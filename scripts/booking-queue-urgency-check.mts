// ŐR — a JÓVÁHAGYOTT várólista-terv kapuja.
// Kontraktus: assets/design-refs/tenant-admin/booking-queue-urgency/README.md
// (tulajdonosi választás 2026-09-14: „A" változat — naptár bal, várólista jobb).
//
// ⛔ A FŐ LELET, amit ez az őr véd: a lista SORRENDJE. Mérve 2026-09-14-én a
// renderelt lapon a négy kérés 46 / 34 / **21** / 28 órányi hátralévő idővel állt
// sorban — a lejárni készülő volt a HARMADIK, mert a kulcs az érkezés napja volt.
// Egy screenshot erre vak: a lista minden sorrendben „rendezettnek" néz ki.
//
// ⛔ ÖNKONTROLL: a várt sorrendet NEM a termék komparátorából számolom. Ha az őr a
// saját alanyát hívná, egy visszarontott rendezés ZÖLD maradna (ez a hibaosztály már
// megtörtént: `feedback_guard_must_not_borrow_its_subject`). Itt a fixture SAJÁT
// határidő-adatából vezetem le, függetlenül.
//
//   npx tsx scripts/booking-queue-urgency-check.mts
//   npx tsx scripts/booking-queue-urgency-check.mts --selftest   (pirosra kell mennie)

process.env.CIT_SHOT = "1";

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { bookingsSection, pendingInOrder, type BookingsTabData } from "../src/server/bookingViews.js";
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

const iso = (o: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + o);
  return d.toISOString().slice(0, 10);
};
const at = (h: number): Date => new Date(Date.now() + h * 3_600_000);

/* ── fixture ──────────────────────────────────────────────────────────────── */

