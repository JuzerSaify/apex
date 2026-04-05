/**
 * Google Gemini provider — uses the Google Generative Language API (v1beta).
 *
 * Supported models (live-fetched, with static fallback):
 *   gemini-2.5-pro-preview-03-25  — most capable, 1M context
 *   gemini-2.0-flash               — fast + tool calling
 *   gemini-2.0-flash-thinking-exp  — chain-of-thought (no tools)
 *   gemini-1.5-pro-latest          — 2M context
 *   gemini-1.5-flash-latest        — fast + cheap
 *
 * API key: GOOGLE_API_KEY or GEMINI_API_KEY env var (or --api-key flag)
 */
import type { IProvider, ChatResponse, ModelInfo } from '../../types/index.js';
import type { Message, ToolDefinition, AgentConfig } from '../../types/index.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ── Internal wire types ────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { content: unknown } };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  tools?: [{ functionDeclarations: GeminiFunctionDeclaration[] }];
  systemInstruction?: { parts: [{ text: string }] };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    candidateCount?: 1;
  };
}

interface GeminiCandidate {
  content: { parts: GeminiPart[]; role: 'model' };
  finishReason: string;
}

interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
  error?: { code: number; message: string; status: string };
}

interface GeminiModelEntry {
  name: string;
  displayName: string;
  supportedGenerationMethods: string[];
}

// ── Message conversion ─────────────────────────────────────────────────────

function toGeminiContents(messages: Message[]): {
  system: string | undefined;
  contents: GeminiContent[];
} {
  let system: string | undefined;
  const contents: GeminiContent[] = [];

  for (const m of messages) {
    const textContent = Array.isArray(m.content)
      ? m.content.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join('\n')
      : (m.content ?? '');

    if (m.role === 'system') {
      system = textContent;
      continue;
    }

    if (m.role === 'assistant') {
      const parts: GeminiPart[] = [];
      if (textContent.trim()) parts.push({ text: textContent });
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: tc.function.arguments ?? {},
            },
          });
        }
      }
      if (parts.length > 0) contents.push({ role: 'model', parts });
      continue;
    }

    if (m.role === 'tool') {
      // Gemini tool results live in a user turn as functionResponse parts
      const last = contents[contents.length - 1];
      const part: GeminiPart = {
        functionResponse: { name: 'tool', response: { content: textContent } },
      };
      if (last?.role === 'user') {
        last.parts.push(part);
      } else {
        contents.push({ role: 'user', parts: [part] });
      }
      continue;
    }

    // user
    contents.push({ role: 'user', parts: [{ text: textContent || ' ' }] });
  }

  // Gemini requires conversation to start with a user turn
  if (contents.length === 0 || contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: ' ' }] });
  }

  return { system, contents };
}

// ── Response parsing ───────────────────────────────────────────────────────

