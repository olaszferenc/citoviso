// ⭐ A GÉPSZINTŰ LAND-SOR ŐRE (ADR-0275) — tényleg sorba állnak-e a landok, és elenged-e a halott land?
//
// Mérve 2026-09-29: egy land 45 perc falióra, három kör — a párhuzamos landok egymás pusht
// pattintották vissza, és minden kör a teljes kapusort futtatta újra. A javítás: a `land.sh`
// fetch→…→visszaellenőrzés szakasza egy repónként közös `flock` alatt fut (`scripts/land-lock.sh`).
//
// Az őr egy ELDOBHATÓ git-repóban (fő fa + egy worktree) a VALÓDI `scripts/land-lock.sh`-t futtatja
// egy kamu land-törzzsel (START/END sor egy naplóba, köztük alvás) — a teljes `land.sh`-t soha, mert az
// a fő fát frissíti és a szervereket újraindítja. Valódi kapusor nem fut; ~20 s.
//
// ── MIT MÉR ──────────────────────────────────────────────────────────────────────────────
//   ① SOROSÍTÁS: A a fő fából, B a worktree-ből, egyszerre → B megvárja A-t (START A · END A ·
//      START B · END B), UGYANAZT a zárfájlt látják (a közös git-dir alatt), és B várakozáskor
//      hangosan kiírja, ki tartja a zárat (A munkafája + PID-je).
//   ② A ZÁRTARTÓ HALÁLA: A-t `kill -9`-cel leöljük, miközben a gyereke (alvás) ÁRVÁN tovább él
//      → B ≤ 5 s alatt továbbmegy. (Egy örökölt fd-s zár az árva gyerek életéig zárva tartana.)
//   ③ STRUKTÚRA: a `land.sh` a zárat az ELSŐ `git fetch` ELŐTT veszi fel, feltétel/kapcsoló nélkül,
//      és a visszaellenőrzés („IGAZOLTAN FENT”) UTÁN engedi el.
//   ── visszarontások (mindnek PIROSNAK kell lennie, különben a zöld nem bizonyít semmit) ──
//   ④ a zár kivéve a könyvtárból (flock nélkül) → az ① átfedést lát.
//   ⑤ örökölt fd-s zár (`exec 9>>…; flock 9`) → a ② nem megy tovább az árva gyerek miatt.
//   ⑥ a `land.sh`-ból kivett `land_lock_acquire` sor → a ③ piros.
//
// ⛔ ÜRES HALMAZON MÉRNI HAMIS ZÖLD: a záró sor kiírja, hány állítás futott; nulla = bukás.
//
//   npx tsx scripts/land-lock-check.mts

import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const LIB = path.join(ROOT, "scripts/land-lock.sh");
const LAND = path.join(ROOT, "scripts/land.sh");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cit-landlock-"));

let asserts = 0;
const failures: string[] = [];
function expect(cond: boolean, what: string): boolean {
  asserts++;
  if (!cond) failures.push(what);
  return cond;
}

// ⛔ feedback_hook_guard_inherits_git_dir: a pre-commit hookban a git GIT_DIR-t exportál — a fixture
// gyerekei ezt NEM örökölhetik, különben a „teszt-repó" a valódi repó lenne. + tripwire.
const CHILD_ENV: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: CHILD_ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} (${cwd}): ${r.stdout}${r.stderr}`);
  return r.stdout;
}
function assertInsideTmp(dir: string) {
  const gd = git(dir, "rev-parse", "--path-format=absolute", "--git-common-dir").trim();
  if (!gd.startsWith(TMP + path.sep)) throw new Error(`TRIPWIRE: a fixture git-könyvtára (${gd}) NEM a ${TMP} alatt van`);
}

const MAIN = path.join(TMP, "main");
const WT = path.join(TMP, "wt");
fs.mkdirSync(MAIN);
git(MAIN, "init", "-q", "-b", "main");
assertInsideTmp(MAIN);
git(MAIN, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
git(MAIN, "worktree", "add", "-q", "-b", "wt", WT);
assertInsideTmp(WT);

// The fake land body: the real lock library, then START / (child) sleep / END into a shared log.
// The sleep runs as a CHILD (`& wait`) on purpose — ② kills the land shell and leaves it orphaned.
const FAKE = path.join(TMP, "fake-land.sh");
fs.writeFileSync(
  FAKE,
  `set -u
