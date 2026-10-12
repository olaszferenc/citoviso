// SZERVER-OLDALI ADAT INLINE <script>-BE CSAK A jsonForScript()-EN ÁT (2026-10-11).
//
//   npx tsx scripts/json-for-script-check.mts
//   npx tsx scripts/json-for-script-check.mts --static      (csak ①, ~2 mp — a pre-commit
//     ezt futtatja bármely src/*.ts változásra; a teljeset a lead-térkép útjára)
//   npx tsx scripts/json-for-script-check.mts --self-test   (a javítás előtti fát —
//     gitből, betűre — méri, és MINDKÉT részben pirosat vár)
//
// A LELET: az Elek IT-kör (ADR-0363) a tulaj-admin Foglalások fülén valódi XSS-t talált:
// a `var G=${JSON.stringify(…)}` a vendég nevében álló `</script>`-nél lezárta a szkript-
// blokkot, a maradék HTML-ként futott. Ugyanez a minta ~100 helyen állt (konzol lead-
// térkép `var LEADS=` — scrape-elt Google-cégnevekkel —, tulaj-admin, generált oldal
// konfigurátor-manifestje a lead nevével), és öt fájl saját, féloldalas helyi escape-et
// írt. Most egy közös függvény van: src/text/jsonForScript.ts.
//
// Amit mér:
//   ① STATIKUS (src/**/*.ts, tesztek nélkül):
//      a. nincs `${JSON.stringify(` — sablon-literálba írt JSON — abban a fájlban, ami
//         `<script`-et ír (máshol napló-sor, hibaszöveg, AI-prompt; a `::jsonb` sor sem HTML);
//      b. nincs saját `.replace(/</g, "\\u003c")` escape — az a közös függvény dolga;
//      c. nincs `<script…>` + JSON.stringify(…) összefűzés (a konfigurátor-manifest alakja);
//      d. nincs `const x = JSON.stringify(…)` + `${x}` (a generált oldal intro-képlistája,
//         a modul-előnézet — a változó elrejtette az a. szabály elől).
//   ② DINAMIKUS: scratch-DB, egy lead `</script><img src=x onerror=…>` nevű, a VALÓDI
//      konzol `/scrape/map` lapja HTTP-n, Chromiumban betöltve (külső kérés nincs):
//      0 lefutás, 0 befecskendezett elem, a név a LEADS tömbben betűre ép.
//   Önteszt: a javítás előtti fa ①-e leletet ad, a javítás előtti mapPage ②-je lefut.

import pg from "pg";
import { readFileSync, readdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import type { Server } from "node:http";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
const STATIC_ONLY = process.argv.includes("--static") && !SELF_TEST;
/** The last commit before jsonForScript (raw JSON.stringify inside inline scripts). */
const PRE_FIX = "ea345a0d";
const SCRATCH_BASE = "citoviso_jsonxss";
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

// ── ① STATIC ─────────────────────────────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts") && !/\/\.[^/]*\.tmp\.ts$/.test(p)) out.push(p);
  }
  return out;
}
/** The helper itself is the one place allowed to call the escape. */
const EXEMPT = new Set(["src/text/jsonForScript.ts"]);

