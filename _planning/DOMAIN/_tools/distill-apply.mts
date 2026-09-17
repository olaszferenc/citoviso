#!/usr/bin/env npx tsx
/**
 * Citoviso ontology distiller — CLOSING THE LOOP (step 5 of distill.sh).
 *
 * The distiller writes review documents into _inbox/. This tool turns those
 * reviews into a REVIEWABLE CHANGE on a throwaway branch, so the owner has to
 * DECIDE, not EDIT.
 *
 * What it does NOT do, on purpose:
 *   - it never writes the main worktree's ontology (that would block every
 *     other session's land),
 *   - it never pushes and never lands,
 *   - it never applies REFINE (canonical text overwrite) or DRIFT — those are
 *     human decisions; it only MEASURES whether they are still live,
 *   - it never guesses when the target is ambiguous: such blocks are
 *     quarantined into the pending-decisions document, never silently dropped.
 *
 * Safety model: DRY-RUN IS THE DEFAULT. Writing requires the explicit `--go`
 * flag. Any unknown flag is a hard error (a mistyped switch can never turn
 * into a live run).
 *
 * Usage:
 *   npx tsx _planning/DOMAIN/_tools/distill-apply.mts            # dry-run, writes nothing
 *   npx tsx _planning/DOMAIN/_tools/distill-apply.mts --go       # creates branch+worktree, commits
 *   npx tsx _planning/DOMAIN/_tools/distill-apply.mts --self-test
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// --------------------------------------------------------------------------
// types
// --------------------------------------------------------------------------

/** Files the tool is allowed to touch. Anything else is quarantined. */
const ALLOWED_TARGETS = [
  "00-GLOSSARY.md",
  "01-CALC-MODELS.md",
  "02-ENTITY-MAP.md",
  "03-INVARIANTS.md",
  "04-INDEX.md",
  "05-MODULES.md",
  "06-UI-CONTRACT.md",
] as const;

/** Heading markers that mean "the distiller itself was unsure" -> never auto-apply. */
const UNCERTAINTY_MARKERS = ["JUDGMENT", "jobb helye", "inkább SKIP", "?)"];

type PromoteStatus = "apply" | "quarantine" | "duplicate";

interface PromoteBlock {
  review: string;
  line: number;
  heading: string;
  target: string | null;
  location: string;
  sources: string;
  body: string;
  hash: string;
  status: PromoteStatus;
  /** Human-readable reasons for quarantine / placement notes. */
  notes: string[];
  /** Resolved anchor section heading in the target file, if any. */
  anchor: string | null;
}

type RefineStatus =
  | "LIVE" // OLD literal found exactly once -> the refine still applies
  | "REFORMATTED" // the text is still there, only its markdown formatting changed
  | "STALE" // OLD literal not found at all -> ontology already moved on
  | "AMBIGUOUS" // OLD literal found more than once
  | "ELLIPSIZED" // OLD contains "…" -> not a literal, cannot be measured
  | "UNPARSEABLE" // OLD is prose / multi-line / no backticks
  | "NO-TARGET"; // target file unknown

interface RefineBlock {
  review: string;
  line: number;
  heading: string;
  target: string | null;
  location: string;
  sources: string;
  oldRaw: string;
  oldLiteral: string | null;
  newRaw: string;
  why: string;
  status: RefineStatus;
}

interface FreeItem {
  review: string;
  section: "DRIFT" | "ARCHIVE";
  text: string;
}

interface ParsedReview {
  file: string;
  promote: PromoteBlock[];
  refine: RefineBlock[];
  free: FreeItem[];
  /** Count of `###` headings seen under PROMOTE/REFINE, for the accounting check. */
  headingCount: { promote: number; refine: number };
  /** [from,to] line spans of every parsed block, for the reconciliation check. */
  blockSpans: Array<[number, number]>;
  /** [from,to] line spans of the PROMOTE/REFINE sections. */
  sectionSpans: Array<[number, number]>;
  /** Raw text, kept so the reconciliation can re-scan it independently. */
  raw: string;
}

/**
 * Independent reconciliation: re-scans the raw document for `### ` headings
 * WITHOUT any fence logic, and demands that the structured parse explain every
 * single one of them inside the PROMOTE/REFINE sections.
 *
 * This deliberately does not reuse the parser's own fence state — a parser that
 * silently swallowed a block would leave an unexplained heading here. (An
 * earlier version of this check compared two numbers that both came from the
 * same parse, so it could never fail.)
 */
function reconcile(p: ParsedReview): string[] {
  const problems: string[] = [];
  const lines = p.raw.split("\n");
  const inSpan = (n: number, spans: Array<[number, number]>) =>
    spans.some(([a, b]) => n >= a && n <= b);

  // Fence balance. An odd number of fence lines means some block runs on into
  // the rest of the document — the parse cannot be trusted at all. Measured:
  // deleting a single closing fence made 13 blocks collapse into 1, and the
  // heading reconciliation alone did NOT notice (the swallowed headings looked
  // like legitimate body content).
  const fences = lines.filter((l) => /^\s*```/.test(l)).length;
  if (fences % 2 !== 0) {
    problems.push(
      `${p.file} — PÁRATLAN számú (${fences}) kódblokk-kerítés: valahol lezáratlan a ` +
        `blokk, a review sérült. Nem dolgozom fel.`,
    );
  }

  lines.forEach((l, i) => {
    if (!/^###\s+/.test(l)) return;
    const n = i + 1;
    if (!inSpan(n, p.sectionSpans)) return; // outside PROMOTE/REFINE: not our business
    if (!inSpan(n, p.blockSpans)) {
      problems.push(`${p.file}:${n} — a ### fejlécet a parser NEM számolta el: ${l.slice(0, 70)}`);
    }
  });
  return problems;
}

// --------------------------------------------------------------------------
// tiny helpers
// --------------------------------------------------------------------------

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function die(msg: string, code = 2): never {
  process.stderr.write(`\n⛔ ${msg}\n`);
  process.exit(code);
}

/** Normalizes a body for duplicate detection: whitespace-insensitive. */
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Normalizes away markdown emphasis so a re-formatted rule still matches.
 * Measured need: `§F.17b` was reported "gone" only because someone wrapped the
 * sentence in `**bold**`. Calling that "stale" would tell the owner to drop a
 * proposal that is in fact still live.
 */
const deformat = (s: string) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();

// --------------------------------------------------------------------------
// PARSER — fence aware
// --------------------------------------------------------------------------

