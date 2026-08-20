// One-purpose data hygiene: remove stored contact addresses that today's
// quality bar rejects. Usage: npx tsx scripts/scrub-contacts.mts [--apply]
//
// WHY: until 2026-08-20 enrichContact took assessment.emails[0] UNFILTERED, so
// theme placeholders (info@domainem.hu, your@email.com, wordpress@example.com)
// and office addresses (heviz@tourinform.hu) were persisted as lead contacts.
// The filter is fixed going forward, but the rows already written stay wrong
// until scrubbed — and a cold email to any of them is a bounce or spam to a
// stranger. Runs over EVERY lead (the reenrich backfill only looks at the
// no_site segment, so these fall outside it).
//
// Deterministic and reversible in spirit: it only ever CLEARS a field the
// current isBusinessEmail() rejects, and records why in lead_provenance.

import { db } from "../src/db/client.js";
import { isBusinessEmail } from "../src/scraper/enrichWebSearch.js";
import { resolveChannel } from "../src/scraper/enrichContact.js";
import type { QualifiedLead } from "../src/scraper/types.js";

const apply = process.argv.slice(2).includes("--apply");

const rows = await db
  .selectFrom("lead")
  .select(["id", "name", "lifecycle_status", "raw"])
  .execute();

const dirty: { id: string; name: string; email: string; raw: QualifiedLead; stage: string }[] = [];
for (const r of rows) {
  const raw = (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead;
  if (raw.email && !isBusinessEmail(raw.email)) {
    dirty.push({ id: r.id, name: r.name, email: raw.email, raw, stage: r.lifecycle_status });
  }
}

console.log(
  `Kontakt-takarítás: ${dirty.length} lead tárolt e-mail címe bukik a mai szűrőn — ${apply ? "ÉLES ÍRÁS" : "DRY-RUN (--apply írna)"}\n`,
);
if (!dirty.length) process.exit(0);

let cleaned = 0;
for (const d of dirty) {
  // A lead already in outreach may have been contacted ON this address; the
  // operator must see that, so it is reported but not silently rewritten.
  const postOutreach = !["qualified", "mock_curation"].includes(d.stage);
  console.log(
    `  ${postOutreach ? "⚠️ KÉZI" : "törlés  "} ${d.name} (${d.stage}): ${d.email}`,
  );
  if (!apply || postOutreach) continue;

  const restored: QualifiedLead = { ...d.raw };
  delete (restored as { email?: string }).email;
  (restored as { contactChannel?: string }).contactChannel = resolveChannel(
    undefined,
    restored.phone,
  );
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("lead")
      .set({ raw: JSON.stringify(restored) })
      .where("id", "=", d.id)
      .execute();
    await trx
      .insertInto("lead_provenance")
      .values({
        lead_id: d.id,
        field: "email",
        value: `(törölve — nem üzleti/sablon cím: ${d.email})`,
        source: "contact_scrub",
        matched_entity: null,
        confidence: null,
      })
      .execute();
  });
  cleaned++;
}

console.log(
  `\n${apply ? `${cleaned} cím törölve.` : "Írás NEM történt (dry-run)."}`,
);
process.exit(0);
