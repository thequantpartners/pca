import { Command } from "commander";
import chalk from "chalk";
import {
  forgetCommit,
  getCommits,
  getCurrentBranch,
  initDB,
  upsertBranch,
  type CommitRecord,
} from "../core/db.js";
import { promptText } from "../core/prompt.js";

export function registerForgetCommand(program: Command): void {
  program
    .command("forget")
    .description("Deprecate a context commit")
    .argument("[id]", "Context commit id")
    .action(async (id: string | undefined) => {
      initDB();
      const branch = getCurrentBranch();
      upsertBranch(branch);

      const commits = getCommits(true);
      const activeCommits = commits.filter((commit) => commit.status === "active");
      const commit = id ? findCommitById(commits, id) : await chooseCommit(activeCommits);

      if (!commit) {
        return;
      }

      if (commit.status !== "active") {
        throw new Error(`Commit ${commit.id} is already deprecated.`);
      }

      const confirmed = await confirmAction(`Forget '${commit.message}'? (Y/N) `);
      if (!confirmed) {
        console.log("Forget cancelled.");
        return;
      }

      forgetCommit(commit.id);
      console.log(chalk.green("✓ Commit marked as deprecated."));
    });
}

function findCommitById(commits: CommitRecord[], id: string): CommitRecord {
  const commit = commits.find((entry) => entry.id === id);
  if (!commit) {
    throw new Error(`Commit not found: ${id}`);
  }

  return commit;
}

async function chooseCommit(commits: CommitRecord[]): Promise<CommitRecord | undefined> {
  if (!commits.length) {
    console.log("No active commits to forget.");
    return undefined;
  }

  for (const [index, commit] of commits.entries()) {
    console.log(
      `${index + 1}. [${formatShortId(commit.id)}] ${commit.message} — ${commit.branch} — ${formatDateTime(commit.timestamp)}`,
    );
  }

  const raw = (await promptText("Selecciona número: ")).trim();
  if (!raw) {
    console.log("Cancelled.");
    process.exitCode = 0;
    process.exit(0);
  }
  const selected = Number.parseInt(raw, 10);
  if (!Number.isInteger(selected) || selected < 1 || selected > commits.length) {
    throw new Error("Invalid commit selection.");
  }

  return commits[selected - 1];
}

async function confirmAction(question: string): Promise<boolean> {
  const answer = (await promptText(question)).trim().toLowerCase();
  return answer === "" || answer === "y" || answer === "yes";
}

function formatShortId(id: string): string {
  return id.slice(0, 8);
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
