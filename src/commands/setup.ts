import { Command } from "commander";
import chalk from "chalk";
import { getAuthBaseUrl, getProjectRoot, maskOpenAIKey } from "../core/config.js";
import { loadDerivedReadiness } from "../core/readiness-state.js";
import { saveOpenAIKey } from "../core/secrets.js";
import { getProjectEnvOpenAIKey, removeProjectEnvOpenAIKey } from "../core/project-env.js";
import { validateOpenAIKey } from "../core/openai-key.js";
import { promptSecret, promptText } from "../core/prompt.js";

type SetupMode = "local-only" | "byok" | "cloud";

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Guided PCA onboarding for local-only, BYOK, or cloud auth")
    .option("--mode <mode>", "Setup mode: local-only | byok | cloud")
    .option("--api-key <key>", "OpenAI API key to validate and save")
    .action(async (options: { mode?: string; apiKey?: string }) => {
      const mode = parseMode(options.mode);

      if (mode) {
        await runSetupMode(mode, { apiKeyFromOption: options.apiKey, nonInteractive: true });
        return;
      }

      await runInteractiveSetup(options.apiKey);
    });
}

export async function runOpenAISetup(
  apiKeyFromOption?: string,
  options?: {
    nonInteractive?: boolean;
  },
): Promise<void> {
  const root = getProjectRoot();
  const projectEnvKey = await getProjectEnvOpenAIKey(root);
  let apiKey = apiKeyFromOption?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (!apiKey && projectEnvKey) {
    if (options?.nonInteractive) {
      console.log("Using OPENAI_API_KEY from project .env for BYOK setup.");
      apiKey = projectEnvKey;
    }
  }

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

  if (projectEnvKey && projectEnvKey === trimmed && !options?.nonInteractive) {
    const remove = await promptText("Remove OPENAI_API_KEY from project .env? y/N ");
    if (remove.trim().toLowerCase() === "y") {
      await removeProjectEnvOpenAIKey(root);
      console.log("Removed OPENAI_API_KEY from project .env.");
    }
  }
}

async function runInteractiveSetup(apiKeyFromOption?: string): Promise<void> {
  const root = getProjectRoot();
  const readiness = await loadDerivedReadiness(root);
  const recommendedMode = recommendMode(readiness);

  console.log(chalk.bold.cyan("PCA Setup"));
  console.log("");
  console.log(`Current mode: ${readiness.currentMode}`);
  console.log(`Recommended next step: ${recommendedMode}`);
  console.log("");
  console.log("Choose setup mode:");
  console.log("  1. local-only");
  console.log("  2. byok");
  console.log("  3. cloud");

  const answer = await promptText(`Mode [1/2/3] (${recommendedMode}): `);
  const mode = mapChoiceToMode(answer.trim(), recommendedMode);
  await runSetupMode(mode, { apiKeyFromOption, nonInteractive: false });
}

async function runSetupMode(
  mode: SetupMode,
  options: {
    apiKeyFromOption?: string;
    nonInteractive: boolean;
  },
): Promise<void> {
  if (mode === "local-only") {
    printLocalOnlyReady();
    return;
  }

  if (mode === "byok") {
    await runByokSetup(options.apiKeyFromOption, options.nonInteractive);
    return;
  }

  await runCloudSetup();
}

async function runByokSetup(apiKeyFromOption: string | undefined, nonInteractive: boolean): Promise<void> {
  const root = getProjectRoot();
  const projectEnvKey = await getProjectEnvOpenAIKey(root);
  const envKey = process.env.OPENAI_API_KEY?.trim();
  const optionKey = apiKeyFromOption?.trim();

  if (nonInteractive && !optionKey && !envKey && !projectEnvKey) {
    throw new Error(
      [
        "OpenAI API key is required for `pca setup --mode byok`.",
        "Provide it with `--api-key <key>` or set `OPENAI_API_KEY` first.",
      ].join("\n"),
    );
  }

  await runOpenAISetup(apiKeyFromOption, { nonInteractive });
  console.log("");
  console.log(chalk.green("BYOK/OpenAI readiness is configured."));
  console.log("Next:");
  console.log("  pca status");
  console.log("  pca init");
}

async function runCloudSetup(): Promise<void> {
  const authBaseUrl = await getAuthBaseUrl();

  console.log(chalk.bold.cyan("PCA Cloud Setup"));
  console.log("");
  console.log("PCA cloud auth is separate from offline local mode.");

  if (!authBaseUrl) {
    console.log("");
    console.log(chalk.yellow("Cloud auth base URL is not configured."));
    console.log("Set it with:");
    console.log("  pca config set auth-base-url <url>");
    console.log("or:");
    console.log("  PCA_AUTH_BASE_URL=<url> pca login");
    console.log("");
    console.log("Local offline commands remain available now:");
    printOfflineCommandList();
    return;
  }

  console.log(`Cloud auth base URL: ${authBaseUrl}`);
  console.log("Next:");
  console.log("  pca login");
  console.log("");
  console.log("Optional for current OpenAI-backed/vector commands:");
  console.log("  pca config set openai-api-key");
}

function printLocalOnlyReady(): void {
  console.log(chalk.green("Local-only setup complete."));
  console.log("Offline local commands are ready:");
  printOfflineCommandList();
}

function printOfflineCommandList(): void {
  console.log("  pca init");
  console.log("  pca status");
  console.log("  pca commit");
  console.log("  pca logs");
}

function parseMode(value?: string): SetupMode | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "local-only" || value === "byok" || value === "cloud") {
    return value;
  }

  throw new Error(`Invalid --mode: ${value}. Use local-only, byok, or cloud.`);
}

function mapChoiceToMode(answer: string, recommended: SetupMode): SetupMode {
  if (!answer) {
    return recommended;
  }

  if (answer === "1" || answer.toLowerCase() === "local-only") {
    return "local-only";
  }

  if (answer === "2" || answer.toLowerCase() === "byok") {
    return "byok";
  }

  if (answer === "3" || answer.toLowerCase() === "cloud") {
    return "cloud";
  }

  throw new Error("Invalid setup mode selection. Use 1, 2, 3, local-only, byok, or cloud.");
}

function recommendMode(readiness: Awaited<ReturnType<typeof loadDerivedReadiness>>): SetupMode {
  if (readiness.readiness.cloudAuthConfigured || readiness.readiness.cloudSessionActive) {
    return "cloud";
  }

  if (readiness.readiness.byokConfigured) {
    return "byok";
  }

  return "local-only";
}
