// Guard for the design-doctrine check (src/generator/designCheck.ts).
//
// Why this exists: on 2026-09-16 the emoji rule measured the RAW source, so our own
// ⛔/⚠ doctrine markers in CSS/JS comments flagged every generated mock, and the
// outreach gate then refused to send a curator-APPROVED page. Narrowing the measured
// zone fixes that — but the dangerous direction of a narrowing fix is the FALSE PASS:
// a `content: "⚠️"` on a ::before and a JS string literal injected into the DOM both
// RENDER, and dropping <style>/<script> wholesale would have excused them silently.
//
// So the positive controls below are the point of this file: every case where an
// emoji can still reach the visitor's eye must keep flagging. The negative controls
// only prove the false failure is gone.
//
// Run: npx tsx scripts/design-comment-zone-check.mts
import { readFileSync, readdirSync } from "node:fs";
import { checkDesign } from "../src/generator/designCheck.js";

let pass = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail: string): void {
  if (ok) {
    pass++;
    return;
  }
  failures.push(`${name} — ${detail}`);
}

/** Minimal document that satisfies every NON-emoji rule, so a flag can only come from emoji. */
function doc(body: string, extraStyle = "", extraScript = ""): string {
  const tokens = [
    "--cit-accent:#2f8fbf",
    "--cit-on-accent:#fff",
    "--cit-ink:#111",
    "--cit-muted:#666",
    "--cit-bg:#fff",
    "--cit-surface:#f6f6f6",
    "--cit-line:#ddd",
    "--cit-radius:12px",
    "--cit-font-display:serif",
    "--cit-font-body:sans-serif",
    "--cit-shadow:0 1px 2px rgba(0,0,0,.1)",
  ].join(";");
  return `<!doctype html><html><head><style>:root{${tokens}}
${extraStyle}</style></head><body>
<section data-cit-module="booking">Érdeklődés</section>
${body}
<script>${extraScript}</script>
</body></html>`;
}

// ── POSITIVE CONTROLS: the emoji still reaches the eye, so it MUST flag ──────────
const positives: { name: string; html: string }[] = [
  {
    name: "emoji a látható szövegben",
    html: doc(`<p>Foglaljon most 🎉</p>`),
  },
  {
    // The whole reason we strip comments only. A ::before content string PAINTS.
    name: "emoji CSS content:-ben (::before — MEGJELENIK a képernyőn)",
    html: doc(`<p class="w">Figyelem</p>`, `.w::before{content:"⚠️ "}`),
  },
  {
    name: "emoji JS string literálban (DOM-ba írható)",
    html: doc(`<div id="t"></div>`, "", `document.getElementById("t").textContent = "Kész ✅";`),
  },
  {
    name: "emoji alt attribútumban (képernyőolvasó + törött kép esetén látszik)",
    html: doc(`<img src="a.jpg" alt="Medence 🏊">`),
  },
  {
    name: "emoji title attribútumban",
    html: doc(`<button title="Bezárás ❌">x</button>`),
  },
  {
    // A `//` INSIDE a string must not be mistaken for a line-comment opener,
    // otherwise everything after it on that line silently stops being measured.
    name: "emoji string után, amiben URL-szerű // áll",
    html: doc(`<div id="t"></div>`, "", `const u = "https://example.com"; el.textContent = "Kész ✅";`),
  },
  {
    name: "emoji CSS content-ben, komment UTÁN ugyanabban a blokkban",
    html: doc(`<p class="w">x</p>`, `/* ⛔ doktrína-jelölés */ .w::after{content:"🔥"}`),
  },
  {
    name: "emoji a lezáratlan komment-kezdet után (nem ismerhető fel kommentként → fail-closed)",
    html: doc(`<p class="w">x</p>`, `.w::after{content:"🔥"} /* nyitott komment`),
  },
];

for (const c of positives) {
  const v = checkDesign(c.html);
  check(`POZITÍV: ${c.name}`, v.verdict === "flag", `verdict=${v.verdict} (HAMIS ZÖLD), emoji=[${v.emoji.join(" ")}]`);
}

