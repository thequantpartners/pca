import OpenAI from "openai";
import { clearOpenAIKey, getOpenAIKey, getOpenAIKeySync, saveOpenAIKey } from "./secrets.js";

export type OpenAIKeyValidation =
  | { ok: true }
  | { ok: false; status?: number; message: string };

export async function validateOpenAIKey(apiKey: string): Promise<OpenAIKeyValidation> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, message: "OpenAI API key cannot be empty." };
  }

  if (process.env.PCA_SKIP_OPENAI_VALIDATION === "1") {
    return { ok: true };
  }

  const client = new OpenAI({ apiKey: trimmed });

  try {
    await client.models.list();
    await client.vectorStores.list({ limit: 1 });
    return { ok: true };
  } catch (error) {
    const status = getStatus(error);
    if (status === 401) {
      return { ok: false, status, message: "Invalid OpenAI API key. Please check and try again." };
    }

    if (status === 403) {
      return {
        ok: false,
        status,
        message: "API key is valid but does not have enough permissions for PCA.",
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status, message };
  }
}

export async function ensureValidOpenAIKey(): Promise<string> {
  const key = await getOpenAIKey();
  if (!key) {
    throw new Error(["OpenAI API key is not configured.", "Run: pca setup"].join("\n"));
  }

  const validation = await validateOpenAIKey(key);
  if (!validation.ok) {
    await clearOpenAIKey();
    throw new Error(["OpenAI API key is invalid or expired.", "Run: pca setup"].join("\n"));
  }

  return key;
}

export function requireOpenAIKeySync(): string {
  const key = getOpenAIKeySync();
  if (!key) {
    throw new Error(["OpenAI API key is not configured.", "Run: pca setup"].join("\n"));
  }

  return key;
}

export async function saveValidatedOpenAIKey(apiKey: string): Promise<void> {
  const validation = await validateOpenAIKey(apiKey);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  await saveOpenAIKey(apiKey);
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}
