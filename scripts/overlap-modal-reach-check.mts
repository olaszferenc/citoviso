// A FEDÉS-VÁLASZTÓ ZÁRÓ GOMBJA ELÉRHETŐ KELL LEGYEN — mindkét méreten.
//
//   npx tsx scripts/overlap-modal-reach-check.mts
//
// Miért létezik ez az őr (Elek FK-007, 2026-09-11, tulajdonosi lelet):
//   „a választó-modál alja levágódik, a záró gomb nem is látszik"
// A modál RENDERELT, a DOM-ban BENNE VOLT a gomb, és a Playwright `isVisible()` is
// igazat mondott — a tulaj mégsem tudta befejezni a döntést. Ez a hibaosztály csak
// GEOMETRIAI ítélettel fogható meg: benne van-e a nézetben, és a KÖZEPÉN tényleg
// azt adja-e vissza az `elementFromPoint`, amit ott hiszünk.
//
// Miért nem az FK-007 fogja meg: az Elek-forgatókönyv DSL-je szöveg-láthatóságot és
// elem-darabszámot tud, `elementFromPoint`-ot nem. A teljes-lapos screenshotja pedig
// éppen ELFEDI a kérdést: a viewportot a lap magasságára nyújtja, ezért a
// `position:fixed` overlay a kép aljára kerül — abból egy emberi (vagy gépi) ítész
// pont az ellenkezőjét olvasná ki, mint ami igaz. Képből fix overlay pozíciója nem
// ítélhető meg; mérni kell.
//
// Amit állít (390×844 és 1280×900):
//   ① EGY koppintásra nyílik a választó (ADR-0117 ⑥) — és a régi `<details>` panel
//      NEM nyílik ki mellette. Ha ez nem igaz, a többi mérés tárgytalan.
//   ② A záró gomb („Visszaigazolom — a többit elutasítom") a NÉZETEN BELÜL van, és
//      a közepén az `elementFromPoint` ŐT adja vissza (nem takarja semmi).
//   ③ Ugyanez a „Mégsem"-re: a visszaút se lehet elérhetetlen.
//   ④ Az üzenet-mező a ragadó sor miatt a hajtás alá kerülhet — de ELÉRHETŐNEK kell
//      maradnia: a modált legörgetve a mezőnek a nézetbe kell jönnie. (Ez a tudatos
//      alku: az elsődleges műveletet mindig látni kell, a másodlagosat elérni.)
//
// Önteszt (`--selftest`): ugyanezen a valódi lapon visszaírja a RÉGI CSS-t (a ragadó
// sor nélkül, `place-items:center` rácson, `92vh`-val), és elvárja, hogy a ② bukjon.
// Ha nem bukik, az őr vak — és ezt maga jelenti be hibával.
//
// ⚠️ Amit az önteszt PONTOSAN bizonyít (ne állítsunk többet nála): a régi CSS-sel a
// gomb-sor a modál ÁTGÖRGETENDŐ részébe esik — megnyitáskor mobilon y=927 egy 844
// pixeles nézetben, asztalin y=935 a 900-ban, tehát a hajtás ALATT. Görgetéssel
// előkereshető volt; a hiba az, hogy az ELSŐDLEGES MŰVELETET keresni kellett. Épp ezt
// a különbséget rögzíti a ④: a másodlagos tartalom (üzenet-mező) görgethet, a
// döntés gombja nem. Az őr tehát nem „elérhetőséget" mér, hanem hogy a befejezés
// LÁTSZIK-E anélkül, hogy a tulaj vadászni kezdene rá.

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
 * Two PENDING requests sharing a night — that is the only thing that makes the
 * chooser exist at all (overlapGroups). Deterministic dates in a fixed month, so
 * the grid's height (and therefore the modal's) does not drift with the calendar. */

function req(over: Partial<InboxItem> & { id: string; guestName: string; dateFrom: string; dateTo: string }): InboxItem {
  return {
    unitName: "A szállás egésze",
    guestEmail: "vendeg@example.test",
    guestPhone: "+36 30 000 0000",
    guests: 2,
    message: null,
    status: "pending",
    token: `token-${over.id}`,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    seen: true,
    quotedTotal: 64000,
    quotedCurrency: "HUF",
    ...over,
  } as InboxItem;
}

const REQUESTS: InboxItem[] = [
  req({ id: "aaaaaaaa-0000-0000-0000-000000000001", guestName: "Kovács János", dateFrom: "2026-09-18", dateTo: "2026-09-20" }),
  req({
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    guestName: "Anna Gruber",
    dateFrom: "2026-09-19",
    dateTo: "2026-09-21",
    createdAt: new Date("2026-09-01T12:00:00Z"),
  }),
];

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
  calendarOpen: false,
  openDay: null,
  openDayBooking: null,
  panel: null,
  requests: REQUESTS,
  yearAccepted: 0,
  yearCancelled: 0,
  outcome: null,
  expireHours: 48,
};

