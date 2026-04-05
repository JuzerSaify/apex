/**
 * AuthManager — manages the current user session for KeepCode CLI.
 *
 * - login()  → triggers Google OAuth browser flow
 * - logout() → clears local session
 * - getUser() → returns current user from local session (with auto-refresh)
 */
import { supabase } from '../db/client.js';
import { loadSession, clearSession, saveSession, type StoredSession } from './store.js';
import { startGoogleLogin } from './google.js';

export type { StoredSession };

export class AuthManager {
  /** Attempt to refresh an expired token; returns null if it fails */
  private async refresh(session: StoredSession): Promise<StoredSession | null> {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
      });
      if (error || !data.session) return null;

      const refreshed: StoredSession = {
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token ?? session.refresh_token,
        expires_at:    data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        user: { ...session.user },
      };
      await saveSession(refreshed);
      return refreshed;
    } catch {
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    return (await this.getUser()) !== null;
  }

  async getUser(): Promise<StoredSession['user'] | null> {
    let session = await loadSession();
    if (!session) return null;

    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at < now + 60) {
      session = await this.refresh(session);
    }

    return session?.user ?? null;
  }

  async getSession(): Promise<StoredSession | null> {
    let session = await loadSession();
    if (!session) return null;

    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at < now + 60) {
      session = await this.refresh(session);
    }

    return session;
  }

  async login(): Promise<StoredSession> {
    return startGoogleLogin();
  }

  async logout(): Promise<void> {
    try {
      const s = await loadSession();
      if (s) {
        await supabase.auth.admin.signOut(s.user.id);
      }
    } catch {
      // ignore signOut errors
    }
    await clearSession();
  }
}

export const auth = new AuthManager();
