// KB deploy-gate — tudasbazis-or verdict token store + CLI (ADR-0045/f).
//
// The judgment layer of §J cannot run inside a bash deploy script (the verifier is
// a Claude subagent). What the script CAN enforce is EVIDENCE: a deploy whose range
// touches KB-relevant surfaces requires a fresh, range-bound PASS token that only an
// explicit, reasoned `pass` invocation creates — after the tudasbazis-or actually ran
// in the session. Mirrors surface-gate.mjs: the silent path is impossible; recording
// a verdict is a deliberate, logged act.
//
//   node scripts/kb-gate.mjs pass "<from>..<to>" "<mit vizsgált az őr / verdikt-kivonat>"
//   node scripts/kb-gate.mjs check "<from>..<to>"     # exit 0 = fresh PASS exists
//   node scripts/kb-gate.mjs --self-test              # red test — a gate that cannot
//                                                     # go red is not a gate
//
// KEY = the resolved SHA range (not a branch): a deploy is repo-global, and the token
// must die with the range — deploying a different target needs a new verdict. Stored
// in the OS tmpdir, NOT in the repo. TTL 24h: yesterday's verdict does not cover
// today's deploy decision.

import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const TTL_MS = 24 * 60 * 60 * 1000;

function resolveSha(ref) {
  return execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
    stdio: ["ignore", "pipe", "pipe"],
  })
    .toString()
    .trim();
}

/** "<from>..<to>" → canonical "<sha>..<sha>" (verdicts bind to content, not ref names). */
export function canonicalRange(range) {
  const m = /^(.+?)\.\.(.+)$/.exec(String(range || ""));
  if (!m) throw new Error(`érvénytelen tartomány: "${range}" — várt alak: <from>..<to>`);
  return `${resolveSha(m[1])}..${resolveSha(m[2])}`;
}

export function tokenPath(range) {
  const slug = canonicalRange(range).replace(/[^a-f0-9]/g, "-");
  return path.join(os.tmpdir(), `citoviso-kb-gate-${slug}.json`);
}

export function readVerdict(range) {
  try {
    const t = JSON.parse(readFileSync(tokenPath(range), "utf8"));
    if (Date.now() - t.at > TTL_MS) return { ...t, stale: true };
    return t;
  } catch {
    return null;
  }
}

function cmdPass(range, reason) {
  if (!reason || reason.trim().length < 20) {
    console.error(
      "⛔ A verdikt-kivonat kötelező (≥20 karakter): mit vizsgált a tudasbazis-or, és miért PASS.",
    );
    process.exit(1);
  }
  const canonical = canonicalRange(range);
  const token = { range: canonical, at: Date.now(), reason: reason.trim() };
  writeFileSync(tokenPath(range), JSON.stringify(token, null, 2));
  console.log(`✅ KB-verdikt rögzítve: ${canonical}\n   ${token.reason}`);
}

function cmdCheck(range) {
  const t = readVerdict(range);
  if (!t) {
    console.error(
      `⛔ Nincs tudasbazis-or PASS-verdikt a(z) ${canonicalRange(range)} tartományra.\n` +
        `   Futtasd az őrt a KB-releváns diffre, majd: node scripts/kb-gate.mjs pass "<range>" "<kivonat>"`,
    );
    process.exit(1);
  }
  if (t.stale) {
    console.error(`⛔ A verdikt ELAVULT (>24h): ${new Date(t.at).toISOString()} — friss őr-kör kell.`);
    process.exit(1);
  }
  console.log(`✓ friss KB-verdikt (${new Date(t.at).toISOString()}): ${t.reason}`);
}

function selfTest() {
  // Build the red cases on real, always-present commits: HEAD and HEAD~1.
  const head = resolveSha("HEAD");
  const prev = resolveSha("HEAD~1");
  let failures = 0;
  const expect = (name, fn, wantThrow) => {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    const ok = threw === wantThrow;
    console.log(`${ok ? "🟢" : "🔴"} ${name}`);
    if (!ok) failures++;
  };
  const run = (args) =>
    execFileSync("node", [process.argv[1], ...args], { stdio: ["ignore", "pipe", "pipe"] });

  expect("check verdikt nélkül → PIROS", () => run(["check", `${prev}..${head}`]), true);
  expect("pass rövid indoklással → PIROS", () => run(["pass", `${prev}..${head}`, "rövid"]), true);
  expect(
    "pass érvényes indoklással → zöld",
    () => run(["pass", `${prev}..${head}`, "self-test: szintetikus verdikt-kivonat a piros-teszthez"]),
    false,
  );
  expect("check a rögzített tartományra → zöld", () => run(["check", `${prev}..${head}`]), false);
  expect("check MÁS tartományra → PIROS (range-kötés)", () => run(["check", `${head}..${prev}`]), true);
  // Stale case: rewrite the token 25h into the past.
  const p = tokenPath(`${prev}..${head}`);
  const tok = JSON.parse(readFileSync(p, "utf8"));
  writeFileSync(p, JSON.stringify({ ...tok, at: Date.now() - 25 * 60 * 60 * 1000 }));
  expect("check ELAVULT tokenre → PIROS (TTL)", () => run(["check", `${prev}..${head}`]), true);
  try {
    unlinkSync(p);
  } catch {}
  if (failures) {
    console.error(`kb-gate self-test: 🔴 ${failures} eset hibás`);
    process.exit(1);
  }
  console.log("kb-gate self-test: 🟢 6/6");
}

const [cmd, arg1, arg2] = process.argv.slice(2);
if (cmd === "pass") cmdPass(arg1, arg2);
else if (cmd === "check") cmdCheck(arg1);
else if (cmd === "--self-test") selfTest();
else {
  console.error('Használat: kb-gate.mjs pass "<from>..<to>" "<kivonat>" | check "<from>..<to>" | --self-test');
  process.exit(1);
}
