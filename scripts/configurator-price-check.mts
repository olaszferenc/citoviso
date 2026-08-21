// Regression gate: the prospect must SEE the itemised switches and the monthly
// price moving as they flip them (tulaj, 2026-08-21).
//
// This measures the BEHAVIOUR a buyer experiences, not the source text:
//   1. open the panel → the itemised module rows are VISIBLE with no extra tap
//      (the "Testre szabom" list used to be collapsed behind a disclosure),
//   2. the running total is inside the viewport at that moment (a total that is
//      scrolled out of view is the same as no total),
//   3. flipping a priced row moves the displayed total by exactly that price,
//      and the change is announced (the delta chip appears),
//   4. all of it at PHONE width too (390px bottom sheet) — the console/mock is
//      used from a phone.
//
// Run: npx tsx scripts/configurator-price-check.mts
import { chromium, type Page } from "playwright-core";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { config } from "../src/config.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";

const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";
const PREVIEW = "/tmp/cit-configurator-price-check.html";
const LEGACY_PREVIEW = "/tmp/cit-configurator-price-check-legacy.html";

const demo: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás a hegy tetején",
  intro: "Kilenc szobás butikhotel a régi városfal tövében, saját teraszos étteremmel.",
  highlights: ["Panorámás tetőterasz", "Borpince", "Wellness és szauna", "Ingyenes parkolás"],
  photos: [
    { url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A hotel", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-2/900/1100", alt: "Szoba", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-3/900/700", alt: "Terasz", provenance: "owner" },
  ],
  contact: { email: "foglalas@hotelpelda.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  rooms: [
    { name: "Superior szoba", capacity: "2 fő · 26 m²", note: "Városra néző.", price: "42 000 Ft / éj", photo: { url: "https://picsum.photos/seed/cit-r1/900/560", alt: "Superior" } },
  ],
  reviews: [{ quote: "Pontos, kedves, tiszta.", author: "Andrea", meta: "Budapest" }],
  place: { city: "Példaváros", country: "HU" },
};

const sections: Recipe["sections"] = (["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const).map(
  (kind) => ({ kind }),
);

/** Digits only — the total is formatted with thin spaces and a currency suffix. */
function amount(text: string): number {
  const m = /([\d   ]+)/.exec(text.replace(/\s/g, " "));
  return m ? Number(m[1].replace(/\D/g, "")) : NaN;
}

async function buildPreview(): Promise<void> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections };
  const html = await injectConfigurator(
    await injectRuntime(renderSite(recipe, demo)),
    ARTIFACT_ID,
    demo.name,
  );
  await writeFile(PREVIEW, html, "utf8");
  // Same overlay served by an OLDER backend whose manifest has no check endpoint —
  // the deploy reality: this runtime file reaches a host before the server code does.
  await writeFile(LEGACY_PREVIEW, html.replace(/"checkUrl":"[^"]*",?/, ""), "utf8");
}

/** An overlay on an old backend must not show a control that cannot work. */
async function auditLegacyBackend(page: Page): Promise<string[]> {
  const failures: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await stubDomainApi(page);
  await page.goto(pathToFileURL(LEGACY_PREVIEW).href);
  await page.mouse.wheel(0, 900);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(350);
  const custom = page.locator('.cit-cfg-dopt[data-dom="custom"]');
  if (await custom.count()) {
    await custom.scrollIntoViewIfNeeded();
    await custom.click();
    await page.waitForTimeout(350);
  }
  if (await page.locator(".cit-cfg-own").count()) {
    failures.push("régi backenden is megjelenik a saját-domain mező (nem tudná ellenőrizni)");
  }
  if (await page.locator(".cit-cfg-dsug").count()) {
    // The suggestions still work there — proof the block is disabled, not the section.
  } else {
    failures.push("régi backenden a domain-javaslatok is eltűntek (túl sokat tiltottunk le)");
  }
  if (errors.length) failures.push(`JS-hiba a régi backend ágán: ${errors[0]}`);
  return failures;
}

