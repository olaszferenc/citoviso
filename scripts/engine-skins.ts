// SKIN-passz showcase (ADR-0017): render ONE real persisted composition artifact
// (recipe + SiteData) through EVERY skin — the skin is the only variable — so the skin
// variety is visible side by side. Runs designCheck on each and writes a contact-sheet
// index.html of iframes. Serve the output dir to view in a browser.
//   npx tsx scripts/engine-skins.ts ["Sissi"]   (arg = lead name; default = Sissi)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { SKINS } from "../src/engine/skins.js";
import { checkDesign } from "../src/generator/designCheck.js";
import { injectRuntime } from "../src/generator/runtime.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  const leadArg = process.argv[2] ?? "Sissi";

  // Find a real persisted engine artifact carrying recipe + SiteData (prefer one with photos).
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
  if (!hit) throw new Error(`nincs perzisztált motor-artifact "${leadArg}" leadhez — futtasd az engine-generate-et`);
  const inputs = hit.inputs as Record<string, unknown>;
  const recipe = inputs.recipe as unknown as Recipe;
  const siteData = inputs.siteData as unknown as SiteData;

  console.log(`\n  lead: ${hit.name} · archetípus: ${recipe.archetype} · fotók: ${siteData.photos.length}`);
  console.log(`  ${Object.keys(SKINS).length} skin renderelése (skin = az egyetlen változó)…\n`);

  const outDir = path.resolve(process.cwd(), "sites/_engine-proof/skins");
  await mkdir(outDir, { recursive: true });

  const cards: string[] = [];
  for (const skin of Object.values(SKINS)) {
    const html = await injectRuntime(renderSite({ ...recipe, skin: skin.id }, siteData));
    const file = `${skin.id}.html`;
    await writeFile(path.join(outDir, file), html, "utf8");
    const design = checkDesign(html);
    const mark = design.verdict === "pass" ? "✅" : `⛔ ${design.reason}`;
    console.log(`  ${skin.id.padEnd(20)} ${mark}`);
    cards.push(
      `<figure class="card">
        <figcaption><b>${esc(skin.id)}</b> — ${esc(skin.label)} <span class="v">${
          design.verdict === "pass" ? "PASS" : "FLAG"
        }</span><br><span class="h">${esc(skin.hint)}</span></figcaption>
        <iframe src="./${esc(file)}" loading="lazy"></iframe>
      </figure>`,
    );
  }

  const index = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Citoviso — SKIN-passz (${esc(hit.name)})</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #0f1115; color: #e8e6e1; padding: 20px; }
  h1 { font-size: 1.2rem; font-weight: 600; }
  .mut { color: #9a988f; font-size: .9rem; }
  .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); margin-top: 16px; }
  .card { margin: 0; background: #171a20; border: 1px solid #262a31; border-radius: 12px; overflow: hidden; }
  figcaption { padding: 10px 12px; font-size: .85rem; line-height: 1.4; }
  .v { float: right; font-size: .72rem; color: #7bd88f; }
  .h { color: #9a988f; }
  iframe { width: 100%; height: 520px; border: 0; border-top: 1px solid #262a31; background: #fff; display: block; }
</style></head><body>
  <h1>SKIN-passz — ${esc(hit.name)} <span class="mut">(azonos recept+adat · archetípus: ${esc(
    recipe.archetype,
  )} · ${Object.keys(SKINS).length} skin)</span></h1>
  <p class="mut">A skin az EGYETLEN változó. Minden csempe ugyanaz az oldal, más token-készlettel (ADR-0017 SKIN-passz).</p>
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
