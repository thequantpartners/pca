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
  status: "active" | "deprecated";
};

let db: Database.Database | undefined;
let dbPath: string | undefined;

export function initDB(): void {
  const database = getDatabase();

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

  try {
    database.exec("ALTER TABLE context_commits ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  } catch {
    // Column already exists.
  }
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
}): void {
  getDatabase()
    .prepare(
      `
      INSERT INTO context_commits (id, branch, git_hash, message, type, timestamp, yn_pending)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `,
    )
    .run(params.id, params.branch, params.gitHash || null, params.message, params.type, params.timestamp);
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

export function getCommits(includeDeprecated: boolean): CommitRecord[] {
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
    ${includeDeprecated ? "" : "WHERE status = 'active'"}
    ORDER BY timestamp DESC
  `;

  return getDatabase().prepare(query).all() as CommitRecord[];
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
