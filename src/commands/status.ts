import { Command } from "commander";
import chalk from "chalk";
import { loadAuthSession } from "../core/auth.js";
import {
  ContextCommitLogError,
  latestContextCommit,
  readContextCommits,
  type ContextCommit,
} from "../core/context-commits.js";
import { getProjectRoot } from "../core/config.js";
import { getLocalProjectStatus } from "../core/project-status.js";
import { getOpenAIKey } from "../core/secrets.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show local PCA project and context memory status")
    .action(async () => {
      const root = getProjectRoot();
      const project = await getLocalProjectStatus(root);
      let commits: ContextCommit[] = [];
      let commitLogWarning: string | undefined;
      try {
        commits = await readContextCommits(root);
      } catch (error) {
        if (error instanceof ContextCommitLogError) {
          commitLogWarning = error.message;
        } else {
          throw error;
        }
      }
      const latest = latestContextCommit(commits);
      const session = await loadAuthSession();
      const key = await getOpenAIKey();

      console.log(chalk.bold.cyan("PCA Status"));
      console.log("");
      console.log(`Project: ${projectStatus(project.state)}`);
      console.log(`PCA_INDEX.md: ${status(project.hasIndex)}`);
      console.log(`AGENTS.md: ${status(project.hasAgents)}`);
      console.log(`.pca/config.json: ${status(project.hasProjectConfig)}`);
      console.log(`pca/ folder: ${status(project.hasPcaFolder)}`);
      console.log("");
      console.log(`Context commits: ${commits.length}`);
      console.log(`Latest commit: ${latest ? `${latest.id} [${latest.type}] ${latest.message}` : "none"}`);
      if (commitLogWarning) {
        console.log(chalk.yellow(commitLogWarning));
      }
      console.log("");
      console.log(`Auth session: ${session ? chalk.green("present") : chalk.yellow("missing")}`);
      console.log(`OpenAI API key: ${key ? chalk.green("present") : chalk.yellow("missing")}`);
    });
}

function status(ok: boolean): string {
  return ok ? chalk.green("OK") : chalk.yellow("Missing");
}

function projectStatus(state: "initialized" | "partial" | "not-initialized"): string {
  if (state === "initialized") {
    return chalk.green("Initialized");
  }

  if (state === "partial") {
    return chalk.yellow("Partially initialized");
  }

  return chalk.yellow("Not initialized");
}
