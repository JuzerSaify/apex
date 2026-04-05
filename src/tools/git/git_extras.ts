import { exec } from 'child_process';
import { promisify } from 'util';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

const execAsync = promisify(exec);

/**
 * git_stash — manage git stash: push, pop, list, drop, apply.
 */
registerTool({
  definition: {
    name: 'git_stash',
    description:
      'Manage git stash: push (save uncommitted changes), pop (restore last stash), list (see all stashes), apply (restore without removing).',
    category: 'git',
    dangerLevel: 'write',
    emoji: '📦',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'One of: push, pop, list, apply, drop (default: list)',
          enum: ['push', 'pop', 'list', 'apply', 'drop'],
        },
        message: {
          type: 'string',
          description: 'Message for stash push (optional)',
        },
        index: {
          type: 'number',
          description: 'Stash index for drop/apply (0 = most recent)',
        },
      },
      required: ['action'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const action = String(args.action ?? 'list');
    const cwd = config.workingDir;
    let cmd = '';

    switch (action) {
      case 'push': {
        const msg = args.message ? ` -m ${JSON.stringify(String(args.message))}` : '';
        cmd = `git stash push${msg}`;
        break;
      }
      case 'pop':
        cmd = `git stash pop`;
        break;
      case 'list':
        cmd = `git stash list`;
        break;
      case 'apply': {
        const idx = args.index !== undefined ? `stash@{${Number(args.index)}}` : '';
        cmd = `git stash apply ${idx}`.trim();
        break;
      }
      case 'drop': {
        const idx = args.index !== undefined ? `stash@{${Number(args.index)}}` : '';
        cmd = `git stash drop ${idx}`.trim();
        break;
      }
      default:
        return `Unknown action: ${action}`;
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd });
      const out = stdout.trim();
      const err = stderr.trim();
      return [out, err].filter(Boolean).join('\n') || `git stash ${action}: done`;
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      return `Error: ${err.stderr ?? err.message ?? String(e)}`;
    }
  },
});

/**
 * git_branch — list, create, switch, or delete branches.
 */
registerTool({
  definition: {
    name: 'git_branch',
    description:
      'Git branch management: list all branches, create a new branch, switch to a branch, or delete a branch.',
    category: 'git',
    dangerLevel: 'write',
    emoji: '🌿',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'One of: list, create, switch, delete (default: list)',
          enum: ['list', 'create', 'switch', 'delete'],
        },
        name: {
          type: 'string',
          description: 'Branch name for create/switch/delete',
        },
        force: {
          type: 'boolean',
          description: 'Force delete even if unmerged (default: false)',
        },
      },
      required: ['action'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const action = String(args.action ?? 'list');
    const name = args.name ? String(args.name) : '';
    const cwd = config.workingDir;
    let cmd = '';

    switch (action) {
      case 'list':
        cmd = 'git branch -a --format="%(HEAD) %(refname:short)"';
        break;
      case 'create':
        if (!name) return 'Error: name required for create';
        cmd = `git checkout -b ${JSON.stringify(name)}`;
        break;
      case 'switch':
        if (!name) return 'Error: name required for switch';
        cmd = `git checkout ${JSON.stringify(name)}`;
        break;
      case 'delete':
        if (!name) return 'Error: name required for delete';
        cmd = `git branch ${args.force ? '-D' : '-d'} ${JSON.stringify(name)}`;
        break;
      default:
        return `Unknown action: ${action}`;
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd });
      return [stdout.trim(), stderr.trim()].filter(Boolean).join('\n') || `git branch ${action}: done`;
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      return `Error: ${err.stderr ?? err.message ?? String(e)}`;
    }
  },
});

/**
 * git_pull — pull from remote with optional rebase.
 */
registerTool({
  definition: {
    name: 'git_pull',
    description:
      'Pull latest changes from the remote repository. Optionally specify remote and branch. Use rebase=true to avoid merge commits.',
    category: 'git',
    dangerLevel: 'write',
    emoji: '⬇️',
    parameters: {
      type: 'object',
      properties: {
        remote: { type: 'string', description: 'Remote name (default: origin)' },
        branch: { type: 'string', description: 'Branch to pull (default: current branch)' },
        rebase: { type: 'boolean', description: 'Use --rebase instead of merge (default: false)' },
      },
      required: [],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const remote = String(args.remote ?? 'origin');
    const branch = args.branch ? String(args.branch) : '';
    const rebase = args.rebase ? '--rebase' : '';
    const cmd = `git pull ${rebase} ${remote} ${branch}`.trim().replace(/\s+/g, ' ');
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: config.workingDir });
      return [stdout.trim(), stderr.trim()].filter(Boolean).join('\n') || 'Up to date.';
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      return `Error: ${err.stderr ?? err.message ?? String(e)}`;
    }
  },
});
