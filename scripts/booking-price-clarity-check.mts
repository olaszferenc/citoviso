// ŐR — a JÓVÁHAGYOTT vendég-oldali ár-terv kapuja.
// Kontraktus: assets/design-refs/tenant-site/booking-price-clarity/README.md
// (tulajdonosi választás 2026-09-14: „A" változat — NYITOTT BONTÁS).
//
// ⛔ A LEGFONTOSABB ÁLLÍTÁS: KITALÁLT SZÁM SEHOL (§B.17). Az idegenforgalmi adót a
// SZÁLLÁSADÓ adja meg; üres mezőnél a lap nem számol összeget, csak kimondja, hogy a
// helyszínen fizetendő. Ezt CSAK kétirányú méréssel lehet igazolni: a kitöltött ÉS az
// üres eset is a saját elvárását kell hogy produkálja — egy „van benne IFA" próba
// önmagában nem bizonyít semmit a hiányzó adatról.
//
//   npx tsx scripts/booking-price-clarity-check.mts
//   npx tsx scripts/booking-price-clarity-check.mts --selftest   (pirosra kell mennie)

process.env.CIT_SHOT = "1";

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { bookingSlot } from "../src/engine/templateKit.js";
import { moduleSections } from "../src/engine/moduleSections.js";
import type { SiteData } from "../src/engine/recipe.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELFTEST = process.argv.includes("--selftest");

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

const iso = (o: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + o);
  return d.toISOString().slice(0, 10);
};

/* ── kontraszt, számolva (nem szemre) ─────────────────────────────────────── */
const srgb = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r: number[]): number => 0.2126 * srgb(r[0]!) + 0.7152 * srgb(r[1]!) + 0.0722 * srgb(r[2]!);
function contrast(a: number[], b: number[]): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}
const parseRgb = (s: string): number[] => (s.match(/\d+(\.\d+)?/g) ?? ["0", "0", "0"]).map(Number);

/* ── a VALÓDI motor kimenete, két beállítással ────────────────────────────── */

function siteData(opts: { ifa: boolean; units: number }): SiteData {
  const units = Array.from({ length: opts.units }, (_, i) => ({
    id: `1111111${i}-1111-1111-1111-11111111111${i}`,
    name: i === 0 ? "A szállás egésze" : `Szoba ${i}`,
    capacity: 6 - i,
  }));
  return {
    name: "Nyugalom Vendégház",
    tagline: "",
    intro: "",
    highlights: [],
    photos: [],
    contact: { email: "info@example.com", phone: "+36 30 123 4567" },
    rooms: units.map((u) => ({ name: u.name, capacity: `${u.capacity} fő`, note: "Kertre néző.", price: "" })),
    // A hírlevél ADAT megvan — ha a blokk mégis renderelne, az ⑧ azonnal pirosra megy.
    newsletter: { title: "Maradjunk kapcsolatban", subtitle: "" },
    booking: {
      units,
      minNights: 2,
      maxNights: 14,
      horizonMonths: 12,
      leadTimeDays: 0,
      responseNote: "",
      ...(opts.ifa ? { touristTaxPerPersonNight: 500, priceIncludes: "Takarítás, ágynemű" } : {}),
    },
  } as unknown as SiteData;
}

