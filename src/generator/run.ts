// CLI for the mock generator (walking skeleton). Thin wrapper over the composition
// engine service (ADR-0017) — the console calls the same service. The legacy AI-HTML
// generateMockFor stays available in generate.ts for the fallback path.
// Usage: npm run generate -- "<lead id | name fragment>" [regionId]
// Empty lead arg → the most recently scraped lead.

import { db } from "../db/client.js";
import { generateEngineMockFor } from "./generateEngine.js";

async function main(): Promise<void> {
  const leadArg = process.argv[2];
  const regionId = process.argv[3] ?? "badacsony";
  try {
    const r = await generateEngineMockFor(leadArg, regionId);
    console.log(`Rendered: ${r.leadName} → ${r.path}`);
    console.log(
      `  mock_artifact ${r.artifactId} (generated) · motor=${r.engine} · skin=${r.skin} · archetípus=${r.archetype} [${r.recipeSource}] · szekciók ${r.sections.join(" → ")} · fotók ${r.photos} · dizájn ${r.designVerdict}`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
