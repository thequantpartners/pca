import { Command } from "commander";
import chalk from "chalk";
import { printBanner } from "../core/banner.js";

export function registerHelpCommand(program: Command): void {
  program
    .command("help")
    .description("Show PCA usage guide")
    .action(() => {
      printBanner();
      printCommandSections();
    });
}

export function printCommandSections(): void {
  console.log(chalk.bold("CORE"));
  console.log(formatCommand('pca init', "Initialize project memory"));
  console.log(formatCommand("pca bootstrap", "Fill project context interactively"));
  console.log(formatCommand("pca context", "Generate project context and copy to clipboard"));
  console.log(formatCommand('pca commit "<msg>"', "Record a context milestone"));
  console.log(formatCommand("pca staged", "Manage staged context commits"));
  console.log(formatCommand("pca logs", "List context history"));
  console.log(formatCommand("pca status", "Show project and context state"));
  console.log("");

  console.log(chalk.bold("GIT SYNC (automatic)"));
  console.log("  Hooks run automatically on git commit, checkout, merge and rebase.");
  console.log("  No manual commands needed.");
  console.log("");

  console.log(chalk.bold("MAINTENANCE"));
  console.log(formatCommand("pca health", "Check context file sizes"));
  console.log(formatCommand("pca doctor", "Diagnose PCA setup"));
  console.log(formatCommand("pca forget", "Deprecate obsolete context"));
  console.log(formatCommand("pca sync", "Sync context to vector store"));
  console.log(formatCommand('pca query "<query>"', "Query project memory"));
  console.log("");

  console.log(chalk.bold("AUTH"));
  console.log(formatCommand("pca login", "Sign in"));
  console.log(formatCommand("pca logout", "Sign out"));
  console.log(formatCommand("pca whoami", "Show active account"));
  console.log(formatCommand("pca config", "Manage configuration"));
}

function formatCommand(command: string, description: string): string {
  return `  ${command.padEnd(22)}${chalk.gray(description)}`;
}
