import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { requireAuthSession } from "./auth.js";
import { loadConfig, saveConfig } from "./config.js";
import { listSyncFiles, readMarkdownForUpload, relativePosix, timestampForLog } from "./files.js";
import { ensureValidOpenAIKey } from "./openai-key.js";
import { uploadMarkdownToVectorStore } from "./openai.js";

export type SyncResult = {
  vectorStoreId: string;
  syncedCount: number;
  failed: Array<{ path: string; error: string }>;
};

type SyncedFile = {
  path: string;
  chunks: number;
};

export async function syncMemory(root: string): Promise<SyncResult> {
  const config = await loadConfig(root);
  requireAuthSession();
  await ensureValidOpenAIKey();
  const files = await listSyncFiles(root);
  const failed: Array<{ path: string; error: string }> = [];
  const syncedFiles: SyncedFile[] = [];
  let syncedCount = 0;

  for (const filePath of files) {
    const rel = relativePosix(root, filePath);

    try {
      const content = await readMarkdownForUpload(root, filePath);
      await uploadMarkdownToVectorStore({
        vectorStoreId: config.vectorStoreId,
        fileName: rel,
        sourcePath: rel,
        content,
      });
      syncedCount += 1;
      syncedFiles.push({ path: rel, chunks: estimateChunkCount(content) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ path: rel, error: message });
    }
  }

  await appendSyncLog(root, config.vectorStoreId, syncedCount, syncedFiles, failed);
  await saveConfig({ ...config, updatedAt: new Date().toISOString() }, root);

  return {
    vectorStoreId: config.vectorStoreId,
    syncedCount,
    failed,
  };
}

async function appendSyncLog(
  root: string,
  vectorStoreId: string,
  syncedCount: number,
  syncedFiles: SyncedFile[],
  failed: Array<{ path: string; error: string }>,
): Promise<void> {
  const logPath = path.join(root, "pca", "rag", "sync-log.md");
  await fs.ensureDir(path.dirname(logPath));
  const timestamp = timestampForLog();

  const failureLines = failed.length
    ? ["- Failed files:", ...failed.map((item) => `  - ${item.path}: ${item.error}`)]
    : [];
  const historyRows = [
    "## Sync History",
    "| File | Last Synced | Chunks | Status |",
    "|------|-------------|--------|--------|",
    ...syncedFiles.map((item) => `| ${item.path} | ${timestamp} | ${item.chunks} | synced |`),
    ...failed.map((item) => `| ${item.path} | never | 0 | failed |`),
  ];

  const entry = [
    `## ${timestamp}`,
    "- Sync completed",
    `- Files synced: ${syncedCount}`,
    `- Vector store: ${vectorStoreId}`,
    "- TODO(v2): add vector store deduplication/replacement with stable local path to file mapping.",
    ...failureLines,
    "",
    ...historyRows,
    "",
  ].join("\n");

  await fs.appendFile(logPath, entry, "utf8");

  if (failed.length) {
    console.error(chalk.yellow(`Sync completed with ${failed.length} failed file(s).`));
  }
}

function estimateChunkCount(content: string): number {
  const headingCount = content.split(/\r?\n/).filter((line) => /^#{1,6}\s+/.test(line.trim())).length;
  if (headingCount > 0) {
    return headingCount;
  }

  return Math.max(1, Math.ceil(content.length / 1_200));
}
