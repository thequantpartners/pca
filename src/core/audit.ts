import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "fs-extra";

export type AuditChunk = {
  filename: string;
  section: string;
  tokens: number;
};

export type AuditEntry = {
  id: string;
  timestamp: string;
  taskDescription: string;
  chunksRetrieved: AuditChunk[];
  totalTokens: number;
  retrievedBy: "pca task";
  status: "completed";
};

export type AuditLogFilters = {
  task?: string;
  date?: string;
  last?: number;
};

export class AuditLogCorruptedError extends Error {
  constructor() {
    super("Audit log corrupted, entries unavailable");
    this.name = "AuditLogCorruptedError";
  }
}

export async function writeAuditEntry(
  root: string,
  taskDescription: string,
  chunks: AuditChunk[],
  tokens: number,
): Promise<void> {
  const ragDir = path.join(root, "pca", "rag");
  if (!(await fs.pathExists(ragDir))) {
    return;
  }

  const entry: AuditEntry = {
    id: `audit_${randomUUID()}`,
    timestamp: new Date().toISOString(),
    taskDescription,
    chunksRetrieved: chunks,
    totalTokens: tokens,
    retrievedBy: "pca task",
    status: "completed",
  };

  await fs.appendFile(auditLogPath(root), `${JSON.stringify(entry)}\n`, "utf8");
}

export async function readAuditLog(root: string, filters: AuditLogFilters = {}): Promise<AuditEntry[]> {
  const logPath = auditLogPath(root);
  if (!(await fs.pathExists(logPath))) {
    return [];
  }

  const raw = await fs.readFile(logPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const entries = lines.map(parseAuditEntry);

  return entries
    .filter((entry) => matchesTaskFilter(entry, filters.task))
    .filter((entry) => matchesDateFilter(entry, filters.date))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, filters.last ?? 10);
}

function auditLogPath(root: string): string {
  return path.join(root, "pca", "rag", "audit-log.jsonl");
}

function parseAuditEntry(line: string): AuditEntry {
  try {
    const parsed = JSON.parse(line) as Partial<AuditEntry>;
    if (!isAuditEntry(parsed)) {
      throw new Error("Invalid audit entry shape.");
    }

    return parsed;
  } catch {
    throw new AuditLogCorruptedError();
  }
}

function isAuditEntry(value: Partial<AuditEntry>): value is AuditEntry {
  return (
    typeof value.id === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.taskDescription === "string" &&
    Array.isArray(value.chunksRetrieved) &&
    value.chunksRetrieved.every(isAuditChunk) &&
    typeof value.totalTokens === "number" &&
    value.retrievedBy === "pca task" &&
    value.status === "completed"
  );
}

function isAuditChunk(value: unknown): value is AuditChunk {
  if (!value || typeof value !== "object") {
    return false;
  }

  const chunk = value as Partial<AuditChunk>;
  return typeof chunk.filename === "string" && typeof chunk.section === "string" && typeof chunk.tokens === "number";
}

function matchesTaskFilter(entry: AuditEntry, task?: string): boolean {
  if (!task?.trim()) {
    return true;
  }

  return entry.taskDescription.toLowerCase().includes(task.trim().toLowerCase());
}

function matchesDateFilter(entry: AuditEntry, date?: string): boolean {
  if (!date?.trim()) {
    return true;
  }

  return entry.timestamp.slice(0, 10) === date.trim();
}
