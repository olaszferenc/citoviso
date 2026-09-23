// ⭐⭐ A GENERÁLT INDEXEK LAND-ŐRE — a darabolt napló TÉNYLEG landol-e párhuzamos szálakkal?
//
// A `planning-index.mts` (ADR-fájlonként + generált index) csak akkor ér valamit, ha a land a
// generált indexek ütközését feloldja, MINDEN MÁST pedig ugyanúgy megállít, mint eddig. Ez az őr
// egy ELDOBHATÓ git-repóban (csupasz origin + klónok) a VALÓDI `scripts/land-rebase.sh`-t futtatja
// — a teljes `land.sh`-t soha, mert az a fő fát frissíti és a szervereket újraindítja.
//
// ── MIT MÉR ──────────────────────────────────────────────────────────────────────────────
//   ① KÉT SZÁL, KÉT ÚJ ADR + KÉT JEGYZET: a rebase feloldódik, mindkét ADR és mindkét jegyzet
//      az indexben, az index friss (a 2026-09-22-i három bukás mind ez az eset volt).
//   ② UGYANAZ A SZÁM KÉT SZÁLON: a git nem ütközik (külön fájlok!) — a kapu viszont BUKIK.
//   ③ RÉGI ALAKÚ SZERKESZTÉS: a migráció előtt indult szál a régi DECISIONS.md-ben módosít egy
//      ADR-t és újat fűz hozzá → mindkettő a SAJÁT fájljába kerül, idegen ADR érintetlen.
//   ④ RÉGI ALAKÚ + A MAIN IS MÓDOSÍTOTTA UGYANAZT: hangos megállás, a szál commitja érintetlen.
//   ⑤ IDEGEN ÜTKÖZÉS (forrásfájl): hangos megállás, mint eddig — a feloldó nem nyel el semmit.
//   ⑥ KÉZI SZERKESZTÉS a generált indexben: a `check --staged` bukik.
//   ⑦ NEGATÍV KONTROLL: a ③ átvétel kikapcsolva (PLANNING_INDEX_SABOTAGE=skip-adopt) a ③
//      állításainak PIROSRA kell menniük — különben a ③ zöldje nem bizonyít semmit.
//
// ⛔ ÜRES HALMAZON MÉRNI HAMIS ZÖLD: a záró sor kiírja, hány állítás futott; nulla = bukás.
//
//   npx tsx scripts/planning-index-land-check.mts

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const TOOL = path.join(ROOT, "scripts/planning-index.mts");
const LAND_REBASE = path.join(ROOT, "scripts/land-rebase.sh");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cit-planidx-"));
const ORIGIN = path.join(TMP, "origin.git");

let asserts = 0;
const failures: string[] = [];
function expect(cond: boolean, what: string): boolean {
  asserts++;
  if (!cond) failures.push(what);
  return cond;
}

// ⛔⛔ MÉRT KÁR (2026-09-23): a pre-commit hookban a git GIT_DIR-t és GIT_INDEX_FILE-t exportál.
// Az első változat ezeket továbbadta a fixture gyerek-folyamatainak, így a „teszt-repó" minden
// git-parancsa a VALÓDI repón futott: `git init --bare` → a KÖZÖS config `core.bare=true` (a fő fa
// és minden worktree), `git config user.*` → a közös identitás felülírva, és egy „legacy" commit a
// saját ágamon, a staged indexem helyén. Kézi futtatásban (nincs GIT_*) kétszer zöld volt.
// Ezért: (1) a gyerekek környezetéből MINDEN GIT_* változó kikerül; (2) minden írás előtt
// tripwire bizonyítja, hogy a git-könyvtár a fixture-ön BELÜL van (`assertInsideTmp`).
const CHILD_ENV: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));

