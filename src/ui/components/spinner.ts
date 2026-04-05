import ora, { type Ora } from 'ora';
import { theme } from '../theme.js';

type Phase = 'thinking' | 'planning' | 'tools' | 'network' | 'compressing' | 'default';

const PHASE_SPINNERS: Record<Phase, { spinner: string; color: 'magenta' | 'cyan' | 'yellow' | 'blue' | 'white' }> = {
  thinking:    { spinner: 'dots12',       color: 'cyan'    },
  planning:    { spinner: 'bouncingBar',  color: 'magenta' },
  tools:       { spinner: 'dots8Bit',     color: 'yellow'  },
  network:     { spinner: 'arc',          color: 'blue'    },
  compressing: { spinner: 'squish',       color: 'white'   },
  default:     { spinner: 'dots2',        color: 'magenta' },
};

export class Spinner {
  private ora: Ora;

  constructor(text: string, phase: Phase = 'default') {
    const cfg = PHASE_SPINNERS[phase];
    this.ora = ora({
      text,
      spinner: cfg.spinner as never,
      color:   cfg.color,
    });
  }

  /** Create a Spinner tuned for the given agent phase */
  static for(phase: Phase, text: string): Spinner {
    return new Spinner(text, phase);
  }

  start(text?: string): this {
    if (text) this.ora.text = text;
    this.ora.start();
    return this;
  }

  text(t: string): this {
    this.ora.text = t;
    return this;
  }

  succeed(text?: string): void {
    this.ora.succeed(text ? theme.success(text) : undefined);
  }

  fail(text?: string): void {
    this.ora.fail(text ? theme.error(text) : undefined);
  }

  warn(text?: string): void {
    this.ora.warn(text ? theme.warning(text) : undefined);
  }

  info(text?: string): void {
    this.ora.info(text ? theme.info(text) : undefined);
  }

  stop(): void {
    this.ora.stop();
  }

  clear(): void {
    this.ora.clear();
  }
}

