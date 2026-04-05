#!/usr/bin/env node
import { Command, Option } from 'commander';
import { KeepCodeSession } from './ui/session.js';
import { auth } from './auth/index.js';
import { applyUpdate, checkForUpdate, printUpdateBanner } from './updater/index.js';
import { listRecentSessions } from './db/sync.js';
import { addMCPServer, listMCPServers } from './mcp/manager.js';
import type { AgentConfig } from './types/index.js';

const PKG_VERSION = '1.4.0';

const program = new Command();

program
  .name('keepcode')
  .description('KeepCode — autonomous coding agent (OpenAI · Anthropic · DeepSeek · Ollama)')
  .version(PKG_VERSION, '-v, --version');

// ── Main agent command ────────────────────────────────────────────────────────
program
  .command('run', { isDefault: true })
  .description('Start interactive coding session (default command)')
  .addOption(new Option('-m, --model <name>',          'Model to use'))
  .addOption(new Option('-p, --provider <name>',       'AI provider: openai|anthropic|deepseek|ollama').choices(['openai', 'anthropic', 'deepseek', 'ollama']))
  .addOption(new Option('-k, --api-key <key>',         'API key (or set OPENAI_API_KEY / ANTHROPIC_API_KEY)'))
  .addOption(new Option('    --api-base <url>',        'Custom API base URL (for Ollama or custom endpoints)'))
  .addOption(new Option('-t, --temperature <float>',   'Sampling temperature (0-2)').default(0.7))
  .addOption(new Option('-i, --iterations <n>',        'Max agent iterations').default(50))
  .addOption(new Option('-c, --cwd <path>',            'Working directory').default(process.cwd()))
  .addOption(new Option('    --ctx <n>',               'Context window size').default(16384))
  .addOption(new Option('    --max-tokens <n>',        'Max tokens per response').default(8192))
  .addOption(new Option('-y, --auto-approve',          'Skip approval prompts for tool calls'))
  .addOption(new Option('    --verbose',               'Stream model output token-by-token'))
  .addOption(new Option('    --auto-model',            'Auto-pick the best available model'))
  .addOption(new Option('-r, --run <task>',            'Run a single task then exit'))
  .action(async (opts) => {
    // API key resolution: flag → env var
    const apiKey = opts.apiKey
      ?? process.env.OPENAI_API_KEY
      ?? process.env.ANTHROPIC_API_KEY
      ?? process.env.DEEPSEEK_API_KEY;

    const flags: Partial<AgentConfig> & { autoModel?: boolean } = {
      model:         opts.model,
      provider:      opts.provider,
      apiKey:        apiKey || undefined,
      apiBaseUrl:    opts.apiBase,
      temperature:   parseFloat(opts.temperature),
      maxIterations: parseInt(opts.iterations, 10),
      workingDir:    opts.cwd,
      contextWindow: parseInt(opts.ctx, 10),
      maxTokens:     parseInt(opts.maxTokens, 10),
      autoApprove:   !!opts.autoApprove,
      verbose:       !!opts.verbose,
      autoModel:     !!opts.autoModel,
    };

    process.on('SIGINT', () => {
      console.log('\n\n  Received SIGINT — cleaning up...\n');
      process.exit(0);
    });

    const session = await KeepCodeSession.create(flags);

    if (opts.run) {
      await session.runTask(opts.run as string);
      process.exit(0);
    } else {
      await session.repl();
    }
  });

// ── Auth commands ─────────────────────────────────────────────────────────────
program
  .command('login')
  .description('Sign in to KeepCode Cloud with Google')
  .action(async () => {
    try {
      await auth.login();
      const user = await auth.getUser();
      if (user) {
        console.log(`\n  ✓ Signed in as ${user.email}\n`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  Login failed: ${msg}\n`);
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Sign out from KeepCode Cloud')
  .action(async () => {
    await auth.logout();
    console.log('\n  Signed out.\n');
  });

program
  .command('profile')
  .description('Show your KeepCode Cloud profile')
  .action(async () => {
    const user = await auth.getUser();
    if (!user) {
      console.log('\n  Not signed in. Run: keepcode login\n');
      process.exit(1);
    }
    console.log(`\n  Email   : ${user.email}`);
    console.log(`  User ID : ${user.id}\n`);
  });

// ── Sessions command ──────────────────────────────────────────────────────────
program
  .command('sessions')
  .description('View recent cloud sessions')
  .option('-n, --limit <n>', 'Number of sessions to show', '10')
  .action(async (opts) => {
    const sessions = await listRecentSessions(parseInt(opts.limit, 10));
    if (!sessions || sessions.length === 0) {
      console.log('\n  No sessions found. Sign in with: keepcode login\n');
      return;
    }
    console.log('\n  Recent sessions:\n');
    for (const s of sessions) {
      const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—';
      console.log(`  ${date}  [${s.provider}/${s.model}]  ${s.task?.slice(0, 60) ?? ''}  (${s.status})`);
    }
    console.log();
  });

// ── Update command ────────────────────────────────────────────────────────────
program
  .command('update')
  .description('Check for and apply updates')
  .action(async () => {
    const latest = await checkForUpdate(PKG_VERSION);
    if (!latest) {
      console.log(`\n  KeepCode is up to date (v${PKG_VERSION})\n`);
      return;
    }
    printUpdateBanner(PKG_VERSION, latest);
    console.log('  Applying update...\n');
    applyUpdate();
  });

// ── MCP subcommands ───────────────────────────────────────────────────────────
const mcp = program.command('mcp').description('Manage MCP servers');

mcp
  .command('list')
  .description('List configured MCP servers')
  .option('-c, --cwd <path>', 'Project directory', process.cwd())
  .action(async (opts) => {
    const servers = await listMCPServers(opts.cwd);
    if (servers.length === 0) {
      console.log('\n  No MCP servers configured. Use: keepcode mcp add\n');
      return;
    }
    console.log('\n  MCP servers:\n');
    for (const s of servers) {
      const status = s.enabled ? '✓ enabled' : '✗ disabled';
      console.log(`  [${status}] ${s.name}  →  ${s.command} ${(s.args ?? []).join(' ')}`);
    }
    console.log();
  });

mcp
  .command('add <name> <command> [args...]')
  .description('Add an MCP server  (e.g. keepcode mcp add github npx -- -y @modelcontextprotocol/server-github)')
  .option('-c, --cwd <path>', 'Project directory', process.cwd())
  .action(async (name: string, command: string, args: string[], opts) => {
    await addMCPServer(opts.cwd, {
      name,
      transport: 'stdio',
      command,
      args,
      enabled: true,
    });
    console.log(`\n  ✓ MCP server '${name}' added.\n`);
  });

program.parse(process.argv);

