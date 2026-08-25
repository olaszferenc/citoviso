// §B.18 i18n doctrine guard (ADR-0036): customer-facing sources must read every UI string
// from the language pack (T()/tr()) — a hardcoded Hungarian literal silently stays Hungarian
// on a Polish page. This lint scans the CONVERTED customer-facing chain for Hungarian-accented
// text that is NOT inside a T(/tr( call and reports loudly. Exit 1 on violations.
//   npx tsx scripts/i18n-lint.mts
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// The converted, doctrine-bound surface — ONE list shared with the extractor
// (scripts/i18n-sources.mjs), because two drifting copies is precisely how the
// module-section labels and later the whole mail chain slipped the doctrine.
// primitives.ts/chrome.ts (composition fallback) and the tenant-admin/console are
// KNOWN DEBT (§B.18) — extend the shared list as they convert.
import { I18N_SOURCES as FILES } from "./i18n-sources.mjs";

const HU = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;

/** Strip comments + the INSIDES of T("…")/tr("…") calls, then hunt leftover accented literals. */
function violations(src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  // MULTI-LINE wrapped calls first, on the whole source: a prettier-split
  // `T(\n  lang,\n  "…",\n)` is properly wrapped, and the extractor (which scans
  // the whole file) already picks it up — a line-based lint alone would report it
  // as a violation and push authors back to unreadable one-liners.
  // Newlines are preserved so the reported line numbers stay true.
  src = src.replace(
    /\bT\(\s*[a-zA-Z_$][\w$]*\s*,\s*"((?:[^"\\]|\\.)*)"/g,
    (m) => "T(_,_WRAPPED_" + "\n".repeat((m.match(/\n/g) ?? []).length),
  );
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
    // TEMPLATE literals too (measured 2026-08-25): the guest-facing booking errors
    // were written as `Legalább ${n} éjszakára…` and sailed past a double-quote-only
    // scan. An interpolated string is the NATURAL shape for a message with a number
    // in it, i.e. exactly the shape a customer-facing sentence takes — so leaving
    // backticks unscanned left the guard blind where it mattered most.
    // The ${…} holes are stripped first: a Hungarian *variable name* is not a label.
    for (const m of l.matchAll(/`([^`]*)`/g)) {
      const text = m[1]!.replace(/\$\{[^}]*\}/g, "");
      if (HU.test(text)) out.push({ line: i + 1, text: text.trim().slice(0, 60) });
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
