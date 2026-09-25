// Parallel gate runner for hooks/pre-commit (ADR-0227).
//
// WHY. The hook grew to ~180 gates; a commit touching the four big surface files starts ~98 of
// them, one after the other, and `scripts/land.sh` runs the same list again on the rebased diff.
// Measured 2026-09-24: most of the wall-clock is process start-up (npx + tsx + Chromium) and
// waiting, on an 8-core machine that the serial list keeps at one core.
//
// WHAT IT KEEPS. Every gate still runs, with the same argv, the same environment, the same cwd
// and the same stdin as the serial hook would have given it. Nothing is skipped, nothing is
// weakened: the runner changes WHEN a gate runs, never WHETHER or HOW.
//
// THE TWO PHASES.
//   ① Parallel, READ-ONLY. Each gate runs with PGOPTIONS default_transaction_read_only=on, so
//      Postgres itself refuses every write — no gate can disturb the rows another gate is
//      measuring. `gate-ro-preload.mjs` records every refused write (SQLSTATE 25006), even one
//      the gate swallowed; the output is also scanned for the libpq text of the same refusal.
//      A gate that tried to write has its phase-① verdict DISCARDED (it may have measured a
//      fixture it never managed to set up) and moves to phase ②.
//   ② Writers, normal mode, after phase ① finished. Two lanes (ADR-XXXX):
//      · the WRITER LANE — gates whose source carries `// gate-lane: own-fixture-only` in the first
//        40 lines run PARALLEL with each other (same PARALLEL, same "a script never overlaps itself").
//        The marker is a PROMISE audited per gate (2026-09-25) and guarded by scripts/gate-lane-check.mts:
//        the gate inserts and reads back ONLY its own run-stamped fixture — no borrowed row, no
//        table-wide sweep, no DDL, no shared outbox/ deletion.
//      · the STRICT lane — every other writer, one by one, in the hook's order, after the lane drained.
//      So an unmarked writer still never overlaps any other gate of this run.
//   The same script never runs twice at the same time (`x --self-test` and `x` share their
//   per-worktree scratch paths).
//
// KNOWN WRITERS. Gates seen writing are remembered in <git-common-dir>/cit-gate-writers and go
// straight to phase ② next time. The file is only a shortcut: a stale "writer" line merely
// runs serially, and a new writer is caught by the read-only refusal.
//
// OUTPUT CONTRACT (the hook's gate_failed doctrine, ADR-0171). Per job the stdout and stderr go
// to files. On success the label and the output a serial run would have shown are printed. On
// failure the runner writes `<rc>\t<label-file>\t<stdout-file>\t<stderr-file>` lines to
// <jobs>/FAILED and exits 3; the hook then prints each failed gate through the SAME gate_failed
// helper the serial path uses.
//
// PASS CACHE: see the block above `signature()` — land skips only an identical, green run.
//
// Usage (from hooks/pre-commit only):  node scripts/lib/gate-runner.mjs <jobs-dir> <root>

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const [JOBS, ROOT] = process.argv.slice(2);
if (!JOBS || !ROOT) {
  console.error("gate-runner: usage: gate-runner.mjs <jobs-dir> <root>");
  process.exit(2);
}

const PARALLEL = Math.max(1, Number(process.env.CIT_GATE_JOBS) || Math.min(4, Math.floor(os.cpus().length / 2)));
const PRELOAD = path.join(ROOT, "scripts/lib/gate-ro-preload.mjs");
const LOCAL_TSX = path.join(ROOT, "node_modules/.bin/tsx");
const RO_TEXT = /read-only transaction/;

