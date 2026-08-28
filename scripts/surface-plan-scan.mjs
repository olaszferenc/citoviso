// Surface-plan gate — a Claude Code PreToolUse hook (block_live_deploy minta, de
// Write/Edit-re). This is the MACHINE gate the §2b design-approval doctrine never had.
//
// WHY PreToolUse (not Post): the doctrine's core is ORDER — plan + owner-approval BEFORE
// code. A PostToolUse block fires after the bytes are already written (too late — I would
// have coded first, exactly the failure this exists to stop). PreToolUse exit 2 DENIES the
// edit itself: a surface file cannot be written until the branch holds an approval/exception
// token (see surface-gate.mjs). Non-surface files pass instantly.
//
// This does not replace judgment or prove the owner said yes; it makes the SILENT path
// impossible — no surface code without an explicit, logged, plan-backed unlock.

import { readFileSync } from "node:fs";

import { isSurfaceFile } from "./ui-surface-scope.mjs";
import { readToken } from "./surface-gate.mjs";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // never block on a parse failure
}

const filePath = String(payload?.tool_input?.file_path ?? "");
if (!isSurfaceFile(filePath)) process.exit(0);

const tok = readToken(process.cwd());
if (tok && (tok.mode === "approved" || tok.mode === "exception")) {
  // Unlocked. Surface an audit note when riding an exception so it can't hide.
  if (tok.mode === "exception") {
    console.error(
      `ℹ️ Felület-kapu: KIVÉTEL-módban engedve (indok: ${tok.reason}). Naplózott eltérés a §2b-től — ` +
        "ha ez már nem apró/mintakövető, zárd vissza: node scripts/surface-gate.mjs clear",
    );
  }
  process.exit(0);
}

// LOCKED → deny the edit with the §2b path forward.
console.error(
  "⛔ FELÜLET-KAPU (CLAUDE.md §2b, ADR-0066/0076): ez egy RENDERELT FELÜLET, és nincs jóváhagyott terv ehhez az ághoz.\n" +
    `   Fájl: ${filePath}\n` +
    "\n" +
    "   A kapu KÉT célja: (1) LÁSD, amit generálsz; (2) a kinézet/funkció dőljön el KÓD ELŐTT.\n" +
    "   ⛔ Kód ELŐTT megállsz. A sorrend:\n" +
    "     1. Terv, nem kód: 2–4 kattintható változat / a felület valós adattal.\n" +
    "     2. npx tsx scripts/ui-shot.mts <fájl|/route>  → 390px + desktop, és Read-del MEG IS NÉZED.\n" +
    "     3. Átadod a tulajnak (működő nézet + DESKTOP ÉS MOBIL), és MEGÁLLSZ a jóváhagyásig.\n" +
    "     4. Jóváhagyás után:  node scripts/surface-gate.mjs approve \"<mit hagyott jóvá>\"\n" +
    "\n" +
    "   Ha a tulaj APRÓ/MINTAKÖVETŐ kivételt engedett (§2b kivétel), az Ő szava alapján:\n" +
    "     node scripts/surface-gate.mjs exception \"<a tulaj miért engedte>\"\n" +
    "   ⚠️ A kivételt NEM magadnak adod (ADR-0068: panasz/kényelem ≠ felhatalmazás).",
);
process.exit(2);
