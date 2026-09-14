// A KIKÜLDÖTT MOCK-LAP KERETEZÉSE — a sáv MINDEN látogatónak szól, és a helyét
// egyetlen sablon CSS-e sem veheti el.
//
//   npx tsx scripts/prospect-framing-check.mts
//   npx tsx scripts/prospect-framing-check.mts --selftest   (PIROS önteszt)
//
// KONTRAKTUS: assets/design-refs/prospect-page/framing/README.md (jóváhagyva
// 2026-09-14, „A — diszkrét felső sáv"). Elek FK-004b.
//
// MIT ŐRIZ, ÉS MIÉRT ÍGY
//
//  ① A SÁV OTT VAN, ÉS A KÖVETETT LÁTOGATÓ IS MEGKAPJA. Eddig felső sávot CSAK a
//     LEIRATKOZOTT kapott; aki egy hideg levélből nyitotta meg, magyarázat nélkül
//     állt a saját szállásáról készült idegen weboldalon. A két ág KÜLÖN sávot
//     kap, és egy látogató SOHA nem lát kettőt: a kettő mást állít (az egyik mér,
//     a másik nem — §B.17), tehát egymás mellett hazudna az egyik.
//
//  ② A HELYÉT NEM VESZI EL A SABLON CSS-E. Egy injektált elem a sablon szabályaitól
//     elveszítheti a pozícióját (aurora `body>*{position:relative}` egyszer a lap
//     aljára ejtett egy FIXED réteget; a fullbleed navja `position:absolute; top:0`).
//     Ezért NEM a sáv saját véleményét kérdezzük a helyéről, hanem geometriát:
//     a sáv rácspontjain az `elementFromPoint` KI-t ad vissza (ADR-0147 mintája),
//     és a lap minden más eleme a sáv ALATT kezdődik. Dokumentum-koordinátákban,
//     görgetés nélkül (az autoscroll egyszer már zöldre mért egy elszállt sávot).
//
//  ③ A JOGI RÉSZLET JS NÉLKÜL IS NYÍLIK. A mock egy IDEGEN böngészőben nyílik meg;
//     a kiút nem múlhat egy betöltött szkripten. Ezért natív <details>, és ezt a
//     guard `javaScriptEnabled:false` kontextusban méri — nem a forrásból hiszi el.
//
//  ④ A LINKEK OLVASHATÓK. Mérve (≥ 4,5:1) a saját hátterükön — nem szemre. A
//     böngésző alap link-kékje sötét sávon 1,99-et ad; a §2b vázlaton pontosan ez
//     a hiba fordult elő, és a kép nem mutatta meg.
//
//  ⑤ A NYITÓ-ANIMÁCIÓ KI VAN KAPCSOLVA A KIKÜLDÖTT MOCKON (tulajdonosi döntés,
//     2026-09-14). Két sablonon (arch-frames, wordmark-grow) egy TELJES KÉPERNYŐS
//     ADR-0115 intro fedte a lapot — arch-frames ~4,7 mp, wordmark-grow 6 mp-nél
//     MÉG futott —, és alatta a keretezés sem látszott. A guard NEM VÁRJA MEG:
//     az ELSŐ festésnél mér, mert a kapcsolónak épp az a dolga, hogy az első kép
//     is helyes legyen. (A korábbi változat kivárta az intro önkioltását, azaz a
//     PROBLÉMA UTÁN mért, és zöld maradt volna, ha az overlay visszajön.)
//     ⛔ ÉS PIXELLEL, NEM HIT-TESZTTEL: az overlay `pointer-events:none`, tehát az
//     `elementFromPoint` ÁTNÉZ RAJTA és a sávot adja vissza — mérve: a „sáv közepén
//     a sáv van" ZÖLD volt egy olyan lapon, ami egy üres krém téglalapot mutatott.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import sharp from "sharp";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import {
  disableIntroAnimation,
  injectOptedOutBanner,
  injectOptedOutNotice,
  injectTrackingBanner,
  injectTrackingNotice,
} from "../src/console/prospectNotice.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

const SELFTEST = process.argv.includes("--selftest");
const TOKEN = "hWAeKUweNOvCiAAMz6hlqUAA";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";

