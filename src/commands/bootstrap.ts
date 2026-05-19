import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getConfigPath, getProjectRoot } from "../core/config.js";
import { appendContextCommit } from "../core/context-commits.js";

type ProjectSignals = {
  detectedName: string | undefined;
  detectedStack: string[];
  detectedStructure: string[];
  hasReadme: boolean;
  readmeSnippet: string | undefined;
};

type PackageScan = {
  name: string | undefined;
  description: string | undefined;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const structureFolders = ["src", "app", "pages", "api", "components"] as const;

export function registerBootstrapCommand(program: Command): void {
  program
    .command("bootstrap")
    .description("Onboard an existing project into PCA context memory")
    .action(async () => {
      const root = getProjectRoot();

      if (!(await isInitializedForBootstrap(root))) {
        console.log(chalk.red("PCA is not initialized in this project."));
        console.log(chalk.bold("Run: pca init"));
        return;
      }

      const signals = await scanProject(root);
      const projectName = signals.detectedName ?? path.basename(root);

      console.log(chalk.bold.cyan("PCA Bootstrap — Existing Project Onboarding"));
      console.log("");
      console.log(`${chalk.bold("Detected stack:")} ${formatDetectedList(signals.detectedStack)}`);
      console.log(`${chalk.bold("Detected structure:")} ${formatDetectedList(signals.detectedStructure)}`);
      console.log(`${chalk.bold("README:")} ${signals.hasReadme ? chalk.green("found") : chalk.yellow("missing")}`);
      console.log("");
      console.log(chalk.dim("PCA will ask you 5 questions to generate your initial context memory."));

      const answers = await askBootstrapQuestions(signals);
      if (!answers) {
        console.error("Bootstrap incomplete. Run pca bootstrap again to complete setup.");
        process.exitCode = 1;
        return;
      }

      const structureText = signals.detectedStructure.join(", ");
      const indexContent = [
        `# PCA Index \u2014 ${projectName}`,
        "",
        "## Project",
        answers.project,
        "",
        "## Stack",
        answers.stack,
        "",
        "## Project Structure",
        structureText,
        "",
        "## Current Status",
        answers.status,
        "",
        "## Key Decisions",
        answers.decisions,
        "",
        "## Off-limits",
        answers.offLimits,
        "",
        "## Memory",
        "This file is the source of truth for PCA context memory.",
        `Updated: ${new Date().toISOString()}`,
        "",
      ].join("\n");
      const briefContent = buildProjectBrief(projectName, answers, signals);

      await fs.writeFile(path.join(root, "PCA_INDEX.md"), indexContent, "utf8");
      await fs.ensureDir(path.join(root, "pca", "core"));
      await fs.writeFile(path.join(root, "pca", "core", "project-brief.md"), briefContent, "utf8");
      await appendContextCommit(root, "Bootstrap: initial context snapshot generated", "product");

      console.log("");
      console.log(chalk.green("PCA_INDEX.md updated with initial context memory."));
      console.log(chalk.green("pca/core/project-brief.md written."));
      console.log(chalk.green("Context commit recorded."));
      console.log("");
      console.log(chalk.bold("Next steps:"));
      console.log(chalk.cyan("  pca status"));
      console.log(chalk.cyan('  pca commit "..." --type decision   ← add more decisions as you work'));
      console.log(chalk.cyan('  pca task "your next task"          ← generate context for your AI agent'));
    });
}

type BootstrapAnswers = {
  project: string;
  status: string;
  stack: string;
  decisions: string;
  offLimits: string;
};

async function askBootstrapQuestions(signals: ProjectSignals): Promise<BootstrapAnswers | undefined> {
  const detectedStack = signals.detectedStack.join(", ");
  const questions: Array<[keyof BootstrapAnswers, string]> = [
    ["project", chalk.cyan("What are you building? (one sentence): ")],
    ["status", chalk.cyan("What is already working in this project? (brief): ")],
    [
      "stack",
      chalk.cyan(
        detectedStack
          ? `What is your main tech stack? (detected: ${detectedStack}; confirm or edit): `
          : "What is your main tech stack? (e.g. Next.js, Prisma, Stripe): ",
      ),
    ],
    [
      "decisions",
      chalk.cyan("What are the most important technical or product decisions already made? (brief): "),
    ],
    ["offLimits", chalk.cyan("What should the AI agent NOT touch or change? (brief): ")],
  ];

  if (!input.isTTY) {
    return askBootstrapQuestionsFromPipe(questions);
  }

  const rl = createInterface({ input, output });
  const answers: Partial<BootstrapAnswers> = {};

  try {
    for (const [key, question] of questions) {
      const answer = (await rl.question(question)).trim();
      if (!answer) {
        return undefined;
      }

      answers[key] = answer;
    }
  } catch {
    return undefined;
  } finally {
    rl.close();
  }

  return answers as BootstrapAnswers;
}

async function askBootstrapQuestionsFromPipe(
  questions: Array<[keyof BootstrapAnswers, string]>,
): Promise<BootstrapAnswers | undefined> {
  const lines = await readStdinLines();
  const answers: Partial<BootstrapAnswers> = {};

  for (const [index, [key, question]] of questions.entries()) {
    output.write(question);
    const answer = lines[index]?.trim() ?? "";
    if (!answer) {
      output.write("\n");
      return undefined;
    }

    output.write(`${answer}\n`);
    answers[key] = answer;
  }

  return answers as BootstrapAnswers;
}

async function readStdinLines(): Promise<string[]> {
  let data = "";
  input.setEncoding("utf8");

  for await (const chunk of input) {
    data += chunk;
  }

  return data.split(/\r?\n/);
}

function buildProjectBrief(projectName: string, answers: BootstrapAnswers, signals: ProjectSignals): string {
  const structureText = signals.detectedStructure.length > 0 ? signals.detectedStructure.join(", ") : "Not detected";
  const readmeText = signals.readmeSnippet ? signals.readmeSnippet.trim() : "No README detected.";

  return [
    `# Project Brief - ${projectName}`,
    "",
    "## What We Are Building",
    answers.project,
    "",
    "## Current Status",
    answers.status,
    "",
    "## Stack",
    answers.stack,
    "",
    "## Detected Structure",
    structureText,
    "",
    "## Key Decisions",
    answers.decisions,
    "",
    "## Off-limits",
    answers.offLimits,
    "",
    "## README Signal",
    readmeText,
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
  ].join("\n");
}

async function isInitializedForBootstrap(root: string): Promise<boolean> {
  const hasConfig = await fs.pathExists(getConfigPath(root));
  const hasIndex = await fs.pathExists(path.join(root, "PCA_INDEX.md"));
  return hasConfig && hasIndex;
}

async function scanProject(root: string): Promise<ProjectSignals> {
  const packageScan = await readPackageJson(root);
  const readmeSnippet = await readReadmeSnippet(root);

  return {
    detectedName: packageScan?.name,
    detectedStack: detectStack(packageScan),
    detectedStructure: await detectStructure(root),
    hasReadme: readmeSnippet !== undefined,
    readmeSnippet,
  };
}

async function readPackageJson(root: string): Promise<PackageScan | undefined> {
  const packagePath = path.join(root, "package.json");
  if (!(await fs.pathExists(packagePath))) {
    return undefined;
  }

  const parsed = (await fs.readJson(packagePath)) as unknown;
  if (!isObjectRecord(parsed)) {
    return {
      name: undefined,
      description: undefined,
      dependencies: {},
      devDependencies: {},
    };
  }

  return {
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    description: typeof parsed.description === "string" ? parsed.description : undefined,
    dependencies: toStringRecord(parsed.dependencies),
    devDependencies: toStringRecord(parsed.devDependencies),
  };
}

async function readReadmeSnippet(root: string): Promise<string | undefined> {
  const readmePath = path.join(root, "README.md");
  if (!(await fs.pathExists(readmePath))) {
    return undefined;
  }

  const content = await fs.readFile(readmePath, "utf8");
  return content.slice(0, 500);
}

async function detectStructure(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const directoryNames = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  return structureFolders.filter((folder) => directoryNames.has(folder)).map((folder) => `${folder}/`);
}

function detectStack(packageScan: PackageScan | undefined): string[] {
  if (!packageScan) {
    return [];
  }

  const dependencyNames = new Set([...Object.keys(packageScan.dependencies), ...Object.keys(packageScan.devDependencies)]);
  const stack: string[] = [];

  addIfDependency(stack, dependencyNames, "next", "Next.js");
  addIfDependency(stack, dependencyNames, "react", "React");
  addIfDependency(stack, dependencyNames, "vue", "Vue");
  addIfDependency(stack, dependencyNames, "prisma", "Prisma");

  if (dependencyNames.has("@clerk/nextjs") || dependencyNames.has("@clerk/clerk-sdk-node")) {
    stack.push("Clerk");
  }

  addIfDependency(stack, dependencyNames, "tailwindcss", "Tailwind CSS");
  addIfDependency(stack, dependencyNames, "stripe", "Stripe");
  addIfDependency(stack, dependencyNames, "drizzle-orm", "Drizzle ORM");
  addIfDependency(stack, dependencyNames, "express", "Express");
  addIfDependency(stack, dependencyNames, "fastify", "Fastify");

  if (dependencyNames.has("trpc") || dependencyNames.has("@trpc/server")) {
    stack.push("tRPC");
  }

  if (dependencyNames.has("supabase") || dependencyNames.has("@supabase/supabase-js")) {
    stack.push("Supabase");
  }

  addIfDependency(stack, dependencyNames, "firebase", "Firebase");
  addIfDependency(stack, dependencyNames, "openai", "OpenAI SDK");
  addIfDependency(stack, dependencyNames, "anthropic", "Anthropic SDK");

  return stack;
}

function addIfDependency(stack: string[], dependencyNames: Set<string>, dependencyName: string, label: string): void {
  if (dependencyNames.has(dependencyName)) {
    stack.push(label);
  }
}

function formatDetectedList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : chalk.yellow("none");
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!isObjectRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
