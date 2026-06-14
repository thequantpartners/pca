import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "index.js");

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `pca-${name}-`));
}

function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.OPENAI_API_KEY;
  delete env.PCA_AUTH_BASE_URL;
  return env;
}

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: cleanEnv(options.env),
    encoding: "utf8",
    input: options.input,
  });

  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function initGitRepo(root) {
  runGit(["init"], root);
  runGit(["config", "user.email", "test@example.com"], root);
  runGit(["config", "user.name", "PCA Test"], root);
  fs.writeFileSync(path.join(root, "initial.txt"), "initial\n");
  runGit(["add", "initial.txt"], root);
  runGit(["commit", "-m", "initial"], root);
  runGit(["branch", "-M", "main"], root);
}

function writeInitializedProject(root) {
  writeProjectWithVectorStore(root, "vs_test");
}

function writeProjectWithVectorStore(root, vectorStoreId) {
  fs.mkdirSync(path.join(root, ".pca"), { recursive: true });
  fs.mkdirSync(path.join(root, "pca"), { recursive: true });
  fs.writeFileSync(path.join(root, "PCA_INDEX.md"), "# Index\n");
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Agents\n");
  fs.writeFileSync(path.join(root, ".pca", "config.json"), JSON.stringify({ vectorStoreId }));
}

function writeAuthSession(pcaHome, values = {}) {
  fs.writeFileSync(
    path.join(pcaHome, "auth.json"),
    JSON.stringify({
      token: "local",
      userEmail: "test@example.com",
      createdAt: new Date().toISOString(),
      ...values,
    }),
  );
}

function writeSecrets(pcaHome, values = {}) {
  fs.writeFileSync(path.join(pcaHome, "secrets.json"), JSON.stringify({ openaiApiKey: "sk-test", ...values }));
}

function writeGlobalConfig(pcaHome, values = {}) {
  fs.writeFileSync(path.join(pcaHome, "config.json"), JSON.stringify(values));
}

function writeProjectEnv(root, content) {
  fs.writeFileSync(path.join(root, ".env"), content);
}

function readContextRows(root) {
  const db = new Database(path.join(root, ".pca", "pca.db"), { readonly: true });
  try {
    return db
      .prepare("SELECT branch, message, type, status FROM context_commits ORDER BY timestamp ASC, id ASC")
      .all();
  } finally {
    db.close();
  }
}

test("routes built-in and custom help commands", () => {
  const root = tempDir("routing");
  const env = { PCA_HOME: tempDir("home") };

  const builtInHelp = runCli(["--help"], { cwd: root, env });
  assert.equal(builtInHelp.code, 0);
  assert.match(builtInHelp.stdout, /Commands:/);
  assert.match(builtInHelp.stdout, /doctor/);
  assert.match(builtInHelp.stdout, /config/);
  assert.match(builtInHelp.stdout, /status/);
  assert.match(builtInHelp.stdout, /commit/);
  assert.match(builtInHelp.stdout, /staged/);
  assert.match(builtInHelp.stdout, /logs/);

  const customHelp = runCli(["help"], { cwd: root, env });
  assert.equal(customHelp.code, 0);
  assert.match(customHelp.stdout, /CORE/);
  assert.match(customHelp.stdout, /GIT SYNC \(automatic\)/);
  assert.match(customHelp.stdout, /MAINTENANCE/);
  assert.match(customHelp.stdout, /AUTH/);
  assert.match(customHelp.stdout, /pca staged/);
  assert.match(customHelp.stdout, /pca sync/);
  assert.doesNotMatch(customHelp.stdout, /pca task/);
  assert.doesNotMatch(customHelp.stdout, /pca visual/);

  const unknown = runCli(["not-a-command"], { cwd: root, env });
  assert.notEqual(unknown.code, 0);
  assert.match(unknown.stderr, /unknown command/i);
});

test("config get, set, and clear manage auth-base-url globally", () => {
  const root = tempDir("config");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };

  const missing = runCli(["config", "get", "auth-base-url"], { cwd: root, env });
  assert.equal(missing.code, 0);
  assert.match(missing.stdout, /^missing\s*$/);

  const set = runCli(["config", "set", "auth-base-url", "https://auth.example.test"], { cwd: root, env });
  assert.equal(set.code, 0, set.stderr);
  assert.match(set.stdout, /PCA auth base URL saved/);

  const savedConfig = JSON.parse(fs.readFileSync(path.join(pcaHome, "config.json"), "utf8"));
  assert.equal(savedConfig.authBaseUrl, "https://auth.example.test");

  const get = runCli(["config", "get", "auth-base-url"], { cwd: root, env });
  assert.equal(get.code, 0);
  assert.match(get.stdout, /https:\/\/auth\.example\.test/);

  const clear = runCli(["config", "clear", "auth-base-url"], { cwd: root, env });
  assert.equal(clear.code, 0);
  assert.match(clear.stdout, /PCA auth base URL removed/);

  const cleared = runCli(["config", "get", "auth-base-url"], { cwd: root, env });
  assert.equal(cleared.code, 0);
  assert.match(cleared.stdout, /^missing\s*$/);
});

