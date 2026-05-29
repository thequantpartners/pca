# Project Brief - @quantpartners/pca

## What We Are Building
A local-first CLI that gives AI agents persistent project memory — works like Git but for context.

## Current Status
CLI fully functional: init, commit, logs, status, diff, audit, context, staged commits, sync, query, task, mcp server, git hooks, and local SQLite storage. 36/36 tests passing. Published on npm as @quantpartners/pca@1.1.1.

## Stack
TypeScript, Node.js 20+, Commander, better-sqlite3, OpenAI SDK, @modelcontextprotocol/sdk, Chalk, fs-extra

## Detected Structure
src/

## Key Decisions
Markdown is source of truth. SQLite for context commits. Three modes: local-only, byok, cloud. Git hooks auto-capture context. Agents must not read full context by default. Free local CLI + paid cloud model. MIT license.

## Off-limits
.pca/pca.db, ~/.pca/config.json, ~/.pca/session.json, existing git hooks, published npm package version, MIT license, SQLite schema, core markdown files in pca/core/

## README Signal
# PCA — Git for AI context

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
pca se

Updated: 2026-05-29T18:39:39.112Z
