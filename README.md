# PCA — Git for AI context

PCA is a local-first CLI that keeps project context, decisions, and AI handoff notes close to your code.
It solves context drift between Git changes and AI agents.

## Install

```bash
npm install -g @quantpartners/pca
```

Requires Node.js >= 20.

## Quick start

```bash
cd your-project
pca init
pca bootstrap
pca context
```

`pca context` generates the current project context, copies it to your clipboard, and saves `.pca/last-context.md`.

## Commands

### CORE

| Command | Description |
| --- | --- |
| `pca init` | Initialize project memory |
| `pca bootstrap` | Fill project context interactively |
| `pca context` | Generate project context and copy to clipboard |
| `pca commit "<msg>"` | Record a context milestone |
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
| `pca sync` | Sync context to vector store |
| `pca query "<query>"` | Query project memory |

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
