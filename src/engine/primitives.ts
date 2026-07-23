// Deterministic layout primitives as a VARIANT REGISTRY (ADR-0017). Each SectionKind has ≥1
// variant — a pure (data) => HTML function with a FIXED structure, token-dressed classes, and
// optional variant-scoped CSS. Only DATA fills the slots (no AI, no randomness → mock=live).
//
// CRAFT BAR: the visual craft is distilled from the reference sample mocks (immersive full-
// bleed hero, eyebrow + large display type, prominent enquiry band, generous rhythm). The
// hero is the #1 "wow" lever, so the default hero is immersive (photo background + scrim when
// a photo exists, a tall typographic hero otherwise). Module hooks (data-cit-module) let the
// runtime (06-UI-CONTRACT) hydrate the enquiry into the interactive booking widget.

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

/** Immersive hero (default). With a photo → full-bleed background + gradient scrim, white
 *  type. Without → a tall, typographic hero on the surface tone. Eyebrow = address (a fact,
 *  never invented); CTA scrolls to the enquiry band. This is the "above the fold" wow. */
function heroImmersive(d: SiteData): string {
  const bg = d.photos[0]?.url ?? "";
  const eyebrow = d.contact.address
    ? `<span class="cit-eyebrow">${esc(d.contact.address)}</span>`
    : "";
  const cta = d.contact.email
    ? `<a class="cit-btn cit-btn-lg" href="#cit-enquiry">Érdeklődés</a>`
    : "";
  const bgAttr = bg
    ? ` style="background-image:linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.72) 94%), url('${esc(
        bg,
      )}')"`
    : "";
  const cls = bg ? "cit-hero cit-hero--immersive cit-hero--photo" : "cit-hero cit-hero--immersive";
  return `<section class="${cls}"${bgAttr}>
      <div class="cit-hero-inner">
        ${eyebrow}
        <h1 class="cit-hero-title">${esc(d.name)}</h1>
        <p class="cit-hero-tagline">${esc(d.tagline)}</p>
        ${cta}
      </div>
    </section>`;
}

/** Minimal, restrained hero (editorial/clean moods) — name + tagline on the surface tone. */
function heroPlain(d: SiteData): string {
  const eyebrow = d.contact.address
    ? `<span class="cit-eyebrow">${esc(d.contact.address)}</span>`
    : "";
  return `<section class="cit-hero cit-hero--plain">
      <div class="cit-hero-inner">
        ${eyebrow}
        <h1 class="cit-hero-title">${esc(d.name)}</h1>
        <p class="cit-hero-tagline">${esc(d.tagline)}</p>
      </div>
    </section>`;
}

const HERO_IMMERSIVE_CSS = `  .cit-hero--immersive { display: flex; align-items: flex-end;
    min-height: clamp(460px, 82vh, 780px); background-size: cover; background-position: center;
    border-bottom: 0; }
  .cit-hero--immersive .cit-hero-inner { position: relative; z-index: 2; width: 100%; }
  .cit-hero--immersive:not(.cit-hero--photo) { background: var(--cit-surface);
    border-bottom: 1px solid var(--cit-line); align-items: center; }
  .cit-hero--photo .cit-hero-title { color: #fff; text-shadow: 0 2px 30px rgba(0,0,0,.45); }
  .cit-hero--photo .cit-hero-tagline { color: rgba(255,255,255,.92); }
  .cit-hero--photo .cit-eyebrow { color: #fff; opacity: .88; }`;

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
  .cit-ledger td { padding: 1rem 1rem; border-bottom: 1px solid var(--cit-line); font-size: 1.1rem; }
  .cit-ledger tr:first-child td { border-top: 1px solid var(--cit-line); }
  .cit-ledger-num { width: 3ch; color: var(--cit-accent); font-variant-numeric: tabular-nums; font-weight: 700; }`;

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

// ---- enquiry (spine CTA — prominent band) --------------------------------

function enquiryCard(d: SiteData): string {
  const email = d.contact.email ?? "";
  // Booking/enquiry is the SPINE CTA (data-cit-module="booking"); the runtime upgrades this
  // into the interactive widget. No-JS: the mailto works. id anchors the hero CTA.
  return `<section id="cit-enquiry" class="cit-enquiry" data-cit-module="booking" data-cit-variant="card"${
    email ? ` data-cit-email="${esc(email)}"` : ""
  }>
      <div class="cit-section-inner cit-enquiry-inner">
        <span class="cit-eyebrow">Kapcsolat</span>
        <h2 class="cit-enquiry-title">Foglaljon közvetlenül</h2>
        <p class="cit-enquiry-sub">Írjon nekünk pár sorban, és hamarosan visszajelzünk a szabad időpontokról.</p>
        ${
          email
            ? `<a class="cit-btn cit-btn-lg" href="mailto:${esc(email)}">Kapcsolatfelvétel</a>`
            : `<span class="cit-btn cit-btn-lg cit-btn-disabled">Kapcsolat hamarosan</span>`
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
    default: "immersive",
    variants: {
      immersive: {
        id: "immersive",
        hint: "nagy, teljes-szélességű immerzív hero (fotóval kép-háttér + gradiens, erős display-cím + CTA)",
        render: heroImmersive,
        css: HERO_IMMERSIVE_CSS,
      },
      plain: {
        id: "plain",
        hint: "visszafogott, minimál fejléc (szerkesztői/tiszta hangulat)",
        render: heroPlain,
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
      card: { id: "card", hint: "érdeklődés-sáv (gerinc CTA)", render: enquiryCard },
    },
  },
};

