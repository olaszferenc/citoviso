// Runtime injector (UI-CONTRACT, ADR-0011). Generated mocks are standalone HTML
// (emailed / hosted / opened from file://), so the shared module runtime is
// INLINED into each document rather than linked — no external dependency, works
// everywhere. The generator emits only the theme tokens (:root) + module slots
// (data-cit-module); this helper injects the CSS + JS before </body>. Idempotent.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.resolve(HERE, "../../assets/runtime");

let cached: string | null = null;

async function runtimeBlock(): Promise<string> {
  if (cached) return cached;
  const css = await readFile(path.join(RUNTIME_DIR, "cit-modules.css"), "utf8");
  const js = await readFile(path.join(RUNTIME_DIR, "cit-runtime.js"), "utf8");
  cached = `<style data-cit-runtime>\n${css}\n</style>\n<script data-cit-runtime>\n${js}\n</script>\n`;
  return cached;
}

const SVG_MAIL =
  '<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
  'aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';

function readAttr(tag: string, name: string): string {
  const m = new RegExp(`${name}="([^"]*)"`, "i").exec(tag);
  return m ? m[1]! : "";
}

/**
 * No-JS fallback for the booking slot (QA fix, 2026-07-11). The interactive
 * booking widget is built by the inline runtime script; where that script does
 * NOT run (email clients strip <script>, JS disabled, CSP, injection miss) the
 * empty <section data-cit-module="booking"></section> would leave a visible
 * empty band next to the contact column. We deterministically seed each EMPTY
 * booking slot with a themed static enquiry card (uses the same --cit tokens).
 * The runtime clears the slot (slot.textContent="") before mounting the full
 * widget, so with JS the fallback is transparently replaced. Honesty: it only
 * offers real contact (mailto if a real email exists) — no fake availability.
 */
function fillBookingFallback(html: string): string {
  return html.replace(
    /<section([^>]*\bdata-cit-module="booking"[^>]*)>\s*<\/section>/gi,
    (_whole, attrs: string) => {
      const name = readAttr(attrs, "data-cit-name");
      const email = readAttr(attrs, "data-cit-email");
      const lead = name
        ? `Vegye fel a kapcsolatot a(z) ${name} szállással időpont-egyeztetéshez.`
        : "Vegye fel a kapcsolatot időpont-egyeztetéshez.";
      const cta = email
        ? `<a class="cit-book__submit" href="mailto:${email}?subject=${encodeURIComponent(
            "Érdeklődés" + (name ? ` — ${name}` : ""),
          )}">Érdeklődés e-mailben</a>`
        : "";
      const fallback =
        `<div class="cit-book cit-book--card" data-cit-fallback>` +
        `<p class="cit-book__title">${SVG_MAIL}<span>Érdeklődés</span></p>` +
        `<p class="cit-book__note">${lead}</p>` +
        cta +
        `<p class="cit-book__note">Előzetes érdeklődés — nem végleges foglalás. A szállás visszaigazol.</p>` +
        `</div>`;
      return `<section${attrs}>${fallback}</section>`;
    },
  );
}

// Selectors for scroll-reveal / entrance-animation content that archetypes tend
// to hide by default (opacity:0 / transform) and reveal with JS. Broad, class-
// name-agnostic net so no-JS contexts (email clients strip <script>) never end
// up with 76%-invisible pages. Covers the common conventions + inline opacity:0.
const REVEAL_NET_SEL =
  '[class*="reveal"],[class*="fade"],[class*="inview"],[class*="in-view"],' +
  '[class*="appear"],[class*="animate"],[class*="scroll-anim"],' +
  '[style*="opacity:0"],[style*="opacity: 0"]';

/**
 * Head-injected guards (QA fix, 2026-07-11 — scroll-reveal empty-band):
 *  1) A synchronous <script> that adds `cit-anim` to <html> BEFORE the archetype
 *     CSS is parsed. New archetypes gate their hidden state behind `.cit-anim`
 *     (content visible by default → visible without JS; hidden only when JS runs
 *     and will animate it back in). No flash: the class is set before first paint.
 *  2) A <noscript> net that force-shows any hide-by-default reveal content — a
 *     safety belt for existing corpus designs that hide unconditionally.
 */
const HEAD_GUARDS =
  `<script data-cit-runtime>document.documentElement.classList.add('cit-anim')</script>` +
  `<noscript data-cit-runtime><style>${REVEAL_NET_SEL}` +
  `{opacity:1!important;transform:none!important;visibility:visible!important}</style></noscript>`;

function injectHeadGuards(html: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/(<head[^>]*>)/i, `$1${HEAD_GUARDS}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/(<html[^>]*>)/i, `$1${HEAD_GUARDS}`);
  return HEAD_GUARDS + html;
}

/**
 * Inline the module runtime (CSS+JS) before </body>, seed no-JS fallbacks, and
 * add the head guards. No-op if already processed.
 */
export async function injectRuntime(html: string): Promise<string> {
  if (html.includes("data-cit-runtime")) return html; // already injected
  let out = fillBookingFallback(html);
  out = injectHeadGuards(out);
  const block = await runtimeBlock();
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${block}</body>`);
  return out + "\n" + block; // no </body> — append as a safe fallback
}
