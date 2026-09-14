// A KIKÜLDÖTT MOCK NEM ÁLLÍTHATJA MAGÁRÓL, HOGY RÖGZÍT — ÉS A JELÖLÉSE LÁTSZÓDJON.
//
//   npx tsx scripts/mock-form-honesty-check.mts
//   npx tsx scripts/mock-form-honesty-check.mts --selftest   (PIROS önteszt)
//
// Elek FK-004b (2026-09-13) két leletét őrzi, mindkettő a lead ELSŐ képernyőjéről:
//
//  ① A VÉLEMÉNY-ŰRLAP JELÖLETLEN VOLT. A hírlevél, az árak, a szolgáltatások és a
//     szobák mind „Minta” pirulát viseltek — az az EGY szekció nem, amelyik nevet,
//     e-mail címet és egy hozzájárulás-pipát kér. A gomb alatt pedig az állt, hogy
//     „A véleménye azután jelenik meg, hogy a szállásadó jóváhagyta”: a lap ígéretet
//     tett egy űrlapról, ami sehova nem posztol. A §B.17 tényhűség-kontraktus ránk is
//     áll: a lap ne állítsa magáról, hogy rögzít, ha nem.
//     ⚠️ A cáfolat CSAK BEKÜLDÉS UTÁN érkezett (`data-cit-demo`) — azaz azután, hogy
//     a látogató már beírta a nevét és az e-mail címét. Ezért az őr NEM elégszik meg
//     azzal, hogy a mondat valahol ott van: a beküldő gomb ALJA FÖLÖTT kell lennie,
//     mert a döntés ott születik.
//
//  ② A BEVEZETŐ BALRA TAPADT. A `reviews-pending` jegyzet inline `style="margin:0"`-t
//     kapott; a `margin` RÖVIDÍTÉS, tehát a bal/jobb `auto`-t is nullázta, amit a
//     `centredModsecCss` (templateKit.ts) állít be — egy stíluslap pedig inline
//     deklarációt nem ver. A 640 px-es blokk középpontja így x≈400 lett a szekció
//     x≈640-e helyett (fullbleed, 1280 px — pontosan a lelet x≈398-a).
//
// HOGYAN MÉR (és miért így)
//
//  · A RENDERELT LAPOT méri, nem a forrást. A felirat egy része adat/feltétel-ág; a
//    forrás-grep a `phase`-től függő ágat nem tudja eldönteni.
//  · NEM a saját alanyát hívja (a rendezés-őr tanulsága): a „nem rögzít”-állítást egy
//    FÜGGETLEN, itt leírt jel-lista dönti el, nem a termékből importált konstans.
//  · ÁLPOZITÍV KONTROLL: az ÉLES (phase=live) lapon UGYANEZ a szekció NEM állíthatja,
//    hogy előnézet — különben egy lusta javítás („írjuk ki mindig”) átmenne, és a
//    vevő éles oldalán hazudna.
//  · A geometriát görgetés NÉLKÜL, magas ablakban veszi fel (az autoscroll egyszer már
//    zöldre mért egy elszállt sávot), és a `Minta` pirulánál a LÁTHATÓSÁGOT is nézi.

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

/** A 2×2 grey PNG — a photo that always paints, with no network. */
const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";

/** A lead as it really arrives: name, place, a few photos, no owner-set modules. */
const DATA: SiteData = {
  name: "ELEK-PRÓBA Vendégház",
  tagline: "Szigliget, Balaton",
  intro: "Szigligeten, a várdomb és a strand között, tágas kerttel és nyolc fő számára kényelmes házzal.",
  highlights: ["Teraszos kert, grillsarok", "Strand néhány perc sétára"],
  geo: { lat: 46.8, lon: 17.43 },
  photos: [1, 2, 3, 4, 5].map((i) => ({ url: PIX, alt: `kép ${i}`, provenance: "portal" as const })),
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Kossuth utca 36, Szigliget, 8264" },
};

/** The SAME property once it is a paying tenant with the review module configured —
 *  the álpozitív control: here the page MUST NOT call itself a preview. */
