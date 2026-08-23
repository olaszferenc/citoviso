// Re-scrape ONLY the portal photos (and the material count they feed) for ONE
// persisted lead, on demand from the lead page's Fotók panel.
//
// WHY a separate path from reenrichOne: the general "Adatok újragyűjtése" button
// runs the enrichment chain but DELIBERATELY skips enrichPortal — the portal
// read is the slow, expensive pass, and most reenrich reasons (a rotted website
// tag, a corrected city) do not need it. So the portal photo strip could never
// be refreshed from the console short of a full region re-scrape. This gives the
// operator exactly that one action, next to the photos they are looking at.
//
// LIFECYCLE: no guard. Unlike reenrichOne, re-pulling the SOURCE photos does not
// rewrite the story under a sent offer — the delivered mock is served from its
// own static snapshot and is not re-rendered by this (owner ruling, 2026-08-23).
//
// NO OVERWRITE: enrichPortal already merges into l.portalProfiles and only fills
// contact gaps (l.phone ?? …), so curator edits and the raw audit trail survive.

import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { enrichMaterial } from "./enrichMaterial.js";
import { enrichPortal, portalPhotosOf } from "./enrichPortal.js";
import { qualificationOf } from "./persist.js";
import { getRegion, loadRegions } from "./regions.js";
import type { QualifiedLead } from "./types.js";

export interface RescrapePhotosResult {
  readonly ok: boolean;
  /** Operator-facing summary (Hungarian, shown as a flash on the lead page). */
  readonly message: string;
}

export async function rescrapePhotos(
  leadId: string,
): Promise<RescrapePhotosResult> {
  const row = await db
    .selectFrom("lead")
    .select(["id", "raw"])
    .where("id", "=", leadId)
    .executeTakeFirst();
  if (!row) return { ok: false, message: "Nincs ilyen lead." };

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

  // The portal read, then the material re-measure so the photo count reflects
  // the fresh strip. Same two passes a scrape run applies, on a single item.
  let leads = await enrichPortal([before], region);
  leads = await enrichMaterial(leads, config.googleMapsApiKey);
  const after = leads[0];

  // Curator edits and the audit trail live on `raw` outside the QualifiedLead
  // shape — carry them across verbatim so a re-scrape never erases them.
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

  const beforePhotos = portalPhotosOf(before).length;
  const afterPhotos = portalPhotosOf(after).length;
  const profileCount = after.portalProfiles?.length ?? 0;

  if (afterPhotos > beforePhotos) {
    return {
      ok: true,
      message: `Fotók újra-scrapelve — portál-fotó: ${beforePhotos} → ${afterPhotos}.`,
    };
  }
  if (afterPhotos > 0) {
    return {
      ok: true,
      message: `Fotók újra-scrapelve — nem változott (${afterPhotos} portál-fotó).`,
    };
  }
  // 0 photos. DISTINGUISH the two very different reasons, or the operator reads
  // "no listing" when in fact listings were found and their photos were filtered.
  if (profileCount > 0) {
    return {
      ok: true,
      message:
        `Fotók újra-scrapelve — ${profileCount} portál-adatlap feldolgozva, de 0 használható fotó: ` +
        `a talált képek a minőség-küszöb alatt vannak. A szallas.hu teljes ` +
        `galériája Cloudflare-védett, ezért nem scrapeljük (jog-doktrína).`,
    };
  }
  return {
    ok: true,
    message: "Fotók újra-scrapelve — ehhez a leadhez nem találtunk portál-adatlapot.",
  };
}
