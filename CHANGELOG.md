# Changelog

All notable changes to KeepCode are documented here.

---

## [v1.4.0] — 2026-04-10

### Multi-Provider AI Support

- **OpenAI** — GPT-4o, GPT-4o-mini, o1, o3-mini (and any OpenAI-compatible endpoint)
- **Anthropic** — Claude 3.5 Sonnet, Claude 3.7 Sonnet (streaming SSE + tool_use blocks)
- **DeepSeek** — DeepSeek-V3, DeepSeek-R1 (via OpenAI-compatible API)
- **Ollama** — still fully supported as optional local provider
- New CLI flags: `--provider openai|anthropic|deepseek|ollama`, `--api-key`, `--api-base`
- API key auto-resolved from `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` env vars
- `src/providers/openai/index.ts` — new streaming + tool-call provider
- `src/providers/anthropic/index.ts` — new streaming SSE + tool_use provider
- `src/providers/factory.ts` — `createProvider(config)` factory, replaces direct Ollama construction
- Normalized `ChatResponse` interface — all providers return identical `{ content, toolCalls, inputTokens, outputTokens }`

### KeepCode Cloud (Supabase)

- **Google Sign-In** — `keepcode login` opens browser for Google OAuth PKCE flow
- `keepcode logout` / `keepcode profile` commands
- Sessions, memory, and MCP server configs sync to Supabase cloud
- `src/auth/store.ts` — secure local session storage (`~/.keepcode/auth.json`, mode 0o600)
- `src/auth/google.ts` — PKCE OAuth flow with local callback server (port 54321)
- `src/auth/index.ts` — `AuthManager` class; singleton `auth` export
- `src/db/client.ts` — Supabase client singleton
- `src/db/sync.ts` — `saveSessionToCloud`, `listRecentSessions`, `syncMemoryToCloud`, `loadMemoryFromCloud`

### MCP (Model Context Protocol)

- `keepcode mcp add <name> <command> [args…]` — register an MCP server
- `keepcode mcp list` — show all configured servers
- Servers auto-connected at session start from `.keepcode/mcp.json`
- MCP tools bridged into the agent tool registry with `serverName__toolName` prefixing
- `src/mcp/client.ts` — `MCPClient` (JSON-RPC 2.0 over stdio, 30 s timeout)
- `src/mcp/manager.ts` — `MCPManager`; `loadMCPServers`, `getMCPToolDefinitions`, `callMCPTool`

### Auto-Update

- `keepcode update` — checks npm registry and runs `npm update -g keepcode`
- Update banner shown on session start when a new version is available
- `src/updater/index.ts`

### `keepcode sessions`

- Lists recent cloud sessions with date, provider/model, task snippet, and status

### Bug Fixes & Internal Refactors

- `AgentConfig`: deprecated `ollamaUrl`, added `provider`, `apiKey`, `apiBaseUrl`
- `IProvider` interface normalized; `ModelInfo` replaces Ollama-specific model shape
- `src/providers/ollama/index.ts` updated to return `ChatResponse` / `ModelInfo`
- `src/types/provider.ts`: typo `OlamaStreamChunk` → `OllamaStreamChunk` fixed
- `package.json` version: `1.3.0` → `1.4.0`

---

## [v1.3.0] — 2026-04-05

### Rebrand: Apex → KeepCode

- **CLI command** renamed: `apex` → `keepcode`
- **Package name** renamed: `apex` → `keepcode`
- All UI strings, banners, identity prompt, and in-REPL messages updated to "KeepCode"
- **New ASCII banner** — two-block stacked "KEEP / CODE" logo with purple→cyan gradient

### Bug Fixes

- **`src/agent/compressor.ts`** — `needsCompression()` was hardcoding `0.82` instead of importing and using the `COMPRESS_THRESHOLD` constant from `defaults.ts`. Context compression triggered at wrong threshold.
- **`src/tools/read/search_files.ts`** — `args.file_pattern` used `String.replace('.', '\\.')` (no regex flag) which only replaced the *first* occurrence. Patterns like `*.test.ts` with multiple dots broke silently. Fixed with global regex flags: `/\./g`, `/\*/g`, `/\?/g`.
- **`src/agent/trainer.ts`** — `extractToolsUsed()` used regex matching on `msg.content` looking for `"calling tool: ..."` text that never appears. Always returned an empty array. Rewritten to read `msg.tool_calls` array directly.
- **`src/tools/utility/memory_write.ts`** — Section-replacement regex used `$` (end-of-line in multiline mode) instead of `\s*$` (end-of-string). Replacing the last section in a memory file failed silently.
- **`src/ui/session.ts`** — `PACKAGE_VERSION` was stale at `'1.0.0'`. Updated to `'1.3.0'`.
- **`src/ui/components/model_picker.ts`** — Used `\x1B[2J\x1B[0f` (clear entire terminal including scrollback). Replaced with cursor-up + clear-from-cursor (`\x1B[nA\x1B[J`) for in-place redraws.

### Tool Improvements

- **`src/tools/execute/bash.ts`**
  - Auto-detects Windows and uses `powershell.exe` as the shell (no more cmd.exe failures for PowerShell commands)
  - Removed noisy `"STDOUT:\n"` prefix from output
  - Error messages now include the exit code, e.g. `Command failed (exit 1): ...`

- **`src/tools/write/edit_file.ts`**
  - Return message now shows a diff summary: `Edited path/to/file.ts: +3 lines (5 removed → 8 added)`

- **`src/tools/utility/think.ts`**
  - Returns the thought text directly rather than the verbose `"Thought recorded: ..."` prefix

- **`src/tools/read/search_files.ts`**
  - Outputs relative paths (relative to `workingDir`) instead of absolute paths
  - Adds a count header: `N match(es) for "pattern"`
  - Gracefully handles `stat()` errors (path not found) instead of throwing

### Premium CLI UI

- **`src/ui/components/spinner.ts`** — New `Spinner.for(phase, text)` factory; each agent phase (`thinking`, `planning`, `tools`, `network`, `compressing`) gets its own spinner style (`dots12`, `bouncingBar`, `dots8Bit`, `arc`, `squish`)
- **`src/ui/renderer.ts`**
  - Each status type carries a `spinner` field — the correct ora spinner is used per agent phase
  - Token streaming uses a purple block cursor `▌` instead of plain `→`
  - `onToolCall` displays a styled separator line under the tool name
  - `onPlan` uses a gradient separator bar (░▒▓█▓▒░) instead of plain dashes
  - `onComplete` title/box uses `chalk.hex` for the success green instead of `theme.success` chain
  - `onComplete` strips both `APEX_TASK_COMPLETE` and `KEEPCODE_TASK_COMPLETE` prefixes
- **`src/ui/components/model_picker.ts`**
  - In-place redraw: no more full-screen wipe
  - KeepCode branded header
  - Cleaner layout with dim separator line

### Prompt & Identity

- **`src/prompt/sections/identity.ts`** — Updated to KEEPCODE v1.3.0; added Memory principle: use `memory_read` at session start and `memory_write` to persist cross-session insights

### New Files

- **`COMPARISON.md`** — Feature matrix and agentic benchmark table comparing KeepCode vs Claude Code, Codex CLI, Aider, and Continue

### Package

- `package.json` version: `1.2.0` → `1.3.0`
- `src/index.ts` `PKG_VERSION`: `1.2.0` → `1.3.0`

---

## [v1.2.0] — 2026-04-03

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

## [v1.1.0] — 2026-04-01

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
