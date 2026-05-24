import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const gitDir = path.join(root, ".git");

if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
  process.exit(0);
}

const hooksDir = path.join(gitDir, "hooks");
const hookPath = path.join(hooksDir, "post-commit");
const hook = `#!/bin/sh

commit_message="$(git log -1 --pretty=%B)"

changed_files="$(git diff HEAD~1 HEAD --name-only 2>/dev/null || git diff-tree --root --no-commit-id --name-only -r HEAD)"
pca_files="$(printf '%s\\n' "$changed_files" | grep -E '^(PCA_INDEX\\.md|AGENTS\\.md|pca/.+\\.md)$')"

if [ -n "$pca_files" ]; then
  pca commit "$commit_message" --type general || true
fi
`;

fs.mkdirSync(hooksDir, { recursive: true });
fs.writeFileSync(hookPath, hook, "utf8");

if (process.platform !== "win32") {
  fs.chmodSync(hookPath, 0o755);
}
