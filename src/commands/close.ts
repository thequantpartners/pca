import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { getProjectRoot, loadConfig } from "../core/config.js";
import { dateStamp, timestampForLog } from "../core/files.js";
import { appendContextCommit } from "../core/context-commits.js";
import { promptText } from "../core/prompt.js";

export function registerCloseCommand(program: Command): void {
  program
    .command("close")
    .description("Automatiza el cierre de una tarea, actualizando roadmap, changelog y sync-log")
    .argument("[message]", "Mensaje de cierre de la tarea")
    .action(async (message: string | undefined) => {
      const root = getProjectRoot();
      await loadConfig(root);

      const activeTaskPath = path.join(root, "pca", "state", "active-task.md");
      if (!(await fs.pathExists(activeTaskPath))) {
        console.error(chalk.red("Error: No se encontró una tarea activa en pca/state/active-task.md"));
        process.exitCode = 1;
        return;
      }

      let closeMessage = message?.trim();
      if (!closeMessage) {
        closeMessage = await promptText(chalk.cyan("Mensaje de cierre: "));
        closeMessage = closeMessage.trim();
        if (!closeMessage) {
          console.error(chalk.red("Error: El mensaje de cierre es requerido."));
          process.exitCode = 1;
          return;
        }
      }

      console.log(chalk.blue("Actualizando roadmap.md..."));
      await updateRoadmap(root);

      console.log(chalk.blue("Actualizando changelog.md..."));
      await updateChangelog(root, closeMessage);

      console.log(chalk.blue("Registrando commit de contexto..."));
      const commitMessage = `docs: close task and update context logs - ${closeMessage}`;
      const commit = await appendContextCommit(root, commitMessage, "general");

      console.log(chalk.blue("Actualizando sync-log.md..."));
      await updateSyncLog(root, closeMessage, commit.id);

      console.log(chalk.green("\nTarea cerrada exitosamente."));
      console.log(`Commit ID: ${commit.id}`);
      console.log("Recuerda ejecutar `pca sync` si corresponde.");
    });
}

async function updateRoadmap(root: string): Promise<void> {
  const filePath = path.join(root, "pca", "state", "roadmap.md");
  if (!(await fs.pathExists(filePath))) {
    return;
  }

  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  
  let inProcessIndex = -1;
  let doneIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    if (line.startsWith("## in process")) inProcessIndex = i;
    if (line.startsWith("## done")) doneIndex = i;
  }

  if (inProcessIndex === -1) return;

  // Encontrar tareas en ## In Process
  const newLines = [...lines];
  const tasksToMove: string[] = [];
  
  let i = inProcessIndex + 1;
  while (i < newLines.length && !newLines[i].startsWith("##")) {
    if (newLines[i].match(/^\s*-\s*\[\s\]/)) {
      tasksToMove.push(newLines[i].replace(/\[\s\]/, "[x]"));
      newLines.splice(i, 1);
    } else {
      i++;
    }
  }

  if (tasksToMove.length === 0) return;

  // Insertar en ## Done
  // Si no existe ## Done, lo creamos al final
  if (doneIndex === -1) {
    newLines.push("");
    newLines.push("## Done");
    doneIndex = newLines.length - 1;
  } else {
    // Buscar si doneIndex cambió por el splice
    doneIndex = newLines.findIndex(line => line.trim().toLowerCase().startsWith("## done"));
  }

  newLines.splice(doneIndex + 1, 0, ...tasksToMove);

  await fs.writeFile(filePath, newLines.join("\n"), "utf8");
}

async function updateChangelog(root: string, message: string): Promise<void> {
  const filePath = path.join(root, "pca", "state", "changelog.md");
  let content = "";
  if (await fs.pathExists(filePath)) {
    content = await fs.readFile(filePath, "utf8");
  }

  const lines = content ? content.split(/\r?\n/) : [];
  let unreleasedIndex = lines.findIndex(line => line.trim().toLowerCase() === "## [unreleased]");

  const newEntry = `- ${message} (${dateStamp()})`;

  if (unreleasedIndex === -1) {
    lines.unshift("## [Unreleased]", newEntry, "");
  } else {
    lines.splice(unreleasedIndex + 1, 0, newEntry);
  }

  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, lines.join("\n"), "utf8");
}

async function updateSyncLog(root: string, message: string, commitId: string): Promise<void> {
  const filePath = path.join(root, "pca", "rag", "sync-log.md");
  await fs.ensureDir(path.dirname(filePath));
  
  const entry = [
    `## ${timestampForLog()}`,
    `- Task closed: ${message}`,
    `- Commit Type: general`,
    `- Commit ID: ${commitId}`,
    `- Sync required: run \`pca sync\``,
    ""
  ].join("\n");

  await fs.appendFile(filePath, entry + "\n", "utf8");
}
