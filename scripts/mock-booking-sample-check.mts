// MOCK-BOOKING-SAMPLE GUARD — a kiküldött mock foglalás-widgetje a FOGLALÁS-utat játssza
// MINTA-ÁRRAL, és a küldő gomb + a próba-nyugta EGY folyamatról beszél.
//
//   npx tsx scripts/mock-booking-sample-check.mts
//   npx tsx scripts/mock-booking-sample-check.mts --selftest   (PIROS önteszt)
//
// Tulaj (2026-09-26): „legyen minta ár". Mérve előtte (szülő session): a mock widgetje
// minta-FOGLALTSÁGOT adott, de árlistát nem, ezért a runtime az árajánlat-módba váltott
// (setAskMode, ADR-0215 „C"): a gomb „Árajánlatot kérek", a próba-nyugta viszont „Így néz
// ki, amikor a vendége foglal… Ön igazolja vissza" — EGY folyamatban két folyamat. A lead a
// próbánál nem azt látta, amit a modul árul (foglalás), és a lap két dolgot állított.
//
// AMIT ŐRIZ
//  ① A mockon a kiválasztott időszakra ÁR-DOBOZ áll (összeggel), amely félreérthetetlenül
//     MINTÁNAK nevezi magát (§B.17 / ADR-0061: a minta-ár nem állítás a szállásról) — a
//     címben, az összeg soránál ÉS a telefonos 2. lépés összegző sávjában is.
//  ② A gomb foglalási kérést küld (nem árajánlatot kér), a nyugta a foglalásról szól és
//     kimondja, hogy próba volt.
//  ③ ⭐ INVARIÁNS: a gomb és a nyugta UGYANARRÓL a folyamatról beszél — ha bármely úton az
//     árajánlat-mód áll elő, a nyugta is árajánlatról szól. Ültetett eltérés → piros.
//  ④ ÁLPOZITÍV KONTROLL: az ÉLES (phase=live) lapon az ár NEM minta — az API árlistájából
//     jön, és a lap sehol nem nevezi mintának.
//
// HOGYAN MÉR
//  · A RENDERELT lapot, a VALÓDI runtime-mal (injectRuntime), valódi böngészőben, a naptár
//    napjaira KATTINTVA (nem az inputba írva) — ahogy a lead is teszi. Telefonon (390, a
//    két-lépés kontraktus szerint a „Tovább"-on át) és asztalon (1280) is.
//  · Az állításokat ITT leírt, a termék konstansaitól FÜGGETLEN felismerők döntik el (egy
//    őr, amely a saját alanyának szövegét importálja, csak egyetérteni tud vele).
//  · A lap egy ál-originről (https://cit-mock.local/) szolgál, hogy az éles kontroll relatív
//    `/api/foglaltsag` hívása útvonalazható legyen — a file:// és az about:blank nem tudja.
//  · Az önteszt a beszőtt runtime FORRÁSÁT rontja el (három külön szabotázs), és mindegyiknél
//    igazolja, hogy a csere TÉNYLEG megtörtént — különben a piros önteszt zölden „bizonyítana".

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { config } from "../src/config.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";

const SELFTEST = process.argv.includes("--selftest");

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ── független felismerők (szándékosan NEM a runtime konstansai) ────────────────────
/** Nevezi-e magát mintának a szöveg? */
const SAMPLE = /minta/i;
/** Van-e benne pénzösszeg? (ezres csoport szóközzel/NBSP-vel, Ft/€) */
const MONEY = /\d[\d   ]*\s?(Ft|€|EUR|HUF)/; // no \b: textContent glues „Ft” to the next button's label
/** Árajánlatról beszél-e? */
const ASK = /árajánlat/i;
/** A gomb foglalási kérést küld? */
const BOOK_BTN = /foglalási kérés/i;
/** A nyugta a foglalásról szól? */
const BOOK_RCPT = /amikor a vendége foglal/i;
/** A nyugta kimondja, hogy próba volt? */
const TRIED = /kipróbálás volt/i;
/** Az ár-doboz árajánlat-módban áll? */
const QUOTE_ASK = /egyedi árat/i;

const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";

