// Curator template-preview shots: for each art template, capture a hero-crop "card" and a
// full-page image (lightbox), rendered IN-PROCESS from a rich demo SiteData (no /tmp files).
// JPEG-compressed + modest width to keep the served assets light.
//   npx tsx scripts/shot-previews.mts [id1 id2 …]   (no id = every template)
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

// Rich demo lead (a boutique hotel) so every module (rooms/reviews/faq/stats) fills the card.
// Illustrative only — NOT a live page; §B.17 fact-fidelity governs real leads.
const demo: SiteData = {
  name: "Fortuna Vendégház",
  tagline: "Csend és kilátás a hegy tetején",
  intro:
    "Kilenc szobás butik-vendégház a régi városfal tövében, saját teraszos étteremmel, borpincével és wellness-részleggel.",
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
    { url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A vendégház", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-2/900/1100", alt: "Szoba", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-3/900/700", alt: "Terasz", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-4/900/700", alt: "Étterem", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-5/900/700", alt: "Wellness", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-6/900/700", alt: "Borpince", provenance: "owner" },
  ],
  contact: { email: "foglalas@fortunavendeghaz.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  rooms: [
    { name: "Superior szoba", capacity: "2 fő · 26 m²", note: "Városra néző, franciaágyas szoba esőztető zuhannyal.", price: "42 000 Ft / éj", photo: { url: "https://picsum.photos/seed/cit-r1/900/560", alt: "Superior" } },
    { name: "Deluxe panoráma", capacity: "2 fő · 32 m²", note: "Franciaerkély, kávégép és minibár.", price: "58 000 Ft / éj", photo: { url: "https://picsum.photos/seed/cit-r2/900/560", alt: "Deluxe" } },
    { name: "Panoráma lakosztály", capacity: "2–3 fő · 48 m²", note: "Külön nappali, kád panorámával.", price: "92 000 Ft / éj", photo: { url: "https://picsum.photos/seed/cit-r3/900/560", alt: "Lakosztály" } },
  ],
  reviews: [
    { quote: "A tetőteraszról nézni a kivilágított várat — ezért önmagában megérte.", author: "Andrea", meta: "Budapest" },
    { quote: "Az árakat előre, pontosan láttuk, a recepción egy forinttal sem lett több.", author: "Péter", meta: "Nyíregyháza" },
    { quote: "A borpince sommelier-je zseni, a reggeli pedig verhetetlen.", author: "A Hegedűs pár", meta: "Szeged" },
  ],
  stats: [
    { value: "9,2", label: "vendégértékelés", icon: "star" },
    { value: "9", label: "szoba" },
    { value: "2011", label: "óta nyitva" },
  ],
  faqs: [
    { q: "Mikor van check-in és check-out?", a: "Érkezés 15:00-tól, távozás 11:00-ig." },
    { q: "Van parkolási lehetőség?", a: "Zárt udvari parkoló, elektromos töltővel." },
    { q: "Hozhatunk kutyát?", a: "Kijelölt kutyabarát szobáinkban szívesen látjuk." },
  ],
  rating: { value: 4.6, count: 318 },
  place: { city: "Példaváros", country: "HU" },
};

// Repo-relative, NOT hardcoded to the main tree: the shots are committed assets,
// so they must land in the tree the script runs from (worktree-safe).
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "assets", "ui");
await mkdir(outDir, { recursive: true });

const args = process.argv.slice(2);
const ids = args.length ? args : Object.keys(TEMPLATES);

const browser = await chromium.launch({ executablePath: config.chromiumPath });
// Card: recognizable hero crop. Prev: PORTRAIT shot matched to the generate-panel's
// tall preview frame (so neither cover-zoom nor contain-letterbox mangles it).
// Full: whole page for the lightbox. All JPEG, downscaled.
const card = await browser.newPage({ viewport: { width: 960, height: 620 }, deviceScaleFactor: 1 });
const prev = await browser.newPage({ viewport: { width: 880, height: 1050 }, deviceScaleFactor: 1 });
const full = await browser.newPage({ viewport: { width: 820, height: 900 }, deviceScaleFactor: 1 });

for (const id of ids) {
  const tpl = TEMPLATES[id];
  if (!tpl) {
    console.log("skip (ismeretlen):", id);
    continue;
  }
  const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] };
  const html = renderSite(recipe, demo, { phase: "mock" });
  await card.setContent(html, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await card.waitForTimeout(700);
  await card.screenshot({ path: path.join(outDir, `tpl-${id}.jpg`), type: "jpeg", quality: 78 });
  await prev.setContent(html, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await prev.waitForTimeout(700);
  await prev.screenshot({ path: path.join(outDir, `tpl-${id}-prev.jpg`), type: "jpeg", quality: 78 });
  await full.setContent(html, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await full.waitForTimeout(700);
  await full.screenshot({ path: path.join(outDir, `tpl-${id}-full.jpg`), type: "jpeg", quality: 70, fullPage: true });
  console.log("shot:", id);
}
await browser.close();
