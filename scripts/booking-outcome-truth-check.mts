// ŐR — "a képernyő mondja meg, mi történt, és a végén legyen ott a válasz".
//
// Három mért hibaosztály (B8, Elek FK-007 / FK-006b köre, 2026-09-14). Mindhárom
// olyan, amit sem a screenshot, sem a DOM-jelenlét nem fog meg:
//
//  A) A KORÁBBI KÉRÉSEK SORA hamis alanyt vagy hamis számot mondott. A tulaj SAJÁT
//     lemondása alanytalan „Lemondva"-t kapott (a vendégé viszont meg volt nevezve),
//     az automatikus elutasítás mellé „döntés:" került — arra az egy kimenetre,
//     ami PONT azért történt, mert senki nem döntött —, a lejárat-jelvény pedig
//     BEÉGETETT 48 órát írt, miközben a modul ablaka állítható (`autoDeclineHours`).
//     24 órás ablakon a képernyő egy nem létező szabályt idézett.
//
//  B) A LEMONDÁS UTÁNI ÁTIRÁNYÍTÁS elejtette a naptár állapotát: a nyitott naptár
//     becsukódott, visszaugrott az aktuális hónapra és az első egységre. A verdikt
//     nem mozdíthatja ki a képernyőt az alól, aki kimondta.
//
//  C) A VENDÉG NEM LÁTTA A NYUGTÁT. A beadás egy magas űrlapot cserél egy alacsony
//     kártyára: a fölötte lévő tartalom felcsúszik, a görgetés marad — és a nyugta
//     a képernyő FÖLÉ kerül. ⛔ Rövid teszt-lapon ez ZÖLD: a dokumentum megrövidül,
//     a böngésző visszarántja a görgetést, és a nyugta véletlenül látszik. Ezért ez
//     az őr FOOTERT tesz a kártya alá — mint minden valódi honlap.
//
//   npx tsx scripts/booking-outcome-truth-check.mts
//   npx tsx scripts/booking-outcome-truth-check.mts --selftest   (pirosra kell mennie)

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { bookingsSection, type BookingsTabData } from "../src/server/bookingViews.js";
import { bookingSlot } from "../src/engine/templateKit.js";
import { moduleSections } from "../src/engine/moduleSections.js";
import type { SiteData } from "../src/engine/recipe.js";
import type { MonthView, DayCell } from "../src/tenant/availability.js";
import type { InboxItem } from "../src/booking/requests.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELFTEST = process.argv.includes("--selftest");

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