function run(cwd: string, cmd: string, args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...CHILD_ENV, ...env } });
  return { status: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function assertInsideTmp(dir: string) {
  const gd = run(dir, "git", ["rev-parse", "--absolute-git-dir"]).out.trim();
  if (!gd.startsWith(TMP + path.sep)) {
    throw new Error(`TRIPWIRE: a fixture git-könyvtára (${gd}) NEM a ${TMP} alatt van — megállok, mielőtt bármit írnék`);
  }
}
function git(cwd: string, ...args: string[]): string {
  const r = run(cwd, "git", args);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} (${cwd}): ${r.out}`);
  return r.out;
}
const write = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (dir: string, rel: string) => (fs.existsSync(path.join(dir, rel)) ? fs.readFileSync(path.join(dir, rel), "utf8") : null);
const tool = (dir: string, ...args: string[]) => run(dir, "npx", ["tsx", "scripts/planning-index.mts", ...args]);
const landRebase = (dir: string, env: Record<string, string> = {}) => run(dir, "bash", [LAND_REBASE], env);
const inRebase = (dir: string) =>
  ["rebase-merge", "rebase-apply"].some((p) => fs.existsSync(path.resolve(dir, git(dir, "rev-parse", "--git-path", p).trim())));

let cloneN = 0;
function clone(ref = "main"): string {
  const dir = path.join(TMP, `c${++cloneN}`);
  git(TMP, "clone", "-q", "-b", ref, ORIGIN, dir);
  assertInsideTmp(dir);
  git(dir, "config", "user.email", "check@citoviso.invalid");
  git(dir, "config", "user.name", "planning-index-land-check");
  git(dir, "config", "core.hooksPath", "/dev/null");
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
  fs.appendFileSync(path.join(dir, ".git/info/exclude"), "node_modules\n");
  return dir;
}
function commitAll(dir: string, msg: string) {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", msg);
}

const PREAMBLE = "# DÖNTÉSI NAPLÓ (ADR) — teszt\n\n> preambulum\n\n---\n\n";
const block = (n: string, title: string, body: string) => `## ADR-${n} — ${title}\n\n${body}\n\n---\n\n`;
const LEGACY =
  PREAMBLE +
  block("0001", "Első döntés", "- egy") +
  block("0002", "Második döntés", "- kettő") +
  block("0003", "Harmadik döntés", "- három").replace(/\n\n---\n\n$/, "\n");

// ── Fixture: a legacy commit (single-file log, hand-written index), then the migration. ─────
function seed() {
  git(TMP, "init", "-q", "--bare", "-b", "main", ORIGIN);
  if (run(ORIGIN, "git", ["rev-parse", "--absolute-git-dir"]).out.trim() !== ORIGIN) throw new Error("TRIPWIRE: a csupasz origin nem a fixture-ben jött létre");
  const s = path.join(TMP, "seed");
  git(TMP, "init", "-q", "-b", "main", s);
  assertInsideTmp(s);
  git(s, "config", "user.email", "check@citoviso.invalid");
  git(s, "config", "user.name", "planning-index-land-check");
  write(s, "_planning/DECISIONS.md", LEGACY);
  write(s, "_planning/memory/2026-01-01_elso.md", "# Első jegyzet\n\ntartalom\n");
  write(s, "_planning/memory/INDEX.md", "# index\n- [2026-01-01_elso.md](2026-01-01_elso.md) — kézi sor\n");
  write(s, "src/app.ts", "export const x = 1;\n");
  commitAll(s, "legacy");
  git(s, "branch", "legacy-work");
  // Migration commit: the tool arrives WITH the migration, exactly as on the real main.
  fs.mkdirSync(path.join(s, "scripts"));
  fs.copyFileSync(TOOL, path.join(s, "scripts/planning-index.mts"));
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(s, "node_modules"));
  fs.appendFileSync(path.join(s, ".git/info/exclude"), "node_modules\n");
  const legacyCopy = path.join(TMP, "legacy.md");
  fs.writeFileSync(legacyCopy, LEGACY);
  if (tool(s, "split", legacyCopy).status !== 0 || tool(s, "build").status !== 0) throw new Error("fixture: split/build failed");
  expect(tool(s, "verify-split", legacyCopy).status === 0, "fixture: a migráció verify-split-je zöld");
  commitAll(s, "migrate");
  git(s, "remote", "add", "origin", ORIGIN);
  git(s, "push", "-q", "origin", "main", "legacy-work");
}

function addAdr(dir: string, n: string, title: string) {
  write(dir, `_planning/decisions/${n}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`, `## ADR-${n} — ${title}\n\n- tartalom ${n}\n`);
}

