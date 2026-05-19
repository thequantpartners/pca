import { basename } from "node:path";
import OpenAI, { toFile } from "openai";
import { requireAuthSession } from "./auth.js";
import { requireOpenAIKeySync } from "./openai-key.js";

export type VectorSearchResult = {
  path: string;
  text: string;
  score?: number;
  source?: "vector" | "local";
};

export function getOpenAIClient(): OpenAI {
  requireAuthSession();
  return new OpenAI({
    apiKey: requireOpenAIKeySync(),
  });
}

export async function createVectorStore(name: string): Promise<string> {
  const client = getOpenAIClient();
  const vectorStore = await client.vectorStores.create({ name });
  return vectorStore.id;
}

export async function uploadMarkdownToVectorStore(args: {
  vectorStoreId: string;
  fileName: string;
  sourcePath: string;
  content: string;
}): Promise<string> {
  const client = getOpenAIClient();
  const upload = await toFile(Buffer.from(args.content, "utf8"), basename(args.fileName), {
    type: "text/markdown",
  });

  const file = await client.files.create({
    file: upload,
    purpose: "assistants",
  });

  await client.vectorStores.files.createAndPoll(args.vectorStoreId, {
    file_id: file.id,
    attributes: {
      path: args.sourcePath,
      source: "pca-cli",
    },
  });

  return file.id;
}

export async function searchVectorStore(args: {
  vectorStoreId: string;
  query: string;
  limit: number;
}): Promise<VectorSearchResult[]> {
  const client = getOpenAIClient();
  const response = await client.vectorStores.search(args.vectorStoreId, {
    query: args.query,
    max_num_results: args.limit,
  });

  const data = Array.isArray(response.data) ? response.data : [];

  return data.map((item, index) => {
    const itemWithShape = item as {
      filename?: string;
      file_id?: string;
      score?: number;
      attributes?: Record<string, unknown>;
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = itemWithShape.content?.map((part) => part.text ?? "").filter(Boolean).join("\n\n") ?? "";
    const path =
      typeof itemWithShape.attributes?.path === "string"
        ? itemWithShape.attributes.path
        : extractSourcePath(text) ?? itemWithShape.filename ?? itemWithShape.file_id ?? `result-${index + 1}`;

    return {
      path,
      text,
      score: itemWithShape.score,
    };
  });
}

function extractSourcePath(text: string): string | undefined {
  const match = text.match(/^Source Path:\s*(.+)$/m);
  return match?.[1]?.trim();
}
