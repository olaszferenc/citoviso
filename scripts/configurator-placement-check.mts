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

// ── ⛔ CSOMAGVÁLTÁS: a csomag tartalma tényleg megjelenik/eltűnik ─────────────
// Owner report (twice): switching packages moved the price but not the page —
// "mintha egymást kioltanák". The single-toggle gate above stayed green because it
// never switched a PACKAGE: applyPreset painted each module before recording its
// new state, so every paint read a half-updated selection. This drives the real
// preset cards and asserts, per package, that every module it contains has a
// VISIBLE surface and every module it drops has none.
{
  const recipe: Recipe = { template: "organic", skin: "", archetype: "", sections: [] };
  const bare = renderSite(recipe, LEAD, { phase: "mock" });
  const html = await injectConfigurator(bare, "00000000-0000-0000-0000-000000000000", "Teszt Lead");
  const dir = await mkdtemp(path.join(tmpdir(), "cfg-preset-"));
  const f = path.join(dir, "p.html");
  await writeFile(f, html, "utf8");
  await page.goto(pathToFileURL(f).href);
  await page.waitForTimeout(400);

  const presets = await page.evaluate(() => {
    const el = document.querySelector("[data-cit-configurator]");
    const cfg = el ? JSON.parse(el.textContent || "{}") : {};
    return (cfg.presets ?? []).map((p: { id: string; label: string; modules: string[] }) => ({
      id: p.id,
      label: p.label,
      modules: p.modules,
    }));
  });
  check("van legalább két csomag, amin a váltás mérhető", presets.length >= 2, presets.length);

  const broken: string[] = [];
  // Switch through every package, and then BACK to the first — the "back" leg is
  // where a stale-state bug shows up even when the forward leg happens to work.
  const order = [...presets.map((p: { id: string }) => p.id), presets[0]?.id].filter(Boolean);
  for (const id of order) {
    // The preset cards live inside the panel's own scroller, so Playwright's
    // viewport check stalls on them. What this gate measures is the STATE handling
    // behind the switch, not reachability (the price/placement checks cover that),
    // so the card is clicked through the DOM.
    await page.evaluate((presetId: string) => {
      const el = document.querySelector(`[data-preset="${presetId}"]`) as HTMLElement | null;
      el?.click();
    }, id);
    await page.waitForTimeout(300);
    const res = await page.evaluate((presetId: string) => {
      const el = document.querySelector("[data-cit-configurator]");
      const cfg = el ? JSON.parse(el.textContent || "{}") : {};
      const preset = (cfg.presets ?? []).find((p: { id: string }) => p.id === presetId);
      const mods: { id: string; domType?: string; domTypesAlso?: string[]; spine?: boolean }[] =
        cfg.modules ?? [];
      const on = new Set<string>(preset?.modules ?? []);
      const wrong: string[] = [];
      for (const m of mods) {
        const anchors = [m.domType, ...(m.domTypesAlso ?? [])].filter(Boolean) as string[];
        if (!anchors.length) continue; // no page surface (email) — nothing to assert
        // A surface may be shared; only judge anchors this module alone owns.
        const soleOwner = anchors.filter(
          (a) =>
            mods.filter((x) => [x.domType, ...(x.domTypesAlso ?? [])].includes(a)).length === 1,
        );
        if (!soleOwner.length) continue;
        const visible = soleOwner.some((a) =>
          Array.from(document.querySelectorAll(`[data-cit-module="${a}"]`)).some((n) => {
            const sec = (n as HTMLElement).closest("section") ?? (n as HTMLElement);
            return (sec as HTMLElement).offsetParent !== null;
          }),
        );
        const want = on.has(m.id) || Boolean(m.spine);
        if (want !== visible) wrong.push(`${m.id}:${want ? "hiányzik" : "ottmaradt"}`);
      }
      return wrong;
    }, id);
    if (res.length) broken.push(`${id} → ${res.join(", ")}`);
  }
  check(
    "⭐⭐ csomagváltásnál a csomag modulja MEGJELENIK, a többié ELTŰNIK",
    broken.length === 0,
    broken.slice(0, 6),
  );
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
