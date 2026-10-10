// Elek2 #24 — the plan link (`/p/<token>`) of a lead who OWNS a site shows the site's CURRENT
// content, not the cold mock it was born from.
//
// THE MEASURED DEFECT. A trialist edited their site in the admin (new slogan; the "MINTA"
// sample blocks replaced by their own content). The plan link — which the lead reads as
// "my site" — kept serving the original mock FILE under the "már az Öné / szünetel" bar:
// the old slogan and the MINTA sections (Elek 2nd round, mail/06f-p-token-lejart.txt).
//
// What this proves, on a real trial started through the real door (startTrial) and edited
// through the real editor (saveTenantContent), served by the real console server:
//   ① running trial: GET /p/<t> → 200, the EDITED slogan is on the page, the mock's own
//      marker text is NOT, no "Minta — …" sample note, the owned bar is there and the
//      configurator is not; the forms are demo (data-cit-demo) — this page is not the
//      tenant host and must never take a real booking; tenant uploads are pinned to the
//      public server (no root-relative /uploads/ left — the console does not serve them);
//      the tenant-host-only legal links are not on it;
//   ② lapsed trial (lapseExpiredTrials): the same edited content under the „szünetel" bar
//      with the „Folytatom — fizetés" action.
//
// ISOLATION: own throwaway database (scratch-db), created BEFORE any import that opens the
// db client; providers forced to mock and READ BACK. The mock file and sites/<tenant> are
// removed at the end.
//
// --self-test: the world is SABOTAGED — the site loses its source artifact, so the tenant
// render cannot be assembled and the route falls back to the mock file (exactly the old
// behaviour). The content assertions of ① and ② must go red.
//
// Run: npx tsx scripts/plan-link-owned-content-check.mts   (--self-test: must go RED)

import pg from "pg";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_planlink_owned";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

// ── 0. providers + scratch DB FIRST — before ANY import that reads config or opens db ──
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.PUBLIC_SITE_URL = "https://citoviso.test";

async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], {
  env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" },
  stdio: "pipe",
});
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";
process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ plan-link-owned-content-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
  if (config.emailProvider !== "mock") {
    console.error(`⛔ plan-link-owned-content-check: EMAIL_PROVIDER=${config.emailProvider} — valódi levél menne ki`);
    process.exit(2);
  }
}
const { getInvoiceProvider } = await import("../src/invoicing/index.js");
if (getInvoiceProvider().name !== "mock") {
  console.error(`⛔ plan-link-owned-content-check: a számlázó ${getInvoiceProvider().name} — valódi számla születne`);
  process.exit(2);
}

const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { startTrial } = await import("../src/trial/start.js");
const { lapseExpiredTrials } = await import("../src/trial/expiry.js");
const { saveTenantContent } = await import("../src/tenant/editor.js");
type SiteData = import("../src/engine/recipe.js").SiteData;
type Recipe = import("../src/engine/recipe.js").Recipe;

