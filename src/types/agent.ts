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

export interface AgentConfig {
  model: string;
  ollamaUrl: string;
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
  tokenCount: number;
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
