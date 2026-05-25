import { Command } from "commander";
import chalk from "chalk";
import { getProjectRoot } from "../core/config.js";
import { installGitHooks } from "../core/hooks.js";

export function registerInstallHooksCommand(program: Command): void {
  program
    .command("install-hooks")
    .description("Install or update PCA git hooks in the current repository")
    .action(async () => {
      const root = getProjectRoot();

      await installGitHooks(root, {
        overwriteExisting: true,
        requireGitDirectory: true,
      });

      console.log(chalk.green("PCA hooks updated."));
    });
}