/** A lead as it arrives: name, place, photos, TWO rooms (→ two sample units), no config. */
const DATA: SiteData = {
  name: "ELEK-PRÓBA Vendégház",
  tagline: "Szigliget, Balaton",
  intro: "Szigligeten, a várdomb és a strand között, tágas kerttel és nyolc fő számára kényelmes házzal.",
  highlights: ["Teraszos kert, grillsarok", "Strand néhány perc sétára"],
  geo: { lat: 46.8, lon: 17.43 },
  photos: [1, 2, 3, 4].map((i) => ({ url: PIX, alt: `kép ${i}`, provenance: "portal" as const })),
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Kossuth utca 36, Szigliget, 8264" },
  rooms: [
    { name: "Kertre néző szoba", capacity: "2 fő · 22 m²", note: "Franciaágyas.", price: "" },
    { name: "Tetőtéri apartman", capacity: "4 fő · 40 m²", note: "Konyhával.", price: "" },
  ],
};

/** The SAME property as a paying tenant with the booking module configured — the
 *  álpozitív control: here the price comes from the API and is NOT a sample. */
const LIVE_DATA: SiteData = {
  ...DATA,
  booking: {
    units: [{ id: "u1", name: "Kertre néző szoba", capacity: 2 }],
    minNights: 1,
    maxNights: 30,
    horizonMonths: 12,
    leadTimeDays: 0,
  } as SiteData["booking"],
};

const TPL = "fullbleed";
const recipe = (): Recipe =>
  ({ skin: TEMPLATES[TPL]!.skins[0]!, archetype: "stacked", template: TPL, sections: [] }) as unknown as Recipe;

type Probe = {
  noForm?: boolean;
  noDays?: string[];
  from: string;
  to: string;
  quote: string;
  submitText: string;
  submitMode: string | null;
  note: string;
  sum: string | null;
  receipt: { title: string; note: string; text: string; mode: string | null } | null;
};

// A guest's hands: two taps in the calendar (tomorrow → +3 nights, clear of the sample
// blocked days which start at +6), then — on the phone — "Tovább", then send.
// An IIFE string (not a function + arg): Playwright evaluates a STRING as an expression and
// hands back its value — a string that merely evaluates to a function is returned uncalled.
const PROBE = (submit: boolean): string => `(async () => { const opts = { submit: ${submit} };
  document.documentElement.style.scrollBehavior = 'auto';
  const form = document.querySelector('form.cit-book--request'); if (!form) return { noForm: true };
  const shift = (iso, d) => { const x = new Date(iso + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  const t = new Date(); const tISO = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())).toISOString().slice(0, 10);
  const a = shift(tISO, 1), b = shift(tISO, 4);
  const day = (iso) => form.querySelector('[data-day="' + iso + '"]');
  if (!day(a) || !day(b)) return { noDays: [a, b] };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  day(a).click(); await wait(60); day(b).click(); await wait(200);
  const txt = (el) => (el ? (el.textContent || '') : '').replace(/\\s+/g, ' ').trim();
  const submit = form.querySelector('.cit-book__submit');
  const out = { from: form.from.value, to: form.to.value, quote: txt(form.querySelector('[data-quote]')),
    submitText: txt(submit), submitMode: submit && submit.getAttribute('data-cit-mode'),
    note: txt(form.querySelector('.cit-book__note')), sum: null, receipt: null };
  const go = form.querySelector('.cit-book__go');
  if (go && getComputedStyle(go).display !== 'none') { go.click(); await wait(120); out.sum = txt(form.querySelector('.cit-book__sum')); }
  if (opts.submit) {
    form.requestSubmit(); await wait(350);
    const done = document.querySelector('.cit-book--done');
    out.receipt = done ? { title: txt(done.querySelector('.cit-book__title')), note: txt(done.querySelector('.cit-book__note')), text: txt(done), mode: done.getAttribute('data-cit-done') } : null;
  }
  return out;
})()`;

const ORIGIN = "https://cit-mock.local/";

async function probe(br: Browser, html: string, opts: { width: number; submit: boolean; live?: boolean }): Promise<Probe> {
  const ctx: BrowserContext = await br.newContext({
    viewport: { width: opts.width, height: opts.width < 600 ? 844 : 900 },
    isMobile: opts.width < 600,
    hasTouch: opts.width < 600,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url === ORIGIN) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    if (/\/api\/foglaltsag\//.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ blocked: [], pricing: { currency: "HUF", unit: "per_night", rows: [{ base: true, amount: 30000 }] } }),
      });
    }
    return route.abort(); // no network at all: fonts, maps, a stray POST
  });
  await page.goto(ORIGIN, { waitUntil: "load" });
  await page.waitForSelector("form.cit-book--request", { timeout: 5000 });
  await page.waitForTimeout(opts.live ? 400 : 150); // the live control fetches its price list
  const out = (await page.evaluate(PROBE(opts.submit))) as Probe;
  await ctx.close();
  return out;
}

