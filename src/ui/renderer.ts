import boxen from 'boxen';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { theme } from './theme.js';
import type { AgentEvent } from '../types/index.js';

type SpinColor = 'cyan' | 'magenta' | 'yellow' | 'blue' | 'white' | 'green' | 'red';

// ── Status display config ─────────────────────────────────────────────────
const STATUS_CFG: Record<string, {
  icon: string; label: string;
  color: (s: string) => string;
  spin: SpinColor;
  spinner: string;
}> = {
  thinking:     { icon: '◆', label: 'Thinking',    color: theme.accent,   spin: 'cyan',    spinner: 'dots12'      },
  planning:     { icon: '◈', label: 'Planning',    color: theme.brand,    spin: 'magenta', spinner: 'bouncingBar' },
  calling_tool: { icon: '⚙', label: 'Tools',       color: theme.warning,  spin: 'yellow',  spinner: 'dots8Bit'    },
  observing:    { icon: '◎', label: 'Analyzing',   color: theme.info,     spin: 'blue',    spinner: 'arc'         },
  compressing:  { icon: '⟳', label: 'Compressing', color: theme.muted,    spin: 'white',   spinner: 'squish'      },
  complete:     { icon: '✓', label: 'Complete',    color: theme.success,  spin: 'green',   spinner: 'dots2'       },
  error:        { icon: '✗', label: 'Error',       color: theme.error,    spin: 'red',     spinner: 'dots2'       },
  aborted:      { icon: '⊘', label: 'Aborted',     color: theme.muted,    spin: 'white',   spinner: 'dots2'       },
  idle:         { icon: '◌', label: 'Idle',        color: theme.muted,    spin: 'white',   spinner: 'dots2'       },
};

const STATUS_HINTS: Record<string, string> = {
  thinking:     'processing',
  planning:     'building strategy',
  observing:    'reviewing results',
  compressing:  'trimming context',
  calling_tool: 'invoking tools',
};

/** Compact gradient separator bar */
const GRAD_SEP = chalk.hex('#7C3AED')('░') + chalk.hex('#4F46E5')('▒') + chalk.hex('#06B6D4')('▓') + chalk.hex('#0891B2')('█') + chalk.hex('#0E7490')('▓') + chalk.hex('#06B6D4')('▒') + chalk.hex('#7C3AED')('░');

/** Handles all AgentEvent types — live spinner, per-tool timing, rich formatting */
export class EventRenderer {
  private tokenBuffer = '';
  private inStream = false;
  private lastStatus = '';
  private spinner: Ora | null = null;
  private toolStartMs = 0;
  private runStartMs = Date.now();
  private curIter = 0;
  private maxIter = 0;
  private totalIn  = 0;
  private totalOut = 0;

  handle(event: AgentEvent): void {
    switch (event.type) {
      case 'status_change':   this.onStatus(event.status, event.message); break;
      case 'token':           this.onToken(event.token); break;
      case 'thought':         this.onThought(event.content); break;
      case 'plan':            this.onPlan(event.steps); break;
      case 'tool_call':       this.onToolCall(event.call.name, event.call.arguments); break;
      case 'tool_result':     this.onToolResult(event.result.name, event.result.output, event.result.error); break;
      case 'compress':        this.onCompress(event.fromTokens, event.toTokens); break;
      case 'error':           this.onError(event.message, event.recoverable); break;
      case 'complete':        this.onComplete(event.summary, event.state.iterations, event.state.toolCallCount, event.state.tokenCount, event.state.inputTokenCount); break;
      case 'abort':           this.onAbort(); break;
      case 'iteration_start': this.onIteration(event.iteration, event.maxIterations); break;
      case 'token_usage':     this.onTokenUsage(event.totalInputTokens, event.totalOutputTokens); break;
      case 'training_insight':this.onInsight(event.insight); break;
    }
  }

  private stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  private startSpinner(text: string, color: SpinColor = 'cyan', spinnerName = 'dots2'): void {
    this.stopSpinner();
    this.spinner = ora({ text, spinner: spinnerName as never, color }).start();
  }

