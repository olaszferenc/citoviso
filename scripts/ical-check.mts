// Deterministic behaviour check for the iCal availability layer (src/booking/ical.ts).
//
// Offline, no network, no DB, no npm test runner: fixtures only. Every case
// prints ✓ or ✗ and the process exits 1 if anything fails, so it can be wired
// into a pre-commit hook or CI as-is.
//
// The fixtures are shaped like the real feeds we will consume (Booking.com,
// Airbnb, Google Calendar / PMS exports) including their quirks: property order
// reversed, folded lines, DESCRIPTION carrying a folded URL, CANCELLED events,
// timed DATE-TIME events, and truncated downloads.
//
// Run: npx tsx scripts/ical-check.mts

import {
  addDays,
  buildIcs,
  daysBetween,
  daysToRanges,
  escapeIcsText,
  foldIcsLine,
  icsToBlockedDays,
  icsToBlockedDaysDetailed,
  importIcsBlockedDays,
  isCalendarDay,
  mergeDayRanges,
  parseIcs,
  parseIcsDetailed,
  unescapeIcsText,
  unfoldIcsLines,
  type IcsEvent,
} from "../src/booking/ical.js";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed++;
    console.log(`✓ ${label}`);
  } else {
    failed++;
    console.log(`✗ ${label}${detail ? `\n    → ${detail}` : ""}`);
  }
}

function eq<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(label, a === e, `kapott: ${a}\n    várt:  ${e}`);
}

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);
}

/** Join lines with CRLF, the way a real server sends a feed. */
function ics(...lines: string[]): string {
  return lines.join("\r\n") + "\r\n";
}

/* ================================================================== *
 * 1. Booking.com-shaped feed
 * ================================================================== */

section("Booking.com-szerű feed");

const BOOKING_FEED = ics(
  "BEGIN:VCALENDAR",
  "PRODID:-//Booking.com//Booking.com Calendar//EN",
  "VERSION:2.0",
  "CALSCALE:GREGORIAN",
  "BEGIN:VEVENT",
  // Booking.com emits DTEND BEFORE DTSTART — order must not matter.
  "DTEND;VALUE=DATE:20260907",
  "DTSTART;VALUE=DATE:20260904",
  "SUMMARY:CLOSED - Not available",
  "UID:2f8a1c9e4b7d0000@booking.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260910",
  "DTSTART;VALUE=DATE:20260909",
  "SUMMARY:CLOSED - Not available",
  "UID:2f8a1c9e4b7d0001@booking.com",
  "END:VEVENT",
  "END:VCALENDAR",
);

const booking = parseIcs(BOOKING_FEED);
eq("két VEVENT beolvasva", booking.length, 2);
eq("első UID megőrizve", booking[0].uid, "2f8a1c9e4b7d0000@booking.com");
eq("első SUMMARY", booking[0].summary, "CLOSED - Not available");
eq("egész napos esemény felismerve", booking[0].allDay, true);
eq("DTEND kiolvasva (sorrendtől függetlenül)", booking[0].endExclusive, "2026-09-07");
eq("éjszakák száma 09-04 → 09-07", booking[0].nights, 3);
eq("egy-éjszakás foglalás", booking[1].nights, 1);

// ⚠️ A LEGFONTOSABB ÜZLETI ÁLLÍTÁS: a távozás napja SZABAD.
eq(
  "DTEND EXKLUZÍV: 09-07 (távozás) NEM foglalt",
  icsToBlockedDays(booking),
  ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-09"],
);
check(
  "a távozás napja bookolható (same-day turnover)",
  !icsToBlockedDays(booking).includes("2026-09-07"),
);

/* ================================================================== *
 * 2. Airbnb-shaped feed with folded lines
 * ================================================================== */

section("Airbnb-szerű feed + sortördelés (folded lines)");

