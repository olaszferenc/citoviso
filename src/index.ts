// Citoviso entry point. Wires the pipeline: ingest -> analyze -> generate.
// Each step is a stub today; see src/scrape and src/generate for the contracts.

import { config } from "./config.js";

function main(): void {
  console.log("Citoviso engine — scaffold");
  console.log(`  chromium: ${config.chromiumPath}`);
  console.log("  pipeline: ingest -> analyze -> generate (stubs)");
  console.log("  next: port mockups/gen.py -> src/generate, add first Source");
}

main();
