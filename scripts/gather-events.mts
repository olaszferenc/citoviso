/**
 * The program recommender's daily job (the `poi` module — "Automata heti programajánló").
 * Driven by `citoviso-events.timer` (daily 05:30); also runnable by hand.
 *
 *   npx tsx scripts/gather-events.mts [--dry-run] [--site <slug>] [--settlement <name>] [--max <n>]
 *                                     [--no-render] [--no-mail] [--pending]
 *
 * --pending  (citoviso-events-pending.timer, every 5 minutes): ONLY the tenants whose own
 *            settlement was never gathered — i.e. who just bought (or re-activated) the
 *            module on ANY activation path. Gathers their circle, re-renders their site,
 *            sends no mail. Owner ruling 2026-09-23: "különben dühös lesz a tenant" — a
 *            buyer must not wait until the next morning for a module they paid for.
 *            A Postgres advisory lock keeps the daily run and this one from gathering (and
 *            paying for) the same settlements twice: a second run exits quietly.
 *
 * Three phases, one run:
 *  1. GATHER — once a WEEK: a settlement is gathered when its last finished run is older
 *     than this week's Monday (Europe/Budapest), or it was never gathered. So the Monday
 *     run does the week (the picker promises "Következő frissítés: hétfő reggel"), a failed
 *     Monday is caught up on Tuesday, and a tenant that joins mid-week gets its circle the
 *     same day. Which settlements: for every site whose tenant renders `poi`, the
 *     municipalities within 30 km — ≥1000 people plus the site's own settlement always
 *     (settlements.ts). Settlement-keyed (owner ruling, 2026-09-23): overlapping circles
 *     pay once.
 *  2. RENDER — DAILY: every `poi` site is re-rendered, so an expired program falls off
 *     the page the day after it ends (the picker's footer promises exactly this).
 *  3. MAIL — the owner's weekly mail (src/events/ownerMail.ts), once per week per tenant.
 *
 * --dry-run  spends on the APIs (that IS the measurement) but writes nothing: no DB row,
 *            no re-render, no mail (it lists who WOULD get one).
 * Unknown flags are refused: `--dry` for `--dry-run` must not silently run for real.
 */
import { sql } from "kysely";

(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();

const KNOWN = new Set(["--dry-run", "--site", "--settlement", "--max", "--no-render", "--no-mail", "--pending"]);
const argv = process.argv.slice(2);
for (const a of argv) {
  if (a.startsWith("--") && !KNOWN.has(a)) {
    console.error(`Ismeretlen kapcsoló: ${a} (ismert: ${[...KNOWN].join(" ")})`);
    process.exit(2);
  }
}
const flag = (f: string) => argv.includes(f);
const val = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY = flag("--dry-run");
const ONLY_SITE = val("--site");
const ONLY_SETTLEMENT = val("--settlement");
const MAX = val("--max") ? Number(val("--max")) : Infinity;
const NO_RENDER = flag("--no-render");
const NO_MAIL = flag("--no-mail");
const PENDING = flag("--pending");

const { db, pool } = await import("../src/db/client.js");
const { tenantRendersModule } = await import("../src/tenant/modules.js");
const { siteLocation } = await import("../src/events/pool.js");
const { settlementsAround, ownSettlement, querySettlements } = await import("../src/events/settlements.js");
const { GatherBatch, gatherSettlement } = await import("../src/events/gather.js");
const { fold } = await import("../src/events/gates.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { sendWeeklyProgramMails } = await import("../src/events/ownerMail.js");
type Settlement = import("../src/events/settlements.js").Settlement;

const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });

// One gathering at a time (daily vs. pending): a session-level advisory lock held on a
// dedicated connection for the whole run. Not acquired → another run is working; leave.
const lockClient = await pool.connect();
const locked = (await lockClient.query<{ ok: boolean }>("SELECT pg_try_advisory_lock(hashtext('citoviso-events')) AS ok")).rows[0]!.ok;
if (!locked) {
  console.log("programajánló: egy másik gyűjtés fut — ez a futás kimarad.");
  lockClient.release();
  await pool.end();
  process.exit(0);
}

// Settlements that EVER had a finished run: a site whose own settlement is not among
// them has never been gathered — the "just bought" case the pending mode exists for.
const everDone = new Set(
  (await db.selectFrom("event_gather_run").select("settlement_osm_id").where("status", "=", "done").distinct().execute())
    .map((r) => r.settlement_osm_id),
);

const sites = await db
  .selectFrom("site")
  .select(["id", "slug", "tenant_id"])
  .$if(Boolean(ONLY_SITE), (q) => q.where("slug", "=", ONLY_SITE!))
  .execute();

