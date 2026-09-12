// Elek full-matrix driver — ONE command that stands the test park up from
// nothing and walks every FK scenario in the only order that can work.
//
//   npx tsx elek/bin/run-all.mts            # teljes mátrix
//   npx tsx elek/bin/run-all.mts FK-005a    # csak néhány kör (a park előáll hozzá)
//
// WHY THIS EXISTS (measured 2026-09-10). All twelve scenarios existed and the
// product worked, yet running them cold gave 3 green and 9 red/blocked. Nothing
// was wrong with the app: the park was never stood up, the chain's env
// substitutions (${ELEK_PROSPECT_PATH}, ${ELEK_TENANT_USER/PASSWORD}) had no
// source, and the dunning states needed a time-travel walk in a specific order.
// Stitching that together by hand takes ~40 minutes and is not reproducible —
// so the next session sees "broken product" again. It is not enough for the
// scenarios to exist; the park must be REBUILDABLE by one command.
//
// ORDER IS NOT COSMETIC — it is a dependency chain:
//   FK-004  kiküldés   → produces the tracked link   → ELEK_PROSPECT_PATH
//   FK-005a vásárlás   → produces tenant + site      → ELEK_TENANT_USER/PASSWORD
//   booking seed       → produces the request set    → FK-007
//   dunning ladder     → produces the FROZEN state   → FK-006a
//   thaw               → produces the LIVE state     → FK-006b
// FK-006a asserts a suspended site; run it after the thaw and it fails while the
// product is fine (measured). The freeze→a→thaw→b order is the assertion.
//
// ⛔ Guards: dev-only (no DATABASE_URL). Sends/charges stay mock — the runner
// itself forces ELEK_RUN=1 + PAYMENT_GATEWAY=mock, and this driver never
// weakens that. It WRITES to the local dev DB (that is the point: it builds the
// park), but only ELEK-TESZT rows.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { readFileSync } from "node:fs";

if (process.env.DATABASE_URL) {
  console.error("⛔ DATABASE_URL be van állítva — ez a futó CSAK a lokál dev DB-n futhat.");
  process.exit(1);
}

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const wanted = (fk: string): boolean => only.length === 0 || only.includes(fk);

const { db, pool } = await import("../../src/db/client.js");

interface Outcome {
  fk: string;
  pass: number;
  fail: number;
  manual: number;
  blocked: number;
  dir: string;
  skipped?: string;
}
const outcomes: Outcome[] = [];
const env: Record<string, string> = { ...process.env } as Record<string, string>;

function step(label: string): void {
  console.log(`\n\x1b[36m▸ ${label}\x1b[0m`);
}

