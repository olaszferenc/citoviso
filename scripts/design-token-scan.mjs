// Design-token doctrine net — a Claude Code PostToolUse hook (factcheck-scan minta).
// Dependency-free plain Node so it can fire on every Write/Edit cheaply: reads the
// hook payload on stdin, and ONLY IF the edited file belongs to the token-bound
// surface chain (or is the core itself — a token rename breaks consumers), spawns
// the real lint (scripts/design-token-lint.mts). Violation → exit 2, so the finding
// flows back to the agent as blocking feedback.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Keep in sync with FILES in design-token-lint.mts (+ the core as a trigger).
const SCOPE = [
  "public/assets/ui/citui.css",
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

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const filePath = String(payload?.tool_input?.file_path ?? "");
if (!SCOPE.some((s) => filePath.endsWith(s))) process.exit(0);

try {
  execFileSync("npx", ["tsx", "scripts/design-token-lint.mts"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
  if (out) console.error(out);
  process.exit(2); // blocking feedback: the edit detached a surface from the design core
}
