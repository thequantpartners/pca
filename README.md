# PCA CLI

PCA = Persistent Context Architecture.

Markdown files are the source of truth. RAG is the mandatory access layer. Agents must not read the full `pca/` folder by default.

## Install

```bash
npm install -g @quantpartners/pca
pca help
```

### Windows PowerShell

On Windows PowerShell, `pca` may resolve to `pca.ps1` and be blocked by
ExecutionPolicy. If that happens, use the npm command shim instead:

```powershell
pca.cmd --version
pca.cmd setup --mode local-only
pca.cmd init
```

## Onboarding

Start with:

```bash
pca setup
```

`pca setup` is the primary onboarding command for PCA CLI 0.3.0. It supports:

- `local-only`: offline local Markdown memory
- `byok`: your own OpenAI API key for current OpenAI-backed/vector commands
- `cloud`: PCA account/cloud sync layer

### Interactive setup

```bash
pca setup
```

The guided flow detects current state and recommends the smallest useful next step.

### Non-interactive setup

```bash
pca setup --mode local-only
pca setup --mode byok --api-key <key>
pca setup --mode cloud
```

## Modes

### Local-only

`local-only` requires no PCA auth, no OpenAI key, no backend, and no network access.

Offline local commands:

```bash
pca init
pca status
pca commit "Documented checkout flow decision" --type decision
pca logs
```

### BYOK

`byok` configures a user-provided OpenAI API key for current OpenAI-backed/vector commands.

```bash
pca setup --mode byok --api-key <key>
```

`pca setup` validates the key before storing it globally. Existing project `.env` files can still be used as a source for BYOK setup.

### Cloud

`cloud` is the PCA account/cloud sync layer. It is not defined as a permanent requirement for user-owned OpenAI keys.

Cloud setup:

```bash
pca setup --mode cloud
```

If cloud auth is configured, continue with:

```bash
pca login
```

For current OpenAI-backed/vector commands, you may still need BYOK today:

```bash
pca config set openai-api-key
```

## Auth and Credentials

- Local memory commands do not require PCA auth or OpenAI.
- `pca login` is auth-only. It opens the PCA browser login flow and stores the PCA auth session in `~/.pca/auth.json`.
- `pca logout` clears PCA auth only by default.
- OpenAI/BYOK credentials are stored separately from PCA auth.

Cloud auth requires a hosted PCA backend. Configure it with:

```bash
pca config set auth-base-url https://your-pca-auth-host.example
```

or:

```bash
PCA_AUTH_BASE_URL=https://your-pca-auth-host.example pca login
```

The CLI does not include Clerk secrets and does not ship backend auth services.

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

## Command Notes

### `pca setup`

- Primary onboarding command
- Supports interactive and non-interactive setup
- Handles local-only, BYOK, and cloud guidance

### `pca login`

- Auth-only
- Requires `auth-base-url`
- Does not prompt for or validate an OpenAI key

### `pca logout`

- Clears PCA auth only by default
- Use `pca logout --clear-openai-key` to remove stored BYOK credentials too

### `pca whoami`

- Shows derived mode
- Shows offline, BYOK, and cloud readiness separately

### `pca doctor`

- Diagnoses project, auth, and credential state
- Suggests next steps without treating cloud auth as a blocker for local mode

### `pca config`

- Default summary shows derived mode and readiness
- `get/set/clear` behavior remains:
  - `openai-api-key`
  - `auth-base-url`

## Typical Flows

### Local-only

```bash
pca setup --mode local-only
pca init
pca commit "initial context snapshot"
pca logs
```

### BYOK

```bash
pca setup --mode byok --api-key <key>
pca init
pca status
```

### Cloud

```bash
pca setup --mode cloud
pca login
pca config set openai-api-key
pca init
pca sync
pca task "crear hero mobile"
```

## Commands

```bash
pca help
pca setup
pca doctor
pca login
pca logout
pca whoami
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

Do not publish until build, tests, and local install checks pass.

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
