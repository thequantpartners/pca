import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { writeAuditEntry, type AuditChunk } from "../core/audit.js";
import { getProjectRoot } from "../core/config.js";
import { readContextCommits, type ContextCommit } from "../core/context-commits.js";
import type { VectorSearchResult } from "../core/openai.js";
import { buildTaskContext, classifyTask, TASK_LIMITS } from "../core/prompt-builder.js";
import { loadDerivedReadiness } from "../core/readiness-state.js";
import { retrieveContext } from "../core/retrieval.js";

export function registerTaskCommand(program: Command): void {
  program
    .command("task")
    .description("Deprecated: use pca context for current project context")
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

      const result = readiness.readiness.cloudVectorCommandsReady
        ? await buildRagTaskContext(root, task)
        : await buildLocalOnlyTaskResult(root, task, projectMemory);

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, result.output, "utf8");

      await writeTaskAuditEntry(root, task, result.auditChunks);

      console.log(result.output);
      console.log(chalk.green(`Saved to ${path.relative(root, outputPath)}`));
    });
}

type TaskContextResult = {
  output: string;
  auditChunks: AuditChunk[];
};

async function buildRagTaskContext(
  root: string,
  task: string,
): Promise<TaskContextResult> {
  const taskType = classifyTask(task);
  const limit = TASK_LIMITS[taskType];
  const results = await retrieveContext({ root, query: task, limit });
  return {
    output: buildTaskContext(task, taskType, results),
    auditChunks: results.map(resultToAuditChunk),
  };
}

async function buildLocalOnlyTaskResult(root: string, task: string, projectMemory: string): Promise<TaskContextResult> {
  return {
    output: await buildLocalOnlyTaskContext(root, task, projectMemory),
    auditChunks: [
      {
        filename: "PCA_INDEX.md",
        section: "Project Memory",
        tokens: estimateTokens(projectMemory),
      },
    ],
  };
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

async function writeTaskAuditEntry(root: string, task: string, chunks: AuditChunk[]): Promise<void> {
  const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);

  try {
    await writeAuditEntry(root, task, chunks, totalTokens);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(chalk.yellow(`Failed to write audit log: ${message}`));
  }
}

function resultToAuditChunk(result: VectorSearchResult): AuditChunk {
  return {
    filename: result.path,
    section: firstMarkdownTitle(result.text) ?? path.basename(result.path),
    tokens: estimateTokens(result.text),
  };
}

function firstMarkdownTitle(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#{1,6}\s+/.test(line))
    ?.replace(/^#{1,6}\s+/, "");
}

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return Math.ceil(trimmed.length / 4);
}
