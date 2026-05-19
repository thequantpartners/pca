# Codebase Snapshot

## Directory tree, 2 levels deep

```txt
dist/
  commands/
  core/
  templates/
  index.d.ts
  index.js
  index.js.map
pca-auth/
  .next/
  .vercel/
  src/
  .env.example
  .gitignore
  middleware.ts
  next-env.d.ts
  next.config.ts
  package-lock.json
  package.json
  README.md
  tsconfig.json
scripts/
  clean-dist.js
src/
  commands/
  core/
  templates/
  index.ts
tests/
  cli.test.mjs
.env.example
.gitignore
CODEBASE_SNAPSHOT.md
ESTADO_ACTUAL.md
package-lock.json
package.json
README.md
tsconfig.json
```

=== FILE: src/index.ts ===
#!/usr/bin/env node
import { Command } from "commander";
import { registerCloseCommand } from "./commands/close.js";
import { registerCommitCommand } from "./commands/commit.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerHelpCommand } from "./commands/help.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { registerLogsCommand } from "./commands/logs.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerSetupCommand } from "./commands/setup.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerVisualCommand } from "./commands/visual.js";
import { registerWhoamiCommand } from "./commands/whoami.js";
import { applyOpenAIKeyFlag } from "./core/config.js";
import { PCA_VERSION } from "./core/version.js";

const program = new Command();

program
  .name("pca")
  .description("Persistent Context Architecture CLI")
  .version(PCA_VERSION)
  .option("--api-key <key>", "OpenAI API key for commands that call OpenAI")
  .hook("preAction", (_thisCommand, actionCommand) => {
    const options = actionCommand.optsWithGlobals() as { apiKey?: string };
    applyOpenAIKeyFlag(options.apiKey);
  });

registerInitCommand(program);
registerStatusCommand(program);
registerCommitCommand(program);
registerLogsCommand(program);
registerSyncCommand(program);
registerQueryCommand(program);
registerTaskCommand(program);
registerVisualCommand(program);
registerCloseCommand(program);
registerLoginCommand(program);
registerLogoutCommand(program);
registerWhoamiCommand(program);
registerSetupCommand(program);
registerConfigCommand(program);
registerDoctorCommand(program);
registerHelpCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
=== END FILE ===

=== FILE: src/commands/close.ts ===
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { requireAuthSession } from "../core/auth.js";
import { getProjectRoot, loadConfig } from "../core/config.js";
import { dateStamp, timestampForLog } from "../core/files.js";

export function registerCloseCommand(program: Command): void {
  program
    .command("close")
    .description("Close a confirmed PCA task and mark memory as needing sync")
    .action(async () => {
      const root = getProjectRoot();
      await loadConfig(root);
      requireAuthSession();

      const lastContextPath = path.join(root, ".pca", "last-task-context.md");
      if (await fs.pathExists(lastContextPath)) {
        const lastContext = await fs.readFile(lastContextPath, "utf8");
        console.log(chalk.cyan("Last task context found: .pca/last-task-context.md"));
        const task = extractTask(lastContext);
        if (task) {
          console.log(`Task: ${task}`);
        }
      } else {
        console.log(chalk.yellow("No .pca/last-task-context.md found. Continuing with manual closure."));
      }

      console.log(chalk.bold("Closure requires explicit user confirmation with SI."));

      const rl = createInterface({ input, output });
      try {
        const confirmed = await rl.question("Â¿La tarea fue completada y confirmada con SI? (yes/no) ");

        if (!["yes", "y", "si", "sÃ­"].includes(confirmed.trim().toLowerCase())) {
          console.log("Closure cancelled. No PCA files were updated.");
          return;
        }

        const change = await rl.question("Texto breve del cambio realizado: ");
        const normalizedChange = change.trim();

        if (!normalizedChange) {
          console.log("Closure cancelled. Change text is required.");
          return;
        }

        await appendChangelog(root, normalizedChange);
        await appendRoadmapDone(root, normalizedChange);
        await appendSyncRequired(root);

        console.log(chalk.green("PCA closure recorded."));
        console.log("Next step: pca sync");
      } finally {
        rl.close();
      }
    });
}

async function appendChangelog(root: string, change: string): Promise<void> {
  const filePath = path.join(root, "pca", "state", "changelog.md");
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `## ${dateStamp()}\n- ${change}\n\n`, "utf8");
}

async function appendRoadmapDone(root: string, change: string): Promise<void> {
  const filePath = path.join(root, "pca", "state", "roadmap.md");
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `\n## Closure ${dateStamp()}\n- Done: ${change}\n`, "utf8");
}

async function appendSyncRequired(root: string): Promise<void> {
  const filePath = path.join(root, "pca", "rag", "sync-log.md");
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `## ${timestampForLog()}\n- Closure recorded\n- Sync required: run \`pca sync\`\n\n`, "utf8");
}

function extractTask(context: string): string | undefined {
  const lines = context.split(/\r?\n/);
  const taskHeadingIndex = lines.findIndex((line) => line.trim() === "## Task");
  if (taskHeadingIndex === -1) {
    return undefined;
  }

  return lines
    .slice(taskHeadingIndex + 1)
    .map((line) => line.trim())
    .find(Boolean);
}
=== END FILE ===

=== FILE: src/commands/commit.ts ===
import { Command } from "commander";
import chalk from "chalk";
import {
  allowedContextCommitTypes,
  appendContextCommit,
  isContextCommitType,
  type ContextCommitType,
} from "../core/context-commits.js";
import { getProjectRoot } from "../core/config.js";
import { getLocalProjectStatus, requireInitializedLocalProject } from "../core/project-status.js";

export function registerCommitCommand(program: Command): void {
  program
    .command("commit")
    .description("Record a local PCA context memory commit")
    .argument("<message>", "Context commit message")
    .option("--type <type>", "decision | feature | bugfix | architecture | product | general", "general")
    .action(async (message: string, options: { type: string }) => {
      if (!message.trim()) {
        throw new Error("Commit message cannot be empty.");
      }

      const type = options.type.trim();
      if (!isContextCommitType(type)) {
        throw new Error(`Invalid --type: ${type}. Allowed values: ${allowedContextCommitTypes()}.`);
      }

      const root = getProjectRoot();
      requireInitializedLocalProject(await getLocalProjectStatus(root));
      const commit = await appendContextCommit(root, message, type as ContextCommitType);

      console.log(chalk.green("PCA context commit recorded."));
      console.log(`ID: ${commit.id}`);
      console.log(`Type: ${commit.type}`);
      console.log(`Timestamp: ${commit.timestamp}`);
      console.log(`Message: ${commit.message}`);
    });
}
=== END FILE ===

=== FILE: src/commands/config.ts ===
import { Command } from "commander";
import chalk from "chalk";
import { getAuthPath, loadAuthSession } from "../core/auth.js";
import { getGlobalConfigPath, getPCAHome, getProjectRoot, loadGlobalConfig, saveGlobalConfig } from "../core/config.js";
import { getMaskedOpenAIKey, getOpenAIKey, getSecretsPath, clearOpenAIKey } from "../core/secrets.js";
import { formatModeLabel, type PCAMode } from "../core/readiness.js";
import { loadDerivedReadiness } from "../core/readiness-state.js";
import { runOpenAISetup } from "./setup.js";

const OPENAI_KEY_NAME = "openai-api-key";
const AUTH_BASE_URL = "auth-base-url";

export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description("Manage global PCA CLI configuration");

  config.action(async () => {
    await printConfig();
  });

  config
    .command("get")
    .description("Read a global config value")
    .argument("<key>", "openai-api-key | auth-base-url")
    .action(async (key: string) => {
      if (key === OPENAI_KEY_NAME) {
        console.log((await getMaskedOpenAIKey()) ?? "missing");
        return;
      }

      if (key === AUTH_BASE_URL) {
        console.log((await loadGlobalConfig()).authBaseUrl ?? "missing");
        return;
      }

      throw unsupportedKey(key);
    });

  config
    .command("set")
    .description("Set a global config value")
    .argument("<key>", "openai-api-key | auth-base-url")
    .argument("[value]", "Value to save")
    .action(async (key: string, value?: string) => {
      if (key === OPENAI_KEY_NAME) {
        await runOpenAISetup(value);
        return;
      }

      if (key === AUTH_BASE_URL) {
        const url = value?.trim();
        if (!url) {
          throw new Error("auth-base-url value is required.");
        }
        const existing = await loadGlobalConfig();
        await saveGlobalConfig({ ...existing, authBaseUrl: url });
        console.log(chalk.green("PCA auth base URL saved."));
        console.log(url);
        return;
      }

      throw unsupportedKey(key);
    });

  config
    .command("clear")
    .description("Clear a global config value")
    .argument("<key>", "openai-api-key | auth-base-url")
    .action(async (key: string) => {
      if (key === OPENAI_KEY_NAME) {
        await clearOpenAIKey();
        console.log(chalk.green("OPENAI_API_KEY removed from global PCA credentials."));
        return;
      }

      if (key === AUTH_BASE_URL) {
        const existing = await loadGlobalConfig();
        delete existing.authBaseUrl;
        await saveGlobalConfig(existing);
        console.log(chalk.green("PCA auth base URL removed."));
        return;
      }

      throw unsupportedKey(key);
    });
}

