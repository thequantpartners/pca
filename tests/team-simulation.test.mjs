import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "index.js");

if (!fs.existsSync(cliPath)) {
  console.error("Missing dist/index.js. Run `npm run build` before `node tests/team-simulation.test.mjs`.");
  process.exit(1);
}

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pca-team-sim-project-"));
const pcaHome = fs.mkdtempSync(path.join(os.tmpdir(), "pca-team-sim-home-"));
const env = {
  ...process.env,
  PCA_HOME: pcaHome,
  FORCE_COLOR: "0",
};

delete env.OPENAI_API_KEY;
delete env.PCA_AUTH_BASE_URL;

let testNumber = 0;
let cleaned = false;

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? projectRoot,
    env,
    encoding: "utf8",
    input: options.input,
  });

  return {
    command: `pca ${args.join(" ")}`,
    code: result.status,
    output: `${result.stdout}\n${result.stderr}`.trim(),
  };
}

function pass(name) {
  testNumber += 1;
  console.log(`✅ Test ${testNumber}: ${name}`);
}

function fail(name, message, result) {
  const details = [
    `❌ Test ${testNumber + 1}: ${name}`,
    message,
    result ? `Command: ${result.command}\nExit code: ${result.code}\nOutput:\n${result.output}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  throw new Error(details);
}

function assertCommand(name, args, expectations = {}) {
  const result = runCli(args, expectations);
  if (result.code !== 0) {
    fail(name, "Expected command to exit with code 0.", result);
  }

  for (const pattern of expectations.stdout ?? []) {
    if (!pattern.test(result.output)) {
      fail(name, `Expected output to match ${pattern}.`, result);
    }
  }

  pass(name);
  return result;
}

function assertFile(name, relativePath, matcher) {
  const filePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    fail(name, `Expected file to exist: ${relativePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  if (matcher && !matcher.test(content)) {
    fail(name, `Expected ${relativePath} to match ${matcher}.`);
  }

  pass(name);
  return content;
}

function cleanup() {
  fs.rmSync(projectRoot, { recursive: true, force: true });
  fs.rmSync(pcaHome, { recursive: true, force: true });
  cleaned = true;
}

function writeLargeContextFile() {
  const warningText = Array.from({ length: 11000 }, (_, index) => `context-warning-word-${index}`).join(" ");
  fs.mkdirSync(path.join(projectRoot, "pca", "decisions"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "pca", "decisions", "sprint-context-load.md"), warningText, "utf8");
}

try {
  fs.writeFileSync(
    path.join(projectRoot, "package.json"),
    JSON.stringify(
      {
        name: "pca-team-sprint-sim",
        dependencies: { react: "^19.0.0", express: "^5.0.0" },
        devDependencies: { typescript: "^6.0.0" },
      },
      null,
      2,
    ),
  );
  fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "api"), { recursive: true });

  assertCommand("pca init", ["init", "--name", "Team Sprint Simulation"], {
    stdout: [/PCA initialized/, /Vector store: local-only/],
  });

  assertCommand("pca bootstrap", ["bootstrap"], {
    input: [
      "A PCA team simulation project for one sprint.",
      "Local CLI initialization and memory files are working.",
      "TypeScript, React, Express",
      "Keep PCA local-only for deterministic simulation tests.",
      "Do not call external OpenAI or auth services.",
      "",
    ].join("\n"),
    stdout: [/PCA_INDEX\.md updated/, /Context commit recorded/],
  });

  fs.mkdirSync(path.join(projectRoot, "pca", "rag"), { recursive: true });

  assertCommand("Ana commits API decision", ["commit", "Ana: define sprint API contract", "--type", "decision"], {
    stdout: [/PCA context commit recorded/, /Type: decision/],
  });

  assertCommand("Ben commits UI feature", ["commit", "Ben: build dashboard status panel", "--type", "feature"], {
    stdout: [/PCA context commit recorded/, /Type: feature/],
  });

  assertCommand("Cy commits QA bugfix", ["commit", "Cy: add regression coverage for context logs", "--type", "bugfix"], {
    stdout: [/PCA context commit recorded/, /Type: bugfix/],
  });

  assertCommand("Generate API task context", ["task", "Implement the API contract for sprint planning"], {
    stdout: [/PCA Task Context/, /local-only/, /Saved to \.pca[\\/]last-task-context\.md/],
  });

  assertCommand("Generate UI task context", ["task", "Build the dashboard status panel"], {
    stdout: [/PCA Task Context/, /Ben: build dashboard status panel/],
  });

  assertCommand("Generate QA task context", ["task", "Verify context logs regression coverage"], {
    stdout: [/PCA Task Context/, /Cy: add regression coverage/],
  });

  assertCommand("Check audit trail", ["audit", "--last", "5"], {
    stdout: [/PCA Audit Log/, /Implement the API contract/, /Build the dashboard status panel/, /Verify context logs/],
  });

  assertCommand("Check audit task filter", ["audit", "--task", "dashboard"], {
    stdout: [/PCA Audit Log/, /Build the dashboard status panel/],
  });

  writeLargeContextFile();
  assertCommand("Check health warnings", ["health"], {
    stdout: [/Context Health/, /WARNING/, /consider upgrading to PCA Cloud/],
  });

  assertCommand("Record architecture context commit", ["commit", "Team: preserve local-only audit trail", "--type", "architecture"], {
    stdout: [/PCA context commit recorded/, /Type: architecture/],
  });

  assertCommand("Record product context commit", ["commit", "Team: sprint simulation validates 3-dev workflow", "--type", "product"], {
    stdout: [/PCA context commit recorded/, /Type: product/],
  });

  assertCommand("Check context logs", ["logs", "--last", "10"], {
    stdout: [/Ana: define sprint API contract/, /Ben: build dashboard status panel/, /Cy: add regression coverage/],
  });

  const allLogs = runCli(["logs", "--last", "10"]);
  const recordedCommits = (allLogs.output.match(/\d{14}-[0-9a-fA-F]{8}/g) ?? []).length;
  if (recordedCommits < 6) {
    fail("Check context commit SQLite records", `Expected at least 6 context commits, found ${recordedCommits}.`, allLogs);
  }
  if (fs.existsSync(path.join(projectRoot, ".pca", "context-commits.json"))) {
    fail("Check legacy context commit JSON", "Expected .pca/context-commits.json to be absent.");
  }
  assertFile("Check generated task context file", ".pca/last-task-context.md", /Verify context logs regression coverage/);

  cleanup();
  if (!cleaned || fs.existsSync(projectRoot) || fs.existsSync(pcaHome)) {
    fail("Clean up temp directories", "Expected temp project and PCA home directories to be removed.");
  }
  pass("Clean up temp directories");

  console.log("✅ ALL TESTS PASSED - Team Simulation Complete");
} catch (error) {
  if (!cleaned) {
    cleanup();
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
