import crypto from "node:crypto";
import { Command } from "commander";
import chalk from "chalk";
import {
  allowedContextCommitTypes,
  isContextCommitType,
  type ContextCommitType,
} from "../core/context-commits.js";
import {
  clearStagedCommits,
  confirmStagedCommits,
  dropStagedCommit,
  getCurrentBranch,
  getStagedCommits,
  initDB,
  recordCommit,
  upsertBranch,
} from "../core/db.js";
import { getProjectRoot } from "../core/config.js";
import { getLocalProjectStatus, requireInitializedLocalProject } from "../core/project-status.js";

export function registerStagedCommand(program: Command): void {
  const staged = program.command("staged").description("Manage staged PCA context commits");

  staged
    .command("add")
    .description("Add a context commit to staging")
    .argument("<message>", "Context commit message")
    .requiredOption("--type <type>", "decision | feature | bugfix | architecture | product | general")
    .action(async (message: string, options: { type: string }) => {
      await requireProject();
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        throw new Error("Commit message cannot be empty.");
      }

      const type = options.type.trim();
      if (!isContextCommitType(type)) {
        throw new Error(`Invalid --type: ${type}. Allowed values: ${allowedContextCommitTypes()}.`);
      }

      initDB();
      const branch = getCurrentBranch();
      upsertBranch(branch);
      recordCommit({
        id: createCommitId(),
        branch,
        gitHash: "",
        message: trimmedMessage,
        type: type as ContextCommitType,
        timestamp: new Date().toISOString(),
        ynPending: 0,
        ynResponse: null,
        status: "staged",
      });

      console.log(chalk.green("PCA context commit staged."));
      console.log(`Type: ${type}`);
      console.log(`Message: ${trimmedMessage}`);
    });

  staged
    .command("list")
    .description("List staged context commits")
    .action(() => {
      initDB();
      const commits = getStagedCommits();
      if (!commits.length) {
        console.log("No staged context commits.");
        return;
      }

      for (const [index, commit] of commits.entries()) {
        console.log(`${index + 1}. [${commit.type}] ${commit.message}`);
      }
    });

  staged
    .command("commit")
    .description("Confirm all staged context commits")
    .action(() => {
      initDB();
      const confirmed = confirmStagedCommits();
      console.log(`${confirmed} staged ${confirmed === 1 ? "commit" : "commits"} confirmed.`);
    });

  staged
    .command("drop")
    .description("Drop one staged context commit by index")
    .argument("<index>", "Staged commit index")
    .action((index: string) => {
      initDB();
      const commit = stagedCommitAtIndex(index);
      dropStagedCommit(commit.id);
      console.log("Staged commit dropped.");
    });

  staged
    .command("clear")
    .description("Drop all staged context commits")
    .action(() => {
      initDB();
      const cleared = clearStagedCommits();
      console.log(`${cleared} staged ${cleared === 1 ? "commit" : "commits"} cleared.`);
    });
}

async function requireProject(): Promise<void> {
  requireInitializedLocalProject(await getLocalProjectStatus(getProjectRoot()));
}

function stagedCommitAtIndex(rawIndex: string): ReturnType<typeof getStagedCommits>[number] {
  const index = Number.parseInt(rawIndex, 10);
  const commits = getStagedCommits();
  if (index === 0) {
    throw new Error("Index starts at 1. Use 'pca staged list' to see valid indexes.");
  }
  if (!Number.isInteger(index) || index < 1 || index > commits.length) {
    throw new Error(`Invalid staged commit index. Use 'pca staged list' to see valid indexes (1–${commits.length}).`);
  }

  return commits[index - 1];
}

function createCommitId(): string {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    String(date.getUTCSeconds()).padStart(2, "0"),
  ].join("");

  return `${stamp}-${crypto.randomBytes(4).toString("hex")}`;
}
