// i18n-single-flight-check — ONE translation per language, never a second one (ADR-0411, Bábel).
//
// ⛔ MEASURED 2026-10-27, production: the owner switched the console to `sl`. The switch
// awaited a full 5651-string pack inside the request; the browser gave up (499/504), and
// every reload and every further console page started ANOTHER full translation — 16 runs
// in an hour, 5 of them within 20 seconds, 2149 calls, $130.03, two credit top-ups. Nothing
// knew a run was already going, and nothing read the spend meter back.
//
// This check drives the REAL ensureLanguagePack / requestLanguagePack against the dev DB
// with a SCRIPTED Bábel transport (no API key, no cost) on throw-away language codes, and
// asserts:
//   ① five parallel ensureLanguagePack calls in one process → every catalog string and KB
//     entry is asked EXACTLY once, and all five callers get the same complete status;
//   ② requestLanguagePack (the console switch / page-render path) returns at once, starts
//     the pack in the background once however often it is called, and the pack completes;
//   ③ three PROCESSES started on a barrier (console + public + CLI, the real topology) →
//     exactly one of them translates, the others wait on the advisory lock and translate 0;
//   ④ a spent daily budget stops the run BEFORE any call, alerts once, and is loud; the
//     per-run ceiling throws too;
//   ⑥ Bábel's committed seed (src/i18n/babel/packs/<lang>.json) wins: its valid strings are
//     not sent to the API, a seed entry that breaks a placeholder is ignored (and asked);
//   ⑤ static wiring: the console request paths never await a translation, the scrape start
//     provisions only behind its one-job gate, and every translation call goes through
//     babelCall (budget + ledger) — no stray `messages.create` in the translators.
//
//   npx tsx scripts/i18n-single-flight-check.mts
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { setBabelTransportForTest, type BabelTransport } from "../src/i18n/babel.js";
import {
  assertTranslationBudget,
  newTranslationRun,
  setBudgetAlertForTest,
  setTranslationSpendReaderForTest,
  TranslationBudgetError,
} from "../src/i18n/budget.js";
import { ensureLanguagePack, loadCatalog, packBuilding, requestLanguagePack } from "../src/i18n/packs.js";
import { pool } from "../src/db/client.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = fileURLToPath(import.meta.url);

/** Scripted Bábel: echoes every source with a language tag, counts what it was asked. */
function scripted(delayMs: number): { transport: BabelTransport; asked: Map<string, number>; calls: () => number } {
  const asked = new Map<string, number>();
  let calls = 0;
  const transport: BabelTransport = async ({ lang, step, user }) => {
    calls++;
    await new Promise((r) => setTimeout(r, delayMs));
    const payload = JSON.parse(user.slice(user.indexOf("\n") + 1)) as unknown;
    if (step === "translateKbEntry") {
      const e = payload as { title: string; body: string };
      const k = `kb:${e.title}`;
      asked.set(k, (asked.get(k) ?? 0) + 1);
      return { text: JSON.stringify({ title: `[${lang}] ${e.title}`, body: e.body }), stopReason: "end_turn", usage: null };
    }
    const items = payload as Array<{ i: number; hu?: string; magyar?: string }>;
    const out: Record<string, string> = {};
    for (const it of items) {
      const hu = it.hu ?? it.magyar ?? "";
      asked.set(hu, (asked.get(hu) ?? 0) + 1);
      out[String(it.i)] = `[${lang}] ${hu}`;
    }
    return { text: JSON.stringify(out), stopReason: "end_turn", usage: null };
  };
  return { transport, asked, calls: () => calls };
}

async function cleanup(langs: string[]): Promise<void> {
  await pool.query("delete from language_pack where lang = any($1)", [langs]);
  await pool.query("delete from kb_translation where lang = any($1)", [langs]);
  await pool.query("delete from translation_spend where lang = any($1)", [langs]);
}

// ── child mode (③): one "server process" racing for the same language ──
if (process.argv[2] === "--child") {
  const [, , , lang, barrier] = process.argv;
  const m = scripted(15);
  setBabelTransportForTest(m.transport);
  setTranslationSpendReaderForTest(async () => 0);
  setBudgetAlertForTest(async () => undefined);
  await loadCatalog();
  while (!existsSync(barrier!)) await new Promise((r) => setTimeout(r, 20));
  const st = await ensureLanguagePack(lang!);
  const uiAsked = [...m.asked.keys()].filter((k) => !k.startsWith("kb:")).length;
  console.log(JSON.stringify({ asked: uiAsked, missing: st.missing, ok: st.ok }));
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
const SEED_FILE = path.join(ROOT, "src/i18n/babel/packs", `${L5}.json`);
const catalog = await loadCatalog();
const N = catalog.length;
setTranslationSpendReaderForTest(async () => 0);
const alerts: string[] = [];
setBudgetAlertForTest(async (e) => void alerts.push(e.message));
// ⛔ The fixtures live in the SHARED dev DB, and gates that render "every language" read
// language_pack table-wide (dialog-fires). Measured 2026-10-27: the gate runner stopped this
// check mid-run after another gate failed, the `finally` never ran, and the next commit's
// dialog-fires rendered the left-over `zz`. A stopped run cleans up too; a fresh one first.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.once(sig, () => {
    rmSync(SEED_FILE, { force: true });
    void cleanup(ALL).finally(() => process.exit(143));
  });
}
await cleanup(ALL);

