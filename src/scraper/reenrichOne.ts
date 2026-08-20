// Re-run the enrichment chain for ONE persisted lead, on demand from the console.
//
// WHY: enrichment used to happen only during a scrape, and the CLI backfill
// (reenrich.ts) only targets `qualification = no_site`. So a lead that looked
// wrong for any OTHER reason — a rotted website tag that made it has_own, a city
// the curator just corrected — could not be refreshed at all short of a full
// re-scrape of its region. That is precisely the situation an operator is in
// while staring at one bad record, which is why this lives behind a button on
// the lead page rather than in a CLI.
//
// Safety rules, both learned the hard way on 2026-08-20:
//  · LIFECYCLE GUARD — only a lead that has not been contacted yet may be
//    silently requalified. Once outreach is out, changing the story underneath
//    it is worse than a stale record.
//  · NO OVERWRITE — every enricher in the chain fills gaps (`l.phone ?? …`), so
//    curator edits survive. The single exception is a DEAD website link, which
//    enrichOutdated repairs to a geo-verified live URL; keeping a 404 helps
//    nobody.

import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { enrichContact } from "./enrichContact.js";
import { enrichGeo } from "./enrichGeo.js";
import { enrichMaterial } from "./enrichMaterial.js";
import { enrichOutdated } from "./enrichOutdated.js";
import { enrichPlaces } from "./enrichPlaces.js";
import { enrichPresence } from "./enrichPresence.js";
import { enrichSiteSearch } from "./enrichSiteSearch.js";
import { enrichWebSearch } from "./enrichWebSearch.js";
import { qualificationOf } from "./persist.js";
import { getRegion, loadRegions } from "./regions.js";
import type { QualifiedLead } from "./types.js";

/** Lifecycle stages where a silent requalification is safe (nothing sent yet). */
const UPDATABLE_LIFECYCLES = ["qualified", "mock_curation"];

export interface ReenrichResult {
  readonly ok: boolean;
  /** Operator-facing summary of what changed (Hungarian, shown as a flash). */
  readonly message: string;
}

export async function reenrichOne(leadId: string): Promise<ReenrichResult> {
  const row = await db
    .selectFrom("lead")
    .select(["id", "raw", "lifecycle_status"])
    .where("id", "=", leadId)
    .executeTakeFirst();
  if (!row) return { ok: false, message: "Nincs ilyen lead." };

  if (!UPDATABLE_LIFECYCLES.includes(row.lifecycle_status)) {
    return {
      ok: false,
      message:
        `Ez a lead már a(z) „${row.lifecycle_status}" fázisban van — a néma újraminősítés ` +
        `letiltva, mert a megkeresés már kiment. Előbb vidd vissza kurációba.`,
    };
  }

  const before = (
    typeof row.raw === "string" ? JSON.parse(row.raw) : row.raw
  ) as QualifiedLead;

  await loadRegions(true);
  let region;
  try {
    region = getRegion(before.region);
  } catch {
    return {
      ok: false,
      message: `Ismeretlen régió: „${before.region}" — a régiónak léteznie kell a region táblában.`,
    };
  }

  // The same chain a scrape run uses, in the same order, on a single-item array.
  let leads = [before];
  leads = await enrichPlaces(leads, config.googleMapsApiKey);
  leads = await enrichPresence(leads, region);
  leads = await enrichSiteSearch(
    leads,
    config.googleMapsApiKey,
    config.googleCseId,
    region,
  );
  leads = await enrichOutdated(leads, region);
  leads = await enrichMaterial(leads, config.googleMapsApiKey);
  leads = await enrichWebSearch(
    leads,
    config.googleMapsApiKey,
    config.googleCseId,
    region,
    // FORCE: the operator asked for THIS lead by hand and wants to SEE the
    // evidence. The thrift rule (skip a lead that already has a usable address)
    // belongs to bulk runs — here it produced an empty contact ledger, which
    // reads as "the web search found nothing" when in fact it never ran.
    true,
  );
  leads = await enrichGeo(enrichContact(leads), region.country, () => {});

  const after = leads[0];
  // Curator edits and the audit trail live on `raw` outside the QualifiedLead
  // shape — carry them across verbatim so a re-enrich never erases them.
  const merged = {
    ...(before as unknown as Record<string, unknown>),
    ...(after as unknown as Record<string, unknown>),
  };

  await db
    .updateTable("lead")
    .set({
      raw: sql`${JSON.stringify(merged)}::jsonb`,
      qualification: qualificationOf(after),
      match_confidence: after.matchConfidence ?? null,
    })
    .where("id", "=", leadId)
    .execute();

  return { ok: true, message: describeChanges(before, after) };
}

/** What actually moved — an empty run must say so, not fake success. */
function describeChanges(before: QualifiedLead, after: QualifiedLead): string {
  const parts: string[] = [];
  if (before.website !== after.website) {
    parts.push(
      after.website
        ? `honlap: ${before.website ?? "nincs"} → ${after.website}`
        : "honlap törölve",
    );
  }
  if (before.websiteStatus !== after.websiteStatus) {
    parts.push(`státusz: ${before.websiteStatus} → ${after.websiteStatus}`);
  }
  if (!before.email && after.email) parts.push(`e-mail: ${after.email}`);
  if (!before.phone && after.phone) parts.push(`telefon: ${after.phone}`);
  if (!before.city && after.city) parts.push(`város: ${after.city}`);
  if (!before.country && after.country) parts.push(`ország: ${after.country}`);
  if (
    before.assessment?.reachable !== after.assessment?.reachable &&
    after.assessment
  ) {
    parts.push(`elérhető: ${after.assessment.reachable ? "igen" : "nem"}`);
  }
  const beforeImages = before.material?.totalImages ?? 0;
  const afterImages = after.material?.totalImages ?? 0;
  if (beforeImages !== afterImages) {
    parts.push(`kép: ${beforeImages} → ${afterImages}`);
  }
  return parts.length
    ? `Újragyűjtés kész — ${parts.join(" · ")}`
    : "Újragyűjtés kész — nem változott semmi.";
}
