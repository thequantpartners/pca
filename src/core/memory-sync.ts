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

export async function syncMemory(root: string): Promise<SyncResult> {
  const config = await loadConfig(root);
  requireAuthSession();
  await ensureValidOpenAIKey();
  const files = await listSyncFiles(root);
  const failed: Array<{ path: string; error: string }> = [];
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ path: rel, error: message });
    }
  }

  await appendSyncLog(root, config.vectorStoreId, syncedCount, failed);
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
  failed: Array<{ path: string; error: string }>,
): Promise<void> {
  const logPath = path.join(root, "pca", "rag", "sync-log.md");
  await fs.ensureDir(path.dirname(logPath));

  const failureLines = failed.length
    ? ["- Failed files:", ...failed.map((item) => `  - ${item.path}: ${item.error}`)]
    : [];

  const entry = [
    `## ${timestampForLog()}`,
    "- Sync completed",
    `- Files synced: ${syncedCount}`,
    `- Vector store: ${vectorStoreId}`,
    "- TODO(v2): add vector store deduplication/replacement with stable local path to file mapping.",
    ...failureLines,
    "",
  ].join("\n");

  await fs.appendFile(logPath, entry, "utf8");

  if (failed.length) {
    console.error(chalk.yellow(`Sync completed with ${failed.length} failed file(s).`));
  }
}