export function scanSource(file: string, src: string): string[] {
  const hits: string[] = [];
  const lines = src.split("\n");
  // Rule a. only in files that write a <script> at all: elsewhere `${JSON.stringify(…)}` builds
  // log lines, error texts and AI prompts (userAgent, scraper/run, guestCritic …), not HTML.
  const writesScript = /<script/i.test(src);
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (writesScript && line.includes("${JSON.stringify(") && !/::jsonb/.test(line)) hits.push(`${at}  a. \${JSON.stringify(…)} sablonba írva`);
    if (/\.replace\(\/<\/g,\s*["']\\\\u003c["']\)/.test(line)) hits.push(`${at}  b. saját "<"-escape (használd a jsonForScript-et)`);
    const decl = /^\s*(?:const|let)\s+(\w+)\s*=\s*JSON\.stringify\(/.exec(line);
    if (decl && src.includes("${" + decl[1] + "}")) hits.push(`${at}  d. JSON.stringify változón át sablonba írva (\${${decl[1]}})`);
    if (/^\s*(\+\s*)?JSON\.stringify\(/.test(line) || /\+\s*JSON\.stringify\(/.test(line)) {
      const before = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
      if (/<script/i.test(before)) hits.push(`${at}  c. <script> + JSON.stringify(…) összefűzés`);
    }
  });
  return hits;
}

const files = walk("src").filter((f) => !EXEMPT.has(f));
const hits: string[] = [];
for (const f of files) {
  let src: string;
  if (SELF_TEST) {
    try {
      src = execFileSync("git", ["show", `${PRE_FIX}:${f}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      continue; // file did not exist before the fix
    }
  } else src = readFileSync(f, "utf8");
  hits.push(...scanSource(f, src));
}
ok(hits.length === 0, `statikus: nincs nyers JSON inline <script>-ben (${files.length} fájl)`, `${hits.length} lelet:\n       ${hits.slice(0, 40).join("\n       ")}`);
{
  // The recognizer itself: each form it must catch, and the forms it must leave alone.
  const probe = [
    "const a = `<script>var X=${JSON.stringify(x)};</script>`;",
    'const b = JSON.stringify(v).replace(/</g, "\\\\u003c");',
    "const c =\n  `<script type=\"application/json\">` +\n  JSON.stringify(m) +\n  `</script>`;",
    "const shots = JSON.stringify(p);\nreturn `var S=${shots};`;",
  ];
  ok(probe.every((p) => scanSource("probe", p).length === 1), "statikus: a felismerő mind a négy tiltott alakot elkapja", JSON.stringify(probe.map((p) => scanSource("probe", p))));
  const clean = [
    "raw: sql`${JSON.stringify(raw)}::jsonb`,",
    "const c = `<script>var X=${jsonForScript(x)};</script>`;",
    "`body:JSON.stringify({a:1})` +",
    "const key = JSON.stringify(v);\nmap.set(key, 1);",
  ];
  ok(clean.every((p) => scanSource("probe", p).length === 0), "statikus: a megengedett alakokat nem jelzi", JSON.stringify(clean.map((p) => scanSource("probe", p))));
}

const staticFailed = failed;
if (STATIC_ONLY) {
  console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ statikus: szerver-oldali JSON inline <script>-be csak a jsonForScript()-en át");
  process.exit(failed ? 1 : 0);
}

// ── ② DYNAMIC — the real console lead map on a scratch DB ────────────────────
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
for (const k of ["EMAIL_PROVIDER", "SMS_PROVIDER", "INVOICE_PROVIDER", "PAYMENT_GATEWAY", "REGISTRAR_PROVIDER", "DNS_PROVIDER", "MMS_PROVIDER"]) {
  process.env[k] = "mock";
}
process.env.CIT_SHOT = "1"; // no boot self-heal: no AI top-ups, no writes to the SHARED language packs
process.env.CONSOLE_PORT = "0";
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
const { chromium } = await import("playwright-core");
{
  const where = await sql<{ db: string }>`select current_database() as db`.execute(db);
  if (where.rows[0]?.db !== SCRATCH) {
    console.error(`⛔ a kapu NEM a saját scratch-DB-jébe írna (${where.rows[0]?.db}) — leáll`);
    process.exit(1);
  }
}

const BUMP = "window.__x=(window.__x||0)+1";
const EVIL = `XSS-Panzió </script><img src=x onerror="${BUMP}"><script>${BUMP}</script> & 'Társa'  >`;
{
  const def = await db.insertInto("scraper_definition").values({ label: "_jsonxss", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) } as never).returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) } as never).returning("id").executeTakeFirstOrThrow();
  await db.insertInto("lead").values({ scrape_run_id: run.id, name: EVIL, address: `${EVIL} utca 1.`, lat: 47.5, lng: 19.0, raw: JSON.stringify({}) } as never).execute();
}

let html: string;
let base = "http://jsonxss.test"; // self-test: no server, the page is served from memory
let server: Server | null = null;
if (SELF_TEST) {
  // The pre-fix views.ts goes NEXT TO the real one, so its relative imports resolve; its
  // `scriptJson` import from copyEditViews (now gone) is replaced by the old local body.
  const OLD_TMP = "src/console/.views-jsonxss-prefix.tmp.ts";
  const old = execFileSync("git", ["show", `${PRE_FIX}:src/console/views.ts`], { encoding: "utf8" }).replace(
    'import { copyEditPill, mockCopyEditBlock, mockCopyEditScript, scriptJson } from "./copyEditViews.js";',
    'import { copyEditPill, mockCopyEditBlock, mockCopyEditScript } from "./copyEditViews.js";\nconst scriptJson = (v: unknown): string => JSON.stringify(v).replace(/</g, "\\\\u003c");',
  );
  writeFileSync(OLD_TMP, old);
  let views: { mapPage: (l: unknown, r: unknown) => string };
  try {
    views = await import("../src/console/.views-jsonxss-prefix.tmp.ts");
  } finally {
    rmSync(OLD_TMP, { force: true });
  }
  const data = await import("../src/console/data.js");
  html = views.mapPage(await data.listLeadsForMap(), await data.listRegions());
} else {
  // The real console over HTTP, logged in as a scratch operator.
  ({ server } = (await import("../src/console/server.js")) as { server: Server });
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
  base = `http://127.0.0.1:${addr.port}`;
  const { hashPassword } = await import("../src/auth/tenantAuth.js");
  const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
  const op = await db.insertInto("operator_user").values({ username: "jsonxss-op", display_name: "jsonxss", password_hash: hashPassword("Jsonxss-jelszo-123") } as never).returning("id").executeTakeFirstOrThrow();
  const r = await fetch(`${base}/scrape/map`, { redirect: "manual", headers: { cookie: `cit_op_session=${mintOperatorCookieValue(op.id)}` } });
  html = await r.text();
  ok(r.status === 200, "a konzol /scrape/map lapja megnyílik (különben a mérés tárgytalan)", String(r.status));
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const page = await browser.newPage();
  let dialogs = 0;
  page.on("dialog", async (d) => { dialogs++; await d.dismiss(); });
  // Offline: the page itself is served from memory; Leaflet/tiles/fonts are not fetched.
  await page.route("**/*", (route) => (route.request().url() === `${base}/` ? route.fulfill({ contentType: "text/html", body: html }) : route.abort()));
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __x?: number; LEADS?: Array<{ name: string; address: string }> };
    return {
      ran: w.__x ?? 0,
      imgs: document.querySelectorAll('img[src="x"]').length,
      scripts: [...document.scripts].filter((s) => (s.textContent ?? "").trim().startsWith("window.__x=")).length,
      leads: Array.isArray(w.LEADS) ? w.LEADS.length : -1,
      name: w.LEADS?.[0]?.name ?? null,
      address: w.LEADS?.[0]?.address ?? null,
    };
  });
  ok(r.leads === 1, "a lead-térkép LEADS tömbje létrejön, 1 leaddel", JSON.stringify(r));
  ok(r.ran === 0 && dialogs === 0, "a mérgezett lead-név a betöltéskor nem fut le", JSON.stringify(r));
  ok(r.imgs === 0 && r.scripts === 0, "nincs befecskendezett <img src=x> / <script>", JSON.stringify(r));
  ok(r.name === EVIL && r.address === `${EVIL} utca 1.`, "a név és a cím a LEADS-ben betűre ép (az escape értéket nem változtat)", JSON.stringify(r));
} finally {
  await browser.close();
}
server?.close();
await db.destroy();

console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ szerver-oldali adat inline <script>-be csak a jsonForScript()-en át kerül");
if (SELF_TEST) {
  // Both halves must see the pre-fix code: a blind half would pass here unnoticed otherwise.
  const dynFailed = failed - staticFailed;
  if (!staticFailed || !dynFailed) {
    console.log(`⛔ ÖNTESZT: a javítás előtti kódot ZÖLDNEK látta (statikus: ${staticFailed}, dinamikus: ${dynFailed} hiba) — az őr vak`);
    process.exit(1);
  }
  console.log(`✓ ÖNTESZT: a javítás előtti kód pirosat adott (statikus: ${staticFailed}, dinamikus: ${dynFailed} hiba)`); process.exit(0);
}
process.exit(failed ? 1 : 0);
