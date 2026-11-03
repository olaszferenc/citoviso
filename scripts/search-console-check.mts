// ŐR — automatikus Search Console-beküldés (ADR-0415). Saját scratch-DB, mock Google-kliens,
// mock DNS, csonk sitemap-letöltés; a globális fetch dob (egy hálózati hívás = piros).
//
// Amit mér:
//   ① élő citoviso.com-os oldal → EGY cél-sor; amíg a platform-tulajdon nincs beállítva: „vár”, Google-hívás 0, nem hiba
//   ② beállítás után: sitemaps.submit az sc-domain:citoviso.com alá, a slug sitemapjével; napló live=false
//   ③ változatlan sitemap újranézésnél → nincs második beküldés; ④ új <loc> (új egység-aloldal) → újraküldés
//   ⑤ nem élő (provisioned) oldal → nincs sor; ⑥ ugyanabban a pillanatban kétszer futtatva → nincs dupla sor/beküldés
//   ⑦ saját domain élő → a slug-sor KIVEZETVE; a domain: token → TXT a zónába → vár (terjedés) → ellenőrzés a
//      társtulajdonosokkal → sites.add → beküldés sc-domain:<domain> alá
//   ⑧ hibás beküldés → próbaszám +1, visszalépés (15 perc), előtte nem próbál újra; 5. hiba után EGY riasztás, a 6. után nincs második
//   ⑨ 301-es / idegen hosztú / nem-sitemap válasz → nincs beküldés, hiba naplózva
//   ⑩ a Google-hibát az élesítés nem látja: a tick nem dob, a többi cél lefut (egy cél kivétele mellett is)
//   ⑪ JWT: RS256 aláírás a nyilvános kulccsal ellenőrizhető, a claimek (iss/scope/aud/exp) helyesek
//   ⑫ élő-kapu: a futtató szkript a valódi klienst CSAK isLiveHost alatt építi; a beállító a verify-t is
//
//   npx tsx scripts/search-console-check.mts

import pg from "pg";
import { execFileSync } from "node:child_process";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

globalThis.fetch = (() => {
  throw new Error("search-console-check: váratlan HÁLÓZATI hívás — az őr hermetikus");
}) as typeof fetch;

const SCRATCH_BASE = "citoviso_search_console";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail && !pass ? ` — ${detail}` : ""}`);
};

process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.DNS_PROVIDER = "mock";

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
const { MockDns } = await import("../src/domains/dns/mock.js");
const { mockClient, signServiceAccountJwt } = await import("../src/visibility/googleSearchConsole.js");
const { runSearchConsoleTick, backoffMs, TXT_SETTLE_MS, RECHECK_MS, MAX_SILENT_FAILURES } = await import("../src/visibility/searchConsoleTick.js");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ search-console-check: NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(2);
  }
}

const PLATFORM = "sc-domain:citoviso.com";
const stamp = Date.now().toString(36);
const sitemaps = new Map<string, { status: number; body: string }>();
const urlset = (host: string, paths: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  paths.map((p) => `  <url><loc>https://${host}${p}</loc></url>`).join("\n") +
  `\n</urlset>\n`;

async function makeSite(tag: string, runId: string, status: "live" | "provisioned") {
  const lead = await db.insertInto("lead").values({ scrape_run_id: runId, name: `_sc_${tag}_${stamp}`, raw: JSON.stringify({}) } as never).returning("id").executeTakeFirstOrThrow();
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: `SC ${tag} (teszt)` } as never).returning("id").executeTakeFirstOrThrow();
  const site = await db
    .insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `sc_${tag}_${stamp}`, slug: `sc-${tag}-${stamp}`, status } as never)
    .returning(["id", "slug"])
    .executeTakeFirstOrThrow();
  return { id: site.id as string, host: `${site.slug}.citoviso.com` };
}

const targets = (siteId: string) => db.selectFrom("search_console_target").selectAll().where("site_id", "=", siteId).orderBy("kind").execute();
const submits = (c: { calls: { op: string; args: readonly string[] }[] }) => c.calls.filter((x) => x.op === "submitSitemap");

