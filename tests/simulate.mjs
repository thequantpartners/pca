import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "index.js");

if (!fs.existsSync(cliPath)) {
  console.error("Missing dist/index.js. Run `npm run build` before `node tests/simulate.mjs`.");
  process.exit(1);
}

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pca-sim-project-"));
const pcaHome = fs.mkdtempSync(path.join(os.tmpdir(), "pca-sim-home-"));
const env = {
  ...process.env,
  PCA_HOME: pcaHome,
  FORCE_COLOR: "0",
};

delete env.OPENAI_API_KEY;
delete env.PCA_AUTH_BASE_URL;

const checks = [
  {
    name: "init",
    args: ["init", "--name", "Simulated Project"],
    stdout: [/PCA initialized/, /Vector store: local-only/],
  },
  {
    name: "status after init",
    args: ["status"],
    stdout: [/PCA active/, /Mode\s+local-only/],
  },
  {
    name: "whoami local-only",
    args: ["whoami"],
    stdout: [/Mode: local-only/],
  },
  {
    name: "config local-only",
    args: ["config"],
    stdout: [/Mode: local-only/],
  },
  {
    name: "doctor local-only",
    args: ["doctor"],
    stdout: [/Global environment/, /Project memory/],
  },
  {
    name: "commit general",
    args: ["commit", "Initial local memory"],
    stdout: [/PCA context commit recorded/, /Type: general/],
  },
  {
    name: "commit decision",
    args: ["commit", "Choose local JSON log", "--type", "decision"],
    stdout: [/PCA context commit recorded/, /Type: decision/],
  },
  {
    name: "logs",
    args: ["logs"],
    stdout: [/Initial local memory/, /Choose local JSON log/],
  },
  {
    name: "logs last",
    args: ["logs", "--last", "1"],
    stdout: [/Choose local JSON log/],
  },
  {
    name: "logs filter",
    args: ["logs", "--type", "decision"],
    stdout: [/Choose local JSON log/],
  },
  {
    name: "diff",
    args: ["diff"],
    stdout: [/Context diff/, /New commits/],
  },
  {
    name: "query",
    args: ["query", "local JSON"],
    stdout: [/PCA Query Result/, /local search/],
  },
  {
    name: "task",
    args: ["task", "fix local memory bug"],
    stdout: [/PCA Task Context/, /local-only/],
  },
  {
    name: "forget deprecated",
    args: ["forget"],
    input: "1\nd\n",
    stdout: [/PCA Forget/, /marked as deprecated/],
  },
  {
    name: "logs after forget",
    args: ["logs", "--last", "5"],
    stdout: [/Initial local memory/, /Choose local JSON log/],
  },
  {
    name: "close",
    args: ["close"],
    input: "yes\nCompleted simulated flow\n",
    stdout: [/PCA closure recorded/, /Next step: pca sync/],
  },
  {
    name: "status after close",
    args: ["status"],
    stdout: [/PCA active/, /Commits/],
  },
  {
    name: "help",
    args: ["help"],
    stdout: [/PCA = Persistent Context Architecture/, /pca sync/],
  },
];

let passed = 0;

for (const [index, check] of checks.entries()) {
  const result = spawnSync(process.execPath, [cliPath, ...check.args], {
    cwd: projectRoot,
    env,
    encoding: "utf8",
    input: check.input,
  });

  const output = `${result.stdout}\n${result.stderr}`;
  const label = `${index + 1}/${checks.length} ${check.name}`;

  if (result.status !== 0) {
    console.error(`[FAIL] ${label}`);
    console.error(output.trim());
    process.exit(1);
  }

  for (const pattern of check.stdout ?? []) {
    if (!pattern.test(output)) {
      console.error(`[FAIL] ${label}`);
      console.error(`Expected output to match ${pattern}`);
      console.error(output.trim());
      process.exit(1);
    }
  }

  passed += 1;
  console.log(`[PASS] ${label}`);
}

console.log(`Simulation passed ${passed}/${checks.length}`);
