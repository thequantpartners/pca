import { Command } from "commander";
import chalk from "chalk";
import { loadAuthSession } from "../core/auth.js";
import { runBrowserLogin } from "../core/browser-auth.js";
import { getAuthBaseUrl } from "../core/config.js";
import { getMaskedOpenAIKey } from "../core/secrets.js";
import { runOpenAISetup } from "./setup.js";

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Sign in to PCA and complete OpenAI API key onboarding")
    .action(async () => {
      const existing = await loadAuthSession();
      let session = existing;

      if (!session) {
        const authBaseUrl = await getAuthBaseUrl();
        if (!authBaseUrl) {
          throw new Error(
            [
              "PCA auth backend is not configured.",
              "Set it with:",
              "  pca config set auth-base-url <url>",
              "or:",
              "  PCA_AUTH_BASE_URL=<url> pca login",
              "",
              "The CLI cannot complete Clerk login without a hosted PCA backend.",
            ].join("\n"),
          );
        }
        console.log("Opening browser for PCA login...");
        console.log("Waiting for authentication...");
        session = await runBrowserLogin();
        console.log(chalk.green(`Login successful: ${session.userEmail}`));
      } else {
        console.log(chalk.green(`Already logged in: ${session.userEmail}`));
      }

      const currentKey = await getMaskedOpenAIKey();
      if (!currentKey) {
        console.log("");
        console.log("OpenAI API key not configured.");
        await runOpenAISetup();
      }

      console.log("");
      console.log(chalk.green("PCA is ready."));
      console.log("Next:");
      console.log("  pca init");
    });
}