. "$LOCKLIB"
land_lock_acquire "$(git rev-parse --show-toplevel)" || exit 9
echo "START $ID" >>"$LOG"
sleep "$HOLD" &
echo $! >"$LOG.$ID.child"
wait $!
echo "END $ID" >>"$LOG"
`,
);

type Run = { p: ChildProcess; out: () => string; done: Promise<number> };
function land(cwd: string, id: string, hold: number, lib: string, log: string): Run {
  let out = "";
  const p = spawn("bash", [FAKE], { cwd, env: { ...CHILD_ENV, LOCKLIB: lib, ID: id, HOLD: String(hold), LOG: log } });
  p.stdout!.on("data", (d) => (out += d));
  p.stderr!.on("data", (d) => (out += d));
  const done = new Promise<number>((res) => p.on("exit", (c) => res(c ?? 128)));
  return { p, out: () => out, done };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const logOf = (log: string) => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : []);
async function until(pred: () => boolean, ms: number): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (pred()) return true;
    await sleep(100);
  }
  return pred();
}
function killChild(log: string, id: string) {
  const f = `${log}.${id}.child`;
  if (!fs.existsSync(f)) return;
  const pid = Number(fs.readFileSync(f, "utf8").trim());
  if (pid > 0) {
    try {
      process.kill(pid, "SIGKILL"); // by PID only — never a pattern kill
    } catch {}
  }
}

let logN = 0;
const newLog = () => path.join(TMP, `log${++logN}`);

// ① serialisation — returns whether the order was serialised (used by ④ too)
async function serialisation(lib: string, record: boolean): Promise<boolean> {
  const log = newLog();
  const a = land(MAIN, "A", 2, lib, log);
  const started = await until(() => logOf(log).includes("START A"), 10_000);
  const b = land(WT, "B", 0.2, lib, log);
  await Promise.all([a.done, b.done]);
  const order = logOf(log).join(" · ");
  const serial = order === "START A · END A · START B · END B";
  if (!record) return serial;
  expect(started, "① A nem indult el 10 s alatt");
  expect(serial, `① a két land NINCS sorosítva: ${order}`);
  const lockOf = (s: string) => /zár megszerezve .* — (\S+)$/m.exec(s)?.[1];
  const common = git(MAIN, "rev-parse", "--path-format=absolute", "--git-common-dir").trim();
  expect(!!lockOf(a.out()) && lockOf(a.out()) === lockOf(b.out()), `① a fő fa és a worktree NEM ugyanazt a zárfájlt látja (${lockOf(a.out())} / ${lockOf(b.out())})`);
  expect(lockOf(a.out()) === path.join(common, "cit-land.lock"), `① a zárfájl nem a közös git-dir alatt van: ${lockOf(a.out())}`);
  expect(/⏳ land-sor: VÁR — a zárat tartja: .*\/main · PID \d+/.test(b.out()), `① B várakozáskor nem írta ki a zártartót:\n${b.out()}`);
  expect(b.out().includes(`PID ${a.p.pid}`), `① a kiírt zártartó PID nem A-é (${a.p.pid}):\n${b.out()}`);
  return serial;
}

// ② the holder dies — returns whether B went on within 5 s (used by ⑤ too)
async function holderDeath(lib: string, record: boolean): Promise<boolean> {
  const log = newLog();
  const a = land(MAIN, "A", 30, lib, log);
  await until(() => logOf(log).includes("START A") && fs.existsSync(`${log}.A.child`), 10_000);
  const b = land(WT, "B", 0.1, lib, log);
  const waiting = await until(() => b.out().includes("VÁR"), 5_000);
  a.p.kill("SIGKILL");
  const orphanAlive = (() => {
    try {
      process.kill(Number(fs.readFileSync(`${log}.A.child`, "utf8").trim()), 0);
      return true;
    } catch {
      return false;
    }
  })();
  const went = await until(() => logOf(log).includes("START B"), 5_000);
  killChild(log, "A");
  if (!went) b.p.kill("SIGKILL");
  await b.done;
  if (record) {
    expect(waiting, `② B nem várakozott, amíg A élt:\n${b.out()}`);
    expect(orphanAlive, "② a kontroll nem éles: A árva gyereke nem élt a leölés után");
    expect(went, "② A leölése után B 5 s alatt sem ment tovább — a halott land bezár mindenkit");
  }
  return went;
}

// ③ structure of land.sh
function structure(text: string): string[] {
  const bad: string[] = [];
  const lines = text.split("\n");
  const idx = (re: RegExp) => lines.findIndex((l) => re.test(l));
  const src = idx(/^\. "\$ROOT\/scripts\/land-lock\.sh"$/);
  const acq = idx(/^land_lock_acquire "\$ROOT" \|\| fail /);
  const fetch = idx(/^\s*git fetch origin/);
  const verified = idx(/IGAZOLTAN FENT/);
  const rel = lines.findIndex((l, i) => i > verified && /^\s*land_lock_release$/.test(l));
  if (src < 0) bad.push("③ a land.sh nem source-olja a scripts/land-lock.sh-t (felső szinten, feltétel nélkül)");
  if (acq < 0) bad.push("③ nincs feltétel nélküli `land_lock_acquire \"$ROOT\" || fail …` sor a land.sh felső szintjén");
  if (acq >= 0 && (fetch < 0 || acq > fetch)) bad.push("③ a zár NEM az első `git fetch origin` előtt szerződik");
  if (src >= 0 && acq >= 0 && src > acq) bad.push("③ a land_lock_acquire a source előtt áll");
  if (verified < 0 || rel < 0) bad.push("③ nincs `land_lock_release` a visszaellenőrzés („IGAZOLTAN FENT”) után");
  if (/LAND_LOCK_(SKIP|OFF|DISABLE)|NO_LAND_LOCK/.test(text)) bad.push("③ kikerülő kapcsoló a land.sh-ban");
  return bad;
}

