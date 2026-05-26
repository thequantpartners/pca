import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { getCommits, getCurrentBranch, initDB, recordCommit, upsertBranch } from "./db.js";

export const CONTEXT_COMMIT_TYPES = ["decision", "feature", "bugfix", "architecture", "product", "general"] as const;

export type ContextCommitType = (typeof CONTEXT_COMMIT_TYPES)[number];

export type ContextCommit = {
  id: string;
  timestamp: string;
  message: string;
  type: ContextCommitType;
};

initDB();

export function allowedContextCommitTypes(): string {
  return CONTEXT_COMMIT_TYPES.join(", ");
}

export async function readContextCommits(root: string): Promise<ContextCommit[]> {
  void root;
  initDB();
  return getCommits(false).flatMap((commit) => {
    if (!isContextCommitType(commit.type)) {
      return [];
    }

    const type: ContextCommitType = commit.type;
    return [
      {
        id: commit.id,
        timestamp: commit.timestamp,
        message: commit.message,
        type,
      },
    ];
  });
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

  const branch = getCurrentBranch();
  upsertBranch(branch);
  recordCommit({
    id: commit.id,
    branch,
    gitHash: getCurrentGitHash(root),
    message: commit.message,
    type: commit.type,
    timestamp: commit.timestamp,
    ynPending: 0,
    ynResponse: "y",
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