function commonDir() {
  try {
    // A worktree's `.git` is a FILE (`gitdir: …`); the main checkout's is a DIRECTORY.
    const dotGit = path.join(ROOT, ".git");
    const p = statSync(dotGit).isDirectory() ? null : readFileSync(dotGit, "utf8").match(/^gitdir:\s*(.+)$/m);
    const gitDir = p ? path.resolve(ROOT, p[1].trim()) : dotGit;
    const c = path.join(gitDir, "commondir");
    return existsSync(c) ? path.resolve(gitDir, readFileSync(c, "utf8").trim()) : gitDir;
  } catch {
    return null;
  }
}
const WRITERS_FILE = process.env.CIT_GATE_WRITERS_FILE || (commonDir() ? path.join(commonDir(), "cit-gate-writers") : null);
const knownWriters = new Set(
  WRITERS_FILE && existsSync(WRITERS_FILE) ? readFileSync(WRITERS_FILE, "utf8").split("\n").filter(Boolean) : [],
);

/** `// gate-lane: own-fixture-only` in the gate's first 40 lines (see scripts/gate-lane-check.mts). */
const LANE_MARK = "// gate-lane: own-fixture-only";
function laneMarked(job) {
  try {
    return readFileSync(path.join(job.cwd, job.script), "utf8")
      .split("\n", 40)
      .some((l) => l.trim() === LANE_MARK);
  } catch {
    return false;
  }
}

function parseNul(file) {
  return readFileSync(file, "utf8").split("\0").filter((s) => s.length > 0);
}

