// Gate: the owner's test phone (OUTREACH_TEST_PHONES) is exempt ONLY on "[TESZT]"
// leads — a real lead carrying the same number is gated exactly as before
// (ADR-0319, owner decision 2026-10-04: "3: igen", with a negative control).
//
// Why it exists: the owner's test number sat on several test leads, so the
// shared-contact gate refused it on the live host ([TESZT] Lovász ↔ [TESZT] Muschel)
// and one unsubscribe click on a dev test lead blocked it on every test lead. The
// exemption must not leak: a mock for a REAL lodging going to a number that is also
// on another lead is the exact neighbour-competitor risk ADR-0258 closed.
//
// Runs the REAL phoneContactBlocks() (the mobile chain's person-level step) on the
// real database with a disposable fixture; the number is random, so the live stock
// can never collide.
//
// What it pins:
//   ① the pure predicate: listed number + [TESZT] name → exempt; real name, an
//      unlisted number or an empty list → not
//   ② [TESZT] lead + test number, shared with another [TESZT] lead → passes
//   ③ NEGATIVE CONTROL: a REAL lead + the same test number → still refused
//      (shared contact)
//   ④ opt-out on the number: [TESZT] lead passes off the live host, is REFUSED on
//      the live host; the real lead is refused on both
//   ⑤ an unlisted number on a [TESZT] lead is gated as before
//   ⑥ WIRING: the mobile chain calls phoneContactBlocks with the lead's name
//
// Usage: npx tsx scripts/owner-test-phone-check.mts

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const tag = randomBytes(4).toString("hex");
const digits = (n: number): string =>
  Array.from(randomBytes(n), (b) => String(b % 10)).join("");
const testPhone = `+3670${digits(7)}`;
const otherPhone = `+3670${digits(7)}`;
// Set before config is imported: the exemption reads OUTREACH_TEST_PHONES from env.
process.env.OUTREACH_TEST_PHONES = `06${testPhone.slice(3)}`;

const { db } = await import("../src/db/client.js");
const { ownerTestPhoneExempt } = await import("../src/outreach/ownerTestPhone.js");
const { phoneContactBlocks } = await import("../src/outreach/sendOutreachSms.js");

let failures = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  console.log(`  ${cond ? "✓" : "✗"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const ids: { defId?: string; runId?: string; leads: string[] } = { leads: [] };

async function mkLead(name: string, phone: string): Promise<string> {
  const r = await db
    .insertInto("lead")
    .values({ scrape_run_id: ids.runId!, name, raw: JSON.stringify({ name, phone }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leads.push(r.id);
  return r.id;
}

console.log(`Tulaj teszt-száma (${testPhone}) — csak [TESZT] leaden mentes (eldobható fixture, valódi DB):\n`);

try {
  // ① pure predicate
  const list = `06${testPhone.slice(3)}`;
  ok(ownerTestPhoneExempt(`[TESZT] X ${tag}`, testPhone, list), "① [TESZT] név + listázott szám → mentes");
  ok(!ownerTestPhoneExempt(`Valódi ${tag}`, testPhone, list), "① valódi név + listázott szám → NEM mentes");
  ok(!ownerTestPhoneExempt(`Szállás [TESZT] ${tag}`, testPhone, list), "① a [TESZT] csak név ELEJÉN számít");
  ok(!ownerTestPhoneExempt(`[TESZT] X ${tag}`, otherPhone, list), "① [TESZT] név + nem listázott szám → NEM mentes");
  ok(!ownerTestPhoneExempt(`[TESZT] X ${tag}`, testPhone, ""), "① üres lista → senki sem mentes");

  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_owner_test_phone_check",
      country: "HU",
      region: "_test",
      industry: "accommodation",
      sources: JSON.stringify(["osm"]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.runId = run.id;

  const tA = `[TESZT] Otp A ${tag}`;
  const tB = `[TESZT] Otp B ${tag}`;
  const real = `Otp Valódi ${tag}`;
  const a = await mkLead(tA, testPhone);
  await mkLead(tB, testPhone);
  const r = await mkLead(real, testPhone);

  // ② / ③ shared contact, both hosts
  for (const live of [false, true]) {
    const where = live ? "élesen" : "teszten";
    const ra = await phoneContactBlocks(a, tA, testPhone, live);
    ok(ra === null, `② ${where}: [TESZT] lead + teszt-szám, két másik lead is viseli → mehet`, ra ?? "");
    const rr = await phoneContactBlocks(r, real, testPhone, live);
    ok(
      rr !== null && rr.includes("másik szálláshoz is tartozik"),
      `③ NEGATÍV KONTROLL ${where}: valódi lead + ugyanaz a szám → TILT (közös elérhetőség)`,
      rr ?? "null",
    );
  }

  // ④ number-level opt-out: an unsubscribed prospect on the OTHER test lead
  const leadB = ids.leads[1]!;
  await db
    .insertInto("prospect")
    .values({ lead_id: leadB, token: `otp-${tag}-b`, unsubscribed_at: new Date() } as never)
    .execute();
  const offLive = await phoneContactBlocks(a, tA, testPhone, false);
  ok(offLive === null, "④ leiratkozás a számon, teszten: [TESZT] lead → mehet", offLive ?? "");
  const onLive = await phoneContactBlocks(a, tA, testPhone, true);
  ok(onLive?.includes("leiratkoztak") === true, "④ leiratkozás a számon, ÉLESEN: [TESZT] lead → TILT", onLive ?? "null");
  for (const live of [false, true]) {
    const rr = await phoneContactBlocks(r, real, testPhone, live);
    ok(
      rr?.includes("leiratkoztak") === true,
      `④ NEGATÍV KONTROLL ${live ? "élesen" : "teszten"}: valódi lead → TILT (leiratkozás)`,
      rr ?? "null",
    );
  }

  // ⑤ unlisted number on a test lead: gated as before
  const c = await mkLead(`[TESZT] Otp C ${tag}`, otherPhone);
  await mkLead(`[TESZT] Otp D ${tag}`, otherPhone);
  const rc = await phoneContactBlocks(c, `[TESZT] Otp C ${tag}`, otherPhone, false);
  ok(rc?.includes("másik szálláshoz is tartozik") === true, "⑤ [TESZT] lead + NEM listázott szám → tilt, mint eddig", rc ?? "null");

  // ⑥ wiring
  const smsSrc = readFileSync("src/outreach/sendOutreachSms.ts", "utf8");
  ok(/phoneContactBlocks\(p\.leadId, p\.leadName, to\)/.test(smsSrc), "⑥ a mobil kapu-lánc a lead nevével hívja");
} finally {
  if (ids.leads.length) {
    await db.deleteFrom("prospect").where("lead_id", "in", ids.leads).execute();
    await db.deleteFrom("lead").where("id", "in", ids.leads).execute();
  }
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await db.destroy();
}

if (failures) {
  console.error(`\n🔴 owner-test-phone-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ owner-test-phone-check: a teszt-szám csak [TESZT] leaden mentes, valódi leaden minden kapu áll.");
process.exit(0);
