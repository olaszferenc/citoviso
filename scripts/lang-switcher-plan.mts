// TERV (nem kód) — a látogatói NYELVVÁLTÓ elhelyezése (ADR-0063, tulaj 2026-08-28).
//
// A tulaj három dolgot kért: (1) zászló + NÉV, (2) a "C" irány (kompakt, lenyíló)
// jó, de ne lógjon bele a Foglalás gombba, (3) mobilon a felső sáv jó, de NE
// legyen sticky. És feltette a döntő kérdést: „mi van a többi mock típussal?" —
// ezért ez a terv MIND A 16 sablonon leméri az ütközést, nem egyen.
//
// A kimenet önhordó HTML (inline CSS): a Design System kártyák sandbox-iframe-ben
// futnak, relatív CSS-hivatkozás ott nem töltődik be.
//
//   npx tsx scripts/lang-switcher-plan.mts
//     → assets/design-refs/tenant-site/lang-switcher-{v1,v2,v3}.html
//     → collision-report.json (ütközés-mérés mind a 16 sablonon)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { db } from "../src/db/client.js";
import { flagSvg } from "../src/ui/flags.js";

const OUT = path.resolve(import.meta.dirname, "../assets/design-refs/tenant-site");
const LANGS = [
  { code: "hu", name: "Magyar" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "en", name: "English" },
];

/* ─────────────────────────────── A HÁROM VÁLTOZAT ─────────────────────────── */

/** Közös: a lenyíló chip (kattintható, JS nélkül — <details>). */
function chip(): string {
  const cur = LANGS[0]!;
  return (
    `<details class="cl"><summary>${flagSvg(cur.code, 18)}<span>${cur.name}</span><i>▾</i></summary>` +
    `<div class="cl-list">` +
    LANGS.slice(1)
      .map(
        (l) =>
          `<a href="/${l.code}/">${flagSvg(l.code, 18)}<span>${l.name}</span></a>`,
      )
      .join("") +
    `</div></details>`
  );
}

/** Minden nyelv egymás mellett (sávhoz). */
function inlineRow(): string {
  return LANGS.map(
    (l, i) =>
      `<a class="cl-i${i === 0 ? " on" : ""}" href="${i === 0 ? "/" : `/${l.code}/`}">` +
      `${flagSvg(l.code, 18)}<span>${l.name}</span></a>`,
  ).join("");
}

const CSS_CHIP = `
.cl{position:relative;font:600 12px/1 var(--cit-font-body,system-ui)}
.cl>summary{list-style:none;display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;
  background:color-mix(in srgb,var(--cit-surface,#fff) 94%,transparent);color:var(--cit-ink,#222);
  box-shadow:0 1px 6px rgba(0,0,0,.12);cursor:pointer}
.cl>summary::-webkit-details-marker{display:none}
.cl>summary i{font-style:normal;opacity:.55}
.cl-list{position:absolute;right:0;top:calc(100% + 6px);padding:5px;border-radius:12px;min-width:158px;
  background:var(--cit-surface,#fff);box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:10}
.cl-list a{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;
  color:var(--cit-ink,#222);text-decoration:none}
.cl-list a:hover{background:color-mix(in srgb,var(--cit-accent,#888) 16%,transparent)}`;

const CSS_ROW = `
.cl-i{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border-radius:8px;
  color:var(--cit-ink,#222);text-decoration:none;opacity:.72;font:600 12px/1 var(--cit-font-body,system-ui)}
.cl-i.on{opacity:1;background:color-mix(in srgb,var(--cit-accent,#888) 18%,transparent)}`;

/**
 * V1 — SÁV a fejléc FELETT, jobbra a lenyíló chip. NEM sticky: a lap tetején ül,
 * görgetéskor kigörög (a tulaj kérése). Szerkezetileg nem tud ütközni: a sáv
 * SAJÁT sort kap, nem a fejléc fölé úszik.
 */
const V1 = {
  id: "v1",
  cim: "V1 — saját sáv a fejléc felett, lenyíló chip",
  css: CSS_CHIP + `
.cl-bar{position:relative;z-index:500;display:flex;justify-content:flex-end;padding:7px 18px;
  background:var(--cit-surface,#f7f7f7);border-bottom:1px solid var(--cit-line,#e5e5e5)}`,
  markup: `<div class="cl-bar">${chip()}</div>`,
  hova: "elé" as const,
};

