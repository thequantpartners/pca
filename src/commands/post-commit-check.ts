import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
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

type RawModeReadable = NodeJS.ReadableStream & {
  isRaw?: boolean;
  setRawMode?: (mode: boolean) => void;
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
  const latestCommit = recordLatestGitCommit(branch);
  if (!latestCommit) {
    exit(0);
  }

  if (!shouldPrompt(latestCommit)) {
    resolveYN(latestCommit.id, "n");
    exit(0);
  }

  const tty = openPromptIO();
  if (!tty) {
    resolveYN(latestCommit.id, "n");
    exit(0);
  }
  tty.close();

  const pendingCommits = getPendingYN(branch);
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

function recordLatestGitCommit(branch: string): CommitRecord | undefined {
  const latestCommit = getLatestGitCommit();
  if (!latestCommit) {
    return undefined;
  }

  const commit: CommitRecord = {
    id: latestCommit.id,
    branch,
    gitHash: latestCommit.gitHash,
    message: latestCommit.message,
    type: "git",
    timestamp: latestCommit.timestamp,
    ynPending: 1,
    ynResponse: null,
  };

  try {
    recordCommit({
      id: commit.id,
      branch: commit.branch,
      gitHash: latestCommit.gitHash,
      message: commit.message,
      type: commit.type,
      timestamp: commit.timestamp,
    });
  } catch {
    // Duplicate git commits have already been indexed; keep processing pending rows.
  }

  return commit;
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
  const tty = openPromptIO();
  if (!tty) {
    return "n";
  }

  const { input, output } = tty;
  let rl: Interface | undefined;

  try {
    rl = createInterface({ input, output });
    output.write(buildPrompt(commit.message));

    const answer = await readAnswerWithTimeout(rl, input);
    return isYes(answer) ? "y" : "n";
  } catch {
    return "n";
  } finally {
    rl?.close();
    tty.close();
  }
}

function openPromptIO(): TTYHandles | undefined {
  if (process.platform === "win32") {
    return openWindowsPromptIO();
  }

  if (isDevTTYAccessible()) {
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
      return undefined;
    }
  }

  if (stdin.isTTY && stdout.isTTY) {
    return {
      input: stdin,
      output: stdout,
      close: () => {},
    };
  }

  return undefined;
}

function openWindowsPromptIO(): TTYHandles | undefined {
  try {
    const input = stdin as RawModeReadable;
    const wasRaw = input.isRaw === true;

    stdin.resume();
    input.setRawMode?.(true);

    return {
      input: stdin,
      output: stdout,
      close: () => {
        input.setRawMode?.(wasRaw);
      },
    };
  } catch {
    return undefined;
  }
}

function isDevTTYAccessible(): boolean {
  try {
    fs.accessSync("/dev/tty", fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
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

function readAnswerWithTimeout(rl: Interface, input: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve) => {
    const cleanup = () => {
      clearTimeout(timeout);
      input.off("data", onData);
      rl.off("line", onLine);
    };

    const finish = (answer: string) => {
      cleanup();
      resolve(answer);
    };

    const onLine = (line: string) => {
      finish(line);
    };

    const onData = (chunk: Buffer | string) => {
      const value = chunk.toString("utf8").trim().toLowerCase();
      if (value === "y" || value === "yes" || value === "") {
        finish("y");
      }

      if (value === "n" || value === "no" || value === "\u0003") {
        finish("n");
      }
    };

    const timeout = setTimeout(() => {
      finish("n");
    }, RESPONSE_TIMEOUT_MS);

    input.on("data", onData);
    rl.once("line", onLine);
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
