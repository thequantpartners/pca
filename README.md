# PCA — Persistent Context Architecture

> **Git for AI context.** Never lose project context when working with AI agents.

PCA syncs your project knowledge with AI agents (Claude, Codex, Cursor) automatically. No more repeating context. No more agent confusion. No more wasted tokens.

Built for **development teams** using AI in production.

---

## Why PCA?

### The Problem

When your team uses AI agents:
- **Context gets lost** between sessions
- **Agents repeat mistakes** because they forgot the architecture
- **Tokens pile up** because you reload the entire project context
- **Decisions contradict** each other across the team
- **Onboarding new devs** means re-teaching the agent everything

### The Solution

PCA creates a **persistent, synced memory** of your project:

```
Your codebase + decisions + architecture
        ↓
   PCA (local + git hooks)
        ↓
AI agent gets only what it needs (no bloat)
```

**Result:** Faster, cheaper, more reliable AI agents.

---

## What's New in v0.6.0

### ✨ Auto-Sync via Git Hooks

No more manual `pca sync`. PCA syncs automatically after every commit.

```bash
git commit -m "feat: add auth"
# ✅ PCA syncs automatically (silent, non-blocking)
```

**Benefit:** Zero friction. Your team forgets PCA exists—it just works.

### 📋 Audit Trail

See exactly what context each AI task retrieved.

```bash
pca audit
```

```
PCA Audit Log

2024-01-15 10:30:00  [audit_001] implement oauth flow
  Chunks: 2 retrieved, 425 tokens
  From: architecture.md, stack.md
  Status: completed

2024-01-15 09:15:00  [audit_002] fix database query
  Chunks: 3 retrieved, 612 tokens
  From: architecture.md, stack.md, database.md
  Status: completed
```

**Benefit:** Debug AI mistakes. Understand what the agent saw. Optimize token usage.

### ⚠️ Context Health Warnings

Know when your context is stale or out of sync.

```bash
pca status
```

```
Context Health

Core Files:
✅ pca/core/architecture.md (updated 2h ago)
✅ pca/core/stack.md (updated 1d ago)
⚠️  pca/core/product-context.md (updated 14d ago - consider updating)
❌ pca/state/roadmap.md (never synced - run: pca sync)

Vector Store Status:
📊 42 chunks indexed
⏱️  Last sync: 30min ago

Summary:
⚠️  1 file potentially stale (>7 days)
ℹ️  Everything else is healthy
```

**Benefit:** Catch outdated context before it breaks your AI agent.

---

## Features Overview

| Feature | v0.6.0 | Benefit |
|---------|--------|---------|
| **Auto-sync on git** | ✅ | Zero friction, automatic for entire team |
| **Audit trail** | ✅ | Debug AI decisions, optimize tokens |
| **Health warnings** | ✅ | Catch stale context proactively |
| **Git-style commits** | ✅ | Record decisions like you record code |
| **Local-first** | ✅ | Works offline, no cloud required |
| **Markdown source** | ✅ | Version control friendly, readable |
| **Task context generator** | ✅ | Compact context for each AI task |
| **Visual memory** | ✅ | Store screenshots, mockups, references |

---

## Quick Start

### Installation

```bash
npm install -g @quantpartners/pca
```

### Initialize Your Project

```bash
cd your-project
pca init
```

Creates:
- `PCA_INDEX.md` — Project memory entry point
- `pca/core/` — Architecture, stack, decisions
- `pca/state/` — Roadmap, changelog, active tasks
- `.git/hooks/post-commit` — Auto-sync hook (installed automatically)

### Bootstrap Project Context

```bash
pca bootstrap
```

Fills templates with your project basics. Edit as needed.

### Daily Workflow

**For each AI task:**

```bash
pca task "implement user authentication"
```

Output: Compact context ready to paste into Claude/Cursor.

**After work:**

```bash
git commit -m "feat: add auth"
# ✅ PCA syncs automatically
```

**Review what happened:**

```bash
pca audit           # See all AI tasks + context used
pca status          # Check context health
pca logs --last 10  # See context commits
```

---

## Real-World Example: Team of 3 Devs

### Setup

```bash
# Alice, Bob, Charlie clone the repo
git clone <repo-with-pca>
cd project
# PCA is already initialized, hooks installed
```

### Day 1 - Feature Work

**Alice** works on OAuth:
```bash
pca task "implement oauth 2.0 flow"
# Gets: Architecture + Stack + Active Decisions
# Pastes context into Claude → builds feature
git commit -m "feat: oauth implementation"
# ✅ Auto-synced
```

**Bob** works on database:
```bash
pca task "setup postgres migrations for users"
# Gets: Architecture + Stack (relevant parts)
# Pastes context into Cursor → builds migrations
git commit -m "feat: user migrations"
# ✅ Auto-synced
```

**Charlie** works on middleware:
```bash
pca task "implement jwt validation middleware"
# Gets: Stack + Architecture + Active Decisions
# Pastes context into Claude → builds middleware
git commit -m "feat: jwt middleware"
# ✅ Auto-synced
```

### Day 2 - Review & Audit

**Team lead reviews:**

