import readline from 'readline';
import { getTool, getAllTools } from './registry.js';
import type { ToolCall, ToolResult, AgentConfig } from '../types/index.js';

// import all tool modules so they self-register
import './read/read_file.js';
import './read/read_lines.js';
import './read/list_directory.js';
import './read/list_files.js';
import './read/search_files.js';
import './read/glob.js';
import './read/read_json.js';
import './read/summarize_directory.js';
import './write/write_file.js';
import './write/edit_file.js';
import './write/patch_file.js';
import './write/append_file.js';
import './write/regex_replace.js';
import './write/write_json.js';
import './write/create_directory.js';
import './write/delete_file.js';
import './write/move_file.js';
import './write/copy_file.js';
import './execute/bash.js';
import './execute/node_eval.js';
import './network/fetch_url.js';
import './network/http_request.js';
import './git/git_status.js';
import './git/git_diff.js';
import './git/git_log.js';
import './git/git_commit.js';
import './git/git_extras.js';
import './code/lint.js';
import './code/run_tests.js';
import './utility/think.js';
import './utility/plan.js';
import './utility/task_complete.js';
import './utility/memory_read.js';
import './utility/memory_write.js';
import './utility/checkpoint.js';
import './utility/diff_files.js';
import './utility/environment.js';
import './utility/process_info.js';

export async function executeTool(
  call: ToolCall,
  config: AgentConfig,
  onApprove?: (call: ToolCall) => Promise<boolean>
): Promise<ToolResult> {
  const start = Date.now();
  const tool = getTool(call.name);

  if (!tool) {
    const available = getAllTools().map((t) => t.definition.name).join(', ');
    return {
      tool_call_id: call.id,
      name: call.name,
      output: `Error: Unknown tool "${call.name}". Available tools: ${available}`,
      error: true,
      durationMs: Date.now() - start,
    };
  }

  // Require approval for dangerous operations
  const needsApproval =
    !config.autoApprove &&
    (tool.definition.dangerLevel === 'write' ||
      tool.definition.dangerLevel === 'execute' ||
      tool.definition.dangerLevel === 'destructive');

  if (needsApproval && onApprove) {
    const approved = await onApprove(call);
    if (!approved) {
      return {
        tool_call_id: call.id,
        name: call.name,
        output: 'User declined this operation.',
        error: true,
        durationMs: Date.now() - start,
      };
    }
  }

  try {
    const output = await tool.handler(call.arguments, config);
    return {
      tool_call_id: call.id,
      name: call.name,
      output,
      error: false,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      tool_call_id: call.id,
      name: call.name,
      output: `Error: ${msg}`,
      error: true,
      durationMs: Date.now() - start,
    };
  }
}

/** Interactive approval prompt via terminal */
export async function promptApproval(call: ToolCall): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const preview = JSON.stringify(call.arguments, null, 2).slice(0, 300);
    rl.question(
      `\n  Run [${call.name}] with args:\n${preview}\n  Allow? [y/N] `,
      (ans) => {
        rl.close();
        resolve(ans.toLowerCase() === 'y' || ans.toLowerCase() === 'yes');
      }
    );
  });
}
