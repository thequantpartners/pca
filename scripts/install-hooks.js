import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const gitDir = path.join(root, ".git");

if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
  process.exit(0);
}

const hooksDir = path.join(gitDir, "hooks");
const postCommitHookPath = path.join(hooksDir, "post-commit");
const postCheckoutHookPath = path.join(hooksDir, "post-checkout");
const postCommitHook = `#!/bin/sh

case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*)
    sleep 1 && pca _post-commit-check < /dev/tty &
    ;;
  *)
    nohup sh -c 'sleep 1 && pca _post-commit-check < /dev/tty' > /dev/null 2>&1 &
    ;;
esac
`;
const postCheckoutHook = `#!/bin/sh

PREV_HEAD="$1"
NEW_HEAD="$2"
BRANCH_CHECKOUT="$3"

if [ "$BRANCH_CHECKOUT" = "1" ]; then
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*)
      pca _branch-changed "$NEW_HEAD" > /dev/null 2>&1 &
      ;;
    *)
      nohup pca _branch-changed "$NEW_HEAD" > /dev/null 2>&1 &
      ;;
  esac
fi
`;

fs.mkdirSync(hooksDir, { recursive: true });
fs.writeFileSync(postCommitHookPath, postCommitHook, "utf8");
fs.writeFileSync(postCheckoutHookPath, postCheckoutHook, "utf8");

if (process.platform !== "win32") {
  fs.chmodSync(postCommitHookPath, 0o755);
  fs.chmodSync(postCheckoutHookPath, 0o755);
}
