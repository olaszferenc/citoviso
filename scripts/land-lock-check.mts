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
//   ③ STRUKTÚRA: a `land.sh` a zárat feltétel/kapcsoló nélkül veszi fel, a zár alatt ÚJRA fetchel a push
//      előtt, az előkör (ADR-XXXX) kapuit CSAK a `land_pregate_valid` igenjére (a zár alatti fetch után)
//      veszi érvényesnek, és a visszaellenőrzés („IGAZOLTAN FENT”) UTÁN engedi el.
//   ── visszarontások (mindnek PIROSNAK kell lennie, különben a zöld nem bizonyít semmit) ──
//   ④ a zár kivéve a könyvtárból (flock nélkül) → az ① átfedést lát.
//   ⑤ örökölt fd-s zár (`exec 9>>…; flock 9`) → a ② nem megy tovább az árva gyerek miatt.
//   ⑥ a `land.sh`-ból kivett `land_lock_acquire` sor, a zár alatti fetch, vagy a `land_pregate_valid` feltétel → a ③ piros.
//   ── a PUSH-ŐR (hooks/pre-push, ADR-0485) és a soros hotfix-merge (scripts/land-merge.sh) ──
//   ⑦ a VALÓDI hooks/pre-push egy eldobható origin-re: zár nélkül a mainre push ELUTASÍTVA (a main
//      nem mozdul); akkor sem, ha épp MÁS land tartja a zárat; a zártartó (land_lock_acquire) pushát átengedi;
//      másik ágra (hotfix/…) zár nélkül is enged.
//   ⑧ a VALÓDI scripts/land-merge.sh: a mainbe merge-el egy hotfix-ágat úgy, hogy a main FÁJA bájtra
//      változatlan, a hotfix-commit a main őse, a merge két szülős; másodszorra „nincs teendő”.
//   ⑨ visszarontás: a hook elutasítása kivéve (exit 0) → a ⑦ zár nélküli pusha átmegy → PIROS.
//   ── az OPTIMISTA ELŐKÖR (ADR-XXXX): a kapuk a zár ELŐTT futnak; a zár alatt csak akkor nem futnak újra,
//      ha a main és a HEAD pontosan az, amire futottak ──
//   ⑩ a VALÓDI land_pregate_valid: változatlan main+HEAD → érvényes; üres arg, elmozdult HEAD, elmozdult
//      main → érvénytelen. Visszarontás: mindig érvényes (return 0) → PIROS.
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
// ⑦–⑨: a throw-away origin and ONLY the real pre-push hook (never the real pre-commit: hooksPath
// points at a private copy dir).
const BARE = path.join(TMP, "origin.git");
git(TMP, "init", "-q", "--bare", BARE);
git(MAIN, "remote", "add", "origin", BARE);
git(MAIN, "push", "-q", "origin", "main");
const HOOKS = path.join(TMP, "hooks");
fs.mkdirSync(HOOKS);
const PRE_PUSH = path.join(ROOT, "hooks/pre-push");
const installHook = (text: string) => fs.writeFileSync(path.join(HOOKS, "pre-push"), text, { mode: 0o755 });
installHook(fs.readFileSync(PRE_PUSH, "utf8"));
git(MAIN, "config", "core.hooksPath", HOOKS);
git(MAIN, "config", "user.name", "t"); // land-merge.sh's commit-tree needs an identity
git(MAIN, "config", "user.email", "t@t");

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
  const push = idx(/^\s*elif ! git push origin HEAD:main; then$/);
  const fetch = lines.findIndex((l, i) => i > acq && /^git fetch origin \|\| fail /.test(l));
  const skip = idx(/land_pregate_valid "\$PRE_BASE" "\$PRE_HEAD"; then$/);
  const verified = idx(/IGAZOLTAN FENT/);
  const rel = lines.findIndex((l, i) => i > verified && /^\s*land_lock_release$/.test(l));
  if (src < 0) bad.push("③ a land.sh nem source-olja a scripts/land-lock.sh-t (felső szinten, feltétel nélkül)");
  if (acq < 0) bad.push("③ nincs feltétel nélküli `land_lock_acquire \"$ROOT\" || fail …` sor a land.sh felső szintjén");
  if (acq >= 0 && (fetch < 0 || push < 0 || !(acq < fetch && fetch < push)))
    bad.push("③ a zár alatt nincs friss `git fetch origin` a push ELŐTT (a push nem a zár alatt látott mainre épül)");
  // ADR-XXXX: the gates may be skipped under the lock ONLY through land_pregate_valid, after the in-lock fetch.
  if (skip < 0 || skip < fetch || skip > push) bad.push("③ az előkör érvényessége nem a zár alatti fetch után, `land_pregate_valid \"$PRE_BASE\" \"$PRE_HEAD\"`-dal dől el");
  if (/PREGATE_(FORCE|SKIP|TRUST)|CIT_LAND_TRUST/.test(text)) bad.push("③ kapcsoló, ami az előkört ellenőrzés nélkül érvényesnek venné");
  if (src >= 0 && acq >= 0 && src > acq) bad.push("③ a land_lock_acquire a source előtt áll");
  if (verified < 0 || rel < 0) bad.push("③ nincs `land_lock_release` a visszaellenőrzés („IGAZOLTAN FENT”) után");
  if (/LAND_LOCK_(SKIP|OFF|DISABLE)|NO_LAND_LOCK/.test(text)) bad.push("③ kikerülő kapcsoló a land.sh-ban");
  return bad;
}

