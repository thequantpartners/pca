import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { readContextCommits, type ContextCommit } from "../core/context-commits.js";
import { getConfigPath, getProjectRoot, loadConfig } from "../core/config.js";
import { listSyncFiles, relativePosix } from "../core/files.js";
import { getLocalProjectStatus, requireInitializedLocalProject } from "../core/project-status.js";

const separator = "\u2500".repeat(40);

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Show local PCA context changes since the last sync")
    .action(async () => {
      const root = getProjectRoot();
      requireInitializedLocalProject(await getLocalProjectStatus(root));

      const commits: ContextCommit[] = await readContextCommits(root);

      const config = await loadConfig(root);
      const since = await diffStartDate(root, config.createdAt, commits);
      const newCommits = commits
        .filter((commit) => isCommitSince(commit, since))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const modifiedFiles = await filesModifiedAfter(root, since.date);

      console.log(chalk.white(`Context diff \u2014 since ${since.label} ${relativeTime(since.date.toISOString())}`));
      console.log(chalk.gray(separator));
      printDashboardRow("New commits", newCommits.length.toLocaleString());
      console.log(chalk.gray(separator));
      if (newCommits.length) {
        for (const commit of newCommits) {
          console.log(`${chalk.gray(`[${commit.type}]`.padEnd(13))}${chalk.white(commit.message)}`);
        }
      } else {
        console.log(chalk.gray("No new commits."));
      }
      console.log(chalk.gray(separator));
      console.log(chalk.white("Modified files"));
      if (modifiedFiles.length) {
        for (const file of modifiedFiles) {
          console.log(`  ${chalk.white(file)}`);
        }
      } else {
        console.log(`  ${chalk.gray("none")}`);
      }
      console.log(chalk.gray(separator));
      console.log(`${chalk.cyan("Next:")} ${chalk.white("run pca sync to push changes")}`);
    });
}

function printDashboardRow(label: string, value: string): void {
  console.log(`${chalk.gray(label.padEnd(15))}${chalk.white(value)}`);
}

function isCommitSince(commit: ContextCommit, since: { date: Date; label: "last sync" | "first commit" }): boolean {
  const timestamp = Date.parse(commit.timestamp);
  return since.label === "last sync" ? timestamp > since.date.getTime() : timestamp >= since.date.getTime();
}

async function diffStartDate(
  root: string,
  createdAt: string,
  commits: ContextCommit[],
): Promise<{ date: Date; label: "last sync" | "first commit" }> {
  const rawConfig = (await fs.readJson(getConfigPath(root))) as { updatedAt?: unknown };
  if (typeof rawConfig.updatedAt === "string" && rawConfig.updatedAt !== createdAt) {
    return { date: parseDate(rawConfig.updatedAt), label: "last sync" };
  }

  const firstCommit = [...commits].sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];
  return {
    date: firstCommit ? parseDate(firstCommit.timestamp) : parseDate(createdAt),
    label: "first commit",
  };
}

async function filesModifiedAfter(root: string, since: Date): Promise<string[]> {
  const files = await listSyncFiles(root);
  const modified: string[] = [];

  for (const filePath of files) {
    const stats = await fs.stat(filePath);
    if (stats.mtime.getTime() > since.getTime()) {
      modified.push(relativePosix(root, filePath));
    }
  }

  return modified.sort((a, b) => a.localeCompare(b));
}

function parseDate(timestamp: string): Date {
  const time = Date.parse(timestamp);
  return new Date(Number.isNaN(time) ? 0 : time);
}

function relativeTime(timestamp: string): string {
  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) {
    return "unknown";
  }

  const diffMs = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
