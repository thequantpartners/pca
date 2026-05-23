import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { loadConfig } from "./config.js";

const STALE_AFTER_DAYS = 7;
const SYNC_TIMESTAMP_TOLERANCE_MS = 60_000;
const CORE_FILES = [
  "pca/core/project-brief.md",
  "pca/core/product-context.md",
  "pca/core/architecture.md",
  "pca/core/stack.md",
  "pca/core/active-decisions.md",
  "pca/core/agent-rules.md",
];
const STATE_FILES = [
  "pca/state/roadmap.md",
  "pca/state/changelog.md",
  "pca/state/active-task.md",
  "pca/state/open-questions.md",
];

export type FileHealthStatus = "healthy" | "stale" | "out-of-sync";

export type FileHealthCheck = {
  filePath: string;
  group: "core" | "state";
  status: FileHealthStatus;
  modifiedAt: Date;
  lastSyncedAt?: Date;
  chunks?: number;
  reason: string;
};

export type SyncLogEntry = {
  filePath: string;
  lastSyncedAt?: Date;
  chunks: number;
  status: string;
};

export type ContextHealthChecks = {
  checks: FileHealthCheck[];
  localMode: boolean;
  totalChunks: number;
  lastSyncAt?: Date;
  warnings: number;
  critical: number;
};

export async function checkFileHealth(root: string, filePath: string): Promise<FileHealthCheck | undefined> {
  const syncHistory = await parseLastSyncFromLog(root);
  return checkFileHealthWithSyncHistory(root, filePath, syncHistory);
}

export async function getAllHealthChecks(root: string): Promise<ContextHealthChecks> {
  const config = await loadConfig(root);
  const syncHistory = await parseLastSyncFromLog(root);
  const checks = (
    await Promise.all([
      ...CORE_FILES.map((filePath) => checkFileHealthWithSyncHistory(root, filePath, syncHistory, "core")),
      ...STATE_FILES.map((filePath) => checkFileHealthWithSyncHistory(root, filePath, syncHistory, "state")),
    ])
  ).filter((check): check is FileHealthCheck => Boolean(check));

  const syncedEntries = [...syncHistory.values()].filter((entry) => entry.lastSyncedAt);
  const lastSyncAt = syncedEntries
    .map((entry) => entry.lastSyncedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    checks,
    localMode: config.vectorStoreId === "local-only",
    totalChunks: [...syncHistory.values()].reduce((sum, entry) => sum + entry.chunks, 0),
    lastSyncAt,
    warnings: checks.filter((check) => check.status === "stale").length,
    critical: checks.filter((check) => check.status === "out-of-sync").length,
  };
}

export function formatHealthOutput(health: ContextHealthChecks): string {
  const lines = ["", chalk.bold("Context Health"), ""];

  if (health.localMode) {
    lines.push(chalk.yellow("Local mode: sync tracking disabled"));
    return lines.join("\n");
  }

  const coreChecks = health.checks.filter((check) => check.group === "core");
  const stateChecks = health.checks.filter((check) => check.group === "state");

  lines.push(chalk.bold("Core Files:"));
  lines.push(...formatCheckGroup(coreChecks));
  lines.push("");
  lines.push(chalk.bold("State Files:"));
  lines.push(...formatCheckGroup(stateChecks));
  lines.push("");
  lines.push(chalk.bold("Vector Store Status:"));
  lines.push(`📊 ${health.totalChunks} chunks indexed`);
  lines.push(`⏱️  Last sync: ${health.lastSyncAt ? formatRelativeTime(health.lastSyncAt) : "never"}`);
  lines.push(health.critical > 0 ? chalk.red("❌ Out of sync") : chalk.green("✅ In sync"));
  lines.push("");
  lines.push(chalk.bold("Summary:"));

  if (health.warnings > 0) {
    lines.push(chalk.yellow(`⚠️  ${health.warnings} ${pluralize("file", health.warnings)} potentially stale (>7 days)`));
  }

  if (health.critical > 0) {
    lines.push(chalk.red(`❌ ${health.critical} ${pluralize("file", health.critical)} out of sync with vector store`));
  }

  if (health.warnings === 0 && health.critical === 0) {
    lines.push(chalk.green("✅ Everything is healthy"));
  } else {
    lines.push(`${health.warnings} warnings, ${health.critical} critical`);
  }

  return lines.join("\n");
}