const jobs = readdirSync(JOBS)
  .filter((f) => f.endsWith(".argv"))
  .map((f) => f.slice(0, -".argv".length))
  .sort((a, b) => {
    const [sa, pa] = a.split(".").map(Number);
    const [sb, pb] = b.split(".").map(Number);
    return sa - sb || pa - pb;
  })
  .map((id) => {
    const base = path.join(JOBS, id);
    const argv = parseNul(`${base}.argv`);
    const env = {};
    for (const kv of parseNul(`${base}.env`)) {
      const i = kv.indexOf("=");
      if (i > 0) env[kv.slice(0, i)] = kv.slice(i + 1);
    }
    // The script is the gate's identity: `npx tsx scripts/x.mts --self-test` → scripts/x.mts.
    const script = argv.find((a) => /^scripts\//.test(a)) ?? argv.join(" ");
    return {
      id,
      base,
      argv,
      env,
      script,
      cwd: readFileSync(`${base}.cwd`, "utf8"),
      label: existsSync(`${base}.label`) ? readFileSync(`${base}.label`, "utf8") : "",
      quiet: existsSync(`${base}.quiet`),
      stdin: existsSync(`${base}.stdin`) ? `${base}.stdin` : null,
    };
  });

function command(job) {
  const [cmd, ...rest] = job.argv;
  // `npx tsx` pays ~0.8 s of npm start-up per gate (measured); the local bin is the same tsx.
  if (cmd === "npx" && rest[0] === "tsx" && existsSync(LOCAL_TSX)) return [LOCAL_TSX, rest.slice(1)];
  return [cmd, rest];
}

function run(job, readOnly) {
  return new Promise((resolve) => {
    const env = { ...job.env };
    const mark = `${job.base}.ro`;
    if (readOnly) {
      env.PGOPTIONS = `${env.PGOPTIONS ? `${env.PGOPTIONS} ` : ""}-c default_transaction_read_only=on`;
      env.NODE_OPTIONS = `${env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ` : ""}--import ${PRELOAD}`;
      env.CIT_GATE_RO_MARK = mark;
    }
    const tag = readOnly ? "p" : "s";
    const out = `${job.base}.${tag}.out`;
    const err = `${job.base}.${tag}.err`;
    const [cmd, args] = command(job);
    const t0 = Date.now();
    const child = spawn(cmd, args, {
      cwd: job.cwd,
      env,
      stdio: [job.stdin ? openSync(job.stdin, "r") : "ignore", openSync(out, "w"), openSync(err, "w")],
    });
    const done = (rc) => {
      const text = `${readFileSync(out, "utf8")}\n${readFileSync(err, "utf8")}`;
      resolve({ rc, out, err, secs: (Date.now() - t0) / 1000, wrote: existsSync(mark) || (readOnly && RO_TEXT.test(text)) });
    };
    child.on("error", (e) => {
      appendFileSync(err, `gate-runner: spawn failed: ${e.message}\n`);
      done(127);
    });
    child.on("close", (code, signal) => done(code ?? (signal ? 128 : 1)));
  });
}

// ── PASS CACHE (land ≠ commit duplication) ───────────────────────────────────────────
// `scripts/land.sh` re-runs the whole list on the rebased diff. When the rebase changed nothing
// (one commit, main did not move), that is the SAME measurement twice. A gate is skipped only
// if it already went green with EXACTLY the same inputs:
//   · CIT_GATE_KEY = the tree the gates measured + the hash of the full diff being gated —
//     the hook computes it only when the worktree equals the index and nothing untracked could
//     be imported (otherwise it is empty and nothing is cached or skipped);
//   · the argv, the piped stdin and the environment (minus the per-invocation noise listed in
//     VOLATILE — which includes LAND_RANGE: no gate may branch on the mode, see below);
//   · less than CACHE_TTL_MS old.
// ⛔ A gate whose SOURCE reads the diff or the mode itself (LAND_RANGE / --cached / git diff)
//    is never cached: its verdict is not a function of the tree alone.
// Only a GREEN verdict is stored; a red one always runs again.
const CACHE_KEY = (process.env.CIT_GATE_KEY || "").trim();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const CACHE_DIR = CACHE_KEY && process.env.CIT_GATE_CACHE !== "0" && commonDir() ? path.join(commonDir(), "cit-gate-pass") : null;
const VOLATILE = /^(GIT_\w*|LAND_RANGE|PWD|OLDPWD|SHLVL|_|CIT_GATE_\w*)$/;
const READS_DIFF = /LAND_RANGE|--cached|git diff|"diff"/;

function signature(job) {
  if (!CACHE_DIR) return null;
  const file = path.join(job.cwd, job.script);
  try {
    if (READS_DIFF.test(readFileSync(file, "utf8"))) return null;
  } catch {
    return null;
  }
  const h = createHash("sha256");
  h.update(`${CACHE_KEY}\0${job.argv.join("\0")}\0\0`);
  h.update(job.stdin ? readFileSync(job.stdin) : "");
  for (const k of Object.keys(job.env).sort()) if (!VOLATILE.test(k)) h.update(`\0${k}=${job.env[k]}`);
  return h.digest("hex");
}
function cachedPass(job) {
  if (!job.sig) return null;
  try {
    const age = Date.now() - statSync(path.join(CACHE_DIR, job.sig)).mtimeMs;
    return age < CACHE_TTL_MS ? age : null;
  } catch {
    return null;
  }
}
function storePass(job) {
  if (!job.sig) return;
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(path.join(CACHE_DIR, job.sig), `${job.script}\n`);
  } catch {
    // A missed store only costs a re-run.
  }
}
if (CACHE_DIR && existsSync(CACHE_DIR)) {
  for (const f of readdirSync(CACHE_DIR)) {
    try {
      if (Date.now() - statSync(path.join(CACHE_DIR, f)).mtimeMs > CACHE_TTL_MS) rmSync(path.join(CACHE_DIR, f), { force: true });
    } catch {
      // Pruning is housekeeping only.
    }
  }
}

const failed = [];
const times = [];
function show(job, r) {
  times.push([r.secs, job.label || job.script, job.script]);
  if (r.rc !== 0) {
    failed.push([r.rc, job.id, r]);
    return;
  }
  storePass(job);
  const parts = [job.label];
  if (!job.quiet) parts.push(readFileSync(r.out, "utf8").replace(/\n$/, ""));
  parts.push(readFileSync(r.err, "utf8").replace(/\n$/, ""));
  process.stdout.write(`${parts.filter(Boolean).join("\n")}\n`);
}

const t0 = Date.now();
const serial = [];
const queue = [];
let reused = 0;
for (const j of jobs) {
  j.sig = signature(j);
  const age = cachedPass(j);
  if (age !== null) {
    reused++;
    process.stdout.write(`${j.label || j.script}\n   ↺ zöld volt PONTOSAN ezen a fán és diffen (${Math.round(age / 60000)} perce) — nem fut újra\n`);
    continue;
  }
  (knownWriters.has(j.script) ? serial : queue).push(j);
}
const phase1 = queue.length;
let deferred = 0;
const newWriters = [];

/** Run `list` on up to PARALLEL workers; a script never overlaps itself; after the first red
 *  nothing new is scheduled. `onDone(job, r)` decides what a finished job means. */
function pool(list, readOnly, onDone) {
  return new Promise((resolveAll) => {
    const running = new Set();
    const busy = new Set();
    const pump = () => {
      if (failed.length === 0) {
        for (let i = 0; i < list.length && running.size < PARALLEL; i++) {
          const job = list[i];
          if (busy.has(job.script)) continue;
          list.splice(i--, 1);
          busy.add(job.script);
          const p = run(job, readOnly).then((r) => {
            running.delete(p);
            busy.delete(job.script);
            onDone(job, r);
            pump();
          });
          running.add(p);
        }
      }
      if (running.size === 0) resolveAll();
    };
    pump();
  });
}

// ── ① parallel, read-only ────────────────────────────────────────────────────────────
await pool(queue, true, (job, r) => {
  if (r.wrote) {
    deferred++;
    serial.push(job);
    newWriters.push(job.script);
  } else show(job, r);
});

if (WRITERS_FILE && newWriters.length) {
  try {
    appendFileSync(WRITERS_FILE, `${[...new Set(newWriters)].filter((s) => !knownWriters.has(s)).join("\n")}\n`);
  } catch {
    // Only a shortcut for the next run; the read-only refusal catches writers regardless.
  }
}

// ── ② writers, normal mode — the marked lane in parallel, then the strict lane in the hook's order ──
serial.sort((a, b) => jobs.indexOf(a) - jobs.indexOf(b));
const lane = serial.filter((j) => laneMarked(j));
const strict = serial.filter((j) => !lane.includes(j));
const tLane = Date.now();
if (failed.length === 0) await pool([...lane], false, show);
const tStrict = Date.now();
if (failed.length === 0) {
  for (const job of strict) {
    const r = await run(job, false);
    show(job, r);
    if (r.rc !== 0) break;
  }
}
const laneSecs = ((tStrict - tLane) / 1000).toFixed(0);
const strictSecs = ((Date.now() - tStrict) / 1000).toFixed(0);

const secs = ((Date.now() - t0) / 1000).toFixed(0);
if (process.env.CIT_GATE_TIMES) {
  writeFileSync(
    process.env.CIT_GATE_TIMES,
    times
      .sort((a, b) => b[0] - a[0])
      .map(([s, l]) => `${s.toFixed(1)}\t${l}`)
      .join("\n") + "\n",
  );
}
console.log(
  `[pre-commit] kapu-futtató: ${jobs.length} kapu · ${phase1 - deferred} párhuzamosan (${PARALLEL} szál, csak-olvasó DB) · ` +
    `${lane.length} író-sávban (jelölt, ${PARALLEL} szál, ${laneSecs} s) · ${strict.length} sorosan (író, ${strictSecs} s) · ${reused} már zöld volt ugyanezen a fán · ${secs} s`,
);
if (failed.length) {
  writeFileSync(path.join(JOBS, "FAILED"), failed.map(([rc, id, r]) => `${rc}\t${path.join(JOBS, `${id}.label`)}\t${r.out}\t${r.err}`).join("\n") + "\n");
  process.exit(3);
}
