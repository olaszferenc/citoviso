// OWN-PHOTO PRESSURE guard — owner's ruling (2026-10-02, Elek javítás L1 ⑤).
//
// WHY THIS EXISTS. The buyer DECLARES at checkout that they may use the photos the site
// is built from (src/legal.ts) — that declaration is final. Yet the tenant admin kept
// telling the paying customer otherwise: a yellow warning bar „Az élesítéshez a saját,
// jogtiszta fotói kellenek”, a primary „Cserélje sajátra” button on the overview, and a
// to-do row „Töltsön fel saját fotókat” tagged „Élesítés előtt” that could never close
// unless they uploaded. The module description promised „élesítéskor az Ön saját
// képeivel töltjük fel”, and the mock-request mail tied going live to their own photos.
// At most a NEUTRAL option may remain: „Ha szeretné, feltölthet saját képeket.”
//
// WHAT IT MEASURES. Every customer-facing text source — product code (src/**), the i18n
// catalog, the public pages (public/**/*.html, incl. the tegező landing), the KB entries
// and the approved design contracts (their README binds labels,
// ADR-0076) — is scanned for sentences that make going live depend on own photos or
// push a replacement. src/legal.ts is the declaration ITSELF and is exempt by name.
//
// Self-test: `--self-test` feeds the reported sentences (must be caught) and the neutral
// successors (must pass).
//
// Usage: npx tsx scripts/own-photo-pressure-check.mts [--self-test]

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

/** Sentence shapes that tie going live to own photos, or urge a replacement. */
const FORBIDDEN: readonly [RegExp, string][] = [
  [/jogtiszta\s+fotói\s+kellenek/iu, "az élesítést saját, jogtiszta fotókhoz köti"],
  [/élesítés\p{L}*\s+(?:előtt|ehhez|hez)?[^.!?\n]{0,40}saját[^.!?\n]{0,20}(?:fotó|kép)/iu, "élesítés ↔ saját fotó feltétel"],
  [/élesítéskor\s+az\s+Ön\s+saját\s+képeivel/iu, "élesítéskor saját képekkel töltjük fel"],
  [/saját\s+(?:képeivel|képeiddel|fotóival|fotóiddal)[^.!?\n]{0,40}(?:véglegesítjük|töltjük)/iu, "a véglegesítést saját képekhez köti"],
  // The platform landing page speaks tegező (owner's ruling 2026-10-02: it is in scope too).
  [/Saját\s+képeid,\s+szöveged/iu, "a saját képet az ígéret részévé teszi"],
  [/éles\s+oldal\p{L}*[^.!?\n]{0,40}(?:saját\s+fotóid|saját\s+képeid|te\s+anyagaid)/iu, "az éles oldalt saját anyaghoz köti"],
  [/Cserélje\s+sajátra/iu, "cserére sürget"],
  [/Töltsön\s+fel\s+saját\s+fotókat/iu, "teendőként sürgeti a saját fotót"],
];

/** The rights declaration itself — the owner's final ruling, not a pressure sentence. */
const EXEMPT = new Set(["src/legal.ts", "scripts/own-photo-pressure-check.mts"]);

function walk(dir: string, keep: (p: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".") || name === "_drafts") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, keep, out);
    else if (keep(p)) out.push(p);
  }
  return out;
}

function hits(text: string): { line: number; why: string; text: string }[] {
  const res: { line: number; why: string; text: string }[] = [];
  text.split("\n").forEach((l, i) => {
    for (const [re, why] of FORBIDDEN) if (re.test(l)) res.push({ line: i + 1, why, text: l.trim().slice(0, 140) });
  });
  return res;
}

if (process.argv.includes("--self-test")) {
  const REPORTED = [
    "Az élesítéshez a saját, jogtiszta fotói kellenek — az első feltöltés {b} a {n} bemutató képet.",
    "Jelenleg bemutató képek — az élesítéshez a saját, jogtiszta fotói kellenek.",
    "Cserélje sajátra",
    "Töltsön fel saját fotókat",
    "Nagy, minőségi fotógaléria a szállásról — élesítéskor az Ön saját képeivel töltjük fel.",
    "Ha tetszik, a saját képeivel és szövegeivel véglegesítjük, és élesíthető.",
    "Ha tetszik, néhány lépésben élesíthető, és a saját képeivel, szövegeivel véglegesítjük.",
    "Elkészítjük az előnézetet. Ha tetszik, a saját képeiddel, szövegeddel közösen véglegesítjük.",
    "Saját képeid, szöveged",
    "Az éles oldalon a te anyagaid szerepelnek, a te hangodon.",
    "A mintához elég a vállalkozásod neve és a helye. Az éles oldalhoz jól jönnek a saját fotóid és pár mondat rólad.",
  ];
  const NEUTRAL = [
    "Ha szeretné, feltölthet saját képeket.",
    "Az első saját feltöltés lecseréli a mostani {n} képet.",
    "A saját fotói láthatók az oldalán.",
    "Nagy, minőségi fotógaléria a szállásról.",
    "Ha tetszik, néhány lépésben élesíthető — csak akkor fizet, ha valóban szeretné.",
    "Elkészítjük az előnézetet. Ha tetszik, közösen véglegesítjük.",
    "Ha szeretnéd, saját képeket is feltölthetsz.",
    "A mintához elég a vállalkozásod neve és a helye — minden mást mi intézünk.",
  ];
  const missed = REPORTED.filter((s) => hits(s).length === 0);
  const falsePos = NEUTRAL.filter((s) => hits(s).length > 0);
  if (missed.length || falsePos.length) {
    console.error("⛔ own-photo-pressure-check --self-test: elszalasztott:", missed, "álpozitív:", falsePos);
    process.exit(1);
  }
  console.log(`✅ own-photo-pressure-check --self-test: ${REPORTED.length} bejelentett mondatot elkap, ${NEUTRAL.length} semleges utódot átenged.`);
  process.exit(0);
}

const files = [
  ...walk(join(ROOT, "src"), (p) => /\.(ts|json)$/.test(p)),
  ...walk(join(ROOT, "kb"), (p) => p.endsWith(".md")),
  ...walk(join(ROOT, "assets/design-refs"), (p) => p.endsWith("README.md")),
  ...walk(join(ROOT, "public"), (p) => p.endsWith(".html")),
];
let bad = 0;
for (const f of files) {
  const rel = relative(ROOT, f);
  if (EXEMPT.has(rel)) continue;
  for (const h of hits(readFileSync(f, "utf8"))) {
    bad++;
    console.error(`  ${rel}:${h.line} — ${h.why}\n      ${h.text}`);
  }
}
if (bad) {
  console.error(
    `\n⛔ own-photo-pressure-check: ${bad} helyen köti az élesítést saját fotóhoz vagy sürget cserét.\n` +
      `   Tulaj-döntés (2026-10-02): a vevő nyilatkozott a képekről — legfeljebb: „Ha szeretné, feltölthet saját képeket.”`,
  );
  process.exit(1);
}
console.log(`✅ own-photo-pressure-check: ${files.length} fájlban nincs saját-fotóhoz kötő vagy cserére sürgető mondat.`);
