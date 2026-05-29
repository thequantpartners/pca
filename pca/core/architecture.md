# Architecture

## Overview
PCA is a local-first CLI that gives AI agents persistent, queryable project memory. It mirrors the Git mental model (commit, log, diff, status) but for developer context rather than source code. A SQLite database stores commits locally; an OpenAI vector store optionally enables semantic search when the user is authenticated.

## Source Layout
```
src/
  index.ts              — Commander program, command registration, pre/post-action hooks
  commands/             — One file per CLI command; each exports a registerXCommand(program) function
  core/                 — Shared modules: DB, config, auth, retrieval, hooks, prompt builder, etc.
  mcp/
    server.ts           — MCP stdio server; exposes pca_status, pca_query, pca_task, pca_commit, pca_logs
  templates/            — Markdown templates for init scaffolding (AGENTS.md, PCA_INDEX.md, docs)
```

## Core Data Flow

### Context Commits
1. User (or agent via MCP) calls `pca commit <message> --type <type>`.
2. `src/core/context-commits.ts` generates an ID (`YYYYMMDDHHmmss-<4 random bytes hex>`) and writes a row to `context_commits` in SQLite.
3. Each commit is scoped to the current git branch (via `git rev-parse --abbrev-ref HEAD`) and linked to the current git hash.
4. Commit statuses: `staged → active → deprecated / archived`. Staged commits are held back until `pca staged confirm`.

### Retrieval (Query / Task)
`src/core/retrieval.ts` decides the retrieval mode:
- **Vector mode** (authenticated + vector store configured): calls `openai.vectorStores.search`.
- **Local mode** (no auth, or `vectorStoreId = "local-only"`): keyword scoring over SQLite commit messages and all `pca/**/*.md` + `PCA_INDEX.md` files. Falls back to local silently on any vector API error.

`src/core/prompt-builder.ts` assembles the retrieved chunks into structured markdown output for `pca query` and `pca task`.

### Sync
`pca sync` uploads all local markdown context files to the OpenAI vector store so that future queries use semantic retrieval. This is the bridge from local-only to vector mode.

### MCP Server
`pca mcp` starts a stdio MCP server. AI agents (Claude Code, Cursor, etc.) connect to it and call the five MCP tools without directly reading the `.pca/` folder. This is the primary integration point for AI development agents.

## SQLite Schema (`src/core/db.ts`)
| Table | Purpose |
|---|---|
| `branches` | Tracks branch names and last-seen timestamps |
| `context_commits` | Stores all context commits with status, type, branch scope, git hash |
| `branch_state` | Tracks last commit and sync timestamps per branch |

Schema is created with `CREATE TABLE IF NOT EXISTS`. New columns are added via `ensureColumn` (ALTER TABLE, only if column missing). Migrations are applied at startup when `initDB()` is called.

## Authentication
- Auth session lives at `~/.pca/auth.json` (token, userEmail, expiry).
- `pca login` opens a browser to the configured `PCA_AUTH_BASE_URL` backend, starts a local HTTP callback server on a random port, and exchanges the OAuth code for a session token.
- `src/core/auth.ts` provides load/save/clear helpers; expired sessions are treated as absent.
- Auth is required for vector store operations only. All local commands work without auth.

## Git Hooks (`src/core/hooks.ts`)
PCA installs five git hooks via `pca install-hooks`:
| Hook | Action |
|---|---|
| `post-commit` | Runs `pca _post-commit-record` to record the git hash |
| `post-checkout` | Runs `pca _branch-changed` on branch switches |
| `post-merge` | Runs `pca _post-merge` to sync branch context after merges |
| `post-rewrite` | Runs `pca _post-rewrite` for amend/rebase tracking |
| `reference-transaction` | Detects branch deletion and archives its context |

Hook commands are prefixed with `_` and excluded from `pca help` and the post-action advice loop.

## Three Operational Modes
| Mode | Config | Retrieval |
|---|---|---|
| **local-only** | `vectorStoreId: "local-only"` | Keyword search over markdown + SQLite |
| **byok** | OpenAI key set, auth session valid | OpenAI vector store semantic search |
| **cloud** | Hosted PCA backend + auth | Same as byok, managed credentials |

## Config Files
| Path | Purpose |
|---|---|
| `.pca/config.json` | Per-project: `projectName`, `projectSlug`, `vectorStoreId` |
| `~/.pca/config.json` | Global: `authBaseUrl` |
| `~/.pca/auth.json` | Auth session token and expiry |
| `~/.pca/openai-key` | Stored OpenAI API key (via `pca setup`) |
| `.pca/pca.db` | SQLite database (off-limits; never edited directly) |

## Key Design Decisions
- **Markdown is the source of truth** for human-readable context; SQLite is the operational store.
- **Agents must not read the full context folder**. PCA exposes only retrieved, task-scoped chunks via MCP and CLI to keep AI token usage bounded.
- **Local fallback is always available**. No auth or network access is ever required for commit/log/status/diff operations.
- **Branch-scoped commits** allow context to follow git branches and be merged/archived on branch lifecycle events.
- **Staged commits** let hooks queue context without immediately confirming it, enabling review workflows.
