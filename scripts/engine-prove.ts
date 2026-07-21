// Proof slice for ADR-0016 (composition engine). ONE recipe + the deterministic
// renderer, rendered with DEMO data (→ mock) and REAL-ish GRANDIS data (→ live).
// Proves the mock=live guarantee: the two outputs share a byte-identical STRUCTURE
// (skeleton match), differing only in content. Also renders the same recipe+data in
// a 2nd skin to show the variety axis. Writes to sites/_engine-proof/.
//   npx tsx scripts/engine-prove.ts
//
// NB: this is an ENGINE proof, not a live customer page — the photos are placeholders
// and the design is a minimal 4-primitive set. Fact-fidelity (§B.17) applies when the
// engine feeds real leads; here it only demonstrates structural mock=live.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderSite } from "../src/engine/render.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

// One recipe: fixed composition + skin. In production the AI planner emits this.
const recipe: Recipe = {
  skin: "editorial-warm",
  sections: [{ kind: "hero" }, { kind: "features" }, { kind: "gallery" }, { kind: "enquiry" }],
};

// Same-SHAPE data (4 highlights, 3 photos, has email) so the skeletons line up —
// proving that same-shape data renders a byte-identical structure. (Different-shape
// data would legitimately change the structure: the form follows the data.)
const demoData: SiteData = {
  name: "Példa Panzió",
  tagline: "Nyugalom a természet ölén",
  intro: "Csendes, családias szálláshely a domboldalon, saját kerttel és reggeli terasszal.",
  highlights: ["Saját kert", "Ingyenes parkolás", "Reggeli terasz", "Kutyabarát"],
  photos: [
    { url: "https://placehold.co/600x450?text=1", alt: "Szoba" },
    { url: "https://placehold.co/600x450?text=2", alt: "Kert" },
    { url: "https://placehold.co/600x450?text=3", alt: "Terasz" },
  ],
  contact: { email: "info@peldapanzio.hu" },
};

const grandisData: SiteData = {
  name: "GRANDIS Premium Apartments",
  tagline: "Prémium apartmanok Gödöllő szívében",
  intro: "Igényesen berendezett apartmanok a belvárosban, kényelmes megközelítéssel és modern felszereltséggel.",
  highlights: ["Belvárosi elhelyezkedés", "Prémium berendezés", "Saját konyha", "Klimatizált"],
  photos: [
    { url: "https://placehold.co/600x450?text=A", alt: "Apartman" },
    { url: "https://placehold.co/600x450?text=B", alt: "Konyha" },
    { url: "https://placehold.co/600x450?text=C", alt: "Fürdő" },
  ],
  contact: { email: "olaszferenc@gmail.com", address: "Gödöllő, Városmajor u. 3, 2100" },
};

/** Strip content: mask text + non-structural attribute values, keep the tag/class/
 *  data-cit-module skeleton. If two pages share a skeleton, their STRUCTURE is identical. */
function skeleton(html: string): string {
  return html
    .replace(/>([^<]*)</g, (_m, t: string) => (t.trim() ? ">·<" : "><"))
    .replace(/([\w-]+)="([^"]*)"/g, (m, name: string) =>
      name === "class" || name === "data-cit-module" || name === "data-cit-variant"
        ? m
        : `${name}="·"`,
    );
}

async function main() {
  const outDir = path.resolve(process.cwd(), "sites/_engine-proof");
  await mkdir(outDir, { recursive: true });

  const mock = renderSite(recipe, demoData);
  const live = renderSite(recipe, grandisData);
  const liveDark = renderSite({ ...recipe, skin: "immersive-dark" }, grandisData);

  await writeFile(path.join(outDir, "mock.html"), mock, "utf8");
  await writeFile(path.join(outDir, "live.html"), live, "utf8");
  await writeFile(path.join(outDir, "live-immersive-dark.html"), liveDark, "utf8");

  const same = skeleton(mock) === skeleton(live);
  console.log(`\n  mock=live SZERKEZET: ${same ? "AZONOS ✅ (bájtra egyező váz)" : "ELTÉR ❌"}`);
  console.log(`  mock.html ${mock.length}b · live.html ${live.length}b — a tartalom eltér, a VÁZ azonos`);
  console.log(`  skin-tengely: live-immersive-dark.html = ugyanaz a recept+adat, MÁS skin (más kinézet, azonos váz)`);
  console.log(`  kimenet: ${outDir}\n`);

  if (!same) {
    // Show the first divergence to debug a broken primitive.
    const a = skeleton(mock);
    const b = skeleton(live);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    console.error(`  első eltérés @${i}:`);
    console.error(`   mock: …${a.slice(Math.max(0, i - 40), i + 40)}…`);
    console.error(`   live: …${b.slice(Math.max(0, i - 40), i + 40)}…`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