try {
  const def = await db.insertInto("scraper_definition").values({ label: `_sc_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) } as never).returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) } as never).returning("id").executeTakeFirstOrThrow();
  const A = await makeSite("a", run.id, "live");
  const P = await makeSite("p", run.id, "provisioned");
  const F = await makeSite("f", run.id, "live");
  const ids = [A.id, P.id, F.id];
  sitemaps.set(A.host, { status: 200, body: urlset(A.host, ["/"]) });
  sitemaps.set(F.host, { status: 200, body: urlset(F.host, ["/"]) });

  const client = mockClient({ fail: new Set([`submitSitemap:https://${F.host}/sitemap.xml`]) });
  const dns = new MockDns();
  const alerts: string[] = [];
  let now = new Date(Date.now() + 1000);
  const tick = () =>
    runSearchConsoleTick({
      client,
      dns,
      fetchSitemap: async (h) => sitemaps.get(h) ?? { status: 404, body: "not found" },
      platformProperty: PLATFORM,
      ownerEmails: ["owner@example.test"],
      now: () => now,
      alert: async (s) => {
        alerts.push(s);
        return true;
      },
      siteIds: ids,
    });

  // ① no platform property yet
  let r = await tick();
  let ta = await targets(A.id);
  check("① élő oldal → egy platform-sor", ta.length === 1 && ta[0]!.kind === "platform" && ta[0]!.sitemap_url === `https://${A.host}/sitemap.xml`, JSON.stringify(ta));
  check("① beállítás nélkül: vár, nem hiba, próbaszám 0", r.waiting.length === 2 && r.failed.length === 0 && ta[0]!.attempts === 0 && ta[0]!.status === "pending", JSON.stringify(r));
  check("① beállítás nélkül egyetlen Google-hívás sem", client.calls.length === 0, JSON.stringify(client.calls));
  check("⑤ nem élő oldal → nincs sor", (await targets(P.id)).length === 0);

  // ② platform property set up (what search-console-setup.mts verify writes)
  await db.insertInto("search_console_property").values({ property: PLATFORM, kind: "platform", verified_at: now, added_at: now }).execute();
  now = new Date(now.getTime() + 3600_000 + 1000);
  r = await tick();
  ta = await targets(A.id);
  const s1 = submits(client);
  check("② beküldés az sc-domain:citoviso.com alá a slug sitemapjével", s1.some((c) => c.args[0] === PLATFORM && c.args[1] === `https://${A.host}/sitemap.xml`), JSON.stringify(s1));
  check("② a sor submitted, hash-sel", ta[0]!.status === "submitted" && !!ta[0]!.submitted_hash);
  const ev = await db.selectFrom("search_console_event").selectAll().where("target_id", "=", ta[0]!.id).where("action", "=", "submit").execute();
  check("② napló: submit ok, live=false", ev.length === 1 && ev[0]!.ok === true && ev[0]!.live === false, JSON.stringify(ev));

  // ⑥ same instant again
  const before = submits(client).length;
  await tick();
  const rows = await db.selectFrom("search_console_target").select(sql<number>`count(*)::int`.as("n")).where("site_id", "in", ids).executeTakeFirstOrThrow();
  check("⑥ azonos pillanatban újrafuttatva: nincs új sor, nincs új beküldés", rows.n === 2 && submits(client).length === before, `sorok ${rows.n}, beküldés ${submits(client).length - before}`);

  // ③ recheck, unchanged
  now = new Date(now.getTime() + RECHECK_MS + 1000);
  r = await tick();
  check("③ változatlan sitemap → nincs újraküldés", submits(client).filter((c) => c.args[1]!.includes(A.host)).length === 1 && r.unchanged >= 1, JSON.stringify(r));
  // ④ changed
  sitemaps.set(A.host, { status: 200, body: urlset(A.host, ["/", "/apartman/kert"]) });
  now = new Date(now.getTime() + RECHECK_MS + 1000);
  r = await tick();
  check("④ új <loc> → újraküldés", submits(client).filter((c) => c.args[1]!.includes(A.host)).length === 2 && r.submitted.includes(`https://${A.host}/sitemap.xml`), JSON.stringify(r));

  // ⑧ F fails on every submit
  const tf0 = (await targets(F.id))[0]!;
  check("⑧ hibás beküldés → próbaszám ≥1, visszalépés", tf0.attempts >= 1 && tf0.status === "pending" && !!tf0.last_error, JSON.stringify(tf0));
  {
    // drive F to MAX_SILENT_FAILURES + 1 attempts, each exactly at its next_attempt_at
    const startAttempts = (await targets(F.id))[0]!.attempts;
    const nb = submits(client).filter((c) => c.args[1]!.includes(F.host)).length;
    const due = new Date((await targets(F.id))[0]!.next_attempt_at as unknown as string);
    now = new Date(due.getTime() - 1000);
    await tick();
    check("⑧ a visszalépés lejárta előtt nem próbál újra", submits(client).filter((c) => c.args[1]!.includes(F.host)).length === nb);
    check("⑧ 1. visszalépés 15 perc", backoffMs(1) === 15 * 60_000 && backoffMs(30) === 24 * 3600_000);
    for (let i = startAttempts; i <= MAX_SILENT_FAILURES; i++) {
      const t = (await targets(F.id))[0]!;
      now = new Date(new Date(t.next_attempt_at as unknown as string).getTime() + 1);
      await tick();
    }
    const tf = (await targets(F.id))[0]!;
    const fAlerts = alerts.filter((a) => a.includes(F.host));
    check(`⑧ ${MAX_SILENT_FAILURES}. hiba után EGY riasztás, utána nincs második`, tf.attempts > MAX_SILENT_FAILURES && fAlerts.length === 1 && !!tf.alerted_at, `próba ${tf.attempts}, riasztás ${fAlerts.length}`);
  }

  // ⑨ redirect / foreign loc / not a sitemap
  sitemaps.set(A.host, { status: 301, body: "" });
  const nA = submits(client).filter((c) => c.args[1]!.includes(A.host)).length;
  now = new Date(now.getTime() + RECHECK_MS + 1000);
  await tick();
  sitemaps.set(A.host, { status: 200, body: urlset("evil.example", ["/"]) });
  now = new Date(now.getTime() + 24 * 3600_000 + 1000);
  await tick();
  sitemaps.set(A.host, { status: 200, body: "<html>nem sitemap</html>" });
  now = new Date(now.getTime() + 24 * 3600_000 + 1000);
  await tick();
  const fe = await db.selectFrom("search_console_event").select(["detail"]).where("action", "=", "sitemap_fetch").where("ok", "=", false).execute();
  check("⑨ 301 / idegen hoszt / nem-sitemap → nincs beküldés", submits(client).filter((c) => c.args[1]!.includes(A.host)).length === nA);
  check("⑨ mindhárom ok naplózva", ["HTTP 301", "idegen hoszt", "nincs <urlset>"].every((w) => fe.some((e) => e.detail?.includes(w))), JSON.stringify(fe));

  // ⑦ own domain goes live (what provisionDomain does at tls_pending → live)
  const DOMAIN = `sc${stamp}.hu`;
  sitemaps.set(DOMAIN, { status: 200, body: urlset(DOMAIN, ["/", "/apartman/kert"]) });
  await db.updateTable("site").set({ custom_domain: DOMAIN, custom_domain_status: "live" } as never).where("id", "=", A.id).execute();
  now = new Date(now.getTime() + 60_000);
  r = await tick();
  ta = await targets(A.id);
  const custom = ta.find((t) => t.kind === "custom");
  const plat = ta.find((t) => t.kind === "platform");
  check("⑦ a slug-sor kivezetve (301 a saját domainre)", plat?.status === "retired" && r.retired === 1, JSON.stringify(plat));
  check("⑦ saját domain sor sc-domain:<domain> alá", custom?.property === `sc-domain:${DOMAIN}` && custom.sitemap_url === `https://${DOMAIN}/sitemap.xml`);
  check("⑦ token → TXT a zónában", [...(dns.txt.get(DOMAIN) ?? [])].some((v) => v.includes(DOMAIN)), JSON.stringify([...dns.txt]));
  check("⑦ a TXT terjedésére vár (még nincs ellenőrzés, nincs beküldés)", r.waiting.includes(`https://${DOMAIN}/sitemap.xml`) && !client.calls.some((c) => c.op === "verifyDomain"));
  now = new Date(now.getTime() + TXT_SETTLE_MS + 1000);
  r = await tick();
  const v = client.calls.find((c) => c.op === "verifyDomain");
  check("⑦ ellenőrzés a társtulajdonossal", v?.args[0] === DOMAIN && v.args.includes("owner@example.test"), JSON.stringify(v));
  check("⑦ sites.add + beküldés a saját tulajdon alá", client.calls.some((c) => c.op === "addSite" && c.args[0] === `sc-domain:${DOMAIN}`) && submits(client).some((c) => c.args[0] === `sc-domain:${DOMAIN}`));
  const prop = await db.selectFrom("search_console_property").selectAll().where("property", "=", `sc-domain:${DOMAIN}`).executeTakeFirst();
  check("⑦ a tulajdon-sor: ellenőrizve + hozzáadva", !!prop?.verified_at && !!prop.added_at);
  const tokens = client.calls.filter((c) => c.op === "getDomainToken" && c.args[0] === DOMAIN).length;
  now = new Date(now.getTime() + RECHECK_MS + 1000);
  sitemaps.set(DOMAIN, { status: 200, body: urlset(DOMAIN, ["/", "/apartman/kert", "/de/"]) });
  await tick();
  check("⑦ újraküldésnél nincs új token/ellenőrzés", client.calls.filter((c) => c.op === "getDomainToken" && c.args[0] === DOMAIN).length === tokens && client.calls.filter((c) => c.op === "verifyDomain").length === 1);

  // ⑩ a throwing fetcher on one target does not stop the pass
  {
    const boom = await runSearchConsoleTick({
      client,
      dns,
      fetchSitemap: async () => {
        throw new Error("kapcsolat bontva");
      },
      platformProperty: PLATFORM,
      ownerEmails: [],
      now: () => new Date(now.getTime() + 30 * 24 * 3600_000),
      siteIds: ids,
    }).then(
      (x) => x,
      () => null,
    );
    check("⑩ dobó letöltés mellett sem dob a tick, a célok hibaként jönnek vissza", !!boom && boom.failed.length >= 1, JSON.stringify(boom));
  }

  // ⑪ JWT
  {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = signServiceAccountJwt({ client_email: "sa@x.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) as string }, 1_700_000_000);
    const [h, c, s] = jwt.split(".");
    const vv = createVerify("RSA-SHA256");
    vv.update(`${h}.${c}`);
    const sigOk = vv.verify(publicKey, Buffer.from(s!.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
    const claims = JSON.parse(Buffer.from(c!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    check(
      "⑪ JWT: aláírás ellenőrizhető, claimek helyesek",
      sigOk && claims.iss === "sa@x.iam.gserviceaccount.com" && claims.aud === "https://oauth2.googleapis.com/token" && claims.exp - claims.iat === 3600 && /auth\/webmasters/.test(claims.scope) && /siteverification/.test(claims.scope),
      JSON.stringify(claims),
    );
  }

  // ⑫ live gate (source shape — the scripts build the real client only under isLiveHost)
  {
    const tickSrc = readFileSync("scripts/search-console-tick.mts", "utf8");
    const gated = /if \(live\) \{[\s\S]*?client = googleClient\(key\);[\s\S]*?\} else \{\s*client = mockClient\(\);/.test(tickSrc);
    check("⑫ a tick a valódi klienst csak az élő hoszton építi", gated && (tickSrc.match(/googleClient\(/g) ?? []).length === 1);
    check("⑫ a tick a dev-en a HELYI szervert olvassa", /fetchSitemap: live \? fetchPublic : fetchLocal/.test(tickSrc));
    const setupSrc = readFileSync("scripts/search-console-setup.mts", "utf8");
    check("⑫ a beállító a verify-t élesen kívül a mockon futtatja", /c: live \|\| cmd === "status" \|\| cmd === "add-txt" \? real : mockClient\(\)/.test(setupSrc));
    check("⑫ a Cloudflare TXT-írás --go nélkül csak kiírja", /else if \(!go\) \{/.test(setupSrc));
  }
} catch (e) {
  failures++;
  console.error("⛔ search-console-check: kivétel —", e);
} finally {
  await db.destroy();
}

if (failures) {
  console.error(`\n⛔ search-console-check: ${failures} állítás piros`);
  process.exit(1);
}
console.log("\n✅ search-console-check: minden állítás zöld");
