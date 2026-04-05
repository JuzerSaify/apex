// All pre-written Twitter/X thread content for KeepCode CLI
// Each thread has an id, title, and array of tweets.
// mediaPath is optional — place screenshot PNGs in marketing/assets/ and reference them here.

export interface Tweet {
  content: string;
  mediaPath?: string; // relative to marketing/ directory, e.g. "assets/demo.png"
}

export interface Thread {
  id: string;
  title: string;
  description: string;
  tweets: Tweet[];
}

export const threads: Thread[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "launch",
    title: "🚀 Launch — What is KeepCode?",
    description: "Main launch thread. Best for first post.",
    tweets: [
      {
        content: `I've been building an autonomous AI coding agent for the past few months.

It reads your codebase, writes files, runs shell commands, calls APIs, commits git changes, and ships results — all from your terminal.

It's called KeepCode. And it's free. 🧵`,
        mediaPath: "assets/launch_hero.png",
      },
      {
        content: `Most AI coding tools make you pay for every token.

KeepCode works with Ollama — meaning you can run it completely locally, completely free, on models like qwen2.5-coder or deepseek-r1.

No API key. No subscription. Your hardware.`,
      },
      {
        content: `But if you want cloud power, it supports that too:

• OpenAI GPT-4o
• Anthropic Claude Sonnet / Opus
• Google Gemini 2.0 Flash
• DeepSeek V3 / R1
• kimi-k2-thinking (reasoning)

Same CLI. Same 40 tools. Switch with one command.`,
      },
      {
        content: `40 built-in tools:

📂 Read/write any file
🔧 Run bash commands
🌐 Fetch URLs & HTTP requests
🔍 Search files with regex
📝 Git diff, commit, log, status
🧠 Persistent cross-session memory
📌 Checkpoint & resume tasks

The agent picks the right tool automatically.`,
        mediaPath: "assets/tools_list.png",
      },
      {
        content: `The CLI is built to feel premium.

Streaming responses. Collapsing tool-call lines. Live spinner showing iteration count, token usage. Markdown rendered inline.

This is what your terminal deserves.`,
        mediaPath: "assets/cli_demo.png",
      },
      {
        content: `Cloud sync is optional but powerful.

Sign in with Google → your sessions and agent memory sync to the cloud via Supabase. Access from any machine. Resume exactly where you left off.

keepcode login    # opens browser, done in 10s`,
      },
      {
        content: `Install in 4 commands:

git clone https://github.com/JuzerSaify/KeepCode
cd KeepCode && npm install && npm run build && npm link

Then: keepcode

That's it. Pick a model, type a task, watch it work.`,
      },
      {
        content: `KeepCode v1.5.0 is live.

→ github.com/JuzerSaify/KeepCode

Star it if you want to see where this goes. 

RTs help more devs find a free alternative to $200/month agent tools. 🙏`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "vs_claude_code",
    title: "⚔️  KeepCode vs Claude Code",
    description: "Direct comparison thread. High engagement potential.",
    tweets: [
      {
        content: `Claude Code costs $17–$200/month depending on usage.
KeepCode costs $0.

Here's a direct feature comparison. (Not clickbait — actual facts.) 🧵`,
      },
      {
        content: `Claude Code:
❌ Claude models only
❌ Anthropic API required
❌ No offline mode
❌ No MCP server support out of box
❌ No checkpoint/resume

KeepCode:
✅ 4 providers + local Ollama
✅ Works offline with local models
✅ MCP support built in
✅ Checkpoint & resume any task`,
      },
      {
        content: `Both support:
✅ Autonomous multi-step tasks
✅ File read/write
✅ Shell commands
✅ Git operations
✅ Memory between sessions

The difference is: KeepCode doesn't charge you for it.`,
      },
      {
        content: `One thing Claude Code does better: deep Claude model integration.

If you're already paying for Claude Max and love Claude — that makes sense for you.

But if you want the same workflow without vendor lock-in, KeepCode runs any model you already have.`,
      },
      {
        content: `Respect to the Anthropic team. Claude Code is genuinely good.

We're not saying "ours is better." We're saying: you deserve a choice.

A free, open-source option that does the same job.

→ github.com/JuzerSaify/KeepCode`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "free_local",
    title: "🏠 Run AI Coding Agent for Free (Ollama)",
    description: "Local Ollama setup — targets budget-conscious devs.",
    tweets: [
      {
        content: `You don't need to pay $20–$200/month for an AI coding agent.

Here's how to run one locally, free, right now. 🧵`,
      },
      {
        content: `Step 1 — Install Ollama:
→ ollama.com/download

Step 2 — Pull a coding model:
ollama pull qwen2.5-coder:7b

(7GB download. Runs on 8GB RAM.)`,
      },
      {
        content: `Step 3 — Install KeepCode:

git clone https://github.com/JuzerSaify/KeepCode
cd KeepCode
npm install && npm run build && npm link`,
      },
      {
        content: `Step 4 — Run it:

keepcode

Pick your model → type a task → it works.

No API key. No account. No rate limits. No monthly bill.`,
        mediaPath: "assets/local_demo.png",
      },
      {
        content: `What can a free local model actually do?

I ran qwen2.5-coder:14b on a task: "add input validation to the login endpoint."

It read 3 files, wrote the validation logic, added tests, ran them, fixed one failure.

10 iterations. Done. Zero dollars.`,
      },
      {
        content: `The catch: local models are slower and less capable than GPT-4o or Claude.

For simple-to-medium tasks they're surprisingly good. For complex reasoning tasks, use a cloud model.

KeepCode lets you switch with one command: /provider openai`,
      },
      {
        content: `Want the best of both?

Start with Ollama locally. When you hit a hard task, switch to Claude or GPT-4o for that one session. Switch back.

You pay for the hard stuff only.

That's how I use it.`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "reasoning_models",
    title: "🧠 Reasoning Models in Your Terminal",
    description: "Shows kimi-k2-thinking and deep reasoning capability.",
    tweets: [
      {
        content: `Reasoning models (DeepSeek-R1, kimi-k2-thinking) are genuinely different.

They think before they answer. You can watch the reasoning chain in real time.

KeepCode supports them natively. Here's what that looks like. 🧵`,
        mediaPath: "assets/thinking_model.png",
      },
      {
        content: `I gave kimi-k2-thinking a hard task: refactor the auth module to support multiple providers.

It spent 40 seconds thinking. I watched it reason through edge cases I hadn't considered.

Then it wrote the code. First attempt passed tests.`,
      },
      {
        content: `How it works in KeepCode:

keepcode --provider openai --model kimi-k2-thinking:cloud

The <think> reasoning blocks are buffered — you see a clean live spinner while it thinks, then the response appears fully formatted.

No noise. Just the result.`,
        mediaPath: "assets/thinking_spinner.png",
      },
      {
        content: `Supported reasoning models:

• kimi-k2-thinking (via OpenAI-compatible endpoint)
• deepseek-r1:14b / :32b / :70b (local via Ollama)
• deepseek-r1 (cloud via DeepSeek API)
• Any reasoning model running on a local Ollama instance

All work out of the box. No config changes.`,
      },
      {
        content: `One thing I learned: reasoning models need more context window.

KeepCode defaults to 32k tokens for this reason. The agent compresses history intelligently when context fills up.

You shouldn't need to think about this — it just works.`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "tool_showcase",
    title: "🔧 40 Tools — What the Agent Can Actually Do",
    description: "Showcase of all built-in tools. Educational thread.",
    tweets: [
      {
        content: `KeepCode has 40 built-in tools the agent uses automatically.

Most AI coding agents have ~5. Here's why 40 matters. 🧵`,
      },
      {
        content: `File operations:
• read_file — reads any file, any size
• write_file / edit_file / patch_file
• regex_replace — surgical text replacement
• append_file / copy_file / move_file / delete_file
• read_lines — read specific line ranges
• read_json — load and query JSON`,
      },
      {
        content: `Exploration tools:
• list_files / list_directory / glob
• search_files — regex search across codebase
• summarize_directory — get the lay of the land fast
• diff_files — compare two versions

The agent uses these to understand your codebase before touching anything.`,
      },
      {
        content: `Execution tools:
• bash — run any shell command
• node_eval — eval JavaScript inline
• run_tests — runs your test suite and reads results
• lint — runs eslint/tsc and reads errors

The agent runs tests, reads the output, and fixes failures automatically.`,
      },
      {
        content: `Git tools:
• git_status / git_diff / git_log
• git_commit — stages and commits automatically
• git_extras — stash, branch, checkout, rebase

The agent can commit its own work. (You can turn this off with --no-auto-approve.)`,
      },
      {
        content: `Network tools:
• fetch_url — get any web page
• http_request — full REST API calls with headers, body, auth

Great for: pulling docs, hitting your own API, checking external endpoints during a task.`,
      },
      {
        content: `Utility tools:
• memory_read / memory_write — persistent notes across sessions
• checkpoint — save and restore task state
• think — structured reasoning step
• plan — break tasks into subtasks
• task_complete — signals completion cleanly
• environment / process_info — inspect the runtime

All of these. Free. Open source.`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "mcp_support",
    title: "🔌 MCP Server Support",
    description: "Model Context Protocol integration — targets power users.",
    tweets: [
      {
        content: `MCP (Model Context Protocol) is becoming the standard way to give AI agents access to external tools.

KeepCode supports it natively. Any MCP server's tools are automatically bridged into the agent.

Here's how to set it up in 30 seconds. 🧵`,
      },
      {
        content: `Add an MCP server:

keepcode mcp add filesystem \\
  npx @modelcontextprotocol/server-filesystem /path/to/dir

That's it. The agent now has access to all tools that MCP server exposes.`,
      },
      {
        content: `Add multiple servers:

keepcode mcp add database npx @modelcontextprotocol/server-sqlite ./db.sqlite
keepcode mcp add github npx @modelcontextprotocol/server-github

List them: keepcode mcp list
Remove: keepcode mcp remove github`,
      },
      {
        content: `What this means in practice:

• Connect your database — agent can read schema, run queries
• Connect GitHub — agent can open PRs, read issues
• Connect Figma — agent can read design tokens
• Any tool you can wrap in MCP, the agent can use

This is the long-term vision for AI tooling.`,
      },
      {
        content: `KeepCode + MCP + local models = a private, extensible coding agent that connects to anything.

No data leaves your machine unless you choose cloud models.

→ github.com/JuzerSaify/KeepCode`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "pain_points",
    title: "😤 Pain Points Hook — Standalone Punchy Tweets",
    description: "5 standalone hook tweets. Post individually, one per day.",
    tweets: [
      {
        content: `Every AI coding tool wants a subscription.

Claude Code: Anthropic account + API costs
Cursor: $40/month Pro
Copilot: $19/month

KeepCode: $0. Open source. Runs on your own Ollama models.

github.com/JuzerSaify/KeepCode`,
      },
      {
        content: `"Just write a script that reads these 5 files, refactors the logic, runs the tests, commits, and opens a PR."

That's not a Copilot autocomplete job. That's an autonomous agent job.

KeepCode does this. From your terminal. Free.`,
      },
      {
        content: `I got tired of paying $20/month for tools that still ask me to explain what I want every session.

KeepCode has persistent memory. It remembers your codebase, your preferences, your past decisions.

Ask it once. It remembers.`,
      },
      {
        content: `The best AI coding setup in 2026:

1. KeepCode for autonomous tasks (free, local)
2. Your editor for edits you make yourself

You don't need Cursor. You don't need Claude Code.

You need a terminal and a good model.`,
      },
      {
        content: `I asked KeepCode to add auth to my Express app.

It read 8 files, wrote middleware, added JWT handling, updated routes, wrote tests, ran them, fixed 2 failures, committed.

I watched. Didn't type a single line of code.

Free. Local. Terminal. Done.`,
        mediaPath: "assets/auth_task_output.png",
      },
    ],
  },
];
