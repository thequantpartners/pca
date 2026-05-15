import { Command } from "commander";
import chalk from "chalk";
import { clearAuthSession } from "../core/auth.js";
import { clearOpenAIKey } from "../core/secrets.js";
import { promptText } from "../core/prompt.js";

export function registerLogoutCommand(program: Command): void {
  program
    .command("logout")
    .description("Clear the local PCA auth session")
    .action(async () => {
      await clearAuthSession();
      console.log(chalk.green("PCA auth session cleared."));

      const removeKey = await promptText("Remove local OpenAI API key too? y/N ");
      if (removeKey.trim().toLowerCase() === "y") {
        await clearOpenAIKey();
        console.log("OpenAI API key removed from global PCA credentials.");
      }
    });
}
