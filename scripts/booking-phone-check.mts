// A tulaj foglaláskezelése TELEFONON — a jóváhagyott „A” terv őre (FK-015, ADR-0274).
// Kontraktus: assets/design-refs/tenant-admin/booking-phone/README.md.
//
// A TELJES admin-oldalt méri (`adminDashboard()` — a valódi keret: felső sáv, alsó
// menüsor, citui-admin.css), valódi mobil-kontextusban, ÁLLÓ 390×844 és FEKVŐ 844×390
// méretben. Nem a DOM-ot kérdezi, hanem a GEOMETRIÁT: a döntő gomb a képernyőn van-e,
// a felső sáv alatt és az alsó menüsor fölött, legalább 44 px magasan. A FK-015 éjszakai
// kör épp ezt mérte hibásnak: a gombok a hajtás alatt ültek, 36 px-esek voltak, a
// megerősítőben nem volt „Mégsem”, a telefonszám sima szöveg volt, és a naptár a mai
// hónapon nyílt, nem a kért hónapon.
//
//   npx tsx scripts/booking-phone-check.mts            → zöld = a szállított felület tartja a tervet
//   npx tsx scripts/booking-phone-check.mts --selftest → a RÉGI elrendezést visszaállítva PIROSNAK kell lennie
//
// Adatbázist NEM ír és nem olvas: a fixture a FK-015 valódi alanya (Myrna Haus, Elek
// Vendég kérése, 56 000 Ft; egy árajánlat-kérés), a termék típusaiból építve.

import path from "node:path";
import { readFile } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { adminDashboard, type MessagesAdminData } from "../src/server/adminViews.js";
import { calendarFocus, type BookingsTabData } from "../src/server/bookingViews.js";
import type { InboxItem } from "../src/booking/requests.js";
import type { MonthView } from "../src/tenant/availability.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELFTEST = process.argv.includes("--selftest");
// --shots <dir>: also photograph the measured states (the report's pictures). Off by default.
const SHOTS = (() => {
  const i = process.argv.indexOf("--shots");
  return i > 0 ? path.resolve(process.argv[i + 1] ?? "") : null;
})();
async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

