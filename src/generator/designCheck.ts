// Design-doctrine gate — enforces DOMAIN 03-INVARIANTS §B + 06-UI-CONTRACT.
// The cheapest, most mechanical guardian: purely deterministic checks on the
// generated HTML, no API. Three rules with a real code surface today:
//   1. no emoji (§B.4) — icons must be inline SVG, never emoji glyphs;
//   2. theme-token contract (06-UI-CONTRACT A) — all 11 --cit-* tokens present so
//      the shared widgets inherit the archetype skin;
//   3. module hook (06-UI-CONTRACT B) — the interest/booking backbone slot exists.
// Verdict recorded on the artifact; a FLAG routes the mock to curation (§G.20).

// The 11 canonical theme tokens every archetype must emit in :root.
const REQUIRED_TOKENS: readonly string[] = [
  "--cit-accent",
  "--cit-on-accent",
  "--cit-ink",
  "--cit-muted",
  "--cit-bg",
  "--cit-surface",
  "--cit-line",
  "--cit-radius",
  "--cit-font-display",
  "--cit-font-body",
  "--cit-shadow",
];

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
// Legal/typographic marks Unicode classes as Extended_Pictographic but which are
// NOT decorative emoji icons — permitted (e.g. © in a footer copyright line).
// Deliberately excludes dingbats like ★ (U+2605): a decorative star glyph should
// still be an inline SVG, so it must keep flagging.
const EMOJI_ALLOWLIST: ReadonlySet<string> = new Set(["©", "®", "™"]);
const BOOKING_HOOK_RE = /data-cit-module\s*=\s*["']booking["']/i;

// ⛔⛔ THE RULE IS ABOUT WHAT THE VISITOR SEES, AND THIS GUARD USED TO MEASURE THE
// RAW SOURCE (measured 2026-09-16 on the Myrna Haus outreach): every mock built
// from our templates carried 14 ⛔/⚠ glyphs — 6 in <style>, 8 in <script>, and
// ZERO in the visitor-visible zone. They are OUR OWN doctrine markers in CSS/JS
// comments (`/* ⛔ KONTRAKTUS ④… */`). The verdict was stored as "flag" on the
// artifact, and the outreach gate then refused to send an approved mock — a false
// failure that blocked the whole channel, not a design violation.
//
// ⛔ WHAT THIS FIX MUST NOT DO IS GO WIDE AND DROP <style>/<script> WHOLESALE:
// a CSS `content: "⚠️"` on a ::before renders ON SCREEN, and so does a JS string
// literal injected into the DOM. Dropping those blocks would turn a false failure
// into a FALSE PASS, which is the worse trade. So we strip COMMENTS ONLY, and the
// zone detection is fail-CLOSED: anything we cannot positively prove to be a
// comment stays measured (a false flag is visible and fixable; a false pass is not).
// The count of glyphs excused this way is reported, never silently dropped.

/** Half-open [start, end) source offsets of a comment span. */
interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * Comment spans we can positively prove: HTML `<!-- -->`, and block `/* *\/`
 * plus line `//` comments INSIDE <style>/<script> only. Line comments are
 * recognised conservatively — see `lineCommentSpans`.
 */
function commentSpans(html: string): Span[] {
  const spans: Span[] = [];
  for (const m of html.matchAll(/<!--[\s\S]*?-->/g)) {
    spans.push({ start: m.index, end: m.index + m[0].length });
  }
  // Block and line comments are only comments inside a CSS/JS context. In plain
  // markup `/* */` is literal text the visitor reads, so it must stay measured.
  for (const block of html.matchAll(/<(style|script)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const body = block[2];
    const base = block.index + block[0].indexOf(body, block[1].length);
    for (const c of body.matchAll(/\/\*[\s\S]*?\*\//g)) {
      spans.push({ start: base + c.index, end: base + c.index + c[0].length });
    }
    for (const s of lineCommentSpans(body)) {
      spans.push({ start: base + s.start, end: base + s.end });
    }
  }
  return spans;
}

/**
 * Line (`//`) comments, recognised only where we can be sure. A `//` is treated
 * as a comment start when it opens the line (after whitespace), or when every
 * quote character before it on that line is balanced — so `"https://…"` inside a
 * string and a `// note` inside a string literal both stay measured. Anything
 * ambiguous is NOT claimed as a comment (fail-closed).
 */
function lineCommentSpans(body: string): Span[] {
  const spans: Span[] = [];
  let lineStart = 0;
  for (const line of body.split("\n")) {
    const at = findLineComment(line);
    if (at >= 0) spans.push({ start: lineStart + at, end: lineStart + line.length });
    lineStart += line.length + 1;
  }
  return spans;
}

function findLineComment(line: string): number {
  const opener = line.match(/^\s*\/\//);
  if (opener) return opener[0].length - 2;
  for (let i = 0; i + 1 < line.length; i++) {
    if (line[i] !== "/" || line[i + 1] !== "/") continue;
    const before = line.slice(0, i);
    // Balanced quotes => we are in code, not inside a string literal.
    const balanced = ['"', "'", "`"].every((q) => (before.split(q).length - 1) % 2 === 0);
    if (balanced) return i;
    return -1;
  }
  return -1;
}

function inAnySpan(offset: number, spans: readonly Span[]): boolean {
  return spans.some((s) => offset >= s.start && offset < s.end);
}

export interface DesignVerdict {
  readonly verdict: "pass" | "flag";
  /** Distinct emoji glyphs found in visitor-visible markup (should be empty). */
  readonly emoji: string[];
  /**
   * How many emoji occurrences sat in source comments and were therefore NOT
   * judged. Reported so the exclusion can never be a silent cap.
   */
  readonly emojiInComments: number;
  /** Required --cit-* tokens absent from the HTML. */
  readonly missingTokens: string[];
  /** Required module hooks absent (e.g. "booking"). */
  readonly missingHooks: string[];
  readonly reason?: string;
}

/** Deterministically verify the design doctrine on generated markup. */
export function checkDesign(html: string): DesignVerdict {
  const spans = commentSpans(html);
  const visible: string[] = [];
  let emojiInComments = 0;
  for (const m of html.matchAll(EMOJI_RE)) {
    if (EMOJI_ALLOWLIST.has(m[0])) continue;
    if (inAnySpan(m.index, spans)) emojiInComments++;
    else visible.push(m[0]);
  }
  const emoji = [...new Set(visible)];
  // Tokens and hooks are structural: they are looked for in the whole document on
  // purpose. A token defined only inside a comment would not apply, but that shows
  // up as a MISSING token elsewhere, so measuring wide cannot excuse a violation.
  const missingTokens = REQUIRED_TOKENS.filter((t) => !html.includes(t));
  const missingHooks = BOOKING_HOOK_RE.test(html) ? [] : ["booking"];

  const problems: string[] = [];
  if (emoji.length) problems.push(`emoji: ${emoji.join(" ")}`);
  if (missingTokens.length) problems.push(`hiányzó token: ${missingTokens.join(", ")}`);
  if (missingHooks.length) problems.push(`hiányzó modul-horog: ${missingHooks.join(", ")}`);

  const ok = problems.length === 0;
  return {
    verdict: ok ? "pass" : "flag",
    emoji,
    emojiInComments,
    missingTokens,
    missingHooks,
    reason: ok ? undefined : problems.join(" · "),
  };
}
