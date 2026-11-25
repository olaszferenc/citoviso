// GATE-SCOPE GUARD — the `// gate-scope: no-docs — <reason>` marker is a PROMISE, measured here (ADR-0480).
//
// WHY: 26 of 57 commits on main (2026-11-24/25) changed only MEMORY.md or _planning/**/*.md, and each
// still ran ~45 code gates at commit and again at land (~350 s of machine time, the six machine-wide
// gate slots held while other sessions waited). A gate whose code never reads a doc cannot change its
// verdict on such a diff, so the runner (scripts/lib/gate-runner.mjs, CIT_GATE_DOCS_ONLY) skips the
// gates that carry the marker — loudly, never as "green".
//
// WHAT IT CHECKS: every script under scripts/ whose first 40 lines carry the marker (with a reason of
// at least 20 characters, the runner's rule) is bundled with esbuild — its WHOLE static import closure,
// npm packages excluded, comments stripped — and the code must not mention any of:
//   _planning · MEMORY · a git command ("git" as a string, ls-files, git grep) · a glob library ·
//   a recursive directory walk (readdir/opendir/cp/walk … recursive).
// A hit = the promise is broken (or no longer provable) → red, naming the gate and the token. A gate
// that walks the tree by hand (readdir + recursion) is caught only by the audit that put the marker on
// it (2026-11-25: every walker of the marked gates starts at src/, scripts/, kb/, public/ or
// assets/design-refs/ — never at the repo root). Comments do not count: the bundle is whitespace-
// minified, which drops them (a "see _planning/…" comment is not a read).
//
//   npx tsx scripts/gate-scope-check.mts             # every marked gate
//   npx tsx scripts/gate-scope-check.mts --self-test # red test on a throwaway fixture

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSync } from "esbuild";

const MARK = "// gate-scope: no-docs —";
const BAN = /_planning|MEMORY|ls-files|git grep|globSync|fast-glob|["'`]git["'`\s]|(?:readdir|opendir|walk|cp)\w*\([^;]{0,160}recursive/g;

function marked(file: string): boolean {
  return readFileSync(file, "utf8")
    .split("\n", 40)
    .some((l) => l.trim().startsWith(MARK) && l.trim().slice(MARK.length).trim().length >= 20);
}

/** The banned tokens found in the comment-free code of the gate's import closure. */
function banned(file: string): string[] {
  const code = buildSync({
    entryPoints: [file],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    packages: "external",
    minifyWhitespace: true,
    minifySyntax: true,
    legalComments: "none",
    logLevel: "silent",
  }).outputFiles[0]!.text;
  return [...new Set(code.match(BAN) ?? [])].map((t) => t.slice(0, 40));
}

function checkAll(dir: string): { checked: number; bad: string[] } {
  const bad: string[] = [];
  let checked = 0;
  for (const f of readdirSync(dir).sort()) {
    if (!/\.(mts|mjs|ts)$/.test(f)) continue;
    const file = path.join(dir, f);
    if (!marked(file)) continue;
    checked++;
    let hits: string[];
    try {
      hits = banned(file);
    } catch (e) {
      bad.push(`${f}: a kód-zárlata nem bontható ki (${(e as Error).message.split("\n")[0]}) — a jelölés nem igazolható`);
      continue;
    }
    if (hits.length) bad.push(`${f}: a kód-zárlata dokumentumot olvashat (${hits.join(", ")})`);
  }
  return { checked, bad };
}

if (process.argv.includes("--self-test")) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "cit-gate-scope-"));
  let fail = 0;
  try {
    writeFileSync(path.join(tmp, "reader.ts"), `import { readFileSync } from "node:fs";\nexport const x = () => readFileSync("_planning/DECISIONS.md", "utf8");\n`);
    writeFileSync(path.join(tmp, "commented.ts"), `// see _planning/decisions/ and MEMORY.md for why\nexport const y = 1;\n`);
    writeFileSync(path.join(tmp, "walker.ts"), `import { readdirSync } from "node:fs";\nexport const z = () => readdirSync(".", { recursive: true });\n`);
    writeFileSync(path.join(tmp, "a-bad-check.mts"), `${MARK} a teszt kedvéért jelölt, de dokumentumot olvas\nimport { x } from "./reader.ts";\nx();\n`);
    writeFileSync(path.join(tmp, "b-walk-check.mts"), `${MARK} a teszt kedvéért jelölt, de a gyökeret bejárja\nimport { z } from "./walker.ts";\nz();\n`);
    writeFileSync(path.join(tmp, "c-ok-check.mts"), `${MARK} csak megjegyzésben említi a dokumentumot\nimport { y } from "./commented.ts";\nconsole.log(y);\n`);
    writeFileSync(path.join(tmp, "d-short-check.mts"), `${MARK} rövid\nimport { x } from "./reader.ts";\nx();\n`);
    const r = checkAll(tmp);
    const expect = (ok: boolean, what: string) => {
      console.log(`${ok ? "✓" : "✗"}  ${what}`);
      if (!ok) fail++;
    };
    expect(r.bad.some((b) => b.startsWith("a-bad-check.mts")), "a dokumentumot olvasó, jelölt kapu PIROS");
    expect(r.bad.some((b) => b.startsWith("b-walk-check.mts")), "a gyökeret rekurzívan bejáró, jelölt kapu PIROS");
    expect(!r.bad.some((b) => b.startsWith("c-ok-check.mts")), "a csak megjegyzésben említő kapu zöld (a megjegyzés nem olvasás)");
    expect(r.checked === 3, "az indoklás nélküli (rövid) jelölés nem számít jelölésnek");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (fail) {
    console.error(`⛔ gate-scope-check --self-test: ${fail} állítás bukott — az őr nem azt méri, amire való`);
    process.exit(1);
  }
  console.log("✅ gate-scope-check --self-test: a hamis no-docs jelölést elkapja, a megjegyzést nem bünteti.");
  process.exit(0);
}

const { checked, bad } = checkAll(path.resolve(process.cwd(), "scripts"));
if (bad.length) {
  console.error(`⛔ gate-scope-check: ${bad.length} kapu „no-docs” jelölése nem igaz vagy nem igazolható:`);
  for (const b of bad) console.error(`   · ${b}`);
  console.error("   Vedd le a jelölést (a kapu akkor dokumentum-változásra is fut), vagy szüntesd meg az olvasást.");
  process.exit(1);
}
console.log(`✅ gate-scope-check: mind a ${checked} „no-docs” jelölésű kapu kód-zárlata dokumentum-olvasás nélküli.`);
process.exit(0);
