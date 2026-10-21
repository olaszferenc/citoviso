// Order-steps guard — contract: assets/design-refs/console/rendeles-egyszerusitett (ADR-0395,
// owner 2026-10-19 „A”). (File name kept from the two-step contract it replaces, order-two-step,
// so the pre-commit wiring stays one line.)
//
// Why it exists: measured 2026-10-19 on a 390 px phone, the old step 1 asked for the package, 11
// section switches AND the address at once — ~1 700 px of content in a ~320 px window, the address
// at the very bottom under a 10-row list of domain names. 5 of 63 real leads opened the panel, for
// ~1 minute; nobody paid. The approved order is three steps, one decision per screen:
//   step 1 — the packages; the switch list behind „Testre szabom”, CLOSED; foot = total + „Tovább”
//            (no Havi|Éves switch there);
//   step 2 — the address only: one offered name, a fixed platform-address line;
//   step 3 — the pay step: the ONE period switch, every consent (§A first), the pay button.
// On a phone the panel is FULL SCREEN on every step.
//
// ⛔ Measured the way the buyer meets it: hit-tests with `elementFromPoint` at an UNTOUCHED scroll
// position (no Playwright auto-scroll — it scrolls overflow boxes and turns an off-screen control
// green), on a portrait phone, a phone held sideways and a desktop.
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
  var panel = document.querySelector(".cit-cfg-panel");
  var pr = panel.getBoundingClientRect();
  return {
    addr: panel.classList.contains("cit-cfg-panel--addr"),
    billing: panel.classList.contains("cit-cfg-panel--billing"),
    presets: vis(".cit-cfg-presets"),
    rowsVis: vis(".cit-cfg-detail .cit-cfg-row"),
    expanded: (document.querySelector(".cit-cfg-customize") || {}).getAttribute ? document.querySelector(".cit-cfg-customize").getAttribute("aria-expanded") : null,
    dsec: vis(".cit-cfg-dsec"),
    pill: vis(".cit-cfg-ppill"),
    period3: vis(".cit-cfg-period3"),
    mini: vis(".cit-cfg-mini__amt"),
    nextHit: hit(".cit-cfg-next"),
    backHit: hit(".cit-cfg-hback"),
    prog: ((document.querySelector(".cit-cfg-progtxt") || {}).textContent || "").trim(),
    h2: ((document.querySelector(".cit-cfg-head h2") || {}).textContent || "").trim(),
    rightsInPay: !!document.querySelector(".cit-cfg-co-act .cit-cfg-rights"),
    full: pr.left <= 1 && pr.top <= 1 && pr.right >= innerWidth - 1 && pr.bottom >= innerHeight - 1,
    rect: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.right), Math.round(pr.bottom), innerWidth, innerHeight],
  };
})()`;
type Probe = {
  addr: boolean; billing: boolean; presets: boolean; rowsVis: boolean; expanded: string | null; dsec: boolean;
  pill: boolean; period3: boolean; mini: boolean; nextHit: boolean; backHit: boolean; prog: string; h2: string;
  rightsInPay: boolean; full: boolean; rect: number[];
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
    // The panel slides in; under a loaded machine (the full gate suite, 2026-10-21: twice red,
    // alone green) 450 ms was not the end of the animation. Wait for the panel's rectangle to
    // STOP MOVING (two polls alike) within a bound — the full-screen claim below stays as strict.
    await page.waitForFunction(
      `(function(){var p=document.querySelector(".cit-cfg-panel");if(!p)return false;var r=p.getBoundingClientRect();` +
        `var k=Math.round(r.top)+"|"+Math.round(r.bottom)+"|"+Math.round(r.left);var same=r.height>0&&window.__citPanelKey===k;window.__citPanelKey=k;return same})()`,
      undefined,
      { timeout: 8000, polling: 150 },
    );
    await page.waitForTimeout(450);
    // The short (sideways) panel scrolls as ONE column; the buyer scrolls it to the
    // foot. Everywhere else the foot is pinned and must be reachable untouched.
    const toFoot = async () => {
      if (vp.short) await page.evaluate(`(function(){var p=document.querySelector(".cit-cfg-panel");p.scrollTop=p.scrollHeight;})()`);
      await page.waitForTimeout(80);
    };
    const toTop = async () => {
      if (vp.short) await page.evaluate(`document.querySelector(".cit-cfg-panel").scrollTop=0`);
      await page.waitForTimeout(80);
    };

    // ── step 1: the packages ──
    let p = (await page.evaluate(PROBE)) as Probe;
    f(!p.addr && !p.billing, "induláskor nem az 1. lépés állapotában van a panel");
    f(p.presets, "az 1. lépésen nem látszanak a csomag-kártyák");
    f(p.expanded === "false" && !p.rowsVis, `a „Testre szabom” kapcsoló-lista alapból nyitva (aria-expanded=${p.expanded})`);
    f(!p.dsec, "az 1. lépésen látszik a cím-rész (a csomag mellett a webcímet is kéri)");
    f(!p.pill, "az 1. lépésen ott a Havi|Éves váltó (a fizetés-lapra tartozik)");
    f(/^1\. \/ 3/.test(p.prog), `a haladásjelző nem „1. / 3 …” („${p.prog}”)`);
    f(p.h2 === "Válasszon csomagot", `az 1. lépés címe: „${p.h2}”`);
    if (vp.sheet) f(p.full, `telefonon a panel nem teljes képernyős (${p.rect.join(",")})`);
    await toFoot();
    p = (await page.evaluate(PROBE)) as Probe;
    f(p.mini, "az 1. lépésen nincs futó összeg");
    f(p.nextHit, "az 1. lépésen a „Tovább” nem koppintható (takarja valami, vagy a képen kívül van)");

    // ── step 2: the address ──
    await page.evaluate(`document.querySelector(".cit-cfg-next").click()`);
    await page.waitForFunction(`!document.querySelector(".cit-cfg-next").disabled`, null, { timeout: 15000 }).catch(() => {});
    await toTop();
    p = (await page.evaluate(PROBE)) as Probe;
    f(p.addr, "a „Tovább” után nem a cím-lépés jön");
    f(!p.presets, "a cím-lépésen is látszanak a csomag-kártyák");
    f(p.dsec, "a cím-lépésen nem látszik a cím-rész");
    f(/^2\. \/ 3/.test(p.prog) && p.h2 === "Az oldal címe", `a cím-lépés fejléce: „${p.h2}” · „${p.prog}”`);
    f(p.backHit, "a cím-lépésen a vissza-nyíl nem koppintható");
    await toFoot();
    p = (await page.evaluate(PROBE)) as Probe;
    f(p.nextHit, "a cím-lépésen a „Tovább” nem koppintható");

    // ── back, then forward again ──
    await page.evaluate(`document.querySelector(".cit-cfg-hback").click()`);
    await page.waitForTimeout(200);
    p = (await page.evaluate(PROBE)) as Probe;
    f(!p.addr && p.presets, "a vissza-nyíl után nem a csomag-lépés jön vissza");
    await page.evaluate(`document.querySelector(".cit-cfg-next").click()`);
    await page.waitForFunction(`!document.querySelector(".cit-cfg-next").disabled`, null, { timeout: 15000 }).catch(() => {});

    // ── step 3: pay ──
    await page.evaluate(`document.querySelector(".cit-cfg-next").click()`);
    await page.waitForTimeout(400);
    p = (await page.evaluate(PROBE)) as Probe;
    f(p.billing, "a cím-lépés „Tovább”-ja nem a fizetés-lapra visz");
    f(p.period3, "a fizetés-lapon nincs Havi/Éves váltó");
    f(p.rightsInPay, "a §A nyilatkozat nem a fizetés-lap jóváhagyásai között van");
    if (vp.sheet) {
      const fold = (await page.evaluate(`document.querySelector(".cit-cfg-panel").classList.contains("cit-cfg-panel--fold")`)) as boolean;
      f(fold, "telefonon a fizetés-lap nem egy oszlopban görget");
    }
    await page.evaluate(`document.querySelector(".cit-cfg-back3").click()`);
    await page.waitForTimeout(200);
    p = (await page.evaluate(PROBE)) as Probe;
    f(p.addr && !p.billing, "a „Vissza a tervhez” nem a cím-lépésre visz");
    f(errors.length === 0, `JS-hiba: ${errors.slice(0, 2).join(" | ")}`);
    await page.close();
  }
  return fails;
}

// Each mutation reverts ONE part of the contract; every one must turn the gate red.
const MUTATIONS: { name: string; from: RegExp; to: string }[] = [
  {
    name: "a kapcsoló-lista alapból nyitva",
    from: /'<button class="cit-cfg-customize" type="button" aria-expanded="false">'/,
    to: `'<button class="cit-cfg-customize" type="button" aria-expanded="true">'`,
  },
  {
    name: "a cím-rész az 1. lépésen is látszik",
    from: /\.cit-cfg-panel:not\(\.cit-cfg-panel--addr\) \.cit-cfg-dsec \{ display: none; \}/,
    to: "",
  },
  {
    name: "a Havi|Éves váltó visszakerül az 1. lépésre",
    from: /\.cit-cfg-panel:not\(\.cit-cfg-panel--cont\) \.cit-cfg-ppill \{ display: none !important; \}/,
    to: "",
  },
  {
    name: "a §A nyilatkozat nem kerül a fizetés-lapra",
    from: /actEl\.insertBefore\(rightsRow, actEl\.firstChild\);/,
    to: "void 0;",
  },
  {
    name: "telefonon a panel újra alsó lap",
    from: /\.cit-cfg-panel \{\n    top: 0;\n    max-height: none;\n    border-radius: 0;\n  \}/,
    to: ".cit-cfg-nomatch {\n  }",
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
    else console.log(`✅ order-steps (ADR-0395): ${VIEWPORTS.length} nézet — csomag → cím → fizetés, egy képernyőn egy döntés, a gombok koppinthatók`);
  }
} finally {
  await browser.close();
}
process.exit(bad ? 1 : 0);
