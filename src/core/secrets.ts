import path from "node:path";
import fs from "fs-extra";
import { getPCAHome, maskOpenAIKey } from "./config.js";

export type PCASecrets = {
  openaiApiKey?: string;
  updatedAt?: string;
};

export function getSecretsPath(): string {
  return path.join(getPCAHome(), "secrets.json");
}

export async function loadSecrets(): Promise<PCASecrets> {
  const secretsPath = getSecretsPath();
  if (!(await fs.pathExists(secretsPath))) {
    return {};
  }

  return (await fs.readJson(secretsPath)) as PCASecrets;
}

export async function saveOpenAIKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("OPENAI_API_KEY cannot be empty.");
  }

  const secrets = await loadSecrets();
  await writeSecrets({
    ...secrets,
    openaiApiKey: trimmed,
    updatedAt: new Date().toISOString(),
  });
  process.env.OPENAI_API_KEY = trimmed;
}

export async function clearOpenAIKey(): Promise<void> {
  const secrets = await loadSecrets();
  delete secrets.openaiApiKey;
  secrets.updatedAt = new Date().toISOString();
  await writeSecrets(secrets);
  delete process.env.OPENAI_API_KEY;
}

export async function getOpenAIKey(): Promise<string | undefined> {
  return process.env.OPENAI_API_KEY?.trim() || (await loadSecrets()).openaiApiKey?.trim();
}

export function getOpenAIKeySync(): string | undefined {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }

  const secretsPath = getSecretsPath();
  if (!fs.pathExistsSync(secretsPath)) {
    return undefined;
  }

  const secrets = fs.readJsonSync(secretsPath) as PCASecrets;
  return secrets.openaiApiKey?.trim();
}

export async function getOpenAIKeyStatus(): Promise<"configured" | "missing"> {
  return (await getOpenAIKey()) ? "configured" : "missing";
}

export async function getMaskedOpenAIKey(): Promise<string | undefined> {
  const key = await getOpenAIKey();
  return key ? maskOpenAIKey(key) : undefined;
}

async function writeSecrets(secrets: PCASecrets): Promise<void> {
  const secretsPath = getSecretsPath();
  await fs.ensureDir(path.dirname(secretsPath));
  await fs.writeJson(secretsPath, secrets, { spaces: 2 });
  try {
    await fs.chmod(secretsPath, 0o600);
  } catch {
    // Best-effort only. Windows ACLs are managed by the OS/user profile.
  }
}
