// Shared kit for art templates (ADR-0027). Every template module imports its interface and
// the cross-cutting helpers from here (never from another template), so templates stay
// independent files and the registry (templates.ts) stays a plain import list.

import { tSync } from "../i18n/packs.js";
import { iconSvg } from "./icons.js";
import { SAMPLE_ROOMS } from "./primitives.js";
import type { Recipe, RenderPhase, Room, SectionCopy, SiteData } from "./recipe.js";

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
 * Sample rooms for the MOCK, wearing the lead's REAL photos (ADR-0059 ③).
 *
 * The wow lives in imagery: a mock whose room cards show icon panels while the
 * SAME page has 5–14 real photos reads as unfinished (owner report, twice). The
 * cards stay clearly marked samples — the section-level "Minta" note every
 * template renders is the §B.17 label, and the alt says so too. The photos are
 * the property's own gallery, so nothing is misattributed to another business;
 * only the ROOM PAIRING is illustrative, which is exactly what the label states.
 *
 * The offset skips the first photos where the set allows: the hero already wears
 * photos[0..1], and repeating them directly below reads as a thin gallery. The
 * gated set is quality-ordered (ADR-0060, sharpest first), so the early-middle
 * photos are still strong. Deterministic — mock=live safe.
 */
export function sampleRooms(d: SiteData): readonly Room[] {
  // The COUNT follows the verified listing when it states one (owner: "szoba egy,
  // ha van szoba kettő, ha van…") — a lead with three rooms must not meet a mock
  // built for a different property. Absent data → the neutral default of three.
  const n = Math.max(1, Math.min(8, d.sampleRoomCount ?? SAMPLE_ROOMS.length));
  const base: Room[] = Array.from({ length: n }, (_, i) => {
    const proto = SAMPLE_ROOMS[Math.min(i, SAMPLE_ROOMS.length - 1)]!;
    return { ...proto, name: T(d, "{n}. szoba", { n: i + 1 }) };
  });
  if (!d.photos.length) return base;
  const offset = d.photos.length > base.length + 1 ? 2 : 0;
  return base.map((r, i) => {
    const p = d.photos[(offset + i) % d.photos.length]!;
    return { ...r, photo: { ...p, alt: T(d, "Minta — {name}", { name: r.name }) } };
  });
}

/**
 * The rooms the MOCK should render: the property's REAL rooms when a verified
 * listing named them, otherwise numbered samples — and in BOTH cases every card
 * wears a photo, because an icon panel next to a page full of real photos is the
 * "üres/ikonos szoba-kártya" the owner rejected (ADR-0059 ③).
 *
 * The photo is borrowed from the property's own gallery, so nothing is
 * misattributed to another business — but it is not necessarily THAT room, so the
 * alt marks it and the runtime paints the MINTAKÉP watermark over it.
 */
