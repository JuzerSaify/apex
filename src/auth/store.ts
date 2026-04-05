/**
 * Local session storage for KeepCode auth.
 * Persists the Supabase session to ~/.keepcode/auth.json with restricted permissions.
 */
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const AUTH_DIR  = path.join(os.homedir(), '.keepcode');
const AUTH_FILE = path.join(AUTH_DIR, 'auth.json');

export interface StoredSession {
  access_token:  string;
  refresh_token: string;
  expires_at:    number;  // unix seconds
  user: {
    id:           string;
    email:        string;
    display_name: string | null;
    avatar_url:   string | null;
  };
}

export async function saveSession(session: StoredSession): Promise<void> {
  await fs.mkdir(AUTH_DIR, { recursive: true });
  await fs.writeFile(AUTH_FILE, JSON.stringify(session, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await fs.readFile(AUTH_FILE, 'utf8');
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await fs.unlink(AUTH_FILE);
  } catch {
    // already gone
  }
}