const AIRBNB_FEED = ics(
  "BEGIN:VCALENDAR",
  "PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "CALSCALE:GREGORIAN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260912",
  "DTSTART;VALUE=DATE:20260909",
  "UID:14a0c1f2e3d4b5a6@airbnb.com",
  // Folded SUMMARY: continuation starts with ONE space.
  "SUMMARY:Kovács János - Airbnb foglalás - 4 fő - Balatonszemes\\, Fő utca ",
  " 12. - HMABCDEFG",
  // Folded DESCRIPTION with a URL cut mid-token, plus a TAB-folded line.
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/d",
  " etails/HMABCDEFG",
  "\tPhone Number (Last 4 Digits): 1234",
  "END:VEVENT",
  "END:VCALENDAR",
);

const airbnb = parseIcs(AIRBNB_FEED);
eq("egy VEVENT", airbnb.length, 1);
eq(
  "összefűzött SUMMARY (folded + escape-elt vessző)",
  airbnb[0].summary,
  "Kovács János - Airbnb foglalás - 4 fő - Balatonszemes, Fő utca 12. - HMABCDEFG",
);
eq("Airbnb foglalás éjszakái", icsToBlockedDays(airbnb), [
  "2026-09-09",
  "2026-09-10",
  "2026-09-11",
]);

// Direct unfolding checks (space-fold, tab-fold, bare LF, bare CR).
eq(
  "unfold: szóközös folytatás",
  unfoldIcsLines("SUMMARY:Hosszú\r\n  szöveg"),
  ["SUMMARY:Hosszú szöveg"],
);
eq("unfold: tab-os folytatás", unfoldIcsLines("SUMMARY:abc\r\n\tdef"), [
  "SUMMARY:abcdef",
]);
eq("unfold: csupasz LF is működik", unfoldIcsLines("A:1\nB:2"), ["A:1", "B:2"]);
eq("unfold: csupasz CR is működik", unfoldIcsLines("A:1\rB:2"), ["A:1", "B:2"]);
check(
  "a NEM tördelt sor nem ragad össze",
  unfoldIcsLines("DTSTART;VALUE=DATE:20260904\r\nDTEND;VALUE=DATE:20260907").length === 2,
);

// The classic failure mode: a folded DTSTART.
const FOLDED_DTSTART = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:folded@test",
  "DTSTART;VALUE=DAT",
  " E:20260904",
  "DTEND;VALUE=DATE:20260906",
  "END:VEVENT",
  "END:VCALENDAR",
);
eq(
  "tördelt DTSTART property-név is helyreáll",
  icsToBlockedDays(parseIcs(FOLDED_DTSTART)),
  ["2026-09-04", "2026-09-05"],
);

/* ================================================================== *
 * 3. All-day vs timed (DATE-TIME) events
 * ================================================================== */

section("Egész napos vs. időpontos (DATE-TIME)");

const TIMED_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Some PMS//EN",
  "BEGIN:VEVENT",
  "UID:timed-1@pms",
  "SUMMARY:Check-in 14:00 / check-out 10:00",
  "DTSTART:20260904T140000Z",
  "DTEND:20260906T100000Z",
  "END:VEVENT",
  "END:VCALENDAR",
);
const timed = parseIcs(TIMED_FEED);
eq("időpontos esemény kind", timed[0].startKind, "date-time");
eq("időpontos esemény nem all-day", timed[0].allDay, false);
eq("időpontos: kezdő nap", timed[0].start, "2026-09-04");
eq("időpontos: exkluzív vég a DTEND napja", timed[0].endExclusive, "2026-09-06");
eq("időpontos foglalás éjszakái (2)", icsToBlockedDays(timed), [
  "2026-09-04",
  "2026-09-05",
]);

const MIDNIGHT_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:midnight@pms",
  "DTSTART:20260904T140000Z",
  "DTEND:20260905T000000Z",
  "END:VEVENT",
  "END:VCALENDAR",
);
eq(
  "éjfélre végződő időpontos = egy éjszaka",
  icsToBlockedDays(parseIcs(MIDNIGHT_FEED)),
  ["2026-09-04"],
);

