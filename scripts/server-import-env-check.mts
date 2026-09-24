// SZERVER-IMPORT KÖRNYEZET ŐR — egy őr se indítsa el a szerver boot-mellékhatását.
//
// MIT VÉD. A `src/console/server.ts` és a `src/server/public.ts` IMPORTJA nem ártatlan:
// a modul betöltésekor (1) a valódi portra hallgat (:4600 / :4800), és (2) elindít egy
// háttér `ensureAllLanguagePacks()` feltöltést, ami a KÖZÖS `language_pack` /
// `kb_translation` táblákat írja ENNEK a munkafának a magyar forrásából, és az
// Anthropic API-t hívja. Mindkettőt egy-egy env-kapcsoló tiltja: `CIT_SHOT=1` a
// mellékhatást, `CONSOLE_PORT=0` / `PUBLIC_PORT=0` a fix portot.
//
// ~10 párhuzamos munkafa → egy CIT_SHOT nélküli őr (a `consent-check` MINDEN commiton
// futott így) egy 650 committal lemaradt fa szövegeit írta a közös csomagokba, és
// fizetett AI-hívást indított egy pre-commitból.
//
// ⚠️ A CSAPDA: az ESM static `import` a fájl TETEJÉRE emelkedik, tehát egy utána álló
// `process.env.CIT_SHOT = "1"` sor KÉSŐN fut (memória: „env assignment loses to ESM
// imports" — egy mock-kapcsoló így küldött VALÓDI levelet). Ezért a szabály:
//
//   (a) a `hooks/pre-commit` hívó sora állítja be MINDKETTŐT
//       (`CIT_SHOT=1 CONSOLE_PORT=0 npx tsx scripts/x.mts`), VAGY
//   (b) a script maga állítja be mindkettőt (`process.env.CIT_SHOT = "1"` és
//       `process.env.<SZERVER>_PORT = "0"`, `??=` is jó) a DINAMIKUS `await import(...)`
//       ELŐTT — static importtal a (b) nem teljesülhet.
//
// A forrás-OLVASÓ őrök (`readFileSync("src/server/public.ts")`) nem importálnak, ezért
// nem lelet. A komment nem számít: csak kód.
//
//   npx tsx scripts/server-import-env-check.mts [--self-test]

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");

let pass = 0;
const fails: string[] = [];
function check(ok: boolean, name: string, detail = ""): void {
  if (ok) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

type ServerKind = "console" | "public";
const PORT_VAR: Record<ServerKind, string> = { console: "CONSOLE_PORT", public: "PUBLIC_PORT" };
const MODULE_PATH: Record<ServerKind, string> = { console: "console/server", public: "server/public" };

/** A comment may narrate the rule; only code counts. Line structure is kept. */
function codeOf(src: string): string {
  return src
    .split("\n")
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l))
    .join("\n");
}

/** Index of the first static import of the server module, or -1. */
function staticImportIndex(code: string, kind: ServerKind): number {
  const re = new RegExp(`^\\s*import\\s[^;]*?from\\s+["'][./]*src/${MODULE_PATH[kind]}\\.js["']`, "m");
  const m = re.exec(code);
  return m ? m.index : -1;
}

/** Index of the first dynamic `import("…/src/<server>.js")`, or -1. */
function dynamicImportIndex(code: string, kind: ServerKind): number {
  const re = new RegExp(`import\\(\\s*["'][./]*src/${MODULE_PATH[kind]}\\.js["']\\s*\\)`);
  const m = re.exec(code);
  return m ? m.index : -1;
}

/** Index of `process.env.<VAR> = "<value>"` (or `??=`), or -1. */
function envAssignIndex(code: string, name: string, value: string): number {
  const re = new RegExp(`process\\.env\\.${name}\\s*(\\?\\?)?=\\s*["'\`]${value}["'\`]`);
  const m = re.exec(code);
  return m ? m.index : -1;
}

