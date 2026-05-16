import { Command } from "commander";
import chalk from "chalk";
import { getGlobalConfigPath, getProjectRoot } from "../core/config.js";
import { loadAuthSession } from "../core/auth.js";
import { getOpenAIKey } from "../core/secrets.js";
import { formatModeLabel, type PCAMode } from "../core/readiness.js";
import { loadDerivedReadiness } from "../core/readiness-state.js";

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("Show PCA account and credential status")
    .action(async () => {
      const root = getProjectRoot();
      const session = await loadAuthSession();
      const key = await getOpenAIKey();
      const readiness = await loadDerivedReadiness(root);

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
      console.log(`OpenAI API key: ${key ? chalk.green("configured") : chalk.yellow("missing")}`);
      console.log(`PCA global config: ${chalk.green("OK")}`);
      console.log(`Global config path: ${getGlobalConfigPath()}`);
    });
}

function readinessStatus(ok: boolean, okLabel: string, missingLabel: string): string {
  return ok ? chalk.green(okLabel) : chalk.yellow(missingLabel);
}

function modeStatus(mode: PCAMode): string {
  return mode === "partial" ? chalk.yellow(formatModeLabel(mode)) : chalk.green(formatModeLabel(mode));
}