```bash
pca audit
# Sees: All 3 tasks, what context each used, tokens spent
# Decision: "Good context coverage, no conflicts"

pca status
# Sees: All files fresh, vector store in sync
# Decision: "Context health good"
```

### Day 3 - Commit Milestone

```bash
pca commit "completed authentication sprint" --type feature
pca logs --type feature
# Team sees: All context decisions recorded
```

**Result:**
- ✅ No repeated context
- ✅ All 3 devs used consistent context
- ✅ Audit trail shows what each AI task saw
- ✅ Health warnings prevented stale context
- ✅ **Saved ~40% tokens** vs manual context passing

---

## Commands Reference

### Core Commands

```bash
pca init                          # Initialize PCA in a project
pca bootstrap                     # Fill templates with your project info
pca status                        # Show project status + context health
pca task "<task description>"     # Generate compact context for an AI task
```

### Memory Management

```bash
pca commit "<message>"            # Record a context milestone
pca commit "..." --type decision  # Record a specific decision
pca logs                          # View context commit history
pca logs --type feature           # Filter by commit type
pca diff                          # See context changes since last commit
```

### Auditing & Health

```bash
pca audit                         # View all AI task context retrievals
pca audit --task "oauth"          # Filter by task name
pca audit --last 5                # Show last 5 tasks
```

### Sync & Query

```bash
pca sync                          # Sync context to vector store (auto on commit)
pca query "authentication flow"   # Search project memory
```

### Advanced

```bash
pca login                         # Setup cloud sync (future feature)
pca doctor                        # Diagnose project setup
pca config                        # Manage configuration
```

---

## How It Works

### Architecture

```
Your Code + Decisions + Architecture
        ↓
    PCA_INDEX.md (markdown source of truth)
        ↓
    .git/hooks/post-commit (auto-sync on commit)
        ↓
    Vector Store (OpenAI or local)
        ↓
    pca task "..." (RAG retrieval)
        ↓
Compact Context → Claude/Cursor/Codex
```

### The Core Rule

> **Agents must not read the full `pca/` folder by default.**
>
> Agents retrieve only task-relevant context using RAG.
>
> This saves tokens, reduces confusion, and keeps context fresh.

### File Structure

```
your-project/
├── PCA_INDEX.md              ← Agent reads this first
├── AGENTS.md                 ← Agent operating rules
├── pca/
│   ├── core/
│   │   ├── project-brief.md
│   │   ├── architecture.md
│   │   ├── stack.md
│   │   ├── product-context.md
│   │   └── active-decisions.md
│   ├── state/
│   │   ├── roadmap.md
│   │   ├── changelog.md
│   │   └── active-task.md
│   ├── rag/
│   │   ├── sync-log.md
│   │   └── audit-log.jsonl
│   └── visual/
│       ├── screenshots/
│       ├── mockups/
│       └── references/
└── .git/hooks/post-commit   ← Auto-sync (installed by pca init)
```

---

## When to Use PCA

### ✅ Perfect For

- **Development teams** (3+ people)
- **Projects using AI agents** in daily workflow
- **Long-lived projects** (6+ months)
- **Remote teams** (needs context sync across machines)
- **Significant context** (50+ markdown files or complex architecture)

### ℹ️ Not Needed For

- Solo builders (project context in your head)
- Tiny projects (<1 month)
- Simple scripts
- Projects with minimal AI usage

---

## Roadmap

**Current:** v0.6.0 — Team-focused local-first
- ✅ Git hooks auto-sync
- ✅ Audit trail
- ✅ Health warnings
- ✅ Context commits

**Coming Soon:**
- v0.7.0 — Cloud sync & team dashboard
- v0.8.0 — Cost tracking per task
- v1.0.0 — Production-ready with team management

---

## FAQ

**Q: Does PCA require cloud setup?**
A: No. v0.6.0 is local-first. Cloud sync is optional in future versions.

**Q: Will this slow down my commits?**
A: No. Git hooks run in background, non-blocking. Silent on success.

**Q: What if my team member doesn't use PCA?**
A: They don't have to. Hooks are silent. Context syncs automatically for those who do use `pca task`.

**Q: Can I use PCA with GitHub Actions / CI?**
A: Yes. Hooks work in CI. You can trigger `pca sync` in workflows.

**Q: How much does it cost?**
A: **Free forever** for local-first usage. Cloud features (paid) coming in v0.7.0.

**Q: Does PCA work with Cursor, Claude, Codex?**
A: Yes. All AI editors. Just paste the output from `pca task "<your task>"`.

---

## Contributing

Found a bug? Have a feature idea? Issues & PRs welcome:

[GitHub: thequantpartners/pca](https://github.com/thequantpartners/pca)

---

## Support

- **Docs:** [Full documentation](https://github.com/thequantpartners/pca#readme)
- **Issues:** [GitHub Issues](https://github.com/thequantpartners/pca/issues)
- **Twitter:** [@quantpartners](https://twitter.com/quantpartners)

---

## License

MIT — Use freely. No restrictions.

---

## The Core Idea

Git gave developers version control for code.

**PCA gives AI builders version control for context.**

Never lose project memory again.

```bash
npm install -g @quantpartners/pca
pca init
```

Start building smarter AI agents today.
