import type { AgentConfig } from '../types/index.js';

export const DEFAULT_CONFIG: Omit<AgentConfig, 'sessionId'> = {
  model: '',
  provider: 'ollama',
  apiBaseUrl: 'http://localhost:11434',
  temperature: 0.7,
  maxIterations: 50,
  contextWindow: 16384,
  maxTokens: 8192,
  workingDir: process.cwd(),
  autoApprove: false,
  verbose: false,
};

// Provider base URLs
export const OPENAI_BASE_URL    = 'https://api.openai.com/v1';
export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
export const DEEPSEEK_BASE_URL  = 'https://api.deepseek.com/v1';
export const GEMINI_BASE_URL    = 'https://generativelanguage.googleapis.com/v1beta';
export const OLLAMA_BASE_URL    = 'http://localhost:11434';

export const KEEPCODE_DIR = '.keepcode';
export const MEMORY_FILE = '.keepcode/memory.md';
export const TRAINING_FILE = '.keepcode/training/insights.json';
export const CHECKPOINTS_DIR = '.keepcode/checkpoints';
export const KNOWLEDGE_DIR = '.keepcode/knowledge';

/** Max number of global insights to inject into each prompt */
export const MAX_INJECTED_INSIGHTS = 6;
/** Max bytes of a file KeepCode will read in one call */
export const MAX_FILE_READ_BYTES = 512 * 1024;
/** Max bytes returned from fetch_url */
export const MAX_FETCH_BYTES = 120 * 1024;
/** bash timeout ms */
export const BASH_TIMEOUT_MS = 120_000;
/** Min chars in a code block before syntax-highlight preview is truncated */
export const PREVIEW_MAX_LINES = 40;
/** Context utilization ratio before triggering compression */
export const COMPRESS_THRESHOLD = 0.82;
