// A LEMONDÁS MEGERŐSÍTÉSE A RENDSZER SAJÁT MODÁLJA — nem natív böngésző-dialógus.
//
//   npx tsx scripts/cancel-confirm-check.mts
//   npx tsx scripts/cancel-confirm-check.mts --selftest
//
// Miért létezik ez az őr (Elek FK-007 E3, 2026-09-14):
//   A `bookingViews.ts` kommentje azt állította, hogy „No native confirm()" — közben a
//   LEMONDÁS ágon natív `confirm()` futott. Két baj egyszerre: a tulajdonosi lemondás
//   négy lépés volt (panel nyit → gépel → küld → nyers OS-dialógus), és a KÓD HAZUDOTT
//   MAGÁRÓL. A komment nem kapu: ha nincs mérés, a következő szerkesztés visszateheti,
//   és megint csak egy kommentre hivatkozhatunk.
//
// Amit állít (a RENDERELT tenant-admin „Foglalások" lapon, 390×844 és 1280×900):
//   ① A kimenetben NINCS natív `confirm(` / `alert(` / `prompt(` — sem attribútumban,
//      sem scriptben. Ez a „komment mondjon igazat" állítás gépi alakja.
//   ② EGY koppintás a „Foglalás lemondása"-ra megnyitja a rendszer-modált, és a régi
//      `<details>` panel NEM nyílik ki mellette.
//   ③ A modál MEGNEVEZI a vendéget és az időszakot, és kimondja a következményt —
//      a natív dialógus információja nem veszhet el, csak a dialógus.
//   ④ A záró (piros) gomb ÉS a „Mégsem" a nézeten belül van, és a közepükön az
//      `elementFromPoint` őket adja vissza. (Ugyanaz a hibaosztály, amit a
//      fedés-választónál már megfizettünk — lásd overlap-modal-reach-check.mts.)
//   ⑤ A záró gomb tényleg BEKÜLDI az űrlapot a `/admin/booking/cancel`-re, a foglalás
//      azonosítójával ÉS a modálba gépelt indoklással. (A `form.submit()` nem süt el
//      submit-eseményt, ezért a prototípust csapdázzuk.)
//   ⑥ A „Mégsem" NEM küld be semmit, és becsukja a modált.
//   ⑦ Nincs JS-hiba a lapon.
//   ⑧ no-JS kontraktus: JS nélkül a `<details>`-es űrlap ugyanoda POST-ol, megvan az
//      `id`, az `uzenet` mező és a küldő gomb. (Külön, `javaScriptEnabled:false` böngésző.)
//
// Önteszt (`--selftest`): ugyanezen a valódi lapon visszaírja a RÉGI MARKUPOT — leveszi
// a `data-bk-cancel` horgot (így a script nem talál űrlapot) és visszateszi az
// `onsubmit="return confirm(…)"`-t.
// ⚠️ Amit az önteszt PONTOSAN bizonyít (ne állítsunk többet nála): mérve 6 bukás — ① két
// natív `confirm(` a kimenetben és hiányzó modál-horog, ② mindkét méreten 0 modál nyílik
// és helyette a régi `<details>` panel csukódik ki. A ③–⑤ ilyenkor TÁRGYTALAN (modál
// nélkül nincs mit megnevezni, elérni, beküldeni), ezért az őr ott korán visszafordul.
// A ⑧ (no-JS) szándékosan KIMARAD az öntesztből: azt az ág a javítás nem érinti, zöldnek
// kell maradnia, egy elvárt-piros futásban pedig félreolvasható lenne.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls, no DB writes

import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { bookingsSection, type BookingsTabData } from "../src/server/bookingViews.js";
import type { InboxItem } from "../src/booking/requests.js";
import type { MonthView } from "../src/tenant/availability.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const selftest = process.argv.includes("--selftest");

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): boolean {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
  return ok;
}

/* ── fixture ───────────────────────────────────────────────────────────────
 * ONE accepted booking, open in the calendar's day panel — that is the screen the
 * owner cancels from (and the one Elek measured). The history list gets the same
 * form, so both call sites are on the page at once. */

