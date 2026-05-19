import chalk from "chalk";
import { PCA_VERSION } from "./version.js";

const tips = [
  "Run: pca status to see your project memory state.",
  "Run: pca commit to record a decision or milestone.",
  "Run: pca logs to see your context history.",
  "Run: pca task to generate context for your AI agent.",
  "Run: pca help to see all available commands.",
];

export function printBanner(): void {
  const art = [
    "██████  ██████  █████  ",
    "██   ██ ██     ██   ██ ",
    "██████  ██     ███████ ",
    "██      ██     ██   ██ ",
    "██      ██████ ██   ██ ",
  ].join("\n");
  const tip = tips[Math.floor(Math.random() * tips.length)];

  console.log(chalk.cyan(art));
  console.log(chalk.gray("Persistent Context Architecture — Git for AI context"));
  console.log(chalk.gray(`Version: ${PCA_VERSION}`));
  console.log("");
  console.log(chalk.yellow(tip));
  console.log("");
}
