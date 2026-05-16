import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
  });

  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function writeInitializedProject(root) {
  fs.mkdirSync(path.join(root, ".pca"), { recursive: true });
  fs.mkdirSync(path.join(root, "pca"), { recursive: true });
  fs.writeFileSync(path.join(root, "PCA_INDEX.md"), "# Index\n");
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Agents\n");
  fs.writeFileSync(path.join(root, ".pca", "config.json"), JSON.stringify({ vectorStoreId: "vs_test" }));
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
  assert.match(builtInHelp.stdout, /logs/);

  const customHelp = runCli(["help"], { cwd: root, env });
  assert.equal(customHelp.code, 0);
  assert.match(customHelp.stdout, /PCA = Persistent Context Architecture/);
  assert.match(customHelp.stdout, /pca sync/);

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

test("doctor groups diagnostics without real OpenAI or Clerk", () => {
  const root = tempDir("doctor");
  const env = { PCA_HOME: tempDir("home") };

  const result = runCli(["doctor"], { cwd: root, env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Global environment/);
  assert.match(result.stdout, /PCA auth session/);
  assert.match(result.stdout, /OpenAI API key/);
  assert.match(result.stdout, /Project memory/);
  assert.match(result.stdout, /Vector store/);
  assert.match(result.stdout, /Backend auth config/);
  assert.match(result.stdout, /Validation: Skipped/);
  assert.match(result.stdout, /PCA project: Not initialized/);
  assert.doesNotMatch(result.stderr, /OpenAI|Clerk/i);
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

  const logPath = path.join(root, ".pca", "context-commits.json");
  const commits = JSON.parse(fs.readFileSync(logPath, "utf8"));
  assert.equal(commits.length, 2);
  assert.equal(commits[0].message, "Initial local memory");
  assert.equal(commits[0].type, "general");
  assert.equal(commits[1].message, "Choose local JSON log");
  assert.equal(commits[1].type, "decision");
  assert.ok(commits[0].id);
  assert.ok(commits[0].timestamp);

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

test("corrupted context commit log shows recovery guidance", () => {
  const root = tempDir("corrupt-log");
  const env = { PCA_HOME: tempDir("home") };
  writeInitializedProject(root);
  fs.writeFileSync(path.join(root, ".pca", "context-commits.json"), "{not json");

  const logs = runCli(["logs"], { cwd: root, env });
  assert.equal(logs.code, 0, logs.stderr);
  assert.match(logs.stdout, /Could not read PCA context commit log/);
  assert.match(logs.stdout, /Recovery: fix the JSON file/);

  const status = runCli(["status"], { cwd: root, env });
  assert.equal(status.code, 0, status.stderr);
  assert.match(status.stdout, /Context commits: 0/);
  assert.match(status.stdout, /Could not read PCA context commit log/);
  assert.match(status.stdout, /Recovery: fix the JSON file/);

  const commit = runCli(["commit", "Do not overwrite corrupted log"], { cwd: root, env });
  assert.notEqual(commit.code, 0);
  assert.match(commit.stderr, /Could not read PCA context commit log/);
  assert.match(commit.stderr, /Recovery: fix the JSON file/);
});
