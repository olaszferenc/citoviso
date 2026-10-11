// Regression gate: a console (operator) session ends — on a password change, when the
// operator is removed, and after its lifetime (Elek IT-kör B1, 2026-10-11, ADR-0363).
//
// WHAT WAS MEASURED (scratch DB, 2026-10-11, `_elek/bin/x-opcookie.mts`): the cookie was
// `<id>.<hmac(id)>` — no issue time — and the console gate only checked the signature.
// After a password change the OLD cookie still opened `/` (200); a new login minted the
// very same cookie; with the operator row DELETED its cookie still opened `/`, `/leads`,
// `/scrape`, `/report` (200). A leaked or forgotten operator cookie could not be revoked.
//
// WHAT IT MEASURES (scratch DB, real functions + the real console over HTTP):
//   1. the gate function: a fresh cookie opens; a cookie issued before the password change,
//      a cookie of a deleted operator, a legacy `<id>.<hmac(id)>` cookie, a cookie older
//      than the session lifetime and a forged one do NOT;
//   2. the console over HTTP: login → 200; /settings/password → the changer's browser gets
//      a fresh cookie (stays in), the old cookie → /login; deleted operator → /login on
//      every operator page (incl. those that never call currentOperator);
//   3. source: the gate calls verifyOperatorSession; the reset script cuts sessions too.
//
// Run:  npx tsx scripts/operator-session-check.mts
//       npx tsx scripts/operator-session-check.mts --self-test   (must go RED: the
//         pre-fix operatorAuth.ts, verbatim from git, as the gate)

import pg from "pg";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import type { Server, IncomingMessage } from "node:http";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
/** The last commit with the stateless, never-ending operator cookie. */
const PRE_FIX = "36d6f4cd";
const SCRATCH_BASE = "citoviso_opsession_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};
let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}

// ── 0. SCRATCH DB FIRST — before any import that opens the db client ─────────
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
execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" }, stdio: "pipe" });
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";
// Nothing in here may reach the outside world.
for (const k of ["EMAIL_PROVIDER", "SMS_PROVIDER", "INVOICE_PROVIDER", "PAYMENT_GATEWAY", "REGISTRAR_PROVIDER", "DNS_PROVIDER", "MMS_PROVIDER"]) {
  process.env[k] = "mock";
}
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
const { hashPassword } = await import("../src/auth/tenantAuth.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ a kapu NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(1);
  }
}

type AuthMod = {
  mintOperatorCookieValue(id: string): string;
  verifyOperatorSession?: (req: IncomingMessage) => Promise<string | null>;
  readOperatorSession(req: IncomingMessage): unknown;
  changeOperatorPassword(id: string, cur: string, next: string): Promise<string | null>;
};
let auth: AuthMod;
const OLD_TMP = "scripts/.opsession-old-operatorAuth.tmp.ts";
if (SELF_TEST) {
  const old = execFileSync("git", ["show", `${PRE_FIX}:src/auth/operatorAuth.ts`], { encoding: "utf8" })
    .replaceAll('from "../', 'from "../src/')
    .replaceAll('from "./', 'from "../src/auth/');
  writeFileSync(OLD_TMP, old);
  try {
    auth = (await import(`./.opsession-old-operatorAuth.tmp.ts`)) as AuthMod;
  } finally {
    rmSync(OLD_TMP, { force: true });
  }
} else {
  auth = (await import("../src/auth/operatorAuth.js")) as AuthMod;
}
/** The console gate as the module offers it (the pre-fix one only had the signature read). */
async function gate(cookie: string): Promise<boolean> {
  const req = { headers: { cookie: `cit_op_session=${cookie}` } } as unknown as IncomingMessage;
  if (auth.verifyOperatorSession) return Boolean(await auth.verifyOperatorSession(req));
  return Boolean(auth.readOperatorSession(req));
}
const sign = (v: string): string => createHmac("sha256", config.sessionSecret).update(`op:${v}`).digest("base64url");

