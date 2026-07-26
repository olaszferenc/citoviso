// Deterministic layout primitives as a VARIANT REGISTRY (ADR-0017). Each SectionKind has ≥1
// variant — a pure (data) => HTML function with a FIXED structure, token-dressed classes, and
// optional variant-scoped CSS. Only DATA fills the slots (no AI, no randomness → mock=live).
//
// CRAFT BAR: the visual craft is distilled from the reference sample mocks (immersive full-
// bleed hero, eyebrow + large display type, prominent enquiry band, generous rhythm). The
// hero is the #1 "wow" lever, so the default hero is immersive (photo background + scrim when
// a photo exists, a tall typographic hero otherwise). Module hooks (data-cit-module) let the
// runtime (06-UI-CONTRACT) hydrate the enquiry into the interactive booking widget.

import { iconSvg, matchIcon, starRow } from "./icons.js";
import type { Review, Room, SectionCopy, SectionKind, SiteData } from "./recipe.js";

// ---- stats (data-only band — never fabricated) ---------------------------

function statsSection(d: SiteData): string {
  if (!d.stats || !d.stats.length) return "";
  const items = d.stats
    .map((s) => `<div class="cit-stat"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`)
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
  .cit-stat strong { display: block; font-family: var(--cit-font-display); font-size: clamp(1.8rem, 3.4vw, 2.6rem);
    line-height: 1; color: var(--cit-ink); }
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
  return bg
    ? `<div class="cit-hero-bg" style="background-image:linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.72) 94%), url('${esc(
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

// ---- rooms / reviews (sample-capable modules, ADR-0015 / §B.17) ----------

/** Marked sample-content note — the visible §B.17 marking that this section is illustrative. */
function sampleNote(text: string): string {
  return `<p class="cit-sample-note">${esc(text)}</p>`;
}

// Generic, ILLUSTRATIVE sample content (no hard fact about THIS property; shown only under a
// visible "minta" note, only in the MOCK phase; the live render drops it without real data).
const SAMPLE_ROOMS: readonly Room[] = [
  { name: "Kétágyas szoba", capacity: "2 fő", note: "Kényelmes franciaágy, saját fürdőszoba." },
  { name: "Családi szoba", capacity: "2+2 fő", note: "Tágas szoba pótágyazási lehetőséggel." },
  { name: "Apartman", capacity: "4 fő", note: "Külön hálótér és felszerelt konyhasarok." },
];
const SAMPLE_REVIEWS: readonly Review[] = [
  { quote: "Csendes, rendezett hely, kedves fogadtatás — biztosan visszatérünk.", author: "Anna", meta: "vendégértékelés" },
  { quote: "Tiszta szobák, remek elhelyezkedés. Csak ajánlani tudom.", author: "Péter", meta: "vendégértékelés" },
  { quote: "Pontosan erre a nyugalomra vágytunk. Köszönünk mindent!", author: "A Kovács család", meta: "vendégértékelés" },
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
  const note = real ? "" : sampleNote("Minta — ide a saját szobáid, fotóid és áraid kerülnek.");
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

function reviewsSection(d: SiteData, copy?: SectionCopy): string {
  const real = d.reviews && d.reviews.length ? d.reviews : null;
  const reviews = real ?? SAMPLE_REVIEWS;
  const note = real ? "" : sampleNote("Minta — ide a valós vendégértékeléseid kerülnek.");
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
${MOTION_CSS}`;
