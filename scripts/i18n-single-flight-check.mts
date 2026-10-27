// i18n-single-flight-check — ONE pack run per language, the request never waits, and nothing
// is ever translated by the code (ADR-0411, ADR-0412, Bábel).
//
// ⛔ MEASURED 2026-10-27, production: the owner switched the console to `sl`. The switch
// awaited a full 5651-string API translation inside the request; the browser gave up
// (499/504), and every reload and every further console page started ANOTHER full
// translation — 16 runs in an hour, 2149 calls, $130.03, two credit top-ups. The owner's
// answer: translation is spent ONLY from Bábel's subscription session — the code applies
// what Bábel committed (src/i18n/babel/packs/<lang>.json, src/i18n/babel/kb/<lang>/) and
// leaves the rest to the Hungarian fallback.
//
// This check drives the REAL ensureLanguagePack / requestLanguagePack against the dev DB on
// throw-away language codes with a throw-away seed, and asserts:
//   ① five parallel ensureLanguagePack calls in one process → the seed is written ONCE, all
//     five callers see the same status, and the strings Bábel left open stay MISSING (no
//     code path fills them);
//   ② requestLanguagePack (the console switch / page-render path) returns at once and
//     applies the seed in the background once, however often it is called;
//   ③ three PROCESSES started on a barrier (console + public + CLI, the real topology) →
//     exactly one of them writes the seed, the others wait on the advisory lock;
//   ④ no seed → ensureLanguagePack writes nothing and reports the gap (hu-fallback);
//   ⑤ a seed entry that breaks a placeholder or is not in the catalogue never lands;
//   ⑥ static wiring: the console request paths never await a pack, the scrape start
//     requests one only behind its one-job gate.
//
//   npx tsx scripts/i18n-single-flight-check.mts
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureLanguagePack, loadCatalog, packBuilding, requestLanguagePack } from "../src/i18n/packs.js";
import { pool } from "../src/db/client.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = fileURLToPath(import.meta.url);
const SEED_DIR = path.join(ROOT, "src/i18n/babel/packs");

/** Count the seed writes of this process (the log line provision() prints once per write). */
function countSeedWrites(): { n: () => number; restore: () => void } {
  let n = 0;
  const orig = console.log;
  console.log = (...a: unknown[]) => {
    const line = a.map(String).join(" ");
    if (line.includes("Bábel-mag alkalmazva")) n++;
    else orig(...a);
  };
  return { n: () => n, restore: () => void (console.log = orig) };
}

async function cleanup(langs: string[]): Promise<void> {
  await pool.query("delete from language_pack where lang = any($1)", [langs]);
  await pool.query("delete from kb_translation where lang = any($1)", [langs]);
}

// ── child mode (③): one "server process" racing for the same language ──
if (process.argv[2] === "--child") {
  const [, , , lang, barrier] = process.argv;
  await loadCatalog();
  const w = countSeedWrites();
  while (!existsSync(barrier!)) await new Promise((r) => setTimeout(r, 20));
  const st = await ensureLanguagePack(lang!);
  w.restore();
  console.log(JSON.stringify({ writes: w.n(), missing: st.missing }));
  await pool.end();
  process.exit(0);
}

let failures = 0;
function expect(ok: boolean, what: string): void {
  if (ok) console.log(`  ✓ ${what}`);
  else {
    failures++;
    console.error(`  ✗ ${what}`);
  }
}

const L1 = "zz", L2 = "zy", L3 = "zx", L4 = "zw", L5 = "zv";
const ALL = [L1, L2, L3, L4, L5];
const seedFile = (l: string): string => path.join(SEED_DIR, `${l}.json`);
const catalog = await loadCatalog();
const N = catalog.length;
/** A seed covering the first `k` plain catalog strings. */
const plain = catalog.filter((h) => !h.includes("{"));
const seedOf = (l: string, k: number): Record<string, string> => Object.fromEntries(plain.slice(0, k).map((h) => [h, `[${l}] ${h}`]));
const packSize = async (l: string): Promise<number> =>
  ((await pool.query("select (select count(*) from jsonb_object_keys(strings))::int n from language_pack where lang=$1", [l])).rows[0] as { n: number } | undefined)?.n ?? 0;

const removeSeeds = (): void => ALL.forEach((l) => rmSync(seedFile(l), { force: true }));
// ⛔ The fixtures live in the SHARED dev DB, and gates that render "every language" read
// language_pack table-wide (dialog-fires). A stopped run cleans up too; a fresh one first.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.once(sig, () => {
    removeSeeds();
    void cleanup(ALL).finally(() => process.exit(143));
  });
}
await cleanup(ALL);
mkdirSync(SEED_DIR, { recursive: true });

