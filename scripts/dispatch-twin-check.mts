// ONE OWNER, ONE OUTREACH (-bb + coordinator, 2026-10-27; Lakeside 79202242 ↔ Napsugár 6ad0d459).
//
// What this proves, on the real twinAlreadyContacted + the dispatch wiring:
//   ① a lead whose PHONE also belongs to another lead with a SENT prospect → held reason
//      „TARTVA iker: a közös kontaktra már ment megkeresés (<név>)”;
//   ② the same through a shared E-MAIL, and through the other prospect's contact_email;
//   ③ the other lead's prospect only CREATED (nothing sent) → no hold (a first outreach may go);
//   ④ a same_owner ruling does NOT release it (the check never reads lead_link);
//   ⑤ wiring: enqueue refuses, and the tick holds (held, not skipped) a twin.
//
// The dev DB is SHARED: ONE transaction, rolled back — the leads' contact edits and the prospect
// rows are never visible to anyone else.
//
// Run: npx tsx scripts/dispatch-twin-check.mts

import { readFileSync } from "node:fs";
import { sql } from "kysely";
import { randomBytes } from "node:crypto";
import { db } from "../src/db/client.js";
import { twinAlreadyContacted } from "../src/outreach/sharedContactGate.js";
import type { QualifiedLead } from "../src/scraper/types.js";

let failures = 0;
const check = (label: string, pass: boolean, detail?: unknown): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✓" : "✗"} ${label}${pass || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
};
class Rollback extends Error {}

console.log("egy gazda, egy megkeresés: a közös kontaktra már ment megkeresés → TARTVA");
try {
  await db.transaction().execute(async (trx) => {
    const leads = await trx
      .selectFrom("lead")
      .leftJoin("prospect", "prospect.lead_id", "lead.id")
      .where("prospect.id", "is", null)
      .select(["lead.id as id", "lead.name as name", "lead.raw as raw"])
      .limit(4)
      .execute();
    check("van 4 prospect nélküli lead a méréshez", leads.length === 4, leads.length);
    if (leads.length < 4) throw new Rollback();
    const [lakeside, napsugar, mailTwin, fresh] = leads as [typeof leads[number], typeof leads[number], typeof leads[number], typeof leads[number]];
    const setContact = (id: string, phone: string | null, email: string | null) =>
      trx
        .updateTable("lead")
        .set({
          raw: sql`(coalesce(raw, '{}'::jsonb) - 'phone' - 'email' - 'emails' - 'contacts') || ${JSON.stringify({ ...(phone ? { phone } : {}), ...(email ? { email } : {}) })}::jsonb`,
        })
        .where("id", "=", id)
        .execute();
    const tag = randomBytes(4).toString("hex");
    await setContact(lakeside.id, "+36 30 555 0" + "123", null);
    await setContact(napsugar.id, "06305550123", null);
    await setContact(mailTwin.id, null, `twin-${tag}@example.com`);
    await setContact(fresh.id, "+36 70 999 8877", `fresh-${tag}@example.com`);
    const prospect = (leadId: string, sent: boolean, email: string | null = null) =>
      trx
        .insertInto("prospect")
        .values({ lead_id: leadId, token: `twin${tag}${randomBytes(6).toString("hex")}`, contact_email: email, ...(sent ? { sent_at: new Date() } : {}) })
        .execute();
    await prospect(napsugar.id, true);
    const rawOf = async (id: string) => {
      const r = await trx.selectFrom("lead").select("raw").where("id", "=", id).executeTakeFirstOrThrow();
      return (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead;
    };

    const r1 = await twinAlreadyContacted(lakeside.id, await rawOf(lakeside.id), trx);
    check("① közös TELEFON (+36 30 555 0123 ↔ 06305550123), a másikon SENT prospect → TARTVA iker", r1 === `TARTVA iker: a közös kontaktra már ment megkeresés (${napsugar.name})`, r1);

    // ② e-mail: the other lead's prospect was mailed to this address (prospect.contact_email).
    await prospect(fresh.id, false);
    await trx.updateTable("prospect").set({ email_sent_at: new Date(), contact_email: `twin-${tag}@example.com` }).where("lead_id", "=", fresh.id).execute();
    const r2 = await twinAlreadyContacted(mailTwin.id, await rawOf(mailTwin.id), trx);
    check("② közös E-MAIL (a másik prospect contact_email-je, email_sent_at) → TARTVA iker", r2?.startsWith("TARTVA iker:") === true && r2.includes(fresh.name), r2);

    // ③ only created, nothing sent → a first outreach may go.
    await trx.updateTable("prospect").set({ sent_at: null }).where("lead_id", "=", napsugar.id).execute();
    const r3 = await twinAlreadyContacted(lakeside.id, await rawOf(lakeside.id), trx);
    check("③ a másik prospect csak létrehozva (semmi nem ment ki) → nincs tartás", r3 === null, r3);
    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) throw e;
}

const gate = readFileSync(new URL("../src/outreach/sharedContactGate.ts", import.meta.url), "utf8");
const twinFn = gate.slice(gate.indexOf("export async function twinAlreadyContacted"));
check("④ a same_owner ítélet nem oldja fel (a twinAlreadyContacted nem olvas lead_link-et)", !/lead_link|same_owner/.test(twinFn.slice(0, twinFn.indexOf("\n}\n"))));
const disp = readFileSync(new URL("../src/outreach/autoDispatch.ts", import.meta.url), "utf8");
check("⑤ bekötés: az alreadyContacted hívja, a tick held-re teszi (nem skipped), a sorba tétel elutasítja",
  /await twinAlreadyContacted\(leadId, raw\)/.test(disp) &&
    /status: contacted\.twin \? "held" : "skipped"/.test(disp) &&
    /if \(contacted\) return \{ ok: false, reason: contacted\.reason \}/.test(disp));

await db.destroy();
if (failures) {
  console.error(`\n⛔ dispatch-twin-check: ${failures} bukás — egy gazda második megkeresést kaphatna.`);
  process.exit(1);
}
console.log("\n✅ dispatch-twin-check: a közös telefonra / e-mailre már kiment megkeresés után a sor TARTVA, a same_owner sem engedi.");
