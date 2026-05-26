import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type CommitRecord = {
  id: string;
  branch: string;
  gitHash: string | null;
  message: string;
  type: string;
  timestamp: string;
  ynPending: 0 | 1;
  ynResponse: "y" | "n" | null;
  status: "staged" | "active" | "deprecated" | "archived";
};

let db: Database.Database | undefined;
let dbPath: string | undefined;

export function initDB(): void {
  const database = getDatabase();
  removeLegacyContextCommitLog();

  database.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS context_commits (
      id TEXT PRIMARY KEY,
      branch TEXT NOT NULL,
      git_hash TEXT,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      yn_pending INTEGER DEFAULT 1,
      yn_response TEXT,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS branch_state (
      branch TEXT PRIMARY KEY,
      last_commit TEXT,
      last_sync TEXT,
      context_file TEXT
    );
  `);

  ensureColumn(database, "context_commits", "branch", "TEXT NOT NULL DEFAULT 'main'");
  ensureColumn(database, "context_commits", "status", "TEXT NOT NULL DEFAULT 'active'");
  database.exec("UPDATE context_commits SET status = 'active' WHERE status IS NULL OR status = ''");
}

export function getCurrentBranch(): string {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "main";
  }
}

export function upsertBranch(name: string): void {
  const now = new Date().toISOString();
  const database = getDatabase();
  const existing = database.prepare("SELECT id, created_at FROM branches WHERE name = ?").get(name) as
    | { id: number; created_at: string }
    | undefined;

  database
    .prepare(
      `
      INSERT OR REPLACE INTO branches (id, name, created_at, last_seen)
      VALUES (?, ?, ?, ?)
    `,
    )
    .run(existing?.id ?? null, name, existing?.created_at ?? now, now);
}

export function recordCommit(params: {
  id: string;
  branch: string;
  gitHash: string;
  message: string;
  type: string;
  timestamp: string;
  ynPending?: 0 | 1;
  ynResponse?: "y" | "n" | null;
  status?: CommitRecord["status"];
}): void {
  getDatabase()
    .prepare(
      `
      INSERT INTO context_commits (id, branch, git_hash, message, type, timestamp, yn_pending, yn_response, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      params.id,
      params.branch,
      params.gitHash || null,
      params.message,
      params.type,
      params.timestamp,
      params.ynPending ?? 1,
      params.ynResponse ?? null,
      params.status ?? "active",
    );
}

export function getPendingYN(branch: string): CommitRecord[] {
  const rows = getDatabase()
    .prepare(
      `
      SELECT
        id,
        branch,
        git_hash AS gitHash,
        message,
        type,
        timestamp,
        yn_pending AS ynPending,
        yn_response AS ynResponse,
        status
      FROM context_commits
      WHERE branch = ? AND yn_pending = 1 AND status = 'active'
      ORDER BY timestamp ASC
    `,
    )
    .all(branch) as CommitRecord[];

  return rows;
}

export function resolveYN(id: string, response: "y" | "n"): void {
  getDatabase()
    .prepare(
      `
      UPDATE context_commits
      SET yn_pending = 0, yn_response = ?
      WHERE id = ?
    `,
    )
    .run(response, id);
}

export function forgetCommit(id: string): void {
  getDatabase().prepare("UPDATE context_commits SET status = 'deprecated' WHERE id = ?").run(id);
}

export function recoverCommit(id: string): void {
  getDatabase().prepare("UPDATE context_commits SET status = 'active' WHERE id = ?").run(id);
}

export function archiveBranchContext(branch: string): void {
  getDatabase()
    .prepare("UPDATE context_commits SET status = 'archived' WHERE branch = ? AND status IN ('active', 'staged')")
    .run(branch);
}

export function copyBranchCommitsToBranch(sourceBranch: string, targetBranch: string, ids?: string[]): number {
  const sourceCommits = getCommitsByBranch(sourceBranch).filter((commit) => !ids || ids.includes(commit.id));
  const database = getDatabase();
  let copied = 0;

  for (const commit of sourceCommits) {
    const id = `${commit.id}-merged-${targetBranch.replace(/[^A-Za-z0-9_.-]+/g, "-")}`;
    try {
      database
        .prepare(
          `
          INSERT INTO context_commits (id, branch, git_hash, message, type, timestamp, yn_pending, yn_response, status)
          VALUES (?, ?, ?, ?, ?, ?, 0, 'y', 'active')
        `,
        )
        .run(id, targetBranch, commit.gitHash, commit.message, commit.type, new Date().toISOString());
      copied += 1;
    } catch {
      // Already merged into this target branch.
    }
  }

  return copied;
}

export function getCommitsByBranch(branch: string, includeArchived = false): CommitRecord[] {
  const statusClause = includeArchived ? "" : "AND status = 'active'";
  return getDatabase()
    .prepare(
      `
      SELECT
        id,
        branch,
        git_hash AS gitHash,
        message,
        type,
        timestamp,
        yn_pending AS ynPending,
        yn_response AS ynResponse,
        status
      FROM context_commits
      WHERE branch = ? ${statusClause}
      ORDER BY timestamp DESC
    `,
    )
    .all(branch) as CommitRecord[];
}

export function getKnownBranches(): string[] {
  const rows = getDatabase().prepare("SELECT name FROM branches ORDER BY name ASC").all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

export function getCommits(includeDeprecated: boolean): CommitRecord[] {
  const whereClause = includeDeprecated ? "WHERE status != 'staged'" : "WHERE status = 'active'";
  const query = `
    SELECT
      id,
      branch,
      git_hash AS gitHash,
      message,
      type,
      timestamp,
      yn_pending AS ynPending,
      yn_response AS ynResponse,
      status
    FROM context_commits
    ${whereClause}
    ORDER BY timestamp DESC
  `;

  return getDatabase().prepare(query).all() as CommitRecord[];
}

export function getStagedCommits(): CommitRecord[] {
  return getDatabase()
    .prepare(
      `
      SELECT
        id,
        branch,
        git_hash AS gitHash,
        message,
        type,
        timestamp,
        yn_pending AS ynPending,
        yn_response AS ynResponse,
        status
      FROM context_commits
      WHERE status = 'staged'
      ORDER BY timestamp ASC, id ASC
    `,
    )
    .all() as CommitRecord[];
}

export function confirmStagedCommits(): number {
  const result = getDatabase()
    .prepare("UPDATE context_commits SET status = 'active', yn_pending = 0, yn_response = 'y' WHERE status = 'staged'")
    .run();
  return result.changes;
}

export function dropStagedCommit(id: string): void {
  getDatabase().prepare("DELETE FROM context_commits WHERE id = ? AND status = 'staged'").run(id);
}

export function clearStagedCommits(): number {
  const result = getDatabase().prepare("DELETE FROM context_commits WHERE status = 'staged'").run();
  return result.changes;
}

function getDatabase(): Database.Database {
  const currentDbPath = path.join(process.cwd(), ".pca", "pca.db");
  if (db && dbPath === currentDbPath) {
    return db;
  }

  fs.mkdirSync(path.dirname(currentDbPath), { recursive: true });
  db = new Database(currentDbPath);
  dbPath = currentDbPath;
  return db;
}

function removeLegacyContextCommitLog(): void {
  const legacyPath = path.join(process.cwd(), ".pca", "context-commits.json");
  try {
    if (fs.existsSync(legacyPath)) {
      fs.rmSync(legacyPath);
    }
  } catch {
    // Legacy cleanup must not block DB initialization.
  }
}

function ensureColumn(database: Database.Database, table: string, column: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((item) => item.name === column)) {
    return;
  }

  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
