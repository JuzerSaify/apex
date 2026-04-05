export function toolsGuideSection(): string {
  return `## TOOL USAGE MASTERY

### READING FILES
- **read_file** — read a file with optional line range. Always read before editing. Use start_line/end_line for large files.
- **read_lines** — read multiple non-contiguous line ranges in ONE call. Efficient when you need function + test without the whole file.
- **read_json** — read a JSON file and optionally extract a dot-path value: read_json("package.json", "scripts.build")
- **list_directory** — tree view with depth control. Good for initial project exploration.
- **list_files** — flat recursive list with optional extension filter. Best for file inventories: list_files("src", ".ts")
- **search_files** — regex search across files. Use for finding usages, imports, TODO comments.
- **glob** — pattern matching: "src/**/*.test.ts", "**/*.json". Use when you know the naming pattern.
- **summarize_directory** — statistical overview: file counts by extension, total size, recently modified. Use on unfamiliar codebases.

### WRITING & EDITING
- **edit_file** — PRIMARY editing tool. Surgical find-and-replace. Include 3+ lines of context in old_string. Read the file first.
- **patch_file** — apply MULTIPLE find-and-replace edits to one file in a single call. More efficient than chaining edit_file.
- **write_file** — full file write. Use for new files or complete rewrites only.
- **append_file** — add content to end of file. Creates file if needed. Use for logs, growing lists, config additions.
- **regex_replace** — bulk pattern-based replacement with regex. Use for renaming across a file, format changes.
- **write_json** — write or update a JSON file. Use set_key for targeted key updates: write_json("package.json", set_key="version", set_value="2.0.0")
- **create_directory** — create nested directories (like mkdir -p).
- **delete_file**, **move_file**, **copy_file** — file operations.

### EXECUTION
- **bash** — run any shell command. 120s timeout. Use "2>&1" for stderr. Chain with && for dependent commands.
- **node_eval** — run a JavaScript snippet in the current Node.js process. Good for quick computations, JSON transforms.

### NETWORK
- **fetch_url** — GET a URL, up to 120KB. For docs, raw GitHub files, APIs.
- **http_request** — full HTTP control: method, headers, JSON body. Use for POST/PUT/PATCH/DELETE APIs, webhooks, auth endpoints.

### GIT
- **git_status** — always run first in a git repo. Shows staged, unstaged, untracked.
- **git_diff** — review changes before committing. Use path param to scope to a file.
- **git_log** — recent commit history. Use n param to control count.
- **git_commit** — commit with message. add_all:true stages everything. Use files:[] to be selective.
- **git_stash** — save/restore uncommitted work: push, pop, list, apply, drop.
- **git_branch** — list, create, switch, delete branches.
- **git_pull** — pull from remote with optional rebase.

### CODE QUALITY
- **lint** — run the project linter (ESLint, pylint, etc.). Read config first if available.
- **run_tests** — run the test suite. Use filter to run specific tests.

### UTILITY
- **think** — reason through a complex problem before acting. Use at real decision points only.
- **plan** — structured execution plan with steps + success criteria. Use at START of 3+ step tasks.
- **diff_files** — compare two files or a file vs. proposed content. Use before/after editing to verify changes.
- **environment** — read env vars, check what's set (with redaction for secrets), get system overview.
- **process_info** — check running processes and port usage. Use to verify a server started or find port conflicts.
- **memory_write** — persist important project facts for future sessions.
- **memory_read** — recall previously saved project facts.
- **checkpoint** — save/restore agent state at key points in long tasks.
- **task_complete** — signal task completion. Only call after verifying the solution works.

### USAGE RULES
- Always read_file before edit_file
- Always run git_status before git_commit
- Always run run_tests after making code changes
- Use patch_file instead of multiple edit_file calls when editing the same file
- Use plan before tasks with 3+ steps
- Use diff_files to verify edits applied correctly
- Use summarize_directory before exploring an unfamiliar project`;
}
