import readline from 'readline';
import crypto from 'crypto';
import { ApexAgent } from '../agent/loop.js';
import { OllamaProvider } from '../providers/ollama/index.js';
import { EventRenderer } from './renderer.js';
import { printBanner } from './components/banner.js';
import { Spinner } from './components/spinner.js';
import { pickModel } from './components/model_picker.js';
import { renderTable } from './components/table.js';
import { theme } from './theme.js';
import { formatModelSize, detectToolSupport } from '../providers/ollama/models.js';
import { loadConfig, initConfig } from '../config/loader.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import type { AgentConfig, Message } from '../types/index.js';

const PACKAGE_VERSION = '1.3.0';

/** Commands available in the REPL */
const COMMANDS: Record<string, string> = {
  '/help':         'Show available commands',
  '/models':       'List available Ollama models',
  '/model <name>': 'Switch to a different model',
  '/clear':        'Clear conversation history',
  '/history':      'Show conversation history summary',
  '/status':       'Show current session config',
  '/exit':         'Exit KeepCode',
};

export class ApexSession {
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
    const agent = new ApexAgent(this.config);
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
          const provider = new OllamaProvider(this.config.ollamaUrl);
          const models   = await provider.fetchModels();
          spinner.stop();
          renderTable({
            head: ['Model', 'Size', 'Tool Support'],
            rows: models.map((m) => [
              m.name,
              formatModelSize(m.size),
              detectToolSupport(m) ? '✓' : '✗',
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
          console.log(`\n  Usage: /model <name>  — current: ${theme.accent(this.config.model)}\n`);
        } else {
          this.config.model = modelName;
          console.log(`\n  Switched model → ${theme.accent(modelName)}\n`);
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
            ['Ollama URL',   this.config.ollamaUrl],
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
  static async create(flags: Partial<AgentConfig> & { autoModel?: boolean }): Promise<ApexSession> {
    const workingDir = flags.workingDir ?? process.cwd();

    // Ensure .apex dirs exist
    await initConfig(workingDir);

    // Merge: defaults ← file config ← CLI flags
    const fileConfig = await loadConfig(workingDir);
    const merged: Omit<AgentConfig, 'sessionId'> = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      ...flags,
      workingDir,
    };

    // Connect to Ollama
    const provider = new OllamaProvider(merged.ollamaUrl);

    const spinner = new Spinner('Connecting to Ollama...').start();
    const alive = await provider.isAlive();
    if (!alive) {
      spinner.fail('Cannot reach Ollama at ' + merged.ollamaUrl);
      console.error('\n  Make sure Ollama is running: https://ollama.ai\n');
      process.exit(1);
    }
    spinner.succeed('Ollama connected');

    // Pick model if not provided
    let model = merged.model;
    if (!model) {
      const models = await provider.fetchModels();
      if (models.length === 0) {
        console.error('\n  No models found. Run: ollama pull llama3.2\n');
        process.exit(1);
      }

      if (flags.autoModel) {
        // Pick largest model with tool support, or just largest
        const withTools = models.filter((m) => detectToolSupport(m));
        model = (withTools[0] ?? models[0]).name;
        console.log(`  Auto-selected model: \u001b[36m${model}\u001b[0m\n`);
      } else {
        const choices = models.map((m) => ({
          name: m.name,
          size: formatModelSize(m.size),
          toolSupport: detectToolSupport(m),
        }));
        model = await pickModel(choices);
      }
    }

    const config: AgentConfig = {
      ...merged,
      model,
      sessionId: crypto.randomUUID(),
    };

    return new ApexSession(config);
  }
}
