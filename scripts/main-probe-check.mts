// MAIN-PROBE GUARD — a „piros a tiszta mainen is?” próba (scripts/lib/main-probe.mjs, ADR-XXXX)
// a helyes gazdát nevezi-e meg, és SOHA nem engedi-e át a bukott commitot.
//
// MIT VÉD. A hook `gate_flush`-a bukás UTÁN az első bukott kaput újrafuttatja egy ideiglenes,
// detached worktree-ben az origin/mainen. A próba csak akkor ér valamit, ha:
//   · a mainen is piros kapura „EZ NEM A TE VÁLTOZÁSOD”-at mond, a kapu fájljának utolsó main-
//     commitjával (gazda) és a mainen kapott kimenettel (bizonyíték);
//   · a csak a diffben piros kapura „A TE VÁLTOZÁSOD BUKIK”-at mond — tehát TÉNYLEG a main
//     változatát futtatja, nem a session fáját;
//   · a hook örökölt GIT_DIR / GIT_INDEX_FILE-ja NEM szivárog a próba-fába (egy ott futó `git`
//     különben a commitolt indexet olvasná — feedback_hook_guard_inherits_git_dir), és a közös,
//     gitignore-olt állapot (.env) symlinkként ott van;
//   · a session fája WORKTREE (a `.git` FÁJL) — a fixture is az, nem egy sima repó;
//   · land-módban (LAND_RANGE) is szól; a mainen még nem létező és a diffet olvasó kapunál
//     kimondja, hogy NEM DÖNTÖTT; időkorlát után megáll és ezt mondja;
//   · a kapu kilépési kódja változatlanul a hooké (a próba nem enged át), zöld futásnál és
//     CIT_GATE_MAIN_PROBE=0 mellett nem fut, és nem hagy maga után worktree-t.
//
// ⛔ A mérés a hookból KIVÁGOTT, szállított `gate_flush`-on, a szállított futtatón és próbán fut,
// egy eldobható git-repóban + worktree-ben, privát gépi slotokkal (a valódi sort nem érinti).
//
// Futtatás:       npx tsx scripts/main-probe-check.mts
// Piros önteszt:  npx tsx scripts/main-probe-check.mts --self-test
//   (hét visszarontás — a próba a session fájában fut · GIT_* szivárog · nincs időkorlát · a hook
//    átengedi a commitot · a mainen piros kaput zöldnek olvassa · a próba-fa ott marad · a hook
//    nem hívja a próbát —, mindegyiknek pirosat KELL adnia.)

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");

const hookText = readFileSync(path.join(ROOT, "hooks/pre-commit"), "utf8");
const runnerText = readFileSync(path.join(ROOT, "scripts/lib/gate-runner.mjs"), "utf8");
const preloadText = readFileSync(path.join(ROOT, "scripts/lib/gate-ro-preload.mjs"), "utf8");
const probeText = readFileSync(path.join(ROOT, "scripts/lib/main-probe.mjs"), "utf8");

/** The shipped mechanism: from `GATE_LOG=` through the end of `gate_flush()`. */
function extractBlock(text: string): string {
  const start = text.indexOf('GATE_LOG="$(mktemp');
  const fl = text.indexOf("gate_flush() {");
  const end = fl < 0 ? -1 : text.indexOf("\n}\n", fl);
  if (start < 0 || end < 0) throw new Error("a hookban nem található a GATE_LOG … gate_flush() blokk");
  return text.slice(start, end + 3);
}

function cleanEnv(): Record<string, string> {
  // ⛔ Nothing of the CALLER's git or gate context leaks into the fixture (this guard itself runs
  // inside the real pre-commit, with GIT_DIR/GIT_INDEX_FILE and maybe LAND_RANGE exported).
  const env: Record<string, string> = {};
  for (const [k, val] of Object.entries(process.env)) {
    if (val === undefined || k.startsWith("GIT_") || k.startsWith("CIT_GATE_") || k === "NODE_OPTIONS" || k === "PGOPTIONS" || k === "LAND_RANGE") continue;
    env[k] = val;
  }
  return env;
}

// ── fixture gates: [main version, branch version] ─────────────────────────────────────
const WHERE_MAIN = `import { execFileSync } from "node:child_process"; import { readFileSync } from "node:fs";
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  let envOk = false; try { envOk = readFileSync(".env", "utf8").includes("FIXTURE_ENV=1"); } catch {}
  if (head !== process.env.FIX_MAIN_SHA) { console.log("WHERE-WRONG-HEAD " + head); process.exit(1); }
  if (!envOk) { console.log("WHERE-NO-ENV"); process.exit(1); }
  console.log("WHERE-OK");`;
