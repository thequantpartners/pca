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
