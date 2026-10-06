// ADR-0288 — every outbound window and outbound deadline is read on the BUDAPEST wall
// clock, whatever zone the process runs in. The live VPS runs in UTC, the dev box in
// Europe/Budapest: a rule that read the process-local hour (Date#getHours / setHours)
// opened the cold-SMS window at 10:00 and closed it at 22:00 Budapest time on prod,
// while every dev test was green. This guard runs each reading under THREE process
// zones (Budapest, UTC, New York) in summer AND winter time:
//   ① sendWindowOpen: 07:59 shut · 08:00 open · 19:59 open · 20:00 shut (Budapest);
//   ② minutesUntilWindowCloses / pairWindowBlocks: 19:30 Budapest → 30 min left, a pair
//      may not start; 10:00 Budapest → it may;
//   ③ the follow-up window (followupWindowBlocks) is the same rule;
//   ④ the follow-up mail prints its deadline on the Budapest clock (like the page's card);
//   ⑤ STRUCTURE: no outbound file reads the process-local clock (getHours/setHours/…);
//   ⑥ ADR-0289 the shared clock (src/text/budapestTime.ts) and what owners/buyers see: the
//      buyer's payment stamp, the traffic report's day start (Budapest midnight, 23/25-hour
//      DST days), the monthly mail's month name — right around midnight, where UTC and
//      Budapest disagree;
//   ⑦ STRUCTURE: the owner/buyer-facing files read no local getter, every date formatter in
//      them names the zone, every SQL day/month boundary says AT TIME ZONE;
//   ⑧ ADR-0334 the MOCK-OUTREACH window (owner 2026-10-06): weekdays 09:00–16:00 Budapest —
//      08:59 shut · 09:00 open · 15:59 open · 16:00 shut, Saturday/Sunday shut all day, the
//      weekday is the BUDAPEST one around midnight, and MOBILE_SEND_WINDOW_OFF (set on prod)
//      does not lift it;
//   ⑨ STRUCTURE: the window guards every place a mock outreach STARTS (the mail send below its
//      dry-run line, the pair start, the standalone cold SMS, the server MMS pull, the dev
//      relay before its pull) — and NOT the pair's SMS half / repair (a 15:59 pair must still
//      get its link SMS after 16:00).
// Pure: no DB, no network.
//
// Run: npx tsx scripts/send-window-tz-check.mts

import { readFileSync } from "node:fs";
import { minutesUntilWindowCloses, mockOutreachWindowBlocks, mockOutreachWindowOpen, sendWindowOpen } from "../src/sms/sendWindow.js";
import { config } from "../src/config.js";
import { pairWindowBlocks } from "../src/outreach/sendOutreachSms.js";
import { deadlineText, followupWindowBlocks } from "../src/outreach/escalationFollowup.js";
import { budapestIsoDay, budapestMidnight, budapestDayStart, budapestYear } from "../src/text/budapestTime.js";
import { fmtStamp } from "../src/tenant/multilangCard.js";
import { since } from "../src/analytics/trafficReport.js";
import { monthLabel } from "../src/analytics/trafficMail.js";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✓ " : "✗ "} ${name}${ok ? "" : `\n     várt: ${JSON.stringify(want)} · kapott: ${JSON.stringify(got)}`}`);
  if (!ok) failures++;
}

const ZONES = ["Europe/Budapest", "UTC", "America/New_York"];
// Budapest wall-clock instants: summer = UTC+2, winter = UTC+1.
const SUMMER = (hhmm: string) => new Date(`2026-07-01T${hhmm}:00+02:00`);
const WINTER = (hhmm: string) => new Date(`2026-12-01T${hhmm}:00+01:00`);
const NOT_ALLOWLISTED = "+10000000000";

