import chalk from "chalk";
import { PCA_VERSION } from "./version.js";

const tips = [
  "\u{1F4A1} New project? Run: pca init && pca bootstrap",
  '\u{1F4A1} Starting a task? Run: pca task "describe your task" and paste the output into your AI agent',
  "\u{1F4A1} Made a decision? Run: pca commit --type decision",
  "\u{1F4A1} Want to see your project history? Run: pca logs",
  "\u{1F4A1} Something broken? Run: pca doctor",
  "\u{1F4A1} No API key needed \u2014 pca works fully offline in local-only mode",
  "\u{1F4A1} After finishing a task, run: pca commit to record what changed",
  "\u{1F4A1} Use pca logs --type decision to review all decisions made so far",
  "\u{1F4A1} Use pca task before every AI session to keep your agent focused",
  "\u{1F4A1} Run pca status to see the health of your project memory",
];

export function printBanner(): void {
  const art = [
    "\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588  ",
    "\u2588\u2588   \u2588\u2588 \u2588\u2588     \u2588\u2588   \u2588\u2588 ",
    "\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588     \u2588\u2588\u2588\u2588\u2588\u2588\u2588 ",
    "\u2588\u2588      \u2588\u2588     \u2588\u2588   \u2588\u2588 ",
    "\u2588\u2588      \u2588\u2588\u2588\u2588\u2588\u2588 \u2588\u2588   \u2588\u2588 ",
  ].join("\n");
  const tip = tips[Math.floor(Math.random() * tips.length)];

  console.log(chalk.cyan(art));
  console.log(chalk.gray("Persistent Context Architecture \u2014 Git for AI context"));
  console.log(chalk.gray(`v${PCA_VERSION}`));
  console.log("");
  console.log(chalk.yellow(tip));
  console.log("");
}
