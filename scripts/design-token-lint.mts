// ADR-0021 ① design-token doctrine guard — deterministic, no API (i18n-lint minta).
// Every first-party Citoviso surface (console, tenant admin, public homepage) must dress
// EXCLUSIVELY from the central design core (public/assets/ui/citui.css --citui-* tokens):
// a hardcoded colour silently detaches that surface from the core — a skin change would
// leave it behind. This lint scans the surface chain and reports loudly. Exit 1 on violations.
//   npx tsx scripts/design-token-lint.mts
//
// Checks:
//   A) raw colour literal (hex / rgb() / hsl()) outside the allowlist → violation
//   B) var(--X) where X is not citui-* → foreign/undefined namespace → violation
//   C) var(--citui-X) referencing a token NOT defined in citui.css → typo → violation
//
// Escape hatches (both DOCUMENTED, both greppable):
//   - per-file ALLOW entries below, each with a reason (brand-art constants, SVG-attr
//     limitations, engine-side overlays) — extending it is a conscious, reviewed act;
//   - a same-line "token-exempt" marker for one-off cases.

import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** The doctrine-bound surface chain. citui.css itself is the SOURCE (checked only as
 *  the token registry) — extend this list when a new first-party surface is born. */
const FILES = [
  "public/assets/ui/citui-console.css",
  "public/assets/ui/citui-admin.css",
  "public/assets/home/home.css",
  "public/index.html",
  "src/console/views.ts",
  "src/console/server.ts",
  "src/server/adminViews.ts",
  "src/server/public.ts",
  "src/ui/icons.ts",
];

const CORE = "public/assets/ui/citui.css";

/** Documented exceptions — value sets per file, each with its WHY. */
const ALLOW: Record<string, { values: string[]; reason: string }> = {
  "public/assets/home/home.css": {
    values: [
      "#49d8eb", "#1fb6d6", "#0c6680", // hero orb gradient
      "#183451", "#193e61", // hero/engine sky gradient ends
      "#62cde0", "#9de8f2", "#b6e8d1", "#d9f7fb", "#def8fb", "#dff8fb", "#edf7fa", "#f3f9fb", // showcase art tints
    ],
    reason: "kézzel komponált ARTWORK gradiens-stopok (brand-art konstans, mint a logó — nem skin-elem)",
  },
  "public/index.html": {
    values: ["#35c4e0", "#8be8f3", "#0e2a47"],
    reason: "logó/hero SVG brand-art — SVG presentation-attribútumban a var() nem oldódik fel",
  },
  "src/console/views.ts": {
    values: ["#1fb6d6", "#16283f", "#e5484d", "#d29922", "#2fa96b", "#60748b"],
    reason: "logó (brand-konstans) + Leaflet szín-tükrök (SVG-attr, var() nem oldódik fel; a citui.css szemantikus tokenjeivel szinkronban tartandó)",
  },
  "src/console/server.ts": {
    values: ["#8a8f98", "#101216"],
    reason: "/p/ előnézet-lábléc: ENGINE-renderelt mock fölé kerül (--cit-* skin, citui.css nélkül) — semleges szürkék",
  },
  "src/server/adminViews.ts": {
    values: ["#1fb6d6", "#16283f"],
    reason: "logó — brand-konstans, nem témázható",
  },
};

/** Neutral overlays (white/black + alpha) are composition tools, not palette drift. */
const NEUTRAL =
  /^(#f{3}|#f{6}|#fff8|#ffffff\w{0,2}|#000|#000000\w{0,2}|rgba?\(\s*255\s*,\s*255\s*,\s*255\b[^)]*\)|rgba?\(\s*0\s*,\s*0\s*,\s*0\b[^)]*\))$/i;

const COLOR_RE = /(?<![\w&-])#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d[\d\s,./%]*\)|hsla?\(\s*\d[\d\s,./%deg]*\)/g;
const VAR_RE = /var\(\s*--([\w-]+)/g;

function stripComments(src: string, file: string): string {
  // Keep line count intact so reported line numbers stay true.
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  let out = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (file.endsWith(".ts") || file.endsWith(".mts")) {
    out = out
      .split("\n")
      .map((l) => l.replace(/^\s*\/\/.*$/, ""))
      .join("\n");
  }
  if (file.endsWith(".html")) out = out.replace(/<!--[\s\S]*?-->/g, blank);
  return out;
}

interface Violation {
  file: string;
  line: number;
  what: string;
  hint: string;
}

const violations: Violation[] = [];

// ── Token registry from the core ──
const coreSrc = await readFile(path.join(ROOT, CORE), "utf8");
const DEFINED = new Set([...coreSrc.matchAll(/--citui-[\w-]+(?=\s*:)/g)].map((m) => m[0]));

for (const file of FILES) {
  let src: string;
  try {
    src = await readFile(path.join(ROOT, file), "utf8");
  } catch {
    continue; // a surface may not exist yet in a branch — absence is not a violation
  }
  const allowed = new Set((ALLOW[file]?.values ?? []).map((v) => v.toLowerCase()));
  const clean = stripComments(src, file);
  const rawLines = src.split("\n");
  const lines = clean.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (/token-exempt/.test(rawLines[i]!)) continue;

    // A) raw colour literals
    for (const m of l.matchAll(COLOR_RE)) {
      const val = m[0].replace(/\s+/g, " ").trim();
      if (NEUTRAL.test(val)) continue;
      if (allowed.has(val.toLowerCase())) continue;
      violations.push({
        file,
        line: i + 1,
        what: `nyers szín-literál: ${val}`,
        hint: "használj --citui-* tokent vagy color-mix(in srgb, var(--citui-…) N%, transparent)-et; szándékos kivétel → ALLOW-lista indoklással",
      });
    }

    // B) + C) var() references
    for (const m of l.matchAll(VAR_RE)) {
      const name = `--${m[1]!}`;
      if (!name.startsWith("--citui-")) {
        violations.push({
          file,
          line: i + 1,
          what: `idegen/nem-citui token: var(${name})`,
          hint: "saját felület CSAK --citui-* tokenből öltözhet (a --cit-* az engine skin-világa)",
        });
      } else if (!DEFINED.has(name)) {
        violations.push({
          file,
          line: i + 1,
          what: `NEM LÉTEZŐ token: var(${name})`,
          hint: `nincs definiálva a ${CORE}-ben — elírás, vagy vedd fel a magba`,
        });
      }
    }
  }
}

if (violations.length) {
  console.error(`❌ design-token-lint: ${violations.length} sérülés a vállalati felület-láncban\n`);
  for (const v of violations) console.error(`  ${v.file}:${v.line} — ${v.what}\n    ↳ ${v.hint}`);
  console.error(`\nDoktrína: ADR-0021 ① — minden saját felület a citui.css tokenjeiből öltözik.`);
  process.exit(1);
}
console.log("✅ design-token-lint: a vállalati felület-lánc tiszta (minden szín a dizájn-magból jön).");
