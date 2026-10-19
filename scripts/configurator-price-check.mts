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
import path from "node:path";
import { sessionTmpDir } from "./lib/session-tmp.mts";

import { config } from "../src/config.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";

const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";
// Session-private previews: /tmp is shared by every worktree, FIXED paths raced siblings.
const TMP = sessionTmpDir("configurator-price-check");
const PREVIEW = path.join(TMP, "preview.html");
const LEGACY_PREVIEW = path.join(TMP, "preview-legacy.html");

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
  // Same third-party-image decoupling as audit(): the gate judges behaviour,
  // not the CDN.
  await page.goto(pathToFileURL(LEGACY_PREVIEW).href, { waitUntil: "domcontentloaded" });
  await page.mouse.wheel(0, 900);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(350);
  // ADR-0395: the address is step 2 — one offered name, an own-name field only with a check endpoint.
  await page.locator(".cit-cfg-next").click();
  await page.waitForSelector(".cit-cfg-next:not([disabled])", { timeout: 15000 });
  if (await page.locator(".cit-cfg-dedit__open").isVisible()) {
    failures.push("régi backenden is felajánlja a saját név mezőt (nem tudná ellenőrizni)");
  }
  if (((await page.locator(".cit-cfg-dcard__name").textContent()) ?? "").trim() !== "hotel-pelda.hu") {
    failures.push("régi backenden a felajánlott név is eltűnt (túl sokat tiltottunk le)");
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
          { domain: "hotel-pelda.hu", availability: "free" },
        ],
      }),
    }),
  );
  await page.route("**/domain-check**", (route) => {
    const name = new URL(route.request().url()).searchParams.get("name") ?? "";
    const clean = name.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
    const body = !clean.includes(".")
      ? { ok: false, reason: "Végződés is kell, például: pelda.hu" }
      : { ok: true, domain: clean, availability: clean.startsWith("foglalt") ? "taken" : "free" };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function audit(page: Page, viewport: string): Promise<Result> {
  const failures: string[] = [];
  await stubDomainApi(page);
  // The fixture's photos live on a third-party CDN; the gate measures PRICE
  // behaviour, not image delivery — a picsum outage must not block commits
  // (measured 2026-08-31: picsum down, github fine → every commit blocked).
  // 'load' would wait for the images; DOMContentLoaded is what the panel needs.
  await page.goto(pathToFileURL(PREVIEW).href, { waitUntil: "domcontentloaded" });
  await page.mouse.wheel(0, 900);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(450);

  // 1) ADR-0395: the itemised switches sit behind „Testre szabom”, CLOSED by default
  //    (on a phone the open list was ~1 700 px in a ~320 px window) — one tap opens them.
  const rows = page.locator(".cit-cfg-detail .cit-cfg-row");
  const rowCount = await rows.count();
  if (!rowCount) failures.push("nincs tételes modul-sor a panelben");
  const expanded = await page.locator(".cit-cfg-customize").getAttribute("aria-expanded");
  if (expanded !== "false") failures.push(`a „Testre szabom" aria-expanded=${expanded} (alapból csukva kellene)`);
  if (rowCount && (await rows.first().isVisible())) failures.push("a tételes kapcsolók alapból nyitva vannak");
  await page.locator(".cit-cfg-customize").click();
  await page.waitForTimeout(200);
  const firstRowVisible = rowCount ? await rows.first().isVisible() : false;
  if (!firstRowVisible) failures.push("a „Testre szabom” koppintásra sem nyílnak meg a kapcsolók");

  // 2) the running total is on screen right then — step 1's one-row total since
  //    the two-step order (contract order-two-step ①); the big card is on step 2.
  const sum = page.locator(".cit-cfg-mini__amt");
  if (!(await sum.isVisible())) failures.push("az összeg-sor nem látszik");
  const box = await sum.boundingBox();
  const vh = page.viewportSize()!.height;
  if (!box || box.y < 0 || box.y + box.height > vh) {
    failures.push(`az összeg kilóg a képernyőből (y=${box?.y}, h=${box?.height}, vh=${vh})`);
  }

  // 2b) ADR-0211: MONTHLY is the default. ADR-0395: the ONE period switch is on the pay step.
  {
    await page.locator(".cit-cfg-next").click();
    await page.waitForSelector(".cit-cfg-next:not([disabled])", { timeout: 15000 });
    await page.locator(".cit-cfg-next").click();
    await page.waitForTimeout(300);
    if (!(await page.locator(".cit-cfg-period3").isVisible())) failures.push("a fizetés-lapon nem látszik a Havi/Éves váltó");
    const on = await page.evaluate(() => document.querySelector(".cit-cfg-period3 .cit-cfg-popt--on")?.getAttribute("data-period") ?? null);
    if (on !== "monthly") failures.push(`induláskor nem a Havi van kiválasztva (hanem: ${on})`);
    await page.locator(".cit-cfg-back3").click();
    await page.waitForTimeout(200);
    await page.locator(".cit-cfg-hback").click();
    await page.waitForTimeout(250);
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
    // The row shows a MONTHLY price; the total follows the selected period (monthly
    // is the default since ADR-0211) — on the annual view a 490 Ft/month module
    // moves the total by 490 × paid months (12 − free months).
    const paidMonths = await page.evaluate(() => {
      const el = document.querySelector("[data-cit-configurator]");
      const cfg = el ? JSON.parse(el.textContent || "{}") : {};
      const free = Number(cfg?.pricing?.annualFreeMonths ?? 0);
      const annual = document.querySelector('.cit-cfg-popt[data-period="annual"]');
      const isAnnual = !!annual && annual.classList.contains("cit-cfg-popt--on");
      return isAnnual ? 12 - free : 1;
    });
    const expected = price * paidMonths;
    if (!(before - after === expected)) {
      failures.push(
        `kikapcsolásnál az összeg ${before} → ${after} (várt csökkenés: ${expected}` +
          (paidMonths > 1 ? ` = ${price} × ${paidMonths} hónap` : "") + ")",
      );
    }
    // the change must be ANNOUNCED, not just silently swapped
    const delta = page.locator(".cit-cfg-mini .cit-cfg-delta");
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

  // 5) ADR-0395 address step: ONE registrar-free name on offer (a taken one is skipped), an
  //    own name may override it — checked, cleaned, a taken one never becomes the selection.
  await page.locator(".cit-cfg-next").click();
  await page.waitForSelector(".cit-cfg-next:not([disabled])", { timeout: 15000 });
  const nameEl = page.locator(".cit-cfg-dcard__name");
  if (((await nameEl.textContent()) ?? "").trim() !== "hotel-pelda.hu") {
    failures.push(`a felajánlott név nem az első SZABAD javaslat: "${await nameEl.textContent()}"`);
  }
  if (await page.locator(".cit-cfg-dsug").count()) failures.push("a cím-lépés névlistát mutat (egy név kellene)");
  await page.locator(".cit-cfg-dedit__open").click();
  const input = page.locator(".cit-cfg-own__in");
  const btn = page.locator(".cit-cfg-own__btn");
  const status = page.locator(".cit-cfg-own__status");
  if (!(await input.isVisible())) {
    failures.push("„Másik nevet szeretnék” után nem jelenik meg a saját név mezője");
  } else {
    if (await page.locator(".cit-cfg-next").isEnabled()) failures.push("szerkesztés közben a „Tovább” nem tiltott");
    // a) a name without a TLD is refused with a plain reason
    await input.fill("masik");
    await btn.click();
    await page.waitForTimeout(300);
    if (!(await status.innerText()).trim()) failures.push("hibás domain névre nincs visszajelzés");
    // b) a taken name must not become the selection
    await input.fill("foglaltnev.hu");
    await btn.click();
    await page.waitForTimeout(500);
    if (((await nameEl.textContent()) ?? "").includes("foglaltnev.hu")) failures.push("FOGLALT domain lett a kiválasztott név");
    if (!/foglalt/i.test(await status.innerText())) failures.push(`foglalt névre nincs „foglalt” visszajelzés: "${await status.innerText()}"`);
    // c) messy but valid input is cleaned and becomes THE name
    await input.fill("https://WWW.Sajat-Nevem.hu/");
    await btn.click();
    await page.waitForTimeout(400);
    if (((await nameEl.textContent()) ?? "").trim() !== "sajat-nevem.hu") {
      failures.push(`az ellenőrzött saját név nem lett a kiválasztott: "${await nameEl.textContent()}"`);
    }
    // d) the pay step names it (item box address line)
    await page.locator(".cit-cfg-next").click();
    await page.waitForTimeout(300);
    const addr = (await page.locator(".cit-cfg-item-addr").textContent()) ?? "";
    if (!/sajat-nevem\.hu/.test(addr)) failures.push(`a fizetés-lap nem a választott címet mutatja: "${addr}"`);
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
    console.log(`✅ ${r.viewport} — a kapcsolók a „Testre szabom” mögött, az ár látható és követi a kapcsolást, a cím-lépés egy nevet ad`);
  }
}
// ── CSOMAG-SZABÁLY (tulaj, 2026-09-07) ────────────────────────────────────────
// "Ami az alacsonyabb csomagban benne van, az benne van a magasabb csomagban is."
// A szabályt a modules.ts SZERKEZETE tartja (a nagyobb csomag a kisebbből
// származik), de a legfelső szint a katalógusból számol, tehát külön el tud
// csúszni — ezért mérjük, nem hisszük.
{
  const { presetNestingViolations, presetsAscending } = await import("../src/modules.js");
  const violations = presetNestingViolations();
  if (violations.length) {
    bad++;
    console.error("⛔ csomag-szabály SÉRÜL (a magasabb csomagból hiányzik az alacsonyabb tartalma):");
    for (const v of violations) {
      console.error(`   · ${v.tier} ← ${v.from}: hiányzik ${v.missing.join(", ")}`);
    }
  } else {
    console.log(
      "✅ csomag-szabály: " +
        presetsAscending()
          .map((p) => `${p.label} (${p.modules.length})`)
          .join(" ⊆ "),
    );
  }
}

if (bad) {
  console.error(`\n⛔ configurator-price-check: ${bad} nézet bukott (előnézet: ${PREVIEW})`);
  process.exit(1);
}
console.log("\n✅ configurator-price-check: minden nézet zöld");