async function printConfig(): Promise<void> {
  const root = getProjectRoot();
  const session = await loadAuthSession();
  const globalConfig = await loadGlobalConfig();
  const key = await getOpenAIKey();
  const readiness = await loadDerivedReadiness(root);

  console.log(chalk.bold.cyan("PCA Config"));
  console.log("");
  console.log(`PCA home: ${getPCAHome()}`);
  console.log(`Global config: ${getGlobalConfigPath()}`);
  console.log(`Auth session: ${getAuthPath()}`);
  console.log(`Secrets: ${getSecretsPath()}`);
  console.log(`Mode: ${modeStatus(readiness.currentMode)}`);
  console.log(`Offline local commands: ${readinessStatus(readiness.readiness.offlineCommandsAvailable, "available", "unavailable")}`);
  console.log(`OpenAI/BYOK readiness: ${readinessStatus(readiness.readiness.byokConfigured, "configured", "not configured")}`);
  console.log(
    `Cloud auth base URL: ${readinessStatus(readiness.readiness.cloudAuthConfigured, "configured", "not configured")}`,
  );
  console.log(`Cloud session: ${readinessStatus(readiness.readiness.cloudSessionActive, "active", "inactive")}`);
  console.log(
    `Cloud/vector commands: ${readinessStatus(readiness.readiness.cloudVectorCommandsReady, "ready", "not ready")}`,
  );
  console.log(`PCA account: ${session?.userEmail ?? chalk.yellow("not logged in")}`);
  console.log(`Auth base URL: ${globalConfig.authBaseUrl ?? chalk.yellow("missing")}`);
  console.log(`OpenAI API key: ${key ? chalk.green("configured") : chalk.yellow("missing")}`);
  const maskedKey = await getMaskedOpenAIKey();
  if (maskedKey) {
    console.log(`Key: ${maskedKey}`);
  }
  console.log("");
  console.log("Commands:");
  console.log("pca login");
  console.log("pca setup");
  console.log("pca config set auth-base-url <url>");
  console.log("pca config set openai-api-key");
  console.log("pca config get openai-api-key");
  console.log("pca config clear openai-api-key");
}

function unsupportedKey(key: string): Error {
  return new Error(`Unsupported config key: ${key}. Use ${OPENAI_KEY_NAME} or ${AUTH_BASE_URL}.`);
}

function readinessStatus(ok: boolean, okLabel: string, missingLabel: string): string {
  return ok ? chalk.green(okLabel) : chalk.yellow(missingLabel);
}

function modeStatus(mode: PCAMode): string {
  return mode === "partial" ? chalk.yellow(formatModeLabel(mode)) : chalk.green(formatModeLabel(mode));
}
=== END FILE ===

=== FILE: src/commands/doctor.ts ===
import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getAuthPath, loadAuthSession } from "../core/auth.js";
import {
  getAuthBaseUrl,
  getConfigPath,
  getGlobalConfigPath,
  getPCAHome,
  getProjectRoot,
} from "../core/config.js";
import { getOpenAIKey } from "../core/secrets.js";
import { PCA_VERSION } from "../core/version.js";
import { formatModeLabel, type PCADerivedReadiness, type PCAMode } from "../core/readiness.js";
import { loadDerivedReadiness, readProjectConfigSafely } from "../core/readiness-state.js";
import { getLocalProjectStatus } from "../core/project-status.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose global PCA and current project setup")
    .action(async () => {
      const root = getProjectRoot();
      const nodeOk = isNodeVersionOk(process.versions.node);
      const session = await loadAuthSession();
      const key = await getOpenAIKey();
      const authBaseUrl = await getAuthBaseUrl();
      const readiness = await loadDerivedReadiness(root);
      const projectStatus = await getLocalProjectStatus(root);

      const projectConfigPath = getConfigPath(root);
      const hasProjectConfig = await fs.pathExists(projectConfigPath);
      const projectConfig = hasProjectConfig ? await readProjectConfigSafely(projectConfigPath) : undefined;
      const hasIndex = await fs.pathExists(path.join(root, "PCA_INDEX.md"));
      const hasAgents = await fs.pathExists(path.join(root, "AGENTS.md"));
      const hasPcaFolder = await fs.pathExists(path.join(root, "pca"));
      const hasVectorStoreId = Boolean(projectConfig?.vectorStoreId);

      console.log(chalk.bold.cyan("PCA Doctor"));
      console.log("");
      console.log(chalk.bold("Global environment"));
      console.log(`Node version: ${status(nodeOk)} ${process.version}`);
      console.log(`PCA version: ${PCA_VERSION}`);
      console.log(`PCA home: ${getPCAHome()}`);
      console.log(`Global config: ${getGlobalConfigPath()}`);
      console.log("");

      console.log(chalk.bold("Derived readiness"));
      console.log(`Mode: ${modeStatus(readiness.currentMode)}`);
      console.log(`Offline local commands: ${readinessStatus(readiness.readiness.offlineCommandsAvailable, "available", "unavailable")}`);
      console.log(`OpenAI/BYOK readiness: ${readinessStatus(readiness.readiness.byokConfigured, "configured", "not configured")}`);
      console.log(
        `Cloud auth base URL: ${readinessStatus(readiness.readiness.cloudAuthConfigured, "configured", "not configured")}`,
      );
      console.log(`Cloud session: ${readinessStatus(readiness.readiness.cloudSessionActive, "active", "inactive")}`);
      console.log(
        `Cloud/vector commands: ${readinessStatus(readiness.readiness.cloudVectorCommandsReady, "ready", "not ready")}`,
      );
      console.log("");

      console.log(chalk.bold("PCA auth"));
      console.log(`Session: ${session ? chalk.green("present") : chalk.yellow("missing")}`);
      console.log(`Session path: ${getAuthPath()}`);
      if (session?.userEmail) {
        console.log(`Account: ${session.userEmail}`);
      }
      console.log("");

      console.log(chalk.bold("OpenAI API key"));
      console.log(`OpenAI API key: ${key ? chalk.green("configured") : chalk.yellow("missing")}`);
      console.log(`Validation: ${chalk.yellow("Skipped in doctor summary")}`);
      console.log("");

      console.log(chalk.bold("Project memory"));
      console.log(`Project root: ${root}`);
      console.log(`PCA project: ${projectLabel(projectStatus.state)}`);
      console.log(`PCA_INDEX.md: ${status(hasIndex)}`);
      console.log(`AGENTS.md: ${status(hasAgents)}`);
      console.log(`.pca/config.json: ${status(hasProjectConfig)}`);
      console.log(`pca/ folder: ${status(hasPcaFolder)}`);
      console.log("");

      console.log(chalk.bold("Vector store"));
      console.log(`Vector Store ID: ${status(hasVectorStoreId)}${projectConfig?.vectorStoreId ? ` ${projectConfig.vectorStoreId}` : ""}`);
      console.log("");

      console.log(chalk.bold("Backend auth config"));
      console.log(`Auth base URL: ${authBaseUrl ? chalk.green("OK") : chalk.yellow("Missing")}${authBaseUrl ? ` ${authBaseUrl}` : ""}`);
      console.log("");

      console.log(chalk.bold("Suggested next step:"));
      for (const step of suggestedSteps({
        nodeOk,
        readiness,
      })) {
        console.log(`- ${step}`);
      }
    });
}

function isNodeVersionOk(version: string): boolean {
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  return major >= 20;
}

function status(ok: boolean): string {
  return ok ? chalk.green("OK") : chalk.yellow("Missing");
}

function suggestedSteps(args: {
  nodeOk: boolean;
  readiness: PCADerivedReadiness;
}): string[] {
  if (!args.nodeOk) {
    return ["Install Node.js >= 20"];
  }

  if (!args.readiness.projectInitialized) {
    return ["Run `pca init` to enable offline local memory"];
  }

  if (!args.readiness.readiness.byokConfigured) {
    return ["Offline local commands are available now", "Run `pca setup` when you want OpenAI-backed commands"];
  }

  if (!args.readiness.readiness.cloudAuthConfigured) {
    return ["OpenAI/BYOK is configured", "Set `auth-base-url` only when you want PCA cloud auth"];
  }

  if (!args.readiness.readiness.cloudSessionActive) {
    return ["Cloud auth base URL is configured", "Run `pca login` when you want PCA cloud auth"];
  }

  if (!args.readiness.readiness.cloudVectorCommandsReady) {
    return ["Cloud auth is active", "Run `pca setup` if you need OpenAI-backed cloud/vector commands"];
  }

  return ["Run `pca sync`", "Run `pca task \"your task\"`"];
}

function readinessStatus(ok: boolean, okLabel: string, missingLabel: string): string {
  return ok ? chalk.green(okLabel) : chalk.yellow(missingLabel);
}

function modeStatus(mode: PCAMode): string {
  return mode === "partial" ? chalk.yellow(formatModeLabel(mode)) : chalk.green(formatModeLabel(mode));
}

function projectLabel(state: "initialized" | "partial" | "not-initialized"): string {
  if (state === "initialized") {
    return chalk.green("Initialized");
  }

  if (state === "partial") {
    return chalk.yellow("Partially initialized");
  }

  return chalk.yellow("Not initialized");
}
=== END FILE ===