  private flushStream(): void {
    if (this.inStream) {
      process.stdout.write('\n');
      this.tokenBuffer = '';
      this.inStream = false;
    }
  }

  private elapsedMs(from: number): string {
    const d = Date.now() - from;
    return d < 1000 ? `${d}ms` : `${(d / 1000).toFixed(1)}s`;
  }

  private onStatus(status: string, message?: string): void {
    this.flushStream();
    const key = `${status}:${message ?? ''}`;
    if (key === this.lastStatus) return;
    this.lastStatus = key;

    const cfg  = STATUS_CFG[status] ?? { icon: '◆', label: status, color: theme.muted, spin: 'white' as SpinColor, spinner: 'dots2' };
    const hint = message ?? STATUS_HINTS[status] ?? '';
    const iter = this.maxIter > 0 ? theme.dim(`  [${this.curIter}/${this.maxIter}]`) : '';
    const text = `${cfg.color(`${cfg.icon}  ${cfg.label.toUpperCase()}`)}${iter}  ${theme.dim(hint)}`;

    this.startSpinner(text, cfg.spin, cfg.spinner);
  }

  private onToken(token: string): void {
    this.stopSpinner();
    if (!this.inStream) {
      process.stdout.write(`\n  ${chalk.hex('#7C3AED')('▌')} `);
      this.inStream = true;
    }
    process.stdout.write(theme.value(token));
    this.tokenBuffer += token;
  }

