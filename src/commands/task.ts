import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getProjectRoot } from "../core/config.js";
import { readContextCommits, type ContextCommit } from "../core/context-commits.js";
import { buildTaskContext, classifyTask, TASK_LIMITS } from "../core/prompt-builder.js";
import { loadDerivedReadiness } from "../core/readiness-state.js";
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
            "RAG is not available.",
            "Run `pca init` first.",
          ].join("\n"),
        );
      }

      const projectMemory = await fs.readFile(indexPath, "utf8");
      const readiness = await loadDerivedReadiness(root);
      const outputPath = path.join(root, ".pca", "last-task-context.md");

      const output = readiness.readiness.cloudVectorCommandsReady
        ? await buildRagTaskContext(root, task)
        : await buildLocalOnlyTaskContext(root, task, projectMemory);

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, output, "utf8");

      console.log(output);
      console.log(chalk.green(`Saved to ${path.relative(root, outputPath)}`));
    });
}

async function buildRagTaskContext(root: string, task: string): Promise<string> {
  const taskType = classifyTask(task);
  const limit = TASK_LIMITS[taskType];
  const results = await retrieveContext({ root, query: task, limit });
  return buildTaskContext(task, taskType, results);
}

async function buildLocalOnlyTaskContext(root: string, task: string, projectMemory: string): Promise<string> {
  const commits = await readContextCommits(root);
  const relevantCommits = selectRelevantLocalCommits(task, commits);
  const formattedCommits = relevantCommits.length
    ? relevantCommits.map((commit) => `- [${commit.type}] ${commit.message} (${commit.timestamp})`).join("\n")
    : "No relevant context commits found.";

  return `# PCA Task Context

## Task
${task}

## Mode
local-only \u2014 No vector retrieval. Context built from local memory files.

## Project Memory
${projectMemory.trim()}

## Relevant Context Commits
${formattedCommits}

## Agent Instructions
Use the project memory above as your only context source.
Do not read the full pca/ folder.
Do not invent decisions not listed here.
Validate before marking task as done.
When done, ask: Is this task complete?
`;
}

function selectRelevantLocalCommits(task: string, commits: ContextCommit[]): ContextCommit[] {
  const taskWords = extractKeywordWords(task);
  return [...commits]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10)
    .filter((commit, index) => index < 3 || commitMatchesTaskWords(commit, taskWords));
}

function commitMatchesTaskWords(commit: ContextCommit, taskWords: string[]): boolean {
  const message = commit.message.toLowerCase();
  return taskWords.some((word) => message.includes(word));
}

function extractKeywordWords(task: string): string[] {
  return [...new Set(task.toLowerCase().match(/[\p{L}\p{N}_]+/gu)?.filter((word) => word.length >= 4) ?? [])];
}
