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
//   ⑤ STRUCTURE: no outbound file reads the process-local clock (getHours/setHours/…).
// Pure: no DB, no network.
//
// Run: npx tsx scripts/send-window-tz-check.mts

import { readFileSync } from "node:fs";
import { minutesUntilWindowCloses, sendWindowOpen } from "../src/sms/sendWindow.js";
import { pairWindowBlocks } from "../src/outreach/sendOutreachSms.js";
import { deadlineText, followupWindowBlocks } from "../src/outreach/escalationFollowup.js";

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
    }
  }
} finally {
  if (origTz === undefined) delete process.env.TZ;
  else process.env.TZ = origTz;
}

// ⑤ structure: the outbound decision files never read the process-local clock.
const OUTBOUND = [
  "src/sms/sendWindow.ts",
  "src/outreach/sendOutreachSms.ts",
  "src/outreach/sendOutreachPair.ts",
  "src/outreach/sendBatch.ts",
  "src/outreach/escalationFollowup.ts",
  "src/outreach/pairRepair.ts",
  "src/mms/relayQueue.ts",
];
const LOCAL = /\.(getHours|setHours|getMinutes|setMinutes|getDate|setDate|getDay)\(/;
check("⑤ a kimenő döntés-fájlok nem olvassák a folyamat helyi óráját",
  OUTBOUND.filter((f) => LOCAL.test(readFileSync(f, "utf8"))), []);

if (failures > 0) {
  console.error(`\n✗ SEND-WINDOW-TZ-CHECK: ${failures} bukott ellenőrzés`);
  process.exit(1);
}
console.log("\n✅ SEND-WINDOW-TZ-CHECK: minden kimenő ablak és határidő Budapest szerint számol, bármely szerver-zónában");
