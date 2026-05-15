import path from "node:path";
import fs from "fs-extra";
import { getPCAHome } from "./config.js";

export type PCAAuthSession = {
  token: string;
  userEmail: string;
  userId?: string;
  authBaseUrl?: string;
  expiresAt?: string;
  createdAt: string;
};

export function getAuthPath(): string {
  return path.join(getPCAHome(), "auth.json");
}

export async function loadAuthSession(): Promise<PCAAuthSession | undefined> {
  const authPath = getAuthPath();
  if (!(await fs.pathExists(authPath))) {
    return undefined;
  }

  const session = (await fs.readJson(authPath)) as PCAAuthSession;
  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
    return undefined;
  }

  return session.token && session.userEmail ? session : undefined;
}

export function loadAuthSessionSync(): PCAAuthSession | undefined {
  const authPath = getAuthPath();
  if (!fs.pathExistsSync(authPath)) {
    return undefined;
  }

  const session = fs.readJsonSync(authPath) as PCAAuthSession;
  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
    return undefined;
  }

  return session.token && session.userEmail ? session : undefined;
}

export async function saveAuthSession(session: PCAAuthSession): Promise<void> {
  const authPath = getAuthPath();
  await fs.ensureDir(path.dirname(authPath));
  await fs.writeJson(authPath, session, { spaces: 2 });
  try {
    await fs.chmod(authPath, 0o600);
  } catch {
    // Best-effort only. Windows ACLs are managed by the OS/user profile.
  }
}

export async function clearAuthSession(): Promise<void> {
  await fs.remove(getAuthPath());
}

export function requireAuthSession(): PCAAuthSession {
  const session = loadAuthSessionSync();
  if (!session) {
    throw new Error(["You are not logged in.", "Run: pca login"].join("\n"));
  }

  return session;
}
