export function assertSafeRedirectUri(value: string): void {
  const url = new URL(value);

  if (url.protocol !== "http:") {
    throw new Error("Only http localhost redirects are allowed.");
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("Only localhost redirects are allowed.");
  }

  if (url.pathname !== "/callback") {
    throw new Error("Callback path must be /callback.");
  }
}