test("global auth and secrets paths resolve under PCA_HOME", async () => {
  const pcaHome = tempDir("paths");
  const previousHome = process.env.PCA_HOME;
  process.env.PCA_HOME = pcaHome;

  try {
    const config = await import("../dist/core/config.js");
    const auth = await import("../dist/core/auth.js");
    const secrets = await import("../dist/core/secrets.js");

    assert.equal(config.getPCAHome(), pcaHome);
    assert.equal(config.getGlobalConfigPath(), path.join(pcaHome, "config.json"));
    assert.equal(auth.getAuthPath(), path.join(pcaHome, "auth.json"));
    assert.equal(secrets.getSecretsPath(), path.join(pcaHome, "secrets.json"));
  } finally {
    if (previousHome === undefined) {
      delete process.env.PCA_HOME;
    } else {
      process.env.PCA_HOME = previousHome;
    }
  }
});

test("derivePCAReadiness covers local-only, byok, cloud, and partial states from existing state", async () => {
  const { derivePCAReadiness } = await import("../dist/core/readiness.js");

  const cases = [
    {
      name: "empty machine state defaults to local-only",
      input: {
        hasAuthSession: false,
        hasAuthBaseUrl: false,
        hasOpenAIKey: false,
        projectState: "not-initialized",
      },
      expected: {
        currentMode: "local-only",
        projectInitialized: false,
        projectUsesLocalOnlyVectorStore: false,
        projectHasCloudVectorStore: false,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: false,
          byokConfigured: false,
          cloudAuthConfigured: false,
          cloudSessionActive: false,
          cloudVectorCommandsReady: false,
        },
      },
    },
    {
      name: "initialized local-only project stays local-only",
      input: {
        hasAuthSession: false,
        hasAuthBaseUrl: false,
        hasOpenAIKey: false,
        projectState: "initialized",
        vectorStoreId: "local-only",
      },
      expected: {
        currentMode: "local-only",
        projectInitialized: true,
        projectUsesLocalOnlyVectorStore: true,
        projectHasCloudVectorStore: false,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: true,
          byokConfigured: false,
          cloudAuthConfigured: false,
          cloudSessionActive: false,
          cloudVectorCommandsReady: false,
        },
      },
    },
    {
      name: "openai key alone maps to byok",
      input: {
        hasAuthSession: false,
        hasAuthBaseUrl: false,
        hasOpenAIKey: true,
        projectState: "not-initialized",
      },
      expected: {
        currentMode: "byok",
        projectInitialized: false,
        projectUsesLocalOnlyVectorStore: false,
        projectHasCloudVectorStore: false,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: false,
          byokConfigured: true,
          cloudAuthConfigured: false,
          cloudSessionActive: false,
          cloudVectorCommandsReady: false,
        },
      },
    },
    {
      name: "auth base url alone is partial",
      input: {
        hasAuthSession: false,
        hasAuthBaseUrl: true,
        hasOpenAIKey: false,
        projectState: "not-initialized",
      },
      expected: {
        currentMode: "partial",
        projectInitialized: false,
        projectUsesLocalOnlyVectorStore: false,
        projectHasCloudVectorStore: false,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: false,
          byokConfigured: false,
          cloudAuthConfigured: true,
          cloudSessionActive: false,
          cloudVectorCommandsReady: false,
        },
      },
    },
    {
      name: "auth session alone is partial",
      input: {
        hasAuthSession: true,
        hasAuthBaseUrl: false,
        hasOpenAIKey: false,
        projectState: "not-initialized",
      },
      expected: {
        currentMode: "partial",
        projectInitialized: false,
        projectUsesLocalOnlyVectorStore: false,
        projectHasCloudVectorStore: false,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: false,
          byokConfigured: false,
          cloudAuthConfigured: false,
          cloudSessionActive: true,
          cloudVectorCommandsReady: false,
        },
      },
    },
    {
      name: "cloud vector readiness requires session, key, and non-local vector store",
      input: {
        hasAuthSession: true,
        hasAuthBaseUrl: true,
        hasOpenAIKey: true,
        projectState: "initialized",
        vectorStoreId: "vs_ready",
      },
      expected: {
        currentMode: "cloud",
        projectInitialized: true,
        projectUsesLocalOnlyVectorStore: false,
        projectHasCloudVectorStore: true,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: true,
          byokConfigured: true,
          cloudAuthConfigured: true,
          cloudSessionActive: true,
          cloudVectorCommandsReady: true,
        },
      },
    },
    {
      name: "initialized cloud vector project without credentials is partial",
      input: {
        hasAuthSession: false,
        hasAuthBaseUrl: false,
        hasOpenAIKey: false,
        projectState: "initialized",
        vectorStoreId: "vs_existing",
      },
      expected: {
        currentMode: "partial",
        projectInitialized: true,
        projectUsesLocalOnlyVectorStore: false,
        projectHasCloudVectorStore: true,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: true,
          byokConfigured: false,
          cloudAuthConfigured: false,
          cloudSessionActive: false,
          cloudVectorCommandsReady: false,
        },
      },
    },
    {
      name: "partial project reports partial mode",
      input: {
        hasAuthSession: false,
        hasAuthBaseUrl: false,
        hasOpenAIKey: false,
        projectState: "partial",
        vectorStoreId: "local-only",
      },
      expected: {
        currentMode: "partial",
        projectInitialized: false,
        projectUsesLocalOnlyVectorStore: false,
        projectHasCloudVectorStore: false,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: false,
          byokConfigured: false,
          cloudAuthConfigured: false,
          cloudSessionActive: false,
          cloudVectorCommandsReady: false,
        },
      },
    },
    {
      name: "auth session with auth base url but no key is partial",
      input: {
        hasAuthSession: true,
        hasAuthBaseUrl: true,
        hasOpenAIKey: false,
        projectState: "not-initialized",
      },
      expected: {
        currentMode: "partial",
        projectInitialized: false,
        projectUsesLocalOnlyVectorStore: false,
        projectHasCloudVectorStore: false,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: false,
          byokConfigured: false,
          cloudAuthConfigured: true,
          cloudSessionActive: true,
          cloudVectorCommandsReady: false,
        },
      },
    },
    {
      name: "initialized project with missing vectorStoreId is partial",
      input: {
        hasAuthSession: false,
        hasAuthBaseUrl: false,
        hasOpenAIKey: false,
        projectState: "initialized",
      },
      expected: {
        currentMode: "partial",
        projectInitialized: true,
        projectUsesLocalOnlyVectorStore: false,
        projectHasCloudVectorStore: false,
        readiness: {
          offlineCommandsAvailable: true,
          offlineLocalMemoryReady: true,
          byokConfigured: false,
          cloudAuthConfigured: false,
          cloudSessionActive: false,
          cloudVectorCommandsReady: false,
        },
      },
    },
  ];

  for (const testCase of cases) {
    assert.deepEqual(derivePCAReadiness(testCase.input), {
      ...testCase.expected,
      projectState: testCase.input.projectState,
    }, testCase.name);
  }
});

