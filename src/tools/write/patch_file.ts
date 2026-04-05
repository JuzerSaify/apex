import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * patch_file — apply multiple text replacements to a file in one atomic call.
 * More efficient than chaining multiple edit_file calls.
 */
registerTool({
  definition: {
    name: 'patch_file',
    description:
      'Apply multiple find-and-replace operations to a single file in one atomic call. Each patch must have old_string (exact, unique) and new_string. Faster than multiple edit_file calls. Reads and writes the file once.',
    category: 'write',
    dangerLevel: 'write',
    emoji: '🩹',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to patch' },
        patches: {
          type: 'array',
          description: 'Array of {old_string, new_string} replacement objects applied in order',
          items: { type: 'object' },
        },
      },
      required: ['path', 'patches'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const filePath = path.resolve(config.workingDir, String(args.path));
    let content = await fs.readFile(filePath, 'utf8');
    const patches = args.patches as Array<{ old_string: string; new_string: string }>;
    const results: string[] = [];

    for (let i = 0; i < patches.length; i++) {
      const { old_string, new_string } = patches[i];
      const count = content.split(old_string).length - 1;
      if (count === 0) {
        results.push(`Patch ${i + 1}: ✗ old_string not found`);
        continue;
      }
      if (count > 1) {
        results.push(`Patch ${i + 1}: ✗ old_string appears ${count} times (not unique)`);
        continue;
      }
      content = content.replace(old_string, new_string);
      const diff = new_string.split('\n').length - old_string.split('\n').length;
      results.push(`Patch ${i + 1}: ✓ applied (${diff >= 0 ? '+' : ''}${diff} lines)`);
    }

    const successes = results.filter((r) => r.includes('✓')).length;
    if (successes > 0) {
      await fs.writeFile(filePath, content, 'utf8');
    }

    return `${filePath} — ${successes}/${patches.length} patches applied\n${results.join('\n')}`;
  },
});
