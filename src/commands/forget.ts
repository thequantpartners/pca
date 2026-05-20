import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import {
  ContextCommitLogError,
  getContextCommitLogPath,
  readContextCommits,
  type ContextCommit,
} from "../core/context-commits.js";
import { getProjectRoot } from "../core/config.js";
import { getLocalProjectStatus, requireInitializedLocalProject } from "../core/project-status.js";

type ForgettableContextCommit = ContextCommit & {
  deprecated?: boolean;
  deprecatedAt?: string;
};

let nonInteractivePromptLines: string[] | undefined;

export function registerForgetCommand(program: Command): void {
  program
    .command("forget")
    .description("Deprecate or archive a local PCA context memory commit")
    .action(async () => {
      const root = getProjectRoot();
      requireInitializedLocalProject(await getLocalProjectStatus(root));

      let commits: ForgettableContextCommit[];
      try {
        commits = await readContextCommits(root);
      } catch (error) {
        if (error instanceof ContextCommitLogError) {
          console.log(chalk.bold.cyan("PCA Forget"));
          console.log("");
          console.log(chalk.yellow(error.message));
          return;
        }
        throw error;
      }

      if (!commits.length) {
        console.log("No context commits found.");
        return;
      }

      console.log(chalk.bold.cyan("PCA Forget"));
      console.log("");
      for (const [index, commit] of commits.entries()) {
        const status = commit.deprecated ? chalk.yellow(" deprecated") : "";
        console.log(`${index + 1}. ${commit.id}  [${commit.type}] ${commit.message}  ${formatDate(commit.timestamp)}${status}`);
      }

      const rl = input.isTTY ? createInterface({ input, output }) : undefined;
      try {
        const selected = Number.parseInt((await promptForgetInput(rl, chalk.cyan("Select commit number: "))).trim(), 10);
        if (!Number.isInteger(selected) || selected < 1 || selected > commits.length) {
          throw new Error("Invalid commit selection.");
        }

        const commit = commits[selected - 1];
        const rawAction = (
          await promptForgetInput(rl, chalk.cyan("Mark as deprecated, archive, or cancel? (d/a/c) "))
        )
          .trim()
          .toLowerCase();
        const action = rawAction || "d";

        if (action === "c") {
          console.log("Forget cancelled.");
          return;
        }

        if (action === "a") {
          await archiveCommit(root, commits, selected - 1);
          console.log(chalk.green(`\u2713 Commit ${commit.id} archived`));
          return;
        }

        if (action !== "d") {
          throw new Error("Invalid action. Use d, a, or c.");
        }

        commit.deprecated = true;
        commit.deprecatedAt = new Date().toISOString();
        await writeContextCommits(root, commits);
        console.log(chalk.green(`\u2713 Commit ${commit.id} marked as deprecated`));
      } finally {
        rl?.close();
      }
    });
}

async function promptForgetInput(rl: Interface | undefined, question: string): Promise<string> {
  if (rl) {
    try {
      return await rl.question(question);
    } catch {
      return "";
    }
  }

  output.write(question);
  nonInteractivePromptLines ??= splitPromptInput(await readNonInteractiveStdin());
  return nonInteractivePromptLines.shift() ?? "";
}

async function readNonInteractiveStdin(): Promise<string> {
  let value = "";
  for await (const chunk of input) {
    value += chunk.toString();
  }

  return value;
}

function splitPromptInput(value: string): string[] {
  if (!value) {
    return [];
  }

  return value.split(/\r?\n/u);
}

async function archiveCommit(root: string, commits: ForgettableContextCommit[], index: number): Promise<void> {
  const [commit] = commits.splice(index, 1);
  const archivePath = path.join(root, "pca", "archive", "context-commits-archive.json");
  const archived = await readArchivedCommits(archivePath);

  archived.push({
    ...commit,
    archivedAt: new Date().toISOString(),
  });

  await fs.ensureDir(path.dirname(archivePath));
  await fs.writeJson(archivePath, archived, { spaces: 2 });
  await writeContextCommits(root, commits);
}

async function readArchivedCommits(archivePath: string): Promise<Array<ForgettableContextCommit & { archivedAt?: string }>> {
  if (!(await fs.pathExists(archivePath))) {
    return [];
  }

  const parsed = (await fs.readJson(archivePath)) as unknown;
  return Array.isArray(parsed) ? (parsed as Array<ForgettableContextCommit & { archivedAt?: string }>) : [];
}

async function writeContextCommits(root: string, commits: ForgettableContextCommit[]): Promise<void> {
  const logPath = getContextCommitLogPath(root);
  await fs.ensureDir(path.dirname(logPath));
  await fs.writeJson(logPath, commits, { spaces: 2 });
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return date.toISOString().slice(0, 10);
}
