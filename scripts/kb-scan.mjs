// KB doctrine net (ADR-0045, §J) — a Claude Code PostToolUse hook (i18n-scan minta).
// Dependency-free plain Node: reads the hook payload on stdin, and ONLY IF the edited
// file is an admin view or a KB entry, spawns the full KB gate (kb-check --coverage).
// Violation → exit 2, so the finding flows back to the agent as blocking feedback:
// an admin-surface change cannot outrun its guide — new section without an entry,
// renamed button without the guide following, entry whose anchor is not on the UI.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Keep in sync with kb-check.mts VIEW_FILES.
const SCOPE_ENDS = ["src/server/adminViews.ts", "src/server/moduleConfigViews.ts"];

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const filePath = String(payload?.tool_input?.file_path ?? "");
const inScope =
  SCOPE_ENDS.some((s) => filePath.endsWith(s)) || filePath.includes("/kb/entries/");
if (!inScope) process.exit(0);

try {
  execFileSync("npx", ["tsx", "scripts/kb-check.mts", "--coverage"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
  console.error(
    out || "kb-check sértés — §J: admin-felület változás csak a tudásbázissal együtt mehet.",
  );
  process.exit(2); // blocking feedback: the surface and its guide diverged
}
