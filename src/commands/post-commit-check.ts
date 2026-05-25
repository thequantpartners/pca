import { execFileSync, spawnSync } from "node:child_process";
import fs, { existsSync } from "node:fs";
import { exit, stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline";
import { Command } from "commander";
import {
  getCurrentBranch,
  getPendingYN,
  initDB,
  recordCommit,
  resolveYN,
  upsertBranch,
  type CommitRecord,
} from "../core/db.js";

const PROMPT_KEYWORDS = [
  "fix",
  "feat",
  "feature",
  "refactor",
  "decision",
  "change",
  "add",
  "remove",
  "update",
  "breaking",
  "migrate",
  "deprecate",
  "implement",
  "redesign",
];

const SKIP_PREFIXES = ["chore:", "docs:", "style:", "test:", "ci:"];
const RESPONSE_TIMEOUT_MS = 30_000;

type LatestGitCommit = {
  id: string;
  gitHash: string;
  message: string;
  timestamp: string;
};

type TTYHandles = {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  close: () => void;
};

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
  ensureLatestGitCommitIsPending(branch);

  const pendingCommits = getPendingYN(branch);
  if (!existsSync("/dev/tty")) {
    for (const commit of pendingCommits) {
      resolveYN(commit.id, "n");
    }

    exit(0);
  }

  for (const commit of pendingCommits) {
    if (!shouldPrompt(commit)) {
      resolveYN(commit.id, "n");
      continue;
    }

    const response = await promptForDecision(commit);
    resolveYN(commit.id, response);

    if (response === "y") {
      recordDecisionCommit(commit.message);
    }
  }
}

function ensureLatestGitCommitIsPending(branch: string): void {
  const latestCommit = getLatestGitCommit();
  if (!latestCommit) {
    return;
  }

  try {
    recordCommit({
      id: latestCommit.id,
      branch,
      gitHash: latestCommit.gitHash,
      message: latestCommit.message,
      type: "git",
      timestamp: latestCommit.timestamp,
    });
  } catch {
    // Duplicate git commits have already been indexed; keep processing pending rows.
  }
}

function getLatestGitCommit(): LatestGitCommit | undefined {
  try {
    const gitHash = execGit(["rev-parse", "HEAD"]);
    const message = execGit(["log", "-1", "--pretty=%B"]).trim();
    const timestamp = execGit(["log", "-1", "--format=%cI"]).trim();

    return {
      id: `git-${gitHash}`,
      gitHash,
      message,
      timestamp,
    };
  } catch {
    return undefined;
  }
}

function shouldPrompt(commit: CommitRecord): boolean {
  if (process.env.CI === "true" || process.env.PCA_SKIP_PROMPT === "true") {
    return false;
  }

  const message = commit.message.trim().toLowerCase();
  if (SKIP_PREFIXES.some((prefix) => message.startsWith(prefix))) {
    return false;
  }

  if (!PROMPT_KEYWORDS.some((keyword) => message.includes(keyword))) {
    return false;
  }

  const changedFiles = getChangedFiles(commit.gitHash);
  return changedFiles.some(isPromptRelevantFile);
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
  return (
    /^src\/.+\.(ts|js|json)$/u.test(filePath) ||
    /^pca\/.+\.md$/u.test(filePath) ||
    filePath === "PCA_INDEX.md" ||
    filePath === "AGENTS.md"
  );
}

async function promptForDecision(commit: CommitRecord): Promise<"y" | "n"> {
  const tty = openTTY();
  if (!tty) {
    return "n";
  }

  const { input, output } = tty;
  let rl: Interface | undefined;

  try {
    rl = createInterface({ input, output });
    output.write(buildPrompt(commit.message));

    const answer = await readAnswerWithTimeout(rl);
    return isYes(answer) ? "y" : "n";
  } catch {
    return "n";
  } finally {
    rl?.close();
    tty.close();
  }
}

function openTTY(): TTYHandles | undefined {
  try {
    const input = fs.createReadStream("/dev/tty");
    const output = fs.createWriteStream("/dev/tty");

    return {
      input,
      output,
      close: () => {
        input.destroy();
        output.end();
      },
    };
  } catch {
    if (stdin.isTTY && stdout.isTTY) {
      return {
        input: stdin,
        output: stdout,
        close: () => {},
      };
    }

    return undefined;
  }
}

function buildPrompt(message: string): string {
  const truncatedMessage = truncate(message.replace(/\s+/gu, " "), 60);

  return [
    "",
    "┌─────────────────────────────────────────┐",
    "│  PCA — Save this decision?              │",
    `│  commit: ${truncatedMessage.padEnd(29, " ")} │`,
    "│  [Y] Yes, record  [N] No, skip          │",
    "└─────────────────────────────────────────┘",
    "> ",
  ].join("\n");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function readAnswerWithTimeout(rl: Interface): Promise<string> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve("n");
    }, RESPONSE_TIMEOUT_MS);

    rl.once("line", (line) => {
      clearTimeout(timeout);
      resolve(line);
    });
  });
}

function isYes(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === "" || normalized === "y" || normalized === "yes";
}

function recordDecisionCommit(message: string): void {
  spawnSync("pca", ["commit", message, "--type", "decision"], {
    cwd: process.cwd(),
    env: { ...process.env, PCA_SKIP_PROMPT: "true" },
    stdio: "ignore",
  });
}

function execGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}
