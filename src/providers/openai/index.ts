/**
 * OpenAI-compatible provider — works with:
 *   • OpenAI API (https://api.openai.com/v1)
 *   • DeepSeek API (https://api.deepseek.com/v1)
 *   • Any OpenAI-compatible endpoint (Groq, Together, local vLLM, etc.)
 */
import type {
  IProvider,
  ChatResponse,
  ModelInfo,
} from '../../types/index.js';
import type { Message, ToolDefinition, AgentConfig } from '../../types/index.js';

interface OAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface OAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OAIResponse {
  id: string;
  choices: Array<{
    message: OAIMessage;
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

interface OAIStreamChunk {
  choices: Array<{
    delta: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

function toOAIMessages(messages: Message[]): OAIMessage[] {
  return messages.map((m) => {
    const content = Array.isArray(m.content)
      ? m.content.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join('\n')
      : (m.content ?? '');

    const msg: OAIMessage = { role: m.role, content };

    // Pass through tool_calls on assistant messages
    if (m.tool_calls && m.tool_calls.length > 0) {
      msg.tool_calls = m.tool_calls.map((tc, i) => ({
        id: `call_${i}`,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function.arguments),
        },
      }));
      msg.content = null;
    }

    // tool role messages need tool_call_id
    if (m.role === 'tool') {
      msg.role = 'tool';
    }

    return msg;
  });
}

function toOAITools(tools: ToolDefinition[]): OAITool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    },
  }));
}

export class OpenAIProvider implements IProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    name = 'openai'
  ) {
    this.name = name;
  }

  async isAlive(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async fetchModels(): Promise<ModelInfo[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!resp.ok) return [];
      const data = await resp.json() as { data: Array<{ id: string }> };
      return data.data.map((m) => ({ name: m.id, supportsTools: true }));
    } catch {
      return [];
    }
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig
  ): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: config.model,
      messages: toOAIMessages(messages),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    };
    if (tools.length > 0) {
      body['tools'] = toOAITools(tools);
      body['tool_choice'] = 'auto';
    }

    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${text}`);
    }

    const data = await resp.json() as OAIResponse;
    const msg = data.choices[0]?.message ?? { role: 'assistant', content: '' };

    const toolCalls = (msg.tool_calls ?? []).map((tc, i) => ({
      id: tc.id ?? `call_${Date.now()}_${i}`,
      name: tc.function.name,
      arguments: (() => {
        try { return JSON.parse(tc.function.arguments) as Record<string, unknown>; }
        catch { return {} as Record<string, unknown>; }
      })(),
    }));

    return {
      content: msg.content ?? '',
      toolCalls,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  async streamFull(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig,
    onToken: (token: string) => void
  ): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: config.model,
      messages: toOAIMessages(messages),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (tools.length > 0) {
      body['tools'] = toOAITools(tools);
      body['tool_choice'] = 'auto';
    }

    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI streaming error ${resp.status}: ${text}`);
    }

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    // Accumulate tool call deltas
    const toolCallAccum: Map<number, {
      id: string; name: string; args: string;
    }> = new Map();

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

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const chunk = JSON.parse(trimmed.slice(6)) as OAIStreamChunk;
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              onToken(delta.content);
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (!toolCallAccum.has(tc.index)) {
                  toolCallAccum.set(tc.index, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' });
                }
                const acc = toolCallAccum.get(tc.index)!;
                if (tc.id) acc.id = tc.id;
                if (tc.function?.name) acc.name = tc.function.name;
                if (tc.function?.arguments) acc.args += tc.function.arguments;
              }
            }
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens;
              outputTokens = chunk.usage.completion_tokens;
            }
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const toolCalls = [...toolCallAccum.values()].map((tc, i) => ({
      id: tc.id || `call_${Date.now()}_${i}`,
      name: tc.name,
      arguments: (() => {
        try { return JSON.parse(tc.args) as Record<string, unknown>; }
        catch { return {} as Record<string, unknown>; }
      })(),
    }));

    return { content: fullContent, toolCalls, inputTokens, outputTokens };
  }
}
