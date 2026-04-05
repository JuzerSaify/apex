import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * read_json — read and optionally query a JSON file with dot-path notation.
 * Returns the full JSON or a specific nested value.
 */
registerTool({
  definition: {
    name: 'read_json',
    description:
      'Read a JSON file and optionally extract a value by dot-path (e.g. "scripts.build", "dependencies.react", "0.name" for arrays). Returns formatted JSON. Use for package.json, config files, API responses.',
    category: 'read',
    dangerLevel: 'safe',
    emoji: '🗂️',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the JSON file' },
        query: {
          type: 'string',
          description: 'Dot-path to extract e.g. "scripts", "dependencies.typescript", "0.name". Omit to return full file.',
        },
      },
      required: ['path'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const filePath = path.resolve(config.workingDir, String(args.path));
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw) as unknown;
    const query = args.query ? String(args.query) : null;

    if (!query) {
      return JSON.stringify(data, null, 2);
    }

    // dot-path traversal
    const keys = query.split('.');
    let cursor: unknown = data;
    for (const key of keys) {
      if (cursor === null || cursor === undefined) break;
      if (Array.isArray(cursor)) {
        cursor = cursor[Number(key)];
      } else if (typeof cursor === 'object') {
        cursor = (cursor as Record<string, unknown>)[key];
      } else {
        cursor = undefined;
        break;
      }
    }

    if (cursor === undefined) {
      // List top-level keys as hint
      const topKeys = typeof data === 'object' && data !== null ? Object.keys(data as object).join(', ') : '(not an object)';
      return `Path "${query}" not found. Top-level keys: ${topKeys}`;
    }

    return typeof cursor === 'string' ? cursor : JSON.stringify(cursor, null, 2);
  },
});