=== FILE: src/commands/help.ts ===
import { Command } from "commander";
import chalk from "chalk";

export function registerHelpCommand(program: Command): void {
  program
    .command("help")
    .description("Show PCA usage guide")
    .action(() => {
      console.log(chalk.bold.cyan("PCA = Persistent Context Architecture"));
      console.log("");
      console.log("Markdown files are the source of truth.");
      console.log("RAG is the mandatory access layer.");
      console.log("Agents must not read the full pca/ folder by default.");
      console.log("");
      console.log(chalk.bold("Mental Flow"));
      console.log("PCA_INDEX.md â†’ Vector Store Retrieval â†’ Compact Task Context â†’ Agent Execution â†’ Closure â†’ Sync");
      console.log("");
      console.log(chalk.bold("Commands"));
      console.log("pca init");
      console.log("pca login");
      console.log("pca logout");
      console.log("pca whoami");
      console.log("pca setup");
      console.log("pca config");
      console.log("pca sync");
      console.log("pca status");
      console.log('pca commit "..." --type decision');
      console.log("pca logs --last 10");
      console.log('pca query "..."');
      console.log('pca task "..."');
      console.log('pca visual add ./image.png --type reference --note "..."');
      console.log("pca close");
      console.log("pca help");
      console.log("");
      console.log(chalk.bold("Recommended Flow"));
      console.log("pca login");
      console.log("pca init");
      console.log("pca status");
      console.log('pca commit "initial context snapshot"');
      console.log("pca logs");
      console.log("pca sync");
      console.log('pca task "crear hero mobile"');
      console.log("# paste .pca/last-task-context.md into Codex");
      console.log("pca close");
      console.log("pca sync");
      console.log("");
      console.log(chalk.bold.red("Critical Rules"));
      console.log("- PCA sin RAG no opera.");
      console.log("- No fallback to reading the full pca/ folder.");
      console.log("- Only PCA_INDEX.md is read at task start.");
      console.log("- Vector Store is required.");
      console.log("- Use pca login/setup to configure global PCA credentials.");
      console.log("- Roadmap/changelog update only after closure confirmation.");
      console.log("");
      console.log(chalk.bold("Visual Memory"));
      console.log("In MVP, visual memory stores local images + textual metadata in visual-index.md.");
      console.log("Real multimodal analysis comes in v2.");
    });
}
=== END FILE ===

=== FILE: src/commands/init.ts ===
import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { loadAuthSession } from "../core/auth.js";
import { applyOpenAIKeyFlag, getProjectRoot, saveConfig, type PCAProjectConfig } from "../core/config.js";
import { slugify, writeFileIfMissing } from "../core/files.js";
import { ensureValidOpenAIKey } from "../core/openai-key.js";
import { createVectorStore } from "../core/openai.js";
import { getOpenAIKey } from "../core/secrets.js";
import { agentsTemplate } from "../templates/agents.js";
import { coreDocs, projectReadmeTemplate } from "../templates/docs.js";
import { pcaIndexTemplate } from "../templates/pca-index.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize PCA memory in the current repository")
    .option("--name <name>", "Project name")
    .option("--api-key <key>", "OpenAI API key for this command")
    .action(async (options: { name?: string; apiKey?: string }) => {
      applyOpenAIKeyFlag(options.apiKey);

      const root = getProjectRoot();
      const indexPath = path.join(root, "PCA_INDEX.md");

      if (await fs.pathExists(indexPath)) {
        throw new Error(
          [
            chalk.red("PCA_INDEX.md already exists."),
            "Abort: pca init does not overwrite an existing PCA workspace.",
          ].join("\n"),
        );
      }

      const projectName = options.name ?? path.basename(root);
      const projectSlug = slugify(projectName);
      const vectorStoreName = `pca_${projectSlug}`;
      const session = await loadAuthSession();
      const hasOpenAIKey = Boolean(await getOpenAIKey());
      let vectorStoreId = "local-only";

      if (session && hasOpenAIKey) {
        await ensureValidOpenAIKey();
        console.log(chalk.cyan(`Creating OpenAI Vector Store: ${vectorStoreName}`));
        vectorStoreId = await createVectorStore(vectorStoreName);
      }

      const created: string[] = [];
      const skipped: string[] = [];

      await writeTracked(root, "PCA_INDEX.md", pcaIndexTemplate(projectName), created, skipped);
      await writeTracked(root, "AGENTS.md", agentsTemplate(), created, skipped);
      await writeTracked(root, "README.md", projectReadmeTemplate(projectName), created, skipped);

      for (const [filePath, content] of Object.entries(coreDocs)) {
        await writeTracked(root, filePath, content, created, skipped);
      }

      for (const dir of [
        "pca/prd",
        "pca/decisions",
        "pca/visual/screenshots",
        "pca/visual/mockups",
        "pca/visual/references",
        "pca/visual/generated",
      ]) {
        await fs.ensureDir(path.join(root, dir));
      }

      await writeTracked(root, "pca/prd/.gitkeep", "", created, skipped);
      await writeTracked(root, "pca/decisions/.gitkeep", "", created, skipped);

      const now = new Date().toISOString();
      const config: PCAProjectConfig = {
        projectName,
        projectSlug,
        vectorStoreId,
        createdAt: now,
        updatedAt: now,
      };

      await saveConfig(config, root);
      created.push(".pca/config.json");

      console.log(chalk.green("PCA initialized."));
      console.log(`Project: ${projectName}`);
      console.log(`Vector store: ${vectorStoreId}`);
      console.log(`Files created: ${created.length}`);

      if (skipped.length) {
        console.log(chalk.yellow(`Files skipped because they already existed: ${skipped.length}`));
      }

      console.log("");
      console.log(chalk.bold("Next step:"));
      console.log(vectorStoreId === "local-only" ? 'pca commit "initial context snapshot"' : "pca sync");
    });
}

async function writeTracked(
  root: string,
  relativePath: string,
  content: string,
  created: string[],
  skipped: string[],
): Promise<void> {
  const result = await writeFileIfMissing(path.join(root, relativePath), content);
  if (result === "created") {
    created.push(relativePath);
  } else {
    skipped.push(relativePath);
  }
}
=== END FILE ===

=== FILE: src/commands/login.ts ===
import { Command } from "commander";
import chalk from "chalk";
import { loadAuthSession } from "../core/auth.js";
import { runBrowserLogin } from "../core/browser-auth.js";
import { getAuthBaseUrl } from "../core/config.js";

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Sign in to PCA cloud auth")
    .action(async () => {
      const existing = await loadAuthSession();
      let session = existing;

      if (!session) {
        const authBaseUrl = await getAuthBaseUrl();
        if (!authBaseUrl) {
          throw new Error(
            [
              "PCA cloud auth backend is not configured.",
              "Set it with:",
              "  pca config set auth-base-url <url>",
              "or:",
              "  PCA_AUTH_BASE_URL=<url> pca login",
              "",
              "Local offline commands remain available without PCA cloud auth.",
              "The CLI cannot complete Clerk login without a hosted PCA backend.",
            ].join("\n"),
          );
        }
        console.log("Opening browser for PCA login...");
        console.log("Waiting for authentication...");
        session = await runBrowserLogin();
        console.log(chalk.green(`Login successful: ${session.userEmail}`));
      } else {
        console.log(chalk.green(`Already logged in: ${session.userEmail}`));
      }

      console.log("");
      console.log(chalk.green("PCA cloud auth is ready."));
      console.log("Next:");
      console.log("  pca setup");
      console.log("");
      console.log("Optional for BYOK/OpenAI-backed commands:");
      console.log("  pca config set openai-api-key");
    });
}
=== END FILE ===

=== FILE: src/commands/logout.ts ===
import { Command } from "commander";
import chalk from "chalk";
import { clearAuthSession } from "../core/auth.js";
import { clearOpenAIKey } from "../core/secrets.js";

export function registerLogoutCommand(program: Command): void {
  program
    .command("logout")
    .description("Clear the local PCA auth session")
    .option("--clear-openai-key", "Also remove the stored OpenAI API key")
    .action(async (options: { clearOpenaiKey?: boolean }) => {
      await clearAuthSession();
      console.log(chalk.green("PCA auth session cleared."));
      console.log("PCA auth and BYOK/OpenAI credentials are stored separately.");

      if (options.clearOpenaiKey) {
        await clearOpenAIKey();
        console.log("OpenAI API key removed from global PCA credentials.");
      } else {
        console.log("OpenAI API key left unchanged.");
        console.log("Use `pca logout --clear-openai-key` to remove it explicitly.");
      }
    });
}
=== END FILE ===

=== FILE: src/commands/logs.ts ===
import { Command } from "commander";
import chalk from "chalk";
import {
  allowedContextCommitTypes,
  ContextCommitLogError,
  isContextCommitType,
  readContextCommits,
} from "../core/context-commits.js";
import { getProjectRoot } from "../core/config.js";