/** The OLD css, re-applied on top — the state the owner reported (red control). */
const OLD_CSS = `
.bk-ovl{display:grid !important;place-items:center !important;align-items:center !important;
  justify-content:initial !important;overflow:visible !important}
.bk-ovm{max-height:92vh !important;padding:18px 16px !important;margin:0 !important}
.bk-ovrow{position:static !important;border-top:0 !important;padding:0 !important;background:none !important}
`;

async function buildPage(): Promise<string> {
  const citui = await readFile(path.join(ROOT, "public/assets/ui/citui.css"), "utf8");
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>${citui}</style>` +
    `<style>body{margin:0;background:var(--citui-surface);font-family:var(--citui-font-text)}` +
    `.wrap{max-width:760px;margin:0 auto;padding:18px}</style>` +
    `</head><body><div class="wrap">${bookingsSection(DATA, "hu")}</div></body></html>`
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

async function run(width: number, height: number, tag: string, old: boolean): Promise<void> {
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(await buildPage(), { waitUntil: "domcontentloaded" });
  if (old) await page.addStyleTag({ content: OLD_CSS });
  await page.waitForTimeout(120);

  console.log(`\n── ${tag} @${width}×${height}${old ? "  [RÉGI CSS — bukást várunk]" : ""}`);
  check(`${tag}: nincs JS-hiba`, errs.length === 0, errs);

  // ① one tap opens the chooser — and the old panel must NOT open alongside it.
  //    The fixture has to PROVE it renders the real thing before anything is measured:
  //    an overlap-less page would silently make every later assertion vacuous.
  const summary = page.locator("details.bk-verdict:has(form[data-bk-overlap]) > summary").first();
  if (!check(`${tag}: van fedésben lévő kérés a fixture-ben`, (await summary.count()) > 0)) {
    await ctx.close();
    await browser.close();
    return;
  }
  await summary.click();
  await page.waitForTimeout(200);
  const opened = await page.locator(".bk-ovm").count();
  check(`${tag}: EGY koppintás megnyitja a választót`, opened === 1, { modals: opened });
  check(
    `${tag}: a régi lenyíló panel NEM nyílt ki mellette`,
    (await page.locator("details.bk-verdict[open]").count()) === 0,
  );
  if (opened !== 1) {
    await ctx.close();
    await browser.close();
    return;
  }

  // ② + ③ the two buttons of the action row
  for (const [sel, label] of [
    [".bk-ovrow [data-ok]", "záró gomb"],
    [".bk-ovrow [data-no]", "Mégsem"],
  ] as const) {
    const r = await reach(page, sel);
    check(`${tag}: a ${label} a nézeten belül van`, r.found && r.inView, r);
    check(`${tag}: a ${label} közepén tényleg ŐT találjuk`, r.hit, r);
  }

  // ④ the message box may sit below the fold (the sticky row is the deliberate
  //    trade), but it must be REACHABLE by scrolling the modal.
  const note = await reach(page, ".bk-ovnote");
  if (!note.inView) {
    await page.evaluate(() => {
      const m = document.querySelector(".bk-ovm");
      if (m) m.scrollTop = m.scrollHeight;
    });
    await page.waitForTimeout(150);
  }
  const after = await reach(page, ".bk-ovnote");
  check(`${tag}: az üzenet-mező elérhető (legfeljebb görgetés után)`, after.inView, {
    elsore: note.inView,
    gorgetes_utan: after,
  });

  await ctx.close();
  await browser.close();
}

const SIZES = [
  { w: 390, h: 844, tag: "mobil" },
  { w: 1280, h: 900, tag: "asztali" },
] as const;

console.log(
  `\nFEDÉS-VÁLASZTÓ ELÉRHETŐSÉG-ŐR${selftest ? "  [ÖNTESZT: a régi CSS-sel BUKNIA KELL]" : ""}`,
);

for (const s of SIZES) await run(s.w, s.h, s.tag, selftest);

console.log("");
if (selftest) {
  if (failures > 0) {
    console.log(`✅ ÖNTESZT RENDBEN — a régi CSS-sel ${failures} mérés bukott, ahogy kell.`);
    process.exit(0);
  }
  console.error(
    "⛔ ÖNTESZT BUKOTT: a RÉGI CSS-sel is minden zöld maradt — az őr nem méri azt, amiért készült.",
  );
  process.exit(1);
}
if (failures > 0) {
  console.error(`⛔ ${failures} mérés bukott — a fedés-választó nem fejezhető be.`);
  process.exit(1);
}
console.log("✅ a fedés-választó záró gombja mindkét méreten látszik ÉS kattintható");
process.exit(0);