/** Does the pre-commit hook invoke this script with BOTH variables on the command line? */
function hookSetsEnv(hookSrc: string, scriptRel: string, kind: ServerKind): boolean {
  const esc = scriptRel.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  for (const line of hookSrc.split("\n")) {
    if (!new RegExp(`npx\\s+tsx\\s+${esc}(\\s|$)`).test(line)) continue;
    const prefix = line.slice(0, line.indexOf("npx"));
    if (/\bCIT_SHOT=1\b/.test(prefix) && new RegExp(`\\b${PORT_VAR[kind]}=0\\b`).test(prefix)) return true;
  }
  return false;
}

export interface Finding {
  readonly file: string;
  readonly kind: ServerKind;
  readonly reason: string;
}

/** Findings for one script (absolute path). Empty when it is clean or imports nothing. */
export function analyzeFile(absFile: string, hookSrc: string, scriptRel = path.relative(ROOT, absFile)): Finding[] {
  const code = codeOf(readFileSync(absFile, "utf8"));
  const out: Finding[] = [];
  for (const kind of ["console", "public"] as const) {
    const stat = staticImportIndex(code, kind);
    const dyn = dynamicImportIndex(code, kind);
    if (stat < 0 && dyn < 0) continue;
    if (hookSetsEnv(hookSrc, scriptRel, kind)) continue; // (a)
    const portVar = PORT_VAR[kind];
    if (stat >= 0) {
      out.push({ file: scriptRel, kind, reason: `STATIC import (${MODULE_PATH[kind]}.js) — az env csak a hook hívó során állítható (CIT_SHOT=1 ${portVar}=0), vagy tedd dinamikussá` });
      continue;
    }
    const shot = envAssignIndex(code, "CIT_SHOT", "1");
    const port = envAssignIndex(code, portVar, "0");
    const missing: string[] = [];
    if (shot < 0) missing.push(`process.env.CIT_SHOT = "1" hiányzik`);
    else if (shot > dyn) missing.push(`process.env.CIT_SHOT = "1" a dinamikus import UTÁN áll`);
    if (port < 0) missing.push(`process.env.${portVar} = "0" hiányzik`);
    else if (port > dyn) missing.push(`process.env.${portVar} = "0" a dinamikus import UTÁN áll`);
    if (missing.length) out.push({ file: scriptRel, kind, reason: missing.join("; ") });
  }
  return out;
}

export function findings(): { scanned: number; importing: number; bad: Finding[] } {
  const hookSrc = readFileSync(path.join(ROOT, "hooks/pre-commit"), "utf8");
  const dir = path.join(ROOT, "scripts");
  const files = readdirSync(dir).filter((f) => /-check\.mts$/.test(f) && f !== "server-import-env-check.mts");
  const bad: Finding[] = [];
  let importing = 0;
  for (const f of files) {
    const abs = path.join(dir, f);
    const code = codeOf(readFileSync(abs, "utf8"));
    if (staticImportIndex(code, "console") >= 0 || dynamicImportIndex(code, "console") >= 0 || staticImportIndex(code, "public") >= 0 || dynamicImportIndex(code, "public") >= 0) importing++;
    bad.push(...analyzeFile(abs, hookSrc));
  }
  return { scanned: files.length, importing, bad };
}

const r = findings();
check(
  r.bad.length === 0,
  "minden szerver-importáló őr CIT_SHOT=1 + <SZERVER>_PORT=0 mellett tölti be a szervert",
  r.bad.map((b) => `${b.file} [${b.kind}]: ${b.reason}`).join(" · "),
);
console.log(`szerver-import env: ${r.scanned} őr átnézve · ${r.importing} importál szervert · ${r.bad.length} sértés`);

