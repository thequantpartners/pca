import type { VectorSearchResult } from "./openai.js";

export type TaskType = "simple" | "normal" | "architecture" | "audit" | "visual" | "bug";

export const TASK_LIMITS: Record<TaskType, number> = {
  simple: 3,
  normal: 5,
  architecture: 8,
  audit: 10,
  bug: 5,
  visual: 6,
};

export function classifyTask(task: string): TaskType {
  const normalized = task.toLowerCase();

  if (/\b(ui|design|landing|mobile|screenshot|visual|mockup)\b/.test(normalized)) {
    return "visual";
  }

  if (/\b(architecture|stack|database|auth|infra)\b/.test(normalized)) {
    return "architecture";
  }

  if (/\b(bug|error|fix)\b/.test(normalized)) {
    return "bug";
  }

  if (/\b(audit|review)\b/.test(normalized)) {
    return "audit";
  }

  return "normal";
}

export function buildQueryOutput(query: string, results: VectorSearchResult[]): string {
  const isLocalSearch = results.some((result) => result.source === "local");
  const sections = results.length
    ? results
        .map((result, index) => `### ${index + 1}. [${result.path}]\n${cleanChunk(result.text)}`)
        .join("\n\n")
    : "No relevant context was retrieved.";

  return `# PCA Query Result

## Query
${query}

## Mode
${isLocalSearch ? "local search — no vector retrieval" : "vector retrieval"}

## Retrieved Context

${sections}
`;
}

export function buildTaskContext(task: string, type: TaskType, results: VectorSearchResult[]): string {
  const summary = buildDeterministicSummary(results);
  const context = results.length
    ? results
        .map((result, index) => `### ${index + 1}. [${result.path}]\n${cleanChunk(result.text)}`)
        .join("\n\n")
    : "No relevant context was retrieved. RAG is not available; run `pca sync` and retry.";

  return `# PCA Task Context

## Task
${task}

## Task Type
${type}

## Runtime Rule
Do not read the full PCA folder.
Use this retrieved context only, plus directly relevant source files.

## Retrieved Context Summary
${summary}

## Relevant Context
${context}

## Agent Instructions
- Keep scope strict.
- Do not update roadmap/changelog yet.
- Do not invent decisions.
- Review directly related source files.
- Validate before saying the task is complete.
- When done, ask: Is this task complete?
`;
}

function buildDeterministicSummary(results: VectorSearchResult[]): string {
  if (!results.length) {
    return "- No retrieved chunks. Run `pca sync` and retry the task.";
  }

  return results
    .slice(0, 3)
    .map((result) => {
      const title = firstMarkdownTitle(result.text);
      const firstLine = firstRelevantLine(result.text);
      const details = [title, firstLine].filter(Boolean).join(" - ");
      return `- ${result.path}${details ? `: ${details}` : ""}`;
    })
    .join("\n");
}

function firstMarkdownTitle(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#{1,3}\s+/.test(line))
    ?.replace(/^#{1,3}\s+/, "");
}

function firstRelevantLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Source Path:") && !/^#{1,6}\s+/.test(line))[0]
    ?.slice(0, 180);
}

function cleanChunk(text: string): string {
  return text.trim() || "[empty chunk]";
}
