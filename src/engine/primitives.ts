// Deterministic layout primitives as a VARIANT REGISTRY (ADR-0017). Each SectionKind has ≥1
// variant — a pure (data) => HTML function with a FIXED structure, token-dressed classes, and
// optional variant-scoped CSS. Only DATA fills the slots (no AI, no randomness → mock=live).
//
// CRAFT BAR: the visual craft is distilled from the reference sample mocks (immersive full-
// bleed hero, eyebrow + large display type, prominent enquiry band, generous rhythm). The
// hero is the #1 "wow" lever, so the default hero is immersive (photo background + scrim when
// a photo exists, a tall typographic hero otherwise). Module hooks (data-cit-module) let the
// runtime (06-UI-CONTRACT) hydrate the enquiry into the interactive booking widget.

import { iconSvg, matchIcon, starIcon, starRow } from "./icons.js";
import type { Faq, Review, Room, SectionCopy, SectionKind, SiteData } from "./recipe.js";

// ---- stats (data-only band — never fabricated) ---------------------------

function statsSection(d: SiteData): string {
  if (!d.stats || !d.stats.length) return "";
  const items = d.stats
    .map((s) => {
      const ico = s.icon
        ? `<span class="cit-stat-ico">${s.icon === "star" ? starIcon() : iconSvg(s.icon)}</span>`
        : "";
      return `<div class="cit-stat"><strong>${esc(s.value)}${ico}</strong><span>${esc(s.label)}</span></div>`;
    })
    .join("\n          ");
  return `<section class="cit-stats">
      <div class="cit-section-inner">
        <div class="cit-stat-row">
          ${items}
        </div>
      </div>
    </section>`;
}

const STATS_CSS = `  .cit-stats { background: var(--cit-surface); border-top: 1px solid var(--cit-line);
    border-bottom: 1px solid var(--cit-line); }
  .cit-stats .cit-section-inner { padding-block: clamp(2.2rem, 4vw, 3.2rem); }
  .cit-stat-row { display: grid; gap: 1.5rem; grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 720px) { .cit-stat-row { grid-template-columns: repeat(4, 1fr); } }
  .cit-stat { border-left: 3px solid var(--cit-accent); padding-left: 1rem; }
  .cit-stat strong { display: flex; align-items: center; gap: .18em; font-family: var(--cit-font-display);
    font-size: clamp(1.8rem, 3.4vw, 2.6rem); line-height: 1; color: var(--cit-ink); }
  .cit-stat-ico { display: inline-flex; }
  .cit-stat-ico svg { width: .7em; height: .7em; color: var(--cit-accent); }
  .cit-stat span { font-size: .82rem; letter-spacing: .1em; text-transform: uppercase; color: var(--cit-muted); }`;

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
/** Full-bleed hero photo as a SEPARATE layer (behind the content), so it can ken-burns
 *  independently of the text. The gradient scrim rides on the same layer for legibility. */
function heroBgLayer(bg: string): string {
  // Robust legibility scrim (works on bright AND dark photos): a top-to-bottom darkening PLUS a
  // constant floor tint, so the white hero title stays readable regardless of skin/photo. The
  // gradient rides the same layer as the photo so it ken-burns together.
  return bg
    ? `<div class="cit-hero-bg" style="background-image:linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,.12) 42%, rgba(0,0,0,.82) 100%), url('${esc(
        bg,
      )}')"></div>`
    : "";
}

function heroImmersive(d: SiteData): string {
  const bg = d.photos[0]?.url ?? "";
  const eyebrow = d.contact.address
    ? `<span class="cit-eyebrow">${esc(d.contact.address)}</span>`
    : "";
  const cta = d.contact.email
    ? `<a class="cit-btn cit-btn-lg" href="#cit-enquiry">Érdeklődés</a>`
    : "";
  const cls = bg ? "cit-hero cit-hero--immersive cit-hero--photo" : "cit-hero cit-hero--immersive";
  return `<section class="${cls}">
      ${heroBgLayer(bg)}<div class="cit-hero-inner">
        ${eyebrow}
        <h1 class="cit-hero-title">${esc(d.name)}</h1>
        <p class="cit-hero-tagline">${esc(d.tagline)}</p>
        ${cta}
      </div>
    </section>`;
}

/** Editorial hero (the reference-bar "voice" hero). Leads with the AI-written poetic HEADLINE
 *  (copy.lead) as the H1 — the brand name demotes to the eyebrow — with an italic accent word.
 *  Same full-bleed photo + scrim craft as the immersive hero. Falls back to the property name
 *  as the H1 when no editorial lead is supplied, so it degrades to the immersive hero cleanly. */
function heroEditorial(d: SiteData, copy?: SectionCopy): string {
  const bg = d.photos[0]?.url ?? "";
  const kicker = copy?.eyebrow ?? d.contact.address ?? "";
  const eyebrow = kicker ? `<span class="cit-eyebrow">${esc(kicker)}</span>` : "";
  const headline = copy?.lead ? accentPhrase(copy.lead, copy.accent) : esc(d.name);
  const cta = d.contact.email
    ? `<a class="cit-btn cit-btn-lg" href="#cit-enquiry">Érdeklődés</a>`
    : "";
  const cls = bg ? "cit-hero cit-hero--immersive cit-hero--photo" : "cit-hero cit-hero--immersive";
  return `<section class="${cls}">
      ${heroBgLayer(bg)}<div class="cit-hero-inner">
        ${eyebrow}
        <h1 class="cit-hero-title">${headline}</h1>
        <p class="cit-hero-tagline">${esc(d.tagline)}</p>
        ${cta}
      </div>
    </section>`;
}

/** Centered full-viewport hero (the reference-bar "fullbleed" treatment): 100svh, centered
 *  composition, eyebrow + giant display title + sub + CTA + scroll hint. Copy-aware like the
 *  editorial hero (copy.lead leads as the H1, the name demotes to the eyebrow). */
function heroCentered(d: SiteData, copy?: SectionCopy): string {
  const bg = d.photos[0]?.url ?? "";
  const kicker = copy?.eyebrow ?? d.contact.address ?? "";
  const eyebrow = kicker ? `<span class="cit-eyebrow">${esc(kicker)}</span>` : "";
  const headline = copy?.lead ? accentPhrase(copy.lead, copy.accent) : esc(d.name);
  const cta = d.contact.email
    ? `<a class="cit-btn cit-btn-lg" href="#cit-enquiry">Szabad időpontok</a>`
    : "";
  const cls = bg
    ? "cit-hero cit-hero--immersive cit-hero--centered cit-hero--photo"
    : "cit-hero cit-hero--immersive cit-hero--centered";
  return `<section class="${cls}">
      ${heroBgLayer(bg)}<div class="cit-hero-inner">
        ${eyebrow}
        <h1 class="cit-hero-title">${headline}</h1>
        <p class="cit-hero-tagline">${esc(d.tagline)}</p>
        ${cta}
      </div>
      <span class="cit-scroll-hint" aria-hidden="true">Görgess</span>
    </section>`;
}

const HERO_CENTERED_CSS = `  .cit-hero--centered { align-items: center; justify-content: center; text-align: center;
    height: 100svh; min-height: 640px; }
  .cit-hero--centered .cit-hero-inner { max-width: 860px; }
  .cit-hero--centered .cit-hero-title { margin-inline: auto; max-width: 18ch; }
  .cit-hero--centered .cit-hero-tagline { margin-inline: auto; }
  .cit-scroll-hint { position: absolute; z-index: 2; bottom: 108px; left: 50%;
    transform: translateX(-50%); font-size: .72rem; letter-spacing: .3em;
    text-transform: uppercase; color: #fff; opacity: .75; }
  @media (prefers-reduced-motion: no-preference) {
    .cit-scroll-hint { animation: cit-bob 2.4s infinite ease-in-out; }
    @keyframes cit-bob { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, 8px); } }
  }`;

/** COLLAGE header hero (the card-sidebar / listing reference treatment): a title row with
 *  the REAL rating meta (never fabricated) + a 5-photo mosaic instead of a full-bleed photo.
 *  Feels like a considered listing page, not a brochure. */
function heroCollage(d: SiteData, copy?: SectionCopy): string {
  const headline = copy?.lead ? accentPhrase(copy.lead, copy.accent) : esc(d.name);
  const meta = [
    d.rating
      ? `<span class="cit-collage-rate">${starIcon()} ${String(d.rating.value).replace(".", ",")}${
          d.rating.count ? ` · ${d.rating.count} értékelés` : ""
        }</span>`
      : "",
    d.contact.address ? `<span>${esc(d.contact.address)}</span>` : "",
  ]
    .filter(Boolean)
    .join("\n          ");
  const shots = d.photos.slice(0, 5);
  const mosaic = shots
    .map(
      (p, i) =>
        `<figure class="cit-collage-m${i + 1}"><img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"></figure>`,
    )
    .join("\n          ");
  return `<section class="cit-hero cit-hero--collage">
      <div class="cit-hero-inner">
        <h1 class="cit-collage-title">${headline}</h1>
        <p class="cit-hero-tagline">${esc(d.tagline)}</p>
        <div class="cit-collage-meta">
          ${meta}
        </div>
        ${
          shots.length
            ? `<div class="cit-collage" data-cit-module="gallery">
          ${mosaic}
        </div>`
            : ""
        }
      </div>
    </section>`;
}

