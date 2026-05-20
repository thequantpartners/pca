import os from "node:os";
import path from "node:path";
import process from "node:process";
import chalk from "chalk";
import fs from "fs-extra";

export type PCAProjectConfig = {
  projectName: string;
  projectSlug: string;
  vectorStoreId: string;
  createdAt: string;
  updatedAt: string;
};

export type PCAGlobalConfig = {
  authBaseUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function getProjectRoot(): string {
  return process.cwd();
}

export function getConfigPath(root = getProjectRoot()): string {
  return path.join(root, ".pca", "config.json");
}

export function getPCAHome(): string {
  if (process.env.PCA_HOME?.trim()) {
    return path.resolve(process.env.PCA_HOME.trim());
  }

  return path.join(os.homedir(), ".pca");
}

export function getGlobalConfigPath(): string {
  return path.join(getPCAHome(), "config.json");
}

export async function loadConfig(root = getProjectRoot()): Promise<PCAProjectConfig> {
  const configPath = getConfigPath(root);

  if (!(await fs.pathExists(configPath))) {
    throw new Error(
      [
        chalk.red("PCA config not found."),
        "RAG is not available.",
        "Run `pca init` first.",
      ].join("\n"),
    );
  }

  const config = (await fs.readJson(configPath)) as Partial<PCAProjectConfig>;

  if (!config.vectorStoreId) {
    throw new Error(
      [
        chalk.red("Missing vectorStoreId in .pca/config.json."),
        "RAG is not available.",
        "Run `pca init` again in a clean project or repair the config.",
      ].join("\n"),
    );
  }

  return {
    projectName: config.projectName ?? path.basename(root),
    projectSlug: config.projectSlug ?? path.basename(root).toLowerCase(),
    vectorStoreId: config.vectorStoreId,
    createdAt: config.createdAt ?? new Date().toISOString(),
    updatedAt: config.updatedAt ?? config.createdAt ?? new Date().toISOString(),
  };
}

export async function saveConfig(config: PCAProjectConfig, root = getProjectRoot()): Promise<void> {
  const configPath = getConfigPath(root);
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, config, { spaces: 2 });
}

export async function loadGlobalConfig(): Promise<PCAGlobalConfig> {
  const configPath = getGlobalConfigPath();
  if (!(await fs.pathExists(configPath))) {
    return {};
  }

  return (await fs.readJson(configPath)) as PCAGlobalConfig;
}

export async function saveGlobalConfig(config: PCAGlobalConfig): Promise<void> {
  const now = new Date().toISOString();
  const next: PCAGlobalConfig = {
    ...config,
    createdAt: config.createdAt ?? now,
    updatedAt: now,
  };

  const configPath = getGlobalConfigPath();
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, next, { spaces: 2 });
}

export async function getAuthBaseUrl(): Promise<string | undefined> {
  return process.env.PCA_AUTH_BASE_URL?.trim() || (await loadGlobalConfig()).authBaseUrl?.trim();
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
        "Prefer `pca setup` so PCA can store the key in global user credentials.",
      ].join("\n"),
    ),
  );
}

export function maskOpenAIKey(apiKey: string): string {
  const trimmedKey = apiKey.trim();
  if (trimmedKey.length <= 7) {
    return "***";
  }

  return `${trimmedKey.slice(0, 3)}...${trimmedKey.slice(-4)}`;
}