try {
  console.log(`① öt párhuzamos ensureLanguagePack egy folyamatban (${N} string, a mag 50-et fed)`);
  {
    writeFileSync(seedFile(L1), JSON.stringify(seedOf(L1, 50)));
    const w = countSeedWrites();
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => ensureLanguagePack(L1)));
    w.restore();
    expect(w.n() === 1, `a magot EGYSZER írta (${w.n()}×)`);
    expect((await packSize(L1)) === 50, `a csomagban pontosan a mag van (${await packSize(L1)}/50)`);
    expect(results.every((r) => r.missing === N - 50 && !r.ok), `a mag által nyitva hagyott ${N - 50} string HIÁNYZIK marad (nincs gépi pótlás)`);
    const again = countSeedWrites();
    await ensureLanguagePack(L1);
    again.restore();
    expect(again.n() === 0, "második hívás: nincs új mag → nincs írás");
  }

  console.log("② requestLanguagePack: azonnal visszatér, a háttérben EGYSZER alkalmaz");
  {
    writeFileSync(seedFile(L3), JSON.stringify(seedOf(L3, 40)));
    const w = countSeedWrites();
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) requestLanguagePack(L3);
    const ms = performance.now() - t0;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && ((await packSize(L3)) < 40 || packBuilding(L3))) await new Promise((r) => setTimeout(r, 50));
    w.restore();
    expect(ms < 50, `öt kérés ${ms.toFixed(1)} ms alatt visszatért (nem várt)`);
    expect((await packSize(L3)) === 40 && w.n() === 1, `a mag a háttérben egyszer került be (${w.n()}×, ${await packSize(L3)}/40)`);
  }

  console.log("③ három folyamat egyszerre (konzol + public + CLI): egy ír, a többi vár");
  {
    writeFileSync(seedFile(L2), JSON.stringify(seedOf(L2, 30)));
    const barrier = path.join(os.tmpdir(), `i18n-sf-${process.pid}-${Date.now()}`);
    const kids = [0, 1, 2].map(
      () =>
        new Promise<{ writes: number; missing: number } | null>((resolve) => {
          const p = spawn(process.execPath, [...process.execArgv, SELF, "--child", L2, barrier], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
          let out = "";
          p.stdout.on("data", (d) => (out += String(d)));
          p.on("close", () => {
            const line = out.trim().split("\n").filter((l) => l.startsWith("{")).pop();
            resolve(line ? (JSON.parse(line) as { writes: number; missing: number }) : null);
          });
        }),
    );
    await new Promise((r) => setTimeout(r, 6000)); // let all three boot and reach the barrier
    writeFileSync(barrier, "go");
    const res = await Promise.all(kids);
    rmSync(barrier, { force: true });
    expect(res.every((r) => r !== null), "mind a három folyamat lefutott");
    const writes = res.map((r) => r?.writes ?? -1);
    expect(writes.reduce((a, b) => a + Math.max(0, b), 0) === 1, `pontosan egy folyamat írt (${writes.join(" / ")})`);
    expect(res.every((r) => r?.missing === N - 30), "mindhárom ugyanazt a hiányt látta a végén");
  }

  console.log("④ mag nélkül: semmi nem íródik, a hiány hiány marad");
  {
    const w = countSeedWrites();
    const st = await ensureLanguagePack(L4);
    w.restore();
    expect(w.n() === 0 && (await packSize(L4)) === 0, "nincs írás, nincs csomag-sor");
    expect(st.missing === N && !st.ok, `a teljes katalógus hiányként jelenik meg (${st.missing}/${N})`);
  }

  console.log("⑤ a sérült és a katalóguson kívüli mag-sor nem kerül be");
  {
    const ph = catalog.find((h) => /\{[a-z]+\}/.test(h) && !/\{art/i.test(h))!;
    writeFileSync(seedFile(L5), JSON.stringify({ [plain[0]!]: "SEED-A", [ph]: "SEED broken", "nincs a katalógusban": "x" }));
    await ensureLanguagePack(L5);
    const row = (await pool.query("select strings from language_pack where lang=$1", [L5])).rows[0] as { strings: Record<string, string> };
    expect(row.strings[plain[0]!] === "SEED-A", "a jó mag-sor bekerült");
    expect(!(ph in row.strings), "a placeholdert sértő mag-sor kimaradt (és senki nem fordította helyette)");
    expect(!("nincs a katalógusban" in row.strings), "katalóguson kívüli kulcs nem kerül be");
  }

  console.log("⑥ bekötés (statikus)");
  {
    const read = (rel: string): string => readFileSync(path.join(ROOT, rel), "utf8");
    const scrape = read("src/console/scrapeJob.ts");
    const fn = scrape.slice(scrape.indexOf("export function startScrapeJob("), scrape.indexOf("export function startScoutJob("));
    expect(fn.indexOf("state.running") >= 0 && fn.indexOf("state.running") < fn.indexOf("requestLanguagePack"), "scrape: a csomag-kérés a „már fut” kapu MÖGÖTT");
    expect(!/ensureLanguagePack/.test(fn), "scrape: nem vár (requestLanguagePack)");
    const auth = read("src/auth/operatorAuth.ts");
    expect(!/prepareMailLang|ensureLanguagePack/.test(auth) && /prepareRenderLang/.test(auth), "konzol-oldalrender: csak melegít (prepareRenderLang), nem vár");
    const srv = read("src/console/server.ts");
    const sw = srv.slice(srv.indexOf('path === "/operator/lang"'), srv.indexOf('path === "/operator/lang"') + 1500);
    expect(/prepareRenderLang/.test(sw) && !/prepareMailLang|ensureLanguagePack/.test(sw), "nyelvváltás (/operator/lang): nem vár a csomagra");
  }
} finally {
  removeSeeds();
  await cleanup(ALL);
  await pool.end();
}

if (failures) {
  console.error(`⛔ i18n-single-flight-check: ${failures} hiba`);
  process.exit(1);
}
console.log("✅ i18n-single-flight-check: nyelvenként egy futás, a kérés nem vár, a kód nem fordít — csak Bábel magját alkalmazza.");
process.exit(0);