export async function parseLastSyncFromLog(root: string): Promise<Map<string, SyncLogEntry>> {
  const logPath = path.join(root, "pca", "rag", "sync-log.md");
  if (!(await fs.pathExists(logPath))) {
    return new Map();
  }

  const content = await fs.readFile(logPath, "utf8");
  const entries = new Map<string, SyncLogEntry>();

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseSyncTableRow(line);
    if (!parsed) {
      continue;
    }

    const existing = entries.get(parsed.filePath);
    if (!existing || compareOptionalDates(parsed.lastSyncedAt, existing.lastSyncedAt) > 0) {
      entries.set(parsed.filePath, parsed);
    }
  }

  return entries;
}

async function checkFileHealthWithSyncHistory(
  root: string,
  filePath: string,
  syncHistory: Map<string, SyncLogEntry>,
  group: "core" | "state" = filePath.includes("/state/") ? "state" : "core",
): Promise<FileHealthCheck | undefined> {
  const absolutePath = path.join(root, filePath);
  if (!(await fs.pathExists(absolutePath))) {
    return undefined;
  }

  const stat = await fs.stat(absolutePath);
  const modifiedAt = stat.mtime;
  const syncEntry = syncHistory.get(filePath);
  const stale = daysBetween(modifiedAt, new Date()) > STALE_AFTER_DAYS;

  if (!syncEntry?.lastSyncedAt) {
    return {
      filePath,
      group,
      status: "out-of-sync",
      modifiedAt,
      chunks: syncEntry?.chunks,
      reason: "never synced - run: pca sync",
    };
  }

  if (modifiedAt.getTime() > syncEntry.lastSyncedAt.getTime() + SYNC_TIMESTAMP_TOLERANCE_MS) {
    return {
      filePath,
      group,
      status: "out-of-sync",
      modifiedAt,
      lastSyncedAt: syncEntry.lastSyncedAt,
      chunks: syncEntry.chunks,
      reason: "modified after last sync - run: pca sync",
    };
  }

  if (stale) {
    return {
      filePath,
      group,
      status: "stale",
      modifiedAt,
      lastSyncedAt: syncEntry.lastSyncedAt,
      chunks: syncEntry.chunks,
      reason: "consider updating",
    };
  }

  return {
    filePath,
    group,
    status: "healthy",
    modifiedAt,
    lastSyncedAt: syncEntry.lastSyncedAt,
    chunks: syncEntry.chunks,
    reason: "healthy",
  };
}

function formatCheckGroup(checks: FileHealthCheck[]): string[] {
  if (!checks.length) {
    return [chalk.gray("No files found.")];
  }

  return checks.map((check) => {
    const base = `${check.filePath} (updated ${formatRelativeTime(check.modifiedAt)}`;
    if (check.status === "healthy") {
      return chalk.green(`✅ ${base})`);
    }

    if (check.status === "stale") {
      return chalk.yellow(`⚠️  ${base} - ${check.reason})`);
    }

    return chalk.red(`❌ ${base} - ${check.reason})`);
  });
}

function parseSyncTableRow(line: string): SyncLogEntry | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || trimmed.includes("---") || trimmed.includes(" File ")) {
    return undefined;
  }

  const columns = trimmed
    .slice(1, -1)
    .split("|")
    .map((column) => column.trim());

  if (columns.length < 4) {
    return undefined;
  }

  const [filePath, lastSynced, chunks, status] = columns;
  if (!filePath || filePath === "File") {
    return undefined;
  }

  return {
    filePath,
    lastSyncedAt: parseSyncDate(lastSynced),
    chunks: Number.parseInt(chunks, 10) || 0,
    status,
  };
}

function parseSyncDate(value: string): Date | undefined {
  if (!value || value.toLowerCase() === "never") {
    return undefined;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function compareOptionalDates(a: Date | undefined, b: Date | undefined): number {
  return (a?.getTime() ?? 0) - (b?.getTime() ?? 0);
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor(Math.max(0, later.getTime() - earlier.getTime()) / 86_400_000);
}

function formatRelativeTime(date: Date): string {
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}
