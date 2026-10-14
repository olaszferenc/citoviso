// ADR-XXXX — the monthly traffic mail names the period it REALLY covers, and only goes to a
// site that was live for most of it.
//
// THE MEASURED DEFECT (2026-10-14, Elek live test round 2, N-1): a trial tenant whose site went
// live on 10-13 18:01 got „[TESZT] Keresztes Apartmanház — szeptemberi forgalom" at 10-14 08:00,
// every number in it from October 13. Two causes: the subject was the month name of
// (now − 30 days), while the report covers the previous 30 days; and the per-month idempotency
// let the first run of the month mail every live tenant, one day old or not.
//
// What it checks (pure: no DB, no network, no mail):
//   ① eligibility: no live stamp → never; 1 day / 20 days 23 h live → no; exactly the minimum → yes;
//   ② the period label: an old site → the 30-day window's first Budapest day … today; a site live
//      for fewer than 30 days → its go-live day … today (never a day the site did not exist);
//   ③ the built mail: subject and body carry the date range, the subject carries no bare month
//      name + „i forgalom", and the N-1 case (live yesterday) is not eligible at all;
//   ④ STRUCTURE: sendMonthlyTrafficMails checks eligibility before it builds a mail, and labels
//      the mail with trafficPeriodLabel (not a month name).
//
// Run: npx tsx scripts/traffic-mail-period-check.mts

import { readFileSync } from "node:fs";
import {
  TRAFFIC_MAIL_MIN_LIVE_DAYS,
  trafficMailEligible,
  trafficPeriodLabel,
} from "../src/analytics/trafficMail.js";
import { buildTrafficEmail } from "../src/email/trafficEmail.js";
import type { TrafficReport } from "../src/analytics/trafficReport.js";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✓ " : "✗ "} ${name}${ok ? "" : `\n     várt: ${JSON.stringify(want)} · kapott: ${JSON.stringify(got)}`}`);
  if (!ok) failures++;
}

const DAY = 86_400_000;
// The N-1 run: 2026-10-14 08:00 Budapest, the site live since 2026-10-13 18:01.
const NOW = new Date("2026-10-14T08:00:00+02:00");
const N1_LIVE = new Date("2026-10-13T18:01:00+02:00");

// ① eligibility
check("① élő-bélyeg nélkül nem megy", trafficMailEligible(null, NOW), false);
check("① tegnap indult (N-1) → nem megy", trafficMailEligible(N1_LIVE, NOW), false);
check(`① ${TRAFFIC_MAIL_MIN_LIVE_DAYS} napnál 1 órával kevesebb → nem megy`,
  trafficMailEligible(new Date(NOW.getTime() - TRAFFIC_MAIL_MIN_LIVE_DAYS * DAY + 3_600_000), NOW), false);
check(`① pontosan ${TRAFFIC_MAIL_MIN_LIVE_DAYS} nap → megy`,
  trafficMailEligible(new Date(NOW.getTime() - TRAFFIC_MAIL_MIN_LIVE_DAYS * DAY), NOW), true);
check("① a küszöb a 30 napos ablak többsége (> 15, < 30)",
  TRAFFIC_MAIL_MIN_LIVE_DAYS > 15 && TRAFFIC_MAIL_MIN_LIVE_DAYS < 30, true);

// ② period label
check("② régi oldal → a 30 napos ablak első napjától máig",
  trafficPeriodLabel(new Date("2026-01-01T10:00:00+01:00"), NOW, "hu"), "szeptember 14. – október 14.");
check("② live_at nélküli (örökölt) címke is a 30 napos ablak",
  trafficPeriodLabel(null, NOW, "hu"), "szeptember 14. – október 14.");
check("② 25 napja élő oldal → az indulás napjától (nem olyan naptól, amikor nem létezett)",
  trafficPeriodLabel(new Date("2026-09-19T15:30:00+02:00"), NOW, "hu"), "szeptember 19. – október 14.");
check("② budapesti nap: UTC-ben még előző nap (szept. 18. 23:30 UTC = szept. 19. 01:30 Bp.)",
  trafficPeriodLabel(new Date("2026-09-18T23:30:00Z"), NOW, "hu"), "szeptember 19. – október 14.");

// ③ the built mail
const report: TrafficReport = {
  days: 30, visitors: 2, views: 17, contacts: 1, fromGooglePct: 0, mobilePct: 65,
  hostSplit: null, visitorsPerContact: 2, isEmpty: false,
};
const period = trafficPeriodLabel(new Date("2026-01-01T10:00:00+01:00"), NOW, "hu");
const msg = buildTrafficEmail({
  to: "teszt@example.invalid", siteName: "Teszt Vendégház", periodLabel: period,
  report, adminUrl: "https://citoviso.com/admin?tab=forgalom", lang: "hu",
});
check("③ a tárgy a dátumtartományt nevezi meg", msg.subject, "Teszt Vendégház — forgalom, szeptember 14. – október 14.");
check("③ a tárgyban nincs „<hónap>i forgalom”", /[a-zá-ű]+i forgalom/i.test(msg.subject), false);
check("③ a szöveg első sora az időszak", msg.text.split("\n")[0], "Időszak: szeptember 14. – október 14.");
check("③ a HTML is kiírja az időszakot", msg.html.includes("Időszak: szeptember 14. – október 14."), true);

// ④ structure
const src = readFileSync("src/analytics/trafficMail.ts", "utf8");
const body = src.slice(src.indexOf("export async function sendMonthlyTrafficMails"));
const iElig = body.indexOf("trafficMailEligible(");
const iBuild = body.indexOf("buildTrafficEmail(");
check("④ a küldő a levél építése ELŐTT nézi a küszöböt", iElig > -1 && iBuild > -1 && iElig < iBuild, true);
check("④ a levél címkéje trafficPeriodLabel, nem hónapnév",
  /periodLabel:\s*trafficPeriodLabel\(/.test(body) && !/monthLabel\(/.test(src), true);

if (failures > 0) {
  console.error(`\n✗ TRAFFIC-MAIL-PERIOD-CHECK: ${failures} bukott ellenőrzés`);
  process.exit(1);
}
console.log("\n✅ TRAFFIC-MAIL-PERIOD-CHECK: a forgalmi levél a valós időszakot írja, és csak a legalább " +
  `${TRAFFIC_MAIL_MIN_LIVE_DAYS} napja élő oldalnak megy`);