const HERO_COLLAGE_CSS = `  .cit-hero--collage { border-bottom: 0; }
  .cit-hero--collage .cit-hero-inner { padding-block: 1.6rem 0; }
  .cit-collage-title { font-family: var(--cit-font-display); font-size: clamp(1.6rem, 3.4vw, 2.2rem);
    line-height: 1.25; margin: 0 0 .25em; color: var(--cit-ink); }
  .cit-hero--collage .cit-hero-tagline { font-size: 1.05rem; margin-bottom: .6rem; }
  .cit-collage-meta { display: flex; flex-wrap: wrap; gap: .5rem 1.2rem; font-size: .92rem;
    color: var(--cit-muted); margin-bottom: 1.2rem; }
  .cit-collage-rate { display: inline-flex; align-items: center; gap: .35em;
    color: var(--cit-ink); font-weight: 700; }
  .cit-collage-rate svg { width: 15px; height: 15px; color: var(--cit-accent); }
  .cit-collage { display: grid; gap: 8px; grid-template-columns: 1fr;
    border-radius: calc(var(--cit-radius) + 4px); overflow: hidden; }
  .cit-collage figure { margin: 0; overflow: hidden; min-height: 220px; }
  .cit-collage img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s; }
  .cit-collage figure:hover img { transform: scale(1.04); }
  @media (min-width: 800px) {
    .cit-collage { grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 200px 200px; }
    .cit-collage figure { min-height: 0; }
    .cit-collage-m1 { grid-row: span 2; }
  }
  @media (max-width: 799px) { .cit-collage-m4, .cit-collage-m5 { display: none; } }`;

/** MASTHEAD hero (the editorial-press reference treatment): a newspaper front — thin fact
 *  row, giant centered serif brand, italic subtitle. Deliberately photo-less; the lead-story
 *  features variant below carries the first photo. */
function heroMasthead(d: SiteData, copy?: SectionCopy): string {
  const facts = [d.contact.address, d.contact.phone]
    .filter(Boolean)
    .map((f) => `<span>${esc(f!)}</span>`)
    .join("\n          ");
  const sub = copy?.lead ? accentPhrase(copy.lead, copy.accent) : esc(d.tagline);
  return `<section class="cit-hero cit-hero--masthead">
      <div class="cit-hero-inner">
        ${facts ? `<div class="cit-mast-top">\n          ${facts}\n        </div>` : ""}
        <h1 class="cit-mast-title">${esc(d.name)}</h1>
        <p class="cit-mast-sub">${sub}</p>
      </div>
    </section>`;
}

const HERO_MASTHEAD_CSS = `  .cit-hero--masthead { border-bottom: 2px solid var(--cit-ink); text-align: center; }
  .cit-hero--masthead .cit-hero-inner { padding-block: 1rem 1.6rem; }
  .cit-mast-top { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: var(--cit-muted);
    border-bottom: 1px solid var(--cit-line); padding-bottom: .8rem; margin-bottom: 1.6rem; }
  .cit-mast-title { font-family: var(--cit-font-display); font-size: clamp(2.4rem, 6.5vw, 4.2rem);
    letter-spacing: .02em; margin: 0 0 .15em; color: var(--cit-ink); }
  .cit-mast-sub { font-family: var(--cit-font-display); font-style: italic; color: var(--cit-muted);
    margin: 0; font-size: 1.1rem; }`;

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

const HERO_IMMERSIVE_CSS = `  .cit-hero--immersive { position: relative; overflow: hidden; display: flex;
    align-items: flex-end; min-height: clamp(460px, 82vh, 780px); border-bottom: 0; }
  .cit-hero-bg { position: absolute; inset: 0; z-index: 0; background-size: cover;
    background-position: center; transform-origin: center; will-change: transform; }
  .cit-hero--immersive .cit-hero-inner { position: relative; z-index: 2; width: 100%; }
  .cit-hero--immersive:not(.cit-hero--photo) { background: var(--cit-surface);
    border-bottom: 1px solid var(--cit-line); align-items: center; }
  .cit-hero--photo .cit-hero-title { color: #fff; text-shadow: 0 2px 30px rgba(0,0,0,.45); }
  .cit-hero--photo .cit-hero-tagline { color: rgba(255,255,255,.92); }
  .cit-hero--photo .cit-eyebrow { color: #fff; opacity: .88; }`;

// ---- features ------------------------------------------------------------

function featuresAmenities(d: SiteData, copy?: SectionCopy): string {
  const items = d.highlights
    .map(
      (h) =>
        `<li class="cit-amenity">${iconSvg(matchIcon(h))}<span>${esc(h)}</span></li>`,
    )
    .join("\n          ");
  // Optional editorial heading (brand voice) above the intro — only when the planner supplies it.
  const head = copy?.title || copy?.eyebrow ? `${sectionHead("", copy?.title ?? "", copy)}` : "";
  return `<section class="cit-features cit-features--amenities">
      <div class="cit-section-inner">
        ${head}
        <p class="cit-intro">${esc(d.intro)}</p>
        <ul class="cit-amenity-grid">
          ${items}
        </ul>
      </div>
    </section>`;
}

const FEATURES_AMENITIES_CSS = `  .cit-amenity-grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
  .cit-amenity { display: flex; align-items: center; gap: .9rem; background: var(--cit-surface);
    border: 1px solid var(--cit-line); border-radius: var(--cit-radius); padding: 1.15rem 1.3rem;
    box-shadow: var(--cit-shadow); font-size: 1.05rem; }
  .cit-amenity svg { flex: none; width: 26px; height: 26px; color: var(--cit-accent); }`;

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

/** Centered amenity TILES (the reference-bar treatment): icon above, label below, hover
 *  accent border. The intro rides in the section head as the sub line. */
function featuresTiles(d: SiteData, copy?: SectionCopy): string {
  const tiles = d.highlights
    .map(
      (h) =>
        `<li class="cit-amen-tile">${iconSvg(matchIcon(h))}<span>${esc(h)}</span></li>`,
    )
    .join("\n          ");
  return `<section class="cit-features cit-features--tiles">
      <div class="cit-section-inner">
        <div class="cit-sec-head">
          ${sectionHead("Szolgáltatások", "Minden, ami a pihenéshez kell", copy)}
          <p class="cit-sec-sub">${esc(d.intro)}</p>
        </div>
        <ul class="cit-amen-tile-grid">
          ${tiles}
        </ul>
      </div>
    </section>`;
}

const FEATURES_TILES_CSS = `  .cit-amen-tile-grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 1.1rem;
    grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 768px) { .cit-amen-tile-grid { grid-template-columns: repeat(4, 1fr); } }
  .cit-amen-tile { text-align: center; padding: 1.9rem 1.1rem; border: 1px solid var(--cit-line);
    border-radius: var(--cit-radius); background: var(--cit-surface); transition: border-color .2s; }
  .cit-amen-tile:hover { border-color: var(--cit-accent); }
  .cit-amen-tile svg { width: 30px; height: 30px; color: var(--cit-accent); margin-bottom: .8rem; }
  .cit-amen-tile span { display: block; font-size: .98rem; color: var(--cit-ink); }`;

// ---- gallery -------------------------------------------------------------

/** Optional editorial heading for a gallery (brand voice, e.g. "Pillanatok az erdőből"). */
function galleryHead(copy?: SectionCopy): string {
  return copy?.title || copy?.eyebrow ? `${sectionHead("", copy?.title ?? "", copy)}\n        ` : "";
}

function galleryGrid(d: SiteData, copy?: SectionCopy): string {
  const imgs = d.photos
    .map(
      (p) =>
        `<figure class="cit-gallery-item"><img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"></figure>`,
    )
    .join("\n          ");
  return `<section class="cit-gallery" data-cit-module="gallery">
      <div class="cit-section-inner">
        ${galleryHead(copy)}<div class="cit-gallery-grid">
          ${imgs}
        </div>
      </div>
    </section>`;
}

function galleryMasonry(d: SiteData, copy?: SectionCopy): string {
  const imgs = d.photos
    .map(
      (p) =>
        `<figure class="cit-gallery-item"><img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"></figure>`,
    )
    .join("\n          ");
  return `<section class="cit-gallery cit-gallery--masonry" data-cit-module="gallery">
      <div class="cit-section-inner">
        ${galleryHead(copy)}<div class="cit-gallery-cols">
          ${imgs}
        </div>
      </div>
    </section>`;
}

const GALLERY_MASONRY_CSS = `  .cit-gallery--masonry .cit-gallery-cols { column-count: 3; column-gap: .75rem; }
  @media (max-width: 760px) { .cit-gallery--masonry .cit-gallery-cols { column-count: 2; } }
  .cit-gallery--masonry .cit-gallery-item { break-inside: avoid; margin: 0 0 .75rem; border-radius: var(--cit-radius); overflow: hidden; }
  .cit-gallery--masonry .cit-gallery-item img { width: 100%; height: auto; display: block; }`;

// Deterministic mosaic span pattern (index → grid span), repeating every 6 photos: a big
// anchor tile, plain tiles, one tall, one wide — the reference's asymmetric gallery rhythm.
const MOSAIC_SPANS: readonly string[] = [
  "cit-g-wide cit-g-tall",
  "",
  "",
  "cit-g-tall",
  "",
  "cit-g-wide",
];

