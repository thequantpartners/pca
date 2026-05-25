# PCA

> Git for AI context.

[![npm version](https://img.shields.io/npm/v/@quantpartners/pca.svg)](https://www.npmjs.com/package/@quantpartners/pca)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

PCA is an open source CLI that gives your project persistent AI context. It keeps decisions, project memory, branch state, and AI task context close to your code.

## Installation

```bash
npm install -g @quantpartners/pca
```

```bash
cd your-project
pca init
```

`pca init` creates the local memory structure and installs Git hooks. If the workspace is already initialized, run:

```bash
pca install-hooks
```

## How It Works

PCA uses Git as the trigger, Markdown as the source of truth, and SQLite in `.pca/pca.db` as the operational index.

After a relevant Git commit, the hook records a pending decision and exits:

```bash
git commit -m "feat: implement checkout flow"
```

```text
💡 PCA: Decision pending. Run 'pca commit' to save it.
```

Review pending decisions when you are back at the shell:

```bash
pca commit
```

```text
┌─────────────────────────────────────────┐
│  PCA — Save this decision?              │
│  commit: feat: implement checkout flow  │
│  [Y] Yes, record  [N] No, skip          │
└─────────────────────────────────────────┘
> y
```

Accepted decisions are recorded in project memory. Skipped decisions are resolved and removed from the pending queue.

Branch changes are tracked by the `post-checkout` hook so PCA can keep branch-local context state.

## Daily Flow

```bash
# New project
pca init
pca bootstrap
pca task "describe your task"

# Every day
git commit -m "feat: something"
pca commit
pca task "next task"

# When ready for cloud memory
pca setup
pca sync
```

## Commands

### Local commands

These work without an OpenAI API key.

| Command | Description |
| --- | --- |
| `pca init` | Initialize PCA memory in this project. |
| `pca bootstrap` | Generate initial context from an existing project. |
| `pca status` | Show project memory status. |
| `pca commit` | Record decisions or review pending ones. |
| `pca logs` | List active context commit history. |
| `pca logs --all` | List active and deprecated context commits. |
| `pca forget` | Deprecate a context commit. |
| `pca recovery` | Restore a deprecated context commit. |
| `pca task` | Generate compact context for your AI agent. |
| `pca doctor` | Diagnose your PCA setup. |
| `pca install-hooks` | Reinstall Git hooks in the current project. |
| `pca help` | Show the CLI guide. |

### Cloud commands

These require an OpenAI API key. Run `pca setup` first.

| Command | Description |
| --- | --- |
| `pca setup` | Configure your OpenAI API key. |
| `pca sync` | Upload memory to OpenAI Vector Store. |
| `pca query` | Search memory via RAG. |
| `pca visual add` | Add image to visual memory. |
| `pca close` | Close a task and update changelog. |

### PCA Cloud

Coming in `2.0.0`:

| Command | Description |
| --- | --- |
| `pca login` | Sign in to PCA Cloud. |
| `pca logout` | Clear cloud session. |
| `pca whoami` | Show account status. |

## Forget And Recovery

Use `pca forget` when a context commit is no longer valid. PCA marks it as deprecated instead of deleting it.

```bash
pca forget
pca logs --all
```

Use `pca recovery` to restore a deprecated commit:

```bash
pca recovery
```

## Rules

- Local-only mode works with no API key required.
- Markdown files in `pca/` remain the source of truth.
- Agents must not read the full `pca/` folder.
- Use `pca task` before every AI agent session.
- Use `pca commit` to review pending decisions and record context.
- Cloud commands require `pca setup` first.

## License

MIT

## Links

- npm: [@quantpartners/pca](https://www.npmjs.com/package/@quantpartners/pca)
- GitHub: [thequantpartners/pca](https://github.com/thequantpartners/pca)
