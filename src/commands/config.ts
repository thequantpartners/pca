import { Command } from "commander";
import chalk from "chalk";
import { getAuthPath, loadAuthSession } from "../core/auth.js";
import { getGlobalConfigPath, getPCAHome, getProjectRoot, loadGlobalConfig, saveGlobalConfig } from "../core/config.js";
import { getMaskedOpenAIKey, getOpenAIKey, getSecretsPath, clearOpenAIKey } from "../core/secrets.js";
import { formatModeLabel, type PCAMode } from "../core/readiness.js";
import { loadDerivedReadiness } from "../core/readiness-state.js";
import { runOpenAISetup } from "./setup.js";

const OPENAI_KEY_NAME = "openai-api-key";
const AUTH_BASE_URL = "auth-base-url";

export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description("Manage global PCA CLI configuration");

  config.action(async () => {
    await printConfig();
  });

  config
    .command("get")
    .description("Read a global config value")
    .argument("<key>", "openai-api-key | auth-base-url")
    .action(async (key: string) => {
      if (key === OPENAI_KEY_NAME) {
        console.log((await getMaskedOpenAIKey()) ?? "missing");
        return;
      }

      if (key === AUTH_BASE_URL) {
        console.log((await loadGlobalConfig()).authBaseUrl ?? "missing");
        return;
      }

      throw unsupportedKey(key);
    });

  config
    .command("set")
    .description("Set a global config value")
    .argument("<key>", "openai-api-key | auth-base-url")
    .argument("[value]", "Value to save")
    .action(async (key: string, value?: string) => {
      if (key === OPENAI_KEY_NAME) {
        await runOpenAISetup(value);
        return;
      }

      if (key === AUTH_BASE_URL) {
        const url = value?.trim();
        if (!url) {
          throw new Error("auth-base-url value is required.");
        }
        const existing = await loadGlobalConfig();
        await saveGlobalConfig({ ...existing, authBaseUrl: url });
        console.log(chalk.green("PCA auth base URL saved."));
        console.log(url);
        return;
      }

      throw unsupportedKey(key);
    });

  config
    .command("clear")
    .description("Clear a global config value")
    .argument("<key>", "openai-api-key | auth-base-url")
    .action(async (key: string) => {
      if (key === OPENAI_KEY_NAME) {
        await clearOpenAIKey();
        console.log(chalk.green("OPENAI_API_KEY removed from global PCA credentials."));
        return;
      }

      if (key === AUTH_BASE_URL) {
        const existing = await loadGlobalConfig();
        delete existing.authBaseUrl;
        await saveGlobalConfig(existing);
        console.log(chalk.green("PCA auth base URL removed."));
        return;
      }

      throw unsupportedKey(key);
    });
}

async function printConfig(): Promise<void> {
  const root = getProjectRoot();
  const session = await loadAuthSession();
  const globalConfig = await loadGlobalConfig();
  const key = await getOpenAIKey();
  const readiness = await loadDerivedReadiness(root);

  console.log(chalk.bold.cyan("PCA Config"));
  console.log("");
  console.log(`PCA home: ${getPCAHome()}`);
  console.log(`Global config: ${getGlobalConfigPath()}`);
  console.log(`Auth session: ${getAuthPath()}`);
  console.log(`Secrets: ${getSecretsPath()}`);
  console.log(`Mode: ${modeStatus(readiness.currentMode)}`);
  console.log(`Offline local commands: ${readinessStatus(readiness.readiness.offlineCommandsAvailable, "available", "unavailable")}`);
  console.log(`OpenAI/BYOK readiness: ${readinessStatus(readiness.readiness.byokConfigured, "configured", "not configured")}`);
  console.log(
    `Cloud auth base URL: ${readinessStatus(readiness.readiness.cloudAuthConfigured, "configured", "not configured")}`,
  );
  console.log(`Cloud session: ${readinessStatus(readiness.readiness.cloudSessionActive, "active", "inactive")}`);
  console.log(
    `Cloud/vector commands: ${readinessStatus(readiness.readiness.cloudVectorCommandsReady, "ready", "not ready")}`,
  );
  console.log(`PCA account: ${session?.userEmail ?? chalk.yellow("not logged in")}`);
  console.log(`Auth base URL: ${globalConfig.authBaseUrl ?? chalk.yellow("missing")}`);
  console.log(`OpenAI API key: ${key ? chalk.green("configured") : chalk.yellow("missing")}`);
  const maskedKey = await getMaskedOpenAIKey();
  if (maskedKey) {
    console.log(`Key: ${maskedKey}`);
  }
  console.log("");
  console.log("Commands:");
  console.log("pca login");
  console.log("pca setup");
  console.log("pca config set auth-base-url <url>");
  console.log("pca config set openai-api-key");
  console.log("pca config get openai-api-key");
  console.log("pca config clear openai-api-key");
}

function unsupportedKey(key: string): Error {
  return new Error(`Unsupported config key: ${key}. Use ${OPENAI_KEY_NAME} or ${AUTH_BASE_URL}.`);
}

function readinessStatus(ok: boolean, okLabel: string, missingLabel: string): string {
  return ok ? chalk.green(okLabel) : chalk.yellow(missingLabel);
}

function modeStatus(mode: PCAMode): string {
  return mode === "partial" ? chalk.yellow(formatModeLabel(mode)) : chalk.green(formatModeLabel(mode));
}
