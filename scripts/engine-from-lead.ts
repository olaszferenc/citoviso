// Real-DB proof (ADR-0016, planner item #2): run the composition engine from a REAL lead
// in the DB — not hand-typed data. Chain: lead (DB) → copy (existing AI brief) → SiteData
// (leadToSiteData) → recipe (engine planner) → render. Proves the engine works end-to-end
// on real leads. This does NOT touch convertLead (still the AI-HTML copy) — that flip waits
// until generation itself is engine-backed, so live cannot diverge from the approved mock.
//   npx tsx scripts/engine-from-lead.ts ["Sissi"]   (arg = lead id / name; default = newest)
//
// NB: a PROOF artifact (gitignored), not a customer deliverable. With no images the AI copy
// is region-generic; the fact-fidelity guardian applies when this feeds a real owner page.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db/client.js";
import { planRecipe } from "../src/engine/planner.js";
import { renderSite } from "../src/engine/render.js";
import { leadToSiteData } from "../src/engine/siteData.js";
import { generateBrief } from "../src/generator/brief.js";
import { loadLead } from "../src/generator/persist.js";

async function main() {
  const arg = process.argv[2];
  const { id, lead } = await loadLead(arg);
  console.log(`\n  lead: ${lead.name}  (${id})`);
  console.log(
    `  kvalifikáció: ${lead.websiteStatus} · email:${lead.email ? "van" : "nincs"} · cím:${
      lead.address ? "van" : "nincs"
    }`,
  );

  // Copy from the existing AI brief (keyless → null → fact-safe fallback in the mapping).
  const brief = await generateBrief({
    name: lead.name,
    region: lead.region,
    regionContext: lead.region,
    imageUrls: [],
  });
  const data = leadToSiteData(lead, {
    copy: brief
      ? { tagline: brief.tagline, intro: brief.intro, highlights: brief.highlights }
      : null,
    regionTagline: lead.region,
  });
  console.log(`  copy: ${brief ? "AI-brief" : "fact-safe fallback (nincs kulcs)"}`);
  console.log(`  SiteData: highlights=${data.highlights.length} · photos=${data.photos.length}`);

  const { recipe, source } = await planRecipe(data);
  console.log(
    `  recept [${source}]: skin=${recipe.skin} · archetípus=${recipe.archetype} · szekciók=${recipe.sections
      .map((s) => s.kind)
      .join(" → ")}`,
  );

  const html = renderSite(recipe, data);
  const outDir = path.resolve(process.cwd(), "sites/_engine-proof");
  await mkdir(outDir, { recursive: true });
  const safe =
    lead.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "lead";
  const file = `lead-${safe}.html`;
  await writeFile(path.join(outDir, file), html, "utf8");
  console.log(`  → ${file}\n  kimenet: ${outDir}\n`);

  await db.destroy();
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
