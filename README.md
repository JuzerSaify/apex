# Apex

A fully autonomous AI coding agent that runs locally via **Ollama**. Give it a task — it plans, explores, edits files, runs commands, calls APIs, and ships a result.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Ollama](https://img.shields.io/badge/Powered%20by-Ollama-black)](https://ollama.com)

## Install

```bash
git clone https://github.com/JuzerSaify/apex
cd apex
npm install
npm run build
npm link
```

Requires [Ollama](https://ollama.com) running locally (or point `--url` at a remote instance).

## Usage

```bash
# Interactive — pick your model, then type your task
apex

# Direct task
apex --model qwen2.5-coder:7b --run "add input validation to the login endpoint"

# Auto-approve all tool calls (no confirmation prompts)
apex --model llama3.1:8b --run "fix the failing tests" --auto-approve

# Point at a remote Ollama instance
apex --model deepseek-r1:14b --url http://192.168.1.10:11434 --run "refactor auth module"
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--model`, `-m` | interactive | Ollama model to use |
| `--url` | `http://localhost:11434` | Ollama base URL |
| `--run`, `-r` | interactive | Task to execute non-interactively |
| `--auto-approve` | false | Skip tool-call confirmation prompts |
| `--verbose` | false | Stream tokens as they arrive |
| `--max-iter` | 50 | Max agent iterations |
| `--working-dir` | `cwd` | Root directory for all file operations |

## Tools (38 total)

### Read
| Tool | Description |
|------|-------------|
| `read_file` | Read file with optional line range |
| `read_lines` | Read multiple non-contiguous line ranges in one call |
| `read_json` | Read JSON file with optional dot-path query |
| `list_directory` | Tree view with depth control |
| `list_files` | Flat recursive listing with extension filter |
| `search_files` | Regex search across files |
| `glob` | Pattern-match files (e.g. `**/*.test.ts`) |
| `summarize_directory` | File count, extension breakdown, size, recently modified |

### Write
| Tool | Description |
|------|-------------|
| `edit_file` | Surgical find-and-replace (primary editing tool) |
| `patch_file` | Apply multiple edits to one file atomically |
| `write_file` | Full file write |
| `append_file` | Append content to file |
| `regex_replace` | Bulk regex-based replacement |
| `write_json` | Write JSON or update a single key |
| `create_directory` | Create nested directories |
| `delete_file` | Delete a file |
| `move_file` | Move or rename a file |
| `copy_file` | Copy a file |

### Execute
| Tool | Description |
|------|-------------|
| `bash` | Run any shell command (120s timeout) |
| `node_eval` | Evaluate a JavaScript snippet in-process |

### Network
| Tool | Description |
|------|-------------|
| `fetch_url` | GET a URL (docs, raw files, APIs) |
| `http_request` | Full HTTP client: POST/PUT/PATCH/DELETE with headers + body |

### Git
| Tool | Description |
|------|-------------|
| `git_status` | Working tree status |
| `git_diff` | Review changes |
| `git_log` | Commit history |
| `git_commit` | Stage and commit |
| `git_stash` | Push/pop/list/apply/drop stash |
| `git_branch` | List/create/switch/delete branches |
| `git_pull` | Pull with optional rebase |

### Code Quality
| Tool | Description |
|------|-------------|
| `lint` | Run project linter |
| `run_tests` | Run test suite with optional filter |

### Utility
| Tool | Description |
|------|-------------|
| `think` | Reason through a problem before acting |
| `plan` | Display a structured execution plan |
| `diff_files` | Unified diff between two files or file vs. string |
| `environment` | Read env vars with secret redaction |
| `process_info` | Check running processes and port usage |
| `memory_write` | Persist project facts across sessions |
| `memory_read` | Recall persisted facts |
| `checkpoint` | Save/restore agent state |
| `task_complete` | Signal verified task completion |

## Project Layout

```
src/
  agent/          # Core loop, memory, compression, trainer
  config/         # Defaults and config loader
  prompt/         # System prompt builder and sections
  providers/      # Ollama HTTP client
  tools/          # All 38 tool implementations
  types/          # TypeScript interfaces
  ui/             # Terminal renderer and components
```

## How It Works

1. **Plans** — calls `plan` at the start of multi-step tasks to show its approach
2. **Explores** — reads files, searches code, inspects environment with `summarize_directory`
3. **Acts** — writes files with `patch_file`/`edit_file`, runs commands via `bash`, calls APIs with `http_request`
4. **Verifies** — re-reads files, runs tests, diffs before/after with `diff_files`
5. **Completes** — calls `task_complete` only after verification passes

The agent stores learnings in `.apex/` — memory, training insights, and checkpoints persist across sessions.

## Requirements

- Node.js 18+
- Ollama with at least one model pulled (`ollama pull qwen2.5-coder:7b`)

## License

MIT
