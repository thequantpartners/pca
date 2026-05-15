import { Command } from "commander";
import chalk from "chalk";
import { getProjectRoot, hasOpenAIKey, maskOpenAIKey } from "../core/config.js";
import { clearOpenAIKey, getAPIKeyStatus, getStoredOpenAIKey, saveOpenAIKey } from "../core/env-file.js";
import { promptSecret } from "../core/prompt.js";

const OPENAI_KEY_NAME = "openai-api-key";

export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description("Manage local PCA CLI configuration");

  config.action(async () => {
    await printConfig();
  });

  config
    .command("get")
    .description("Read a config value")
    .argument("<key>", "Supported key: openai-api-key")
    .action(async (key: string) => {
      assertSupportedKey(key);
      const storedKey = await getStoredOpenAIKey(getProjectRoot());
      const runtimeKey = process.env.OPENAI_API_KEY;
      const value = storedKey ?? runtimeKey;

      if (!value) {
        console.log("OPENAI_API_KEY is not configured.");
        return;
      }

      console.log(maskOpenAIKey(value));
    });

  config
    .command("set")
    .description("Set a config value")
    .argument("<key>", "Supported key: openai-api-key")
    .argument("[value]", "Value to save. If omitted, PCA prompts securely.")
    .action(async (key: string, value?: string) => {
      assertSupportedKey(key);
      const apiKey = value?.trim() || (await promptSecret("OpenAI API key: "));
      const envPath = await saveOpenAIKey(apiKey, getProjectRoot());

      console.log(chalk.green("OPENAI_API_KEY saved."));
      console.log(`File: ${envPath}`);
      console.log(`Key: ${maskOpenAIKey(apiKey)}`);
    });

  config
    .command("clear")
    .description("Clear a config value from the local .env file")
    .argument("<key>", "Supported key: openai-api-key")
    .action(async (key: string) => {
      assertSupportedKey(key);
      const envPath = await clearOpenAIKey(getProjectRoot());
      console.log(chalk.green("OPENAI_API_KEY removed from local .env."));
      console.log(`File: ${envPath}`);
    });
}

async function printConfig(): Promise<void> {
  const status = await getAPIKeyStatus(getProjectRoot());

  console.log(chalk.bold.cyan("PCA Config"));
  console.log("");
  console.log(`Project .env: ${status.envPath}`);
  console.log(`.env exists: ${status.exists ? chalk.green("yes") : chalk.yellow("no")}`);
  console.log(`OPENAI_API_KEY: ${hasOpenAIKey() ? chalk.green("configured") : chalk.yellow("missing")}`);
  if (status.maskedKey) {
    console.log(`Key: ${status.maskedKey}`);
  }
  console.log("");
  console.log("Commands:");
  console.log("pca login");
  console.log("pca config set openai-api-key");
  console.log("pca config get openai-api-key");
  console.log("pca config clear openai-api-key");
}

function assertSupportedKey(key: string): void {
  if (key !== OPENAI_KEY_NAME) {
    throw new Error(`Unsupported config key: ${key}. Use ${OPENAI_KEY_NAME}.`);
  }
}