const SAMEDAY_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:sameday@pms",
  "DTSTART:20260904T140000Z",
  "DTEND:20260904T160000Z",
  "END:VEVENT",
  "END:VCALENDAR",
);
eq(
  "napon belüli blokk = legalább egy foglalt nap",
  icsToBlockedDays(parseIcs(SAMEDAY_FEED)),
  ["2026-09-04"],
);

const FLOATING_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:tz@pms",
  "DTSTART;TZID=Europe/Budapest:20260904T150000",
  "DTEND;TZID=Europe/Budapest:20260906T100000",
  "END:VEVENT",
  "END:VCALENDAR",
);
const floating = parseIcs(FLOATING_FEED);
eq("TZID: a leírt naptári nap számít", icsToBlockedDays(floating), [
  "2026-09-04",
  "2026-09-05",
]);
check(
  "TZID-re figyelmeztet (nem hallgatja el)",
  floating[0].warnings.some((w) => w.includes("TZID")),
  JSON.stringify(floating[0].warnings),
);

/* ================================================================== *
 * 4. CANCELLED / STATUS
 * ================================================================== */

section("STATUS kezelés (CANCELLED kihagyása)");

const STATUS_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:live@test",
  "DTSTART;VALUE=DATE:20260904",
  "DTEND;VALUE=DATE:20260906",
  "STATUS:CONFIRMED",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:dead@test",
  "DTSTART;VALUE=DATE:20260910",
  "DTEND;VALUE=DATE:20260914",
  "STATUS:CANCELLED",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:maybe@test",
  "DTSTART;VALUE=DATE:20260920",
  "DTEND;VALUE=DATE:20260921",
  "STATUS:TENTATIVE",
  "END:VEVENT",
  "END:VCALENDAR",
);
const statusParsed = parseIcsDetailed(STATUS_FEED);
eq("CANCELLED nem kerül be", statusParsed.events.length, 2);
eq("CANCELLED számlálva", statusParsed.stats.skippedCancelled, 1);
eq("TENTATIVE megmarad (opciós foglalás blokkol)", statusParsed.events[1].status, "TENTATIVE");
eq("CANCELLED napjai szabadok", icsToBlockedDays(statusParsed.events), [
  "2026-09-04",
  "2026-09-05",
  "2026-09-20",
]);
check(
  "CANCELLED-ről szól a diagnosztika",
  statusParsed.warnings.some((w) => w.includes("CANCELLED")),
);
// Defensive: a hand-built CANCELLED event must be filtered at expansion too.
const handBuilt: IcsEvent[] = [
  {
    uid: "x",
    summary: "",
    status: "cancelled",
    start: "2026-09-04",
    endExclusive: "2026-09-06",
    nights: 2,
    allDay: true,
    rawStart: "20260904",
    rawEnd: "20260906",
    startKind: "date",
    warnings: [],
  },
];
eq("kézzel épített CANCELLED is kiesik", icsToBlockedDays(handBuilt), []);

/* ================================================================== *
 * 5. Leap year + month/year rollover
 * ================================================================== */

section("Szökőév + hónap-/évforduló átnyúlás");

const LEAP_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:leap@test",
  "DTSTART;VALUE=DATE:20280227",
  "DTEND;VALUE=DATE:20280302",
  "END:VEVENT",
  "END:VCALENDAR",
);
eq("2028 szökőév: 02-29 létezik", icsToBlockedDays(parseIcs(LEAP_FEED)), [
  "2028-02-27",
  "2028-02-28",
  "2028-02-29",
  "2028-03-01",
]);

const NONLEAP_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:nonleap@test",
  "DTSTART;VALUE=DATE:20260227",
  "DTEND;VALUE=DATE:20260302",
  "END:VEVENT",
  "END:VCALENDAR",
);
eq("2026 nem szökőév: 02-28 után 03-01", icsToBlockedDays(parseIcs(NONLEAP_FEED)), [
  "2026-02-27",
  "2026-02-28",
  "2026-03-01",
]);