export function registerLogsCommand(program: Command): void {
  program
    .command("logs")
    .description("List local PCA context memory commits")
    .option("--last <number>", "Maximum number of commits to show", "10")
    .option("--type <type>", "decision | feature | bugfix | architecture | product | general")
    .action(async (options: { last: string; type?: string }) => {
      const limit = parseLast(options.last);
      const type = options.type?.trim();
      if (type && !isContextCommitType(type)) {
        throw new Error(`Invalid --type: ${type}. Allowed values: ${allowedContextCommitTypes()}.`);
      }

      let allCommits;
      try {
        allCommits = await readContextCommits(getProjectRoot());
      } catch (error) {
        if (error instanceof ContextCommitLogError) {
          console.log(chalk.bold.cyan("PCA Context Logs"));
          console.log("");
          console.log(chalk.yellow(error.message));
          return;
        }
        throw error;
      }

      const commits = allCommits
        .filter((commit) => !type || commit.type === type)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit);

      console.log(chalk.bold.cyan("PCA Context Logs"));
      console.log("");

      if (!commits.length) {
        console.log(type ? `No context commits found for type: ${type}.` : "No context commits found.");
        return;
      }

      for (const commit of commits) {
        console.log(`${commit.timestamp}  ${commit.id}  [${commit.type}] ${commit.message}`);
      }
    });
}

function parseLast(value: string): number {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Invalid --last. Use an integer between 1 and 100.");
  }

  return limit;
}
=== END FILE ===

=== FILE: src/commands/query.ts ===
import { Command } from "commander";
import { getProjectRoot } from "../core/config.js";
import { buildQueryOutput } from "../core/prompt-builder.js";
import { retrieveContext } from "../core/retrieval.js";

export function registerQueryCommand(program: Command): void {
  program
    .command("query")
    .description("Search PCA context through OpenAI Vector Store")
    .argument("<query>", "Search query")
    .option("--limit <number>", "Maximum results", "5")
    .option("--api-key <key>", "OpenAI API key for this command")
    .action(async (query: string, options: { limit: string }) => {
      const limit = parseLimit(options.limit);
      const root = getProjectRoot();
      const results = await retrieveContext({ root, query, limit });
      console.log(buildQueryOutput(query, results));
    });
}

function parseLimit(value: string): number {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Invalid --limit. Use an integer between 1 and 20.");
  }

  return limit;
}
=== END FILE ===

=== FILE: src/commands/setup.ts ===
import { Command } from "commander";
import chalk from "chalk";
import { getAuthBaseUrl, getProjectRoot, maskOpenAIKey } from "../core/config.js";
import { loadDerivedReadiness } from "../core/readiness-state.js";
import { saveOpenAIKey } from "../core/secrets.js";
import { getProjectEnvOpenAIKey, removeProjectEnvOpenAIKey } from "../core/project-env.js";
import { validateOpenAIKey } from "../core/openai-key.js";
import { promptSecret, promptText } from "../core/prompt.js";

type SetupMode = "local-only" | "byok" | "cloud";

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Guided PCA onboarding for local-only, BYOK, or cloud auth")
    .option("--mode <mode>", "Setup mode: local-only | byok | cloud")
    .option("--api-key <key>", "OpenAI API key to validate and save")
    .action(async (options: { mode?: string; apiKey?: string }) => {
      const mode = parseMode(options.mode);

      if (mode) {
        await runSetupMode(mode, { apiKeyFromOption: options.apiKey, nonInteractive: true });
        return;
      }

      await runInteractiveSetup(options.apiKey);
    });
}

export async function runOpenAISetup(
  apiKeyFromOption?: string,
  options?: {
    nonInteractive?: boolean;
  },
): Promise<void> {
  const root = getProjectRoot();
  const projectEnvKey = await getProjectEnvOpenAIKey(root);
  let apiKey = apiKeyFromOption?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (!apiKey && projectEnvKey) {
    if (options?.nonInteractive) {
      console.log("Using OPENAI_API_KEY from project .env for BYOK setup.");
      apiKey = projectEnvKey;
    }
  }

  if (!apiKey && projectEnvKey) {
    const move = await promptText("Found OPENAI_API_KEY in project .env. Move it to PCA global credentials? y/N ");
    if (move.trim().toLowerCase() === "y") {
      apiKey = projectEnvKey;
    }
  }

  if (!apiKey) {
    apiKey = await promptSecret("Paste your OpenAI API key: ");
  }

  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("OpenAI API key cannot be empty.");
  }

  console.log("Validating OpenAI API key...");
  const validation = await validateOpenAIKey(trimmed);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  await saveOpenAIKey(trimmed);
  console.log(chalk.green("OpenAI API key valid."));
  console.log(`Stored globally: ${maskOpenAIKey(trimmed)}`);

  if (projectEnvKey && projectEnvKey === trimmed && !options?.nonInteractive) {
    const remove = await promptText("Remove OPENAI_API_KEY from project .env? y/N ");
    if (remove.trim().toLowerCase() === "y") {
      await removeProjectEnvOpenAIKey(root);
      console.log("Removed OPENAI_API_KEY from project .env.");
    }
  }
}

async function runInteractiveSetup(apiKeyFromOption?: string): Promise<void> {
  const root = getProjectRoot();
  const readiness = await loadDerivedReadiness(root);
  const recommendedMode = recommendMode(readiness);

  console.log(chalk.bold.cyan("PCA Setup"));
  console.log("");
  console.log(`Current mode: ${readiness.currentMode}`);
  console.log(`Recommended next step: ${recommendedMode}`);
  console.log("");
  console.log("Choose setup mode:");
  console.log("  1. local-only");
  console.log("  2. byok");
  console.log("  3. cloud");

  const answer = await promptText(`Mode [1/2/3] (${recommendedMode}): `);
  const mode = mapChoiceToMode(answer.trim(), recommendedMode);
  await runSetupMode(mode, { apiKeyFromOption, nonInteractive: false });
}

async function runSetupMode(
  mode: SetupMode,
  options: {
    apiKeyFromOption?: string;
    nonInteractive: boolean;
  },
): Promise<void> {
  if (mode === "local-only") {
    printLocalOnlyReady();
    return;
  }

  if (mode === "byok") {
    await runByokSetup(options.apiKeyFromOption, options.nonInteractive);
    return;
  }

  await runCloudSetup();
}

async function runByokSetup(apiKeyFromOption: string | undefined, nonInteractive: boolean): Promise<void> {
  const root = getProjectRoot();
  const projectEnvKey = await getProjectEnvOpenAIKey(root);
  const envKey = process.env.OPENAI_API_KEY?.trim();
  const optionKey = apiKeyFromOption?.trim();

  if (nonInteractive && !optionKey && !envKey && !projectEnvKey) {
    throw new Error(
      [
        "OpenAI API key is required for `pca setup --mode byok`.",
        "Provide it with `--api-key <key>` or set `OPENAI_API_KEY` first.",
      ].join("\n"),
    );
  }

  await runOpenAISetup(apiKeyFromOption, { nonInteractive });
  console.log("");
  console.log(chalk.green("BYOK/OpenAI readiness is configured."));
  console.log("Next:");
  console.log("  pca status");
  console.log("  pca init");
}

async function runCloudSetup(): Promise<void> {
  const authBaseUrl = await getAuthBaseUrl();

  console.log(chalk.bold.cyan("PCA Cloud Setup"));
  console.log("");
  console.log("PCA cloud auth is separate from offline local mode.");

  if (!authBaseUrl) {
    console.log("");
    console.log(chalk.yellow("Cloud auth base URL is not configured."));
    console.log("Set it with:");
    console.log("  pca config set auth-base-url <url>");
    console.log("or:");
    console.log("  PCA_AUTH_BASE_URL=<url> pca login");
    console.log("");
    console.log("Local offline commands remain available now:");
    printOfflineCommandList();
    return;
  }

  console.log(`Cloud auth base URL: ${authBaseUrl}`);
  console.log("Next:");
  console.log("  pca login");
  console.log("");
  console.log("Optional for current OpenAI-backed/vector commands:");
  console.log("  pca config set openai-api-key");
}

function printLocalOnlyReady(): void {
  console.log(chalk.green("Local-only setup complete."));
  console.log("Offline local commands are ready:");
  printOfflineCommandList();
}

function printOfflineCommandList(): void {
  console.log("  pca init");
  console.log("  pca status");
  console.log("  pca commit");
  console.log("  pca logs");
}

function parseMode(value?: string): SetupMode | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "local-only" || value === "byok" || value === "cloud") {
    return value;
  }

  throw new Error(`Invalid --mode: ${value}. Use local-only, byok, or cloud.`);
}

function mapChoiceToMode(answer: string, recommended: SetupMode): SetupMode {
  if (!answer) {
    return recommended;
  }

  if (answer === "1" || answer.toLowerCase() === "local-only") {
    return "local-only";
  }

  if (answer === "2" || answer.toLowerCase() === "byok") {
    return "byok";
  }

  if (answer === "3" || answer.toLowerCase() === "cloud") {
    return "cloud";
  }

  throw new Error("Invalid setup mode selection. Use 1, 2, 3, local-only, byok, or cloud.");
}

function recommendMode(readiness: Awaited<ReturnType<typeof loadDerivedReadiness>>): SetupMode {
  if (readiness.readiness.cloudAuthConfigured || readiness.readiness.cloudSessionActive) {
    return "cloud";
  }

  if (readiness.readiness.byokConfigured) {
    return "byok";
  }

  return "local-only";
}
=== END FILE ===

