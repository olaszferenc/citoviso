// Regression gate: no tall booking dock may cover the mobile viewport (2026-08-21 fix).
// The bug: an element that HOLDS the enquiry/booking FORM is position:sticky|fixed and,
// on a phone, its vertically-stacked fields grow tall enough to pin over the top of the
// page and hide the content behind it (parallax .t-dock / cinematic .cn-dock /
// immersive-parallax .cit-arch-dock all shared this before their max-width:700px guard).
//
// This measures the ACTUAL bug — not the CSS text — so it can't be fooled by a new class
// name or a different template: every template + archetype is rendered at a phone width
// (390px), and for every booking-form container we check whether it (or an ancestor) is
// sticky/fixed AND tall (> 40% of the viewport). Any such element is a covering dock → FAIL.
//
// Thin things are safe by construction: sticky navs and fixed bottom CTA bars carry no form
// <input>, so they are never matched; a short sticky booking BAR (< 40% vh) is allowed.
//   npx tsx scripts/mobile-sticky-check.mts            (all templates + archetypes)
//   npx tsx scripts/mobile-sticky-check.mts cinematic  (subset by id)
import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { ARCHETYPES } from "../src/engine/archetypes.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";

// Rich enough that the enquiry dock + rooms + reviews all render (form fields = the tall part).
const demo: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás a hegy tetején",
  intro:
    "Kilenc szobás butikhotel a régi városfal tövében, saját teraszos étteremmel, borpincével és wellness-részleggel.",
  highlights: ["Panorámás tetőterasz", "Borpince", "Wellness és szauna", "Teraszos étterem", "Ingyenes parkolás", "Gigabit WiFi"],
  photos: [
    { url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A hotel", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-2/900/1100", alt: "Szoba", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-3/900/700", alt: "Terasz", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-4/900/700", alt: "Étterem", provenance: "owner" },
  ],
  contact: { email: "foglalas@hotelpelda.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  rooms: [
    { name: "Superior szoba", capacity: "2 fő · 26 m²", note: "Városra néző, franciaágyas.", price: "42 000 Ft / éj", photo: { url: "https://picsum.photos/seed/cit-r1/900/560", alt: "Superior" } },
    { name: "Deluxe panoráma", capacity: "2 fő · 32 m²", note: "Franciaerkély a várra.", price: "58 000 Ft / éj", photo: { url: "https://picsum.photos/seed/cit-r2/900/560", alt: "Deluxe" } },
  ],
  reviews: [
    { quote: "A tetőteraszról nézni a kivilágított várat — ezért önmagában megérte.", author: "Andrea", meta: "Budapest" },
    { quote: "Az árakat előre, pontosan láttuk.", author: "Péter", meta: "Nyíregyháza" },
  ],
  stats: [{ value: "9,2", label: "vendégértékelés", icon: "star" }, { value: "84", label: "szoba" }],
  faqs: [{ q: "Mikor van check-in?", a: "Érkezés 15:00-tól, távozás 11:00-ig." }],
  rating: { value: 4.6, count: 1892 },
  place: { city: "Példaváros", country: "HU" },
};

const baseSections: Recipe["sections"] = (["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const).map(
  (kind) => ({ kind }),
);

// In-browser audit (passed as a STRING so tsx/esbuild's __name helper is not injected into
// the page context). Returns the covering docks it finds.
const AUDIT = `(() => {
  const vh = window.innerHeight;
  const THRESH = vh * 0.4;
  // Elements that carry the booking FORM (its stacked fields are what grows tall on mobile).
  const anchors = Array.from(document.querySelectorAll(
    'input, .cit-book, .cit-enquiry, [data-cit-module="enquiry"]'
  ));
  const seen = new Set();
  const bad = [];
  for (const node of anchors) {
    let el = node;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (cs.position === 'sticky' || cs.position === 'fixed') {
        if (!seen.has(el)) {
          seen.add(el);
          const r = el.getBoundingClientRect();
          if (r.height > THRESH) {
            bad.push({ sel: (el.className && el.className.toString ? el.className.toString() : el.tagName), pos: cs.position, h: Math.round(r.height), vh: Math.round(vh) });
          }
        }
        break; // nearest positioned ancestor decides
      }
      el = el.parentElement;
    }
  }
  return bad;
})()`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // Build the render set: every template (by id) + every archetype (retired ones stay
  // renderable from persisted recipes, so they must be guarded too).
  const targets: { id: string; kind: "template" | "archetype"; recipe: Recipe }[] = [];
  for (const id of Object.keys(TEMPLATES)) {
    if (args.length && !args.includes(id)) continue;
    const tpl = TEMPLATES[id]!;
    targets.push({ id, kind: "template", recipe: { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: baseSections } });
  }
  for (const arch of Object.values(ARCHETYPES)) {
    if (args.length && !args.includes(arch.id)) continue;
    targets.push({ id: arch.id, kind: "archetype", recipe: { skin: "editorial-warm", archetype: arch.id, sections: baseSections } });
  }

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  // Speed + offline: never fetch external images/fonts (dock height comes from form fields).
  await page.route("**/*", (route) => {
    const t = route.request().resourceType();
    return t === "image" || t === "font" || t === "media" ? route.abort() : route.continue();
  });

  let flags = 0;
  for (const t of targets) {
    // Hydrate exactly like the real mock (injectRuntime) and LET THE RUNTIME SCRIPT RUN
    // ('load' + wait for the mounted date inputs): the booking widget's stacked fields are
    // what make the dock tall on mobile. Without the live mount the slot stays short and the
    // bug hides (false negative — cinematic slipped past a static-markup measure).
    const html = await injectRuntime(renderSite(t.recipe, demo, { phase: "mock" }), demo.lang);
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    await page.waitForSelector('[data-cit-module="booking"] input, .cit-book input', { timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(120); // let layout settle
    const bad = (await page.evaluate(AUDIT)) as { sel: string; pos: string; h: number; vh: number }[];
    if (bad.length) {
      flags++;
      for (const b of bad) {
        console.error(
          `  ❌ ${t.kind} ${t.id}: a foglaló-dokk position:${b.pos} és MAGAS mobilon (${b.h}px / ${b.vh}px vh) → takarja a tartalmat. ` +
            `Selector: "${b.sel}". Tegyél rá mobil-guardot: @media(max-width:700px){ … position:static }`, // i18n-exempt: operator log
        );
      }
    } else {
      console.log(`  ✅ ${t.kind.padEnd(9)} ${t.id.padEnd(20)} — nincs takaró dokk mobilon`); // i18n-exempt
    }
  }
  await browser.close();

  console.log(`\n  ${targets.length} kimenet · ${flags ? `${flags} FLAG ❌` : "mind PASS ✅ (nincs mobil viewport-takaró foglaló-dokk)"}`);
  if (flags) process.exit(1);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