const DATA: SiteData = {
  name: "ELEK-PRÓBA Vendégház",
  tagline: "Szigliget, Balaton",
  intro: "Szigligeten, a várdomb és a strand között, tágas kerttel és nyolc fő számára kényelmes házzal.",
  highlights: ["Teraszos kert, grillsarok", "Strand néhány perc sétára"],
  geo: { lat: 46.8, lon: 17.43 },
  photos: [1, 2, 3].map((i) => ({ url: PIX, alt: `kép ${i}`, provenance: "portal" as const })),
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Kossuth utca 36, Szigliget, 8264" },
};

/**
 * NOT all 19 templates — a chosen set, each for a NAMED reason, so the guard stays
 * in seconds rather than minutes. The full 19-template sweep was run once by hand
 * (2026-09-14, 76 page loads, 0 problems); what runs on every commit is the set
 * that carries the known failure modes.
 */
const TEMPLATES_UNDER_TEST: ReadonlyArray<[string, string]> = [
  ["fullbleed", "a navja position:absolute; top:0 — ez fekhetne rá a sávra"],
  ["aurora", "body>*{position:relative} — ez ejtett már a lap aljára injektált réteget"],
  ["editorial", "balra igazított, kéthasábos — más elrendezés-család"],
  ["dark-luxury", "sötét skin: a sáv saját sötétjén is el kell válnia"],
  ["arch-frames", "ADR-0115 nyitó-animáció fedi a lapot ~4,7 mp-ig"],
];

const recipe = (templateId: string): Recipe =>
  ({
    skin: TEMPLATES[templateId]!.skins[0]!,
    archetype: "stacked",
    template: templateId,
    sections: [],
  }) as unknown as Recipe;

const OUT = path.resolve(import.meta.dirname, "../assets/Temp/_framing");
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

/** The page as the console really serves it to a TRACKED visitor. */
async function trackedPage(tpl: string): Promise<string> {
  const base = disableIntroAnimation(await injectRuntime(renderSite(recipe(tpl), DATA)));
  return injectTrackingNotice(injectTrackingBanner(base, TOKEN), TOKEN);
}
/** …and to a visitor who already opted out. */
async function optedOutPage(tpl: string): Promise<string> {
  const base = disableIntroAnimation(await injectRuntime(renderSite(recipe(tpl), DATA)));
  return injectOptedOutNotice(injectOptedOutBanner(base), TOKEN);
}
/** The SAME page WITHOUT the switch — the reference for "is it really off?". */
async function pageWithIntro(tpl: string): Promise<string> {
  const base = await injectRuntime(renderSite(recipe(tpl), DATA));
  return injectTrackingNotice(injectTrackingBanner(base, TOKEN), TOKEN);
}

/** The two templates that open with a full-screen ADR-0115 intro. */
const INTRO_TEMPLATES: ReadonlyArray<[string, string]> = [
  ["arch-frames", ".cit-fintro — halkuló wordmark, ~4,7 mp"],
  ["wordmark-grow", ".cit-intro — névből növő képkeret, 6 mp-nél még futott"],
];

type Probe = {
  bars: { kind: string; top: number; left: number; width: number; height: number; text: string }[];
  bodyWidth: number;
  /** Who answers elementFromPoint on a grid over the framing bar. */
  occluders: string[];
  /** Visible elements whose rectangle overlaps the bar AND paint on top of it. */
  above: string[];
  /** Top of the first STATIC in-flow element after the bar (push-down probe). */
  firstFlowTop: number | null;
  /** Contrast of every link/summary in the bar, on its own background. */
  contrast: { text: string; ratio: number }[];
  /** Is the legal detail visible right now? (collapsed by default) */
  detailVisible: boolean;
  detailHasLinks: { privacy: boolean; unsub: boolean };
  /** Is the ADR-0115 intro overlay still on screen? */
  introUp: boolean;
  /** How much of the bar's middle strip is REALLY painted in the bar's own colour
   *  (percent, measured on a screenshot — not a hit-test, which an overlay with
   *  pointer-events:none would sail straight through). */
  centrePixel: number[] | null;
};

