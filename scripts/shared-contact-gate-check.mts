// Gate: a cold message never goes to a contact that ANOTHER live lead also carries,
// unless a human ruled the two leads same_owner (src/outreach/sharedContactGate.ts).
//
// Why it exists (owner, 2026-09-28): "annál rosszabb szinte nincs is, mint hogy egy
// mockot a rossz elérhetőség miatt a szomszéd konkurenciának küldjünk el". The dev
// stock held eight neighbour pairs where the medium-confidence Places match had
// copied the other business's phone/e-mail, and intermediary addresses sitting as
// the primary contact of up to ten leads.
//
// Runs on the REAL database with a disposable fixture (pair-repair-check pattern);
// every contact value carries a random suffix so the live stock can never collide.
//
// What it pins:
//   ① a contact only this lead carries passes
//   ② the same e-mail as another lead's PRIMARY blocks, and names that lead
//   ③ a REJECTED ledger sighting on the other lead does not count
//   ④ an ACCEPTED ledger sighting does
//   ⑤ phones compare by number, not by spelling (+36 30 … vs 06-30/…)
//   ⑥ same_owner releases; unrelated does NOT (two businesses on one contact =
//      at least one is wrong)
//   ⑦ a disqualified holder no longer counts
//   ⑧ another lead's PROSPECT address counts (it is what we would mail)
//   ⑨ a crowd (≥7 leads) is named an intermediary
//   ⑩ Elek's address and the caller's exemption pass
//   ⑪ WIRING: the mail path's own dry-run refuses with this reason, and stops
//      refusing after the ruling; the mobile path calls the gate with the phone
//
// Usage: npx tsx scripts/shared-contact-gate-check.mts

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { sharedContactBlocks } from "../src/outreach/sharedContactGate.js";
import { sendOutreachMail } from "../src/outreach/sendBatch.js";
import { ELEK_EMAIL } from "../src/elek/park.js";

const tag = randomBytes(4).toString("hex");
const mail = `sc-${tag}@example.invalid`;
const phoneA = `+36 30 7${tag.replace(/\D/g, "0").padEnd(6, "0").slice(0, 6)}`;
const phoneB = `06-30/7${phoneA.slice(-6, -3)}-${phoneA.slice(-3)}`;

