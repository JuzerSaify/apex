import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * regex_replace — find-and-replace using a regular expression across a file.
 * Supports global, case-insensitive, multiline flags. Shows a diff summary.
 */
registerTool({
  definition: {
    name: 'regex_replace',
    description:
      'Replace all regex matches in a file with a replacement string. Supports regex flags (g=global, i=case-insensitive, m=multiline). Returns count of replacements made. Use for bulk renaming, format changes, and pattern-based edits.',
    category: 'write',
    dangerLevel: 'write',
    emoji: '🔀',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to modify' },
        pattern: { type: 'string', description: 'Regular expression pattern (without slashes)' },
        replacement: { type: 'string', description: 'Replacement string (can use $1, $2 capture groups)' },
        flags: {
          type: 'string',
          description: 'Regex flags: g (global), i (case-insensitive), m (multiline). Default: "g"',
        },
      },
      required: ['path', 'pattern', 'replacement'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const filePath = path.resolve(config.workingDir, String(args.path));
    const pattern = String(args.pattern);
    const replacement = String(args.replacement);
    const flags = String(args.flags ?? 'g');

    const content = await fs.readFile(filePath, 'utf8');
    let count = 0;
    const regex = new RegExp(pattern, flags);

    const updated = content.replace(regex, (...match) => {
      count++;
      // Restore $1, $2 etc.
      return match[0].replace(new RegExp(pattern, flags), replacement);
    });

    // Simpler approach: count first, then replace
    const matches = content.match(new RegExp(pattern, flags.includes('g') ? flags : flags + 'g'));
    count = matches?.length ?? 0;
    const result = content.replace(new RegExp(pattern, flags.includes('g') ? flags : flags + 'g'), replacement);

    if (count === 0) {
      return `No matches found for pattern /${pattern}/${flags} in ${filePath}`;
    }

    await fs.writeFile(filePath, result, 'utf8');
    return `Replaced ${count} match(es) of /${pattern}/${flags} in ${filePath}`;
  },
});
