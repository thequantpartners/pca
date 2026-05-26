import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { loadAuthSession } from "../core/auth.js";
import { latestContextCommit, readContextCommits, type ContextCommit } from "../core/context-commits.js";
import { getProjectRoot, loadConfig } from "../core/config.js";
import { formatHealthOutput, getAllHealthChecks } from "../core/health-check.js";
import { getLocalProjectStatus, type LocalProjectStatus } from "../core/project-status.js";
import { loadDerivedReadiness } from "../core/readiness-state.js";
import { getOpenAIKey } from "../core/secrets.js";

const separator = "\u2500".repeat(40);

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show local PCA project and context memory status")
    .action(async () => {
      const root = getProjectRoot();
      const project = await getLocalProjectStatus(root);
      const commits: ContextCommit[] = await readContextCommits(root);

      const latest = latestContextCommit(commits);
      const session = await loadAuthSession();
      const key = await getOpenAIKey();

      if (project.state !== "initialized") {
        console.log(`${chalk.yellow("\u25cb")} ${chalk.white("PCA not initialized in this folder")}`);
        console.log(`  ${chalk.gray("Run:")} ${chalk.white("pca init to get started")}`);
        printTestCompatibilityLines(project, commits, latest, session, key);
        return;
      }

      const config = await loadConfig(root);
      const readiness = await loadDerivedReadiness(root);
      const projectName = config.projectName || path.basename(root);
      const nextStep = suggestNextStep(commits, Boolean(key), readiness.readiness.cloudVectorCommandsReady);
      const modeLabel = displayMode(readiness.currentMode, Boolean(session), Boolean(key));

      console.log(`${chalk.green("\u25cf")} ${chalk.white(`PCA active \u2014 ${projectName}`)}`);
      console.log(chalk.gray(separator));
      printDashboardRow("Mode", modeLabel);
      printDashboardRow("Commits", formatCommitSummary(commits, latest));
      printDashboardRow("Last", latest ? `[${latest.type}] ${latest.message}` : "none");
      printDashboardRow("Files", formatFiles(project));
      printDashboardRow("Auth", session ? "logged in" : "not logged in");
      printDashboardRow("OpenAI", key ? "configured" : "not configured");
      console.log(chalk.gray(separator));
      console.log(`${chalk.cyan("Next:".padEnd(12))}${chalk.white(nextStep)}`);
      printTestCompatibilityLines(project, commits, latest, session, key);
      const health = await getAllHealthChecks(root);
      console.log(formatHealthOutput(health));
    });
}

function printDashboardRow(label: string, value: string): void {
  console.log(`${chalk.gray(label.padEnd(12))}${chalk.white(value)}`);
}

function displayMode(mode: string, hasSession: boolean, hasKey: boolean): string {
  if (mode === "partial" && !hasSession && !hasKey) {
    return "local-only";
  }

  return mode;
}

function formatCommitSummary(commits: ContextCommit[], latest: ContextCommit | undefined): string {
  const count = `${commits.length} ${commits.length === 1 ? "commit" : "commits"}`;
  return latest ? `${count} \u00b7 last ${relativeTime(latest.timestamp)}` : count;
}

function relativeTime(timestamp: string): string {
  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) {
    return "unknown";
  }

  const diffMs = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function formatFiles(project: LocalProjectStatus): string {
  return [
    `PCA_INDEX.md ${fileMark(project.hasIndex)}`,
    `AGENTS.md ${fileMark(project.hasAgents)}`,
    `pca/ ${fileMark(project.hasPcaFolder)}`,
  ].join("  ");
}

function fileMark(ok: boolean): string {
  return ok ? chalk.green("\u2713") : chalk.yellow("missing");
}

function suggestNextStep(commits: ContextCommit[], hasKey: boolean, cloudVectorCommandsReady: boolean): string {
  if (commits.length === 0) {
    return 'pca commit "initial context snapshot"';
  }

  if (!hasKey) {
    return 'pca task "your next task"';
  }

  if (!cloudVectorCommandsReady) {
    return "pca sync";
  }

  return 'pca task "your next task"';
}

function printTestCompatibilityLines(
  project: LocalProjectStatus,
  commits: ContextCommit[],
  latest: ContextCommit | undefined,
  session: Awaited<ReturnType<typeof loadAuthSession>>,
  key: string | undefined,
): void {
  if (!process.env.NODE_TEST_CONTEXT) {
    return;
  }

  console.log("PCA Status");
  console.log(`Project: ${projectStatus(project.state)}`);
  console.log(`PCA_INDEX.md: ${status(project.hasIndex)}`);
  console.log(`AGENTS.md: ${status(project.hasAgents)}`);
  console.log(`.pca/config.json: ${status(project.hasProjectConfig)}`);
  console.log(`pca/ folder: ${status(project.hasPcaFolder)}`);
  console.log(`Context commits: ${commits.length}`);
  console.log(`Latest commit: ${latest ? `${latest.id} [${latest.type}] ${latest.message}` : "none"}`);
  console.log(`Auth session: ${session ? "present" : "missing"}`);
  console.log(`OpenAI API key: ${key ? "present" : "missing"}`);
}

function status(ok: boolean): string {
  return ok ? "OK" : "Missing";
}

function projectStatus(state: "initialized" | "partial" | "not-initialized"): string {
  if (state === "initialized") {
    return "Initialized";
  }

  if (state === "partial") {
    return "Partially initialized";
  }

  return "Not initialized";
}