try {
  console.log(`① öt párhuzamos ensureLanguagePack egy folyamatban (${N} string)`);
  {
    const m = scripted(2);
    setBabelTransportForTest(m.transport);
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => ensureLanguagePack(L1)));
    const ui = [...m.asked.entries()].filter(([k]) => !k.startsWith("kb:"));
    const kb = [...m.asked.entries()].filter(([k]) => k.startsWith("kb:"));
    expect(ui.length === N, `minden string sorra került (${ui.length}/${N})`);
    expect(ui.every(([, n]) => n === 1), `egy string sem kétszer (max ${Math.max(...ui.map(([, n]) => n))}×)`);
    expect(kb.length > 0 && kb.every(([, n]) => n === 1), `minden súgó-cikk egyszer (${kb.length} cikk)`);
    expect(results.every((r) => r.missing === 0 && r.ok), "mind az öt hívó teljes csomagot kapott");
    expect(m.calls() === Math.ceil(N / 60) + kb.length, `egy futás hívásszáma (${m.calls()} = ${Math.ceil(N / 60)} UI + ${kb.length} KB)`);
  }

  console.log("② requestLanguagePack: azonnal visszatér, a háttérben EGYSZER fordít");
  {
    const m = scripted(5);
    setBabelTransportForTest(m.transport);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) requestLanguagePack(L3);
    const ms = performance.now() - t0;
    expect(ms < 50, `öt kérés ${ms.toFixed(1)} ms alatt visszatért (nem várt fordításra)`);
    let sawBuilding = false;
    const deadline = Date.now() + 60_000;
    for (;;) {
      if (packBuilding(L3)) sawBuilding = true;
      const st = (await pool.query("select (select count(*) from jsonb_object_keys(strings))::int n from language_pack where lang=$1", [L3])).rows[0] as { n: number } | undefined;
      if (!packBuilding(L3) && st && st.n === N) break;
      if (Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const ui = [...m.asked.entries()].filter(([k]) => !k.startsWith("kb:"));
    expect(sawBuilding, "közben „készül” állapotot mutatott (packBuilding)");
    expect(ui.length === N && ui.every(([, n]) => n === 1), `a csomag elkészült, minden string egyszer (${ui.length}/${N})`);
  }

  console.log("③ három folyamat egyszerre (konzol + public + CLI): egy fordít, a többi vár");
  {
    const barrier = path.join(os.tmpdir(), `i18n-sf-${process.pid}-${Date.now()}`);
    const kids = [0, 1, 2].map(
      () =>
        new Promise<{ asked: number; missing: number; ok: boolean } | null>((resolve) => {
          const p = spawn(process.execPath, [...process.execArgv, SELF, "--child", L2, barrier], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
          let out = "";
          p.stdout.on("data", (d) => (out += String(d)));
          p.on("close", () => {
            const line = out.trim().split("\n").filter((l) => l.startsWith("{")).pop();
            resolve(line ? (JSON.parse(line) as { asked: number; missing: number; ok: boolean }) : null);
          });
        }),
    );
    await new Promise((r) => setTimeout(r, 6000)); // let all three boot and reach the barrier
    writeFileSync(barrier, "go");
    const res = await Promise.all(kids);
    rmSync(barrier, { force: true });
    const asked = res.map((r) => r?.asked ?? -1);
    expect(res.every((r) => r !== null), "mind a három folyamat lefutott");
    expect(asked.filter((n) => n > 0).length === 1, `pontosan egy folyamat fordított (kérdezett stringek: ${asked.join(" / ")})`);
    expect(asked.reduce((a, b) => a + Math.max(0, b), 0) === N, `összesen egyszer a katalógus (${N})`);
    expect(res.every((r) => r?.missing === 0), "a várakozók is teljes csomagot láttak a végén");
  }

  console.log("④ költségplafon: a napi plafon a HÍVÁS ELŐTT állít meg, egyszer riaszt");
  {
    const m = scripted(0);
    setBabelTransportForTest(m.transport);
    setTranslationSpendReaderForTest(async () => 1e6);
    const errs: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void errs.push(a.map(String).join(" "));
    let st;
    try {
      st = await ensureLanguagePack(L4);
      await ensureLanguagePack(L4);
    } finally {
      console.error = orig;
      setTranslationSpendReaderForTest(async () => 0);
    }
    expect(m.calls() === 0, `egyetlen fordító-hívás sem ment ki (${m.calls()})`);
    expect(st!.missing === N, "a csomag hiányos maradt (hu-fallback), nem „kész”");
    expect(errs.some((e) => e.includes("⛔⛔") && e.includes("NAPI")), "hangos: ⛔⛔ … NAPI plafon a naplóban");
    expect(alerts.length === 1, `a ház EGYSZER kapott riasztást (${alerts.length})`);
    const run = newTranslationRun(L4);
    run.spentUsd = 1e6;
    let scope = "";
    try {
      await assertTranslationBudget(run);
    } catch (e) {
      if (e instanceof TranslationBudgetError) scope = e.scope;
    }
    expect(scope === "run", "a futásonkénti plafon is megállít");
  }

  console.log("⑥ Bábel-mag: a commitolt fordítás elsőbbséget kap, a sérült kimarad");
  {
    const ph = catalog.find((h) => /\{[a-z]+\}/.test(h) && !/\{art/i.test(h))!;
    const [a, b] = catalog.filter((h) => h !== ph && !h.includes("{"));
    writeFileSync(SEED_FILE, JSON.stringify({ [a!]: "SEED-A", [b!]: "SEED-B", [ph]: "SEED broken", "nincs a katalógusban": "x" }));
    const m = scripted(0);
    setBabelTransportForTest(m.transport);
    await ensureLanguagePack(L5);
    const row = (await pool.query("select strings from language_pack where lang=$1", [L5])).rows[0] as { strings: Record<string, string> };
    expect(row.strings[a!] === "SEED-A" && row.strings[b!] === "SEED-B", "a mag stringjei a csomagban");
    expect(!m.asked.has(a!) && !m.asked.has(b!), "a magban lévőt nem kérdezte az API-tól");
    expect(m.asked.get(ph) === 1 && row.strings[ph] !== "SEED broken", "a placeholdert sértő mag-sort kihagyta, az API fordította");
    expect(!("nincs a katalógusban" in row.strings), "katalóguson kívüli kulcs nem kerül be");
  }

  console.log("⑤ bekötés (statikus)");
  {
    const read = (rel: string): string => readFileSync(path.join(ROOT, rel), "utf8");
    const scrape = read("src/console/scrapeJob.ts");
    const fn = scrape.slice(scrape.indexOf("export function startScrapeJob("), scrape.indexOf("export function startScoutJob("));
    expect(fn.indexOf("state.running") >= 0 && fn.indexOf("state.running") < fn.indexOf("requestLanguagePack"), "scrape: a fordítás a „már fut” kapu MÖGÖTT indul");
    expect(!/ensureLanguagePack/.test(fn), "scrape: nem vár fordításra (requestLanguagePack)");
    const auth = read("src/auth/operatorAuth.ts");
    expect(!/prepareMailLang|ensureLanguagePack/.test(auth) && /prepareRenderLang/.test(auth), "konzol-oldalrender: csak melegít (prepareRenderLang), nem vár");
    const srv = read("src/console/server.ts");
    const sw = srv.slice(srv.indexOf('path === "/operator/lang"'), srv.indexOf('path === "/operator/lang"') + 1500);
    expect(/prepareRenderLang/.test(sw) && !/prepareMailLang|ensureLanguagePack/.test(sw), "nyelvváltás (/operator/lang): nem vár a csomagra");
    for (const rel of ["src/i18n/packs.ts", "src/i18n/kbPacks.ts", "src/tenant/multilangGenerate.ts"]) {
      const src = read(rel);
      expect(!/messages\.create\(/.test(src) && /babelCall\(/.test(src), `${rel}: minden fordítás babelCall-on át (plafon + főkönyv)`);
    }
  }
} finally {
  setBabelTransportForTest(null);
  rmSync(SEED_FILE, { force: true });
  await cleanup(ALL);
  await pool.end();
}

if (failures) {
  console.error(`⛔ i18n-single-flight-check: ${failures} hiba`);
  process.exit(1);
}
console.log("✅ i18n-single-flight-check: nyelvenként egy fordítás, a kérés nem vár, a plafon a hívás előtt állít meg.");
process.exit(0);
