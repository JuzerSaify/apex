import { buildSystemPrompt } from '../prompt/builder.js';
import { createProvider } from '../providers/factory.js';
import { executeTool, promptApproval } from '../tools/executor.js';
import { getToolDefinitions } from '../tools/registry.js';
import { TASK_COMPLETE_SIGNAL } from '../tools/utility/task_complete.js';
import { needsCompression, compressMessages, estimateTokens } from './compressor.js';
import { recordRun, deriveInsights } from './trainer.js';
import { initDirs } from './memory.js';
import { getMCPToolDefinitions, callMCPTool, isMCPTool } from '../mcp/manager.js';
import { saveSessionToCloud } from '../db/sync.js';
import type {
  AgentConfig,
  AgentState,
  Message,
  AgentEvent,
  EventListener,
  IProvider,
} from '../types/index.js';

export class KeepCodeAgent {
  private listeners: EventListener[] = [];
  private abortRequested = false;
  private provider: IProvider;
  private sessionMemory = new Map<string, string>();
  private noToolStreak = 0;
  /** Consecutive tool calls that returned errors — used to detect stuck loops */
  private toolErrorStreak = 0;

  constructor(private config: AgentConfig) {
    this.provider = createProvider(config);
  }

  on(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  abort(): void {
    this.abortRequested = true;
    this.emit({ type: 'abort' });
  }

  private emit(event: AgentEvent): void {
    for (const l of this.listeners) l(event);
  }

  async run(userTask: string, priorMessages: Message[] = []): Promise<AgentState> {
    this.abortRequested = false;
    await initDirs(this.config.workingDir);

    const systemPrompt = await buildSystemPrompt(this.config, userTask);
    // Merge local tools + any connected MCP tools
    const mcpToolDefs = await getMCPToolDefinitions().catch(() => []);
    const tools = [...getToolDefinitions(), ...mcpToolDefs];

    const state: AgentState = {
      status: 'thinking',
      iterations: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        ...priorMessages,
        { role: 'user', content: userTask },
      ],
      toolCallCount: 0,
      startTime: Date.now(),
      tokenCount: 0,
    };

    this.noToolStreak = 0;
    this.toolErrorStreak = 0;

    while (state.iterations < this.config.maxIterations) {
      if (this.abortRequested) {
        state.status = 'aborted';
        break;
      }

      state.iterations++;
      this.emit({
        type: 'iteration_start',
        iteration: state.iterations,
        maxIterations: this.config.maxIterations,
      });

      // Compress if near context limit
      if (needsCompression(state.messages, this.config)) {
        const beforeTokens = estimateTokens(state.messages);
        this.emit({ type: 'status_change', status: 'compressing', message: 'Compressing context...' });
        const { compressed } = compressMessages(state.messages, 10);
        state.messages = compressed;
        this.emit({
          type: 'compress',
          fromTokens: beforeTokens,
          toTokens: estimateTokens(compressed),
        });
      }

      let response;
      try {
        this.emit({ type: 'status_change', status: 'thinking' });

        if (this.config.verbose) {
          // Stream tokens for display AND collect the full response (tool_calls included) in
          // one pass — avoids the previous double-call bug.
          response = await this.provider.streamFull(
            state.messages,
            tools,
            this.config,
            (token) => this.emit({ type: 'token', token })
          );
          state.tokenCount += response.outputTokens;
        } else {
          response = await this.provider.chat(state.messages, tools, this.config);
          state.tokenCount += response.outputTokens;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        state.status = 'error';
        state.error = msg;
        this.emit({ type: 'error', message: msg, recoverable: false });
        break;
      }

      const assistantContent = response.content ?? '';
      const toolCalls = response.toolCalls;

      // Emit thought if there's a text response
      if (assistantContent.trim()) {
        this.emit({ type: 'thought', content: assistantContent });
      }

      // If the model returned text with no tool calls — check for completion
      if (toolCalls.length === 0) {
        state.messages.push({ role: 'assistant', content: assistantContent });
        this.noToolStreak++;

        // Explicit task_complete signal in text (some models inline it)
        if (assistantContent.includes(TASK_COMPLETE_SIGNAL)) {
          state.status = 'complete';
          state.result = assistantContent;
          this.emit({ type: 'complete', summary: assistantContent, state });
          break;
        }

        // Model stalled: 3 textual turns in a row with no tools → nudge once more then exit
        if (this.noToolStreak >= 3) {
          state.status = 'complete';
          state.result = assistantContent;
          this.emit({ type: 'complete', summary: assistantContent, state });
          break;
        }

        // Nudge the model to continue using tools or signal completion
        this.emit({ type: 'status_change', status: 'thinking', message: 'Awaiting tool use...' });
        const nudgeMsg = this.noToolStreak === 1
          ? 'You responded with text but no tool calls. Continue the task using your available tools, or call task_complete if fully done and verified.'
          : `You have not used any tools in the last ${this.noToolStreak} turns. You MUST call a tool now — use task_complete if the task is fully verified and done, or use the appropriate tool to continue working.`;
        state.messages.push({
          role: 'user',
          content: nudgeMsg,
        });
        continue;
      }

      // Tool calls received — reset the stall counter
      this.noToolStreak = 0;

      // Emit plan event if model used the think tool with numbered steps
      const thinkCall = toolCalls.find((c) => c.name === 'think');
      if (thinkCall) {
        const thought = String(thinkCall.arguments.thought ?? '');
        const steps = thought
          .split('\n')
          .filter((l) => /^\s*\d+[.):\-]\s+/.test(l))
          .map((l) => l.replace(/^\s*\d+[.):\-]\s+/, '').trim())
          .filter(Boolean);
        if (steps.length >= 2) {
          this.emit({ type: 'plan', steps });
        }
      }

      // Push assistant message WITH tool_calls so the model sees what it called in history
      state.messages.push({
        role: 'assistant',
        content: assistantContent,
        tool_calls: toolCalls.map((tc) => ({
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // Execute all tool calls
      this.emit({ type: 'status_change', status: 'calling_tool' });

      for (const call of toolCalls) {
        if (this.abortRequested) break;

        this.emit({ type: 'tool_call', call });
        state.toolCallCount++;

        // Route to MCP if the tool belongs to a connected MCP server
        let result: { output: string; error?: boolean; tool_call_id: string; name: string };
        if (isMCPTool(call.name)) {
          try {
            const mcpOut = await callMCPTool(call.name, call.arguments);
            result = { tool_call_id: call.id, name: call.name, output: mcpOut ?? 'MCP tool returned no output' };
          } catch (err) {
            result = { tool_call_id: call.id, name: call.name, output: String(err), error: true };
          }
        } else {
          result = await executeTool(
            call,
            this.config,
            this.config.autoApprove ? undefined : promptApproval
          );
        }

        this.emit({ type: 'tool_result', result });

        // Track errors and inject a recovery hint so the model pivots strategies
        if (result.error) {
          this.toolErrorStreak++;
          const hint = this.toolErrorStreak >= 2
            ? `\n[AGENT HINT] ${this.toolErrorStreak} consecutive tool errors detected. Try a completely different approach or tool.`
            : `\n[AGENT HINT] Tool "${call.name}" failed. Try with different arguments or use an alternative tool.`;
          state.messages.push({
            role: 'tool',
            content: result.output + hint,
          });
        } else {
          this.toolErrorStreak = 0;
          state.messages.push({
            role: 'tool',
            content: result.output,
          });
        }

        // Check if task_complete was called
        if (result.output.startsWith(TASK_COMPLETE_SIGNAL)) {
          const summary = result.output.slice(TASK_COMPLETE_SIGNAL.length).trim();
          state.status = 'complete';
          state.result = summary;
          this.emit({ type: 'complete', summary, state });

          // Record training data asynchronously
          const insights = deriveInsights(state, userTask);
          recordRun(this.config, userTask, state, insights).catch(() => {});
          // Sync session to Supabase cloud (best-effort)
          saveSessionToCloud({
            sessionId:  this.config.sessionId,
            task:       userTask,
            model:      this.config.model,
            provider:   this.config.provider,
            status:     'complete',
            result:     summary,
            iterations: state.iterations,
            toolCalls:  state.toolCallCount,
            tokenCount: state.tokenCount,
            durationMs: Date.now() - state.startTime,
          }).catch(() => {});
          return state;
        }
      }

      this.emit({ type: 'status_change', status: 'observing' });
    }

    if (state.iterations >= this.config.maxIterations && state.status !== 'complete') {
      state.status = 'error';
      state.error = `Reached max iterations (${this.config.maxIterations})`;
      // Capture the last meaningful assistant message as the result
      const lastAssistant = [...state.messages]
        .reverse()
        .find((m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim());
      if (lastAssistant) state.result = lastAssistant.content as string;
      this.emit({ type: 'error', message: state.error, recoverable: false });
    }

    // Record training data
    const insights = deriveInsights(state, userTask);
    recordRun(this.config, userTask, state, insights).catch(() => {});
    // Sync session to Supabase cloud (best-effort)
    saveSessionToCloud({
      sessionId:  this.config.sessionId,
      task:       userTask,
      model:      this.config.model,
      provider:   this.config.provider,
      status:     state.status as 'complete' | 'error' | 'aborted',
      result:     state.result,
      iterations: state.iterations,
      toolCalls:  state.toolCallCount,
      tokenCount: state.tokenCount,
      durationMs: Date.now() - state.startTime,
    }).catch(() => {});

    return state;
  }
}