async function pageFor(opts: { ifa: boolean; units: number }): Promise<string> {
  // ⚠️ cit-money.js travels WITH the widget (generator/runtime.ts splices it in
  // first). This page is built by hand, so it must do the same — without it the
  // quote line dies on an undefined CitMoney and the booking never reaches its
  // done state. money-format-check enforces the pairing.
  const [moneyJs, runtimeJs, modulesCss] = await Promise.all([
    readFile(path.join(ROOT, "assets/runtime/cit-money.js"), "utf8"),
    readFile(path.join(ROOT, "assets/runtime/cit-runtime.js"), "utf8"),
    readFile(path.join(ROOT, "assets/runtime/cit-modules.css"), "utf8"),
  ]);
  const d = siteData(opts);
  const stub =
    `<script>(function(){var real=window.fetch;window.fetch=function(u,o){var s=String(u);` +
    `if(s.indexOf("/api/foglaltsag/")>=0){return Promise.resolve({ok:true,json:function(){` +
    `return Promise.resolve(${JSON.stringify({
      blocked: [iso(10), iso(11)],
      pricing: { currency: "HUF", unit: "per_night", rows: [{ base: true, amount: 32000, label: "Alapár" }] },
    })});}});}` +
    `if(s.indexOf("/api/foglalas")>=0){return Promise.resolve({ok:true,json:function(){` +
    `return Promise.resolve(${JSON.stringify({
      ok: true,
      summary: {
        dateFrom: iso(20),
        dateTo: iso(23),
        nights: 3,
        guests: 2,
        unitName: "A szállás egésze",
        ref: "FOG-4K2P9X",
        total: 96000,
        currency: "HUF",
        expireHours: 48,
        guestEmail: "vendeg@example.com",
        lines: [{ label: "Alapár", nights: 3, perNight: 32000, guests: 1, sum: 96000 }],
      },
    })});}});}` +
    `return real.apply(this,arguments);};})();</script>`;
  // ⛔ ÖNTESZT: visszarontjuk a jelmagyarázatot a MÉRT régi állapotra (11,84 px,
  // muted szöveg, keret nélküli minta) — ha az őr ezt átengedi, az ⑤ állítás dísz.
  const sabotage = SELFTEST
    ? `<style>.cit-book__legend{font-size:11.84px !important;color:#6b7a8d !important}
       .cit-book__lg{border:1px solid #dbe3ec !important}</style>`
    : "";
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>:root{--cit-bg:#fff;--cit-ink:#16283f;--cit-muted:#5b6b7f;--cit-line:#dbe3ec;` +
    `--cit-accent:#0e7f8c;--cit-radius:14px}body{font-family:system-ui,sans-serif;margin:0;background:#fff}` +
    `.cit-book__submit{font:inherit;font-weight:600;padding:13px 20px;border:0;border-radius:10px;` +
    `background:var(--cit-accent);color:#fff}#b8-footer{height:2200px}</style>` +
    `<style>${modulesCss}</style></head><body>` +
    stub +
    bookingSlot(d) +
    moduleSections(d) +
    `<div id="b8-footer"></div>` +
    `<script>${moneyJs}</script><script>${runtimeJs}</script>${sabotage}</body></html>`
  );
}

async function open(browser: Awaited<ReturnType<typeof chromium.launch>>, html: string, width: number): Promise<Page> {
  const dir = await mkdtemp(path.join(tmpdir(), "b8-price-"));
  const file = path.join(dir, "site.html");
  await writeFile(file, html, "utf8");
  const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width === 390 });
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(500);
  return page;
}

/** Két szabad nap kijelölése a naptárban → az ár megjelenik. */
async function pickTwoDays(page: Page): Promise<void> {
  const free = page.locator(".cit-book__day:not(:disabled):visible");
  await free.nth(1).click();
  await free.nth(4).click();
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });

/* ══ ①–③ AZ ÁR: bontás, alap, helyszíni tétel ═════════════════════════════ */

console.log("\n①–③ A bontás NYITVA, az alap KIMONDVA, a helyszíni tétel KÜLÖN:");
{
  const page = await open(browser, await pageFor({ ifa: true, units: 1 }), 1280);
  await pickTwoDays(page);
  const q = (await page.locator("[data-quote]").textContent()) ?? "";

  check("① a bontás magától látszik (nincs mögötte kattintás)", /Alapár/.test(q) && /Ft/.test(q), q.slice(0, 60));
  check(
    "② az ALAP a beadás ELŐTT ki van mondva (mihez képest, számít-e a létszám)",
    /a létszám nem befolyásolja|SZEMÉLYENKÉNT/i.test(q),
    q.slice(0, 120),
  );
  check("② b a „mi van benne” sor a tulaj szavaival áll ott", /Takarítás, ágynemű/.test(q));
  check(
    "③ ⭐⭐ a HELYSZÍNEN fizetendő KÜLÖN dobozban, összeggel",
    /A helyszínen fizetendő ezen felül/.test(q) && /Idegenforgalmi adó/.test(q) && /3 000|3 000/.test(q),
    q.slice(-160),
  );
  const boxed = await page.evaluate(
    `Boolean(document.querySelector("[data-quote] .cit-book__later"))`,
  );
  check("③b és tényleg SAJÁT doboza van (nem beleolvad az Összesenbe)", Boolean(boxed));
  check(
    "③c az „Összesen” megnevezi, MIRE vonatkozik",
    /Összesen a szállásért/.test(q),
  );
  await page.close();
}

/* ══ ④ KITALÁLT SZÁM SEHOL — a MÁSIK irány ════════════════════════════════ */