=== FILE: src/commands/status.ts ===
import { Command } from "commander";
import chalk from "chalk";
import { loadAuthSession } from "../core/auth.js";
import {
  ContextCommitLogError,
  latestContextCommit,
  readContextCommits,
  type ContextCommit,
} from "../core/context-commits.js";
import { getProjectRoot } from "../core/config.js";
import { getLocalProjectStatus } from "../core/project-status.js";
import { getOpenAIKey } from "../core/secrets.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show local PCA project and context memory status")
    .action(async () => {
      const root = getProjectRoot();
      const project = await getLocalProjectStatus(root);
      let commits: ContextCommit[] = [];
      let commitLogWarning: string | undefined;
      try {
        commits = await readContextCommits(root);
      } catch (error) {
        if (error instanceof ContextCommitLogError) {
          commitLogWarning = error.message;
        } else {
          throw error;
        }
      }
      const latest = latestContextCommit(commits);
      const session = await loadAuthSession();
      const key = await getOpenAIKey();

      console.log(chalk.bold.cyan("PCA Status"));
      console.log("");
      console.log(`Project: ${projectStatus(project.state)}`);
      console.log(`PCA_INDEX.md: ${status(project.hasIndex)}`);
      console.log(`AGENTS.md: ${status(project.hasAgents)}`);
      console.log(`.pca/config.json: ${status(project.hasProjectConfig)}`);
      console.log(`pca/ folder: ${status(project.hasPcaFolder)}`);
      console.log("");
      console.log(`Context commits: ${commits.length}`);
      console.log(`Latest commit: ${latest ? `${latest.id} [${latest.type}] ${latest.message}` : "none"}`);
      if (commitLogWarning) {
        console.log(chalk.yellow(commitLogWarning));
      }
      console.log("");
      console.log(`Auth session: ${session ? chalk.green("present") : chalk.yellow("missing")}`);
      console.log(`OpenAI API key: ${key ? chalk.green("present") : chalk.yellow("missing")}`);
    });
}

function status(ok: boolean): string {
  return ok ? chalk.green("OK") : chalk.yellow("Missing");
}

function projectStatus(state: "initialized" | "partial" | "not-initialized"): string {
  if (state === "initialized") {
    return chalk.green("Initialized");
  }

  if (state === "partial") {
    return chalk.yellow("Partially initialized");
  }

  return chalk.yellow("Not initialized");
}
=== END FILE ===

=== FILE: src/commands/sync.ts ===
import { Command } from "commander";
import chalk from "chalk";
import { getProjectRoot } from "../core/config.js";
import { syncMemory } from "../core/memory-sync.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Upload PCA markdown files to the configured OpenAI Vector Store")
    .option("--api-key <key>", "OpenAI API key for this command")
    .action(async () => {
      const root = getProjectRoot();
      const result = await syncMemory(root);

      console.log(chalk.green("PCA sync completed."));
      console.log(`Files synced: ${result.syncedCount}`);
      console.log(`Vector store: ${result.vectorStoreId}`);

      if (result.failed.length) {
        console.log(chalk.yellow(""));
        console.log(chalk.yellow("Failed files:"));
        for (const item of result.failed) {
          console.log(`- ${item.path}: ${item.error}`);
        }
        process.exitCode = 1;
      }
    });
}
=== END FILE ===

=== FILE: src/commands/task.ts ===
import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getProjectRoot, loadConfig } from "../core/config.js";
import { buildTaskContext, classifyTask, TASK_LIMITS } from "../core/prompt-builder.js";
import { retrieveContext } from "../core/retrieval.js";

export function registerTaskCommand(program: Command): void {
  program
    .command("task")
    .description("Generate compact PCA context for an AI development task")
    .argument("<task>", "Task description")
    .option("--api-key <key>", "OpenAI API key for this command")
    .action(async (task: string) => {
      const root = getProjectRoot();
      const indexPath = path.join(root, "PCA_INDEX.md");

      if (!(await fs.pathExists(indexPath))) {
        throw new Error(
          [
            chalk.red("PCA_INDEX.md not found."),
            "PCA sin RAG no opera.",
            "Run `pca init` first.",
          ].join("\n"),
        );
      }

      await fs.readFile(indexPath, "utf8");
      await loadConfig(root);

      const taskType = classifyTask(task);
      const limit = TASK_LIMITS[taskType];
      const results = await retrieveContext({ root, query: task, limit });
      const output = buildTaskContext(task, taskType, results);
      const outputPath = path.join(root, ".pca", "last-task-context.md");

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, output, "utf8");

      console.log(output);
      console.log(chalk.green(`Saved to ${path.relative(root, outputPath)}`));
    });
}
=== END FILE ===

=== FILE: src/commands/visual.ts ===
import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { requireAuthSession } from "../core/auth.js";
import { getProjectRoot, loadConfig } from "../core/config.js";
import { dateStamp, toPosixPath } from "../core/files.js";

type VisualType = "reference" | "screenshot" | "mockup" | "generated" | "bug";

const VALID_TYPES = new Set<VisualType>(["reference", "screenshot", "mockup", "generated", "bug"]);

const TYPE_DIR: Record<VisualType, string> = {
  reference: "references",
  screenshot: "screenshots",
  mockup: "mockups",
  generated: "generated",
  bug: "screenshots",
};

export function registerVisualCommand(program: Command): void {
  const visual = program.command("visual").description("Manage PCA visual memory metadata");

  visual
    .command("add")
    .description("Add a local image to visual memory and record textual metadata")
    .argument("<image>", "Image path")
    .requiredOption("--type <type>", "reference | screenshot | mockup | generated | bug")
    .option("--note <note>", "Textual note", "")
    .action(async (image: string, options: { type: string; note: string }) => {
      const root = getProjectRoot();
      await loadConfig(root);
      requireAuthSession();

      if (!VALID_TYPES.has(options.type as VisualType)) {
        throw new Error("Invalid visual type. Use reference, screenshot, mockup, generated, or bug.");
      }

      const type = options.type as VisualType;
      const source = path.resolve(root, image);

      if (!(await fs.pathExists(source))) {
        throw new Error(`Image not found: ${image}`);
      }

      const stat = await fs.stat(source);
      if (!stat.isFile()) {
        throw new Error(`Path is not a file: ${image}`);
      }

      const destinationDir = path.join(root, "pca", "visual", TYPE_DIR[type]);
      const fileName = `${dateStamp()}-${path.basename(source)}`;
      const destination = path.join(destinationDir, fileName);

      await fs.ensureDir(destinationDir);
      await fs.copyFile(source, destination);

      const rel = toPosixPath(path.relative(root, destination));
      const indexPath = path.join(root, "pca", "visual", "visual-index.md");
      const entry = [
        `## ${dateStamp()} - ${fileName}`,
        `Path: \`${rel}\``,
        `Type: ${type}`,
        `Note: ${options.note || "[no note]"}`,
        "Status: pending-review",
        "Use for:",
        "- [to be completed]",
        "Avoid:",
        "- [to be completed]",
        "",
      ].join("\n");

      await fs.ensureDir(path.dirname(indexPath));
      await fs.appendFile(indexPath, entry, "utf8");

      console.log(chalk.green("Visual memory added."));
      console.log(`Path: ${rel}`);
      console.log("");
      console.log("MVP note: the image is not indexed directly. Textual metadata in visual-index.md enters RAG after sync.");
      console.log("Next step: pca sync");
    });
}
=== END FILE ===

=== FILE: src/commands/whoami.ts ===
import { Command } from "commander";
import chalk from "chalk";
import { getGlobalConfigPath, getProjectRoot } from "../core/config.js";
import { loadAuthSession } from "../core/auth.js";
import { getOpenAIKey } from "../core/secrets.js";
import { formatModeLabel, type PCAMode } from "../core/readiness.js";
import { loadDerivedReadiness } from "../core/readiness-state.js";

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("Show PCA account and credential status")
    .action(async () => {
      const root = getProjectRoot();
      const session = await loadAuthSession();
      const key = await getOpenAIKey();
      const readiness = await loadDerivedReadiness(root);

      console.log(`Mode: ${modeStatus(readiness.currentMode)}`);
      console.log(`Offline local commands: ${readinessStatus(readiness.readiness.offlineCommandsAvailable, "available", "unavailable")}`);
      console.log(`OpenAI/BYOK readiness: ${readinessStatus(readiness.readiness.byokConfigured, "configured", "not configured")}`);
      console.log(
        `Cloud auth base URL: ${readinessStatus(readiness.readiness.cloudAuthConfigured, "configured", "not configured")}`,
      );
      console.log(`Cloud session: ${readinessStatus(readiness.readiness.cloudSessionActive, "active", "inactive")}`);
      console.log(
        `Cloud/vector commands: ${readinessStatus(readiness.readiness.cloudVectorCommandsReady, "ready", "not ready")}`,
      );
      console.log(`PCA account: ${session?.userEmail ?? chalk.yellow("not logged in")}`);
      console.log(`OpenAI API key: ${key ? chalk.green("configured") : chalk.yellow("missing")}`);
      console.log(`PCA global config: ${chalk.green("OK")}`);
      console.log(`Global config path: ${getGlobalConfigPath()}`);
    });
}

function readinessStatus(ok: boolean, okLabel: string, missingLabel: string): string {
  return ok ? chalk.green(okLabel) : chalk.yellow(missingLabel);
}

