// §B.18 i18n doctrine guard (ADR-0036): customer-facing sources must read every UI string
// from the language pack (T()/tr()) — a hardcoded Hungarian literal silently stays Hungarian
// on a Polish page. This lint scans the CONVERTED customer-facing chain for Hungarian-accented
// text that is NOT inside a T(/tr( call and reports loudly. Exit 1 on violations.
//   npx tsx scripts/i18n-lint.mts
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// The converted, doctrine-bound surface. primitives.ts/chrome.ts (composition fallback) and
// the tenant-admin/console are KNOWN DEBT (§B.18) — extend this list as they convert.
const FILES = [
  "src/engine/templateKit.ts",
  "src/generator/generateEngine.ts",
  // Serve-time injection onto the LIVE tenant page — customer-facing, so doctrine-bound.
  "src/server/ownerLogin.ts",
  "assets/runtime/cit-runtime.js",
  "assets/runtime/cit-configurator.js",
];

const HU = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;

/** Strip comments + the INSIDES of T("…")/tr("…") calls, then hunt leftover accented literals. */
function violations(src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]!;
    // Drop line comments and doc lines — doctrine binds RENDERED strings, not comments.
    l = l.replace(/^\s*(\/\/|\*|\/\*).*$/, "");
    // Operator-facing logs are not customer UI; an explicit same-line "i18n-exempt" marker
    // opts a line out (operator-only labels, LEGAL texts owned by the country legal pack).
    if (/console\.(log|error|warn)/.test(l) || /i18n-exempt/.test(lines[i]!)) continue;
    // Drop wrapped calls: T(x, "…"), tr("…") — including their vars object.
    l = l.replace(/\bT\(\s*[a-zA-Z_$][\w$]*\s*,\s*"(?:[^"\\]|\\.)*"/g, "T(_,_WRAPPED_");
    l = l.replace(/\btr\(\s*"(?:[^"\\]|\\.)*"\s*\)/g, "tr(_WRAPPED_)");
    // Remaining double-quoted literals with Hungarian accents = suspects.
    for (const m of l.matchAll(/"((?:[^"\\]|\\.)+)"/g)) {
      if (HU.test(m[1]!)) out.push({ line: i + 1, text: m[1]!.slice(0, 60) });
    }
    // Template-literal / JSX-like inline text between tags with accents, outside ${…}.
    const stripped = l.replace(/\$\{[^}]*\}/g, "");
    for (const m of stripped.matchAll(/>([^<>{}`]*[áéíóöőúüűÁÉÍÓÖŐÚÜŰ][^<>{}`]*)</g)) {
      const t = m[1]!.trim();
      if (t) out.push({ line: i + 1, text: t.slice(0, 60) });
    }
  }
  return out;
}

let total = 0;
for (const rel of FILES) {
  const src = await readFile(path.join(ROOT, rel), "utf8").catch(() => "");
  const v = violations(src);
  if (v.length) {
    console.error(`⛔ ${rel} — ${v.length} burkolatlan magyar felirat:`);
    for (const x of v.slice(0, 10)) console.error(`   ${rel}:${x.line}  "${x.text}"`);
    total += v.length;
  }
}
// Templates dir: every file individually.
for (const f of await readdir(path.join(ROOT, "src/engine/templates"))) {
  if (!f.endsWith(".ts")) continue;
  const rel = `src/engine/templates/${f}`;
  const src = await readFile(path.join(ROOT, rel), "utf8");
  const v = violations(src);
  if (v.length) {
    console.error(`⛔ ${rel} — ${v.length} burkolatlan magyar felirat:`);
    for (const x of v.slice(0, 10)) console.error(`   ${rel}:${x.line}  "${x.text}"`);
    total += v.length;
  }
}
if (total) {
  console.error(`\n⛔ i18n-lint: ${total} sértés — §B.18: vevő-felirat CSAK T()/tr() burkolással.`);
  process.exit(1);
}
console.log("✅ i18n-lint: a vevő-felület lánc tiszta (minden felirat nyelvi csomagból olvas).");
