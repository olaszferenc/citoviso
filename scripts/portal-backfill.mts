/**
 * PORTÁL-BACKFILL — a MÁR TÁROLT kontaktálható leadek ismert portál-adatlapjainak beolvasása.
 *
 * MIÉRT (tulajdonosi döntés 2026-10-01, „portál előbb, mindenkinek”): élesen 1 417 kontaktálható
 * leadből 977-nek VAN ismert portál-adatlapja, de csak 31-nek volt beolvasott portál-fotója — az
 * `enrichPortal` futásonként 60 leadet olvasott. A plafon a scrape-ből kiment, de a scrape csak az
 * ÚJ leadeket olvassa (a tároltakat a store-dedup úgyis eldobja). A tárolt park ezzel a szkripttel
 * kapja meg ugyanazt: így a mock portál-fotóból épül, és nem fizetős Places-fotóból.
 *
 * MIT CSINÁL
 *   (alap, READ-ONLY)  megszámolja, hány leadnek van ingyen olvasható adatlapja, és becsli a futásidőt.
 *   --go               beolvas és ír: kötegenként (BATCH) menti a leadet, tehát egy megszakított futás
 *                      ott folytatódik, ahol abbamaradt (`portalLookupAt` jelöli a kész leadet).
 *   --limit N          legfeljebb N lead ebben a futásban.
 *   --redo             a már olvasott (`portalLookupAt`) leadeket is újraolvassa.
 *
 * ⛔ AMIT NEM CSINÁL: nem keres a weben (Brave/CSE kvóta), és nem hív Google-t (Places / Street View)
 * — csak a leadhez MÁR kötött adatlapokat olvassa, a portál udvariassági sorosításával
 * (politeness.ts: hostonként egy kérés, szünettel, robots.txt szerint). A tárolt `raw`-ot nem írja
 * felül: csak a portál-mezőket olvasztja bele (`raw || patch`), a kurátori szerkesztés megmarad.
 *
 * Futtatás:
 *   npx tsx scripts/portal-backfill.mts              # mérés + becslés
 *   npx tsx scripts/portal-backfill.mts --go         # beolvasás + mentés (~75–100 perc a teljes élesi parkra)
 */
import { sql } from "kysely";

import { db } from "../src/db/client.js";
import { enrichPortal, portalPhotosOf } from "../src/scraper/enrichPortal.js";
import { getRegion, loadRegions } from "../src/scraper/regions.js";
import { findPortalCandidates } from "../src/scraper/sources/portalListing.js";
import type { QualifiedLead, Region } from "../src/scraper/types.js";
import { curatorOwnsEmail } from "../src/scraper/curatorEmail.js";

const GO = process.argv.includes("--go");
const REDO = process.argv.includes("--redo");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Number.POSITIVE_INFINITY;
/** Leads per save point — a crash loses at most one batch of reads. */
const BATCH = 100;
/**
 * Wall seconds per lead, measured 2026-10-02 (ADR-0298): 40 random prod leads read for real at the
 * pass' concurrency 4, after booking.com went challenge_protected and hovamenjek moved to fullHd —
 * 49.3 s / 49.5 s (before: 98.2 s / 63.8 s). The 2026-10-01 model (78.5 min for 1 057) did not
 * reproduce with the old code either (1.6–2.5 s/lead).
 */
const MEASURED_SEC_PER_LEAD = 49.4 / 40;

const rows = await db
  .selectFrom("lead")
  .select(["id", "raw"])
  .where(sql<boolean>`(raw->>'isLead')::boolean`)
  .execute();

await loadRegions(true);
const regionOf = new Map<string, Region | null>();
function region(id: string): Region | null {
  if (!regionOf.has(id)) {
    try {
      regionOf.set(id, getRegion(id));
    } catch {
      regionOf.set(id, null);
    }
  }
  return regionOf.get(id)!;
}

const todo: { id: string; lead: QualifiedLead; region: Region }[] = [];
let alreadyRead = 0;
let noRegion = 0;
let nothingKnown = 0;
for (const r of rows) {
  const lead = (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead;
  if (!REDO && (lead.portalLookupAt || (lead.portalProfiles?.length ?? 0) > 0)) {
    alreadyRead++;
    continue;
  }
  const reg = region(lead.region);
  if (!reg) {
    noRegion++;
    continue;
  }
  if (!(await findPortalCandidates(lead, reg, 6, false)).length) {
    nothingKnown++;
    continue;
  }
  todo.push({ id: r.id, lead, region: reg });
}
const run = todo.slice(0, LIMIT);

console.log(
  `Kontaktálható lead: ${rows.length} · már olvasva: ${alreadyRead} · nincs ismert adatlap: ${nothingKnown}` +
    (noRegion ? ` · ismeretlen régió: ${noRegion}` : "") +
    ` · OLVASANDÓ: ${todo.length}` +
    (run.length < todo.length ? ` (ebben a futásban: ${run.length})` : ""),
);
console.log(
  `Becsült futásidő: ~${Math.round((run.length * MEASURED_SEC_PER_LEAD) / 60)} perc ` +
    `(mérve 2026-10-02, 40 éles leaden; a padló a leglassabb host soros olvasása — ma a hovamenjek.hu).`,
);
if (!GO) {
  console.log("Szárazfutás — íráshoz: --go");
  await db.destroy();
  process.exit(0);
}

let saved = 0;
let withPhotos = 0;
const t0 = Date.now();
for (let i = 0; i < run.length; i += BATCH) {
  const batch = run.slice(i, i + BATCH);
  // One enrichPortal call per region: the region only feeds the entity match's town terms.
  const byRegion = new Map<string, typeof batch>();
  for (const t of batch) byRegion.set(t.region.id, [...(byRegion.get(t.region.id) ?? []), t]);
  for (const group of byRegion.values()) {
    const after = await enrichPortal(
      group.map((t) => t.lead),
      group[0]!.region,
      { maxSearchLeads: 0 },
    );
    for (let k = 0; k < group.length; k++) {
      const before = group[k]!.lead;
      const next = after[k]!;
      if (!next.portalLookupAt) continue;
      const portalPhotos = portalPhotosOf(next).length;
      if (portalPhotos > 0) withPhotos++;
      const patch: Record<string, unknown> = {
        portalLookupAt: next.portalLookupAt,
        portalProfiles: next.portalProfiles ?? [],
        listings: next.listings ?? [],
      };
      if (next.phone && next.phone !== before.phone) patch.phone = next.phone;
      // A curator-saved (or curator-cleared) address stays (ADR-XXXX ③).
      if (next.email && next.email !== before.email && !curatorOwnsEmail(before)) patch.email = next.email;
      if (before.material) {
        // Same sum as enrichMaterial's buildMaterial, from the stored components (not the stored
        // total — older rows carry totalImages: null) and without its Street View call.
        const m = before.material;
        const totalImages =
          (m.placesPhotos ?? 0) + (m.websiteImages ?? 0) + portalPhotos + (m.streetView ? 1 : 0);
        patch.material = { ...m, portalPhotos, totalImages, hasAnyImage: totalImages > 0 };
      }
      await db
        .updateTable("lead")
        .set({ raw: sql`raw || ${JSON.stringify(patch)}::jsonb` })
        .where("id", "=", group[k]!.id)
        .execute();
      saved++;
    }
  }
  console.log(
    `  mentve ${saved}/${run.length} · portál-fotóval: ${withPhotos} · ${Math.round((Date.now() - t0) / 1000)} mp`,
  );
}
console.log(`✅ Kész: ${saved} lead olvasva, ${withPhotos}-nek lett portál-fotója.`);
await db.destroy();
