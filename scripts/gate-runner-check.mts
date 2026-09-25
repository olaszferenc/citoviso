// GATE-RUNNER GUARD — a párhuzamos kapu-futtatás (ADR-0227) nem ad-e hamis zöldet, és nem
// tüntet-e el bukást.
//
// MIT VÉD. A `hooks/pre-commit` párhuzamos módban a kapukat csak FELJEGYZI, és a hook végén a
// `scripts/lib/gate-runner.mjs` futtatja le őket: ① párhuzamosan, Postgres-kényszerített
// csak-olvasó módban, ② az írókat sorosan. Ez a gyorsítás CSAK akkor vállalható, ha:
//   · minden feljegyzett kapu TÉNYLEG lefut (egy le nem futó kapu = néma zöld),
//   · a kapu ugyanazt kapja, amit soros módban: argv, `VAR=x` előtag, pipe-olt stdin,
//   · a bukás kilépési kódja és KIMENETE eljut az operátorhoz (ADR-0171 doktrína),
//   · az 1. fázisban a DB tényleg csak-olvasó, és az írni PRÓBÁLÓ kapu (akkor is, ha a hibát
//     lenyeli és zölden kilép) a 2. fázisban normál módban újrafut — az 1. fázisbeli ítélete
//     eldobva,
//   · ugyanaz a szkript sosem fut önmagával párhuzamosan (`x --self-test` és `x` közös
//     munkafa-kulcsú scratch-útvonalakon osztozik),
//   · a párhuzamosság valódi (különben a mechanika csak költség),
//   · a ② fázis író-sávja (ADR-0229) CSAK a `// gate-lane: own-fixture-only` jelölt írókat futtatja
//     egymással párhuzamosan, a jelöletlen író pedig UTÁNUK, egyedül indul,
//   · `gate_flush` nélkül a hook NEM zárulhat zölden,
//   · a zöld-gyorsítótár (land ≠ commit duplikáció) CSAK azonos fán + diffen + argv/stdin/
//     környezeten hasznosít újra, követetlen fájl mellett nem, piros ítéletet sosem tárol, és
//     a módot/diffet olvasó kaput sosem hagyja ki — viszont egy commit landolásakor tényleg
//     újrahasznosít (különben csak költség).
//
// ⛔ A mérés a hookból KIVÁGOTT, ténylegesen szállított mechanikán és a valódi futtatón fut,
// fixture-kapukkal egy eldobható könyvtárban — nem egy újraírt másolaton (gate-output-check
// tanulsága: a másolat az ÉN elképzelésemet bizonyítaná).
//
// Futtatás:       npx tsx scripts/gate-runner-check.mts
// Piros önteszt:  npx tsx scripts/gate-runner-check.mts --self-test
//   (tizenegy visszarontás — csak-olvasó opció ki · író-jelölő ki · flush-őr ki · szkript-kizárás ki ·
//    a bukás kiírása ki · piros ítélet tárolása · diffet olvasó kapu tárolása · a követetlen-fájl
//    feltétel ki · pipefail ki a kulcs-diffből · a sáv-jelölés vak · minden író a sávba —,
//    mindegyiknek pirosat KELL adnia.)

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");

const hookText = readFileSync(path.join(ROOT, "hooks/pre-commit"), "utf8");
const runnerText = readFileSync(path.join(ROOT, "scripts/lib/gate-runner.mjs"), "utf8");
const preloadText = readFileSync(path.join(ROOT, "scripts/lib/gate-ro-preload.mjs"), "utf8");

/** The shipped mechanism: from `GATE_LOG=` through the end of `gate_flush()`. */
function extractBlock(text: string): string {
  const start = text.indexOf('GATE_LOG="$(mktemp');
  const fl = text.indexOf("gate_flush() {");
  const end = fl < 0 ? -1 : text.indexOf("\n}\n", fl);
  if (start < 0 || end < 0) throw new Error("a hookban nem található a GATE_LOG … gate_flush() blokk");
  return text.slice(start, end + 3);
}

type Variant = { hook: string; runner: string; preload: string; withFlush: boolean };

