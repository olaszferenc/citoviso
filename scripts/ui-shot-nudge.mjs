// UI screenshot-loop nudge — a Claude Code PostToolUse hook (design-token-scan minta).
// When an edit touches the UI chain (views, templates, CSS), reminds the agent to close
// the visual loop with scripts/ui-shot.mts and actually LOOK at the result (§B.19,
// ADR-0062: a working feature in the wrong place is a failed delivery). Non-blocking:
// emits additionalContext, never exit 2 — judgment stays with the agent, the nudge just
// makes "forgot to look" impossible. Debounced to once per 30 min per session.

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// Surfaces whose pixels change when these files change. Keep roughly in sync with
// design-token-scan SCOPE, plus the engine (its output is shot in file mode).
const SCOPE = [
  "src/console/views.ts",
  "src/console/partnerViews.ts",
  "src/server/adminViews.ts",
  "src/server/legalViews.ts",
  "src/server/moduleConfigViews.ts",
  "src/ui/icons.ts",
  "public/index.html",
];
const SCOPE_PREFIX = ["public/assets/", "src/engine/"];

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const filePath = String(payload?.tool_input?.file_path ?? "");
const rel = filePath.replace(/^.*?\/(src|public)\//, "$1/");
const hit =
  SCOPE.some((s) => filePath.endsWith(s)) || SCOPE_PREFIX.some((p) => rel.startsWith(p));
if (!hit) process.exit(0);

// Debounce: at most one nudge per session per 30 minutes.
const sid = String(payload?.session_id ?? "nosession").replace(/[^a-zA-Z0-9_-]/g, "");
const stamp = path.join(os.tmpdir(), `ui-shot-nudge-${sid}`);
try {
  if (existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < 30 * 60 * 1000) {
    process.exit(0);
  }
  writeFileSync(stamp, "");
} catch {
  /* stamp failure must never block the edit */
}

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext:
        "UI-lánc fájl változott. ⛔ TERV-JÓVÁHAGYÁSI KAPU (CLAUDE.md §2b, ADR-0066/0067): ha ez " +
        "KINÉZETI DÖNTÉST igényel, kódot MÉG NEM írsz — előbb statikus terv-változatok " +
        "KÖZVETLENÜL az assets/design-refs/<felület>/ mappába, `npx tsx scripts/ui-shot.mts` " +
        "(390px + desktop), a képeket Read-del MEG IS NÉZED, landolsz (a terv ettől azonnal " +
        "látszik a :4600/design lapon — nincs feltöltés), és MEGÁLLSZ a tulaj jóváhagyásáig. " +
        "A döntését a sites/_design-picks.json-ból olvasod vissza. Apró javításnál elég a " +
        "ui-shot ellenőrzés.",
    },
  }),
);
process.exit(0);
