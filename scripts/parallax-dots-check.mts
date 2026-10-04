#!/usr/bin/env npx tsx
// gate-runner: self-overlap-safe — renders in memory (setContent), writes no file, no row, no shared path
/**
 * PARALLAX DOT-NAV guard — while scrolling, the lit side dot is ALWAYS the section on screen.
 *
 *   npx tsx scripts/parallax-dots-check.mts [--self-test]
 *
 * THE OWNER'S REPORT (2026-10-04): „a Parallax oldalsó pöttysora a foglalási blokknál az első
 * pöttyöt mutatja aktívnak” → „igen javítsuk”. Measured before the fix (desktop 1440×900):
 * the IntersectionObserver (threshold .4) lit the dot of whichever section last CROSSED the
 * ratio — a section leaving the screen fires as intersecting too, and the 2 000 px "Kiemelt"
 * section never reached a 40 % ratio at all; the closing booking section had no dot.
 *
 * Scrolled with the mouse wheel, step by step, top to bottom, on mock / live with booking /
 * live without booking, at 1440×900 and 1100×700:
 *   ① exactly one dot is lit at every step, and no dot vanishes (measured: the shared
 *      runtime's ADR-0253 rule hid the booking dot as a "sticky booking button" exactly at
 *      the booking block — the lit dot itself was gone)
 *   ② whenever a dotted section covers the reading line (40 % down the screen), ITS dot is lit
 *   ③ at the bottom of the page the last dot is lit (the booking one when the page has it)
 *   ④ the booking dot exists exactly when the page has the booking section (#cit-booking),
 *      and every dot points at an existing section
 *   ⑤ no JS error
 * The dots are desktop-only (display:none under 1000 px) — reported, not asserted further.
 *
 * --self-test: the same run with the OLD IntersectionObserver script put back — ② must go red.
 * A guard never seen red proves nothing.
 */
import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";

const SELF_TEST = process.argv.includes("--self-test");

// The pre-fix behavior layer, verbatim — the negative control.
const OLD_JS = `(function(){
    var dots=[].slice.call(document.querySelectorAll('.t-dots a'));if(!dots.length||!('IntersectionObserver' in window))return;
    var secs=dots.map(function(a){return document.querySelector(a.getAttribute('href'))}).filter(Boolean);
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){var i=secs.indexOf(e.target);
        dots.forEach(function(d,j){d.classList.toggle('on',j===i)});}
    })},{threshold:.4});
    secs.forEach(function(s){io.observe(s)});
  })();`;
const NEW_JS = /\(function\(\)\{\s*var dots=[\s\S]*?addEventListener\('resize',queue\);mark\(\);\s*\}\)\(\);/;

const P = (s: string) => ({ url: `https://example.invalid/${s}.jpg`, alt: s, provenance: "owner" as const });
const BASE = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás a hegy tetején",
  intro: "Kilenc szobás butikhotel a régi városfal tövében, saját teraszos étteremmel. A nyugalom itt nem program, hanem alapállapot.",
  highlights: ["Panorámás tetőterasz", "Borpince", "Wellness és szauna", "Teraszos étterem", "Ingyenes parkolás"],
  photos: ["a", "b", "c", "d", "e", "f"].map(P),
  contact: { email: "foglalas@hotelpelda.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  reviews: [
    { quote: "A tetőteraszról nézni a várat — ezért megérte.", author: "Andrea", meta: "Budapest" },
    { quote: "A reggeli verhetetlen.", author: "Péter", meta: "Szeged" },
  ],
  stats: [{ value: "9,2", label: "vendégértékelés", icon: "star" }],
  rating: { value: 4.6, count: 1892 },
  place: { city: "Példaváros", country: "HU" },
  geo: { lat: 47.5, lon: 19.0 },
} as unknown as SiteData;
const BOOKING = { units: [{ id: "u1", name: "Superior" }], minNights: 1, maxNights: 30, horizonMonths: 12, leadTimeDays: 0 };

const CASES: ReadonlyArray<readonly [string, SiteData, "mock" | "live"]> = [
  ["mock", BASE, "mock"],
  ["élő + foglalás", { ...BASE, booking: BOOKING } as unknown as SiteData, "live"],
  ["élő, foglalás nélkül", BASE, "live"],
];

interface Step {
  readonly y: number;
  readonly lit: string[];
  readonly covering: string | null;
  readonly bottom: boolean;
  readonly hidden: string[];
}

