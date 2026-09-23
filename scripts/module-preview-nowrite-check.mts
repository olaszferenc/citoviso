#!/usr/bin/env npx tsx
/**
 * ADR-0089 ④ / ADR-0192 ⑧.5 — the module preview writes NOTHING, measured on the DB.
 *
 *   npx tsx scripts/module-preview-nowrite-check.mts
 *
 * WHY A SECOND GUARD: module-preview-check.mts ① reads the preview function's own
 * SOURCE for write calls. The write that actually happened sat two calls deeper
 * (renderTenantModulePreview → assembleEffective → moduleContentFor → ensureUnits →
 * INSERT site_unit), so the text check stayed green while, measured 2026-09-23,
 * merely LOOKING at the Szobák / Árak / Foglalás preview created an "A szállás egésze"
 * unit (with a slug) in an account that had bought none of them.
 *
 * This guard asks the behavioural question instead: snapshot every row the site and
 * tenant own, render the preview for EVERY previewable module (one by one and all at
 * once), snapshot again, and require byte-identical state.
 *
 * RED TWIN: the persisting render path (moduleContentFor with the real entitlements)
 * on the same unit-less site MUST come back dirty — it legitimately creates the
 * default unit. If this detector cannot see that write, it cannot see any.
 *
 * Fixture: throwaway tenant on the SHARED dev DB (reuses an existing mock_artifact
 * read-only for the recipe), removed in `finally`.
 */
import { db } from "../src/db/client.js";
import { moduleContentFor, renderTenantModulePreview } from "../src/tenant/editor.js";
import { previewableIds } from "../src/server/modulePreview.js";

const stamp = Date.now().toString(36);
const ids: Record<string, string> = {};
let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/** Every row the fixture site/tenant owns, in a stable serialisation. */
const snapshot = async (): Promise<string> => {
  const bySite = async (t: "site_unit" | "site_module_config" | "unit_price" | "availability_day") =>
    t === "unit_price" || t === "availability_day"
      ? db
          .selectFrom(t)
          .selectAll()
          .where("unit_id", "in", db.selectFrom("site_unit").select("id").where("site_id", "=", ids.siteId))
          .execute()
      : db.selectFrom(t).selectAll().where("site_id", "=", ids.siteId).execute();
  const parts = {
    site: await db.selectFrom("site").selectAll().where("id", "=", ids.siteId).execute(),
    site_unit: await bySite("site_unit"),
    site_module_config: await bySite("site_module_config"),
    unit_price: await bySite("unit_price"),
    availability_day: await bySite("availability_day"),
    module_entitlement: await db.selectFrom("module_entitlement").selectAll().where("tenant_id", "=", ids.tenantId).execute(),
    tenant: await db.selectFrom("tenant").selectAll().where("id", "=", ids.tenantId).execute(),
  };
  return JSON.stringify(parts, (_k, v) => (v instanceof Date ? v.toISOString() : v));
};

const diffTables = (a: string, b: string): string => {
  const A = JSON.parse(a) as Record<string, unknown>;
  const B = JSON.parse(b) as Record<string, unknown>;
  return Object.keys(A)
    .filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k]))
    .join(", ");
};

try {
  const arts = await db.selectFrom("mock_artifact").select(["id", "inputs"]).orderBy("generated_at", "desc").limit(80).execute();
  const art = arts.find((a) => {
    const i = a.inputs as { recipe?: unknown; siteData?: unknown } | null;
    return Boolean(i?.recipe && i?.siteData);
  });
  if (!art) throw new Error("nincs használható mock_artifact a fixture-höz");

  const def = await db.insertInto("scraper_definition").values({ label: `_pvnw_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: `_pvnw_${stamp}`, raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const t = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: `_pvnw_${stamp}` }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = t.id;
  const s = await db.insertInto("site").values({ tenant_id: t.id, preview_token: `pvnw_${stamp}`, slug: `pvnw-${stamp}`, status: "live", live_at: new Date(), source_artifact_id: art.id }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = s.id;

  const all = previewableIds();
  console.log(`\n① AZ ELŐNÉZET NEM ÍR — egység nélküli fiók, semmi megvéve, ${all.length} modul:`);
  const before = await snapshot();
  const dirty: string[] = [];
  // Per module, against the SAME baseline, reset after any write: a cumulative diff
  // would blame every module after the first offender (measured on the red run).
  const reset = async (): Promise<void> => {
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute();
  };
  for (const m of [...all.map((x) => [x]), all]) {
    const html = await renderTenantModulePreview(t.id, new Set(m));
    const label = m.length === 1 ? m[0] : "mind egyszerre";
    if (!html) dirty.push(`${label}: nincs HTML`);
    const now = await snapshot();
    if (now !== before) {
      dirty.push(`${label}: ${diffTables(before, now)}`);
      await reset();
    }
  }
  check("egyetlen előnézet sem változtatott az adatbázison", dirty.length === 0, dirty.join(" | "));

  const rooms = await renderTenantModulePreview(t.id, new Set(["rooms"]));
  check(
    "és a Szobák-előnézet ettől még mutat egységet (a memóriában)",
    Boolean(rooms && rooms.includes('data-cit-module="rooms"')),
  );

  console.log(`\n② PIROS IKER — a mentő útvonal UGYANITT ír (az érzékelő lát):`);
  await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute();
  await db.insertInto("module_entitlement").values({ tenant_id: t.id, module: "rooms", active: true }).execute();
  const beforeReal = await snapshot();
  await moduleContentFor(t.id, ids.siteId, []);
  const afterReal = await snapshot();
  check(
    "a valódi (nem előnézeti) renderelés létrehozza az alap-egységet",
    afterReal !== beforeReal && diffTables(beforeReal, afterReal).includes("site_unit"),
    diffTables(beforeReal, afterReal) || "NEM látott írást",
  );
} finally {
  if (ids.siteId) {
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute();
    await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  }
  if (ids.tenantId) {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute();
    await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  }
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await db.destroy();
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : `\n✅ minden állítás teljesült\n`);
process.exit(failures ? 1 : 0);
