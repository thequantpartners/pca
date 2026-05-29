# PCA Index — @quantpartners/pca

## Project
A local-first CLI that gives AI agents persistent project memory — works like Git but for context.

## Stack
TypeScript, Node.js 20+, Commander, better-sqlite3, OpenAI SDK, @modelcontextprotocol/sdk, Chalk, fs-extra

## Project Structure
src/

## Current Status
CLI fully functional: init, commit, logs, status, diff, audit, context, staged commits, sync, query, task, mcp server, git hooks, and local SQLite storage. 36/36 tests passing. Published on npm as @quantpartners/pca@1.1.1.

## Key Decisions
Markdown is source of truth. SQLite for context commits. Three modes: local-only, byok, cloud. Git hooks auto-capture context. Agents must not read full context by default. Free local CLI + paid cloud model. MIT license.

## Off-limits
.pca/pca.db, ~/.pca/config.json, ~/.pca/session.json, existing git hooks, published npm package version, MIT license, SQLite schema, core markdown files in pca/core/

## Memory
This file is the source of truth for PCA context memory.
Updated: 2026-05-29T18:39:39.112Z