const origTz = process.env.TZ;
try {
  for (const tz of ZONES) {
    process.env.TZ = tz;
    for (const [season, at] of [["nyár", SUMMER], ["tél", WINTER]] as const) {
      check(`① [${tz}, ${season}] ablak 07:59 · 08:00 · 19:59 · 20:00 (Budapest)`,
        ["07:59", "08:00", "19:59", "20:00"].map((t) => sendWindowOpen(at(t))), [false, true, true, false]);
      check(`② [${tz}, ${season}] 19:30 Budapest → 30 perc az ablak zárásáig`, minutesUntilWindowCloses(at("19:30")), 30);
      check(`② [${tz}, ${season}] mobil-pár: 19:30-kor nem indul, 10:00-kor igen`,
        [pairWindowBlocks(NOT_ALLOWLISTED, at("19:30")) !== null, pairWindowBlocks(NOT_ALLOWLISTED, at("10:00"))], [true, null]);
      check(`③ [${tz}, ${season}] emlékeztető-ablak 07:59 zárva · 08:00 nyitva · 20:00 zárva`,
        ["07:59", "08:00", "20:00"].map((t) => followupWindowBlocks(at(t)) === null), [false, true, false]);
      check(`④ [${tz}, ${season}] a levél határideje Budapest szerint (16:10)`, /16:10/.test(deadlineText(at("16:10"), "hu")), true);
      // ⑥ 00:30 Budapest = the previous day in UTC (and in New York).
      check(`⑥ [${tz}, ${season}] 00:30 Budapest: a nap és a fizetési bélyeg a budapesti`,
        [budapestIsoDay(at("00:30")), fmtStamp(at("00:30"))],
        season === "nyár" ? ["2026-07-01", "2026. 07. 01. 00:30"] : ["2026-12-01", "2026. 12. 01. 00:30"]);
      check(`⑥ [${tz}, ${season}] a jelentés napja budapesti éjféltől indul`,
        since(0, at("00:30")).toISOString(), season === "nyár" ? "2026-06-30T22:00:00.000Z" : "2026-11-30T23:00:00.000Z");
    }
    // ⑧ 2026-07-01 is a Wednesday, 2026-12-01 a Tuesday.
    for (const [season, at] of [["nyár", SUMMER], ["tél", WINTER]] as const) {
      check(`⑧ [${tz}, ${season}] mock-ablak hétköznap 08:59 · 09:00 · 15:59 · 16:00 (Budapest)`,
        ["08:59", "09:00", "15:59", "16:00"].map((t) => mockOutreachWindowOpen(at(t))), [false, true, true, false]);
    }
    check(`⑧ [${tz}] szombat és vasárnap 10:00 (Budapest) zárva, péntek 15:59 nyitva`,
      [new Date("2026-10-03T10:00:00+02:00"), new Date("2026-10-04T10:00:00+02:00"), new Date("2026-10-02T15:59:00+02:00")].map(mockOutreachWindowOpen),
      [false, false, true]);
    // Sunday 23:30 UTC is Monday 01:30 Budapest; Friday 23:30 UTC is Saturday 01:30.
    check(`⑧ [${tz}] a hétköznap budapesti: hétfő 09:00 nyitva, szombat 00:30 zárva`,
      [mockOutreachWindowOpen(new Date("2026-10-05T09:00:00+02:00")), mockOutreachWindowOpen(new Date("2026-10-03T00:30:00+02:00"))], [true, false]);
    check(`⑧ [${tz}] az ok kimondja a napot és az órát`,
      mockOutreachWindowBlocks(new Date("2026-10-03T10:00:00+02:00")), "mock-megkeresés csak hétköznap 9:00–16:00 (Budapest) között megy ki (most szombat 10:00) — a következő hétköznap 9:00-tól indítható");
    check(`⑥ [${tz}] DST: a tavaszi nap 23, az őszi 25 órás (budapesti éjféltől éjfélig)`,
      [(budapestMidnight("2026-03-30").getTime() - budapestMidnight("2026-03-29").getTime()) / 3_600_000,
       (budapestMidnight("2026-10-26").getTime() - budapestMidnight("2026-10-25").getTime()) / 3_600_000], [23, 25]);
    check(`⑥ [${tz}] 7 napos ablak kezdete DST-váltáson át`, budapestDayStart(6, new Date("2026-10-27T10:00:00+01:00")).toISOString(), "2026-10-20T22:00:00.000Z");
    check(`⑥ [${tz}] szilveszter 23:30 / újév 00:30 Budapest: az év a budapesti`,
      [budapestYear(new Date("2026-12-31T23:30:00+01:00")), budapestYear(new Date("2027-01-01T00:30:00+01:00"))], [2026, 2027]);
    check(`⑥ [${tz}] a havi levél hónapneve budapesti: augusztus 31. 23:30 → augusztus, szept. 1. 00:30 → szeptember`,
      [monthLabel(new Date("2026-08-31T23:30:00+02:00"), "hu"), monthLabel(new Date("2026-09-01T00:30:00+02:00"), "hu")], ["augusztus", "szeptember"]);
  }
  const origOff = config.mobileSendWindowOff;
  try {
    (config as { mobileSendWindowOff: boolean }).mobileSendWindowOff = true;
    check("⑧ MOBILE_SEND_WINDOW_OFF mellett is zárva: szerda 17:00, szombat 10:00",
      [new Date("2026-09-30T17:00:00+02:00"), new Date("2026-10-03T10:00:00+02:00")].map((d) => mockOutreachWindowBlocks(d) !== null), [true, true]);
  } finally {
    (config as { mobileSendWindowOff: boolean }).mobileSendWindowOff = origOff;
  }
} finally {
  if (origTz === undefined) delete process.env.TZ;
  else process.env.TZ = origTz;
}