const targets = new Map<string, Settlement>();
const poiTenants: Array<{ tenantId: string; slug: string | null }> = [];
const known = new Map<string, Settlement>();
for (const s of sites) {
  if (!(await tenantRendersModule(s.tenant_id, "poi"))) continue;
  const loc = await siteLocation(s.id);
  if (!loc) {
    if (!PENDING) console.log(`  ${s.slug}: nincs koordináta — kimarad`);
    continue;
  }
  const around = await settlementsAround(loc.lat, loc.lon);
  const own = ownSettlement(around, loc.lat, loc.lon, loc.address);
  const q = querySettlements(around, own);
  for (const x of around) known.set(x.osmId, x);
  if (PENDING && own && everDone.has(own.osmId)) continue;
  console.log(`  ${s.slug}: ${around.length} település a körben, ${q.length} lekérdezve (saját: ${own?.name ?? "?"})`);
  poiTenants.push({ tenantId: s.tenant_id, slug: s.slug });
  for (const x of q) targets.set(x.osmId, x);
}

let list = [...targets.values()];
if (ONLY_SETTLEMENT) list = list.filter((s) => fold(s.name) === fold(ONLY_SETTLEMENT));

// A finished run since this week's Monday (Budapest) = this week's gathering happened.
const recent = new Set(
  (
    await db
      .selectFrom("event_gather_run")
      .select("settlement_osm_id")
      .where("status", "=", "done")
      .where("started_at", ">=", sql<Date>`date_trunc('week', now() AT TIME ZONE 'Europe/Budapest') AT TIME ZONE 'Europe/Budapest'`)
      .execute()
  ).map((r) => r.settlement_osm_id),
);
const skipped = list.filter((s) => recent.has(s.osmId)).length;
list = list.filter((s) => !recent.has(s.osmId)).slice(0, MAX);

if (PENDING && !poiTenants.length) {
  // The 5-minute timer's normal case: nobody is waiting. One quiet line, no spend.
  console.log("programajánló: nincs függő tenant.");
  await lockClient.query("SELECT pg_advisory_unlock(hashtext('citoviso-events'))");
  lockClient.release();
  await pool.end();
  process.exit(0);
}

console.log(
  `\n${today} — ${list.length} település gyűjtése${DRY ? " (DRY-RUN: DB-írás nincs)" : ""}` +
    (skipped ? `, ${skipped} a héten már kész` : ""),
);

const batch = new GatherBatch(today, [...known.values()], { dryRun: DRY });
let usd = 0, kept = 0, failed = 0;
const drops: Record<string, number> = {};
for (const s of list) {
  try {
    const r = await gatherSettlement(batch, s);
    usd += r.costUsd;
    kept += r.kept.length;
    for (const [k, v] of Object.entries(r.drops)) drops[k] = (drops[k] ?? 0) + (v ?? 0);
    console.log(
      `  ${s.name.padEnd(22)} ${String(r.pages).padStart(2)} lap  ${String(r.extracted).padStart(3)} nyers → ` +
        `${String(r.kept.length).padStart(2)} program  $${r.costUsd.toFixed(4)}`,
    );
    for (const e of r.kept) {
      console.log(`      ${e.start}${e.end ? "…" + e.end.slice(5) : "      "}  ${e.settlement.name.padEnd(16)} ${e.name.slice(0, 60)}  (${e.via}) ${e.sourceUrl}`);
    }
  } catch (err) {
    failed++;
    console.error(`  ${s.name}: HIBA — ${(err as Error).message}`);
  }
}

console.log(`\nÖSSZESEN: ${kept} program, $${usd.toFixed(4)}` + (kept ? `, $${(usd / kept).toFixed(4)}/program` : ""));
console.log(`eldobva: ${JSON.stringify(drops)}`);

// 2. RENDER — daily, so expired programs leave the page by themselves.
if (!DRY && !NO_RENDER) {
  let ok = 0;
  for (const t of poiTenants) {
    try {
      if (await rerenderTenantSnapshot(t.tenantId)) ok++;
    } catch (err) {
      failed++;
      console.error(`  újrarenderelés HIBA (${t.slug}): ${(err as Error).message}`);
    }
  }
  console.log(`újrarenderelve: ${ok}/${poiTenants.length} oldal`);
}

// 3. MAIL — the owner's weekly mail (idempotent per week).
// A narrowed run (--site / --settlement) is a test of one circle, not the weekly round:
// it must not mail every other tenant.
if (!NO_MAIL && !ONLY_SETTLEMENT && !ONLY_SITE && !PENDING) {
  const m = await sendWeeklyProgramMails({ dryRun: DRY });
  console.log(`tulaj-levél: ${DRY ? "menne" : "kiküldve"} ${m.sent} · üres: ${m.skippedEmpty} · a héten már ment: ${m.skippedAlready} · hiba: ${m.failed}`);
  failed += m.failed;
}
await lockClient.query("SELECT pg_advisory_unlock(hashtext('citoviso-events'))");
lockClient.release();
await pool.end();
// A failed settlement must show on the systemd status, not vanish in a log line.
if (failed) process.exit(1);