type Verdict = { name: string; ok: boolean; detail?: unknown };
/** The claims about the MOCK page, computed without side effects so the selftest can
 *  read them too. `phone` adds the two-step summary bar claim. */
function judgeMock(p: Probe, phone: boolean): Verdict[] {
  const v: Verdict[] = [];
  v.push({ name: "van widget és két érintés tartományt adott", ok: !p.noForm && !p.noDays && !!p.from && !!p.to, detail: p.noDays ?? { from: p.from, to: p.to } });
  v.push({ name: "① ár-doboz ÖSSZEGGEL", ok: MONEY.test(p.quote ?? ""), detail: p.quote });
  v.push({ name: "① az ár-doboz MINTÁNAK nevezi magát", ok: SAMPLE.test(p.quote ?? ""), detail: p.quote });
  v.push({ name: "① nem árajánlat-mód („egyedi árat ad”)", ok: !QUOTE_ASK.test(p.quote ?? ""), detail: p.quote });
  v.push({ name: "② a gomb FOGLALÁSI kérést küld, nem árajánlatot kér", ok: BOOK_BTN.test(p.submitText ?? "") && !ASK.test(p.submitText ?? ""), detail: p.submitText });
  if (phone) v.push({ name: "① telefonon a 2. lépés összegző sávja: összeg + minta", ok: !!p.sum && MONEY.test(p.sum) && SAMPLE.test(p.sum), detail: p.sum });
  const r = p.receipt;
  v.push({ name: "② nyugta a FOGLALÁSRÓL, és kimondja, hogy próba volt", ok: !!r && BOOK_RCPT.test(r.title) && TRIED.test(r.note) && !ASK.test(r.title + " " + r.note), detail: r && { title: r.title, note: r.note } });
  v.push({ name: "② a nyugtán a minta-összeg is ott van", ok: !!r && SAMPLE.test(r.text) && MONEY.test(r.text), detail: r?.text.slice(0, 160) });
  v.push({
    name: "③ ⭐ INVARIÁNS: a gomb és a nyugta EGY folyamatról beszél",
    ok: !!r && ASK.test(p.submitText ?? "") === ASK.test(r.title),
    detail: { gomb: p.submitText, nyugta: r?.title },
  });
  return v;
}

function report(vs: Verdict[]): void {
  for (const x of vs) check(x.name, x.ok, x.ok ? undefined : x.detail);
}

const br = await chromium.launch({ executablePath: config.chromiumPath });

const mockHtml = await injectRuntime(renderSite(recipe(), DATA, { phase: "mock" }), DATA.lang);
const liveHtml = await injectRuntime(renderSite(recipe(), LIVE_DATA, { phase: "live" }), LIVE_DATA.lang);

console.log("①②③ a MOCK foglalás-widgetje TELEFONON (390, két lépés):");
report(judgeMock(await probe(br, mockHtml, { width: 390, submit: true }), true));
console.log("①②③ a MOCK foglalás-widgetje ASZTALON (1280):");
report(judgeMock(await probe(br, mockHtml, { width: 1280, submit: true }), false));

console.log("④ ÁLPOZITÍV KONTROLL — ugyanez ÉLESEN (phase=live, árlista az API-ból):");
{
  const l = await probe(br, liveHtml, { width: 1280, submit: false, live: true });
  check("van widget és tartomány", !l.noForm && !l.noDays && !!l.from && !!l.to, l.noDays);
  check("az ár-doboz összeget mutat (az API árlistájából)", MONEY.test(l.quote ?? ""), l.quote);
  check("de NEM nevezi mintának", !SAMPLE.test(l.quote ?? ""), l.quote);
  check("a jegyzet sem beszél mintáról", !SAMPLE.test(l.note ?? ""), l.note);
  check("a gomb foglalási kérést küld", BOOK_BTN.test(l.submitText ?? "") && !ASK.test(l.submitText ?? ""), l.submitText);
}

