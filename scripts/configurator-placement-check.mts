// ADR-0047 → ADR-0061 gate: what the LEAD sees when the cold-outreach link opens.
//
// HISTORY (both failures shipped): the sample cards once landed inside a review
// quote (295–530px), then only appeared on first panel-open. ADR-0061 then retired
// the generic sample-card layer entirely for NEW artifacts: every module renders
// SERVER-SIDE as a native-styled, fully interactive section (marked sample data
// where real data is absent), so the configurator has nothing left to inject.
//
// What this measures now, in a real browser:
//   1. NEW artifact: zero injected [data-cit-sample] cards — and the all-in promise
//      is honoured by the PAGE: every sellable module's surface is present
//      server-side (hours/pricing/poi/newsletter/map/booking-request), with the
//      "Minta" marking on the sampled ones.
//   2. OLD artifact (no data-cit-native stamp): the legacy sample-card fallback
//      still works — already-sent mocks must keep selling.
//
//   npx tsx scripts/configurator-placement-check.mts

import { chromium } from "playwright-core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// A cold lead: name, a photo, a phone number, real coordinates. No module data —
// exactly the case where the mock must still demo EVERY module natively.
const LEAD: SiteData = {
  name: "Bánó Gábor",
  tagline: "Köveskál",
  intro: "Teszt bevezető szöveg a leadről.",
  highlights: ["Kert", "Parkoló"],
  photos: [{ url: "https://placehold.co/1200x800", alt: "Kert", provenance: "places" }],
  contact: { email: "a@b.hu", phone: "+36301112233", address: "Fő utca 1., Köveskál" },
  geo: { lat: 46.88, lon: 17.55 },
  rating: { value: 4.9, count: 143 },
};

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const injected: string[] = [];
const missing: string[] = [];
const unmarked: string[] = [];

