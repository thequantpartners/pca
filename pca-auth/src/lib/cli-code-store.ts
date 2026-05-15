import { Redis } from "@upstash/redis";

const CODE_TTL_SECONDS = 5 * 60;

export type CliCodePayload = {
  userEmail: string;
  userId: string;
  state: string;
};

function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Upstash Redis is not configured.");
  }

  return new Redis({ url, token });
}

export async function saveCliCode(code: string, payload: CliCodePayload): Promise<void> {
  await redis().set(key(code), payload, { ex: CODE_TTL_SECONDS });
}

export async function consumeCliCode(code: string): Promise<CliCodePayload | null> {
  const client = redis();
  const storageKey = key(code);
  const payload = await client.get<CliCodePayload>(storageKey);

  if (payload) {
    await client.del(storageKey);
  }

  return payload;
}

function key(code: string): string {
  return `pca:cli-login:${code}`;
}
