// Planner variety QA (ADR-0017 éles-készenléti léc): stress-test the AI planner's TASTE in
// isolation. Feed it several mood-distinct SiteData FIXTURES (not real leads — no fact-fidelity
// concern) and observe whether it varies skin / archetype / variant by mood, or collapses to a
// few defaults. Renders a contact-sheet and reports the variety distribution.
//   npx tsx scripts/engine-qa.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ARCHETYPES } from "../src/engine/archetypes.js";
import { planRecipe } from "../src/engine/planner.js";
import type { Photo, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { SKINS } from "../src/engine/skins.js";
import { checkDesign } from "../src/generator/designCheck.js";
import { injectRuntime } from "../src/generator/runtime.js";

const photos = (seed: string, n: number): Photo[] =>
  Array.from({ length: n }, (_, i) => ({
    url: `https://picsum.photos/seed/${seed}${i}/600/${420 + ((i * 37) % 160)}`,
    alt: `${seed} ${i + 1}`,
  }));

// Mood-distinct fixtures — the mood lives in tagline/intro so the planner must read it.
const FIXTURES: Array<{ id: string; data: SiteData }> = [
  {
    id: "premium-city",
    data: {
      name: "Belváros Prémium Apartman",
      tagline: "Letisztult luxus a város szívében",
      intro: "Designer apartman prémium anyagokból, elegáns, minimalista enteriőrrel, üzleti utazóknak és igényes vendégeknek.",
      highlights: ["Designer enteriőr", "Prémium ágynemű", "Nespresso", "Klíma"],
      photos: photos("city", 6),
      contact: { email: "info@belvarospremium.hu" },
    },
  },
  {
    id: "rustic-vineyard",
    data: {
      name: "Szőlőhegyi Présház",
      tagline: "Rusztikus nyugalom a borvidék ölén",
      intro: "Régi présházból felújított vendégház, boltíves pincével, kőfalakkal és saját szőlővel — csendes, földközeli pihenés.",
      highlights: ["Boltíves pince", "Kőfalas terasz", "Saját bor", "Kemence"],
      photos: photos("vine", 5),
      contact: { email: "foglalas@szolohegyipresház.hu" },
    },
  },
  {
    id: "lakeside-family",
    data: {
      name: "Nádas Családi Panzió",
      tagline: "Napfényes, derűs napok a tóparton",
      intro: "Barátságos családi panzió közvetlenül a vízparton, játszótérrel, strandközelben — gyerekbarát, könnyed nyaralás.",
      highlights: ["Vízparti fekvés", "Játszótér", "Kerékpárkölcsönzés", "Reggeli"],
      photos: photos("lake", 4),
      contact: { email: "hello@nadaspanzio.hu" },
    },
  },
  {
    id: "dark-boutique",
    data: {
      name: "Óbor Boutique Hotel",
      tagline: "Cinematic esték, drámai belső terek",
      intro: "Sötét, elegáns boutique hotel dizájnos hangulatvilágítással, exkluzív bárral — látványos, prémium élmény.",
      highlights: ["Dizájn-világítás", "Exkluzív bár", "Wellness", "Éjszakai terasz"],
      photos: photos("dark", 6),
      contact: { email: "reserve@oborhotel.hu" },
    },
  },
  {
    id: "budget-guesthouse",
    data: {
      name: "Diófa Vendégház",
      tagline: "Egyszerű, tiszta, barátságos szállás",
      intro: "Praktikus, becsületes vendégház jó áron, tiszta szobákkal és közvetlen vendéglátással — se sallang, se meglepetés.",
      highlights: ["Ingyenes parkolás", "Tiszta szobák", "Konyhahasználat"],
      photos: [],
      contact: { email: "diofavendeghaz@gmail.com" },
    },
  },
  {
    id: "airy-sunny-bnb",
    data: {
      name: "Levendula Napfény Vendégház",
      tagline: "Levegős, világos, napsütötte reggelek",
      intro: "Krém-homok tónusú, tágas és világos vendégház bőséges természetes fénnyel, kertre nyíló terasszal — könnyed, mediterrán derű.",
      highlights: ["Napfényes terasz", "Levendulakert", "Házi reggeli", "Csendes utca"],
      photos: photos("sun", 5),
      contact: { email: "info@levendulanapfeny.hu" },
    },
  },
  {
    id: "wine-cellar-estate",
    data: {
      name: "Éjféli Pince Birtok",
      tagline: "Gyertyafényes pincék, mély bordó esték",
      intro: "Történelmi borbirtok éjfekete pincékkel, gyertyafényes kóstolóval és patinás présházzal — drámai, borvidéki luxus.",
      highlights: ["Pincekóstoló", "Barrique-terem", "Birtoklátogatás", "Sommelier"],
      photos: photos("cellar", 6),
      contact: { email: "birtok@ejfelipince.hu" },
    },
  },
];

async function main() {
  const outDir = path.resolve(process.cwd(), "sites/_engine-proof/qa");
  await mkdir(outDir, { recursive: true });

  const usedSkins = new Set<string>();
  const usedArch = new Set<string>();
  const usedVariants = new Set<string>();
  let aiCount = 0;
  const cards: string[] = [];

  for (const fx of FIXTURES) {
    const { recipe, source } = await planRecipe(fx.data);
    if (source === "ai") aiCount++;
    usedSkins.add(recipe.skin);
    usedArch.add(recipe.archetype);
    const variantSig = recipe.sections
      .map((s) => `${s.kind}:${s.variant ?? "·"}`)
      .join(" ");
    for (const s of recipe.sections) if (s.variant) usedVariants.add(`${s.kind}:${s.variant}`);

    const html = await injectRuntime(renderSite(recipe, fx.data));
    const file = `${fx.id}.html`;
    await writeFile(path.join(outDir, file), html, "utf8");
    const design = checkDesign(html);

    console.log(`  ${fx.id.padEnd(20)} [${source}] skin=${recipe.skin} · arch=${recipe.archetype}`);
    console.log(`  ${" ".repeat(20)}   ${variantSig} · dizájn=${design.verdict}`);
    cards.push(
      `<figure class="card">
        <figcaption><b>${fx.id}</b> — „${fx.data.tagline}"<br>
          <span class="t">skin:</span> ${recipe.skin} · <span class="t">arch:</span> ${recipe.archetype} · <span class="t">variáns:</span> ${variantSig} <span class="v">${design.verdict}</span></figcaption>
        <iframe src="./${file}" loading="lazy"></iframe>
      </figure>`,
    );
  }

  console.log(`\n  === VARIÁCIÓ ===`);
  console.log(`  skin:      ${usedSkins.size}/${Object.keys(SKINS).length} különböző (${[...usedSkins].join(", ")})`);
  console.log(`  archetípus: ${usedArch.size}/${Object.keys(ARCHETYPES).length} különböző (${[...usedArch].join(", ")})`);
  console.log(`  nem-alap variánsok: ${usedVariants.size} (${[...usedVariants].join(", ") || "egyik sem"})`);
  console.log(`  AI-tervezés: ${aiCount}/${FIXTURES.length}\n`);

  const index = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Citoviso — planner QA</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #0f1115; color: #e8e6e1; padding: 20px; }
  h1 { font-size: 1.2rem; } .mut { color: #9a988f; font-size: .9rem; }
  .grid { display: grid; gap: 20px; grid-template-columns: 1fr; margin-top: 14px; }
  .card { background: #171a20; border: 1px solid #262a31; border-radius: 12px; overflow: hidden; }
  figcaption { padding: 10px 12px; font-size: .85rem; line-height: 1.5; }
  .t { color: #9a988f; } .v { float: right; color: #7bd88f; font-size: .72rem; }
  iframe { width: 100%; height: 720px; border: 0; border-top: 1px solid #262a31; background: #fff; display: block; }
</style></head><body>
  <h1>Planner QA — hangulat → recept</h1>
  <p class="mut">${FIXTURES.length} hangulat-fixture · skin ${usedSkins.size}/${Object.keys(SKINS).length} · archetípus ${usedArch.size}/${Object.keys(ARCHETYPES).length} · a planner a hangulatból választ skint/archetípust/variánst.</p>
  <div class="grid">${cards.join("\n    ")}</div>
</body></html>`;
  await writeFile(path.join(outDir, "index.html"), index, "utf8");
  console.log(`  contact-sheet: ${path.join(outDir, "index.html")}\n`);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
