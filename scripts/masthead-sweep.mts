// TEMP verification harness (masthead rollout): render one lead's persisted
// inputs through EVERY template into mock-tpl-<id>.html for visual judgement.
import { writeFile } from "node:fs/promises";
import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES, pickTemplateSkin } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";

const row = await db
  .selectFrom("mock_artifact")
  .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
  .select(["mock_artifact.inputs as inputs"])
  .where("lead.name", "ilike", "%Levendula%")
  .orderBy("mock_artifact.generated_at", "desc")
  .executeTakeFirstOrThrow();

const inputs = row.inputs as { recipe: Recipe; siteData: SiteData };
const only = process.argv.slice(2); // optional template-id filter (parallel agents)
for (const tpl of Object.values(TEMPLATES)) {
  if (only.length && !only.includes(tpl.id)) continue;
  const recipe: Recipe = { ...inputs.recipe, template: tpl.id, skin: pickTemplateSkin(tpl, "sweep") };
  const html = await injectRuntime(renderSite(recipe, inputs.siteData, { phase: "mock" }), inputs.siteData.lang);
  await writeFile(`mock-tpl-${tpl.id}.html`, html);
  console.log(`✓ mock-tpl-${tpl.id}.html`);
}
process.exit(0);