const GATES = String.raw`
echo "[pre-commit] ok-quiet…"
node scripts/okq.mjs >"$GATE_LOG" || gate_failed
echo "[pre-commit] ok-loud…"
node scripts/okl.mjs
echo "[pre-commit] env-prefix…"
FIX_PREFIX=bar node scripts/env.mjs >"$GATE_LOG" || gate_failed
echo "[pre-commit] piped-stdin…"
printf 'a\nb\n' | node scripts/stdin.mjs
echo "[pre-commit] same-script A…"
node scripts/same.mjs A >"$GATE_LOG" || gate_failed
echo "[pre-commit] same-script B…"
node scripts/same.mjs B >"$GATE_LOG" || gate_failed
echo "[pre-commit] par-1…"
node scripts/par1.mjs 1 >"$GATE_LOG" || gate_failed
echo "[pre-commit] par-2…"
node scripts/par2.mjs 2 >"$GATE_LOG" || gate_failed
echo "[pre-commit] swallowing-writer…"
npx tsx scripts/writer.mts >"$GATE_LOG" || gate_failed
`;
const FAILING = String.raw`
echo "[pre-commit] failing-one…"
node scripts/fail7.mjs 7 >"$GATE_LOG" || gate_failed
echo "[pre-commit] failing-two…"
node scripts/fail5.mjs 5 >"$GATE_LOG" || gate_failed
`;

// Two DIFFERENT scripts each: the runner rightly never overlaps a script with itself.
const PAR = `import { appendFileSync } from "node:fs";
    const t0 = Date.now(); await new Promise((r) => setTimeout(r, 1200));
    appendFileSync(process.env.FIX_OUT + "/par", process.argv[2] + " " + t0 + " " + Date.now() + "\\n");`;
const FAIL = `console.log("FAIL-STDOUT-" + process.argv[2]); process.exit(Number(process.argv[2]));`;

const CACHE_GATES = String.raw`
echo "[pre-commit] counted…"
node scripts/count.mjs >"$GATE_LOG" || gate_failed
echo "[pre-commit] mode-aware…"
node scripts/modeaware.mjs >"$GATE_LOG" || gate_failed
echo "[pre-commit] flaky…"
node scripts/flaky.mjs >"$GATE_LOG" || gate_failed
`;
// ── F: writer lanes. Three KNOWN writers (pre-registered, so they go straight to phase ②):
// two carry the lane marker and must overlap; the unmarked one must start only after both ended.
const LANE_GATES = String.raw`
echo "[pre-commit] lane-1…"
node scripts/lane1.mjs lane1 >"$GATE_LOG" || gate_failed
echo "[pre-commit] lane-2…"
node scripts/lane2.mjs lane2 >"$GATE_LOG" || gate_failed
echo "[pre-commit] strict-1…"
node scripts/strict1.mjs strict1 >"$GATE_LOG" || gate_failed
`;
const LANE_MARK = "// gate-lane: own-fixture-only";
const WRITER_TIMED = (marked: boolean): string =>
  `${marked ? LANE_MARK : "// (no lane marker)"}
    import { appendFileSync } from "node:fs";
    const t0 = Date.now(); await new Promise((r) => setTimeout(r, 1200));
    appendFileSync(process.env.FIX_OUT + "/lane", process.argv[2] + " " + t0 + " " + Date.now() + "\\n");`;

const COUNTER = (name: string, extra = ""): string =>
  `import { appendFileSync, existsSync } from "node:fs"; appendFileSync(process.env.FIX_OUT + "/${name}", "x");${extra}`;

const FIXTURES: Record<string, string> = {
  "count.mjs": COUNTER("count"),
  // Mentions the mode variable, so its verdict is not a function of the tree alone.
  "modeaware.mjs": COUNTER("modeaware", " const mode = process.env.LAND_RANGE;"),
  "flaky.mjs": COUNTER("flaky", ` if (existsSync(process.env.FIX_OUT + "/fail-flag")) process.exit(4);`),

  "okq.mjs": `console.log("OKQ-STDOUT"); console.error("OKQ-STDERR");`,
  "okl.mjs": `console.log("OKL-STDOUT");`,
  "env.mjs": `if (process.env.FIX_PREFIX !== "bar") { console.log("PREFIX-MISSING"); process.exit(1); }`,
  "stdin.mjs": `import { readFileSync } from "node:fs"; const s = readFileSync(0, "utf8");
    if (s !== "a\\nb\\n") { console.log("STDIN-WRONG " + JSON.stringify(s)); process.exit(1); }`,
  "same.mjs": `import { openSync, rmSync, appendFileSync } from "node:fs";
    const lock = process.env.FIX_OUT + "/same.lock";
    try { openSync(lock, "wx"); } catch { appendFileSync(process.env.FIX_OUT + "/overlap", "x"); }
    await new Promise((r) => setTimeout(r, 700)); rmSync(lock, { force: true });`,
  "par1.mjs": PAR,
  "par2.mjs": PAR,
  "lane1.mjs": WRITER_TIMED(true),
  "lane2.mjs": WRITER_TIMED(true),
  "strict1.mjs": WRITER_TIMED(false),
  "fail7.mjs": FAIL,
  "fail5.mjs": FAIL,
  // Writes inside a rolled-back transaction (nothing persists), SWALLOWS any error and exits 0 —
  // the worst case: a gate that would go green on a fixture it never managed to set up.
  "writer.mts": `import { appendFileSync } from "node:fs";
    const { pool } = await import(${JSON.stringify(path.join(ROOT, "src/db/client.ts"))});
    const c = await pool.connect();
    let ro = "?";
    try {
      ro = (await c.query("show default_transaction_read_only")).rows[0].default_transaction_read_only;
      await c.query("begin"); await c.query("create temp table _gate_runner_probe(a int)"); await c.query("rollback");
    } catch { try { await c.query("rollback"); } catch {} }
    c.release(); await pool.end();
    appendFileSync(process.env.FIX_OUT + "/writer", ro + "\\n");`,
};

