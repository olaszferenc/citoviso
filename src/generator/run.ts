// CLI for the mock generator (walking skeleton). Thin wrapper over the
// generateMock service — the console calls the same service.
// Usage: npm run generate -- "<lead id | name fragment>" [regionId]
// Empty lead arg → the most recently scraped lead.

import { db } from "../db/client.js";
import { generateMockFor } from "./generate.js";

async function main(): Promise<void> {
  const leadArg = process.argv[2];
  const regionId = process.argv[3] ?? "badacsony";
  try {
    const r = await generateMockFor(leadArg, regionId);
    console.log(`Rendered: ${r.leadName} → ${r.path}`);
    console.log(
      `  mock_artifact ${r.artifactId} (generated) · motor=${r.engine}${r.archetype ? ` (${r.archetype})` : ""} · photos ${r.photos} · hero ${r.heroType}`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
