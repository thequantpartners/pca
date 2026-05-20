import { Command } from "commander";
import chalk from "chalk";
import { measureContextHealth, type ContextHealthZone } from "../core/context-health.js";
import { getProjectRoot } from "../core/config.js";

const separator = "\u2500".repeat(40);

export function registerHealthCommand(program: Command): void {
  program
    .command("health")
    .description("Measure PCA local context size and token health")
    .action(async () => {
      const health = await measureContextHealth(getProjectRoot());

      console.log(`${zoneIndicator(health.zone)} ${chalk.white(`Context Health \u2014 ${health.zone.toUpperCase()}`)}`);
      console.log(chalk.gray(separator));
      printDashboardRow("Words", health.totalWords.toLocaleString());
      printDashboardRow("Tokens", `~${health.estimatedTokens.toLocaleString()} / 15,000`);
      printDashboardRow("Usage", `${health.percentage}%`);
      console.log(chalk.gray(separator));
      console.log(chalk.white("Heaviest files:"));
      if (health.heaviestFiles.length === 0) {
        console.log(`  ${chalk.gray("none")}`);
      } else {
        for (const file of health.heaviestFiles) {
          console.log(`  ${chalk.gray(file.path.padEnd(24))}  ${chalk.white(`${file.words.toLocaleString()} words`)}`);
        }
      }
      console.log(chalk.gray(separator));
      if (health.zone !== "safe") {
        console.log(adviceLine(health.zone, health.percentage));
      }
    });
}

function printDashboardRow(label: string, value: string): void {
  console.log(`${chalk.gray(label.padEnd(12))}${chalk.white(value)}`);
}

function zoneIndicator(zone: ContextHealthZone): string {
  if (zone === "critical") {
    return "\u{1F534}";
  }

  if (zone === "warning") {
    return "\u{1F7E1}";
  }

  return "\u{1F7E2}";
}

function adviceLine(zone: ContextHealthZone, percentage: number): string {
  if (zone === "critical") {
    return `\u{1F534} PCA advice [ Context at ${percentage}% \u2014 high hallucination risk. Upgrade to PCA Cloud now ]`;
  }

  return `\u{1F4A1} PCA advice [ Context at ${percentage}% \u2014 consider upgrading to PCA Cloud before context rot begins ]`;
}
