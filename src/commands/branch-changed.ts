import { Command } from "commander";
import { getCurrentBranch, initDB, upsertBranch } from "../core/db.js";

export function registerBranchChangedCommand(program: Command): void {
  program
    .command("_branch-changed", { hidden: true })
    .argument("[newHead]", "New checkout ref")
    .action(() => {
      try {
        initDB();
        upsertBranch(getCurrentBranch());
      } catch {
        // Internal hook command: branch awareness must never surface errors to Git.
      }
    });
}
