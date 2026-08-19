// Re-enrichment backfill for EXISTING leads (no new inserts).
// Usage: npm run reenrich -- [regionId] [--apply]
//
// WHY: enrichment only ever ran DURING a scrape, and persist only INSERTS —
// the cross-run dedup skips existing leads entirely, so a stock scraped before
// a new source went live (e.g. Brave Search, ADR-0026) never benefits from it.
// Two concrete risks on such a stock: (1) a "no_site" qualification decided
// WITHOUT web search may be wrong — contacting a lead who HAS a site with
// "you have no website" is the §F credibility bug; (2) email-poor no-site
// leads never got the web contact search.
//
// This runner re-runs the SAME enrichers (site search → outdatedness → contact
// search → channel) over the persisted no_site stock and UPDATES the rows in
// place. Dry-run by default; --apply writes. Only pre-outreach leads
// (qualified / mock_curation) are touched — a lead already contacted must not
// be silently requalified; those are reported for the operator instead.

import { config } from "../config.js";
import { db } from "../db/client.js";
import { enrichContact } from "./enrichContact.js";
import { enrichOutdated } from "./enrichOutdated.js";
import { enrichSiteSearch } from "./enrichSiteSearch.js";
import { enrichWebSearch, NON_BUSINESS_EMAIL_RE } from "./enrichWebSearch.js";
import { qualificationOf } from "./persist.js";
import { getRegion, loadRegions } from "./regions.js";
import { webSearchAvailable, webSearchBackend } from "./sources/webSearch.js";
import type { QualifiedLead } from "./types.js";

/** Lifecycle stages where a silent requalification is safe (nothing sent yet). */
const UPDATABLE_LIFECYCLES = ["qualified", "mock_curation"];

function parseArgs(argv: string[]): { regionId?: string; apply: boolean } {
  const args = argv.slice(2);
  let regionId: string | undefined;
  let apply = false;
  for (const a of args) {
    if (a === "--apply") apply = true;
    else if (!a.startsWith("--")) regionId = a;
  }
  return { regionId, apply };
}

interface LeadRow {
  id: string;
  lifecycle_status: string;
  raw: QualifiedLead;
}

