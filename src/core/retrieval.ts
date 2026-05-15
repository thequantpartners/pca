import chalk from "chalk";
import { loadConfig, requireOpenAIKey } from "./config.js";
import { searchVectorStore, type VectorSearchResult } from "./openai.js";

export async function retrieveContext(args: {
  root: string;
  query: string;
  limit: number;
}): Promise<VectorSearchResult[]> {
  const config = await loadConfig(args.root);
  requireOpenAIKey();

  try {
    return await searchVectorStore({
      vectorStoreId: config.vectorStoreId,
      query: args.query,
      limit: args.limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        chalk.red("Vector Store retrieval failed."),
        "PCA sin RAG no opera.",
        `Vector store: ${config.vectorStoreId}`,
        message,
      ].join("\n"),
    );
  }
}
