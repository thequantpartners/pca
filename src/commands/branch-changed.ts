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

export function registerBranchChangedCommand(program: Command): void {
  program
    .command("_branch-changed", { hidden: true })
    .argument("[newHead]", "New checkout ref")
    .option("--deleted-branch <branch>", "Deleted branch name")
    .action(async (_newHead: string | undefined, options: { deletedBranch?: string }) => {
      try {
        initDB();
        const branch = getCurrentBranch();
        upsertBranch(branch);
        if (!options.deletedBranch) {
          console.log(`PCA context switched to ${branch}`);
        }
        await promptForDeletedBranches(branch, options.deletedBranch);
      } catch {
        // Internal hook command: branch awareness must never surface errors to Git.
      }
    });
}

async function promptForDeletedBranches(currentBranch: string, preferredBranch?: string): Promise<void> {
  const deletedBranches = getKnownBranches().filter(
    (branch) => branch !== currentBranch && !gitBranchExists(branch),
  );
  const orderedBranches =
    preferredBranch && deletedBranches.includes(preferredBranch)
      ? [preferredBranch, ...deletedBranches.filter((branch) => branch !== preferredBranch)]
      : deletedBranches;

  for (const branch of orderedBranches) {
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
