// Regression gate: no password travels by mail; the owner SETS it through a
// one-time link; "Elfelejtett jelszó?" works without us; setting a password ends
// every older session (Elek T-3, owner-approved 2026-10-02, variant B).
//
// WHAT WAS MEASURED (production, 2026-10-01): the "Belépési adatai" mail printed the
// password in plain text and said "if you forget it, reply to this mail"; the login
// page's "Elfelejtett jelszó?" led to "az önkiszolgáló visszaállítás hamarosan
// elérhető lesz". The login_token table existed, unused, since 0011.
//
// WHAT IT MEASURES (scratch DB, real functions):
//   1. the credentials mail carries the username and a link — never a password;
//   2. the token is stored HASHED; a peek (the GET) spends nothing; the POST rules:
//      < 8 chars / mismatch refused, success sets the password, the link is single-use,
//      and an expired link is dead;
//   3. a session cookie issued BEFORE the password set no longer opens the admin, a
//      fresh one does; a pre-T-3 (legacy) cookie still works while no password was set;
//   4. a re-run activation never overwrites a password the owner set;
//   5. "Elfelejtett jelszó?" finds the login by username or e-mail, nothing by junk;
//   6. variant B: the pay-done link exists only right after the payment and only
//      while the owner never set a password;
//   7. the routes: the link's GET only peeks; the mail log masks the token.
//
// Run:  npx tsx scripts/password-link-check.mts
//       npx tsx scripts/password-link-check.mts --self-test   (must go RED: the
//         pre-fix credentials mail and a session check that ignores the password set)

import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH_BASE = "citoviso_pwlink_check";
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
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ a kapu NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(1);
  }
}

// ── 1. THE MAIL ──────────────────────────────────────────────────────────────
{
  const URL = "https://citoviso.com/login/jelszo/TOKEN_abcdefghijklmnopqrstuvwxyz";
  let mail: { text: string; html: string };
  if (SELF_TEST) {
    // The pre-fix letter, verbatim from git: it takes (and prints) a password.
    const old = execFileSync("git", ["show", "8493d321:src/email/loginEmail.ts"], { encoding: "utf8" })
      .replaceAll('from "../', 'from "../src/')
      .replaceAll('from "./', 'from "../src/email/');
    const tmp = "scripts/.pwlink-old-loginEmail.tmp.ts";
    (await import("node:fs")).writeFileSync(tmp, old);
    try {
      const m = await import(`./.pwlink-old-loginEmail.tmp.ts`);
      mail = m.buildCredentialsEmail({ to: "a@b.hu", username: "napfeny-panzio", password: "kilato-levendula-47",
        loginUrl: "https://citoviso.com/login", siteName: "Napfény Panzió" });
    } finally {
      (await import("node:fs")).rmSync(tmp, { force: true });
    }
  } else {
    const { buildCredentialsEmail } = await import("../src/email/loginEmail.js");
    mail = buildCredentialsEmail({ to: "a@b.hu", username: "napfeny-panzio", setPasswordUrl: URL,
      loginUrl: "https://citoviso.com/login", siteName: "Napfény Panzió" });
  }
  const both = `${mail.text}\n${mail.html}`;
  ok(!/Jelszó:/.test(mail.text) && !both.includes("kilato-levendula-47"), "a belépő levélben NINCS jelszó", mail.text.slice(0, 300));
  ok(both.includes(URL) && both.includes("Jelszó beállítása"), "a levél a „Jelszó beállítása” linket viszi", mail.text.slice(0, 300));
  ok(!/válaszoljon erre a levélre/.test(both), "nincs „válaszoljon erre a levélre” — van önkiszolgáló út");
  ok(both.includes("napfeny-panzio"), "a felhasználónév a levélben marad");
}

// ── fixtures ────────────────────────────────────────────────────────────────
const def = await db.insertInto("scraper_definition").values({ label: "g", country: "HU", region: "g", industry: "sz" } as never).returning("id").executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "Napfény Panzió", raw: sql`'{}'::jsonb` } as never).returning("id").executeTakeFirstOrThrow();
const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Napfény Panzió" } as never).returning("id").executeTakeFirstOrThrow();

const { issueTenantLogin } = await import("../src/tenant/credentials.js");
const { issuePasswordToken, peekPasswordToken, setPasswordWithToken, findUserForReset, payDonePasswordUrl } =
  await import("../src/auth/passwordLink.js");