const t0 = Date.now();
try {
  await serialisation(LIB, true);
  await holderDeath(LIB, true);
  const s = structure(fs.readFileSync(LAND, "utf8"));
  expect(s.length === 0, s.join("\n"));

  // ④ no lock at all
  const libText = fs.readFileSync(LIB, "utf8");
  const noLock = path.join(TMP, "lib-nolock.sh");
  const flockLine = /flock -o "\$LAND_LOCK_FILE" sh -c/;
  expect(flockLine.test(libText), "④ a visszarontás célsora (flock -o …) nem található a könyvtárban");
  fs.writeFileSync(noLock, libText.replace(flockLine, "sh -c"));
  expect(!(await serialisation(noLock, false)), "④ VISSZARONTÁS ZÖLD: zár nélkül is sorosnak mérte az ①");

  // ⑤ inherited-fd lock: the orphaned child keeps it
  const fdLock = path.join(TMP, "lib-fdlock.sh");
  fs.writeFileSync(fdLock, libText.replace(flockLine, 'exec 9>>"$LAND_LOCK_FILE"; flock 9; sh -c'));
  expect(!(await holderDeath(fdLock, false)), "⑤ VISSZARONTÁS ZÖLD: az örökölt fd-s zárral is továbbment B az ②-ben");

  // ⑥ acquire removed from land.sh
  const landNoAcq = fs.readFileSync(LAND, "utf8").replace(/^land_lock_acquire .*$/m, "");
  expect(structure(landNoAcq).length > 0, "⑥ VISSZARONTÁS ZÖLD: land_lock_acquire nélkül is átment a ③");
} catch (e) {
  failures.push(`kivétel: ${(e as Error).stack ?? e}`);
} finally {
  try {
    git(MAIN, "worktree", "remove", "--force", WT);
  } catch {}
  fs.rmSync(TMP, { recursive: true, force: true });
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (asserts === 0) failures.push("0 állítás futott — üres mérés");
if (failures.length) {
  console.error(`⛔ land-lock-check: ${failures.length} bukás / ${asserts} állítás (${secs} s)`);
  for (const f of failures) console.error(`   ✗ ${f}`);
  process.exit(1);
}
console.log(`✅ land-lock-check: ${asserts} állítás zöld (sorosítás · halott zártartó · land.sh-struktúra · 3 visszarontás piros) — ${secs} s`);