let fails = 0;
const failed: string[] = [];
function check(label: string, ok: boolean, detail?: unknown): boolean {
  console.log(`  ${ok ? "✅" : "❌"} ${label}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) {
    fails++;
    failed.push(label);
  }
  return ok;
}

/* ── fixture: the FK-015 subject, built from the product's own shapes ─────────── */

const NOW = Date.now();
// Every field written out: scripts/ are NOT type-checked (reference_scripts_are_not_typechecked),
// a missing one would reach the view as a silent `undefined`.
const req = (o: Partial<InboxItem> & { id: string }): InboxItem => ({
  unitId: "u-nadas",
  unitName: "Nádas apartman",
  guestName: "Elek Vendég Éjszakai",
  guestEmail: "elek@citoviso.com",
  guestPhone: "+36 30 555 0101",
  dateFrom: "2026-10-24",
  dateTo: "2026-10-26",
  guests: 2,
  message: "Kisállattal érkeznénk, lehetséges?",
  status: "pending",
  token: "tok-booking-0000000000001",
  createdAt: new Date(NOW - 60_000),
  decidedAt: null,
  decidedBy: null,
  decisionNote: null,
  seen: false,
  quotedTotal: 56000,
  quotedCurrency: "HUF",
  offeredAt: null,
  ...o,
});
const R1 = req({ id: "11111111-aaaa-4bbb-8ccc-000000000001" });
const R2 = req({
  id: "22222222-aaaa-4bbb-8ccc-000000000002",
  unitId: "u-egesz",
  unitName: "A szállás egésze",
  guestName: "Elek Vendég Ajánlat",
  guestPhone: "+36 30 555 0102",
  dateFrom: "2026-11-13",
  dateTo: "2026-11-15",
  message: "Baráti társasággal jönnénk, hat felnőtt.",
  token: "tok-quote-00000000000000002",
  createdAt: new Date(NOW - 30_000),
  quotedTotal: null,
  quotedCurrency: null,
});
const REQS = [R1, R2];
const UNITS = [
  { id: "u-egesz", name: "A szállás egésze" },
  { id: "u-nadas", name: "Nádas apartman" },
  { id: "u-kishazi", name: "Kisházi szoba" },
];

function october(): MonthView {
  const cells = Array.from({ length: 31 }, (_, i) => {
    const d = i + 1;
    const day = `2026-10-${String(d).padStart(2, "0")}`;
    return { day, dom: d, blocked: false, source: null, editable: true, past: false, detail: null };
  });
  return {
    month: "2026-10",
    label: "2026. október",
    prevMonth: "2026-09",
    nextMonth: "2026-11",
    leadingBlanks: 3,
    cells,
    blockedCount: 0,
    importedCount: 0,
  };
}

const bookings: BookingsTabData = {
  units: UNITS,
  unitId: "u-nadas",
  month: october(),
  calendarOpen: false,
  openDay: null,
  openDayBooking: null,
  panel: null,
  requests: REQS,
  targetId: null,
  sentOffers: [],
  yearAccepted: 0,
  yearCancelled: 0,
  expireHours: 48,
  outcome: null,
};

const MAIL_BODY = [
  "Új foglalási kérés — Nádas apartman",
  "",
  "Vendég: Elek Vendég Éjszakai",
  "Hivatkozás: FG-111111",
  "Érkezés: 2026. 10. 24.",
  "Távozás: 2026. 10. 26.",
  "Létszám: 2 fő",
  "Ár összesen (a foglaláskori árlista szerint): 56 000 Ft",
  "Telefon: +36 30 555 0101",
  "E-mail: elek@citoviso.com",
  "",
  "Üzenete:",
  "Kisállattal érkeznénk, lehetséges?",
  "",
  `Elfogadom: https://myrna-haus.citoviso.com/foglalas/${R1.token}/elfogadom`,
  `Nem szabad: https://myrna-haus.citoviso.com/foglalas/${R1.token}/elutasitom`,
  "",
  "A vendég csak azután kap visszaigazolást, hogy Ön döntött.",
].join("\n");

const THREAD = { key: null, supersededBy: null, isLatestOfThread: false, olderCount: 0, subject: null, supersedesTitle: null };
const messages: MessagesAdminData = {
  messages: [
    {
      id: "m1",
      channel: "email",
      kind: "booking",
      subject: "Foglalási kérés: Elek Vendég Éjszakai, 2026. 10. 24.–2026. 10. 26.",
      bodyText: MAIL_BODY,
      recipient: "myrna@example.com",
      attachmentName: null,
      relatedKind: null,
      relatedId: null,
      sentAt: new Date(NOW - 60_000),
      readAt: new Date(),
      thread: THREAD,
    },
  ],
  unread: 0,
  topic: "mind",
  channel: "",
  unreadOnly: false,
  q: "",
  total: 1,
  mindCount: 1,
  topicCounts: { foglalas: 1, szamlazas: 0, honlap: 0, fiok: 0 },
  channelCounts: { email: 1, sms: 0 },
  unreadCount: 0,
  openId: "m1",
  openThreads: [],
  confirmRead: false,
} as MessagesAdminData;

const session = { tenantId: "t1", username: "myrna@example.com", displayName: "Myrna Haus" } as never;
const content = {
  lang: "hu",
  status: "live",
  name: "Myrna Haus",
  usingOwnPhotos: true,
  intro: "x".repeat(60),
  photos: [],
} as never;
const common = { siteSlug: "myrna-haus", pendingBookings: 2 };

const PAGES = {
  foglalasok: adminDashboard(session, content, { ...common, tab: "foglalasok", bookings }),
  uzenetek: adminDashboard(session, content, { ...common, tab: "uzenetek", messages }),
  attekintes: adminDashboard(session, content, {
    ...common,
    tab: "attekintes",
    overview: {
      visitors7: 0,
      visitsByDay: [0, 0, 0, 0, 0, 0, 0],
      messages: [],
      pendingBookings: { items: REQS, expireHours: 48 },
    },
  }),
};

// ⛔ ÖNTESZT: the OLD layout and controls, put back by CSS — calendar first, 36 px
// buttons, no call link, the confirmation squeezed into half the row.
const SABOTAGE = `<style>
.bk-cols__dec{order:2}.bk-cols__cal{order:1}.bk-cols{display:flex!important;flex-direction:column}
.bk-verdict summary{min-height:36px!important;padding:6px 10px!important}
.bk-req__reach a[href^="tel:"]{display:none!important}
.bk-verdict[open]{max-width:45%!important}
.bk-cf [data-bk-cfno]{display:none!important}
.adm-pendstrip{display:none!important}
.adm-msg__body{display:flex!important;flex-direction:column}.adm-msg__dec{order:2}
.adm-msg__body>p{min-height:700px}
</style>`;

/* ── serving: the page + the real stylesheets from public/ ────────────────────── */

async function load(page: Page, html: string, hash = ""): Promise<string[]> {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/admin") {
      const body = SELFTEST ? html.replace("</head>", `${SABOTAGE}</head>`) : html;
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body });
    }
    if (url.pathname.startsWith("/assets/")) {
      try {
        const body = await readFile(path.join(ROOT, "public", url.pathname));
        const type = url.pathname.endsWith(".css") ? "text/css" : url.pathname.endsWith(".js") ? "text/javascript" : "application/octet-stream";
        return route.fulfill({ status: 200, contentType: type, body });
      } catch {
        return route.fulfill({ status: 404, body: "" });
      }
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto(`http://guard.local/admin${hash}`);
  await page.waitForTimeout(150);
  await settle(page);
  return errs;
}

