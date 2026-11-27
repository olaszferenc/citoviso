// A STAMP OR GATE-VERSION BUMP ONLY WITH A RULE CHANGE AND A REASON (coordinator 2026-11-27, 16:1x: four bumps in one day —
// headings1 → supply1 → supply2, render gate 16 → 17 → 18 — each one made every passed plan stale at once, and the owner's
// approval page emptied for about an hour after every deploy that carried one).
//
// Runs on the STAGED tree (pre-commit). When the commit changes
//   · MOCK_HEROFIX_STAMP (src/outreach/mockPhotoGate.ts)  — every waiting mock is re-rendered (mockRefresh), or
//   · RENDER_GATE_VERSION (src/outreach/mockRenderGate.ts) — every cached verdict is judged again (regateStaleQueue),
// the same commit must
//   ① change a rule the bump stands for: a generator / template / photo-curation file for the stamp (src/engine/**,
//     src/generator/** except the refresh / supply machinery, src/media/**), the gate's own rules for the version
//     (mockRenderGate.ts beyond the constant line, src/media/{photoKind,townPick}.ts, src/text/textOverlap.ts);
//   ② carry the reason: an added comment within the 6 lines above the constant that names the new value.
// A bump without both fails the commit. Hermetic (git plumbing only).
import { execFileSync } from "node:child_process";

const git = (...a: string[]): string => {
  try {
    return execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
};

interface Bump {
  readonly file: string;
  readonly re: RegExp;
  readonly name: string;
  readonly rules: (f: string) => boolean;
}
const BUMPS: readonly Bump[] = [
  {
    file: "src/outreach/mockPhotoGate.ts",
    re: /export const MOCK_HEROFIX_STAMP = "([^"]+)";/,
    name: "MOCK_HEROFIX_STAMP (generátor-bélyeg)",
    rules: (f) =>
      (/^src\/(engine|media)\//.test(f) || /^src\/generator\//.test(f)) &&
      !/^src\/generator\/(mockRefresh|chainSupply)\.ts$/.test(f),
  },
  {
    file: "src/outreach/mockRenderGate.ts",
    re: /export const RENDER_GATE_VERSION = (\d+);/,
    name: "RENDER_GATE_VERSION (kapu-verzió)",
    rules: (f) => /^src\/media\/(photoKind|townPick)\.ts$/.test(f) || f === "src/text/textOverlap.ts",
  },
];

let fails = 0;
const staged = git("diff", "--cached", "--name-only").split("\n").filter(Boolean);
for (const b of BUMPS) {
  const before = b.re.exec(git("show", `HEAD:${b.file}`))?.[1];
  const after = b.re.exec(git("show", `:${b.file}`))?.[1];
  if (!before || !after || before === after) continue;
  // ① a rule change rides along: another rule file, or the gate file itself beyond the constant (for the version)
  const diff = git("diff", "--cached", "-U0", "--", b.file);
  const changedBody = diff
    .split("\n")
    .filter((l) => /^[+-][^+-]/.test(l))
    .filter((l) => !b.re.test(l.slice(1)) && !/^\s*\/\//.test(l.slice(1)) && l.slice(1).trim() !== "");
  const ruleFiles = staged.filter((f) => f !== b.file && b.rules(f));
  const ownRule = b.file === "src/outreach/mockRenderGate.ts" && changedBody.length > 0;
  if (!ruleFiles.length && !ownRule) {
    console.log(`✗ ${b.name}: ${before} → ${after}, de a commit nem változtat szabályt, amire az emelés vonatkozna — emelés nélkül commitold (minden átment terv elavulna)`);
    fails++;
  }
  // ② the reason: an added comment near the constant naming the new value
  const lines = git("show", `:${b.file}`).split("\n");
  const at = lines.findIndex((l) => b.re.test(l));
  const added = new Set(diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)));
  const near = lines.slice(Math.max(0, at - 6), at).filter((l) => /^\s*\/\//.test(l) && added.has(l));
  if (!near.some((l) => l.includes(after))) {
    console.log(`✗ ${b.name}: ${before} → ${after} — indoklás kell: hozzáadott komment a konstans felett, ami megnevezi az új értéket (${after}) és a szabályt`);
    fails++;
  }
  if (!fails) console.log(`✓ ${b.name}: ${before} → ${after}, szabály-változással és indoklással`);
}
if (!fails) console.log("✅ bump-guard-check: nincs indokolatlan bélyeg- / kapu-verzió emelés");
process.exit(fails ? 1 : 0);
