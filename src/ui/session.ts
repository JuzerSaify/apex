import readline from 'readline';
import crypto from 'crypto';
import { KeepCodeAgent } from '../agent/loop.js';
import { createProvider } from '../providers/factory.js';
import { EventRenderer } from './renderer.js';
import { printBanner } from './components/banner.js';
import { Spinner } from './components/spinner.js';
import { pickModel } from './components/model_picker.js';
import { renderTable } from './components/table.js';
import { theme } from './theme.js';
import { loadConfig, initConfig } from '../config/loader.js';
import { DEFAULT_CONFIG, OLLAMA_BASE_URL } from '../config/defaults.js';
import { auth } from '../auth/index.js';
import { checkForUpdate, printUpdateBanner } from '../updater/index.js';
import { loadMCPServers } from '../mcp/manager.js';
import { listRecentSessions } from '../db/sync.js';
import type { AgentConfig, Message, AIProvider } from '../types/index.js';

const PACKAGE_VERSION = '1.4.0';

/** Commands available in the REPL */
const COMMANDS: Record<string, string> = {
  '/help':         'Show available commands',
  '/models':       'List available models for current provider',
  '/model <name>': 'Switch to a different model',
  '/provider':     'Show current AI provider',
  '/clear':        'Clear conversation history',
  '/history':      'Show conversation history summary',
  '/sessions':     'Show recent cloud sessions (requires login)',
  '/status':       'Show current session config',
  '/whoami':       'Show current logged-in user',
  '/exit':         'Exit KeepCode',
};