const NEWYEAR_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:nye@test",
  "SUMMARY:Szilveszter",
  "DTSTART;VALUE=DATE:20261230",
  "DTEND;VALUE=DATE:20270102",
  "END:VEVENT",
  "END:VCALENDAR",
);
eq("évforduló átnyúlás", icsToBlockedDays(parseIcs(NEWYEAR_FEED)), [
  "2026-12-30",
  "2026-12-31",
  "2027-01-01",
]);

eq("addDays hónapfordulón", addDays("2026-01-31", 1), "2026-02-01");
eq("addDays visszafelé", addDays("2026-03-01", -1), "2026-02-28");
eq("addDays szökőnapra", addDays("2028-02-28", 1), "2028-02-29");
eq("daysBetween", daysBetween("2026-09-04", "2026-09-07"), 3);
check("isCalendarDay elutasítja a 2026-02-30-at", !isCalendarDay("2026-02-30"));
check("isCalendarDay elutasítja a 2026-13-01-et", !isCalendarDay("2026-13-01"));
check("isCalendarDay elfogadja a 2028-02-29-et", isCalendarDay("2028-02-29"));

/* ================================================================== *
 * 6. Escaping
 * ================================================================== */

section("Escape-elt értékek");

const ESCAPE_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:esc@test",
  "SUMMARY:Kovács\\, János\\; 2 fő\\nRészletek: itt\\\\ott",
  "DTSTART;VALUE=DATE:20260904",
  "DTEND;VALUE=DATE:20260905",
  "END:VEVENT",
  "END:VCALENDAR",
);
eq(
  "SUMMARY escape feloldva",
  parseIcs(ESCAPE_FEED)[0].summary,
  "Kovács, János; 2 fő\nRészletek: itt\\ott",
);
eq("unescape \\N is newline", unescapeIcsText("a\\Nb"), "a\nb");
eq("escape → unescape körbe", unescapeIcsText(escapeIcsText("a,b;c\\d\ne")), "a,b;c\\d\ne");
eq("csonka backslash nem dob", unescapeIcsText("vége\\"), "vége\\");

// A quoted parameter containing a colon must not split the line early.
const QUOTED_PARAM = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  'ATTENDEE;CN="Kovács, J: 2 fő";ROLE=REQ-PARTICIPANT:mailto:k@example.com',
  "UID:quoted@test",
  "DTSTART;VALUE=DATE:20260904",
  "DTEND;VALUE=DATE:20260905",
  "END:VEVENT",
  "END:VCALENDAR",
);
eq("idézőjeles paraméterben lévő kettőspont nem zavar", icsToBlockedDays(parseIcs(QUOTED_PARAM)), [
  "2026-09-04",
]);

/* ================================================================== *
 * 7. RRULE / RDATE — nem támogatott, de JELEZVE
 * ================================================================== */

section("RRULE / RDATE jelzése");

const RRULE_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:rrule@test",
  "SUMMARY:Minden hétvégén zárva",
  "DTSTART;VALUE=DATE:20260905",
  "DTEND;VALUE=DATE:20260907",
  "RRULE:FREQ=WEEKLY;BYDAY=SA;COUNT=10",
  "END:VEVENT",
  "END:VCALENDAR",
);
const rrule = importIcsBlockedDays(RRULE_FEED);
eq("RRULE: csak az első előfordulás blokkol", rrule.days, ["2026-09-05", "2026-09-06"]);
check(
  "RRULE-ról FIGYELMEZTET (nem hallgatja el)",
  rrule.warnings.some((w) => w.includes("RRULE")),
  JSON.stringify(rrule.warnings),
);

const RDATE_FEED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:rdate@test",
  "DTSTART;VALUE=DATE:20260905",
  "DTEND;VALUE=DATE:20260906",
  "RDATE;VALUE=DATE:20260912,20260919",
  "END:VEVENT",
  "END:VCALENDAR",
);
check(
  "RDATE-ról is figyelmeztet",
  importIcsBlockedDays(RDATE_FEED).warnings.some((w) => w.includes("RDATE")),
);

