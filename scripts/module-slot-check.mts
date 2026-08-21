// ADR-0047 gate: a paid module must land in a NAMED PLACE, at full width.
//
// WHY THIS EXISTS. Two failures shipped because nobody measured WHERE module content
// ends up:
//   1. Every block was concatenated into one lump placed before the enquiry slot.
//      That reads as "at the end" but a template may put its CTA anywhere — on
//      `editorial` it is the coupon near the top, so ten modules landed ahead of the
//      gallery and the reviews. Live tenant pages included.
//   2. The configurator injected its sample blocks before `querySelector("footer")`,
//      and 12 of 16 templates mark a review's author line with <footer> inside a
//      <blockquote>. So the entire module offer was rendered INSIDE a quote card,
//      295–530px wide. That is what the owner saw as "one strip on the left".
//
// Both were invisible to every existing guard, because all of them asked "is the
// content present?" and none asked "where, and how wide?". This one measures place
// and width in a real browser.
//
//   npx tsx scripts/module-slot-check.mts

import { chromium } from "playwright-core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { MODULE_SLOTS } from "../src/engine/moduleSections.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const BARE: SiteData = {
  name: "Teszt Vendégház",
  tagline: "Teszt",
  intro: "Teszt bevezető szöveg.",
  highlights: ["Kert", "Parkoló"],
  photos: [{ url: "https://placehold.co/1200x800", alt: "a", provenance: "owner" }],
  contact: { email: "a@b.hu", phone: "+3630" },
};

/** A tenant who bought everything — every module has content to place. */
const FULL = {
  ...BARE,
  rooms: [{ name: "Padlásszoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
  amenities: ["Wifi", "Parkoló"],
  usp: ["Csend"],
  poi: ["Strand 2 km"],
  hours: { checkInFrom: "14:00", checkInTo: "", checkOutUntil: "10:00", note: "" },
  pricing: { currency: "HUF", unit: "per_night", note: "", units: [{ name: "Padlásszoba", base: 19000 }] },
  location: { showMap: true, approachNote: "A templomnál jobbra.", parkingNote: "" },
  newsletter: { title: "Hírlevél", subtitle: "Évente pár levél." },
  reviews: [{ quote: "Nagyon jó volt.", author: "Anna" }],
  googleRating: { value: 4.9, count: 143, url: "https://example.com/reviews" },
  reviewForm: {},
} as unknown as SiteData;

const ids = Object.keys(TEMPLATES);
const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

// ── 1. every template names all four places ─────────────────────────────────
console.log(`Slot-lefedettség (${ids.length} sablon):\n`);
{
  const missing: string[] = [];
  for (const t of ids) {
    const bare = renderSite(recipe(t), BARE, { phase: "live" });
    const absent = MODULE_SLOTS.filter((s) => !bare.includes(`data-cit-slot="${s}"`));
    if (absent.length) missing.push(`${t}(${absent.join(",")})`);
  }
  check(
    "⭐⭐ mind a 16 sablon megnevezi mind a 4 helyet",
    missing.length === 0,
    missing.slice(0, 6),
  );
}

// ── 2. no module falls back to the lump ─────────────────────────────────────
{
  const leftovers: string[] = [];
  for (const t of ids) {
    const html = renderSite(recipe(t), FULL, { phase: "live" });
    // A filled slot is replaced by its blocks, so no marker may survive a full render.
    if (/data-cit-slot="/.test(html)) leftovers.push(t);
  }
  check("kitöltött oldalon nem marad üresen álló slot-jelölő", leftovers.length === 0, leftovers);
}

// ── 3. the blocks are actually WIDE — the bug that shipped ──────────────────
console.log("\nSzélesség valódi böngészőben (1400px viewport):\n");
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const narrow: string[] = [];
const notAllRendered: string[] = [];
for (const t of ids) {
  const html = renderSite(recipe(t), FULL, { phase: "live" });
  const dir = await mkdtemp(path.join(tmpdir(), "slot-"));
  const f = path.join(dir, "p.html");
  await writeFile(f, html, "utf8");
  await page.goto(pathToFileURL(f).href);

  const res = await page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll("section.cit-modsec"));
    const widths = secs.map((s) => Math.round(s.getBoundingClientRect().width));
    return { count: secs.length, min: widths.length ? Math.min(...widths) : 0 };
  });

  // 10 configured modules → 10 shared blocks (rooms may be shown by the template
  // itself, so 9 is also correct; fewer than that means something vanished).
  if (res.count < 9) notAllRendered.push(`${t}(${res.count})`);
  // A full-width section on a 1400px viewport is never ~300px. The shipped bug
  // produced 295–530px, so 900px separates "in the flow" from "trapped in a card".
  if (res.min < 900) narrow.push(`${t}(${res.min}px)`);
}
await browser.close();

check("minden sablon kirendereli a modul-blokkokat", notAllRendered.length === 0, notAllRendered);
check(
  "⭐⭐ egyetlen modul-blokk sem szorul be keskeny oszlopba (≥900px)",
  narrow.length === 0,
  narrow.slice(0, 6),
);

if (failures) {
  console.error(`\n⛔ module-slot-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ module-slot-check: a modulok megnevezett helyre, teljes szélességben kerülnek.");
