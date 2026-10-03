#!/usr/bin/env npx tsx
// gate-runner: self-overlap-safe — renders in memory (setContent), writes no file, no row, no shared path
/**
 * NAV-TARGET guard — on the MOCK, no header link may point at a section the chosen package
 * does not include. The client-side twin of unbought-module-leak-check ⑤ (the live cut).
 *
 *   npx tsx scripts/nav-target-check.mts [--self-test] [--only=parallax,editorial]
 *
 * THE OWNER'S RULE (2026-10-04, verbatim): „ellenőrizd: a sticky headerekben csak azok a
 * modulok szerepelnek amelyek elérhetőek (megvették)”.
 *
 * THE MEASURED HOLE: the prospect configurator (assets/runtime/cit-configurator.js) hides a
 * section when its module is switched off — `refreshSections()` sets display:none — but
 * left every link INTO it: the masthead, the scrolled bar, the side dots and the phone
 * menu (cit-runtime.js copies the masthead at boot). Picking the "Alap" package left
 * "Vélemények", "Szobák", "Szolgáltatások" pointing at nothing on 19 of 19 templates with
 * such a link (before the fix, 2026-10-04). The live page never had it: render.ts
 * `stripModuleAnchor` cuts the section AND the links server-side.
 *
 * Per template, phone (390) and desktop (1440), ONE page driven through the packages:
 *   ① "Teljes" (the default all-in) — every shown in-page link has a shown target
 *   ② "Alap" picked — still true (the links into the dropped sections are gone)
 *   ③ POSITIVE CONTROL — back to "Teljes": the hidden links come back (a guard that hid
 *      every link would pass ② and fail here)
 *   ④ no JS error
 * Links measured: every `a[href^="#"]` outside the configurator panel and forms — header,
 * masthead, scrolled/sticky bars, side dots, phone menu rows (a row counts as shown unless
 * its <li> is display:none: the menu itself is closed while measuring), and in-page CTAs.
 *
 * --self-test: the same run with the fix taken out of the page (every `syncNavLinks();`
 * call removed) — ② must go RED on at least one template and ①/③/④ stay green.
 * A guard never seen red proves nothing.
 */
import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import { injectRuntime } from "../src/generator/runtime.js";

const SELF_TEST = process.argv.includes("--self-test");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);

// A full page: rooms, reviews, highlights, stats — so "Alap" has sections to drop.
const P = (s: string) => ({ url: `https://example.invalid/${s}.jpg`, alt: s, provenance: "owner" as const });
const DATA = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás a hegy tetején",
  intro: "Kilenc szobás butikhotel a régi városfal tövében, saját teraszos étteremmel. A nyugalom itt nem program, hanem alapállapot.",
  highlights: ["Panorámás tetőterasz", "Borpince", "Wellness és szauna", "Teraszos étterem", "Ingyenes parkolás"],
  photos: ["a", "b", "c", "d", "e", "f"].map(P),
  contact: { email: "foglalas@hotelpelda.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  rooms: [
    { name: "Superior", capacity: "2 fő", note: "Városra néző szoba.", price: "42 000 Ft / éj", photo: P("r1") },
    { name: "Deluxe", capacity: "2 fő", note: "Franciaerkély a várra.", price: "58 000 Ft / éj", photo: P("r2") },
  ],
  reviews: [
    { quote: "A tetőteraszról nézni a várat — ezért megérte.", author: "Andrea", meta: "Budapest" },
    { quote: "A reggeli verhetetlen.", author: "Péter", meta: "Szeged" },
  ],
  stats: [{ value: "9,2", label: "vendégértékelés", icon: "star" }],
  rating: { value: 4.6, count: 1892 },
  place: { city: "Példaváros", country: "HU" },
  geo: { lat: 47.5, lon: 19.0 },
} as unknown as SiteData;

interface Link {
  readonly href: string;
  readonly label: string;
  readonly target: "ok" | "hidden" | "missing";
}

/** Every SHOWN in-page link and the state of its target. */
const MEASURE = `(() => {
  // display only: the package cut uses display:none; visibility/opacity belong to scroll-state
  // chrome (the phone bar waits for the hero's observer) and would make the count a race
  const shown = (el) => { for (let e = el; e; e = e.parentElement) { if (getComputedStyle(e).display === 'none') return false; } return true; };
  const out = [];
  for (const a of document.querySelectorAll('a[href^="#"]')) {
    if (a.closest('.cit-cfg-panel, form')) continue;
    const href = a.getAttribute('href');
    if (href.length < 2) continue;
    const row = a.closest('#cit-pmenu li');
    if (row ? getComputedStyle(row).display === 'none' : !shown(a)) continue;
    const t = document.getElementById(href.slice(1));
    out.push({ href, label: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 24), target: !t ? 'missing' : shown(t) ? 'ok' : 'hidden' });
  }
  return out;
})()`;