console.log("\n④ ⛔ Üres IFA-mezőnél a lap NEM TALÁL KI számot (§B.17):");
{
  const page = await open(browser, await pageFor({ ifa: false, units: 1 }), 1280);
  await pickTwoDays(page);
  const q = (await page.locator("[data-quote]").textContent()) ?? "";
  check(
    "⭐⭐ nincs IFA-összeg a lapon",
    !/Idegenforgalmi adó —/.test(q) && !/\d+\s*Ft\s*\/\s*fő/.test(q),
    q.slice(-140),
  );
  check(
    "⭐ de KIMONDJA, hogy a helyszínen IFA fizetendő (a hiány nem csend)",
    /helyszínen idegenforgalmi adó fizetendő/.test(q),
  );
  check(
    "és a „mi van benne” sor elmarad, ha a tulaj nem adta meg",
    !/benne van/.test(q),
  );
  await page.close();
}

/* ══ ⑤ A NYUGTA: teendő, és csak LÉTEZŐ dolgot ígér ═══════════════════════ */

console.log("\n⑤ A nyugta TEENDŐT ad — és csak azt ígéri, ami létezik:");
{
  const page = await open(browser, await pageFor({ ifa: true, units: 1 }), 390);
  await pickTwoDays(page);
  await page.fill("#cit-name", "Teszt Vendég");
  await page.fill("#cit-email", "vendeg@example.com");
  await page.fill("#cit-phone", "+36301112222");
  await page.locator(".cit-book__submit").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.locator(".cit-book__submit").click();
  await page.waitForTimeout(900);
  const r = (await page.locator(".cit-book--done").textContent()) ?? "";

  check("⑤ a nyugta lépéseket ad", /Mi a következő lépés/.test(r));
  check("⑤b megmondja, melyik címre jön a válasz", /vendeg@example\.com/.test(r));
  check("⑤c és mi történik, ha nincs válasz", /lejár/.test(r));
  check(
    "⑤d ⛔ a lemondó linket a VISSZAIGAZOLÁSHOZ köti (a függő kérést nem lehet így lemondani)",
    /Ha visszaigazolja, a levélben kap egy lemondó linket/.test(r),
  );
  check(
    "⑤e ⛔ NEM ígér állapot-lapot (nincs ilyen felület)",
    !/állapot/i.test(r),
    r.slice(0, 80),
  );
  check(
    "⑤f a függő kérés visszavonására a szállásadó elérhetőségét adja",
    /info@example\.com|\+36 30 123 4567/.test(r),
  );
  await page.close();
}

/* ══ ⑥ A JELMAGYARÁZAT OLVASHATÓ — mérve ═════════════════════════════════ */

console.log("\n⑥ A naptár jelmagyarázata olvasható (mérve, nem szemre):");
{
  const page = await open(browser, await pageFor({ ifa: true, units: 1 }), 390);
  const leg = (await page.evaluate(`(() => {
    var l = document.querySelector(".cit-book__legend");
    if (!l) return null;
    var s = getComputedStyle(l);
    var card = document.querySelector("form.cit-book--request");
    var swatches = [].slice.call(document.querySelectorAll(".cit-book__lg")).map(function(x){
      var cs = getComputedStyle(x);
      return { border: cs.borderTopWidth, color: cs.borderTopColor, bg: cs.backgroundColor };
    });
    return { size: parseFloat(s.fontSize), color: s.color,
      cardBg: getComputedStyle(card).backgroundColor, swatches: swatches };
  })()`)) as { size: number; color: string; cardBg: string; swatches: { border: string; bg: string }[] } | null;

  check("a jelmagyarázat mérhető", leg !== null);
  if (leg) {
    const ratio = contrast(parseRgb(leg.color), parseRgb(leg.cardBg));
    check(`⭐⭐ kontraszt ≥ 4,5 (mérve ${ratio.toFixed(2)})`, ratio >= 4.5);
    check(`⭐ betűméret ≥ 12,5 px (mérve ${leg.size.toFixed(2)})`, leg.size >= 12.5);
    // ⛔ NEM a keret PIXEL-vastagságát mérem: a böngésző az 1,5 px-et DPR 1-en
    // `1px`-ként jelenti, tehát egy vastagság-küszöb olyat kérdezne, amire nem tud
    // válaszolni. A kontraktus állítása az, hogy a minta ELKÜLÖNÜLJÖN — ez a keret
    // és a kártya háttere közti kontraszt, a WCAG nem-szöveges küszöbével (3:1).
    // ⚠️ ALFÁVAL EGYÜTT: a keret `color-mix(..., transparent)`, tehát a nyers színe
    // hazudna — előbb rá kell keverni a háttérre.
    const cardRgb = parseRgb(leg.cardBg);
    const ratios = leg.swatches.map((sw) => {
      const c = parseRgb(sw.color);
      const a = c.length > 3 ? c[3]! : 1;
      const over = [0, 1, 2].map((i) => a * c[i]! + (1 - a) * cardRgb[i]!);
      return contrast(over, cardRgb);
    });
    check(
      "⭐ MINDEN minta kerete ELKÜLÖNÜL a háttértől (≥3:1, alfával együtt)",
      leg.swatches.length >= 2 && ratios.every((r) => r >= 3),
      ratios.map((r) => r.toFixed(2)).join(" / "),
    );
  }
  await page.close();
}