export function roomsForMock(d: SiteData): readonly Room[] {
  if (!d.rooms?.length) return sampleRooms(d);
  if (!d.photos.length) return d.rooms;
  const offset = d.photos.length > d.rooms.length + 1 ? 2 : 0;
  return d.rooms.map((r, i) =>
    r.photo
      ? r
      : {
          ...r,
          photo: {
            ...d.photos[(offset + i) % d.photos.length]!,
            alt: T(d, "Minta — {name}", { name: r.name }),
          },
        },
  );
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
export function ctaLabel(d: SiteData, phase: RenderPhase = "live"): string {
  return hasBookingSurface(d, phase) ? T(d, "Foglalás") : T(d, "Érdeklődés");
}

/**
 * Is the page offering a BOOKING (calendar + request) rather than an enquiry?
 *
 * ONE source for the whole page (ADR-0048). It has to know the PHASE too, because
 * the mock demos the booking module even without an entitlement (ADR-0061): with
 * the phase missing, every nav/hero/sticky button said "Érdeklődés" while the page
 * carried a full booking section — the exact two-processes-on-one-page bug ADR-0048
 * closed, re-opened by the demo path (measured on all 16 templates, 2026-08-23).
 */
export function hasBookingSurface(d: SiteData, phase: RenderPhase = "live"): boolean {
  return Boolean(d.booking) || phase === "mock";
}

/** The canonical booking slot (hydrated by the inline runtime into the interactive widget)
 *  with the no-JS fallback CTA ladder (mailto → tel → disabled). Templates place this inside
 *  their signature container (glass bar, dark dock, sticky card, coupon frame).
 *
 *  ADR-0059 ④ — in the MOCK the slot renders the REAL booking request widget in DEMO
 *  mode (clickable, never submits; MINTA-marked by the runtime): a module the lead
 *  cannot try is a module we cannot sell (ADR-0015). The demo's units come from the
 *  real rooms when we have them, else the sample rooms — the same set the room cards
 *  show, so the picker and the cards never disagree. */
export function bookingSlot(d: SiteData, phase: RenderPhase = "live"): string {
  const email = d.contact.email ?? "";
  const phone = d.contact.phone ?? "";
  const b = d.booking;
  const demo = !b && phase === "mock";
  // (hasBookingSurface() is the shared predicate — kept explicit here because the
  //  slot needs to distinguish the REAL entitlement from the demo below.)

  // ADR-0062 (konverziós dramaturgia): with booking active the template's signature
  // container carries only a SLIM band — a full form-with-calendar on the first
  // screen asks for the booking before any desire is built, which is exactly the
  // owner-rejected "foglalj, mielőtt bármit láttál" pattern. The FULL widget lives
  // in the closing "Foglalás" section (#cit-booking, moduleSections); this band's
  // one button jumps there. variant="cta" is a no-op for the runtime.
  if (b || demo) {
    return `<section id="cit-enquiry" class="cit-enquiry cit-enquiry--bar" data-cit-module="booking" data-cit-variant="cta" data-cit-name="${esc(d.name)}">
        <div class="cit-enquiry-bar-inner">
          <p class="cit-enquiry-bar-title">${T(d, "Foglalás")}</p>
          <a class="cit-btn" href="#cit-booking">${T(d, "Szabad időpontok megtekintése")}</a>
        </div>
      </section>`;
  }

  // Enquiry state (no booking module): the band hydrates into the compact enquiry
  // mini-form; the markup below is the NO-JS fallback CTA ladder — an empty band is
  // forbidden (§B), and a guest without JS must still be able to reach the owner.
  const cta = email
    ? `<a class="cit-btn" href="mailto:${esc(email)}">${T(d, "Érdeklődés küldése")}</a>`
    : phone
      ? `<a class="cit-btn" href="tel:${esc(phone.replace(/\s+/g, ""))}">${T(d, "Hívás: {phone}", { phone: esc(phone) })}</a>`
      : `<span class="cit-btn cit-btn-disabled">${T(d, "Kapcsolat hamarosan")}</span>`;

  return `<section id="cit-enquiry" class="cit-enquiry cit-enquiry--bar" data-cit-module="booking" data-cit-variant="bar" data-cit-name="${esc(d.name)}"${
    email ? ` data-cit-email="${esc(email)}"` : ""
  }${phone ? ` data-cit-phone="${esc(phone)}"` : ""}>
        <div class="cit-enquiry-bar-inner">
          <p class="cit-enquiry-bar-title">${T(d, "Foglalási igény")}</p>
          ${cta}
        </div>
      </section>`;
}

/**
 * Designed stand-in for a MISSING photo slot (owner decree 2026-08-23, ADR-0058: never an
 * empty grey box — "legyen dizájnos"). A token-themed decorative panel (soft accent gradient
 * + a faint line-icon), NOT a fake photograph: it fills the slot beautifully without making a
 * false claim about what a specific room looks like (§B.17 — the sample rooms are labelled as
 * samples). Used wherever a room / gallery / hero slot would otherwise render nothing. Every
 * colour comes from the --cit-* tokens, so it inherits whatever skin the template drew.
 *
 * Fills its container: absolute inset when the parent is positioned (the usual room-image
 * frame), and width/height:100% + a min-height floor so it is never a zero-height sliver.
 */
export function photoFill(alt: string, opts: { icon?: string; compact?: boolean } = {}): string {
  // `compact` is for small image slots (a table thumbnail): the full panel's 76px
  // icon and 170px floor would blow a 66×46 cell apart.
  const size = opts.compact ? 22 : 76;
  const svg = iconSvg(opts.icon ?? "bed").replace("<svg ", `<svg width="${size}" height="${size}" `);
  // Block fill (not absolute): fills a container that has its own height (aspect-ratio
  // frames) and floors at min-height when the container relied on the image for height —
  // robust in every template's room frame without needing a positioned parent.
  return (
    `<div class="cit-fill" role="img" aria-label="${esc(alt)}" style="` +
    `width:100%;height:100%;min-height:${opts.compact ? "0" : "170px"};` +
    `display:flex;align-items:center;justify-content:center;overflow:hidden;` +
    `background:radial-gradient(135% 120% at 18% 0%, color-mix(in srgb, var(--cit-accent) 30%, var(--cit-surface)), transparent 60%),` +
    `radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, var(--cit-accent) 16%, var(--cit-surface)), transparent 55%),` +
    `var(--cit-surface);color:color-mix(in srgb, var(--cit-accent) 60%, var(--cit-ink))">` +
    `<span aria-hidden="true" style="opacity:.55;display:flex">${svg}</span>` +
    `</div>`
  );
}

/** Deterministic skin pick for a template — stable per seed (lead UUID), spread across the
 *  curated list (djb2 hash). Kills the planner monoculture without randomness (mock=live safe). */
export function pickTemplateSkin(template: ArtTemplate, seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return template.skins[h % template.skins.length]!;
}

// ── Masthead lockup (owner-approved contract, 2026-08-30) ───────────────────
// assets/design-refs/engine/name-masthead/ — the property NAME must own the
// first screen of every mock: a centered editorial masthead (name → place
// subline between hairline rules → link band), NOT a tiny corner brand and NOT
// an inflated font-size. Presence comes from position, spacing and the rules.
// The template's original slim nav stays for the scrolled state only (the
// masthead scrolls away with the hero).
//
// Theming: every colour/typeface reads a --mast-* custom property with a
// token-derived default, so each template can speak its own dialect by
// overriding a handful of props in its own CSS (e.g. brutalism squares the
// rules and goes uppercase) without touching this structure.

export interface MastheadLink {
  readonly label: string;
  readonly href: string;
  /** The booking CTA — the one link that survives the mobile collapse. */
  readonly hot?: boolean;
}

export function mastheadHtml(
  d: SiteData,
  o: { links: readonly MastheadLink[]; place?: string },
): string {
  const links = o.links
    .map(
      (l) =>
        `<a${l.hot ? ` class="cit-mast-hot"` : ""} href="${esc(l.href)}">${esc(l.label)}</a>`,
    )
    .join("");
  const place = o.place
    ? `<div class="cit-mast-place"><span>${esc(o.place)}</span></div>`
    : "";
  return `<header class="cit-mast">
    <a class="cit-mast-name" href="#top">${esc(d.name)}</a>
    ${place}
    ${links ? `<nav class="cit-mast-links">${links}</nav>` : ""}
  </header>`;
}

/** Base masthead CSS. `overlay` (default) floats over a photo hero in light ink;
 *  `flow` sits in the document flow above a solid-background top in page ink. */
export function mastheadCss(mode: "overlay" | "flow" = "overlay"): string {
  const overlay = mode === "overlay";
  return `
  .cit-mast{${overlay ? "position:absolute;inset:0 0 auto 0;" : "position:relative;"}z-index:40;text-align:center;
    color:var(--mast-ink,${overlay ? "#fff" : "var(--cit-ink)"});padding:30px 24px 0}
  .cit-mast-name{display:block;font-family:var(--mast-font,var(--cit-font-display));
    font-weight:var(--mast-weight,400);font-size:clamp(28px,3vw,40px);
    letter-spacing:var(--mast-track,.5px);line-height:1.1;color:inherit;text-decoration:none}
  .cit-mast-place{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:10px}
  .cit-mast-place::before,.cit-mast-place::after{content:"";height:1px;width:min(70px,9vw);
    background:var(--mast-rule,${overlay ? "rgba(255,255,255,.4)" : "color-mix(in srgb, var(--cit-ink) 30%, transparent)"})}
  .cit-mast-place span{font-size:10.5px;letter-spacing:4.5px;text-transform:uppercase;font-weight:500;
    color:var(--mast-sub,${overlay ? "rgba(255,255,255,.75)" : "color-mix(in srgb, var(--cit-ink) 70%, transparent)"})}
  .cit-mast-links{display:flex;justify-content:center;gap:30px;align-items:center;margin:16px auto 0;
    padding:12px 0;max-width:640px;
    border-top:1px solid var(--mast-line,${overlay ? "rgba(255,255,255,.22)" : "color-mix(in srgb, var(--cit-ink) 18%, transparent)"});
    border-bottom:1px solid var(--mast-line,${overlay ? "rgba(255,255,255,.22)" : "color-mix(in srgb, var(--cit-ink) 18%, transparent)"})}
  .cit-mast-links a{color:var(--mast-linkink,${overlay ? "rgba(255,255,255,.85)" : "var(--cit-ink)"});
    text-decoration:none;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;font-weight:500;transition:.25s}
  .cit-mast-links a:hover{color:var(--mast-hover,var(--cit-accent))}
  .cit-mast-links a.cit-mast-hot{font-weight:600;padding-bottom:2px;
    border-bottom:1px solid var(--mast-hotline,${overlay ? "color-mix(in srgb, var(--cit-accent) 40%, #fff)" : "var(--cit-accent)"})}
  @media(max-width:720px){
    .cit-mast-name{font-size:26px}
    .cit-mast-place span{letter-spacing:3.5px}
    .cit-mast-links{gap:18px;max-width:340px}
    .cit-mast-links a:not(.cit-mast-hot){display:none}
  }`;
}
