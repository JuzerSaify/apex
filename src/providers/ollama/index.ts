import { OllamaClient } from './client.js';
import { fetchModels } from './models.js';
import { chat, chatStreamFull, parseToolCalls } from './chat.js';
import type {
  OllamaModel,
  IProvider,
  ChatResponse,
  ModelInfo,
} from '../../types/index.js';
import type { Message, ToolDefinition, AgentConfig } from '../../types/index.js';

/** Wrap OllamaModel into the normalized ModelInfo shape */
function toModelInfo(m: OllamaModel): ModelInfo {
  return {
    name: m.name,
    size: m.size,
    supportsTools: m.details?.families?.includes('llama3') ||
      m.name.includes('llama3') || m.name.includes('mistral') ||
      m.name.includes('qwen') || m.name.includes('phi'),
  };
}

export class OllamaProvider implements IProvider {
  readonly name = 'ollama';
  private client: OllamaClient;

  constructor(baseUrl: string) {
    this.client = new OllamaClient(baseUrl);
  }

  async isAlive(): Promise<boolean> {
    return this.client.ping();
  }

  async fetchModels(): Promise<ModelInfo[]> {
    const models = await fetchModels(this.client);
    return models.map(toModelInfo);
  }

  /** Fetch raw Ollama models (for /models command size display) */
  async fetchOllamaModels(): Promise<OllamaModel[]> {
    return fetchModels(this.client);
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig
  ): Promise<ChatResponse> {
    const raw = await chat(this.client, messages, tools, config);
    const toolCalls = parseToolCalls(raw);
    return {
      content: raw.message.content ?? '',
      toolCalls,
      inputTokens: raw.prompt_eval_count ?? 0,
      outputTokens: raw.eval_count ?? 0,
    };
  }

  async streamFull(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig,
    onToken: (token: string) => void
  ): Promise<ChatResponse> {
    const raw = await chatStreamFull(this.client, messages, tools, config, onToken);
    const toolCalls = parseToolCalls(raw);
    return {
      content: raw.message.content ?? '',
      toolCalls,
      inputTokens: raw.prompt_eval_count ?? 0,
      outputTokens: raw.eval_count ?? 0,
    };
  }
}