// ① two threads, two new ADRs and two new notes
function scenarioParallel() {
  const a = clone();
  const b = clone();
  addAdr(a, "0004", "Alfa szal");
  write(a, "_planning/memory/2026-02-01_alfa.md", "# Alfa jegyzet\n");
  tool(a, "build");
  commitAll(a, "alfa");
  git(a, "push", "-q", "origin", "main");
  addAdr(b, "0005", "Beta szal");
  write(b, "_planning/memory/2026-02-02_beta.md", "# Beta jegyzet\n");
  tool(b, "build");
  commitAll(b, "beta");
  git(b, "fetch", "-q", "origin");
  const r = landRebase(b);
  expect(r.status === 0, `① a land-rebase feloldja a két index ütközését (rc=${r.status}: ${r.out.slice(-300)})`);
  expect(!inRebase(b), "① nincs félbemaradt rebase");
  const dec = read(b, "_planning/DECISIONS.md") ?? "";
  expect(dec.includes("ADR-0004") && dec.includes("ADR-0005"), "① mindkét új ADR az indexben");
  const idx = read(b, "_planning/memory/INDEX.md") ?? "";
  expect(idx.includes("Alfa jegyzet") && idx.includes("Beta jegyzet"), "① mindkét új jegyzet a memória-indexben");
  expect(!/^(<{7}|={7}|>{7})/m.test(dec + idx), "① nincs konfliktus-jelölő a generált fájlokban");
  expect(tool(b, "check").status === 0, "① a check zöld a feloldás után");
}

// ② the same number on two threads: git is silent — the gate must not be
function scenarioDuplicate() {
  const a = clone();
  const b = clone();
  addAdr(a, "0006", "Egyik");
  tool(a, "build");
  commitAll(a, "egyik");
  git(a, "push", "-q", "origin", "main");
  addAdr(b, "0006", "Masik");
  tool(b, "build");
  commitAll(b, "masik");
  git(b, "fetch", "-q", "origin");
  landRebase(b);
  const c = tool(b, "check");
  expect(c.status !== 0 && c.out.includes("DUPLIKÁLT ADR-SZÁM: ADR-0006"), `② a duplikált 0006-ot a check megfogja (rc=${c.status})`);
  // `b` never pushes: the duplicate stays in this clone, origin keeps only a's 0006.
}

// ③ a legacy-format edit replayed onto the migrated main
function scenarioLegacyAdopt(sabotage: boolean): boolean[] {
  const l = clone("legacy-work");
  const legacy = read(l, "_planning/DECISIONS.md")!;
  write(
    l,
    "_planning/DECISIONS.md",
    legacy.replace("- kettő", "- kettő\n- ÚJ SOR A RÉGI FÁBÓL") + "\n---\n\n## ADR-0009 — Regi faban irt uj dontes\n\n- kilenc\n",
  );
  commitAll(l, "legacy edit");
  git(l, "fetch", "-q", "origin");
  const r = landRebase(l, sabotage ? { PLANNING_INDEX_SABOTAGE: "skip-adopt" } : {});
  const f2 = fs.readdirSync(path.join(l, "_planning/decisions")).find((f) => f.startsWith("0002-"));
  const f1 = fs.readdirSync(path.join(l, "_planning/decisions")).find((f) => f.startsWith("0001-"));
  return [
    r.status === 0,
    Boolean(f2 && read(l, `_planning/decisions/${f2}`)!.includes("ÚJ SOR A RÉGI FÁBÓL")),
    fs.readdirSync(path.join(l, "_planning/decisions")).some((f) => f.startsWith("0009-")),
    Boolean(f1 && read(l, `_planning/decisions/${f1}`) === "## ADR-0001 — Első döntés\n\n- egy\n"),
    tool(l, "check").status === 0,
  ];
}