const GATES_MAIN: Record<string, string> = {
  "ok.mjs": `console.log("OK");`,
  "red.mjs": `console.log("RED-MAIN-OUT: a közös adat hibás"); process.exit(4);`,
  "mine.mjs": `console.log("MINE-MAIN-OK");`,
  "where.mjs": WHERE_MAIN,
  "slow.mjs": `await new Promise((r) => setTimeout(r, 60000));`,
  // Mentions the diff, so a clean tree proves nothing about it.
  "diffy.mjs": `const range = process.env.LAND_RANGE ?? "--cached"; void range; process.exit(1);`,
};
const GATES_BRANCH: Record<string, string> = {
  "mine.mjs": `console.log("MINE-BRANCH-RED"); process.exit(3);`,
  "where.mjs": `console.log("WHERE-BRANCH-RED"); process.exit(6);`,
  "slow.mjs": `process.exit(5);`,
  "newgate.mjs": `process.exit(2);`,
};
const line = (label: string, script: string): string => `echo "[pre-commit] ${label}…"\nnode scripts/${script} >"$GATE_LOG" || gate_failed\n`;

type Variant = { hook: string; probe: string };
type Run = { rc: number; out: string; secs: number };
type Fixture = { base: string; repo: string; wt: string; mainSha: string; slots: string; run: (gates: string, extra?: Record<string, string>, limitMs?: number) => Promise<Run>; worktrees: () => number };

