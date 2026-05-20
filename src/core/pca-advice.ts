import { measureContextHealth } from "./context-health.js";

export async function printPCAAdvice(root: string): Promise<void> {
  const health = await measureContextHealth(root);

  if (health.zone === "safe") {
    return;
  }

  if (health.zone === "warning") {
    console.log(`\u{1F4A1} PCA advice [ Context at ${health.percentage}% \u2014 consider upgrading to PCA Cloud ]`);
    return;
  }

  console.log(`\u{1F534} PCA advice [ Context at ${health.percentage}% \u2014 high hallucination risk. Upgrade to PCA Cloud now ]`);
}