// ④ legacy edit of an ADR that main ALSO changed after the migration
function scenarioLegacyBothChanged() {
  const m = clone();
  const f3 = fs.readdirSync(path.join(m, "_planning/decisions")).find((f) => f.startsWith("0003-"))!;
  write(m, `_planning/decisions/${f3}`, read(m, `_planning/decisions/${f3}`)!.replace("- három", "- három (a mainen javítva)"));
  tool(m, "build");
  commitAll(m, "main edits 0003");
  git(m, "push", "-q", "origin", "main");
  const l = clone("legacy-work");
  write(l, "_planning/DECISIONS.md", read(l, "_planning/DECISIONS.md")!.replace("- három", "- három (a régi fában javítva)"));
  commitAll(l, "legacy edits 0003");
  const before = git(l, "rev-parse", "HEAD").trim();
  git(l, "fetch", "-q", "origin");
  const r = landRebase(l);
  expect(r.status !== 0, `④ mindkét oldal módosította az ADR-0003-at → HANGOS megállás (rc=${r.status})`);
  expect(r.out.includes("ADR-0003") && r.out.includes("kézi összefésülés"), "④ a megállás megnevezi az ADR-t és a teendőt");
  expect(!inRebase(l), "④ a rebase megszakítva, nem félbehagyva");
  expect(git(l, "rev-parse", "HEAD").trim() === before, "④ a szál commitja érintetlen (semmi nem veszett el)");
}

// ⑤ a conflict outside the generated files still stops the land
function scenarioForeignConflict() {
  const a = clone();
  const b = clone();
  write(a, "src/app.ts", "export const x = 2;\n");
  addAdr(a, "0010", "Tiz");
  tool(a, "build");
  commitAll(a, "a");
  git(a, "push", "-q", "origin", "main");
  write(b, "src/app.ts", "export const x = 3;\n");
  addAdr(b, "0011", "Tizenegy");
  tool(b, "build");
  commitAll(b, "b");
  const before = git(b, "rev-parse", "HEAD").trim();
  git(b, "fetch", "-q", "origin");
  const r = landRebase(b);
  expect(r.status !== 0, `⑤ forrásfájl-ütközésnél a land-rebase bukik (rc=${r.status})`);
  expect(!inRebase(b) && git(b, "rev-parse", "HEAD").trim() === before, "⑤ a rebase megszakítva, a commit érintetlen");
}

// ⑥ a hand edit of a generated index is caught at commit time
function scenarioHandEdit() {
  const a = clone();
  fs.appendFileSync(path.join(a, "_planning/memory/INDEX.md"), "- [kézi.md](kézi.md) — kézzel fűzve\n");
  git(a, "add", "-A");
  const c = tool(a, "check", "--staged");
  expect(c.status !== 0 && c.out.includes("INDEX.md ELAVULT"), "⑥ a kézzel fűzött index-sort a check --staged megfogja");
  git(a, "reset", "-q", "--hard");
  write(a, "_planning/DECISIONS.md", read(a, "_planning/DECISIONS.md") + "\n## ADR-0099 — kézzel a régi helyre\n");
  git(a, "add", "-A");
  const d = tool(a, "check", "--staged");
  expect(d.status !== 0 && d.out.includes("DECISIONS.md ELAVULT"), "⑥ a DECISIONS.md-be kézzel írt ADR-t a check --staged megfogja");
}

try {
  seed();
  scenarioParallel();
  scenarioDuplicate();
  // ③ runs on a main that carries the ② duplicate; its assertions do not depend on it.
  const good = scenarioLegacyAdopt(false);
  const names = [
    "③ a régi alakú szerkesztés feloldódik",
    "③ az ADR-0002 módosítása a SAJÁT fájljába került",
    "③ a régi fában írt új ADR-0009 saját fájlt kapott",
    "③ az idegen ADR-0001 bájtra érintetlen",
    "③ a generált index friss",
  ];
  good.forEach((ok, i) => expect(ok, names[i]));
  // ⑦ negative control: with the adoption switched off, the edit must be LOST — i.e. ③'s
  // content assertions must go red. If they stay green, ③ proves nothing.
  const bad = scenarioLegacyAdopt(true);
  expect(!bad[1] && !bad[2], "⑦ NEGATÍV KONTROLL: átvétel nélkül a ③ tartalmi állításai PIROSAK (a ③ zöldje valódi)");
  scenarioLegacyBothChanged();
  scenarioForeignConflict();
  scenarioHandEdit();
} catch (e) {
  failures.push(`a forgatókönyv elszállt: ${(e as Error).message}`);
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}

if (asserts === 0) failures.push("NULLA állítás futott — üres halmazon a zöld hamis");
if (failures.length) {
  console.error(`⛔ planning-index-land-check: ${failures.length} bukás ${asserts} állításból`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(`planning-index-land-check: ✅ ${asserts} állítás zöld (párhuzamos ADR · duplikátum · régi alak · ütközés · kézi szerkesztés · negatív kontroll)`);
