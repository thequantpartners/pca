import { Command } from "commander";
import chalk from "chalk";
import { getProjectRoot } from "../core/config.js";
import { syncMemory } from "../core/memory-sync.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Upload PCA markdown files to the configured OpenAI Vector Store")
    .option("--api-key <key>", "OpenAI API key for this command")
    .action(async () => {
      const root = getProjectRoot();
      const result = await syncMemory(root);

      console.log(chalk.green("PCA sync completed."));
      console.log(`Files synced: ${result.syncedCount}`);
      console.log(`Vector store: ${result.vectorStoreId}`);

      if (result.failed.length) {
        console.log(chalk.yellow(""));
        console.log(chalk.yellow("Failed files:"));
        for (const item of result.failed) {
          console.log(`- ${item.path}: ${item.error}`);
        }
        process.exitCode = 1;
      }
    });
}
