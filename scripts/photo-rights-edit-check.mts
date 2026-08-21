// §A.2 fixture gate: the WATERMARK flag must survive the owner's photo edits (2026-08-21).
//
// WHY THIS EXISTS: reorder / caption / unit-assign each hand-rolled a `{url, alt,
// ...provenance}` literal when copying the photo set into the overrides. They all
// remembered `provenance` and all forgot `watermarked` — and since overrides REPLACE
// the photo array wholesale at render, the first time an owner moved a photo the §A.2
// flag was erased from the entire set. A watermarked image would then have gone live.
//
// Nothing surfaced it: no detector sets that flag yet, so the bug was lying in wait
// for the feature that depends on it. Typecheck could not see it either — dropping an
// optional field is perfectly legal. Only exercising the real edit path shows it.
//
// Needs the local DB (npm run db:up). Runs on a throwaway tenant it creates and removes.
//   npx tsx scripts/photo-rights-edit-check.mts

import { rm } from "node:fs/promises";
import { db, pool } from "../src/db/client.js";
import {
  getTenantContent,
  moveTenantPhoto,
  setTenantPhotoCaption,
  setTenantPhotoUnits,
} from "../src/tenant/editor.js";
import { applyLivePhotoPolicy } from "../src/engine/photoPolicy.js";
import type { SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const CLEAN = "https://cdn.booked.hu/_pr_check/clean.jpg";
const MARKED = "https://cdn.booked.hu/_pr_check/watermarked.jpg";

const BASE: SiteData = {
  name: "_pr_check panzió",
  tagline: "Teszt",
  intro: "Teszt bevezető a fixture-höz.",
  highlights: ["Egy"],
  photos: [
    { url: CLEAN, alt: "Tiszta portál-kép", provenance: "portal" },
    { url: MARKED, alt: "Vízjeles portál-kép", provenance: "portal", watermarked: true },
  ],
  contact: { email: "teszt@example.com" },
};

const ids: { defId?: string; runId?: string; leadId?: string; tenantId?: string; siteId?: string } = {};

console.log("Fotó-jogállás a tulaj szerkesztései után (eldobható fixture, valódi DB):\n");

try {
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_pr_check",
      country: "HU",
      region: "_test_pr",
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

  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "_pr_check lead", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;

  // The artifact is what loadSiteForEdit reads baseSiteData/recipe from — and the site
  // MUST point at it via source_artifact_id, or every edit below silently no-ops.
  const artifact = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: lead.id,
      path: "_pr_check.html",
      inputs: JSON.stringify({
        engine: "composition",
        recipe: { template: "fullbleed", skin: "default", archetype: "classic", sections: [] },
        siteData: BASE,
      }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "_pr_check tenant" })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;

  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      preview_token: `pr_${process.pid.toString(36)}`,
      path: "_pr_check.html",
      source_artifact_id: artifact.id,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;
  const tenantId = tenant.id;

  const before = await getTenantContent(tenantId);
  check("a fixture két fotóval indul", before?.photos.length === 2, before?.photos.length);

  /**
   * The photo set the LIVE render would see, read back from the persisted overrides.
   *
   * NO fallback to BASE on purpose: an earlier draft returned the base photos when the
   * overrides were missing, so the watermark assertions passed while the edits were in
   * fact no-ops (the fixture's site had no source_artifact_id). A guard that reports
   * green on "nothing happened" is worse than no guard — so this throws instead.
   */
  async function effectivePhotos(): Promise<Array<{ url: string; alt?: string; watermarked?: boolean }>> {
    const row = await db
      .selectFrom("site")
      .select("edited_site_data")
      .where("id", "=", ids.siteId!)
      .executeTakeFirstOrThrow();
    const ov = (row.edited_site_data ?? {}) as {
      photos?: Array<{ url: string; alt?: string; watermarked?: boolean }>;
    };
    if (!ov.photos) {
      throw new Error(
        "a szerkesztés nem írt override-ot — a fixture rossz (a mérés nem futott le)",
      );
    }
    return ov.photos;
  }

  // Each edit below is a SEPARATE way into the same overrides array — all three used
  // to strip the flag, so all three are measured.
  await moveTenantPhoto(tenantId, MARKED, "up");
  let eff = await effectivePhotos();
  check(
    "⭐ átrendezés után is vízjeles marad",
    eff.find((p) => p.url === MARKED)?.watermarked === true,
    eff,
  );

  await setTenantPhotoCaption(tenantId, CLEAN, "Új képaláírás");
  eff = await effectivePhotos();
  check(
    "⭐ képaláírás-szerkesztés után is vízjeles marad",
    eff.find((p) => p.url === MARKED)?.watermarked === true,
    eff,
  );
  check(
    "a képaláírás tényleg megváltozott (a szerkesztés nem no-op)",
    eff.find((p) => p.url === CLEAN)?.alt === "Új képaláírás",
    eff,
  );

  await setTenantPhotoUnits(tenantId, CLEAN, []);
  eff = await effectivePhotos();
  check(
    "⭐ egység-hozzárendelés után is vízjeles marad",
    eff.find((p) => p.url === MARKED)?.watermarked === true,
    eff,
  );

  // The whole point of the flag: §A.2 must drop it at the live edge even WITH the
  // owner's rights declaration on file (that declaration covers provenance, not a
  // third party's watermark).
  const live = applyLivePhotoPolicy({ ...BASE, photos: eff as SiteData["photos"] }, true);
  check(
    "⭐⭐ élesben a vízjeles kép KIESIK, a tiszta marad",
    live.photos.length === 1 && live.photos[0]?.url === CLEAN,
    live.photos.map((p) => p.url),
  );
} finally {
  // The edits re-render the snapshot, which WRITES this file into the repo root — a
  // guard that leaves droppings behind gets them committed by whoever runs it next.
  await rm("_pr_check.html", { force: true });
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("mock_artifact").where("lead_id", "=", ids.leadId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}

if (failures) {
  console.error(`\n⛔ photo-rights-edit-check: ${failures} bukott ellenőrzés — a §A.2 jelölés elveszik szerkesztéskor.`);
  process.exit(1);
}
console.log("\n✅ photo-rights-edit-check: a vízjel-jelölés túléli a tulaj szerkesztéseit, és élesben kizár.");