/**
 * Wait until the page stops scrolling. `html{scroll-behavior:smooth}` (citui.css) turns the
 * product's scrollIntoView into an ANIMATION — a fixed 150 ms wait measured it mid-flight
 * under land load (y 872 → a false red). Two equal readings 120 ms apart, at most 4 s.
 */
async function settle(page: Page): Promise<void> {
  let last = -1;
  for (let i = 0; i < 33; i++) {
    const y = (await page.evaluate("scrollY")) as number;
    if (y === last) return;
    last = y;
    await page.waitForTimeout(120);
  }
}

type Geo = { found: boolean; top: number; bottom: number; h: number; field: [number, number] };
/** The visible field: under the sticky top bar, above the bottom nav (if shown). */
// ⚠️ A string, not a closure: tsx/esbuild wraps named inner functions in `__name()`,
// which does not exist in the page (same trick as booking-queue-urgency-check).
async function geo(page: Page, sel: string, overlay = false): Promise<Geo> {
  return (await page.evaluate(`(() => {
    var s = ${JSON.stringify(sel)}, ov = ${overlay ? "true" : "false"};
    function vis(e) {
      if (!e) return false;
      var cs = getComputedStyle(e), r = e.getBoundingClientRect();
      return cs.display !== "none" && cs.visibility !== "hidden" && r.height > 0;
    }
    var el = document.querySelector(s);
    var topbar = Array.from(document.querySelectorAll(".adm-top")).find(vis);
    var nav = Array.from(document.querySelectorAll(".adm-bnav")).find(vis);
    var top = ov ? 0 : topbar ? topbar.getBoundingClientRect().bottom : 0;
    var bottom = ov ? innerHeight : nav ? nav.getBoundingClientRect().top : innerHeight;
    if (!vis(el)) return { found: false, top: 0, bottom: 0, h: 0, field: [top, bottom] };
    var r = el.getBoundingClientRect();
    return { found: true, top: r.top, bottom: r.bottom, h: r.height, field: [top, bottom] };
  })()`)) as Geo;
}
async function onScreen(page: Page, label: string, sel: string, minH = 44): Promise<void> {
  const g = await geo(page, sel);
  check(
    label,
    g.found && g.top >= g.field[0] - 1 && g.bottom <= g.field[1] + 1 && g.h >= minH,
    { y: [Math.round(g.top), Math.round(g.bottom)], látható: g.field.map(Math.round), h: Math.round(g.h), found: g.found },
  );
}

