#!/usr/bin/env node
import { Command, Option } from 'commander';
import { ApexSession } from './ui/session.js';
import type { AgentConfig } from './types/index.js';

const PKG_VERSION = '1.3.0';

const program = new Command();

program
  .name('keepcode')
  .description('KeepCode — autonomous coding agent powered by Ollama')
  .version(PKG_VERSION, '-v, --version')
  .addOption(new Option('-m, --model <name>',        'Ollama model to use'))
  .addOption(new Option('-u, --url <url>',            'Ollama base URL').default('http://localhost:11434'))
  .addOption(new Option('-t, --temperature <float>',  'Sampling temperature (0-2)').default(0.7))
  .addOption(new Option('-i, --iterations <n>',       'Max agent iterations').default(50))
  .addOption(new Option('-c, --cwd <path>',           'Working directory').default(process.cwd()))
  .addOption(new Option('    --ctx <n>',              'Context window size').default(16384))
  .addOption(new Option('    --max-tokens <n>',       'Max tokens per response').default(8192))
  .addOption(new Option('-y, --auto-approve',         'Skip approval prompts for tool calls'))
  .addOption(new Option('    --verbose',              'Stream model output token-by-token'))
  .addOption(new Option('    --auto-model',           'Auto-pick the best available model'))
  .addOption(new Option('-r, --run <task>',           'Run a single task then exit'))
  .action(async (opts) => {
    const flags: Partial<AgentConfig> & { autoModel?: boolean } = {
      model:         opts.model,
      ollamaUrl:     opts.url,
      temperature:   parseFloat(opts.temperature),
      maxIterations: parseInt(opts.iterations, 10),
      workingDir:    opts.cwd,
      contextWindow: parseInt(opts.ctx, 10),
      maxTokens:     parseInt(opts.maxTokens, 10),
      autoApprove:   !!opts.autoApprove,
      verbose:       !!opts.verbose,
      autoModel:     !!opts.autoModel,
    };

    // Handle SIGINT gracefully
    process.on('SIGINT', () => {
      console.log('\n\n  Received SIGINT — cleaning up...\n');
      process.exit(0);
    });

    const session = await ApexSession.create(flags);

    if (opts.run) {
      // Non-interactive single-run mode
      await session.runTask(opts.run as string);
      process.exit(0);
    } else {
      // Interactive REPL
      await session.repl();
    }
  });

program.parse(process.argv);
