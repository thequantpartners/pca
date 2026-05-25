import { execFileSync } from "node:child_process";
import { exit } from "node:process";
import { createInterface, type Interface } from "node:readline";
import { Command } from "commander";
import {
  getCurrentBranch,
  initDB,
  recordCommit,
  resolveYN,
  upsertBranch,
  type CommitRecord,
} from "../core/db.js";

const SKIP_PREFIXES = ["chore:", "docs:", "style:", "test:", "ci:"];
const RESPONSE_TIMEOUT_MS = 30_000;

export function registerPostCommitCheckCommand(program: Command): void {
  program.command("_post-commit-check", { hidden: true }).action(async () => {
    try {
      await runPostCommitCheck();
    } catch {
      // Internal hook command: never surface errors to the user's Git flow.
    }
  });
}

async function runPostCommitCheck(): Promise<void> {
  initDB();

  const branch = getCurrentBranch();
  upsertBranch(branch);

  const commit = getLatestGitCommit(branch);
  if (!commit) {
    exit(0);
  }

  if (!shouldPrompt(commit)) {
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
    });
  } catch {
    // Duplicate commits were already recorded by a previous hook run.
  }

  const response = await promptForDecision(commit);
  resolveYN(commit.id, response);
  printConfirmation(response);
  exit(0);
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
      ynPending: 1,
      ynResponse: null,
    };
  } catch {
    return undefined;
  }
}

function shouldPrompt(commit: CommitRecord): boolean {
  debugPrompt("heuristic:start", {
    message: commit.message,
    platform: process.platform,
  });

  if (process.env.CI === "true" || process.env.PCA_SKIP_PROMPT === "true") {
    debugPrompt("heuristic:skip-env", {
      ci: process.env.CI,
      pcaSkipPrompt: process.env.PCA_SKIP_PROMPT,
    });
    return false;
  }

  const message = commit.message.trim().toLowerCase();
  if (SKIP_PREFIXES.some((prefix) => message.startsWith(prefix))) {
    debugPrompt("heuristic:skip-prefix", { message });
    return false;
  }

  const changedFiles = getChangedFiles(commit.gitHash);
  const hasRelevantFile = changedFiles.some(isPromptRelevantFile);
  debugPrompt("heuristic:files", {
    changedFiles,
    hasRelevantFile,
  });

  return hasRelevantFile;
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

async function promptForDecision(commit: CommitRecord): Promise<"y" | "n"> {
  let rl: Interface | undefined;

  try {
    process.stdin.resume();
    rl = createInterface({ input: process.stdin, output: process.stdout });

    await writeOutput(buildPrompt(commit.message));
    await writeOutput("> ");

    const answer = await readAnswerWithTimeout(rl, commit.id);
    return isYes(answer) ? "y" : "n";
  } catch {
    return "n";
  } finally {
    rl?.close();
  }
}

function readAnswerWithTimeout(rl: Interface, commitId: string): Promise<string> {
  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
    };

    const finish = (answer: string) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(answer);
    };

    const timeout = setTimeout(() => {
      resolveYN(commitId, "n");
      process.stdout.write("\nPCA: No response within 30 seconds. Skipped.\n");
      rl.close();
      finish("n");
    }, RESPONSE_TIMEOUT_MS);

    rl.question("", (answer) => {
      finish(answer);
    });
  });
}

function buildPrompt(message: string): string {
  const truncatedMessage = truncate(message.replace(/\s+/gu, " "), 80);

  return [
    "",
    "PCA: Save this commit as context?",
    `Commit: ${truncatedMessage}`,
    "[Y] Yes, record  [N] No, skip",
  ].join("\n") + "\n";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function isYes(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === "" || normalized === "y";
}

function printConfirmation(response: "y" | "n"): void {
  process.stdout.write(response === "y" ? "PCA: Decision saved.\n" : "PCA: Skipped.\n");
}

function writeOutput(content: string): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(content, () => {
      resolve();
    });
  });
}

function debugPrompt(event: string, payload: Record<string, unknown>): void {
  if (process.env.PCA_DEBUG_PROMPT !== "true") {
    return;
  }

  try {
    process.stderr.write(`[pca:post-commit-check] ${event} ${JSON.stringify(payload)}\n`);
  } catch {
    // Debug logging must never affect the Git hook.
  }
}

function execGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}
