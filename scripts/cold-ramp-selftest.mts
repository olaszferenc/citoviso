// Self-test of the cold ramp's pure rules (src/outreach/coldRamp.ts): the climb, the ceiling, the
// brake's hold, the per-firing allowance and the health verdict. No DB, no network.
//
//   npx tsx scripts/cold-ramp-selftest.mts
import assert from "node:assert/strict";
import {
  judgeColdHealth,
  parseColdRamp,
  previousWorkingDay,
  rampCapOn,
  tickAllowance,
  workingDaysAfter,
  type ColdRamp,
} from "../src/outreach/coldRamp.js";
import { MOCK_OUTREACH_WINDOW } from "../src/sms/sendWindow.js";

// 2026-11-18 is a Wednesday.
assert.equal(workingDaysAfter("2026-11-18", "2026-11-18"), 0, "start day itself");
assert.equal(workingDaysAfter("2026-11-18", "2026-11-19"), 1, "next day");
assert.equal(workingDaysAfter("2026-11-18", "2026-11-23"), 3, "Thu, Fri, Mon — the weekend does not count");
assert.equal(workingDaysAfter("2026-11-18", "2026-11-17"), 0, "before the start");
assert.equal(previousWorkingDay("2026-11-23"), "2026-11-20", "Monday looks back to Friday");
assert.equal(previousWorkingDay("2026-11-19"), "2026-11-18");

const ramp: ColdRamp = { startDay: "2026-11-19", startCap: 100, growthPct: 30, maxCap: 3000 };
assert.equal(rampCapOn(ramp, "2026-11-19"), 100, "day 1");
assert.equal(rampCapOn(ramp, "2026-11-20"), 130, "day 2: ×1.3");
assert.equal(rampCapOn(ramp, "2026-11-23"), 169, "day 3 (Monday): ×1.3²");
assert.equal(rampCapOn(ramp, "2026-12-04"), 1792, "11 working days later: 100 × 1.3^11");
assert.equal(rampCapOn(ramp, "2026-12-07"), 2330, "12 working days later: 100 × 1.3^12 — past 2 000 in the 13th working day");
assert.equal(rampCapOn(ramp, "2026-12-09"), 3000, "the ceiling holds (100 × 1.3^14 = 3 937 → 3 000)");
assert.equal(rampCapOn({ ...ramp, holdCap: 169 }, "2026-12-07"), 169, "a brake hold caps the climb");

// Allowance: 10:00 Budapest on a day with 2 000 to go → the remainder over the 2-minute slots left
// until the window closes (MOCK_OUTREACH_WINDOW.toHour — 16 by default, the owner may move it).
const { toHour } = MOCK_OUTREACH_WINDOW;
const at10 = new Date("2026-11-19T09:00:00Z"); // 10:00 CET
const slots = Math.floor((toHour * 60 - 600) / 2);
assert.equal(tickAllowance(at10, { ...ramp, startCap: 2000, maxCap: 2000 }, 0), Math.ceil(2000 / slots), `even share of 2 000 over ${slots} slots`);
assert.equal(tickAllowance(at10, ramp, 100), 0, "cap reached → nothing");
const late = new Date(Date.UTC(2026, 10, 19, toHour - 2, 59)); // <toHour-1>:59 CET, one slot left
assert.equal(tickAllowance(late, { ...ramp, startCap: 2000, maxCap: 2000 }, 1990), 10, "the last slot takes the rest");

// Verdicts.
const h = (sent: number, viewed: number, gmailSent = 0, gmailViewed = 0) => ({ day: "2026-11-18", sent, viewed, gmailSent, gmailViewed });
assert.equal(judgeColdHealth(h(20, 0), false).kind, "no-data", "under the sample floor");
assert.equal(judgeColdHealth(h(200, 60, 120, 40), false).kind, "ok", "33% Gmail");
assert.equal(judgeColdHealth(h(200, 60, 120, 2), false).kind, "stop", "1.7% Gmail stops even if the rest looks fine");
assert.equal(judgeColdHealth(h(200, 14, 120, 9), false).kind, "freeze", "7.5% Gmail freezes");
assert.equal(judgeColdHealth(h(200, 40, 120, 24), true).kind, "release", "20% with a hold → release");
assert.equal(judgeColdHealth(h(200, 40, 120, 24), false).kind, "ok", "20% without a hold → ok");
assert.equal(judgeColdHealth(h(50, 1, 10, 0), false).kind, "stop", "too few Gmail → all recipients judged: 2%");

// Parsing.
assert.equal(parseColdRamp(null), null);
assert.equal(parseColdRamp({ startDay: "2026-11-19", startCap: 100, growthPct: 30, maxCap: 50 }), null, "max under start");
assert.deepEqual(parseColdRamp({ startDay: "2026-11-19", startCap: 100, growthPct: 30, maxCap: 3000, holdCap: 169, judgedDay: "2026-11-20" }), {
  startDay: "2026-11-19",
  startCap: 100,
  growthPct: 30,
  maxCap: 3000,
  holdCap: 169,
  judgedDay: "2026-11-20",
});

console.log("cold-ramp-selftest: OK");
