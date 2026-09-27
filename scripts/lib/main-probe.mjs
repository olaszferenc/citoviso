// „Piros a tiszta mainen is?" — a bukott kapu újrafuttatása a tiszta origin/mainen (ADR-XXXX).
//
// WHY. A gate that is red on the CLEAN main blocks every commit that happens to trigger it, and
// the committer searches their own diff for a fault that is not there. Measured 2026-09-27: the
// `photo-normalize-check` measured the shared dev DB's "first tenant_user" (a one-unit tenant,
// so the room uploader it looked for never rendered) — red on origin/main itself, blocking every
// commit touching src/server/adminViews.ts; the diagnosis took ~30 minutes by hand (a scratch
// worktree on origin/main, a manual re-run, DB queries). This does exactly that, automatically.
//
// WHAT IT DOES. Called by `gate_flush` (hooks/pre-commit) ONLY after a gate failed, for ONE gate
// (the first failed one), it:
//   1. creates a temporary DETACHED worktree on origin/main (outside the session's tree), with
//      the same shared symlinks rc-wt-prepare.sh makes (.env, node_modules, sites, assets/Temp,
//      the main tree's mock-*.html);
//   2. replays that gate's recorded job (argv · env · stdin · label) in it, through MAIN's own
//      gate-runner — the same read-only-first / writer-lane semantics, and a MACHINE slot
//      (ADR-0230), under a hard time limit;
//   3. prints ONE verdict: red there too → „EZ NEM A TE VÁLTOZÁSOD" with the gate file's last
//      commit on main (whom to tell); green there → „a te változásod bukik"; and the honest
//      "cannot tell" cases (the gate does not exist on main yet · it reads the diff/mode, so a
//      clean tree trivially passes · time limit · the probe itself broke).
//
// ⛔ IT NEVER LETS A COMMIT THROUGH. Its exit code is ignored by the hook; the hook exits with the
//    failed gate's code either way. An exception stays the owner's (ADR-0068).
// ⛔ GIT_* IS SCRUBBED (feedback_hook_guard_inherits_git_dir): inside a pre-commit hook GIT_DIR /
//    GIT_INDEX_FILE point at the COMMITTING worktree — a gate running `git` in the probe tree
//    would otherwise read (or write!) the index being committed. LAND_RANGE and the pass-cache
//    key go too: the probe measures main, not the diff.
// ⚠️ Worktree trap (feedback_my_fixup_tool_damaged_another_thread): `.git` of a worktree is a
//    FILE — the common dir is asked from git, never guessed from `<root>/.git/`.
//
// Output: the full probe log goes to a file; stderr gets the verdict (and, when main is red too,
// the tail of main's output — the proof). Only ever runs on a failure path.
//
// Knobs (all optional):
//   CIT_GATE_MAIN_PROBE=0             off (the hook checks it)
//   CIT_GATE_MAIN_PROBE_REF=<ref>     the "clean main" (default origin/main)
//   CIT_GATE_MAIN_PROBE_FETCH=0       no `git fetch origin main` first (default: fetch in commit
//                                     mode; never in land mode — land just rebased onto it)
//   CIT_GATE_MAIN_PROBE_TIMEOUT=<s>   hard limit for the replay (default 300)
//
// Usage (from hooks/pre-commit only): node scripts/lib/main-probe.mjs <jobs-dir> <root> <label-file>
// Guard: scripts/main-probe-check.mts (scenarios + red self-test).

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const [JOBS, ROOT_ARG, LABEL_FILE] = process.argv.slice(2);
if (!JOBS || !ROOT_ARG || !LABEL_FILE) {
  console.error("main-probe: usage: main-probe.mjs <jobs-dir> <root> <label-file>");
  process.exit(2);
}
const ROOT = realpathSync(ROOT_ARG);
const ROOT_AS_GIVEN = path.resolve(ROOT_ARG); // the hook records $PWD, which may differ from the realpath
const REF = process.env.CIT_GATE_MAIN_PROBE_REF || "origin/main";
const TIMEOUT = Math.max(5, Number(process.env.CIT_GATE_MAIN_PROBE_TIMEOUT) || 300);
const PREFIX = "cit-main-probe-";
// Same test the pass cache uses (gate-runner.mjs): a gate that reads the diff or the mode.
const READS_DIFF = /LAND_RANGE|--cached|git diff|"diff"/;

/** The environment with every GIT_* and per-run gate knob removed. */
function scrub(env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue;
    if (k.startsWith("GIT_") || k === "LAND_RANGE" || k === "CIT_GATE_KEY") continue;
    out[k] = v;
  }
  return out;
}
const CLEAN = scrub(process.env);