const BOOKING: InboxItem = {
  id: "bbbbbbbb-0000-0000-0000-000000000001",
  unitName: "A szállás egésze",
  guestName: "Kovács János",
  guestEmail: "vendeg@example.test",
  guestPhone: "+36 30 000 0000",
  guests: 2,
  dateFrom: "2026-09-18",
  dateTo: "2026-09-20",
  message: "Kutyát hozhatunk?",
  status: "accepted",
  token: "token-cancel-1",
  createdAt: new Date("2026-09-01T10:00:00Z"),
  decidedAt: new Date("2026-09-02T09:00:00Z"),
  decidedBy: "owner",
  decisionNote: "Örömmel várjuk!",
  seen: true,
  quotedTotal: 64000,
  quotedCurrency: "HUF",
} as InboxItem;

const MONTH: MonthView = {
  month: "2026-09",
  label: "2026. szeptember",
  prevMonth: "2026-08",
  nextMonth: "2026-10",
  leadingBlanks: 1,
  cells: Array.from({ length: 30 }, (_, i) => ({
    day: `2026-09-${String(i + 1).padStart(2, "0")}`,
    dom: i + 1,
    blocked: false,
    source: null,
    editable: true,
    past: false,
    detail: null,
  })),
  blockedCount: 0,
  importedCount: 0,
};

const DATA: BookingsTabData = {
  units: [{ id: "unit-1", name: "A szállás egésze" }],
  unitId: "unit-1",
  month: MONTH,
  calendarOpen: true,
  openDay: "2026-09-18",
  openDayBooking: BOOKING,
  panel: null,
  requests: [BOOKING],
  yearAccepted: 1,
  yearCancelled: 0,
  outcome: null,
  expireHours: 48,
};

/** The OLD markup, put back verbatim in shape — the state before the fix (red control). */
function regress(html: string): string {
  return html.replace(
    /<form method="post" action="\/admin\/booking\/cancel" data-bk-cancel /g,
    `<form method="post" action="/admin/booking/cancel" ` +
      `onsubmit="return confirm(&quot;Biztosan lemondja a foglalást?&quot;)" `,
  );
}