/** Asymmetric MOSAIC gallery (the reference-bar treatment): span-based grid, not a uniform
 *  rack. Deterministic spans by photo index → mock=live stable. */
function galleryMosaic(d: SiteData, copy?: SectionCopy): string {
  const imgs = d.photos
    .map((p, i) => {
      const span = MOSAIC_SPANS[i % MOSAIC_SPANS.length];
      return `<figure class="cit-gallery-item${span ? ` ${span}` : ""}"><img src="${esc(
        p.url,
      )}" alt="${esc(p.alt)}" loading="lazy"></figure>`;
    })
    .join("\n          ");
  return `<section class="cit-gallery cit-gallery--mosaic" data-cit-module="gallery">
      <div class="cit-section-inner">
        ${galleryHead(copy)}<div class="cit-gallery-mosaic">
          ${imgs}
        </div>
      </div>
    </section>`;
}

const GALLERY_MOSAIC_CSS = `  .cit-gallery-mosaic { display: grid; gap: .75rem; grid-template-columns: repeat(2, 1fr); }
  .cit-gallery-mosaic .cit-gallery-item { min-height: 160px; }
  .cit-gallery-mosaic .cit-gallery-item img { aspect-ratio: auto; }
  @media (min-width: 768px) {
    .cit-gallery-mosaic { grid-template-columns: repeat(4, 1fr); grid-auto-rows: 200px; grid-auto-flow: dense; }
    .cit-gallery-mosaic .cit-g-wide { grid-column: span 2; }
    .cit-gallery-mosaic .cit-g-tall { grid-row: span 2; }
  }`;

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

/** Compact enquiry BAR (the reference "glass booking bar" slot). The runtime hydrates the
 *  booking module into the interactive bar form (data-cit-variant="bar"); the static content
 *  below is the no-JS fallback (a working mailto CTA — never an empty band). The archetype
 *  decides WHERE the bar sits (e.g. overlapping the hero bottom). */
function enquiryBar(d: SiteData): string {
  const email = d.contact.email ?? "";
  const phone = d.contact.phone ?? "";
  // No-JS/fallback CTA ladder: mailto → tel → disabled. A phone-only lead still gets a
  // WORKING action in the most exposed slot (the design guard's "Kapcsolat hamarosan" flag).
  const cta = email
    ? `<a class="cit-btn" href="mailto:${esc(email)}">Érdeklődés küldése</a>`
    : phone
      ? `<a class="cit-btn" href="tel:${esc(phone.replace(/\s+/g, ""))}">Hívás: ${esc(phone)}</a>`
      : `<span class="cit-btn cit-btn-disabled">Kapcsolat hamarosan</span>`;
  return `<section id="cit-enquiry" class="cit-enquiry cit-enquiry--bar" data-cit-module="booking" data-cit-variant="bar" data-cit-name="${esc(
    d.name,
  )}"${email ? ` data-cit-email="${esc(email)}"` : ""}${phone ? ` data-cit-phone="${esc(phone)}"` : ""}>
      <div class="cit-enquiry-bar-inner">
        <p class="cit-enquiry-bar-title">Foglalási igény</p>
        ${cta}
      </div>
    </section>`;
}

const ENQUIRY_BAR_CSS = `  .cit-enquiry--bar { background: none; border-top: 0; }
  .cit-enquiry-bar-inner { max-width: 1180px; margin: 0 auto; display: flex; flex-wrap: wrap;
    align-items: center; justify-content: space-between; gap: 1rem;
    padding: 1.4rem clamp(1.25rem, 4vw, 2rem); }
  .cit-enquiry-bar-title { margin: 0; font-family: var(--cit-font-display); font-size: 1.25rem;
    color: var(--cit-ink); }
  /* The bar variant always sits inside an archetype-provided container (glass bar, dark dock,
     dashed coupon) — that container IS the card. The runtime hydrates a self-contained
     surface widget into the slot, so strip its own chrome to avoid a card-inside-a-card. */
  .cit-enquiry--bar .cit-book { background: none; border: 0; box-shadow: none;
    padding: 1.2rem clamp(1.25rem, 4vw, 2rem); }`;

// ---- rooms / reviews (sample-capable modules, ADR-0015 / §B.17) ----------

/** Marked sample-content note — the visible §B.17 marking that this section is illustrative. */
function sampleNote(text: string): string {
  return `<p class="cit-sample-note">${esc(text)}</p>`;
}

// Generic, ILLUSTRATIVE sample content (no hard fact about THIS property; shown only under a
// visible "minta" note, only in the MOCK phase; the live render drops it without real data).
export const SAMPLE_ROOMS: readonly Room[] = [
  { name: "Kétágyas szoba", capacity: "2 fő", note: "Kényelmes franciaágy, saját fürdőszoba." },
  { name: "Családi szoba", capacity: "2+2 fő", note: "Tágas szoba pótágyazási lehetőséggel." },
  { name: "Apartman", capacity: "4 fő", note: "Külön hálótér és felszerelt konyhasarok." },
];
export const SAMPLE_REVIEWS: readonly Review[] = [
  { quote: "Az érkezéstől az utolsó reggeliig azt éreztük: itt tényleg ránk figyelnek.", author: "Anna", meta: "vendégértékelés" },
  { quote: "Este a teraszon ülve értettük meg, miért járnak ide vissza a törzsvendégek.", author: "Péter", meta: "vendégértékelés" },
  { quote: "A gyerekek már az autóban kérdezték, mikor jövünk legközelebb.", author: "A Kovács család", meta: "vendégértékelés" },
];
// Generic FAQ prompts (NOT answered with a fabricated policy about THIS property; the sample
// answers are illustrative placeholders the owner replaces with real ones before go-live).
export const SAMPLE_FAQS: readonly Faq[] = [
  { q: "Mikor lehet becsekkolni és kicsekkolni?", a: "Ide kerül a tényleges érkezési és távozási időpont — a saját házirended szerint." },
  { q: "Van parkolási lehetőség?", a: "Ide kerül a parkolásra vonatkozó valós információ (helyszín, díj, kapacitás)." },
  { q: "Hozhatunk kisállatot?", a: "Ide kerül a kisállat-politikád — hogy fogadtok-e, milyen feltételekkel." },
  { q: "Tartalmaz reggelit a foglalás?", a: "Ide kerül az étkezésre vonatkozó valós tájékoztatás." },
];

/** Color the last word of a section title in the accent tone (a subtle editorial touch,
 *  like the reference samples' accent-word headings). */
function accentLast(title: string): string {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return esc(title);
  const last = words.pop()!;
  return `${esc(words.join(" "))} <span class="cit-accent-word">${esc(last)}</span>`;
}

/** Render `text` with an optional `accent` substring italicised in the accent tone, and "\n"
 *  turned into a line break. Used for AI-written editorial headings/hero leads where the
 *  planner picks EXACTLY which phrase to accent (vs. accentLast's mechanical last-word rule). */
function accentPhrase(text: string, accent?: string): string {
  const br = (s: string) => esc(s).replace(/\n/g, "<br>");
  if (!accent) return br(text);
  const i = text.indexOf(accent);
  if (i < 0) return br(text);
  return `${br(text.slice(0, i))}<span class="cit-accent-word">${esc(accent)}</span>${br(
    text.slice(i + accent.length),
  )}`;
}

/** Section eyebrow + heading. With editorial copy → brand-voice eyebrow + title (accent picked
 *  by the planner); without → the generic label with a mechanical last-word accent. */
function sectionHead(genericEyebrow: string, genericTitle: string, copy?: SectionCopy): string {
  const eb = copy?.eyebrow ?? genericEyebrow;
  const ebHtml = eb ? `<span class="cit-eyebrow">${esc(eb)}</span>\n        ` : "";
  const titleHtml = copy?.title ? accentPhrase(copy.title, copy.accent) : accentLast(genericTitle);
  return `${ebHtml}<h2 class="cit-section-title">${titleHtml}</h2>`;
}

/** Resolve rooms to render: real data, or gallery-photo-backed illustrative SAMPLE (mock only). */
function resolveRooms(d: SiteData): { rooms: readonly Room[]; note: string } {
  const real = d.rooms && d.rooms.length ? d.rooms : null;
  const rooms =
    real ??
    SAMPLE_ROOMS.map((r, i) => (d.photos.length ? { ...r, photo: d.photos[i % d.photos.length] } : r));
  const note = real ? "" : sampleNote("Minta — ide az Ön szobái, fotói és árai kerülnek.");
  return { rooms, note };
}

function roomsSection(d: SiteData, copy?: SectionCopy): string {
  // Image-led room cards. Real rooms use their own photo; sample rooms borrow the lead's
  // gallery photos (illustrative, under the visible "minta" note — never a misattribution claim).
  const { rooms, note } = resolveRooms(d);
  const cards = rooms
    .map((r) => {
      const img = r.photo
        ? `<div class="cit-room-img"><img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt)}" loading="lazy"></div>`
        : "";
      const cap = r.capacity ? `<p class="cit-room-meta">${esc(r.capacity)}</p>` : "";
      const noteP = r.note ? `<p class="cit-room-note">${esc(r.note)}</p>` : "";
      return `<article class="cit-room">${img}<div class="cit-room-body"><h3>${esc(r.name)}</h3>${cap}${noteP}</div></article>`;
    })
    .join("\n          ");
  return `<section class="cit-rooms">
      <div class="cit-section-inner">
        ${sectionHead("Szobák", "Szállásaink és szobáink", copy)}
        ${note}
        <div class="cit-room-grid">
          ${cards}
        </div>
      </div>
    </section>`;
}

