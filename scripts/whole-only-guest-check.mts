// „CSAK EGYBEN ADOM KI" — a VENDÉG-OLDAL őre (ADR-0257, kontraktus assets/design-refs/tenant-site/whole-only/
// 8–11. pont, a tulaj „A”-ja; a whole-unit-band sáv „main” állapota).
//
// A KISZÁLLÍTOTT lapot méri (renderSite + injectRuntime), MIND a 19 sablonon, 390 és 1280 px-en, böngészőben:
//   ① EGY kiemelt ház-sáv (`data-cit-whole-mode="main"`), „Csak egyben kiadó”, és MINDEN bemutató szoba ELŐTT áll;
//   ② a sáv gombja árral „Foglalás”, ár nélkül „Árajánlatot kérek”, és a HÁZ egységét viszi;
//   ③ a bemutató szoba kártyáján NINCS ár és NINCS foglalás-link, de ott a „A ház része …” sor (látható);
//   ④ a szoba felugrója: „A ház része”, „Ez a szoba külön nem foglalható — …”, a gomb „Az egész ház foglalása”
//      (ár nélkül „Árajánlat az egész házra”), és a gomb a HÁZ egységét viszi;
//   ⑤ a foglalás-doboz kimondja, mit foglal („Amit foglal” + a ház neve), szoba-választó NINCS;
//   ⑥ 0 JS-hiba.
// NEGATÍV KONTROLL (minden futásban): ugyanaz a ház „egyben IS kiadó” állapotban (szobák árral, Foglalás-sal) —
// ott a ③ és az ① próbának PIROSRA kell mennie, különben a próba vak.
//
// Usage: npx tsx scripts/whole-only-guest-check.mts [sablon…] [--keep]
// A kész felület képei: assets/Temp/_wog-<sablon>-<szélesség>.png (két sablon, a saját szemnek).

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { amenityByLabel, amenitySvg } from "../src/tenant/amenityCatalog.js";
import type { Recipe, Room, SiteData } from "../src/engine/recipe.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const KEEP = process.argv.includes("--keep");
const ONLY = process.argv.filter((a) => !a.startsWith("--")).slice(2);
const SHOT_IDS = new Set(process.env.WOG_SHOTS === "all" ? Object.keys(TEMPLATES) : ["editorial", "aurora"]);

function am(label: string) {
  const item = amenityByLabel(label);
  if (!item) throw new Error(`a fixture „${label}" címkéje nincs a katalógusban`);
  return { label, icon: amenitySvg(item) };
}
function photo(fill: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${fill}"/></svg>`;
  return { url: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, alt: "" };
}
const HOUSE_ID = "u-haz";
const HOUSE = "Hársfa Vendégház";
const ROOM_NAMES = ["Hársfa szoba", "Diófa szoba", "Tetőtéri szoba"];

/** mode "only": the owner's case (ADR-0257). mode "also": the negative control (whole-unit-band C). */
function siteData(mode: "only" | "also", housePriced = true): SiteData {
  const only = mode === "only";
  const rooms: Room[] = ROOM_NAMES.map((name, i) => ({
    name,
    unitId: `u-${i}`,
    capacity: `${[4, 3, 2][i]} fő`,
    description: "Csendes szoba a kertre néző ablakkal.",
    amenities: [am("Ingyenes Wi‑Fi"), am("Saját fürdőszoba")],
    photo: photo(["#c9a27e", "#8fa98b", "#9d8fb0"][i]!),
    ...(only ? { presentation: true } : { price: `${[18, 16, 14][i]} 000 Ft / éj` }),
  }));
  rooms.push({
    name: HOUSE, unitId: HOUSE_ID, capacity: "9 fő", wholeProperty: true,
    description: "Egész ház a szőlőhegy alján.",
    ...(only ? { wholeOnly: true } : {}),
    ...(housePriced ? { price: "62 000 Ft-tól / éj", priceFrom: true } : {}),
  } as Room);
  const units = only
    ? [{ id: HOUSE_ID, name: HOUSE, capacity: 9, wholeOnly: true, ...(housePriced ? {} : { unpriced: true }) }]
    : [...ROOM_NAMES.map((n, i) => ({ id: `u-${i}`, name: n })), { id: HOUSE_ID, name: HOUSE, ...(housePriced ? {} : { unpriced: true }) }];
  return {
    name: HOUSE, tagline: "Szőlőhegy", intro: "Egész ház, csak egyben kiadó.", highlights: ["Kert", "Terasz"],
    photos: [photo("#b08968"), photo("#7f9c96")],
    contact: { email: "info@example.invalid", phone: "+36 30 000 0000", address: "Fő utca 1." },
    place: { city: "Badacsony", country: "HU" },
    rooms,
    booking: { units, minNights: 1, maxNights: 14, horizonMonths: 6, leadTimeDays: 0 },
  } as unknown as SiteData;
}