const stamp = Date.now().toString(36);
const OLD_TAGLINE = "Osztálykirándulásnak és baráti összejövetelnek remek bázis";
const NEW_TAGLINE = `Az új szlogen a próbából ${stamp}`;
const MOCK_MARKER = `MOCK-FÁJL-TARTALOM-${stamp}`;
const SITE = {
  name: `_planlink_${stamp} Üdülő`,
  tagline: OLD_TAGLINE,
  intro: "Csendes, zöld környezetben megbúvó üdülőtábor faházakkal.",
  highlights: ["Balaton közelében"],
  photos: [{ url: "/uploads/00000000-0000-4000-8000-000000000001/a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;
const FORM = { name: "Teszt Elek", email: "planlink@example.invalid", phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true };

let tenantId = "";
let closeConsole: (() => void) | null = null;
let mockFile = "";

try {
  overrideFreeTrialConfigInProcess({ enabled: true, days: 14 });
  await db.insertInto("market").values({ country: "HU", legal_status: "approved" } as never)
    .onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
  const def = await db.insertInto("scraper_definition")
    .values({ label: `_planlink_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name: `_planlink_${stamp}`, raw: JSON.stringify({}) })
    .returning("id").executeTakeFirstOrThrow();
  const rel = `sites/_planlink_${stamp}.html`;
  mockFile = path.resolve(process.cwd(), rel);
  // The cold mock as it went out: the OLD slogan, a sample note, and a marker only the file has.
  await writeFile(
    mockFile,
    `<!doctype html><html><head><title>mock</title></head><body><main><h1>${SITE.name}</h1>` +
      `<p>${OLD_TAGLINE}</p><p>${MOCK_MARKER}</p><p>Minta — ide az Ön szobái, fotói és árai kerülnek.</p></main></body></html>`,
  );
  const art = await db.insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: rel, status: "approved", inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) } as never)
    .returning("id").executeTakeFirstOrThrow();
  const token = `planlink${stamp}xxxxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  await db.insertInto("prospect")
    .values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date() })
    .execute();

  const started = await startTrial(token, FORM);
  if (!started.ok) throw new Error(`a próba nem indult: ${started.error}`);
  tenantId = started.tenantId;
  const saved = await saveTenantContent(tenantId, { tagline: NEW_TAGLINE });
  if (!saved.ok) throw new Error("a szlogen mentése bukott");
  if (SELF_TEST) {
    // Sabotage: without its source artifact the site cannot be assembled → the route
    // falls back to the mock file, i.e. the historical behaviour.
    await db.updateTable("site").set({ source_artifact_id: null }).where("tenant_id", "=", tenantId).execute();
    console.log("  🔴 ÖNTESZT: a site forrás-artefaktja levéve — a /p/ a mockra esik vissza.\n");
  }

  const { server: consoleServer } = await import("../src/console/server.js");
  closeConsole = () => { consoleServer.closeAllConnections(); consoleServer.close(); };
  if (!consoleServer.listening) await new Promise((r) => consoleServer.once("listening", r));
  const cport = (consoleServer.address() as { port: number }).port;
  const get = async (p: string): Promise<{ status: number; body: string }> => {
    const r = await fetch(`http://127.0.0.1:${cport}${p}`, { redirect: "manual" });
    return { status: r.status, body: r.status === 200 ? await r.text() : "" };
  };

  const contentLegs = (label: string, r: { status: number; body: string }): void => {
    check(`${label}: 200`, r.status === 200, String(r.status));
    check(`${label}: a SZERKESZTETT szlogen látszik`, r.body.includes(NEW_TAGLINE));
    check(`${label}: a régi szlogen NEM`, !r.body.includes(OLD_TAGLINE));
    check(`${label}: a mock-fájl tartalma NEM`, !r.body.includes(MOCK_MARKER));
    check(`${label}: nincs „Minta — …” minta-jegyzet`, !/Minta — ide az Ön/.test(r.body));
    check(`${label}: a „már az Öné” sáv rajta van`, r.body.includes("data-cit-owned-css"));
    check(`${label}: nincs konfigurátor (nem árul)`, !r.body.includes("data-cit-configurator"));
    check(`${label}: nincs gyökér-relatív /uploads/ (a konzol nem szolgálja ki)`, !/["'(\s,]\/uploads\//.test(r.body));
    check(`${label}: a feltöltött kép a publikus szerverre mutat`, r.body.includes(`${config.publicSiteUrl}/uploads/`));
    check(`${label}: nincs tenant-hoszt jogi link (/adatvedelem, /impresszum)`, !/href="\/(adatvedelem|impresszum)"/.test(r.body));
    check(`${label}: indexelhetetlen (noindex)`, r.body.includes('content="noindex,nofollow"'));
  };

  console.log("① futó próba");
  contentLegs("futó próba", await get(`/p/${token}`));

  console.log("② lejárt próba");
  const trial = await db.selectFrom("free_trial").select("id").where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
  await db.updateTable("free_trial").set({ started_at: new Date(Date.now() - 15 * 86_400_000), trial_until: new Date(Date.now() - 3_600_000) }).where("id", "=", trial.id).execute();
  const lapse = await lapseExpiredTrials(new Date(), { onlyTrialIds: [trial.id] });
  check("a próba lejárt (lapsed, site suspended)", lapse.lapsed === 1 && lapse.sitesSuspended === 1, JSON.stringify(lapse));
  const lapsed = await get(`/p/${token}`);
  contentLegs("lejárt próba", lapsed);
  check(
    "lejárt próba: „szünetel” + Folytatom → /p/<t>/folytatas",
    lapsed.body.includes("a honlapja szünetel") && lapsed.body.includes(`href="/p/${token}/folytatas">Folytatom — fizetés</a>`),
  );
} catch (e) {
  failures++;
  console.error("⛔ plan-link-owned-content-check: kivétel —", e);
} finally {
  closeConsole?.();
  if (mockFile) await rm(mockFile, { force: true });
  overrideFreeTrialConfigInProcess(null);
  if (tenantId) await rm(path.resolve(process.cwd(), "sites", tenantId), { recursive: true, force: true });
  await db.destroy();
}

if (SELF_TEST) {
  // The sabotage must hit the content legs of BOTH states (slogan, old slogan, mock marker,
  // sample note, uploads → at least 4 per state).
  if (failures < 8) {
    console.error(`\n⛔ plan-link-owned-content-check --self-test: csak ${failures} állítás ment pirosra a szabotázson — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ plan-link-owned-content-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
  process.exit(0);
} else if (failures > 0) {
  console.error(`\n⛔ plan-link-owned-content-check: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ plan-link-owned-content-check: a terv-link a tulajdonos lead MOSTANI oldalát mutatja.");
process.exit(0);