// ⑦ the push guard — returns whether the unlocked push to main was REFUSED (used by ⑨ too)
function bareMain(): string {
  return git(BARE, "rev-parse", "refs/heads/main").trim();
}
function commitIn(dir: string, msg: string): string {
  git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", msg);
  return git(dir, "rev-parse", "HEAD").trim();
}
function pushRun(extraEnv: Record<string, string>, ...args: string[]) {
  return spawnSync("git", ["push", "-q", "origin", ...args], { cwd: WT, encoding: "utf8", env: { ...CHILD_ENV, ...extraEnv } });
}
async function pushGuard(record: boolean): Promise<boolean> {
  git(WT, "fetch", "-q", "origin");
  git(WT, "reset", "-q", "--hard", "origin/main");
  commitIn(WT, `work ${Date.now()}`);
  const before = bareMain();
  const r = pushRun({}, "HEAD:main");
  const refused = r.status !== 0 && bareMain() === before;
  if (!record) return refused;
  expect(refused, `⑦ zár nélkül a mainre push ÁTMENT (rc=${r.status}):\n${r.stderr}`);
  expect(/land-soron át/.test(r.stderr ?? ""), `⑦ az elutasítás nem mondja meg, merre (land.sh / land-merge.sh):\n${r.stderr}`);
  // Somebody else's land holds the lock (from the main tree) → a hand-made push from the worktree is still refused.
  const other = path.join(TMP, "other-holds.sh");
  fs.writeFileSync(other, `set -u\n. "$LOCKLIB"\nland_lock_acquire "$(git rev-parse --show-toplevel)" || exit 9\necho held >"$FLAG"\nsleep 3\n`);
  const flag = path.join(TMP, `held-${Date.now()}`);
  // Async on purpose: the holder must be REAPED when it ends (a zombie child of a blocked event loop
  // keeps `kill -0` true, and the lock would never free).
  const holderProc = spawn("bash", [other], { cwd: MAIN, env: { ...CHILD_ENV, LOCKLIB: LIB, FLAG: flag }, stdio: "ignore" });
  const holderDone = new Promise((res) => holderProc.on("exit", res));
  await until(() => fs.existsSync(flag), 10_000);
  const spoof = pushRun({}, "HEAD:main");
  await holderDone;
  expect(fs.existsSync(flag) && spoof.status !== 0 && bareMain() === before, `⑦ MÁS land tartja a zárat, és a kézi push mégis átment (rc=${spoof.status})`);
  const side = pushRun({}, "HEAD:refs/heads/hotfix/x");
  expect(side.status === 0, `⑦ másik ágra (hotfix/x) zár nélkül a push elutasítva (rc=${side.status}):\n${side.stderr}`);
  const locked = path.join(TMP, "locked-push.sh");
  fs.writeFileSync(locked, `set -u\n. "$LOCKLIB"\nland_lock_acquire "$(git rev-parse --show-toplevel)" || exit 9\ngit push -q origin HEAD:main\n`);
  const lr = spawnSync("bash", [locked], { cwd: WT, encoding: "utf8", env: { ...CHILD_ENV, LOCKLIB: LIB } });
  expect(lr.status === 0 && bareMain() === git(WT, "rev-parse", "HEAD").trim(), `⑦ a zártartó land pusha elutasítva (rc=${lr.status}):\n${lr.stdout}${lr.stderr}`);
  return refused;
}

