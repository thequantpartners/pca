import { Command } from "commander";
import chalk from "chalk";
import { printBanner } from "../core/banner.js";

const localCommands = [
  ["pca init", "Initialize PCA memory in this project"],
  ["pca bootstrap", "Generate initial context from an existing project"],
  ["pca status", "Show project memory status"],
  ["pca commit", "Record a decision or milestone"],
  ["pca logs", "List context commit history"],
  ["pca task", "Generate context for your AI agent"],
  ["pca doctor", "Diagnose your PCA setup"],
  ["pca help", "Show this guide"],
] as const;

const cloudCommands = [
  ["pca setup", "Configure API keys and cloud auth"],
  ["pca sync", "Upload memory to OpenAI Vector Store"],
  ["pca query", "Search memory via RAG"],
  ["pca visual add", "Add image to visual memory"],
  ["pca close", "Close a task and update changelog"],
  ["pca login", "Sign in to PCA cloud"],
  ["pca logout", "Clear cloud session"],
  ["pca whoami", "Show account status"],
  ["pca config", "Manage global config"],
] as const;

export function registerHelpCommand(program: Command): void {
  program
    .command("help")
    .description("Show PCA usage guide")
    .action(() => {
      printBanner();
      console.log(chalk.bold.cyan("PCA = Persistent Context Architecture"));
      console.log("");
      console.log("Markdown files are the source of truth.");
      console.log("RAG is the mandatory access layer.");
      console.log("Agents must not read the full pca/ folder by default.");
      console.log("");
      console.log(chalk.bold("Mental Flow"));
      console.log("PCA_INDEX.md \u2192 Vector Store Retrieval \u2192 Compact Task Context \u2192 Agent Execution \u2192 Closure \u2192 Sync");
      console.log("");
      printCommandSections();
      console.log(chalk.bold("Recommended Flow"));
      console.log("pca login");
      console.log("pca init");
      console.log("pca bootstrap");
      console.log("pca status");
      console.log('pca commit "initial context snapshot"');
      console.log("pca logs");
      console.log("pca sync");
      console.log('pca task "crear hero mobile"');
      console.log("# paste .pca/last-task-context.md into Codex");
      console.log("pca close");
      console.log("pca sync");
      console.log("");
      console.log(chalk.bold.red("Critical Rules"));
      console.log("- PCA sin RAG no opera.");
      console.log("- No fallback to reading the full pca/ folder.");
      console.log("- Only PCA_INDEX.md is read at task start.");
      console.log("- Vector Store is required.");
      console.log("- Use pca login/setup to configure global PCA credentials.");
      console.log("- Roadmap/changelog update only after closure confirmation.");
      console.log("");
      console.log(chalk.bold("Visual Memory"));
      console.log("In MVP, visual memory stores local images + textual metadata in visual-index.md.");
      console.log("Real multimodal analysis comes in v2.");
    });
}

export function printCommandSections(): void {
  console.log(chalk.green("Local commands (no API key required)"));
  printCommandRows(localCommands);
  console.log("");
  console.log(chalk.yellow("Cloud commands (requires API key or PCA account)"));
  printCommandRows(cloudCommands);
  console.log("");
}

function printCommandRows(commands: readonly (readonly [string, string])[]): void {
  const commandWidth = Math.max(...commands.map(([command]) => command.length));
  for (const [command, description] of commands) {
    console.log(`  ${command.padEnd(commandWidth + 2)}${chalk.gray(description)}`);
  }
}
