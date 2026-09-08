// Render ANY registered art template against a real lead's persisted inputs.
//
// The template registry is the design surface a new template lands on, so a new
// template has to be judged on REAL data before it can be offered in the picker —
// never on a hand-made sample. This takes an existing mock_artifact's stored
// inputs (recipe + siteData, ADR-0016 mock=live) and re-renders them through the
// chosen template, writing a standalone file for ui-shot / the eye.
//
//   npx tsx scripts/template-preview.mts <templateId> ["<lead name>"] [--out=<dir>]
//
// No AI, no DB writes — the persisted inputs ARE the design (§I bait-and-switch).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { checkDesign } from "../src/generator/designCheck.js";

const args = process.argv.slice(2);
const tplId = args.find((a) => !a.startsWith("--")) ?? "";
const leadName = args.filter((a) => !a.startsWith("--"))[1];
const outDir = path.resolve(
  (args.find((a) => a.startsWith("--out=")) ?? "").split("=")[1] ||
    "assets/design-refs/_drafts/template-preview",
);

if (!TEMPLATES[tplId]) {
  console.error(`Ismeretlen sablon: "${tplId}"`);
  console.error(`Elérhető: ${Object.keys(TEMPLATES).join(", ")}`);
  process.exit(1);
}

const row = await db
  .selectFrom("mock_artifact")
  .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
  .select(["mock_artifact.inputs as inputs", "lead.name as name"])
  .$if(!!leadName, (q) => q.where("lead.name", "ilike", `%${leadName}%`))
  .orderBy("mock_artifact.generated_at", "desc")
  .executeTakeFirst();

if (!row) {
  console.error("Nincs mock_artifact ehhez a leadhez.");
  process.exit(1);
}

const inputs = row.inputs as { recipe: Recipe; siteData: SiteData };
const tpl = TEMPLATES[tplId]!;
// The template's own curated skin rail wins over the stored one: a template is
// judged with the skins it was designed for.
const skin = tpl.skins[0] ?? inputs.recipe.skin;
const recipe: Recipe = { ...inputs.recipe, template: tplId, skin };

const html = renderSite(recipe, inputs.siteData, { phase: "mock" });
const verdict = checkDesign(html);

await mkdir(outDir, { recursive: true });
const file = path.join(outDir, `${tplId}.html`);
await writeFile(file, html, "utf8");

console.log(`  sablon:  ${tplId} (${tpl.label})`);
console.log(`  lead:    ${row.name}`);
console.log(`  skin:    ${skin}`);
console.log(`  fotók:   ${inputs.siteData.photos.length}`);
console.log(`  méret:   ${(html.length / 1024).toFixed(0)} kB`);
console.log(
  `  design-check: ${verdict.verdict === "pass" ? "🟢 pass" : "🔴 flag"}` +
    (verdict.verdict === "pass"
      ? ""
      : ` — emoji: ${verdict.emoji.join("") || "-"}, hiányzó token: ${
          verdict.missingTokens.join(", ") || "-"
        }, hiányzó horog: ${verdict.missingHooks.join(", ") || "-"}`),
);
console.log(`  fájl:    ${file}`);

await db.destroy();
process.exit(verdict.verdict === "pass" ? 0 : 1);
