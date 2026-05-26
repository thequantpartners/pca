import path from "node:path";
import fg from "fast-glob";
import fs from "fs-extra";
import { loadAuthSession } from "./auth.js";
import { loadConfig } from "./config.js";
import { readContextCommits } from "./context-commits.js";
import { ensureValidOpenAIKey } from "./openai-key.js";
import { searchVectorStore, type VectorSearchResult } from "./openai.js";

export async function retrieveContext(args: {
  root: string;
  query: string;
  limit: number;
}): Promise<VectorSearchResult[]> {
  const config = await loadConfig(args.root);

  if (config.vectorStoreId === "local-only" || !(await loadAuthSession())) {
    return searchLocalContext(args);
  }

  try {
    await ensureValidOpenAIKey();
  } catch {
    return searchLocalContext(args);
  }

  try {
    return await searchVectorStore({
      vectorStoreId: config.vectorStoreId,
      query: args.query,
      limit: args.limit,
    });
  } catch (error) {
    return searchLocalContext(args);
  }
}

async function searchLocalContext(args: { root: string; query: string; limit: number }): Promise<VectorSearchResult[]> {
  const queryWords = extractKeywordWords(args.query);
  const candidates = await readLocalSearchCandidates(args.root);

  const results = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreText(candidate.text, queryWords),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, args.limit)
    .map((candidate) => ({
      path: candidate.path,
      text: excerptAroundMatch(candidate.text, queryWords),
      score: candidate.score,
      source: "local" as const,
    }));

  if (results.length > 0) {
    return results;
  }

  return [
    {
      path: "local search — no vector retrieval",
      text: "No matching local context found.",
      source: "local",
    },
  ];
}

async function readLocalSearchCandidates(root: string): Promise<VectorSearchResult[]> {
  const candidates: VectorSearchResult[] = [];

  try {
    const commits = await readContextCommits(root);
    candidates.push(
      ...commits.map((commit) => ({
        path: ".pca/pca.db",
        text: [`[${commit.type}] ${commit.message}`, `Timestamp: ${commit.timestamp}`, `ID: ${commit.id}`].join("\n"),
        source: "local" as const,
      })),
    );
  } catch {
    // Query fallback should keep working even if the local commit log needs repair.
  }

  const files = await fg(["PCA_INDEX.md", "pca/**/*.md"], {
    cwd: root,
    onlyFiles: true,
    dot: true,
    unique: true,
  });

  for (const file of files.sort()) {
    const absolutePath = path.join(root, file);
    if (!(await fs.pathExists(absolutePath))) {
      continue;
    }

    candidates.push({
      path: file.replace(/\\/g, "/"),
      text: await fs.readFile(absolutePath, "utf8"),
      source: "local",
    });
  }

  return candidates;
}

function scoreText(text: string, queryWords: string[]): number {
  const normalized = text.toLowerCase();
  return queryWords.reduce((score, word) => {
    const matches = normalized.match(new RegExp(escapeRegExp(word), "g"))?.length ?? 0;
    return score + matches;
  }, 0);
}

function excerptAroundMatch(text: string, queryWords: string[]): string {
  const lines = text.split(/\r?\n/);
  const matchingLineIndex = lines.findIndex((line) => {
    const normalized = line.toLowerCase();
    return queryWords.some((word) => normalized.includes(word));
  });

  if (matchingLineIndex === -1) {
    return text.trim().slice(0, 800);
  }

  const start = Math.max(0, matchingLineIndex - 2);
  const end = Math.min(lines.length, matchingLineIndex + 5);
  return lines.slice(start, end).join("\n").trim();
}

function extractKeywordWords(query: string): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}_]+/gu)?.filter((word) => word.length >= 3) ?? [];
  return [...new Set(words)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