/** Editorial SHOWCASE: full-width alternating image/text rows (asymmetry = the bespoke feel).
 *  Distinct rhythm from the uniform card grid; the biggest structural "wow" lever after the hero. */
function roomsShowcase(d: SiteData, copy?: SectionCopy): string {
  const { rooms, note } = resolveRooms(d);
  const rows = rooms
    .map((r, i) => {
      const img = r.photo
        ? `<div class="cit-show-img"><img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt)}" loading="lazy"></div>`
        : "";
      const cap = r.capacity ? `<p class="cit-room-meta">${esc(r.capacity)}</p>` : "";
      const noteP = r.note ? `<p class="cit-show-note">${esc(r.note)}</p>` : "";
      const idx = `<span class="cit-show-idx">${String(i + 1).padStart(2, "0")}</span>`;
      return `<article class="cit-show-row${i % 2 ? " cit-show-row--rev" : ""}">${img}<div class="cit-show-body">${idx}<h3>${esc(
        r.name,
      )}</h3>${cap}${noteP}</div></article>`;
    })
    .join("\n          ");
  return `<section class="cit-rooms cit-rooms--showcase">
      <div class="cit-section-inner">
        ${sectionHead("Szobák", "Szállásaink és szobáink", copy)}
        ${note}
        <div class="cit-show-list">
          ${rows}
        </div>
      </div>
    </section>`;
}

/** Boutique room cards (the reference-bar treatment): photo, name, meta chips, note and a
 *  card foot with the REAL price (when we have one — sample rooms never carry a price, §B.17)
 *  and an enquiry link. */
function roomsBoutique(d: SiteData, copy?: SectionCopy): string {
  const { rooms, note } = resolveRooms(d);
  const cards = rooms
    .map((r) => {
      const img = r.photo
        ? `<div class="cit-room-img"><img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt)}" loading="lazy"></div>`
        : "";
      const meta = r.capacity ? `<div class="cit-room-chips"><span>${esc(r.capacity)}</span></div>` : "";
      const noteP = r.note ? `<p class="cit-room-note">${esc(r.note)}</p>` : "";
      const price = r.price ? `<span class="cit-room-price"><strong>${esc(r.price)}</strong></span>` : "";
      return `<article class="cit-room cit-room--boutique">${img}<div class="cit-room-body"><h3>${esc(
        r.name,
      )}</h3>${meta}${noteP}<div class="cit-room-foot">${price}<a href="#cit-enquiry">Érdeklődés →</a></div></div></article>`;
    })
    .join("\n          ");
  return `<section class="cit-rooms cit-rooms--boutique">
      <div class="cit-section-inner">
        <div class="cit-sec-head">
          ${sectionHead("Szobák", "Szállásaink és szobáink", copy)}
        </div>
        ${note}
        <div class="cit-room-grid">
          ${cards}
        </div>
      </div>
    </section>`;
}

const ROOMS_BOUTIQUE_CSS = `  .cit-rooms--boutique .cit-sample-note { display: block; width: fit-content; margin-inline: auto; }
  .cit-room-chips { display: flex; gap: 1rem; font-size: .82rem; letter-spacing: .08em;
    text-transform: uppercase; color: var(--cit-muted); margin: 0 0 .7rem; }
  .cit-room-foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    border-top: 1px solid var(--cit-line); margin-top: 1.1rem; padding-top: 1rem; }
  .cit-room-price strong { font-family: var(--cit-font-display); font-size: 1.3rem; color: var(--cit-ink); }
  .cit-room-foot a { color: var(--cit-accent); text-decoration: none; font-size: .82rem;
    letter-spacing: .1em; text-transform: uppercase; font-weight: 600; }`;

/** Horizontal SUITE-SCROLL rooms (the dark-luxury reference treatment): snap-scrolling
 *  cards with image, meta line, note and a price/enquiry foot (price REAL-only, §B.17). */
function roomsSuitesScroll(d: SiteData, copy?: SectionCopy): string {
  const { rooms, note } = resolveRooms(d);
  const cards = rooms
    .map((r) => {
      const img = r.photo
        ? `<div class="cit-suite-img"><img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt)}" loading="lazy"></div>`
        : "";
      const meta = r.capacity ? `<p class="cit-suite-meta">${esc(r.capacity)}</p>` : "";
      const noteP = r.note ? `<p class="cit-suite-note">${esc(r.note)}</p>` : "";
      const price = r.price ? `<strong>${esc(r.price)}</strong>` : "<span></span>";
      return `<article class="cit-suite">${img}<div class="cit-suite-body"><h3>${esc(
        r.name,
      )}</h3>${meta}${noteP}<div class="cit-suite-foot">${price}<a href="#cit-enquiry">Érdeklődés</a></div></div></article>`;
    })
    .join("\n          ");
  return `<section class="cit-rooms cit-rooms--suites">
      <div class="cit-section-inner cit-suites-head">
        ${sectionHead("Szobák", "Szállásaink és szobáink", copy)}
        ${note}
      </div>
      <div class="cit-suites-scroll">
          ${cards}
      </div>
    </section>`;
}

const ROOMS_SUITES_CSS = `  .cit-rooms--suites .cit-suites-head { padding-bottom: 0; }
  .cit-suites-scroll { display: flex; gap: 1.4rem; overflow-x: auto; padding: 2.6rem 4% 1.4rem;
    scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
  .cit-suites-scroll::-webkit-scrollbar { height: 4px; }
  .cit-suites-scroll::-webkit-scrollbar-thumb { background: var(--cit-accent); }
  .cit-suite { min-width: min(340px, 84vw); scroll-snap-align: start;
    background: var(--cit-surface); border: 1px solid var(--cit-line); }
  .cit-suite-img { height: 240px; overflow: hidden; }
  .cit-suite-img img { width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform .6s; }
  .cit-suite:hover .cit-suite-img img { transform: scale(1.06); }
  .cit-suite-body { padding: 1.6rem; }
  .cit-suite-body h3 { font-family: var(--cit-font-display); font-size: 1.4rem; margin: 0 0 .4em; color: var(--cit-ink); }
  .cit-suite-meta { font-size: .76rem; letter-spacing: .12em; text-transform: uppercase;
    color: var(--cit-muted); margin: 0 0 .8rem; }
  .cit-suite-note { font-size: .92rem; color: var(--cit-muted); margin: 0 0 1.2rem; line-height: 1.6; }
  .cit-suite-foot { display: flex; justify-content: space-between; align-items: baseline;
    border-top: 1px solid var(--cit-line); padding-top: 1.1rem; }
  .cit-suite-foot strong { font-family: var(--cit-font-display); font-size: 1.25rem; color: var(--cit-accent); }
  .cit-suite-foot a { color: var(--cit-ink); font-size: .76rem; letter-spacing: .14em;
    text-transform: uppercase; text-decoration: none; border-bottom: 1px solid var(--cit-accent); }`;

/** Numbered RITUAL grid features (the dark-luxury reference treatment): a 1px-gap grid of
 *  numbered panels — the highlights as a considered "menu", not chip cards. */
function featuresRituals(d: SiteData, copy?: SectionCopy): string {
  const roman = ["I.", "II.", "III.", "IV.", "V.", "VI.", "VII.", "VIII.", "IX.", "X.", "XI.", "XII."];
  const items = d.highlights
    .map(
      (h, i) =>
        `<div class="cit-rit"><p class="cit-rit-no">${roman[i] ?? `${i + 1}.`}</p><h3>${esc(h)}</h3></div>`,
    )
    .join("\n          ");
  return `<section class="cit-features cit-features--rituals">
      <div class="cit-section-inner">
        ${sectionHead("Szolgáltatások", "Amit itt megtalál", copy)}
        <p class="cit-intro">${esc(d.intro)}</p>
        <div class="cit-rituals">
          ${items}
        </div>
      </div>
    </section>`;
}

/** LEAD-STORY features (the editorial-press reference treatment): a front-page article —
 *  first photo with caption + kicker + heading + DROPCAP intro + CTA, then the highlights
 *  as bordered "classified ads" in newspaper columns. */
function featuresLeadStory(d: SiteData, copy?: SectionCopy): string {
  const photo = d.photos[0];
  const fig = photo
    ? `<figure class="cit-lead-img"><img src="${esc(photo.url)}" alt="${esc(photo.alt)}" loading="lazy"><figcaption>${esc(
        photo.alt,
      )}</figcaption></figure>`
    : "";
  const kicker = copy?.eyebrow ?? "Miért pont ide?";
  const title = copy?.title ? accentPhrase(copy.title, copy.accent) : accentLast("Miért érdemes idejönni");
  const cta = d.contact.email || d.contact.phone
    ? `<a class="cit-btn" href="#cit-enquiry">Szabad időpontot kérek</a>`
    : "";
  const ads = d.highlights
    .map(
      (h) =>
        `<div class="cit-ad">${iconSvg(matchIcon(h))}<h3>${esc(h)}</h3></div>`,
    )
    .join("\n          ");
  return `<section class="cit-features cit-features--leadstory">
      <div class="cit-section-inner">
        <div class="cit-lead-story">
          ${fig}
          <div class="cit-lead-copy">
            <p class="cit-eyebrow">${esc(kicker)}</p>
            <h2 class="cit-section-title">${title}</h2>
            <p class="cit-dropcap">${esc(d.intro)}</p>
            ${cta}
          </div>
        </div>
        ${
          ads
            ? `<div class="cit-classifieds">
          ${ads}
        </div>`
            : ""
        }
      </div>
    </section>`;
}

