// Two-step order guard — contract: assets/design-refs/console/order-two-step (variant B).
//
// Why it exists (owner, 2026-09-26, from a phone): the configurator's pinned money
// block (period cards + "MOST FIZETENDŐ" card + VAT + next charge + button) filled
// the 74vh bottom sheet and left ONE row of the package list — "semmi nem látszik a
// modulok csomagokból". The approved fix splits the order in two:
//   step 1 — the package/module list owns the sheet; the foot is ONE row
//            (small Havi|Éves switch + running total + "Tovább");
//   step 2 — the list leaves; the period cards come FIRST, then the card, VAT,
//            next charge and the §A declaration; the action row stays pinned.
//
// ⛔ Measured the way the buyer meets it: hit-tests with `elementFromPoint` at an
// UNTOUCHED scroll position (no Playwright auto-scroll — it scrolls overflow boxes
// and turns an off-screen control green), on a portrait phone, a phone held
// sideways and a desktop.
//
//   npx tsx scripts/order-two-step-check.mts               # the gate
//   npx tsx scripts/order-two-step-check.mts --self-test   # must go RED on each mutation
import { chromium, type Browser } from "playwright-core";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { sessionTmpDir } from "./lib/session-tmp.mts";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";

const SELF_TEST = process.argv.includes("--self-test");
const TMP = sessionTmpDir("order-two-step-check");
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";

const demo: SiteData = {
  name: "Három Huszár Apartments",
  tagline: "Csendes udvar a belváros szélén",
  intro: "Három apartman, mindegyikben konyha és terasz, saját parkolóval.",
  highlights: ["Saját parkoló", "Terasz", "Konyha", "5 perc a belvárostól"],
  photos: [],
  contact: { email: "info@harom-huszar.example", phone: "+36 30 000 0000", address: "9400 Példaváros, Huszár utca 3." },
  rooms: [{ name: "Apartman", capacity: "4 fő", note: "Terasszal." }],
  reviews: [{ quote: "Tiszta és csendes.", author: "Anna", meta: "Győr" }],
  place: { city: "Példaváros", country: "HU" },
};
const sections: Recipe["sections"] = (["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const).map(
  (kind) => ({ kind }),
);

async function buildHtml(): Promise<string> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections };
  return injectConfigurator(await injectRuntime(renderSite(recipe, demo)), ARTIFACT_ID, demo.name);
}

const VIEWPORTS = [
  { tag: "telefon 390×844", size: { width: 390, height: 844 }, sheet: true, short: false },
  { tag: "kis telefon 360×780", size: { width: 360, height: 780 }, sheet: true, short: false },
  { tag: "fekvő telefon 844×390", size: { width: 844, height: 390 }, sheet: false, short: true },
  { tag: "asztali 1280×800", size: { width: 1280, height: 800 }, sheet: false, short: false },
] as const;

/**
 * ⛔ String probe: tsx's esbuild adds __name wrappers to arrow functions, which
 * throw inside page.evaluate. Returns what the buyer can actually TAP right now.
 */
