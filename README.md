# PCA

> Git for AI context.

[![npm version](https://img.shields.io/npm/v/@quantpartners/pca.svg)](https://www.npmjs.com/package/@quantpartners/pca)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

PCA 1.0.0 is an open source CLI that gives your project persistent AI context. Never lose project context again.
Built for solo builders, vibe coders, indie hackers, and AI builders.

## The Problem

AI agents forget what happened between sessions.
Architecture decisions get buried in chat history.
Prompts grow because you keep re-explaining the project.
Branch switches make context even easier to lose.

## The Solution

PCA gives the project its own memory.
Markdown stays the source of truth, Git captures the workflow, and SQLite indexes operational state.
You set it up once per project, then PCA works quietly in the background.

## Installation

```bash
npm install -g @quantpartners/pca
```

```bash
cd your-project
pca init
```

`pca init` installs the local memory structure and two Git hooks: `post-commit` for decision capture and `post-checkout` for branch awareness.

## How It Works

PCA integrates with Git so context capture follows the workflow you already use.

```bash
git commit -m "feat: implement checkout flow"
```

After Git finishes printing its normal output, PCA may ask:

```text
┌─────────────────────────────────────────┐
│  PCA — Save this decision?              │
│  commit: feat: implement checkout flow  │
│  [Y] Yes, record  [N] No, skip          │
└─────────────────────────────────────────┘
> y
```

If you answer yes, PCA records the decision in project memory and indexes it by branch.
If the commit is not relevant, PCA resolves it silently.

Branch changes are tracked too:

```bash
git switch payments
```

```text
# no output
# PCA updates the active branch context in the background
```

The hooks do not block your terminal. They run in the background and keep Git as the natural trigger for context updates.

## Commands

| Command | Description |
| --- | --- |
| `pca init` | Set up PCA for the project once. |
| `pca status` | Show current project context status. |
| `pca commit` | Manually record a decision or milestone. |
| `pca query` | Search project memory. |
| `pca task` | Generate compact context for an AI agent. |
| `pca logs` | Show context commit history. |
| `pca doctor` | Diagnose local PCA setup and project health. |

## Philosophy

Markdown files in `pca/` are the source of truth because builders should be able to read and edit memory directly.
Git hooks capture context at the moment work happens.
SQLite in `.pca/pca.db` is the operational index for branch awareness, pending prompts, and commit history.
The agent should execute with context, not be responsible for remembering it.

## Roadmap

1.0.0 -> Git-native context memory ✅
2.0.0 -> PCA Cloud: vector memory
Future -> Team context and agent handoff

## License

MIT

## Links

- npm: [@quantpartners/pca](https://www.npmjs.com/package/@quantpartners/pca)
- GitHub: [thequantpartners/pca](https://github.com/thequantpartners/pca)