const FEATURES_LEADSTORY_CSS = `  .cit-lead-story { display: grid; gap: 2.2rem; grid-template-columns: 1fr; align-items: center; }
  @media (min-width: 920px) { .cit-lead-story { grid-template-columns: 1.25fr .75fr; } }
  .cit-lead-img { position: relative; aspect-ratio: 4 / 3; overflow: hidden; margin: 0; }
  .cit-lead-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cit-lead-img figcaption { position: absolute; bottom: 0; left: 0; background: var(--cit-ink);
    color: var(--cit-bg); font-size: .74rem; padding: .5rem .9rem; letter-spacing: .08em; }
  .cit-dropcap { color: var(--cit-ink); margin: 0 0 1.4rem; line-height: 1.65; }
  .cit-dropcap::first-letter { font-family: var(--cit-font-display); font-size: 3.4em; float: left;
    line-height: .85; padding-right: .12em; color: var(--cit-accent); }
  .cit-classifieds { column-count: 1; column-gap: 1.8rem; margin-top: 3.4rem; }
  @media (min-width: 680px) { .cit-classifieds { column-count: 2; } }
  @media (min-width: 980px) { .cit-classifieds { column-count: 3; } }
  .cit-ad { break-inside: avoid; border: 1px solid var(--cit-ink); padding: 1.1rem 1.2rem;
    margin-bottom: 1.2rem; background: var(--cit-surface); display: flex; gap: .8rem; align-items: center; }
  .cit-ad svg { flex: none; width: 24px; height: 24px; color: var(--cit-accent); }
  .cit-ad h3 { font-size: 1rem; margin: 0; font-family: var(--cit-font-body); font-weight: 600; color: var(--cit-ink); }`;

const FEATURES_RITUALS_CSS = `  .cit-rituals { display: grid; gap: 1px; background: var(--cit-line);
    border: 1px solid var(--cit-line); grid-template-columns: 1fr; margin-top: 2.6rem; }
  @media (min-width: 760px) { .cit-rituals { grid-template-columns: repeat(3, 1fr); } }
  .cit-rit { background: var(--cit-bg); padding: 2.2rem 1.9rem; transition: background .3s; }
  .cit-rit:hover { background: var(--cit-surface); }
  .cit-rit-no { font-family: var(--cit-font-display); color: var(--cit-accent);
    font-size: .95rem; letter-spacing: .15em; margin: 0 0 .9rem; }
  .cit-rit h3 { font-family: var(--cit-font-display); font-size: 1.25rem; margin: 0; color: var(--cit-ink); }`;

/** Offset portrait gallery (the dark-luxury reference treatment): 3:4 tiles, every second
 *  one shifted down — a considered, editorial rhythm instead of a uniform rack. */
function galleryOffset(d: SiteData, copy?: SectionCopy): string {
  const imgs = d.photos
    .map(
      (p) =>
        `<figure class="cit-gallery-item"><img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"></figure>`,
    )
    .join("\n          ");
  return `<section class="cit-gallery cit-gallery--offset" data-cit-module="gallery">
      <div class="cit-section-inner">
        ${galleryHead(copy)}<div class="cit-gallery-offset">
          ${imgs}
        </div>
      </div>
    </section>`;
}

const GALLERY_OFFSET_CSS = `  .cit-gallery-offset { display: grid; grid-template-columns: repeat(2, 1fr); gap: .7rem;
    margin-top: 1rem; padding-bottom: 26px; }
  @media (min-width: 860px) { .cit-gallery-offset { grid-template-columns: repeat(4, 1fr); } }
  .cit-gallery-offset .cit-gallery-item { aspect-ratio: 3 / 4; }
  .cit-gallery-offset .cit-gallery-item img { aspect-ratio: auto; height: 100%; }
  .cit-gallery-offset .cit-gallery-item:nth-child(even) { transform: translateY(26px); }`;

// Deterministic polaroid rotations by index (the contact-sheet's hand-placed feel).
const SHEET_ROTATIONS: readonly string[] = ["-1.6deg", "1.2deg", "-0.8deg", "1.8deg", "-1.2deg", "0.9deg"];

/** CONTACT-SHEET gallery (the editorial-press reference treatment): white-framed polaroid
 *  shots with italic captions, each rotated slightly (deterministic by index → mock=live). */
function galleryContactSheet(d: SiteData, copy?: SectionCopy): string {
  const shots = d.photos
    .map((p, i) => {
      const r = SHEET_ROTATIONS[i % SHEET_ROTATIONS.length];
      return `<div class="cit-shot" style="--cit-r:${r}"><figure><img src="${esc(p.url)}" alt="${esc(
        p.alt,
      )}" loading="lazy"></figure><figcaption>${esc(p.alt)}</figcaption></div>`;
    })
    .join("\n          ");
  return `<section class="cit-gallery cit-gallery--sheet" data-cit-module="gallery">
      <div class="cit-section-inner">
        ${galleryHead(copy)}<div class="cit-contact-sheet">
          ${shots}
        </div>
      </div>
    </section>`;
}

const GALLERY_SHEET_CSS = `  .cit-contact-sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
  @media (min-width: 760px) { .cit-contact-sheet { grid-template-columns: repeat(3, 1fr); } }
  .cit-shot { background: var(--cit-surface); padding: 10px 10px 6px; border: 1px solid var(--cit-line);
    box-shadow: var(--cit-shadow); transform: rotate(var(--cit-r, 0deg)); transition: transform .3s; }
  .cit-shot:hover { transform: rotate(0) scale(1.03); z-index: 2; position: relative; }
  .cit-shot figure { aspect-ratio: 1; overflow: hidden; margin: 0; }
  .cit-shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cit-shot figcaption { font-family: var(--cit-font-display); font-style: italic; font-size: .8rem;
    text-align: center; padding: .6rem 0 .4rem; color: var(--cit-muted); }`;

/** PARALLAX PANELS gallery (the immersive-parallax reference treatment): each photo is a
 *  full-bleed 60svh band with fixed background (parallax on desktop; scroll-attached on
 *  mobile/reduced-motion). The photo alt rides as a quiet bottom-left caption. */
function galleryPanels(d: SiteData, copy?: SectionCopy): string {
  const head = copy?.title || copy?.eyebrow
    ? `<div class="cit-section-inner cit-panels-head">${sectionHead("", copy?.title ?? "", copy)}</div>\n      `
    : "";
  const panels = d.photos
    .map(
      (p) =>
        `<div class="cit-panel" style="background-image:url('${esc(p.url)}')" role="img" aria-label="${esc(
          p.alt,
        )}"><span class="cit-panel-cap">${esc(p.alt)}</span></div>`,
    )
    .join("\n        ");
  return `<section class="cit-gallery cit-gallery--panels" data-cit-module="gallery">
      ${head}<div class="cit-panels">
        ${panels}
      </div>
    </section>`;
}

const GALLERY_PANELS_CSS = `  .cit-panels-head { padding-bottom: 0; }
  .cit-panels { display: grid; }
  .cit-panel { min-height: 60svh; background-size: cover; background-position: center;
    position: relative; }
  .cit-panel-cap { position: absolute; left: clamp(1rem, 4vw, 2.5rem); bottom: 1.2rem;
    color: #fff; font-size: .78rem; letter-spacing: .16em; text-transform: uppercase;
    text-shadow: 0 1px 10px rgba(0,0,0,.6); opacity: .85; }
  @media (min-width: 900px) and (prefers-reduced-motion: no-preference) {
    .cit-panel { background-attachment: fixed; }
  }`;

/** LETTERS reviews (the editorial-press reference treatment): guest-book letters — accent
 *  top border, italic serif quotes, an em-dash signature. Sample-marked without real data. */
function reviewsLetters(d: SiteData, copy?: SectionCopy): string {
  const real = d.reviews && d.reviews.length ? d.reviews : null;
  // ADR-0048: never invent a guest quote about a named business (§B.17). No real
  // review → no section here; moduleSections() renders the honest stand-in.
  if (!real) return "";
  const reviews = real;
  const note = real ? "" : sampleNote("Minta — ide az Ön vendégeinek értékelései kerülnek.");
  const letters = reviews
    .map(
      (r) =>
        `<div class="cit-letter">${starRow(5)}<p>„${esc(r.quote)}"</p><span class="cit-letter-sig">— ${esc(
          r.author,
        )}${r.meta ? `, ${esc(r.meta)}` : ""}</span></div>`,
    )
    .join("\n          ");
  return `<section class="cit-reviews cit-reviews--letters">
      <div class="cit-section-inner">
        ${sectionHead("Vendégkönyv", "Levelek a vendégkönyvből", copy)}
        ${note}
        <div class="cit-letters">
          ${letters}
        </div>
      </div>
    </section>`;
}