const WIDTHS = [
  { w: 390, h: 800, label: "mobil" },
  { w: 1280, h: 860, label: "asztali" },
];

// Measured in the page (a string: tsx's keepNames would inject __name into arrow functions).
const PROBE = `(function (cfg) {
  var f = [];
  function painted(el) {
    if (!el) return false;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    var r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  }
  var bands = document.querySelectorAll('.cit-wholeband[data-cit-whole-mode="main"]');
  if (bands.length !== 1) f.push("main-sav-db:" + bands.length);
  var band = bands[0];
  if (band) {
    if (!painted(band)) f.push("main-sav-nem-latszik");
    var brow = band.querySelector(".cit-wholeband__brow");
    if (!brow || brow.textContent.trim() !== "Csak egyben kiadó") f.push("sav-cimke:" + (brow && brow.textContent));
    var cta = band.querySelector(".cit-wholeband__cta");
    var want = cfg.priced ? "Foglalás" : "Árajánlatot kérek";
    if (!cta || cta.textContent.trim() !== want) f.push("sav-gomb:" + (cta && cta.textContent.trim()));
    if (cta && cta.getAttribute("data-cit-room-unit") !== cfg.house) f.push("sav-gomb-nem-a-haz");
  }
  var shells = [];
  document.querySelectorAll('.cit-room__open[data-cit-room-name]').forEach(function (s) {
    if (!s.closest(".cit-wholeband") && cfg.rooms.indexOf(s.getAttribute("data-cit-room-name")) >= 0) shells.push(s);
  });
  if (!shells.length) f.push("nincs-szoba-kartya");
  shells.forEach(function (s) {
    var nm = s.getAttribute("data-cit-room-name");
    if (band && !(band.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)) f.push("sav-nem-elol:" + nm);
    if (s.getAttribute("data-cit-room-price")) f.push("szoba-ar-attr:" + nm);
    var card = s.closest("article, li, tr, figure, .cit-modsec__item") || s;
    var book = card.querySelectorAll('a[href="#cit-enquiry"], a[href="#cit-booking"]');
    if (book.length) f.push("szoba-foglalas-link:" + nm);
    if (/\\d[\\s\\u00a0\\u202f.]?\\d{3}\\s?Ft/.test(card.innerText || "")) f.push("szoba-ar-szoveg:" + nm);
    var part = s.querySelector(".cit-room__part");
    if (!part || !painted(part)) f.push("nincs-hazresze-sor:" + nm);
  });
  var only = document.querySelector(".cit-book__only");
  if (!only || (only.innerText || "").indexOf(cfg.houseName) < 0) f.push("doboz-nem-mondja-mit-foglal");
  if (document.getElementById("cit-unit")) f.push("doboz-szoba-valaszto");
  return f;
})`;

async function measure(page: Page, url: string, priced: boolean): Promise<string[]> {
  const errs: string[] = [];
  const onErr = (e: Error) => errs.push(e.message);
  page.on("pageerror", onErr);
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const cfg = { priced, house: HOUSE_ID, houseName: HOUSE, rooms: ROOM_NAMES };
  const f = (await page.evaluate(`${PROBE}(${JSON.stringify(cfg)})`)) as string[];
  // ④ the popover of the first presentation room
  const pop = (await page.evaluate(`(function(){
    var s = null;
    document.querySelectorAll('.cit-room__open[data-cit-room-show="1"]').forEach(function(e){ if (!s && !e.closest(".cit-wholeband")) s = e; });
    if (!s) return { err: "nincs-bemutato-jel" };
    s.scrollIntoView({ block: "center", behavior: "instant" });
    s.click();
    var rd = document.querySelector(".cit-rd[data-open]");
    if (!rd) return { err: "felugro-nem-nyilt" };
    var a = rd.querySelector(".cit-rd__cta a");
    return {
      brow: (rd.querySelector(".cit-rd__brow").textContent || "").trim(),
      price: (rd.querySelector(".cit-rd__price").textContent || "").trim(),
      cta: a ? (a.textContent || "").trim() : "",
      unit: a ? a.getAttribute("data-cit-room-unit") : null,
    };
  })()`)) as { err?: string; brow?: string; price?: string; cta?: string; unit?: string | null };
  if (pop.err) f.push(pop.err);
  else {
    if (pop.brow !== "A ház része") f.push(`felugro-cimke:${pop.brow}`);
    if (!/^Ez a szoba külön nem foglalható — .+ csak egyben kiadó\.$/.test(pop.price ?? "")) f.push(`felugro-mondat:${pop.price}`);
    const want = priced ? "Az egész ház foglalása" : "Árajánlat az egész házra";
    if (pop.cta !== want) f.push(`felugro-gomb:${pop.cta}`);
    if (pop.unit !== HOUSE_ID) f.push(`felugro-gomb-egysege:${pop.unit}`);
    await page.keyboard.press("Escape");
  }
  page.off("pageerror", onErr);
  for (const e of errs.slice(0, 2)) f.push(`js-hiba:${e.slice(0, 120)}`);
  return f;
}

