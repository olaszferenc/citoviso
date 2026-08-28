// UI screenshot-loop nudge — a Claude Code PostToolUse hook (design-token-scan minta).
// When an edit touches the UI chain (views, templates, CSS), reminds the agent to close
// the visual loop with scripts/ui-shot.mts and actually LOOK at the result (§B.19,
// ADR-0062: a working feature in the wrong place is a failed delivery). Non-blocking:
// emits additionalContext, never exit 2 — judgment stays with the agent, the nudge just
// makes "forgot to look" impossible. Debounced to once per 30 min per session.

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import { isSurfaceFile } from "./ui-surface-scope.mjs";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const filePath = String(payload?.tool_input?.file_path ?? "");
if (!isSurfaceFile(filePath)) process.exit(0);

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

// ⛔ A SZABÁLY SZÖVEGE NEM ITT ÉL (2026-08-28): korábban a hook a §2b PRÓZAI
// MÁSOLATÁT hordozta, és amikor a doktrína változott (ADR-0076: a külső design-app
// kivezetve), a hook még a régit mondta — vagyis az őr maga terelte rossz irányba a
// sessiont. Mostantól a hook a CLAUDE.md ÉLŐ §2b szakaszából idéz: nincs mit
// szinkronban tartani, mert nincs második példány.
function doctrineExcerpt() {
  try {
    const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const md = readFileSync(`${root}/CLAUDE.md`, "utf8");
    const start = md.indexOf("## 2b.");
    if (start === -1) return null;
    const end = md.indexOf("\n## ", start + 5);
    const section = md.slice(start, end === -1 ? md.length : end).trim();
    // A lépések a lényeg; a hosszú indoklás a fájlban olvasható.
    return section.length > 1800 ? `${section.slice(0, 1800)}\n… (a teljes szakasz: CLAUDE.md §2b)` : section;
  } catch {
    return null;
  }
}

const excerpt = doctrineExcerpt();
console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext:
        "UI-lánc fájl változott — a TERV-JÓVÁHAGYÁSI KAPU alá esel. A szabály SZÓ SZERINT, " +
        "a munkafád CLAUDE.md-jéből (ha ez elavultnak tűnik: a globális elavult-doktrína őr " +
        "amúgy is blokkol, előbb rebase-elj):\n\n" +
        (excerpt ?? "⚠️ A CLAUDE.md §2b nem olvasható — OLVASD EL KÉZZEL, mielőtt felületet írsz."),
    },
  }),
);
