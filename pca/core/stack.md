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