const PROBE = `(function () {
  function vis(s) {
    var e = document.querySelector(s);
    if (!e) return false;
    var r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
  }
  function hit(s) {
    var e = document.querySelector(s);
    if (!e) return false;
    var r = e.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    var x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 12);
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
    var t = document.elementFromPoint(x, y);
    return !!t && (t === e || e.contains(t));
  }
  function top(s) { var e = document.querySelector(s); return e ? e.getBoundingClientRect().top : null; }
  function h(s) { var e = document.querySelector(s); return e ? e.getBoundingClientRect().height : 0; }
  function num(s) {
    var e = document.querySelector(s);
    var m = e ? /([0-9][0-9\\s\\u00a0\\u202f]*)/.exec(e.textContent || "") : null;
    return m ? Number(m[1].replace(/\\D/g, "")) : null;
  }
  var panel = document.querySelector(".cit-cfg-panel");
  return {
    s2: panel.classList.contains("cit-cfg-panel--s2"),
    body: vis(".cit-cfg-body"),
    bodyH: h(".cit-cfg-body"),
    panelH: h(".cit-cfg-panel"),
    s2scroll: vis(".cit-cfg-s2scroll"),
    permat: vis(".cit-cfg-permat"),
    permatHit: hit('.cit-cfg-permat [data-period="annual"]'),
    permatTop: top(".cit-cfg-permat"),
    sumTop: top(".cit-cfg-s2scroll .cit-cfg-sum"),
    sumVis: vis(".cit-cfg-sum"),
    pill: vis(".cit-cfg-ppill"),
    pillHit: hit('.cit-cfg-ppill [data-period="annual"]'),
    mini: vis(".cit-cfg-mini__amt"),
    miniN: num(".cit-cfg-mini__amt"),
    cardN: num(".cit-cfg-sum b"),
    miniText: (document.querySelector(".cit-cfg-mini__amt") || {}).textContent || "",
    nextHit: hit(".cit-cfg-next"),
    submitHit: hit(".cit-cfg-submit"),
    rights: vis(".cit-cfg-rights"),
    recap: ((document.querySelector(".cit-cfg-recap b") || {}).textContent || "").trim(),
    head: ((document.querySelector(".cit-cfg-head p") || {}).textContent || "").trim(),
    annualCardOn: !!document.querySelector('.cit-cfg-permat [data-period="annual"].cit-cfg-popt--on'),
    annualPillOn: !!document.querySelector('.cit-cfg-ppill [data-period="annual"].cit-cfg-popt--on'),
    // LINES of the annual card's "áráért" line (the form that is shown: wide OR
    // narrow). ⛔ Not getClientRects().length: an inline span with a nested span
    // returns one rect per RUN, so a single line read 2 — count distinct line tops.
    gainLines: (function () {
      var w = document.querySelector(".cit-cfg-permat .cit-cfg-gain-w");
      var n = document.querySelector(".cit-cfg-permat .cit-cfg-gain-n");
      var shown = w && getComputedStyle(w).display !== "none" ? w : n;
      if (!shown) return 0;
      var tops = {};
      Array.prototype.forEach.call(shown.getClientRects(), function (r) {
        if (r.width > 0) tops[Math.round(r.top)] = 1;
      });
      return Object.keys(tops).length;
    })(),
    gainText: ((document.querySelector(".cit-cfg-permat .cit-cfg-popt__gain") || {}).innerText || "").trim(),
  };
})()`;
type Probe = {
  s2: boolean; body: boolean; bodyH: number; panelH: number; s2scroll: boolean; permat: boolean;
  permatHit: boolean; permatTop: number | null; sumTop: number | null; sumVis: boolean; pill: boolean;
  pillHit: boolean; mini: boolean; miniN: number | null; cardN: number | null; miniText: string;
  nextHit: boolean; submitHit: boolean; rights: boolean; recap: string; head: string;
  annualCardOn: boolean; annualPillOn: boolean; gainLines: number; gainText: string;
};