if (SELFTEST) {
  console.log("\n🔴 PIROS ÖNTESZT — a visszarontott runtime-nak BUKNIA kell a saját állításán:");
  const before = failures;
  /** Replace or die: a sabotage that does not change the page proves nothing. */
  const sab = (html: string, from: string | RegExp, to: string, what: string): string => {
    const out = html.replace(from, to);
    if (out === html) {
      failures++;
      console.error(`  ⛔ A(z) „${what}” szabotázs NEM VÁLTOZTATOTT a lapon — a minta nincs a runtime-ban.`);
    }
    return out;
  };
  const NO_PRICE = sab(mockHtml, "rows: [{ base: true, amount: 24000 + idx * 4000 }]", "rows: []", "minta-árlista kivéve");
  const FLAT_RECEIPT = sab(
    NO_PRICE,
    '(askMode ? tr("Így néz ki, amikor a vendége árajánlatot kér") : tr("Így néz ki, amikor a vendége foglal"))',
    'tr("Így néz ki, amikor a vendége foglal")',
    "a nyugta nem követi a módot",
  );
  // Four labels carry the sample claim (heading, basis line, total, sentence) — a sabotage
  // that leaves one in place is not the „real price" page it pretends to be (measured: the
  // basis line alone kept the claim green, 2026-09-26).
  const NO_LABEL = sab(
    sab(
      sab(
        sab(mockHtml, '(demo ? tr("Minta-ár") : tr("Az ár"))', 'tr("Az ár")', "minta-cím kivéve"),
        /var basis = demo\s*\? tr\("A minta-ár a TELJES SZÁLLÁSRA[^"]*"\)\s*: q\.perStay/,
        "var basis = q.perStay",
        "minta-alap sor kivéve",
      ),
      '(demo ? tr("Összesen a szállásért (minta-ár)") : tr("Összesen a szállásért"))',
      'tr("Összesen a szállásért")',
      "minta-összeg felirat kivéve",
    ),
    /\? '<span class="cit-book__qsample">'[\s\S]*?"<\/span>"/,
    '? ""',
    "minta-mondat kivéve",
  );
  const cases: [string, string, string[], string[]][] = [
    // [label, html, claims that MUST go red, claims that MUST stay green]
    [
      "minta-árlista kivéve → árajánlat-mód (a foglalás-út állításai buknak; az invariáns szerkezeti, ÁLL)",
      NO_PRICE,
      ["① ár-doboz ÖSSZEGGEL", "① az ár-doboz MINTÁNAK nevezi magát", "① nem árajánlat-mód („egyedi árat ad”)", "② a gomb FOGLALÁSI kérést küld, nem árajánlatot kér", "② nyugta a FOGLALÁSRÓL, és kimondja, hogy próba volt"],
      ["③ ⭐ INVARIÁNS: a gomb és a nyugta EGY folyamatról beszél"],
    ],
    [
      "…ÉS a nyugta mindig foglalást mond → a gomb árajánlatot kér, a nyugta foglal: az INVARIÁNS bukik",
      FLAT_RECEIPT,
      ["③ ⭐ INVARIÁNS: a gomb és a nyugta EGY folyamatról beszél"],
      [],
    ],
    [
      "minta-feliratok kivéve az ár-dobozból → az ár úgy áll ott, mint egy valódi ár",
      NO_LABEL,
      ["① az ár-doboz MINTÁNAK nevezi magát"],
      ["① ár-doboz ÖSSZEGGEL", "② a gomb FOGLALÁSI kérést küld, nem árajánlatot kér", "③ ⭐ INVARIÁNS: a gomb és a nyugta EGY folyamatról beszél"],
    ],
  ];
  for (const [label, html, mustFail, mustHold] of cases) {
    const vs = judgeMock(await probe(br, html, { width: 1280, submit: true }), false);
    const byName = new Map(vs.map((x) => [x.name, x]));
    const red = mustFail.filter((n) => byName.get(n)?.ok === false);
    check(`${label} — PIROS: ${red.length}/${mustFail.length}`, red.length === mustFail.length, mustFail.filter((n) => byName.get(n)?.ok !== false));
    const held = mustHold.filter((n) => byName.get(n)?.ok === true);
    if (mustHold.length) check(`   …és ami nem érintett, ZÖLD marad: ${held.length}/${mustHold.length}`, held.length === mustHold.length, mustHold.filter((n) => byName.get(n)?.ok !== true));
  }
  if (failures === before) console.log("\n✅ ÖNTESZT: mindhárom szabotázs a saját állításán bukik, a többi állítás áll.");
}

await br.close();

if (failures) {
  console.error(`\n❌ mock-booking-sample-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ mock-booking-sample-check: a mock foglalás-widgetje minta-árral a foglalás-utat játssza, a gomb és a nyugta egy folyamatról beszél, az éles lap nem mond mintát.");
