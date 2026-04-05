import chalk from 'chalk';

/** KeepCode brand color palette */
export const theme = {
  brand:   chalk.hex('#7C3AED'),        // purple — KeepCode brand
  accent:  chalk.hex('#06B6D4'),        // cyan — accents
  success: chalk.hex('#10B981'),        // green
  warning: chalk.hex('#F59E0B'),        // amber
  error:   chalk.hex('#EF4444'),        // red
  muted:   chalk.hex('#6B7280'),        // gray
  info:    chalk.hex('#3B82F6'),        // blue
  dim:     chalk.dim,
  bold:    chalk.bold,

  // Compound styles
  label:   (s: string) => chalk.hex('#7C3AED').bold(s),
  value:   (s: string) => chalk.hex('#E5E7EB')(s),
  path:    (s: string) => chalk.hex('#06B6D4').underline(s),
  code:    (s: string) => chalk.hex('#F9FAFB').bgHex('#1F2937')(' ' + s + ' '),
  step:    (n: number, total: number) =>
    chalk.hex('#6B7280')(`[${n}/${total}]`),

  // Danger levels
  safe:        chalk.hex('#10B981'),
  write:       chalk.hex('#F59E0B'),
  execute:     chalk.hex('#F97316'),
  destructive: chalk.hex('#EF4444'),
} as const;

export type Theme = typeof theme;