/** Run one FK through the real runner, in its own process, and tally it. */
function runFk(fk: string): Outcome {
  const r = spawnSync("npx", ["tsx", "elek/bin/runner.mts", fk], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    timeout: 900_000,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const dir = /futás-mappa: (\S+)/.exec(out)?.[1] ?? "";
  const t = /lépések: \d+ · pass=(\d+) fail=(\d+) manual=(\d+) blocked=(\d+)/.exec(out);
  const o: Outcome = {
    fk,
    pass: Number(t?.[1] ?? 0),
    fail: Number(t?.[2] ?? 0),
    manual: Number(t?.[3] ?? 0),
    blocked: Number(t?.[4] ?? 0),
    dir,
  };
  if (!t) {
    // No tally line = the runner itself died (syntax error, missing scenario).
    // Surface its output instead of reporting a silent zero.
    o.skipped = "a runner nem adott összesítést";
    console.log(out.trim().split("\n").slice(-6).join("\n"));
  }
  const mark = o.fail > 0 || o.blocked > 0 ? "\x1b[31m✗\x1b[0m" : "\x1b[32m✓\x1b[0m";
  console.log(`  ${mark} ${fk}: pass=${o.pass} fail=${o.fail} manual=${o.manual} blocked=${o.blocked}`);
  outcomes.push(o);
  return o;
}

/** Run a helper script (seed, time-travel) and fail loudly. */
function runScript(args: string[], label: string): void {
  const r = spawnSync("npx", ["tsx", ...args], { cwd: ROOT, env, encoding: "utf8", timeout: 300_000 });
  if (r.status !== 0) {
    console.error(`⛔ ${label} elhasalt:\n${(r.stdout ?? "") + (r.stderr ?? "")}`);
    process.exit(1);
  }
}

// ─────────────────────────────── park ───────────────────────────────

step("Park: ELEK-TESZT lead");
runScript(["scripts/seed-elek-lead.mts"], "lead-seed");

step("Park: a megkeresés küldhető állapotba áll");
// The outreach channel is ONE-SHOT by design: once sent, the button is replaced
// by the "már kiment" note, so FK-004 cannot re-run. Re-arm it (dev park only).
const rearmed = await db
  .updateTable("prospect")
  .set({ status: "created", sent_at: null, email_sent_at: null })
  .where("contact_email", "=", "elek@citoviso.com")
  .executeTakeFirst();
console.log(`  visszaállítva: ${Number(rearmed.numUpdatedRows ?? 0)} követett link`);

// ───────────────────────── a lánc, sorrendben ─────────────────────────

step("Önálló körök (nem függenek a parktól)");
for (const fk of ["FK-000", "FK-003", "FK-003b"]) if (wanted(fk)) runFk(fk);

step("Kiküldés — innen jön a követett link");
if (wanted("FK-004")) runFk("FK-004");

const prospect = await db
  .selectFrom("prospect")
  .select(["token", "status"])
  .where("contact_email", "=", "elek@citoviso.com")
  .orderBy("created_at", "desc")
  .executeTakeFirst();
if (!prospect) {
  console.error("⛔ nincs követett link az ELEK-leadhez — az FK-004 előkészítése nem futott le.");
  process.exit(1);
}
// The bare-token shape is served unchanged alongside the readable one
// (prospectPath.ts), so the driver does not have to re-derive the slug.
env.ELEK_PROSPECT_PATH = `/p/${prospect.token}`;
console.log(`  ELEK_PROSPECT_PATH=${env.ELEK_PROSPECT_PATH}`);

step("A lead szemével, majd a vásárlás — innen jön a tenant");
for (const fk of ["FK-004b", "FK-005a"]) if (wanted(fk)) runFk(fk);

const tenant = await db
  .selectFrom("tenant")
  .select(["id", "display_name"])
  .where("display_name", "like", "ELEK%")
  .orderBy("created_at", "desc")
  .executeTakeFirst();
if (!tenant) {
  console.error("⛔ nincs ELEK-TESZT tenant — a vásárlás-kör (FK-005a) nem ért célba.");
  process.exit(1);
}

step("Park: tenant-belépés kiadása");
// The password is mailed once and only ever stored as a hash, so the driver
// re-issues it — that is also what the owner would do after losing it.
const { issueTenantLogin } = await import("../../src/tenant/credentials.js");
const login = await issueTenantLogin(tenant.id, tenant.display_name, "elek@citoviso.com");
env.ELEK_TENANT_USER = login.username;
env.ELEK_TENANT_PASSWORD = login.password;
console.log(`  ELEK_TENANT_USER=${login.username}`);

step("Park: a modul-vásárlás újra megvehető állapotba áll");
// Az egyszeri modul-vásárlás EGY-LÖVETŰ, mint a megkeresés: a kifizetett, még le
// nem szállított generálás a kártyán „Kifizetve"-re vált és az írás-kapu is zár
// (2026-09-11) — helyesen, hiszen ugyanazt nem lehet kétszer megvenni. Emiatt az
// FK-005b másodszorra nem tudna fizetést indítani. A parkot ezért ugyanúgy fel
// kell húzni, mint a követett linket. ⚠️ CSAK az ELEK-tenant sorai; a
// megrendelés/fizetés/számla ÉRINTETLEN marad (az FK-005b azokat is méri).
const elekSites = (
  await db.selectFrom("site").select("id").where("tenant_id", "=", tenant.id).execute()
).map((r) => r.id);
if (elekSites.length) {
  const delGen = await db
    .deleteFrom("multilang_generation")
    .where("site_id", "in", elekSites)
    .executeTakeFirst();
  await db.deleteFrom("site_multilang").where("site_id", "in", elekSites).execute();
  console.log(`  visszaállítva: ${Number(delGen.numDeletedRows ?? 0)} korábbi nyelv-generálás`);
}

step("Tenant-admin körök");
for (const fk of ["FK-001", "FK-002", "FK-005b"]) if (wanted(fk)) runFk(fk);

step("Park: foglalás-állapot");
await pool.query(readFileSync(path.join(ROOT, "scripts/seed-elek-booking.sql"), "utf8"));
console.log("  foglalás-seed lefutott");

if (wanted("FK-007")) runFk("FK-007");

// ── dunning: az ÁLLAPOT a mérés tárgya, ezért a sorrend az assertion ──

if (wanted("FK-006a") || wanted("FK-006b")) {
  step("Park: dunning-létra a fagyasztásig (T−3 → T+10)");
  for (const s of ["prenotify", "due", "remind", "final", "freeze"]) {
    runScript(["scripts/elek-timetravel-fk006.mts", s], `időutazó (${s})`);
    console.log(`  ${s} ✓`);
  }
  if (wanted("FK-006a")) runFk("FK-006a");

  step("Park: fizetés → visszaolvadás");
  runScript(["scripts/elek-timetravel-fk006.mts", "thaw"], "időutazó (thaw)");
  // The expiry is part of FK-006b's subject (the owner must be TOLD a request
  // died unanswered), and only expireStaleRequests produces that notice — the
  // SQL seed's pre-expired row shows the chip but sends nothing. Without this
  // the scenario measured a state the park never created.
  runScript(["scripts/elek-timetravel-fk006.mts", "bookingexpire"], "időutazó (bookingexpire)");
  if (wanted("FK-006b")) runFk("FK-006b");
}

// ────────────────────────────── összkép ──────────────────────────────

const w = Math.max(...outcomes.map((o) => o.fk.length), 8);
console.log(`\n\x1b[1m  ${"FK".padEnd(w)}  pass  fail  kézi  blokk\x1b[0m`);
for (const o of outcomes) {
  const bad = o.fail > 0 || o.blocked > 0;
  const c = bad ? "\x1b[31m" : "\x1b[32m";
  console.log(
    `  ${c}${o.fk.padEnd(w)}\x1b[0m  ${String(o.pass).padStart(4)}  ${String(o.fail).padStart(4)}  ` +
      `${String(o.manual).padStart(4)}  ${String(o.blocked).padStart(5)}` +
      (o.skipped ? `   ⛔ ${o.skipped}` : ""),
  );
}
const totals = outcomes.reduce(
  (a, o) => ({ pass: a.pass + o.pass, fail: a.fail + o.fail, manual: a.manual + o.manual, blocked: a.blocked + o.blocked }),
  { pass: 0, fail: 0, manual: 0, blocked: 0 },
);
console.log(
  `\n  összesen: ${totals.pass} gépi zöld · ${totals.fail} piros · ${totals.blocked} blokkolt · ` +
    `${totals.manual} kézi lépés (ezekre gépi zöld NEM adható — Elek ítéli meg)`,
);
if (outcomes.some((o) => o.skipped)) console.log("  ⚠️ volt kör, ami összesítés nélkül állt le — nézd a naplót fent.");

await pool.end();
process.exit(totals.fail > 0 || totals.blocked > 0 ? 2 : 0);