const REVIEWS_LETTERS_CSS = `  .cit-letters { display: grid; gap: 1.6rem; grid-template-columns: 1fr; }
  @media (min-width: 820px) { .cit-letters { grid-template-columns: repeat(3, 1fr); } }
  .cit-letter { background: var(--cit-surface); border-top: 4px solid var(--cit-accent);
    padding: 1.5rem; box-shadow: var(--cit-shadow); }
  .cit-letter .cit-stars { margin-bottom: .8rem; }
  .cit-letter .cit-stars svg { width: 14px; height: 14px; color: var(--cit-accent); }
  .cit-letter p { font-family: var(--cit-font-display); font-style: italic; margin: 0 0 1rem;
    color: var(--cit-ink); line-height: 1.55; }
  .cit-letter-sig { font-size: .78rem; letter-spacing: .1em; text-transform: uppercase; color: var(--cit-muted); }`;

/** Single QUOTE band reviews (the dark-luxury reference treatment): one centered display
 *  quote on the surface tone. Real review when we have one; else marked sample (§B.17). */
function reviewsQuote(d: SiteData, copy?: SectionCopy): string {
  const real = d.reviews && d.reviews.length ? d.reviews[0] : null;
  // ADR-0048: never invent a guest quote about a named business (§B.17). No real
  // review → no section here; moduleSections() renders the honest stand-in.
  if (!real) return "";
  const r = real;
  const note = real ? "" : sampleNote("Minta — ide a valós vendégértékelésed kerül.");
  const head = copy?.title || copy?.eyebrow ? `<div class="cit-sec-head">${sectionHead("", copy?.title ?? "", copy)}</div>` : "";
  return `<section class="cit-reviews cit-reviews--quote">
      <div class="cit-section-inner">
        ${head}${starRow(5)}
        <blockquote class="cit-quote">„${esc(r.quote)}"</blockquote>
        <cite class="cit-quote-cite">${esc(r.author)}${r.meta ? ` · ${esc(r.meta)}` : ""}</cite>
        ${note}
      </div>
    </section>`;
}

const REVIEWS_QUOTE_CSS = `  .cit-reviews--quote { background: var(--cit-surface); border-top: 1px solid var(--cit-line);
    border-bottom: 1px solid var(--cit-line); text-align: center; }
  .cit-reviews--quote .cit-stars { justify-content: center; margin-bottom: 1.4rem; }
  .cit-reviews--quote .cit-stars svg { width: 18px; height: 18px; color: var(--cit-accent); }
  .cit-quote { font-family: var(--cit-font-display); font-size: clamp(1.4rem, 3.2vw, 2.1rem);
    max-width: 22ch; margin: 0 auto 1.4rem; line-height: 1.45; color: var(--cit-ink); }
  .cit-quote-cite { font-style: normal; font-size: .8rem; letter-spacing: .14em;
    text-transform: uppercase; color: var(--cit-muted); }
  .cit-reviews--quote .cit-sample-note { display: block; width: fit-content; margin: 1.6rem auto 0; }`;

function reviewsSection(d: SiteData, copy?: SectionCopy): string {
  const real = d.reviews && d.reviews.length ? d.reviews : null;
  // ADR-0048: never invent a guest quote about a named business (§B.17). No real
  // review → no section here; moduleSections() renders the honest stand-in.
  if (!real) return "";
  const reviews = real;
  const note = real ? "" : sampleNote("Minta — ide az Ön vendégeinek értékelései kerülnek.");
  const cards = reviews
    .map((r) => {
      const meta = r.meta ? `<span class="cit-review-meta">${esc(r.meta)}</span>` : "";
      return `<figure class="cit-review">${starRow(5)}<blockquote class="cit-review-quote">${esc(
        r.quote,
      )}</blockquote><figcaption><span class="cit-review-author">${esc(r.author)}</span> ${meta}</figcaption></figure>`;
    })
    .join("\n          ");
  return `<section class="cit-reviews">
      <div class="cit-section-inner">
        ${sectionHead("Vélemények", "Amit a vendégek mondanak", copy)}
        ${note}
        <div class="cit-review-grid">
          ${cards}
        </div>
      </div>
    </section>`;
}

/** Reviews on a full ACCENT BAND (the reference-bar treatment): section head in the
 *  on-accent tone, glass cards. The head line carries the REAL Google rating when we have
 *  one (same A4-gated fact as the stats band — never fabricated). */
function reviewsBand(d: SiteData, copy?: SectionCopy): string {
  const real = d.reviews && d.reviews.length ? d.reviews : null;
  // ADR-0048: never invent a guest quote about a named business (§B.17). No real
  // review → no section here; moduleSections() renders the honest stand-in.
  if (!real) return "";
  const reviews = real;
  const note = real ? "" : sampleNote("Minta — ide az Ön vendégeinek értékelései kerülnek.");
  const ratingLine = d.rating
    ? `${String(d.rating.value).replace(".", ",")} / 5${
        d.rating.count ? ` — ${d.rating.count} értékelés alapján` : ""
      }`
    : "";
  const head = copy?.title
    ? sectionHead("Vendégeink mondták", "Amit a vendégek mondanak", copy)
    : sectionHead("Vendégeink mondták", ratingLine || "Amit a vendégek mondanak");
  const cards = reviews
    .map((r) => {
      const meta = r.meta ? `<span class="cit-review-meta">${esc(r.meta)}</span>` : "";
      return `<figure class="cit-review">${starRow(5)}<blockquote class="cit-review-quote">${esc(
        r.quote,
      )}</blockquote><figcaption><span class="cit-review-author">${esc(r.author)}</span> ${meta}</figcaption></figure>`;
    })
    .join("\n          ");
  return `<section class="cit-reviews cit-reviews--band">
      <div class="cit-section-inner">
        <div class="cit-sec-head">
          ${head}
        </div>
        ${note}
        <div class="cit-review-grid">
          ${cards}
        </div>
      </div>
    </section>`;
}

const REVIEWS_BAND_CSS = `  .cit-reviews--band { background: var(--cit-accent); }
  .cit-reviews--band .cit-section-title, .cit-reviews--band .cit-review-quote,
  .cit-reviews--band .cit-review-author { color: var(--cit-on-accent); }
  /* On an accent-filled band the accent-toned word would be invisible — carry it in the
     on-accent tone instead (the italic still marks it). */
  .cit-reviews--band .cit-accent-word { color: var(--cit-on-accent); opacity: .72; }
  .cit-reviews--band .cit-eyebrow { color: var(--cit-on-accent); opacity: .8; }
  .cit-reviews--band .cit-review-meta { color: var(--cit-on-accent); opacity: .7; }
  .cit-reviews--band .cit-sample-note { display: block; width: fit-content; margin-inline: auto;
    color: var(--cit-on-accent); border-color: color-mix(in srgb, var(--cit-on-accent) 45%, transparent); }
  .cit-reviews--band .cit-review { background: color-mix(in srgb, var(--cit-on-accent) 9%, transparent);
    border: 1px solid color-mix(in srgb, var(--cit-on-accent) 18%, transparent); box-shadow: none; }
  .cit-reviews--band .cit-stars svg { color: var(--cit-on-accent); opacity: .95; }`;

/** Map + contact closing section (the reference-bar "Megközelítés és kapcsolat" block).
 *  The map is the runtime's click-to-load facade (GDPR — data-cit-module="map"); the static
 *  fallback is the address pin card. The contact card lists ONLY real lead facts + a working
 *  mailto CTA (no fake form — an unwired form would be deception). */
function locationSection(d: SiteData, copy?: SectionCopy): string {
  const c = d.contact;
  const query = [d.name, c.address].filter(Boolean).join(", ");
  const rows = [
    c.address ? `<li>${iconSvg("location")}<span>${esc(c.address)}</span></li>` : "",
    c.phone ? `<li>${iconSvg("phone")}<span>${esc(c.phone)}</span></li>` : "",
    c.email
      ? `<li>${iconSvg("mail")}<a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>`
      : "",
  ]
    .filter(Boolean)
    .join("\n            ");
  const cta = c.email
    ? `<a class="cit-btn" href="mailto:${esc(c.email)}">Írjon nekünk</a>`
    : "";
  return `<section class="cit-location">
      <div class="cit-section-inner">
        <div class="cit-sec-head">
          ${sectionHead("Ide gyere", "Megközelítés és kapcsolat", copy)}
        </div>
        <div class="cit-location-grid">
          <div class="cit-location-map" data-cit-module="map" data-cit-query="${esc(query)}">
            <div class="cit-location-pin">
              ${iconSvg("location")}
              <strong>${esc(d.name)}</strong>
              ${c.address ? `<span>${esc(c.address)}</span>` : ""}
            </div>
          </div>
          <div class="cit-location-card">
            <h3>Kapcsolat</h3>
            <ul class="cit-location-rows">
            ${rows}
            </ul>
            ${cta}
          </div>
        </div>
      </div>
    </section>`;
}

