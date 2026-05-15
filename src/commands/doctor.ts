import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getAuthPath, loadAuthSession } from "../core/auth.js";
import { getConfigPath, getGlobalConfigPath, getPCAHome, getProjectRoot, type PCAProjectConfig } from "../core/config.js";
import { getOpenAIKey } from "../core/secrets.js";
import { validateOpenAIKey } from "../core/openai-key.js";
import { PCA_VERSION } from "../core/version.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose global PCA and current project setup")
    .action(async () => {
      const root = getProjectRoot();
      const nodeOk = isNodeVersionOk(process.versions.node);
      const session = await loadAuthSession();
      const key = await getOpenAIKey();
      const keyValidation = key ? await validateOpenAIKey(key) : undefined;

      const projectConfigPath = getConfigPath(root);
      const hasProjectConfig = await fs.pathExists(projectConfigPath);
      const projectConfig = hasProjectConfig ? await readConfigSafely(projectConfigPath) : undefined;
      const hasIndex = await fs.pathExists(path.join(root, "PCA_INDEX.md"));
      const hasAgents = await fs.pathExists(path.join(root, "AGENTS.md"));
      const hasPcaFolder = await fs.pathExists(path.join(root, "pca"));
      const hasVectorStoreId = Boolean(projectConfig?.vectorStoreId);
      const isPCAProject = hasProjectConfig && hasIndex && hasAgents && hasPcaFolder && hasVectorStoreId;

      console.log(chalk.bold.cyan("PCA Doctor"));
      console.log("");
      console.log(chalk.bold("Global PCA"));
      console.log(`Node version: ${status(nodeOk)} ${process.version}`);
      console.log(`PCA version: ${PCA_VERSION}`);
      console.log(`PCA home: ${getPCAHome()}`);
      console.log(`Global config: ${getGlobalConfigPath()}`);
      console.log(`Auth session: ${session ? chalk.green("OK") : chalk.yellow("Missing")} (${getAuthPath()})`);
      console.log("");
      console.log(chalk.bold("OpenAI"));
      console.log(`OpenAI API key: ${!key ? chalk.yellow("Missing") : keyValidation?.ok ? chalk.green("OK") : chalk.red("Invalid")}`);
      console.log("");
      console.log(chalk.bold("Project PCA"));
      console.log(`PCA project: ${isPCAProject ? chalk.green("OK") : chalk.yellow("Not initialized")}`);
      console.log(`PCA_INDEX.md: ${status(hasIndex)}`);
      console.log(`AGENTS.md: ${status(hasAgents)}`);
      console.log(`.pca/config.json: ${status(hasProjectConfig)}`);
      console.log(`Vector Store ID: ${status(hasVectorStoreId)}`);
      console.log(`pca/ folder: ${status(hasPcaFolder)}`);
      console.log("");
      console.log(chalk.bold("Suggested next step:"));
      for (const step of suggestedSteps({
        nodeOk,
        loggedIn: Boolean(session),
        hasKey: Boolean(key),
        keyValid: keyValidation?.ok ?? false,
        isPCAProject,
      })) {
        console.log(`- ${step}`);
      }
    });
}

function isNodeVersionOk(version: string): boolean {
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  return major >= 20;
}

async function readConfigSafely(configPath: string): Promise<Partial<PCAProjectConfig> | undefined> {
  try {
    return (await fs.readJson(configPath)) as Partial<PCAProjectConfig>;
  } catch {
    return undefined;
  }
}

function status(ok: boolean): string {
  return ok ? chalk.green("OK") : chalk.yellow("Missing");
}

function suggestedSteps(args: {
  nodeOk: boolean;
  loggedIn: boolean;
  hasKey: boolean;
  keyValid: boolean;
  isPCAProject: boolean;
}): string[] {
  if (!args.nodeOk) {
    return ["Install Node.js >= 20"];
  }

  if (!args.loggedIn) {
    return ["Run `pca login`"];
  }

  if (!args.hasKey || !args.keyValid) {
    return ["Run `pca setup`"];
  }

  if (!args.isPCAProject) {
    return ["Run `pca init`"];
  }

  return ["Run `pca sync`", "Run `pca task \"your task\"`"];
}
