import { Command } from "commander";
import chalk from "chalk";
import { printBanner } from "../core/banner.js";

export function registerHelpCommand(program: Command): void {
  program
    .command("help")
    .description("Show PCA usage guide")
    .action(() => {
      printBanner();
      console.log(chalk.bold.cyan("PCA = Persistent Context Architecture"));
      console.log("Git for AI context \u2014 local-first, cloud when you need it.");
      console.log("");
      printCommandSections();
      console.log(chalk.bold("Daily Flow"));
      console.log("# New project");
      console.log("pca init");
      console.log("pca bootstrap");
      console.log('pca task "describe your task"   \u2190 paste into Claude, Codex or Cursor');
      console.log("");
      console.log("# Every day");
      console.log('git commit -m "feat: something"');
      console.log("\ud83d\udca1 PCA: Decision pending. Run 'pca commit' to save it.");
      console.log("pca commit                       \u2190 review and save decisions");
      console.log('pca task "next task"             \u2190 before every AI session');
      console.log("");
      console.log("# When ready for cloud memory");
      console.log("pca setup");
      console.log("pca sync");
      console.log("");
      console.log(chalk.bold.red("Critical Rules"));
      console.log("- Local-only mode works with no API key required.");
      console.log("- Agents must not read the full pca/ folder.");
      console.log("- Use pca task before every AI agent session.");
      console.log("- Use pca commit to record decisions, not just code changes.");
      console.log("- Cloud commands require pca setup first.");
    });
}

export function printCommandSections(): void {
  console.log(chalk.green("Local commands (work today, no API key required)"));
  console.log(formatCommand("pca init", "Initialize PCA memory in this project"));
  console.log(formatCommand("pca bootstrap", "Generate initial context from an existing project"));
  console.log(formatCommand("pca status", "Show project memory status"));
  console.log(formatCommand("pca commit", "Record decisions or review pending ones"));
  console.log(formatCommand("pca logs", "List context commit history"));
  console.log(formatCommand("pca task", "Generate compact context for your AI agent"));
  console.log(formatCommand("pca doctor", "Diagnose your PCA setup"));
  console.log(formatCommand("pca install-hooks", "Reinstall Git hooks in current project"));
  console.log(formatCommand("pca help", "Show this guide"));
  console.log("");
  console.log(chalk.yellow("Cloud commands (require OpenAI API key — run pca setup first)"));
  console.log(formatCommand("pca setup", "Configure your OpenAI API key"));
  console.log(formatCommand("pca sync", "Upload memory to OpenAI Vector Store"));
  console.log(formatCommand("pca query", "Search memory via RAG"));
  console.log(formatCommand("pca visual add", "Add image to visual memory"));
  console.log(formatCommand("pca close", "Close a task and update changelog"));
  console.log("");
  console.log(chalk.cyan("Coming soon — PCA Cloud"));
  console.log(formatCommand("pca login", "Sign in to PCA Cloud (coming in 2.0.0)"));
  console.log(formatCommand("pca logout", "Clear cloud session (coming in 2.0.0)"));
  console.log(formatCommand("pca whoami", "Show account status (coming in 2.0.0)"));
  console.log("");
}

function formatCommand(command: string, description: string): string {
  return `  ${command.padEnd(22)}${chalk.gray(description)}`;
}