const LOCATION_CSS = `  .cit-location-grid { display: grid; gap: 2rem; grid-template-columns: 1fr; }
  @media (min-width: 900px) { .cit-location-grid { grid-template-columns: 1.2fr 1fr; align-items: stretch; } }
  .cit-location-map { position: relative; min-height: 340px; border-radius: var(--cit-radius);
    overflow: hidden; background: var(--cit-surface); border: 1px solid var(--cit-line); }
  .cit-location-pin { position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: .4rem; text-align: center; padding: 1.5rem; }
  .cit-location-pin svg { width: 34px; height: 34px; color: var(--cit-accent); }
  .cit-location-pin strong { font-family: var(--cit-font-display); font-size: 1.3rem; color: var(--cit-ink); }
  .cit-location-pin span { color: var(--cit-muted); }
  .cit-location-card { background: var(--cit-surface); border: 1px solid var(--cit-line);
    border-radius: var(--cit-radius); box-shadow: var(--cit-shadow); padding: 2rem; }
  .cit-location-card h3 { font-family: var(--cit-font-display); font-size: 1.6rem; margin: 0 0 1.4rem; color: var(--cit-ink); }
  .cit-location-rows { list-style: none; padding: 0; margin: 0 0 1.8rem; display: grid; gap: 1rem; }
  .cit-location-rows li { display: flex; align-items: center; gap: .8rem; color: var(--cit-muted); }
  .cit-location-rows svg { flex: none; width: 20px; height: 20px; color: var(--cit-accent); }
  .cit-location-rows a { color: var(--cit-ink); text-decoration: none; }
  .cit-location-rows a:hover { color: var(--cit-accent); }`;

function faqSection(d: SiteData, copy?: SectionCopy): string {
  const real = d.faqs && d.faqs.length ? d.faqs : null;
  const faqs = real ?? SAMPLE_FAQS;
  const note = real ? "" : sampleNote("Minta — ide a saját, valós kérdés-válaszaid kerülnek.");
  // Native <details> accordion: progressive-enhancement friendly (works with NO JS), accessible.
  const items = faqs
    .map(
      (f) =>
        `<details class="cit-faq-item"><summary class="cit-faq-q">${esc(f.q)}</summary><div class="cit-faq-a">${esc(
          f.a,
        )}</div></details>`,
    )
    .join("\n          ");
  return `<section class="cit-faq">
      <div class="cit-section-inner">
        ${sectionHead("Kérdések", "Gyakori kérdések", copy)}
        ${note}
        <div class="cit-faq-list">
          ${items}
        </div>
      </div>
    </section>`;
}

const FAQ_CSS = `  .cit-faq-list { display: grid; gap: .8rem; max-width: 820px; }
  .cit-faq-item { background: var(--cit-surface); border: 1px solid var(--cit-line);
    border-radius: var(--cit-radius); overflow: hidden; }
  .cit-faq-q { cursor: pointer; list-style: none; padding: 1.15rem 1.4rem; font-weight: 600;
    color: var(--cit-ink); display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .cit-faq-q::-webkit-details-marker { display: none; }
  .cit-faq-q::after { content: "+"; font-size: 1.4rem; line-height: 1; color: var(--cit-accent);
    transition: transform .25s ease; }
  .cit-faq-item[open] .cit-faq-q::after { transform: rotate(45deg); }
  .cit-faq-a { padding: 0 1.4rem 1.3rem; color: var(--cit-muted); line-height: 1.6; }`;

const ROOMS_CSS = `  .cit-section-title { font-family: var(--cit-font-display); font-size: clamp(1.9rem, 3.8vw, 3rem);
    line-height: 1.1; margin: 0 0 1.4rem; color: var(--cit-ink); }
  .cit-sample-note { display: inline-block; font-size: .8rem; letter-spacing: .03em; color: var(--cit-muted);
    border: 1px dashed var(--cit-line); border-radius: 999px; padding: .4rem .95rem; margin: 0 0 1.6rem; }
  .cit-room-grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .cit-room { background: var(--cit-surface); border: 1px solid var(--cit-line);
    border-radius: var(--cit-radius); overflow: hidden; box-shadow: var(--cit-shadow); }
  .cit-room-img { aspect-ratio: 4 / 3; overflow: hidden; }
  .cit-room-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cit-room-body { padding: 1.35rem 1.45rem; }
  .cit-room-body h3 { font-family: var(--cit-font-display); font-size: 1.35rem; margin: 0 0 .3em; color: var(--cit-ink); }
  .cit-room-meta { font-size: .82rem; letter-spacing: .1em; text-transform: uppercase; color: var(--cit-muted); margin: 0 0 .6rem; }
  .cit-room-note { color: var(--cit-muted); margin: 0; }`;

const ROOMS_SHOWCASE_CSS = `  .cit-rooms--showcase .cit-show-list { display: grid; gap: clamp(2.5rem, 6vw, 5rem); margin-top: 2.5rem; }
  .cit-show-row { display: grid; gap: clamp(1.5rem, 4vw, 3.5rem); align-items: center;
    grid-template-columns: 1fr; }
  @media (min-width: 860px) { .cit-show-row { grid-template-columns: 1.15fr .85fr; }
    .cit-show-row--rev .cit-show-img { order: 2; } }
  .cit-show-img { border-radius: var(--cit-radius); overflow: hidden; box-shadow: var(--cit-shadow); }
  .cit-show-img img { width: 100%; height: 100%; object-fit: cover; display: block; aspect-ratio: 3 / 2; }
  .cit-show-idx { display: block; font-family: var(--cit-font-display); font-size: 1rem;
    color: var(--cit-accent); letter-spacing: .15em; margin-bottom: .6rem; }
  .cit-show-body h3 { font-family: var(--cit-font-display); font-size: clamp(1.5rem, 3vw, 2.2rem);
    line-height: 1.1; margin: 0 0 .4em; color: var(--cit-ink); }
  .cit-show-note { color: var(--cit-muted); margin: .6rem 0 0; font-size: 1.08rem; line-height: 1.6; max-width: 46ch; }`;

const REVIEWS_CSS = `  .cit-reviews { background: var(--cit-bg); }
  .cit-review-grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .cit-review { background: var(--cit-surface); border: 1px solid var(--cit-line);
    border-radius: var(--cit-radius); padding: 1.6rem; margin: 0; box-shadow: var(--cit-shadow); }
  .cit-stars { display: inline-flex; gap: 2px; margin-bottom: .9rem; }
  .cit-stars svg { width: 16px; height: 16px; color: var(--cit-accent); }
  .cit-review-quote { font-size: 1.05rem; line-height: 1.6; margin: 0 0 1.1rem; color: var(--cit-ink); }
  .cit-review-author { font-weight: 600; color: var(--cit-ink); }
  .cit-review-meta { font-size: .85rem; color: var(--cit-muted); }`;

// ---- registry ------------------------------------------------------------

