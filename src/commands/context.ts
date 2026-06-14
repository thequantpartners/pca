import { execFileSync } from "node:child_process";
import path from "node:path";
import clipboard from "clipboardy";
import { Command } from "commander";
import fs from "fs-extra";
import chalk from "chalk";
import { getProjectRoot } from "../core/config.js";
import { readContextCommits } from "../core/context-commits.js";

type ProjectSummary = {
  name: string;
  description: string;
};

export function registerContextCommand(program: Command): void {
  program
    .command("context")
    .description("Generate current project context, copy it to clipboard, and save it locally")
    .option("-p, --prompt", "Generate an LLM-optimized system prompt context")
    .action(async (options: { prompt?: boolean }) => {
      const root = getProjectRoot();

      if (options.prompt) {
        const promptContext = await buildPromptContext(root);
        await clipboard.write(promptContext);

        const chars = promptContext.length;
        const tokens = Math.round(chars / 4);
        
        console.log(chalk.green(`\nSystem Prompt copiado al portapapeles exitosamente.`));
        console.log(chalk.cyan(`Estadísticas: ${chars} caracteres, ~${tokens} tokens estimados.\n`));
        return;
      }

      const markdown = await buildCurrentProjectContext(root);
      const outputPath = path.join(root, ".pca", "last-context.md");

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, markdown, "utf8");
      await clipboard.write(markdown);

      console.log("Context copied to clipboard.");
    });
}

async function buildPromptContext(root: string): Promise<string> {
  const parts: string[] = [];
  
  parts.push("You are an AI assistant working on the following project.");
  parts.push("Please adhere to the context and rules below strictly.\n");

  const addFile = async (filePath: string, label: string) => {
    const fullPath = path.join(root, filePath);
    if (await fs.pathExists(fullPath)) {
      let content = await fs.readFile(fullPath, "utf8");
      // Minify logic: remove multiple empty lines
      content = content.replace(/\n\s*\n/g, "\n").trim();
      parts.push(`<${label}>\n${content}\n</${label}>\n`);
    }
  };

  await addFile("PCA_INDEX.md", "pca_index");
  await addFile("AGENTS.md", "agents_rules");

  const corePath = path.join(root, "pca", "core");
  if (await fs.pathExists(corePath)) {
    const files = await fs.readdir(corePath);
    for (const file of files) {
      if (file.endsWith(".md")) {
        await addFile(path.posix.join("pca/core", file), `core_file_${file.replace(".md", "")}`);
      }
    }
  }

  await addFile("pca/state/active-task.md", "active_task");

  return parts.join("\n");
}

async function buildCurrentProjectContext(root: string): Promise<string> {
  const [project, stack, architecture, activeDecisions, commits] = await Promise.all([
    readProjectSummary(root),
    readOptionalMarkdown(root, "pca/core/stack.md"),
    readOptionalMarkdown(root, "pca/core/architecture.md"),
    readOptionalMarkdown(root, "pca/core/active-decisions.md"),
    readContextCommits(root),
  ]);

  return [
    "# PCA Project Context",
    "",
    "## Project",
    `Name: ${project.name}`,
    "",
    project.description,
    "",
    "## Stack",
    formatSection(stack, "No stack context found."),
    "",
    "## Architecture",
    formatSection(architecture, "No architecture context found."),
    "",
    "## Git",
    `Active branch: ${getActiveBranch(root)}`,
    "",
    "## Latest Context Commits",
    formatCommits(commits.slice(0, 5)),
    "",
    "## Active Decisions",
    formatSection(activeDecisions, "No active decisions file found."),
    "",
  ].join("\n");
}

async function readProjectSummary(root: string): Promise<ProjectSummary> {
  const projectBrief = await readOptionalMarkdown(root, "pca/core/project-brief.md");
  const pcaIndex = await readOptionalMarkdown(root, "PCA_INDEX.md");
  const source = projectBrief || pcaIndex;

  return {
    name: firstHeading(source) ?? path.basename(root),
    description: firstSectionBody(source, ["What We Are Building", "Project", "Current Status"]) ?? "No project description found.",
  };
}

async function readOptionalMarkdown(root: string, relativePath: string): Promise<string | undefined> {
  const filePath = path.join(root, relativePath);
  if (!(await fs.pathExists(filePath))) {
    return undefined;
  }

  const content = await fs.readFile(filePath, "utf8");
  return content.trim() || undefined;
}

function firstHeading(content: string | undefined): string | undefined {
  return content
    ?.split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line))
    ?.replace(/^#\s+/, "")
    .trim();
}

function firstSectionBody(content: string | undefined, headings: string[]): string | undefined {
  if (!content) {
    return undefined;
  }

  for (const heading of headings) {
    const body = sectionBody(content, heading);
    if (body) {
      return body;
    }
  }

  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,6}\s+/.test(line))[0];
}

function sectionBody(content: string, heading: string): string | undefined {
  const lines = content.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) {
    return undefined;
  }

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s+/.test(line.trim())) {
      break;
    }

    body.push(line);
  }

  const text = body.join("\n").trim();
  return text || undefined;
}

function formatSection(content: string | undefined, fallback: string): string {
  return content?.trim() || fallback;
}

function formatCommits(commits: Awaited<ReturnType<typeof readContextCommits>>): string {
  if (!commits.length) {
    return "No context commits found.";
  }

  return commits.map((commit) => `- ${commit.timestamp} [${commit.type}] ${commit.message}`).join("\n");
}

function getActiveBranch(root: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}