const LIVE_DATA: SiteData = { ...DATA, reviewForm: { units: [] } };

/**
 * Does this sentence tell the visitor, BEFORE they submit, that nothing is recorded?
 * Written HERE on purpose (independent of the product's wording constant) — a guard
 * that imports its subject's string can only ever agree with it.
 */
const SAYS_NO_RECORD = /\b(nem rögzít|nem küld|előnézet|minta)\b/i;
/** …and does it promise an outcome that only a LIVE form can deliver? */
const PROMISES_OUTCOME = /(jelenik meg|elküldtük|értesítjük|Önhöz érkezik|jóváhagyásra vár)/i;
/** Informal address anywhere in the customer-visible text (word-bounded: "Válasszon"
 *  must not match "válassz"). */
const INFORMAL = /(?<![\p{L}])(rended|rendedet|nézz|kattints|írj|válassz|próbáld|gyere|foglalj|nálad)(?![\p{L}])/iu;

const CENTRED_TPL = "fullbleed"; // the template the measured artifacts actually used
const PLAIN_TPL = "editorial"; // left-aligned: the centring rule must not reach it

const recipe = (templateId: string): Recipe =>
  ({
    skin: TEMPLATES[templateId]!.skins[0]!,
    archetype: "stacked",
    template: templateId,
    sections: [],
  }) as unknown as Recipe;

const OUT = path.resolve(import.meta.dirname, "../assets/Temp/_mockhonesty");
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

type Probe = {
  reviewForm: {
    present: boolean;
    mintaPill: boolean;
    mintaVisible: boolean;
    /** Every note text inside the section, in DOCUMENT coordinates. */
    notes: { text: string; top: number; bottom: number }[];
    submit: { top: number; bottom: number } | null;
    pill: { top: number; bottom: number } | null;
    firstField: { top: number; bottom: number } | null;
  };
  pending: { noteCentre: number | null; sectionCentre: number | null; noteWidth: number } | null;
  bodyText: string;
};

const PROBE = `() => {
  const sec = document.querySelector('[data-cit-module="review-form"]');
  const vis = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0" &&
      r.width > 2 && r.height > 2;
  };
  // DOCUMENT coordinates on purpose: nothing is scrolled, so no auto-scroll can move
  // a rectangle out from under the measurement, and "can these two be on screen at
  // once" stays a pure arithmetic question about the page, not about this browser.
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
  };
  const rf = { present: !!sec, mintaPill: false, mintaVisible: false, notes: [],
               submit: null, pill: null, firstField: null };
  if (sec) {
    const pill = sec.querySelector(".cit-modsec__minta");
    rf.mintaPill = !!pill;
    rf.mintaVisible = !!pill && vis(pill);
    if (pill && vis(pill)) rf.pill = box(pill);
    for (const n of sec.querySelectorAll("p, .cit-modsec__note")) {
      if (!vis(n)) continue;
      rf.notes.push({ text: (n.textContent || "").trim(), ...box(n) });
    }
    const btn = sec.querySelector('button[type="submit"], .cit-btn');
    if (btn) rf.submit = box(btn);
    const field = sec.querySelector("input, textarea, select");
    if (field) rf.firstField = box(field);
  }
  const pend = document.querySelector('[data-cit-module="reviews-pending"]');
  let pending = null;
  if (pend) {
    const note = pend.querySelector(".cit-modsec__note");
    const inner = pend.querySelector(".cit-modsec__in");
    if (note && inner) {
      const nr = note.getBoundingClientRect(), ir = inner.getBoundingClientRect();
      pending = { noteCentre: (nr.left + nr.right) / 2, sectionCentre: (ir.left + ir.right) / 2,
                  noteWidth: nr.width };
    }
  }
  return { reviewForm: rf, pending, bodyText: document.body.innerText };
}`;

