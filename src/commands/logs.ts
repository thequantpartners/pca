import { Command } from "commander";
import chalk from "chalk";
import { allowedContextCommitTypes, isContextCommitType } from "../core/context-commits.js";
import { getCommits, getCurrentBranch, initDB, upsertBranch } from "../core/db.js";

export function registerLogsCommand(program: Command): void {
  program
    .command("logs")
    .description("List local PCA context memory commits")
    .option("--last <number>", "Maximum number of commits to show", "10")
    .option("--type <type>", "decision | feature | bugfix | architecture | product | general | git")
    .option("--all", "Include deprecated commits")
    .action((options: { last: string; type?: string; all?: boolean }) => {
      const limit = parseLast(options.last);
      const type = options.type?.trim();
      if (type && type !== "git" && !isContextCommitType(type)) {
        throw new Error(`Invalid --type: ${type}. Allowed values: ${allowedContextCommitTypes()}, git.`);
      }

      initDB();
      const branch = getCurrentBranch();
      upsertBranch(branch);

      const commits = getCommits(Boolean(options.all))
        .filter((commit) => !type || commit.type === type)
        .slice(0, limit);

      console.log(chalk.bold.cyan("PCA Context Logs"));
      console.log("");

      if (!commits.length) {
        console.log(type ? `No context commits found for type: ${type}.` : "No context commits found.");
        return;
      }

      for (const commit of commits) {
        const deprecated = commit.status === "deprecated" ? "[deprecated] " : "";
        const date = new Date(commit.timestamp).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
        console.log(`${deprecated}${date}  ${commit.id}  [${commit.type}] ${commit.message}`);
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
