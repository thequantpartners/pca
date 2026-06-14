<div align="center">

  <img src="https://raw.githubusercontent.com/thequantpartners/pca/main/assets/pca-banner.png" alt="PCA — Git for AI context" width="700"/>

**PCA — Git for AI context**

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.7-green)](https://www.npmjs.com/package/@quantpartners/pca)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Local-first](https://img.shields.io/badge/runs-local--first-black)]()
[![No telemetry](https://img.shields.io/badge/no%20telemetry-%E2%9C%93-lightgrey)]()

[Quick Start](#quick-start) · [What is PCA?](#what-is-pca) · [Commands](#commands) · [How it works](#how-it-works) · [Git Sync](#git-sync) · [License](#license)

</div>

> [!IMPORTANT]
> **AI AGENT NOTICE**: If you are an AI agent, you **MUST** read [AGENTS.md](file:///c:/Users/Ken%20Ryzen/Documents/proyectos-sass/PCA-CLI/AGENTS.md) first to understand the workspace operating rules and context requirements before executing tasks.

---

# PCA — Git for AI context

<a name="what-is-pca"></a>

PCA is a local-first CLI that keeps project context, decisions, and AI handoff notes close to your code.
It solves context drift between Git changes and AI agents.

Builders using AI agents (Cursor, Claude, Codex, Gemini) lose project context between sessions. You repeat yourself. The agent forgets decisions. Prompts grow. PCA fixes that.

## Install

```bash
npm install -g @quantpartners/pca
```

Requires Node.js >= 20.

## Quick start

```bash
cd your-project
pca setup
pca init
pca bootstrap
pca context
```

`pca setup` configures mode and API key.
`pca init` initializes project memory.
`pca bootstrap` fills project context interactively.
`pca context` generates the current project context, copies it to your clipboard, and saves `.pca/last-context.md`.

## Commands

### CORE

| Command | Description |
| --- | --- |
| `pca init` | Initialize project memory |
| `pca bootstrap` | Fill project context interactively |
| `pca context` | Generate project context and copy to clipboard |
| `pca context --prompt` | Generate an LLM-optimized context prompt |
| `pca commit "<msg>"` | Record a context milestone |
| `pca close "<msg>"` | Automate closing active tasks and update roadmap |

## 🤖 Instructions for AI Agents
If a user tells you to "use this repo" or "work on this task", follow this protocol:
1. **Read Context First**: Run `pca context --prompt` (or ask the user to run it) and read the output carefully. This gives you the system prompt and operational rules.
2. **Follow `AGENTS.md`**: Do exactly what the agent rules say. Only modify code after understanding the architectural decisions.
3. **Commit Context**: When making significant changes or decisions, prompt the user to run `pca commit` to save the memory.
4. **Close Tasks**: When a task is fully complete and validated, instruct the user to run `pca close` (or run it yourself if you have CLI execution tools) to automatically update the roadmap, changelog, and sync logs.
| `pca staged` | Manage staged context commits |
| `pca logs` | List context history |
| `pca status` | Show project and context state |

### GIT SYNC (automatic)

Hooks run automatically on git commit, checkout, merge and rebase.
No manual commands needed.

### MAINTENANCE

| Command | Description |
| --- | --- |
| `pca health` | Check context file sizes |
| `pca doctor` | Diagnose PCA setup |
| `pca forget` | Deprecate obsolete context |
| `pca diff` | Show context diff |
| `pca audit` | Audit context history |
| `pca recovery` | Restore a deprecated context commit |
| `pca sync` | Sync context to vector store |
| `pca query "<query>"` | Query project memory |
| `pca task "<task>"` | Generate agent-ready task context |
| `pca setup` | Configure mode and API key |
| `pca mcp` | Start MCP server |

### AUTH

| Command | Description |
| --- | --- |
| `pca login` | Sign in |
| `pca logout` | Sign out |
| `pca whoami` | Show active account |
| `pca config` | Manage configuration |

## How it works

- Markdown files hold project memory and agent-facing context.
- SQLite in `.pca/pca.db` stores context commits, staged items, branches, and status.
- Git hooks stage context from commits and track branch, merge, and rebase events.
- `pca context` builds a paste-ready Markdown snapshot for your AI agent.

## Git sync

`pca init` installs hooks for commit, checkout, merge, and rewrite/rebase events.
The hooks stage context automatically, switch branch-local context, and archive old branch context when confirmed.
Use `pca staged list`, `pca staged commit`, `pca staged drop <index>`, or `pca staged clear` to manage staged context.

## License

MIT