type Run = { rc: number; out: string; dir: string; read: (f: string) => string };
type Fixture = { dir: string; out: string; run: (extra?: Record<string, string>) => Run; git: (...a: string[]) => string };

function cleanEnv(): Record<string, string> {
  // ⛔ No GIT_* leaks into the fixture (feedback_hook_guard_inherits_git_dir) — and no
  // inherited runner knobs: the fixture decides its own parallelism.
  const env: Record<string, string> = {};
  for (const [k, val] of Object.entries(process.env)) {
    // LAND_RANGE too: under `land.sh` this guard itself runs with origin/main...HEAD exported,
    // a range that does not exist in the fixture repo (measured: it broke scenario E).
    if (val === undefined || k.startsWith("GIT_") || k.startsWith("CIT_GATE_") || k === "NODE_OPTIONS" || k === "PGOPTIONS" || k === "LAND_RANGE") continue;
    env[k] = val;
  }
  return env;
}

/** A throw-away project: the fixture gates, the shipped runner/preload, a hook built from the
 *  shipped block. With `repo`, it is also a git repository (for the pass-cache key). */
function prepare(v: Variant, gates: string, jobs: string, repo = false): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), "cit-gate-runner-check-"));
  const out = mkdtempSync(path.join(tmpdir(), "cit-gate-runner-check-out-"));
  mkdirSync(path.join(dir, "scripts/lib"), { recursive: true });
  symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
  for (const [f, src] of Object.entries(FIXTURES)) writeFileSync(path.join(dir, "scripts", f), src);
  writeFileSync(path.join(dir, "scripts/lib/gate-runner.mjs"), v.runner);
  writeFileSync(path.join(dir, "scripts/lib/gate-ro-preload.mjs"), v.preload);
  const hook =
    `#!/usr/bin/env bash\nset -e\ncd ${JSON.stringify(dir)}\n` +
    extractBlock(v.hook) +
    gates +
    (v.withFlush ? "gate_flush\n" : "") +
    `echo "[pre-commit] ✅ minden kapu zöld"\n`;
  writeFileSync(path.join(dir, "hook"), hook);
  const git = (...a: string[]): string => {
    const r = spawnSync("git", ["-C", dir, ...a], { env: cleanEnv(), encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
    return r.stdout;
  };
  if (repo) {
    writeFileSync(path.join(dir, ".gitignore"), "node_modules\n");
    writeFileSync(path.join(dir, "tracked.txt"), "v1\n");
    git("init", "-q");
    git("-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "add", "-A");
    git("-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "commit", "-qm", "fixture");
  }
  const read = (f: string): string => {
    try {
      return readFileSync(path.join(out, f), "utf8");
    } catch {
      return "";
    }
  };
  const run = (extra: Record<string, string> = {}): Run => {
    const env = cleanEnv();
    env.FIX_OUT = out;
    env.CIT_GATE_WRITERS_FILE = path.join(out, "writers");
    if (jobs) env.CIT_GATE_JOBS = jobs;
    Object.assign(env, extra);
    const r = spawnSync("bash", [path.join(dir, "hook")], { env, encoding: "utf8", timeout: 120_000 });
    return { rc: r.status ?? -1, out: `${r.stdout}${r.stderr}`, dir, read };
  };
  return { dir, out, run, git };
}
function dispose(f: Fixture): void {
  rmSync(f.dir, { recursive: true, force: true });
  rmSync(f.out, { recursive: true, force: true });
}
function runVariant(v: Variant, gates: string, jobs: string): Run & { fx: Fixture } {
  const fx = prepare(v, gates, jobs);
  return { ...fx.run(), fx };
}

function audit(v: Variant): string[] {
  const bad: string[] = [];
  const say = (ok: boolean, msg: string): void => {
    if (!ok) bad.push(msg);
  };

  // ── A: a green parallel run ───────────────────────────────────────────────────────
  const a = runVariant(v, GATES, "4");
  say(a.rc === 0, `A · a zöld párhuzamos futás kilépési kódja ${a.rc} (0 várt)\n${a.out.slice(-1500)}`);
  say(a.out.includes("✅ minden kapu zöld"), "A · hiányzik a záró zöld sor");
  say(a.out.includes("[pre-commit] ok-quiet…") && a.out.includes("[pre-commit] swallowing-writer…"), "A · a kapu-feliratok nem jelennek meg");
  say(!a.out.includes("OKQ-STDOUT"), "A · az elnémított (>\"$GATE_LOG\") kapu stdout-ja zöld futásnál kiíródott");
  say(a.out.includes("OKQ-STDERR"), "A · a stderr nem folyt át (soros módban átfolyik)");
  say(a.out.includes("OKL-STDOUT"), "A · a nem elnémított kapu stdout-ja elveszett");
  say(!a.out.includes("PREFIX-MISSING"), "A · a `VAR=x` előtag nem jutott el a kapuhoz");
  say(!a.out.includes("STDIN-WRONG"), "A · a pipe-olt stdin nem jutott el a kapuhoz");
  say(a.read("overlap") === "", "A · ugyanaz a szkript ÖNMAGÁVAL párhuzamosan futott");
  const par = a
    .read("par")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split(" ").map(Number));
  say(par.length === 2, `A · a két par-kapuból ${par.length} futott le`);
  if (par.length === 2) {
    const overlap = Math.min(par[0][2], par[1][2]) - Math.max(par[0][1], par[1][1]);
    say(overlap > 300, `A · a független kapuk NEM futottak párhuzamosan (átfedés ${overlap} ms)`);
  }
  const w = a.read("writer").trim().split("\n");
  say(w[0] === "on", `A · az 1. fázisban a DB NEM volt csak-olvasó (default_transaction_read_only=${w[0]})`);
  say(
    w.length === 2 && w[1] === "off",
    `A · az írni próbáló (és a hibát lenyelő) kapu nem futott újra normál módban (futások: ${JSON.stringify(w)})`,
  );
  let writers = "";
  try {
    writers = readFileSync(path.join(a.fx.out, "writers"), "utf8");
  } catch {
    writers = "";
  }
  say(writers.includes("scripts/writer.mts"), "A · az író kapu nem került az író-gyorsítótárba");
  dispose(a.fx);

  // ── B: failures surface, with their output and exit code ──────────────────────────
  // The two failing gates come FIRST, so both start in the first batch (after the first red the
  // runner schedules nothing new — both outputs are only guaranteed when both already run).
  const b = runVariant(v, FAILING + GATES, "4");
  say(b.rc === 5 || b.rc === 7, `B · a bukó futás kilépési kódja ${b.rc} (a kapu kódja, 5 vagy 7 várt)`);
  say(!b.out.includes("✅ minden kapu zöld"), "B · bukás mellett is kiírta a zöld záró sort");
  say(b.out.includes("EZ A KAPU ELBUKOTT"), "B · a bukás nem a gate_failed blokkal jelent meg");
  say(b.out.includes("FAIL-STDOUT-7") && b.out.includes("FAIL-STDOUT-5"), "B · valamelyik bukó kapu kimenete elveszett");
  say(b.out.includes("[pre-commit] failing-one…") && b.out.includes("[pre-commit] failing-two…"), "B · a bukó kapu felirata hiányzik");
  dispose(b.fx);

  // ── C: serial escape hatch still gates ────────────────────────────────────────────
  const c = runVariant(v, GATES + FAILING, "1");
  say(c.rc === 7, `C · soros módban (CIT_GATE_JOBS=1) a kilépési kód ${c.rc} (7 várt: az első bukó)`);
  say(c.out.includes("FAIL-STDOUT-7"), "C · soros módban a bukó kapu kimenete elveszett");
  dispose(c.fx);

  // ── D: a hook that forgets gate_flush must NOT end green ──────────────────────────
  const d = runVariant({ ...v, withFlush: false }, GATES, "4");
  say(d.rc !== 0, `D · gate_flush nélkül a hook ZÖLDEN zárult (rc=${d.rc}) — a kapuk le sem futottak`);
  dispose(d.fx);

  // ── E: the pass cache reuses ONLY an identical, green measurement ──────────────────
  const e = prepare(v, CACHE_GATES, "4", true);
  const count = (f: string): number => {
    try {
      return readFileSync(path.join(e.out, f), "utf8").length;
    } catch {
      return 0;
    }
  };
  const e1 = e.run();
  say(e1.rc === 0 && count("count") === 1, `E · az első futás nem futtatta le a kaput (rc=${e1.rc}, futás ${count("count")})\n${e1.out.slice(-800)}`);
  const e2 = e.run();
  say(e2.rc === 0 && count("count") === 1, `E · azonos fán + diffen a zöld kapu MÉGIS újrafutott (futás ${count("count")}) — a gyorsítótár nem működik`);
  say(e2.out.includes("zöld volt PONTOSAN"), "E · a kihagyott kapu nem mondja meg, hogy kihagyta és miért");
  say(count("modeaware") === 2, `E · a diffet/módot olvasó kapu gyorsítótárból jött (futás ${count("modeaware")}, 2 várt)`);
  // untracked file → no key → runs
  writeFileSync(path.join(e.dir, "stray.mjs"), "export {};\n");
  e.run();
  say(count("count") === 2, "E · követetlen fájl mellett is a gyorsítótárból jött (egy követetlen fájlt egy kapu importálhat)");
  rmSync(path.join(e.dir, "stray.mjs"));
  // a red run is never stored
  writeFileSync(path.join(e.out, "fail-flag"), "");
  writeFileSync(path.join(e.dir, "tracked.txt"), "v2\n");
  e.git("add", "tracked.txt");
  const e4 = e.run();
  say(e4.rc !== 0, `E · a bukó kapu nem bukott (rc=${e4.rc})`);
  rmSync(path.join(e.out, "fail-flag"));
  const before = count("flaky");
  e.run();
  say(count("flaky") === before + 1, "E · egy PIROS ítélet a gyorsítótárba került — a következő futás le sem futtatta a kaput");
  // commit-mode key == land-mode key for the same single commit (the case the cache is for)
  e.git("-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "commit", "-qm", "v2");
  const c0 = count("count");
  const e6 = e.run({ LAND_RANGE: "HEAD~1...HEAD" });
  say(e6.rc === 0 && count("count") === c0, `E · a landolás (ugyanaz a fa + diff) nem használta a commitkori zöldet (futás ${c0}→${count("count")})`);
  // a FAILED diff (a range that does not exist) must not yield a key — it runs
  const c1 = count("count");
  e.run({ LAND_RANGE: "nincs-ilyen-ag...HEAD" });
  e.run({ LAND_RANGE: "nincs-ilyen-ag...HEAD" });
  say(count("count") === c1 + 2, "E · hibás land-tartományon (elhasaló git diff) a kapu a gyorsítótárból jött — az üres diff hash-e lett a kulcs");
  // a changed tree runs again
  writeFileSync(path.join(e.dir, "tracked.txt"), "v3\n");
  e.git("add", "tracked.txt");
  e.run();
  say(count("count") === c1 + 3, "E · megváltozott fán a kapu a gyorsítótárból jött");
  dispose(e);

  // ── F: the writer lane — marked writers overlap, the unmarked one waits for them ───────
  const f = prepare(v, LANE_GATES, "4");
  writeFileSync(path.join(f.out, "writers"), "scripts/lane1.mjs\nscripts/lane2.mjs\nscripts/strict1.mjs\n");
  const fr = f.run();
  say(fr.rc === 0, `F · a sávos futás kilépési kódja ${fr.rc} (0 várt)\n${fr.out.slice(-1200)}`);
  say(fr.out.includes("2 író-sávban"), "F · az összegző sor nem mondja meg, hány író futott a sávban");
  const lanes = new Map(
    fr.read("lane").trim().split("\n").filter(Boolean).map((l) => {
      const [name, a, b] = l.split(" ");
      return [name, [Number(a), Number(b)]] as const;
    }),
  );
  say(lanes.size === 3, `F · a három író kapuból ${lanes.size} futott le`);
  if (lanes.size === 3) {
    const l1 = lanes.get("lane1")!;
    const l2 = lanes.get("lane2")!;
    const st = lanes.get("strict1")!;
    const overlap = Math.min(l1[1], l2[1]) - Math.max(l1[0], l2[0]);
    say(overlap > 300, `F · a két JELÖLT író NEM futott párhuzamosan (átfedés ${overlap} ms) — a sáv nem működik`);
    say(st[0] >= Math.max(l1[1], l2[1]), `F · a JELÖLETLEN író a sávval EGYSZERRE futott (indult ${st[0] - Math.max(l1[1], l2[1])} ms-mal a sáv vége előtt)`);
  }
  dispose(f);
  return bad;
}

const shipped: Variant = { hook: hookText, runner: runnerText, preload: preloadText, withFlush: true };

function mutate(label: string, src: string, from: string, to: string): string {
  if (!src.includes(from)) {
    console.log(`⛔ AZ ÖNTESZT NEM TUDOTT VISSZARONTANI (${label}): a minta nincs meg — az őr nem a szállított alakot méri.`);
    process.exit(1);
  }
  return src.split(from).join(to);
}

if (SELF_TEST) {
  const reds: [string, Variant][] = [
    ["csak-olvasó opció ki", { ...shipped, runner: mutate("ro", runnerText, "-c default_transaction_read_only=on", "-c application_name=x") }],
    ["író-jelölő ki", { ...shipped, preload: mutate("mark", preloadText, 'if (!err || err.code !== "25006") return;', "return;") }],
    ["flush-őr ki", { ...shipped, hook: mutate("flush", hookText, "      rm -rf \"$GATE_JOBS\"\n      exit 1\n", "      rm -rf \"$GATE_JOBS\"\n") }],
    ["szkript-kizárás ki", { ...shipped, runner: mutate("busy", runnerText, "if (busy.has(job.script)) continue;", "") }],
    ["bukás-kiírás ki", { ...shipped, hook: mutate("print", hookText, '    cat "$out" >"$GATE_LOG"\n', "    : >\"$GATE_LOG\"\n") }],
    ["piros ítélet is a gyorsítótárba", { ...shipped, runner: mutate("red-store", runnerText, "function show(job, r) {\n", "function show(job, r) {\n  storePass(job);\n") }],
    ["diffet olvasó kapu is gyorsítótárazva", { ...shipped, runner: mutate("reads-diff", runnerText, 'if (READS_DIFF.test(readFileSync(file, "utf8"))) return null;', "") }],
    ["pipefail ki a kulcs-diffből", { ...shipped, hook: mutate("pipefail", hookText, "diffsum=$(set -o pipefail; ", "diffsum=$(") }],
    ["követetlen-fájl feltétel ki", { ...shipped, hook: mutate("untracked", hookText, '[ -z "$(git status --porcelain', '[ -z "$(true || git status --porcelain') }],
    ["a sáv-jelölés vak", { ...shipped, runner: mutate("lane-mark", runnerText, 'const LANE_MARK = "// gate-lane: own-fixture-only";', 'const LANE_MARK = "// gate-lane: nincs-ilyen";') }],
    ["minden író a sávba", { ...shipped, runner: mutate("lane-all", runnerText, "const lane = serial.filter((j) => laneMarked(j));", "const lane = serial.filter(() => true);") }],
  ];
  let ok = true;
  for (const [name, v] of reds) {
    const bad = audit(v);
    console.log(`${bad.length ? "✅ piros, ahogy kell" : "⛔ ZÖLD MARADT"} — ${name}${bad.length ? ` (${bad.length} sértés; első: ${bad[0].split("\n")[0]})` : ""}`);
    if (!bad.length) ok = false;
  }
  if (!ok) {
    console.log("⛔ gate-runner-check ÖNTESZT: legalább egy visszarontás ZÖLD maradt — az őr vak rá.");
    process.exit(1);
  }
  console.log("✅ gate-runner-check önteszt: mind a tizenegy visszarontás pirosat adott.");
  process.exit(0);
}

const bad = audit(shipped);
if (bad.length) {
  console.log(`⛔ gate-runner-check: ${bad.length} sértés`);
  for (const b of bad) console.log(`   · ${b}`);
  process.exit(1);
}
console.log("✅ gate-runner-check: a párhuzamos futtató mind a hat forgatókönyvben (A–F) tartja a soros hook szerződését.");