/* ================================================================== *
 * 8. Defenzív viselkedés — hibás/csonka bemenet
 * ================================================================== */

section("Defenzív: hibás / csonka bemenet");

for (const [label, input] of [
  ["üres string", ""],
  ["csak whitespace", "   \r\n  "],
  ["HTML hibaoldal", "<html><body>403 Forbidden</body></html>"],
  ["szemét bájtok", " nem-ical"],
] as const) {
  let threw = false;
  let days: string[] = [];
  let warns: string[] = [];
  try {
    const r = importIcsBlockedDays(input);
    days = r.days;
    warns = r.warnings;
  } catch {
    threw = true;
  }
  check(`${label}: nem dob kivételt`, !threw);
  check(`${label}: üres eredmény`, days.length === 0);
  check(`${label}: van figyelmeztetés`, warns.length > 0);
}

// A truncated download: the last VEVENT has no END, the VCALENDAR none either.
const TRUNCATED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:ok@test",
  "DTSTART;VALUE=DATE:20260904",
  "DTEND;VALUE=DATE:20260906",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:cut@test",
  "DTSTART;VALUE=DATE:20260910",
  "DTEND;VALUE=DATE:20260912",
].join("\r\n");
const truncated = importIcsBlockedDays(TRUNCATED);
eq("csonka feed: RÉSZLEGES eredmény, nem kivétel", truncated.days, [
  "2026-09-04",
  "2026-09-05",
  "2026-09-10",
  "2026-09-11",
]);
check(
  "csonka feed: jelzi a lezáratlan VEVENT-et",
  truncated.warnings.some((w) => w.includes("Lezáratlan")),
  JSON.stringify(truncated.warnings),
);

// One broken event must not kill the healthy ones.
const MIXED = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:bad-date@test",
  "DTSTART;VALUE=DATE:2026FEB30",
  "DTEND;VALUE=DATE:20260302",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:no-dtstart@test",
  "DTEND;VALUE=DATE:20260302",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:impossible@test",
  "DTSTART;VALUE=DATE:20260230",
  "DTEND;VALUE=DATE:20260302",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:good@test",
  "DTSTART;VALUE=DATE:20260904",
  "DTEND;VALUE=DATE:20260906",
  "END:VEVENT",
  "END:VCALENDAR",
);
const mixed = parseIcsDetailed(MIXED);
eq("hibás események eldobva, az ép megmarad", mixed.events.length, 1);
eq("eldobottak számlálva", mixed.stats.skippedInvalid, 3);
eq("négy VEVENT látva", mixed.stats.veventCount, 4);
eq("az ép esemény napjai", icsToBlockedDays(mixed.events), ["2026-09-04", "2026-09-05"]);

// DTEND before DTSTART / equal to DTSTART / missing entirely.
const REPAIR = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:inverted@test",
  "DTSTART;VALUE=DATE:20260910",
  "DTEND;VALUE=DATE:20260908",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:equal@test",
  "DTSTART;VALUE=DATE:20260920",
  "DTEND;VALUE=DATE:20260920",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:no-end@test",
  "DTSTART;VALUE=DATE:20260925",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:duration@test",
  "DTSTART;VALUE=DATE:20261001",
  "DURATION:P3D",
  "END:VEVENT",
  "END:VCALENDAR",
);
const repair = importIcsBlockedDays(REPAIR);
eq("fordított/üres/DURATION javítás", repair.days, [
  "2026-09-10",
  "2026-09-20",
  "2026-09-25",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
]);
check(
  "fordított DTEND-ről figyelmeztet",
  repair.warnings.some((w) => w.includes("korábbi mint DTSTART")),
  JSON.stringify(repair.warnings),
);
check(
  "hiányzó DTEND-ről figyelmeztet",
  repair.warnings.some((w) => w.includes("Hiányzó DTEND")),
);

