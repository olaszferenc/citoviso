// AI-planner demo (ADR-0016): SiteData → (AI) → Recipe → render. Shows that the
// planner picks skin + composition from the data's mood, and that the deterministic
// enforce() gates modules (no photos → no gallery). Writes planned-*.html.
//   npx tsx scripts/engine-plan.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { planRecipe } from "../src/engine/planner.js";
import { renderSite } from "../src/engine/render.js";
import type { SiteData } from "../src/engine/recipe.js";

const grandis: SiteData = {
  name: "GRANDIS Premium Apartments",
  tagline: "Prémium apartmanok Gödöllő szívében",
  intro: "Igényesen berendezett apartmanok a belvárosban, modern felszereltséggel.",
  highlights: ["Belvárosi elhelyezkedés", "Prémium berendezés", "Saját konyha", "Klimatizált"],
  photos: [
    { url: "https://placehold.co/600x450?text=A", alt: "Apartman" },
    { url: "https://placehold.co/600x450?text=B", alt: "Konyha" },
    { url: "https://placehold.co/600x450?text=C", alt: "Fürdő" },
  ],
  contact: { email: "olaszferenc@gmail.com" },
};

const panzio: SiteData = {
  name: "Nefelejcs Panzió",
  tagline: "Csendes családi vendégház a dombok között",
  intro: "Otthonos szobák, saját kert és házias reggeli a nyugalom szerelmeseinek.",
  highlights: ["Saját kert", "Házias reggeli", "Kutyabarát", "Ingyenes parkolás"],
  photos: [
    { url: "https://placehold.co/600x450?text=1", alt: "Szoba" },
    { url: "https://placehold.co/600x450?text=2", alt: "Kert" },
  ],
  contact: { email: "info@nefelejcspanzio.hu" },
};

// Same as grandis but with NO photos — proves the gallery is data-gated out.
const grandisNoPhotos: SiteData = { ...grandis, photos: [] };

async function main() {
  const outDir = path.resolve(process.cwd(), "sites/_engine-proof");
  await mkdir(outDir, { recursive: true });

  const cases: Array<{ label: string; file: string; data: SiteData }> = [
    { label: "GRANDIS (prémium)", file: "planned-grandis.html", data: grandis },
    { label: "Nefelejcs (családias)", file: "planned-panzio.html", data: panzio },
    { label: "GRANDIS fotó NÉLKÜL", file: "planned-grandis-nophotos.html", data: grandisNoPhotos },
  ];

  for (const c of cases) {
    const { recipe, source } = await planRecipe(c.data);
    const html = renderSite(recipe, c.data);
    await writeFile(path.join(outDir, c.file), html, "utf8");
    const order = recipe.sections.map((s) => s.kind).join(" → ");
    console.log(`\n  ${c.label}  [${source}]`);
    console.log(`    skin:     ${recipe.skin}`);
    console.log(`    szekciók: ${order}`);
    console.log(`    → ${c.file}`);
  }
  console.log(`\n  kimenet: ${outDir}\n`);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
