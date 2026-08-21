// Shared kit for art templates (ADR-0027). Every template module imports its interface and
// the cross-cutting helpers from here (never from another template), so templates stay
// independent files and the registry (templates.ts) stays a plain import list.

import { tSync } from "../i18n/packs.js";
import type { Recipe, RenderPhase, SectionCopy, SiteData } from "./recipe.js";

/** ADR-0036 UI-string translation: the KEY is the Hungarian source string itself. Templates
 *  wrap every static customer-facing literal: `T(d, "Galéria")`. Optional {var} interpolation
 *  AFTER translation (word order stays the translator's). The extractor (scripts/
 *  extract-i18n.mts) collects these calls into the pack catalog — always double-quote the
 *  literal. Hungarian renders the source unchanged. */
export function T(
  d: Pick<SiteData, "lang">,
  hu: string,
  vars?: Record<string, string | number>,
): string {
  let s = tSync(d.lang, hu);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export interface ArtTemplate {
  readonly id: string;
  readonly label: string;
  /** Curated skins this template renders well with — the deterministic diversity rail.
   *  The generator spreads leads across this list (UUID-hash), killing the monoculture. */
  readonly skins: readonly string[];
  render(recipe: Recipe, data: SiteData, phase: RenderPhase): string;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render text with the copy's accent substring in the italic accent tone ("\n" = break). */
export function accented(text: string, accent?: string): string {
  const brk = (s: string) => esc(s).replace(/\n/g, "<br>");
  if (accent && text.includes(accent)) {
    const at = text.indexOf(accent);
    return `${brk(text.slice(0, at))}<em>${brk(accent)}</em>${brk(text.slice(at + accent.length))}`;
  }
  return brk(text);
}

/** First sentence of a longer text (hero subtitle slot), capped for the hero measure. */
export function firstSentence(s: string, max = 180): string {
  const m = /^[^.!?]*[.!?]/.exec(s.trim());
  const first = (m ? m[0] : s).trim();
  return first.length <= max ? first : "";
}

/** The recipe's editorial copy for a section kind (baked in by the generator). */
export function copyOf(recipe: Recipe, kind: string): SectionCopy {
  return recipe.sections.find((s) => s.kind === kind)?.copy ?? {};
}

/** §B.17: filled-star count mirroring the REAL rating (never a flattering 5-of-5 default).
 *  0 = no real rating → render no stars. */
export function honestStarCount(data: SiteData): number {
  return data.rating ? Math.max(1, Math.min(5, Math.round(data.rating.value))) : 0;
}

/**
 * The page's call-to-action wording (ADR-0048).
 *
 * ADR-0044 settled that booking and enquiry share ONE slot ("ha van foglalás, nincs
 * érdeklődés") — but only the SLOT followed. Every nav button, hero button and sticky
 * bar kept saying "Érdeklődés" with booking bought, while the slot's own heading said
 * "Foglalás". The guest was offered two different processes on one page, and the one
 * we do NOT want had all the buttons.
 *
 * One word, one source: with booking, the whole page says "Foglalás".
 */
export function ctaLabel(d: SiteData): string {
  return d.booking ? T(d, "Foglalás") : T(d, "Érdeklődés");
}

/** The canonical booking slot (hydrated by the inline runtime into the interactive widget)
 *  with the no-JS fallback CTA ladder (mailto → tel → disabled). Templates place this inside
 *  their signature container (glass bar, dark dock, sticky card, coupon frame). */
export function bookingSlot(d: SiteData): string {
  const email = d.contact.email ?? "";
  const phone = d.contact.phone ?? "";
  // With booking the runtime replaces this band with the real request form; the markup
  // here is the NO-JS fallback. Even then it must not invite an "érdeklődés" — that is
  // the other process, and mixing them is what confuses the guest.
  const sendLabel = d.booking ? T(d, "Foglalási kérés küldése") : T(d, "Érdeklődés küldése");
  const cta = email
    ? `<a class="cit-btn" href="mailto:${esc(email)}">${sendLabel}</a>`
    : phone
      ? `<a class="cit-btn" href="tel:${esc(phone.replace(/\s+/g, ""))}">${T(d, "Hívás: {phone}", { phone: esc(phone) })}</a>`
      : `<span class="cit-btn cit-btn-disabled">${T(d, "Kapcsolat hamarosan")}</span>`;

  // ADR-0044 — ONE slot, two states. With the booking module bought, the visitor gets
  // a real request form (free days fetched at view time); otherwise the enquiry CTA.
  // The static markup below is the NO-JS fallback in BOTH states: an empty band is
  // forbidden (§B), and a guest without JS must still be able to reach the owner.
  const b = d.booking;
  const bookingAttrs = b
    ? ` data-cit-units="${esc(JSON.stringify(b.units))}"` +
      ` data-cit-min-nights="${b.minNights}" data-cit-max-nights="${b.maxNights}"` +
      ` data-cit-horizon="${b.horizonMonths}" data-cit-lead-days="${b.leadTimeDays}"` +
      (b.responseNote ? ` data-cit-note="${esc(b.responseNote)}"` : "")
    : "";

  return `<section id="cit-enquiry" class="cit-enquiry cit-enquiry--bar" data-cit-module="booking" data-cit-variant="${
    b ? "request" : "bar"
  }" data-cit-name="${esc(d.name)}"${
    email ? ` data-cit-email="${esc(email)}"` : ""
  }${phone ? ` data-cit-phone="${esc(phone)}"` : ""}${bookingAttrs}>
        <div class="cit-enquiry-bar-inner">
          <p class="cit-enquiry-bar-title">${b ? T(d, "Foglalás") : T(d, "Foglalási igény")}</p>
          ${cta}
        </div>
      </section>`;
}

/** Deterministic skin pick for a template — stable per seed (lead UUID), spread across the
 *  curated list (djb2 hash). Kills the planner monoculture without randomness (mock=live safe). */
export function pickTemplateSkin(template: ArtTemplate, seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return template.skins[h % template.skins.length]!;
}