const { authenticate, setSession, currentTenant, mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");

const login = await issueTenantLogin(tenant.id, "Napfény Panzió", "tulaj@napfeny.hu");

// ── 2. THE TOKEN ─────────────────────────────────────────────────────────────
const t1 = await issuePasswordToken(login.tenantUserId);
const stored = await db.selectFrom("login_token").select("token").where("tenant_user_id", "=", login.tenantUserId).execute();
ok(stored.length === 1 && stored[0]!.token !== t1 && !stored[0]!.token.includes(t1), "a token HASH-ként tárolódik, a nyers link nincs a DB-ben");
const p1 = await peekPasswordToken(t1);
const p1b = await peekPasswordToken(t1);
ok(p1.ok && p1b.ok, "a GET (peek) nem költi el a linket — kétszer is érvényes", JSON.stringify(p1b));
ok((await setPasswordWithToken(t1, "rovid", "rovid")).ok === false, "8 karakternél rövidebb jelszó elutasítva");
ok((await setPasswordWithToken(t1, "kilatas a balatonra", "kilatas a balatonrA")).ok === false, "eltérő megismétlés elutasítva");
ok((await peekPasswordToken(t1)).ok, "a hibás próbálkozás nem költi el a linket");
const beforeSet = Date.now();
await new Promise((r) => setTimeout(r, 5));
const oldCookie = (() => {
  // a session opened BEFORE the password set (issued now, the set happens below)
  const h: string[] = [];
  setSession({ setHeader: (_n: string, v: string | string[]) => h.push(...([] as string[]).concat(v)), req: { headers: {} } } as never, login.tenantUserId);
  return h[0]!.split(";")[0]!.split("=").slice(1).join("=");
})();
const legacyCookie = mintTenantCookieValue(login.tenantUserId);
const reqWith = (cookie: string) => ({ headers: { cookie: `cit_session=${cookie}` } }) as never;
ok(Boolean(await currentTenant(reqWith(legacyCookie))), "régi (T-3 előtti) süti él, amíg a tulaj nem állított jelszót");
await new Promise((r) => setTimeout(r, 5));
const set = await setPasswordWithToken(t1, "kilatas a balatonra", "kilatas a balatonra");
ok(set.ok, "érvényes jelszó beállítva a linkkel", JSON.stringify(set));
ok(Boolean(await authenticate("napfeny-panzio", "kilatas a balatonra")), "az új jelszóval be lehet lépni");
ok((await setPasswordWithToken(t1, "masik jelszo 2026", "masik jelszo 2026")).ok === false, "a link EGYSZER használható");
const peekUsed = await peekPasswordToken(t1);
ok(!peekUsed.ok && peekUsed.reason === "used", "felhasznált link: „used”", JSON.stringify(peekUsed));

// ── 3. SESSIONS END ──────────────────────────────────────────────────────────
if (SELF_TEST) {
  // Self-test: the session check blinded — the set is erased again.
  await db.updateTable("tenant_user").set({ password_set_at: null }).where("id", "=", login.tenantUserId).execute();
}
ok(!(await currentTenant(reqWith(oldCookie))), "a jelszó beállítása ELŐTT nyitott munkamenet véget ért", `beforeSet=${beforeSet}`);
ok(!(await currentTenant(reqWith(legacyCookie))), "a régi formátumú süti is véget ért a beállítás után");
await new Promise((r) => setTimeout(r, 5));
const freshH: string[] = [];
setSession({ setHeader: (_n: string, v: string | string[]) => freshH.push(...([] as string[]).concat(v)), req: { headers: {} } } as never, login.tenantUserId);
const fresh = freshH[0]!.split(";")[0]!.split("=").slice(1).join("=");
ok(Boolean(await currentTenant(reqWith(fresh))), "a beállítás UTÁN kiadott süti működik");

// ── 2b. EXPIRED ──────────────────────────────────────────────────────────────
const t2 = await issuePasswordToken(login.tenantUserId, -1000);
const pe = await peekPasswordToken(t2);
ok(!pe.ok && pe.reason === "expired", "lejárt link: „expired”", JSON.stringify(pe));
ok((await setPasswordWithToken(t2, "harmadik jelszo", "harmadik jelszo")).ok === false, "lejárt linkkel nem lehet jelszót állítani");

// ── 4. RE-RUN ACTIVATION KEEPS THE OWNER'S PASSWORD ─────────────────────────
if (!SELF_TEST) {
  const again = await issueTenantLogin(tenant.id, "Napfény Panzió", "tulaj@napfeny.hu");
  ok(again.password === null && Boolean(await authenticate("napfeny-panzio", "kilatas a balatonra")),
    "egy újrafutó aktiválás NEM írja felül a tulaj saját jelszavát");
}

// ── 5. FORGOT ────────────────────────────────────────────────────────────────
ok((await findUserForReset("NAPFENY-PANZIO")).length === 1, "elfelejtett jelszó: felhasználónévvel megtalálja");
ok((await findUserForReset("Tulaj@Napfeny.hu")).length === 1, "elfelejtett jelszó: e-mail címmel is");
ok((await findUserForReset("senki@sehol.hu")).length === 0, "ismeretlen adatra semmi (a lap ugyanazt mondja)");

// ── 6. VARIANT B — the pay-done link ─────────────────────────────────────────
{
  const lead2 = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "Második Ház", raw: sql`'{}'::jsonb` } as never).returning("id").executeTakeFirstOrThrow();
  const tenant2 = await db.insertInto("tenant").values({ lead_id: lead2.id, display_name: "Második Ház" } as never).returning("id").executeTakeFirstOrThrow();
  const l2 = await issueTenantLogin(tenant2.id, "Második Ház", "masik@haz.hu");
  const prospect = await db.insertInto("prospect").values({ lead_id: lead.id, token: "pwlinkProspect01" } as never).returning("id").executeTakeFirstOrThrow();
  const oi = await db.insertInto("order_intent").values({ prospect_id: prospect.id, price: 4650, modules: JSON.stringify([]), status: "submitted" } as never).returning("id").executeTakeFirstOrThrow();
  await db.insertInto("payment").values({ order_intent_id: oi.id, amount: 4650, period: "monthly", gateway: "barion", gateway_ref: "pd-now", status: "paid", paid_at: new Date() } as never).execute();
  await db.insertInto("payment").values({ order_intent_id: oi.id, amount: 4650, period: "monthly", gateway: "barion", gateway_ref: "pd-old", status: "paid", paid_at: new Date(Date.now() - 3 * 3600_000) } as never).execute();
  const now = await payDonePasswordUrl("pd-now", l2.username);
  ok(Boolean(now && /\/login\/jelszo\//.test(now)), "B: a friss fizetés lapján van jelszó-űrlap link", String(now));
  ok((await payDonePasswordUrl("pd-old", l2.username)) === null, "B: 3 órával a fizetés után már nincs");
  ok((await payDonePasswordUrl("pd-now", "napfeny-panzio")) === null, "B: ha a tulaj már állított jelszót, nincs");
}

// ── 7. ROUTES + LOG (source) ─────────────────────────────────────────────────
{
  const pub = readFileSync("src/server/public.ts", "utf8");
  const getAt = pub.indexOf("const pwLinkGet");
  ok(getAt > -1 && /peekPasswordToken/.test(pub.slice(getAt, getAt + 500)) && !/setPasswordWithToken/.test(pub.slice(getAt, getAt + 500)),
    "a link GET-je csak megnéz, nem költ (levél-szkennerek)");
  const cred = readFileSync("src/tenant/credentials.ts", "utf8");
  ok((cred.match(/split\(token\)\.join\(/g) ?? []).length >= 2, "a naplózott levél-másolatban a link kitakarva (mindkét levélben)");
  const views = readFileSync("src/server/adminViews.ts", "utf8");
  ok(!/önkiszolgáló visszaállítás hamarosan elérhető/.test(views), "nincs többé „hamarosan elérhető” ígéret a belépő súgón");
}

await db.destroy();
console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ jelszó nem jár levélben, a link egyszeri, a régi munkamenetek véget érnek");
if (SELF_TEST) {
  if (!failed) { console.log("⛔ ÖNTESZT: a visszarontott változatot ZÖLDNEK látta — a kapu vak"); process.exit(1); }
  console.log("✓ ÖNTESZT: a visszarontás pirosat adott"); process.exit(0);
}
process.exit(failed ? 1 : 0);
