#!/usr/bin/env node
import { Command } from "commander";
import { registerAuditCommand } from "./commands/audit.js";
import { registerBranchChangedCommand } from "./commands/branch-changed.js";
import { registerBootstrapCommand } from "./commands/bootstrap.js";
import { registerCloseCommand } from "./commands/close.js";
import { registerCommitCommand } from "./commands/commit.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerContextCommand } from "./commands/context.js";
import { registerDiffCommand } from "./commands/diff.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerForgetCommand } from "./commands/forget.js";
import { registerHealthCommand } from "./commands/health.js";
import { registerHelpCommand } from "./commands/help.js";
import { registerInitCommand } from "./commands/init.js";
import { registerInstallHooksCommand } from "./commands/install-hooks.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { registerLogsCommand } from "./commands/logs.js";
import { registerMCPCommand } from "./commands/mcp.js";
import { registerPostCommitRecordCommand } from "./commands/post-commit-record.js";
import { registerPostMergeCommand } from "./commands/post-merge.js";
import { registerPostRewriteCommand } from "./commands/post-rewrite.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerRecoveryCommand } from "./commands/recovery.js";
import { registerSetupCommand } from "./commands/setup.js";
import { registerStagedCommand } from "./commands/staged.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerVisualCommand } from "./commands/visual.js";
import { registerWhoamiCommand } from "./commands/whoami.js";
import { printBanner } from "./core/banner.js";
import { applyOpenAIKeyFlag, getProjectRoot } from "./core/config.js";
import { printPCAAdvice } from "./core/pca-advice.js";
import { PCA_VERSION } from "./core/version.js";

const program = new Command();

program
  .name("pca")
  .description("Persistent Context Architecture CLI")
  .version(PCA_VERSION)
  .option("--api-key <key>", "OpenAI API key for commands that call OpenAI")
  .hook("preAction", (_thisCommand, actionCommand) => {
    const options = actionCommand.optsWithGlobals() as { apiKey?: string };
    applyOpenAIKeyFlag(options.apiKey);
  })
  .hook("postAction", async (_thisCommand, actionCommand) => {
    if (shouldSkipPCAAdvice(actionCommand)) {
      return;
    }

    await printPCAAdvice(getProjectRoot());
  });

registerInitCommand(program);
registerInstallHooksCommand(program);
registerAuditCommand(program);
registerBootstrapCommand(program);
registerStatusCommand(program);
registerHealthCommand(program);
registerDiffCommand(program);
registerForgetCommand(program);
registerRecoveryCommand(program);
registerCommitCommand(program);
registerLogsCommand(program);
registerStagedCommand(program);
registerContextCommand(program);
registerSyncCommand(program);
registerQueryCommand(program);
registerTaskCommand(program);
registerVisualCommand(program);
registerCloseCommand(program);
registerLoginCommand(program);
registerLogoutCommand(program);
registerWhoamiCommand(program);
registerSetupCommand(program);
registerConfigCommand(program);
registerDoctorCommand(program);
registerMCPCommand(program);
registerBranchChangedCommand(program);
registerPostCommitRecordCommand(program);
registerPostMergeCommand(program);
registerPostRewriteCommand(program);
registerHelpCommand(program);

function shouldSkipPCAAdvice(actionCommand: Command): boolean {
  const excludedCommands = new Set([
    "health",
    "doctor",
    "login",
    "logout",
    "whoami",
    "config",
    "context",
    "staged",
    "install-hooks",
    "forget",
    "recovery",
    "mcp",
    "audit",
    "_branch-changed",
    "_post-commit-record",
    "_post-merge",
    "_post-rewrite",
  ]);
  let current: Command | null = actionCommand;

  while (current) {
    if (excludedCommands.has(current.name())) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

async function main(): Promise<void> {
  if (process.argv.length <= 2) {
    printBanner();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
