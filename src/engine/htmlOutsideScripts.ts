// Serve-time / post-render rewrites of a finished page are regexes over the WHOLE
// document — and a page carries inline <script> blocks (the embedded cit-runtime, the
// template's motion layer, JSON-LD) whose source quotes HTML as JS strings.
//
// Measured 2026-10-12 (Elek, ÚJ-B1): stripTenantLegalLinks ran after injectRuntime on the
// plan link (/p/<token>) of every trial/paid lead and cut `<a href="/adatvedelem">…</a>`
// out of a cit-runtime.js string literal — the whole runtime died on a SyntaxError (no
// booking form, grey gallery tiles). A rewrite meant for markup goes through here so it
// never sees script source.

const SCRIPT_BLOCK = /(<script\b[^>]*>[\s\S]*?<\/script\s*>)/gi;

/** Apply `fn` to every stretch of `html` that is NOT inside a <script>…</script> block;
 *  script blocks pass through byte-for-byte. `fn` is called in document order. */
export function mapOutsideScripts(html: string, fn: (markup: string) => string): string {
  return html
    .split(SCRIPT_BLOCK)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}