function modeStatus(mode: PCAMode): string {
  return mode === "partial" ? chalk.yellow(formatModeLabel(mode)) : chalk.green(formatModeLabel(mode));
}
=== END FILE ===

=== FILE: src/core/auth.ts ===
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
=== END FILE ===

=== FILE: src/core/browser-auth.ts ===
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
=== END FILE ===

=== FILE: src/core/config.ts ===
import os from "node:os";
import path from "node:path";
import process from "node:process";
import chalk from "chalk";
import fs from "fs-extra";

export type PCAProjectConfig = {
  projectName: string;
  projectSlug: string;
  vectorStoreId: string;
  createdAt: string;
  updatedAt: string;
};

export type PCAGlobalConfig = {
  authBaseUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function getProjectRoot(): string {
  return process.cwd();
}

export function getConfigPath(root = getProjectRoot()): string {
  return path.join(root, ".pca", "config.json");
}

export function getPCAHome(): string {
  if (process.env.PCA_HOME?.trim()) {
    return path.resolve(process.env.PCA_HOME.trim());
  }

  return path.join(os.homedir(), ".pca");
}

export function getGlobalConfigPath(): string {
  return path.join(getPCAHome(), "config.json");
}

export async function loadConfig(root = getProjectRoot()): Promise<PCAProjectConfig> {
  const configPath = getConfigPath(root);

  if (!(await fs.pathExists(configPath))) {
    throw new Error(
      [
        chalk.red("PCA config not found."),
        "PCA sin RAG no opera.",
        "Run `pca init` first.",
      ].join("\n"),
    );
  }

  const config = (await fs.readJson(configPath)) as Partial<PCAProjectConfig>;

  if (!config.vectorStoreId) {
    throw new Error(
      [
        chalk.red("Missing vectorStoreId in .pca/config.json."),
        "PCA sin RAG no opera.",
        "Run `pca init` again in a clean project or repair the config.",
      ].join("\n"),
    );
  }

  return {
    projectName: config.projectName ?? path.basename(root),
    projectSlug: config.projectSlug ?? path.basename(root).toLowerCase(),
    vectorStoreId: config.vectorStoreId,
    createdAt: config.createdAt ?? new Date().toISOString(),
    updatedAt: config.updatedAt ?? config.createdAt ?? new Date().toISOString(),
  };
}

export async function saveConfig(config: PCAProjectConfig, root = getProjectRoot()): Promise<void> {
  const configPath = getConfigPath(root);
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, config, { spaces: 2 });
}

export async function loadGlobalConfig(): Promise<PCAGlobalConfig> {
  const configPath = getGlobalConfigPath();
  if (!(await fs.pathExists(configPath))) {
    return {};
  }

  return (await fs.readJson(configPath)) as PCAGlobalConfig;
}

export async function saveGlobalConfig(config: PCAGlobalConfig): Promise<void> {
  const now = new Date().toISOString();
  const next: PCAGlobalConfig = {
    ...config,
    createdAt: config.createdAt ?? now,
    updatedAt: now,
  };

  const configPath = getGlobalConfigPath();
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, next, { spaces: 2 });
}

export async function getAuthBaseUrl(): Promise<string | undefined> {
  return process.env.PCA_AUTH_BASE_URL?.trim() || (await loadGlobalConfig()).authBaseUrl?.trim();
}

export function applyOpenAIKeyFlag(apiKey?: string): void {
  const trimmedKey = apiKey?.trim();
  if (!trimmedKey) {
    return;
  }

  process.env.OPENAI_API_KEY = trimmedKey;
  console.warn(
    chalk.yellow(
      [
        "Warning: Passing API keys via CLI flags can expose them in shell history.",
        "Prefer `pca setup` so PCA can store the key in global user credentials.",
      ].join("\n"),
    ),
  );
}

export function maskOpenAIKey(apiKey: string): string {
  const trimmedKey = apiKey.trim();
  if (trimmedKey.length <= 7) {
    return "***";
  }

  return `${trimmedKey.slice(0, 3)}...${trimmedKey.slice(-4)}`;
}
=== END FILE ===

=== FILE: src/core/context-commits.ts ===
import crypto from "node:crypto";
import path from "node:path";
import fs from "fs-extra";

export const CONTEXT_COMMIT_TYPES = ["decision", "feature", "bugfix", "architecture", "product", "general"] as const;

export type ContextCommitType = (typeof CONTEXT_COMMIT_TYPES)[number];

export type ContextCommit = {
  id: string;
  timestamp: string;
  message: string;
  type: ContextCommitType;
};

export class ContextCommitLogError extends Error {
  constructor(logPath: string, detail: string) {
    super(
      [
        `Could not read PCA context commit log: ${logPath}`,
        detail,
        "Recovery: fix the JSON file, move it aside, or delete it if the local commit history is no longer needed.",
      ].join("\n"),
    );
    this.name = "ContextCommitLogError";
  }
}

export function getContextCommitLogPath(root: string): string {
  return path.join(root, ".pca", "context-commits.json");
}

export function allowedContextCommitTypes(): string {
  return CONTEXT_COMMIT_TYPES.join(", ");
}

export async function readContextCommits(root: string): Promise<ContextCommit[]> {
  const logPath = getContextCommitLogPath(root);
  if (!(await fs.pathExists(logPath))) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = (await fs.readJson(logPath)) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ContextCommitLogError(logPath, detail);
  }

  if (!Array.isArray(parsed)) {
    throw new ContextCommitLogError(logPath, "Expected the file to contain a JSON array of context commits.");
  }

  return parsed.filter(isContextCommit);
}

export async function appendContextCommit(
  root: string,
  message: string,
  type: ContextCommitType = "general",
): Promise<ContextCommit> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error("Commit message cannot be empty.");
  }

  if (!isContextCommitType(type)) {
    throw new Error(`Invalid commit type: ${type}. Allowed values: ${allowedContextCommitTypes()}.`);
  }

  const commit: ContextCommit = {
    id: createCommitId(),
    timestamp: new Date().toISOString(),
    message: trimmedMessage,
    type,
  };

  const commits = await readContextCommits(root);
  commits.push(commit);

  const logPath = getContextCommitLogPath(root);
  await fs.ensureDir(path.dirname(logPath));
  await fs.writeJson(logPath, commits, { spaces: 2 });

  return commit;
}

export function latestContextCommit(commits: ContextCommit[]): ContextCommit | undefined {
  return [...commits].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}

export function isContextCommitType(value: string): value is ContextCommitType {
  return CONTEXT_COMMIT_TYPES.includes(value as ContextCommitType);
}

function createCommitId(): string {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    String(date.getUTCSeconds()).padStart(2, "0"),
  ].join("");

  return `${stamp}-${crypto.randomBytes(4).toString("hex")}`;
}

function isContextCommit(value: unknown): value is ContextCommit {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ContextCommit>;
  return (
    typeof item.id === "string" &&
    typeof item.timestamp === "string" &&
    typeof item.message === "string" &&
    typeof item.type === "string" &&
    isContextCommitType(item.type)
  );
}
=== END FILE ===

=== FILE: src/core/files.ts ===
import path from "node:path";
import fg from "fast-glob";
import fs from "fs-extra";

export const SYNC_PATTERNS = ["PCA_INDEX.md", "AGENTS.md", "README.md", "pca/**/*.md"];

export const IGNORE_PATTERNS = [
  "node_modules/**",
  "dist/**",
  "build/**",
  ".next/**",
  ".git/**",
  ".env",
  "*.key",
  "*.pem",
  "logs/**",
];

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function relativePosix(root: string, filePath: string): string {
  return toPosixPath(path.relative(root, filePath));
}

export async function writeFileIfMissing(filePath: string, content: string): Promise<"created" | "exists"> {
  if (await fs.pathExists(filePath)) {
    return "exists";
  }

  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
  return "created";
}

export async function listSyncFiles(root: string): Promise<string[]> {
  const files = await fg(SYNC_PATTERNS, {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    dot: true,
    ignore: IGNORE_PATTERNS,
  });

  return files.sort((a, b) => relativePosix(root, a).localeCompare(relativePosix(root, b)));
}

export async function readMarkdownForUpload(root: string, filePath: string): Promise<string> {
  const rel = relativePosix(root, filePath);
  const content = await fs.readFile(filePath, "utf8");

  return [`Source Path: ${rel}`, "", content].join("\n");
}

export function timestampForLog(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function dateStamp(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
=== END FILE ===

=== FILE: src/core/memory-sync.ts ===
import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { requireAuthSession } from "./auth.js";
import { loadConfig } from "./config.js";
import { listSyncFiles, readMarkdownForUpload, relativePosix, timestampForLog } from "./files.js";
import { ensureValidOpenAIKey } from "./openai-key.js";
import { uploadMarkdownToVectorStore } from "./openai.js";

export type SyncResult = {
  vectorStoreId: string;
  syncedCount: number;
  failed: Array<{ path: string; error: string }>;
};

export async function syncMemory(root: string): Promise<SyncResult> {
  const config = await loadConfig(root);
  requireAuthSession();
  await ensureValidOpenAIKey();
  const files = await listSyncFiles(root);
  const failed: Array<{ path: string; error: string }> = [];
  let syncedCount = 0;

  for (const filePath of files) {
    const rel = relativePosix(root, filePath);

    try {
      const content = await readMarkdownForUpload(root, filePath);
      await uploadMarkdownToVectorStore({
        vectorStoreId: config.vectorStoreId,
        fileName: rel,
        sourcePath: rel,
        content,
      });
      syncedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ path: rel, error: message });
    }
  }

  await appendSyncLog(root, config.vectorStoreId, syncedCount, failed);

  return {
    vectorStoreId: config.vectorStoreId,
    syncedCount,
    failed,
  };
}

