import fs from "fs-extra";
import { loadAuthSession } from "./auth.js";
import { getAuthBaseUrl, getConfigPath, type PCAProjectConfig } from "./config.js";
import { getOpenAIKey } from "./secrets.js";
import { getLocalProjectStatus } from "./project-status.js";
import { derivePCAReadiness, type PCADerivedReadiness } from "./readiness.js";

export async function loadDerivedReadiness(root: string): Promise<PCADerivedReadiness> {
  const [session, authBaseUrl, openAIKey, projectStatus, projectConfig] = await Promise.all([
    loadAuthSession(),
    getAuthBaseUrl(),
    getOpenAIKey(),
    getLocalProjectStatus(root),
    readProjectConfigSafely(getConfigPath(root)),
  ]);

  return derivePCAReadiness({
    hasAuthSession: Boolean(session),
    hasAuthBaseUrl: Boolean(authBaseUrl),
    hasOpenAIKey: Boolean(openAIKey),
    projectState: projectStatus.state,
    vectorStoreId: projectConfig?.vectorStoreId,
  });
}

export async function readProjectConfigSafely(configPath: string): Promise<Partial<PCAProjectConfig> | undefined> {
  try {
    if (!(await fs.pathExists(configPath))) {
      return undefined;
    }

    return (await fs.readJson(configPath)) as Partial<PCAProjectConfig>;
  } catch {
    return undefined;
  }
}