/** Shared primitive CSS — dresses ONLY from --cit-* tokens (skin-agnostic). Craft: generous
 *  vertical rhythm, strong display type scale, prominent CTA — distilled from the sample bar. */
export const PRIMITIVE_CSS = `  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--cit-bg); color: var(--cit-ink);
    font-family: var(--cit-font-body); line-height: 1.65; -webkit-font-smoothing: antialiased; }
  .cit-section-inner, .cit-hero-inner { max-width: 1120px; margin: 0 auto;
    padding: clamp(3.5rem, 8vw, 6.5rem) clamp(1.25rem, 4vw, 2.5rem); }
  .cit-eyebrow { display: inline-block; font-size: .78rem; letter-spacing: .28em;
    text-transform: uppercase; color: var(--cit-accent); font-weight: 600; margin: 0 0 1.4rem; }
  .cit-hero-title { font-family: var(--cit-font-display); font-size: clamp(2.6rem, 6.2vw, 5.2rem);
    line-height: 1.05; letter-spacing: -.01em; margin: 0 0 .35em; max-width: 16ch; color: var(--cit-ink); }
  .cit-hero-tagline { font-size: clamp(1.15rem, 2.2vw, 1.5rem); color: var(--cit-muted);
    margin: 0; max-width: 54ch; line-height: 1.5; }
  .cit-intro { font-size: clamp(1.15rem, 1.6vw, 1.35rem); color: var(--cit-muted);
    max-width: 62ch; margin: 0 0 2.6rem; line-height: 1.6; }
  .cit-feature-grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
  .cit-feature { background: var(--cit-surface); border: 1px solid var(--cit-line);
    border-radius: var(--cit-radius); padding: 1.4rem 1.5rem; box-shadow: var(--cit-shadow);
    font-size: 1.05rem; }
  .cit-gallery-grid { display: grid; gap: .75rem;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .cit-gallery-item { margin: 0; border-radius: var(--cit-radius); overflow: hidden; }
  .cit-gallery-item img { width: 100%; height: 100%; object-fit: cover; display: block; aspect-ratio: 4 / 3; }
  .cit-enquiry { background: var(--cit-surface); border-top: 1px solid var(--cit-line); }
  .cit-enquiry-inner { max-width: 660px; text-align: center; }
  .cit-enquiry-title { font-family: var(--cit-font-display); font-size: clamp(1.9rem, 3.8vw, 3rem);
    line-height: 1.1; color: var(--cit-ink); margin: 0 0 .5em; }
  .cit-enquiry-sub { color: var(--cit-muted); margin: 0 0 2.2rem; font-size: 1.15rem; }
  .cit-btn { display: inline-block; background: var(--cit-accent); color: var(--cit-on-accent);
    text-decoration: none; padding: .85rem 1.7rem; border-radius: var(--cit-radius); font-weight: 600;
    letter-spacing: .02em; }
  .cit-btn-lg { margin-top: 2rem; padding: 1.05rem 2.4rem; font-size: 1.02rem; }
  .cit-btn-disabled { opacity: .55; }`;
