import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
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
