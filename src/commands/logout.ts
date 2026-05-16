import { Command } from "commander";
import chalk from "chalk";
import { clearAuthSession } from "../core/auth.js";
import { clearOpenAIKey } from "../core/secrets.js";

export function registerLogoutCommand(program: Command): void {
  program
    .command("logout")
    .description("Clear the local PCA auth session")
    .option("--clear-openai-key", "Also remove the stored OpenAI API key")
    .action(async (options: { clearOpenaiKey?: boolean }) => {
      await clearAuthSession();
      console.log(chalk.green("PCA auth session cleared."));
      console.log("PCA auth and BYOK/OpenAI credentials are stored separately.");

      if (options.clearOpenaiKey) {
        await clearOpenAIKey();
        console.log("OpenAI API key removed from global PCA credentials.");
      } else {
        console.log("OpenAI API key left unchanged.");
        console.log("Use `pca logout --clear-openai-key` to remove it explicitly.");
      }
    });
}
