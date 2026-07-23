// Deterministic layout primitives, now as a VARIANT REGISTRY (ADR-0017 primitív-variáns
// passz). Each SectionKind has ≥1 variant — a pure (data) => HTML function with a FIXED
// structure, token-dressed classes, and optional variant-scoped CSS. Only DATA fills the
// slots (no AI, no randomness → mock=live). The variant is the section-render axis: same
// kind, different internal layout (cards vs table, plain hero vs photo-overlay, grid vs
// masonry). Module hooks (data-cit-module) let the runtime (06-UI-CONTRACT) hydrate these.
//
// EXTENSIBILITY: a new variant = one entry in a kind's `variants` map. render.ts picks it,
// planner.ts derives its menu/enum from the registry → no core change.

import type { SectionKind, SiteData } from "./recipe.js";

/** Minimal HTML-escape for text + attribute slots. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- hero ----------------------------------------------------------------

function heroPlain(d: SiteData): string {
  return `<section class="cit-hero">
      <div class="cit-hero-inner">
        <h1 class="cit-hero-title">${esc(d.name)}</h1>
        <p class="cit-hero-tagline">${esc(d.tagline)}</p>
      </div>
    </section>`;
}

function heroOverlay(d: SiteData): string {
  const bg = d.photos[0]?.url ?? "";
  if (!bg) return heroPlain(d); // defensive: overlay needs a photo (also gated in enforce)
  return `<section class="cit-hero cit-hero--overlay" style="background-image:linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,.15)), url('${esc(
    bg,
  )}')">
      <div class="cit-hero-inner">
        <h1 class="cit-hero-title">${esc(d.name)}</h1>
        <p class="cit-hero-tagline">${esc(d.tagline)}</p>
      </div>
    </section>`;
}

const HERO_OVERLAY_CSS = `  .cit-hero--overlay { background-size: cover; background-position: center; border-bottom: 0; }
  .cit-hero--overlay .cit-hero-inner { min-height: 56vh; display: flex; flex-direction: column; justify-content: flex-end; }
  .cit-hero--overlay .cit-hero-title, .cit-hero--overlay .cit-hero-tagline { color: #fff; text-shadow: 0 2px 18px rgba(0,0,0,.5); }`;

// ---- features ------------------------------------------------------------

function featuresCards(d: SiteData): string {
  const items = d.highlights
    .map((h) => `<li class="cit-feature">${esc(h)}</li>`)
    .join("\n          ");
  return `<section class="cit-features">
      <div class="cit-section-inner">
        <p class="cit-intro">${esc(d.intro)}</p>
        <ul class="cit-feature-grid">
          ${items}
        </ul>
      </div>
    </section>`;
}

function featuresTable(d: SiteData): string {
  const rows = d.highlights
    .map(
      (h, i) =>
        `<tr><td class="cit-ledger-num">${String(i + 1).padStart(2, "0")}</td><td>${esc(h)}</td></tr>`,
    )
    .join("\n            ");
  return `<section class="cit-features cit-features--table">
      <div class="cit-section-inner">
        <p class="cit-intro">${esc(d.intro)}</p>
        <table class="cit-ledger"><tbody>
            ${rows}
        </tbody></table>
      </div>
    </section>`;
}

const FEATURES_TABLE_CSS = `  .cit-ledger { width: 100%; border-collapse: collapse; }
  .cit-ledger td { padding: .95rem 1rem; border-bottom: 1px solid var(--cit-line); font-size: 1.05rem; }
  .cit-ledger tr:first-child td { border-top: 1px solid var(--cit-line); }
  .cit-ledger-num { width: 3ch; color: var(--cit-accent); font-variant-numeric: tabular-nums; font-weight: 600; }`;

// ---- gallery -------------------------------------------------------------

function galleryGrid(d: SiteData): string {
  const imgs = d.photos
    .map(
      (p) =>
        `<figure class="cit-gallery-item"><img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"></figure>`,
    )
    .join("\n          ");
  return `<section class="cit-gallery" data-cit-module="gallery">
      <div class="cit-section-inner">
        <div class="cit-gallery-grid">
          ${imgs}
        </div>
      </div>
    </section>`;
}

function galleryMasonry(d: SiteData): string {
  const imgs = d.photos
    .map(
      (p) =>
        `<figure class="cit-gallery-item"><img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"></figure>`,
    )
    .join("\n          ");
  return `<section class="cit-gallery cit-gallery--masonry" data-cit-module="gallery">
      <div class="cit-section-inner">
        <div class="cit-gallery-cols">
          ${imgs}
        </div>
      </div>
    </section>`;
}

const GALLERY_MASONRY_CSS = `  .cit-gallery--masonry .cit-gallery-cols { column-count: 3; column-gap: .75rem; }
  @media (max-width: 760px) { .cit-gallery--masonry .cit-gallery-cols { column-count: 2; } }
  .cit-gallery--masonry .cit-gallery-item { break-inside: avoid; margin: 0 0 .75rem; border-radius: var(--cit-radius); overflow: hidden; }
  .cit-gallery--masonry .cit-gallery-item img { width: 100%; height: auto; display: block; }`;

// ---- enquiry (spine CTA — single variant) --------------------------------

function enquiryCard(d: SiteData): string {
  const email = d.contact.email ?? "";
  // Booking/enquiry is the SPINE CTA (data-cit-module="booking"); the runtime upgrades
  // this static card into the interactive widget. No-JS: the mailto works.
  return `<section class="cit-enquiry" data-cit-module="booking" data-cit-variant="card"${
    email ? ` data-cit-email="${esc(email)}"` : ""
  }>
      <div class="cit-section-inner">
        <h2 class="cit-enquiry-title">Érdeklődés</h2>
        <p class="cit-enquiry-sub">Írjon nekünk, és hamarosan válaszolunk.</p>
        ${
          email
            ? `<a class="cit-btn" href="mailto:${esc(email)}">Kapcsolatfelvétel</a>`
            : `<span class="cit-btn cit-btn-disabled">Kapcsolat hamarosan</span>`
        }
      </div>
    </section>`;
}

// ---- registry ------------------------------------------------------------

export interface PrimitiveVariant {
  readonly id: string;
  /** One-line hint fed to the AI planner menu (single source → no prompt drift). */
  readonly hint: string;
  readonly render: (d: SiteData) => string;
  /** Variant-scoped CSS (token-only). Deduped + appended by the renderer. May be absent. */
  readonly css?: string;
}

