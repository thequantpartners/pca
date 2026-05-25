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
const postCommitHookPath = path.join(hooksDir, "post-commit");
const postCheckoutHookPath = path.join(hooksDir, "post-checkout");
const { postCommitHook, postCheckoutHook } = await loadHooks();

fs.mkdirSync(hooksDir, { recursive: true });
fs.writeFileSync(postCommitHookPath, postCommitHook, "utf8");
fs.writeFileSync(postCheckoutHookPath, postCheckoutHook, "utf8");

if (process.platform !== "win32") {
  fs.chmodSync(postCommitHookPath, 0o755);
  fs.chmodSync(postCheckoutHookPath, 0o755);
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
