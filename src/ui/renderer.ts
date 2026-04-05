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

// ── Inline markdown helpers ───────────────────────────────────────────────────

/** Apply inline markdown: ***bold-italic***, **bold**, *italic*, `inline code` */
function renderInline(s: string): string {
  return s
    .replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => chalk.white.bold.italic(t))
    .replace(/\*\*(.+?)\*\*/g,     (_, t) => chalk.white.bold(t))
    .replace(/\*(.+?)\*/g,         (_, t) => chalk.italic(t))
    .replace(/`([^`\n]+)`/g,       (_, t) => chalk.hex('#F9FAFB').bgHex('#374151')(` ${t} `));
}

/**
 * Full markdown → styled terminal renderer.
 * Handles H1–H4, bold, italic, inline code, fenced code blocks,
 * tables, ordered/unordered lists (nested), blockquotes, and hr.
 */
function renderMd(content: string, indent = '  '): void {
  const cols = Math.min(process.stdout.columns ?? 80, 100);
  const raw  = content.trim().split('\n');
  let   inFence  = false;
  let   fenceLang = '';
  const tableRows: string[] = [];

  const flushTable = (): void => {
    if (tableRows.length === 0) return;
    let isHeader = true;
    for (const row of tableRows) {
      // Skip separator rows like |---|---|
      if (/^\|?[\s\-:|]+\|$/.test(row.trim())) continue;
      const cells = row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      if (isHeader) {
        isHeader = false;
        console.log(`${indent}${cells.map((c) => chalk.white.bold(c)).join(chalk.dim('  │  '))}`);
        console.log(`${indent}${chalk.dim('─'.repeat(Math.min(cols - indent.length, 70)))}`);
      } else {
        console.log(`${indent}${cells.map((c) => chalk.hex('#E5E7EB')(c)).join(chalk.dim('  │  '))}`);
      }
    }
    tableRows.length = 0;
  };

  for (const rawLine of raw) {
    // ── Fenced code block ────────────────────────────────────────────────────
    if (/^```/.test(rawLine)) {
      if (!inFence) {
        flushTable();
        inFence    = true;
        fenceLang  = rawLine.slice(3).trim();
        const tag  = fenceLang ? chalk.hex('#F59E0B')(` ${fenceLang} `) : '';
        const fill = chalk.dim('─'.repeat(Math.max(2, Math.min(cols - indent.length - fenceLang.length - 6, 44))));
        console.log(`${indent}${chalk.dim('╭──')}${tag}${fill}`);
      } else {
        console.log(`${indent}${chalk.dim('╰' + '─'.repeat(Math.min(cols - indent.length - 2, 46)))}`);
        inFence   = false;
        fenceLang = '';
      }
      continue;
    }
    if (inFence) {
      console.log(`${indent}${chalk.dim('│')} ${chalk.hex('#F9FAFB')(rawLine)}`);
      continue;
    }

    // ── Table rows ────────────────────────────────────────────────────────────
    if (/^\|/.test(rawLine)) { tableRows.push(rawLine); continue; }
    flushTable();

    const line = rawLine;
    if (line.trim() === '')    { console.log(); continue; }

    // ── Horizontal rule ──────────────────────────────────────────────────────
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      console.log(`${indent}${chalk.dim('─'.repeat(Math.min(cols - indent.length, 70)))}`);
      continue;
    }

    // ── Headings ─────────────────────────────────────────────────────────────
    if (/^# /.test(line)) {
      const text = renderInline(line.replace(/^# /, ''));
      console.log(`\n${indent}${chalk.white.bold.underline(text)}`);
      console.log(`${indent}${chalk.dim('═'.repeat(Math.min(line.length - 2, cols - indent.length - 2)))}`);
      continue;
    }
    if (/^## /.test(line)) {
      console.log(`\n${indent}${chalk.hex('#06B6D4').bold('◈  ' + renderInline(line.replace(/^## /, '')))}`);
      continue;
    }
    if (/^### /.test(line)) {
      console.log(`${indent}${chalk.hex('#7C3AED').bold('▸  ' + renderInline(line.replace(/^### /, '')))}`);
      continue;
    }
    if (/^#### /.test(line)) {
      console.log(`${indent}${chalk.dim('·  ' + renderInline(line.replace(/^#### /, '')))}`);
      continue;
    }

    // ── Blockquote ───────────────────────────────────────────────────────────
    if (/^> /.test(line)) {
      console.log(`${indent}${chalk.dim('▎')} ${chalk.italic.hex('#9CA3AF')(renderInline(line.replace(/^> /, '')))}`);
      continue;
    }

    // ── Unordered list (nested) ───────────────────────────────────────────────
    const ulM = line.match(/^(\s*)[-*+] (.+)$/);
    if (ulM) {
      const depth  = Math.floor(ulM[1].length / 2);
      const bullet = depth === 0 ? chalk.hex('#7C3AED')('●')
                   : depth === 1 ? chalk.hex('#06B6D4')('○')
                   : chalk.dim('▪');
      console.log(`${indent}${'  '.repeat(depth)}${bullet} ${chalk.white(renderInline(ulM[2]))}`);
      continue;
    }

    // ── Ordered list ─────────────────────────────────────────────────────────
    const olM = line.match(/^(\s*)(\d+)[.)]\s+(.+)$/);
    if (olM) {
      const depth = Math.floor(olM[1].length / 2);
      console.log(`${indent}${'  '.repeat(depth)}${chalk.hex('#06B6D4').bold(olM[2] + '.')} ${chalk.white(renderInline(olM[3]))}`);
      continue;
    }

    // ── Indented code (4-space) ───────────────────────────────────────────────
    if (/^ {4}/.test(line)) {
      console.log(`${indent}${chalk.dim('│')} ${chalk.hex('#F9FAFB')(line.trimStart())}`);
      continue;
    }

    // ── Normal paragraph ─────────────────────────────────────────────────────
    console.log(`${indent}${chalk.white(renderInline(line))}`);
  }

  flushTable();
}
export class EventRenderer {
  private tokenBuffer = '';
  private inStream = false;
  private lastStatus = '';
  private spinner: Ora | null = null;
  private spinnerBaseText = '';
  private toolStartMs = 0;
  private runStartMs = Date.now();
  private curIter = 0;
  private maxIter = 0;
  private totalIn  = 0;
  private totalOut = 0;
  /** Track last thought content to avoid repeating it in the complete box */
  private lastThoughtContent = '';

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
      this.spinnerBaseText = '';
    }
  }

  private startSpinner(text: string, color: SpinColor = 'cyan', spinnerName = 'dots2'): void {
    this.stopSpinner();
    this.spinnerBaseText = text;
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
      const cols = Math.min(process.stdout.columns ?? 80, 100);
      const sep  = chalk.dim('─'.repeat(cols - 2));
      process.stdout.write(`\n  ${chalk.white.bold('▸ Streaming Response')}\n  ${sep}\n  `);
      this.inStream = true;
    }
    process.stdout.write(chalk.white(token));
    this.tokenBuffer += token;
  }

  private onThought(content: string): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';
    this.lastThoughtContent = content.trim();
    console.log();
    renderMd(content);
  }

  private onPlan(steps: string[]): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';
    const cols = Math.min(process.stdout.columns ?? 80, 100);
    const bar  = chalk.dim('─'.repeat(cols - 4));
    console.log(`\n  ${chalk.white.bold('◈ Plan')}  ${GRAD_SEP}`);
    console.log(`  ${bar}`);
    for (let i = 0; i < steps.length; i++) {
      console.log(`  ${chalk.hex('#06B6D4').bold(String(i + 1).padStart(2) + '.')}  ${chalk.white(steps[i])}`);
    }
    console.log(`  ${bar}`);
  }

  private onToolCall(name: string, args: Record<string, unknown>): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';
    this.toolStartMs = Date.now();

    const cols      = Math.min(process.stdout.columns ?? 80, 100);
    const toolLabel = chalk.hex('#F59E0B').bold(`⚙  ${name}`);
    const sep       = chalk.dim('─'.repeat(cols - 4));
    console.log(`\n  ${toolLabel}\n  ${sep}`);
    for (const [k, v] of Object.entries(args)) {
      let val: string;
      if (typeof v === 'string') {
        const vLines = v.split('\n');
        val = vLines[0].slice(0, 300);
        if (vLines[0].length > 300) val += chalk.dim('…');
        if (vLines.length > 1) val += chalk.dim(` (+${vLines.length - 1} lines)`);
      } else {
        val = JSON.stringify(v);
        if (val.length > 300) val = val.slice(0, 300) + chalk.dim('…');
      }
      console.log(`     ${chalk.dim(k + ':')} ${chalk.hex('#E5E7EB')(val)}`);
    }
    this.startSpinner(chalk.dim(`     running ${name}…`), 'yellow', 'dots8Bit');
  }

  private onToolResult(name: string, output: string, error?: boolean): void {
    this.stopSpinner();
    const ms   = this.elapsedMs(this.toolStartMs);
    const tag  = chalk.dim(`  ${ms}`);
    const safe = (output ?? '').trim();
    const MAX  = 60;

    if (error) {
      const lines = safe ? safe.split('\n') : ['(no output)'];
      console.log(`     ${theme.error('✗')}  ${chalk.hex('#EF4444')(lines[0].slice(0, 300))}${tag}`);
      for (const l of lines.slice(1, 20)) {
        console.log(`        ${chalk.hex('#EF4444')(l.slice(0, 250))}`);
      }
      if (lines.length > 20) {
        console.log(`        ${chalk.dim(`… ${lines.length - 20} more lines`)}`);
      }
    } else {
      const lines     = safe ? safe.split('\n') : [];
      const shown     = lines.slice(0, MAX);
      const remaining = lines.length - MAX;
      const body      = shown.map((l) => `        ${chalk.hex('#D1D5DB')(l.slice(0, 300))}`).join('\n');
      console.log(`     ${theme.success('✓')}${tag}`);
      if (body.trim()) {
        console.log(body);
        if (remaining > 0) {
          console.log(`\n        ${chalk.dim(`… ${remaining} more lines`)}`);
        }
      }
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
    const color = recoverable ? '#F59E0B' : '#EF4444';
    const label = recoverable ? '⚠  Warning' : '✗  Error';
    console.log(
      '\n' +
      boxen(`  ${chalk.hex(color)(message)}`, {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: color,
        title: `  ${label}  `,
        titleAlignment: 'left',
      })
    );
  }

  private onComplete(summary: string, iterations: number, toolCalls: number, tokenCount: number, inputTokenCount = 0): void {
    this.stopSpinner();
    this.flushStream();
    this.lastStatus = '';

    const totalMs = Date.now() - this.runStartMs;
    const elapsed = totalMs < 60_000
      ? `${(totalMs / 1000).toFixed(1)}s`
      : `${Math.floor(totalMs / 60_000)}m ${Math.floor((totalMs % 60_000) / 1000)}s`;

    const clean = (summary ?? '').replace(/^(APEX_TASK_COMPLETE|KEEPCODE_TASK_COMPLETE):?\s*/i, '').trim();

    // If this content was already shown via onThought, skip repeating it in the box
    const alreadyShown = clean === this.lastThoughtContent;
    this.lastThoughtContent = ''; // reset for next run

    // Render summary with inline markdown — full content, no truncation
    const block = (!alreadyShown && clean)
      ? clean.split('\n').map((l) => {
          if (l.trim() === '') return '';
          const ri = l
            .replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => chalk.white.bold.italic(t))
            .replace(/\*\*(.+?)\*\*/g,     (_, t) => chalk.white.bold(t))
            .replace(/`([^`]+)`/g,         (_, t) => chalk.hex('#F9FAFB').bgHex('#374151')(` ${t} `));
          if (/^# /.test(l))   return `  ${chalk.white.bold(ri.replace(/^# /, ''))}`;
          if (/^## /.test(l))  return `  ${chalk.hex('#06B6D4').bold(ri.replace(/^## /, ''))}`;
          if (/^### /.test(l)) return `  ${chalk.hex('#7C3AED').bold(ri.replace(/^### /, ''))}`;
          if (/^[-*] /.test(l)) return `  ${chalk.hex('#7C3AED')('●')} ${chalk.white(ri.replace(/^[-*] /, ''))}`;
          if (/^\d+\. /.test(l)) {
            const m = l.match(/^(\d+)\. (.+)$/);
            return m ? `  ${chalk.hex('#06B6D4').bold(m[1] + '.')} ${chalk.white(m[2])}` : `  ${chalk.white(ri)}`;
          }
          return `  ${chalk.white(ri)}`;
        }).join('\n')
      : `  ${chalk.dim('(task complete)')}`;

    const stats = [
      chalk.dim(`${iterations} iter${iterations !== 1 ? 's' : ''}`),
      chalk.dim(`${toolCalls} tool call${toolCalls !== 1 ? 's' : ''}`),
      chalk.dim(`↑${inputTokenCount.toLocaleString()} in  ↓${tokenCount.toLocaleString()} out`),
      theme.accent(elapsed),
    ].join(chalk.dim('  ·  '));

    const width = Math.min(process.stdout.columns ?? 80, 94);

    console.log(
      '\n' +
      boxen(`${block}\n\n  ${stats}`, {
        padding:          { top: 1, bottom: 1, left: 1, right: 1 },
        width,
        borderStyle:      'round',
        borderColor:      '#10B981',
        title:            chalk.hex('#10B981').bold('  ✓  Task Complete  '),
        titleAlignment:   'center',
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
    // Rebuild spinner text from stored base to avoid ANSI regex fragility
    if (this.spinner?.isSpinning && this.spinnerBaseText) {
      this.spinner.text = this.spinnerBaseText +
        theme.dim(`  │ ↑${totalIn.toLocaleString()} ↓${totalOut.toLocaleString()}`);
    }
  }

  private onInsight(insight: string): void {
    this.stopSpinner();
    this.flushStream();
    console.log(`\n  ${chalk.hex('#7C3AED')('✦')}  ${chalk.dim('Insight:')} ${chalk.hex('#9CA3AF').italic(insight)}`);
  }
}
