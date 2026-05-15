import { Command } from "commander";
import { getProjectRoot } from "../core/config.js";
import { buildQueryOutput } from "../core/prompt-builder.js";
import { retrieveContext } from "../core/retrieval.js";

export function registerQueryCommand(program: Command): void {
  program
    .command("query")
    .description("Search PCA context through OpenAI Vector Store")
    .argument("<query>", "Search query")
    .option("--limit <number>", "Maximum results", "5")
    .option("--api-key <key>", "OpenAI API key for this command")
    .action(async (query: string, options: { limit: string }) => {
      const limit = parseLimit(options.limit);
      const root = getProjectRoot();
      const results = await retrieveContext({ root, query, limit });
      console.log(buildQueryOutput(query, results));
    });
}

function parseLimit(value: string): number {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Invalid --limit. Use an integer between 1 and 20.");
  }

  return limit;
}