// Absurdly long event → capped, not an out-of-memory day explosion.
const HUGE = ics(
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:huge@test",
  "DTSTART;VALUE=DATE:20260101",
  "DTEND;VALUE=DATE:99991231",
  "END:VEVENT",
  "END:VCALENDAR",
);
const huge = importIcsBlockedDays(HUGE);
check(
  "abszurd hosszú esemény levágva (nem fagy le)",
  huge.days.length === 1830,
  `napok: ${huge.days.length}`,
);
check(
  "a levágásról szól figyelmeztetés",
  huge.warnings.some((w) => w.includes("Gyanúsan hosszú")),
);

// Bad arguments to the expansion helper.
{
  let threw = false;
  try {
    icsToBlockedDaysDetailed(undefined as any);
    icsToBlockedDaysDetailed([null as unknown as IcsEvent]);
  } catch {
    threw = true;
  }
  check("hibás argumentum sem dob kivételt", !threw);
}

/* ================================================================== *
 * 9. buildIcs — a MI kiadott naptárunk
 * ================================================================== */

section("buildIcs — kiadott naptár");

const OUT = buildIcs({
  unitName: "Napsugár Apartman",
  ranges: [
    { start: "2026-09-04", endExclusive: "2026-09-07" },
    { start: "2026-12-30", endExclusive: "2027-01-02", summary: "Szilveszter; 4 fő" },
  ],
  dtstamp: "2026-08-21T06:00:00Z",
});

