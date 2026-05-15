import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getProjectRoot, loadConfig } from "../core/config.js";
import { buildTaskContext, classifyTask, TASK_LIMITS } from "../core/prompt-builder.js";
import { retrieveContext } from "../core/retrieval.js";

export function registerTaskCommand(program: Command): void {
  program
    .command("task")
    .description("Generate compact PCA context for an AI development task")
    .argument("<task>", "Task description")
    .option("--api-key <key>", "OpenAI API key for this command")
    .action(async (task: string) => {
      const root = getProjectRoot();
      const indexPath = path.join(root, "PCA_INDEX.md");

      if (!(await fs.pathExists(indexPath))) {
        throw new Error(
          [
            chalk.red("PCA_INDEX.md not found."),
            "PCA sin RAG no opera.",
            "Run `pca init` first.",
          ].join("\n"),
        );
      }

      await fs.readFile(indexPath, "utf8");
      await loadConfig(root);

      const taskType = classifyTask(task);
      const limit = TASK_LIMITS[taskType];
      const results = await retrieveContext({ root, query: task, limit });
      const output = buildTaskContext(task, taskType, results);
      const outputPath = path.join(root, ".pca", "last-task-context.md");

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, output, "utf8");

      console.log(output);
      console.log(chalk.green(`Saved to ${path.relative(root, outputPath)}`));
    });
}
