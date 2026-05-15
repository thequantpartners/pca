import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { consumeCliCode } from "../../../../lib/cli-code-store";
import { assertSafeRedirectUri } from "../../../../lib/redirect";

type SessionRequest = {
  code?: string;
  state?: string;
  redirectUri?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SessionRequest;
  const code = body.code?.trim();
  const state = body.state?.trim();
  const redirectUri = body.redirectUri?.trim();

  if (!code || !state || !redirectUri) {
    return NextResponse.json({ error: "Missing code, state, or redirectUri." }, { status: 400 });
  }

  try {
    assertSafeRedirectUri(redirectUri);
  } catch {
    return NextResponse.json({ error: "Invalid redirectUri." }, { status: 400 });
  }

  const payload = await consumeCliCode(code);
  if (!payload || payload.state !== state) {
    return NextResponse.json({ error: "Invalid or expired login code." }, { status: 401 });
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const token = signCliSession({
    userEmail: payload.userEmail,
    userId: payload.userId,
    expiresAt,
  });

  return NextResponse.json({
    token,
    userEmail: payload.userEmail,
    userId: payload.userId,
    expiresAt,
  });
}

function signCliSession(payload: { userEmail: string; userId: string; expiresAt: string }): string {
  const secret = process.env.PCA_CLI_SESSION_SECRET;
  if (!secret) {
    throw new Error("PCA_CLI_SESSION_SECRET is not configured.");
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