test("doctor groups diagnostics without real OpenAI or Clerk", () => {
  const root = tempDir("doctor");
  const env = { PCA_HOME: tempDir("home") };

  const result = runCli(["doctor"], { cwd: root, env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Global environment/);
  assert.match(result.stdout, /Derived readiness/);
  assert.match(result.stdout, /PCA auth/);
  assert.match(result.stdout, /OpenAI API key/);
  assert.match(result.stdout, /Project memory/);
  assert.match(result.stdout, /Vector store/);
  assert.match(result.stdout, /Backend auth config/);
  assert.match(result.stdout, /Validation: Skipped in doctor summary/);
  assert.match(result.stdout, /PCA project: Not initialized/);
  assert.doesNotMatch(result.stderr, /OpenAI|Clerk/i);
});

test("whoami, doctor, and config show local-only readiness for an offline project", () => {
  const root = tempDir("phase2-local");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };
  writeProjectWithVectorStore(root, "local-only");

  const whoami = runCli(["whoami"], { cwd: root, env });
  assert.equal(whoami.code, 0, whoami.stderr);
  assert.match(whoami.stdout, /Mode: local-only/);
  assert.match(whoami.stdout, /Offline local commands: available/);
  assert.match(whoami.stdout, /OpenAI\/BYOK readiness: not configured/);
  assert.match(whoami.stdout, /Cloud session: inactive/);
  assert.match(whoami.stdout, /Cloud\/vector commands: not ready/);

  const doctor = runCli(["doctor"], { cwd: root, env });
  assert.equal(doctor.code, 0, doctor.stderr);
  assert.match(doctor.stdout, /Mode: local-only/);
  assert.match(doctor.stdout, /Offline local commands: available/);
  assert.match(doctor.stdout, /Run `pca setup` when you want OpenAI-backed commands/);
  assert.doesNotMatch(doctor.stdout, /Run `pca login`/);

  const config = runCli(["config"], { cwd: root, env });
  assert.equal(config.code, 0, config.stderr);
  assert.match(config.stdout, /Mode: local-only/);
  assert.match(config.stdout, /Offline local commands: available/);
});

test("status surfaces show byok readiness with key only", () => {
  const root = tempDir("phase2-byok");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };
  writeSecrets(pcaHome);

  const whoami = runCli(["whoami"], { cwd: root, env });
  assert.equal(whoami.code, 0, whoami.stderr);
  assert.match(whoami.stdout, /Mode: byok/);
  assert.match(whoami.stdout, /OpenAI\/BYOK readiness: configured/);
  assert.match(whoami.stdout, /Cloud auth base URL: not configured/);

  const config = runCli(["config"], { cwd: root, env });
  assert.equal(config.code, 0, config.stderr);
  assert.match(config.stdout, /Mode: byok/);
  assert.match(config.stdout, /OpenAI\/BYOK readiness: configured/);
  assert.match(config.stdout, /Key: \*\*\*/);
});

test("status surfaces override doctor mode for auth base url without session", () => {
  const root = tempDir("phase2-auth-url");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };
  writeGlobalConfig(pcaHome, { authBaseUrl: "https://auth.example.test" });

  const whoami = runCli(["whoami"], { cwd: root, env });
  assert.equal(whoami.code, 0, whoami.stderr);
  assert.match(whoami.stdout, /Mode: partial/);
  assert.match(whoami.stdout, /Cloud auth base URL: configured/);
  assert.match(whoami.stdout, /Cloud session: inactive/);

  const doctor = runCli(["doctor"], { cwd: root, env });
  assert.equal(doctor.code, 0, doctor.stderr);
  assert.match(doctor.stdout, /Mode: local-only/);
  assert.match(doctor.stdout, /Run `pca init` to enable offline local memory/);
});

