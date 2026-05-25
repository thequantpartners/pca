import { stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import {
  allowedContextCommitTypes,
  appendContextCommit,
  isContextCommitType,
  latestContextCommit,
  readContextCommits,
  type ContextCommitType,
} from "../core/context-commits.js";
import { getProjectRoot } from "../core/config.js";
import { getCurrentBranch, getPendingYN, initDB, resolveYN, upsertBranch, type CommitRecord } from "../core/db.js";
import { listSyncFiles, relativePosix } from "../core/files.js";
import { getLocalProjectStatus, requireInitializedLocalProject } from "../core/project-status.js";
import { promptText } from "../core/prompt.js";

type RecentMemoryFile = {
  path: string;
  snippet: string;
};

let nonInteractivePromptLines: string[] | undefined;

export function registerCommitCommand(program: Command): void {
  program
    .command("commit")
    .description("Record a local PCA context memory commit")
    .argument("[message]", "Context commit message")
    .option("--type <type>", "decision | feature | bugfix | architecture | product | general", "general")
    .action(async (message: string | undefined, options: { type: string }) => {
      const root = getProjectRoot();
      const answeredPending = await handlePendingDecisions(root);
      if (answeredPending && message === undefined) {
        return;
      }

      if (message !== undefined && !message.trim()) {
        throw new Error("Commit message cannot be empty.");
      }

      const type = options.type.trim();
      if (!isContextCommitType(type)) {
        throw new Error(`Invalid --type: ${type}. Allowed values: ${allowedContextCommitTypes()}.`);
      }

      requireInitializedLocalProject(await getLocalProjectStatus(root));

      const resolvedMessage = message?.trim() ?? (await promptForAutoProposedMessage(root));
      if (!resolvedMessage) {
        return;
      }

      const commit = await appendContextCommit(root, resolvedMessage, type as ContextCommitType);

      console.log(chalk.green("PCA context commit recorded."));
      console.log(`ID: ${commit.id}`);
      console.log(`Type: ${commit.type}`);
      console.log(`Timestamp: ${commit.timestamp}`);
      console.log(`Message: ${commit.message}`);
    });
}

async function handlePendingDecisions(root: string): Promise<boolean> {
  initDB();

  const branch = getCurrentBranch();
  upsertBranch(branch);

  const pendingCommits = getPendingYN(branch);
  if (!pendingCommits.length) {
    return false;
  }

  requireInitializedLocalProject(await getLocalProjectStatus(root));

  let rl: Interface | undefined;
  try {
    rl = createInterface({ input: process.stdin, output: process.stdout });

    for (const commit of pendingCommits) {
      const answer = await promptPendingDecision(rl, commit);
      const response = isYesAnswer(answer) ? "y" : "n";
      resolveYN(commit.id, response);

      if (response === "y") {
        await appendContextCommit(root, commit.message, "decision");
        console.log(chalk.green("PCA context commit recorded."));
        console.log(`Message: ${commit.message}`);
      } else {
        console.log(chalk.yellow("PCA pending decision skipped."));
      }
    }
  } finally {
    rl?.close();
  }

  return true;
}

function promptPendingDecision(rl: Interface, commit: CommitRecord): Promise<string> {
  process.stdout.write(buildPendingDecisionPrompt(commit.message));

  return new Promise((resolve) => {
    rl.question("> ", (answer) => {
      resolve(answer);
    });
  });
}

function buildPendingDecisionPrompt(message: string): string {
  const truncatedMessage = truncatePromptLine(message.replace(/\s+/gu, " "), 29);

  return [
    "",
    "┌─────────────────────────────────────────┐",
    "│  PCA — Save this decision?              │",
    `│  commit: ${truncatedMessage.padEnd(29, " ")} │`,
    "│  [Y] Yes, record  [N] No, skip          │",
    "└─────────────────────────────────────────┘",
  ].join("\n") + "\n";
}

function truncatePromptLine(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function isYesAnswer(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === "" || normalized === "y" || normalized === "yes";
}

async function promptForAutoProposedMessage(root: string): Promise<string | undefined> {
  const commits = await readContextCommits(root);
  const latestCommit = latestContextCommit(commits);
  const modifiedFiles = await findRecentlyModifiedMemoryFiles(root, latestCommit?.timestamp);
  const proposedMessage = proposeCommitMessage(modifiedFiles);

  console.log(chalk.bold("Proposed commit message:"));
  console.log(`> "${proposedMessage}"`);
  console.log("");

  const rawAnswer = await promptCommitInput(chalk.cyan("Accept? (Y/n/edit): "));
  if (!stdin.isTTY && !rawAnswer.trim()) {
    throw new Error("missing required argument 'message'");
  }

  const answer = rawAnswer.trim().toLowerCase();
  if (!answer || answer === "y" || answer === "yes") {
    return proposedMessage;
  }

  if (answer === "n" || answer === "no") {
    console.log(chalk.yellow("Commit cancelled."));
    return undefined;
  }

  if (answer === "edit") {
    const editedMessage = (await promptCommitInput(chalk.cyan("Enter your message: "))).trim();
    if (!editedMessage) {
      throw new Error("Commit message cannot be empty.");
    }

    return editedMessage;
  }

  console.log(chalk.yellow("Commit cancelled."));
  return undefined;
}

async function promptCommitInput(question: string): Promise<string> {
  if (stdin.isTTY) {
    return promptText(question);
  }

  stdout.write(question);
  nonInteractivePromptLines ??= splitPromptInput(await readNonInteractiveStdin());
  return nonInteractivePromptLines.shift() ?? "";
}

async function readNonInteractiveStdin(): Promise<string> {
  let input = "";
  for await (const chunk of stdin) {
    input += chunk.toString();
  }

  return input;
}

function splitPromptInput(input: string): string[] {
  if (!input) {
    return [];
  }

  return input.split(/\r?\n/u);
}

async function findRecentlyModifiedMemoryFiles(root: string, latestCommitTimestamp: string | undefined): Promise<RecentMemoryFile[]> {
  const lastCommitTime = latestCommitTimestamp ? Date.parse(latestCommitTimestamp) : undefined;
  const syncFiles = await listSyncFiles(root);
  const recentFiles: RecentMemoryFile[] = [];

  for (const filePath of syncFiles) {
    const relativePath = relativePosix(root, filePath);
    if (!isAutoCommitMemoryFile(relativePath)) {
      continue;
    }

    const stats = await fs.stat(filePath);
    if (lastCommitTime !== undefined && stats.mtime.getTime() <= lastCommitTime) {
      continue;
    }

    const content = await fs.readFile(filePath, "utf8");
    recentFiles.push({
      path: relativePath,
      snippet: content.slice(0, 300),
    });
  }

  return recentFiles;
}

function isAutoCommitMemoryFile(relativePath: string): boolean {
  return relativePath === "PCA_INDEX.md" || relativePath === "AGENTS.md" || /^pca\/.+\.md$/u.test(relativePath);
}

function proposeCommitMessage(files: RecentMemoryFile[]): string {
  const hasIndexUpdate = files.some((file) => file.path === "PCA_INDEX.md");
  const hasDecisionUpdate = files.some((file) => file.path.startsWith("pca/decisions/"));
  const hasStateUpdate = files.some((file) => file.path.startsWith("pca/state/"));
  const categories = [
    hasIndexUpdate ? "context" : undefined,
    hasDecisionUpdate ? "decisions" : undefined,
    hasStateUpdate ? "state" : undefined,
  ].filter((category): category is string => Boolean(category));

  if (categories.length > 1) {
    return `Updated ${formatCategoryList(categories)}`;
  }

  if (hasIndexUpdate) {
    return "Updated project context and memory index";
  }

  if (hasDecisionUpdate) {
    return "Recorded new project decision";
  }

  if (hasStateUpdate) {
    return "Updated project state";
  }

  return "General context update";
}

function formatCategoryList(categories: string[]): string {
  if (categories.length === 2) {
    return `${categories[0]} and ${categories[1]}`;
  }

  return `${categories.slice(0, -1).join(", ")}, and ${categories[categories.length - 1]}`;
}