const PROBE = `() => {
  // ⚠️ checkVisibility(), NOT a hand-rolled display/opacity/size test. Two things
  // the hand-rolled version got WRONG, both measured 2026-09-14:
  //   · a CLOSED <details> still has a LAYOUT BOX in Chromium (600×18 with no
  //     text in it), so a size test called the collapsed legal block "visible" and
  //     the guard reported the bar as permanently open;
  //   · a template's hidden fixed nav has opacity:0, but its CHILDREN compute
  //     opacity:1 — so the links inside an invisible navigation were reported as
  //     painting over the bar. checkOpacity walks the ANCESTORS.
  const vis = (el) => el.checkVisibility
    ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })
    : (() => { const c = getComputedStyle(el), r = el.getBoundingClientRect();
        return c.display !== "none" && c.visibility !== "hidden" && c.opacity !== "0" && r.width > 2 && r.height > 2; })();
  const box = (el) => { const r = el.getBoundingClientRect();
    return { top: r.top + scrollY, left: r.left + scrollX, width: r.width, height: r.height }; };

  const bars = [];
  for (const el of document.querySelectorAll("[data-cit-framing]")) {
    if (!vis(el)) continue;
    bars.push({ kind: el.getAttribute("data-cit-framing"), ...box(el),
                text: (el.textContent || "").replace(/\\s+/g, " ").trim() });
  }
  const bar = document.querySelector('[data-cit-framing]');

  // ── occlusion: geometry, not the bar's own opinion of where it is ──────────
  const occ = new Set();
  const above = [];
  const contrast = [];
  let detailVisible = false, privacy = false, unsub = false;
  if (bar) {
    const r = bar.getBoundingClientRect();
    for (let x = 4; x < r.width - 2; x += Math.max(24, r.width / 14))
      for (let y = r.top + 2; y < r.bottom - 2; y += Math.max(4, r.height / 5)) {
        const e = document.elementFromPoint(x, y);
        if (!(e === bar || bar.contains(e))) occ.add(e ? e.tagName + "." + (e.className || "").toString().slice(0, 20) : "null");
      }
    // ⛔ A LAYER THAT OVERLAPS THE BAR IS FINE — ONE THAT PAINTS ON TOP OF IT IS NOT.
    // A parallax hero image reaches 16 px into the bar's band on arch-frames, and a
    // hidden fixed nav spans it on two more templates; neither is a defect, because
    // both sit BEHIND. So the question is asked per element, at the middle of the
    // overlap: who does the browser say is on top there?
    for (const n of document.querySelectorAll("body *")) {
      if (n === bar || bar.contains(n)) continue;
      const nr = n.getBoundingClientRect();
      if (nr.height <= 3 || nr.width <= 30 || !vis(n)) continue;
      const ox = Math.max(r.left, nr.left), ox2 = Math.min(r.right, nr.right);
      const oy = Math.max(r.top, nr.top), oy2 = Math.min(r.bottom, nr.bottom);
      if (ox2 - ox < 4 || oy2 - oy < 4) continue; // no real overlap
      const e = document.elementFromPoint((ox + ox2) / 2, (oy + oy2) / 2);
      if (!(e === bar || bar.contains(e)))
        above.push(n.tagName + "." + (n.className || "").toString().slice(0, 18) + "@" + Math.round(nr.top));
    }
    // ── contrast, measured ────────────────────────────────────────────────────
    const lum = (c) => { const p = c.match(/[\\d.]+/g).slice(0, 3).map(Number)
      .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; };
    const bgOf = (el) => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c; n = n.parentElement; } return "rgb(255,255,255)"; };
    for (const el of bar.querySelectorAll("a, summary, strong")) {
      if (!vis(el)) continue;
      const f = lum(getComputedStyle(el).color), b = lum(bgOf(el));
      contrast.push({ text: (el.textContent || "").trim().slice(0, 30),
                      ratio: Math.round(((Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)) * 100) / 100 });
    }
    // ⛔ NOT \`details > div\`: the red self-test replaces the <details> with a plain
    // <div>, and a selector anchored on the tag would then find NOTHING and report
    // "collapsed" for a bar whose legal block is permanently open — the mutation
    // would have broken the QUESTION instead of the answer. The subject is the
    // legal SENTENCE, wherever it lives.
    const legal = [...bar.querySelectorAll("*")].find(
      (n) => /jogos érdekű megkeresés/i.test(n.textContent || "") &&
             ![...n.children].some((c) => /jogos érdekű megkeresés/i.test(c.textContent || "")),
    );
    detailVisible = !!legal && vis(legal);
    if (legal) {
      const scope = legal.closest("details") || legal;
      privacy = !!scope.querySelector('a[href*="/privacy"], a[href*="/adatvedelem"]');
      unsub = !!scope.querySelector('a[href*="/unsubscribe"]');
    }
  }
  // THE PUSH-DOWN PROBE: where does the page's first NORMAL-FLOW block start? The
  // same number is taken on the page WITHOUT the bar; the difference must be the
  // bar's height. NORMAL FLOW only — a fixed nav or an absolute parallax layer is
  // not "the page moving down", and asking about them measures nothing.
  // ⚠️ "static OR relative", not "static": the aurora skin sets
  // body>*{position:relative} — the exact rule that once stole a fixed layer's
  // place — and a static-only probe found NO anchor there and reported null.
  // A relative box still occupies its flow position; absolute/fixed/sticky do not.
  let firstFlowTop = null;
  for (const n of document.querySelectorAll("body > *")) {
    if (n.hasAttribute("data-cit-framing")) continue;
    if (!["static", "relative"].includes(getComputedStyle(n).position)) continue;
    const nr = n.getBoundingClientRect();
    if (nr.height < 4) continue;
    firstFlowTop = Math.round(nr.top + scrollY);
    break;
  }

  return { bars, bodyWidth: document.body.getBoundingClientRect().width,
           occluders: [...occ], above, contrast, detailVisible, firstFlowTop,
           detailHasLinks: { privacy, unsub },
           introUp: !!(document.getElementById("cit-fintro") || document.getElementById("cit-intro")) };
}`;