export interface Primitive {
  readonly kind: SectionKind;
  readonly variants: Readonly<Record<string, PrimitiveVariant>>;
  /** Default variant id — used when the recipe omits (or names an invalid) variant. */
  readonly default: string;
}

export const PRIMITIVES: Readonly<Record<SectionKind, Primitive>> = {
  hero: {
    kind: "hero",
    default: "plain",
    variants: {
      plain: { id: "plain", hint: "letisztult fejléc néven + alcímen", render: heroPlain },
      overlay: {
        id: "overlay",
        hint: "nagy hero-kép sötét fátyollal, ráírt szöveg (fotó kell)",
        render: heroOverlay,
        css: HERO_OVERLAY_CSS,
      },
    },
  },
  features: {
    kind: "features",
    default: "cards",
    variants: {
      cards: { id: "cards", hint: "kiemelés-kártyák rácsa", render: featuresCards },
      table: {
        id: "table",
        hint: "füzetes, sorszámozott ledger-lista",
        render: featuresTable,
        css: FEATURES_TABLE_CSS,
      },
    },
  },
  gallery: {
    kind: "gallery",
    default: "grid",
    variants: {
      grid: { id: "grid", hint: "egységes fotórács", render: galleryGrid },
      masonry: {
        id: "masonry",
        hint: "változó magasságú masonry oszlopok",
        render: galleryMasonry,
        css: GALLERY_MASONRY_CSS,
      },
    },
  },
  enquiry: {
    kind: "enquiry",
    default: "card",
    variants: {
      card: { id: "card", hint: "érdeklődés-kártya (gerinc CTA)", render: enquiryCard },
    },
  },
};

/** Shared primitive CSS — dresses ONLY from --cit-* tokens (skin-agnostic). */
export const PRIMITIVE_CSS = `  * { box-sizing: border-box; }
  body { margin: 0; background: var(--cit-bg); color: var(--cit-ink);
    font-family: var(--cit-font-body); line-height: 1.6; }
  .cit-section-inner, .cit-hero-inner { max-width: 1080px; margin: 0 auto;
    padding: clamp(2.5rem, 6vw, 5rem) 1.25rem; }
  .cit-hero { background: var(--cit-surface); border-bottom: 1px solid var(--cit-line); }
  .cit-hero-title { font-family: var(--cit-font-display); font-size: clamp(2rem, 5vw, 3.4rem);
    margin: 0 0 .4em; color: var(--cit-ink); }
  .cit-hero-tagline { font-size: clamp(1.05rem, 2.2vw, 1.4rem); color: var(--cit-muted); margin: 0; }
  .cit-intro { font-size: 1.15rem; color: var(--cit-muted); max-width: 60ch; margin: 0 0 2rem; }
  .cit-feature-grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .cit-feature { background: var(--cit-surface); border: 1px solid var(--cit-line);
    border-radius: var(--cit-radius); padding: 1.1rem 1.25rem; box-shadow: var(--cit-shadow); }
  .cit-gallery-grid { display: grid; gap: .75rem;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .cit-gallery-item { margin: 0; border-radius: var(--cit-radius); overflow: hidden; }
  .cit-gallery-item img { width: 100%; height: 100%; object-fit: cover; display: block; aspect-ratio: 4 / 3; }
  .cit-enquiry { background: var(--cit-surface); border-top: 1px solid var(--cit-line); }
  .cit-enquiry-title { font-family: var(--cit-font-display); color: var(--cit-ink); margin: 0 0 .3em; }
  .cit-enquiry-sub { color: var(--cit-muted); margin: 0 0 1.4rem; }
  .cit-btn { display: inline-block; background: var(--cit-accent); color: var(--cit-on-accent);
    text-decoration: none; padding: .8rem 1.5rem; border-radius: var(--cit-radius); font-weight: 600; }
  .cit-btn-disabled { opacity: .55; }`;
