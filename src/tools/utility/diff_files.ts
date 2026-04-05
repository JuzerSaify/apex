import { promises as fs } from 'fs';
import path from 'path';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * diff_files — compare two files or two strings and return a unified diff.
 * Useful for reviewing changes before applying them, comparing versions, etc.
 */
registerTool({
  definition: {
    name: 'diff_files',
    description:
      'Show a unified diff between two files or between a file and a provided string. Useful for reviewing what changed, comparing config versions, and verifying edits were applied correctly.',
    category: 'read',
    dangerLevel: 'safe',
    emoji: '🔍',
    parameters: {
      type: 'object',
      properties: {
        file_a: { type: 'string', description: 'First file path' },
        file_b: {
          type: 'string',
          description: 'Second file path (or omit to use content_b)',
        },
        content_b: {
          type: 'string',
          description: 'String to compare against file_a (alternative to file_b)',
        },
        context_lines: {
          type: 'number',
          description: 'Lines of context around each change (default: 3)',
        },
      },
      required: ['file_a'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const fileA = path.resolve(config.workingDir, String(args.file_a));
    const context = Number(args.context_lines ?? 3);

    const textA = await fs.readFile(fileA, 'utf8');
    let textB: string;
    let labelB: string;

    if (args.file_b) {
      const fileB = path.resolve(config.workingDir, String(args.file_b));
      textB = await fs.readFile(fileB, 'utf8');
      labelB = path.relative(config.workingDir, fileB);
    } else if (args.content_b !== undefined) {
      textB = String(args.content_b);
      labelB = '<proposed>';
    } else {
      return 'Error: provide file_b or content_b for comparison';
    }

    const linesA = textA.split('\n');
    const linesB = textB.split('\n');
    const labelA = path.relative(config.workingDir, fileA);

    // Simple LCS-based unified diff
    const hunks = unifiedDiff(linesA, linesB, labelA, labelB, context);
    if (hunks.length === 0) return `Files are identical: ${labelA} vs ${labelB}`;
    return hunks.join('\n');
  },
});

/** Minimal unified diff implementation */
function unifiedDiff(
  linesA: string[],
  linesB: string[],
  labelA: string,
  labelB: string,
  ctx: number
): string[] {
  // Build edit table via Myers diff (simplified: line-by-line LCS)
  const edit = shortestEdit(linesA, linesB);
  const output: string[] = [`--- ${labelA}`, `+++ ${labelB}`];

  // Group changes into hunks
  type EditOp = { type: 'eq' | 'del' | 'add'; line: string; a: number; b: number };
  const ops: EditOp[] = [];
  let ai = 0, bi = 0;
  for (const op of edit) {
    if (op === '=') {
      ops.push({ type: 'eq', line: linesA[ai], a: ai, b: bi });
      ai++; bi++;
    } else if (op === '-') {
      ops.push({ type: 'del', line: linesA[ai], a: ai, b: bi });
      ai++;
    } else {
      ops.push({ type: 'add', line: linesB[bi], a: ai, b: bi });
      bi++;
    }
  }

  // Identify changed positions and build hunks with context
  const changed = ops.map((o, i) => o.type !== 'eq' ? i : -1).filter((i) => i >= 0);
  if (changed.length === 0) return [];

  const hunkRanges: Array<[number, number]> = [];
  let hStart = Math.max(0, changed[0] - ctx);
  let hEnd = Math.min(ops.length - 1, changed[0] + ctx);
  for (const idx of changed) {
    if (idx - ctx <= hEnd + 1) {
      hEnd = Math.min(ops.length - 1, idx + ctx);
    } else {
      hunkRanges.push([hStart, hEnd]);
      hStart = Math.max(0, idx - ctx);
      hEnd = Math.min(ops.length - 1, idx + ctx);
    }
  }
  hunkRanges.push([hStart, hEnd]);

  for (const [start, end] of hunkRanges) {
    const slice = ops.slice(start, end + 1);
    const aStart = slice.find((o) => o.type !== 'add')?.a ?? 0;
    const bStart = slice.find((o) => o.type !== 'del')?.b ?? 0;
    const aCount = slice.filter((o) => o.type !== 'add').length;
    const bCount = slice.filter((o) => o.type !== 'del').length;
    output.push(`@@ -${aStart + 1},${aCount} +${bStart + 1},${bCount} @@`);
    for (const op of slice) {
      if (op.type === 'eq') output.push(` ${op.line}`);
      else if (op.type === 'del') output.push(`-${op.line}`);
      else output.push(`+${op.line}`);
    }
  }

  return output;
}

function shortestEdit(a: string[], b: string[]): string[] {
  // Simple patience-like diff using Map for LCS
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const ops: string[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { ops.unshift('='); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { ops.unshift('+'); j--; }
    else { ops.unshift('-'); i--; }
  }
  return ops;
}
