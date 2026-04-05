import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

registerTool({
  definition: {
    name: 'read_lines',
    description:
      'Read multiple non-contiguous line ranges from a file in one call. Efficient for reading a function + its tests without fetching the whole file.',
    category: 'read',
    dangerLevel: 'safe',
    emoji: '📑',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
        ranges: {
          type: 'array',
          description: 'Array of {start, end} objects each with 1-based line numbers, e.g. [{start:1,end:20},{start:50,end:70}]',
          items: { type: 'object' },
        },
      },
      required: ['path', 'ranges'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const filePath = path.resolve(config.workingDir, String(args.path));
    const content = await fs.readFile(filePath, 'utf8');
    const allLines = content.split('\n');
    const ranges = args.ranges as Array<{ start: number; end: number }>;
    const parts: string[] = [];

    for (const r of ranges) {
      const start = Math.max(1, r.start);
      const end = Math.min(allLines.length, r.end);
      const slice = allLines
        .slice(start - 1, end)
        .map((l, i) => `${String(start + i).padStart(5)}  ${l}`)
        .join('\n');
      parts.push(`Lines ${start}-${end}:\n${slice}`);
    }

    return `${filePath}\n${'─'.repeat(60)}\n${parts.join('\n\n')}`;
  },
});
