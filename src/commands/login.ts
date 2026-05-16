import { Command } from "commander";
import chalk from "chalk";
import { loadAuthSession } from "../core/auth.js";
import { runBrowserLogin } from "../core/browser-auth.js";
import { getAuthBaseUrl } from "../core/config.js";

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Sign in to PCA cloud auth")
    .action(async () => {
      const existing = await loadAuthSession();
      let session = existing;

      if (!session) {
        const authBaseUrl = await getAuthBaseUrl();
        if (!authBaseUrl) {
          throw new Error(
            [
              "PCA cloud auth backend is not configured.",
              "Set it with:",
              "  pca config set auth-base-url <url>",
              "or:",
              "  PCA_AUTH_BASE_URL=<url> pca login",
              "",
              "Local offline commands remain available without PCA cloud auth.",
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

      console.log("");
      console.log(chalk.green("PCA cloud auth is ready."));
      console.log("Next:");
      console.log("  pca setup");
      console.log("");
      console.log("Optional for BYOK/OpenAI-backed commands:");
      console.log("  pca config set openai-api-key");
    });
}