async function probe(
  br: Browser,
  name: string,
  html: string,
  opts: { width: number; js: boolean; openDetails?: boolean },
): Promise<Probe> {
  const f = path.join(OUT, `${name}.html`);
  await writeFile(f, html, "utf8");
  const ctx = await br.newContext({
    viewport: { width: opts.width, height: 2400 },
    javaScriptEnabled: opts.js,
  });
  const pg = await ctx.newPage();
  await pg.route(/^https?:/, (r) => void r.abort()); // no network: fonts/maps never paint
  await pg.goto("file://" + f, { waitUntil: "domcontentloaded" });
  // ⛔ NO WAITING FOR THE INTRO ANY MORE (owner's ruling, 2026-09-14). The earlier
  // version of this guard waited up to 7 s for the ADR-0115 overlay to remove
  // ITSELF — which measured the page AFTER the problem, and would have stayed
  // green if the overlay came back. The switch is supposed to make the first
  // paint correct, so the measurement is taken at the first paint.
  await pg.waitForTimeout(400);
  if (opts.openDetails) {
    // A REAL click on the summary — with JS off this is the browser's own
    // <details> behaviour, which is exactly what is being asserted.
    const s = await pg.$("[data-cit-framing] summary");
    if (s) await s.click();
    await pg.waitForTimeout(150);
  }
  const out = (await pg.evaluate(`(${PROBE})()`)) as Probe;
  // ── PIXEL, mert a hit-teszt itt VAK ──────────────────────────────────────────
  // A nyitó-animáció rétege `pointer-events:none`, tehát az `elementFromPoint`
  // ÁTNÉZ RAJTA és a sávot adja vissza — miközben a képernyőn az overlay opak
  // háttere takar mindent. Ezt mérve fogtam meg: a „sáv közepén a sáv van" zöld
  // volt egy olyan lapon, ami egy üres krém téglalapot mutatott. A festéket csak
  // a festék dönti el.
  const bar = out.bars[0];
  const vh = 2400; // a kontextus ablakmagassága; nem görgetünk, így doc == viewport
  // ⛔ Ha a sáv a LÁTHATÓ képen kívülre került (pl. a lap aljára téve), akkor nincs
  // mit fényképezni — és ez maga a bukás, nem kivétel. A `clip` ilyenkor hibára
  // futna, és az őr összeomlana ahelyett, hogy PIROSAT adna.
  const inView = bar !== undefined && bar.top >= 0 && bar.top + bar.height <= vh;
  if (bar && inView) {
    // ⚠️ NEM egyetlen pont a közepén: 1280-on a sáv függőleges közepére épp a
    // „Miért kaptam?" felirat esik, és egy 6×6-os folt a BETŰKET átlagolta —
    // [63,66,71] jött ki, és az őr öt hibátlan sablont buktatott meg. Egy TELJES
    // SZÉLESSÉGŰ, 3 px magas csík kell, és az a kérdés, hogy a képpontok TÖBBSÉGE
    // a sáv saját háttere-e. Betű mindig van rajta; egy takaró réteg viszont
    // NULLÁRA viszi az arányt.
    const shot = await pg.screenshot({
      clip: { x: bar.left, y: bar.top + bar.height / 2 - 1, width: Math.round(bar.width), height: 3 },
    });
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    let hit = 0;
    for (let i = 0; i < n; i++) {
      const o = i * info.channels;
      if (
        Math.abs(data[o]! - 0x10) <= 6 &&
        Math.abs(data[o + 1]! - 0x12) <= 6 &&
        Math.abs(data[o + 2]! - 0x16) <= 6
      )
        hit++;
    }
    out.centrePixel = [Math.round((hit / n) * 100)];
  } else out.centrePixel = null;
  await ctx.close();
  return out;
}

