# Changelog

All notable changes to Apex are documented here.

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