async function appendSyncLog(
  root: string,
  vectorStoreId: string,
  syncedCount: number,
  failed: Array<{ path: string; error: string }>,
): Promise<void> {
  const logPath = path.join(root, "pca", "rag", "sync-log.md");
  await fs.ensureDir(path.dirname(logPath));

  const failureLines = failed.length
    ? ["- Failed files:", ...failed.map((item) => `  - ${item.path}: ${item.error}`)]
    : [];

  const entry = [
    `## ${timestampForLog()}`,
    "- Sync completed",
    `- Files synced: ${syncedCount}`,
    `- Vector store: ${vectorStoreId}`,
    "- TODO(v2): add vector store deduplication/replacement with stable local path to file mapping.",
    ...failureLines,
    "",
  ].join("\n");

  await fs.appendFile(logPath, entry, "utf8");

  if (failed.length) {
    console.error(chalk.yellow(`Sync completed with ${failed.length} failed file(s).`));
  }
}
=== END FILE ===

=== FILE: src/core/openai.ts ===
import { basename } from "node:path";
import OpenAI, { toFile } from "openai";
import { requireAuthSession } from "./auth.js";
import { requireOpenAIKeySync } from "./openai-key.js";

export type VectorSearchResult = {
  path: string;
  text: string;
  score?: number;
};

export function getOpenAIClient(): OpenAI {
  requireAuthSession();
  return new OpenAI({
    apiKey: requireOpenAIKeySync(),
  });
}

export async function createVectorStore(name: string): Promise<string> {
  const client = getOpenAIClient();
  const vectorStore = await client.vectorStores.create({ name });
  return vectorStore.id;
}

export async function uploadMarkdownToVectorStore(args: {
  vectorStoreId: string;
  fileName: string;
  sourcePath: string;
  content: string;
}): Promise<string> {
  const client = getOpenAIClient();
  const upload = await toFile(Buffer.from(args.content, "utf8"), basename(args.fileName), {
    type: "text/markdown",
  });

  const file = await client.files.create({
    file: upload,
    purpose: "assistants",
  });

  await client.vectorStores.files.createAndPoll(args.vectorStoreId, {
    file_id: file.id,
    attributes: {
      path: args.sourcePath,
      source: "pca-cli",
    },
  });

  return file.id;
}

export async function searchVectorStore(args: {
  vectorStoreId: string;
  query: string;
  limit: number;
}): Promise<VectorSearchResult[]> {
  const client = getOpenAIClient();
  const response = await client.vectorStores.search(args.vectorStoreId, {
    query: args.query,
    max_num_results: args.limit,
  });

  const data = Array.isArray(response.data) ? response.data : [];

  return data.map((item, index) => {
    const itemWithShape = item as {
      filename?: string;
      file_id?: string;
      score?: number;
      attributes?: Record<string, unknown>;
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = itemWithShape.content?.map((part) => part.text ?? "").filter(Boolean).join("\n\n") ?? "";
    const path =
      typeof itemWithShape.attributes?.path === "string"
        ? itemWithShape.attributes.path
        : extractSourcePath(text) ?? itemWithShape.filename ?? itemWithShape.file_id ?? `result-${index + 1}`;

    return {
      path,
      text,
      score: itemWithShape.score,
    };
  });
}

function extractSourcePath(text: string): string | undefined {
  const match = text.match(/^Source Path:\s*(.+)$/m);
  return match?.[1]?.trim();
}
=== END FILE ===

=== FILE: src/core/openai-key.ts ===
import OpenAI from "openai";
import { clearOpenAIKey, getOpenAIKey, getOpenAIKeySync, saveOpenAIKey } from "./secrets.js";

export type OpenAIKeyValidation =
  | { ok: true }
  | { ok: false; status?: number; message: string };

export async function validateOpenAIKey(apiKey: string): Promise<OpenAIKeyValidation> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, message: "OpenAI API key cannot be empty." };
  }

  if (process.env.PCA_SKIP_OPENAI_VALIDATION === "1") {
    return { ok: true };
  }

  const client = new OpenAI({ apiKey: trimmed });

  try {
    await client.models.list();
    await client.vectorStores.list({ limit: 1 });
    return { ok: true };
  } catch (error) {
    const status = getStatus(error);
    if (status === 401) {
      return { ok: false, status, message: "Invalid OpenAI API key. Please check and try again." };
    }

    if (status === 403) {
      return {
        ok: false,
        status,
        message: "API key is valid but does not have enough permissions for PCA.",
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status, message };
  }
}

export async function ensureValidOpenAIKey(): Promise<string> {
  const key = await getOpenAIKey();
  if (!key) {
    throw new Error(["OpenAI API key is not configured.", "Run: pca setup"].join("\n"));
  }

  const validation = await validateOpenAIKey(key);
  if (!validation.ok) {
    await clearOpenAIKey();
    throw new Error(["OpenAI API key is invalid or expired.", "Run: pca setup"].join("\n"));
  }

  return key;
}

export function requireOpenAIKeySync(): string {
  const key = getOpenAIKeySync();
  if (!key) {
    throw new Error(["OpenAI API key is not configured.", "Run: pca setup"].join("\n"));
  }

  return key;
}

export async function saveValidatedOpenAIKey(apiKey: string): Promise<void> {
  const validation = await validateOpenAIKey(apiKey);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  await saveOpenAIKey(apiKey);
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}
=== END FILE ===

=== FILE: src/core/project-env.ts ===
import path from "node:path";
import fs from "fs-extra";
import { getProjectRoot } from "./config.js";

const OPENAI_KEY = "OPENAI_API_KEY";

export function getProjectEnvPath(root = getProjectRoot()): string {
  return path.join(root, ".env");
}

export async function getProjectEnvOpenAIKey(root = getProjectRoot()): Promise<string | undefined> {
  const values = await readEnvValues(getProjectEnvPath(root));
  return values[OPENAI_KEY];
}

export async function removeProjectEnvOpenAIKey(root = getProjectRoot()): Promise<void> {
  const envPath = getProjectEnvPath(root);
  if (!(await fs.pathExists(envPath))) {
    return;
  }

  const lines = (await fs.readFile(envPath, "utf8")).split(/\r?\n/);
  const next = lines.filter((line) => !new RegExp(`^\\s*${OPENAI_KEY}\\s*=`).test(line));
  await fs.writeFile(envPath, `${next.filter(Boolean).join("\n")}${next.some(Boolean) ? "\n" : ""}`, "utf8");
}

async function readEnvValues(envPath: string): Promise<Record<string, string>> {
  if (!(await fs.pathExists(envPath))) {
    return {};
  }

  const content = await fs.readFile(envPath, "utf8");
  const values: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    values[match[1]] = unquote(match[2] ?? "");
  }

  return values;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}
=== END FILE ===

=== FILE: src/core/project-status.ts ===
import path from "node:path";
import fs from "fs-extra";
import { getConfigPath } from "./config.js";

export type LocalProjectStatus = {
  hasIndex: boolean;
  hasAgents: boolean;
  hasProjectConfig: boolean;
  hasPcaFolder: boolean;
  state: "initialized" | "partial" | "not-initialized";
};

export async function getLocalProjectStatus(root: string): Promise<LocalProjectStatus> {
  const hasIndex = await fs.pathExists(path.join(root, "PCA_INDEX.md"));
  const hasAgents = await fs.pathExists(path.join(root, "AGENTS.md"));
  const hasProjectConfig = await fs.pathExists(getConfigPath(root));
  const hasPcaFolder = await fs.pathExists(path.join(root, "pca"));
  const checks = [hasIndex, hasAgents, hasProjectConfig, hasPcaFolder];

  return {
    hasIndex,
    hasAgents,
    hasProjectConfig,
    hasPcaFolder,
    state: checks.every(Boolean) ? "initialized" : checks.some(Boolean) ? "partial" : "not-initialized",
  };
}

export function requireInitializedLocalProject(status: LocalProjectStatus): void {
  if (status.state === "initialized") {
    return;
  }

  throw new Error(
    [
      status.state === "partial" ? "PCA project is partially initialized." : "PCA project is not initialized.",
      "Run `pca init` before recording context commits.",
    ].join("\n"),
  );
}
=== END FILE ===

=== FILE: src/core/prompt.ts ===
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

export async function promptText(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

export async function promptSecret(question: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    return promptText(question);
  }

  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
    };

    const onData = (chunk: string) => {
      if (chunk === "\u0003") {
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }

      if (chunk === "\r" || chunk === "\n") {
        cleanup();
        resolve(value);
        return;
      }

      if (chunk === "\u007f" || chunk === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }

      value += chunk;
      stdout.write("*");
    };

    stdin.on("data", onData);
  });
}
=== END FILE ===

=== FILE: src/core/prompt-builder.ts ===
import type { VectorSearchResult } from "./openai.js";

