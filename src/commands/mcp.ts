import { Command } from "commander";
import { startMCPServer } from "../mcp/server.js";

export function registerMCPCommand(program: Command): void {
  program
    .command("mcp")
    .description("Start PCA as an MCP server for Claude Code, Codex, or Cursor")
    .action(async () => {
      await startMCPServer();
    });
}