async function audit(browser: Browser, file: string): Promise<string[]> {
  const fails: string[] = [];
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: vp.size });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const f = (c: boolean, msg: string) => {
      if (!c) fails.push(`${vp.tag}: ${msg}`);
    };
    await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded" });
    await page.mouse.wheel(0, 900);
    await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 8000 });
    // evaluate(), not click(): no auto-scroll anywhere in this guard
    await page.evaluate(`document.querySelector(".cit-cfg-launch").click()`);
    await page.waitForTimeout(450);
    // The short (sideways) panel scrolls as ONE column; the buyer scrolls it to the
    // foot. Everywhere else the foot is pinned and must be reachable untouched.
    const toFoot = async () => {
      if (vp.short) await page.evaluate(`(function(){var p=document.querySelector(".cit-cfg-panel");p.scrollTop=p.scrollHeight;})()`);
      await page.waitForTimeout(80);
    };

    // ── step 1 ──
    await toFoot();
    let p = (await page.evaluate(PROBE)) as Probe;
    f(!p.s2, "induláskor már a 2. lépés állapotában van a panel");
    f(p.body, "az 1. lépésen nem látszik a csomag/modul-lista");
    f(!p.s2scroll && !p.permat, "az 1. lépésen látszik a fizetési blokk (Havi/Éves kártyák / MOST FIZETENDŐ) — pont ez szorította ki a listát");
    f(p.mini, "az 1. lépésen nincs futó összeg");
    f(p.pill && p.pillHit, "az 1. lépésen nem koppintható a kis Havi|Éves váltó");
    f(p.nextHit, "az 1. lépésen a „Tovább” nem koppintható (takarja valami, vagy a képen kívül van)");
    if (vp.sheet) {
      // The measured defect: the list had ~1 row of a 74vh sheet. Now it owns it.
      const share = p.panelH ? p.bodyH / p.panelH : 0;
      f(share >= 0.5, `a lista a lapnak csak ${(share * 100).toFixed(0)}%-át kapja (min. 50%)`);
    }
    // the small switch drives the same period as the cards (one state)
    await page.evaluate(`document.querySelector('.cit-cfg-ppill [data-period="annual"]').click()`);
    await page.waitForTimeout(120);
    p = (await page.evaluate(PROBE)) as Probe;
    f(/év/.test(p.miniText), `éves váltás után a futó összeg nem „/ év” (${p.miniText.trim()})`);
    f(p.annualPillOn && p.annualCardOn, "a kis váltó és a 2. lépés kártyái nem ugyanazt az ütemet mutatják");
    await page.evaluate(`document.querySelector('.cit-cfg-ppill [data-period="monthly"]').click()`);
    await page.waitForTimeout(120);

    // ── step 2 ──
    await page.evaluate(`document.querySelector(".cit-cfg-next").click()`);
    await page.waitForTimeout(250);
    if (vp.short) await page.evaluate(`document.querySelector(".cit-cfg-panel").scrollTop=0`);
    p = (await page.evaluate(PROBE)) as Probe;
    f(p.s2, "a „Tovább” után nem a 2. lépés állapota van");
    f(!p.body, "a 2. lépésen is látszik a csomag-lista");
    f(p.permat && p.permatHit, "a 2. lépésen a Havi/Éves kártya nem látszik / nem koppintható érintetlen görgetésnél");
    f(p.permatTop !== null && p.sumTop !== null && p.permatTop < p.sumTop, "a 2. lépés első látványa nem a Havi/Éves kártya-pár (az összeg-kártya fölötte van)");
    f(p.sumVis, "a 2. lépésen nem látszik a MOST FIZETENDŐ kártya");
    // owner, 2026-09-26: "10 hónap áráért 12 hónap —" / "95 000 Ft/év" broke in two on desktop
    f(p.gainLines === 1, `az Éves kártya „áráért” sora nem egy sorban áll (${p.gainLines} sor: „${p.gainText}”)`);
    f(p.miniN !== null && p.miniN === p.cardN, `a két lépés összege eltér (1. lépés: ${p.miniN}, kártya: ${p.cardN})`);
    f(/szekció/.test(p.recap), `a 2. lépés nem nevezi meg a választott csomagot („${p.recap}”)`);
    f(!/Most nem fizet semmit/.test(p.head) && /Még nem fizet/.test(p.head), `a 2. lépés fejléce: „${p.head}”`);
    await toFoot();
    p = (await page.evaluate(PROBE)) as Probe;
    f(p.submitHit, "a 2. lépésen a „Tovább a számlázási adatokhoz” nem koppintható");
    f(p.rights, "a 2. lépésen nem található a §A nyilatkozat");

    // ── back ──
    await page.evaluate(`document.querySelector(".cit-cfg-back").click()`);
    await page.waitForTimeout(200);
    p = (await page.evaluate(PROBE)) as Probe;
    f(p.body && !p.permat && !p.s2, "a „Vissza a csomagokhoz” után nem a lista-lépés jön vissza");

    // ── the pay step: nothing of step 2 may stay behind and eat the form ──
    // Measured regression (B thread, 2026-09-26): the §A declaration's inline
    // `display:flex` beat the pay step's hide rule, and at 360×780 the billing form
    // was left a 24 px window under the consents — the buyer could not fill it in.
    await page.evaluate(`document.querySelector(".cit-cfg-next").click()`);
    await page.waitForTimeout(200);
    await page.evaluate(
      `(function(){var r=document.querySelector(".cit-cfg-rights");r.checked=true;r.dispatchEvent(new Event("change",{bubbles:true}));document.querySelector(".cit-cfg-submit").click();})()`,
    );
    await page.waitForTimeout(400);
    const pay = (await page.evaluate(`(function(){
      var d = document.querySelector(".cit-cfg-s2decl"), t = document.querySelector(".cit-cfg-s2top");
      var s = document.querySelector(".cit-cfg-co-scroll"), a = document.querySelector(".cit-cfg-co-act");
      var sr = s.getBoundingClientRect(), ar = a.getBoundingClientRect();
      return { decl: !!d && d.getBoundingClientRect().height > 0, top: !!t && t.getBoundingClientRect().height > 0,
        formH: Math.round(s.clientHeight), overlap: Math.round(sr.bottom - ar.top) };
    })()`)) as { decl: boolean; top: boolean; formH: number; overlap: number };
    f(!pay.decl, "a fizetés-lapon is ott maradt a §A nyilatkozat (elveszi az űrlap helyét)");
    f(!pay.top, "a fizetés-lapon is ott maradt a 2. lépés teteje (vissza / csomag / Havi-Éves kártyák)");
    if (vp.sheet) {
      // Portrait phones only: on desktop the two columns sit side by side (a vertical
      // "overlap" means nothing), and sideways the 24 px window predates this contract
      // (measured identical before ADR-0240) — that one is the pay step's own open item.
      f(pay.overlap <= 0, `a pipa+Fizetek blokk rálóg a számlázási űrlapra (${pay.overlap} px)`);
      // before ADR-0240 the form window was 127 px at 360×780 and 240 px at 390×844
      f(pay.formH >= 110, `a számlázási űrlap ablaka csak ${pay.formH} px (min. 110)`);
    }
    f(errors.length === 0, `JS-hiba: ${errors.slice(0, 2).join(" | ")}`);
    await page.close();
  }
  return fails;
}