export type TaskType = "simple" | "normal" | "architecture" | "audit" | "visual" | "bug";

export const TASK_LIMITS: Record<TaskType, number> = {
  simple: 3,
  normal: 5,
  architecture: 8,
  audit: 10,
  bug: 5,
  visual: 6,
};

export function classifyTask(task: string): TaskType {
  const normalized = task.toLowerCase();

  if (/\b(ui|diseÃ±o|landing|mobile|screenshot|visual|mockup)\b/.test(normalized)) {
    return "visual";
  }

  if (/\b(arquitectura|stack|database|auth|infra)\b/.test(normalized)) {
    return "architecture";
  }

  if (/\b(bug|error|fix|arreglar)\b/.test(normalized)) {
    return "bug";
  }

  if (/\b(audit|auditar|review)\b/.test(normalized)) {
    return "audit";
  }

  return "normal";
}

export function buildQueryOutput(query: string, results: VectorSearchResult[]): string {
  const sections = results.length
    ? results
        .map((result, index) => `### ${index + 1}. [${result.path}]\n${cleanChunk(result.text)}`)
        .join("\n\n")
    : "No relevant context was retrieved.";

  return `# PCA Query Result

## Query
${query}

## Retrieved Context

${sections}
`;
}

export function buildTaskContext(task: string, type: TaskType, results: VectorSearchResult[]): string {
  const summary = buildDeterministicSummary(results);
  const context = results.length
    ? results
        .map((result, index) => `### ${index + 1}. [${result.path}]\n${cleanChunk(result.text)}`)
        .join("\n\n")
    : "No relevant context was retrieved. PCA sin RAG no opera; run `pca sync` and retry.";

  return `# PCA Task Context

## Task
${task}

## Task Type
${type}

## Runtime Rule
Do not read the full PCA folder.
Use this retrieved context only, plus directly relevant source files.

## Retrieved Context Summary
${summary}

## Relevant Context
${context}

## Agent Instructions
- Scope estricto.
- No actualizar roadmap/changelog todavÃ­a.
- No inventar decisiones.
- Revisar archivos de cÃ³digo directamente relacionados.
- Validar antes de decir completado.
- Al terminar preguntar: Â¿Doy esta tarea por terminada?
`;
}

function buildDeterministicSummary(results: VectorSearchResult[]): string {
  if (!results.length) {
    return "- No retrieved chunks. Run `pca sync` and retry the task.";
  }

  return results
    .slice(0, 3)
    .map((result) => {
      const title = firstMarkdownTitle(result.text);
      const firstLine = firstRelevantLine(result.text);
      const details = [title, firstLine].filter(Boolean).join(" - ");
      return `- ${result.path}${details ? `: ${details}` : ""}`;
    })
    .join("\n");
}

function firstMarkdownTitle(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#{1,3}\s+/.test(line))
    ?.replace(/^#{1,3}\s+/, "");
}

function firstRelevantLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Source Path:") && !/^#{1,6}\s+/.test(line))[0]
    ?.slice(0, 180);
}

function cleanChunk(text: string): string {
  return text.trim() || "[empty chunk]";
}
=== END FILE ===

=== FILE: src/core/readiness.ts ===
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
=== END FILE ===

=== FILE: src/core/readiness-state.ts ===
import fs from "fs-extra";
import { loadAuthSession } from "./auth.js";
import { getAuthBaseUrl, getConfigPath, type PCAProjectConfig } from "./config.js";
import { getOpenAIKey } from "./secrets.js";
import { getLocalProjectStatus } from "./project-status.js";
import { derivePCAReadiness, type PCADerivedReadiness } from "./readiness.js";

export async function loadDerivedReadiness(root: string): Promise<PCADerivedReadiness> {
  const [session, authBaseUrl, openAIKey, projectStatus, projectConfig] = await Promise.all([
    loadAuthSession(),
    getAuthBaseUrl(),
    getOpenAIKey(),
    getLocalProjectStatus(root),
    readProjectConfigSafely(getConfigPath(root)),
  ]);

  return derivePCAReadiness({
    hasAuthSession: Boolean(session),
    hasAuthBaseUrl: Boolean(authBaseUrl),
    hasOpenAIKey: Boolean(openAIKey),
    projectState: projectStatus.state,
    vectorStoreId: projectConfig?.vectorStoreId,
  });
}

export async function readProjectConfigSafely(configPath: string): Promise<Partial<PCAProjectConfig> | undefined> {
  try {
    if (!(await fs.pathExists(configPath))) {
      return undefined;
    }

    return (await fs.readJson(configPath)) as Partial<PCAProjectConfig>;
  } catch {
    return undefined;
  }
}
=== END FILE ===

=== FILE: src/core/retrieval.ts ===
import chalk from "chalk";
import { requireAuthSession } from "./auth.js";
import { loadConfig } from "./config.js";
import { ensureValidOpenAIKey } from "./openai-key.js";
import { searchVectorStore, type VectorSearchResult } from "./openai.js";

export async function retrieveContext(args: {
  root: string;
  query: string;
  limit: number;
}): Promise<VectorSearchResult[]> {
  const config = await loadConfig(args.root);
  requireAuthSession();
  await ensureValidOpenAIKey();

  try {
    return await searchVectorStore({
      vectorStoreId: config.vectorStoreId,
      query: args.query,
      limit: args.limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        chalk.red("Vector Store retrieval failed."),
        "PCA sin RAG no opera.",
        `Vector store: ${config.vectorStoreId}`,
        message,
      ].join("\n"),
    );
  }
}
=== END FILE ===

=== FILE: src/core/secrets.ts ===
import path from "node:path";
import fs from "fs-extra";
import { getPCAHome, maskOpenAIKey } from "./config.js";

export type PCASecrets = {
  openaiApiKey?: string;
  updatedAt?: string;
};

export function getSecretsPath(): string {
  return path.join(getPCAHome(), "secrets.json");
}

export async function loadSecrets(): Promise<PCASecrets> {
  const secretsPath = getSecretsPath();
  if (!(await fs.pathExists(secretsPath))) {
    return {};
  }

  return (await fs.readJson(secretsPath)) as PCASecrets;
}

export async function saveOpenAIKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("OPENAI_API_KEY cannot be empty.");
  }

  const secrets = await loadSecrets();
  await writeSecrets({
    ...secrets,
    openaiApiKey: trimmed,
    updatedAt: new Date().toISOString(),
  });
  process.env.OPENAI_API_KEY = trimmed;
}

export async function clearOpenAIKey(): Promise<void> {
  const secrets = await loadSecrets();
  delete secrets.openaiApiKey;
  secrets.updatedAt = new Date().toISOString();
  await writeSecrets(secrets);
  delete process.env.OPENAI_API_KEY;
}

export async function getOpenAIKey(): Promise<string | undefined> {
  return process.env.OPENAI_API_KEY?.trim() || (await loadSecrets()).openaiApiKey?.trim();
}

export function getOpenAIKeySync(): string | undefined {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }

  const secretsPath = getSecretsPath();
  if (!fs.pathExistsSync(secretsPath)) {
    return undefined;
  }

  const secrets = fs.readJsonSync(secretsPath) as PCASecrets;
  return secrets.openaiApiKey?.trim();
}

export async function getOpenAIKeyStatus(): Promise<"configured" | "missing"> {
  return (await getOpenAIKey()) ? "configured" : "missing";
}

export async function getMaskedOpenAIKey(): Promise<string | undefined> {
  const key = await getOpenAIKey();
  return key ? maskOpenAIKey(key) : undefined;
}

async function writeSecrets(secrets: PCASecrets): Promise<void> {
  const secretsPath = getSecretsPath();
  await fs.ensureDir(path.dirname(secretsPath));
  await fs.writeJson(secretsPath, secrets, { spaces: 2 });
  try {
    await fs.chmod(secretsPath, 0o600);
  } catch {
    // Best-effort only. Windows ACLs are managed by the OS/user profile.
  }
}
=== END FILE ===

=== FILE: src/core/version.ts ===
export const PCA_VERSION = "0.3.1";
=== END FILE ===

=== FILE: package.json ===
{
  "name": "@quantpartners/pca",
  "version": "0.3.1",
  "description": "Persistent Context Architecture CLI for AI-native development",
  "type": "module",
  "bin": {
    "pca": "dist/index.js"
  },
  "files": [
    "dist",
    "README.md",
    ".env.example"
  ],
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "node scripts/clean-dist.js && tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "npm run build && node --test tests/*.test.mjs",
    "prepack": "npm run build",
    "pack:dry": "npm pack --dry-run"
  },
  "keywords": [
    "pca",
    "persistent-context",
    "rag",
    "cli",
    "ai",
    "codex",
    "context",
    "vector-store",
    "openai"
  ],
  "dependencies": {
    "chalk": "^5.6.2",
    "commander": "^14.0.3",
    "dotenv": "^17.4.2",
    "fast-glob": "^3.3.3",
    "fs-extra": "^11.3.5",
    "openai": "^6.37.0"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4",
    "@types/node": "^22.15.0",
    "tsx": "^4.22.0",
    "typescript": "^6.0.3"
  },
  "engines": {
    "node": ">=20"
  },
  "publishConfig": {
    "access": "public"
  }
}
=== END FILE ===


