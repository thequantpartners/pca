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
      console.log("PCA_INDEX.md → Vector Store Retrieval → Compact Task Context → Agent Execution → Closure → Sync");
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