// ⑨ structure: where a mock outreach STARTS, the window is asked; where a started pair is
// finished (its SMS half, the repair), it is not.
const fnBody = (file: string, signature: string): string => {
  const src = readFileSync(file, "utf8");
  const i = src.indexOf(signature);
  if (i < 0) return "";
  const next = src.slice(i + signature.length).search(/\n(export )?(async )?function /);
  return next < 0 ? src.slice(i) : src.slice(i, i + signature.length + next);
};
const WIN = /mockOutreachWindowBlocks\(/;
// Asked AND obeyed: the reason is bound and the very next statement returns on it.
const GATE = /const (\w+) = mockOutreachWindowBlocks\([^;]*;\s*if \(\1\) return /;
const mail = fnBody("src/outreach/sendBatch.ts", "export async function sendOutreachMail(");
const mailDry = mail.indexOf("if (opts.dryRun)");
const mailWin = mail.search(GATE);
const mailSend = mail.indexOf("getEmailSender(");
check("⑨ e-mail: az ablak a dry-run sor UTÁN, a tényleges küldés ELŐTT",
  mailDry >= 0 && mailWin > mailDry && mailSend > mailWin, true);
check("⑨ mobil-pár indítása és a hideg SMS kérdezi az ablakot, és zárva visszafordul",
  [GATE.test(fnBody("src/outreach/sendOutreachPair.ts", "export async function startOutreachPair(")),
   GATE.test(fnBody("src/outreach/sendOutreachSms.ts", "export async function sendOutreachSms("))], [true, true]);
check("⑨ a pár SMS-fele és a közös mobil-kapu NEM (16:00 után is befejeződik a pár)",
  [WIN.test(fnBody("src/outreach/sendOutreachPair.ts", "export async function sendPairSmsHalf(")),
   WIN.test(fnBody("src/outreach/sendOutreachSms.ts", "export async function mobileOutreachGates("))], [false, false]);
const relay = readFileSync("src/mms/relayClient.ts", "utf8");
check("⑨ szerver MMS-pull és dev relay: az ablak a pull ELŐTT",
  [WIN.test(fnBody("src/sms/sendWindow.ts", "export function mmsPullBlocks(")),
   relay.search(WIN) >= 0 && relay.search(WIN) < relay.indexOf('"/api/mms-relay/pull"')], [true, true]);

// ⑤ structure: the outbound decision files never read the process-local clock.
const OUTBOUND = [
  "src/sms/sendWindow.ts",
  "src/outreach/sendOutreachSms.ts",
  "src/outreach/sendOutreachPair.ts",
  "src/outreach/sendBatch.ts",
  "src/outreach/escalationFollowup.ts",
  "src/outreach/pairRepair.ts",
  "src/mms/relayQueue.ts",
  "src/mms/relayClient.ts",
];
const LOCAL = /\.(getHours|setHours|getMinutes|setMinutes|getDate|setDate|getDay)\(/;
check("⑤ a kimenő döntés-fájlok nem olvassák a folyamat helyi óráját",
  OUTBOUND.filter((f) => LOCAL.test(readFileSync(f, "utf8"))), []);

// ⑦ structure: the owner/buyer-facing time readers.
const FACING = [
  "src/tenant/multilangCard.ts",
  "src/analytics/trafficReport.ts",
  "src/analytics/trafficMail.ts",
  "src/tenant/documents.ts",
  "src/console/aamAlert.ts",
  "src/console/partnerData.ts",
  "src/console/partnerViews.ts",
];
check("⑦ a tulaj/vevő-felé néző idő-olvasók nem használnak helyi gettert",
  FACING.filter((f) => LOCAL.test(readFileSync(f, "utf8"))), []);
// Every date formatter call in these files names its zone (a number formatter is exempt).
const FORMATTERS = [...FACING, "src/server/adminViews.ts", "src/server/moduleConfigViews.ts", "src/outreach/escalationFollowup.ts"];
const zoneless: string[] = [];
for (const f of FORMATTERS) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((l, i) => {
    if (!/new Intl\.DateTimeFormat\(|\.toLocale(Date|Time)?String\(/.test(l)) return;
    const call = lines.slice(i, i + 10).join("\n");
    const end = call.indexOf(".format(") >= 0 ? call.indexOf(".format(") : call.indexOf(")", call.indexOf("String(") + 7) + 1;
    const body = call.slice(0, end > 0 ? end : undefined);
    if (/timeZone/.test(body)) return;
    if (/Fraction|currency|style:/.test(body) || /toLocaleString\(\s*"hu-HU"\s*\)/.test(l) && !/Date|At\b|At\)/.test(l)) return;
    zoneless.push(`${f}:${i + 1}`);
  });
}
check("⑦ minden dátum-formázó kimondja a zónát (timeZone)", zoneless, []);
const sqlBad = ["src/analytics/trafficReport.ts", "src/analytics/trafficMail.ts"].filter((f) => {
  const src = readFileSync(f, "utf8");
  return [...src.matchAll(/(to_char\(occurred_at[^)]*\)|date_trunc\('month'[^`]*)/g)].some((m) => !/AT TIME ZONE/.test(m[0]));
});
check("⑦ az SQL nap/hónap-határ AT TIME ZONE-nal számol", sqlBad, []);

if (failures > 0) {
  console.error(`\n✗ SEND-WINDOW-TZ-CHECK: ${failures} bukott ellenőrzés`);
  process.exit(1);
}
console.log("\n✅ SEND-WINDOW-TZ-CHECK: minden kimenő ablak és határidő Budapest szerint számol, bármely szerver-zónában; mock-megkeresés csak hétköznap 9–16");