  private onThought(content: string): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';
    const lines = content.trim().split('\n');
    console.log();
    for (const line of lines) {
      if (line.trim() === '') {
        console.log();
      } else if (/^#{1,3}\s/.test(line)) {
        console.log(`  ${theme.brand.bold(line.replace(/^#+\s/, ''))}`);
      } else if (/^\s*[-*]\s/.test(line)) {
        console.log(`  ${theme.muted('·')} ${theme.muted(line.replace(/^\s*[-*]\s/, ''))}`);
      } else if (/^\s*\d+\.\s/.test(line)) {
        const m = line.match(/^\s*(\d+)\.\s(.+)$/);
        if (m) console.log(`  ${theme.brand(m[1] + '.')} ${theme.muted(m[2])}`);
        else   console.log(`  ${theme.muted(line)}`);
      } else {
        console.log(`  ${theme.muted.italic(line)}`);
      }
    }
  }

  private onPlan(steps: string[]): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';
    console.log(`\n  ${theme.brand.bold('▸ Plan')}`);
    console.log(`  ${GRAD_SEP}`);
    for (let i = 0; i < steps.length; i++) {
      console.log(`  ${theme.brand(`${String(i + 1).padStart(2)}.`)}  ${theme.value(steps[i])}`);
    }
    console.log(`  ${GRAD_SEP}`);
  }

  private onToolCall(name: string, args: Record<string, unknown>): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';
    this.toolStartMs = Date.now();

    const toolLabel = chalk.hex('#F59E0B').bold(`⚙  ${name}`);
    const sep = theme.dim('─'.repeat(Math.min(name.length + 5, 44)));
    console.log(`\n  ${toolLabel}\n  ${sep}`);
    for (const [k, v] of Object.entries(args)) {
      let val: string;
      if (typeof v === 'string') {
        const firstLine = v.split('\n')[0];
        val = firstLine.length > 110 ? firstLine.slice(0, 110) + theme.dim('…') : firstLine;
        if (v.split('\n').length > 1) val += theme.dim(` (+${v.split('\n').length - 1} lines)`);
      } else {
        val = JSON.stringify(v);
        if (val.length > 110) val = val.slice(0, 110) + theme.dim('…');
      }
      console.log(`     ${theme.muted(k + ':')} ${theme.value(val)}`);
    }
    // Spinner while tool executes
    this.startSpinner(theme.dim(`     running ${name}…`), 'yellow', 'dots8Bit');
  }

  private onToolResult(name: string, output: string, error?: boolean): void {
    this.stopSpinner();
    const ms  = this.elapsedMs(this.toolStartMs);
    const tag = theme.dim(`  ${ms}`);

    if (error) {
      const lines = output.trim().split('\n');
      console.log(`     ${theme.error('✗')}  ${theme.error(lines[0].slice(0, 200))}${tag}`);
      for (const l of lines.slice(1, 5)) {
        console.log(`        ${theme.dim(l.slice(0, 140))}`);
      }
    } else {
      const lines  = output.trim().split('\n');
      const shown  = lines.slice(0, 10);
      const more   = lines.length > 10 ? `\n        ${theme.dim(`… ${lines.length - 10} more lines`)}` : '';
      const body   = shown.map((l) => `        ${theme.muted(l.slice(0, 130))}`).join('\n');
      console.log(`     ${theme.success('✓')}${tag}`);
      if (body.trim()) console.log(body + more);
    }
  }

  private onCompress(from: number, to: number): void {
    this.stopSpinner();
    this.flushStream();
    const pct = Math.round((1 - to / from) * 100);
    console.log(
      `\n  ${theme.info('⟳')}  Context compressed  ` +
      `${theme.warning(String(from))} → ${theme.success(String(to))} tokens  ` +
      theme.dim(`(${pct}% freed)`)
    );
  }

  private onError(message: string, recoverable: boolean): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';
    const prefix = recoverable ? theme.warning('⚠  WARNING') : theme.error('✗  ERROR');
    console.log(`\n${prefix}\n  ${theme.error(message)}\n`);
  }

  private onComplete(summary: string, iterations: number, toolCalls: number, tokenCount: number, inputTokenCount = 0): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';

    const totalMs = Date.now() - this.runStartMs;
    const elapsed = totalMs < 60_000
      ? `${(totalMs / 1000).toFixed(1)}s`
      : `${Math.floor(totalMs / 60_000)}m ${Math.floor((totalMs % 60_000) / 1000)}s`;

    const clean   = summary.replace(/^(APEX_TASK_COMPLETE|KEEPCODE_TASK_COMPLETE):?\s*/i, '').trim();
    const display = clean.length > 800 ? clean.slice(0, 800) + '\n  ' + theme.dim('… trimmed') : clean;
    const block   = display.split('\n').map((l) => `  ${l}`).join('\n');

    const stats = [
      theme.muted(`${iterations} iter${iterations !== 1 ? 's' : ''}`),
      theme.muted(`${toolCalls} tool call${toolCalls !== 1 ? 's' : ''}`),
      theme.muted(`↑${inputTokenCount.toLocaleString()} in  ↓${tokenCount.toLocaleString()} out`),
      theme.accent(elapsed),
    ].join(theme.dim('  ·  '));

    const title = chalk.hex('#10B981').bold('  ✓  Task Complete  ');

    console.log(
      '\n' +
      boxen(`${block}\n\n  ${stats}`, {
        padding: { top: 1, bottom: 1, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: '#10B981',
        title,
        titleAlignment: 'center',
      })
    );
    this.runStartMs = Date.now(); // reset for next run in REPL
  }

  private onAbort(): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';
    console.log(`\n  ${theme.warning('⊘')}  ${theme.warning.bold('Aborted.')}\n`);
  }

  private onIteration(n: number, max: number): void {
    // Track iteration counts for spinner label — don't print text directly
    this.curIter = n;
    this.maxIter = max;
    this.lastStatus = ''; // Re-allow same status to re-render with updated iter
  }

  private onTokenUsage(totalIn: number, totalOut: number): void {
    this.totalIn  = totalIn;
    this.totalOut = totalOut;
    // Update spinner text with live token counts if spinning
    if (this.spinner?.isSpinning) {
      const tokenLabel = theme.dim(`  │ ↑${totalIn.toLocaleString()} ↓${totalOut.toLocaleString()} tok`);
      // Refresh spinner text without restarting
      this.spinner.text = this.spinner.text.replace(/ *│ [↑↓].*tok$/, '') + tokenLabel;
    }
  }

  private onInsight(insight: string): void {
    this.stopSpinner();
    this.flushStream();
    console.log(`\n  ${theme.brand('✦')}  ${theme.dim.italic(insight)}`);
  }
}
