// AZ ÁR-MINTA: KITÖLTENDŐ MEZŐK, NULLA SZÁM — ÉS A KÉPALÁÍRÁS AZT MONDJA, AMI LÁTSZIK.
//
//   npx tsx scripts/pricing-sample-check.mts
//   npx tsx scripts/pricing-sample-check.mts --selftest   (PIROS önteszt)
//
// KONTRAKTUS: assets/design-refs/prospect-page/pricing-sample/README.md — tulajdonosi
// választás, 2026-09-14: „B — kitöltendő mezők”. Kiváltó: Elek FK-004b.
//
// A LELET, ÉS MIÉRT VOLT ROSSZ MINDKÉT FELE
//
//   A sor `<td>Főszezon</td><td></td><td>—</td>` volt: ÜRES „Mikor” cella és egy
//   gondolatjel — a lead egy késznek látszó, de üres táblázatot kapott. A képaláírás
//   közben „ezek nem valós árak”-ról beszélt, miközben a képernyőn EGYETLEN ár sem
//   volt: mentegetőzés valamiért, ami ott sincs. Egyik fél sem azt mondta, ami van.
//
// AMIT EZ AZ ŐR MÉR (a RENDERELT lapon, mert a jelölés és az elrendezés a kérdés)
//
//   ① NULLA SZÁM A TÁBLÁZATBAN. Nem „nincs Ft-jel”, hanem nincs SZÁMJEGY egyetlen
//      cellában sem — ez a §B.17 legerősebb alakja: nincs mit félreolvasni. (A szoba
//      neve — „1. szoba” — a táblán KÍVÜL van, és nem ár; a mérés a cellákra néz.)
//   ② MINDEN KITÖLTENDŐ CELLA KITÖLTENDŐNEK LÁTSZIK: vagy a szaggatott helyőrző,
//      vagy az „Ön írja be” — üres cella nem maradhat.
//   ③ A KÉPALÁÍRÁS NEM BESZÉL ÁRAKRÓL, AMIK NINCSENEK. Ha a tábla számtalan, akkor
//      a felirat sem állíthatja, hogy a látott számok nem valósak.
//   ④ 390 PX-EN MINDEN CELLA MEG VAN NEVEZVE. A fejléc-sor telefonon el van rejtve
//      (`thead{clip}`), tehát a szaggatott vonal és az „Ön írja be” magában semmit
//      nem jelent — mérve: „Főszezon / ▭▭▭▭ / Ön írja be”, és nem derült ki, melyik
//      a dátum és melyik az ár. A CSS kommentje már ígérte, hogy „each labelled”;
//      az ígéretnek őr kell.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

const SELFTEST = process.argv.includes("--selftest");

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
  intro: "Szigligeten, a várdomb és a strand között, tágas kerttel.",
  highlights: ["Teraszos kert", "Strand a közelben"],
  geo: { lat: 46.8, lon: 17.43 },
  photos: [1, 2, 3].map((i) => ({ url: PIX, alt: `kép ${i}`, provenance: "portal" as const })),
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Kossuth utca 36" },
};

/** Két elrendezés-család: középre igazított és balra igazított. */
const TEMPLATES_UNDER_TEST = ["fullbleed", "editorial"] as const;

const recipe = (templateId: string): Recipe =>
  ({
    skin: TEMPLATES[templateId]!.skins[0]!,
    archetype: "stacked",
    template: templateId,
    sections: [],
  }) as unknown as Recipe;

const OUT = path.resolve(import.meta.dirname, "../assets/Temp/_pricingsample");
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

type Probe = {
  found: boolean;
  /** Minden cella a minta-táblákból: szöveg + van-e helyőrzője + oszlop-címkéje. */
  cells: { text: string; hasFill: boolean; col: string | null; index: number }[];
  /** A „Minta — …” képaláírás(ok) szövege. */
  captions: string[];
  /** 390 px-en látszik-e a fejléc-sor? (ott a per-cella címke a hordozó) */
  headVisible: boolean;
};

const PROBE = `() => {
  const vis = (el) => el.checkVisibility
    ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })
    : true;
  const sec = document.querySelector('[data-cit-module="pricing"]');
  if (!sec) return { found: false, cells: [], captions: [], headVisible: false };
  const cells = [];
  for (const tr of sec.querySelectorAll("tbody tr")) {
    [...tr.children].forEach((td, i) => {
      cells.push({
        text: (td.textContent || "").replace(/\\s+/g, " ").trim(),
        hasFill: !!td.querySelector(".cit-price__fill"),
        col: td.getAttribute("data-cit-col"),
        index: i,
      });
    });
  }
  const captions = [...sec.querySelectorAll(".cit-modsec__note")]
    .filter(vis)
    .map((n) => (n.textContent || "").replace(/\\s+/g, " ").trim());
  // ⚠️ NEM checkVisibility(): a fejléc-sort a CSS a képernyőolvasós technikával rejti
  // el (position:absolute; width:1px; height:1px; clip), ami NEM display:none és NEM
  // visibility:hidden — a checkVisibility() ezért IGAZAT mond rá, és az őr azt
  // állította, hogy a fejléc telefonon látszik. A kérdés a MÉRETE: egy 1×1 px-es,
  // levágott sorból a látogató nem olvas oszlopnevet.
  // …és a THEAD dobozát kell mérni, nem a benne lévő TH-ét: a levágás a SZÜLŐN van
  // (overflow:hidden + clip), a gyerek doboza ettől még a természetes méretét adja.
  const head = sec.querySelector("thead");
  const r = head ? head.getBoundingClientRect() : null;
  return { found: true, cells, captions,
           headVisible: !!r && r.width > 2 && r.height > 2 && vis(head) };
}`;