// Every sellable module's page surface, as it must exist on a NEW all-in mock.
const SURFACES: [string, RegExp][] = [
  ["hours", /data-cit-module="hours"/],
  ["pricing", /data-cit-module="pricing"/],
  ["poi", /data-cit-module="poi"/],
  ["newsletter", /data-cit-module="newsletter"/],
  ["map", /data-cit-module="map"[^>]*data-cit-query="/],
  ["booking-demo", /data-cit-variant="request"[^>]*data-cit-demo="1"|data-cit-demo="1"[^>]*data-cit-variant="request"/],
  ["review-form", /data-cit-module="review-form"/],
  ["gallery", /data-cit-module="gallery"/],
];

console.log(`ADR-0061 all-in mock (${Object.keys(TEMPLATES).length} sablon):\n`);

for (const t of Object.keys(TEMPLATES)) {
  const recipe: Recipe = { template: t, skin: "", archetype: "", sections: [] };
  const bare = renderSite(recipe, LEAD, { phase: "mock" });
  const html = await injectConfigurator(bare, "00000000-0000-0000-0000-000000000000", "Teszt Lead");

  const absent = SURFACES.filter(([, re]) => !re.test(bare)).map(([n]) => n);
  if (absent.length) missing.push(`${t}(${absent.join(",")})`);
  // The §B.17 marking lives ON the sampled sections: hours + pricing + poi at least.
  const pills = bare.match(/<span class="cit-modsec__minta"/g)?.length ?? 0;
  if (pills < 3) unmarked.push(`${t}(${pills})`);

  const dir = await mkdtemp(path.join(tmpdir(), "cfg-"));
  const f = path.join(dir, "p.html");
  await writeFile(f, html, "utf8");
  await page.goto(pathToFileURL(f).href);
  // First paint only — deliberately NOT opening the panel or touching anything.
  await page.waitForTimeout(350);

  const res = await page.evaluate(() => document.querySelectorAll("[data-cit-sample]").length);
  if (res > 0) injected.push(`${t}(${res})`);
}

check(
  "⭐⭐ minden eladható modul felülete a SZERVER-oldali oldalon él (all-in, natívan)",
  missing.length === 0,
  missing.slice(0, 6),
);
check("a minta-adatú szekciók jelöltek (Minta-szalag ≥3)", unmarked.length === 0, unmarked.slice(0, 6));
check(
  "⭐⭐ új artifactra a konfigurátor NULLA generikus minta-kártyát injektál",
  injected.length === 0,
  injected.slice(0, 6),
);

// ── ⛔ §I: EVERY module toggle must VISIBLY change the page ───────────────────
// Owner report 2026-08-23: switching between the three packages changed nothing on
// the page — "ez így átverés". Root cause: four modules (amenities, usp, booking,
// reviews) had no usable DOM anchor, so their toggle was a no-op while the price
// changed. That is selling something the prospect cannot see. This measures the
// PAGE HEIGHT before/after each toggle in a real browser — a proxy nothing can fake.
{
  const recipe: Recipe = { template: "organic", skin: "", archetype: "", sections: [] };
  const bare = renderSite(recipe, LEAD, { phase: "mock" });
  const html = await injectConfigurator(bare, "00000000-0000-0000-0000-000000000000", "Teszt Lead");
  const dir = await mkdtemp(path.join(tmpdir(), "cfg-toggle-"));
  const f = path.join(dir, "p.html");
  await writeFile(f, html, "utf8");
  await page.goto(pathToFileURL(f).href);
  await page.waitForTimeout(400);
  // Open the detailed module list ("Testre szabom") so the rows are clickable.
  await page.locator(".cit-cfg-customize").first().click().catch(() => {});
  await page.waitForTimeout(250);

  const mute = await page.evaluate(() => {
    const out: string[] = [];
    const rows = Array.from(
      document.querySelectorAll(".cit-cfg-row:not(.cit-cfg-locked)"),
    ) as HTMLElement[];
    for (const row of rows) {
      const id = row.getAttribute("data-id") || "";
      if (id === "email") continue; // mailbox service: no page surface by design
      const before = document.body.scrollHeight;
      row.click(); // switch OFF
      const after = document.body.scrollHeight;
      row.click(); // switch back ON
      if (before === after) out.push(id);
    }
    return out;
  });
  check(
    "⭐⭐ MINDEN modul ki/bekapcsolása láthatóan változtat az oldalon (§I: nincs néma modul)",
    mute.length === 0,
    mute,
  );
}

// ── ⛔⛔ CSOMAG ⇄ CSÚSZKA ⇄ OLDAL — a lánc végig igaz legyen ─────────────────
// Owner ruling 2026-08-25, verbatim: "Ha olyat jelenítesz meg, amit adott csomag
// vagy kiválasztott modul nem tartalmaz, de ott van a mockban, az üzleti csalás."
//
// The chain is: package → switches → page. Two links broke before:
//   1. applyPreset painted before recording state, so sections of the OLD package
//      stayed and the new one's never appeared;
//   2. the booking SECTION disappeared with the module, but the CALLING surfaces
//      (hero band, nav button) still said "Foglalás / Szabad időpontok
//      megtekintése" and pointed at the missing section — offering a feature the
//      package does not include.
// The earlier version of this gate missed #2 because it skipped anchors shared by
// several modules — which is exactly where the lie lived.
{
  const recipe: Recipe = { template: "organic", skin: "", archetype: "", sections: [] };
  const bare = renderSite(recipe, LEAD, { phase: "mock" });
  const html = await injectConfigurator(bare, "00000000-0000-0000-0000-000000000000", "Teszt Lead");
  const dir = await mkdtemp(path.join(tmpdir(), "cfg-preset-"));
  const f = path.join(dir, "p.html");
  await writeFile(f, html, "utf8");
  await page.goto(pathToFileURL(f).href);
  await page.waitForTimeout(400);

  const presets = (await page.evaluate(
    `JSON.parse(document.querySelector('[data-cit-configurator]').textContent).presets`,
  )) as { id: string; label: string; modules: string[] }[];
  check("van legalább két csomag, amin a váltás mérhető", presets.length >= 2, presets.length);

  /** What the PAGE currently offers, measured on visible elements only. */
  const PROBE = `(function(){
    function vis(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)).some(function(n){
      var s = n.closest('section') || n; return s.offsetParent !== null; }); }
    var rows = Array.prototype.slice.call(document.querySelectorAll('.cit-cfg-row'));
    var on = {}; rows.forEach(function(r){ on[r.getAttribute('data-id')] = r.getAttribute('aria-pressed') === 'true'; });
    var tags = {}; rows.forEach(function(r){
      var t = r.querySelector('.cit-cfg-tag'); tags[r.getAttribute('data-id')] = t ? (t.textContent||'').trim() : ''; });
    var ctaTexts = Array.prototype.slice.call(document.querySelectorAll('#cit-enquiry, nav a, .og-nav a'))
      .filter(function(n){ return n.offsetParent !== null; })
      .map(function(n){ return (n.textContent||'').replace(/\s+/g,' ').trim(); }).join(' | ');
    return {
      on: on, tags: tags, ctaTexts: ctaTexts,
      bookingSection: vis('[data-cit-module="booking-section"]'),
      bookingLink: Array.prototype.slice.call(document.querySelectorAll('a[href="#cit-booking"]'))
        .some(function(a){ return a.offsetParent !== null; }),
      surfaces: {
        rooms: vis('[data-cit-module="rooms"]'), pricing: vis('[data-cit-module="pricing"]'),
        hours: vis('[data-cit-module="hours"]'), poi: vis('[data-cit-module="poi"]'),
        newsletter: vis('[data-cit-module="newsletter"]'), location: vis('[data-cit-module="map"]'),
        amenities: vis('[data-cit-module="amenities"]'), usp: vis('[data-cit-module="usp"]'),
        gallery: vis('[data-cit-module="gallery"]')
      }
    };
  })()`;

  const wrongSwitches: string[] = [];
  const soldNotIncluded: string[] = [];
  const missingIncluded: string[] = [];
  const lyingTags: string[] = [];
  // Every package, then BACK to the first — the return leg exposes stale state.
  const order = [...presets.map((p) => p.id), presets[0]!.id];
  for (const id of order) {
    const preset = presets.find((p) => p.id === id)!;
    await page.evaluate(
      `(function(){var e=document.querySelector('[data-preset="${id}"]'); if(e) e.click();})()`,
    );
    await page.waitForTimeout(300);
    const r = (await page.evaluate(PROBE)) as {
      on: Record<string, boolean>;
      tags: Record<string, string>;
      ctaTexts: string;
      bookingSection: boolean;
      bookingLink: boolean;
      surfaces: Record<string, boolean>;
    };
    const wants = new Set(preset.modules);

    // ① the switches must match the package — except a row REPLACED by another
    //    selected module (booking → enquiry share one slot, ADR-0048), which is
    //    legitimately off and carries the "kiváltva" label.
    for (const [mod, isOn] of Object.entries(r.on)) {
      const replaced = mod === "enquiry" && wants.has("booking");
      const want = wants.has(mod) && !replaced;
      if (want !== isOn) wrongSwitches.push(`${id}/${mod}:${want ? "kikapcsolva" : "bekapcsolva"}`);
    }
    // ② the page must show exactly the switched-on surfaces
    for (const [mod, visible] of Object.entries(r.surfaces)) {
      const want = wants.has(mod);
      if (want && !visible) missingIncluded.push(`${id}/${mod}`);
      if (!want && visible) soldNotIncluded.push(`${id}/${mod}`);
    }
    // ③ booking: neither its section NOR any calling surface may promise it
    if (!wants.has("booking")) {
      if (r.bookingSection) soldNotIncluded.push(`${id}/booking-szekció`);
      if (r.bookingLink) soldNotIncluded.push(`${id}/booking-link`);
      if (/szabad időpontok megtekintése/i.test(r.ctaTexts)) {
        soldNotIncluded.push(`${id}/foglalás-CTA-szöveg`);
      }
    }
    // ④ a tag may never contradict its switch
    for (const [mod, tag] of Object.entries(r.tags)) {
      if (!tag) continue;
      if (!r.on[mod] && /megvan|minta/.test(tag)) lyingTags.push(`${id}/${mod}:„${tag}"`);
      // "kiváltva" may only stand while the replacing module is actually selected.
      if (tag === "kiváltva" && mod === "enquiry" && !r.on["booking"]) {
        lyingTags.push(`${id}/enquiry:„kiváltva" pedig nincs foglalás`);
      }
    }
  }
  check("⭐⭐ a csomag pontosan a saját moduljait kapcsolja be", wrongSwitches.length === 0, wrongSwitches.slice(0, 8));
  check("⭐⭐ a csomagban lévő modul felülete LÁTSZIK", missingIncluded.length === 0, missingIncluded.slice(0, 8));
  check(
    "⛔⛔ SEMMI nem látszik, ami nincs a csomagban (se szekció, se hívó CTA) — üzleti csalás",
    soldNotIncluded.length === 0,
    soldNotIncluded.slice(0, 8),
  );
  check("a sor címkéje nem mond ellent a kapcsolójának", lyingTags.length === 0, lyingTags.slice(0, 8));
}

// ── legacy fallback: an OLD artifact (no stamp, no module sections) still sells ──
{
  const legacy =
    `<!doctype html><html><head><meta charset="utf-8"></head><body>` +
    `<section id="cit-enquiry" data-cit-module="booking" data-cit-name="Régi Mock"></section>` +
    `<footer>lábléc</footer></body></html>`;
  const html = await injectConfigurator(legacy, "00000000-0000-0000-0000-000000000001", "Régi Mock");
  const dir = await mkdtemp(path.join(tmpdir(), "cfg-"));
  const f = path.join(dir, "legacy.html");
  await writeFile(f, html, "utf8");
  await page.goto(pathToFileURL(f).href);
  await page.waitForTimeout(350);
  const res = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll("[data-cit-sample]"));
    return s.filter((n) => (n as HTMLElement).offsetParent !== null).length;
  });
  check("régi (pecsét nélküli) artifacton a minta-kártya fallback ÉL (≥6 látszik)", res >= 6, res);
}
await browser.close();

if (failures) {
  console.error(`\n⛔ configurator-placement-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ configurator-placement-check: az all-in mock natívan teljes; a régi artifact-fallback él.");
