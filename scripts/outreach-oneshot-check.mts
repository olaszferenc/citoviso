// ⛔ ONE COLD MAIL PER ADDRESS — not per prospect row (Elek FK-004 ③).
//
// The promise the console makes to the operator is "egy csatornán csak egyszer megy ki
// hideg megkeresés". Until 2026-09-11 that was keyed on `prospect.email_sent_at` of the
// ROW being sent, which is not the same statement: generate a second tracked link for
// the same lead — a new mock, a re-run, an operator creating another row — and the same
// human receives a second cold letter with the same subject. Measured on the test park:
// two prospect rows, one address, both sendable.
//
// This guard is READ-ONLY (the dev DB is shared by every worktree, so a guard that
// writes fixtures is a guard that corrupts a colleague's measurement). It asserts:
//   ① the batch's eligibility query never offers the same address twice;
//   ② the address-level predicate agrees with the row-level stamps;
//   ③ NEGATIVE CONTROL: the OLD, row-scoped query shape is re-run here, and the guard
//      states whether it would have offered a duplicate — if the current data cannot
//      even express the bug, the guard says so loudly instead of claiming a green.
// Legacy double-sends already in the data are reported as facts, not as failures:
// they happened before the rule existed and cannot be un-sent.
//
// Usage: npx tsx scripts/outreach-oneshot-check.mts

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import { listSendableProspects } from "../src/outreach/sendBatch.js";

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`✅ ${what}`);
  else {
    failed++;
    console.error(`❌ ${what}${detail ? `\n     ${detail}` : ""}`);
  }
};

// ① The shipped eligibility query.
const sendable = await listSendableProspects();
const byAddress = new Map<string, string[]>();
for (const p of sendable) {
  const key = p.contactEmail.trim().toLowerCase();
  byAddress.set(key, [...(byAddress.get(key) ?? []), p.leadName]);
}
const dupes = [...byAddress.entries()].filter(([, v]) => v.length > 1);
say(
  dupes.length === 0,
  `a küldhető lista címenként legfeljebb egy sort kínál (${sendable.length} sor, ${byAddress.size} cím)`,
  dupes.map(([a, v]) => `${a} → ${v.length}× (${v.join(", ")})`).join("\n     "),
);

// ② The address-level predicate must agree with the stamps actually in the table.
const { emailAlreadyMailed } = await import("../src/outreach/sendBatch.js");
const stamped = await db
  .selectFrom("prospect")
  .select(["contact_email as email"])
  .where("email_sent_at", "is not", null)
  .where("contact_email", "is not", null)
  .execute();
const stampedAddresses = [...new Set(stamped.map((r) => (r.email ?? "").trim().toLowerCase()))];
let predicateOk = true;
const predicateDetail: string[] = [];
for (const a of stampedAddresses) {
  if (!(await emailAlreadyMailed(a))) {
    predicateOk = false;
    predicateDetail.push(`${a}: van kiküldött sora, mégis küldhetőnek mondja`);
  }
  // Case-insensitivity is the point of the rule, so measure it explicitly.
  if (a !== a.toUpperCase() && !(await emailAlreadyMailed(a.toUpperCase()))) {
    predicateOk = false;
    predicateDetail.push(`${a}: NAGYBETŰS alakra nem ismeri fel ugyanazt a postafiókot`);
  }
}
say(
  predicateOk,
  `a cím-szintű előellenőrzés minden kiküldött címre fog (${stampedAddresses.length} cím, kis- és nagybetűs alakban)`,
  predicateDetail.join("\n     "),
);

// ③ NEGATIVE CONTROL — what the OLD, row-scoped rule would have offered.
const oldShape = await db
  .selectFrom("prospect")
  .innerJoin("lead", "lead.id", "prospect.lead_id")
  .innerJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
  .select(["prospect.contact_email as email", "lead.name as leadName"])
  .where("prospect.status", "in", ["created", "sent"])
  .where("prospect.email_sent_at", "is", null)
  .where("mock_artifact.status", "=", "approved")
  .where("prospect.contact_email", "is not", null)
  .where("prospect.unsubscribed_at", "is", null)
  .execute();
const oldByAddress = new Map<string, number>();
for (const r of oldShape) {
  const key = (r.email ?? "").trim().toLowerCase();
  oldByAddress.set(key, (oldByAddress.get(key) ?? 0) + 1);
}
const oldDupes = [...oldByAddress.entries()].filter(([, n]) => n > 1);
if (oldDupes.length) {
  console.log(
    `\n🔍 negatív kontroll: a RÉGI, sor-szintű szabály ${oldDupes.length} címre kínálna több levelet ` +
      `(${oldDupes.map(([a, n]) => `${a} ×${n}`).join(", ")}) — az új szabály ezeket egyre szűkíti.`,
  );
} else {
  console.log(
    "\n⚠️  negatív kontroll NEM ÉRTELMEZHETŐ: a jelenlegi adatokon a régi szabály sem kínálna " +
      "duplikátumot, tehát ez a futás NEM bizonyítja, hogy az új szabály fog. Két azonos című, " +
      "küldetlen prospect-sor kell hozzá.",
  );
}

// Facts, not failures: double-sends that already happened.
const legacy = await sql<{ email: string; n: number }>`
  select lower(contact_email) as email, count(*)::int as n
  from prospect
  where email_sent_at is not null and contact_email is not null
  group by lower(contact_email) having count(*) > 1
`.execute(db);
if (legacy.rows.length) {
  console.log(
    `\nℹ️  a szabály ELŐTTI adat: ${legacy.rows.length} címre már ment több hideg levél ` +
      `(${legacy.rows.map((r) => `${r.email} ×${r.n}`).join(", ")}). Ez megtörtént, nem visszavonható.`,
  );
}

console.log(failed === 0 ? "\n🟢 outreach-oneshot-check: rendben" : `\n🔴 outreach-oneshot-check: ${failed} hiba`);
process.exit(failed === 0 ? 0 : 1);
