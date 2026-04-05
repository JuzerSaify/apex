/**
 * Provider factory — instantiates the right provider based on AgentConfig.provider.
 *
 * Supported providers:
 *   • ollama     — local Ollama instance (default, free)
 *   • openai     — OpenAI API (GPT-4o, o3, o4-mini, etc.)
 *   • anthropic  — Anthropic API (Claude family)
 *   • deepseek   — DeepSeek API (OpenAI-compatible)
 *   • gemini     — Google Gemini API (gemini-2.5-pro, gemini-2.0-flash, etc.)
 */
import { OllamaProvider } from './ollama/index.js';
import { OpenAIProvider } from './openai/index.js';
import { AnthropicProvider } from './anthropic/index.js';
import { GeminiProvider } from './gemini/index.js';
import {
  OPENAI_BASE_URL,
  DEEPSEEK_BASE_URL,
  OLLAMA_BASE_URL,
} from '../config/defaults.js';
import type { IProvider } from '../types/index.js';
import type { AgentConfig } from '../types/index.js';

export { OllamaProvider }    from './ollama/index.js';
export { OpenAIProvider }    from './openai/index.js';
export { AnthropicProvider } from './anthropic/index.js';
export { GeminiProvider }    from './gemini/index.js';

export function createProvider(config: AgentConfig): IProvider {
  switch (config.provider) {
    case 'openai': {
      if (!config.apiKey) throw new Error('OpenAI requires an API key (--api-key or OPENAI_API_KEY)');
      const base = config.apiBaseUrl && config.apiBaseUrl !== OLLAMA_BASE_URL
        ? config.apiBaseUrl
        : OPENAI_BASE_URL;
      return new OpenAIProvider(config.apiKey, base, 'openai');
    }

    case 'anthropic': {
      if (!config.apiKey) throw new Error('Anthropic requires an API key (--api-key or ANTHROPIC_API_KEY)');
      return new AnthropicProvider(config.apiKey);
    }

    case 'deepseek': {
      if (!config.apiKey) throw new Error('DeepSeek requires an API key (--api-key or DEEPSEEK_API_KEY)');
      const base = config.apiBaseUrl && config.apiBaseUrl !== OLLAMA_BASE_URL
        ? config.apiBaseUrl
        : DEEPSEEK_BASE_URL;
      return new OpenAIProvider(config.apiKey, base, 'deepseek');
    }

    case 'gemini': {
      if (!config.apiKey) throw new Error('Gemini requires an API key (--api-key or GOOGLE_API_KEY)');
      return new GeminiProvider(config.apiKey);
    }

    case 'ollama':
    default: {
      const base = config.apiBaseUrl ?? OLLAMA_BASE_URL;
      return new OllamaProvider(base);
    }
  }
}