check("CRLF sorvégek", OUT.includes("\r\n") && !/[^\r]\n/.test(OUT));
check("VCALENDAR keret", OUT.startsWith("BEGIN:VCALENDAR\r\n") && OUT.endsWith("END:VCALENDAR\r\n"));
check("VERSION:2.0", OUT.includes("\r\nVERSION:2.0\r\n"));
check("PRODID jelen van", /\r\nPRODID:-\/\/Citoviso\/\//.test(OUT));
check("CALSCALE:GREGORIAN", OUT.includes("\r\nCALSCALE:GREGORIAN\r\n"));
check("METHOD:PUBLISH", OUT.includes("\r\nMETHOD:PUBLISH\r\n"));
check("X-WR-CALNAME az egység nevével", OUT.includes("X-WR-CALNAME:Napsugár Apartman"));
check("egész napos DTSTART", OUT.includes("DTSTART;VALUE=DATE:20260904"));
check("EXKLUZÍV DTEND", OUT.includes("DTEND;VALUE=DATE:20260907"));
check("DTSTAMP UTC alap-formátumban", OUT.includes("DTSTAMP:20260821T060000Z"));
check("SUMMARY escape-elve (pontosvessző)", OUT.includes("SUMMARY:Szilveszter\\; 4 fő"));
check("TRANSP:OPAQUE (foglaltnak számít)", OUT.includes("TRANSP:OPAQUE"));
eq("két VEVENT kiadva", OUT.split("BEGIN:VEVENT").length - 1, 2);
check("minden VEVENT-nek van UID-ja", (OUT.match(/\r\nUID:/g) ?? []).length === 2);

// Deterministic UID: the same availability must not create duplicates.
const OUT2 = buildIcs({
  unitName: "Napsugár Apartman",
  ranges: [
    { start: "2026-09-04", endExclusive: "2026-09-07" },
    { start: "2026-12-30", endExclusive: "2027-01-02", summary: "Szilveszter; 4 fő" },
  ],
  dtstamp: "2026-08-21T06:00:00Z",
});
eq("azonos bemenet → bájtra azonos kimenet (stabil UID)", OUT2, OUT);
const OTHER_UNIT = buildIcs({
  unitName: "Hold Apartman",
  ranges: [{ start: "2026-09-04", endExclusive: "2026-09-07" }],
  dtstamp: "2026-08-21T06:00:00Z",
});
check(
  "másik egység → másik UID",
  (OTHER_UNIT.match(/UID:([^\r]+)/) ?? [])[1] !== (OUT.match(/UID:([^\r]+)/) ?? [])[1],
);
check(
  "megadott UID felülírja a származtatottat",
  buildIcs({
    unitName: "X",
    ranges: [{ start: "2026-09-04", endExclusive: "2026-09-05", uid: "saját-uid@citoviso.com" }],
    dtstamp: "2026-08-21T06:00:00Z",
  }).includes("UID:saját-uid@citoviso.com"),
);

// Folding on output: no content line may exceed 75 octets.
const LONG = buildIcs({
  unitName: "Nagyon Hosszú Nevű Vendégház és Apartmanház Balatonszemes Fő utca 12.",
  ranges: [
    {
      start: "2026-09-04",
      endExclusive: "2026-09-07",
      summary:
        "Kovács János Árpád foglalása, 4 fő, késői érkezés 22:00 után, kisállattal, extra ágyneművel és reggelivel",
    },
  ],
  dtstamp: "2026-08-21T06:00:00Z",
});
const longLines = LONG.split("\r\n");
const overLong = longLines.filter((l) => Buffer.byteLength(l, "utf8") > 75);
eq("egyetlen sor sem hosszabb 75 oktetnél", overLong.length, 0);
check(
  "a folytatás-sorok szóközzel kezdődnek",
  longLines.some((l) => l.startsWith(" ")),
);
check(
  "a tördelés nem vág ketté többájtos karaktert",
  !LONG.includes("�") && Buffer.from(LONG, "utf8").toString("utf8") === LONG,
);
// The folded long SUMMARY must come back identical after a round trip.
eq(
  "hosszú SUMMARY tördelés után is visszaolvasható",
  parseIcs(LONG)[0].summary,
  "Kovács János Árpád foglalása, 4 fő, késői érkezés 22:00 után, kisállattal, extra ágyneművel és reggelivel",
);

// foldIcsLine unit behaviour on a pure-ASCII and a multi-byte line.
{
  const ascii = "SUMMARY:" + "a".repeat(200);
  const folded = foldIcsLine(ascii);
  const parts = folded.split("\r\n");
  check(
    "foldIcsLine: minden darab ≤75 oktet",
    parts.every((p) => Buffer.byteLength(p, "utf8") <= 75),
    JSON.stringify(parts.map((p) => Buffer.byteLength(p, "utf8"))),
  );
  eq("foldIcsLine: unfold visszaadja az eredetit", unfoldIcsLines(folded)[0], ascii);
  const multi = "SUMMARY:" + "őűéáí".repeat(40);
  const foldedMulti = foldIcsLine(multi);
  check(
    "foldIcsLine (UTF-8): minden darab ≤75 oktet",
    foldedMulti.split("\r\n").every((p) => Buffer.byteLength(p, "utf8") <= 75),
  );
  eq("foldIcsLine (UTF-8): unfold visszaadja az eredetit", unfoldIcsLines(foldedMulti)[0], multi);
  eq("rövid sort nem tördel", foldIcsLine("UID:x@y"), "UID:x@y");
}

// buildIcs from a flat day list + merging.
const FROM_DAYS = buildIcs({
  unitName: "Teszt",
  blockedDays: ["2026-09-05", "2026-09-04", "2026-09-06", "2026-09-04", "2026-09-10"],
  dtstamp: "2026-08-21T06:00:00Z",
});
eq("nap-listából 2 összefüggő blokk lesz", FROM_DAYS.split("BEGIN:VEVENT").length - 1, 2);
check("blokk 1: 09-04 → 09-07 (exkluzív)", FROM_DAYS.includes("DTEND;VALUE=DATE:20260907"));
check("blokk 2: 09-10 → 09-11 (exkluzív)", FROM_DAYS.includes("DTEND;VALUE=DATE:20260911"));

eq("daysToRanges összefüggő blokkokat ad", daysToRanges(["2026-09-04", "2026-09-05", "2026-09-07"]), [
  { start: "2026-09-04", endExclusive: "2026-09-06" },
  { start: "2026-09-07", endExclusive: "2026-09-08" },
]);
eq("daysToRanges kiszűri a hibás napokat", daysToRanges(["nem-nap", "2026-02-30", "2026-09-04"]), [
  { start: "2026-09-04", endExclusive: "2026-09-05" },
]);
eq(
  "mergeDayRanges összeolvasztja az érintkező blokkokat",
  mergeDayRanges([
    { start: "2026-09-04", endExclusive: "2026-09-07" },
    { start: "2026-09-07", endExclusive: "2026-09-09" },
    { start: "2026-09-05", endExclusive: "2026-09-06" },
  ]),
  [{ start: "2026-09-04", endExclusive: "2026-09-09" }],
);
eq(
  "mergeDayRanges eldobja az érvénytelen blokkot",
  mergeDayRanges([{ start: "2026-09-07", endExclusive: "2026-09-04" }]),
  [],
);

// Defensive buildIcs: garbage options must still yield a valid VCALENDAR.
{
  let threw = false;
  let out = "";
  try {
    out = buildIcs({ unitName: "", ranges: [{ start: "x", endExclusive: "y" } as any] });
  } catch {
    threw = true;
  }
  check("buildIcs hibás bemenetre sem dob", !threw);
  check("buildIcs üres, de érvényes naptárt ad", out.includes("BEGIN:VCALENDAR") && !out.includes("BEGIN:VEVENT"));
  eq("üres naptár is beolvasható", parseIcs(out).length, 0);
}

/* ================================================================== *
 * 10. Körbe-oda-vissza (round trip)
 * ================================================================== */

section("Round trip: buildIcs → parseIcs → ugyanaz a nap-halmaz");

const ROUND_CASES: readonly (readonly string[])[] = [
  ["2026-09-04", "2026-09-05", "2026-09-06"],
  ["2026-02-27", "2026-02-28", "2026-03-01"],
  ["2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01"],
  ["2026-12-30", "2026-12-31", "2027-01-01"],
  ["2026-09-04", "2026-09-10", "2026-09-11", "2026-10-01"],
  [],
];
for (const days of ROUND_CASES) {
  const text = buildIcs({
    unitName: "Napsugár Apartman",
    blockedDays: days,
    dtstamp: "2026-08-21T06:00:00Z",
  });
  const back = icsToBlockedDays(parseIcs(text));
  eq(`round trip [${days.length} nap]`, back, [...days].sort());
}

// Import → re-export → import must be a fixed point.
const reexport = buildIcs({
  unitName: "Napsugár Apartman",
  blockedDays: importIcsBlockedDays(BOOKING_FEED).days,
  dtstamp: "2026-08-21T06:00:00Z",
});
eq(
  "idegen feed → saját feed → ugyanaz a nap-halmaz",
  importIcsBlockedDays(reexport).days,
  importIcsBlockedDays(BOOKING_FEED).days,
);
eq(
  "saját feed újra-kiadása idempotens",
  buildIcs({
    unitName: "Napsugár Apartman",
    blockedDays: importIcsBlockedDays(reexport).days,
    dtstamp: "2026-08-21T06:00:00Z",
  }),
  reexport,
);

// Multi-source merge: Booking + Airbnb feeds into one published calendar.
const mergedDays = icsToBlockedDays([...parseIcs(BOOKING_FEED), ...parseIcs(AIRBNB_FEED)]);
eq("két csatorna egyesített foglaltsága", mergedDays, [
  "2026-09-04",
  "2026-09-05",
  "2026-09-06",
  "2026-09-09",
  "2026-09-10",
  "2026-09-11",
]);
eq(
  "egyesített feed round trip",
  importIcsBlockedDays(
    buildIcs({ unitName: "Napsugár", blockedDays: mergedDays, dtstamp: "2026-08-21T06:00:00Z" }),
  ).days,
  mergedDays,
);

/* ================================================================== *
 * Összegzés
 * ================================================================== */

console.log(`\n${"═".repeat(62)}`);
console.log(`Összesen: ${passed + failed} — ✓ ${passed} / ✗ ${failed}`);
if (failed > 0) {
  console.log("EREDMÉNY: BUKÁS");
  process.exit(1);
}
console.log("EREDMÉNY: MINDEN ZÖLD");