/** A sáv saját háttere (#101216) uralja-e a sáv középső csíkját? (%-ban mérve) */
function isBarColour(px: readonly number[] | null): boolean {
  return px !== null && px[0]! >= 50;
}

const br = await chromium.launch();

// ── ① a KÖVETETT látogató sávja, minden vizsgált sablonon ────────────────────
console.log("① a KÖVETETT látogató keretezése:");
for (const [tpl, why] of TEMPLATES_UNDER_TEST) {
  const html = await trackedPage(tpl);
  // ugyanaz a lap a sáv NÉLKÜL — a „lenyomja a lapot" állítás referenciája
  const bare = injectTrackingNotice(await injectRuntime(renderSite(recipe(tpl), DATA)), TOKEN);
  for (const w of [390, 1280]) {
    const p = await probe(br, `tracked-${tpl}-${w}`, html, { width: w, js: true });
    const b0 = await probe(br, `bare-${tpl}-${w}`, bare, { width: w, js: true });
    const tag = `${tpl}@${w}`;
    check(`${tag}: pontosan EGY keretező sáv, és az a követett (${why})`,
      p.bars.length === 1 && p.bars[0]?.kind === "tracked", p.bars.map((b) => b.kind));
    const bar = p.bars[0];
    if (!bar) continue;
    check(`${tag}: a lap TETEJÉN áll (top=${Math.round(bar.top)})`, Math.abs(bar.top) <= 1, bar);
    check(`${tag}: teljes szélességű (${Math.round(bar.width)} / ${Math.round(p.bodyWidth)})`,
      Math.abs(bar.width - p.bodyWidth) <= 1, { bar: bar.width, body: p.bodyWidth });
    check(`${tag}: SEMMI nem fest rá (elementFromPoint)`, p.occluders.length === 0, p.occluders);
    check(`${tag}: egyetlen látható réteg sem fest a sáv FÖLÉ`, p.above.length === 0, p.above);
    // A sáv LENYOMJA a lapot — nem ráúszik. A referenciát ugyanez a lap adja a sáv
    // nélkül: a különbségnek pontosan a sáv magasságának kell lennie.
    const delta =
      p.firstFlowTop !== null && b0.firstFlowTop !== null ? p.firstFlowTop - b0.firstFlowTop : null;
    check(
      `${tag}: LENYOMJA a lapot a saját magasságával (${delta} ≈ ${Math.round(bar.height)})`,
      delta !== null && Math.abs(delta - bar.height) <= 1,
      { sávval: p.firstFlowTop, sáv_nélkül: b0.firstFlowTop, magasság: Math.round(bar.height) },
    );
    check(`${tag}: kimondja, hogy MI EZ és hogy NEM élő oldal`,
      /honlap-terv/i.test(bar.text) && /nem élő oldal/i.test(bar.text), bar.text.slice(0, 90));
    check(`${tag}: a jogi részlet alapból CSUKVA (nem tolakszik)`, !p.detailVisible);
    // Csak a MOST LÁTHATÓ feliratok — a csukott rész linkjeit a ② szakasz méri,
    // kinyitva (egy nem renderelt elem kontrasztja nem jelent semmit).
    const worst = p.contrast.reduce((m, c) => Math.min(m, c.ratio), 99);
    check(`${tag}: a sáv feliratai olvashatók (legrosszabb kontraszt ${worst})`, worst >= 4.5, p.contrast);
    check(`${tag}: az ELSŐ festésnél nincs nyitó-animáció a lapon`, p.introUp === false);
    check(
      `${tag}: a sáv középső csíkjának ${p.centrePixel?.[0]}%-a tényleg a sáv színe (festve, nem hit-teszt)`,
      isBarColour(p.centrePixel),
      p.centrePixel,
    );
  }
}

