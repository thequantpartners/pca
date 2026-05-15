import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getConfigPath, getProjectRoot, hasOpenAIKey, type PCAConfig } from "../core/config.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose local PCA CLI and project setup")
    .action(async () => {
      const root = getProjectRoot();
      const nodeOk = isNodeVersionOk(process.versions.node);
      const configPath = getConfigPath(root);
      const hasConfig = await fs.pathExists(configPath);
      const hasIndex = await fs.pathExists(path.join(root, "PCA_INDEX.md"));
      const config = hasConfig ? await readConfigSafely(configPath) : undefined;
      const hasVectorStoreId = Boolean(config?.vectorStoreId);
      const isPCAProject = hasConfig && hasIndex && hasVectorStoreId;

      console.log(chalk.bold.cyan("PCA Doctor"));
      console.log("");
      console.log(`Node version: ${status(nodeOk)} ${process.version}`);
      console.log(`OPENAI_API_KEY: ${status(hasOpenAIKey())}`);
      console.log(`PCA project: ${isPCAProject ? chalk.green("OK") : chalk.yellow("Not initialized")}`);
      console.log(`PCA_INDEX.md: ${status(hasIndex)}`);
      console.log(`Vector Store ID: ${status(hasVectorStoreId)}`);
      console.log("");
      console.log(chalk.bold("Suggested next step:"));
      for (const step of suggestedSteps({
        nodeOk,
        hasKey: hasOpenAIKey(),
        hasConfig,
        hasIndex,
        hasVectorStoreId,
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

async function readConfigSafely(configPath: string): Promise<Partial<PCAConfig> | undefined> {
  try {
    return (await fs.readJson(configPath)) as Partial<PCAConfig>;
  } catch {
    return undefined;
  }
}

function status(ok: boolean): string {
  return ok ? chalk.green("OK") : chalk.yellow("Missing");
}

function suggestedSteps(args: {
  nodeOk: boolean;
  hasKey: boolean;
  hasConfig: boolean;
  hasIndex: boolean;
  hasVectorStoreId: boolean;
  isPCAProject: boolean;
}): string[] {
  if (!args.nodeOk) {
    return ["Install Node.js >= 20"];
  }

  if (!args.hasKey) {
    return ["Configure OPENAI_API_KEY", "Run `pca help`"];
  }

  if (!args.hasConfig || !args.hasIndex || !args.hasVectorStoreId) {
    return ["Run `pca init`"];
  }

  if (args.isPCAProject) {
    return ["Run `pca sync`", "Run `pca task \"your task\"`"];
  }

  return ["Run `pca help`"];
}
