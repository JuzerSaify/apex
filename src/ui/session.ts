import readline from 'readline';
import crypto from 'crypto';
import { KeepCodeAgent } from '../agent/loop.js';
import { createProvider } from '../providers/factory.js';
import { EventRenderer } from './renderer.js';
import { printBanner, printCompactHeader, detectVSCodeVersion } from './components/banner.js';
import { Spinner } from './components/spinner.js';
import { pickModel, pickProvider } from './components/model_picker.js';
import { renderTable } from './components/table.js';
import { theme } from './theme.js';
import { loadConfig, initConfig } from '../config/loader.js';
import { DEFAULT_CONFIG, OLLAMA_BASE_URL } from '../config/defaults.js';
import boxen from 'boxen';
import { auth, type StoredSession } from '../auth/index.js';
import { checkForUpdate, printUpdateBanner } from '../updater/index.js';
import { loadMCPServers } from '../mcp/manager.js';
import { listRecentSessions } from '../db/sync.js';
import { getAllTools } from '../tools/registry.js';
import type { AgentConfig, Message, AIProvider } from '../types/index.js';

const PACKAGE_VERSION = '1.5.0';

/** Commands available in the REPL */
const COMMANDS: Record<string, string> = {
  '/model [name]':    'Switch model — no arg opens interactive search picker',
  '/provider [name]': 'Switch provider — no arg opens interactive picker',
  '/models':          'List all available models for current provider',
  '/clear':           'Clear conversation history',
  '/history':         'Show conversation summary',
  '/sessions':        'Cloud session history  (requires login)',
  '/status':          'Show config & stats',
  '/whoami':          'Show logged-in user',
  '/tools':           'List registered tools by category',
  '/help':            'Show this help',
  '/exit':            'Exit KeepCode',
};

export class KeepCodeSession {
  private config: AgentConfig;
  private history: Message[] = [];
  private renderer = new EventRenderer();
  private isRunning = false;
  private pickerActive = false;
  private user: StoredSession['user'] | null = null;

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

    // ── Auth check ────────────────────────────────────────────────────────────
    this.user = await auth.getUser().catch(() => null);
    if (!this.user) {
      const cols = Math.min(process.stdout.columns ?? 80, 70);
      console.log(
        '\n' +
        boxen(
          `  ${theme.error('\u2718')}  You are not signed in.\n\n` +
          `  Agent features are locked.\n\n` +
          `  Type ${theme.brand('/login')} to sign in with Google,\n` +
          `  or run ${theme.accent('keepcode login')} in a new terminal.`,
          {
            padding:        { top: 1, bottom: 1, left: 2, right: 2 },
            width:          cols,
            borderStyle:    'round',
            borderColor:    '#EF4444',
            title:          '  Sign In Required  ',
            titleAlignment: 'center',
          }
        )
      );
    } else {
      console.log(`  ${theme.dim('Signed in as')} ${theme.accent(this.user.email)}`);
    }

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