let failures = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  console.log(`  ${cond ? "✓" : "✗"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const ids: { defId?: string; runId?: string; leads: string[] } = { leads: [] };

async function mkLead(name: string, raw: Record<string, unknown>): Promise<string> {
  const r = await db
    .insertInto("lead")
    .values({ scrape_run_id: ids.runId!, name, raw: JSON.stringify({ name, ...raw }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leads.push(r.id);
  return r.id;
}
async function setRaw(id: string, raw: Record<string, unknown>): Promise<void> {
  await db.updateTable("lead").set({ raw: sql`${JSON.stringify(raw)}::jsonb` }).where("id", "=", id).execute();
}
async function rule(a: string, b: string, verdict: string): Promise<void> {
  const [lead_a, lead_b] = a < b ? [a, b] : [b, a];
  await db
    .insertInto("lead_link")
    .values({ lead_a, lead_b, verdict })
    .onConflict((oc) => oc.columns(["lead_a", "lead_b"]).doUpdateSet({ verdict }))
    .execute();
}

console.log("Közös elérhetőség kapu (eldobható fixture, valódi DB):\n");

try {
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_shared_contact_check",
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

  const a = await mkLead(`_sc A ${tag}`, { email: mail, phone: phoneA });

  // ①
  ok((await sharedContactBlocks(a, "email", mail)) === null, "① egyedül a lead viseli → mehet");

  // ② + ③ + ④
  const b = await mkLead(`_sc B ${tag}`, {
    city: "Tesztfalva",
    contacts: [{ kind: "email", value: mail.toUpperCase(), source: "x", accepted: false }],
  });
  ok((await sharedContactBlocks(a, "email", mail)) === null, "③ a másik lead ELUTASÍTOTT sorában → nem számít");
  await setRaw(b, {
    name: `_sc B ${tag}`,
    city: "Tesztfalva",
    contacts: [{ kind: "email", value: ` ${mail.toUpperCase()} `, source: "x", accepted: true }],
  });
  const r4 = await sharedContactBlocks(a, "email", mail);
  ok(r4 !== null && r4.includes(`_sc B ${tag} (Tesztfalva)`), "④ ELFOGADOTT ledger-sor a másikon → blokkol, és megnevezi", String(r4));
  await setRaw(b, { name: `_sc B ${tag}`, email: mail });
  ok((await sharedContactBlocks(a, "email", mail)) !== null, "② a másik lead ELSŐDLEGES címe → blokkol");

  // ⑤
  await setRaw(b, { name: `_sc B ${tag}`, phone: phoneB });
  ok((await sharedContactBlocks(a, "phone", phoneA)) !== null, `⑤ ${phoneA} ≡ ${phoneB} → blokkol`);

  // ⑥
  await rule(a, b, "unrelated");
  ok((await sharedContactBlocks(a, "phone", phoneA)) !== null, "⑥ „független” ítélet → a blokk MARAD");
  await rule(a, b, "same_owner");
  ok((await sharedContactBlocks(a, "phone", phoneA)) === null, "⑥ „azonos tulaj” ítélet → mehet");
  await db.deleteFrom("lead_link").where("lead_a", "in", [a, b]).execute();

  // ⑦
  await db.updateTable("lead").set({ lifecycle_status: "disqualified" }).where("id", "=", b).execute();
  ok((await sharedContactBlocks(a, "phone", phoneA)) === null, "⑦ kizárt lead nem számít");
  await db.updateTable("lead").set({ lifecycle_status: "qualified" }).where("id", "=", b).execute();

  // ⑧
  await setRaw(b, { name: `_sc B ${tag}` });
  ok((await sharedContactBlocks(a, "email", mail)) === null, "⑧ előfeltétel: a B rekordján már nincs a cím");
  await db.insertInto("prospect").values({ lead_id: b, token: `sc-${tag}-b`, contact_email: mail }).execute();
  ok((await sharedContactBlocks(a, "email", mail)) !== null, "⑧ a másik lead PROSPECT-címe → blokkol");

  // ⑨
  for (let i = 0; i < 6; i++) await mkLead(`_sc crowd${i} ${tag}`, { phone: phoneA });
  const r9 = await sharedContactBlocks(a, "phone", phoneA);
  ok(r9 !== null && r9.includes("közvetítő"), "⑨ tömegen ülő szám → közvetítőként nevezi meg", String(r9));

  // ⑩
  ok((await sharedContactBlocks(a, "phone", phoneA, true)) === null, "⑩ a hívó kivétele (teszt-szám) → mehet");
  const elek2 = await mkLead(`_sc elek ${tag}`, { email: ELEK_EMAIL });
  ok((await sharedContactBlocks(a, "email", ELEK_EMAIL)) === null, "⑩ Elek címe → mehet");
  void elek2;

  // ⑪ wiring — the mail path's OWN dry-run answers
  await db.insertInto("prospect").values({ lead_id: a, token: `sc-${tag}-a`, contact_email: mail }).execute();
  const pa = await db.selectFrom("prospect").select("id").where("token", "=", `sc-${tag}-a`).executeTakeFirstOrThrow();
  const before = await sendOutreachMail(pa.id, { dryRun: true, probe: true });
  const reasonBefore = before.outcome.kind === "skipped" ? before.outcome.reason : before.outcome.kind;
  ok(reasonBefore.includes("másik szálláshoz is tartozik"), "⑪ a levél-út száraz próbája ezzel az okkal áll meg", reasonBefore);
  await rule(a, b, "same_owner");
  const after = await sendOutreachMail(pa.id, { dryRun: true, probe: true });
  const reasonAfter = after.outcome.kind === "skipped" ? after.outcome.reason : after.outcome.kind;
  ok(!reasonAfter.includes("másik szálláshoz"), "⑪ az ítélet után a levél-út továbbenged (a következő kapuig)", reasonAfter);

  const smsSrc = readFileSync("src/outreach/sendOutreachSms.ts", "utf8");
  ok(/sharedContactBlocks\(p\.leadId, "phone", to,/.test(smsSrc), "⑪ a mobil-út a normalizált számmal hívja a kaput");
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
  console.error(`\n🔴 shared-contact-gate-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ shared-contact-gate-check: a szomszéd elérhetőségére nem megy ki mock, az azonos tulaj ítélete felold.");
process.exit(0);
