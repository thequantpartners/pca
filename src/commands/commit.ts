import { Command } from "commander";
import chalk from "chalk";
import {
  allowedContextCommitTypes,
  appendContextCommit,
  isContextCommitType,
  type ContextCommitType,
} from "../core/context-commits.js";
import { getProjectRoot } from "../core/config.js";
import { getLocalProjectStatus, requireInitializedLocalProject } from "../core/project-status.js";

export function registerCommitCommand(program: Command): void {
  program
    .command("commit")
    .description("Record a local PCA context memory commit")
    .argument("<message>", "Context commit message")
    .option("--type <type>", "decision | feature | bugfix | architecture | product | general", "general")
    .action(async (message: string, options: { type: string }) => {
      if (!message.trim()) {
        throw new Error("Commit message cannot be empty.");
      }

      const type = options.type.trim();
      if (!isContextCommitType(type)) {
        throw new Error(`Invalid --type: ${type}. Allowed values: ${allowedContextCommitTypes()}.`);
      }

      const root = getProjectRoot();
      requireInitializedLocalProject(await getLocalProjectStatus(root));
      const commit = await appendContextCommit(root, message, type as ContextCommitType);

      console.log(chalk.green("PCA context commit recorded."));
      console.log(`ID: ${commit.id}`);
      console.log(`Type: ${commit.type}`);
      console.log(`Timestamp: ${commit.timestamp}`);
      console.log(`Message: ${commit.message}`);
    });
}
