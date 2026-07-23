// MAX-CRAFT proof (ADR-0018): render ONE deliberately DENSE, fully-populated SiteData through
// the engine at maximum craft, to see how CLOSE the composition engine can get to the reference
// bar (Silva / 03-dark-luxury) — evidence for the A-vs-B decision. This is a design proof: the
// data is fully populated (rooms with photos, stats, reviews), i.e. the "engine with rich data"
// case (= a live page with real data, or a mock whose owner filled everything in).
//   npx tsx scripts/engine-max.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { injectRuntime } from "../src/generator/runtime.js";

const P = (seed: string, w = 1200, h = 900) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const data: SiteData = {
  name: "Silvana Erdei Rezort",
  tagline: "Csend, amit hallani lehet — prémium erdei menedék a fák koronája fölött.",
  intro:
    "A Silvana nem hotel: tizennyolc, egymástól takarásban lévő lakosztály, padlótól plafonig üvegezve, természetes tölgy és kő felületekkel. Saját szauna, saját panoráma — közös csak az erdő csendje és a lombkorona-medence, ahonnan a fák tetejére látni.",
  highlights: [
    "Panorámaszauna",
    "Kültéri jacuzzi",
    "Reggeli-kosár termelőktől",
    "Kandalló + tűzifa",
    "Erdőfürdő túraútvonalak",
    "Privát parkoló + EV-töltő",
    "Klíma minden lakosztályban",
    "Kutyabarát lakosztályok",
  ],
  photos: [
    { url: P("silvana-a"), alt: "Reggeli köd az erdőben" },
    { url: P("silvana-b"), alt: "Lombkorona medence" },
    { url: P("silvana-c"), alt: "Lakosztály este" },
    { url: P("silvana-d"), alt: "Szaunaház a patakparton" },
    { url: P("silvana-e"), alt: "Erdei ösvény" },
    { url: P("silvana-f"), alt: "Terasz naplementében" },
  ],
  rooms: [
    { name: "Canopy Suite", capacity: "38 m² · 2 fő · lombkorona szint", note: "Függőágy az üvegfal előtt, privát erkély a fák magasságában, esőztető zuhany.", photo: { url: P("silvana-r1", 1000, 750), alt: "Canopy Suite" } },
    { name: "Forest Deluxe", capacity: "30 m² · 2 fő · földszint", note: "Közvetlen kilépés a mohakertbe, kültéri fürdődézsa, kandalló a hűvös estékre.", photo: { url: P("silvana-r2", 1000, 750), alt: "Forest Deluxe" } },
    { name: "Sky Penthouse", capacity: "64 m² · 2–4 fő · tetőszint", note: "Panorámás tetőterasz privát jacuzzival, külön nappali, csillagnéző tetőablak.", photo: { url: P("silvana-r3", 1000, 750), alt: "Sky Penthouse" } },
  ],
  reviews: [
    { quote: "Három napig nem néztem a telefonomra. Nem tiltotta senki — egyszerűen nem hiányzott.", author: "Horváth Dóra", meta: "Budapest · 2026. január" },
    { quote: "A lombkorona-medencéből néztük a naplementét. Ez volt életünk legjobb évfordulója.", author: "Kiss Márton és Anna", meta: "Szeged · 2026. február" },
    { quote: "A slow dinner önmagában megér egy utat. A csend meg mindent visz.", author: "Fekete Gábor", meta: "Debrecen · 2026. május" },
  ],
  stats: [
    { value: "18", label: "lakosztály" },
    { value: "4,9★", label: "487 értékelés" },
    { value: "720 m", label: "tengerszint felett" },
    { value: "2021", label: "óta várunk" },
  ],
  contact: { email: "stay@silvana.hu", phone: "+36 37 000 000", address: "3235 Mátraszentimre, Fenyves út 1." },
};

// Max-craft recipe (all real data → no sample notes). Dark, premium skin.
const recipe: Recipe = {
  skin: "immersive-dark",
  archetype: "stacked",
  sections: [
    { kind: "hero" },
    { kind: "stats" },
    { kind: "features" },
    { kind: "rooms" },
    { kind: "gallery", variant: "masonry" },
    { kind: "reviews" },
    { kind: "enquiry" },
  ],
};

async function main() {
  const html = await injectRuntime(renderSite(recipe, data));
  const outDir = path.resolve(process.cwd(), "sites/_engine-proof");
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, "max-craft.html");
  await writeFile(file, html, "utf8");
  console.log(`\n  max-craft proof: ${file}`);
  console.log(`  skin=${recipe.skin} · archetípus=${recipe.archetype} · ${recipe.sections.length} szekció · minden VALÓS adat\n`);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