test("status surfaces show partial mode for auth session without key", () => {
  const root = tempDir("phase2-auth-session");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };
  writeGlobalConfig(pcaHome, { authBaseUrl: "https://auth.example.test" });
  writeAuthSession(pcaHome, { authBaseUrl: "https://auth.example.test" });

  const whoami = runCli(["whoami"], { cwd: root, env });
  assert.equal(whoami.code, 0, whoami.stderr);
  assert.match(whoami.stdout, /Mode: partial/);
  assert.match(whoami.stdout, /Cloud session: active/);
  assert.match(whoami.stdout, /OpenAI\/BYOK readiness: not configured/);

  const config = runCli(["config"], { cwd: root, env });
  assert.equal(config.code, 0, config.stderr);
  assert.match(config.stdout, /Mode: partial/);
  assert.match(config.stdout, /Cloud session: active/);
});

test("status surfaces show cloud readiness for a cloud vector project with complete credentials", () => {
  const root = tempDir("phase2-cloud");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };
  writeProjectWithVectorStore(root, "vs_ready");
  writeGlobalConfig(pcaHome, { authBaseUrl: "https://auth.example.test" });
  writeAuthSession(pcaHome, { authBaseUrl: "https://auth.example.test" });
  writeSecrets(pcaHome);

  const whoami = runCli(["whoami"], { cwd: root, env });
  assert.equal(whoami.code, 0, whoami.stderr);
  assert.match(whoami.stdout, /Mode: cloud/);
  assert.match(whoami.stdout, /Cloud auth base URL: configured/);
  assert.match(whoami.stdout, /Cloud session: active/);
  assert.match(whoami.stdout, /Cloud\/vector commands: ready/);

  const doctor = runCli(["doctor"], { cwd: root, env });
  assert.equal(doctor.code, 0, doctor.stderr);
  assert.match(doctor.stdout, /Mode: cloud/);
  assert.match(doctor.stdout, /Cloud\/vector commands: ready/);
  assert.match(doctor.stdout, /Run `pca sync`/);
  assert.match(doctor.stdout, /Run `pca task "your task"`/);
});

test("status surfaces show local-only for no project and no credentials", () => {
  const root = tempDir("phase2-empty");
  const env = { PCA_HOME: tempDir("home") };

  const whoami = runCli(["whoami"], { cwd: root, env });
  assert.equal(whoami.code, 0, whoami.stderr);
  assert.match(whoami.stdout, /Mode: local-only/);
  assert.match(whoami.stdout, /Offline local commands: available/);
  assert.match(whoami.stdout, /Cloud auth base URL: not configured/);

  const config = runCli(["config"], { cwd: root, env });
  assert.equal(config.code, 0, config.stderr);
  assert.match(config.stdout, /Mode: local-only/);
  assert.match(config.stdout, /OpenAI\/BYOK readiness: not configured/);
});

test("login with existing auth session is auth-only and does not require openai setup", () => {
  const root = tempDir("login-auth-only");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };
  writeAuthSession(pcaHome);

  const result = runCli(["login"], { cwd: root, env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Already logged in: test@example\.com/);
  assert.match(result.stdout, /PCA cloud auth is ready/);
  assert.match(result.stdout, /pca setup/);
  assert.match(result.stdout, /pca config set openai-api-key/);
  assert.doesNotMatch(result.stdout, /OpenAI API key not configured/);
  assert.doesNotMatch(result.stdout, /Validating OpenAI API key/);
});

test("login missing auth-base-url shows cloud-specific guidance without blocking local mode", () => {
  const root = tempDir("login-missing-auth-url");
  const env = { PCA_HOME: tempDir("home") };

  const result = runCli(["login"], { cwd: root, env });

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /PCA cloud auth backend is not configured/);
  assert.match(result.stderr, /pca config set auth-base-url <url>/);
  assert.match(result.stderr, /Local offline commands remain available without PCA cloud auth/);
  assert.doesNotMatch(result.stderr, /OpenAI API key not configured/);
});

test("logout clears auth but leaves openai key intact by default", () => {
  const root = tempDir("logout-default");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };
  writeAuthSession(pcaHome);
  writeSecrets(pcaHome);

  const result = runCli(["logout"], { cwd: root, env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /PCA auth session cleared/);
  assert.match(result.stdout, /PCA auth and BYOK\/OpenAI credentials are stored separately/);
  assert.match(result.stdout, /OpenAI API key left unchanged/);
  assert.match(result.stdout, /pca logout --clear-openai-key/);
  assert.equal(fs.existsSync(path.join(pcaHome, "auth.json")), false);
  const secrets = JSON.parse(fs.readFileSync(path.join(pcaHome, "secrets.json"), "utf8"));
  assert.equal(secrets.openaiApiKey, "sk-test");
});