const iso = (offset: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const at = (h: number): Date => new Date(Date.now() + h * 3_600_000);

/* ══ A + B — a tulaj sora és a visszaút, tisztán a nézet-függvényből ══════════ */

function monthFixture(): MonthView {
  const month = iso(0).slice(0, 7);
  const daysIn = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const cells: DayCell[] = [];
  for (let d = 1; d <= daysIn; d++) {
    const day = `${month}-${String(d).padStart(2, "0")}`;
    cells.push({
      day,
      dom: d,
      blocked: false,
      source: null,
      editable: day >= iso(0),
      past: day < iso(0),
      detail: null,
    });
  }
  return {
    month,
    label: "teszt hónap",
    prevMonth: month,
    nextMonth: month,
    leadingBlanks: 0,
    cells,
    blockedCount: 0,
    importedCount: 0,
  };
}

function reqFixture(o: Partial<InboxItem> & { id: string }): InboxItem {
  return {
    unitName: "A szállás egésze",
    guestName: "Vendég",
    guestEmail: "v@example.com",
    guestPhone: null,
    dateFrom: iso(10),
    dateTo: iso(12),
    guests: 2,
    message: null,
    status: "pending",
    token: `tok-${o.id}`,
    createdAt: at(-4),
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    seen: true,
    quotedTotal: null,
    quotedCurrency: null,
    ...o,
  };
}

/** The tab's HTML for a given answer window — the ONLY knob section A turns. */
function renderTab(expireHours: number): string {
  const requests: InboxItem[] = [
    reqFixture({ id: "a1", guestName: "Lemondó Tulaj", status: "cancelled", decidedBy: "owner", decidedAt: at(-30) }),
    reqFixture({ id: "a2", guestName: "Lemondó Vendég", status: "cancelled", decidedBy: "guest", decidedAt: at(-31) }),
    reqFixture({ id: "a3", guestName: "Lemondó Ismeretlen", status: "cancelled", decidedBy: null, decidedAt: at(-32) }),
    reqFixture({ id: "a4", guestName: "Automata Elutasított", status: "declined", decidedBy: "auto", decidedAt: at(-33) }),
    reqFixture({ id: "a5", guestName: "Kézzel Elutasított", status: "declined", decidedBy: "owner", decidedAt: at(-34) }),
    reqFixture({ id: "a6", guestName: "Lejárt Kérés", status: "expired", decidedBy: "system", decidedAt: at(-35) }),
    reqFixture({ id: "a7", guestName: "Élő Foglalás", status: "accepted", decidedBy: "owner", decidedAt: at(-36), dateFrom: iso(20), dateTo: iso(22) }),
  ];
  const data: BookingsTabData = {
    units: [{ id: "unit-2", name: "Nagy szoba" }, { id: "unit-1", name: "A szállás egésze" }],
    unitId: "unit-2",
    month: monthFixture(),
    calendarOpen: true,
    openDay: null,
    openDayBooking: null,
    panel: null,
    requests,
    yearAccepted: 1,
    yearCancelled: 3,
    expireHours,
    outcome: null,
  };
  return bookingsSection(data, "hu");
}

/** The chip of one history row, by the guest's name. */
function rowOf(html: string, name: string): string {
  const i = html.indexOf(name);
  if (i < 0) return "";
  const start = html.lastIndexOf('<div class="bk-hist">', i);
  const end = html.indexOf('<div class="bk-hist">', i);
  return html.slice(start, end > i ? end : start + 2400);
}

console.log("\nA) A korábbi kérések sora megnevezi az ALANYT és a valódi szabályt:");
{
  const html = renderTab(48);
  check(
    "⭐ a TULAJ lemondása megnevezi a tulajt (nem alanytalan „Lemondva”)",
    rowOf(html, "Lemondó Tulaj").includes("Ön mondta le"),
    rowOf(html, "Lemondó Tulaj").includes("Lemondva") ? "még mindig alanytalan" : "",
  );
  check(
    "a VENDÉG lemondása változatlanul a vendéget nevezi meg",
    rowOf(html, "Lemondó Vendég").includes("A vendég lemondta"),
  );
  check(
    "⭐ ISMERETLEN szerzőnél NEM találunk ki alanyt (semleges „Lemondva”)",
    rowOf(html, "Lemondó Ismeretlen").includes("Lemondva") &&
      !rowOf(html, "Lemondó Ismeretlen").includes("Ön mondta le"),
  );
  check(
    "⭐ az AUTOMATIKUS elutasítás nem hivatkozik döntésre",
    rowOf(html, "Automata Elutasított").includes("automatikusan:") &&
      !rowOf(html, "Automata Elutasított").includes("döntés:"),
  );
  check(
    "a KÉZI elutasítás továbbra is döntés",
    rowOf(html, "Kézzel Elutasított").includes("döntés:"),
  );
  check(
    "a LEJÁRT kérés sora lejáratot mond, nem döntést",
    rowOf(html, "Lejárt Kérés").includes("lejárt:") &&
      !rowOf(html, "Lejárt Kérés").includes("döntés:"),
  );
}

console.log("\n   a lejárat-jelvény a MODUL ablakát idézi, nem egy beégetett számot:");
{
  const h48 = renderTab(48);
  const h24 = renderTab(24);
  const h0 = renderTab(0);
  check("48 órás ablaknál „Lejárt (48 óra)”", h48.includes("Lejárt (48 óra)"));
  check(
    "⭐⭐ 24 órás ablaknál „Lejárt (24 óra)” — és SEHOL nem marad 48",
    h24.includes("Lejárt (24 óra)") && !h24.includes("Lejárt (48 óra)"),
    h24.includes("Lejárt (48 óra)") ? "a beégetett 48 él" : "",
  );
  check(
    "ablak nélkül nem állít órát",
    h0.includes(">Lejárt<") && !/Lejárt \(\d+ óra\)/.test(h0),
  );
}

console.log("\nB) A lemondás visszavisz oda, ahol a tulaj dolgozott:");
{
  const html = renderTab(48);
  // The cancel form of the accepted booking must carry the CURRENT view — the unit
  // the owner is looking at (not the first one) and the open calendar.
  check(
    "⭐ a lemondó űrlap viszi az egységet, a hónapot és a nyitott naptárat",
    html.includes('name="nezet" value="u=unit-2&amp;ho=') && html.includes("naptar=1"),
    /name="nezet" value="([^"]*)"/.exec(html)?.[1] ?? "nincs nezet mező",
  );
  // ⛔ The guard must not accept a hard-coded first unit: the fixture deliberately
  // puts the SECOND unit in view, so a `units[0]`-style bug goes red here.
  check(
    "nem az első egységet írja be vakon",
    !html.includes('name="nezet" value="u=unit-1'),
  );
}

