import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

registerTool({
  definition: {
    name: 'edit_file',
    description:
      'Replace an exact string in a file with new content. The old_string must appear EXACTLY ONCE in the file. Read the file first to get the precise text. Preferred over write_file for surgical edits.',
    category: 'write',
    dangerLevel: 'write',
    emoji: '🔧',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to edit' },
        old_string: {
          type: 'string',
          description: 'Exact string to find (must appear exactly once)',
        },
        new_string: {
          type: 'string',
          description: 'Replacement string',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const filePath = path.resolve(config.workingDir, String(args.path));
    const original = await fs.readFile(filePath, 'utf8');
    const oldStr = String(args.old_string);
    const newStr = String(args.new_string);

    const count = original.split(oldStr).length - 1;
    if (count === 0) {
      return `Error: old_string not found in ${filePath}. Use read_file to verify the exact text.`;
    }
    if (count > 1) {
      return `Error: old_string appears ${count} times in ${filePath}. Make it more unique by including surrounding context.`;
    }

    const updated = original.replace(oldStr, newStr);
    await fs.writeFile(filePath, updated, 'utf8');

    const addedLines   = newStr.split('\n').length;
    const removedLines = oldStr.split('\n').length;
    const delta        = addedLines - removedLines;
    const sign         = delta >= 0 ? '+' : '';
    const summary      = delta === 0
      ? `${removedLines} line(s) replaced`
      : `${sign}${delta} lines (${removedLines} removed → ${addedLines} added)`;
    return `Edited ${path.relative(config.workingDir, filePath)}: ${summary}`;
  },
});