async function probe(br: Browser, name: string, html: string, width: number): Promise<Probe> {
  const f = path.join(OUT, `${name}.html`);
  await writeFile(f, html, "utf8");
  const ctx = await br.newContext({ viewport: { width, height: 2000 } });
  const pg = await ctx.newPage();
  await pg.route(/^https?:/, (r) => void r.abort()); // no network: fonts/maps never paint
  await pg.goto("file://" + f, { waitUntil: "domcontentloaded" });
  await pg.waitForTimeout(300);
  const out = (await pg.evaluate(`(${PROBE})()`)) as Probe;
  await ctx.close();
  return out;
}

/** A mock (phase="mock") ár-minta szekciója — ez megy ki a leadnek. */
function mockPage(tpl: string): string {
  return renderSite(recipe(tpl), DATA);
}

const br = await chromium.launch();

for (const tpl of TEMPLATES_UNDER_TEST) {
  const html = mockPage(tpl);
  for (const w of [390, 1280]) {
    const p = await probe(br, `${tpl}-${w}`, html, w);
    const tag = `${tpl}@${w}`;
    check(`${tag}: renderelődik az ár-minta`, p.found && p.cells.length > 0, p.cells.length);
    if (!p.found) continue;

    // ── ① nulla szám ────────────────────────────────────────────────────────
    const withDigits = p.cells.filter((c) => /\d/.test(c.text));
    check(
      `${tag}: EGYETLEN számjegy sincs a tábla ${p.cells.length} cellájában`,
      withDigits.length === 0,
      withDigits.map((c) => c.text),
    );

    // ── ② minden kitöltendő cella kitöltendőnek látszik ─────────────────────
    const blank = p.cells.filter((c) => c.text === "" && !c.hasFill);
    check(`${tag}: nincs néma üres cella (mind jelöli, hogy kitöltendő)`, blank.length === 0, blank);
    const fills = p.cells.filter((c) => c.hasFill).length;
    const yours = p.cells.filter((c) => /Ön írja be/i.test(c.text)).length;
    check(`${tag}: minden soron van helyőrző ÉS „Ön írja be” (${fills} / ${yours})`,
      fills > 0 && fills === yours, { helyőrző: fills, "ön írja be": yours });

    // ── ③ a képaláírás nem beszél nem létező árakról ────────────────────────
    check(`${tag}: van látható „Minta” képaláírás`, p.captions.some((c) => /^Minta/i.test(c)), p.captions);
    const liar = p.captions.filter((c) => /nem valós ár|ezek nem valós/i.test(c));
    check(
      `${tag}: a képaláírás NEM mentegetőzik számokért, amik nincsenek a képen`,
      liar.length === 0,
      liar,
    );

    // ── ④ telefonon minden cella meg van nevezve ────────────────────────────
    if (w === 390) {
      check(`${tag}: a fejléc-sor telefonon REJTETT (ezért kell a cella-címke)`, p.headVisible === false);
      const unlabelled = p.cells.filter((c) => c.index > 0 && !c.col);
      check(
        `${tag}: a fejléc nélkül is MINDEN nem-első cella megnevezi az oszlopát`,
        unlabelled.length === 0,
        unlabelled.map((c) => `${c.index}:${c.text || "(helyőrző)"}`),
      );
    } else {
      check(`${tag}: asztalin a fejléc-sor LÁTSZIK`, p.headVisible === true);
    }
  }
}

// ── PIROS ÖNTESZT ────────────────────────────────────────────────────────────
if (SELFTEST) {
  console.log("\n🔴 PIROS ÖNTESZT — a visszarontott lapoknak BUKNIA kell:");
  const good = mockPage("fullbleed");
  const cases: [string, string, number, (p: Probe) => boolean][] = [
    [
      "a RÉGI váz visszaírva (üres „Mikor” + gondolatjel)",
      good
        .replace(/<td data-cit-col="[^"]*"><span class="cit-price__fill"[^>]*><\/span><\/td>/g, "<td></td>")
        .replace(/<td class="cit-price__you" data-cit-col="[^"]*">[^<]*<\/td>/g, "<td>—</td>"),
      1280,
      (p) => p.cells.some((c) => c.text === "" && !c.hasFill),
    ],
    [
      "kitalált ár írva a tábla egyik cellájába",
      good.replace(/(<td class="cit-price__you" data-cit-col="[^"]*">)[^<]*(<\/td>)/, "$124 000 Ft$2"),
      1280,
      (p) => p.cells.some((c) => /\d/.test(c.text)),
    ],
    [
      "a régi, mentegetőző képaláírás visszaírva",
      good.replace(
        /Minta — az időszakokat és az árakat Ön tölti ki[^<]*/,
        "Minta — ide az Ön szezonjai és árai kerülnek (ezek nem valós árak).",
      ),
      1280,
      (p) => p.captions.some((c) => /nem valós ár/i.test(c)),
    ],
    [
      "a telefonos cella-címkék leszedve",
      good.replace(/ data-cit-col="[^"]*"/g, ""),
      390,
      (p) => p.cells.some((c) => c.index > 0 && !c.col),
    ],
  ];
  for (const [name, html, w, isRed] of cases) {
    check(`a visszarontás tényleg megváltoztatta a lapot: ${name}`, html !== good);
    const p = await probe(br, `selftest-${name.slice(0, 12).replace(/\W+/g, "-")}`, html, w);
    check(`PIROSRA MEGY: ${name}`, isRed(p), {
      cellák: p.cells.slice(0, 3),
      feliratok: p.captions,
    });
  }
}

await br.close();

if (failures) {
  console.error(`\n❌ pricing-sample-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ pricing-sample-check: kitöltendő mezők, nulla szám, és a felirat azt mondja, ami látszik.");