function parseGeminiResponse(data: GeminiResponse): ChatResponse {
  if (data.error) {
    throw new Error(`Gemini API error ${data.error.code}: ${data.error.message}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    return { content: '', toolCalls: [], inputTokens: 0, outputTokens: 0 };
  }

  let content = '';
  const toolCalls: ChatResponse['toolCalls'] = [];

  for (const part of candidate.content.parts) {
    if (part.text) content += part.text;
    if (part.functionCall) {
      toolCalls.push({
        id: `gemini_${Date.now()}_${toolCalls.length}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args,
      });
    }
  }

  return {
    content,
    toolCalls,
    inputTokens:  data.usageMetadata?.promptTokenCount     ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// ── Provider ───────────────────────────────────────────────────────────────

export class GeminiProvider implements IProvider {
  readonly name = 'gemini';

  constructor(private readonly apiKey: string) {}

  private key(): string {
    return encodeURIComponent(this.apiKey);
  }

  async isAlive(): Promise<boolean> {
    try {
      const resp = await fetch(
        `${GEMINI_API_BASE}/models?key=${this.key()}&pageSize=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      return resp.ok;
    } catch {
      return false;
    }
  }

  async fetchModels(): Promise<ModelInfo[]> {
    try {
      const resp = await fetch(
        `${GEMINI_API_BASE}/models?key=${this.key()}&pageSize=100`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!resp.ok) return this.staticModels();

      const data = await resp.json() as { models?: GeminiModelEntry[] };
      const models: ModelInfo[] = (data.models ?? [])
        .filter((m) => {
          const id = m.name.replace('models/', '');
          return id.startsWith('gemini-') &&
            m.supportedGenerationMethods.includes('generateContent');
        })
        .map((m) => ({
          name:         m.name.replace('models/', ''),
          displayName:  m.displayName,
          supportsTools: !m.name.includes('thinking'),
        }));

      return models.length > 0 ? models : this.staticModels();
    } catch {
      return this.staticModels();
    }
  }

  private staticModels(): ModelInfo[] {
    return [
      { name: 'gemini-2.5-pro-preview-03-25', displayName: 'Gemini 2.5 Pro Preview  (1M ctx)', supportsTools: true  },
      { name: 'gemini-2.0-flash',              displayName: 'Gemini 2.0 Flash',                supportsTools: true  },
      { name: 'gemini-2.0-flash-thinking-exp', displayName: 'Gemini 2.0 Flash Thinking',       supportsTools: false },
      { name: 'gemini-1.5-pro-latest',         displayName: 'Gemini 1.5 Pro  (2M ctx)',         supportsTools: true  },
      { name: 'gemini-1.5-flash-latest',       displayName: 'Gemini 1.5 Flash',                supportsTools: true  },
    ];
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig
  ): Promise<ChatResponse> {
    const { system, contents } = toGeminiContents(messages);
    const body = this.buildBody(system, contents, tools, config);
    const url = `${GEMINI_API_BASE}/models/${config.model}:generateContent?key=${this.key()}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gemini API error ${resp.status}: ${text}`);
    }

    return parseGeminiResponse(await resp.json() as GeminiResponse);
  }

  async streamFull(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig,
    onToken: (token: string) => void
  ): Promise<ChatResponse> {
    const { system, contents } = toGeminiContents(messages);
    const body = this.buildBody(system, contents, tools, config);
    const url = `${GEMINI_API_BASE}/models/${config.model}:streamGenerateContent?alt=sse&key=${this.key()}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gemini stream error ${resp.status}: ${text}`);
    }

    let fullContent = '';
    let inputTokens  = 0;
    let outputTokens = 0;
    const toolCalls: ChatResponse['toolCalls'] = [];

    const reader  = resp.body!.getReader();
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
          if (!trimmed.startsWith('data: ')) continue;
          const raw = trimmed.slice(6).trim();
          if (raw === '[DONE]' || raw === '') continue;
          try {
            const chunk = JSON.parse(raw) as GeminiResponse;
            const candidate = chunk.candidates?.[0];
            if (candidate?.content) {
              for (const part of candidate.content.parts) {
                if (part.text) {
                  fullContent += part.text;
                  onToken(part.text);
                }
                if (part.functionCall) {
                  toolCalls.push({
                    id:        `gemini_${Date.now()}_${toolCalls.length}`,
                    name:      part.functionCall.name,
                    arguments: part.functionCall.args,
                  });
                }
              }
            }
            if (chunk.usageMetadata) {
              inputTokens  = chunk.usageMetadata.promptTokenCount;
              outputTokens = chunk.usageMetadata.candidatesTokenCount;
            }
          } catch {
            // ignore malformed SSE chunk
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent, toolCalls, inputTokens, outputTokens };
  }

  private buildBody(
    system: string | undefined,
    contents: GeminiContent[],
    tools: ToolDefinition[],
    config: AgentConfig
  ): GeminiRequest {
    const body: GeminiRequest = {
      contents,
      generationConfig: {
        temperature:     config.temperature,
        maxOutputTokens: config.maxTokens,
        candidateCount:  1,
      },
    };
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }
    if (tools.length > 0) {
      body.tools = [{
        functionDeclarations: tools.map((t) => ({
          name:        t.name,
          description: t.description,
          parameters:  t.parameters as Record<string, unknown>,
        })),
      }];
    }
    return body;
  }
}
