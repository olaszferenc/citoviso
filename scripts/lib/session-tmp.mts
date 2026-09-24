// Session-private temp directory for gate previews/fixtures.
//
// WHY. `/tmp` is shared by every worktree on this machine. A gate that writes its
// preview to a FIXED path (`/tmp/cit-x-check.html`) races the same gate in a
// sibling session: one overwrites the other's fixture mid-run, and the loser
// measures a page it did not render.
//
//   import { sessionTmpDir } from "./lib/session-tmp.mts";
//   const TMP = sessionTmpDir("barion-pixel-check");   // /tmp/cit-barion-pixel-check-XXXXXX
//   const PREVIEW = path.join(TMP, "preview.html");
//
// The directory is removed on every exit path (normal end, `process.exit(n)`,
// uncaught exception) through a synchronous `exit` hook — a `finally` alone would
// not survive `process.exit`.

import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function sessionTmpDir(name: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), `cit-${name}-`));
  process.on("exit", () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best effort — a leftover mkdtemp dir is unique, so it cannot race anyone.
    }
  });
  return dir;
}