async function main(): Promise<void> {
  const { regionId, apply } = parseArgs(process.argv);
  if (!webSearchAvailable()) {
    console.error("⛔ Nincs webes kereső-backend (BRAVE_API_KEY) — a backfill értelmetlen.");
    process.exit(1);
  }
  await loadRegions(true);

  // Target: the persisted no_site stock. raw holds the full QualifiedLead.
  const rows = (await db
    .selectFrom("lead")
    .select(["id", "lifecycle_status", "raw"])
    .where("qualification", "=", "no_site")
    .where("lifecycle_status", "not in", ["terminated", "disqualified"])
    .execute()) as unknown as LeadRow[];

  const parsed = rows
    .map((r) => ({
      ...r,
      raw: typeof r.raw === "string" ? (JSON.parse(r.raw) as QualifiedLead) : r.raw,
    }))
    .filter((r) => !regionId || r.raw.region === regionId);

  const skippedStage = parsed.filter(
    (r) => !UPDATABLE_LIFECYCLES.includes(r.lifecycle_status),
  );
  const targets = parsed.filter((r) =>
    UPDATABLE_LIFECYCLES.includes(r.lifecycle_status),
  );

  console.log(
    `Backfill (${webSearchBackend()}): ${targets.length} no_site lead${regionId ? ` · régió: ${regionId}` : ""} — ${apply ? "ÉLES ÍRÁS" : "DRY-RUN (írás nélkül; --apply írna)"}`,
  );
  if (skippedStage.length) {
    console.log(
      `⚠️ ${skippedStage.length} lead már outreach utáni fázisban — NEM nyúlunk hozzá, de érdemes kézzel átnézni:`,
    );
    for (const r of skippedStage) {
      console.log(`   - ${r.raw.name} (${r.lifecycle_status})`);
    }
  }
  if (!targets.length) {
    console.log("Nincs feldolgozandó lead.");
    process.exit(0);
  }

  // Region by region: the enrichers need the Region object for geo-verify.
  const byRegion = new Map<string, LeadRow[]>();
  for (const r of targets) {
    const list = byRegion.get(r.raw.region) ?? [];
    list.push(r);
    byRegion.set(r.raw.region, list);
  }

  let sitesFound = 0;
  let emailsFound = 0;
  let emailsRemoved = 0;
  let phonesFound = 0;
  let updated = 0;

  for (const [rid, group] of byRegion) {
    let region;
    try {
      region = getRegion(rid);
    } catch {
      console.error(
        `⛔ Ismeretlen régió "${rid}" (${group.length} lead) — kihagyva. A régiónak léteznie kell a region táblában.`,
      );
      continue;
    }
    console.log(`\n— ${region.label}: ${group.length} lead —`);

    // The SAME chain a scrape run uses on this segment, same order:
    // site discovery → outdatedness for the newly-found sites → contact
    // search for the still email-poor → channel resolution.
    const before = group.map((g) => g.raw);
    // Scrub known-bad stored contacts first (the pre-filter era stored the
    // tourist office's address on some leads) — otherwise "has an email"
    // makes the contact search skip exactly the leads that need it.
    const scrubbed = before.map((l) =>
      l.email && NON_BUSINESS_EMAIL_RE.test(l.email)
        ? { ...l, email: undefined }
        : l,
    );
    const withSearch = await enrichSiteSearch(
      scrubbed,
      config.googleMapsApiKey,
      config.googleCseId,
      region,
    );
    const assessed = await enrichOutdated(withSearch);
    const withWeb = await enrichWebSearch(
      assessed,
      config.googleMapsApiKey,
      config.googleCseId,
      region.label,
    );
    const after = enrichContact(withWeb);

    for (let i = 0; i < group.length; i++) {
      const row = group[i]!;
      const oldL = before[i]!;
      const newL = after[i]!;
      const changes: string[] = [];
      if (newL.websiteStatus !== oldL.websiteStatus || newL.website !== oldL.website) {
        sitesFound++;
        changes.push(
          `honlap: ${oldL.websiteStatus} → ${newL.websiteStatus} (${newL.website ?? "-"})`,
        );
      }
      if (newL.email !== oldL.email) {
        if (newL.email) emailsFound++;
        else emailsRemoved++;
        changes.push(
          newL.email
            ? `email: ${newL.email}`
            : `email TÖRÖLVE (nem üzleti cím: ${oldL.email})`,
        );
      }
      if (newL.phone && !oldL.phone) {
        phonesFound++;
        changes.push(`telefon: ${newL.phone}`);
      }
      if (!changes.length) continue;
      console.log(`  ${row.raw.name}: ${changes.join(" · ")}`);

      if (!apply) continue;
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("lead")
          .set({
            qualification: qualificationOf(newL),
            raw: JSON.stringify(newL),
          })
          .where("id", "=", row.id)
          .execute();
        // Provenance for every changed fact — the trust ledger must show that
        // these came from a later web-search backfill, not the original scrape.
        const prov = [];
        if (newL.website !== oldL.website) {
          prov.push({
            lead_id: row.id,
            field: "website",
            value: newL.website ?? newL.websiteStatus,
            source: "web_search_backfill",
            matched_entity: null,
            confidence: null,
          });
        }
        if (newL.email !== oldL.email) {
          prov.push({
            lead_id: row.id,
            field: "email",
            value: newL.email ?? `(törölve — nem üzleti cím: ${oldL.email})`,
            source: "web_search_backfill",
            matched_entity: null,
            confidence: null,
          });
        }
        if (newL.phone && !oldL.phone) {
          prov.push({
            lead_id: row.id,
            field: "phone",
            value: newL.phone,
            source: "web_search_backfill",
            matched_entity: null,
            confidence: null,
          });
        }
        if (prov.length) {
          await trx.insertInto("lead_provenance").values(prov).execute();
        }
      });
      updated++;
    }
  }

  console.log(
    `\nÖsszegzés: ${sitesFound} honlap-átminősítés · ${emailsFound} új email · ${emailsRemoved} rossz email törölve · ${phonesFound} új telefon` +
      (apply ? ` · ${updated} lead FRISSÍTVE a DB-ben` : " · írás NEM történt (dry-run)"),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill hiba:", err);
  process.exit(1);
});
