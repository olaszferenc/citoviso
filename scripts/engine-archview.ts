// ARCHETYPE-axis showcase (ADR-0017): render ONE real persisted composition artifact
// through EVERY archetype — the LAYOUT is the only variable (skin fixed) — so the
// archetype (arrangement) variety is visible side by side. Writes a contact-sheet.
//   npx tsx scripts/engine-archview.ts ["Sissi"] ["skin-id"]
//     arg1 = lead name (default Sissi) · arg2 = fixed skin (default editorial-magazine)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ARCHETYPES } from "../src/engine/archetypes.js";
import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { SKINS } from "../src/engine/skins.js";
import { injectRuntime } from "../src/generator/runtime.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

  console.log(`\n  lead: ${hit.name} · fix skin: ${skinId} · fotók: ${siteData.photos.length}`);
  console.log(`  ${Object.keys(ARCHETYPES).length} archetípus renderelése (elrendezés = az egyetlen változó)…\n`);

  const outDir = path.resolve(process.cwd(), "sites/_engine-proof/arch");
  await mkdir(outDir, { recursive: true });

  const cards: string[] = [];
  for (const arch of Object.values(ARCHETYPES)) {
    const html = await injectRuntime(renderSite({ ...recipe, skin: skinId, archetype: arch.id }, siteData));
    const file = `${arch.id}.html`;
    await writeFile(path.join(outDir, file), html, "utf8");
    console.log(`  ${arch.id.padEnd(18)} ${arch.label}`);
    cards.push(
      `<figure class="card">
        <figcaption><b>${esc(arch.id)}</b> — ${esc(arch.label)}<br><span class="h">${esc(arch.hint)}</span></figcaption>
        <iframe src="./${esc(file)}" loading="lazy"></iframe>
      </figure>`,
    );
  }

  const index = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Citoviso — ARCHETÍPUS-nézet (${esc(hit.name)})</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #0f1115; color: #e8e6e1; padding: 20px; }
  h1 { font-size: 1.2rem; font-weight: 600; }
  .mut { color: #9a988f; font-size: .9rem; }
  /* One archetype per FULL-WIDTH row so desktop breakpoints (e.g. split's ≥900px
   * 2-column) actually trigger — a narrow iframe collapses every archetype to mobile. */
  .grid { display: grid; gap: 22px; grid-template-columns: 1fr; margin-top: 16px; }
  .card { margin: 0; background: #171a20; border: 1px solid #262a31; border-radius: 12px; overflow: hidden; }
  figcaption { padding: 10px 12px; font-size: .85rem; line-height: 1.4; }
  .h { color: #9a988f; }
  iframe { width: 100%; height: 760px; border: 0; border-top: 1px solid #262a31; background: #fff; display: block; }
</style></head><body>
  <h1>ARCHETÍPUS-nézet — ${esc(hit.name)} <span class="mut">(azonos recept+adat · fix skin: ${esc(
    skinId,
  )} · ${Object.keys(ARCHETYPES).length} archetípus)</span></h1>
  <p class="mut">Az ELRENDEZÉS az egyetlen változó. A készlet ma 3 archetípus — a bővítés (elrendezés-családok desztillációja) a következő passz.</p>
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
