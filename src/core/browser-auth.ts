import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import { getAuthBaseUrl } from "./config.js";
import { saveAuthSession, type PCAAuthSession } from "./auth.js";

export async function runBrowserLogin(): Promise<PCAAuthSession> {
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

  const state = crypto.randomBytes(24).toString("hex");
  const result = await listenForCallback(authBaseUrl, state);
  await saveAuthSession(result);
  return result;
}

async function listenForCallback(authBaseUrl: string, state: string): Promise<PCAAuthSession> {
  let server: http.Server | undefined;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server?.close();
      reject(new Error("Login timed out. Run `pca login` again."));
    }, 5 * 60 * 1000);

    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
        if (url.pathname !== "/callback") {
          res.writeHead(404).end("Not found");
          return;
        }

        if (url.searchParams.get("state") !== state) {
          res.writeHead(400).end("Invalid state. Return to the terminal and run pca login again.");
          return;
        }

        const error = url.searchParams.get("error");
        if (error) {
          throw new Error(error);
        }

        const redirectUri = `http://${req.headers.host}/callback`;
        const session = await sessionFromCallback(authBaseUrl, url, state, redirectUri);
        res.writeHead(200, { "content-type": "text/html" }).end(successHtml());
        clearTimeout(timeout);
        server?.close();
        resolve(session);
      } catch (error) {
        clearTimeout(timeout);
        server?.close();
        const message = error instanceof Error ? error.message : String(error);
        res.writeHead(500).end(message);
        reject(error);
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server?.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not start local login callback server."));
        return;
      }

      const redirectUri = `http://localhost:${address.port}/callback`;
      const loginUrl = new URL("/cli/login", authBaseUrl);
      loginUrl.searchParams.set("redirect_uri", redirectUri);
      loginUrl.searchParams.set("state", state);
      openBrowser(loginUrl.toString());
    });
  });
}

async function sessionFromCallback(
  authBaseUrl: string,
  url: URL,
  state: string,
  redirectUri: string,
): Promise<PCAAuthSession> {
  const token = url.searchParams.get("token") ?? url.searchParams.get("session_token");
  const userEmail = url.searchParams.get("email") ?? url.searchParams.get("user_email");
  const userId = url.searchParams.get("user_id") ?? undefined;
  const expiresAt = url.searchParams.get("expires_at") ?? undefined;

  if (token && userEmail) {
    return {
      token,
      userEmail,
      userId,
      authBaseUrl,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
  }

  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error("Login callback did not include a code or session token.");
  }

  const response = await fetch(new URL("/api/cli/session", authBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, state, redirectUri }),
  });

  if (!response.ok) {
    throw new Error(`Login exchange failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    token?: string;
    sessionToken?: string;
    userEmail?: string;
    email?: string;
    userId?: string;
    expiresAt?: string;
  };

  const exchangedToken = payload.token ?? payload.sessionToken;
  const exchangedEmail = payload.userEmail ?? payload.email;
  if (!exchangedToken || !exchangedEmail) {
    throw new Error("Login exchange response was missing token or user email.");
  }

  return {
    token: exchangedToken,
    userEmail: exchangedEmail,
    userId: payload.userId,
    authBaseUrl,
    expiresAt: payload.expiresAt,
    createdAt: new Date().toISOString(),
  };
}

function openBrowser(url: string): void {
  const command =
    process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function successHtml(): string {
  return `<!doctype html><html><body><h1>PCA login successful</h1><p>You can close this tab and return to the terminal.</p></body></html>`;
}