test("logout can explicitly clear openai key too", () => {
  const root = tempDir("logout-clear-key");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };
  writeAuthSession(pcaHome);
  writeSecrets(pcaHome);

  const result = runCli(["logout", "--clear-openai-key"], { cwd: root, env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /PCA auth session cleared/);
  assert.match(result.stdout, /OpenAI API key removed from global PCA credentials/);
  assert.equal(fs.existsSync(path.join(pcaHome, "auth.json")), false);
  const secrets = JSON.parse(fs.readFileSync(path.join(pcaHome, "secrets.json"), "utf8"));
  assert.equal(secrets.openaiApiKey, undefined);
});

test("setup --mode local-only requires no auth or openai and shows offline commands", () => {
  const root = tempDir("setup-local-only");
  const env = { PCA_HOME: tempDir("home") };

  const result = runCli(["setup", "--mode", "local-only"], { cwd: root, env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Local-only setup complete/);
  assert.match(result.stdout, /Offline local commands are ready/);
  assert.match(result.stdout, /pca init/);
  assert.match(result.stdout, /pca status/);
  assert.match(result.stdout, /pca commit/);
  assert.match(result.stdout, /pca logs/);
  assert.equal(fs.existsSync(path.join(env.PCA_HOME, "auth.json")), false);
  assert.equal(fs.existsSync(path.join(env.PCA_HOME, "secrets.json")), false);
});

test("setup --mode byok --api-key validates and stores key globally", () => {
  const root = tempDir("setup-byok");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome, PCA_SKIP_OPENAI_VALIDATION: "1" };

  const result = runCli(["setup", "--mode", "byok", "--api-key", "sk-phase4"], { cwd: root, env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Validating OpenAI API key/);
  assert.match(result.stdout, /OpenAI API key valid/);
  assert.match(result.stdout, /BYOK\/OpenAI readiness is configured/);
  const secrets = JSON.parse(fs.readFileSync(path.join(pcaHome, "secrets.json"), "utf8"));
  assert.equal(secrets.openaiApiKey, "sk-phase4");
});

test("setup --mode byok without key or source fails clearly", () => {
  const root = tempDir("setup-byok-missing");
  const env = { PCA_HOME: tempDir("home") };

  const result = runCli(["setup", "--mode", "byok"], { cwd: root, env });

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /OpenAI API key is required for `pca setup --mode byok`/);
  assert.match(result.stderr, /--api-key <key>/);
});

test("setup --mode cloud with missing auth-base-url gives guidance", () => {
  const root = tempDir("setup-cloud");
  const env = { PCA_HOME: tempDir("home") };

  const result = runCli(["setup", "--mode", "cloud"], { cwd: root, env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /PCA Cloud Setup/);
  assert.match(result.stdout, /Cloud auth base URL is not configured/);
  assert.match(result.stdout, /pca config set auth-base-url <url>/);
  assert.match(result.stdout, /PCA_AUTH_BASE_URL=<url> pca login/);
  assert.match(result.stdout, /Local offline commands remain available now/);
});

test("interactive setup can choose local-only path", () => {
  const root = tempDir("setup-interactive-local");
  const env = { PCA_HOME: tempDir("home") };

  const result = runCli(["setup"], { cwd: root, env, input: "1\n" });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /PCA Setup/);
  assert.match(result.stdout, /Recommended next step: local-only/);
  assert.match(result.stdout, /Choose setup mode/);
  assert.match(result.stdout, /Local-only setup complete/);
});

test("setup --mode byok can use project env key and store it globally", () => {
  const root = tempDir("setup-migrate-env");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome, PCA_SKIP_OPENAI_VALIDATION: "1" };
  writeProjectEnv(root, "OPENAI_API_KEY=sk-from-env\n");

  const result = runCli(["setup", "--mode", "byok"], { cwd: root, env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Using OPENAI_API_KEY from project \.env for BYOK setup/);
  assert.match(result.stdout, /OpenAI API key valid/);
  const secrets = JSON.parse(fs.readFileSync(path.join(pcaHome, "secrets.json"), "utf8"));
  assert.equal(secrets.openaiApiKey, "sk-from-env");
  assert.equal(fs.readFileSync(path.join(root, ".env"), "utf8"), "OPENAI_API_KEY=sk-from-env\n");
});

test("status reports local project and credential state without network calls", () => {
  const root = tempDir("status");
  const pcaHome = tempDir("home");
  const env = { PCA_HOME: pcaHome };

  const empty = runCli(["status"], { cwd: root, env });
  assert.equal(empty.code, 0, empty.stderr);
  assert.match(empty.stdout, /PCA Status/);
  assert.match(empty.stdout, /Project: Not initialized/);
  assert.match(empty.stdout, /PCA_INDEX\.md: Missing/);
  assert.match(empty.stdout, /Context commits: 0/);
  assert.match(empty.stdout, /Latest commit: none/);
  assert.match(empty.stdout, /Auth session: missing/);
  assert.match(empty.stdout, /OpenAI API key: missing/);

  fs.writeFileSync(path.join(root, "PCA_INDEX.md"), "# Index\n");
  const partial = runCli(["status"], { cwd: root, env });
  assert.equal(partial.code, 0, partial.stderr);
  assert.match(partial.stdout, /Project: Partially initialized/);

  fs.mkdirSync(path.join(root, ".pca"), { recursive: true });
  fs.mkdirSync(path.join(root, "pca"), { recursive: true });
  fs.writeFileSync(path.join(root, "PCA_INDEX.md"), "# Index\n");
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Agents\n");
  fs.writeFileSync(path.join(root, ".pca", "config.json"), JSON.stringify({ vectorStoreId: "vs_test" }));
  fs.writeFileSync(
    path.join(pcaHome, "auth.json"),
    JSON.stringify({ token: "local", userEmail: "test@example.com", createdAt: new Date().toISOString() }),
  );
  fs.writeFileSync(path.join(pcaHome, "secrets.json"), JSON.stringify({ openaiApiKey: "sk-test" }));

  const initialized = runCli(["status"], { cwd: root, env });
  assert.equal(initialized.code, 0, initialized.stderr);
  assert.match(initialized.stdout, /Project: Initialized/);
  assert.match(initialized.stdout, /PCA_INDEX\.md: OK/);
  assert.match(initialized.stdout, /Auth session: present/);
  assert.match(initialized.stdout, /OpenAI API key: present/);
});

