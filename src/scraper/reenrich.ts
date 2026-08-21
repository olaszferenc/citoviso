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
import { tokens } from "./enrichPresence.js";
import { enrichOutdated } from "./enrichOutdated.js";
import { enrichSiteSearch } from "./enrichSiteSearch.js";
import { enrichWebSearch, isBusinessEmail } from "./enrichWebSearch.js";
import { qualificationOf } from "./persist.js";
import { getRegion, loadRegions } from "./regions.js";
import { webSearchAvailable, webSearchBackend } from "./sources/webSearch.js";
import type { QualifiedLead } from "./types.js";

/** Lifecycle stages where a silent requalification is safe (nothing sent yet). */
const UPDATABLE_LIFECYCLES = ["qualified", "mock_curation"];

/**
 * Generic trade words. A name built ONLY from these ("Ifjúsági szállás",
 * "Üdülő tábor", "Vadkempingező hely" — typically OSM entries with no brand)
 * carries NO identity, so the brand+region verify() degenerates: every
 * directory page about student lodging in the region satisfies it. §F.14 calls
 * a brand-only match a collision; here there is not even a brand, so web search
 * cannot identify the business and a backfill must not guess on its behalf.
 * (The live scrape path deserves the same guard — see the session note.)
 */
const GENERIC_NAME_WORD = new Set([
  "szallas", "szallashely", "apartman", "apartmanhaz", "kemping", "camping",
  "udulo", "vendeghaz", "haz", "panzio", "hotel", "tabor", "hely", "ifjusagi",
  "turistahaz", "motel", "resort", "vendeglo", "etterem", "szoba", "szobak",
  "parton", "vadkempingezo", "diakszallas", "kozossegi", "faluhaz", "porta",
]);

function hasDistinctiveName(name: string): boolean {
  return tokens(name).some((t) => t.length >= 4 && !GENERIC_NAME_WORD.has(t));
}

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
  const updatable = parsed.filter((r) =>
    UPDATABLE_LIFECYCLES.includes(r.lifecycle_status),
  );
  const skippedGeneric = updatable.filter((r) => !hasDistinctiveName(r.raw.name));
  const targets = updatable.filter((r) => hasDistinctiveName(r.raw.name));

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
  if (skippedGeneric.length) {
    console.log(
      `ℹ️ ${skippedGeneric.length} lead neve csupa általános szó (nincs márka) — a webes azonosítás rájuk megbízhatatlan, kihagyva: ${skippedGeneric.map((r) => r.raw.name).join(", ")}`,
    );
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
  let listingsFound = 0;
  let ledgerFound = 0;
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
      l.email && !isBusinessEmail(l.email) ? { ...l, email: undefined } : l,
    );
    const withSearch = await enrichSiteSearch(
      scrubbed,
      config.googleMapsApiKey,
      config.googleCseId,
      region,
    );
    const assessed = await enrichOutdated(withSearch, region);
    const withWeb = await enrichWebSearch(
      assessed,
      config.googleMapsApiKey,
      config.googleCseId,
      region,
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
      // The enrichers also produce the DIGITAL FOOTPRINT — the portal pages the
      // business is listed on — and the contact ledger behind the chosen
      // address. Both live in `raw`, so a lead that gained ONLY these used to
      // fall through the `continue` below and keep nothing: the backfill found
      // the pages and then threw them away. They are the openable proof the
      // operator works from ("hol találtuk meg"), so they count as a change.
      const freshListings = (newL.listings ?? []).filter(
        (l) => !(oldL.listings ?? []).some((o) => o.url === l.url),
      );
      if (freshListings.length) {
        listingsFound += freshListings.length;
        changes.push(`${freshListings.length} portál-link`);
      }
      const ledgerGrowth = (newL.contacts?.length ?? 0) - (oldL.contacts?.length ?? 0);
      if (ledgerGrowth > 0) {
        ledgerFound += ledgerGrowth;
        changes.push(`${ledgerGrowth} kontakt-napló bejegyzés`);
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
        for (const l of freshListings) {
          prov.push({
            lead_id: row.id,
            field: "listing",
            value: l.title,
            source: "web_search_backfill",
            // Structured AND serialised, per the column's contract — never a bare URL.
            matched_entity: JSON.stringify({ url: l.url, verified: l.verified === true }),
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
    `\nÖsszegzés: ${sitesFound} honlap-átminősítés · ${emailsFound} új email · ${emailsRemoved} rossz email törölve · ${phonesFound} új telefon · ${listingsFound} portál-link · ${ledgerFound} kontakt-napló bejegyzés` +
      (apply ? ` · ${updated} lead FRISSÍTVE a DB-ben` : " · írás NEM történt (dry-run)"),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill hiba:", err);
  process.exit(1);
});