/**
 * Splits a review document into its `## SECTION` parts, ignoring every line
 * inside a fenced code block.
 *
 * This is the load-bearing part: real reviews contain `###` and `##` headings
 * INSIDE ```append blocks (measured: 20260913T020001Z.md lines 277 and 283).
 * A naive heading scan would cut those blocks in half and silently corrupt the
 * promoted text.
 */
function splitSections(text: string): Map<string, { line: number; lines: string[] }> {
  const out = new Map<string, { line: number; lines: string[] }>();
  const lines = text.split("\n");
  let inFence = false;
  let current: { name: string; line: number; lines: string[] } | null = null;

  lines.forEach((raw, i) => {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      if (current) current.lines.push(raw);
      return;
    }
    if (!inFence) {
      const m = /^##\s+([A-ZÁÉÍÓÖŐÚÜŰ]+)\b/.exec(raw);
      if (m) {
        if (current) out.set(current.name, { line: current.line, lines: current.lines });
        current = { name: m[1], line: i + 1, lines: [] };
        return;
      }
    }
    if (current) current.lines.push(raw);
  });
  if (current) {
    const c = current as { name: string; line: number; lines: string[] };
    out.set(c.name, { line: c.line, lines: c.lines });
  }
  return out;
}

/** Splits a section body into `### ...` blocks (fence aware). */
function splitBlocks(
  lines: string[],
  baseLine: number,
): Array<{ heading: string; line: number; lines: string[] }> {
  const out: Array<{ heading: string; line: number; lines: string[] }> = [];
  let inFence = false;
  let cur: { heading: string; line: number; lines: string[] } | null = null;

  lines.forEach((raw, i) => {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      if (cur) cur.lines.push(raw);
      return;
    }
    if (!inFence && /^###\s+/.test(raw)) {
      if (cur) out.push(cur);
      cur = { heading: raw.replace(/^###\s+/, "").trim(), line: baseLine + i + 1, lines: [] };
      return;
    }
    if (cur) cur.lines.push(raw);
  });
  if (cur) out.push(cur);
  return out;
}

/**
 * Extracts the content of the first ```append fence in a block.
 *
 * A fence that is never closed is NOT a valid body: it means the document is
 * malformed and the "body" would silently run on into the rest of the review.
 * Such a block is reported as unterminated, never accepted.
 */
function extractAppendBody(lines: string[]): {
  body: string | null;
  sawOtherFence: boolean;
  unterminated: boolean;
} {
  let inFence = false;
  let isAppend = false;
  let sawOtherFence = false;
  const buf: string[] = [];
  let closed = false;
  let opened = false;

  for (const raw of lines) {
    const fence = /^\s*```(.*)$/.exec(raw);
    if (fence) {
      if (!inFence) {
        inFence = true;
        isAppend = fence[1].trim().toLowerCase() === "append";
        if (isAppend && !opened) opened = true;
        if (!isAppend) sawOtherFence = true;
      } else {
        inFence = false;
        if (isAppend && !closed) closed = true;
        isAppend = false;
      }
      continue;
    }
    if (inFence && isAppend && !closed) buf.push(raw);
  }
  const unterminated = inFence || (opened && !closed);
  if (unterminated) return { body: null, sawOtherFence, unterminated: true };
  if (!closed) return { body: null, sawOtherFence, unterminated: false };
  return { body: buf.join("\n").replace(/\s+$/, ""), sawOtherFence, unterminated: false };
}

/** `03-INVARIANTS.md → §B (a 17. pont UTÁN)` -> target + location. */
function parseHeading(heading: string): { target: string | null; location: string; mdRefs: string[] } {
  const mdRefs = (heading.match(/\b\d\d-[A-Z0-9-]+\.md\b/g) ?? []) as string[];
  const arrow = heading.indexOf("→");
  const firstRef = mdRefs[0] ?? null;
  const location = arrow >= 0 ? heading.slice(arrow + 1).trim() : heading.trim();
  return { target: firstRef, location, mdRefs: Array.from(new Set(mdRefs)) };
}

function grabLine(lines: string[], label: RegExp): string {
  for (const l of lines) {
    const m = label.exec(l);
    if (m) return l.slice(m[0].length).trim();
  }
  return "";
}

/**
 * Extracts a verbatim literal from a REFINE `OLD:` line.
 * Returns null when the value is prose, multi-line or ellipsized — those
 * cannot be measured and MUST NOT be reported as "stale".
 */
function extractOldLiteral(oldRaw: string): { literal: string | null; why: RefineStatus | null } {
  const t = oldRaw.trim();
  if (!t) return { literal: null, why: "UNPARSEABLE" };
  const first = t.indexOf("`");
  const last = t.lastIndexOf("`");
  if (first < 0 || last <= first) return { literal: null, why: "UNPARSEABLE" };
  // Anything outside the backticks that is not whitespace means prose framing
  // like "(a fenti bekezdés VÁLTOZATLAN, plusz …) `...`" -> not a clean literal.
  const before = t.slice(0, first).trim();
  const after = t.slice(last + 1).trim();
  if (before || after) return { literal: null, why: "UNPARSEABLE" };
  const lit = t.slice(first + 1, last);
  if (lit.includes("…") || lit.includes("...")) return { literal: null, why: "ELLIPSIZED" };
  if (!lit.trim()) return { literal: null, why: "UNPARSEABLE" };
  return { literal: lit, why: null };
}

function parseReview(file: string, text: string): ParsedReview {
  const sections = splitSections(text);
  const promote: PromoteBlock[] = [];
  const refine: RefineBlock[] = [];
  const free: FreeItem[] = [];
  const headingCount = { promote: 0, refine: 0 };
  const blockSpans: Array<[number, number]> = [];
  const sectionSpans: Array<[number, number]> = [];

  const pro = sections.get("PROMOTE");
  if (pro) {
    sectionSpans.push([pro.line, pro.line + pro.lines.length]);
    const blocks = splitBlocks(pro.lines, pro.line);
    headingCount.promote = blocks.length;
    for (const b of blocks) {
      blockSpans.push([b.line, b.line + b.lines.length]);
      const { target, location, mdRefs } = parseHeading(b.heading);
      const { body, sawOtherFence, unterminated } = extractAppendBody(b.lines);
      const notes: string[] = [];
      let status: PromoteStatus = "apply";

      if (!target || !ALLOWED_TARGETS.includes(target as (typeof ALLOWED_TARGETS)[number])) {
        notes.push(`ismeretlen cél-fájl a fejlécben (${target ?? "nincs"})`);
        status = "quarantine";
      }
      if (mdRefs.length > 1) {
        notes.push(`a fejléc TÖBB cél-fájlt nevez meg (${mdRefs.join(", ")}) — ember dönti el`);
        status = "quarantine";
      }
      for (const mark of UNCERTAINTY_MARKERS) {
        if (b.heading.includes(mark)) {
          notes.push(`a desztilláló maga jelölte bizonytalannak („${mark}")`);
          status = "quarantine";
        }
      }
      if (!body) {
        notes.push(
          unterminated
            ? "LEZÁRATLAN ```append kódblokk — a review sérült, nem tudom, hol ér véget a szöveg"
            : sawOtherFence
              ? "van kódblokk, de NEM ```append — nem tudom, mit kellene átvezetni"
              : "nincs ```append kódblokk a blokkban",
        );
        status = "quarantine";
      }

      promote.push({
        review: file,
        line: b.line,
        heading: b.heading,
        target,
        location,
        sources: grabLine(b.lines, /^\s*(?:\*\*)?Source:?(?:\*\*)?\s*/i),
        body: body ?? "",
        hash: body ? sha(`${target} ${normalize(body)}`) : sha(`${file}:${b.line}`),
        status,
        notes,
        anchor: null,
      });
    }
  }

  const ref = sections.get("REFINE");
  if (ref) {
    sectionSpans.push([ref.line, ref.line + ref.lines.length]);
    const blocks = splitBlocks(ref.lines, ref.line);
    headingCount.refine = blocks.length;
    for (const b of blocks) {
      blockSpans.push([b.line, b.line + b.lines.length]);
      const { target, location } = parseHeading(b.heading);
      const oldRaw = grabLine(b.lines, /^\s*[-*]\s*(?:\*\*)?OLD:?(?:\*\*)?:?\s*/i);
      const newRaw = grabLine(b.lines, /^\s*[-*]\s*(?:\*\*)?NEW:?(?:\*\*)?:?\s*/i);
      const why = grabLine(b.lines, /^\s*[-*]\s*(?:\*\*)?WHY:?(?:\*\*)?:?\s*/i);
      const { literal, why: badWhy } = extractOldLiteral(oldRaw);
      refine.push({
        review: file,
        line: b.line,
        heading: b.heading,
        target,
        location,
        sources: grabLine(b.lines, /^\s*(?:\*\*)?Source:?(?:\*\*)?\s*/i),
        oldRaw,
        oldLiteral: literal,
        newRaw,
        why,
        status: badWhy ?? "LIVE", // refined against the real file later
      });
    }
  }

  for (const name of ["DRIFT", "ARCHIVE"] as const) {
    const s = sections.get(name);
    if (!s) continue;
    for (const l of s.lines) {
      const t = l.trim();
      if (/^[-*]\s+\S/.test(t) && !/^\*\(nincs/.test(t)) {
        free.push({ review: file, section: name, text: t.replace(/^[-*]\s+/, "") });
      }
    }
  }

  return { file, promote, refine, free, headingCount, blockSpans, sectionSpans, raw: text };
}

// --------------------------------------------------------------------------
// ANCHOR RESOLUTION — where inside the target file does the block go?
// --------------------------------------------------------------------------

interface Anchor {
  heading: string;
  /** index of the line AFTER the last content line of the section */
  insertAt: number;
}

/**
 * Resolves the `§X` / quoted-heading anchor named in the review's location
 * text against the real target file.
 *
 * Deterministic and checkable: either exactly one `## ` heading matches, or we
 * fall back to end-of-file. It never picks "the closest" heading.
 */
function resolveAnchor(fileLines: string[], location: string): Anchor | null {
  const headingIdx: number[] = [];
  let inFence = false;
  fileLines.forEach((l, i) => {
    if (/^\s*```/.test(l)) inFence = !inFence;
    else if (!inFence && /^##\s+/.test(l)) headingIdx.push(i);
  });

  const endOf = (hi: number): number => {
    const next = headingIdx.find((x) => x > hi);
    let end = next === undefined ? fileLines.length : next;
    while (end > hi + 1 && fileLines[end - 1].trim() === "") end--;
    return end;
  };

  // 1. section symbol: §B, §D.10 -> letter B / D
  const symbols = Array.from(location.matchAll(/§([A-Z])/g)).map((m) => m[1]);
  const uniq = Array.from(new Set(symbols));
  if (uniq.length === 1) {
    const letter = uniq[0];
    const hits = headingIdx.filter((i) => new RegExp(`^##\\s+§${letter}\\b`).test(fileLines[i]));
    if (hits.length === 1) {
      return { heading: fileLines[hits[0]].replace(/^##\s+/, "").trim(), insertAt: endOf(hits[0]) };
    }
    return null; // 0 hits = brand new section; >1 = ambiguous. Both -> end of file.
  }
  if (uniq.length > 1) return null;

  // 2. an explicitly named heading, in decreasing order of confidence:
  //    a) a backticked `## Heading`, b) a quoted „Heading", c) the leading
  //    words of the location text. Each candidate must match EXACTLY ONE
  //    heading by prefix; anything else falls through to end-of-file.
  const candidates: string[] = [];
  for (const m of location.matchAll(/`##\s+([^`]{3,80})`/g)) candidates.push(m[1]);
  for (const m of location.matchAll(/[„"']([^"'”„]{3,60})[”"']/g)) candidates.push(m[1]);
  // leading words, progressively trimmed at the usual punctuation
  const lead = location.replace(/^(új\s+szekció|új\s+szakasz)\s*[:—-]?\s*/i, "").trim();
  for (const cut of [lead, lead.split(" → ")[0], lead.split(",")[0], lead.split(" (")[0]]) {
    if (cut && cut.length >= 8) candidates.push(cut);
  }

  for (const raw of candidates) {
    const q = raw.trim().toLowerCase();
    if (q.length < 8) continue;
    const hits = headingIdx.filter((i) =>
      fileLines[i].replace(/^##\s+/, "").trim().toLowerCase().startsWith(q),
    );
    if (hits.length === 1) {
      return { heading: fileLines[hits[0]].replace(/^##\s+/, "").trim(), insertAt: endOf(hits[0]) };
    }
  }
  return null;
}

// --------------------------------------------------------------------------
// RENDERING
// --------------------------------------------------------------------------

const MARK_BEGIN = "<!-- distill:begin";
const MARK_END = "<!-- distill:end -->";

function renderInsert(b: PromoteBlock, stamp: string): string[] {
  const src = b.sources ? b.sources : "(nincs megjelölve)";
  return [
    "",
    `${MARK_BEGIN} ${b.hash} ${stamp} -->`,
    `### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (${stamp})`,
    `> **Kért hely a review szerint:** ${b.location}`,
    `> **Forrás-memória:** ${src}`,
    `> **Review:** \`_inbox/${b.review}\` (${b.line}. sor)`,
    `> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = ` +
      `a keret-kommentek és ez az idézet-blokk törlése.`,
    "",
    b.body,
    MARK_END,
    "",
  ];
}

// --------------------------------------------------------------------------
// THE BRANCH THE OWNER HAS TO JUDGE — one source, two readers
// --------------------------------------------------------------------------

/**
 * Slug / branch / worktree / pending-file for a given review stamp.
 *
 * ⛔ EXPORTED ON PURPOSE. The notifier (`notify.sh` → `notify.mts`) has to name these exact
 * paths in the message it sends: an alert that says "there is something" without saying WHERE
 * is the same silence we are fixing. It cannot read them from this script's output either —
 * `distill.sh` deletes `.apply-out.txt` (line 146) BEFORE the notify hook runs (line 153).
 * So the choice was: recompute them there, or share them. A rule in two copies becomes two
 * truths (the house has several recorded cases), and here the second truth would be a wrong
 * path in the one message whose whole job is to be actionable. Hence: one function, two callers.
 */
export interface BranchPaths {
  readonly slug: string;
  readonly branch: string;
  readonly wtDir: string;
  readonly pendingPath: string;
}

export function branchPaths(stamp: string, branchDirRoot: string): BranchPaths {
  const slug = `distill${stamp.slice(0, 8)}`; // hyphen-free slug (CLAUDE.md §8)
  const wtDir = path.join(branchDirRoot, slug);
  return {
    slug,
    branch: `wt/${slug}`,
    wtDir,
    pendingPath: path.join(wtDir, "_planning", "DOMAIN", "_tools", "DISTILL-PENDING.md"),
  };
}

// --------------------------------------------------------------------------
// MAIN PIPELINE
// --------------------------------------------------------------------------

interface Options {
  go: boolean;
  repo: string;
  domainDir: string;
  inboxDir: string;
  ledger: string;
  branchDirRoot: string;
  stamp: string;
  reviewFilter: string | null;
  selfTest: boolean;
}

/** Stamps already recorded in `_inbox/applied/` — the house ledger. */
function appliedStamps(inbox: string): Set<string> {
  const dir = path.join(inbox, "applied");
  if (!fs.existsSync(dir)) return new Set();
  const out = new Set<string>();
  for (const f of fs.readdirSync(dir)) {
    const m = /^(\d{8}T\d{6}Z)/.exec(f);
    if (m) out.add(m[1]);
  }
  return out;
}

/**
 * Pending reviews = `_inbox/*.md` whose stamp is NOT yet in `_inbox/applied/`.
 *
 * `applied/` is the ledger the rest of the house already uses (it is committed,
 * unlike the review docs themselves, which are gitignored). Editing the DOMAIN
 * files does NOT mark a review processed — only the applied/ copy does.
 */
function listReviews(inbox: string, filter: string | null): string[] {
  if (!fs.existsSync(inbox)) return [];
  const done = appliedStamps(inbox);
  return fs
    .readdirSync(inbox)
    .filter((f) => /^\d{8}T\d{6}Z\.md$/.test(f))
    .filter((f) => !done.has(f.slice(0, 16)))
    .filter((f) => (filter ? f.includes(filter) : true))
    .sort();
}

function run(opts: Options): number {
  const reviews = listReviews(opts.inboxDir, opts.reviewFilter);
  if (opts.reviewFilter) {
    process.stdout.write(
      `⚠️  SZŰKÍTVE: csak a „${opts.reviewFilter}" mintára illeszkedő review-k futnak ` +
        `(${reviews.length} db) — ez NEM teljes futás.\n`,
    );
  }
  if (reviews.length === 0) {
    process.stdout.write("Nincs feldolgozandó review az _inbox/-ban.\n");
    return 0;
  }

  const parsed: ParsedReview[] = [];
  for (const r of reviews) {
    parsed.push(parseReview(r, fs.readFileSync(path.join(opts.inboxDir, r), "utf8")));
  }

  // --- independent reconciliation: no heading may go unaccounted -----------
  const problems = parsed.flatMap(reconcile);
  if (problems.length > 0) {
    die(
      `a bemenet ellenőrzése ${problems.length} problémát talált — a parse nem megbízható, ` +
        `NEM írok semmit:\n  ` +
        problems.slice(0, 10).join("\n  "),
    );
  }

  const promoteAll = parsed.flatMap((p) => p.promote);
  const refineAll = parsed.flatMap((p) => p.refine);

  // --- duplicate detection --------------------------------------------------
  // Idempotency is decided by CONTENT, not by a side ledger: a block is "done"
  // when its text is already in the target file (accepted+landed), or when its
  // marker is already in the branch (same run repeated). Deliberately NOT
  // gated on the ledger — if the owner throws the branch away, the proposal
  // must come back, not vanish silently.
  const seen = new Set<string>();
  for (const b of promoteAll) {
    if (b.status !== "apply") continue;
    if (seen.has(b.hash)) {
      b.status = "duplicate";
      b.notes.push("ugyanez a blokk egy korábbi review-ban is szerepel");
      continue;
    }
    seen.add(b.hash);
  }

  // --- resolve targets against the REAL ontology ---------------------------
  const fileCache = new Map<string, string[]>();
  const readTarget = (t: string): string[] | null => {
    if (fileCache.has(t)) return fileCache.get(t)!;
    const p = path.join(opts.domainDir, t);
    if (!fs.existsSync(p)) return null;
    const lines = fs.readFileSync(p, "utf8").split("\n");
    fileCache.set(t, lines);
    return lines;
  };

  for (const b of promoteAll) {
    if (b.status !== "apply" || !b.target) continue;
    const lines = readTarget(b.target);
    if (!lines) {
      b.status = "quarantine";
      b.notes.push(`a cél-fájl nem létezik: ${b.target}`);
      continue;
    }
    const joined = lines.join("\n");
    if (normalize(joined).includes(normalize(b.body))) {
      b.status = "duplicate";
      b.notes.push("a szövege MÁR benne van a cél-fájlban");
      continue;
    }
    const a = resolveAnchor(lines, b.location);
    b.anchor = a ? a.heading : null;
    if (!a) b.notes.push("nem oldható fel szakasz-horgony → a fájl VÉGÉRE kerül");
  }

  // --- measure REFINE staleness against the real ontology ------------------
  for (const r of refineAll) {
    if (r.status === "ELLIPSIZED" || r.status === "UNPARSEABLE") continue;
    if (!r.target || !ALLOWED_TARGETS.includes(r.target as (typeof ALLOWED_TARGETS)[number])) {
      r.status = "NO-TARGET";
      continue;
    }
    const lines = readTarget(r.target);
    if (!lines) {
      r.status = "NO-TARGET";
      continue;
    }
    const hay = lines.join("\n");
    const needle = r.oldLiteral!;
    const countOf = (h: string, n: string): number => {
      if (!n) return 0;
      let c = 0;
      let i = h.indexOf(n);
      while (i >= 0) {
        c++;
        i = h.indexOf(n, i + 1);
      }
      return c;
    };
    const count = countOf(hay, needle);
    if (count === 1) r.status = "LIVE";
    else if (count > 1) r.status = "AMBIGUOUS";
    else {
      // Second pass, formatting-insensitive: "not found verbatim" is NOT the
      // same claim as "no longer in the ontology".
      const soft = countOf(deformat(hay), deformat(needle));
      r.status = soft >= 1 ? "REFORMATTED" : "STALE";
    }
  }

  // --- summary -------------------------------------------------------------
  const toApply = promoteAll.filter((b) => b.status === "apply");
  const quarantined = promoteAll.filter((b) => b.status === "quarantine");
  const dups = promoteAll.filter((b) => b.status === "duplicate");

  process.stdout.write(
    [
      "",
      `# Desztilláló — átvezetés ${opts.go ? "(ÉLES: --go)" : "(SZÁRAZ FUTÁS — semmit nem írok)"}`,
      "",
      `Review-k: ${reviews.length} db (${reviews[0]} … ${reviews[reviews.length - 1]})`,
      `PROMOTE blokkok: ${promoteAll.length} — ` +
        `átvezethető ${toApply.length} · már megvan ${dups.length} · ember-döntés ${quarantined.length}`,
      `REFINE blokkok: ${refineAll.length} — ` +
        `ÉLŐ ${refineAll.filter((r) => r.status === "LIVE").length} · ` +
        `ÁTFOGALMAZOTT ${refineAll.filter((r) => r.status === "REFORMATTED").length} · ` +
        `NEM TALÁLHATÓ ${refineAll.filter((r) => r.status === "STALE").length} · ` +
        `mérhetetlen ${refineAll.filter((r) => ["ELLIPSIZED", "UNPARSEABLE", "AMBIGUOUS", "NO-TARGET"].includes(r.status)).length}` +
        "  (egyik sem kerül be automatikusan)",
      `DRIFT / ARCHIVE tételek: ${parsed.reduce((a, p) => a + p.free.length, 0)} (mind javaslat marad)`,
      "",
    ].join("\n"),
  );

  const byTarget = new Map<string, PromoteBlock[]>();
  for (const b of toApply) {
    const k = b.target!;
    if (!byTarget.has(k)) byTarget.set(k, []);
    byTarget.get(k)!.push(b);
  }
  for (const [t, blocks] of Array.from(byTarget).sort()) {
    process.stdout.write(`  ${t}: ${blocks.length} blokk\n`);
    for (const b of blocks) {
      process.stdout.write(
        `    - ${b.anchor ? `[${b.anchor}]` : "[FÁJL VÉGE]"} ← ${b.location} (${b.review})\n`,
      );
    }
  }
  process.stdout.write("\n");

  if (!opts.go) {
    process.stdout.write(
      [
        "SZÁRAZ FUTÁS VÉGE — nem jött létre ág, worktree, fájl vagy ledger-bejegyzés.",
        "Éles átvezetés:  npx tsx _planning/DOMAIN/_tools/distill-apply.mts --go",
        "",
      ].join("\n"),
    );
    return 0;
  }

  // ------------------------------------------------------------------ --go --
  const { slug, branch, wtDir } = branchPaths(opts.stamp, opts.branchDirRoot);

  const git = (args: string[], cwd: string) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

  if (!fs.existsSync(wtDir)) {
    const existing = git(["branch", "--list", branch], opts.repo);
    const addArgs = existing
      ? ["worktree", "add", wtDir, branch]
      : ["worktree", "add", "-b", branch, wtDir, "HEAD"];
    git(addArgs, opts.repo);
    process.stdout.write(`Worktree létrehozva: ${wtDir} (${branch})\n`);
  } else {
    process.stdout.write(`Meglévő worktree használata: ${wtDir}\n`);
  }

  const wtDomain = path.join(wtDir, "_planning", "DOMAIN");
  const touched: string[] = [];
  let inserted = 0;

  for (const [t, blocks0] of Array.from(byTarget).sort()) {
    const p = path.join(wtDomain, t);
    const existing = fs.readFileSync(p, "utf8");
    // Re-entrancy: if a previous (possibly crashed) run already inserted this
    // exact block into this branch, do not insert it a second time.
    const blocks = blocks0.filter((b) => !existing.includes(`${MARK_BEGIN} ${b.hash}`));
    const already = blocks0.length - blocks.length;
    if (already > 0) process.stdout.write(`  ${t}: ${already} blokk már bent van ebben az ágban\n`);
    if (blocks.length === 0) continue;
    let lines = existing.split("\n");
    // Insert from the bottom up so earlier offsets stay valid.
    const placed = blocks
      .map((b) => {
        const a = resolveAnchor(lines, b.location);
        return { b, at: a ? a.insertAt : lines.length };
      })
      .sort((x, y) => y.at - x.at);
    for (const { b, at } of placed) {
      lines = [...lines.slice(0, at), ...renderInsert(b, opts.stamp), ...lines.slice(at)];
    }
    fs.writeFileSync(p, lines.join("\n"));
    touched.push(`_planning/DOMAIN/${t}`);
    inserted += blocks.length;

    // --- post-condition: every block must be findable inside its file ------
    const after = fs.readFileSync(p, "utf8");
    for (const b of blocks) {
      if (!after.includes(`${MARK_BEGIN} ${b.hash}`)) {
        die(`utó-feltétel bukott: a ${b.hash} blokk NINCS benne a ${t}-ben az írás után`);
      }
      if (!normalize(after).includes(normalize(b.body))) {
        die(`utó-feltétel bukott: a ${b.hash} blokk TÖRZSE csonkult a ${t}-ben`);
      }
    }
  }

  if (inserted === 0) {
    process.stdout.write(
      `\nNincs új átvezetendő tétel — a ${branch} ág már mindent tartalmaz. ` +
        `Nem írok és nem commitolok.\n\n`,
    );
    return 0;
  }

  // --- pending-decisions document (committed, so it shows up in the diff) ---
  const { pendingPath } = branchPaths(opts.stamp, opts.branchDirRoot);
  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, renderPending(opts, reviews, refineAll, quarantined, parsed));
  touched.push("_planning/DOMAIN/_tools/DISTILL-PENDING.md");

  // --- ledger copies into _inbox/applied/ ----------------------------------
  // These ride ON THE BRANCH on purpose: they land exactly when the owner
  // accepts, and never if the branch is thrown away. Marking a review
  // "processed" at proposal time would turn the freshness guard green while
  // nothing had actually been decided — a false green.
  const appliedDir = path.join(wtDomain, "_inbox", "applied");
  fs.mkdirSync(appliedDir, { recursive: true });
  for (const r of reviews) {
    fs.copyFileSync(path.join(opts.inboxDir, r), path.join(appliedDir, r));
    touched.push(`_planning/DOMAIN/_inbox/applied/${r}`);
  }

  // Explicit file list only — `git add .` is forbidden (parallel sessions).
  git(["add", "--", ...touched], wtDir);
  const msg =
    `docs(ontológia): desztillált javaslatok átvezetve (${opts.stamp}) — ` +
    `${toApply.length} blokk, JÓVÁHAGYÁSRA VÁR\n\n` +
    `Gépi átvezetés: _planning/DOMAIN/_tools/distill-apply.mts --go\n` +
    `Forrás: ${reviews.length} review az _inbox/-ból.\n` +
    `REFINE/DRIFT NEM került be automatikusan — lásd _tools/DISTILL-PENDING.md.\n` +
    `⛔ Ez az ág NINCS pusholva és NINCS landolva; a tulaj dönt.\n`;
  git(["commit", "-m", msg], wtDir);
  const head = git(["rev-parse", "--short", "HEAD"], wtDir);

  // --- ledger: append-only AUDIT LOG (not a skip-gate, see above) ----------
  fs.mkdirSync(path.dirname(opts.ledger), { recursive: true });
  fs.appendFileSync(
    opts.ledger,
    `# ${opts.stamp} -> ${branch} ${head}\n` +
      toApply.map((b) => `${b.hash}  ${b.review}  ${b.target}`).join("\n") +
      "\n",
  );

  process.stdout.write(
    [
      "",
      `✅ ÁTVEZETVE — ág: ${branch} (${head}), worktree: ${wtDir}`,
      `   ⛔ NINCS pusholva, NINCS landolva.`,
      "",
      "── A TULAJ DOLGA — három parancs ───────────────────────────────────────",
      `  1) Mit változna?     git -C ${wtDir} diff HEAD~1 --stat`,
      `                       git -C ${wtDir} diff HEAD~1`,
      `  2) Ember-döntések:   less ${pendingPath}`,
      `  3a) ELFOGADOM  →     cd ${wtDir} && bash scripts/land.sh`,
      `       (a landolás viszi az _inbox/applied/ bejegyzéseket is — ettől lesz zöld a`,
      `        frissesség-őr; ha eldobod az ágat, az helyesen PIROS marad)`,
      `  3b) ELDOBOM    →     git -C ${opts.repo} worktree remove --force ${wtDir} && \\`,
      `                       git -C ${opts.repo} branch -D ${branch}`,
      "────────────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );

  // If earlier weeks' branches were never accepted, their proposals are also
  // in THIS branch (nothing landed, so nothing counts as done). Say so, rather
  // than leaving the owner to guess which branch is current.
  const others = git(["branch", "--list", "wt/distill*"], opts.repo)
    .split("\n")
    .map((l) => l.replace(/^[*+]?\s*/, "").trim())
    .filter((l) => l && l !== branch);
  if (others.length > 0) {
    process.stdout.write(
      `ℹ️  Van ${others.length} korábbi, el nem fogadott desztilláló-ág: ${others.join(", ")}\n` +
        `   Ezek tételei ebben az ágban IS benne vannak (semmi nem landolt), tehát a ${branch} a\n` +
        `   teljes kép — a régiek nyugodtan törölhetők: git -C ${opts.repo} branch -D ${others.join(" ")}\n\n`,
    );
  }
  return 0;
}

function renderPending(
  opts: Options,
  reviews: string[],
  refine: RefineBlock[],
  quarantined: PromoteBlock[],
  parsed: ParsedReview[],
): string {
  const L: string[] = [];
  L.push(`# Desztilláló — EMBER-DÖNTÉST IGÉNYLŐ TÉTELEK (${opts.stamp})`);
  L.push("");
  L.push(
    "> Ezt a fájlt a `_tools/distill-apply.mts` generálta. Ami itt van, azt a gép " +
      "**szándékosan NEM vezette át** — mindegyik döntést igényel. A gép csak MEGMÉRTE, " +
      "hogy az állítás ma is áll-e.",
  );
  L.push("");
  L.push(`Feldolgozott review-k (${reviews.length}): ${reviews.map((r) => `\`${r}\``).join(", ")}`);
  L.push("");

  L.push("## REFINE — kanonikus szöveg felülírása (a legkockázatosabb művelet)");
  L.push("");
  L.push(
    "A gép azt mérte meg, hogy az `OLD:` szöveg **szó szerint megvan-e még** a cél-fájlban:",
  );
  L.push("");
  L.push("- **ÉLŐ** — pontosan egyszer megvan → a javaslat ma is érvényes, dönteni kell róla.");
  L.push(
    "- **ÁTFOGALMAZOTT** — a mondat megvan, de a formázása/szövege azóta változott → a javaslat " +
      "valószínűleg ÉL, csak kézzel kell illeszteni. ⚠️ NEM ejthető gondolkodás nélkül.",
  );
  L.push(
    "- **NEM TALÁLHATÓ** — a szó szerinti idézet sehogy sem jön elő → vagy már átvezették, vagy " +
      "a szabály eltűnt. ⚠️ Ez nem azonos azzal, hogy „fölösleges” — nézd meg, mielőtt ejted.",
  );
  L.push("- **TÖBBSZÖRÖS / MÉRHETETLEN** — nem egyértelmű vagy nem szó szerinti idézet (`…`), gépileg nem dönthető.");
  L.push("");

  const order: RefineStatus[] = [
    "LIVE",
    "REFORMATTED",
    "AMBIGUOUS",
    "ELLIPSIZED",
    "UNPARSEABLE",
    "NO-TARGET",
    "STALE",
  ];
  const label: Record<RefineStatus, string> = {
    LIVE: "🔴 ÉLŐ — ma is szó szerint így áll a fájlban",
    REFORMATTED: "🟡 ÁTFOGALMAZOTT — a mondat megvan, a formázása/szövege változott",
    STALE: "⚪ NEM TALÁLHATÓ — a szó szerinti idézet nincs meg",
    AMBIGUOUS: "🟠 TÖBBSZÖRÖS találat",
    ELLIPSIZED: "🟠 MÉRHETETLEN — az OLD idézet rövidített (`…`)",
    UNPARSEABLE: "🟠 MÉRHETETLEN — az OLD nem szó szerinti idézet",
    "NO-TARGET": "🟠 ismeretlen cél-fájl",
  };
  for (const st of order) {
    const items = refine.filter((r) => r.status === st);
    if (items.length === 0) continue;
    L.push(`### ${label[st]} (${items.length})`);
    L.push("");
    for (const r of items) {
      L.push(`#### \`${r.target ?? "?"}\` → ${r.location}`);
      L.push(`- Review: \`_inbox/${r.review}\` (${r.line}. sor) · Forrás: ${r.sources || "—"}`);
      if (r.oldLiteral) L.push(`- OLD (szó szerint): \`${r.oldLiteral.slice(0, 400)}\``);
      else L.push(`- OLD (nyers): ${r.oldRaw.slice(0, 400) || "—"}`);
      L.push(`- NEW: ${r.newRaw.slice(0, 600) || "(a review-ban kódblokként — nyisd meg)"}`);
      if (r.why) L.push(`- MIÉRT: ${r.why.slice(0, 400)}`);
      L.push("");
    }
  }

  L.push("## PROMOTE — karanténban (a gép nem merte elhelyezni)");
  L.push("");
  if (quarantined.length === 0) L.push("*(nincs)*");
  for (const b of quarantined) {
    L.push(`### ${b.heading}`);
    L.push(`- Review: \`_inbox/${b.review}\` (${b.line}. sor)`);
    L.push(`- Miért nem ment át: ${b.notes.join("; ")}`);
    L.push("");
  }

  L.push("## DRIFT / ARCHIVE — változatlanul javaslat");
  L.push("");
  const free = parsed.flatMap((p) => p.free);
  if (free.length === 0) L.push("*(nincs)*");
  for (const f of free) {
    L.push(`- **${f.section}** (\`${f.review}\`): ${f.text.slice(0, 500)}`);
  }
  L.push("");
  return L.join("\n");
}

// --------------------------------------------------------------------------
// SELF-TEST
// --------------------------------------------------------------------------

function selfTest(opts: Options): number {
  let pass = 0;
  let fail = 0;
  const ok = (name: string, cond: boolean, detail = "") => {
    if (cond) {
      pass++;
      process.stdout.write(`  ✅ ${name}\n`);
    } else {
      fail++;
      process.stdout.write(`  ❌ ${name}${detail ? ` — ${detail}` : ""}\n`);
    }
  };

  process.stdout.write("\n# distill-apply — önteszt\n\n## 0. A forrásfájl épsége\n");
  // A stray NUL byte once made this very file "binary" for grep, so every
  // `grep` over it returned NOTHING and looked like a clean search result.
  const selfSrc = fs.readFileSync(new URL(import.meta.url).pathname, "utf8");
  ok("a szkript nem tartalmaz NUL bájtot (grep-et vakká tenné)", !selfSrc.includes("\0"));

  process.stdout.write("\n## 1. Parser (szintetikus fixture-ök)\n");

  // --- the load-bearing case: ### INSIDE a ```append fence ----------------
  const nested = [
    "# Distill review — X",
    "## PROMOTE  (új)",
    '### 02-ENTITY-MAP.md → „Kapcsolatok / folyamat” UTÁN, új szekció',
    "Source: `a.md`, `b.md`",
    "```append",
    "## Propagáció",
    "szöveg",
    "### A fotó NÉGY úton ér a lapra",
    "még szöveg",
    "```",
    "## SKIP",
    "- valami",
  ].join("\n");
  const p1 = parseReview("t1.md", nested);
  ok("beágyazott ### a fence-en BELÜL nem vág blokkot", p1.promote.length === 1, `${p1.promote.length} blokk`);
  ok(
    "a beágyazott ### a TÖRZSBEN marad",
    p1.promote[0]?.body.includes("### A fotó NÉGY úton ér a lapra"),
  );
  ok("cél-fájl felismerve", p1.promote[0]?.target === "02-ENTITY-MAP.md");

  // --- negative: a PROMOTE block with no ```append must NOT vanish --------
  const noFence = ["## PROMOTE", "### 03-INVARIANTS.md → §B", "Source: `x.md`", "csak próza"].join("\n");
  const p2 = parseReview("t2.md", noFence);
  ok("append nélküli blokk NEM tűnik el", p2.promote.length === 1);
  ok("append nélküli blokk KARANTÉNBA megy", p2.promote[0]?.status === "quarantine");

  // --- negative: wrong fence language is reported, not silently skipped ---
  const wrongFence = ["## PROMOTE", "### 03-INVARIANTS.md → §B", "```", "x", "```"].join("\n");
  const p3 = parseReview("t3.md", wrongFence);
  ok(
    "nem-append fence: karantén + indoklás",
    p3.promote[0]?.status === "quarantine" && p3.promote[0].notes.some((n) => n.includes("append")),
  );

  // --- unterminated fence: must be refused, not silently accepted ---------
  const unterm = ["## PROMOTE", "### 03-INVARIANTS.md → §B", "```append", "x", "## SKIP", "- y"].join("\n");
  const pu = parseReview("t6.md", unterm);
  ok("lezáratlan ```append → karantén, nem elfogadott törzs", pu.promote[0]?.status === "quarantine");
  ok(
    "lezáratlan ```append → megnevezve az indoklásban",
    pu.promote[0]?.notes.some((n) => n.includes("LEZÁRATLAN")),
  );
  ok("páratlan kerítés-szám → reconcile panaszkodik", reconcile(pu).some((x) => x.includes("PÁRATLAN")));
  ok("ép fixture-ön a reconcile NÉMA (nincs hamis riasztás)", reconcile(p1).length === 0);

  // --- uncertainty marker -------------------------------------------------
  const judg = [
    "## PROMOTE",
    "### 00-GLOSSARY.md → Architektúra-fogalmak  *(JUDGMENT — az érettségi határon)*",
    "```append",
    "x",
    "```",
  ].join("\n");
  ok("JUDGMENT-jelölt blokk karanténba", parseReview("t4.md", judg).promote[0]?.status === "quarantine");

  // --- two target files in one heading ------------------------------------
  const two = [
    "## PROMOTE",
    "### 02-ENTITY-MAP.md → új fogalom (jobb helye: 00-GLOSSARY.md → Architektúra)",
    "```append",
    "x",
    "```",
  ].join("\n");
  ok("két cél-fájl a fejlécben → karantén", parseReview("t5.md", two).promote[0]?.status === "quarantine");

  // --- OLD literal extraction --------------------------------------------
  ok("ellipszises OLD nem mérhető", extractOldLiteral("`21. A honlap (…) nem ígérünk.`").why === "ELLIPSIZED");
  ok(
    "prózába ágyazott OLD nem mérhető",
    extractOldLiteral("(a fenti bekezdés VÁLTOZATLAN, plusz) `valami`").why === "UNPARSEABLE",
  );
  ok("tiszta OLD literál kinyerhető", extractOldLiteral("`10. Lokál-először; x.`").literal === "10. Lokál-először; x.");
  ok("üres OLD nem mérhető", extractOldLiteral("").why === "UNPARSEABLE");

  // --- anchor resolution --------------------------------------------------
  const fake = ["# F", "", "## §A — Egy", "a1", "", "## §B — Kettő", "b1", "", "## §C — Három", "c1", ""];
  const aB = resolveAnchor(fake, "§B (a 17. pont UTÁN)");
  ok("§B horgony feloldva", aB?.heading.startsWith("§B"));
  ok("beszúrás a §B szakasz VÉGÉRE (a §C elé)", aB?.insertAt === 7, `insertAt=${aB?.insertAt}`);
  ok("nem létező §K → nincs horgony (fájl vége)", resolveAnchor(fake, "új §K — valami") === null);
  ok("két különböző § → nincs horgony", resolveAnchor(fake, "§B.17/§F metszete") === null);

  const named = ["# F", "", "## Árazási sávok (piaci referencia)", "x", "", "## Rejtett költség", "y", ""];
  ok(
    "backtickes `## Fejléc` feloldva",
    resolveAnchor(named, "új szekció `## Rejtett költség` frissítése")?.heading === "Rejtett költség",
  );
  ok(
    "idézőjel nélküli vezető szavak feloldva",
    resolveAnchor(named, "Árazási sávok (domain-upsell szabály)")?.heading?.startsWith("Árazási sávok") === true,
  );
  ok("túl rövid / nem illeszkedő név → nincs horgony", resolveAnchor(named, "új szekció: Valami Más") === null);
  const dupe = ["# F", "", "## Modul A", "x", "", "## Modul B", "y", ""];
  ok("többszörös prefix-találat → nincs horgony (nem tippel)", resolveAnchor(dupe, "Modul") === null);

  // --- REFINE staleness must not confuse "reformatted" with "gone" ---------
  ok(
    "félkövérezett mondat NEM „nem található” (deformat)",
    deformat("17b. **Soha ne tulajdoníts** fotót") === deformat("17b. Soha ne tulajdoníts fotót"),
  );
  ok(
    "a deformat NEM mos össze két KÜLÖNBÖZŐ mondatot",
    deformat("7. review csak VALÓS vendégvéleménnyel") !== deformat("7. review csak a SZÁM tölthető"),
  );

  // --- real reviews -------------------------------------------------------
  process.stdout.write("\n## 2. VALÓDI review-k (_inbox)\n");
  const reviews = listReviews(opts.inboxDir, null);
  ok(`van valódi bemenet (${reviews.length} review)`, reviews.length > 0);
  let realPromote = 0;
  let realRefine = 0;
  let acct = true;
  for (const r of reviews) {
    const pr = parseReview(r, fs.readFileSync(path.join(opts.inboxDir, r), "utf8"));
    realPromote += pr.promote.length;
    realRefine += pr.refine.length;
    if (pr.headingCount.promote !== pr.promote.length) acct = false;
    // Every parsed promote block must have a non-empty heading.
    if (pr.promote.some((b) => !b.heading)) acct = false;
  }
  ok(`valódi PROMOTE blokkok kiolvasva (${realPromote})`, realPromote > 0);
  ok(`valódi REFINE blokkok kiolvasva (${realRefine})`, realRefine > 0);
  ok("könyvelés stimmel minden valódi review-n", acct);

  process.stdout.write(`\nÖsszesen: ${pass} pass / ${fail} fail\n\n`);
  return fail === 0 ? 0 : 1;
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const here = path.dirname(new URL(import.meta.url).pathname);
  let repo = path.resolve(here, "..", "..", "..");
  let go = false;
  let selfT = false;
  let reviewFilter: string | null = null;
  let domainOverride: string | null = null;
  let branchRoot = path.join(os.homedir(), "wt");

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--go") go = true;
    else if (a === "--dry-run" || a === "--dry") go = false; // both spellings mean the same
    else if (a === "--self-test") selfT = true;
    else if (a === "--repo") repo = path.resolve(argv[++i] ?? die("--repo: hiányzó érték"));
    else if (a === "--domain") domainOverride = path.resolve(argv[++i] ?? die("--domain: hiányzó érték"));
    else if (a === "--worktree-root") branchRoot = path.resolve(argv[++i] ?? die("--worktree-root: hiányzó érték"));
    else if (a === "--review") reviewFilter = argv[++i] ?? die("--review: hiányzó érték");
    else if (a === "-h" || a === "--help") {
      process.stdout.write(
        "distill-apply.mts [--go] [--self-test] [--review <minta>] [--repo <út>] [--domain <út>]\n" +
          "  Alapértelmezés: SZÁRAZ FUTÁS (semmit nem ír). Írni csak --go-val lehet.\n",
      );
      process.exit(0);
    } else {
      // A mistyped switch must never silently fall through to a live run.
      die(`ismeretlen kapcsoló: ${a}\nÍrni CSAK a --go kapcsolóval lehet; minden más száraz futás.`);
    }
  }

  const domainDir = domainOverride ?? path.join(repo, "_planning", "DOMAIN");
  const opts: Options = {
    go,
    repo,
    domainDir,
    inboxDir: path.join(domainDir, "_inbox"),
    ledger: path.join(domainDir, "_tools", ".distill-applied"),
    branchDirRoot: branchRoot,
    stamp: new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "Z"),
    reviewFilter,
    selfTest: selfT,
  };

  process.exit(selfT ? selfTest(opts) : run(opts));
}

// ⛔ MAIN-GUARD. A `notify.mts` ebből a fájlból importálja a `branchPaths()`-t, hogy az ág és a
// worktree útvonala EGY forrásból jöjjön. Enélkül a puszta import lefuttatná a teljes átvezetőt
// és `process.exit`-tel megölné a hívót — az értesítő némán elhalna.
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  main();
}
