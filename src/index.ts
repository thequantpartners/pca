#!/usr/bin/env node
import { Command } from "commander";
import { registerCloseCommand } from "./commands/close.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerHelpCommand } from "./commands/help.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerVisualCommand } from "./commands/visual.js";
import { applyOpenAIKeyFlag } from "./core/config.js";

const program = new Command();

program
  .name("pca")
  .description("Persistent Context Architecture CLI")
  .version("0.1.0")
  .option("--api-key <key>", "OpenAI API key for commands that call OpenAI")
  .hook("preAction", (_thisCommand, actionCommand) => {
    const options = actionCommand.optsWithGlobals() as { apiKey?: string };
    applyOpenAIKeyFlag(options.apiKey);
  });

registerInitCommand(program);
registerSyncCommand(program);
registerQueryCommand(program);
registerTaskCommand(program);
registerVisualCommand(program);
registerCloseCommand(program);
registerLoginCommand(program);
registerConfigCommand(program);
registerDoctorCommand(program);
registerHelpCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
