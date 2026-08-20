// Proof + design-gate harness for the ADR-0027 art templates. Renders each requested
// template id (default: ALL) with a rich demo SiteData (rooms/reviews/stats/faqs so the
// full "wow" shows), writes the HTML under sites/_engine-proof/templates/, and runs the
// deterministic design-doctrine gate (checkDesign) on each — printing PASS/FLAG.
//   npx tsx scripts/template-shots.ts [id1 id2 …]   (no id = every template)
// Screenshot after with:  npx tsx scripts/engine-shot.ts sites/_engine-proof/templates/*.html
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { checkDesign } from "../src/generator/designCheck.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

// Rich demo lead (a boutique hotel) — placeholders for photos; illustrative content so every
// module (rooms/reviews/faq/stats) renders. NOT a live page; §B.17 fact-fidelity governs real leads.
const demo: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás a hegy tetején",
  intro:
    "Kilenc szobás butikhotel a régi városfal tövében, saját teraszos étteremmel, borpincével és wellness-részleggel. A nyugalom itt nem program, hanem alapállapot.",
  highlights: [
    "Panorámás tetőterasz",
    "Borpince, helyi tételekkel",
    "Wellness és szauna",
    "Teraszos étterem",
    "Ingyenes parkolás",
    "Gigabit WiFi",
    "Kutyabarát szobák",
    "E-bike bérlés",
  ],
  photos: [
    { url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A hotel", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-2/900/1100", alt: "Szoba", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-3/900/700", alt: "Terasz", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-4/900/700", alt: "Étterem", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-5/900/700", alt: "Wellness", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-6/900/700", alt: "Borpince", provenance: "owner" },
  ],
  contact: {
    email: "foglalas@hotelpelda.hu",
    phone: "+36 30 000 0000",
    address: "3300 Példaváros, Vár utca 2.",
  },
  rooms: [
    {
      name: "Superior szoba",
      capacity: "2 fő · 26 m²",
      note: "Városra néző, franciaágyas szoba esőztető zuhannyal.",
      price: "42 000 Ft / éj",
      photo: { url: "https://picsum.photos/seed/cit-r1/900/560", alt: "Superior" },
    },
    {
      name: "Deluxe panoráma",
      capacity: "2 fő · 32 m²",
      note: "Franciaerkély a várra, kávégép és minibár.",
      price: "58 000 Ft / éj",
      photo: { url: "https://picsum.photos/seed/cit-r2/900/560", alt: "Deluxe" },
    },
    {
      name: "Panoráma lakosztály",
      capacity: "2–3 fő · 48 m²",
      note: "Külön nappali, kád panorámával, privát check-in.",
      price: "92 000 Ft / éj",
      photo: { url: "https://picsum.photos/seed/cit-r3/900/560", alt: "Lakosztály" },
    },
  ],
  reviews: [
    { quote: "A tetőteraszról nézni a kivilágított várat — ezért önmagában megérte.", author: "Andrea", meta: "Budapest" },
    { quote: "Az árakat előre, pontosan láttuk, a recepción egy forinttal sem lett több.", author: "Péter", meta: "Nyíregyháza" },
    { quote: "A borpince sommelier-je zseni, a reggeli pedig verhetetlen.", author: "A Hegedűs pár", meta: "Szeged" },
  ],
  stats: [
    { value: "9,2", label: "vendégértékelés", icon: "star" },
    { value: "84", label: "szoba" },
    { value: "1928", label: "óta nyitva" },
  ],
  faqs: [
    { q: "Mikor van check-in és check-out?", a: "Érkezés 15:00-tól, távozás 11:00-ig. Korábbi érkezésnél a csomagot elhelyezzük." },
    { q: "Van parkolási lehetőség?", a: "Zárt garázs az épület alatt, elektromos töltővel." },
    { q: "Hozhatunk kutyát?", a: "Kijelölt kutyabarát szobáinkban szívesen látjuk a négylábúakat." },
    { q: "A wellness benne van az árban?", a: "A Deluxe-tól felfelé igen; a Superiorhoz külön díjas vagy csomagban kérhető." },
  ],
  rating: { value: 4.6, count: 1892 },
  place: { city: "Példaváros", country: "HU" },
};

async function main() {
  const args = process.argv.slice(2);
  const ids = args.length ? args : Object.keys(TEMPLATES);
  const outDir = path.resolve(process.cwd(), "sites/_engine-proof/templates");
  await mkdir(outDir, { recursive: true });

  let flags = 0;
  for (const id of ids) {
    const tpl = TEMPLATES[id];
    if (!tpl) {
      console.error(`  ?? ismeretlen template: ${id}`);
      flags++;
      continue;
    }
    const skin = tpl.skins[0] ?? "editorial-warm";
    const recipe: Recipe = { template: id, skin, archetype: "stacked", sections: [] };
    const html = renderSite(recipe, demo, { phase: "mock" });
    const dest = path.join(outDir, `${id}.html`);
    await writeFile(dest, html, "utf8");
    const v = checkDesign(html);
    if (v.verdict !== "pass") flags++;
    const mark = v.verdict === "pass" ? "PASS ✅" : `FLAG ❌ (${v.reason})`;
    console.log(`  ${id.padEnd(14)} skin=${skin.padEnd(18)} ${mark}  → ${dest}`);
  }
  console.log(`\n  ${ids.length} template · ${flags ? `${flags} FLAG ❌` : "mind PASS ✅"}`);
  if (flags) process.exit(1);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
