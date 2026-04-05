import type { Message, AgentConfig } from '../types/index.js';
import { COMPRESS_THRESHOLD } from '../config/defaults.js';

/** Estimate token count (rough: 1 token ≈ 4 chars) */
export function estimateTokens(messages: Message[]): number {
  let total = 0;
  for (const m of messages) {
    const content = Array.isArray(m.content)
      ? m.content.map((b) => b.text ?? b.content ?? '').join(' ')
      : m.content;
    total += Math.ceil(content.length / 4);
  }
  return total;
}

/** Check if context is above threshold and compression is needed */
export function needsCompression(messages: Message[], config: AgentConfig): boolean {
  const tokens = estimateTokens(messages);
  const threshold = config.contextWindow * COMPRESS_THRESHOLD;
  return tokens > threshold;
}

/**
 * Compress conversation history: keep system + first user message + last N turns.
 * Inserts a synthetic summary message at compression boundary.
 */
export function compressMessages(
  messages: Message[],
  keepLastTurns = 8
): { compressed: Message[]; removedCount: number } {
  if (messages.length <= keepLastTurns + 2) {
    return { compressed: messages, removedCount: 0 };
  }

  const system = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const firstUser = nonSystem.slice(0, 1);
  const tail = nonSystem.slice(-keepLastTurns);
  const removedCount = nonSystem.length - keepLastTurns - 1;

  const summaryMsg: Message = {
    role: 'user',
    content: `[CONTEXT COMPRESSED: ${removedCount} earlier messages were summarized to save context window space. The task and most recent tool calls are preserved above.]`,
  };

  return {
    compressed: [...system, ...firstUser, summaryMsg, ...tail],
    removedCount,
  };
}
