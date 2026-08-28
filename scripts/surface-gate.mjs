// Surface-plan gate — approval token store + CLI.
//
// The §2b design-approval gate is the one critical doctrine with no MACHINE gate: it is
// about ORDER (plan → owner-approval → CODE), and prose alone let momentum route around it
// (I self-granted the "apró javítás" exception and coded first). This turns the soft
// "MEGÁLLSZ ÉS VÁRSZ" into a hard, auditable token that surface-plan-scan.mjs enforces.
//
// KEY = the git branch: one worktree == one thread of surface work (feedback_working_mode:
// EGY szál egyszerre). Stored in the OS tmpdir (ephemeral, per-branch), NOT in the repo.
//
// This does NOT (cannot, in a single-agent setup) prove the owner said yes — but it makes
// the silent path IMPOSSIBLE: no surface edit happens without an explicit, reasoned,
// logged unlock, and `approve` refuses unless a fresh DESKTOP+MOBILE ui-shot pair exists
// (the exact rule — mobile+desktop at delivery — that just failed). Deliberate act, not
// a slip.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_SHOT_AGE_MS = 60 * 60 * 1000; // a plan shot older than an hour is not "fresh"

export function repoRoot(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return cwd;
  }
}

export function branchSlug(cwd = process.cwd()) {
  try {
    const b = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return b.replace(/[^a-zA-Z0-9_-]/g, "-") || "detached";
  } catch {
    return "nogit";
  }
}

export function tokenPath(cwd = process.cwd()) {
  return path.join(os.tmpdir(), `citoviso-surface-gate-${branchSlug(cwd)}.json`);
}

export function readToken(cwd = process.cwd()) {
  try {
    return JSON.parse(readFileSync(tokenPath(cwd), "utf8"));
  } catch {
    return null;
  }
}

/** Are there fresh ui-shot outputs for BOTH viewports? (mobile-first delivery rule.) */
export function freshShotPair(cwd = process.cwd()) {
  const dir = path.join(repoRoot(cwd), "assets", "Temp");
  let mobile = false;
  let desktop = false;
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".png")) continue;
      if (Date.now() - statSync(path.join(dir, f)).mtimeMs > MAX_SHOT_AGE_MS) continue;
      if (f.includes("-mobile")) mobile = true;
      if (f.includes("-desktop")) desktop = true;
    }
  } catch {
    /* no Temp dir → no shots */
  }
  return { mobile, desktop };
}

// --- CLI ---------------------------------------------------------------------------

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const note = rest.join(" ").trim();
  const cwd = process.cwd();
  const p = tokenPath(cwd);

  if (cmd === "status") {
    const tok = readToken(cwd);
    const { mobile, desktop } = freshShotPair(cwd);
    console.log(`ág: ${branchSlug(cwd)}`);
    console.log(`token: ${tok ? `${tok.mode} — ${tok.note ?? tok.reason ?? ""} (${tok.at})` : "nincs (a felület-kapu ZÁRVA)"}`);
    console.log(`friss shot: desktop=${desktop ? "✓" : "✗"} mobil=${mobile ? "✓" : "✗"}`);
    return;
  }

  if (cmd === "approve") {
    if (!note) die('Adj meg egy leírást: node scripts/surface-gate.mjs approve "mit hagyott jóvá a tulaj"');
    const { mobile, desktop } = freshShotPair(cwd);
    if (!mobile || !desktop) {
      die(
        `⛔ JÓVÁHAGYÁS ELUTASÍTVA — nincs friss DESKTOP+MOBIL terv-nézet (desktop=${desktop ? "✓" : "✗"} mobil=${mobile ? "✓" : "✗"}).\n` +
          "   A §2b: a tulaj csak azt hagyhatja jóvá, amit LÁT, mindkét nézeten. Előbb:\n" +
          "   npx tsx scripts/ui-shot.mts <fájl|/route>   (390px + desktop, assets/Temp/-be)",
      );
    }
    writeFileSync(
      p,
      JSON.stringify({ mode: "approved", note, at: new Date().toISOString(), branch: branchSlug(cwd) }, null, 1),
    );
    console.log(`✅ Felület-kapu NYITVA (approved) ehhez az ághoz: ${note}`);
    return;
  }

  if (cmd === "exception") {
    if (!note) die('Adj meg egy indokot: node scripts/surface-gate.mjs exception "miért apró/mintakövető"');
    writeFileSync(
      p,
      JSON.stringify({ mode: "exception", reason: note, at: new Date().toISOString(), branch: branchSlug(cwd) }, null, 1),
    );
    console.log(`✅ Felület-kapu NYITVA (exception, naplózott): ${note}`);
    console.log("   ⚠️ A kivétel a tulaj kimondott engedélye — ne magadnak add meg (ADR-0068).");
    return;
  }

  if (cmd === "clear") {
    if (existsSync(p)) unlinkSync(p);
    console.log("Felület-kapu visszazárva (token törölve).");
    return;
  }

  die(
    "Használat: node scripts/surface-gate.mjs <status | approve \"...\" | exception \"...\" | clear>\n" +
      "  status    — az ág kapu-állapota + friss-shot állapot\n" +
      "  approve   — a tulaj jóváhagyta a tervet (friss desktop+mobil shot KÖTELEZŐ)\n" +
      "  exception — a tulaj apró/mintakövető kivételt engedett (indokkal, naplózva)\n" +
      "  clear     — visszazárás",
  );
}

// Run as CLI only when invoked directly (not when imported by the hook).
if (import.meta.url === `file://${process.argv[1]}`) main();