// ── ② JS NÉLKÜL is nyílik, és viszi a kiutat ─────────────────────────────────
console.log("② a jogi részlet JS NÉLKÜL:");
{
  const html = await trackedPage("fullbleed");
  const closed = await probe(br, "nojs-closed", html, { width: 390, js: false });
  check("JS nélkül is látszik a sáv", closed.bars.length === 1 && closed.bars[0]?.kind === "tracked");
  check("JS nélkül is CSUKVA indul", closed.detailVisible === false);
  const open = await probe(br, "nojs-open", html, { width: 390, js: false, openDetails: true });
  check("a „Miért kaptam?” JS NÉLKÜL kinyílik", open.detailVisible === true);
  check("a kinyitott rész viszi az Adatkezelési tájékoztatót", open.detailHasLinks.privacy);
  check("a kinyitott rész viszi a LEIRATKOZÁST", open.detailHasLinks.unsub);
  const barText = open.bars[0]?.text ?? "";
  check("és kimondja a megkeresés jogalapját", /jogos érdekű megkeresés/i.test(barText), barText.slice(0, 120));
  // A KINYITOTT rész linkjei itt mérhetők először — csukva nincs mit mérni.
  const worstOpen = open.contrast.reduce((m, c) => Math.min(m, c.ratio), 99);
  check(`a kinyitott rész linkjei is olvashatók (legrosszabb kontraszt ${worstOpen})`,
    worstOpen >= 4.5, open.contrast);
  check("és a kinyitott rész a leiratkozó LINKET is méri (nem csak feliratot)",
    open.contrast.some((c) => /leiratkozás/i.test(c.text)), open.contrast.map((c) => c.text));
}

// ── ③ ÁLPOZITÍV KONTROLL: a két ág nem cserélhető fel ────────────────────────
console.log("③ ÁLPOZITÍV KONTROLL — a leiratkozott ág:");
{
  const p = await probe(br, "optedout-fullbleed-390", await optedOutPage("fullbleed"), { width: 390, js: true });
  check("pontosan EGY sáv, és az a leiratkozott", p.bars.length === 1 && p.bars[0]?.kind === "opted-out",
    p.bars.map((b) => b.kind));
  const t = p.bars[0]?.text ?? "";
  check("kimondja, hogy nem keressük többé", /nem keressük többé/i.test(t));
  check("és NEM állítja magáról, hogy rögzít", !/rögzülnek/i.test(t), t.slice(0, 90));

  const tr = await probe(br, "tracked-crosscheck", await trackedPage("fullbleed"), { width: 390, js: true });
  const tt = tr.bars[0]?.text ?? "";
  check("a KÖVETETT sáv viszont NEM állítja, hogy nem mérünk",
    !/nem mérjük|nem keressük többé/i.test(tt), tt.slice(0, 90));
}

