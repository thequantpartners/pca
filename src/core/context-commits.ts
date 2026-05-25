import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import fs from "fs-extra";
import { getCurrentBranch, initDB, recordCommit, upsertBranch } from "./db.js";

export const CONTEXT_COMMIT_TYPES = ["decision", "feature", "bugfix", "architecture", "product", "general"] as const;

export type ContextCommitType = (typeof CONTEXT_COMMIT_TYPES)[number];

export type ContextCommit = {
  id: string;
  timestamp: string;
  message: string;
  type: ContextCommitType;
};

initDB();

export class ContextCommitLogError extends Error {
  constructor(logPath: string, detail: string) {
    super(
      [
        `Could not read PCA context commit log: ${logPath}`,
        detail,
        "Recovery: fix the JSON file, move it aside, or delete it if the local commit history is no longer needed.",
      ].join("\n"),
    );
    this.name = "ContextCommitLogError";
  }
}

export function getContextCommitLogPath(root: string): string {
  return path.join(root, ".pca", "context-commits.json");
}

export function allowedContextCommitTypes(): string {
  return CONTEXT_COMMIT_TYPES.join(", ");
}

export async function readContextCommits(root: string): Promise<ContextCommit[]> {
  const logPath = getContextCommitLogPath(root);
  if (!(await fs.pathExists(logPath))) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = (await fs.readJson(logPath)) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ContextCommitLogError(logPath, detail);
  }

  if (!Array.isArray(parsed)) {
    throw new ContextCommitLogError(logPath, "Expected the file to contain a JSON array of context commits.");
  }

  return parsed.filter(isContextCommit);
}

export async function appendContextCommit(
  root: string,
  message: string,
  type: ContextCommitType = "general",
): Promise<ContextCommit> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error("Commit message cannot be empty.");
  }

  if (!isContextCommitType(type)) {
    throw new Error(`Invalid commit type: ${type}. Allowed values: ${allowedContextCommitTypes()}.`);
  }

  const commit: ContextCommit = {
    id: createCommitId(),
    timestamp: new Date().toISOString(),
    message: trimmedMessage,
    type,
  };

  const commits = await readContextCommits(root);
  commits.push(commit);

  const logPath = getContextCommitLogPath(root);
  await fs.ensureDir(path.dirname(logPath));
  await fs.writeJson(logPath, commits, { spaces: 2 });

  const branch = getCurrentBranch();
  upsertBranch(branch);
  recordCommit({
    id: commit.id,
    branch,
    gitHash: getCurrentGitHash(root),
    message: commit.message,
    type: commit.type,
    timestamp: commit.timestamp,
  });

  return commit;
}

export function latestContextCommit(commits: ContextCommit[]): ContextCommit | undefined {
  return [...commits].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}

export function isContextCommitType(value: string): value is ContextCommitType {
  return CONTEXT_COMMIT_TYPES.includes(value as ContextCommitType);
}

function createCommitId(): string {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    String(date.getUTCSeconds()).padStart(2, "0"),
  ].join("");

  return `${stamp}-${crypto.randomBytes(4).toString("hex")}`;
}

function getCurrentGitHash(root: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function isContextCommit(value: unknown): value is ContextCommit {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ContextCommit>;
  return (
    typeof item.id === "string" &&
    typeof item.timestamp === "string" &&
    typeof item.message === "string" &&
    typeof item.type === "string" &&
    isContextCommitType(item.type)
  );
}
