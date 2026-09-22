// Runtime injector (UI-CONTRACT, ADR-0011). Generated mocks are standalone HTML
// (emailed / hosted / opened from file://), so the shared module runtime is
// INLINED into each document rather than linked — no external dependency, works
// everywhere. The generator emits only the theme tokens (:root) + module slots
// (data-cit-module); this helper injects the CSS + JS before </body>. Idempotent.

import { readFile } from "node:fs/promises";

import { huArticleLower } from "../hu.js";
import { packForClientAsync } from "../i18n/packs.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.resolve(HERE, "../../assets/runtime");

let cached: string | null = null;

async function runtimeBlock(): Promise<string> {
  if (cached) return cached;
  const css = await readFile(path.join(RUNTIME_DIR, "cit-modules.css"), "utf8");
  // The money rule travels WITH the widget: a generated mock is opened from
  // file:// and out of e-mail clients, so nothing may be fetched separately.
  const money = await readFile(path.join(RUNTIME_DIR, "cit-money.js"), "utf8");
  // The season rule travels with it for the same reason — and one stronger one: the
  // SERVER freezes this rule's answer onto the booking request and mails it, so the
  // browser must run the very same bytes, not a second implementation that happens to
  // agree today. Inlined BEFORE cit-runtime.js, which calls CitSeason.
  const season = await readFile(path.join(RUNTIME_DIR, "cit-season.cjs"), "utf8");
  const js = await readFile(path.join(RUNTIME_DIR, "cit-runtime.js"), "utf8");
  cached =
    `<style data-cit-runtime>\n${css}\n</style>\n` +
    `<script data-cit-runtime>\n${money}\n${season}\n${js}\n</script>\n`;
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
        ? // ⛔ ADR-0101 ①: a névelő a szállás NEVÉBŐL dől el, nem „a(z)"-zel kerüljük ki.
          `Vegye fel a kapcsolatot ${huArticleLower(name)} ${name} szállással időpont-egyeztetéshez.`
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
/**
 * ⛔ THE NET HAD A HOLE: THE OPENING ANIMATION (measured 2026-09-14).
 *
 * The ADR-0115 intro overlays (`.cit-fintro` on arch-frames, `.cit-intro` on
 * wordmark-grow) are `position:fixed; inset:0` with an OPAQUE background, and the
 * name inside them only becomes visible once JS adds `.cit-on`. The element is
 * removed by JS too. With scripts off, therefore, neither happens: the visitor
 * gets a FULL-SCREEN BLANK PANEL over the whole page. Photographed at 390 px —
 * an empty cream rectangle, nothing else, on both templates.
 *
 * The rule above cannot reach it: it force-SHOWS hidden content, and the problem
 * here is the opposite — an overlay that should never have appeared. Without JS
 * there is no animation to play, so the overlay has no reason to exist.
 */
const NO_JS_INTRO_KILL = ".cit-fintro,.cit-intro{display:none!important}";

const HEAD_GUARDS =
  `<script data-cit-runtime>document.documentElement.classList.add('cit-anim')</script>` +
  `<noscript data-cit-runtime><style>${REVEAL_NET_SEL}` +
  `{opacity:1!important;transform:none!important;visibility:visible!important}` +
  NO_JS_INTRO_KILL +
  `</style></noscript>`;

function injectHeadGuards(html: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/(<head[^>]*>)/i, `$1${HEAD_GUARDS}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/(<html[^>]*>)/i, `$1${HEAD_GUARDS}`);
  return HEAD_GUARDS + html;
}

// Citoviso credit strip — a subtle, clickable "made by" line under the page footer, on both
// the mock and the live tenant site (growth + attribution). Skin-agnostic neutral colors so it
// reads on any background; a real anchor to citoviso.com (openable, as requested).
const CIT_CREDIT =
  `<div data-cit-runtime style="font:400 13px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;` +
  `text-align:center;padding:16px 20px;color:#8a8a8a;border-top:1px solid rgba(128,128,128,.22)">` +
  `Ezt az oldalt a <a href="https://citoviso.com" target="_blank" rel="noopener" ` +
  `style="color:inherit;text-decoration:underline">Citoviso</a> készítette — modern honlap percek alatt.` +
  `</div>`;

/**
 * Inline the module runtime (CSS+JS) before </body>, seed no-JS fallbacks, add the head
 * guards, and append the Citoviso credit strip. No-op if already processed.
 * `lang` (ADR-0036): non-Hungarian pages get a window.CIT_I18N map injected BEFORE the
 * runtime script, so the client widgets (booking, lightbox) resolve their labels via tr().
 */
export async function injectRuntime(html: string, lang?: string): Promise<string> {
  if (html.includes("data-cit-runtime")) return html; // already injected
  let out = fillBookingFallback(html);
  out = injectHeadGuards(out);
  const block = await runtimeBlock();
  const i18n =
    lang && lang !== "hu"
      ? `<script data-cit-runtime>window.CIT_I18N=${JSON.stringify(await packForClientAsync(lang)).replaceAll("</", "<\\/")}</script>\n`
      : "";
  const tail = `${CIT_CREDIT}\n${i18n}${block}`;
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${tail}</body>`);
  return out + "\n" + tail; // no </body> — append as a safe fallback
}
