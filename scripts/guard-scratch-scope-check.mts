// SCRATCH-HATÓKÖR ŐR — egy őr ne törölje ki a másik session fixture-jét.
//
// MIT VÉD. Az `assets/Temp` egy SYMLINK a fő fába (`~/citoviso/assets/Temp`), tehát
// MINDEN párhuzamos munkafa ugyanoda ír. Több böngésző-hajtott őr ide teszi a saját
// HTML-fixture-jét, és a futás VÉGÉN `rm -rf`-eli a könyvtárát. Két session egyszerre
// → amelyik előbb végez, kitörli a másik alól a fájlokat.
//
// Mérve 2026-09-15: a `lead-page-surface-check` pont így szállt el nálam —
// `navigating to …/_leadsurface/artdeco.html` hibával, a lap megnyitásán, miközben a
// `wt/leadlistalap` session ugyanazt az őrt futtatta. ⛔ A piros ilyenkor NEM a
// termékről szól, hanem rólunk: egy tiszta futás ugyanott 209 zöld / 0 piros lett.
// Ez a legrosszabb fajta piros — a következő ember a TERMÉKET kezdi keresgélni.
//
// A leletem ÖT őrt talált ebben az állapotban (lead-page-surface · configurator-float ·
// mock-form-honesty · pricing-sample · prospect-framing), és MIND AZ ÖT be van kötve a
// `hooks/pre-commit`-be — vagyis ~16 párhuzamos szálnál véletlenszerűen ölték egymás
// commitjait. A bejelentett eset egy volt az ötből.
//
// A SZABÁLY: ha egy script az `assets/Temp` alá ír ÉS törölni is tud ott, akkor az
// útjának munkafa-egyedi kulcsot (`SCOPE`) kell viselnie.
//
//   npx tsx scripts/guard-scratch-scope-check.mts [--self-test]

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");

let pass = 0;
const fails: string[] = [];
function check(ok: boolean, name: string, detail = ""): void {
  if (ok) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/** A comment may NARRATE this bug; only code counts (the drift-guard lesson). */
function codeOf(src: string): string {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
}

/** Does the file delete anything? `rm(...)`, `rmSync(...)`, `rmdir(...)`. */
function deletes(code: string): boolean {
  return /\b(rm|rmSync|rmdir|rmdirSync)\s*\(/.test(code);
}

/** Every `assets/Temp/<something>` path written in the file. */
function tempPaths(code: string): string[] {
  return [...code.matchAll(/assets\/Temp\/([^"'`\s)]*)/g)].map((m) => m[1] ?? "").filter(Boolean);
}

/** The worktree-unique key. Anything derived from the repo directory counts. */
function hasScopeKey(code: string, p: string): boolean {
  return /\$\{SCOPE\}/.test(p) && /const\s+SCOPE\s*=/.test(code);
}

export interface Offender {
  readonly file: string;
  readonly paths: readonly string[];
}

export function offenders(extra?: { file: string; src: string }): Offender[] {
  const out: Offender[] = [];
  const dir = path.join(ROOT, "scripts");
  const files = readdirSync(dir).filter((f) => /\.(mts|ts)$/.test(f));
  if (extra && !files.includes(path.basename(extra.file))) files.push(path.basename(extra.file));
  for (const f of files) {
    const rel = `scripts/${f}`;
    if (rel === "scripts/guard-scratch-scope-check.mts") continue;
    const src =
      extra && path.basename(extra.file) === f ? extra.src : readFileSync(path.join(dir, f), "utf8");
    const code = codeOf(src);
    if (!code.includes("assets/Temp")) continue;
    if (!deletes(code)) continue; // writes only — a collision overwrites, it does not delete
    const bad = tempPaths(code).filter((p) => !hasScopeKey(code, p));
    if (bad.length) out.push({ file: rel, paths: [...new Set(bad)] });
  }
  return out;
}

const bad = offenders();
check(
  bad.length === 0,
  "minden TÖRLŐ őr munkafa-egyedi scratch-be ír",
  bad.map((b) => `${b.file} → ${b.paths.join(", ")}`).join(" · "),
);
console.log(
  `scratch-hatókör: ${readdirSync(path.join(ROOT, "scripts")).filter((f) => /\.(mts|ts)$/.test(f)).length} script átnézve · ${bad.length} sértés`,
);

if (SELF_TEST) {
  console.log("\n── piros önteszt ──");
  const reds: [string, () => boolean][] = [
    [
      "a KÖZÖS scratch + törlés megbukna (a bejelentett alak)",
      () =>
        offenders({
          file: "scripts/fake-check.mts",
          src: 'const OUT = path.resolve(d, "../assets/Temp/_fake");\nawait rm(OUT, { recursive: true });',
        }).some((o) => o.file === "scripts/fake-check.mts"),
    ],
    [
      "(kontroll) a HATÓKÖRÖZÖTT alak nem lelet",
      () =>
        !offenders({
          file: "scripts/fake-check.mts",
          src:
            'const SCOPE = path.basename(x);\nconst OUT = path.resolve(d, `../assets/Temp/_fake-${SCOPE}`);\nawait rm(OUT, { recursive: true });',
        }).some((o) => o.file === "scripts/fake-check.mts"),
    ],
    [
      "(kontroll) aki csak ÍR és nem töröl, nem lelet",
      () =>
        !offenders({
          file: "scripts/fake-check.mts",
          src: 'await writeFile(path.resolve(d, "../assets/Temp/kep.png"), buf);',
        }).some((o) => o.file === "scripts/fake-check.mts"),
    ],
    [
      "(kontroll) a hibát IDÉZŐ komment nem lelet",
      () =>
        !offenders({
          file: "scripts/fake-check.mts",
          src: '// régen: rm("../assets/Temp/_fake") — lásd guard-scratch-scope-check.',
        }).some((o) => o.file === "scripts/fake-check.mts"),
    ],
  ];
  let red = 0;
  for (const [name, fn] of reds) {
    const ok = fn();
    console.log(`  ${ok ? "🔴 elkapva" : "⚪ ÁTENGEDVE"} — ${name}`);
    if (ok) red++;
    else fails.push(`ÖNTESZT nem ment pirosra: ${name}`);
  }
  console.log(`önteszt: ${red}/${reds.length}`);
}

console.log(`\n${fails.length ? "❌" : "✅"} guard-scratch-scope-check: ${pass} állítás zöld, ${fails.length} piros`);
for (const f of fails) console.error(`  ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