async function renderTo(dir: string, id: string, d: SiteData, tag: string): Promise<string> {
  const tpl = TEMPLATES[id]!;
  const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] };
  const html = await injectRuntime(renderSite(recipe, d, { phase: "live" }));
  const file = path.join(dir, `${id}-${tag}.html`);
  await writeFile(file, html, "utf8");
  return file;
}

async function main(): Promise<void> {
  const ids = ONLY.length ? ONLY : Object.keys(TEMPLATES);
  const unknown = ids.filter((id) => !TEMPLATES[id]);
  if (unknown.length) throw new Error(`ismeretlen sablon: ${unknown.join(", ")}`);
  const dir = await mkdtemp(path.join(os.tmpdir(), "cit-wog-"));
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  let fail = 0, total = 0;
  try {
    for (const vp of WIDTHS) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await page.route("**/*", (r) => {
        const u = r.request().url();
        return u.startsWith("file:") || u.startsWith("data:") ? r.continue() : r.abort();
      });
      for (const id of ids) {
        for (const priced of [true, false]) {
          total++;
          const file = await renderTo(dir, id, siteData("only", priced), priced ? "only" : "only-noprice");
          const f = await measure(page, `file://${file}`, priced);
          const head = `${id.padEnd(16)} ${vp.label.padEnd(8)} ${priced ? "árral  " : "ár nélk"}`;
          if (f.length) {
            fail++;
            console.error(`  ✗ ${head} ${f.slice(0, 4).join(" · ")}`);
          } else console.log(`  ✓ ${head}`);
          if (priced && SHOT_IDS.has(id)) {
            await page.goto(`file://${file}`, { waitUntil: "load" });
            await page.waitForTimeout(200);
            // The rooms area only (band + grid), not the whole page: that is what is judged.
            const clip = (await page.evaluate(`(function(){
              var t = 1e9, b = 0;
              document.querySelectorAll('[data-cit-module="rooms"]').forEach(function(e){
                var r = e.getBoundingClientRect(); t = Math.min(t, r.top + scrollY); b = Math.max(b, r.bottom + scrollY);
              });
              return { x: 0, y: Math.max(0, t - 24), width: innerWidth, height: Math.min(b - t + 48, 4000) };
            })()`)) as { x: number; y: number; width: number; height: number };
            await page.screenshot({ path: path.join(ROOT, "assets", "Temp", `_wog-${id}-${vp.label}.png`), fullPage: true, clip });
          }
        }
        // NEGATIVE CONTROL: "egyben IS kiadó" — rooms priced and bookable, the band follows them.
        total++;
        const ctl = await renderTo(dir, id, siteData("also"), "control");
        const cf = await measure(page, `file://${ctl}`, true);
        const blind = !cf.some((x) => x.startsWith("main-sav-db")) || !cf.some((x) => x.startsWith("szoba-ar-attr"));
        if (blind) {
          fail++;
          console.error(`  ✗ ${id.padEnd(16)} ${vp.label.padEnd(8)} KONTROLL: a próba nem ment pirosra a foglalható szobákon (${cf.join(" · ") || "0 lelet"})`);
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
    if (KEEP) console.log(`  (a lapok: ${dir})`);
    else await rm(dir, { recursive: true, force: true });
  }
  if (fail) {
    console.error(`\n⛔ WHOLE-ONLY-GUEST: ${fail}/${total} mérés bukott — kontraktus: assets/design-refs/tenant-site/whole-only/README.md 8–11.`);
    process.exit(1);
  }
  console.log(`\n🟢 WHOLE-ONLY-GUEST: ${total} mérés (${ids.length} sablon × ${WIDTHS.length} szélesség × árral/ár nélkül + kontroll) — a ház az egyetlen ajánlat, a szobák bemutatásra.`);
}

await main();
