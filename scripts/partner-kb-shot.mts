// KB screenshot generator for the PARTNER console entries (ADR-0045 §J.26:
// reproducible captures — regenerate whenever the UI changes, never hand-made).
// Shoots at phone width (the operator's real device) from the REAL views over the
// REAL data layer (partnerData — the KPI/aging/habit numbers are SQL, a hand-written
// fixture would be a second copy of those rules).
//
//   npx tsx scripts/partner-kb-shot.mts             # writes the three entry images
//   npx tsx scripts/partner-kb-shot.mts --out <dir> # writes under <dir> (kb-shot --determinism /
//                                                   # --check-committed call it this way)
//
// ⛔ DETERMINISM (ADR-0220). This generator used to shoot the SHARED dev DB. Measured
// 2026-09-24: the dev DB held 12 partners — among them real names of the owner's own
// companies — and 0 documents, so a fresh capture would have put personal data into the
// guide and an EMPTY documents screen next to a text describing 14 documents; the three
// committed images were a month stale and nothing could tell. Now every run:
//   1. creates its OWN scratch database (unique name — parallel sessions must not share
//      one, `reference_module_upsell_check_scratch_db_race`), migrates it,
//   2. fills it with the demo seed (scripts/seed-partner-demo.mts) under a FROZEN clock
//      (lib/frozen-clock.mjs) — the seed dates documents relative to "now" and the views
//      measure overdue days against "now", so a real clock changes the image daily,
//   3. renders + captures through the shared settle() (lib/kb-settle.mts),
//   4. drops the scratch database, also on failure.

import "./lib/frozen-clock.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME: Record<string, string> = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

// The instant every capture is taken at. Changing it regenerates all three images.
const PARTNER_SHOT_NOW = "2026-09-23T10:00:00+02:00";

const OUT_DIR = (() => {
  const i = process.argv.indexOf("--out");
  if (i < 0) return null;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("--")) {
    console.error("⛔ --out: hiányzik a könyvtár");
    process.exit(2);
  }
  return path.resolve(v);
})();
const PARTNER_MANIFEST = "partner-kb-shot-manifest.json";

const TARGETS: ReadonlyArray<[string, string]> = [
  ["list", "kb/entries/console-partners/assets/hu/screen.png"],
  ["page", "kb/entries/console-partner-page/assets/hu/screen.png"],
  ["documents", "kb/entries/console-documents/assets/hu/screen.png"],
];

// The frozen clock must be in force in THIS process too (the views read "now") — the
// import above installed it only if the variable was already set, so re-exec once.
if (process.env.KB_FROZEN_NOW !== PARTNER_SHOT_NOW) {
  try {
    execFileSync("npx", ["tsx", fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      env: { ...process.env, KB_FROZEN_NOW: PARTNER_SHOT_NOW, TZ: "Europe/Budapest" },
      stdio: "inherit",
    });
    process.exit(0);
  } catch (e) {
    process.exit((e as { status?: number }).status ?? 1);
  }
}
if (Date.now() !== Date.parse(PARTNER_SHOT_NOW) || new Date().getTime() !== Date.parse(PARTNER_SHOT_NOW)) {
  console.error("⛔ partner-kb-shot: a rögzített óra NEM él — a képek naponta változnának.");
  process.exit(1);
}