/**
 * V2 — ugyanaz a sáv, de MINDEN nyelv kiírva (nincs kattintás a váltáshoz).
 * Mobilon is ez volt, amit a tulaj jónak látott.
 */
const V2 = {
  id: "v2",
  cim: "V2 — saját sáv, mind a 4 nyelv kiírva",
  css: CSS_ROW + `
.cl-bar{position:relative;z-index:500;display:flex;justify-content:flex-end;gap:2px;padding:6px 16px;
  background:var(--cit-surface,#f7f7f7);border-bottom:1px solid var(--cit-line,#e5e5e5)}
@media(max-width:640px){.cl-bar{justify-content:center;flex-wrap:wrap}}`,
  markup: `<div class="cl-bar">${inlineRow()}</div>`,
  hova: "elé" as const,
};

/**
 * V3 — lebegő chip a lap ALJÁN jobbra. Sosem ér a fejléchez, tehát egyetlen
 * sablonnal sem ütközhet fent; görgetés közben is elérhető marad.
 * ⚠️ Mérendő: a mobil sablonok alsó fix CTA-sávja (z-index 120) ütközhet vele.
 */
const V3 = {
  id: "v3",
  cim: "V3 — lebegő chip a lap alján jobbra",
  css: CSS_CHIP + `
.cl-float{position:fixed;right:14px;bottom:14px;z-index:400}
.cl-float .cl-list{top:auto;bottom:calc(100% + 6px)}
@media(max-width:640px){.cl-float{bottom:76px}}`,
  markup: `<div class="cl-float">${chip()}</div>`,
  hova: "body-vég" as const,
};

/**
 * V4 — BESZŐVE a sablon SAJÁT menüjébe (ADR-0059: a modul a natív szekcióba
 * folyik be, nem rátapad). A chip a `</nav>` elé kerül, tehát a sablon saját
 * fejléc-elrendezését használja: nem takarhat el semmit, mert a menü SORÁBAN ül,
 * és minden sablon a maga stílusát adja neki.
 */
const V4 = {
  id: "v4",
  cim: "V4 — a sablon saját menüjébe szőve",
  css: CSS_CHIP + `
.cl-innav{display:inline-flex;align-items:center;margin-left:10px;vertical-align:middle}
.cl-innav .cl>summary{box-shadow:none;background:color-mix(in srgb,currentColor 10%,transparent);
  color:inherit}`,
  markup: `<span class="cl-innav">${chip()}</span>`,
  hova: "nav" as const,
};

/**
 * V5 — HIBRID (a mérés vezetett ide):
 *   · DESKTOP: a chip a sablon SAJÁT menüjébe szőve (V4) — 16/16 tiszta;
 *   · MOBIL:  saját, NEM sticky sáv a fejléc felett — mert a szűk menüsorba
 *     befűzve a chip szétnyomta a márkanevet (mérve: 3 sorba tördelte).
 * A tulaj mindkettőt így kérte; ez a változat egyszerre teljesíti.
 */
const V5 = {
  id: "v5",
  cim: "V5 — desktopon a menübe szőve, mobilon saját sáv (nem sticky)",
  css: CSS_CHIP + CSS_ROW + `
.cl-innav{display:inline-flex;align-items:center;margin-left:10px;vertical-align:middle}
/* Olvashatóság sötét ÉS világos navon: a chip a saját szöveg-színéből kap
   kontrasztos hátteret, nem egy fix szürkét (mérve: fehér navon alig látszott). */
.cl-innav .cl>summary{box-shadow:none;color:inherit;
  background:color-mix(in srgb,currentColor 16%,transparent);
  border:1px solid color-mix(in srgb,currentColor 28%,transparent)}
.cl-bar{position:relative;z-index:500;display:none;justify-content:center;flex-wrap:wrap;gap:2px;
  padding:7px 12px;background:var(--cit-surface,#f7f7f7);border-bottom:1px solid var(--cit-line,#e5e5e5)}
@media(max-width:640px){.cl-bar{display:flex}.cl-innav{display:none}}`,
  markup: `<span class="cl-innav">${chip()}</span>`,
  barMarkup: `<div class="cl-bar">${inlineRow()}</div>`,
  hova: "hibrid" as const,
};

