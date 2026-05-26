import { execFileSync } from "node:child_process";
import { Command } from "commander";
import {
  archiveBranchContext,
  getCurrentBranch,
  getKnownBranches,
  initDB,
  upsertBranch,
} from "../core/db.js";
import { promptText } from "../core/prompt.js";

export function registerPostRewriteCommand(program: Command): void {
  program.command("_post-rewrite", { hidden: true }).action(async () => {
    try {
      initDB();
      const currentBranch = getCurrentBranch();
      upsertBranch(currentBranch);
      await promptForDeletedBranches(currentBranch);
    } catch {
      // Internal hook command: never break Git rewrite completion.
    }
  });
}

async function promptForDeletedBranches(currentBranch: string): Promise<void> {
  for (const branch of getKnownBranches()) {
    if (branch === currentBranch || gitBranchExists(branch)) {
      continue;
    }

    const answer = (await promptText(`Branch ${branch} was deleted. Archive its context? [y/n] `)).trim().toLowerCase();
    if (answer === "y" || answer === "yes") {
      archiveBranchContext(branch);
      console.log(`PCA context archived for ${branch}`);
    }
  }
}

function gitBranchExists(branch: string): boolean {
  try {
    execFileSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}
