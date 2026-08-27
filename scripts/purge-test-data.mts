// Purge locally-generated PILOT TEST DATA: the mock -> outreach -> tenant -> site
// delivery chain plus its financial transactions, and the tenant snapshot files.
//
// What SURVIVES by design (the acquisition side and the configured frame):
//   lead, lead_provenance, scrape_run, scraper_definition, region  -- the scrape corpus
//   partner, legal_entity, bank_account, gl_account, cost_center,  -- ERP master data
//   cost_type, profit_center, document_category, partner_*         -- (owner decision 2026-08-26)
//   module_price, pricing_config                                   -- pricing frame
//   operator_user                                                  -- console logins
//   language_pack, kb_translation                                  -- global translation caches
//
// Dry-run by default; pass --go to actually delete. A full JSON backup of every
// purged row is written to _planning/backups/ first (gitignored -- holds lead PII).
//
// Usage: npx tsx scripts/purge-test-data.mts [--go]

import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db/client.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GO = process.argv.includes("--go");

// Generated artifacts live in the MAIN tree, not in the per-session worktree:
// worktrees only symlink `sites/` there. Follow that symlink to find the real
// data root, so a purge run from any worktree hits the one shared location.
const DATA_ROOT = existsSync(join(ROOT, "sites"))
  ? dirname(realpathSync(join(ROOT, "sites")))
  : ROOT;

// Deletion order is explicit rather than relying on CASCADE alone, so every step
// reports its own row count. FK cascades still cover the children we omit here.
const DELETES: { table: string; sql: string; note?: string }[] = [
  { table: "accounting_document_line", sql: `DELETE FROM accounting_document_line` },
  { table: "accounting_document", sql: `DELETE FROM accounting_document`, note: "partner + legal_entity survive" },
  { table: "invoice", sql: `DELETE FROM invoice` },
  { table: "payment", sql: `DELETE FROM payment` },
  { table: "order_intent", sql: `DELETE FROM order_intent` },
  { table: "tenant", sql: `DELETE FROM tenant`, note: "cascades: site, site_unit, unit_price, site_module_config, site_multilang, multilang_generation, module_entitlement, tenant_user, login_token, domain_provisioning, calendar_link; partner.tenant_id -> NULL" },
  { table: "prospect", sql: `DELETE FROM prospect`, note: "cascades: mock_view -> mock_event" },
  { table: "mock_request", sql: `DELETE FROM mock_request` },
  { table: "mock_artifact", sql: `DELETE FROM mock_artifact`, note: "cascades: curator_decision" },
];

// Tables whose rows are captured before deletion (includes cascade victims).
const BACKUP_TABLES = [
  "accounting_document", "accounting_document_line", "invoice", "payment", "order_intent",
  "tenant", "tenant_user", "login_token", "site", "site_unit", "unit_price",
  "site_module_config", "site_module_config_history", "site_multilang", "multilang_generation",
  "module_entitlement", "domain_provisioning", "calendar_link", "availability_day",
  "booking_request", "site_place_rating", "site_review",
  "prospect", "mock_view", "mock_event", "mock_artifact", "mock_request", "curator_decision",
];

async function count(table: string): Promise<number> {
  const r = await pool.query(`SELECT count(*)::int AS n FROM "${table}"`);
  return r.rows[0].n as number;
}