// ── 1. Scratch database ─────────────────────────────────────────────────────
// .env first (PGHOST/PGPORT/PGUSER), then the scratch name wins: loadEnvFile does not
// overwrite a variable that is already set, and config.ts loads it the same way.
try {
  (process as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
} catch {
  // no .env — ambient environment
}
const SCRATCH = `citoviso_kbshot_${process.pid}_${randomBytes(3).toString("hex")}`;
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD || undefined,
};
async function admin(sql: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
}
const childEnv = { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" };
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

await admin(`CREATE DATABASE ${SCRATCH}`);
let dropped = false;
async function dropScratch(): Promise<void> {
  if (dropped) return;
  dropped = true;
  await admin(`DROP DATABASE IF EXISTS ${SCRATCH} WITH (FORCE)`);
}
process.on("exit", () => {
  if (!dropped) console.error(`⚠️ partner-kb-shot: a scratch-DB (${SCRATCH}) nem lett eldobva.`);
});

let failed = false;
try {
  const run = (args: string[], what: string): void => {
    try {
      execFileSync("npx", ["tsx", ...args], { cwd: ROOT, env: childEnv, stdio: "pipe" });
    } catch (e) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      console.error(`⛔ partner-kb-shot: ${what} bukott:\n${err.stdout ?? ""}\n${err.stderr ?? ""}`);
      throw e;
    }
  };
  run(["src/db/migrate.ts"], "migráció a scratch-DB-n");
  // The seed runs in its own process — preload the frozen clock there too.
  run(["--import", pathToFileURL(path.join(ROOT, "scripts/lib/frozen-clock.mjs")).href, "scripts/seed-partner-demo.mts"], "demo-seed");

  // The seed cannot freeze what the DATABASE stamps: `created_at DEFAULT now()` is the
  // Postgres server's clock (measured: the partner page read "Partner azóta 2026-09-24"
  // on a capture frozen to 09-23). Pin it in the scratch DB — nowhere else.
  //
  // ⛔ The seed links the customer to the dev DB's richest EXISTING tenant — a scratch DB
  // has none, so the partner page showed "–" for havi díj / éves érték / aktív modul while
  // the entry text explains exactly those tiles (the old image read 10 380 Ft from a real
  // dev tenant). A demo tenant chain, owning the SAME three modules the kb-shot fixture
  // owns (OWNED_IN_SHOT: gallery, rooms, booking), so the two guides never disagree.
  await (async () => {
    const c = new pg.Client({ ...PG, database: SCRATCH });
    await c.connect();
    try {
      await c.query("BEGIN");
      const def = await c.query(
        "INSERT INTO scraper_definition (label, country, region, industry) VALUES ('KB demo (TESZT)', 'HU', 'Balaton', 'lodging') RETURNING id",
      );
      const run = await c.query("INSERT INTO scrape_run (scraper_definition_id, status) VALUES ($1, 'completed') RETURNING id", [def.rows[0].id]);
      const lead = await c.query("INSERT INTO lead (scrape_run_id, name) VALUES ($1, 'Vendégház Panoráma (TESZT)') RETURNING id", [run.rows[0].id]);
      const tenant = await c.query(
        "INSERT INTO tenant (lead_id, display_name) VALUES ($1, 'Vendégház Panoráma (TESZT)') RETURNING id",
        [lead.rows[0].id],
      );
      const tid = tenant.rows[0].id;
      await c.query(
        "INSERT INTO site (tenant_id, status, slug, preview_token, live_at) VALUES ($1, 'live', 'panorama-teszt', 'kb-demo', $2)",
        [tid, PARTNER_SHOT_NOW],
      );
      for (const m of ["gallery", "rooms", "booking"]) {
        await c.query("INSERT INTO module_entitlement (tenant_id, module) VALUES ($1, $2)", [tid, m]);
      }
      const linked = await c.query(
        "UPDATE partner SET tenant_id = $1 WHERE name = 'Vendégház Panoráma Kft. (TESZT)' AND tenant_id IS NULL",
        [tid],
      );
      if (linked.rowCount !== 1) throw new Error(`a demo-tenant ${linked.rowCount} partnerhez kötődött (várt: 1)`);
      await c.query("UPDATE partner SET created_at = $1", [PARTNER_SHOT_NOW]);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      await c.end();
    }
  })();

  // ── 2. Render from the real data layer ───────────────────────────────────
  const { config } = await import("../src/config.js");
  if (config.pg.database !== SCRATCH || config.databaseUrl) {
    throw new Error(`a konfiguráció NEM a scratch-DB-re mutat (${config.pg.database}) — a közös dev DB-t fotóznánk`);
  }
  const { getDocuments, getPartnerDetail, listPartners } = await import("../src/console/partnerData.js");
  const { documentsPage, partnerPage, partnersPage } = await import("../src/console/partnerViews.js");
  const { pool } = await import("../src/db/client.js");
  const { chromium } = await import("playwright-core");
  const { pinNetwork, settle } = await import("./lib/kb-settle.mts");

  const all = await listPartners();
  const cust = all.find((p) => p.isCustomer && !p.isSupplier);
  const docs = await getDocuments({});
  // The entry texts describe the seed: 4 partners, 14 documents. Anything else means
  // the seed changed under us — say it, don't photograph it.
  if (all.length !== 4 || docs.total !== 14 || !cust) {
    throw new Error(`a seed nem a várt adatot adta (partner: ${all.length}, bizonylat: ${docs.total})`);
  }
  const detail = (await getPartnerDetail(cust.id))!;
  const pages = new Map<string, string>([
    ["list", partnersPage(all, {})],
    ["page", partnerPage(detail, "overview")],
    ["documents", documentsPage(docs, {})],
  ]);
  await pool.end();

  const server = http.createServer((req, res) => {
    const u = (req.url ?? "/").split("?")[0] ?? "/";
    if (u.startsWith("/assets/")) {
      const f = path.join(ROOT, "public", u);
      if (fs.existsSync(f)) {
        res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "text/plain" });
        res.end(fs.readFileSync(f));
        return;
      }
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(pages.get(u.slice(1)) ?? pages.get("list")!);
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;

  // ── 3. Capture ──────────────────────────────────────────────────────────
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const written: string[] = [];
  try {
    for (const [key, rel] of TARGETS) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const misses = await pinNetwork(page);
      await page.goto(`http://127.0.0.1:${port}/${key}`);
      await settle(page, page);
      const out = path.join(OUT_DIR ?? ROOT, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.screenshot({ path: out, fullPage: true });
      if (misses.length) throw new Error(`külső kérés a pillanatképen kívül: ${[...new Set(misses)].join(", ")}`);
      await page.close();
      written.push(rel);
      console.log(`  📸 ${rel}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (OUT_DIR) fs.writeFileSync(path.join(OUT_DIR, PARTNER_MANIFEST), JSON.stringify(written));
  console.log(`✅ partner-KB képernyőképek (390px, valós view + seed, óra: ${PARTNER_SHOT_NOW})`);
} catch (e) {
  failed = true;
  console.error(`⛔ partner-kb-shot: ${(e as Error).message}`);
} finally {
  await dropScratch().catch((e) => console.error(`⚠️ scratch-DB eldobása bukott: ${(e as Error).message}`));
}
process.exit(failed ? 1 : 0);
