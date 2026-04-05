import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * http_request — make HTTP requests with custom method, headers, and body.
 * More powerful than fetch_url for POST/PUT/PATCH/DELETE API calls.
 */
registerTool({
  definition: {
    name: 'http_request',
    description:
      'Make an HTTP request with a custom method (GET/POST/PUT/PATCH/DELETE/HEAD), headers, and JSON or string body. Returns status, response headers, and body. Use for API calls, webhooks, and REST operations.',
    category: 'network',
    dangerLevel: 'execute',
    emoji: '🔗',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL' },
        method: {
          type: 'string',
          description: 'HTTP method: GET, POST, PUT, PATCH, DELETE, HEAD (default: GET)',
        },
        headers: {
          type: 'object',
          description: 'HTTP headers as key-value pairs',
        },
        body: {
          type: 'string',
          description: 'Request body (string or JSON string). Sets Content-Type: application/json if body is valid JSON',
        },
        timeout_ms: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
      },
      required: ['url'],
    },
  },
  handler: async (args: Record<string, unknown>, _config: AgentConfig) => {
    const url = String(args.url);
    const method = String(args.method ?? 'GET').toUpperCase();
    const userHeaders = (args.headers ?? {}) as Record<string, string>;
    const bodyStr = args.body ? String(args.body) : undefined;
    const timeout = Number(args.timeout_ms ?? 30_000);

    const headers: Record<string, string> = {
      'User-Agent': 'Apex-AI-Agent/1.1',
      ...userHeaders,
    };

    // Auto-detect JSON body
    if (bodyStr && !headers['Content-Type']) {
      try {
        JSON.parse(bodyStr);
        headers['Content-Type'] = 'application/json';
      } catch {
        headers['Content-Type'] = 'text/plain';
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(timeout),
    });

    const resBody = await res.text();
    const resHeaders = Object.fromEntries(res.headers.entries());
    const contentType = resHeaders['content-type'] ?? '';

    let displayBody = resBody;
    if (contentType.includes('json')) {
      try {
        displayBody = JSON.stringify(JSON.parse(resBody), null, 2);
      } catch { /* not valid json */ }
    }

    const truncLimit = 8192;
    if (displayBody.length > truncLimit) {
      displayBody = displayBody.slice(0, truncLimit) + '\n... [truncated]';
    }

    const headerLines = Object.entries(resHeaders)
      .filter(([k]) => ['content-type', 'content-length', 'location', 'x-ratelimit-remaining'].includes(k))
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');

    return `${method} ${url}\n→ ${res.status} ${res.statusText}\n${headerLines ? `Headers:\n${headerLines}\n` : ''}Body:\n${displayBody}`;
  },
});
