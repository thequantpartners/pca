# PCA Project Context

## Project
Name: Project Brief - @quantpartners/pca

A local-first CLI that gives AI agents persistent project memory — works like Git but for context.

## Stack
# Stack

## Language & Runtime
- **TypeScript** — strict ESM (`"type": "module"`), compiled with `tsc`, Node.js 20+
- **Node.js ≥ 20** — required engine; uses native `node:crypto`, `node:http`, `node:child_process`, `node:fs`, `node:path`, `node:os`

## CLI Framework
- **Commander v14** — command registration, option parsing, pre/post action hooks
- Entry point: `src/index.ts` → compiled to `dist/index.js`, exposed as the `pca` binary

## Storage
- **better-sqlite3 v12** — synchronous SQLite driver; project DB stored at `.pca/pca.db`
- Tables: `branches`, `context_commits`, `branch_state`
- Schema managed in `src/core/db.ts` with `CREATE TABLE IF NOT EXISTS` and `ensureColumn` for migrations

## File I/O
- **fs-extra v11** — async/sync file helpers (`readJson`, `writeJson`, `pathExists`, `ensureDir`, `chmod`)
- **fast-glob v3** — glob expansion for markdown source files during local search

## AI / Vector Search
- **openai v6** — used for vector store creation, markdown file uploads, and semantic search
  - `client.vectorStores.create` / `client.vectorStores.files.createAndPoll` / `client.vectorStores.search`
  - API key read from `OPENAI_API_KEY` env var or stored in global user credentials
- Local fallback: keyword scoring over `PCA_INDEX.md` and `pca/**/*.md` when vector store is unavailable or user is not authenticated

## MCP Server
- **@modelcontextprotocol/sdk v1** — exposes a stdio MCP server (`src/mcp/server.ts`)
- Transport: `StdioServerTransport`
- Tools exposed: `pca_status`, `pca_query`, `pca_task`, `pca_commit`, `pca_logs`

## Terminal Output
- **chalk v5** — colored terminal output (red errors, yellow warnings, green success, cyan prompts)
- **clipboardy v5** — copy-to-clipboard for context output

## Utilities
- **dotenv v17** — optional `.env` file loading for `OPENAI_API_KEY` and `PCA_AUTH_BASE_URL`
- **crypto** (Node built-in) — commit ID generation (`timestamp + 4 random bytes hex`), OAuth state tokens

## Auth
- Browser-based OAuth flow: local `http.Server` on a random port listens for the redirect callback
- Session persisted to `~/.pca/auth.json` with `chmod 0o600`
- Token expiry checked on load; expired sessions are treated as unauthenticated

## Dev Tooling
- **tsx v4** — TypeScript execution for `npm run dev` (no build required during development)
- **TypeScript v6** — strict compilation; `tsc` produces the `dist/` ESM output
- **node:test** — built-in test runner; test files in `tests/*.test.mjs`
- `scripts/clean-dist.js` — clears `dist/` before each build
- `scripts/install-hooks.js` — `postinstall` hook that auto-installs git hooks on `npm install`

## Packaging & Distribution
- Published on npm as `@quantpartners/pca` (public, MIT)
- `files` in `package.json`: `dist/`, `scripts/install-hooks.js`, `README.md`, `.env.example`
- `prepack` runs `npm run build` automatically before `npm publish`

## Architecture
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

## Git
Active branch: main

## Latest Context Commits
- 2026-05-29T18:49:53.620Z [architecture] stack and architecture files filled with real context
- 2026-05-29T18:39:39.114Z [product] Bootstrap: initial context snapshot generated

## Active Decisions
No active decisions file found.
