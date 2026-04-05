import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * append_file — append text to the end of a file (or create it).
 * Useful for log files, adding entries to config files, growing lists.
 */
registerTool({
  definition: {
    name: 'append_file',
    description:
      'Append content to the end of a file. Creates the file if it does not exist. Use for adding log entries, list items, config lines, or growing any file incrementally.',
    category: 'write',
    dangerLevel: 'write',
    emoji: '➕',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to append to' },
        content: { type: 'string', description: 'Content to append' },
        newline: {
          type: 'boolean',
          description: 'Prepend a newline before content if file is non-empty (default: true)',
        },
      },
      required: ['path', 'content'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const filePath = path.resolve(config.workingDir, String(args.path));
    const content = String(args.content);
    const addNewline = args.newline !== false;

    let prefix = '';
    try {
      const existing = await fs.readFile(filePath, 'utf8');
      if (addNewline && existing.length > 0 && !existing.endsWith('\n')) {
        prefix = '\n';
      }
    } catch {
      // file doesn't exist yet — create it
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }

    await fs.appendFile(filePath, prefix + content, 'utf8');
    const lines = (prefix + content).split('\n').length;
    return `Appended ${lines} line(s) to ${filePath}`;
  },
});