// ── ④ A NYITÓ-ANIMÁCIÓ KI VAN KAPCSOLVA — a két érintett sablonon ────────────
console.log("④ nyitó-animáció a kiküldött mockon (tulajdonosi döntés: KI):");
for (const [tpl, mi] of INTRO_TEMPLATES) {
  for (const js of [true, false]) {
    const tag = `${tpl} JS=${js ? "BE" : "KI"}`;
    const p = await probe(br, `intro-off-${tpl}-${js}`, await trackedPage(tpl), { width: 390, js });
    // JS nélkül az elemet SEMMI nem tudja kivenni a DOM-ból — ott a kérdés az, hogy
    // FEST-E (lásd a pixel-ellenőrzést alább). A DOM-ból eltűnés a JS-es ág állítása.
    if (js) check(`${tag}: nincs intro-réteg a lapon (${mi})`, p.introUp === false);
    else check(`${tag}: az intro-réteg ott van a DOM-ban, de NEM fest (a CSS rejti)`, p.introUp === true);
    check(
      `${tag}: a sáv középső csíkjának ${p.centrePixel?.[0]}%-a a sáv színe (festve)`,
      isBarColour(p.centrePixel),
      p.centrePixel,
    );
    check(`${tag}: a sáv látszik és a lap tetején van`, p.bars.length === 1 && Math.abs(p.bars[0]!.top) <= 1);

    // ⛔ REFERENCIA: UGYANAZ a lap a kapcsoló NÉLKÜL. Enélkül a fenti három zöld
    // csak annyit bizonyítana, hogy „nincs baj" — nem azt, hogy a KAPCSOLÓ okozta.
    // (A mérőeszköz bizonyítsa a saját útját.)
    const ref = await probe(br, `intro-on-${tpl}-${js}`, await pageWithIntro(tpl), { width: 390, js });
    if (js) {
      check(
        `${tag}: KAPCSOLÓ NÉLKÜL ugyanez a lap MÁST mutat (intro=${ref.introUp}, a sáv színe: ${ref.centrePixel?.[0]}%)`,
        ref.introUp === true && !isBarColour(ref.centrePixel),
        { intro: ref.introUp, pixel: ref.centrePixel },
      );
    } else {
      // JS nélkül a kapcsoló NEM az egyetlen védelem: a runtime <noscript> hálója
      // (runtime.ts) is elrejti az introt. Ez KÜLÖN állítás, és külön is mérendő —
      // enélkül egy JS-nélküli látogató egy ÜRES KRÉM TÉGLALAPOT kapna (mérve,
      // 2026-09-14, arch-frames és wordmark-grow, 390 px).
      check(
        `${tag}: a runtime <noscript> hálója ÖNMAGÁBAN is elrejti az introt (a sáv színe: ${ref.centrePixel?.[0]}%)`,
        isBarColour(ref.centrePixel),
        ref.centrePixel,
      );
      // …és egy RÉGI artefaktum (amiben a háló még nem tartalmazta az introt) csak
      // a kapcsoló miatt marad ép — ezért van a <style> a disableIntroAnimation-ben.
      const stale = (await pageWithIntro(tpl)).replace(
        /\.cit-fintro,\.cit-intro\{display:none!important\}/g,
        "",
      );
      const staleOff = await probe(br, `intro-stale-off-${tpl}`, disableIntroAnimation(stale), { width: 390, js: false });
      const staleRaw = await probe(br, `intro-stale-raw-${tpl}`, stale, { width: 390, js: false });
      check(
        `${tag}: RÉGI artefaktumon (háló nélkül) a kapcsoló menti meg a lapot`,
        isBarColour(staleOff.centrePixel) && !isBarColour(staleRaw.centrePixel),
        { kapcsolóval: staleOff.centrePixel, nélküle: staleRaw.centrePixel },
      );
    }
  }
}