async function probe(br: Browser, name: string, html: string): Promise<Probe> {
  const f = path.join(OUT, `${name}.html`);
  await writeFile(f, html, "utf8");
  // A TALL window on purpose: everything is laid out at once, so no scroll is needed
  // and no auto-scroll can move a rectangle out from under the measurement.
  const ctx = await br.newContext({ viewport: { width: 1280, height: 20000 } });
  const pg = await ctx.newPage();
  await pg.route(/^https?:/, (r) => void r.abort()); // no network: fonts/maps never paint
  await pg.goto("file://" + f, { waitUntil: "domcontentloaded" });
  await pg.waitForTimeout(250);
  const out = (await pg.evaluate(`(${PROBE})()`)) as Probe;
  await ctx.close();
  return out;
}

const br = await chromium.launch();

// The four pages under measurement. `renderSite` defaults to phase "mock", which is
// also what the prospect artifact is built with (generateEngine.ts).
const mockCentred = renderSite(recipe(CENTRED_TPL), DATA);
const mockPlain = renderSite(recipe(PLAIN_TPL), DATA);
const liveCentred = renderSite(recipe(CENTRED_TPL), LIVE_DATA, { phase: "live" });

// ── ① a kiküldött mock: jelölt űrlap, kattintás ELŐTT kimondott igazság ──────────
console.log("① a MOCK vélemény-űrlapja (fullbleed):");
const m = await probe(br, "mock-centred", mockCentred);
check("a szekció renderelődik", m.reviewForm.present);
check("„Minta” pirula van rajta", m.reviewForm.mintaPill);
check("és látszik is", m.reviewForm.mintaVisible);
// „A LÁTOGATÓ SZEME ELŐTT VAN-E?" — nem az a kérdés, hogy a mondat OTT VAN valahol
// a szekcióban (a `data-cit-demo` is ott volt, csak beküldés után szólalt meg), hanem
// hogy EGYÜTT LÁTSZIK-e azzal, amiről dönt. Egy telefon-képernyőnyi magasság a mérce:
// ha a kettő együttes befoglalója ennél magasabb, nem lehetnek egyszerre a képen.
const PHONE_H = 844; // iPhone 14 logikai magasság — a tulaj telefonon dolgozik
const together = (
  a: { top: number; bottom: number } | null,
  b: { top: number; bottom: number } | null,
): boolean => a !== null && b !== null && Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top) <= PHONE_H;

const noRecordNotes = m.reviewForm.notes.filter((n) => SAYS_NO_RECORD.test(n.text));
check(
  "a „nem rögzít” mondat EGY KÉPERNYŐN van a beküldő gombbal (a döntés helyén)",
  noRecordNotes.some((n) => together(n, m.reviewForm.submit)),
  { notes: m.reviewForm.notes.map((n) => `${Math.round(n.top)}→${Math.round(n.bottom)} ${n.text.slice(0, 50)}`), submit: m.reviewForm.submit },
);
check(
  "a „Minta” pirula EGY KÉPERNYŐN van az első kitöltendő mezővel (gépelés ELŐTT)",
  together(m.reviewForm.pill, m.reviewForm.firstField),
  { pill: m.reviewForm.pill, field: m.reviewForm.firstField },
);
const bareOutcome = m.reviewForm.notes.filter(
  (n) => PROMISES_OUTCOME.test(n.text) && !SAYS_NO_RECORD.test(n.text),
);
check(
  "egyetlen mondat sem ígér közzétételt cáfolat nélkül",
  bareOutcome.length === 0,
  bareOutcome.map((n) => n.text.slice(0, 70)),
);

// ── ② ÁLPOZITÍV KONTROLL: az éles lap NEM nevezheti magát előnézetnek ────────────
console.log("② ÁLPOZITÍV KONTROLL — ugyanez a szekció ÉLESEN (phase=live):");
const l = await probe(br, "live-centred", liveCentred);
check("a szekció ott is renderelődik", l.reviewForm.present);
check("de NINCS rajta „Minta” pirula", !l.reviewForm.mintaPill);
const liveDenies = l.reviewForm.notes.filter((n) => SAYS_NO_RECORD.test(n.text));
check(
  "és nem állítja magáról, hogy nem rögzít",
  liveDenies.length === 0,
  liveDenies.map((n) => n.text.slice(0, 70)),
);

