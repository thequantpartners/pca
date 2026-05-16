import type { LocalProjectStatus } from "./project-status.js";

export type PCAMode = "local-only" | "byok" | "cloud" | "partial";

export type PCAReadinessInput = {
  hasAuthSession: boolean;
  hasAuthBaseUrl: boolean;
  hasOpenAIKey: boolean;
  projectState: LocalProjectStatus["state"];
  vectorStoreId?: string;
};

export type PCADerivedReadiness = {
  currentMode: PCAMode;
  projectState: LocalProjectStatus["state"];
  projectInitialized: boolean;
  projectUsesLocalOnlyVectorStore: boolean;
  projectHasCloudVectorStore: boolean;
  readiness: {
    offlineCommandsAvailable: boolean;
    offlineLocalMemoryReady: boolean;
    byokConfigured: boolean;
    cloudAuthConfigured: boolean;
    cloudSessionActive: boolean;
    cloudVectorCommandsReady: boolean;
  };
};

export function formatModeLabel(mode: PCAMode): string {
  return mode;
}

export function derivePCAReadiness(input: PCAReadinessInput): PCADerivedReadiness {
  const projectInitialized = input.projectState === "initialized";
  const projectUsesLocalOnlyVectorStore = projectInitialized && input.vectorStoreId === "local-only";
  const projectHasCloudVectorStore =
    projectInitialized && Boolean(input.vectorStoreId) && input.vectorStoreId !== "local-only";

  return {
    currentMode: deriveCurrentMode(input),
    projectState: input.projectState,
    projectInitialized,
    projectUsesLocalOnlyVectorStore,
    projectHasCloudVectorStore,
    readiness: {
      offlineCommandsAvailable: true,
      offlineLocalMemoryReady: projectInitialized,
      byokConfigured: input.hasOpenAIKey,
      cloudAuthConfigured: input.hasAuthBaseUrl,
      cloudSessionActive: input.hasAuthSession,
      cloudVectorCommandsReady: input.hasAuthSession && input.hasOpenAIKey && projectHasCloudVectorStore,
    },
  };
}

function deriveCurrentMode(input: PCAReadinessInput): PCAMode {
  const projectInitialized = input.projectState === "initialized";
  const hasVectorStoreId = Boolean(input.vectorStoreId);
  const projectUsesLocalOnlyVectorStore = projectInitialized && input.vectorStoreId === "local-only";
  const projectHasCloudVectorStore = projectInitialized && hasVectorStoreId && input.vectorStoreId !== "local-only";

  if (input.projectState === "partial") {
    return "partial";
  }

  if (input.hasAuthBaseUrl !== input.hasAuthSession) {
    return "partial";
  }

  if (projectHasCloudVectorStore && (!input.hasAuthSession || !input.hasOpenAIKey)) {
    return "partial";
  }

  if (projectInitialized && !projectUsesLocalOnlyVectorStore && !projectHasCloudVectorStore) {
    return "partial";
  }

  if (input.hasAuthSession) {
    return input.hasOpenAIKey ? "cloud" : "partial";
  }

  if (input.hasOpenAIKey) {
    return "byok";
  }

  return "local-only";
}
