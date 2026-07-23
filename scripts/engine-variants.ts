// PRIMITÍV-VARIÁNS showcase (ADR-0017): render ONE real persisted composition artifact
// with several named VARIANT combinations — skin + archetype fixed, so the section-render
// variant is the only variable. Full-width rows (variants read on mobile too). Contact-sheet.
//   npx tsx scripts/engine-variants.ts ["Sissi"] ["skin-id"]
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db/client.js";
import type { Recipe, RecipeSection, SectionKind, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { SKINS } from "../src/engine/skins.js";
import { injectRuntime } from "../src/generator/runtime.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Variant per kind. Missing kind → its default. Fixed archetype so only variants vary.
type Combo = { label: string; v: Partial<Record<SectionKind, string>> };
const COMBOS: Combo[] = [
  { label: "alap — plain · cards · grid", v: {} },
  { label: "overlay · ledger · grid", v: { hero: "overlay", features: "table" } },
  { label: "plain · cards · masonry", v: { gallery: "masonry" } },
  { label: "overlay · ledger · masonry", v: { hero: "overlay", features: "table", gallery: "masonry" } },
];

async function main() {
  const leadArg = process.argv[2] ?? "Sissi";
  const skinId = process.argv[3] ?? "editorial-magazine";
  if (!SKINS[skinId]) throw new Error(`ismeretlen skin: ${skinId}`);

  const rows = await db
    .selectFrom("mock_artifact")
    .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
    .select(["mock_artifact.inputs as inputs", "lead.name as name"])
    .where("lead.name", "ilike", `%${leadArg}%`)
    .orderBy("mock_artifact.generated_at", "desc")
    .limit(12)
    .execute();
  const hit = rows.find((r) => {
    const i = r.inputs as Record<string, unknown>;
    return i.engine === "composition" && i.recipe && i.siteData;
  });
  if (!hit) throw new Error(`nincs perzisztált motor-artifact "${leadArg}" leadhez`);
  const inputs = hit.inputs as Record<string, unknown>;
  const recipe = inputs.recipe as unknown as Recipe;
  const siteData = inputs.siteData as unknown as SiteData;

  console.log(`\n  lead: ${hit.name} · fix skin: ${skinId} · archetípus: stacked · fotók: ${siteData.photos.length}\n`);

  const outDir = path.resolve(process.cwd(), "sites/_engine-proof/variants");
  await mkdir(outDir, { recursive: true });

  const cards: string[] = [];
  for (const [idx, combo] of COMBOS.entries()) {
    const sections: RecipeSection[] = recipe.sections.map((s) =>
      combo.v[s.kind] ? { kind: s.kind, variant: combo.v[s.kind] } : { kind: s.kind },
    );
    const html = await injectRuntime(
      renderSite({ skin: skinId, archetype: "stacked", sections }, siteData),
    );
    const file = `combo-${idx + 1}.html`;
    await writeFile(path.join(outDir, file), html, "utf8");
    console.log(`  ${combo.label}  → ${file}`);
    cards.push(
      `<figure class="card">
        <figcaption><b>${idx + 1}.</b> ${esc(combo.label)}</figcaption>
        <iframe src="./${esc(file)}" loading="lazy"></iframe>
      </figure>`,
    );
  }

  const index = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Citoviso — PRIMITÍV-VARIÁNS (${esc(hit.name)})</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #0f1115; color: #e8e6e1; padding: 20px; }
  h1 { font-size: 1.2rem; font-weight: 600; }
  .mut { color: #9a988f; font-size: .9rem; }
  .grid { display: grid; gap: 22px; grid-template-columns: 1fr; margin-top: 16px; }
  .card { margin: 0; background: #171a20; border: 1px solid #262a31; border-radius: 12px; overflow: hidden; }
  figcaption { padding: 10px 12px; font-size: .9rem; }
  iframe { width: 100%; height: 760px; border: 0; border-top: 1px solid #262a31; background: #fff; display: block; }
</style></head><body>
  <h1>PRIMITÍV-VARIÁNS — ${esc(hit.name)} <span class="mut">(azonos adat · fix skin ${esc(
    skinId,
  )} · fix archetípus stacked · a SZEKCIÓ-RENDER az egyetlen változó)</span></h1>
  <p class="mut">hero: plain/overlay · features: cards/table(ledger) · gallery: grid/masonry — mobilon is látszik.</p>
  <div class="grid">
    ${cards.join("\n    ")}
  </div>
</body></html>`;
  await writeFile(path.join(outDir, "index.html"), index, "utf8");

  console.log(`\n  contact-sheet: ${path.join(outDir, "index.html")}\n`);
  await db.destroy();
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
