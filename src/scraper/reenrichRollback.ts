// Rollback for a reenrich backfill run (see reenrich.ts).
// Usage: npm run reenrich:rollback -- [--apply]
//
// WHY THIS EXISTS: the 2026-08-20 Keszthely backfill wrote 14 leads, and a
// review of the results found the site matches were verified against the
// REGION LABEL ("Keszthely és környéke"), not the lead's own town — so a
// Keszthely page "corroborated" a lead in Révfülöp, Badacsonytomaj or
// Balatonboglár. 4 of 6 site reclassifications were wrong. The same
// region-wide query fished the contact data, so the whole write is suspect,
// not just the failures. Reverting all of it beats hand-picking survivors.
//
// The revert is DETERMINISTIC, not a guess:
//   - every touched lead was `no_site` (that was the backfill's own filter),
//   - its pre-backfill website is preserved in lead_provenance as the
//     `presence_check` row (the backfill added its own row rather than
//     replacing it),
//   - email/phone were only ever written when previously EMPTY, so clearing
//     the backfill-written ones restores the original state exactly.
// The assessment block is dropped: it describes the wrongly-matched page.

import { db } from "../db/client.js";
import { classifyWebsite } from "./qualify.js";
import type { QualifiedLead } from "./types.js";

const BACKFILL_SOURCE = "web_search_backfill";

function parseArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.slice(2).includes("--apply") };
}

async function main(): Promise<void> {
  const { apply } = parseArgs(process.argv);

  const touched = await db
    .selectFrom("lead_provenance")
    .select("lead_id")
    .distinct()
    .where("source", "=", BACKFILL_SOURCE)
    .execute();
  if (!touched.length) {
    console.log("Nincs visszavonandó backfill-írás.");
    process.exit(0);
  }
  const ids = touched.map((t) => t.lead_id);

  const leads = await db
    .selectFrom("lead")
    .select(["id", "name", "qualification", "raw"])
    .where("id", "in", ids)
    .execute();
  const provRows = await db
    .selectFrom("lead_provenance")
    .select(["lead_id", "field", "value", "source"])
    .where("lead_id", "in", ids)
    .execute();

  console.log(
    `Backfill-visszavonás: ${leads.length} lead — ${apply ? "ÉLES ÍRÁS" : "DRY-RUN (írás nélkül; --apply írna)"}\n`,
  );

  let reverted = 0;
  for (const lead of leads) {
    const raw = (
      typeof lead.raw === "string" ? JSON.parse(lead.raw) : lead.raw
    ) as QualifiedLead;
    const mine = provRows.filter(
      (p) => p.lead_id === lead.id && p.source === BACKFILL_SOURCE,
    );
    // Pre-backfill website: the presence_check row holds the original value.
    const original = provRows.find(
      (p) => p.lead_id === lead.id && p.field === "website" && p.source === "presence_check",
    )?.value;
    const originalIsUrl = Boolean(original && /^https?:\/\//i.test(original));
    const website = originalIsUrl ? original! : undefined;
    const websiteStatus = website
      ? classifyWebsite(website)
      : original === "portal_only" || original === "none"
        ? (original as QualifiedLead["websiteStatus"])
        : "none";

    const restored: QualifiedLead = { ...raw, websiteStatus, isLead: true };
    if (website) (restored as { website?: string }).website = website;
    else delete (restored as { website?: string }).website;
    // The assessment described the wrongly-matched page — drop it.
    delete (restored as { assessment?: unknown }).assessment;
    // Contact fields the backfill added (it only wrote into empty ones).
    for (const p of mine) {
      if (p.field === "email") delete (restored as { email?: string }).email;
      if (p.field === "phone") delete (restored as { phone?: string }).phone;
    }
    (restored as { contactChannel?: string }).contactChannel = restored.email
      ? "email"
      : restored.phone
        ? "voice"
        : "none";

    const changes = mine.map((p) => p.field).join(", ");
    console.log(
      `  ${lead.name}: visszaáll (${changes}) → honlap: ${websiteStatus}${website ? ` (${website})` : ""}, email: ${restored.email ?? "-"}, tel: ${restored.phone ?? "-"}`,
    );

    if (!apply) continue;
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("lead")
        .set({ qualification: "no_site", raw: JSON.stringify(restored) })
        .where("id", "=", lead.id)
        .execute();
      // Drop the backfill's provenance rows: the claims they recorded are
      // withdrawn, so the ledger must not keep asserting them.
      await trx
        .deleteFrom("lead_provenance")
        .where("lead_id", "=", lead.id)
        .where("source", "=", BACKFILL_SOURCE)
        .execute();
    });
    reverted++;
  }

  console.log(
    `\n${apply ? `${reverted} lead visszaállítva (a backfill provenance-sorai törölve).` : "Írás NEM történt (dry-run)."}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Rollback hiba:", err);
  process.exit(1);
});
