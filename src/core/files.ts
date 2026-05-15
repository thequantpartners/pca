import path from "node:path";
import fg from "fast-glob";
import fs from "fs-extra";

export const SYNC_PATTERNS = ["PCA_INDEX.md", "AGENTS.md", "README.md", "pca/**/*.md"];

export const IGNORE_PATTERNS = [
  "node_modules/**",
  "dist/**",
  "build/**",
  ".next/**",
  ".git/**",
  ".env",
  "*.key",
  "*.pem",
  "logs/**",
];

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function relativePosix(root: string, filePath: string): string {
  return toPosixPath(path.relative(root, filePath));
}

export async function writeFileIfMissing(filePath: string, content: string): Promise<"created" | "exists"> {
  if (await fs.pathExists(filePath)) {
    return "exists";
  }

  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
  return "created";
}

export async function listSyncFiles(root: string): Promise<string[]> {
  const files = await fg(SYNC_PATTERNS, {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    dot: true,
    ignore: IGNORE_PATTERNS,
  });

  return files.sort((a, b) => relativePosix(root, a).localeCompare(relativePosix(root, b)));
}

export async function readMarkdownForUpload(root: string, filePath: string): Promise<string> {
  const rel = relativePosix(root, filePath);
  const content = await fs.readFile(filePath, "utf8");

  return [`Source Path: ${rel}`, "", content].join("\n");
}

export function timestampForLog(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function dateStamp(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
