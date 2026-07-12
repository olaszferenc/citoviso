// Dev-time factuality net (Layer 2) — a Claude Code PostToolUse hook.
// Dependency-free plain Node (no tsx startup cost) so it can fire on every
// Write/Edit cheaply. Reads the hook payload on stdin, and IF the edited file is
// a generated mock (mock-*.html), runs the DETERMINISTIC pre-filter (no API) over
// its visible text and surfaces any HARD-fact-shaped tokens for verification.
// This guards hand-edits/out-of-pipeline mocks; the real gate is the runtime
// verifier in src/generator/factCheck.ts. Keep HARD_PATTERNS in sync with it.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const NUM_WORD =
  "(?:egy|két|kettő|három|négy|öt|hat|hét|nyolc|kilenc|tíz|tizen(?:egy|két|kettő|három|négy|öt|hat|hét|nyolc|kilenc)|húsz|harminc|negyven|ötven|hatvan|hetven|nyolcvan|kilencven|száz)";

// Unicode-aware token boundaries (ASCII \b breaks on ő/²/€ etc.).
const B = "(?<![\\p{L}\\d])";
const E = "(?![\\p{L}\\d])";
const P = (src) => new RegExp(src, "giu");

const HARD_PATTERNS = [
  P(`${B}\\d[.,]\\d\\s*(?:★|csillag)`),
  /★/gu,
  P(`${B}\\d{1,4}\\s*(?:értékelés|vélemény|review)`),
  P(`${B}\\d[\\d\\s.]*\\s*(?:Ft|HUF|€|EUR|forint)${E}`),
  P(`${B}(?:\\d{1,3}|${NUM_WORD})\\s*(?:fő|fős|személy|ágy|háló|szoba|szobás|apartman|apartmanos)${E}`),
  P(`${B}\\d{1,4}\\s*(?:m²|m2|négyzetméter|nm)${E}`),
  P(`${B}\\d{1,4}\\s*(?:méter|kilométer|km)\\p{L}*`),
  P(`${B}\\d{1,3}\\s*perc(?:re|nyire)?${E}`),
  P(`(?:alapítva|óta|épült|nyílt)\\D{0,14}(?:1[89]\\d{2}|20\\d{2})`),
  P(`(?:1[89]\\d{2}|20\\d{2})\\D{0,6}(?:óta|-ban épült|-ben épült)`),
  P(`${B}(?:díjnyertes|díjazott|díjjal|kitüntet\\p{L}*|minősített|NTAK|Michelin)`),
  P(`${B}(?:wifi|wi-fi|medence|szauna|jacuzzi|jakuzzi|pezsgőfürdő|klíma|légkondi)${E}`),
  P(`${B}leg\\p{L}{3,}`),
];

function htmlToVisibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidates(text) {
  const hits = new Set();
  for (const re of HARD_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const t = m[0].trim().replace(/\s+/g, " ");
      if (t) hits.add(t);
    }
  }
  return [...hits];
}

function emit(context) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context } }),
  );
}

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const file = payload?.tool_input?.file_path;
if (typeof file !== "string" || !file.endsWith(".html") || !basename(file).startsWith("mock-")) {
  process.exit(0);
}

let html;
try {
  html = readFileSync(file, "utf8");
} catch {
  process.exit(0);
}

const found = candidates(htmlToVisibleText(html));
if (found.length) {
  emit(
    `⚠️ TÉNYHŰSÉG-háló (${basename(file)}): a látható szövegben HARD-tény-jelölt(ek) — ` +
      `mindegyikhez ellenőrizd, hogy VALÓS forrás-mezőből vagy a képen láthatóból ered-e (DOMAIN 03-INVARIANTS §B.17), ` +
      `különben ki kell hagyni:\n- ${found.join("\n- ")}`,
  );
}
process.exit(0);
