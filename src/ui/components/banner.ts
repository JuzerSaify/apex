import chalk from 'chalk';
import boxen from 'boxen';
import { theme } from '../theme.js';
import os from 'os';

// KEEP block — rendered in purple
const KEEP_LINES = [
  '  ██╗  ██╗███████╗███████╗██████╗ ',
  '  ██║ ██╔╝██╔════╝██╔════╝██╔══██╗',
  '  █████╔╝ █████╗  █████╗  ██████╔╝',
  '  ██╔═██╗ ██╔══╝  ██╔══╝  ██╔═══╝ ',
  '  ██║  ██╗███████╗███████╗██║     ',
  '  ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ',
];

// Separator
const SEP_LINE = '  ─────────────────────────────────';

// CODE block — rendered in cyan
const CODE_LINES = [
  '   ██████╗ ██████╗ ██████╗ ███████╗',
  '  ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
  '  ██║     ██║   ██║██║  ██║█████╗  ',
  '  ██║     ██║   ██║██║  ██║██╔══╝  ',
  '  ╚██████╗╚██████╔╝██████╔╝███████╗',
  '   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
];

function buildArt(): string {
  const purple = chalk.hex('#7C3AED');
  const cyan   = chalk.hex('#06B6D4');
  const lines  = [
    ...KEEP_LINES.map((l) => purple(l)),
    chalk.dim(SEP_LINE),
    ...CODE_LINES.map((l) => cyan(l)),
  ];
  return lines.join('\n');
}

export function printBanner(version: string, model: string, cwd: string): void {
  const now      = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const platform = `${process.platform} / Node ${process.version}`;
  const mem      = `${(os.freemem() / 1024 ** 3).toFixed(1)} GB free`;

  const art     = buildArt();
  const content = [
    art,
    '',
    `  ${theme.label('Version')}  ${theme.muted('v' + version)}    ${theme.dim(platform)}`,
    `  ${theme.label('Model  ')}  ${theme.accent(model)}`,
    `  ${theme.label('CWD    ')}  ${theme.path(cwd)}`,
    `  ${theme.label('Time   ')}  ${theme.dim(now)}    ${theme.dim(mem)}`,
    '',
    `  ${theme.dim('Commands:')}  ${theme.muted('/help')}  ${theme.muted('/models')}  ${theme.muted('/status')}  ${theme.muted('/clear')}  ${theme.muted('/model <name>')}  ${theme.muted('/exit')}`,
  ].join('\n');

  console.log(
    boxen(content, {
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: '#7C3AED',
    })
  );
}
