import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * write_json — write or update a JSON file with pretty formatting.
 * Supports deep merge mode (update specific keys without overwriting).
 */
registerTool({
  definition: {
    name: 'write_json',
    description:
      'Write a JSON value to a file with 2-space indentation. Optionally set a single dot-path key instead of overwriting the whole file (merge mode). Use for package.json updates, config changes, saving structured data.',
    category: 'write',
    dangerLevel: 'write',
    emoji: '💾',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        data: {
          type: 'object',
          description: 'JSON data to write (used when not setting a specific key)',
        },
        set_key: {
          type: 'string',
          description: 'Dot-path key to set without overwriting other keys e.g. "scripts.build". Requires the file to already be a JSON object.',
        },
        set_value: {
          type: 'string',
          description: 'Value for set_key (parsed as JSON if valid, otherwise used as string)',
        },
      },
      required: ['path'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const filePath = path.resolve(config.workingDir, String(args.path));

    if (args.set_key) {
      // Merge mode: read existing, set key, write back
      let obj: Record<string, unknown> = {};
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        obj = JSON.parse(raw) as Record<string, unknown>;
      } catch { /* file doesn't exist or invalid json — start fresh */ }

      const keys = String(args.set_key).split('.');
      let cursor = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (typeof cursor[keys[i]] !== 'object' || cursor[keys[i]] === null) {
          cursor[keys[i]] = {};
        }
        cursor = cursor[keys[i]] as Record<string, unknown>;
      }

      const rawValue = args.set_value !== undefined ? String(args.set_value) : 'null';
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(rawValue);
      } catch {
        parsedValue = rawValue;
      }
      cursor[keys[keys.length - 1]] = parsedValue;

      await fs.writeFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
      return `Set ${args.set_key} = ${JSON.stringify(parsedValue)} in ${filePath}`;
    }

    // Full write mode
    const data = args.data ?? {};
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return `Written ${filePath} (${JSON.stringify(data).length} bytes)`;
  },
});
