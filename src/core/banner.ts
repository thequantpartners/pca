import chalk from "chalk";
import { PCA_VERSION } from "./version.js";

const tips = [
  "💡 New project? Run: pca init && pca bootstrap",
  '💡 Starting a task? Run: pca task "describe your task" and paste the output into your AI agent',
  "💡 Made a decision? Run: pca commit --type decision",
  "💡 Want to see your project history? Run: pca logs",
  "💡 Something broken? Run: pca doctor",
  "💡 No API key needed — pca works fully offline in local-only mode",
  "💡 After finishing a task, run: pca commit to record what changed",
  "💡 Use pca logs --type decision to review all decisions made so far",
  "💡 Use pca task before every AI session to keep your agent focused",
  "💡 Run pca status to see the health of your project memory",
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
  console.log(chalk.gray("Persistent Context Architecture \u2014 Git for AI context"));
  console.log(chalk.gray(`v${PCA_VERSION}`));
  console.log("");
  console.log(chalk.yellow(tip));
  console.log("");
}