const STEP = `(() => {
  const line = innerHeight * 0.4;
  const dots = [...document.querySelectorAll('.t-dots a')];
  let covering = null;
  for (const a of dots) {
    const t = document.querySelector(a.getAttribute('href'));
    const r = t && t.getBoundingClientRect();
    if (r && r.height && r.top <= line && r.bottom > line) covering = a.getAttribute('href');
  }
  return {
    y: Math.round(scrollY),
    lit: dots.filter((a) => a.classList.contains('on')).map((a) => a.getAttribute('href')),
    covering,
    bottom: scrollY + innerHeight >= document.documentElement.scrollHeight - 2,
    hidden: dots.filter((a) => { const c = getComputedStyle(a); return !a.offsetWidth || c.visibility === 'hidden' || Number(c.opacity) === 0; }).map((a) => a.getAttribute('href')),
  };
})()`;

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail && !pass ? ` — ${detail}` : ""}`);
};

const bad: Record<"one" | "shown" | "cover" | "bottom" | "set" | "js", string[]> = { one: [], shown: [], cover: [], bottom: [], set: [], js: [] };
let steps = 0;
let coverSteps = 0;
const tpl = TEMPLATES.parallax!;
const recipe: Recipe = { template: "parallax", skin: tpl.skins[0]!, archetype: "stacked", sections: [] };
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  for (const [name, data, phase] of CASES) {
    let html = await injectRuntime(renderSite(recipe, data, { phase }));
    if (SELF_TEST) {
      if (!NEW_JS.test(html)) throw new Error("öntesztben a javított pötty-szkript nem található a lapon");
      html = html.replace(NEW_JS, OLD_JS);
    }
    for (const [w, h] of [[1440, 900], [1100, 700], [390, 844]] as const) {
      const where = `${name}@${w}`;
      const page: Page = await browser.newPage({ viewport: { width: w, height: h } });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
      await page.route(/^https?:/, (r) => r.abort());
      await page.setContent(html, { waitUntil: "load" });
      const shown = await page.evaluate(() => getComputedStyle(document.querySelector(".t-dots")!).display !== "none");
      if (!shown) {
        console.log(`  ·  ${where}: a pötty-sor rejtett (asztali elem, 1000 px alatt display:none)`);
        if (errors.length) bad.js.push(`${where}: ${errors[0]}`);
        await page.close();
        continue;
      }
      const set = await page.evaluate(() => ({
        hrefs: [...document.querySelectorAll(".t-dots a")].map((a) => a.getAttribute("href")!),
        missing: [...document.querySelectorAll(".t-dots a")].map((a) => a.getAttribute("href")!).filter((x) => !document.querySelector(x)),
        hasBooking: Boolean(document.getElementById("cit-booking")),
      }));
      if (set.missing.length) bad.set.push(`${where}: nincs cél: ${set.missing.join(",")}`);
      if (set.hrefs.includes("#cit-booking") !== set.hasBooking)
        bad.set.push(`${where}: foglalás-pötty ${set.hrefs.includes("#cit-booking") ? "van" : "nincs"}, #cit-booking ${set.hasBooking ? "van" : "nincs"}`);
      const last = set.hrefs[set.hrefs.length - 1]!;
      await page.mouse.move(w / 2, h / 2);
      for (let i = 0; i < 400; i++) {
        await page.waitForTimeout(80);
        const s = (await page.evaluate(STEP)) as Step;
        steps++;
        if (s.lit.length !== 1) bad.one.push(`${where} y=${s.y}: ${s.lit.length} világít`);
        if (s.hidden.length) bad.shown.push(`${where} y=${s.y}: eltűnt ${s.hidden.join(",")}`);
        if (s.covering) {
          coverSteps++;
          if (s.lit[0] !== s.covering) bad.cover.push(`${where} y=${s.y}: ${s.covering} van a képen, ${s.lit.join(",") || "semmi"} világít`);
        }
        if (s.bottom) {
          if (s.lit[0] !== last) bad.bottom.push(`${where}: a lap alján ${s.lit.join(",") || "semmi"} világít, nem ${last}`);
          break;
        }
        await page.mouse.wheel(0, 160);
      }
      if (errors.length) bad.js.push(`${where}: ${errors[0]}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await db.destroy();
}

const list = (xs: readonly string[]): string => xs.slice(0, 6).join(" · ") + (xs.length > 6 ? ` · …(+${xs.length - 6})` : "");
console.log(`\nParallax pötty-nav görgetés közben — ${CASES.length} eset, ${steps} lépés (${coverSteps} szakasz a sávon):`);
check("① minden lépésben pontosan egy pötty világít, és egyik pötty sem tűnik el", bad.one.length + bad.shown.length === 0, list([...bad.one, ...bad.shown]));
const coverOk = bad.cover.length === 0;
if (SELF_TEST) {
  console.log(`  ${coverOk ? "❌" : "✅"} ② (öntesztben PIROS kell) a régi IntersectionObserver ${coverOk ? "NEM jelzett" : `jelzett: ${list(bad.cover)}`}`);
} else {
  check("② a képernyőn lévő szakasz pöttye világít", coverOk && coverSteps > 20, list(bad.cover) || `csak ${coverSteps} mért lépés`);
  check("③ a lap alján az utolsó pötty világít", bad.bottom.length === 0, list(bad.bottom));
}
check("④ foglalás-pötty ⇔ foglalási szakasz; minden pötty célja létezik", bad.set.length === 0, list(bad.set));
check("⑤ nincs JS-hiba", bad.js.length === 0, list(bad.js));

if (SELF_TEST) {
  const ok = !coverOk && failures === 0;
  console.log(ok ? "\n✅ ÖNTESZT: a régi szkripttel a ② bukott — az őr lát\n" : "\n❌ ÖNTESZT: az őr nem a javítást méri\n");
  process.exit(ok ? 0 : 1);
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : "\n✅ minden állítás teljesült\n");
process.exit(failures ? 1 : 0);