// ⑩ land_pregate_valid — valid ONLY for (fetched origin/main, HEAD) exactly as the pre-pass left them.
function pregate(lib: string, record = true): boolean {
  git(WT, "fetch", "-q", "origin");
  git(WT, "reset", "-q", "--hard", "origin/main");
  commitIn(WT, `pre ${Date.now()}`);
  const base = git(WT, "rev-parse", "origin/main").trim();
  const head = git(WT, "rev-parse", "HEAD").trim();
  const run = (b: string, h: string) =>
    spawnSync("bash", ["-c", '. "$LOCKLIB"; land_pregate_valid "$B" "$H"'], { cwd: WT, env: { ...CHILD_ENV, LOCKLIB: lib, B: b, H: h } }).status === 0;
  const cases: [string, boolean][] = [];
  cases.push(["változatlan main + HEAD → érvényes", run(base, head) === true]);
  cases.push(["üres argumentum → érvénytelen", run("", head) === false && run(base, "") === false]);
  commitIn(WT, `head moved ${Date.now()}`);
  cases.push(["a HEAD elmozdult → érvénytelen", run(base, head) === false]);
  git(WT, "reset", "-q", "--hard", head);
  // main moves (another land) and the worktree fetches it under the lock
  commitIn(MAIN, `other land ${Date.now()}`);
  const mainLock = path.join(TMP, "locked-main-pre.sh");
  fs.writeFileSync(mainLock, `set -u\n. "$LOCKLIB"\nland_lock_acquire "$(git rev-parse --show-toplevel)" || exit 9\ngit push -q origin main\n`);
  spawnSync("bash", [mainLock], { cwd: MAIN, encoding: "utf8", env: { ...CHILD_ENV, LOCKLIB: LIB } });
  git(WT, "fetch", "-q", "origin");
  cases.push(["a main elmozdult → érvénytelen", run(base, head) === false]);
  const ok = cases.every(([, v]) => v);
  if (record) for (const [what, v] of cases) expect(v, `⑩ ${what}: NEM így mérte`);
  return ok;
}

