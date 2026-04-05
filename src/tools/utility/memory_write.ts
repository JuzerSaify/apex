import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import { MEMORY_FILE } from '../../config/defaults.js';
import type { AgentConfig } from '../../types/index.js';

registerTool({
  definition: {
    name: 'memory_write',
    description:
      'Write a note to persistent memory (.apex/memory.md). Use for: learned facts about the project, decisions made, patterns discovered, things to remember for future sessions.',
    category: 'utility',
    dangerLevel: 'write',
    emoji: '📝',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key / section header' },
        content: { type: 'string', description: 'Content to store' },
        append: {
          type: 'boolean',
          description: 'Append to existing key instead of overwriting (default false)',
        },
      },
      required: ['key', 'content'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const memPath = path.join(config.workingDir, MEMORY_FILE);
    await fs.mkdir(path.dirname(memPath), { recursive: true });

    let current = '';
    try {
      current = await fs.readFile(memPath, 'utf8');
    } catch { /* first write */ }

    const key = String(args.key);
    const content = String(args.content);
    const timestamp = new Date().toISOString();

    if (args.append) {
      const section = `\n> (${timestamp})\n${content}\n`;
      if (current.includes(`## ${key}`)) {
        const updated = current.replace(
          new RegExp(`(## ${key}[\\s\\S]*?)(?=\\n## |\\s*$)`),
          (m) => m.trim() + section + '\n'
        );
        await fs.writeFile(memPath, updated, 'utf8');
      } else {
        await fs.writeFile(memPath, `${current}\n## ${key}\n${section}`, 'utf8');
      }
    } else {
      const newSection = `## ${key}\n_Updated: ${timestamp}_\n\n${content}\n`;
      if (current.includes(`## ${key}`)) {
        const updated = current.replace(
          new RegExp(`## ${key}[\\s\\S]*?(?=\\n## |\\s*$)`),
          newSection
        );
        await fs.writeFile(memPath, updated, 'utf8');
      } else {
        await fs.writeFile(memPath, `${current}\n${newSection}`, 'utf8');
      }
    }

    return `Memory written: [${key}]`;
  },
});