const pick = async (page: Page, preset: string): Promise<boolean> => {
  const hit = await page.evaluate((p) => {
    const b = document.querySelector(`.cit-cfg-preset[data-preset="${p}"]`) as HTMLElement | null;
    b?.click();
    return Boolean(b);
  }, preset);
  await page.waitForTimeout(60);
  return hit;
};

const fmt = (ls: readonly Link[]): string =>
  ls.map((l) => `${l.label || "?"}→${l.href} (${l.target === "hidden" ? "rejtett" : "nincs"})`).join(", ");

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail && !pass ? ` — ${detail}` : ""}`);
};

const ids = ONLY.length ? ONLY : Object.keys(TEMPLATES);
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const bad: Record<"teljes" | "alap" | "restored" | "js", string[]> = { teljes: [], alap: [], restored: [], js: [] };
let dropped = 0;
try {
  for (const id of ids) {
    const tpl = TEMPLATES[id];
    if (!tpl) throw new Error(`ismeretlen sablon: ${id}`);
    const recipe: Recipe = { template: id, skin: tpl.skins[0]!, archetype: "stacked", sections: [] };
    let html = await injectConfigurator(
      await injectRuntime(renderSite(recipe, DATA, { phase: "mock" })),
      "00000000-0000-0000-0000-000000000000",
      DATA.name,
    );
    if (SELF_TEST) html = html.replaceAll("syncNavLinks();", "");
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
      await page.route(/^https?:/, (r) => r.abort());
      await page.setContent(html, { waitUntil: "load" });
      const where = `${id}@${width}`;
      const full = (await page.evaluate(MEASURE)) as Link[];
      const fullBad = full.filter((l) => l.target !== "ok");
      if (fullBad.length) bad.teljes.push(`${where}: ${fmt(fullBad)}`);
      if (!(await pick(page, "alap"))) throw new Error(`${where}: nincs „alap” csomag-kártya a konfigurátorban`);
      const alap = (await page.evaluate(MEASURE)) as Link[];
      const alapBad = alap.filter((l) => l.target !== "ok");
      if (alapBad.length) bad.alap.push(`${where}: ${fmt(alapBad)}`);
      dropped += full.length - alap.length;
      await pick(page, "teljes");
      const back = (await page.evaluate(MEASURE)) as Link[];
      if (back.length !== full.length) {
        const key = (l: Link): string => `${l.href} ${l.label}`;
        const left = back.map(key);
        const lost = full.map(key).filter((k) => {
          const i = left.indexOf(k);
          if (i < 0) return true;
          left.splice(i, 1);
          return false;
        });
        bad.restored.push(`${where}: ${full.length} link helyett ${back.length} (hiányzik: ${lost.join(", ")})`);
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
console.log(`\nMOCK fejléc-linkek csomag-váltáskor — ${ids.length} sablon × telefon + asztal:`);
check("① „Teljes” csomag: minden látható #-link látható célra mutat", bad.teljes.length === 0, list(bad.teljes));
const alapOk = bad.alap.length === 0;
if (SELF_TEST) {
  console.log(`  ${alapOk ? "❌" : "✅"} ② (öntesztben PIROS kell) „Alap” csomag — a javítás nélkül ${alapOk ? "NEM jelzett" : `jelzett: ${list(bad.alap)}`}`);
} else {
  check("② „Alap” csomag: nincs link elrejtett vagy hiányzó szekcióra", alapOk, list(bad.alap));
}
check(`③ vissza „Teljes”-re: az elrejtett linkek visszajönnek (váltáskor eltűnt: ${dropped})`, bad.restored.length === 0, list(bad.restored));
// Without a single dropped link ② would pass on a page where "Alap" changed nothing at all.
if (!SELF_TEST) check("③ az „Alap” váltás ténylegesen vitt el linket (a mérés nem üresjárat)", dropped > 0);
check("④ nincs JS-hiba", bad.js.length === 0, list(bad.js));

if (SELF_TEST) {
  const ok = !alapOk && failures === 0;
  console.log(ok ? "\n✅ ÖNTESZT: a javítás nélkül a ② bukott — az őr lát\n" : "\n❌ ÖNTESZT: az őr nem a javítást méri\n");
  process.exit(ok ? 0 : 1);
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : "\n✅ minden állítás teljesült\n");
process.exit(failures ? 1 : 0);
