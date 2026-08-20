// i18n doctrine net (§B.18, ADR-0036) — a Claude Code PostToolUse hook (factcheck-scan
// minta). Dependency-free plain Node: reads the hook payload on stdin, and ONLY IF the
// edited file belongs to the customer-facing i18n-bound chain, spawns the real lint
// (scripts/i18n-lint.mts). Violation → exit 2, so the finding flows back to the agent as
// blocking feedback: a hardcoded customer-facing Hungarian literal cannot survive an edit.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Keep in sync with the lint's coverage (i18n-lint.mts): the converted customer chain.
const SCOPE_ENDS = [
  "src/engine/templateKit.ts",
  "src/generator/generateEngine.ts",
  "assets/runtime/cit-runtime.js",
  "assets/runtime/cit-configurator.js",
];
const SCOPE_DIRS = ["src/engine/templates/"];

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const filePath = String(payload?.tool_input?.file_path ?? "");
const inScope =
  SCOPE_ENDS.some((s) => filePath.endsWith(s)) ||
  SCOPE_DIRS.some((d) => filePath.includes(d) && filePath.endsWith(".ts"));
if (!inScope) process.exit(0);

try {
  execFileSync("npx", ["tsx", "scripts/i18n-lint.mts"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
  console.error(out || "i18n-lint sértés — §B.18: vevő-felirat CSAK T()/tr() burkolással.");
  process.exit(2); // blocking feedback: an unwrapped customer-facing literal was introduced
}