export interface PrimitiveVariant {
  readonly id: string;
  /** One-line hint fed to the AI planner menu (single source → no prompt drift). */
  readonly hint: string;
  readonly render: (d: SiteData, copy?: SectionCopy) => string;
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
  stats: {
    kind: "stats",
    default: "band",
    variants: {
      band: {
        id: "band",
        hint: "kiemelt szám-sáv (CSAK valós adattal; sosem fabrikált)",
        render: statsSection,
        css: STATS_CSS,
      },
    },
  },
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
      editorial: {
        id: "editorial",
        hint: "szerkesztőségi hero: a márkahang KÖLTŐI vezércíme a H1 (copy.lead, dőlt akcent-szó), a név eyebrow-ba kerül — a legerősebb 'hang' emelő",
        render: heroEditorial,
        css: HERO_IMMERSIVE_CSS,
      },
      centered: {
        id: "centered",
        hint: "teljes-képernyős, KÖZÉPRE zárt hero (100svh, óriás display-cím, CTA, görgetés-jel) — a fullbleed-glass archetípus párja",
        render: heroCentered,
        css: HERO_IMMERSIVE_CSS + "\n" + HERO_CENTERED_CSS,
      },
      collage: {
        id: "collage",
        hint: "hirdetés-stílusú fejléc: cím-sor VALÓS értékeléssel + 5-fotós mozaik (nem full-bleed) — a card-sidebar archetípus párja",
        render: heroCollage,
        css: HERO_COLLAGE_CSS,
      },
      masthead: {
        id: "masthead",
        hint: "újság-címoldal: óriás középre zárt szerif márkanév + dőlt alcím, fotó nélkül — az editorial-press archetípus párja",
        render: heroMasthead,
        css: HERO_MASTHEAD_CSS,
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
    default: "amenities",
    variants: {
      amenities: {
        id: "amenities",
        hint: "felszereltség-rács SVG-ikonokkal (a kiemelésekhez illő ikon)",
        render: featuresAmenities,
        css: FEATURES_AMENITIES_CSS,
      },
      cards: { id: "cards", hint: "kiemelés-kártyák rácsa (ikon nélkül)", render: featuresCards },
      table: {
        id: "table",
        hint: "füzetes, sorszámozott ledger-lista",
        render: featuresTable,
        css: FEATURES_TABLE_CSS,
      },
      tiles: {
        id: "tiles",
        hint: "középre zárt ikon-csempék (ikon fent, címke lent, hover-akcent) — a fullbleed-glass archetípus párja",
        render: featuresTiles,
        css: FEATURES_TILES_CSS,
      },
      rituals: {
        id: "rituals",
        hint: "számozott (I., II., …) panel-rács 1px-es ráccsal — megfontolt, prémium 'étlap' — a dark-luxury archetípus párja",
        render: featuresRituals,
        css: FEATURES_RITUALS_CSS,
      },
      "lead-story": {
        id: "lead-story",
        hint: "címlap-vezércikk: fotó képaláírással + kicker + dropcap-bemutatkozó + CTA, alatta a kiemelések 'apróhirdetés'-kártyákként — az editorial-press archetípus párja",
        render: featuresLeadStory,
        css: FEATURES_LEADSTORY_CSS,
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
      mosaic: {
        id: "mosaic",
        hint: "aszimmetrikus mozaik (nagy horgony-csempe + széles/magas span-ek) — a fullbleed-glass archetípus párja",
        render: galleryMosaic,
        css: GALLERY_MOSAIC_CSS,
      },
      offset: {
        id: "offset",
        hint: "álló (3:4) csempék, minden második lejjebb tolva — visszafogott, prémium ritmus — a dark-luxury archetípus párja",
        render: galleryOffset,
        css: GALLERY_OFFSET_CSS,
      },
      "contact-sheet": {
        id: "contact-sheet",
        hint: "polaroid kontakt-lap: fehér keretes, enyhén elforgatott fotók dőlt képaláírással — az editorial-press archetípus párja",
        render: galleryContactSheet,
        css: GALLERY_SHEET_CSS,
      },
      panels: {
        id: "panels",
        hint: "teljes-szélességű PARALLAX fotó-sávok (60svh, fixed háttér desktopon) — az immersive-parallax archetípus párja",
        render: galleryPanels,
        css: GALLERY_PANELS_CSS,
      },
    },
  },
  rooms: {
    kind: "rooms",
    default: "cards",
    variants: {
      cards: {
        id: "cards",
        hint: "szoba/egység-kártyák (valós adat híján jelölt minta a mockban)",
        render: roomsSection,
        css: ROOMS_CSS,
      },
      showcase: {
        id: "showcase",
        hint: "szerkesztőségi showcase: teljes-szélességű, VÁLTAKOZÓ kép/szöveg sorok (aszimmetria = bespoke ritmus)",
        render: roomsShowcase,
        css: ROOMS_CSS + "\n" + ROOMS_SHOWCASE_CSS,
      },
      "suites-scroll": {
        id: "suites-scroll",
        hint: "vízszintes, snap-görgetős lakosztály-kártyák (prémium ritmus) — a dark-luxury archetípus párja",
        render: roomsSuitesScroll,
        css: ROOMS_CSS + "\n" + ROOMS_SUITES_CSS,
      },
      boutique: {
        id: "boutique",
        hint: "boutique szoba-kártyák (fotó + meta-chipek + kártya-láb érdeklődés-linkkel; ár CSAK valós adattal) — a fullbleed-glass archetípus párja",
        render: roomsBoutique,
        css: ROOMS_CSS + "\n" + ROOMS_BOUTIQUE_CSS,
      },
    },
  },
  reviews: {
    kind: "reviews",
    default: "cards",
    variants: {
      cards: {
        id: "cards",
        hint: "vendégértékelés-kártyák csillagokkal (valós adat híján jelölt minta a mockban)",
        render: reviewsSection,
        css: REVIEWS_CSS,
      },
      band: {
        id: "band",
        hint: "vélemény-SÁV színes (akcent) háttéren, üveg-kártyákkal; a fejcím a VALÓS Google-értékelést viszi — a fullbleed-glass archetípus párja",
        render: reviewsBand,
        css: REVIEWS_CSS + "\n" + REVIEWS_BAND_CSS,
      },
      quote: {
        id: "quote",
        hint: "EGYETLEN nagy, középre zárt display-idézet sávban (csend + fókusz) — a dark-luxury archetípus párja",
        render: reviewsQuote,
        css: REVIEWS_QUOTE_CSS,
      },
      letters: {
        id: "letters",
        hint: "vendégkönyv-levelek: akcent felső-szegélyes lapok, dőlt szerif idézetek, aláírás — az editorial-press archetípus párja",
        render: reviewsLetters,
        css: REVIEWS_LETTERS_CSS,
      },
    },
  },
  faq: {
    kind: "faq",
    default: "accordion",
    variants: {
      accordion: {
        id: "accordion",
        hint: "gyakori kérdések akkordeon (natív details; valós adat híján jelölt minta a mockban)",
        render: faqSection,
        css: FAQ_CSS,
      },
    },
  },
  location: {
    kind: "location",
    default: "map-contact",
    variants: {
      "map-contact": {
        id: "map-contact",
        hint: "térkép (kattintásra töltő, GDPR) + kapcsolat-kártya a valós elérhetőségekkel — záró bizalom-blokk",
        render: locationSection,
        css: LOCATION_CSS,
      },
    },
  },
  enquiry: {
    kind: "enquiry",
    default: "card",
    variants: {
      card: { id: "card", hint: "érdeklődés-sáv (gerinc CTA)", render: enquiryCard },
      bar: {
        id: "bar",
        hint: "kompakt foglaló-SÁV (a runtime interaktív bar-widgetet épít rá; az archetípus a hero aljára úsztathatja) — a fullbleed-glass archetípus párja",
        render: enquiryBar,
        css: ENQUIRY_BAR_CSS,
      },
    },
  },
};

// Motion layer (ADR-0018 — the "alive" craft the reference bar codes in). Cross-cutting, token-
// only, applied to every primitive at once. Reveal-on-scroll (staggered fade-up, activated by the
// runtime adding .cit-in), hero ken-burns, image hover-zoom, card hover-lift, button micro-motion.
// ALL wrapped in prefers-reduced-motion:no-preference → reduced-motion + no-JS render fully static.
// The hidden reveal state is gated by html.cit-anim (set synchronously before paint) so no-JS never
// hides content. mock=live safe: motion is deterministic behaviour over the rendered structure.
const MOTION_CSS = `  .cit-room-img, .cit-gallery-item, .cit-show-img { overflow: hidden; }
  @media (prefers-reduced-motion: no-preference) {
    html.cit-anim .cit-reveal { opacity: 0; transform: translateY(26px);
      transition: opacity .7s cubic-bezier(.22,.61,.36,1), transform .7s cubic-bezier(.22,.61,.36,1);
      transition-delay: calc(var(--cit-i, 0) * 70ms); }
    html.cit-anim .cit-reveal.cit-in { opacity: 1; transform: none; }
    .cit-hero-bg { animation: cit-kenburns 20s ease-out both; }
    @keyframes cit-kenburns { from { transform: scale(1.12); } to { transform: scale(1); } }
    .cit-room-img img, .cit-gallery-item img, .cit-show-img img {
      transition: transform .7s cubic-bezier(.22,.61,.36,1); }
    .cit-room:hover .cit-room-img img, .cit-gallery-item:hover img,
    .cit-show-row:hover .cit-show-img img { transform: scale(1.05); }
    .cit-amenity, .cit-feature, .cit-room, .cit-review {
      transition: transform .3s ease, box-shadow .3s ease; }
    .cit-amenity:hover, .cit-feature:hover, .cit-room:hover, .cit-review:hover {
      transform: translateY(-4px); box-shadow: 0 18px 44px rgba(0,0,0,.16); }
    .cit-btn { transition: transform .2s ease, filter .2s ease, background .2s ease; }
    .cit-btn:hover { transform: translateY(-2px); filter: brightness(1.06); }
  }`;

/** Shared primitive CSS — dresses ONLY from --cit-* tokens (skin-agnostic). Craft: generous
 *  vertical rhythm, strong display type scale, prominent CTA — distilled from the sample bar. */
// ADR-0025 ② page-level emphasis. Emitted AFTER the archetype CSS (render.ts) so it is the
// FINAL word on section rhythm, giving the page one focal hero-moment + quiet minors instead of
// democratic same-height bands. Archetype-agnostic: it only scales vertical space + the focal
// asset (gallery/heading) — no full-bleed breakout, so it never breaks the split archetypes.
export const EMPHASIS_CSS = `  [data-cit-emphasis="focal"] .cit-section-inner { padding-block: clamp(5.5rem, 13vw, 9.5rem); }
  [data-cit-emphasis="focal"] .cit-section-title { font-size: clamp(2.4rem, 5.2vw, 4rem); line-height: 1.06; }
  [data-cit-emphasis="focal"] .cit-gallery-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr)); gap: clamp(.75rem, 1.5vw, 1.25rem); }
  [data-cit-emphasis="focal"] .cit-gallery-item img { aspect-ratio: 3 / 2; }
  [data-cit-emphasis="quiet"] .cit-section-inner { padding-block: clamp(2.4rem, 5vw, 3.8rem); }
  [data-cit-emphasis="quiet"] .cit-section-title { font-size: clamp(1.5rem, 3vw, 2.1rem); }
  [data-cit-emphasis="quiet"] .cit-sample-note { opacity: .82; }`;

export const PRIMITIVE_CSS = `  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--cit-bg); color: var(--cit-ink);
    font-family: var(--cit-font-body); line-height: 1.65; -webkit-font-smoothing: antialiased; }
  .cit-section-inner, .cit-hero-inner { max-width: 1120px; margin: 0 auto;
    padding: clamp(3.5rem, 8vw, 6.5rem) clamp(1.25rem, 4vw, 2.5rem); }
  .cit-eyebrow { display: inline-block; font-size: .78rem; letter-spacing: .28em;
    text-transform: uppercase; color: var(--cit-accent); font-weight: 600; margin: 0 0 1.4rem; }
  .cit-accent-word { color: var(--cit-accent); font-style: italic; }
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
  .cit-btn-disabled { opacity: .55; }
  .cit-sec-head { text-align: center; max-width: 680px; margin: 0 auto 3.2rem; }
  .cit-sec-head .cit-section-title { margin-bottom: .9rem; }
  .cit-sec-sub { color: var(--cit-muted); margin: 0; font-size: 1.08rem; line-height: 1.6; }
${MOTION_CSS}`;
