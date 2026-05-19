#!/usr/bin/env node
import { Command } from "commander";
import { registerBootstrapCommand } from "./commands/bootstrap.js";
import { registerCloseCommand } from "./commands/close.js";
import { registerCommitCommand } from "./commands/commit.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerHelpCommand } from "./commands/help.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { registerLogsCommand } from "./commands/logs.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerSetupCommand } from "./commands/setup.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerVisualCommand } from "./commands/visual.js";
import { registerWhoamiCommand } from "./commands/whoami.js";
import { printBanner } from "./core/banner.js";
import { applyOpenAIKeyFlag } from "./core/config.js";
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
  });

registerInitCommand(program);
registerBootstrapCommand(program);
registerStatusCommand(program);
registerCommitCommand(program);
registerLogsCommand(program);
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
registerHelpCommand(program);

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
