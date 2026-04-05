/**
 * Google OAuth PKCE flow for KeepCode CLI.
 * Opens the user's browser and listens on a local callback server.
 */
import http   from 'http';
import { supabase } from '../db/client.js';
import { saveSession, type StoredSession } from './store.js';

const CALLBACK_PORT = 54321;
const CALLBACK_URL  = `http://localhost:${CALLBACK_PORT}/auth/callback`;

function buildHtml(success: boolean, errorMsg: string): string {
  const icon   = success ? '\u2714' : '\u2718';
  const title  = success ? 'KeepCode \u2014 Signed In' : 'KeepCode \u2014 Sign-In Failed';
  const heading = success ? `${icon} Signed in successfully` : `${icon} Sign-in failed`;
  const body    = success
    ? 'You can close this tab and return to your terminal.'
    : `<p style="color:#f87171">${errorMsg}</p><p>Return to your terminal and try <code>keepcode login</code> again.</p>`;
  const accent  = success ? '#10B981' : '#EF4444';
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
           display:flex;justify-content:center;align-items:center;
           min-height:100vh;background:#0d1117;color:#e6edf3}
      .card{text-align:center;padding:48px 56px;border-radius:16px;
            background:#161b22;border:1px solid #30363d;max-width:460px;width:90%}
      h2{font-size:1.5rem;margin-bottom:12px;color:${accent}}
      p{color:#8b949e;line-height:1.6;margin-top:8px}
      code{background:#21262d;padding:2px 7px;border-radius:5px;
           font-family:'SF Mono','Fira Code',monospace;font-size:.875rem}
      .icon{font-size:3rem;margin-bottom:16px;display:block}
    </style>
  </head>
  <body>
    <div class="card">
      <span class="icon" style="color:${accent}">${icon}</span>
      <h2>${heading}</h2>
      ${body}
    </div>
  </body>
</html>`;
}

export async function startGoogleLogin(): Promise<StoredSession> {
  // 1. Get the OAuth redirect URL from Supabase
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
  console.log('\n  Opening browser for Google Sign-In...');
  console.log(`\n  ${data.url}\n  ${'\u2191'} If browser did not open, visit this URL manually.\n`);
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

      const url      = new URL(req.url, CALLBACK_URL);
      const code     = url.searchParams.get('code');
      const errParam = url.searchParams.get('error');

      // Clear timeout and close server before responding
      clearTimeout(timeout);
      server.close();

      // ── Error from Google / Supabase ──────────────────────────────────────
      if (errParam) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(buildHtml(false, `OAuth error: ${errParam}`));
        reject(new Error(`OAuth error: ${errParam}`));
        return;
      }

      // ── No code returned ──────────────────────────────────────────────────
      if (!code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(buildHtml(false, 'No authorization code was received.'));
        reject(new Error('No auth code in callback'));
        return;
      }

      // ── Success — send page immediately so browser shows feedback ─────────
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(buildHtml(true, ''));

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

    server.listen(CALLBACK_PORT, '127.0.0.1');

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Callback server error: ${err.message}`));
    });
  });
}