test("init creates local memory project without auth or OpenAI", () => {
  const root = tempDir("init-offline");
  const env = { PCA_HOME: tempDir("home") };

  const result = runCli(["init"], { cwd: root, env });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /PCA initialized/);
  assert.match(result.stdout, /Vector store: local-only/);

  assert.ok(fs.existsSync(path.join(root, "PCA_INDEX.md")));
  assert.ok(fs.existsSync(path.join(root, "AGENTS.md")));
  assert.ok(fs.existsSync(path.join(root, "pca")));

  // Verify core files under pca/
  assert.ok(fs.existsSync(path.join(root, "pca", "core", "project-brief.md")));
  assert.ok(fs.existsSync(path.join(root, "pca", "state", "roadmap.md")));
  assert.ok(fs.existsSync(path.join(root, "pca", "rag", "sync-log.md")));

  // Verify AGENTS.md templates
  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  assert.match(agents, /pca status/);
  assert.match(agents, /Detailed Crash Reporting Flow/);

  // Verify PCA_INDEX.md templates
  const pcaIndex = fs.readFileSync(path.join(root, "PCA_INDEX.md"), "utf8");
  assert.match(pcaIndex, /Core File Mapping/);

  // Verify README.md notice
  assert.ok(fs.existsSync(path.join(root, "README.md")));
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(readme, /AI AGENT NOTICE/);

  const config = JSON.parse(fs.readFileSync(path.join(root, ".pca", "config.json"), "utf8"));
  assert.equal(config.vectorStoreId, "local-only");

  const status = runCli(["status"], { cwd: root, env });
  assert.equal(status.code, 0, status.stderr);
  assert.match(status.stdout, /Project: Initialized/);
});

test("init prepends notice to existing README.md", () => {
  const root = tempDir("init-existing-readme");
  const env = { PCA_HOME: tempDir("home") };

  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "README.md"), "# Existing Project\nMy project details.\n");

  const result = runCli(["init"], { cwd: root, env });
  assert.equal(result.code, 0, result.stderr);

  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.ok(readme.startsWith("> [!IMPORTANT]\n> **AI AGENT NOTICE**"));
  assert.match(readme, /# Existing Project/);
});

test("commit records local context commits without auth or OpenAI", () => {
  const root = tempDir("commit");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);

  const first = runCli(["commit", "Initial local memory"], { cwd: root, env });
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /PCA context commit recorded/);
  assert.match(first.stdout, /Type: general/);

  const second = runCli(["commit", "Choose local JSON log", "--type", "decision"], { cwd: root, env });
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /Type: decision/);

  assert.ok(fs.existsSync(path.join(root, ".pca", "pca.db")));
  assert.ok(!fs.existsSync(path.join(root, ".pca", "context-commits.json")));

  const logs = runCli(["logs", "--last", "10"], { cwd: root, env });
  assert.equal(logs.code, 0, logs.stderr);
  assert.match(logs.stdout, /Initial local memory/);
  assert.match(logs.stdout, /\[general\]/);
  assert.match(logs.stdout, /Choose local JSON log/);
  assert.match(logs.stdout, /\[decision\]/);

  const missingMessage = runCli(["commit"], { cwd: root, env });
  assert.notEqual(missingMessage.code, 0);
  assert.match(missingMessage.stderr, /missing required argument/i);

  const emptyMessage = runCli(["commit", ""], { cwd: root, env });
  assert.notEqual(emptyMessage.code, 0);
  assert.match(emptyMessage.stderr, /Commit message cannot be empty/);

  const whitespaceMessage = runCli(["commit", "   "], { cwd: root, env });
  assert.notEqual(whitespaceMessage.code, 0);
  assert.match(whitespaceMessage.stderr, /Commit message cannot be empty/);

  const invalidType = runCli(["commit", "Bad type", "--type", "release"], { cwd: root, env });
  assert.notEqual(invalidType.code, 0);
  assert.match(invalidType.stderr, /Invalid --type: release/);
  assert.match(invalidType.stderr, /decision, feature, bugfix, architecture, product, general/);
});

