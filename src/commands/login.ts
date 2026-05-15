import { Command } from "commander";
import chalk from "chalk";
import { getProjectRoot, maskOpenAIKey } from "../core/config.js";
import { saveOpenAIKey } from "../core/env-file.js";
import { promptSecret } from "../core/prompt.js";

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Save OPENAI_API_KEY in the current project's .env file")
    .option("--api-key <key>", "OpenAI API key to save")
    .action(async (options: { apiKey?: string }) => {
      const root = getProjectRoot();
      const apiKey = options.apiKey?.trim() || (await promptSecret("OpenAI API key: "));
      const envPath = await saveOpenAIKey(apiKey, root);

      console.log(chalk.green("OPENAI_API_KEY saved."));
      console.log(`File: ${envPath}`);
      console.log(`Key: ${maskOpenAIKey(apiKey)}`);
      console.log("");
      console.log("Next step: pca doctor");
    });
}
