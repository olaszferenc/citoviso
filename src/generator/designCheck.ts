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

export interface DesignVerdict {
  readonly verdict: "pass" | "flag";
  /** Distinct emoji glyphs found (should be empty). */
  readonly emoji: string[];
  /** Required --cit-* tokens absent from the HTML. */
  readonly missingTokens: string[];
  /** Required module hooks absent (e.g. "booking"). */
  readonly missingHooks: string[];
  readonly reason?: string;
}

/** Deterministically verify the design doctrine on generated markup. */
export function checkDesign(html: string): DesignVerdict {
  const emoji = [...new Set([...html.matchAll(EMOJI_RE)].map((m) => m[0]))].filter(
    (g) => !EMOJI_ALLOWLIST.has(g),
  );
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
    missingTokens,
    missingHooks,
    reason: ok ? undefined : problems.join(" · "),
  };
}
