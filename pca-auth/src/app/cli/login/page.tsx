import crypto from "node:crypto";
import { SignInButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { saveCliCode } from "../../../lib/cli-code-store";
import { assertSafeRedirectUri } from "../../../lib/redirect";

type LoginPageProps = {
  searchParams: Promise<{
    redirect_uri?: string;
    state?: string;
  }>;
};

export default async function CliLoginPage({ searchParams }: LoginPageProps) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return (
      <main>
        <section className="panel">
          <h1>PCA Auth is not configured</h1>
          <p>Set Clerk environment variables in Vercel before using CLI browser login.</p>
        </section>
      </main>
    );
  }

  const params = await searchParams;
  const redirectUri = params.redirect_uri;
  const state = params.state;

  if (!redirectUri || !state) {
    return (
      <main>
        <section className="panel">
          <h1>Missing login parameters</h1>
          <p>Run <code>pca login</code> from your terminal to start a valid login session.</p>
        </section>
      </main>
    );
  }

  try {
    assertSafeRedirectUri(redirectUri);
  } catch {
    return (
      <main>
        <section className="panel">
          <h1>Invalid redirect URI</h1>
          <p>PCA CLI login only allows localhost callback URLs.</p>
        </section>
      </main>
    );
  }

  const user = await currentUser();
  const currentUrl = `/cli/login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  if (!user) {
    return (
      <main>
        <section className="panel">
          <h1>Sign in to PCA</h1>
          <p>Use your Google account to finish CLI authentication.</p>
          <SignInButton mode="redirect" forceRedirectUrl={currentUrl}>
            <button type="button">Continue with Google</button>
          </SignInButton>
        </section>
      </main>
    );
  }

  const code = crypto.randomBytes(32).toString("base64url");
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

  if (!email) {
    return (
      <main>
        <section className="panel">
          <h1>Email required</h1>
          <p>Your PCA account needs a verified email address.</p>
        </section>
      </main>
    );
  }

  await saveCliCode(code, {
    userEmail: email,
    userId: user.id,
    state,
  });

  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", state);
  redirect(callback.toString());
}