async function main(): Promise<void> {
  console.log(GO ? "=== PURGE (--go, ELES torles) ===" : "=== PURGE dry-run (semmi nem torlodik) ===");

  // --- 1. Report current state -------------------------------------------------
  console.log("\n--- DB sorok a purge elott ---");
  const before: Record<string, number> = {};
  for (const t of BACKUP_TABLES) before[t] = await count(t);
  for (const t of BACKUP_TABLES) if (before[t] > 0) console.log(`  ${String(before[t]).padStart(6)}  ${t}`);

  const keep = ["lead", "lead_provenance", "scrape_run", "scraper_definition", "region",
                "partner", "legal_entity", "module_price", "pricing_config", "operator_user",
                "language_pack", "kb_translation"];
  console.log("\n--- MARAD (erintetlen) ---");
  for (const t of keep) console.log(`  ${String(await count(t)).padStart(6)}  ${t}`);

  // --- 2. Disk targets ---------------------------------------------------------
  const sitesRoot = join(DATA_ROOT, "sites");
  const KEEP_DIRS = new Set(["_engine-proof", "_outreach-shots", "_console-shots", "_inbox-ab"]);
  const siteDirs = existsSync(sitesRoot)
    ? readdirSync(sitesRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !KEEP_DIRS.has(d.name))
        .map((d) => join(sitesRoot, d.name))
    : [];
  const rootMocks = readdirSync(DATA_ROOT).filter((f) => /^mock-.*\.html$/.test(f) || /^mock-preview.*\.png$/.test(f));
  const outboxDir = join(DATA_ROOT, "outbox");
  const outboxFiles = existsSync(outboxDir) ? readdirSync(outboxDir) : [];

  console.log(`\n--- LEMEZ (adat-gyoker: ${DATA_ROOT}) ---`);
  for (const d of siteDirs) console.log(`  dir   ${d.replace(DATA_ROOT + "/", "")}`);
  console.log(`  file  ${rootMocks.length} db gyoker mock-*.html / mock-preview*.png`);
  console.log(`  file  ${outboxFiles.length} db outbox/ teszt-email`);
  console.log("\n--- LEMEZ (marad) ---");
  for (const k of KEEP_DIRS) console.log(`  dir   sites/${k}`);

  if (!GO) {
    console.log("\nDry-run vege. Eles futtatas: npx tsx scripts/purge-test-data.mts --go");
    await pool.end();
    return;
  }

  // --- 3. Backup ---------------------------------------------------------------
  const stamp = new Date().toISOString().slice(0, 10);
  // Backups land next to the previous purge snapshot in the main tree.
  const backupDir = join(DATA_ROOT, "_planning", "backups");
  mkdirSync(backupDir, { recursive: true });
  const backup: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) backup[t] = (await pool.query(`SELECT * FROM "${t}"`)).rows;
  const backupPath = join(backupDir, `purge-backup-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 1));
  console.log(`\nMentes: ${backupPath}`);

  // --- 4. Delete in one transaction --------------------------------------------
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("\n--- Torles ---");
    for (const d of DELETES) {
      const res = await client.query(d.sql);
      console.log(`  ${String(res.rowCount ?? 0).padStart(6)}  ${d.table}${d.note ? "   (" + d.note + ")" : ""}`);
    }
    // Converted leads return to the pool as qualified; the scrape corpus stays whole.
    const reset = await client.query(
      `UPDATE lead SET lifecycle_status='qualified'
       WHERE lifecycle_status IN ('activation','conversion')`);
    console.log(`  ${String(reset.rowCount ?? 0).padStart(6)}  lead.lifecycle_status -> qualified`);
    await client.query("COMMIT");
    console.log("COMMIT ok.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ROLLBACK — semmi nem torlodott:", e);
    process.exitCode = 1;
    client.release();
    await pool.end();
    return;
  }
  client.release();

  // --- 5. Disk cleanup ---------------------------------------------------------
  for (const d of siteDirs) rmSync(d, { recursive: true, force: true });
  for (const f of rootMocks) rmSync(join(DATA_ROOT, f), { force: true });
  for (const f of outboxFiles) rmSync(join(outboxDir, f), { force: true });
  console.log(`\nLemez: ${siteDirs.length} snapshot-mappa, ${rootMocks.length} mock-fajl, ${outboxFiles.length} outbox-fajl torolve.`);

  // --- 6. Verify ---------------------------------------------------------------
  console.log("\n--- Ellenorzes (purge utan) ---");
  let dirty = false;
  for (const t of BACKUP_TABLES) {
    const n = await count(t);
    if (n > 0) { console.log(`  MARADT ${n} sor: ${t}`); dirty = true; }
  }
  if (!dirty) console.log("  Minden celzott tabla ures.");
  console.log("\n--- Megorzott allomany ---");
  for (const t of keep) console.log(`  ${String(await count(t)).padStart(6)}  ${t}`);
  await pool.end();
}

await main();
