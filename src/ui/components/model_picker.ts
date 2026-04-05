import readline from 'readline';
import chalk from 'chalk';
import { theme } from '../theme.js';

export interface ModelChoice {
  name: string;
  size: string;
  toolSupport: boolean;
}

/** Track how many lines were printed so we can redraw in-place */
function printLines(lines: string[]): void {
  process.stdout.write(lines.join('\n') + '\n');
}

function clearPrinted(lineCount: number): void {
  if (lineCount > 0) {
    // Move cursor up lineCount rows then clear from cursor to end
    process.stdout.write(`\x1B[${lineCount}A\x1B[J`);
  }
}

/** Interactive keyboard-driven model picker (in-place, no full-screen clear) */
export async function pickModel(models: ModelChoice[]): Promise<string> {
  if (models.length === 0) {
    throw new Error('No Ollama models available. Run: ollama pull <model>');
  }

  return new Promise((resolve) => {
    let selected  = 0;
    let lastLines = 0;

    const buildLines = (): string[] => {
      const header = [
        '',
        `  ${chalk.hex('#7C3AED').bold('KeepCode')} ${theme.dim('— select a model')}`,
        `  ${theme.dim('─'.repeat(42))}`,
      ];
      const rows = models.map((m, i) => {
        const active = i === selected;
        const cursor = active ? chalk.hex('#7C3AED')('▶ ') : '  ';
        const name   = active ? chalk.hex('#7C3AED').bold(m.name) : theme.muted(m.name);
        const size   = theme.dim(` ${m.size}`);
        const tools  = m.toolSupport
          ? chalk.hex('#10B981')(' ✓ tools')
          : theme.muted(' ✗ tools');
        return `  ${cursor}${name}${size}${tools}`;
      });
      const footer = [
        '',
        `  ${theme.dim('↑↓ navigate   Enter select   q quit')}`,
        '',
      ];
      return [...header, ...rows, ...footer];
    };

    const render = () => {
      const lines = buildLines();
      clearPrinted(lastLines);
      printLines(lines);
      lastLines = lines.length;
    };

    render();

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const onKey = (_chunk: string, key: { name: string; ctrl: boolean }) => {
      if (!key) return;

      if (key.name === 'up') {
        selected = (selected - 1 + models.length) % models.length;
        render();
      } else if (key.name === 'down') {
        selected = (selected + 1) % models.length;
        render();
      } else if (key.name === 'return') {
        cleanup();
        resolve(models[selected].name);
      } else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        cleanup();
        process.exit(0);
      }
    };

    const cleanup = () => {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.off('keypress', onKey);
      process.stdin.pause();
    };

    if (!process.stdin.isTTY) {
      // Non-interactive stdin (piped): skip UI, return first model
      cleanup();
      resolve(models[0].name);
      return;
    }

    process.stdin.on('keypress', onKey);
    process.stdin.resume();
  });
}