// ── ③ a bevezető a szekció közepén áll (középre igazított sablonon) ──────────────
console.log("③ a vélemény-szekció bevezetője (középre igazított sablon):");
check("van mérhető bevezető", m.pending?.noteCentre != null);
if (m.pending?.noteCentre != null && m.pending.sectionCentre != null) {
  const off = Math.abs(m.pending.noteCentre - m.pending.sectionCentre);
  check(`a középpontja a szekció közepén van (eltérés ${Math.round(off)} px ≤ 6)`, off <= 6, {
    note: Math.round(m.pending.noteCentre),
    section: Math.round(m.pending.sectionCentre),
    width: Math.round(m.pending.noteWidth),
  });
}

// ── ④ a lap végig magáz ─────────────────────────────────────────────────────────
console.log("④ megszólítás a renderelt lapon:");
for (const [label, html] of [
  ["fullbleed (mock)", mockCentred],
  ["editorial (mock)", mockPlain],
] as const) {
  const p = await probe(br, `addr-${label.split(" ")[0]}`, html);
  const hit = INFORMAL.exec(p.bodyText);
  check(`${label}: nincs tegező alak`, hit === null, hit ? p.bodyText.slice(Math.max(0, hit.index - 60), hit.index + 60) : undefined);
}

// ── PIROS ÖNTESZT: minden ág menjen pirosra a saját hibájától ───────────────────
if (SELFTEST) {
  console.log("\n🔴 PIROS ÖNTESZT — a visszarontott lapoknak BUKNIA kell:");
  const before = failures;
  const cases: [string, string, (p: Probe) => boolean][] = [
    [
      "a „Minta” pirula kivágva",
      // GLOBAL on purpose: the first pill on the page belongs to another sample
      // section (pricing), so a single replace would have left the review form's
      // own pill in place and "proved" a mutation that never reached the subject.
      mockCentred.replace(/<span class="cit-modsec__minta">[^<]*<\/span>/g, ""),
      (p) => !p.reviewForm.mintaPill,
    ],
    [
      "a „nem rögzít” mondat visszaírva közzététel-ígéretre",
      mockCentred.replace(
        /Ez egy előnézet: a beküldés most nem rögzít és nem küld el semmit\./,
        "A véleménye azután jelenik meg, hogy a szállásadó jóváhagyta.",
      ),
      (p) =>
        p.reviewForm.notes.some((n) => PROMISES_OUTCOME.test(n.text) && !SAYS_NO_RECORD.test(n.text)),
    ],
    [
      "a bevezető inline margin:0-ja visszatéve",
      mockCentred.replace('class="cit-modsec__note" style="margin-top:0"', 'class="cit-modsec__note" style="margin:0"'),
      (p) =>
        p.pending != null &&
        p.pending.noteCentre != null &&
        p.pending.sectionCentre != null &&
        Math.abs(p.pending.noteCentre - p.pending.sectionCentre) > 6,
    ],
    [
      "tegező alak visszaírva",
      mockCentred.replace("ide az Ön saját érkezési és távozási rendje kerül", "a saját érkezési és távozási rended kerül ide"),
      (p) => INFORMAL.test(p.bodyText),
    ],
  ];
  for (const [name, html, isRed] of cases) {
    const p = await probe(br, `selftest-${name.slice(0, 12).replace(/\W+/g, "-")}`, html);
    check(`PIROSRA MEGY: ${name}`, isRed(p));
  }
  // A mutációnak TÉNYLEG történnie kellett — egy elgépelt replace() néma no-op, és
  // akkor az „önteszt” a HELYES lapot dicsérné (fixture-must-prove-its-own-path).
  for (const [name, html] of cases.map(([n, h]) => [n, h] as const)) {
    check(`a visszarontás tényleg megváltoztatta a lapot: ${name}`, html !== mockCentred);
  }
  if (failures === before) console.log("  (mind a négy ág pirosra tudott menni)");
}

await br.close();

if (failures) {
  console.error(`\n❌ mock-form-honesty-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ mock-form-honesty-check: a kiküldött mock jelölt, és nem ígér rögzítést.");
