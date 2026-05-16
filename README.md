# PCA CLI

PCA = Persistent Context Architecture.

Markdown files are the source of truth. RAG is the mandatory access layer. Agents must not read the full `pca/` folder by default.

## Install

```bash
npm install -g @quantpartners/pca
pca help
```

## Onboarding

Recommended fresh-machine flow:

```bash
pca login
```

`pca login` is designed to:

1. Open a browser login flow for PCA.
2. Complete Clerk Google login through a hosted PCA backend.
3. Store the PCA CLI auth session in `~/.pca/auth.json`.
4. Ask for an OpenAI API key when needed.
5. Validate the key against OpenAI.
6. Store the key in global PCA credentials.

The CLI does not include Clerk secrets. A hosted PCA backend must provide the browser login and code exchange. Configure it with:

```bash
pca config set auth-base-url https://your-pca-auth-host.example
```

or:

```bash
PCA_AUTH_BASE_URL=https://your-pca-auth-host.example pca login
```

## Global Storage

PCA stores user-level configuration under:

```txt
~/.pca/
  auth.json
  config.json
  secrets.json
```

Project `.pca/config.json` stores only project data:

```json
{
  "projectName": "...",
  "projectSlug": "...",
  "vectorStoreId": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Secrets are never stored in project files.

## Local Context Memory

These commands are fully local and work offline. They do not require PCA auth, OpenAI API keys, Clerk, network access, or Vector Store access.

`pca init` also works offline without PCA auth, an OpenAI API key, Clerk, a hosted backend, or network access. In offline mode it creates a local-only PCA project, and `.pca/config.json` uses `vectorStoreId: "local-only"` until cloud/vector credentials are available. Vector Store creation only happens when PCA auth and OpenAI credentials are configured.

```bash
pca status
pca commit "Documented checkout flow decision" --type decision
pca commit "Updated onboarding context"
pca logs
pca logs --last 10
pca logs --type decision
```

Context commits are stored in:

```txt
.pca/context-commits.json
```

## Commands

```bash
pca help
pca doctor
pca login
pca logout
pca whoami
pca setup
pca config
pca status
pca commit "record local context update"
pca commit "ADR: keep Markdown as source of truth" --type decision
pca logs
pca logs --last 10
pca logs --type decision
pca init
pca sync
pca query "project architecture"
pca task "crear hero mobile"
pca visual add ./example.png --type reference --note "landing reference"
pca close
```

## OpenAI API Key

Use:

```bash
pca setup
```

or as part of:

```bash
pca login
```

`pca setup` validates the key with real OpenAI API calls before saving it. Existing project `.env` files are only used for explicit migration:

```txt
Found OPENAI_API_KEY in project .env.
Move it to PCA global credentials? y/N
```

PCA never deletes `.env` automatically.

## Typical Flow

```bash
pca login
pca init
pca sync
pca task "crear hero mobile"
# paste .pca/last-task-context.md into Codex
pca close
pca sync
```

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
node dist/index.js help
node dist/index.js doctor
```

Windows PowerShell may block npm `.ps1` shims depending on ExecutionPolicy. Use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
node dist\index.js help
node dist\index.js doctor
```

Local global install:

```bash
npm link
pca help
```

Windows CLI note:

- PowerShell may block npm `.ps1` shims depending on ExecutionPolicy. Use `pca.cmd help`.
- CMD can use `pca help`.

## Publish

```bash
npm run build
npm pack --dry-run
npm publish --access public
```

Do not publish until build and local install tests pass.

## Limitations

- The Clerk browser login requires a hosted PCA backend. The CLI implements the callback/exchange pattern but does not ship backend secrets.
- OpenAI API keys are stored in `~/.pca/secrets.json` as the current fallback. OS keychain integration is a future upgrade.
- No web dashboard yet.
- No billing.
- No multiuser project sharing.
- No advanced Vector Store deduplication/replacement yet.
- Visual memory stores local images plus textual metadata in `pca/visual/visual-index.md`; real multimodal analysis comes in v2.

## References

- Clerk custom OAuth flows: https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections
- OpenAI models list endpoint: https://platform.openai.com/docs/api-reference/models/list
