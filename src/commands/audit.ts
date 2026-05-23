import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { AuditLogCorruptedError, readAuditLog, type AuditEntry } from "../core/audit.js";
import { getProjectRoot } from "../core/config.js";

export function registerAuditCommand(program: Command): void {
  program
    .command("audit")
    .description("View PCA context retrieval audit history")
    .option("--last <number>", "Maximum number of audit entries to show", "10")
    .option("--task <task>", "Filter by task description")
    .option("--date <date>", "Filter by date in YYYY-MM-DD format")
    .action(async (options: { last: string; task?: string; date?: string }) => {
      const last = parseLast(options.last);
      const date = options.date?.trim();

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("Invalid --date. Use YYYY-MM-DD.");
      }

      let entries: AuditEntry[];
      try {
        entries = await readAuditLog(getProjectRoot(), {
          last,
          task: options.task,
          date,
        });
      } catch (error) {
        if (error instanceof AuditLogCorruptedError) {
          console.log(chalk.bold.cyan("PCA Audit Log"));
          console.log("");
          console.log(chalk.yellow(error.message));
          return;
        }

        throw error;
      }

      console.log(chalk.bold.cyan("PCA Audit Log"));
      console.log("");

      if (!entries.length) {
        console.log("No audit entries found.");
        return;
      }

      for (const entry of entries) {
        console.log(`${formatTimestamp(entry.timestamp)}  [${formatAuditId(entry.id)}] ${entry.taskDescription}`);
        console.log(`  Chunks: ${entry.chunksRetrieved.length} retrieved, ${entry.totalTokens} tokens`);
        console.log(`  From: ${formatChunkSources(entry)}`);
        console.log(`  Status: ${entry.status}`);
        console.log("");
      }
    });
}

function parseLast(value: string): number {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Invalid --last. Use an integer between 1 and 100.");
  }

  return limit;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

function formatAuditId(id: string): string {
  if (!id.startsWith("audit_")) {
    return id;
  }

  return id.slice(0, 13);
}

function formatChunkSources(entry: AuditEntry): string {
  const filenames = entry.chunksRetrieved.map((chunk) => path.basename(chunk.filename));
  const uniqueFilenames = [...new Set(filenames)];
  return uniqueFilenames.length ? uniqueFilenames.join(", ") : "none";
}