export class KeepCodeSession {
  private config: AgentConfig;
  private history: Message[] = [];
  private renderer = new EventRenderer();
  private isRunning = false;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /** One-shot: run a single task non-interactively then exit */
  async runTask(task: string): Promise<void> {
    const startMs = Date.now();
    const agent = new KeepCodeAgent(this.config);
    agent.on((e) => this.renderer.handle(e));
    const state = await agent.run(task, this.history);
    // Persist the user message + assistant result for conversational context
    this.history.push({ role: 'user', content: task });
    if (state.result) {
      this.history.push({ role: 'assistant', content: state.result });
    }
    // Keep history bounded to last 20 messages to avoid blowing context
    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`\n  ${theme.dim(`Session time: ${elapsed}s  ·  history: ${this.history.length} msgs`)}`);
  }

  /** Start the interactive REPL */
  async repl(): Promise<void> {
    printBanner(PACKAGE_VERSION, this.config.model, this.config.workingDir);

    const rl = readline.createInterface({
      input:    process.stdin,
      output:   process.stdout,
      terminal: true,
      prompt:   `\n  ${theme.brand('▶')}  `,
    });

    const refreshPrompt = (): void => {
      const histCount = theme.dim(`[${Math.floor(this.history.length / 2)} turns]`);
      rl.setPrompt(`\n  ${theme.brand('▶')} ${histCount}  `);
    };

    refreshPrompt();
    rl.prompt();

    rl.on('line', async (line: string) => {
      const input = line.trim();
      if (!input) { rl.prompt(); return; }

      if (input.startsWith('/')) {
        await this.handleCommand(input, rl);
        rl.prompt();
        return;
      }

      if (this.isRunning) {
        console.log(theme.warning('  ⏳ Agent is already running. Please wait...'));
        rl.prompt();
        return;
      }

      this.isRunning = true;
      rl.pause();
      try {
        await this.runTask(input);
      } finally {
        this.isRunning = false;
        refreshPrompt();
        rl.resume();
        rl.prompt();
      }
    });

    rl.on('close', () => {
      console.log('\n  Goodbye.\n');
      process.exit(0);
    });
  }

  private async handleCommand(
    cmd: string,
    rl: readline.Interface
  ): Promise<void> {
    const base = cmd.split(' ')[0].toLowerCase();

    switch (base) {
      case '/help': {
        console.log('\n  Available commands:\n');
        for (const [name, desc] of Object.entries(COMMANDS)) {
          console.log(`    \u001b[35m${name.padEnd(12)}\u001b[0m ${desc}`);
        }
        console.log();
        break;
      }
      case '/models': {
        const spinner = new Spinner('Fetching models...').start();
        try {
          const provider = createProvider(this.config);
          const models   = await provider.fetchModels();
          spinner.stop();
          renderTable({
            head: ['Model', 'Tool Support'],
            rows: models.map((m) => [m.name, m.supportsTools ? '✓' : '✗']),
          });
        } catch (e) {
          spinner.fail('Failed to fetch models');
          console.error(e);
        }
        break;
      }
      case '/model': {
        const modelName = cmd.split(' ').slice(1).join(' ').trim();
        if (!modelName) {
          console.log(`\n  Usage: /model <name>  — current: ${theme.accent(this.config.model)}\n`);
        } else {
          this.config.model = modelName;
          console.log(`\n  Switched model → ${theme.accent(modelName)}\n`);
        }
        break;
      }
      case '/provider': {
        console.log(`\n  Provider: ${theme.accent(this.config.provider)}  Model: ${theme.accent(this.config.model)}\n`);
        break;
      }
      case '/sessions': {
        const spinner = new Spinner('Loading session history...').start();
        const sessions = await listRecentSessions(10);
        spinner.stop();
        if (sessions.length === 0) {
          console.log('\n  No sessions found. Login with: keepcode login\n');
        } else {
          renderTable({
            head: ['Task (preview)', 'Provider', 'Status', 'Iters'],
            rows: sessions.map((s) => [
              s.task.slice(0, 40) + (s.task.length > 40 ? '…' : ''),
              s.provider,
              s.status,
              String(s.iterations),
            ]),
          });
        }
        break;
      }
      case '/whoami': {
        const user = await auth.getUser();
        if (user) {
          console.log(`\n  Logged in as: ${theme.accent(user.email)}`);
          if (user.display_name) console.log(`  Name: ${user.display_name}`);
          console.log();
        } else {
          console.log('\n  Not logged in. Run: keepcode login\n');
        }
        break;
      }
      case '/history': {
        if (this.history.length === 0) {
          console.log('\n  No conversation history yet.\n');
        } else {
          const turns = Math.floor(this.history.length / 2);
          console.log(`\n  ${theme.label('History')} — ${turns} turn${turns !== 1 ? 's' : ''}`);
          for (let i = 0; i < this.history.length; i++) {
            const msg   = this.history[i];
            const icon  = msg.role === 'user' ? theme.brand('You      ') : theme.accent('KeepCode ');
            const preview = (typeof msg.content === 'string' ? msg.content : '[complex]').slice(0, 100);
            console.log(`  ${icon}  ${theme.muted(preview)}${preview.length >= 100 ? theme.dim('…') : ''}`);
          }
          console.log();
        }
        break;
      }
      case '/clear': {
        this.history = [];
        console.log('\n  Conversation cleared.\n');
        break;
      }
      case '/status': {
        renderTable({
          head: ['Setting', 'Value'],
          rows: [
            ['Model',        this.config.model],
            ['Provider',     this.config.provider],
            ['API Base URL', this.config.apiBaseUrl],
            ['Temperature',  String(this.config.temperature)],
            ['Max Iters',    String(this.config.maxIterations)],
            ['Context Win',  String(this.config.contextWindow)],
            ['Auto Approve', String(this.config.autoApprove)],
            ['Verbose',      String(this.config.verbose)],
            ['CWD',          this.config.workingDir],
          ],
        });
        break;
      }
      case '/exit':
        rl.close();
        break;
      default:
        console.log(`\n  Unknown command: ${base}. Type /help for help.\n`);
    }
  }

  /** Factory: build a session from CLI flags + file config + model picker */
  static async create(flags: Partial<AgentConfig> & { autoModel?: boolean }): Promise<KeepCodeSession> {
    const workingDir = flags.workingDir ?? process.cwd();

    await initConfig(workingDir);

    // Merge: defaults ← file config ← CLI flags
    const fileConfig = await loadConfig(workingDir);
    const merged: Omit<AgentConfig, 'sessionId'> = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      ...flags,
      workingDir,
    };

    // Check for updates silently (non-blocking)
    checkForUpdate(PACKAGE_VERSION).then((latest) => {
      if (latest) printUpdateBanner(PACKAGE_VERSION, latest);
    }).catch(() => {});

    // Load MCP servers (non-blocking, errors are logged inside)
    loadMCPServers(workingDir).catch(() => {});

    // ── Provider connectivity check ────────────────────────────────────────
    const provider = createProvider(merged as AgentConfig);
    const providerLabel = merged.provider === 'ollama'
      ? `Ollama (${merged.apiBaseUrl})`
      : merged.provider.charAt(0).toUpperCase() + merged.provider.slice(1);

    const spinner = new Spinner(`Connecting to ${providerLabel}...`).start();
    const alive = await provider.isAlive().catch(() => false);

    if (!alive) {
      if (merged.provider === 'ollama') {
        spinner.fail(`Cannot reach Ollama at ${merged.apiBaseUrl}`);
        console.error('\n  Make sure Ollama is running: https://ollama.ai\n');
        console.error('  Or switch provider: keepcode --provider openai --api-key sk-...\n');
      } else {
        spinner.fail(`Cannot connect to ${providerLabel}`);
        console.error('\n  Check your API key and network connection.\n');
      }
      process.exit(1);
    }
    spinner.succeed(`${providerLabel} connected`);

    // ── Model auto-selection / picker ─────────────────────────────────────
    let model = merged.model;
    if (!model) {
      const models = await provider.fetchModels().catch(() => []);
      if (models.length === 0) {
        if (merged.provider === 'ollama') {
          console.error('\n  No models found. Run: ollama pull llama3.2\n');
        } else {
          console.error(`\n  No models found for ${providerLabel}. Set --model explicitly.\n`);
        }
        process.exit(1);
      }

      if (flags.autoModel) {
        const withTools = models.filter((m) => m.supportsTools);
        model = (withTools[0] ?? models[0]).name;
        console.log(`  Auto-selected model: \x1b[36m${model}\x1b[0m\n`);
      } else {
        const choices = models.map((m) => ({
          name: m.name,
          size: m.size ? `${(m.size / 1e9).toFixed(1)} GB` : '',
          toolSupport: m.supportsTools ?? true,
        }));
        model = await pickModel(choices);
      }
    }

    const config: AgentConfig = {
      ...merged,
      model,
      sessionId: crypto.randomUUID(),
    };

    return new KeepCodeSession(config);
  }
}