// ⑧ the hotfix merge through the queue
function landMerge(): void {
  git(WT, "fetch", "-q", "origin");
  git(WT, "checkout", "-q", "-B", "hotfix", "origin/main~0");
  fs.writeFileSync(path.join(WT, "hotfix.txt"), "only on the hotfix line\n");
  git(WT, "add", "hotfix.txt");
  git(WT, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "hotfix");
  const hot = git(WT, "rev-parse", "HEAD").trim();
  git(WT, "push", "-q", "origin", "HEAD:refs/heads/hotfix/y");
  git(WT, "checkout", "-q", "wt");
  commitIn(MAIN, "main moves on");
  const mainLock = path.join(TMP, "locked-main.sh");
  fs.writeFileSync(mainLock, `set -u\n. "$LOCKLIB"\nland_lock_acquire "$(git rev-parse --show-toplevel)" || exit 9\ngit push -q origin main\n`);
  spawnSync("bash", [mainLock], { cwd: MAIN, encoding: "utf8", env: { ...CHILD_ENV, LOCKLIB: LIB } });
  const treeBefore = git(BARE, "rev-parse", "refs/heads/main^{tree}").trim();
  const lm = path.join(ROOT, "scripts/land-merge.sh");
  const r = spawnSync("bash", [lm, hot], { cwd: WT, encoding: "utf8", env: CHILD_ENV });
  const head = bareMain();
  const parents = git(BARE, "rev-list", "--parents", "-n1", head).trim().split(" ").length - 1;
  const contains = spawnSync("git", ["merge-base", "--is-ancestor", hot, head], { cwd: BARE, env: CHILD_ENV }).status === 0;
  expect(r.status === 0 && /IGAZOLTAN FENT/.test(r.stdout), `⑧ a land-merge.sh nem zárult igazoltan (rc=${r.status}):\n${r.stdout}${r.stderr}`);
  expect(contains, "⑧ a hotfix-commit nem őse a mainnek a land-merge után");
  expect(git(BARE, "rev-parse", "refs/heads/main^{tree}").trim() === treeBefore, "⑧ a land-merge MEGVÁLTOZTATTA a main tartalmát (a fa nem a régi)");
  expect(parents === 2, `⑧ a land-merge commitja nem két szülős (${parents})`);
  const again = spawnSync("bash", [lm, hot], { cwd: WT, encoding: "utf8", env: CHILD_ENV });
  expect(again.status === 0 && /nincs teendő/.test(again.stdout) && bareMain() === head, `⑧ a második land-merge nem „nincs teendő” (rc=${again.status}):\n${again.stdout}${again.stderr}`);
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
  const landTxt = fs.readFileSync(LAND, "utf8");
  const noLockFetch = landTxt.replace(/^(LOCK_T0=\$\(date \+%s\))\ngit fetch origin \|\| fail .*$/m, "$1");
  expect(noLockFetch !== landTxt && structure(noLockFetch).length > 0, "⑥ VISSZARONTÁS ZÖLD: a zár alatti fetch nélkül is átment a ③");
  const noPredicate = landTxt.replace(/land_pregate_valid "\$PRE_BASE" "\$PRE_HEAD"; then/, "true; then");
  expect(noPredicate !== landTxt && structure(noPredicate).length > 0, "⑥ VISSZARONTÁS ZÖLD: az előkör ellenőrzés nélküli elfogadásával is átment a ③");

  // ⑩ the optimistic pre-pass predicate on the REAL library, then its mutation (always valid) → red.
  expect(pregate(LIB), "⑩ a land_pregate_valid nem pontosan a változatlan main + változatlan HEAD esetén érvényes");
  const fnRe = /land_pregate_valid\(\) \{\n/;
  expect(fnRe.test(libText), "⑩ a visszarontás célsora (land_pregate_valid() {) nem található");
  const alwaysValid = path.join(TMP, "lib-pregate-always.sh");
  fs.writeFileSync(alwaysValid, libText.replace(fnRe, "land_pregate_valid() {\n  return 0\n"));
  expect(!pregate(alwaysValid, false), "⑩ VISSZARONTÁS ZÖLD: a mindig-érvényes előkört is elfogadta a mérés");

  await pushGuard(true);
  landMerge();
  // ⑨ the hook without its lock check
  const hookText = fs.readFileSync(PRE_PUSH, "utf8");
  const check = '} >&2\nexit 1\n';
  expect(hookText.includes(check), "⑨ a visszarontás célsora nem található a hooks/pre-push-ban");
  installHook(hookText.replace(check, "} >&2\nexit 0\n"));
  expect(!(await pushGuard(false)), "⑨ VISSZARONTÁS ZÖLD: zár-ellenőrzés nélkül is elutasította a hook a pusht");
  installHook(hookText);
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
console.log(`✅ land-lock-check: ${asserts} állítás zöld (sorosítás · halott zártartó · land.sh-struktúra · push-őr · land-merge · előkör · 7 visszarontás piros) — ${secs} s`);
