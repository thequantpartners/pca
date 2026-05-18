import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getAuthPath, loadAuthSession } from "../core/auth.js";
import {
  getAuthBaseUrl,
  getConfigPath,
  getGlobalConfigPath,
  getPCAHome,
  getProjectRoot,
} from "../core/config.js";
import { getOpenAIKey } from "../core/secrets.js";
import { PCA_VERSION } from "../core/version.js";
import { formatModeLabel, type PCADerivedReadiness, type PCAMode } from "../core/readiness.js";
import { loadDerivedReadiness, readProjectConfigSafely } from "../core/readiness-state.js";
import { getLocalProjectStatus } from "../core/project-status.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose global PCA and current project setup")
    .action(async () => {
      const root = getProjectRoot();
      const nodeOk = isNodeVersionOk(process.versions.node);
      const session = await loadAuthSession();
      const key = await getOpenAIKey();
      const authBaseUrl = await getAuthBaseUrl();
      const readiness = await loadDerivedReadiness(root);
      const projectStatus = await getLocalProjectStatus(root);

      const projectConfigPath = getConfigPath(root);
      const hasProjectConfig = await fs.pathExists(projectConfigPath);
      const projectConfig = hasProjectConfig ? await readProjectConfigSafely(projectConfigPath) : undefined;
      const hasIndex = await fs.pathExists(path.join(root, "PCA_INDEX.md"));
      const hasAgents = await fs.pathExists(path.join(root, "AGENTS.md"));
      const hasPcaFolder = await fs.pathExists(path.join(root, "pca"));
      const hasVectorStoreId = Boolean(projectConfig?.vectorStoreId);

      console.log(chalk.bold.cyan("PCA Doctor"));
      console.log("");
      console.log(chalk.bold("Global environment"));
      console.log(`Node version: ${status(nodeOk)} ${process.version}`);
      console.log(`PCA version: ${PCA_VERSION}`);
      console.log(`PCA home: ${getPCAHome()}`);
      console.log(`Global config: ${getGlobalConfigPath()}`);
      console.log("");

      console.log(chalk.bold("Derived readiness"));
      console.log(`Mode: ${modeStatus(readiness.currentMode, Boolean(session), Boolean(key))}`);
      console.log(`Offline local commands: ${readinessStatus(readiness.readiness.offlineCommandsAvailable, "available", "unavailable")}`);
      console.log(`OpenAI/BYOK readiness: ${readinessStatus(readiness.readiness.byokConfigured, "configured", "not configured")}`);
      console.log(
        `Cloud auth base URL: ${readinessStatus(readiness.readiness.cloudAuthConfigured, "configured", "not configured")}`,
      );
      console.log(`Cloud session: ${readinessStatus(readiness.readiness.cloudSessionActive, "active", "inactive")}`);
      console.log(
        `Cloud/vector commands: ${readinessStatus(readiness.readiness.cloudVectorCommandsReady, "ready", "not ready")}`,
      );
      console.log("");

      console.log(chalk.bold("PCA auth"));
      console.log(`Session: ${session ? chalk.green("present") : chalk.yellow("missing")}`);
      console.log(`Session path: ${getAuthPath()}`);
      if (session?.userEmail) {
        console.log(`Account: ${session.userEmail}`);
      }
      console.log("");

      console.log(chalk.bold("OpenAI API key"));
      console.log(`OpenAI API key: ${key ? chalk.green("configured") : chalk.yellow("missing")}`);
      console.log(`Validation: ${chalk.yellow("Skipped in doctor summary")}`);
      console.log("");

      console.log(chalk.bold("Project memory"));
      console.log(`Project root: ${root}`);
      console.log(`PCA project: ${projectLabel(projectStatus.state)}`);
      console.log(`PCA_INDEX.md: ${status(hasIndex)}`);
      console.log(`AGENTS.md: ${status(hasAgents)}`);
      console.log(`.pca/config.json: ${status(hasProjectConfig)}`);
      console.log(`pca/ folder: ${status(hasPcaFolder)}`);
      console.log("");

      console.log(chalk.bold("Vector store"));
      console.log(`Vector Store ID: ${status(hasVectorStoreId)}${projectConfig?.vectorStoreId ? ` ${projectConfig.vectorStoreId}` : ""}`);
      console.log("");

      console.log(chalk.bold("Backend auth config"));
      console.log(`Auth base URL: ${authBaseUrl ? chalk.green("OK") : chalk.yellow("Missing")}${authBaseUrl ? ` ${authBaseUrl}` : ""}`);
      console.log("");

      console.log(chalk.bold("Suggested next step:"));
      for (const step of suggestedSteps({
        nodeOk,
        readiness,
      })) {
        console.log(`- ${step}`);
      }
    });
}

function isNodeVersionOk(version: string): boolean {
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  return major >= 20;
}

function status(ok: boolean): string {
  return ok ? chalk.green("OK") : chalk.yellow("Missing");
}

function suggestedSteps(args: {
  nodeOk: boolean;
  readiness: PCADerivedReadiness;
}): string[] {
  if (!args.nodeOk) {
    return ["Install Node.js >= 20"];
  }

  if (!args.readiness.projectInitialized) {
    return ["Run `pca init` to enable offline local memory"];
  }

  if (!args.readiness.readiness.byokConfigured) {
    return ["Offline local commands are available now", "Run `pca setup` when you want OpenAI-backed commands"];
  }

  if (!args.readiness.readiness.cloudAuthConfigured) {
    return ["OpenAI/BYOK is configured", "Set `auth-base-url` only when you want PCA cloud auth"];
  }

  if (!args.readiness.readiness.cloudSessionActive) {
    return ["Cloud auth base URL is configured", "Run `pca login` when you want PCA cloud auth"];
  }

  if (!args.readiness.readiness.cloudVectorCommandsReady) {
    return ["Cloud auth is active", "Run `pca setup` if you need OpenAI-backed cloud/vector commands"];
  }

  return ["Run `pca sync`", "Run `pca task \"your task\"`"];
}

function readinessStatus(ok: boolean, okLabel: string, missingLabel: string): string {
  return ok ? chalk.green(okLabel) : chalk.yellow(missingLabel);
}

function modeStatus(mode: PCAMode, hasSession: boolean, hasKey: boolean): string {
  const displayMode = mode === "partial" && !hasSession && !hasKey ? "local-only" : mode;

  return displayMode === "partial" ? chalk.yellow(formatModeLabel(displayMode)) : chalk.green(formatModeLabel(displayMode));
}

function projectLabel(state: "initialized" | "partial" | "not-initialized"): string {
  if (state === "initialized") {
    return chalk.green("Initialized");
  }

  if (state === "partial") {
    return chalk.yellow("Partially initialized");
  }

  return chalk.yellow("Not initialized");
}
