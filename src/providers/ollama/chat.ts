import type { OllamaClient } from './client.js';
import type {
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaStreamChunk,
  OllamaTool,
  OllamaChatMessage,
} from '../../types/index.js';
import type { Message, ToolDefinition, ToolCall, AgentConfig } from '../../types/index.js';

function toOllamaMessages(messages: Message[]): OllamaChatMessage[] {
  return messages.map((m) => {
    const content = Array.isArray(m.content)
      ? m.content.map((b) => (b.type === 'text' ? b.text ?? '' : '')).join('\n')
      : m.content;
    const msg: OllamaChatMessage = { role: m.role, content };
    // Preserve tool_calls on assistant messages so the model sees what it called
    if (m.tool_calls && m.tool_calls.length > 0) {
      msg.tool_calls = m.tool_calls;
    }
    return msg;
  });
}

function toOllamaTools(tools: ToolDefinition[]): OllamaTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function chat(
  client: OllamaClient,
  messages: Message[],
  tools: ToolDefinition[],
  config: AgentConfig
): Promise<OllamaChatResponse> {
  const body: OllamaChatRequest = {
    model: config.model,
    messages: toOllamaMessages(messages),
    tools: tools.length > 0 ? toOllamaTools(tools) : undefined,
    stream: false,
    options: {
      temperature: config.temperature,
      num_ctx: config.contextWindow,
      num_predict: config.maxTokens,
    },
  };
  return client.post<OllamaChatResponse>('/api/chat', body);
}

export async function* chatStream(
  client: OllamaClient,
  messages: Message[],
  tools: ToolDefinition[],
  config: AgentConfig
): AsyncGenerator<OllamaStreamChunk> {
  const body: OllamaChatRequest = {
    model: config.model,
    messages: toOllamaMessages(messages),
    tools: tools.length > 0 ? toOllamaTools(tools) : undefined,
    stream: true,
    options: {
      temperature: config.temperature,
      num_ctx: config.contextWindow,
      num_predict: config.maxTokens,
    },
  };

  const stream = await client.postStream('/api/chat', body);
  const reader = stream.getReader();
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
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed) as OllamaStreamChunk;
        } catch {
          // skip malformed line
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream tokens to the caller via onToken callback and return the full response
 * (including tool_calls from the final done chunk) without a second API call.
 */
export async function chatStreamFull(
  client: OllamaClient,
  messages: Message[],
  tools: ToolDefinition[],
  config: AgentConfig,
  onToken: (token: string) => void
): Promise<OllamaChatResponse> {
  let fullContent = '';
  let finalChunk: OllamaStreamChunk | null = null;

  for await (const chunk of chatStream(client, messages, tools, config)) {
    const token = chunk.message?.content ?? '';
    if (token) {
      fullContent += token;
      onToken(token);
    }
    if (chunk.done) {
      finalChunk = chunk;
    }
  }

  return {
    model: config.model,
    message: {
      role: 'assistant',
      content: fullContent,
      // tool_calls come in the final done chunk from Ollama
      tool_calls: finalChunk?.message?.tool_calls,
    },
    done: true,
    eval_count: finalChunk?.eval_count ?? 0,
  };
}

export function parseToolCalls(response: OllamaChatResponse): ToolCall[] {
  const raw = response.message?.tool_calls;
  if (!raw || raw.length === 0) return [];
  return raw.map((tc, i) => ({
    id: `call_${Date.now()}_${i}`,
    name: tc.function.name,
    arguments: tc.function.arguments ?? {},
  }));
}