async function buildPage(): Promise<string> {
  const citui = await readFile(path.join(ROOT, "public/assets/ui/citui.css"), "utf8");
  const body = bookingsSection(DATA, "hu");
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>${citui}</style>` +
    `<style>body{margin:0;background:var(--citui-surface);font-family:var(--citui-font-text)}` +
    `.wrap{max-width:760px;margin:0 auto;padding:18px}</style>` +
    `</head><body><div class="wrap">${selftest ? regress(body) : body}</div></body></html>`
  );
}

interface Reach {
  readonly found: boolean;
  readonly y: number;
  readonly vh: number;
  readonly inView: boolean;
  readonly hit: boolean;
  readonly topEl: string | null;
}

/** Geometric verdict: inside the viewport AND the point actually lands on it. */
async function reach(page: Page, sel: string): Promise<Reach> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { found: false, y: -1, vh: innerHeight, inView: false, hit: false, topEl: null };
    const b = el.getBoundingClientRect();
    const cx = Math.round(b.left + b.width / 2);
    const cy = Math.round(b.top + b.height / 2);
    const inView = b.height > 0 && b.top >= 0 && b.bottom <= innerHeight;
    const top = inView ? document.elementFromPoint(cx, cy) : null;
    return {
      found: true,
      y: Math.round(b.top),
      vh: innerHeight,
      inView,
      hit: Boolean(top && (top === el || top.closest(s))),
      topEl: top ? `${top.tagName}.${String(top.className).slice(0, 40)}` : null,
    };
  }, sel);
}

/* ── ① the rendered output carries no native dialog ─────────────────────── */

function sourceCheck(html: string): void {
  console.log(`\n── kimenet (forrás-szint)${selftest ? "  [RÉGI MARKUP — bukást várunk]" : ""}`);
  // The word "confirm" legitimately appears as a CSS class / data name; only the CALL
  // shape is forbidden. `(?<![\w.$])` keeps `confirmBtn` and `x.confirm(` out of it.
  for (const fn of ["confirm", "alert", "prompt"]) {
    const hits = html.match(new RegExp(`(?<![\\w.$])${fn}\\s*\\(`, "g")) ?? [];
    check(`nincs natív ${fn}() a renderelt lapon`, hits.length === 0, { talalat: hits.length });
  }
  check(
    "a lemondó űrlap a modál-horgot viseli",
    /action="\/admin\/booking\/cancel"[^>]*data-bk-cancel/.test(html),
  );
}

/* ── ②–⑦ behaviour, both sizes ──────────────────────────────────────────── */

async function run(width: number, height: number, tag: string): Promise<void> {
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(await buildPage(), { waitUntil: "domcontentloaded" });

  // ⑤ `form.submit()` fires NO submit event — trap the prototype instead, and stop the
  //    navigation so the assertions can read what would have gone out.
  await page.evaluate(() => {
    const w = window as unknown as { __sent: Record<string, string> | null };
    w.__sent = null;
    const orig = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
      const out: Record<string, string> = { action: this.getAttribute("action") ?? "" };
      for (const el of Array.from(this.elements)) {
        const n = (el as HTMLInputElement).name;
        if (n) out[n] = (el as HTMLInputElement).value;
      }
      w.__sent = out;
      void orig; // deliberately NOT called: no navigation in the measurement
    };
  });
  await page.waitForTimeout(80);

  console.log(`\n── ${tag} @${width}×${height}${selftest ? "  [RÉGI MARKUP — bukást várunk]" : ""}`);
  check(`${tag}: nincs JS-hiba`, errs.length === 0, errs);

  // The fixture has to PROVE it renders the real thing first: a page without a
  // cancellable booking would make every later assertion vacuously green.
  const summary = page.locator(".bk-dayinfo details.bk-cancel > summary").first();
  if (!check(`${tag}: van lemondható foglalás a nap-panelen`, (await summary.count()) > 0)) {
    await ctx.close();
    await browser.close();
    return;
  }

  // ② ONE tap → system modal, and the old panel stays shut.
  await summary.click();
  await page.waitForTimeout(200);
  const opened = await page.locator(".bk-ovl .bk-ovm").count();
  check(`${tag}: EGY koppintás megnyitja a megerősítő modált`, opened === 1, { modals: opened });
  check(
    `${tag}: a régi lenyíló panel NEM nyílt ki mellette`,
    (await page.locator(".bk-dayinfo details.bk-cancel[open]").count()) === 0,
  );
  if (opened !== 1) {
    await ctx.close();
    await browser.close();
    return;
  }

  // Evidence for human eyes (--shots). VIEWPORT shot, never fullPage: a full-page
  // capture stretches the viewport to the document height and repaints a fixed
  // overlay at its final place — the one thing a picture must not lie about here.
  if (process.argv.includes("--shots")) {
    const out = path.join(ROOT, "assets/design-refs/_drafts", `cancel-modal-${tag}.png`);
    await page.screenshot({ path: out });
    console.log(`  · kép: ${out}`);
  }

  // ③ the modal says WHO, WHICH nights, and what it costs to press the red button.
  const txt = (await page.locator(".bk-ovm").innerText()).replace(/\s+/g, " ");
  check(`${tag}: a modál megnevezi a vendéget`, txt.includes("Kovács János"), { txt: txt.slice(0, 160) });
  check(`${tag}: a modál kiírja az időszakot`, txt.includes("2026. 09. 18.") && txt.includes("2026. 09. 20."));
  check(`${tag}: a modál kimondja, hogy nem vonható vissza`, txt.includes("nem vonható vissza"));

  // ④ both buttons of the sticky action row are reachable.
  for (const [sel, label] of [
    [".bk-ovrow [data-ok]", "záró gomb"],
    [".bk-ovrow [data-no]", "Mégsem"],
  ] as const) {
    const r = await reach(page, sel);
    check(`${tag}: a ${label} a nézeten belül van`, r.found && r.inView, r);
    check(`${tag}: a ${label} közepén tényleg ŐT találjuk`, r.hit, r);
  }

  // ⑥ "Mégsem" closes and sends nothing.
  await page.locator(".bk-ovrow [data-no]").click();
  await page.waitForTimeout(120);
  check(`${tag}: a Mégsem becsukja a modált`, (await page.locator(".bk-ovl").count()) === 0);
  check(
    `${tag}: a Mégsem NEM küldött be semmit`,
    (await page.evaluate(() => (window as unknown as { __sent: unknown }).__sent)) === null,
  );

  // ⑤ the red button really posts the cancel, with the id and the typed reason.
  await summary.click();
  await page.waitForTimeout(180);
  await page.locator(".bk-ovnote").fill("Csőtörés miatt a vendégház zárva.");
  await page.locator(".bk-ovrow [data-ok]").click();
  await page.waitForTimeout(150);
  const sent = (await page.evaluate(
    () => (window as unknown as { __sent: Record<string, string> | null }).__sent,
  )) as Record<string, string> | null;
  check(`${tag}: a záró gomb beküldi a lemondást`, sent?.action === "/admin/booking/cancel", sent);
  check(`${tag}: a beküldés viszi a foglalás azonosítóját`, sent?.id === BOOKING.id, sent?.id);
  check(
    `${tag}: a modálba gépelt indoklás megy ki`,
    sent?.uzenet === "Csőtörés miatt a vendégház zárva.",
    sent?.uzenet,
  );

  await ctx.close();
  await browser.close();
}

/* ── ⑧ no-JS contract ───────────────────────────────────────────────────── */

async function runNoJs(): Promise<void> {
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.setContent(await buildPage(), { waitUntil: "domcontentloaded" });

  console.log(`\n── no-JS kontraktus @390×844`);
  const form = page.locator('.bk-dayinfo form[action="/admin/booking/cancel"]').first();
  check("no-JS: a lemondó űrlap ott van", (await form.count()) === 1);
  check("no-JS: viszi a foglalás azonosítóját", (await form.locator('input[name="id"]').getAttribute("value")) === BOOKING.id);
  check("no-JS: van indoklás-mező", (await form.locator('textarea[name="uzenet"]').count()) === 1);
  check("no-JS: van küldő gomb", (await form.locator('button[type="submit"]').count()) === 1);

  await ctx.close();
  await browser.close();
}

const SIZES = [
  { w: 390, h: 844, tag: "mobil" },
  { w: 1280, h: 900, tag: "asztali" },
] as const;

console.log(
  `\nLEMONDÁS-MEGERŐSÍTÉS ŐRE${selftest ? "  [ÖNTESZT: a RÉGI markuppal BUKNIA KELL]" : ""}`,
);

sourceCheck(selftest ? regress(bookingsSection(DATA, "hu")) : bookingsSection(DATA, "hu"));
for (const s of SIZES) await run(s.w, s.h, s.tag);
if (!selftest) await runNoJs(); // the no-JS path is UNCHANGED by the fix — it must stay green

console.log("");
if (selftest) {
  if (failures > 0) {
    console.log(`✅ ÖNTESZT RENDBEN — a régi markuppal ${failures} mérés bukott, ahogy kell.`);
    process.exit(0);
  }
  console.error(
    "⛔ ÖNTESZT BUKOTT: a RÉGI markuppal is minden zöld maradt — az őr nem méri azt, amiért készült.",
  );
  process.exit(1);
}
if (failures > 0) {
  console.error(`⛔ ${failures} mérés bukott — a lemondás megerősítése nem a rendszer sajátja.`);
  process.exit(1);
}
console.log("✅ a lemondás a rendszer saját modáljával erősít meg — natív dialógus sehol");
process.exit(0);
