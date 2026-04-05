import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * list_files — flat recursive directory listing with optional glob filter.
 * Returns relative paths, sorted. Faster than list_directory for file enumeration.
 */
registerTool({
  definition: {
    name: 'list_files',
    description:
      'Recursively list files under a directory with optional extension filter. Returns sorted relative paths. Skips node_modules, .git, dist, __pycache__, .venv. Use when you need a flat file inventory without directory tree structure.',
    category: 'read',
    dangerLevel: 'safe',
    emoji: '📋',
    parameters: {
      type: 'object',
      properties: {
        dir: {
          type: 'string',
          description: 'Directory to list (default: working directory)',
        },
        ext: {
          type: 'string',
          description: 'File extension filter e.g. ".ts", ".py", ".json" (optional)',
        },
        max: {
          type: 'number',
          description: 'Maximum files to return (default: 500)',
        },
      },
      required: [],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const root = args.dir
      ? path.resolve(config.workingDir, String(args.dir))
      : config.workingDir;
    const ext = args.ext ? String(args.ext).toLowerCase() : null;
    const max = Number(args.max ?? 500);

    const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__', '.venv', '.next', 'build', 'coverage', '.apex']);
    const results: string[] = [];

    async function walk(dir: string) {
      if (results.length >= max) return;
      let entries: string[];
      try {
        entries = await fs.readdir(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        if (results.length >= max) break;
        if (SKIP.has(name)) continue;
        const full = path.join(dir, name);
        let stat;
        try { stat = await fs.stat(full); } catch { continue; }
        if (stat.isDirectory()) {
          await walk(full);
        } else {
          if (!ext || name.endsWith(ext)) {
            results.push(path.relative(root, full).replace(/\\/g, '/'));
          }
        }
      }
    }

    await walk(root);
    results.sort();

    const truncated = results.length >= max;
    const header = `${results.length} file(s) in ${path.relative(config.workingDir, root) || '.'}${ext ? ` (${ext})` : ''}${truncated ? ' [limit reached]' : ''}`;
    return `${header}\n${results.join('\n')}`;
  },
});
