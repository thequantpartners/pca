import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { promptText } from "./prompt.js";

export const postCommitHook = `#!/bin/sh
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*)
    sleep 1 && pca _post-commit-check &
    ;;
  *)
    if [ -e /dev/tty ] && [ -r /dev/tty ] && [ -w /dev/tty ]; then
      nohup sh -c 'sleep 1 && pca _post-commit-check < /dev/tty' > /dev/null 2>&1 &
    else
      nohup sh -c 'sleep 1 && pca _post-commit-check' > /dev/null 2>&1 &
    fi
    ;;
esac
`;

export const postCheckoutHook = `#!/bin/sh

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

export type InstallGitHooksOptions = {
  overwriteExisting?: boolean;
  requireGitDirectory?: boolean;
};

export async function installGitHooks(root: string, options: InstallGitHooksOptions = {}): Promise<void> {
  const gitDir = path.join(root, ".git");
  const hasGitDirectory = await fs
    .stat(gitDir)
    .then((stats) => stats.isDirectory())
    .catch(() => false);

  if (!hasGitDirectory) {
    const message = "Git repository not found. Run this command from a Git repository root.";

    if (options.requireGitDirectory) {
      throw new Error(chalk.red(message));
    }

    console.warn(chalk.yellow("Git hooks directory not found. Skipping git hook installation."));
    return;
  }

  const hooksDir = path.join(gitDir, "hooks");
  await fs.ensureDir(hooksDir);

  const hooks = [
    { name: "post-commit", content: postCommitHook },
    { name: "post-checkout", content: postCheckoutHook },
  ];

  for (const hook of hooks) {
    const hookPath = path.join(hooksDir, hook.name);
    const relativeHookPath = `.git/hooks/${hook.name}`;

    if (!options.overwriteExisting && (await fs.pathExists(hookPath))) {
      const answer = (await promptText(chalk.cyan(`${hook.name} hook exists. Overwrite? (y/n) `))).trim().toLowerCase();
      if (answer !== "y" && answer !== "yes") {
        console.log(chalk.yellow(`Skipped ${relativeHookPath} installation.`));
        continue;
      }
    }

    try {
      await fs.writeFile(hookPath, hook.content, "utf8");

      if (process.platform !== "win32") {
        await fs.chmod(hookPath, 0o755);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(chalk.yellow(`Failed to install ${relativeHookPath}: ${message}`));
      continue;
    }

    console.log(chalk.green(`Git hook installed: ${relativeHookPath}`));
  }

  console.log("Git hooks enabled: PCA checks commits and branch changes asynchronously");
}
