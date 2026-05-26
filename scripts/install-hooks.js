import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const root = process.cwd();
const gitDir = path.join(root, ".git");

if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
  process.exit(0);
}

const hooksDir = path.join(gitDir, "hooks");
const {
  postCommitHook,
  postCheckoutHook,
  postMergeHook,
  postRewriteHook,
  referenceTransactionHook,
} = await loadHooks();

fs.mkdirSync(hooksDir, { recursive: true });
const hooks = [
  ["post-commit", postCommitHook],
  ["post-checkout", postCheckoutHook],
  ["post-merge", postMergeHook],
  ["post-rewrite", postRewriteHook],
  ["reference-transaction", referenceTransactionHook],
];

for (const [name, content] of hooks) {
  fs.writeFileSync(path.join(hooksDir, name), content, "utf8");
}

if (process.platform !== "win32") {
  for (const [name] of hooks) {
    fs.chmodSync(path.join(hooksDir, name), 0o755);
  }
}

async function loadHooks() {
  try {
    return await import("../dist/core/hooks.js");
  } catch {
    const sourcePath = path.join(scriptDir, "..", "src", "core", "hooks.ts");
    const source = fs.readFileSync(sourcePath, "utf8");

    return {
      postCommitHook: extractHook(source, "postCommitHook"),
      postCheckoutHook: extractHook(source, "postCheckoutHook"),
      postMergeHook: extractHook(source, "postMergeHook"),
      postRewriteHook: extractHook(source, "postRewriteHook"),
      referenceTransactionHook: extractHook(source, "referenceTransactionHook"),
    };
  }
}

function extractHook(source, name) {
  const marker = `export const ${name} = \``;
  const start = source.indexOf(marker);

  if (start === -1) {
    throw new Error(`Unable to find ${name} in src/core/hooks.ts`);
  }

  const contentStart = start + marker.length;
  const end = source.indexOf("`;", contentStart);

  if (end === -1) {
    throw new Error(`Unable to parse ${name} in src/core/hooks.ts`);
  }

  return source.slice(contentStart, end);
}