/* ══ ⑦–⑧ A SZEKCIÓK ══════════════════════════════════════════════════════ */

console.log("\n⑦–⑧ Szekció-cím, egy-egységes szállás, hírlevél:");
{
  const one = await open(browser, await pageFor({ ifa: true, units: 1 }), 1280);
  const geo = (await one.evaluate(`(() => {
    var sec = document.querySelector("#cit-booking");
    var h = sec ? sec.querySelector("h2") : null;
    var card = sec ? sec.querySelector("form.cit-book--request, .cit-book") : null;
    var rooms = document.querySelector('[data-cit-module="rooms"]');
    return {
      hasHeading: Boolean(h && h.textContent.trim()),
      gapAboveCard: (h && card) ? Math.round(card.getBoundingClientRect().top - h.getBoundingClientRect().top) : null,
      roomCards: rooms ? rooms.querySelectorAll("li.cit-modsec__item").length : -1,
      wholePanel: Boolean(rooms && rooms.querySelector(".cit-whole")),
      newsletter: document.querySelectorAll('[data-cit-module="newsletter"]').length
    };
  })()`)) as { hasHeading: boolean; roomCards: number; wholePanel: boolean; newsletter: number };

  check("⑦ a foglalás-szekció CÍMMEL indul (nem 100 px üres sáv)", geo.hasHeading);
  check("⑧ EGY egységnél nincs egy-kártyás rács", geo.roomCards === 0, `kártyák: ${geo.roomCards}`);
  check("⑧b helyette teljes szélességű panel áll ott", geo.wholePanel);
  check("⑨ ⛔ a generált lapon NINCS hírlevél-blokk", geo.newsletter === 0, `találat: ${geo.newsletter}`);
  await one.close();

  // A többegységes eset NEM változhat: a rács marad, ahol tényleg van miből választani.
  const many = await open(browser, await pageFor({ ifa: true, units: 3 }), 1280);
  const cards = await many.evaluate(
    `document.querySelectorAll('[data-cit-module="rooms"] li.cit-modsec__item').length`,
  );
  check("⑧c HÁROM egységnél viszont marad a rács (nincs regresszió)", Number(cards) === 3, String(cards));
  await many.close();
}

await browser.close();

/* ══ verdikt ══════════════════════════════════════════════════════════════ */

if (SELFTEST) {
  const wanted = [
    "⭐ MINDEN minta kerete ELKÜLÖNÜL a háttértől (≥3:1, alfával együtt)",
  ];
  const sizeRed = failures.some((f) => f.startsWith("⭐ betűméret"));
  const contrastRed = failures.some((f) => f.startsWith("⭐⭐ kontraszt"));
  const missed = wanted.filter((w) => !failures.includes(w));
  if (!missed.length && sizeRed && contrastRed) {
    console.log(
      `\n✅ ÖNTESZT: a visszarontott jelmagyarázat (11,84 px / 3,99 kontraszt / keret nélküli minta) ` +
        `MINDHÁROM állításon pirosra ment — az őr látja. Bukások: ${failures.length}`,
    );
    process.exit(0);
  }
  console.log(
    `\n⛔ ÖNTESZT BUKOTT: méret-piros=${sizeRed} kontraszt-piros=${contrastRed} keret-piros=${!missed.length}`,
  );
  process.exit(1);
}

if (failures.length) {
  console.log(`\n⛔ ${failures.length} bukás:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\n✅ booking-price-clarity-check: a vendég a döntés pillanatában látja, mi van az árban.");
