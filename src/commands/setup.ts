import { Command } from "commander";
import chalk from "chalk";
import { getProjectRoot, maskOpenAIKey } from "../core/config.js";
import { saveOpenAIKey } from "../core/secrets.js";
import { getProjectEnvOpenAIKey, removeProjectEnvOpenAIKey } from "../core/project-env.js";
import { validateOpenAIKey } from "../core/openai-key.js";
import { promptSecret, promptText } from "../core/prompt.js";

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Configure or repair the global OpenAI API key used by PCA")
    .option("--api-key <key>", "OpenAI API key to validate and save")
    .action(async (options: { apiKey?: string }) => {
      await runOpenAISetup(options.apiKey);
    });
}

export async function runOpenAISetup(apiKeyFromOption?: string): Promise<void> {
  const root = getProjectRoot();
  const projectEnvKey = await getProjectEnvOpenAIKey(root);
  let apiKey = apiKeyFromOption?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (!apiKey && projectEnvKey) {
    const move = await promptText("Found OPENAI_API_KEY in project .env. Move it to PCA global credentials? y/N ");
    if (move.trim().toLowerCase() === "y") {
      apiKey = projectEnvKey;
    }
  }

  if (!apiKey) {
    apiKey = await promptSecret("Paste your OpenAI API key: ");
  }

  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("OpenAI API key cannot be empty.");
  }

  console.log("Validating OpenAI API key...");
  const validation = await validateOpenAIKey(trimmed);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  await saveOpenAIKey(trimmed);
  console.log(chalk.green("OpenAI API key valid."));
  console.log(`Stored globally: ${maskOpenAIKey(trimmed)}`);

  if (projectEnvKey && projectEnvKey === trimmed) {
    const remove = await promptText("Remove OPENAI_API_KEY from project .env? y/N ");
    if (remove.trim().toLowerCase() === "y") {
      await removeProjectEnvOpenAIKey(root);
      console.log("Removed OPENAI_API_KEY from project .env.");
    }
  }
}
