/**
 * Anthropic Claude provider — uses the native Anthropic Messages API.
 * Supports tool use (function calling) via content blocks.
 */
import type {
  IProvider,
  ChatResponse,
  ModelInfo,
} from '../../types/index.js';
import type { Message, ToolDefinition, AgentConfig } from '../../types/index.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  temperature?: number;
}

interface AnthropicResponse {
  id: string;
  content: AnthropicContent[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

// Anthropic streaming event types
interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  content_block?: AnthropicContent;
  message?: AnthropicResponse;
  usage?: { input_tokens: number; output_tokens: number };
}

function toAnthropicMessages(messages: Message[]): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  let system: string | undefined;
  const result: AnthropicMessage[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      system = Array.isArray(m.content)
        ? m.content.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join('\n')
        : m.content;
      continue;
    }

    const textContent = Array.isArray(m.content)
      ? m.content.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join('\n')
      : (m.content ?? '');

    if (m.role === 'tool') {
      // Tool results must be in a user message with tool_result blocks
      const last = result[result.length - 1];
      const block: AnthropicContent = {
        type: 'tool_result',
        tool_use_id: 'tool_0', // Anthropic requires tool_use_id; we use a placeholder
        content: textContent,
      };
      if (last?.role === 'user' && Array.isArray(last.content)) {
        (last.content as AnthropicContent[]).push(block);
      } else {
        result.push({ role: 'user', content: [block] });
      }
      continue;
    }

    if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
      const blocks: AnthropicContent[] = [];
      if (textContent.trim()) {
        blocks.push({ type: 'text', text: textContent });
      }
      for (const tc of m.tool_calls) {
        blocks.push({
          type: 'tool_use',
          id: 'tool_0',
          name: tc.function.name,
          input: tc.function.arguments ?? {},
        });
      }
      result.push({ role: 'assistant', content: blocks });
      continue;
    }

    result.push({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: textContent,
    });
  }

  return { system, messages: result };
}

export class AnthropicProvider implements IProvider {
  readonly name = 'anthropic';

  constructor(private readonly apiKey: string) {}

  async isAlive(): Promise<boolean> {
    try {
      // Lightweight check — list models endpoint
      const r = await fetch(`${ANTHROPIC_API_URL}/models`, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  async fetchModels(): Promise<ModelInfo[]> {
    return [
      { name: 'claude-opus-4-5', displayName: 'Claude Opus 4.5', supportsTools: true },
      { name: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', supportsTools: true },
      { name: 'claude-haiku-3-5', displayName: 'Claude Haiku 3.5', supportsTools: true },
      { name: 'claude-3-7-sonnet-20250219', displayName: 'Claude 3.7 Sonnet', supportsTools: true },
      { name: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet', supportsTools: true },
      { name: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku', supportsTools: true },
      { name: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus', supportsTools: true },
    ];
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig
  ): Promise<ChatResponse> {
    const { system, messages: anthropicMsgs } = toAnthropicMessages(messages);

    const body: AnthropicRequest = {
      model: config.model,
      max_tokens: config.maxTokens,
      messages: anthropicMsgs,
      temperature: config.temperature,
    };
    if (system) body.system = system;
    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Record<string, unknown>,
      }));
    }

    const resp = await fetch(`${ANTHROPIC_API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${text}`);
    }

    const data = await resp.json() as AnthropicResponse;
    let content = '';
    const toolCalls: ChatResponse['toolCalls'] = [];

    for (const block of data.content) {
      if (block.type === 'text') content += block.text;
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return {
      content,
      toolCalls,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  }

  async streamFull(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig,
    onToken: (token: string) => void
  ): Promise<ChatResponse> {
    const { system, messages: anthropicMsgs } = toAnthropicMessages(messages);

    const body: AnthropicRequest & { stream: true } = {
      model: config.model,
      max_tokens: config.maxTokens,
      messages: anthropicMsgs,
      temperature: config.temperature,
      stream: true,
    };
    if (system) body.system = system;
    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Record<string, unknown>,
      }));
    }

    const resp = await fetch(`${ANTHROPIC_API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Anthropic streaming error ${resp.status}: ${text}`);
    }

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    // Track tool use blocks being streamed
    const toolBlocks: Map<number, { id: string; name: string; inputJson: string }> = new Map();

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event: ')) {
            eventType = trimmed.slice(7);
          } else if (trimmed.startsWith('data: ')) {
            try {
              const event = JSON.parse(trimmed.slice(6)) as AnthropicStreamEvent;
              if (eventType === 'content_block_start' && event.content_block?.type === 'tool_use') {
                const idx = event.index ?? 0;
                toolBlocks.set(idx, {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  inputJson: '',
                });
              } else if (eventType === 'content_block_delta') {
                if (event.delta?.type === 'text_delta' && event.delta.text) {
                  fullContent += event.delta.text;
                  onToken(event.delta.text);
                } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
                  const idx = event.index ?? 0;
                  const block = toolBlocks.get(idx);
                  if (block) block.inputJson += event.delta.partial_json;
                }
              } else if (eventType === 'message_delta' && event.usage) {
                outputTokens = event.usage.output_tokens;
              } else if (eventType === 'message_start' && event.message?.usage) {
                inputTokens = event.message.usage.input_tokens;
              }
            } catch {
              // skip malformed SSE
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const toolCalls = [...toolBlocks.values()].map((tb) => ({
      id: tb.id,
      name: tb.name,
      arguments: (() => {
        try { return JSON.parse(tb.inputJson) as Record<string, unknown>; }
        catch { return {} as Record<string, unknown>; }
      })(),
    }));

    return { content: fullContent, toolCalls, inputTokens, outputTokens };
  }
}
