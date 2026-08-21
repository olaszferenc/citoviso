// ADR-0044 fixture gate: proves the module-config layer actually works end to end,
// against the real database, on a throwaway site it creates and removes.
//
// WHY A FIXTURE GATE AND NOT JUST THE LINT: the lint only proves a config SCHEMA
// exists. This proves the behaviour — defaults for an untouched module, the industry
// layer, the save/read round trip, unknown-key rejection, validation, and the
// "put it back the way it was" restore. A green pipeline on a wrong result is the
// failure mode that has already bitten this project once (ADR-0043).
//
//   npx tsx scripts/module-config-check.mts

import { db } from "../src/db/client.js";
import { pool } from "../src/db/client.js";
import { effectiveModuleConfig } from "../src/moduleConfig.js";
import {
  getAllSiteModuleConfigs,
  getSiteIndustry,
  getSiteModuleConfig,
  restorePreviousModuleConfig,
  setSiteModuleConfig,
} from "../src/tenant/siteModuleConfig.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ── pure layer: no database needed ──────────────────────────────────────────
console.log("Alapérték-rétegek (tiszta függvények):");
{
  const d = effectiveModuleConfig("booking", null, null);
  check("érintetlen modul is teljes konfigot ad", d.minNights === 1 && d.horizonMonths === 12, d);

  const hu = effectiveModuleConfig("hours", null, null);
  check("hours katalógus-alapérték", hu.checkInFrom === "14:00", hu);

  const rest = effectiveModuleConfig("hours", null, "restaurant");
  check("iparág-réteg felülírja a katalógust", rest.checkInFrom === "11:00", rest);

  const saved = effectiveModuleConfig("hours", { checkInFrom: "16:00" }, "restaurant");
  check("a tulaj mentett értéke nyer az iparág felett", saved.checkInFrom === "16:00", saved);
  check("a nem mentett mező az iparág-rétegből jön", saved.checkOutUntil === "22:00", saved);
}

// ── database round trip on a throwaway site ────────────────────────────────
console.log("\nAdatbázis kör-forduló (eldobható fixture):");
const ids: { defId?: string; runId?: string; leadId?: string; tenantId?: string; siteId?: string } = {};
try {
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_mcfg_check",
      country: "HU",
      region: "_test",
      industry: "restaurant",
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
    .values({ scrape_run_id: run.id, name: "_mcfg_check lead", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;

  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "_mcfg_check tenant" })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;

  const site = await db
    .insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `mcfg_${Date.now().toString(36)}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;

  const siteId = site.id;

  const industry = await getSiteIndustry(siteId);
  check("az iparág feloldódik a lead láncán", industry === "restaurant", industry);

  const fresh = await getSiteModuleConfig(siteId, "hours");
  check("mentés előtt: customized=false", fresh.customized === false, fresh);
  check("mentés előtt: iparág-alapérték jön", fresh.config.checkInFrom === "11:00", fresh.config);

  const saved = await setSiteModuleConfig(
    siteId,
    "hours",
    { checkInFrom: "15:00", checkInTo: "21:00", ismeretlenMezo: "dobandó" },
    "test",
  );
  check("mentés sikeres", saved.ok, saved.errors);

  const after = await getSiteModuleConfig(siteId, "hours");
  check("mentés után visszaolvasható", after.config.checkInFrom === "15:00", after.config);
  check("mentés után: customized=true", after.customized === true, after);
  check("ismeretlen mező NEM tárolódott", !("ismeretlenMezo" in after.config), after.config);
  check("nem mentett mező az iparág-rétegből jön", after.config.checkOutUntil === "22:00", after.config);

  const bad = await setSiteModuleConfig(siteId, "hours", { checkInFrom: "20:00", checkInTo: "08:00" }, "test");
  check("érvénytelen bemenet elutasítva", bad.ok === false && bad.errors.length > 0, bad);
  const unchanged = await getSiteModuleConfig(siteId, "hours");
  check("elutasított mentés nem írt felül semmit", unchanged.config.checkInFrom === "15:00", unchanged.config);

  const badBooking = await setSiteModuleConfig(siteId, "booking", { minNights: 10, maxNights: 3 }, "test");
  check("booking: min>max elutasítva", badBooking.ok === false, badBooking);

  await setSiteModuleConfig(siteId, "hours", { checkInFrom: "17:00", checkInTo: "22:00" }, "test");
  const restored = await restorePreviousModuleConfig(siteId, "hours", "test");
  check("visszaállítás lefutott", restored === true);
  const back = await getSiteModuleConfig(siteId, "hours");
  check("visszaállítás az ELŐZŐ értéket hozta", back.config.checkInFrom === "15:00", back.config);

  const all = await getAllSiteModuleConfigs(siteId);
  check("minden regisztrált modul szerepel a listában", Object.keys(all).length >= 12, Object.keys(all).length);
  check("a nem mentett modul is teljes konfigot ad", all.booking?.config.horizonMonths === 12, all.booking?.config);
} finally {
  // Cascades clear site_module_config + history; the rest goes bottom-up.
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}

if (failures) {
  console.error(`\n⛔ module-config-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ module-config-check: a modul-konfig réteg végponttól végpontig működik.");
