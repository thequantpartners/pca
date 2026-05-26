import { execFileSync } from "node:child_process";
import { stdin, stdout } from "node:process";
import { Command } from "commander";
import {
  archiveBranchContext,
  copyBranchCommitsToBranch,
  getCommitsByBranch,
  getCurrentBranch,
  initDB,
  upsertBranch,
  type CommitRecord,
} from "../core/db.js";
import { promptText } from "../core/prompt.js";

let nonInteractivePromptLines: string[] | undefined;

export function registerPostMergeCommand(program: Command): void {
  program
    .command("_post-merge", { hidden: true })
    .argument("[sourceBranch]", "Merged branch name")
    .action(async (sourceBranch?: string) => {
      try {
        await runPostMerge(sourceBranch);
      } catch {
        // Internal hook command: never break Git merge completion.
      }
    });
}

async function runPostMerge(sourceBranch?: string): Promise<void> {
  initDB();
  const targetBranch = getCurrentBranch();
  upsertBranch(targetBranch);
  const mergedBranch = sourceBranch?.trim() || inferMergedBranch(targetBranch) || "unknown";

  console.log(`Merged ${mergedBranch} into ${targetBranch}. What do you want to do with its context?`);
  console.log("[1] Review and merge manually");
  console.log("[2] Auto-merge context");
  console.log("[3] Skip");

  const choice = (await promptHookInput("> ")).trim();
  if (choice === "1") {
    await reviewAndMerge(mergedBranch, targetBranch);
    return;
  }

  if (choice === "2") {
    const copied = copyBranchCommitsToBranch(mergedBranch, targetBranch);
    archiveBranchContext(mergedBranch);
    console.log(`PCA auto-merged ${copied} context commits from ${mergedBranch} into ${targetBranch}.`);
    return;
  }

  archiveBranchContext(mergedBranch);
  console.log(`PCA context archived for ${mergedBranch}.`);
}

async function reviewAndMerge(sourceBranch: string, targetBranch: string): Promise<void> {
  const commits = getCommitsByBranch(sourceBranch);
  if (!commits.length) {
    console.log(`No context commits found for ${sourceBranch}.`);
    return;
  }

  printCommitChoices(commits);
  const answer = (await promptHookInput("Select commits to keep (comma separated numbers, blank to skip): ")).trim();
  const selectedIds = parseSelectedCommitIds(answer, commits);
  const copied = selectedIds.length ? copyBranchCommitsToBranch(sourceBranch, targetBranch, selectedIds) : 0;
  archiveBranchContext(sourceBranch);
  console.log(`PCA merged ${copied} selected context commits from ${sourceBranch} into ${targetBranch}.`);
}

async function promptHookInput(question: string): Promise<string> {
  if (stdin.isTTY) {
    return promptText(question);
  }

  stdout.write(question);
  nonInteractivePromptLines ??= splitPromptInput(await readNonInteractiveStdin());
  const answer = nonInteractivePromptLines.shift() ?? "";
  if (answer) {
    stdout.write(`${answer}\n`);
  }
  return answer;
}

async function readNonInteractiveStdin(): Promise<string> {
  let input = "";
  for await (const chunk of stdin) {
    input += chunk.toString();
  }
  return input;
}

function splitPromptInput(input: string): string[] {
  return input ? input.split(/\r?\n/u) : [];
}

function printCommitChoices(commits: CommitRecord[]): void {
  for (const [index, commit] of commits.entries()) {
    console.log(`${index + 1}. [${commit.type}] ${commit.message} (${commit.timestamp})`);
  }
}

function parseSelectedCommitIds(answer: string, commits: CommitRecord[]): string[] {
  if (!answer) {
    return [];
  }

  return [
    ...new Set(
      answer
        .split(",")
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((index) => Number.isInteger(index) && index >= 1 && index <= commits.length)
        .map((index) => commits[index - 1].id),
    ),
  ];
}

function inferMergedBranch(targetBranch: string): string | undefined {
  const mergeParent = execGit(["rev-parse", "--verify", "HEAD^2"]).trim();
  if (mergeParent) {
    return branchContainingCommit(mergeParent, targetBranch);
  }

  const head = execGit(["rev-parse", "HEAD"]).trim();
  if (head) {
    return branchWithTip(head, targetBranch);
  }

  return undefined;
}

function branchContainingCommit(commit: string, targetBranch: string): string | undefined {
  return execGit(["branch", "--format=%(refname:short)", "--contains", commit])
    .split(/\r?\n/u)
    .map((branch) => branch.trim())
    .filter((branch) => branch && branch !== targetBranch)
    .sort()[0];
}

function branchWithTip(hash: string, targetBranch: string): string | undefined {
  return execGit(["for-each-ref", "--format=%(refname:short) %(objectname)", "refs/heads"])
    .split(/\r?\n/u)
    .map((line) => line.trim().split(/\s+/u))
    .filter(([branch, objectName]) => branch && branch !== targetBranch && objectName === hash)
    .map(([branch]) => branch)
    .sort()[0];
}

function execGit(args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}