function monthFixture(openDay: string): MonthView {
  const month = iso(0).slice(0, 7);
  const daysIn = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const cells: DayCell[] = [];
  for (let d = 1; d <= daysIn; d++) {
    const day = `${month}-${String(d).padStart(2, "0")}`;
    const source = day === openDay ? "booking" : null;
    cells.push({
      day,
      dom: d,
      blocked: Boolean(source),
      source: source as DayCell["source"],
      editable: day >= iso(0) && !source,
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
    blockedCount: 1,
    importedCount: 0,
  };
}

function reqFixture(o: Partial<InboxItem> & { id: string }): InboxItem {
  return {
    unitName: "A szállás egésze",
    guestName: "Vendég",
    guestEmail: "v@example.com",
    guestPhone: "+36 30 111 2222",
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
    quotedTotal: 64_000,
    quotedCurrency: "HUF",
    ...o,
  };
}

/**
 * A MÉRT eset: a legsürgősebb kérés a LEGKÉSŐBB érkezik. Így a két lehetséges
 * rendezési kulcs ELLENTÉTES sorrendet ad — a fixture nem tud véletlenül átmenni.
 * (A régi kulcs sorrendje: Anna → Péter → Eszter/Gábor; a helyesé: Eszter → Gábor
 * → Péter → Anna.)
 */
const PENDING: InboxItem[] = [
  reqFixture({ id: "r1", guestName: "Kovacs Anna", dateFrom: iso(21), dateTo: iso(24), createdAt: at(-2) }),
  reqFixture({ id: "r2", guestName: "Nagy Peter", dateFrom: iso(28), dateTo: iso(30), createdAt: at(-14) }),
  reqFixture({ id: "r3", guestName: "Toth Eszter", dateFrom: iso(44), dateTo: iso(48), createdAt: at(-27) }),
  reqFixture({ id: "r4", guestName: "Szabo Gabor", dateFrom: iso(44), dateTo: iso(47), createdAt: at(-20) }),
];

const HISTORY: InboxItem[] = [
  reqFixture({
    id: "h1",
    guestName: "Farkas Judit",
    status: "accepted",
    decidedAt: at(-72),
    decidedBy: "owner",
    dateFrom: iso(6),
    dateTo: iso(9),
  }),
  reqFixture({
    id: "h2",
    guestName: "Horvath Reka",
    status: "expired",
    decidedAt: at(-120),
    decidedBy: "system",
    guestEmail: "reka@example.com",
    guestPhone: "+36 30 555 1234",
  }),
];

function tabData(o: Partial<BookingsTabData> = {}): BookingsTabData {
  const openDay = iso(6);
  return {
    units: [{ id: "u1", name: "A szállás egésze" }],
    unitId: "u1",
    month: monthFixture(openDay),
    calendarOpen: true,
    openDay,
    openDayBooking: HISTORY[0]!,
    panel: null,
    requests: [...PENDING, ...HISTORY],
    yearAccepted: 1,
    yearCancelled: 0,
    expireHours: 48,
    outcome: null,
    ...o,
  };
}

/** A kártyák sorrendje a renderelt lapon, a vendégnevekből. */
function renderedOrder(html: string): string[] {
  const out: string[] = [];
  const re = /<div class="bk-req[^"]*" id="req-([^"]+)">[\s\S]*?<strong>([^<]+)<\/strong>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[2]!);
  return out;
}

/* ══ ① A RENDEZÉSI KULCS ═══════════════════════════════════════════════════ */

console.log("\n① A várólistát a VÁLASZ-HATÁRIDŐ rendezi (kontraktus ①):");
{
  const EXPIRE = 48;
  // ⛔ FÜGGETLEN referencia: a fixture SAJÁT createdAt-jából, nem a termék
  // komparátorából. (A határidő = createdAt + ablak, tehát a legrégebbi kérés jár le
  // leghamarabb.) Ha ezt a terméktől kérdezném, a visszarontott rendezés is zöld lenne.
  const expected = [...PENDING]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => r.guestName);

  const html = bookingsSection(tabData({ expireHours: EXPIRE }), "hu");
  const got = SELFTEST
    ? // PIROS ÖNTESZT: a régi, érkezés szerinti kulcs sorrendje.
      [...PENDING]
        .sort((a, b) => (a.dateFrom < b.dateFrom ? -1 : a.dateFrom > b.dateFrom ? 1 : 0))
        .map((r) => r.guestName)
    : renderedOrder(html);

  check(
    "⭐⭐ a kártyák a hátralévő idő szerint NÖVEKVŐ sorrendben állnak",
    JSON.stringify(got) === JSON.stringify(expected),
    `várt: ${expected.join(" → ")} · kapott: ${got.join(" → ")}`,
  );
  check(
    "a legsürgősebb kérés VALÓBAN a legkésőbb érkezik (a fixture nem tud véletlenül átmenni)",
    expected[0] === "Toth Eszter" && PENDING.find((r) => r.guestName === "Toth Eszter")!.dateFrom > PENDING.find((r) => r.guestName === "Kovacs Anna")!.dateFrom,
  );
  check(
    "⭐ a legsürgősebb kártya „Ma lejár” sávot visel (nem csak a sorrend mutatja)",
    /bk-req bk-req--hot/.test(html) && html.includes("Ma lejár"),
  );
}

console.log("\n② Válasz-ablak nélkül visszaesik az ÉRKEZÉS szerinti kulcsra (kontraktus ①):");
{
  const noWindow = pendingInOrder(PENDING, 0).map((r) => r.guestName);
  const byStay = [...PENDING]
    .sort((a, b) => (a.dateFrom < b.dateFrom ? -1 : a.dateFrom > b.dateFrom ? 1 : 0))
    .map((r) => r.guestName);
  check("ablak nélkül az érkezés napja rendez", JSON.stringify(noWindow) === JSON.stringify(byStay), noWindow.join(" → "));
  const withWindow = pendingInOrder(PENDING, 48).map((r) => r.guestName);
  check(
    "⭐ és a KÉT kulcs tényleg MÁS sorrendet ad (különben a ① állítás semmit nem bizonyítana)",
    JSON.stringify(noWindow) !== JSON.stringify(withWindow),
  );
}

/* ══ ③–⑨ A LAP SZÖVEGE ÉS SZERKEZETE ══════════════════════════════════════ */

console.log("\n③–⑨ Amit a lapnak KI KELL MONDANIA:");
{
  const html = bookingsSection(tabData(), "hu");

  check(
    "③ a lap KIMONDJA, mi rendez",
    html.includes("A sorrendet a válasz-határidő adja"),
  );
  const noWin = bookingsSection(tabData({ expireHours: 0 }), "hu");
  check(
    "③b ablak nélkül azt mondja ki, hogy az érkezés napja rendez",
    noWin.includes("A sorrendet az érkezés napja adja"),
  );

  // ④ a csempe NEM nyit másodlagos listát ugyanazokból a sorokból
  const pendPanel = bookingsSection(tabData({ panel: "pend" }), "hu");
  check(
    "④ a „Döntésre vár” csempe NEM nyit duplikált kérés-listát",
    !pendPanel.includes("Koppintson egy sorra — a kéréshez ugrik."),
  );
  check(
    "④b helyette a listához ugrik, és megnevezi a legsürgősebbet",
    html.includes('href="#kerelmek"') && /a legsürgősebb \d+ óra/.test(html),
  );

  // ⑥ fedés-popup: hónap + szín→név kulcs
  check(
    "⑥ a fedés-választó naptára megnevezi a hónapot",
    html.includes("bk-ovmonth") && html.includes('"months"'),
  );
  check(
    "⑥b és minden színhez NEVET ad (a fedésnek is)",
    html.includes("bk-ovkey") && html.includes('"both"'),
  );

  // ⑦ a lezárt sor továbbvisz a vendéghez
  check(
    "⑦ a LEJÁRT sor viszi az elérhetőséget és kínál utat",
    html.includes("bk-reach") &&
      html.includes("reka@example.com") &&
      html.includes("mailto:reka@example.com") &&
      html.includes("Írok neki"),
  );
  check(
    "⑦b a lejárat jelvénye NEM a legcsendesebb (borostyán, nem szürke)",
    html.includes("bk-chip--lost") && !/bk-chip--mut">Lejárt/.test(html),
  );

  // ⑧ üres állapot: MONDAT
  const empty = bookingsSection(
    tabData({ requests: [], openDay: null, openDayBooking: null, yearAccepted: 0 }),
    "hu",
  );
  check(
    "⑧ üres állapotban MONDAT áll a gondolatjel helyén",
    empty.includes("Nincs bejelentett érkezés") && !empty.includes('bk-tile__v">—<'),
  );
  check(
    "⑧b a csempe megnevezi, MIT számol",
    html.includes("Idén visszaigazolt — jelenleg érvényes"),
  );

  // ⑨ egy képernyő, egy dátum-írásmód
  const shortForms = html.match(/\b(jan|febr|márc|ápr|máj|jún|júl|aug|szept|okt|nov|dec)\.\s\d{1,2}\./g) ?? [];
  check(
    "⑨ a lapon NINCS rövid dátum-alak (egyféle írásmód)",
    shortForms.length === 0,
    shortForms.slice(0, 3).join(", "),
  );
  check(
    "⑨b a teljes alak viszont ott van",
    /\d{4}\. \d{2}\. \d{2}\./.test(html),
  );
}

/* ══ ⑤ + ELRENDEZÉS — GEOMETRIA, böngészőben ══════════════════════════════ */

console.log("\n⑤ A nap-panel a RÁCS FÖLÖTT, és a jóváhagyott elrendezés (geometria):");
{
  const html = bookingsSection(tabData(), "hu");
  // ⛔ ÖNTESZT: egy CSS-sor visszarontja az elrendezést egy hasábra. Ha az őr ezt
  // nem veszi észre, akkor a „naptár bal, lista jobb" állítás dísz, nem kapu.
  const sabotage = SELFTEST
    ? `<style>@media(min-width:900px){.bk-cols{display:block !important}}
       .bk-dayinfo{order:9}.bk-cal__body{display:flex !important;flex-direction:column}</style>`
    : "";
  const page =
    `<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8">` +
    // ⛔ A VIEWPORT-META NÉLKÜL a mobil emuláció 980 px-es elrendezési nézetet ad, és a
    // `@media(min-width:900px)` 390 px-en is illeszkedik — az őr a SAJÁT harness-ét
    // mérte volna, nem a terméket (mérve: calLeft 282 / listLeft 642 @390). A valódi
    // admin-váz (adminViews › shell) is kiírja ezt a sort.
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<link rel="stylesheet" href="${pathToFileURL(path.join(ROOT, "public/assets/ui/citui.css")).href}">` +
    `<link rel="stylesheet" href="${pathToFileURL(path.join(ROOT, "public/assets/ui/citui-admin.css")).href}">` +
    `</head><body><div class="adm-shell"><aside class="adm-side"></aside>` +
    `<main class="adm-main"><div class="adm-main__inner">${html}</div></main></div>${sabotage}</body></html>`;
  const dir = await mkdtemp(path.join(tmpdir(), "b8-queue-"));
  const file = path.join(dir, "tab.html");
  await writeFile(file, page, "utf8");

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  for (const width of [390, 1280]) {
    const p = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width === 390 });
    await p.goto(pathToFileURL(file).href);
    await p.waitForTimeout(250);
    const geo = (await p.evaluate(`(() => {
      var panel = document.querySelector(".bk-dayinfo");
      var grid = document.querySelector(".bk-grid");
      var cal = document.querySelector(".bk-cols__cal");
      var list = document.querySelector(".bk-cols__list");
      if (!panel || !grid || !cal || !list) return null;
      var pr = panel.getBoundingClientRect(), gr = grid.getBoundingClientRect();
      var cr = cal.getBoundingClientRect(), lr = list.getBoundingClientRect();
      return {
        panelAboveGrid: pr.bottom <= gr.top + 1,
        sideBySide: cr.right <= lr.left + 1 && Math.abs(cr.top - lr.top) < 60,
        stacked: lr.top >= cr.bottom - 1,
        nums: { calTop: Math.round(cr.top), calBottom: Math.round(cr.bottom),
                listTop: Math.round(lr.top), listLeft: Math.round(lr.left), calLeft: Math.round(cr.left) },
        calSticky: getComputedStyle(cal).position
      };
    })()`)) as { panelAboveGrid: boolean; sideBySide: boolean; stacked: boolean; calSticky: string; nums: Record<string, number> } | null;

    check(`@${width}px a mérés elvégezhető (megvan mind a négy horgony)`, geo !== null);
    if (!geo) continue;
    check(`@${width}px ⭐ a nap-panel a RÁCS FÖLÖTT van`, geo.panelAboveGrid);
    if (width === 1280) {
      check("@1280px ⭐⭐ a NAPTÁR BAL, a lista JOBB (tulajdonosi választás)", geo.sideBySide);
      check("@1280px a naptár görgetéskor TAPAD", geo.calSticky === "sticky");
    } else {
      check("@390px egy hasáb, a naptár ELÖL (külön elrendezés, nem lekicsinyítve)", geo.stacked, JSON.stringify(geo.nums));
    }
    await p.close();
  }
  await browser.close();
}

/* ══ verdikt ══════════════════════════════════════════════════════════════ */

if (SELFTEST) {
  const wantedReds = [
    "⭐⭐ a kártyák a hátralévő idő szerint NÖVEKVŐ sorrendben állnak",
    "@1280px ⭐⭐ a NAPTÁR BAL, a lista JOBB (tulajdonosi választás)",
  ];
  const missed = wantedReds.filter((w) => !failures.includes(w));
  if (!missed.length) {
    console.log(
      `\n✅ ÖNTESZT: a visszarontott rendezés ÉS a visszarontott elrendezés is pirosra ment ` +
        `(${failures.length} bukás) — az őr mindkettőt látja.`,
    );
    process.exit(0);
  }
  console.log(`\n⛔ ÖNTESZT BUKOTT: ezek NEM mentek pirosra: ${missed.join(" · ")}`);
  process.exit(1);
}

if (failures.length) {
  console.log(`\n⛔ ${failures.length} bukás:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\n✅ booking-queue-urgency-check: a szállított várólista a jóváhagyott tervet követi.");