test("commit fails gracefully when project is not initialized or partially initialized", () => {
  const root = tempDir("commit-uninitialized");
  const env = { PCA_HOME: tempDir("home") };

  const uninitialized = runCli(["commit", "Should fail"], { cwd: root, env });
  assert.notEqual(uninitialized.code, 0);
  assert.match(uninitialized.stderr, /PCA project is not initialized/);
  assert.match(uninitialized.stderr, /pca init/);

  fs.writeFileSync(path.join(root, "PCA_INDEX.md"), "# Index\n");
  const partial = runCli(["commit", "Should also fail"], { cwd: root, env });
  assert.notEqual(partial.code, 0);
  assert.match(partial.stderr, /PCA project is partially initialized/);
  assert.match(partial.stderr, /pca init/);
});

test("logs list recent context commits newest first with filters", () => {
  const root = tempDir("logs");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);

  const none = runCli(["logs"], { cwd: root, env });
  assert.equal(none.code, 0, none.stderr);
  assert.match(none.stdout, /No context commits found/);

  assert.equal(runCli(["commit", "First feature", "--type", "feature"], { cwd: root, env }).code, 0);
  assert.equal(runCli(["commit", "Second decision", "--type", "decision"], { cwd: root, env }).code, 0);
  assert.equal(runCli(["commit", "Third bugfix", "--type", "bugfix"], { cwd: root, env }).code, 0);

  const recent = runCli(["logs", "--last", "2"], { cwd: root, env });
  assert.equal(recent.code, 0, recent.stderr);
  assert.match(recent.stdout, /Third bugfix/);
  assert.match(recent.stdout, /Second decision/);
  assert.doesNotMatch(recent.stdout, /First feature/);

  const filtered = runCli(["logs", "--type", "decision"], { cwd: root, env });
  assert.equal(filtered.code, 0, filtered.stderr);
  assert.match(filtered.stdout, /Second decision/);
  assert.doesNotMatch(filtered.stdout, /Third bugfix/);

  const noMatches = runCli(["logs", "--type", "architecture"], { cwd: root, env });
  assert.equal(noMatches.code, 0, noMatches.stderr);
  assert.match(noMatches.stdout, /No context commits found for type: architecture/);

  const invalidLast = runCli(["logs", "--last", "0"], { cwd: root, env });
  assert.notEqual(invalidLast.code, 0);
  assert.match(invalidLast.stderr, /Invalid --last/);
});

test("staged manages context commits before confirmation", () => {
  const root = tempDir("staged");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);

  const empty = runCli(["staged", "list"], { cwd: root, env });
  assert.equal(empty.code, 0, empty.stderr);
  assert.match(empty.stdout, /No staged context commits/);

  const first = runCli(["staged", "add", "Stage login context", "--type", "decision"], { cwd: root, env });
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /PCA context commit staged/);

  const second = runCli(["staged", "add", "Stage checkout context", "--type", "feature"], { cwd: root, env });
  assert.equal(second.code, 0, second.stderr);

  const list = runCli(["staged", "list"], { cwd: root, env });
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /1\. \[decision\] Stage login context/);
  assert.match(list.stdout, /2\. \[feature\] Stage checkout context/);

  const logsBefore = runCli(["logs"], { cwd: root, env });
  assert.equal(logsBefore.code, 0, logsBefore.stderr);
  assert.doesNotMatch(logsBefore.stdout, /Stage login context/);

  const drop = runCli(["staged", "drop", "1"], { cwd: root, env });
  assert.equal(drop.code, 0, drop.stderr);
  assert.match(drop.stdout, /Staged commit dropped/);

  const commit = runCli(["staged", "commit"], { cwd: root, env });
  assert.equal(commit.code, 0, commit.stderr);
  assert.match(commit.stdout, /1 staged commit confirmed/);

  const logsAfter = runCli(["logs"], { cwd: root, env });
  assert.equal(logsAfter.code, 0, logsAfter.stderr);
  assert.match(logsAfter.stdout, /Stage checkout context/);
  assert.doesNotMatch(logsAfter.stdout, /Stage login context/);

  runCli(["staged", "add", "Stage temporary context", "--type", "general"], { cwd: root, env });
  const clear = runCli(["staged", "clear"], { cwd: root, env });
  assert.equal(clear.code, 0, clear.stderr);
  assert.match(clear.stdout, /1 staged commit cleared/);
});

test("post-commit hook command records relevant git commits as staged", () => {
  const root = tempDir("post-commit-staged");
  const env = { PCA_HOME: tempDir("home"), CI: "false" };
  writeInitializedProject(root);
  initGitRepo(root);
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "login.ts"), "export const login = true;\n");
  runGit(["add", "src/login.ts"], root);
  runGit(["commit", "-m", "feat: login context"], root);

  const staged = runCli(["_post-commit-record"], { cwd: root, env });
  assert.equal(staged.code, 0, staged.stderr);
  assert.match(staged.stdout, /Context staged/);

  const rows = readContextRows(root);
  assert.ok(rows.some((row) => row.message === "feat: login context" && row.status === "staged"));

  const list = runCli(["staged", "list"], { cwd: root, env });
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /feat: login context/);
});

