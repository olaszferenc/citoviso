// Deterministic mock re-render from persisted inputs (ADR-0016 mock=live foundation).
//
// A motor-side fix (template CSS, module weave, runtime) does NOT propagate to the
// already-generated mock files — they are static snapshots. This re-renders a lead's
// mock artifact(s) from mock_artifact.inputs (recipe + siteData), through the CURRENT
// engine, into the SAME file path the console serves. Never the AI planner again —
// that would be bait-and-switch (§I); the persisted inputs ARE the design.
//
//   npx tsx scripts/rerender-mock.mts "Villa Rubin"        # every artifact of the lead
//   npx tsx scripts/rerender-mock.mts <artifactId>         # one artifact
//
// Run from the tree whose cwd the console serves (the main tree for :4600).

import { writeFile } from "node:fs/promises";

import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { checkDesign } from "../src/generator/designCheck.js";
import { injectRuntime } from "../src/generator/runtime.js";

const arg = process.argv[2];
if (!arg) {
  console.error('Használat: npx tsx scripts/rerender-mock.mts "<lead név>" | <artifactId>');
  process.exit(1);
}

const isUuid = /^[0-9a-f-]{36}$/i.test(arg);
const rows = await db
  .selectFrom("mock_artifact")
  .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
  .select(["mock_artifact.id as id", "mock_artifact.path as path", "mock_artifact.inputs as inputs", "lead.name as name"])
  .$if(isUuid, (q) => q.where("mock_artifact.id", "=", arg))
  .$if(!isUuid, (q) => q.where("lead.name", "ilike", `%${arg}%`))
  .orderBy("mock_artifact.generated_at", "desc")
  .execute();

if (!rows.length) {
  console.error(`Nincs mock_artifact erre: ${arg}`);
  process.exit(1);
}

let done = 0;
for (const row of rows) {
  const inputs = (row.inputs ?? {}) as Record<string, unknown>;
  const recipe = inputs.recipe as Recipe | undefined;
  const siteData = inputs.siteData as SiteData | undefined;
  if (!recipe || !siteData) {
    console.warn(`  – ${row.path}: nincs recipe+siteData az inputs-ban (régi artifact) — kihagyva`);
    continue;
  }
  const html = await injectRuntime(renderSite(recipe, siteData, { phase: "mock" }), siteData.lang);
  await writeFile(row.path, html, "utf8");
  const design = checkDesign(html);
  console.log(
    `  ✓ ${row.name} → ${row.path} (dizájn: ${design.verdict}${design.verdict === "pass" ? "" : ` — ${design.reason}`})`,
  );
  done++;
}
console.log(`\n✅ ${done}/${rows.length} mock újrarenderelve a persistált inputs-ból.`);
process.exit(0);
