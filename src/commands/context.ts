import { execFileSync } from "node:child_process";
import path from "node:path";
import clipboard from "clipboardy";
import { Command } from "commander";
import fs from "fs-extra";
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
    .action(async () => {
      const root = getProjectRoot();
      const markdown = await buildCurrentProjectContext(root);
      const outputPath = path.join(root, ".pca", "last-context.md");

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, markdown, "utf8");
      await clipboard.write(markdown);

      console.log("Context copied to clipboard.");
    });
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