/**
 * V6 — a HIBRID, működő változata (a mérés vezetett ide, két körben):
 *   · DESKTOP: chip a sablon saját menüjébe szőve (V4: 16/16 tiszta).
 *   · MOBIL:   FIX sáv a lap tetején + a lap saját fix elemeit (nav, CTA-sáv) a
 *     beépülő réteg lejjebb tolja a sáv magasságával. Azért így: mobilon 6 sablon
 *     ELREJTI a navot (ott a beszőtt chip eltűnne), 5-nél pedig a fix nav takarta
 *     volna a sávot — mindkettő MÉRVE.
 *   A tolás generikus (számított), nem sablon-lista: nincs mit karbantartani.
 */
const V6 = {
  id: "v6",
  cim: "V6 — desktopon menübe szőve, mobilon fix sáv (a lap fix elemei alá tolva)",
  css: CSS_CHIP + CSS_ROW + `
.cl-innav{display:inline-flex;align-items:center;margin-left:10px;vertical-align:middle}
.cl-innav .cl>summary{box-shadow:none;color:inherit;
  background:color-mix(in srgb,currentColor 16%,transparent);
  border:1px solid color-mix(in srgb,currentColor 28%,transparent)}
.cl-bar{position:fixed;top:0;left:0;right:0;z-index:2147483000;display:none;
  justify-content:center;flex-wrap:nowrap;gap:2px;padding:6px 8px;
  background:var(--cit-surface,#f7f7f7);border-bottom:1px solid var(--cit-line,#e5e5e5)}
.cl-bar .cl-i{padding:5px 7px;font-size:11px}
@media(max-width:640px){.cl-bar{display:flex}.cl-innav{display:none}}`,
  markup: `<span class="cl-innav">${chip()}</span>`,
  barMarkup:
    `<div class="cl-bar">${inlineRow()}</div>` +
    `<script>(function(){function f(){var b=document.querySelector('.cl-bar');` +
    `if(!b||getComputedStyle(b).display==='none'){document.body.style.paddingTop='';return;}` +
    `var h=b.getBoundingClientRect().height;document.body.style.paddingTop=h+'px';` +
    `Array.prototype.forEach.call(document.body.querySelectorAll('*'),function(e){` +
    `if(e===b||b.contains(e))return;var st=getComputedStyle(e);` +
    `if(st.position!=='fixed'&&st.position!=='sticky')return;` +
    `var t=parseFloat(st.top);if(isNaN(t)||t>=h)return;` +
    `if(!e.dataset.clShift){e.dataset.clShift='1';e.style.top=(t+h)+'px';}});}` +
    `addEventListener('DOMContentLoaded',f);addEventListener('resize',f);f();})();</script>`,
  hova: "hibrid" as const,
};

const VARIANTS = [V4, V6];

/* ─────────────────────────── renderelés + ütközés-mérés ───────────────────── */

async function loadRealSite(): Promise<{ recipe: Recipe; data: SiteData }> {
  const row = await db
    .selectFrom("site")
    .innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("mock_artifact.inputs as inputs")
    .where("site.slug", "=", "ifjusagi-szallas-tihany")
    .executeTakeFirst();
  const inputs = (row?.inputs ?? {}) as { recipe?: Recipe; siteData?: SiteData };
  if (!inputs.recipe || !inputs.siteData) throw new Error("nincs valós site-adat");
  return { recipe: inputs.recipe, data: inputs.siteData };
}

function inject(html: string, v: (typeof VARIANTS)[number]): string {
  const style = `<style data-cit-langcss>${v.css}</style>`;
  const withCss = html.includes("</head>")
    ? html.replace("</head>", `${style}</head>`)
    : style + html;
  if (v.hova === "body-vég") {
    return withCss.replace(/<\/body>/i, `${v.markup}</body>`);
  }
  if (v.hova === "hibrid") {
    const withBar = withCss.replace(
      /<body([^>]*)>/i,
      `<body$1>${(v as { barMarkup?: string }).barMarkup ?? ""}`,
    );
    // <nav> VAGY <header> — a card-sidebar sablon fejléce <header>, nav nélkül
    // (mérve: ott a chip egyáltalán nem jelent meg).
    const nav = /<nav[\s\S]*?<\/nav>/i.exec(withBar) ?? /<header[\s\S]*?<\/header>/i.exec(withBar);
    if (nav) {
      const block = nav[0];
      const last = block.lastIndexOf("</a>");
      if (last !== -1) {
        return withBar.replace(block, block.slice(0, last + 4) + v.markup + block.slice(last + 4));
      }
    }
    return withBar;
  }
  if (v.hova === "nav") {
    // A menü UTOLSÓ LINKJE MELLÉ — így a chip abba a flex-sorba kerül, amiben a
    // menüpontok ülnek. (A `</nav>` elé tenni nem elég: az aurora navja három
    // szinttel beljebb tartja a linkeket, ott a chip kiesett a sorból és takarásba
    // került — mérve.)
    const nav = /<nav[\s\S]*?<\/nav>/i.exec(withCss) ?? /<header[\s\S]*?<\/header>/i.exec(withCss);
    if (nav) {
      const block = nav[0];
      const last = block.lastIndexOf("</a>");
      if (last !== -1) {
        const patched = block.slice(0, last + 4) + v.markup + block.slice(last + 4);
        return withCss.replace(block, patched);
      }
    }
    return withCss.replace(/<body([^>]*)>/i, `<body$1><div class="cl-bar">${v.markup}</div>`);
  }
  // A sáv a LEGELSŐ elem a body-ban (a sablon saját fejléce elé).
  return withCss.replace(/<body([^>]*)>/i, `<body$1>${v.markup}`);
}

