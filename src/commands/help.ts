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
      console.log("Markdown files are the source of truth.");
      console.log("Agents retrieve only what they need. No full folder reads.");
      console.log("");
      console.log(chalk.bold("Mental Flow"));
      console.log("Local:  init \u2192 bootstrap \u2192 commit \u2192 task \u2192 paste into agent");
      console.log("Cloud:  + sync \u2192 query \u2192 close");
      console.log("");
      printCommandSections();
      console.log(chalk.bold("Recommended Flow"));
      console.log("# Start a new project");
      console.log("pca init");
      console.log("pca bootstrap");
      console.log('pca task "your first task"   \u2190 paste output into Codex or Claude');
      console.log("");
      console.log("# Daily flow");
      console.log("pca commit                   \u2190 record decisions as you work");
      console.log('pca task "next task"         \u2190 before every AI session');
      console.log("pca logs                     \u2190 review history anytime");
      console.log("");
      console.log("# When ready for cloud");
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
  console.log(chalk.green("Local commands (no API key required)"));
  console.log(formatCommand("pca init", "Initialize PCA memory in this project"));
  console.log(formatCommand("pca bootstrap", "Generate initial context from an existing project"));
  console.log(formatCommand("pca status", "Show project memory status"));
  console.log(formatCommand("pca commit", "Record a decision or milestone"));
  console.log(formatCommand("pca logs", "List context commit history"));
  console.log(formatCommand("pca task", "Generate context for your AI agent"));
  console.log(formatCommand("pca doctor", "Diagnose your PCA setup"));
  console.log(formatCommand("pca help", "Show this guide"));
  console.log("");
  console.log(chalk.yellow("Cloud commands (requires API key or PCA account)"));
  console.log(formatCommand("pca setup", "Configure API keys and cloud auth"));
  console.log(formatCommand("pca sync", "Upload memory to OpenAI Vector Store"));
  console.log(formatCommand("pca query", "Search memory via RAG"));
  console.log(formatCommand("pca visual add", "Add image to visual memory"));
  console.log(formatCommand("pca close", "Close a task and update changelog"));
  console.log(formatCommand("pca login", "Sign in to PCA cloud"));
  console.log(formatCommand("pca logout", "Clear cloud session"));
  console.log(formatCommand("pca whoami", "Show account status"));
  console.log(formatCommand("pca config", "Manage global config"));
  console.log("");
}

function formatCommand(command: string, description: string): string {
  return `  ${command.padEnd(16)}${chalk.gray(description)}`;
}