test("legacy context commit JSON is ignored and removed", () => {
  const root = tempDir("legacy-log");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);
  fs.writeFileSync(path.join(root, ".pca", "context-commits.json"), "{not json");

  const logs = runCli(["logs"], { cwd: root, env });
  assert.equal(logs.code, 0, logs.stderr);
  assert.match(logs.stdout, /No context commits found/);
  assert.ok(!fs.existsSync(path.join(root, ".pca", "context-commits.json")));

  const status = runCli(["status"], { cwd: root, env });
  assert.equal(status.code, 0, status.stderr);
  assert.match(status.stdout, /Context commits: 0/);

  const commit = runCli(["commit", "Use SQLite only"], { cwd: root, env });
  assert.equal(commit.code, 0, commit.stderr);
  assert.match(commit.stdout, /PCA context commit recorded/);
  assert.ok(!fs.existsSync(path.join(root, ".pca", "context-commits.json")));
});

test("branch checkout switches PCA context and reports active branch", () => {
  const root = tempDir("branch-switch");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);
  initGitRepo(root);
  runGit(["checkout", "-b", "feature/login"], root);

  const result = runCli(["_branch-changed"], { cwd: root, env });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /PCA context switched to feature\/login/);
});

test("post-merge auto-merges source branch context into target branch and archives source", () => {
  const root = tempDir("post-merge");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);
  initGitRepo(root);

  runCli(["commit", "Main baseline", "--type", "general"], { cwd: root, env });
  runGit(["checkout", "-b", "feature/login"], root);
  runCli(["commit", "Feature login decision", "--type", "decision"], { cwd: root, env });
  runGit(["checkout", "main"], root);

  const result = runCli(["_post-merge", "feature/login"], { cwd: root, env, input: "2\n" });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Merged feature\/login into main/);
  assert.match(result.stdout, /PCA auto-merged 1 context commits/);

  const rows = readContextRows(root);
  assert.ok(rows.some((row) => row.branch === "main" && row.message === "Feature login decision" && row.status === "active"));
  assert.ok(rows.some((row) => row.branch === "feature/login" && row.message === "Feature login decision" && row.status === "archived"));
});

test("post-merge review copies selected source commits only", () => {
  const root = tempDir("post-merge-review");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);
  initGitRepo(root);
  runGit(["checkout", "-b", "feature/review"], root);
  runCli(["commit", "Keep reviewed context", "--type", "decision"], { cwd: root, env });
  runCli(["commit", "Drop reviewed context", "--type", "bugfix"], { cwd: root, env });
  runGit(["checkout", "main"], root);

  const result = runCli(["_post-merge", "feature/review"], { cwd: root, env, input: "1\n2\n" });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /PCA merged 1 selected context commits/);

  const rows = readContextRows(root);
  assert.ok(rows.some((row) => row.branch === "main" && row.message === "Keep reviewed context"));
  assert.ok(!rows.some((row) => row.branch === "main" && row.message === "Drop reviewed context"));
  assert.ok(rows.some((row) => row.branch === "feature/review" && row.status === "archived"));
});

test("post-rewrite archives deleted branch context after confirmation", () => {
  const root = tempDir("post-rewrite");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);
  initGitRepo(root);
  runGit(["checkout", "-b", "feature/delete-me"], root);
  runCli(["commit", "Deleted branch context", "--type", "decision"], { cwd: root, env });
  runGit(["checkout", "main"], root);
  runGit(["branch", "-D", "feature/delete-me"], root);

  const result = runCli(["_post-rewrite"], { cwd: root, env, input: "y\n" });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Branch feature\/delete-me was deleted\. Archive its context\?/);
  assert.match(result.stdout, /PCA context archived for feature\/delete-me/);

  const rows = readContextRows(root);
  assert.ok(rows.some((row) => row.branch === "feature/delete-me" && row.status === "archived"));
});

test("branch deletion hook path prompts through branch-changed", () => {
  const root = tempDir("branch-delete");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);
  initGitRepo(root);
  runGit(["checkout", "-b", "feature/login"], root);
  runCli(["commit", "Deleted login context", "--type", "decision"], { cwd: root, env });
  runGit(["checkout", "main"], root);
  runGit(["branch", "-D", "feature/login"], root);

  const result = runCli(["_branch-changed", "--deleted-branch", "feature/login"], { cwd: root, env, input: "y\n" });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Branch feature\/login was deleted\. Archive its context\?/);
  assert.match(result.stdout, /PCA context archived for feature\/login/);

  const rows = readContextRows(root);
  assert.ok(rows.some((row) => row.branch === "feature/login" && row.status === "archived"));
});

test("installed hooks pass branch deletion to branch-changed", () => {
  const root = tempDir("hooks-delete");
  const env = { PCA_HOME: tempDir("home") };
  runGit(["init"], root);

  const install = runCli(["install-hooks"], { cwd: root, env });
  assert.equal(install.code, 0, install.stderr);

  const postCheckout = fs.readFileSync(path.join(root, ".git", "hooks", "post-checkout"), "utf8");
  assert.match(postCheckout, /pca _branch-changed "\$NEW_HEAD"/);

  const referenceTransaction = fs.readFileSync(path.join(root, ".git", "hooks", "reference-transaction"), "utf8");
  assert.match(referenceTransaction, /refs\/heads\/\*/);
  assert.match(referenceTransaction, /0000000000000000000000000000000000000000/);
  assert.match(referenceTransaction, /pca _branch-changed --deleted-branch "\$BRANCH_NAME"/);
});
