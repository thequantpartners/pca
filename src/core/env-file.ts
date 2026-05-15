import path from "node:path";
import fs from "fs-extra";
import { getProjectRoot, maskOpenAIKey } from "./config.js";

const OPENAI_KEY = "OPENAI_API_KEY";

export type APIKeyStatus = {
  envPath: string;
  exists: boolean;
  hasKey: boolean;
  maskedKey?: string;
};

export function getProjectEnvPath(root = getProjectRoot()): string {
  return path.join(root, ".env");
}

export async function getStoredOpenAIKey(root = getProjectRoot()): Promise<string | undefined> {
  const envPath = getProjectEnvPath(root);
  const values = await readEnvValues(envPath);
  return values[OPENAI_KEY];
}

export async function getAPIKeyStatus(root = getProjectRoot()): Promise<APIKeyStatus> {
  const envPath = getProjectEnvPath(root);
  const exists = await fs.pathExists(envPath);
  const storedKey = await getStoredOpenAIKey(root);
  const runtimeKey = process.env.OPENAI_API_KEY;
  const key = storedKey ?? runtimeKey;

  return {
    envPath,
    exists,
    hasKey: Boolean(key),
    maskedKey: key ? maskOpenAIKey(key) : undefined,
  };
}

export async function saveOpenAIKey(apiKey: string, root = getProjectRoot()): Promise<string> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("OPENAI_API_KEY cannot be empty.");
  }

  const envPath = getProjectEnvPath(root);
  await setEnvValue(envPath, OPENAI_KEY, trimmedKey);
  process.env.OPENAI_API_KEY = trimmedKey;
  return envPath;
}

export async function clearOpenAIKey(root = getProjectRoot()): Promise<string> {
  const envPath = getProjectEnvPath(root);
  await removeEnvValue(envPath, OPENAI_KEY);
  delete process.env.OPENAI_API_KEY;
  return envPath;
}

async function readEnvValues(envPath: string): Promise<Record<string, string>> {
  if (!(await fs.pathExists(envPath))) {
    return {};
  }

  const content = await fs.readFile(envPath, "utf8");
  const values: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    values[match[1]] = unquote(match[2] ?? "");
  }

  return values;
}

async function setEnvValue(envPath: string, key: string, value: string): Promise<void> {
  const lines = (await readEnvLines(envPath)).filter((line) => !isKeyLine(line, key));
  lines.push(`${key}=${quoteEnvValue(value)}`);
  await writeEnvLines(envPath, lines);
}

async function removeEnvValue(envPath: string, key: string): Promise<void> {
  const lines = (await readEnvLines(envPath)).filter((line) => !isKeyLine(line, key));
  await writeEnvLines(envPath, lines);
}

async function readEnvLines(envPath: string): Promise<string[]> {
  if (!(await fs.pathExists(envPath))) {
    return [];
  }

  return (await fs.readFile(envPath, "utf8")).split(/\r?\n/).filter((line, index, lines) => {
    return line.length > 0 || index < lines.length - 1;
  });
}

async function writeEnvLines(envPath: string, lines: string[]): Promise<void> {
  await fs.ensureDir(path.dirname(envPath));
  await fs.writeFile(envPath, `${lines.join("\n")}${lines.length ? "\n" : ""}`, "utf8");
}

function isKeyLine(line: string, key: string): boolean {
  return new RegExp(`^\\s*${key}\\s*=`).test(line);
}

function quoteEnvValue(value: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}