function git(args, opts = {}) {
  return spawnSync("git", ["-C", opts.cwd ?? ROOT, ...args], { env: CLEAN, encoding: "utf8", timeout: opts.timeout ?? 60_000 });
}
function gitOut(args, opts) {
  const r = git(args, opts);
  return r.status === 0 ? r.stdout.trim() : null;
}

const logFile = path.join(os.tmpdir(), `${PREFIX}${new Date().toISOString().replace(/[:.]/g, "")}-${process.pid}.log`);
const log = [];
const note = (s) => log.push(s);
function flushLog() {
  try {
    writeFileSync(logFile, `${log.join("\n")}\n`);
  } catch {
    // The verdict on stderr is what matters; the file is the long form.
  }
}
function say(lines) {
  process.stderr.write(`${lines.join("\n")}\n`);
}
const BAR = "══════════════════════════════════════════════════════════════════════";

// ── the failed job, as the hook recorded it ──────────────────────────────────────────
const base = LABEL_FILE.replace(/\.label$/, "");
const parseNul = (f) => readFileSync(f, "utf8").split("\0").filter((s) => s.length > 0);
let job;
try {
  const env = {};
  for (const kv of parseNul(`${base}.env`)) {
    const i = kv.indexOf("=");
    if (i > 0) env[kv.slice(0, i)] = kv.slice(i + 1);
  }
  const argv = parseNul(`${base}.argv`);
  job = {
    argv,
    env,
    cwd: readFileSync(`${base}.cwd`, "utf8"),
    label: existsSync(`${base}.label`) ? readFileSync(`${base}.label`, "utf8") : "",
    quiet: existsSync(`${base}.quiet`),
    stdin: existsSync(`${base}.stdin`) ? `${base}.stdin` : null,
    script: argv.find((a) => /^scripts\//.test(a)) ?? null,
  };
} catch (e) {
  say([`   ⚠ tiszta-main próba: a bukott kapu feljegyzése nem olvasható (${e.message}) — NEM DÖNTÖTT.`]);
  process.exit(0);
}
const title = job.label || job.argv.join(" ");

function verdict(kind, lines) {
  note(`VERDICT: ${kind}`);
  flushLog();
  say(["", BAR, ...lines, `   (a próba teljes naplója: ${logFile})`, BAR]);
}

// ── clean main ───────────────────────────────────────────────────────────────────────
const landMode = !!process.env.LAND_RANGE;
if (process.env.CIT_GATE_MAIN_PROBE_FETCH !== "0" && !landMode && REF === "origin/main") {
  const f = git(["fetch", "-q", "origin", "main"], { timeout: 30_000 });
  note(`fetch origin main → ${f.status === 0 ? "ok" : `nem sikerült (${(f.stderr || "").trim() || f.signal}) — a meglévő ${REF}-nel mérek`}`);
}
const mainSha = gitOut(["rev-parse", "--verify", "-q", `${REF}^{commit}`]);
if (!mainSha) {
  verdict("NO_REF", [`   ⚠ tiszta-main próba: a(z) ${REF} nem található — NEM DÖNTÖTT, hogy a te változásod-e.`]);
  process.exit(0);
}
const short = mainSha.slice(0, 8);
note(`gate: ${title}\nargv: ${JSON.stringify(job.argv)}\ncwd: ${job.cwd}\nref: ${REF} = ${mainSha}`);

// The gate's identity on main.
const rel = path.relative(ROOT_AS_GIVEN, job.cwd).startsWith("..") ? path.relative(ROOT, job.cwd) || "." : path.relative(ROOT_AS_GIVEN, job.cwd) || ".";
const scriptOnMain = job.script ? path.posix.join(rel === "." ? "" : rel, job.script) : null;
const mainSource = scriptOnMain ? gitOut(["show", `${mainSha}:${scriptOnMain}`]) : null;

if (job.script && mainSource === null) {
  verdict("NOT_ON_MAIN", [
    `ℹ️  TISZTA-MAIN PRÓBA — ${title}`,
    `   A kapu (${scriptOnMain}) a ${REF}-en (${short}) MÉG NEM LÉTEZIK: a diffed hozza, a mainen nincs mivel`,
    `   összevetni. A bukás a TE változásod része — a kaput és a vele érkező kódot nézd.`,
  ]);
  process.exit(0);
}
if (mainSource !== null && READS_DIFF.test(mainSource)) {
  verdict("READS_DIFF", [
    `ℹ️  TISZTA-MAIN PRÓBA — ${title}`,
    `   Ez a kapu a DIFFET vagy a módot olvassa (LAND_RANGE / --cached / git diff): egy tiszta fán a`,
    `   diff üres, a zöldje semmit nem bizonyítana. NEM DÖNTÖTT — a bukást a saját diffeden keresd.`,
  ]);
  process.exit(0);
}

// ── stale probes of earlier (killed) runs ─────────────────────────────────────────────
// Only our own prefix, only older than two time limits — a concurrent probe is never touched.
{
  const list = gitOut(["worktree", "list", "--porcelain"]) || "";
  for (const m of list.matchAll(/^worktree (.+)$/gm)) {
    const wt = m[1];
    if (!path.basename(wt).startsWith(PREFIX)) continue;
    let age = Infinity;
    try {
      age = Date.now() - statSync(wt).mtimeMs;
    } catch {}
    if (age > 2 * (TIMEOUT + 60) * 1000) {
      git(["worktree", "remove", "--force", wt]);
      note(`régi próba-fa takarítva: ${wt}`);
    }
  }
  git(["worktree", "prune"]);
  // Job dirs of killed probes, and logs older than a week (a log is the long form of a verdict
  // someone may still be reading — a day is too short over a weekend).
  for (const f of readdirSync(os.tmpdir())) {
    if (!f.startsWith(PREFIX)) continue;
    const p = path.join(os.tmpdir(), f);
    try {
      const age = Date.now() - statSync(p).mtimeMs;
      if (f.startsWith(`${PREFIX}jobs-`) ? age > 2 * (TIMEOUT + 60) * 1000 : f.endsWith(".log") && age > 7 * 86400_000) rmSync(p, { recursive: true, force: true });
    } catch {}
  }
}

// ── the temporary detached worktree ──────────────────────────────────────────────────
const dir = mkdtempSync(path.join(os.tmpdir(), PREFIX));
rmSync(dir, { recursive: true, force: true }); // `worktree add` wants to create it
let exitNote = "";
let pj = null;
function cleanup() {
  if (pj) rmSync(pj, { recursive: true, force: true });
  const r = git(["worktree", "remove", "--force", dir]);
  if (r.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    git(["worktree", "prune"]);
  }
}
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  const add = git(["worktree", "add", "--detach", "-q", dir, mainSha], { timeout: 120_000 });
  if (add.status !== 0) {
    verdict("PROBE_ERROR", [`   ⚠ tiszta-main próba: a próba-fa nem jött létre (${(add.stderr || "").trim()}) — NEM DÖNTÖTT.`]);
    process.exit(0);
  }

  // Shared, gitignored state — the same set rc-wt-prepare.sh links. Targets are resolved from
  // THIS tree (a worktree's entries are themselves links into the main tree).
  const mainTree = (() => {
    const common = gitOut(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    return common ? path.dirname(common) : null;
  })();
  for (const l of [".env", "node_modules", "sites", "assets/Temp"]) {
    const src = path.join(ROOT, l);
    if (!existsSync(src)) continue;
    const dst = path.join(dir, l);
    if (existsSync(dst)) continue;
    mkdirSync(path.dirname(dst), { recursive: true });
    symlinkSync(realpathSync(src), dst);
  }
  if (mainTree && existsSync(mainTree)) {
    for (const f of readdirSync(mainTree)) {
      if (!/^mock-.*\.html$/.test(f)) continue;
      const dst = path.join(dir, f);
      if (!existsSync(dst)) {
        try {
          symlinkSync(path.join(mainTree, f), dst);
        } catch {}
      }
    }
  }

  // The job, re-rooted into the probe tree.
  pj = mkdtempSync(path.join(os.tmpdir(), `${PREFIX}jobs-`));
  const reroot = (s) => {
    for (const r of [ROOT_AS_GIVEN, ROOT]) if (s === r || s.startsWith(`${r}/`)) return dir + s.slice(r.length);
    return s;
  };
  const env = scrub(job.env);
  for (const k of ["PWD", "OLDPWD"]) if (env[k]) env[k] = reroot(env[k]);
  delete env.CIT_GATE_SLOT_HELD; // the probe's runner decides its own slot (below)
  const id = "1.1";
  writeFileSync(path.join(pj, `${id}.argv`), job.argv.map((a) => `${reroot(a)}\0`).join(""));
  writeFileSync(path.join(pj, `${id}.env`), Object.entries(env).map(([k, v]) => `${k}=${v}\0`).join(""));
  writeFileSync(path.join(pj, `${id}.cwd`), reroot(job.cwd));
  writeFileSync(path.join(pj, `${id}.label`), job.label);
  if (job.quiet) writeFileSync(path.join(pj, `${id}.quiet`), "");
  if (job.stdin) copyFileSync(job.stdin, path.join(pj, `${id}.stdin`));

  // MAIN's runner, not this tree's (the diff may have changed the runner too). No pass cache.
  const runnerEnv = { ...CLEAN, CIT_GATE_CACHE: "0" };
  const t0 = Date.now();
  const r = spawnSync("timeout", ["-k", "10", String(TIMEOUT), process.execPath, path.join(dir, "scripts/lib/gate-runner.mjs"), pj, dir], {
    cwd: dir,
    env: runnerEnv,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  let mainOut = `${r.stdout || ""}${r.stderr || ""}`;
  // A red gate's own output lives in the runner's per-job files (FAILED lists them).
  const failedList = path.join(pj, "FAILED");
  if (existsSync(failedList)) {
    for (const line of readFileSync(failedList, "utf8").split("\n").filter(Boolean)) {
      const [, , out, err] = line.split("\t");
      for (const f of [out, err]) {
        try {
          mainOut += `\n${readFileSync(f, "utf8")}`;
        } catch {}
      }
    }
  }
  note(`runner rc=${r.status} signal=${r.signal ?? "-"} ${secs} s\n──── a kapu kimenete a mainen ────\n${mainOut}`);
  const hadFailed = existsSync(failedList);

  if (r.status === 124 || r.status === 137 || r.signal) {
    exitNote = "TIMEOUT";
    verdict("TIMEOUT", [
      `⏱️  TISZTA-MAIN PRÓBA — ${title}`,
      `   A kapu a ${REF}-en (${short}) ${TIMEOUT} s alatt nem futott le (időkorlát) — NEM DÖNTÖTT.`,
      `   Kézzel: CIT_GATE_MAIN_PROBE_TIMEOUT=<s> a következő futásnál.`,
    ]);
  } else if (r.status === 0) {
    const behind = gitOut(["rev-list", "--count", `HEAD..${mainSha}`]);
    verdict("GREEN_ON_MAIN", [
      `🔎 TISZTA-MAIN PRÓBA — ${title}`,
      `   Ugyanez a kapu a tiszta ${REF}-en (${short}) ZÖLD (${secs} s).`,
      `   ⇒ A TE VÁLTOZÁSOD BUKIK — a hibát a saját diffedben keresd.`,
      `   ⚠ EGY futás: egy időzítés-/terhelés-érzékeny kapu a mainen szerencsés időzítéssel is zöld lehet`,
      `     (mérve: console-contrast-check, 30 s-os goto a ~31 s-os networkidle-n). Ha a kimenet időkorlátról`,
      `     szól és a diffed a kapu tárgyát nem érinti, ez nem bizonyíték — szólj a kapu gazdájának.`,
      ...(behind && behind !== "0"
        ? [`   ⚠ A fád ${behind} committal a ${REF} mögött van: ha a kaput a mainen azóta javították, egy rebase is megoldhatja.`]
        : []),
    ]);
  } else if (r.status === 3 && hadFailed) {
    const owner = scriptOnMain ? gitOut(["log", "-1", "--format=%h · %an · %ad · %s", "--date=format:%Y-%m-%d %H:%M", mainSha, "--", scriptOnMain]) : null;
    // Every commit is authored by the owner — the SESSION trailer is what names the thread.
    const session = scriptOnMain ? gitOut(["log", "-1", "--format=%(trailers:key=Claude-Session,valueonly,separator=%x20)", mainSha, "--", scriptOnMain]) : null;
    const changedHere = scriptOnMain ? git(["diff", "--quiet", mainSha, "--", scriptOnMain]).status === 1 : false;
    const tail = mainOut.trim().split("\n").slice(-25);
    verdict("RED_ON_MAIN", [
      `⛔ TISZTA-MAIN PRÓBA — ${title}`,
      `   EZ NEM A TE VÁLTOZÁSOD — a kapu vagy a közös adat hibás a mainen:`,
      `   ugyanez a kapu a tiszta ${REF}-en (${short}) is PIROS (${secs} s).`,
      ...(owner ? [`   A kapu utolsó módosítása a mainen: ${owner}`] : []),
      ...(session ? [`   A módosító session: ${session}`] : []),
      ...(changedHere ? [`   ℹ A kapu fájlja a te fádban ELTÉR a mainétől — a mainen a main változata futott.`] : []),
      `   Teendő: szólj a kapu gazdájának (a fenti commit szála), vagy jelezd a tulajnak.`,
      `   A commit ettől NEM megy át — kapu-kivételt csak a tulaj adhat (ADR-0068).`,
      `   Ha a kimenet ELŐFELTÉTEL-hiányról szól: npx tsx scripts/park-doctor.mts`,
      "   ── a kapu kimenete a mainen (vége) ──",
      ...tail.map((l) => `   │ ${l}`),
    ]);
  } else {
    exitNote = "PROBE_ERROR";
  }
  if (exitNote === "PROBE_ERROR") {
    verdict("PROBE_ERROR", [
      `   ⚠ tiszta-main próba — ${title}: a mainen futtatott kapu-futtató nem értelmezhető kóddal állt meg`,
      `     (rc=${r.status}) — NEM DÖNTÖTT, hogy a te változásod-e.`,
    ]);
  }
} finally {
  cleanup();
}
