import { Command } from "commander";
import chalk from "chalk";
import {
  allowedContextCommitTypes,
  ContextCommitLogError,
  isContextCommitType,
  readContextCommits,
} from "../core/context-commits.js";
import { getProjectRoot } from "../core/config.js";

export function registerLogsCommand(program: Command): void {
  program
    .command("logs")
    .description("List local PCA context memory commits")
    .option("--last <number>", "Maximum number of commits to show", "10")
    .option("--type <type>", "decision | feature | bugfix | architecture | product | general")
    .action(async (options: { last: string; type?: string }) => {
      const limit = parseLast(options.last);
      const type = options.type?.trim();
      if (type && !isContextCommitType(type)) {
        throw new Error(`Invalid --type: ${type}. Allowed values: ${allowedContextCommitTypes()}.`);
      }

      let allCommits;
      try {
        allCommits = await readContextCommits(getProjectRoot());
      } catch (error) {
        if (error instanceof ContextCommitLogError) {
          console.log(chalk.bold.cyan("PCA Context Logs"));
          console.log("");
          console.log(chalk.yellow(error.message));
          return;
        }
        throw error;
      }

      const commits = allCommits
        .filter((commit) => !type || commit.type === type)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit);

      console.log(chalk.bold.cyan("PCA Context Logs"));
      console.log("");

      if (!commits.length) {
        console.log(type ? `No context commits found for type: ${type}.` : "No context commits found.");
        return;
      }

      for (const commit of commits) {
        console.log(`${commit.timestamp}  ${commit.id}  [${commit.type}] ${commit.message}`);
      }
    });
}

function parseLast(value: string): number {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Invalid --last. Use an integer between 1 and 100.");
  }

  return limit;
}