      if (!this.user) {
        console.log(`\n  ${theme.error('\u2718')}  Not signed in. Type ${theme.brand('/login')} to authenticate.\n`);
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
        printCompactHeader(this.config.model, this.config.provider, Math.floor(this.history.length / 2));
        rl.resume();
        rl.prompt();
      }
    });

    rl.on('close', () => {
      if (this.pickerActive) return; // picker is active — suppress spurious close
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
        console.log(`\n  ${theme.brand.bold('KeepCode')} ${theme.dim('Commands')}\n`);
        const section = (icon: string, label: string, pairs: [string, string][]) => {
          console.log(`  ${theme.accent(icon)} ${theme.accent.bold(label)}`);
          for (const [name, desc] of pairs) {
            const pad = ' '.repeat(Math.max(1, 24 - name.length));
            console.log(`    ${theme.brand(name)}${pad}${theme.muted(desc)}`);
          }
          console.log();
        };
        section('◈', 'Model & Provider', [
          ['/model [name]',    'Switch model — no arg: interactive search'],
          ['/provider [name]', 'Switch provider — no arg: interactive'],
          ['/models',          'List all available models'],
        ]);
        section('◆', 'Session', [
          ['/clear',    'Clear conversation history'],
          ['/history',  'Show conversation summary'],
          ['/sessions', 'Cloud session history  (requires login)'],
          ['/status',   'Show config & stats'],
        ]);
        section('○', 'System', [          ['/login',   'Sign in to KeepCode with Google'],          ['/tools',   'List registered tools by category'],
          ['/whoami',  'Show logged-in user'],
          ['/help',    'Show this help'],
          ['/exit',    'Exit KeepCode'],
        ]);
        break;
      }
      case '/models': {
        const spinner = new Spinner('Fetching models...').start();
        try {
          const provider = createProvider(this.config);
          const models   = await provider.fetchModels();
          spinner.stop();
          renderTable({
            head: ['Model', 'Display Name', 'Context', 'Tools'],
            rows: models.map((m) => [
              m.name,
              m.displayName ?? m.name,
              m.contextLength
                ? `${Math.round(m.contextLength / 1000)}k`
                : m.size ? `${(m.size / 1e9).toFixed(1)} GB` : '—',
              m.supportsTools ? '✓' : '✗',
            ]),
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
          const spinner = new Spinner('Fetching models...').start();
          try {
            const provider = createProvider(this.config);
            const models   = await provider.fetchModels().catch(() => []);
            spinner.stop();
            if (models.length === 0) {
              console.log(`\n  No models found for ${this.config.provider}. Use: /model <name>\n`);
              break;
            }
            const choices = models.map((m) => ({
              name:          m.name,
              displayName:   m.displayName,
              size:          m.size ? `${(m.size / 1e9).toFixed(1)} GB` : '',
              contextLength: m.contextLength,
              toolSupport:   m.supportsTools ?? true,
            }));
            rl.pause();
            this.pickerActive = true;
            try {
              this.config.model = await pickModel(choices);
            } finally {
              this.pickerActive = false;
              process.stdin.resume();
              rl.resume();
            }
            console.log(`\n  ${theme.success('\u2714')}  Model \u2192 ${theme.accent(this.config.model)}\n`);
          } catch {
            this.pickerActive = false;
            process.stdin.resume();
            rl.resume();
            spinner.stop();
          }
        } else {
          this.config.model = modelName;
          console.log(`\n  Switched model → ${theme.accent(modelName)}\n`);
        }
        break;
      }
      case '/provider': {
        let provName = cmd.split(' ').slice(1).join(' ').trim().toLowerCase();
        const validProviders = ['openai', 'anthropic', 'gemini', 'ollama'];
        if (!provName) {
          rl.pause();
          this.pickerActive = true;
          try {
            provName = await pickProvider();
          } catch {
            this.pickerActive = false;
            process.stdin.resume();
            rl.resume();
            break;
          }
          this.pickerActive = false;
          process.stdin.resume();
          rl.resume();
        }
        if (!validProviders.includes(provName)) {
          console.log(`\n  ${theme.warning(`Unknown provider: ${provName}`)}`);
          console.log(`  ${theme.dim('Valid options:')} ${validProviders.map((p) => theme.accent(p)).join(theme.dim(' · '))}\n`);
        } else {
          const prevProvider = this.config.provider;
          this.config.provider = provName as AgentConfig['provider'];
          // Reset api key / base url to defaults for the new provider
          this.config.apiBaseUrl = provName === 'ollama' ? OLLAMA_BASE_URL : '';
          // Fetch models and let user pick or auto-select
          const spinner2 = new Spinner(`Connecting to ${provName}...`).start();
          try {
            const newProvider = createProvider(this.config);
            const alive = await newProvider.isAlive().catch(() => false);
            if (!alive) {
              spinner2.fail(`Cannot connect to ${provName}`);
              this.config.provider = prevProvider;
              this.config.apiBaseUrl = prevProvider === 'ollama' ? OLLAMA_BASE_URL : '';
              console.log(`  ${theme.dim('Reverted to')} ${theme.accent(prevProvider)}\n`);
              break;
            }
            spinner2.succeed(`${provName} connected`);
            const models = await newProvider.fetchModels().catch(() => []);
            if (models.length === 0) {
              console.log(`  ${theme.warning('No models found.')} Set a model with: /model <name>\n`);
            } else if (provName === 'ollama') {
              const withTools = models.filter((m) => m.supportsTools);
              this.config.model = (withTools[0] ?? models[0]).name;
              console.log(`  ${theme.dim('Using model:')} ${theme.accent(this.config.model)}\n`);
            } else {
              const choices = models.map((m) => ({
                name:          m.name,
                displayName:   m.displayName,
                size:          m.size ? `${(m.size / 1e9).toFixed(1)} GB` : '',
                contextLength: m.contextLength,
                toolSupport:   m.supportsTools ?? true,
              }));
              this.config.model = await pickModel(choices);
            }
            console.log(`  ${theme.dim('Switched:')} ${theme.accent(prevProvider)} ${theme.dim('→')} ${theme.accent(provName)}\n`);
          } catch (e) {
            spinner2.fail(`Failed to switch to ${provName}`);
            this.config.provider = prevProvider;
          }
        }
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
            rows: sessions.map((s) => {
              const task = String(s.task ?? '');
              return [
                task.slice(0, 40) + (task.length > 40 ? '…' : ''),
                String(s.provider ?? ''),
                String(s.status ?? ''),
                String(s.iterations ?? 0),
              ];
            }),
          });
        }
        break;
      }
      case '/whoami': {
        const user = await auth.getUser();
        this.user = user;  // keep field in sync
        if (user) {
          console.log(`\n  ${theme.success('\u2714')}  ${theme.dim('Signed in as')} ${theme.accent(user.email)}`);
          if (user.display_name) console.log(`     ${theme.dim('Name:')}  ${user.display_name}`);
          console.log();
        } else {
          console.log(`\n  ${theme.error('\u2718')}  Not signed in. Type ${theme.brand('/login')} to authenticate.\n`);
        }
        break;
      }
      case '/login': {
        rl.pause();
        this.pickerActive = true;
        console.log(`\n  ${theme.dim('Opening browser for Google Sign-In...')}\n`);
        try {
          const stored = await auth.login();
          this.user = stored.user;
          console.log(`\n  ${theme.success('\u2714')}  Signed in as ${theme.accent(stored.user.email)}\n`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`\n  ${theme.error('\u2718')}  Login failed: ${theme.muted(msg)}\n`);
        } finally {
          this.pickerActive = false;
          process.stdin.resume();
          rl.resume();
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
            ['VS Code',      detectVSCodeVersion() ?? 'not detected'],
            ['CWD',          this.config.workingDir],
          ],
        });
        break;
      }
      case '/tools': {
        const tools = getAllTools();
        const byCategory: Record<string, string[]> = {};
        for (const t of tools) {
          const cat = t.definition.name.split('_')[0] ?? 'other';
          (byCategory[cat] ??= []).push(t.definition.name);
        }
        console.log(`\n  ${theme.brand.bold('Registered Tools')} ${theme.dim(`(${tools.length} total)`)}\n`);
        for (const [cat, names] of Object.entries(byCategory).sort()) {
          console.log(`  ${theme.accent(cat.padEnd(14))} ${theme.muted(names.join('  '))}`);
        }
        console.log();
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
    // Strip undefined CLI flags so DEFAULT_CONFIG fallbacks are preserved
    const fileConfig = await loadConfig(workingDir);
    const definedFlags = Object.fromEntries(
      Object.entries(flags as Record<string, unknown>).filter(([, v]) => v !== undefined)
    );
    const merged: Omit<AgentConfig, 'sessionId'> = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      ...definedFlags,
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

    // ── Login nudge (non-blocking) ────────────────────────────────────────
    const user = await auth.getUser().catch(() => null);
    if (!user) {
      console.log(`\n  ${theme.brand('\u25c6')} ${theme.dim('Sign in for cloud sync & session history:')}  ${theme.accent('keepcode login')}`);
    } else {
      console.log(`  ${theme.dim(`Signed in as ${user.email}`)}`);
    }

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

      if (flags.autoModel || merged.provider === 'ollama') {
        // Ollama: always auto-pick first available model; cloud: only if --auto-model
        const withTools = models.filter((m) => m.supportsTools);
        model = (withTools[0] ?? models[0]).name;
        const label = (withTools[0] ?? models[0]).displayName ?? model;
        if (merged.provider === 'ollama') {
          console.log(`\n  ${theme.dim('Using model:')} ${theme.accent(label)}`);
        } else {
          console.log(`\n  ${theme.dim('Auto-selected:')} ${theme.accent(label)}`);
        }
      } else {
        // Cloud providers: interactive picker with displayName + context window
        const choices = models.map((m) => ({
          name:          m.name,
          displayName:   m.displayName,
          size:          m.size ? `${(m.size / 1e9).toFixed(1)} GB` : '',
          contextLength: m.contextLength,
          toolSupport:   m.supportsTools ?? true,
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
