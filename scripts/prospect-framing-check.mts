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
// ⚠️ A NYITÓ-ANIMÁCIÓ (ADR-0115) KÜLÖN KEZELVE: két sablonon (arch-frames,
//    wordmark-grow) egy teljes képernyős intro fedi a lapot ~4,7 mp-ig, majd MAGA
//    távolítja el magát. A guard megvárja — de a tényt KIÍRJA, mert ez alatt a
//    keretezés sem látszik, és ez tulajdonosi döntés kérdése, nem a guardé.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import {
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
  const base = await injectRuntime(renderSite(recipe(tpl), DATA));
  return injectTrackingNotice(injectTrackingBanner(base, TOKEN), TOKEN);
}
/** …and to a visitor who already opted out. */
async function optedOutPage(tpl: string): Promise<string> {
  const base = await injectRuntime(renderSite(recipe(tpl), DATA));
  return injectOptedOutNotice(injectOptedOutBanner(base), TOKEN);
}

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
  await pg.waitForTimeout(300);
  if (opts.js) {
    // The ADR-0115 intro removes ITSELF after ~4,7 s. Wait for it rather than
    // guessing a number — and never longer than it can possibly take.
    for (let i = 0; i < 70 && (await pg.$("#cit-fintro, #cit-intro")); i++) await pg.waitForTimeout(100);
  }
  if (opts.openDetails) {
    // A REAL click on the summary — with JS off this is the browser's own
    // <details> behaviour, which is exactly what is being asserted.
    const s = await pg.$("[data-cit-framing] summary");
    if (s) await s.click();
    await pg.waitForTimeout(150);
  }
  const out = (await pg.evaluate(`(${PROBE})()`)) as Probe;
  await ctx.close();
  return out;
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
    check(`${tag}: a nyitó-animáció már nem fedi a lapot`, p.introUp === false);
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

// ── PIROS ÖNTESZT ────────────────────────────────────────────────────────────
if (SELFTEST) {
  console.log("\n🔴 PIROS ÖNTESZT — a visszarontott lapoknak BUKNIA kell:");
  const good = await trackedPage("fullbleed");
  // A negyedik oszlop: KINYITVA kell-e mérni. A csukott rész linkjeinek nincs
  // kontrasztja (nincsenek renderelve) — a „kék link" visszarontás csak nyitva
  // mérhető, és ezt az első futás buktatta le (az őr zöld maradt egy valódi hibán).
  const cases: [string, string, (p: Probe) => boolean, boolean?][] = [
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
  for (const [name, html, isRed, needsOpen] of cases) {
    check(`a visszarontás tényleg megváltoztatta a lapot: ${name}`, html !== good);
    const p = await probe(br, `selftest-${name.slice(0, 10).replace(/\W+/g, "-")}`, html, {
      width: 1280,
      js: true,
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