// ── PIROS ÖNTESZT ────────────────────────────────────────────────────────────
if (SELFTEST) {
  console.log("\n🔴 PIROS ÖNTESZT — a visszarontott lapoknak BUKNIA kell:");
  const good = await trackedPage("fullbleed");
  // A negyedik oszlop: KINYITVA kell-e mérni. A csukott rész linkjeinek nincs
  // kontrasztja (nincsenek renderelve) — a „kék link" visszarontás csak nyitva
  // mérhető, és ezt az első futás buktatta le (az őr zöld maradt egy valódi hibán).
  const cases: [string, string, (p: Probe) => boolean, boolean?, boolean?][] = [
    [
      "a sáv kivágva",
      good.replace(/<div data-cit-framing="tracked"[\s\S]*?<\/details><\/div><\/div>/, ""),
      (p) => p.bars.length === 0,
    ],
    [
      "a <details> sima <div>-re cserélve (JS nélkül nem nyílna)",
      good.replace("<details style=", "<div data-was-details style=").replace("</details>", "</div>"),
      (p) => p.bars.length === 1 && p.detailVisible === true, // már nyitva van → nem kapcsolható
    ],
    [
      "a sáv a lap ALJÁRA téve",
      good
        .replace(/(<div data-cit-framing="tracked"[\s\S]*?<\/details><\/div><\/div>)/, "")
        .replace(/<\/body>/i, `${/(<div data-cit-framing="tracked"[\s\S]*?<\/details><\/div><\/div>)/.exec(good)![1]}</body>`),
      (p) => p.bars.length === 1 && (Math.abs(p.bars[0]!.top) > 1 || p.above.length > 0),
    ],
    [
      // ⚠️ NEM a böngésző alap-kékjével: a sablonok `a{color:inherit}`-et állítanak,
      // ezért az inline szín ELHAGYÁSA itt nem kéket, hanem az öröklött szürkét adja
      // — az első öntesztem így egy LEHETETLEN esetet mért, és zölden „bizonyította",
      // hogy az őr piros tud lenni. A visszarontás ezért egy valóban rossz szín.
      "a linkek alig látható sötétszürkével",
      good.replace(/color:#8a8f98;text-decoration:underline/g, "color:#3a3f47;text-decoration:underline"),
      (p) => p.contrast.some((c) => c.ratio < 4.5),
      true,
    ],
    [
      "egy FIXED réteg a sáv fölé ültetve (a sablon CSS-ének mintája)",
      good.replace(
        /(<div data-cit-framing="tracked")/,
        `<div style="position:fixed;top:0;left:0;right:0;height:60px;background:#c00;z-index:99999"></div>$1`,
      ),
      (p) => p.occluders.length > 0,
    ],
  ];
  // A kikapcsolás két fele KÜLÖN-KÜLÖN is buktatható kell legyen — az elsőt épp
  // egy hamis idempotencia-őr (`includes("data-cit-no-intro")`, ami az intro SAJÁT
  // szkriptjének forrására illeszkedett) tette hatástalanná anélkül, hogy bárhol
  // pirosat adott volna.
  const introGood = await trackedPage("arch-frames");
  cases.push(
    [
      "a <html data-cit-no-intro> attribútum leszedve (a JS-es kikapcsolás)",
      introGood.replace(/<html data-cit-no-intro/i, "<html"),
      (p) => p.introUp === true || !isBarColour(p.centrePixel),
    ],
    [
      "a kapcsoló <style>-ja leszedve, RÉGI artefaktumon (a JS-nélküli kikapcsolás)",
      introGood
        .replace(/<style data-cit-no-intro>[\s\S]*?<\/style>/i, "")
        .replace(/\.cit-fintro,\.cit-intro\{display:none!important\}/g, ""),
      (p) => !isBarColour(p.centrePixel),
      false,
      false, // JS KI: enélkül a JS úgyis eltakarítaná az overlay-t
    ],
  );
  for (const [name, html, isRed, needsOpen, js] of cases) {
    // ⛔ A referencia AZ A LAP, amiből a visszarontás készült — az intro-ágak az
    // arch-frames-ből, a többi a fullbleed-ből. Egy közös `good`-hoz hasonlítva a
    // „tényleg megváltozott?" kontroll mindig zöld lenne, és semmit nem bizonyítana.
    const src = name.includes("artefaktumon") || name.includes("attribútum") ? introGood : good;
    check(`a visszarontás tényleg megváltoztatta a lapot: ${name}`, html !== src);
    const p = await probe(br, `selftest-${name.slice(0, 10).replace(/\W+/g, "-")}`, html, {
      width: 1280,
      js: js !== false,
      openDetails: needsOpen === true,
    });
    check(`PIROSRA MEGY: ${name}`, isRed(p), { bars: p.bars.length, top: p.bars[0]?.top, occ: p.occluders, above: p.above.slice(0, 3), contrast: p.contrast });
  }
}

await br.close();

if (failures) {
  console.error(`\n❌ prospect-framing-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ prospect-framing-check: a keretezés minden látogatónak kimegy, a helyén marad, és JS nélkül is nyílik.");
