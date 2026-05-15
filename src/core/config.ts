import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import dotenv from "dotenv";
import fs from "fs-extra";

loadEnvironment();

export type PCAConfig = {
  projectName: string;
  projectSlug: string;
  vectorStoreId: string;
  createdAt: string;
  runtime: "openai-vector-store";
  ragRequired: true;
  defaultAgent: "codex";
  visualMemory: true;
};

export function getProjectRoot(): string {
  return process.cwd();
}

export function getConfigPath(root = getProjectRoot()): string {
  return path.join(root, ".pca", "config.json");
}

export async function loadConfig(root = getProjectRoot()): Promise<PCAConfig> {
  const configPath = getConfigPath(root);

  if (!(await fs.pathExists(configPath))) {
    throw new Error(
      [
        chalk.red("PCA config not found."),
        "PCA sin RAG no opera.",
        "Run `pca init` first.",
      ].join("\n"),
    );
  }

  const config = (await fs.readJson(configPath)) as Partial<PCAConfig>;

  if (!config.vectorStoreId) {
    throw new Error(
      [
        chalk.red("Missing vectorStoreId in .pca/config.json."),
        "PCA sin RAG no opera.",
        "Run `pca init` again in a clean project or repair the config.",
      ].join("\n"),
    );
  }

  if (config.runtime !== "openai-vector-store" || config.ragRequired !== true) {
    throw new Error(
      [
        chalk.red("Invalid PCA runtime config."),
        "Expected runtime=openai-vector-store and ragRequired=true.",
      ].join("\n"),
    );
  }

  return config as PCAConfig;
}

export async function saveConfig(config: PCAConfig, root = getProjectRoot()): Promise<void> {
  const configPath = getConfigPath(root);
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, config, { spaces: 2 });
}

export function requireOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error(
      [
        chalk.red("Missing OPENAI_API_KEY."),
        "",
        "Set it using one of these options:",
        "",
        "1. Create a .env file in the current project:",
        "   OPENAI_API_KEY=sk-...",
        "",
        "2. Or set an environment variable:",
        "   export OPENAI_API_KEY=sk-...",
        '   $env:OPENAI_API_KEY="sk-..."',
        "   set OPENAI_API_KEY=sk-...",
        "",
        "Then run the command again.",
      ].join("\n"),
    );
  }

  return key;
}

export function applyOpenAIKeyFlag(apiKey?: string): void {
  const trimmedKey = apiKey?.trim();
  if (!trimmedKey) {
    return;
  }

  process.env.OPENAI_API_KEY = trimmedKey;
  console.warn(
    chalk.yellow(
      [
        "Warning: Passing API keys via CLI flags can expose them in shell history.",
        "Prefer using OPENAI_API_KEY environment variable or a local .env file.",
      ].join("\n"),
    ),
  );
}

export function maskOpenAIKey(apiKey: string): string {
  const trimmedKey = apiKey.trim();
  if (trimmedKey.length <= 7) {
    return "sk-...";
  }

  return `${trimmedKey.slice(0, 3)}...${trimmedKey.slice(-4)}`;
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function loadEnvironment(): void {
  dotenv.config({
    path: path.join(process.cwd(), ".env"),
    quiet: true,
  });

  const packageEnv = path.join(getPackageRoot(), ".env");
  if (packageEnv !== path.join(process.cwd(), ".env")) {
    dotenv.config({
      path: packageEnv,
      quiet: true,
    });
  }
}

function getPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "..", "..");
}
