import path from "node:path";
import fs from "fs-extra";
import { getConfigPath } from "./config.js";

export type LocalProjectStatus = {
  hasIndex: boolean;
  hasAgents: boolean;
  hasProjectConfig: boolean;
  hasPcaFolder: boolean;
  state: "initialized" | "partial" | "not-initialized";
};

export async function getLocalProjectStatus(root: string): Promise<LocalProjectStatus> {
  const hasIndex = await fs.pathExists(path.join(root, "PCA_INDEX.md"));
  const hasAgents = await fs.pathExists(path.join(root, "AGENTS.md"));
  const hasProjectConfig = await fs.pathExists(getConfigPath(root));
  const hasPcaFolder = await fs.pathExists(path.join(root, "pca"));
  const checks = [hasIndex, hasAgents, hasProjectConfig, hasPcaFolder];

  return {
    hasIndex,
    hasAgents,
    hasProjectConfig,
    hasPcaFolder,
    state: checks.every(Boolean) ? "initialized" : checks.some(Boolean) ? "partial" : "not-initialized",
  };
}

export function requireInitializedLocalProject(status: LocalProjectStatus): void {
  if (status.state === "initialized") {
    return;
  }

  throw new Error(
    [
      status.state === "partial" ? "PCA project is partially initialized." : "PCA project is not initialized.",
      "Run `pca init` before recording context commits.",
    ].join("\n"),
  );
}
