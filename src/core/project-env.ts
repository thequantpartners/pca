import path from "node:path";
import fs from "fs-extra";
import { getProjectRoot } from "./config.js";

const OPENAI_KEY = "OPENAI_API_KEY";

export function getProjectEnvPath(root = getProjectRoot()): string {
  return path.join(root, ".env");
}

export async function getProjectEnvOpenAIKey(root = getProjectRoot()): Promise<string | undefined> {
  const values = await readEnvValues(getProjectEnvPath(root));
  return values[OPENAI_KEY];
}

export async function removeProjectEnvOpenAIKey(root = getProjectRoot()): Promise<void> {
  const envPath = getProjectEnvPath(root);
  if (!(await fs.pathExists(envPath))) {
    return;
  }

  const lines = (await fs.readFile(envPath, "utf8")).split(/\r?\n/);
  const next = lines.filter((line) => !new RegExp(`^\\s*${OPENAI_KEY}\\s*=`).test(line));
  await fs.writeFile(envPath, `${next.filter(Boolean).join("\n")}${next.some(Boolean) ? "\n" : ""}`, "utf8");
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
