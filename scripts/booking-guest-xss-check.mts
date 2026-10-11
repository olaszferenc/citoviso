// A VENDÉG ÁLTAL BEÍRT SZÖVEG SOSEM FUT LE A TULAJ ADMINJÁBAN (Elek IT-kör, 2026-10-11).
//
//   npx tsx scripts/booking-guest-xss-check.mts
//   npx tsx scripts/booking-guest-xss-check.mts --self-test   (a javítás előtti
//     bookingViews.ts-t — gitből, betűre — rendereli, és elvárja a pirosat)
//
// A MÉRT LELET (scratch-DB, `_elek/bin/x-xss.mts`): a vendég a foglalási kérés NEVÉBE
// `<img src=x onerror=…>"><svg onload=…><script>…</script>`-et írt. A DB nyersen tárolja
// (ez rendben van — a megjelenítésnél kell escape-elni). A Foglalások fülön két ütköző
// kérésnél a payload a lap MINDEN betöltésekor lefutott, három úton:
//   ① a „Fedés: az időszakot {names} is kéri” sor a nevet a T() paraméterébe nyersen tette;
//   ② az ütközés-választó adatai (`var G=…`) a <script>-be `<` escape nélkül kerültek —
//      a névben álló `</script>` lezárta a blokkot, a többi HTML-ként futott;
//   ③ a választó modálja `innerHTML`-lel rakta össze a nevet (három helyen).
// A tulaj-levél, a levélbeli döntő-lap és a konzol escape-elt volt (mérve, ugyanott).
//
// Amit mér: a valódi `bookingsSection` két ütköző, mérgezett nevű kéréssel, valódi
// Chromiumban betöltve ÉS a választót megnyitva — 0 futás, 0 befecskendezett elem, a név
// szövegként látszik.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls, no DB writes

import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import type { BookingsTabData } from "../src/server/bookingViews.js";
import type { InboxItem } from "../src/booking/requests.js";
import type { MonthView } from "../src/tenant/availability.js";

const SELF_TEST = process.argv.includes("--self-test");
/** The last commit whose bookingViews.ts rendered guest names raw. */
const PRE_FIX = "9fad47dd";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const BUMP = "window.__x=(window.__x||0)+1";
const EVIL = `XSS-Vendég <img src=x onerror="${BUMP}">"><svg onload="${BUMP}"><script>${BUMP}</script>`;

function req(over: Partial<InboxItem> & { id: string; guestName: string; dateFrom: string; dateTo: string }): InboxItem {
  return {
    unitName: "A szállás egésze",
    guestEmail: "vendeg@example.test",
    guestPhone: "+36 30 000 0000",
    guests: 2,
    message: `<b>üzenet</b><img src=x onerror="${BUMP}">`,
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
  openDay: null,
  openDayBooking: null,
  panel: null,
  requests: [
    req({ id: "bbbbbbbb-0000-0000-0000-000000000001", guestName: EVIL, dateFrom: "2026-09-18", dateTo: "2026-09-20" }),
    req({ id: "bbbbbbbb-0000-0000-0000-000000000002", guestName: `${EVIL} 2`, dateFrom: "2026-09-19", dateTo: "2026-09-21", createdAt: new Date("2026-09-01T12:00:00Z") }),
  ],
  yearAccepted: 0,
  yearCancelled: 0,
  outcome: null,
  expireHours: 48,
};

type Views = { bookingsSection(d: BookingsTabData, lang?: string): string };
let views: Views;
// The pre-fix file goes NEXT TO the real one, so its relative imports resolve unchanged.
const OLD_TMP = "src/server/.bookingViews-prefix.tmp.ts";
if (SELF_TEST) {
  writeFileSync(OLD_TMP, execFileSync("git", ["show", `${PRE_FIX}:src/server/bookingViews.ts`], { encoding: "utf8" }));
  try {
    views = (await import("../src/server/.bookingViews-prefix.tmp.ts")) as Views;
  } finally {
    rmSync(OLD_TMP, { force: true });
  }
} else {
  views = (await import("../src/server/bookingViews.js")) as Views;
}

const html =
  `<!doctype html><html lang="hu"><head><meta charset="utf-8"></head>` +
  `<body>${views.bookingsSection(DATA, "hu")}</body></html>`;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const page = await browser.newPage();
  let dialogs = 0;
  page.on("dialog", async (d) => { dialogs++; await d.dismiss(); });
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(200);
  const opened = await page.evaluate(() => {
    const f = document.querySelector("form[data-bk-overlap]") as HTMLFormElement | null;
    if (!f) return false;
    f.dispatchEvent(new Event("submit", { cancelable: true }));
    return !!document.querySelector(".bk-ovl");
  });
  check("az ütközés-választó létrejön és megnyílik (különben a mérés tárgytalan)", opened);
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => ({
    ran: (window as unknown as { __x?: number }).__x ?? 0,
    imgs: document.querySelectorAll('img[src="x"]').length,
    svgs: document.querySelectorAll("svg[onload]").length,
    scripts: [...document.scripts].filter((s) => (s.textContent ?? "").trim().startsWith("window.__x=")).length,
    nameAsText: document.body.innerText.includes('XSS-Vendég <img src=x onerror='),
    modalNameAsText: (document.querySelector(".bk-ovl")?.textContent ?? "").includes("<svg onload="),
  }));
  check("a payload a betöltéskor és a választó megnyitásakor sem fut le", r.ran === 0 && dialogs === 0, r);
  check("nincs befecskendezett <img src=x> / <svg onload> / <script>", r.imgs === 0 && r.svgs === 0 && r.scripts === 0, r);
  check("a név SZÖVEGKÉNT látszik a lapon", r.nameAsText);
  check("a választó modáljában is szövegként áll a név", r.modalNameAsText);
} finally {
  await browser.close();
}

console.log(failures ? `\n✗ ${failures} hiba` : "\n✓ a vendég neve/üzenete a tulaj adminjában szöveg, nem kód");
if (SELF_TEST) {
  if (!failures) { console.log("⛔ ÖNTESZT: a javítás előtti bookingViews.ts-t ZÖLDNEK látta — az őr vak"); process.exit(1); }
  console.log("✓ ÖNTESZT: a javítás előtti kód pirosat adott"); process.exit(0);
}
process.exit(failures ? 1 : 0);