async function newOperator(username: string, pw: string): Promise<string> {
  const r = await db
    .insertInto("operator_user")
    .values({ username, display_name: username, password_hash: hashPassword(pw) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

// ── 1. THE GATE FUNCTION ─────────────────────────────────────────────────────
{
  const id = await newOperator("opsess-a", "Regi-jelszo-123");
  const fresh = auth.mintOperatorCookieValue(id);
  ok(await gate(fresh), "friss süti: beenged");

  ok(!(await gate(`${id}.${sign(id)}`)), "régi formátumú (kiadási idő nélküli) süti: nem enged be — az átállás egyszer kiléptet");
  const oldIat = Date.now() - 31 * 86_400_000;
  ok(!(await gate(`${id}.${oldIat}.${sign(`${id}.${oldIat}`)}`)), "31 napos süti: lejárt, nem enged be");
  const futIat = Date.now() + 86_400_000;
  ok(!(await gate(`${id}.${futIat}.${sign(`${id}.${futIat}`)}`)), "jövőbeli kiadási idejű süti: nem enged be");
  ok(!(await gate(`${id}.${Date.now()}.${sign(`${id}.1`)}`)), "hamis aláírás: nem enged be");

  await new Promise((r) => setTimeout(r, 5));
  const msg = await auth.changeOperatorPassword(id, "Regi-jelszo-123", "Uj-jelszo-456789");
  ok(msg === null, "jelszócsere sikerül", String(msg));
  ok(!(await gate(fresh)), "a jelszócsere ELŐTT kiadott süti: nem enged be (a csere kiléptet)");
  const after = auth.mintOperatorCookieValue(id);
  ok(await gate(after), "a csere UTÁN kiadott süti: beenged");

  await db.deleteFrom("operator_user").where("id", "=", id).execute();
  ok(!(await gate(after)), "TÖRÖLT operátor sütije: nem enged be");
}

// ── 2. THE CONSOLE OVER HTTP (the real gate in src/console/server.ts) ───────
if (!SELF_TEST) {
  process.env.CIT_SHOT = "1"; // no boot self-heal: no AI top-ups, no writes to the SHARED language packs
  process.env.CONSOLE_PORT = "0";
  const { server } = (await import("../src/console/server.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
  const C = `http://127.0.0.1:${addr.port}`;
  const cookieOf = (r: Response): string => (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const get = async (p: string, cookie: string): Promise<string> => {
    const r = await fetch(`${C}${p}`, { redirect: "manual", headers: { cookie } });
    return `${r.status}${r.headers.get("location") ? ` → ${r.headers.get("location")}` : ""}`;
  };
  const form = { "content-type": "application/x-www-form-urlencoded" };

  await newOperator("opsess-b", "Regi-jelszo-123");
  const login = await fetch(`${C}/login`, { method: "POST", redirect: "manual", headers: form, body: "username=opsess-b&password=Regi-jelszo-123" });
  const ck = cookieOf(login);
  ok(login.status === 303 && ck.startsWith("cit_op_session="), "HTTP: belépés sütit ad", `${login.status} ${ck}`);
  ok((await get("/", ck)) === "200", "HTTP: a sütivel a konzol nyílik", await get("/", ck));

  await new Promise((r) => setTimeout(r, 5));
  const ch = await fetch(`${C}/settings/password`, {
    method: "POST",
    redirect: "manual",
    headers: { ...form, cookie: ck },
    body: "current=Regi-jelszo-123&next=Uj-jelszo-456789&next2=Uj-jelszo-456789",
  });
  const ck2 = cookieOf(ch);
  ok(/ok:/.test(decodeURIComponent(ch.headers.get("location") ?? "")), "HTTP: jelszócsere sikerül", ch.headers.get("location") ?? "");
  ok(Boolean(ck2) && ck2 !== ck, "HTTP: a cserélő böngésző ÚJ sütit kap (bent marad)", ck2);
  ok((await get("/", ck2)) === "200", "HTTP: az új sütivel a konzol nyílik", await get("/", ck2));
  ok((await get("/", ck)) === "303 → /login", "HTTP: a csere előtti süti → /login", await get("/", ck));

  await db.deleteFrom("operator_user").where("username", "=", "opsess-b").execute();
  for (const p of ["/", "/leads", "/scrape", "/report", "/settings"]) {
    ok((await get(p, ck2)) === "303 → /login", `HTTP: törölt operátor → /login (${p})`, await get(p, ck2));
  }
  server.close();
}

// ── 3. SOURCE ────────────────────────────────────────────────────────────────
if (!SELF_TEST) {
  const srv = readFileSync("src/console/server.ts", "utf8");
  ok(/!isPublicPath && !\(await verifyOperatorSession\(req\)\)/.test(srv), "a konzol-kapu a verifyOperatorSession-t hívja (DB-t néz, nem csak aláírást)");
  ok(!/!isPublicPath && !readOperatorSession\(req\)/.test(srv), "a régi, csak-aláírásos kapu nincs többé");
  const reset = readFileSync("scripts/operator-user.ts", "utf8");
  ok(/sessions_valid_from: new Date\(\)/.test(reset), "a jelszó-visszaállító szkript is kiléptet (sessions_valid_from)");
}

await db.destroy();
console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ az operátor-munkamenet véget ér: jelszócsere, törlés, lejárat");
if (SELF_TEST) {
  if (!failed) { console.log("⛔ ÖNTESZT: a javítás előtti operatorAuth.ts-t ZÖLDNEK látta — a kapu vak"); process.exit(1); }
  console.log("✓ ÖNTESZT: a javítás előtti kód pirosat adott"); process.exit(0);
}
process.exit(failed ? 1 : 0);
