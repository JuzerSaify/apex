import { OllamaClient } from './client.js';
import { fetchModels } from './models.js';
import { chat, chatStream, chatStreamFull, parseToolCalls } from './chat.js';
import type {
  OllamaModel,
  OllamaChatResponse,
  OllamaStreamChunk,
  IProvider,
} from '../../types/index.js';
import type { Message, ToolDefinition, ToolCall, AgentConfig } from '../../types/index.js';

export class OllamaProvider implements IProvider {
  readonly name = 'ollama';
  private client: OllamaClient;

  constructor(baseUrl: string) {
    this.client = new OllamaClient(baseUrl);
  }

  async isAlive(): Promise<boolean> {
    return this.client.ping();
  }

  async fetchModels(): Promise<OllamaModel[]> {
    return fetchModels(this.client);
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig
  ): Promise<OllamaChatResponse> {
    return chat(this.client, messages, tools, config);
  }

  async *stream(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig
  ): AsyncGenerator<OllamaStreamChunk> {
    yield* chatStream(this.client, messages, tools, config);
  }

  /** Stream tokens via callback and return the full response (no second API call). */
  async streamFull(
    messages: Message[],
    tools: ToolDefinition[],
    config: AgentConfig,
    onToken: (token: string) => void
  ): Promise<OllamaChatResponse> {
    return chatStreamFull(this.client, messages, tools, config, onToken);
  }

  parseToolCalls(response: OllamaChatResponse): ToolCall[] {
    return parseToolCalls(response);
  }
}
