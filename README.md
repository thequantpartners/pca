# PCA CLI

**Never lose project context again.**

PCA gives AI agents persistent memory. Commit decisions, query context, and keep every session grounded — without repeating yourself.

```bash
npm install -g @quantpartners/pca
```

> **Windows users:** If PowerShell blocks `pca`, use `pca.cmd` or run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` as Administrator.

---

## What is PCA?

When you build with AI agents, context disappears between sessions. You repeat decisions. Prompts grow. The project loses continuity.

PCA fixes that.

```
Git tracks code history.
PCA tracks project context history.
```

- Store decisions, milestones, and project memory in Markdown
- Query only what's relevant — agents never read the full context
- Works offline, no API key required to start

---

## Quickstart

```bash
pca setup        # guided onboarding
pca init         # initialize memory in your project
pca commit "Defined auth strategy" --type decision
pca status       # see your context state
```

---

## Modes

| Mode | Requires | What you get |
|------|----------|--------------|
| `local-only` | Nothing | Offline Markdown memory |
| `byok` | OpenAI API key | Vector search + RAG queries |
| `cloud` | PCA account | Cloud sync + dashboard (coming soon) |

Start local. Upgrade when your project grows.

```bash
pca setup --mode local-only     # no API key needed
pca setup --mode byok --api-key <key>
pca setup --mode cloud
```

---

## Core Commands

```bash
# Setup & diagnostics
pca setup               # guided onboarding
pca doctor              # diagnose your setup
pca status              # project memory state
pca health              # context size and hallucination risk

# Memory
pca init                # initialize PCA in your project
pca commit "message"    # record a decision or milestone
pca commit "message" --type decision|feature|architecture|product
pca logs                # view context history
pca logs --last 10
pca logs --type decision

# Query & tasks
pca query "auth strategy"         # search project memory
pca task "build login screen"     # generate compact agent context

# Sync & close
pca sync                # sync memory to vector store
pca close               # close session and update changelog

# Account
pca login / logout / whoami
```

---

## Context Health

PCA warns you before context gets too large and agents start hallucinating.

```bash
pca health
```

```
🟢 Context Health — SAFE
────────────────────────────────────────
Words        3,400
Tokens       ~2,550 / 15,000
Usage        17%
```

A `💡 PCA advice` warning appears automatically after any command when your context approaches the limit.

---

## Credentials & Storage

PCA stores everything in `~/.pca/` — never inside your project:

```
~/.pca/auth.json      # PCA session
~/.pca/config.json    # global config
~/.pca/secrets.json   # API keys (fallback)
```

Your project only contains:

```
PCA_INDEX.md
AGENTS.md
.pca/config.json
pca/
```

No secrets. No `.env` pollution.

---

## Typical Flows

**Local only (no API key)**
```bash
pca setup --mode local-only
pca init
pca commit "initial context snapshot"
pca logs
```

**With OpenAI (vector search)**
```bash
pca setup --mode byok --api-key <key>
pca init
pca sync
pca task "build checkout flow"
```

---

## Roadmap

```
0.1–0.4  CLI base, Git-style commits, global auth ✓
0.5      PCA Cloud sync beta
0.6      Dashboard + token savings analytics
1.0      Context OS for AI builders
```

---

## Limitations

- Cloud login requires a hosted PCA backend (not included in CLI)
- No web dashboard yet
- No multiuser project sharing yet
- Visual memory stores metadata only — multimodal analysis coming in v2

---

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
```

```bash
npm link        # local global install
pca help
```