function prepare(v: Variant): Fixture {
  const base = mkdtempSync(path.join(tmpdir(), "cit-main-probe-check-"));
  const repo = path.join(base, "repo");
  const wt = path.join(base, "wt");
  const slots = path.join(base, "slots");
  mkdirSync(path.join(repo, "scripts/lib"), { recursive: true });
  const git = (cwd: string, ...a: string[]): string => {
    const r = spawnSync("git", ["-C", cwd, "-c", "user.name=Kapu Gazda", "-c", "user.email=gazda@example.com", ...a], { env: cleanEnv(), encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  for (const [f, src] of Object.entries(GATES_MAIN)) writeFileSync(path.join(repo, "scripts", f), src);
  writeFileSync(path.join(repo, "scripts/lib/gate-runner.mjs"), runnerText);
  writeFileSync(path.join(repo, "scripts/lib/gate-ro-preload.mjs"), preloadText);
  writeFileSync(path.join(repo, "scripts/lib/main-probe.mjs"), probeText);
  writeFileSync(path.join(repo, ".gitignore"), ".env\nnode_modules\n");
  writeFileSync(path.join(repo, ".env"), "FIXTURE_ENV=1\n");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "main: a fixture kapui");
  const mainSha = git(repo, "rev-parse", "HEAD");
  git(repo, "update-ref", "refs/remotes/origin/main", mainSha);
  // The session tree is a WORKTREE (its `.git` is a file), on its own branch, one commit ahead.
  git(repo, "worktree", "add", "-q", "-b", "wt/fixture", wt);
  symlinkSync(path.join(repo, ".env"), path.join(wt, ".env"));
  for (const [f, src] of Object.entries(GATES_BRANCH)) writeFileSync(path.join(wt, "scripts", f), src);
  git(wt, "add", "-A", "scripts");
  git(wt, "commit", "-qm", "a session változása");
  // The variant under test is what the SESSION tree calls (untracked change is fine).
  writeFileSync(path.join(wt, "scripts/lib/main-probe.mjs"), v.probe);

  const run = (gates: string, extra: Record<string, string> = {}, limitMs = 60_000): Promise<Run> =>
    new Promise((resolve) => {
      const hook = `#!/usr/bin/env bash\nset -e\ncd ${JSON.stringify(wt)}\n${extractBlock(v.hook)}${gates}gate_flush\necho "[pre-commit] ✅ minden kapu zöld"\n`;
      writeFileSync(path.join(base, "hook"), hook);
      const env = { ...cleanEnv(), CIT_GATE_SLOTS: slots, CIT_GATE_WRITERS_FILE: path.join(base, "writers"), CIT_GATE_MAIN_PROBE_FETCH: "0", FIX_MAIN_SHA: mainSha, ...extra };
      const t0 = Date.now();
      const ch = spawn("bash", [path.join(base, "hook")], { cwd: wt, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
      let text = "";
      ch.stdout.on("data", (d) => (text += d));
      ch.stderr.on("data", (d) => (text += d));
      const timer = setTimeout(() => {
        try {
          process.kill(-ch.pid!, "SIGKILL");
        } catch {}
      }, limitMs);
      ch.on("close", (code) => {
        clearTimeout(timer);
        resolve({ rc: code ?? -1, out: text, secs: (Date.now() - t0) / 1000 });
      });
    });
  const worktrees = (): number => (git(repo, "worktree", "list", "--porcelain").match(/^worktree /gm) || []).length;
  return { base, repo, wt, mainSha, slots, run, worktrees };
}
function dispose(f: Fixture): void {
  spawnSync("pkill", ["-f", f.base], { stdio: "ignore" });
  spawnSync("git", ["-C", f.repo, "worktree", "prune"], { env: cleanEnv(), stdio: "ignore" });
  // Probe trees a mutant left behind live in the tmpdir, registered in the fixture repo.
  const list = spawnSync("git", ["-C", f.repo, "worktree", "list", "--porcelain"], { env: cleanEnv(), encoding: "utf8" }).stdout || "";
  for (const m of list.matchAll(/^worktree (.+)$/gm)) if (path.basename(m[1]).startsWith("cit-main-probe-")) rmSync(m[1], { recursive: true, force: true });
  rmSync(f.base, { recursive: true, force: true });
}

const NOT_YOURS = "EZ NEM A TE VÁLTOZÁSOD";
const YOURS = "A TE VÁLTOZÁSOD BUKIK";

async function audit(v: Variant): Promise<string[]> {
  const bad: string[] = [];
  const say = (ok: boolean, msg: string): void => {
    if (!ok) bad.push(msg);
  };
  const f = prepare(v);
  try {
    // ① red on main too → not yours, with the owner and main's output; the gate's code stays.
    const a = await f.run(line("red", "red.mjs"));
    say(a.rc === 4, `① a hook kilépési kódja ${a.rc} (4 várt: a kapué — a próba nem enged át)\n${a.out.slice(-1200)}`);
    say(a.out.includes(NOT_YOURS), `① a mainen is piros kapura nem mondta: „${NOT_YOURS}”\n${a.out.slice(-1200)}`);
    say(a.out.includes("Kapu Gazda") && a.out.includes("main: a fixture kapui"), "① nem nevezte meg a kapu fájljának utolsó main-commitját (gazda)");
    say((a.out.match(/RED-MAIN-OUT/g) || []).length >= 2, "① a mainen kapott kimenet (bizonyíték) nem jelent meg a próba ítéletében");
    say(!a.out.includes(YOURS), "① a mainen is piros kapura a session hibáját mondta");

    // ② red only in the diff → yours; main's version really ran.
    const b = await f.run(line("mine", "mine.mjs"));
    say(b.rc === 3, `② a hook kilépési kódja ${b.rc} (3 várt)`);
    say(b.out.includes(YOURS) && !b.out.includes(NOT_YOURS), `② a csak a diffben piros kapura nem „${YOURS}”-t mondott\n${b.out.slice(-1200)}`);

    // ③ the hook's GIT_DIR / GIT_INDEX_FILE must not reach the probe tree; .env is linked there.
    const gitDir = spawnSync("git", ["-C", f.wt, "rev-parse", "--absolute-git-dir"], { env: cleanEnv(), encoding: "utf8" }).stdout.trim();
    const idx = path.join(gitDir, "index");
    const idxBefore = readFileSync(idx);
    const c = await f.run(line("where", "where.mjs"), { GIT_DIR: gitDir, GIT_INDEX_FILE: idx, GIT_WORK_TREE: f.wt });
    say(c.rc === 6, `③ a hook kilépési kódja ${c.rc} (6 várt)\n${c.out.slice(-1200)}`);
    say(c.out.includes(YOURS), `③ örökölt GIT_DIR mellett a próba nem a main fáján futott, vagy nem látta a .env-et (${/WHERE-[A-Z-]+/.exec(c.out)?.[0] ?? "?"})\n${c.out.slice(-1200)}`);
    say(Buffer.compare(idxBefore, readFileSync(idx)) === 0, "③ a próba MEGVÁLTOZTATTA a commitoló fa indexét");

    // ④ land mode speaks too.
    const d = await f.run(line("red", "red.mjs"), { LAND_RANGE: "origin/main...HEAD" });
    say(d.rc === 4 && d.out.includes(NOT_YOURS), `④ land-módban (LAND_RANGE) nem szólt a próba (rc=${d.rc})`);

    // ⑤ a gate that does not exist on main yet → says so, decides nothing.
    const e = await f.run(line("new", "newgate.mjs"));
    say(e.rc === 2 && e.out.includes("MÉG NEM LÉTEZIK") && !e.out.includes(NOT_YOURS), `⑤ a mainen még nem létező kapunál nem ezt mondta (rc=${e.rc})`);

    // ⑥ a gate that reads the diff/mode → NOT DECIDED (a clean tree trivially passes it).
    const g = await f.run(line("diffy", "diffy.mjs"));
    say(g.rc === 1 && g.out.includes("NEM DÖNTÖTT") && !g.out.includes(YOURS) && !g.out.includes(NOT_YOURS), `⑥ a diffet olvasó kapunál ítéletet mondott (rc=${g.rc})`);

    // ⑦ time limit: a gate hanging on main is cut, and the probe says so.
    const h = await f.run(line("slow", "slow.mjs"), { CIT_GATE_MAIN_PROBE_TIMEOUT: "5" }, 45_000);
    say(h.rc === 5 && h.out.includes("időkorlát") && h.secs < 40, `⑦ az időkorlát nem fogott (rc=${h.rc}, ${h.secs.toFixed(0)} s)`);

    // ⑧ green → no probe; switched off → no probe.
    const i = await f.run(line("ok", "ok.mjs"));
    say(i.rc === 0 && !i.out.includes("TISZTA-MAIN PRÓBA"), `⑧ zöld futásnál is futott a próba (rc=${i.rc})`);
    const j = await f.run(line("red", "red.mjs"), { CIT_GATE_MAIN_PROBE: "0" });
    say(j.rc === 4 && !j.out.includes("TISZTA-MAIN PRÓBA"), `⑧ CIT_GATE_MAIN_PROBE=0 mellett is futott (rc=${j.rc})`);

    // ⑨ no probe worktree left behind (only the fixture repo and the session tree).
    say(f.worktrees() === 2, `⑨ a próba worktree-t hagyott maga után (${f.worktrees()} bejegyzés, 2 várt)`);
  } finally {
    dispose(f);
  }
  return bad;
}

function mutate(label: string, src: string, from: string, to: string): string {
  if (!src.includes(from)) {
    console.log(`⛔ AZ ÖNTESZT NEM TUDOTT VISSZARONTANI (${label}): a minta nincs meg — az őr nem a szállított alakot méri.`);
    process.exit(1);
  }
  return src.split(from).join(to);
}

const shipped: Variant = { hook: hookText, probe: probeText };

if (SELF_TEST) {
  const reds: [string, Variant][] = [
    ["a próba a session fájában fut", { ...shipped, probe: mutate("reroot", probeText, "return dir + s.slice(r.length);", "return s;") }],
    ["GIT_* szivárog", { ...shipped, probe: mutate("scrub", probeText, 'if (k.startsWith("GIT_") || k === "LAND_RANGE"', 'if (k === "LAND_RANGE"') }],
    ["nincs időkorlát", { ...shipped, probe: mutate("timeout", probeText, 'spawnSync("timeout", ["-k", "10", String(TIMEOUT), process.execPath, ', "spawnSync(process.execPath, [") }],
    ["a hook átengedi a commitot", { ...shipped, hook: mutate("exit", hookText, '"$first" || true\n  fi\n  exit "$last"', '"$first" || true\n  fi\n  exit 0') }],
    ["a mainen piros kaput zöldnek olvassa", { ...shipped, probe: mutate("verdict", probeText, "} else if (r.status === 0) {", "} else if (r.status === 0 || r.status === 3) {") }],
    ["a próba-fa ott marad", { ...shipped, probe: mutate("cleanup", probeText, "} finally {\n  cleanup();\n}", "} finally {\n}") }],
    ["a hook nem hívja a próbát", { ...shipped, hook: mutate("wire", hookText, "[ -f scripts/lib/main-probe.mjs ]", "[ -f scripts/lib/nincs-ilyen.mjs ]") }],
  ];
  let ok = true;
  for (const [name, v] of reds) {
    const bad = await audit(v);
    console.log(`${bad.length ? "✅ piros, ahogy kell" : "⛔ ZÖLD MARADT"} — ${name}${bad.length ? ` (${bad.length} sértés; első: ${bad[0].split("\n")[0]})` : ""}`);
    if (!bad.length) ok = false;
  }
  if (!ok) {
    console.log("⛔ main-probe-check ÖNTESZT: legalább egy visszarontás ZÖLD maradt — az őr vak rá.");
    process.exit(1);
  }
  console.log(`✅ main-probe-check önteszt: mind a ${reds.length} visszarontás pirosat adott.`);
  process.exit(0);
}

const bad = await audit(shipped);
if (bad.length) {
  console.log(`⛔ main-probe-check: ${bad.length} sértés`);
  for (const b of bad) console.log(`   · ${b}`);
  process.exit(1);
}
console.log("✅ main-probe-check: a tiszta-main próba mind a kilenc forgatókönyvben (①–⑨) a helyes gazdát nevezi meg, és a bukott commitot nem engedi át.");
