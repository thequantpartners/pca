# PCA Auth Backend

Hosted browser authentication bridge for the PCA CLI.

## Flow

```txt
pca login
→ CLI starts localhost callback server
→ CLI opens /cli/login?redirect_uri=http://localhost:<port>/callback&state=...
→ Clerk Google login
→ Backend stores one-time code in Redis
→ Browser redirects to localhost callback
→ CLI exchanges code at /api/cli/session
→ CLI stores ~/.pca/auth.json
```

## Environment

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
PCA_CLI_SESSION_SECRET=
```

Generate the session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Local

```bash
npm install
npm run build
```

## Deploy

```bash
vercel
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add PCA_CLI_SESSION_SECRET
vercel --prod
```

Then configure the CLI:

```bash
pca config set auth-base-url https://your-vercel-domain.vercel.app
pca login
```
