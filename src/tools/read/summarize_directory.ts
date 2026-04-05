import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * summarize_directory — produce a high-level overview of a directory:
 * file count, types, total size, recently modified files.
 * Helps the agent quickly understand an unfamiliar project.
 */
registerTool({
  definition: {
    name: 'summarize_directory',
    description:
      'Generate a statistical overview of a directory: total files, breakdown by extension, total size, and top 10 most recently modified files. Useful for understanding an unfamiliar codebase at a glance before diving in.',
    category: 'read',
    dangerLevel: 'safe',
    emoji: '🔭',
    parameters: {
      type: 'object',
      properties: {
        dir: {
          type: 'string',
          description: 'Directory to analyze (default: working directory)',
        },
      },
      required: [],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const root = args.dir
      ? path.resolve(config.workingDir, String(args.dir))
      : config.workingDir;

    const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__', '.venv', '.next', 'build', 'coverage', '.apex']);

    const extMap = new Map<string, number>();
    const recentFiles: Array<{ path: string; mtime: number; size: number }> = [];
    let totalFiles = 0;
    let totalBytes = 0;

    async function walk(dir: string) {
      let names: string[];
      try { names = await fs.readdir(dir); } catch { return; }
      for (const name of names) {
        if (SKIP.has(name)) continue;
        const full = path.join(dir, name);
        let stat;
        try { stat = await fs.stat(full); } catch { continue; }
        if (stat.isDirectory()) {
          await walk(full);
        } else {
          totalFiles++;
          totalBytes += stat.size;
          const ext = path.extname(name).toLowerCase() || '(no ext)';
          extMap.set(ext, (extMap.get(ext) ?? 0) + 1);
          recentFiles.push({ path: path.relative(root, full).replace(/\\/g, '/'), mtime: stat.mtimeMs, size: stat.size });
        }
      }
    }

    await walk(root);

    const topExts = Array.from(extMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([ext, count]) => `  ${ext.padEnd(14)} ${count} file(s)`)
      .join('\n');

    const recentTop = recentFiles
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 10)
      .map((f) => {
        const kb = (f.size / 1024).toFixed(1);
        const d = new Date(f.mtime).toISOString().slice(0, 16).replace('T', ' ');
        return `  ${d}  ${kb.padStart(7)} KB  ${f.path}`;
      })
      .join('\n');

    const sizeMb = (totalBytes / 1024 / 1024).toFixed(2);

    return [
      `Directory: ${root}`,
      `Total files: ${totalFiles} (${sizeMb} MB)`,
      ``,
      `By extension:`,
      topExts,
      ``,
      `Recently modified (top 10):`,
      recentTop || '  (none)',
    ].join('\n');
  },
});
