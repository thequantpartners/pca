import { Command } from "commander";
import chalk from "chalk";
import { getGlobalConfigPath } from "../core/config.js";
import { loadAuthSession } from "../core/auth.js";
import { getOpenAIKey } from "../core/secrets.js";
import { validateOpenAIKey } from "../core/openai-key.js";

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("Show PCA account and credential status")
    .action(async () => {
      const session = await loadAuthSession();
      const key = await getOpenAIKey();
      const keyStatus = key ? await validateOpenAIKey(key) : undefined;

      console.log(`PCA account: ${session?.userEmail ?? chalk.yellow("not logged in")}`);
      console.log(
        `OpenAI API key: ${
          !key ? chalk.yellow("missing") : keyStatus?.ok ? chalk.green("configured") : chalk.red("invalid")
        }`,
      );
      console.log(`PCA global config: ${chalk.green("OK")}`);
      console.log(`Global config path: ${getGlobalConfigPath()}`);
    });
}
