// IS THE TEST SURFACE ACTUALLY SHOWING TODAY'S CODE? (2026-09-08)
//
// The main tree (/home/citoviso/citoviso) follows origin/main on a per-minute
// timer and serves :4600 — the ONE surface the owner ever looks at. The sync
// guard refuses to update a DIRTY tree, which is correct (ADR-0052: the main
// tree is an integration point, not a workspace) but it refused IN SILENCE:
// the only trace was a line in a log file nobody reads.
//
// MEASURED: 2921 consecutive refusals over ~2 days, all caused by one generated
// file the weekly distiller writes into the tracked tree. Meanwhile the owner
// tested fixes that were not there, and reported them as broken. The fix for the
// FILE is a .gitignore entry; the fix for the SILENCE is this module — the same
// lesson as the rest of that day: a guard whose verdict never reaches a human is
// indistinguishable from a bug.
//
// Read-only: runs `git` in the main tree, never writes, never throws.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** The integration tree that serves :4600 (ADR-0052 §5 map). */
const MAIN_TREE = "/home/citoviso/citoviso";

export interface TreeFreshness {
  /** Commits on origin/main that the test surface does NOT have yet. */
  readonly behind: number;
  /** Tracked files blocking the sync — the reason it cannot catch up. */
  readonly dirtyFiles: readonly string[];
}

async function git(tree: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", ["-C", tree, ...args], { timeout: 5_000 });
  // trimEND only: `git status --porcelain` encodes the state in the FIRST TWO
  // COLUMNS, and a modified-but-unstaged file starts with a SPACE (" M path").
  // A plain trim() ate that space and the path came out as "EMORY.md" —
  // a warning naming a file that does not exist is worse than no warning.
  return stdout.trimEnd();
}

/**
 * How far the test surface has fallen behind, and why it cannot catch up.
 * Returns null when everything is current or git is unreadable — the chip is a
 * warning, so an unknown state must stay quiet rather than cry wolf.
 *
 * `tree` is a parameter ONLY so the negative case can be measured on a throwaway
 * clone: a staleness detector that has never been seen to fire is not evidence.
 */
export async function getTreeFreshness(tree: string = MAIN_TREE): Promise<TreeFreshness | null> {
  try {
    const behind = Number(await git(tree, ["rev-list", "--count", "HEAD..origin/main"]));
    if (!Number.isFinite(behind) || behind <= 0) return null;
    // Only TRACKED changes block the sync (the guard ignores untracked files),
    // so only those explain the block.
    const status = await git(tree, ["status", "--porcelain", "--untracked-files=no"]);
    // "XY path" — two status columns, one space, then the path (which may itself
    // contain spaces). Parsed by shape, not by a magic offset.
    const dirtyFiles = status
      ? status
          .split("\n")
          .map((l) => /^..\s(.+)$/.exec(l)?.[1]?.trim())
          .filter((f): f is string => Boolean(f))
          .slice(0, 5)
      : [];
    return { behind, dirtyFiles };
  } catch {
    return null; // no git, no tree, timeout — say nothing rather than guess
  }
}
