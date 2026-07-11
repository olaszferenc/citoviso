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

/**
 * Inline the module runtime (CSS+JS) before </body> and seed no-JS fallbacks.
 * No-op if already processed.
 */
export async function injectRuntime(html: string): Promise<string> {
  if (html.includes("data-cit-runtime")) return html; // already injected
  const seeded = fillBookingFallback(html);
  const block = await runtimeBlock();
  if (/<\/body>/i.test(seeded)) return seeded.replace(/<\/body>/i, `${block}</body>`);
  return seeded + "\n" + block; // no </body> — append as a safe fallback
}