// Each mutation reverts ONE part of the contract; every one must turn the gate red.
const MUTATIONS: { name: string; from: RegExp; to: string }[] = [
  {
    name: "a pénzügyi blokk visszakerül az 1. lépésre",
    from: /\.cit-cfg-panel:not\(\.cit-cfg-panel--s2\):not\(\.cit-cfg-panel--billing\) \.cit-cfg-s2scroll \{\n  display: none;/,
    to: ".cit-cfg-nomatch-s2scroll {\n  display: none;",
  },
  {
    name: "a 2. lépésen megmarad a lista",
    from: /\.cit-cfg-panel--s2 \.cit-cfg-body,\n/,
    to: "",
  },
  {
    name: "az Éves kártya nem kap több helyet (az „áráért” sor kettétörik)",
    from: /\.cit-cfg-permat \.cit-cfg-popt--deal \{ flex-grow: 1\.2; \}/,
    to: "",
  },
  {
    name: "a §A nyilatkozat inline display-t kap (a fizetés-lapon is ott marad)",
    from: /'<label class="cit-cfg-note cit-cfg-s2decl">'/,
    to: `'<label class="cit-cfg-note cit-cfg-s2decl" style="display:flex">'`,
  },
  {
    name: "a futó összeg nem követi a kártyát",
    from: /esc\(fmt\(currentCharge\(\)\)\)/,
    to: "esc(fmt(currentCharge() + 1))",
  },
];

const browser = await chromium.launch();
let bad = false;
try {
  const html = await buildHtml();
  if (SELF_TEST) {
    for (const m of MUTATIONS) {
      // ⛔ a mutation that silently does not match would make the self-test a lie
      if (!m.from.test(html)) {
        console.error(`⛔ önteszt: a „${m.name}” mutáció NEM illeszkedik a runtime-ra — az önteszt elavult`);
        bad = true;
        continue;
      }
      const file = path.join(TMP, `mut-${MUTATIONS.indexOf(m)}.html`);
      await writeFile(file, html.replace(m.from, m.to), "utf8");
      const fails = await audit(browser, file);
      if (fails.length) console.log(`✅ önteszt piros, ahogy kell — ${m.name} (${fails.length} lelet, pl. ${fails[0]})`);
      else {
        console.error(`⛔ önteszt ZÖLD maradt — ${m.name}: az őr nem látja ezt a visszarontást`);
        bad = true;
      }
    }
  } else {
    const file = path.join(TMP, "preview.html");
    await writeFile(file, html, "utf8");
    const fails = await audit(browser, file);
    for (const x of fails) console.error(`⛔ ${x}`);
    if (fails.length) bad = true;
    else console.log(`✅ order-two-step: ${VIEWPORTS.length} nézet — lista az 1. lépésen, a pénzügyi döntés a 2.-on, a gombok koppinthatók`);
  }
} finally {
  await browser.close();
}
process.exit(bad ? 1 : 0);
