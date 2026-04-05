import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', '.next', '__pycache__']);

async function walkFiles(dir: string, pattern: RegExp | null, include: RegExp | null): Promise<string[]> {
  let results: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results = results.concat(await walkFiles(full, pattern, include));
    } else if (!include || include.test(e.name)) {
      results.push(full);
    }
  }
  return results;
}

registerTool({
  definition: {
    name: 'search_files',
    description:
      'Search for a regex pattern across files. Returns matching lines with file:line context. Ideal for finding symbol usages, TODO comments, imports, etc.',
    category: 'read',
    dangerLevel: 'safe',
    emoji: '🔍',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        path: { type: 'string', description: 'Directory or file to search in (default: cwd)' },
        file_pattern: {
          type: 'string',
          description: 'Glob-style filter for file names e.g. "*.ts" (optional)',
        },
        case_sensitive: { type: 'boolean', description: 'Case sensitive (default false)' },
        max_results: { type: 'number', description: 'Max matches to return (default 50)' },
      },
      required: ['pattern'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const flags = args.case_sensitive ? '' : 'i';
    let regex: RegExp;
    try {
      regex = new RegExp(String(args.pattern), flags);
    } catch {
      return 'Error: Invalid regex pattern.';
    }

    const searchPath = path.resolve(config.workingDir, String(args.path ?? '.'));
    const maxResults = Number(args.max_results ?? 50);

    let fileInclude: RegExp | null = null;
    if (args.file_pattern) {
      const fp = String(args.file_pattern)
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      fileInclude = new RegExp(`^${fp}$`, 'i');
    }

    let stat;
    try {
      stat = await fs.stat(searchPath);
    } catch {
      return `Error: Path not found: ${searchPath}`;
    }
    const files = stat.isFile()
      ? [searchPath]
      : await walkFiles(searchPath, null, fileInclude);

    const matches: string[] = [];
    outer: for (const file of files) {
      let content: string;
      try {
        content = await fs.readFile(file, 'utf8');
      } catch {
        continue;
      }
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const relPath = path.relative(config.workingDir, file);
          matches.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
          if (matches.length >= maxResults) break outer;
        }
      }
    }

    if (matches.length === 0) return `No matches for "${args.pattern}"`;
    const header = `${matches.length}${matches.length >= maxResults ? '+' : ''} match(es) for "${args.pattern}"\n`;
    return header + matches.join('\n');
  },
});
