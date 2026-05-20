import fg from "fast-glob";
import fs from "fs-extra";
import { IGNORE_PATTERNS, relativePosix, SYNC_PATTERNS } from "./files.js";

const TOKEN_LIMIT = 15_000;

export type ContextHealthZone = "safe" | "warning" | "critical";

export type ContextHealth = {
  totalWords: number;
  estimatedTokens: number;
  percentage: number;
  zone: ContextHealthZone;
  heaviestFiles: { path: string; words: number }[];
};

export async function measureContextHealth(root: string): Promise<ContextHealth> {
  const files = await fg(SYNC_PATTERNS, {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    dot: true,
    ignore: IGNORE_PATTERNS,
  });

  const fileStats = await Promise.all(
    files.map(async (filePath) => {
      const content = await fs.readFile(filePath, "utf8");
      return {
        path: relativePosix(root, filePath),
        words: countWords(content),
      };
    }),
  );

  const totalWords = fileStats.reduce((sum, file) => sum + file.words, 0);
  const estimatedTokens = Math.round(totalWords * 0.75);
  const percentage = Math.round((estimatedTokens / TOKEN_LIMIT) * 100);

  return {
    totalWords,
    estimatedTokens,
    percentage,
    zone: healthZone(estimatedTokens),
    heaviestFiles: fileStats.sort((a, b) => b.words - a.words || a.path.localeCompare(b.path)).slice(0, 3),
  };
}

function countWords(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function healthZone(tokens: number): ContextHealthZone {
  if (tokens > TOKEN_LIMIT) {
    return "critical";
  }

  if (tokens > 8_000) {
    return "warning";
  }

  return "safe";
}
