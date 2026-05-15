import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getProjectRoot, loadConfig, requireOpenAIKey } from "../core/config.js";
import { dateStamp, timestampForLog } from "../core/files.js";

export function registerCloseCommand(program: Command): void {
  program
    .command("close")
    .description("Close a confirmed PCA task and mark memory as needing sync")
    .action(async () => {
      const root = getProjectRoot();
      await loadConfig(root);
      requireOpenAIKey();

      const lastContextPath = path.join(root, ".pca", "last-task-context.md");
      if (await fs.pathExists(lastContextPath)) {
        const lastContext = await fs.readFile(lastContextPath, "utf8");
        console.log(chalk.cyan("Last task context found: .pca/last-task-context.md"));
        const task = extractTask(lastContext);
        if (task) {
          console.log(`Task: ${task}`);
        }
      } else {
        console.log(chalk.yellow("No .pca/last-task-context.md found. Continuing with manual closure."));
      }

      console.log(chalk.bold("Closure requires explicit user confirmation with SI."));

      const rl = createInterface({ input, output });
      try {
        const confirmed = await rl.question("¿La tarea fue completada y confirmada con SI? (yes/no) ");

        if (!["yes", "y", "si", "sí"].includes(confirmed.trim().toLowerCase())) {
          console.log("Closure cancelled. No PCA files were updated.");
          return;
        }

        const change = await rl.question("Texto breve del cambio realizado: ");
        const normalizedChange = change.trim();

        if (!normalizedChange) {
          console.log("Closure cancelled. Change text is required.");
          return;
        }

        await appendChangelog(root, normalizedChange);
        await appendRoadmapDone(root, normalizedChange);
        await appendSyncRequired(root);

        console.log(chalk.green("PCA closure recorded."));
        console.log("Next step: pca sync");
      } finally {
        rl.close();
      }
    });
}

async function appendChangelog(root: string, change: string): Promise<void> {
  const filePath = path.join(root, "pca", "state", "changelog.md");
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `## ${dateStamp()}\n- ${change}\n\n`, "utf8");
}

async function appendRoadmapDone(root: string, change: string): Promise<void> {
  const filePath = path.join(root, "pca", "state", "roadmap.md");
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `\n## Closure ${dateStamp()}\n- Done: ${change}\n`, "utf8");
}

async function appendSyncRequired(root: string): Promise<void> {
  const filePath = path.join(root, "pca", "rag", "sync-log.md");
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `## ${timestampForLog()}\n- Closure recorded\n- Sync required: run \`pca sync\`\n\n`, "utf8");
}

function extractTask(context: string): string | undefined {
  const lines = context.split(/\r?\n/);
  const taskHeadingIndex = lines.findIndex((line) => line.trim() === "## Task");
  if (taskHeadingIndex === -1) {
    return undefined;
  }

  return lines
    .slice(taskHeadingIndex + 1)
    .map((line) => line.trim())
    .find(Boolean);
}
