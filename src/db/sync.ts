/**
 * Cloud sync — persists agent sessions and memory to Supabase.
 * Operations are best-effort: errors are logged but never crash the agent.
 */
import crypto from 'crypto';
import { supabase } from './client.js';
import { auth } from '../auth/index.js';

// ── Session ───────────────────────────────────────────────────────────────────

export interface SessionRecord {
  sessionId:  string;
  task:       string;
  model:      string;
  provider:   string;
  status:     'running' | 'complete' | 'error' | 'aborted';
  result?:    string;
  iterations: number;
  toolCalls:  number;
  tokenCount: number;
  durationMs?: number;
  createdAt?: string;
}

export async function saveSessionToCloud(record: SessionRecord): Promise<void> {
  const user = await auth.getUser();
  if (!user) return;

  await supabase.from('agent_sessions').upsert({
    user_id:      user.id,
    session_id:   record.sessionId,
    task:         record.task,
    model:        record.model,
    provider:     record.provider,
    status:       record.status,
    result:       record.result,
    iterations:   record.iterations,
    tool_calls:   record.toolCalls,
    token_count:  record.tokenCount,
    duration_ms:  record.durationMs,
    completed_at: ['complete', 'error', 'aborted'].includes(record.status) ? new Date().toISOString() : undefined,
  }, { onConflict: 'session_id' });
}

export async function listRecentSessions(limit = 10): Promise<SessionRecord[]> {
  const user = await auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('agent_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    sessionId:  r.session_id as string,
    task:       r.task as string,
    model:      r.model as string,
    provider:   r.provider as string,
    status:     r.status as SessionRecord['status'],
    result:     r.result as string | undefined,
    iterations: r.iterations as number,
    toolCalls:  r.tool_calls as number,
    tokenCount: r.token_count as number,
    durationMs: r.duration_ms as number | undefined,
    createdAt:  r.created_at as string | undefined,
  }));
}

// ── Memory ─────────────────────────────────────────────────────────────────────

function hashProject(workingDir: string): string {
  return crypto.createHash('sha256').update(workingDir).digest('hex').slice(0, 16);
}

export async function syncMemoryToCloud(workingDir: string, content: string): Promise<void> {
  const user = await auth.getUser();
  if (!user) return;

  const projectHash = hashProject(workingDir);
  const projectName = workingDir.split(/[/\\]/).pop() ?? workingDir;

  await supabase.from('agent_memory').upsert({
    user_id:      user.id,
    project_hash: projectHash,
    project_name: projectName,
    content,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'user_id,project_hash' });
}

export async function loadMemoryFromCloud(workingDir: string): Promise<string | null> {
  const user = await auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('agent_memory')
    .select('content')
    .eq('user_id', user.id)
    .eq('project_hash', hashProject(workingDir))
    .single();

  return (data?.content as string) ?? null;
}
