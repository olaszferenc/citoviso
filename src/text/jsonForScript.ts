// JSON for an inline <script> — the ONE way server-side data is written into one.
//
// ⛔ WHY. A plain JSON.stringify() inside <script>…</script> is an XSS hole: the HTML
// parser ends the script block at the first "</script" it meets, INSIDE a JSON string
// too. A scraped business name like `</script><img src=x onerror=…>` then runs as
// markup (found live on the tenant-admin Bookings tab, ADR-0363; the same pattern
// stood on the console lead map). "<!--" inside a script also flips the parser into
// the "escaped" state, so "<" is the character that matters most.
//
// The escapes are JSON-equivalent: every replaced character can only occur inside a
// JSON string literal, where "<" means exactly "<". The parsed value is unchanged,
// in a JS expression (`var X=…`) and in a `<script type="application/json">` block alike.
//   <  >  &        → no tag, comment or entity can form (also safe inside an attribute)
//   '              → a single-quoted inline handler (onclick='f(…)') cannot be closed
//   U+2028 U+2029  → line terminators that pre-ES2019 engines reject in a string literal
//
// Guard: scripts/json-for-script-check.mts (static scan + a live lead-map probe).

const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "'": "\\u0027",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/** JSON.stringify(v), safe to place inside an inline <script> (or a handler attribute). */
export function jsonForScript(v: unknown): string {
  const json = JSON.stringify(v);
  // JSON.stringify(undefined) is undefined; `${undefined}` printed "undefined" — keep that.
  if (json === undefined) return "undefined";
  return json.replace(/[<>&'\u2028\u2029]/g, (c) => ESCAPES[c]!);
}