if (SELF_TEST) {
  console.log("\n── piros önteszt (session-privát tmp fixture, NEM a scripts/ alatt) ──");
  const tmp = mkdtempSync(path.join(os.tmpdir(), "cit-server-import-env-"));
  const fixture = (name: string, src: string): string => {
    const p = path.join(tmp, name);
    writeFileSync(p, src, "utf8");
    return p;
  };
  const hookNone = 'npx tsx scripts/fake-check.mts >"$GATE_LOG" || gate_failed\n';
  const hookBoth = 'CIT_SHOT=1 PUBLIC_PORT=0 npx tsx scripts/fake-check.mts >"$GATE_LOG" || gate_failed\n';
  const hookHalf = 'CIT_SHOT=1 npx tsx scripts/fake-check.mts >"$GATE_LOG" || gate_failed\n';
  const REL = "scripts/fake-check.mts";
  const red = (p: string, hook: string): boolean => analyzeFile(p, hook, REL).length > 0;
  try {
    const cases: [string, () => boolean][] = [
      [
        "a STATIC import env nélkül (a consent-check eredeti alakja) megbukik",
        () => red(fixture("a.mts", 'import { server } from "../src/server/public.js";\nawait new Promise((r) => server.listen(0, r));\n'), hookNone),
      ],
      [
        "a dinamikus import CIT_SHOT nélkül (a verdict-dialog eredeti alakja) megbukik",
        () => red(fixture("b.mts", 'process.env.CONSOLE_PORT = "0";\nconst { server } = await import("../src/console/server.js");\n'), hookNone),
      ],
      [
        "az env a dinamikus import UTÁN késő — megbukik",
        () => red(fixture("c.mts", 'const { server } = await import("../src/server/public.js");\nprocess.env.CIT_SHOT = "1";\nprocess.env.PUBLIC_PORT = "0";\n'), hookNone),
      ],
      [
        "a kommentben elmondott env nem számít — megbukik",
        () => red(fixture("d.mts", '// process.env.CIT_SHOT = "1"; process.env.PUBLIC_PORT = "0";\nconst { server } = await import("../src/server/public.js");\n'), hookNone),
      ],
      [
        "a hook csak az egyik változót adja (fél megoldás) — megbukik",
        () => red(fixture("e.mts", 'import { server } from "../src/server/public.js";\n'), hookHalf),
      ],
      [
        "(kontroll) env ELŐBB, dinamikus import UTÁNA — nem lelet",
        () => !red(fixture("f.mts", 'process.env.CIT_SHOT = "1";\nprocess.env.PUBLIC_PORT ??= "0";\nconst { server } = (await import("../src/server/public.js")) as { server: unknown };\n'), hookNone),
      ],
      [
        "(kontroll) static import, de a hook sora mindkét változót adja — nem lelet",
        () => !red(fixture("g.mts", 'import { server } from "../src/server/public.js";\n'), hookBoth),
      ],
      [
        "(kontroll) aki csak a szerver FORRÁSÁT olvassa, nem importál — nem lelet",
        () => !red(fixture("h.mts", 'const src = readFileSync("src/server/public.ts", "utf8");\n'), hookNone),
      ],
      [
        "(kontroll) a konzol-port nem helyettesíti a publikus portot — megbukik",
        () => red(fixture("i.mts", 'process.env.CIT_SHOT = "1";\nprocess.env.CONSOLE_PORT = "0";\nconst { server } = await import("../src/server/public.js");\n'), hookNone),
      ],
    ];
    let selfFail = 0;
    for (const [name, fn] of cases) {
      const ok = fn();
      if (!ok) selfFail++;
      console.log(`${ok ? "  ✓" : "  ✗"} ${name}`);
    }
    if (selfFail) {
      console.error(`\n⛔ ÖNELLENŐRZÉS BUKOTT: ${selfFail} eset — az őr nem méri, amit állít.`);
      process.exit(1);
    }
    console.log("\n✅ önellenőrzés: az őr PIROSRA megy a bejelentett alakokon, és zöld a kontrollokon.");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (fails.length) {
  console.error(`\n⛔ server-import-env-check: ${fails.length} bukás`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`✅ server-import-env-check: ${pass} állítás zöld`);