// ── NEGATIVE CONTROLS: source comments only — the visitor never sees these ───────
const negatives: { name: string; html: string }[] = [
  {
    name: "⛔ CSS blokk-kommentben",
    html: doc(`<p>Rendben</p>`, `/* ⛔ KONTRAKTUS ④: a sáv tapadjon */ .a{color:red}`),
  },
  {
    name: "⚠️ JS sor-eleji kommentben",
    html: doc(`<p>Rendben</p>`, "", `\n  // ⚠️ GEOMETRY, not elementFromPoint\n  const a = 1;`),
  },
  {
    name: "⛔ JS sor-végi kommentben (kód után)",
    html: doc(`<p>Rendben</p>`, "", `const a = 1; // ⛔ MÉRVE: ez csak jegyzet\n`),
  },
  {
    name: "⛔ JS blokk-kommentben",
    html: doc(`<p>Rendben</p>`, "", `/* ⛔⛔ height:100% MADE IT SWALLOW THE CARD */ const a = 1;`),
  },
  {
    name: "⚠️ HTML kommentben",
    html: doc(`<!-- ⚠️ ide jön a galéria --><p>Rendben</p>`),
  },
  {
    name: "© ® ™ a láblécben (allowlist)",
    html: doc(`<footer>© 2026 Citoviso ® ™</footer>`),
  },
];

for (const c of negatives) {
  const v = checkDesign(c.html);
  check(`NEGATÍV: ${c.name}`, v.verdict === "pass", `verdict=${v.verdict}, emoji=[${v.emoji.join(" ")}] — HAMIS BUKÓ`);
}

// A comment-only emoji must still be COUNTED, never silently dropped.
{
  const v = checkDesign(doc(`<p>x</p>`, `/* ⛔ egy */ /* ⚠️ kettő */`));
  check(
    "A kommentben talált emoji SZÁMA jelentve van (nem néma kihagyás)",
    v.emojiInComments === 2,
    `emojiInComments=${v.emojiInComments}, várt 2`,
  );
}

// Structural rules must be untouched by the narrowing.
{
  const v = checkDesign(`<!doctype html><html><body><section data-cit-module="booking">x</section></body></html>`);
  check("Hiányzó --cit-* tokenek továbbra is flagelnek", v.verdict === "flag" && v.missingTokens.length === 11, `missingTokens=${v.missingTokens.length}`);
}
{
  const v = checkDesign(doc(`<p>x</p>`).replace(`data-cit-module="booking"`, `data-cit-module="gallery"`));
  check("Hiányzó booking modul-horog továbbra is flagel", v.verdict === "flag" && v.missingHooks.includes("booking"), `missingHooks=[${v.missingHooks.join(",")}]`);
}

// ── REAL PRODUCT OUTPUT: the mocks that triggered this whole fix ─────────────────
// Built from the product's own source, not a hand-written fixture (a fixture cannot
// prove that the REAL templates stopped flagging).
const realDir = "/home/citoviso/citoviso";
let realChecked = 0;
try {
  const mocks = readdirSync(realDir).filter((f) => /^mock-.*\.html$/.test(f));
  for (const f of mocks.slice(0, 12)) {
    const v = checkDesign(readFileSync(`${realDir}/${f}`, "utf8"));
    realChecked++;
    check(
      `VALÓDI MOCK: ${f}`,
      v.verdict === "pass",
      `verdict=${v.verdict}, reason=${v.reason ?? "-"}, emoji=[${v.emoji.join(" ")}]`,
    );
  }
} catch (e) {
  failures.push(`VALÓDI MOCK olvasás: ${(e as Error).message}`);
}
if (realChecked === 0) {
  // A zero-of-zero is not a measurement — say so loudly instead of passing quietly.
  failures.push(`VALÓDI MOCK: egyetlen mock-*.html sem található a ${realDir} könyvtárban — a valódi kimenet NEM lett mérve`);
}

console.log(`\ndesign-comment-zone-check: ${pass} zöld, ${failures.length} bukás (valódi mock mérve: ${realChecked})`);
if (failures.length) {
  for (const f of failures) console.error(`  ⛔ ${f}`);
  process.exit(1);
}
