export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
  tool_use_id?: string;
}

export interface Message {
  role: Role;
  content: string | ContentBlock[];
  /** Ollama tool_calls — present on assistant messages that invoked tools */
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
}

export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'calling_tool'
  | 'observing'
  | 'compressing'
  | 'planning'
  | 'complete'
  | 'error'
  | 'aborted';

export type AIProvider = 'ollama' | 'openai' | 'anthropic' | 'deepseek' | 'gemini';

export interface AgentConfig {
  model: string;
  /** Which AI provider to use */
  provider: AIProvider;
  /** API base URL — for Ollama default http://localhost:11434; for cloud providers this is optional override */
  apiBaseUrl: string;
  /** API key — required for openai / anthropic / deepseek */
  apiKey?: string;
  /** @deprecated use apiBaseUrl */
  ollamaUrl?: string;
  temperature: number;
  maxIterations: number;
  contextWindow: number;
  maxTokens: number;
  workingDir: string;
  autoApprove: boolean;
  verbose: boolean;
  sessionId: string;
}

export interface AgentState {
  status: AgentStatus;
  iterations: number;
  messages: Message[];
  toolCallCount: number;
  startTime: number;
  /** Cumulative output tokens across all LLM calls in this run */
  tokenCount: number;
  /** Cumulative input (prompt) tokens across all LLM calls in this run */
  inputTokenCount: number;
  error?: string;
  result?: string;
  plan?: string[];
  currentStep?: number;
}

export interface RunRecord {
  id: string;
  timestamp: string;
  task: string;
  model: string;
  iterations: number;
  toolsUsed: string[];
  errors: string[];
  successful: boolean;
  timeMs: number;
  score: number;
  insights: string[];
}

export interface TrainingData {
  version: string;
  runs: RunRecord[];
  globalInsights: string[];
  skillsLearned: Record<string, string[]>;
  lastUpdated: string;
}
