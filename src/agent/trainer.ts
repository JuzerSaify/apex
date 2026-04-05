import { promises as fs } from 'fs';
import path from 'path';
import { TRAINING_FILE } from '../config/defaults.js';
import type { AgentConfig, AgentState, TrainingData, RunRecord } from '../types/index.js';

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function scoreRun(state: AgentState): number {
  if (!state.result) return 0.1;
  if (state.status === 'aborted') return 0.2;
  if (state.status === 'error') return 0.3;
  // Higher score for fewer iterations (more efficient)
  const efficiencyBonus = Math.max(0, 1 - state.iterations / 30) * 0.3;
  return Math.min(1.0, 0.7 + efficiencyBonus);
}

function extractToolsUsed(state: AgentState): string[] {
  const toolNames = new Set<string>();
  for (const msg of state.messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.function?.name) toolNames.add(tc.function.name);
      }
    }
  }
  return Array.from(toolNames);
}

export async function recordRun(
  config: AgentConfig,
  task: string,
  state: AgentState,
  insights: string[]
): Promise<void> {
  const tPath = path.join(config.workingDir, TRAINING_FILE);
  await fs.mkdir(path.dirname(tPath), { recursive: true });

  let data: TrainingData;
  try {
    const raw = await fs.readFile(tPath, 'utf8');
    data = JSON.parse(raw) as TrainingData;
  } catch {
    data = {
      version: '1.0.0',
      runs: [],
      globalInsights: [],
      skillsLearned: {},
      lastUpdated: '',
    };
  }

  const record: RunRecord = {
    id: generateRunId(),
    timestamp: new Date().toISOString(),
    task: task.slice(0, 200),
    model: config.model,
    iterations: state.iterations,
    toolsUsed: extractToolsUsed(state),
    errors: state.error ? [state.error.slice(0, 200)] : [],
    successful: state.status === 'complete',
    timeMs: Date.now() - state.startTime,
    score: scoreRun(state),
    insights,
  };

  data.runs = [record, ...data.runs].slice(0, 100); // keep last 100 runs

  // Merge new insights into global insights (dedup)
  for (const insight of insights) {
    if (!data.globalInsights.includes(insight)) {
      data.globalInsights.unshift(insight);
    }
  }
  data.globalInsights = data.globalInsights.slice(0, 50); // keep top 50

  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(tPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Generate self-reflection insights by analyzing the run */
export function deriveInsights(state: AgentState, task: string): string[] {
  const insights: string[] = [];

  if (state.status === 'complete' && state.iterations <= 5) {
    insights.push(`For tasks like "${task.slice(0, 60)}..." — solved efficiently in ${state.iterations} iterations`);
  }

  if (state.error?.includes('old_string not found')) {
    insights.push('Always use read_file with exact line numbers before calling edit_file to ensure the old_string matches exactly');
  }

  if (state.error?.includes('Cannot find module')) {
    insights.push('When creating TypeScript files, verify import paths include .js extensions for ESM compatibility');
  }

  if (state.iterations >= 20 && state.status === 'complete') {
    insights.push(`Complex tasks may require incremental verification — complete smaller steps before proceeding`);
  }

  if (state.toolCallCount > 0 && state.status === 'complete') {
    const toolsPerIteration = state.toolCallCount / state.iterations;
    if (toolsPerIteration > 3) {
      insights.push('Batch related file operations when possible to reduce iteration count');
    }
  }

  return insights;
}