interface Result {
  readonly viewport: string;
  readonly failures: string[];
}

/** Stub the two domain endpoints: the preview runs from file://, and the real ones
 *  would mean live DNS+RDAP calls in a pre-commit gate. The CONTRACT is what we
 *  assert here (the server side has its own normaliser unit coverage). */
async function stubDomainApi(page: Page): Promise<void> {
  await page.route("**/domains", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        suggestions: [
          { domain: "hotelpelda.hu", availability: "taken" },
          { domain: "hotel-pelda.hu", availability: "probably_free" },
        ],
      }),
    }),
  );
  await page.route("**/domain-check**", (route) => {
    const name = new URL(route.request().url()).searchParams.get("name") ?? "";
    const clean = name.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
    const body = !clean.includes(".")
      ? { ok: false, reason: "Végződés is kell, például: pelda.hu" }
      : { ok: true, domain: clean, availability: clean.startsWith("foglalt") ? "taken" : "probably_free" };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function audit(page: Page, viewport: string): Promise<Result> {
  const failures: string[] = [];
  await stubDomainApi(page);
  await page.goto(pathToFileURL(PREVIEW).href);
  await page.mouse.wheel(0, 900);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(450);

  // 1) itemised switches visible with NO extra tap
  const rows = page.locator(".cit-cfg-detail .cit-cfg-row");
  const rowCount = await rows.count();
  if (!rowCount) failures.push("nincs tételes modul-sor a panelben");
  const firstRowVisible = rowCount ? await rows.first().isVisible() : false;
  if (!firstRowVisible) failures.push("a tételes kapcsolók nincsenek nyitva a panel megnyitásakor");
  const expanded = await page.locator(".cit-cfg-customize").getAttribute("aria-expanded");
  if (expanded !== "true") failures.push(`a „Testre szabom" aria-expanded=${expanded} (nyitva kellene)`);

  // 2) the running total is on screen right then
  const sum = page.locator(".cit-cfg-sum");
  if (!(await sum.isVisible())) failures.push("az összeg-sor nem látszik");
  const box = await sum.boundingBox();
  const vh = page.viewportSize()!.height;
  if (!box || box.y < 0 || box.y + box.height > vh) {
    failures.push(`az összeg kilóg a képernyőből (y=${box?.y}, h=${box?.height}, vh=${vh})`);
  }

  // 3) flipping a priced row moves the total by exactly that price
  const priced = page.locator('.cit-cfg-detail .cit-cfg-row:not(.cit-cfg-locked)').filter({ hasText: "+" });
  if (!(await priced.count())) {
    failures.push("nincs árazott modul-sor, amin a mozgás mérhető");
  } else if (!firstRowVisible) {
    // Nothing to measure through an invisible list — the failure above is the cause;
    // interacting anyway would only produce a 30s timeout instead of a verdict.
    failures.push("a rejtett lista miatt az ár-követés nem mérhető");
  } else {
    const target = priced.first();
    const price = amount((await target.locator(".cit-cfg-price").innerText()) || "");
    const before = amount(await sum.innerText());
    await target.scrollIntoViewIfNeeded();
    // Aim at the switch: the row's centre can land on the info icon (which opens
    // the description instead of toggling) when the label is short.
    const sw = target.locator(".cit-cfg-sw");
    await sw.click();
    await page.waitForTimeout(250);
    const after = amount(await sum.innerText());
    if (!(before - after === price)) {
      failures.push(`kikapcsolásnál az összeg ${before} → ${after} (várt csökkenés: ${price})`);
    }
    // the change must be ANNOUNCED, not just silently swapped
    const delta = page.locator(".cit-cfg-delta");
    if (!(await delta.count()) || !(await delta.first().isVisible())) {
      failures.push("nincs látható változás-jelzés (delta) az összeg mellett");
    }
    // and the total must STILL be on screen after the toggle
    const box2 = await sum.boundingBox();
    if (!box2 || box2.y < 0 || box2.y + box2.height > vh) {
      failures.push("kapcsolás után az összeg kicsúszott a képernyőből");
    }
    await sw.click(); // restore
    await page.waitForTimeout(200);
    const back = amount(await sum.innerText());
    if (back !== before) failures.push(`visszakapcsolásnál nem állt vissza az összeg (${back} ≠ ${before})`);
  }

  // 4) the customize area is visually its OWN surface, not a run-on list
  const boxed = await page.locator(".cit-cfg-custombox .cit-cfg-detail").count();
  if (!boxed) failures.push("a testre szabó rész nem külön felületen ül (nincs cit-cfg-custombox)");

  // 5) own domain name: a buyer who likes none of our suggestions can type one and
  //    have it checked — and only a checkable, free name may become the selection.
  const custom = page.locator('.cit-cfg-dopt[data-dom="custom"]');
  if (!(await custom.count())) {
    failures.push("nincs saját-domain választó");
  } else {
    await custom.scrollIntoViewIfNeeded();
    await custom.click();
    await page.waitForTimeout(400);
    const own = page.locator(".cit-cfg-own");
    if (!(await own.isVisible())) {
      failures.push("saját domain választásakor nem jelenik meg a saját név mező");
    } else {
      const input = page.locator(".cit-cfg-own__in");
      const btn = page.locator(".cit-cfg-own__btn");
      const status = page.locator(".cit-cfg-own__status");
      // a) messy but valid input is cleaned and accepted
      await input.fill("https://WWW.Sajat-Nevem.hu/");
      await btn.click();
      await page.waitForTimeout(400);
      if (!/sajat-nevem\.hu/.test(await status.innerText())) {
        failures.push(`saját név ellenőrzése nem adott találatot: "${await status.innerText()}"`);
      }
      if (!/sajat-nevem\.hu/.test(await sum.innerText())) {
        failures.push("az ellenőrzött saját domain nem került be a megrendelés összegzőjébe");
      }
      // b) editing after a verdict drops the stale selection
      await input.fill("masik");
      await page.waitForTimeout(200);
      if (/sajat-nevem\.hu/.test(await sum.innerText())) {
        failures.push("szerkesztés után is az ELŐZŐ (már nem ellenőrzött) domain marad az összegzőben");
      }
      // c) a name without a TLD is refused with a plain reason
      await btn.click();
      await page.waitForTimeout(300);
      if (!(await status.innerText()).trim()) {
        failures.push("hibás domain névre nincs visszajelzés");
      }
      // d) a taken name must not become the selection
      await input.fill("foglaltnev.hu");
      await btn.click();
      await page.waitForTimeout(400);
      if (/foglaltnev\.hu/.test(await sum.innerText())) {
        failures.push("FOGLALT domain is bekerült a megrendelésbe");
      }
    }
  }
  return { viewport, failures };
}

await buildPreview();
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const results: Result[] = [];
for (const [label, viewport] of [
  ["desktop 1180×860", { width: 1180, height: 860 }],
  ["mobil 390×780", { width: 390, height: 780 }],
] as const) {
  const page = await browser.newPage({ viewport });
  results.push(await audit(page, label));
  await page.close();
}
const legacyPage = await browser.newPage({ viewport: { width: 390, height: 780 } });
results.push({ viewport: "régi backend (nincs ellenőrző végpont)", failures: await auditLegacyBackend(legacyPage) });
await legacyPage.close();
await browser.close();

let bad = 0;
for (const r of results) {
  if (r.failures.length) {
    bad++;
    console.error(`⛔ ${r.viewport}`);
    for (const f of r.failures) console.error(`   · ${f}`);
  } else {
    console.log(`✅ ${r.viewport} — tételes kapcsolók nyitva, az ár látható és követi a kapcsolást`);
  }
}
if (bad) {
  console.error(`\n⛔ configurator-price-check: ${bad} nézet bukott (előnézet: ${PREVIEW})`);
  process.exit(1);
}
console.log("\n✅ configurator-price-check: minden nézet zöld");