/* ══ C — a vendég látja-e a nyugtát ═════════════════════════════════════════ */

const SITE = {
  name: "Nyugalom Vendégház",
  tagline: "",
  intro: "",
  highlights: [],
  photos: [],
  contact: { email: "info@example.com", phone: "+36 30 123 4567" },
  booking: {
    units: [{ id: "11111111-1111-1111-1111-111111111111", name: "A szállás egésze", capacity: 6 }],
    minNights: 2,
    maxNights: 14,
    horizonMonths: 12,
    leadTimeDays: 0,
    responseNote: "",
  },
} as unknown as SiteData;

const SUMMARY = {
  ok: true,
  summary: {
    dateFrom: iso(20),
    dateTo: iso(23),
    nights: 3,
    guests: 2,
    unitName: "A szállás egésze",
    ref: "FOG-4K2P9X",
    total: 96000,
    currency: "HUF",
    expireHours: 48,
    guestEmail: "vendeg@example.com",
    lines: [{ label: "Alapár", nights: 3, perNight: 32000, guests: 1, sum: 96000 }],
  },
};

async function guestPage(runtimeJs: string, modulesCss: string): Promise<string> {
  const stub =
    `<script>(function(){var real=window.fetch;window.fetch=function(u,o){` +
    `var s=String(u);` +
    `if(s.indexOf("/api/foglaltsag/")>=0){return Promise.resolve({ok:true,json:function(){` +
    `return Promise.resolve({blocked:[]});}});}` +
    `if(s.indexOf("/api/foglalas")>=0){return Promise.resolve({ok:true,json:function(){` +
    `return Promise.resolve(${JSON.stringify(SUMMARY)});}});}` +
    `return real.apply(this,arguments);};})();</script>`;
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>:root{--cit-bg:#fff;--cit-ink:#16283f;--cit-muted:#6b7a8d;--cit-line:#dbe3ec;` +
    `--cit-accent:#0ea5b7;--cit-radius:14px}body{font-family:system-ui,sans-serif;margin:0;padding:0}` +
    `.cit-book__submit{font:inherit;font-weight:600;padding:13px 20px;border:0;border-radius:10px;` +
    `background:var(--cit-accent);color:#fff}` +
    `#b8-footer{height:2600px;background:#f4f7fa}</style>` +
    `<style>${modulesCss}</style></head><body>` +
    stub +
    bookingSlot(SITE) +
    moduleSections(SITE) +
    // EVERY real site has something under the booking card. Without it the browser
    // clamps the scroll and the defect hides.
    `<div id="b8-footer"></div>` +
    `<script>${runtimeJs}</script></body></html>`
  );
}