/* ── the run ──────────────────────────────────────────────────────────────────── */

console.log(`\nFOGLALÁSKEZELÉS TELEFONON — őr${SELFTEST ? "  [ÖNTESZT: a régi elrendezéssel BUKNIA KELL]" : ""}`);

console.log("\n④ A naptár a következő döntés hónapján (tiszta függvény):");
{
  const f = calendarFocus(REQS, 48, null, "2026-09-29");
  check("④ kérés nélküli URL → a legsürgősebb kérés szobája és hónapja", f?.id === R1.id && f.dateFrom.slice(0, 7) === "2026-10", f?.id);
  const t = calendarFocus(REQS, 48, R2.token, "2026-09-29");
  check("④ a levél linkje (?k=) arra a kérésre nyit", t?.id === R2.id, t?.id);
  const acc = calendarFocus([{ ...R1, status: "accepted" }], 48, null, "2026-09-29");
  check("④ döntésre váró nélkül → a következő érkezés", acc?.id === R1.id, acc?.id);
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });
for (const [tag, w, h] of [["álló", 390, 844], ["fekvő", 844, 390]] as const) {
  const mk = async (): Promise<Page> =>
    (await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  const P = `[${tag} ${w}×${h}]`;

  console.log(`\n${P} Foglalások fül:`);
  {
    const page = await mk();
    const errs = await load(page, PAGES.foglalasok);
    await shot(page, `${tag}-1-foglalasok`);
    const iw = await page.evaluate(() => innerWidth);
    check(`${P} a layout-viewport = a készülék (${iw})`, iw === w);
    const R = `#req-${R1.id}`;
    await onScreen(page, `${P} ② „Visszaigazolom” a képernyőn, görgetés nélkül, ≥44 px`, `${R} details.bk-verdict:first-of-type > summary`);
    await onScreen(page, `${P} ② „Elutasítom” a képernyőn, görgetés nélkül, ≥44 px`, `${R} details.bk-verdict:last-of-type > summary`);
    const order = await page.evaluate(() => {
      const d = document.querySelector(".bk-cols__dec")!.getBoundingClientRect();
      const c = document.querySelector(".bk-cols__cal")!.getBoundingClientRect();
      return { dec: Math.round(d.top), cal: Math.round(c.top) };
    });
    check(`${P} ② a döntésre váró kérések a naptár ELŐTT`, order.dec < order.cal, order);
    const tel = await page.getAttribute(`${R} .bk-req__reach a[href^="tel:"]`, "href").catch(() => null);
    const telGeo = await geo(page, `${R} .bk-req__reach a[href^="tel:"]`);
    check(`${P} ⑤ „Felhívom” = tel: link, látható, ≥44 px`, tel === "tel:+36305550101" && telGeo.found && telGeo.h >= 44, { tel, h: telGeo.h });
    await page.click(`${R} details.bk-verdict:first-of-type > summary`);
    await page.waitForTimeout(120);
    await settle(page);
    await shot(page, `${tag}-2-megerosito`);
    const cf = await page.evaluate((r) => (document.querySelector(`${r} .bk-cf`) as HTMLElement | null)?.innerText ?? "", R);
    check(`${P} ③ a megerősítő MEGNEVEZI a vendéget`, cf.includes("Visszaigazolja Elek Vendég Éjszakai foglalását?"), cf.slice(0, 80));
    const wide = await page.evaluate((r) => {
      const p = document.querySelector(`${r} .bk-cf`)?.getBoundingClientRect();
      const c = document.querySelector(r)!.getBoundingClientRect();
      return p ? Math.round((p.width / c.width) * 100) : 0;
    }, R);
    check(`${P} ③ a megerősítő a kártya teljes szélességét kapja (≥ 85%)`, wide >= 85, `${wide}%`);
    await onScreen(page, `${P} ③ „Mégsem” a képernyőn, ≥44 px`, `${R} [data-bk-cfno]`);
    await onScreen(page, `${P} ③ „Igen, visszaigazolom” a képernyőn, ≥44 px`, `${R} .bk-cf button[type=submit]`);
    const other = await geo(page, `${R} details.bk-verdict:last-of-type > summary`);
    check(`${P} ③ nyitott megerősítő mellett az ellentétes döntés NEM látszik`, !other.found);
    await page.click(`${R} [data-bk-cfno]`).catch(() => undefined);
    await page.waitForTimeout(120);
    const closed = await page.evaluate((r) => !(document.querySelector(`${r} details.bk-verdict[open]`)), R);
    check(`${P} ③ a „Mégsem” bezárja, nem dönt`, closed);
    // the quote card's hint sits inside the padding (FK-015 ⑦)
    const pad = await page.evaluate((id) => {
      const hint = document.querySelector(`#req-${id} [data-bk-quote]`)?.getBoundingClientRect();
      const card = document.querySelector(`#req-${id}`)!.getBoundingClientRect();
      return hint ? Math.round(hint.left - card.left) : -1;
    }, R2.id);
    check(`${P} ⑦ az árajánlat-magyarázat a kártya belső margóján belül (≥ 12 px)`, pad >= 12, pad);
    const reqDays = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".bk-day--req")).map((d) => d.textContent).join(","),
    );
    check(`${P} ④ a kért éjszakák jelölve a naptárban (24, 25)`, reqDays === "24,25", reqDays);
    const calT = await page.evaluate(() => (document.querySelector(".bk-cal__t") as HTMLElement).innerText);
    check(`${P} ④ a csukott naptár kimondja a kérést és a szobát`, calT.includes("Kérés vár: 2026. 10. 24. → 2026. 10. 26.") && calT.includes("Nádas apartman"), calT);
    const badge = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="tab=foglalasok"] .adm-bdg')).map((b) => b.textContent).join(","),
    );
    check(`${P} ① a Foglalások jelvénye a nyitott fülön is a döntésre várók száma (2)`, badge.split(",").includes("2"), badge);
    check(`${P} nincs JS-hiba`, errs.length === 0, errs);
    await page.context().close();
  }

  console.log(`\n${P} Üzenetek — a megnyitott foglalási levél:`);
  {
    const page = await mk();
    const errs = await load(page, PAGES.uzenetek, "#uz-m1");
    await shot(page, `${tag}-3-level`);
    await onScreen(page, `${P} ② „Foglalások megnyitása” a képernyőn, ≥44 px`, ".adm-msg__acts .citui-btn");
    const href = await page.getAttribute(".adm-msg__acts .citui-btn", "href");
    check(`${P} ② a fő gomb AZT a kérést nyitja`, href === `/admin?tab=foglalasok&k=${R1.token}#kerelem`, href);
    await onScreen(page, `${P} ② gyors döntés „Elfogadom” a képernyőn, ≥44 px`, ".adm-msg__qd--ok > summary");
    await page.click(".adm-msg__qd--ok > summary");
    await page.waitForTimeout(120);
    await settle(page);
    await shot(page, `${tag}-4-level-megerosito`);
    const q = await page.evaluate(() => (document.querySelector(".adm-msg__qd--ok .adm-confirm") as HTMLElement | null)?.innerText ?? "");
    check(`${P} ② a gyors döntés megerősítője megnevezi a vendéget`, q.includes("Elek Vendég Éjszakai"), q.slice(0, 80));
    await onScreen(page, `${P} ② „Mégsem” a gyors döntésnél, ≥44 px`, ".adm-msg__qd--ok [data-msg-cfno]");
    await onScreen(page, `${P} ② „Igen, elfogadom” a képernyőn, ≥44 px`, ".adm-msg__qd--ok .citui-btn--primary");
    const no = await geo(page, ".adm-msg__qd--no > summary");
    check(`${P} ② nyitott megerősítő alatt NEM az ellentétes döntés áll`, !no.found);
    const tel = await page.getAttribute('.adm-msg__body a[href^="tel:"]', "href").catch(() => null);
    check(`${P} ⑤ a levél telefonszáma koppintható`, tel === "tel:+36305550101", tel);
    check(`${P} nincs JS-hiba`, errs.length === 0, errs);
    await page.context().close();
  }

  console.log(`\n${P} Áttekintés:`);
  {
    const page = await mk();
    const errs = await load(page, PAGES.attekintes);
    await shot(page, `${tag}-5-attekintes`);
    await onScreen(page, `${P} ① „2 kérés vár az Ön döntésére” sáv a képernyőn`, "[data-pending-strip]");
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-todo="booking-pending"]')).map((li) => ({
        t: (li.querySelector("strong") as HTMLElement).innerText,
        href: li.querySelector("a")!.getAttribute("href"),
      })),
    );
    check(
      `${P} ① Teendők: a foglalási kérés sora a kérésre visz`,
      rows.some((r) => r.t === "Döntésre vár: Elek Vendég Éjszakai" && r.href === `/admin?tab=foglalasok&k=${R1.token}#kerelem`),
      rows,
    );
    check(
      `${P} ① Teendők: az árajánlat-kérés sora az ajánlat-lapra visz`,
      rows.some((r) => r.t === "Árajánlatot vár: Elek Vendég Ajánlat" && r.href === `/foglalas/${R2.token}/ajanlat`),
      rows,
    );
    check(`${P} nincs JS-hiba`, errs.length === 0, errs);
    await page.context().close();
  }
}
if (SHOTS) {
  // desktop pictures only (the desktop layout is the approved "calendar left, list right")
  for (const [name, html, hash] of [
    ["asztali-1-foglalasok", PAGES.foglalasok, ""],
    ["asztali-3-level", PAGES.uzenetek, "#uz-m1"],
  ] as const) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await load(page, html, hash);
    if (name === "asztali-1-foglalasok") {
      await page.click(`#req-${R1.id} details.bk-verdict:first-of-type > summary`);
      await page.waitForTimeout(200);
    }
    await shot(page, name);
    await page.context().close();
  }
}
await browser.close();

if (SELFTEST) {
  // Every geometric / visible claim must go RED under the old layout; the pure-function
  // and markup-only branches (④ focus, badge, links) are NOT expected to — said out loud.
  const wantedReds = [
    "② „Visszaigazolom” a képernyőn",
    "② a döntésre váró kérések a naptár ELŐTT",
    "⑤ „Felhívom” = tel: link",
    "② „Foglalások megnyitása” a képernyőn",
    "③ a megerősítő a kártya teljes szélességét",
    "① „2 kérés vár az Ön döntésére” sáv",
  ];
  const missing = wantedReds.filter((w) => !failed.some((f) => f.includes(w)));
  console.log(
    `\nÖNTESZT: ${missing.length ? `❌ nem ment pirosra: ${missing.join(" · ")}` : "✅ minden rontás pirosra ment"} (${fails} piros ág)`,
  );
  console.log("   (szándékosan nem rontva: a ④ tiszta függvény, a jelvény és a linkek célja — azokat CSS nem éri el)");
  process.exit(missing.length ? 1 : 0);
}
console.log(`\n${fails ? `❌ ${fails} bukás` : "✅ minden rendben"}`);
process.exit(fails ? 1 : 0);
