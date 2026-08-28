// Surface-plan gate — the STRUCTURAL twin of the PreToolUse hook, run from git
// pre-commit (feedback_heuristic_guard_needs_structural_twin: a runtime nudge alone is
// the antipattern — pair it with a check on the committed boundary). Reads the staged
// file list on stdin; if any is a rendered surface, the branch must hold an approval /
// exception token (surface-gate.mjs), else the commit is refused.
//
// Commit-mode only — land.sh re-runs pre-commit with LAND_RANGE and NO token (ephemeral,
// per-session); the work was already gated at commit time, so the caller skips this there.

import { readFileSync } from "node:fs";

import { isSurfaceFile } from "./ui-surface-scope.mjs";
import { readToken } from "./surface-gate.mjs";

let list = "";
try {
  list = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}
const surfaces = list
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((f) => isSurfaceFile(f));

if (!surfaces.length) process.exit(0);

const tok = readToken(process.cwd());
if (tok && (tok.mode === "approved" || tok.mode === "exception")) {
  if (tok.mode === "exception")
    console.error(`   ℹ️ felület-kapu: KIVÉTEL-mód (indok: ${tok.reason}) — naplózott eltérés.`);
  process.exit(0);
}

console.error("⛔ FELÜLET-KAPU: renderelt felület van a commitban, de nincs jóváhagyott terv (§2b, ADR-0066/0076):");
for (const f of surfaces) console.error(`   · ${f}`);
console.error(
  "   Előbb: ui-shot (390px+desktop) → átadás a tulajnak (működő + desktop ÉS mobil) → jóváhagyás.\n" +
    '   Majd:  node scripts/surface-gate.mjs approve "<mit hagyott jóvá>"\n' +
    '   Apró/mintakövető, a tulaj kimondott kivételével: node scripts/surface-gate.mjs exception "<indok>"',
);
process.exit(1);
