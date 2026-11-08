// KB-SHOT PASS CACHE (ADR-0432) — deploy GATE 1c/kép re-captures ONLY the help images whose
// INPUTS changed since a green comparison.
//
// WHY. `kb-shot.mts --check-committed` re-rendered and pixel-compared all ~70 guide images on
// every deploy (2026-11-08: 2–8 min depending on load), although a typical deploy range touches
// one or two screens. A picture is a pure function of its inputs — proven per run by
// `kb-shot.mts --determinism` (ADR-0220) — so when every input is byte-identical to a run whose
// capture matched the committed PNG, and the committed PNG is still that same file, the capture
// would match again. Only then is it skipped. Anything not provably identical is captured.
//
// THE INPUTS of one picture (all of them must match, or it is captured):
//   · GLOBAL — the generator and its settle/compare code (kb-shot.mts, kb-settle.mts,
//     png-pixel-diff.mts, this file), the committed font snapshot, the playwright-core version,
//     the Chromium version, the system font list (fc-list), the shot language;
//   · PER SHOT — the exact HTML handed to the browser (the checkout path normalised away), the
//     #hash, the shot's interaction arguments (click / scroll / element), the output path;
//   · RESOURCES — the bytes of every file the page loaded for the shot (observed requests, the
//     browser cache disabled, UNION every file:// reference written in the HTML). A shot that
//     requested anything that is not a local file or a font from the snapshot is never stored.
//   · the committed PNG's own sha256 (a changed or replaced committed image is always compared).
// Only a GREEN comparison is stored (by the --check-committed parent, per image). `--full`
// switches the cache off; the --determinism run never uses it.
//
// Where: <git-common-dir>/cit-kbshot-pass/<key>.json (KB_SHOT_PASS_DIR moves it — the self-test
// uses a private one). Entries older than 30 days are removed when new ones are written.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type Res = readonly [file: string, sha: string];
const ABSENT = "ABSENT";
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

const sha = (b: string | Buffer): string => createHash("sha256").update(b).digest("hex");
export function fileSha(file: string): string | null {
  try {
    return sha(readFileSync(file));
  } catch {
    return null;
  }
}

/** The cache directory, or null when it cannot be located (then nothing is skipped). */
export function passDir(cwd: string): string | null {
  if (process.env.KB_SHOT_PASS_DIR) return process.env.KB_SHOT_PASS_DIR;
  const r = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd, encoding: "utf8" });
  if (r.status !== 0 || !r.stdout.trim()) return null;
  return path.join(path.resolve(cwd, r.stdout.trim()), "cit-kbshot-pass");
}

function dirFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...dirFiles(p));
    else out.push(p);
  }
  return out.sort();
}

/** Everything a picture depends on that is the same for every shot of the run. */
export function globalFingerprint(root: string, browserVersion: string, lang: string): string {
  const h = createHash("sha256");
  h.update(`browser ${browserVersion}\nlang ${lang}\n`);
  for (const f of ["scripts/kb-shot.mts", "scripts/lib/kb-settle.mts", "scripts/lib/png-pixel-diff.mts", "scripts/lib/kb-shot-pass.mts"]) {
    h.update(`${f} ${fileSha(path.join(root, f)) ?? "MISSING"}\n`);
  }
  for (const f of dirFiles(path.join(root, "scripts/lib/kb-shot-fonts"))) h.update(`${path.relative(root, f)} ${fileSha(f)}\n`);
  for (const f of ["node_modules/playwright-core/package.json"]) h.update(`${f} ${fileSha(path.join(root, f)) ?? "MISSING"}\n`);
  const fc = spawnSync("fc-list", [], { encoding: "utf8" });
  h.update(`fc-list ${fc.status === 0 ? sha([...fc.stdout.split("\n")].sort().join("\n")) : "NONE"}\n`);
  return h.digest("hex");
}

/** The checkout path is not an input: the deploy gate renders in a random temp worktree. */
export function normalise(root: string, text: string): string {
  return text.split(pathToFileURL(root).href).join("@ROOT@").split(root).join("@ROOT@");
}

// The asset cache-buster (`?v=<process start ms>`, ASSET_V and friends) differs on every run and
// is ignored by a file:// load; the bytes it points at are in the resource list. Measured
// 2026-11-08: with it in the key, 66 of 67 shots missed between two identical runs.
const CACHE_BUSTER = /\?v=\d+/g;

export function shotKey(global: string, root: string, rel: string, html: string, extra: unknown): string {
  return sha(`${global}\n${rel}\n${JSON.stringify(extra ?? null)}\n${normalise(root, html).replace(CACHE_BUSTER, "?v=")}`);
}

const FILE_REF = /file:\/\/[^"'\s)<>]+/g;

/**
 * The resource list of one shot: every observed request plus every file:// URL in the HTML.
 * `fontFile` maps a Google Fonts URL to its committed snapshot file (null = not in the snapshot).
 * Returns null when the shot loaded something that is not a local file — such a shot is never cached.
 */
export function resources(
  root: string,
  html: string,
  requested: readonly string[],
  fontFile: (url: string) => string | null,
  /** The run's temp dir: the shot's own HTML file lives there, and it is already in the key. */
  ownDir: string,
): Res[] | null {
  const files = new Set<string>();
  for (const u of [...requested, ...(html.match(FILE_REF) ?? [])]) {
    if (u.startsWith("data:") || u.startsWith("about:") || u.startsWith("blob:")) continue;
    if (u.startsWith("file://")) {
      const clean = u.replace(/[?#].*$/, "");
      let p: string;
      try {
        p = fileURLToPath(clean);
      } catch {
        return null;
      }
      files.add(p);
      continue;
    }
    const f = fontFile(u);
    if (!f) return null;
    files.add(f);
  }
  const out: Res[] = [];
  for (const f of [...files].sort()) {
    if (f.startsWith(ownDir + path.sep)) continue;
    // A request for a file that does not exist (the views' server paths — /admin/modules/preview,
    // /lead/l1/photos — fail on file://) is a stable input too: recorded ABSENT, and it must
    // still be absent for a hit.
    out.push([normalise(root, f), fileSha(f) ?? ABSENT]);
  }
  return out;
}

interface Entry {
  readonly png: string;
  readonly res: readonly Res[];
  readonly at: string;
}

/** True only when a green entry exists for exactly these inputs AND the committed PNG is the one it was compared to. */
export function lookup(dir: string, key: string, root: string, rel: string): boolean {
  let e: Entry;
  try {
    e = JSON.parse(readFileSync(path.join(dir, `${key}.json`), "utf8")) as Entry;
  } catch {
    return false;
  }
  if (!e || typeof e.png !== "string" || !Array.isArray(e.res)) return false;
  if (fileSha(path.join(root, rel)) !== e.png) return false;
  for (const [f, s] of e.res) {
    if ((fileSha(f.replace(/^@ROOT@/, root)) ?? ABSENT) !== s) return false;
  }
  return true;
}

/** Store a GREEN comparison (the caller has just pixel-matched the capture to the committed PNG). */
export function store(dir: string, key: string, res: readonly Res[], root: string, rel: string): void {
  const png = fileSha(path.join(root, rel));
  if (!png) return;
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${key}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ png, res, at: new Date().toISOString() } satisfies Entry));
  renameSync(tmp, file);
}

export function prune(dir: string): void {
  if (!existsSync(dir)) return;
  const now = Date.now();
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    try {
      if (now - statSync(p).mtimeMs > MAX_AGE_MS) rmSync(p, { force: true });
    } catch {}
  }
}
