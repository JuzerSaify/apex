/**
 * Google OAuth PKCE flow for KeepCode CLI.
 * Opens the user's browser and listens on a local callback server.
 */
import crypto from 'crypto';
import http   from 'http';
import { supabase } from '../db/client.js';
import { saveSession, type StoredSession } from './store.js';

const CALLBACK_PORT = 54321;
const CALLBACK_URL  = `http://localhost:${CALLBACK_PORT}/auth/callback`;

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier  = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export async function startGoogleLogin(): Promise<StoredSession> {
  // 1. Get the OAuth redirect URL from Supabase (skipBrowserRedirect keeps us in control)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: CALLBACK_URL,
      skipBrowserRedirect: true,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error || !data?.url) {
    throw new Error(`Failed to get OAuth URL: ${error?.message ?? 'unknown'}`);
  }

  // 2. Open browser
  const { default: openBrowser } = await import('open');
  console.log('\n  Opening browser for Google Sign-In...\n');
  console.log(`  If the browser didn't open, visit:\n  ${data.url}\n`);
  await openBrowser(data.url);

  // 3. Wait for callback
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 5 minutes'));
    }, 5 * 60 * 1000);

    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/auth/callback')) {
        res.writeHead(404);
        res.end();
        return;
      }

      const url   = new URL(req.url, CALLBACK_URL);
      const code  = url.searchParams.get('code');
      const errParam = url.searchParams.get('error');

      // Send HTML response back to browser
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>KeepCode — Signed In</title>
          <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0d1117;color:#e6edf3}
          .card{text-align:center;padding:40px;border-radius:12px;background:#161b22;border:1px solid #30363d}</style></head>
          <body><div class="card"><h2>✓ KeepCode Authenticated</h2><p>You can close this tab and return to the terminal.</p></div></body>
        </html>
      `);

      clearTimeout(timeout);
      server.close();

      if (errParam) {
        reject(new Error(`OAuth error: ${errParam}`));
        return;
      }

      if (!code) {
        reject(new Error('No auth code in callback'));
        return;
      }

      // 4. Exchange code for session
      const { data: sessionData, error: sessErr } = await supabase.auth.exchangeCodeForSession(code);
      if (sessErr || !sessionData.session) {
        reject(new Error(`Session exchange failed: ${sessErr?.message ?? 'unknown'}`));
        return;
      }

      const sess = sessionData.session;
      const stored: StoredSession = {
        access_token:  sess.access_token,
        refresh_token: sess.refresh_token ?? '',
        expires_at:    sess.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        user: {
          id:           sess.user.id,
          email:        sess.user.email ?? '',
          display_name: sess.user.user_metadata?.['full_name'] as string ?? null,
          avatar_url:   sess.user.user_metadata?.['avatar_url'] as string ?? null,
        },
      };

      await saveSession(stored);
      resolve(stored);
    });

    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      // server is ready
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Callback server error: ${err.message}`));
    });
  });
}