const { recipe, data } = await loadRealSite();
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const report: Record<string, Record<string, string>> = {};

for (const v of VARIANTS) {
  report[v.id] = {};
  for (const tpl of Object.keys(TEMPLATES)) {
    const html = inject(renderSite({ ...recipe, template: tpl }, data, { phase: "live" }), v);
    const file = path.join(OUT, `_tmp-${v.id}-${tpl}.html`);
    await writeFile(file, html, "utf8");
    for (const vp of [
      { width: 1280, height: 820, label: "asztali" },
      { width: 390, height: 800, label: "mobil" },
    ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 700 });
    await page.goto(pathToFileURL(file).href);
    await page.waitForTimeout(250);
    // ÜTKÖZÉS-MÉRÉS: a kapcsoló középpontján TÉNYLEG a kapcsoló van-e legfelül,
    // és takar-e bármit a sablon fejlécéből (a "benne van a HTML-ben" nem elég).
    const verdict = await page.evaluate(() => {
      const cands = Array.from(
        document.querySelectorAll(".cl-bar, .cl-float, .cl-innav"),
      ) as HTMLElement[];
      // A hibridnél a rejtett (display:none) fél nem hiba — a LÁTHATÓT mérjük.
      const el = cands.find((c) => c.getBoundingClientRect().width > 8) ?? null;
      if (!el) return "nincs-kapcsolo";
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return "nulla-meretu";
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cy < 0 || cy > window.innerHeight) return "kepernyon-kivul";
      const top = document.elementFromPoint(cx, cy);
      if (!top || !el.contains(top)) return "TAKARVA";
      // Takar-e a kapcsoló egy linket/gombot a sablonból?
      const hits: string[] = [];
      for (const a of Array.from(document.querySelectorAll("a,button"))) {
        if (el.contains(a)) continue;
        const ar = (a as HTMLElement).getBoundingClientRect();
        if (ar.width < 4 || ar.height < 4) continue;
        const overlap =
          ar.left < r.right && ar.right > r.left && ar.top < r.bottom && ar.bottom > r.top;
        if (overlap) hits.push(((a as HTMLElement).innerText || "?").trim().slice(0, 18));
      }
      return hits.length ? `UTKOZIK: ${hits.slice(0, 3).join(", ")}` : "ok";
    });
    report[v.id]![`${tpl}/${vp.label}`] = verdict;
    await page.close();
    }
  }
}
// TERV-fájlok: a döntéshez elég 4 karakteresen eltérő sablon (fix nav, üveg nav,
// klasszikus nav, scrapbook) — a többit a mérési riport fedi.
const PLAN_TPLS = ["fullbleed", "aurora", "scrapbook", "editorial"];
for (const v of VARIANTS) {
  for (const tpl of PLAN_TPLS) {
    const html = inject(renderSite({ ...recipe, template: tpl }, data, { phase: "live" }), v);
    const marked = html.replace(
      /<head>/i,
      `<head><!-- @dsCard group="Tenant-oldal" --><title>Nyelvváltó ${v.id.toUpperCase()} — ${tpl}</title>`,
    );
    await writeFile(path.join(OUT, `lang-switcher-${v.id}-${tpl}.html`), marked, "utf8");
  }
}
await browser.close();
await writeFile(path.join(OUT, "lang-switcher-collision.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
process.exit(0);
