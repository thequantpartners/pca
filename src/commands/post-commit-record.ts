import { execFileSync } from "node:child_process";
import { exit } from "node:process";
import { Command } from "commander";
import { getCurrentBranch, initDB, recordCommit, upsertBranch, type CommitRecord } from "../core/db.js";

const SKIP_PREFIXES = ["chore:", "docs:", "style:", "test:", "ci:"];

export function registerPostCommitRecordCommand(program: Command): void {
  program.command("_post-commit-record", { hidden: true }).action(() => {
    try {
      runPostCommitRecord();
    } catch {
      // Internal hook command: never surface errors to the user's Git flow.
    }
  });
}

function runPostCommitRecord(): void {
  initDB();

  const branch = getCurrentBranch();
  upsertBranch(branch);

  const commit = getLatestGitCommit(branch);
  if (!commit) {
    exit(0);
  }

  if (!shouldRecordPending(commit)) {
    exit(0);
  }

  try {
    recordCommit({
      id: commit.id,
      branch: commit.branch,
      gitHash: commit.gitHash ?? "",
      message: commit.message,
      type: commit.type,
      timestamp: commit.timestamp,
      ynPending: 0,
      ynResponse: null,
      status: "staged",
    });
  } catch {
    // Duplicate commits were already recorded by a previous hook run.
  }

  setTimeout(() => {
    process.stdout.write("\nPCA: Context staged. Run 'pca staged commit' to confirm it.\n");
    process.exit(0);
  }, 1500);
}

function getLatestGitCommit(branch: string): CommitRecord | undefined {
  try {
    const gitHash = execGit(["rev-parse", "HEAD"]);
    const message = execGit(["log", "-1", "--pretty=%B"]).trim();
    const timestamp = execGit(["log", "-1", "--format=%cI"]).trim();

    return {
      id: `git-${gitHash}`,
      branch,
      gitHash,
      message,
      type: "git",
      timestamp,
      ynPending: 0,
      ynResponse: null,
      status: "staged",
    };
  } catch {
    return undefined;
  }
}

function shouldRecordPending(commit: CommitRecord): boolean {
  if (process.env.CI === "true" || process.env.PCA_SKIP_PROMPT === "true") {
    return false;
  }

  const message = commit.message.trim().toLowerCase();
  if (SKIP_PREFIXES.some((prefix) => message.startsWith(prefix))) {
    return false;
  }

  return getChangedFiles(commit.gitHash).some(isPromptRelevantFile);
}

function getChangedFiles(gitHash: string | null): string[] {
  if (!gitHash) {
    return [];
  }

  try {
    return execGit(["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", gitHash])
      .split(/\r?\n/u)
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isPromptRelevantFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/gu, "/");

  if (
    normalizedPath === ".pca/pca.db" ||
    normalizedPath === "package-lock.json" ||
    normalizedPath.startsWith("node_modules/") ||
    normalizedPath.startsWith("dist/")
  ) {
    return false;
  }

  return (
    /\.(ts|js|tsx|jsx)$/u.test(normalizedPath) ||
    /^pca\/.+\.md$/u.test(normalizedPath) ||
    normalizedPath === "PCA_INDEX.md" ||
    normalizedPath === "AGENTS.md" ||
    /\.json$/u.test(normalizedPath)
  );
}

function execGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}
