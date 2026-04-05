# Changelog

All notable changes to Apex are documented here.

---

## [v1.2.0] — 2026-04-07

### New Tools (16 registrations across 14 files)

**Read**
- `read_lines` — read multiple non-contiguous line ranges in a single call (more efficient than chained `read_file` calls)
- `read_json` — read a JSON file with optional dot-path query (`"scripts.build"` → returns just that value)
- `list_files` — flat recursive file listing with optional extension filter; skips `node_modules`, `.git`, `dist`
- `summarize_directory` — directory statistics: file count by extension, total size, top-10 recently modified

**Write**
- `patch_file` — atomically apply N find-and-replace edits to one file in a single call
- `append_file` — append content to a file (creates if absent); optional newline separator
- `regex_replace` — regex-pattern find-and-replace across an entire file with flags support
- `write_json` — write a JSON file or update a single key without overwriting the rest (`set_key` mode)

**Network**
- `http_request` — full HTTP client supporting POST/PUT/PATCH/DELETE/HEAD with custom headers and JSON body auto-detection

**Git**
- `git_stash` — push, pop, list, apply, drop stash entries
- `git_branch` — list, create, switch, delete branches
- `git_pull` — pull from remote with optional rebase

**Utility**
- `plan` — render a structured execution plan (goal, ordered steps, success criteria, risks)
- `diff_files` — LCS-based unified diff between two files or a file vs. a proposed string
- `environment` — read environment variables with prefix filtering and automatic secret redaction
- `process_info` — inspect running processes and port usage (cross-platform: Windows + Unix)

### Agent Improvements

- **Tool error recovery** — when a tool call returns an error, the agent now injects an explicit recovery hint into the model's message history, prompting it to try a different approach or tool instead of silently retrying the same operation
- **Consecutive error detection** — after 2+ consecutive tool failures, a stronger escalation hint is injected: "Try a completely different approach"
- **Improved stall-detection nudge** — turn 1 stall gets a gentle reminder; turn 2+ stall gets an imperative directive to call a tool or `task_complete`
- **`plan` tool support in loop** — the `plan` tool now renders a visible execution plan to the user at the start of complex tasks

### Prompt Enhancements

- **`identity.ts`** — version bumped to v1.2.0; complete tool inventory across 7 categories; tightened core principles
- **`tools_guide.ts`** — rewritten with documentation for all 38 tools; organized by category with usage patterns and rules
- **`principles.ts`** — principle 3 updated: `plan` is now explicitly required before multi-step tasks; `think` reserved for in-task decision points
- **`task_patterns.ts`** — 6 new patterns added: Analyzing an Unfamiliar Codebase, Making Multiple Changes to a File, HTTP API Integration, Git Branch Workflow, Environment/Config Investigation, Debugging Port/Process Issues

### Other

- `package.json` version bumped: `1.1.0` → `1.2.0`
- `src/index.ts` `PKG_VERSION` updated to `1.2.0`
- README completely rewritten: focused ~150-line reference with tool tables, usage examples, and project layout

---

## [v1.1.0] — 2026-04-05

### Bug Fixes

- **Double model inference eliminated** — verbose/streaming mode used to make two separate API calls (one to stream tokens, one to retrieve tool calls). A single `chatStreamFull()` pass now streams tokens live and captures the complete response including `tool_calls`, cutting model inference in half for every streamed turn.
- **Tool results now correctly associated with tool calls** — assistant messages pushed to conversation history now include the `tool_calls` array required by the Ollama protocol. Previously the model could not reliably correlate tool results with the calls that triggered them, causing degraded multi-step reasoning.
- **Fake assistant content removed** — when the model called tools but returned no text, a placeholder `"Calling N tool(s)..."` string was injected into conversation history, polluting the model's context window. This is now removed.
- **Agent result captured on timeout** — when the agent reached `maxIterations` without completing, `state.result` was left `undefined`, causing the renderer to display nothing. The last assistant message is now used as the result.
- **IDE compile errors fixed** — `moduleResolution` was set to `"bundler"` which caused 18 false-positive TypeScript errors in VS Code. Switched to `"NodeNext"` to match the actual Node ESM runtime.

### Improvements

- `Message` interface extended with optional `tool_calls` field — aligns the internal message type with the Ollama wire format for full round-trip fidelity.
- Stall-detection nudge message improved — when the model goes N turns without calling any tools, the nudge message now includes the turn count and clearer instructions to either continue working or call `task_complete`.
- `toOllamaMessages()` updated to serialize `tool_calls` when round-tripping messages back to the Ollama API.

---

## [v1.0.0] — 2026-03-28

### Initial Release

- Autonomous agent loop with configurable max iterations
- 20+ built-in tools: file read/write/edit, bash, git, search, fetch, think, checkpoint, memory
- Ollama-native — runs entirely locally with any Ollama-compatible model
- Streaming token output with live spinner UI
- Auto-approval mode (`--auto-approve`) for fully unattended runs
- Context compression to stay within model context windows
- Training run recorder for self-improvement data collection
- Interactive model picker with tool-support indicator