console.log(
  `\nC) A beadás után a nyugta a KÉPERNYŐN van${SELFTEST ? " — PIROS ÖNTESZT (a görgetés kivéve)" : ""}:`,
);
{
  const [rawRuntime, modulesCss] = await Promise.all([
    readFile(path.join(ROOT, "assets/runtime/cit-runtime.js"), "utf8"),
    readFile(path.join(ROOT, "assets/runtime/cit-modules.css"), "utf8"),
  ]);

  // ⛔ ÖNKONTROLL: a piros önteszt csak akkor bizonyít, ha a mutáció tényleg megtörtént.
  // Ha a hívás neve elmozdul és a csere némán nem talál, az önteszt ZÖLDEN „bizonyítaná",
  // hogy az őr nem képes pirosra menni — pontosan fordítva.
  const CALL = "showReceipt();";
  const occurrences = rawRuntime.split(CALL).length - 1;
  if (occurrences < 2) {
    console.log(
      `  ⛔ ÖNKONTROLL: a futásidőben ${occurrences} db \`${CALL}\` hívás van (kettőt várok: éles + demo ág)`,
    );
    failures.push("önkontroll: a mért hívás nincs meg");
  }
  const runtimeJs = SELFTEST ? rawRuntime.split(CALL).join("/*kivéve*/;") : rawRuntime;

  const dir = await mkdtemp(path.join(tmpdir(), "b8-receipt-"));
  const file = path.join(dir, "guest.html");
  await writeFile(file, await guestPage(runtimeJs, modulesCss), "utf8");

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  for (const width of [390, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      isMobile: width === 390,
    });
    await page.goto(pathToFileURL(file).href);
    await page.waitForTimeout(500);

    const days = page.locator(".cit-book__day:not(:disabled):visible");
    await days.nth(1).click();
    await days.nth(4).click();
    await page.fill("#cit-name", "Teszt Vendég");
    await page.fill("#cit-email", "vendeg@example.com");
    await page.fill("#cit-phone", "+36301112222");
    // The guest is AT the send button when they press it — they scrolled the form
    // down as they filled it, so the button is in the middle of the screen and most
    // of the (tall) form is above the fold. ⛔ `scrollIntoViewIfNeeded()` would scroll
    // the LEAST possible amount, leaving the card top near the viewport top, and the
    // 1280px branch could then never fail — a dead assertion dressed as a green one.
    await page
      .locator(".cit-book__submit")
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.locator(".cit-book__submit").click();
    await page.waitForTimeout(900);

    const seen = (await page.evaluate(`(() => {
      var done = document.querySelector(".cit-book--done");
      if (!done) return { found: false };
      var r = done.getBoundingClientRect();
      // Not just "in the box": the HEADLINE has to be readable, so the top of the
      // card must sit inside the viewport, not merely overlap it.
      // ⚠️ AL-PIXEL TŰRÉS: a görgetés gyakran −0,4 px-en áll meg, ami VIZUÁLISAN a
      // lap teteje. A szigorú "nem-negatív" próba ebből villogó pirosat csinálna
      // egy helyes lapon. (⛔ Ebbe a sablon-sztringbe backtick NEM kerülhet.)
      return { found: true, top: Math.round(r.top), h: Math.round(r.height),
        inView: r.top >= -2 && r.top < innerHeight - 60 };
    })()`)) as { found: boolean; top?: number; inView?: boolean };

    check(
      `@${width}px a nyugta a képernyőn van`,
      Boolean(seen.found && seen.inView),
      seen.found ? `a kártya teteje ${seen.top} px-nél (0 fölött kellene)` : "nincs nyugta",
    );
    await page.close();
  }
  await browser.close();
}

/* ══ verdikt ═══════════════════════════════════════════════════════════════ */

if (SELFTEST) {
  // A self-test is only evidence if the C section went red. A/B do not depend on the
  // removed call, so they must stay green — that is what makes the red SPECIFIC.
  const cReds = failures.filter((f) => f.includes("a nyugta a képernyőn van")).length;
  if (cReds === 2 && failures.length === cReds) {
    console.log("\n✅ ÖNTESZT: a görgetés nélkül MINDKÉT méreten pirosra ment — az őr lát.");
    process.exit(0);
  }
  console.log(`\n⛔ ÖNTESZT BUKOTT: ${cReds}/2 piros a C-ben, összes bukás: ${failures.length}`);
  process.exit(1);
}

if (failures.length) {
  console.log(`\n⛔ ${failures.length} bukás:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\n✅ booking-outcome-truth-check: a sor igazat mond, és a vendég látja a választ.");
