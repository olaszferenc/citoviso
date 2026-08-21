// Archetype = LAYOUT GRAMMAR as a registry entry (ADR-0016). Where a SKIN changes only
// LOOK (--cit-* tokens) and a PRIMITIVE is a fixed content block, an ARCHETYPE decides how
// the already-selected sections are ARRANGED on the page (stacked / split / reordered flow).
//
// EXTENSIBILITY CONTRACT (the whole point of this layer): adding an archetype = adding ONE
// entry to ARCHETYPES. The renderer (render.ts) and the planner (planner.ts) DERIVE
// everything from this registry — the planner's schema enum and prompt are Object.keys/
// values of ARCHETYPES — so a new archetype is instantly selectable by the AI with ZERO
// changes to core code. Each archetype's CSS is scoped under `.cit-arch-<id>` (set on the
// <body>), so archetypes are ISOLATED: a new one cannot break an existing one. arrange() is
// LAYOUT-ONLY — it MUST NOT add or drop sections (inclusion / data-gating is the planner +
// enforce() boundary); it only orders and wraps the sections it is given.

import type { SectionKind } from "./recipe.js";

export interface RenderedSection {
  readonly kind: SectionKind;
  readonly html: string;
}

export interface Archetype {
  readonly id: string;
  readonly label: string;
  /** One-line mood hint fed to the AI planner (single source → no prompt drift). */
  readonly hint: string;
  /** Archetype-scoped CSS. MUST dress only from --cit-* tokens and scope every rule under
   *  `.cit-arch-<id>` so archetypes stay isolated. May be empty (e.g. the stacked baseline). */
  readonly css: string;
  /** Opt-in: this archetype's arrange() wraps sections in `cit-sec-<kind>` anchors, so the
   *  chrome nav may render section links against them (render.ts passes the active kinds). */
  readonly navLinks?: boolean;
  /** Variant pairings that complete this archetype's art direction. Applied by the planner's
   *  enforce() to sections the AI left on their default variant — an explicit (valid) variant
   *  choice always wins. Deterministic → mock=live safe. */
  readonly preferredVariants?: Partial<Record<SectionKind, string>>;
  /** Retired = below the reference quality bar (2026-08-05 tulaj-verdikt): the planner may
   *  not SELECT it, but it STAYS in the registry — persisted recipes must re-render
   *  identically forever (mock=live). Mirrors the corpus `retired:true` precedent. */
  readonly retired?: boolean;
  /** Skins whose tonality this art direction was designed around (first = the canonical
   *  pairing). Advisory: every rule is token-dressed, so any skin renders — but a dark
   *  composition on a bright skin loses its character. Used when re-targeting an existing
   *  recipe onto this archetype (curator tools), never to override a tenant's choice. */
  readonly skinAffinity?: readonly string[];
  /** Layout-only arrangement of the ALREADY-SELECTED sections (in enforce() order). */
  arrange(sections: readonly RenderedSection[]): string;
}

/** Split sections into the spine anchors (hero first, enquiry last) and the free middle. */
function partition(sections: readonly RenderedSection[]) {
  const hero = sections.filter((s) => s.kind === "hero");
  const enquiry = sections.filter((s) => s.kind === "enquiry");
  const middle = sections.filter((s) => s.kind !== "hero" && s.kind !== "enquiry");
  return { hero, middle, enquiry };
}

const join = (sections: readonly RenderedSection[]): string =>
  sections.map((s) => s.html).join("\n    ");

export const ARCHETYPES: Readonly<Record<string, Archetype>> = {
  // Baseline: full-width bands in recipe order. Identical to the pre-archetype engine, so
  // it is the safe default and the fallback target.
  stacked: {
    id: "stacked",
    label: "Egyszerű — egymás alatti sávok",
    hint: "semleges technikai TARTALÉK — csak akkor válaszd, ha egyik karakteres art direction sem illik (pl. nagyon kevés az adat).",
    css: "",
    arrange: (sections) => join(sections),
  },

  // Editorial split: hero + enquiry stay full-width anchors; the middle content sections sit
  // in a 2-column grid on wide screens (single column on mobile). A denser, magazine feel.
  "split-editorial": {
    id: "split-editorial",
    label: "Szerkesztői — kéthasábos törzs",
    retired: true,
    hint: "magazinos, kéthasábos középső törzs; tartalmas, szerkesztői hangulat.",
    css: `.cit-arch-split-editorial .cit-arch-split { display: grid; gap: 0; grid-template-columns: 1fr; }
  @media (min-width: 900px) {
    .cit-arch-split-editorial .cit-arch-split { grid-template-columns: 1fr 1fr; align-items: start; }
    .cit-arch-split-editorial .cit-arch-split > * { border-right: 1px solid var(--cit-line); }
    .cit-arch-split-editorial .cit-arch-split > *:last-child { border-right: 0; }
  }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const mid = middle.length
        ? `<div class="cit-arch-split">\n      ${join(middle)}\n    </div>`
        : "";
      return [join(hero), mid, join(enquiry)].filter(Boolean).join("\n    ");
    },
  },

  // Gallery-forward: pulls the gallery up (right after the hero) as a full-bleed showcase,
  // then the rest. A different visual FLOW from the exact same sections.
  "gallery-forward": {
    id: "gallery-forward",
    label: "Galéria-vezérelt — képekkel elöl",
    retired: true,
    hint: "vizuális, fotó-vezérelt; a galéria elöl, teljes szélességű bemutató.",
    css: `.cit-arch-gallery-forward .cit-gallery .cit-section-inner { max-width: none; padding-inline: 0; }
  .cit-arch-gallery-forward .cit-gallery-grid { gap: 2px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const gallery = middle.filter((s) => s.kind === "gallery");
      const rest = middle.filter((s) => s.kind !== "gallery");
      return join([...hero, ...gallery, ...rest, ...enquiry]);
    },
  },

  // Sidebar: the hero becomes a sticky left rail on desktop; the content scrolls beside it.
  // A portfolio/magazine feel. Collapses to stacked on mobile.
  sidebar: {
    id: "sidebar",
    label: "Oldalsáv — ragadós hero-rail",
    retired: true,
    hint: "ragadós hero bal oldalt, a tartalom mellette görget; portfólió-szerű, igényes.",
    css: `@media (min-width: 900px) {
    .cit-arch-sidebar .cit-arch-swrap { display: grid; grid-template-columns: 34% 1fr; align-items: start; }
    .cit-arch-sidebar .cit-arch-side { position: sticky; top: 0; align-self: start; height: 100vh; }
    .cit-arch-sidebar .cit-arch-side .cit-hero { height: 100%; display: flex; align-items: center;
      border-bottom: 0; border-right: 1px solid var(--cit-line); }
  }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      return `<div class="cit-arch-swrap">
      <div class="cit-arch-side">${join(hero)}</div>
      <div class="cit-arch-main">${join([...middle, ...enquiry])}</div>
    </div>`;
    },
  },

  // Framed: the whole page floats as a bordered "brochure card" on a tinted backdrop. A
  // printed, considered look — distinct on every width (not just desktop).
  framed: {
    id: "framed",
    label: "Keretezett — brosúra-lap",
    retired: true,
    hint: "keretezett, lebegő brosúra-lap tónusos háttéren; nyomtatott, igényes.",
    css: `.cit-arch-framed { background: var(--cit-line); }
  .cit-arch-framed .cit-arch-frame { max-width: 1200px; margin: clamp(0px, 4vw, 48px) auto;
    background: var(--cit-bg); border: 1px solid var(--cit-line);
    border-radius: calc(var(--cit-radius) * 1.4); overflow: hidden; box-shadow: var(--cit-shadow); }`,
    arrange: (sections) => `<div class="cit-arch-frame">${join(sections)}</div>`,
  },

  // Fullbleed-glass: the FIRST reference-quality art direction ported into the engine
  // (assets/design-refs/reference-quality/01-fullbleed-glass.html). Not merely a section
  // order — a bound composition: glass overlay nav with section links, full-viewport
  // centered hero, the enquiry BAR floated up to overlap the hero bottom (the signature
  // element), centered section heads, alternating band rhythm, dark ink footer, and the
  // location block as the closing trust anchor. Pairs with the `centered` hero, `bar`
  // enquiry, `tiles` features, `mosaic` gallery, `band` reviews and `boutique` rooms
  // variants (the arrange works with any variant, just less characterfully).
  "fullbleed-glass": {
    id: "fullbleed-glass",
    label: "Fullbleed-glass — üveg foglaló-sáv",
    skinAffinity: ["coastal-fresh", "sand-cream-airy", "night-azure-gold", "tuscan-terracotta"],
    hint:
      "teljes-képernyős hero + a hero aljára úszó ÜVEG foglaló-sáv, központosított szekció-fejek, sötét lábléc; " +
      "prémium boutique érzet. Párosítsd: hero=centered, enquiry=bar, features=tiles, gallery=mosaic, reviews=band, rooms=boutique.",
    navLinks: true,
    preferredVariants: {
      hero: "centered",
      enquiry: "bar",
      features: "tiles",
      gallery: "mosaic",
      reviews: "band",
      rooms: "boutique",
    },
    css: `.cit-arch-fullbleed-glass .cit-nav { position: fixed; left: 0; right: 0; border-bottom: 0;
    background: color-mix(in srgb, var(--cit-surface) 82%, transparent);
    -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
    box-shadow: 0 2px 20px color-mix(in srgb, var(--cit-ink) 8%, transparent); }
  .cit-arch-fullbleed-glass .cit-nav-inner { max-width: 1180px; }
  .cit-arch-fullbleed-glass .cit-hero--immersive { min-height: 100svh; }
  .cit-arch-fullbleed-glass .cit-arch-bookwrap { position: relative; z-index: 10;
    max-width: 1180px; margin: -64px auto 0; padding-inline: clamp(1rem, 3vw, 2rem); }
  .cit-arch-fullbleed-glass .cit-arch-bookwrap .cit-enquiry {
    background: color-mix(in srgb, var(--cit-surface) 82%, transparent);
    -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
    border: 1px solid color-mix(in srgb, var(--cit-surface) 60%, transparent);
    border-radius: calc(var(--cit-radius) + 4px);
    box-shadow: 0 20px 50px color-mix(in srgb, var(--cit-ink) 18%, transparent); }
  .cit-arch-fullbleed-glass .cit-arch-bookwrap .cit-enquiry-inner { padding: 1.6rem; }
  .cit-arch-fullbleed-glass .cit-arch-bookwrap .cit-enquiry-title { font-size: 1.5rem; margin-bottom: .3em; }
  .cit-arch-fullbleed-glass .cit-arch-bookwrap .cit-enquiry-sub { margin-bottom: 1.2rem; }
  .cit-arch-fullbleed-glass .cit-arch-bookwrap .cit-btn-lg { margin-top: 0; }
  .cit-arch-fullbleed-glass .cit-section-inner { max-width: 1180px; }
  .cit-arch-fullbleed-glass .cit-stats .cit-stat-row { display: flex; flex-wrap: wrap;
    justify-content: center; gap: 2.5rem; }
  .cit-arch-fullbleed-glass .cit-stats { border-top: 0; }
  .cit-arch-fullbleed-glass .cit-arch-anchor, .cit-arch-fullbleed-glass #cit-enquiry {
    scroll-margin-top: 84px; }
  .cit-arch-fullbleed-glass .cit-footer {
    background: color-mix(in srgb, var(--cit-ink) 22%, #0d0d0d);
    color: rgba(255,255,255,.75); border-top: 0; }
  .cit-arch-fullbleed-glass .cit-footer-name,
  .cit-arch-fullbleed-glass .cit-footer-col h4 { color: #fff; }
  .cit-arch-fullbleed-glass .cit-footer-col a { color: rgba(255,255,255,.75); }
  .cit-arch-fullbleed-glass .cit-footer-col a:hover { color: var(--cit-accent); }
  .cit-arch-fullbleed-glass .cit-footer-bottom { border-top-color: rgba(255,255,255,.12); }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      // Signature composition: the enquiry bar floats up over the hero bottom; the location
      // block closes the page as the trust anchor. Layout-only: nothing added or dropped.
      const location = middle.filter((s) => s.kind === "location");
      const rest = middle.filter((s) => s.kind !== "location");
      const anchor = (s: RenderedSection) =>
        `<div id="cit-sec-${s.kind}" class="cit-arch-anchor">${s.html}</div>`;
      const book = enquiry.length
        ? `<div class="cit-arch-bookwrap">${join(enquiry)}</div>`
        : "";
      return [join(hero), book, rest.map(anchor).join("\n    "), location.map(anchor).join("\n    ")]
        .filter(Boolean)
        .join("\n    ");
    },
  },

  // Dark-luxury: reference-quality art direction #2 (03-dark-luxury.html — Silva). Bound
  // composition: gradient overlay nav, bottom-left editorial hero with a CTA, a SOLID
  // reservation panel overlapping the hero (not glass — considered, quiet), horizontal
  // suite-scroll, numbered ritual grid, offset portrait gallery, a single display quote
  // band, and the location block closing. Pairs best with the dark skins (the hint says so);
  // every rule is token-dressed so a light skin degrades gracefully rather than breaking.
  "dark-luxury": {
    id: "dark-luxury",
    label: "Dark-luxury — csendes prémium",
    skinAffinity: ["cellar-dark-wine", "immersive-dark", "night-azure-gold"],
    hint:
      "sötét, cinematic, felnőtt-prémium: alsó-bal hero, tömör foglaló-panel, vízszintes lakosztály-scroll, " +
      "számozott rituálé-rács, eltolt galéria, egyetlen nagy idézet. SÖTÉT skinnel párosítsd (immersive-dark / " +
      "cellar-dark-wine / night-azure-gold). Variáns-párok automatikusan jönnek.",
    navLinks: true,
    preferredVariants: {
      hero: "editorial",
      enquiry: "bar",
      rooms: "suites-scroll",
      features: "rituals",
      gallery: "offset",
      reviews: "quote",
    },
    css: `.cit-arch-dark-luxury .cit-nav { position: fixed; left: 0; right: 0; border-bottom: 0;
    background: linear-gradient(180deg, color-mix(in srgb, var(--cit-bg) 88%, transparent), transparent); }
  .cit-arch-dark-luxury .cit-nav-brand { letter-spacing: .2em; text-transform: uppercase; font-size: 1.1rem; }
  .cit-arch-dark-luxury .cit-nav-cta { background: none; border: 1px solid var(--cit-accent);
    color: var(--cit-accent); border-radius: 0; letter-spacing: .18em; text-transform: uppercase; font-size: .74rem; }
  .cit-arch-dark-luxury .cit-nav-cta:hover { background: var(--cit-accent); color: var(--cit-on-accent); }
  .cit-arch-dark-luxury .cit-hero--immersive { min-height: 100svh; }
  .cit-arch-dark-luxury .cit-eyebrow { letter-spacing: .42em; }
  .cit-arch-dark-luxury .cit-arch-bookwrap { position: relative; z-index: 10; max-width: 1200px;
    margin: -70px auto 0; padding-inline: clamp(1rem, 3vw, 2rem); }
  .cit-arch-dark-luxury .cit-arch-bookwrap .cit-enquiry { background: var(--cit-surface);
    border: 1px solid var(--cit-line); }
  .cit-arch-dark-luxury .cit-section-inner { max-width: 1200px; }
  .cit-arch-dark-luxury .cit-btn { border-radius: 0; letter-spacing: .18em;
    text-transform: uppercase; font-size: .8rem; }
  .cit-arch-dark-luxury .cit-amen-tile, .cit-arch-dark-luxury .cit-room,
  .cit-arch-dark-luxury .cit-faq-item, .cit-arch-dark-luxury .cit-location-card,
  .cit-arch-dark-luxury .cit-location-map { border-radius: 0; }
  .cit-arch-dark-luxury .cit-faq-item { background: none; border: 0;
    border-bottom: 1px solid var(--cit-line); }
  .cit-arch-dark-luxury .cit-faq-q { padding-inline: 0; }
  .cit-arch-dark-luxury .cit-faq-a { padding-inline: 0; }
  .cit-arch-dark-luxury .cit-faq-list { max-width: 900px; }
  .cit-arch-dark-luxury .cit-stats { border-top: 0; }
  .cit-arch-dark-luxury .cit-arch-anchor, .cit-arch-dark-luxury #cit-enquiry {
    scroll-margin-top: 84px; }
  .cit-arch-dark-luxury .cit-footer { background: var(--cit-bg); border-top: 1px solid var(--cit-line); }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const location = middle.filter((s) => s.kind === "location");
      const rest = middle.filter((s) => s.kind !== "location");
      const anchor = (s: RenderedSection) =>
        `<div id="cit-sec-${s.kind}" class="cit-arch-anchor">${s.html}</div>`;
      const book = enquiry.length
        ? `<div class="cit-arch-bookwrap">${join(enquiry)}</div>`
        : "";
      return [join(hero), book, rest.map(anchor).join("\n    "), location.map(anchor).join("\n    ")]
        .filter(Boolean)
        .join("\n    ");
    },
  },

  // Card-sidebar: reference-quality art direction #3 (04-card-sidebar.html — Diófa,
  // Airbnb-like listing). Bound composition: normal sticky nav, collage header (title row
  // + photo mosaic), then a two-column body — content blocks with quiet border-bottom
  // rhythm on the left, the STICKY booking card on the right (the signature element).
  // Collapses to a single column on mobile with the booking card after the content.
  "card-sidebar": {
    id: "card-sidebar",
    label: "Card-sidebar — hirdetés-stílus",
    skinAffinity: ["editorial-warm", "coastal-fresh", "sand-cream-airy"],
    hint:
      "ismerős, Airbnb-szerű hirdetés-oldal: mozaik-fejléc, bal tartalom-oszlop, jobbra RAGADÓS foglaló-kártya; " +
      "közvetlen, bizalomépítő, családias. VILÁGOS skinnel párosítsd. Variáns-párok automatikusan jönnek.",
    navLinks: true,
    preferredVariants: {
      hero: "collage",
      enquiry: "card",
      features: "amenities",
      rooms: "cards",
      reviews: "cards",
      gallery: "grid",
    },
    css: `.cit-arch-card-sidebar .cit-section-inner, .cit-arch-card-sidebar .cit-hero-inner,
  .cit-arch-card-sidebar .cit-nav-inner, .cit-arch-card-sidebar .cit-footer-inner { max-width: 1140px; }
  .cit-arch-card-sidebar .cit-arch-cs-wrap { max-width: 1140px; margin: 0 auto;
    padding: 2rem clamp(1.25rem, 4vw, 2.5rem) 4rem; display: grid; gap: 2.5rem;
    grid-template-columns: 1fr; }
  @media (min-width: 960px) {
    .cit-arch-card-sidebar .cit-arch-cs-wrap { grid-template-columns: 1.6fr 1fr; align-items: start; }
    .cit-arch-card-sidebar .cit-arch-cs-side { position: sticky; top: 86px; }
  }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-section-inner { max-width: none;
    padding: 1.9rem 0; }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-arch-anchor { border-bottom: 1px solid var(--cit-line); }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-arch-anchor:last-child { border-bottom: 0; }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-section-title { font-size: 1.35rem; margin-bottom: 1rem; }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-eyebrow { display: none; }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-sec-head { text-align: left; margin: 0 0 1.2rem; max-width: none; }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-intro { font-size: 1rem; margin-bottom: 1.4rem; }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-amenity { box-shadow: none; border: 0;
    padding: .35rem 0; background: none; font-size: .98rem; }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-amenity svg { width: 22px; height: 22px; }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-amenity-grid { gap: .5rem;
    grid-template-columns: 1fr; }
  @media (min-width: 640px) { .cit-arch-card-sidebar .cit-arch-cs-main .cit-amenity-grid {
    grid-template-columns: 1fr 1fr; } }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-stats { border: 0; background: none; }
  .cit-arch-card-sidebar .cit-arch-cs-main .cit-stat strong { font-size: 1.5rem; }
  .cit-arch-card-sidebar .cit-arch-cs-side .cit-enquiry { border: 1px solid var(--cit-line);
    border-radius: calc(var(--cit-radius) + 4px); box-shadow: 0 6px 20px rgba(0,0,0,.09);
    background: var(--cit-surface); }
  .cit-arch-card-sidebar .cit-arch-cs-side .cit-book { background: none; border: 0;
    box-shadow: none; padding: 1.6rem; }
  .cit-arch-card-sidebar .cit-arch-cs-side .cit-enquiry-inner { padding: 1.6rem; text-align: left; }
  .cit-arch-card-sidebar .cit-arch-cs-side .cit-enquiry-title { font-size: 1.3rem; }
  .cit-arch-card-sidebar .cit-arch-cs-side .cit-enquiry-sub { font-size: .95rem; margin-bottom: 1.2rem; }
  .cit-arch-card-sidebar .cit-arch-cs-side .cit-btn-lg { margin-top: 0; width: 100%; text-align: center; }
  .cit-arch-card-sidebar .cit-arch-anchor, .cit-arch-card-sidebar #cit-enquiry {
    scroll-margin-top: 76px; }
  .cit-arch-card-sidebar .cit-footer { background: var(--cit-bg); }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const anchor = (s: RenderedSection) =>
        `<div id="cit-sec-${s.kind}" class="cit-arch-anchor">${s.html}</div>`;
      const main = middle.map(anchor).join("\n      ");
      return `${join(hero)}
    <div class="cit-arch-cs-wrap">
      <div class="cit-arch-cs-main">
      ${main}
      </div>
      <aside class="cit-arch-cs-side">${join(enquiry)}</aside>
    </div>`;
    },
  },

  // Editorial-press: reference-quality art direction #4 (05-editorial.html — Kékfestő
  // Porta, "newspaper"). Bound composition: the MASTHEAD hero leads the page and the chrome
  // nav re-orders BELOW it as a sticky pill row (flex order — the front page reads title
  // first, nav second), a lead-story front article with dropcap + classified-ad highlights,
  // the enquiry as a dashed COUPON right after the lead story, polaroid contact-sheet
  // gallery, guest-book letter reviews, and a thin colophon footer.
  "editorial-press": {
    id: "editorial-press",
    label: "Editorial-press — újság-címoldal",
    skinAffinity: ["editorial-magazine", "stone-masonry", "sand-cream-airy"],
    hint:
      "nyomtatott újság-érzet: masthead-címoldal, vezércikk dropcappal, szelvény-stílusú foglaló, polaroid-galéria, " +
      "vendégkönyv-levelek; kézműves, történetmesélő, vidéki karakter. VILÁGOS/papír-tónusú skinnel párosítsd. " +
      "Variáns-párok automatikusan jönnek.",
    navLinks: true,
    preferredVariants: {
      hero: "masthead",
      enquiry: "bar",
      features: "lead-story",
      gallery: "contact-sheet",
      reviews: "letters",
      rooms: "boutique",
    },
    css: `.cit-arch-editorial-press { display: flex; flex-direction: column; }
  .cit-arch-editorial-press > * { order: 3; }
  .cit-arch-editorial-press > .cit-hero--masthead { order: 1; }
  .cit-arch-editorial-press > .cit-nav { order: 2; }
  .cit-arch-editorial-press > .cit-footer { order: 4; }
  .cit-arch-editorial-press .cit-nav { position: sticky; top: 0; background: var(--cit-bg);
    border-bottom: 1px solid var(--cit-line); }
  .cit-arch-editorial-press .cit-nav-inner { justify-content: center; gap: .5rem; padding-block: .6rem; }
  .cit-arch-editorial-press .cit-nav-brand { display: none; }
  .cit-arch-editorial-press .cit-nav-links { display: flex; flex-wrap: wrap; justify-content: center; gap: .3rem; }
  .cit-arch-editorial-press .cit-nav-links a { padding: .4rem .95rem; border-radius: 999px; }
  .cit-arch-editorial-press .cit-nav-links a:hover { background: var(--cit-ink); color: var(--cit-bg); }
  .cit-arch-editorial-press .cit-nav-cta { border-radius: 999px; }
  .cit-arch-editorial-press .cit-section-inner { max-width: 1100px; }
  .cit-arch-editorial-press .cit-sec-head { text-align: left; margin: 0 0 2rem; max-width: none; }
  .cit-arch-editorial-press .cit-section-title { display: flex; align-items: center; gap: 1.1rem; }
  .cit-arch-editorial-press .cit-section-title::after { content: ""; flex: 1;
    border-top: 1px solid var(--cit-ink); }
  .cit-arch-editorial-press .cit-arch-bookwrap { max-width: 1100px; margin: 0 auto;
    padding-inline: clamp(1.25rem, 4vw, 2.5rem); }
  .cit-arch-editorial-press .cit-arch-bookwrap .cit-enquiry { border: 2px dashed var(--cit-ink);
    background: var(--cit-surface); }
  .cit-arch-editorial-press .cit-btn { border-radius: 0; letter-spacing: .08em;
    text-transform: uppercase; font-size: .85rem; }
  .cit-arch-editorial-press .cit-room { background: none; border: 0; box-shadow: none; }
  .cit-arch-editorial-press .cit-room-img { aspect-ratio: 3 / 4; }
  .cit-arch-editorial-press .cit-room-body { padding: 1.1rem 0 0; }
  .cit-arch-editorial-press .cit-room-foot { border-top-color: var(--cit-ink); }
  .cit-arch-editorial-press .cit-faq-item { background: none; border: 0;
    border-bottom: 1px solid var(--cit-line); border-radius: 0; }
  .cit-arch-editorial-press .cit-faq-q { padding-inline: 0; font-family: var(--cit-font-display);
    font-size: 1.15rem; }
  .cit-arch-editorial-press .cit-faq-a { padding-inline: 0; }
  .cit-arch-editorial-press .cit-location-map { border: 1px solid var(--cit-ink); border-radius: 0;
    padding: 10px; background: var(--cit-surface); }
  .cit-arch-editorial-press .cit-location-card { border-radius: 0; }
  .cit-arch-editorial-press .cit-stats { border: 0; background: none; }
  .cit-arch-editorial-press .cit-arch-anchor, .cit-arch-editorial-press #cit-enquiry {
    scroll-margin-top: 64px; }
  .cit-arch-editorial-press .cit-footer { background: none; border-top: 2px solid var(--cit-ink); }
  .cit-arch-editorial-press .cit-footer-inner { padding-block: 2.2rem; }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const anchor = (s: RenderedSection) =>
        `<div id="cit-sec-${s.kind}" class="cit-arch-anchor">${s.html}</div>`;
      // Front-page order: lead story (features) first, then the COUPON enquiry, then the
      // rest, location closing. Layout-only reordering of the given sections.
      const lead = middle.filter((s) => s.kind === "features");
      const location = middle.filter((s) => s.kind === "location");
      const rest = middle.filter((s) => s.kind !== "features" && s.kind !== "location");
      const book = enquiry.length
        ? `<div class="cit-arch-bookwrap">${join(enquiry)}</div>`
        : "";
      return [
        join(hero),
        lead.map(anchor).join("\n    "),
        book,
        rest.map(anchor).join("\n    "),
        location.map(anchor).join("\n    "),
      ]
        .filter(Boolean)
        .join("\n    ");
    },
  },

  // Immersive-parallax: reference-quality art direction #5 (06-immersive-parallax.html —
  // Nordwand). Bound composition: minimal fixed top bar, side DOT NAV (desktop), parallax
  // hero (fixed background), the enquiry as a STICKY dark booking dock right under the
  // hero, heavy uppercase display type, alternating showcase rows with spec chips, full-
  // bleed parallax photo panels, a dark reviews band and a dark footer. Pairs with the
  // alpine-bold skin (the hint says so) but dresses from tokens only.
  "immersive-parallax": {
    id: "immersive-parallax",
    label: "Immersive-parallax — panoráma-panelek",
    skinAffinity: ["alpine-bold", "coastal-fresh", "night-azure-gold"],
    hint:
      "erőteljes, sportos-immerzív: parallax fotó-panelek, ragadós sötét foglaló-dokk, oldalsó pont-nav, " +
      "KIABÁLÓ verzál címek; hegyi/panorámás/aktív karakterhez. Az alpine-bold skinnel párosítsd. " +
      "Variáns-párok automatikusan jönnek.",
    navLinks: true,
    preferredVariants: {
      hero: "editorial",
      enquiry: "bar",
      rooms: "showcase",
      features: "tiles",
      gallery: "panels",
      reviews: "band",
    },
    css: `.cit-arch-immersive-parallax .cit-nav { position: fixed; left: 0; right: 0;
    border-bottom: 0; background: linear-gradient(180deg, rgba(0,0,0,.55), transparent); }
  .cit-arch-immersive-parallax .cit-nav-brand { color: #fff; font-weight: 900;
    text-transform: uppercase; letter-spacing: .1em; text-shadow: 0 1px 8px rgba(0,0,0,.5); }
  .cit-arch-immersive-parallax .cit-nav-links { display: none; }
  .cit-arch-immersive-parallax .cit-hero--immersive { min-height: 100svh; }
  .cit-arch-immersive-parallax .cit-hero-bg { animation: none; }
  @media (min-width: 900px) and (prefers-reduced-motion: no-preference) {
    .cit-arch-immersive-parallax .cit-hero-bg { background-attachment: fixed; }
  }
  .cit-arch-immersive-parallax .cit-hero-title, .cit-arch-immersive-parallax .cit-section-title {
    text-transform: uppercase; letter-spacing: -.01em; }
  .cit-arch-immersive-parallax .cit-hero .cit-eyebrow { background: var(--cit-accent);
    color: var(--cit-on-accent); padding: .45rem .9rem; border-radius: 4px; letter-spacing: .22em; }
  .cit-arch-immersive-parallax .cit-arch-dock { position: sticky; top: 0; z-index: 40;
    background: var(--cit-ink); box-shadow: 0 8px 24px rgba(0,0,0,.25);
    padding: .5rem clamp(1rem, 4vw, 2rem); }
  /* mobile: the dock's booking form stacks tall — never pin it, or it covers the viewport */
  @media (max-width: 700px) { .cit-arch-immersive-parallax .cit-arch-dock { position: static; } }
  .cit-arch-immersive-parallax .cit-arch-dock .cit-enquiry { background: none; }
  /* The runtime hydrates a surface-toned widget into the slot; re-dress it for the dark dock
     (the signature element) so the composition survives hydration. */
  .cit-arch-immersive-parallax .cit-arch-dock .cit-book { background: none; border: 0;
    box-shadow: none; padding: .4rem 0; color: var(--cit-bg); }
  .cit-arch-immersive-parallax .cit-arch-dock .cit-enquiry-bar-title,
  .cit-arch-immersive-parallax .cit-arch-dock .cit-book__label,
  .cit-arch-immersive-parallax .cit-arch-dock .cit-book__count,
  .cit-arch-immersive-parallax .cit-arch-dock .cit-book__step,
  .cit-arch-immersive-parallax .cit-arch-dock .cit-book__title { color: var(--cit-bg); }
  .cit-arch-immersive-parallax .cit-arch-dock .cit-book__input {
    background: color-mix(in srgb, var(--cit-bg) 12%, transparent);
    border-color: color-mix(in srgb, var(--cit-bg) 28%, transparent); color: var(--cit-bg); }
  .cit-arch-immersive-parallax .cit-arch-dock .cit-book__stepper {
    background: color-mix(in srgb, var(--cit-bg) 12%, transparent);
    border-color: color-mix(in srgb, var(--cit-bg) 28%, transparent); }
  .cit-arch-immersive-parallax .cit-arch-dock .cit-book__step:hover {
    background: color-mix(in srgb, var(--cit-bg) 22%, transparent); }
  .cit-arch-immersive-parallax .cit-arch-dock .cit-book__note { color: var(--cit-bg); opacity: .7; }
  .cit-arch-immersive-parallax .cit-section-inner { max-width: 1200px; }
  .cit-arch-immersive-parallax .cit-stats { border: 0; }
  .cit-arch-immersive-parallax .cit-stat { border-left-width: 4px; }
  .cit-arch-immersive-parallax .cit-show-body h3 { text-transform: uppercase; }
  .cit-arch-immersive-parallax .cit-room-meta { background: var(--cit-surface);
    border: 1px solid var(--cit-line); display: inline-block; padding: .35rem .8rem;
    border-radius: 999px; }
  .cit-arch-immersive-parallax .cit-reviews--band { background: var(--cit-ink); }
  .cit-arch-immersive-parallax .cit-reviews--band .cit-section-title,
  .cit-arch-immersive-parallax .cit-reviews--band .cit-review-quote,
  .cit-arch-immersive-parallax .cit-reviews--band .cit-review-author { color: var(--cit-bg); }
  .cit-arch-immersive-parallax .cit-reviews--band .cit-eyebrow { color: var(--cit-accent); opacity: 1; }
  .cit-arch-immersive-parallax .cit-reviews--band .cit-review {
    background: color-mix(in srgb, var(--cit-bg) 8%, transparent);
    border-color: color-mix(in srgb, var(--cit-bg) 16%, transparent); }
  .cit-arch-immersive-parallax .cit-reviews--band .cit-review-meta,
  .cit-arch-immersive-parallax .cit-reviews--band .cit-sample-note {
    color: var(--cit-bg); opacity: .75; }
  .cit-arch-immersive-parallax .cit-reviews--band .cit-stars svg { color: var(--cit-accent); }
  .cit-arch-immersive-parallax .cit-dots { position: fixed; right: 18px; top: 50%;
    transform: translateY(-50%); z-index: 45; display: none; flex-direction: column; gap: 14px; }
  @media (min-width: 1000px) { .cit-arch-immersive-parallax .cit-dots { display: flex; } }
  .cit-arch-immersive-parallax .cit-dots a { width: 10px; height: 10px; border-radius: 50%;
    background: transparent; border: 2px solid var(--cit-ink); display: block; transition: background .2s; }
  .cit-arch-immersive-parallax .cit-dots a:hover { background: var(--cit-accent);
    border-color: var(--cit-accent); }
  .cit-arch-immersive-parallax .cit-arch-anchor, .cit-arch-immersive-parallax #cit-enquiry {
    scroll-margin-top: 96px; }
  .cit-arch-immersive-parallax .cit-footer {
    background: var(--cit-ink); color: color-mix(in srgb, var(--cit-bg) 65%, transparent); border-top: 0; }
  .cit-arch-immersive-parallax .cit-footer-name, .cit-arch-immersive-parallax .cit-footer-col h4 {
    color: var(--cit-bg); }
  .cit-arch-immersive-parallax .cit-footer-col a {
    color: color-mix(in srgb, var(--cit-bg) 65%, transparent); }
  .cit-arch-immersive-parallax .cit-footer-col a:hover { color: var(--cit-accent); }
  .cit-arch-immersive-parallax .cit-footer-bottom {
    border-top-color: color-mix(in srgb, var(--cit-bg) 14%, transparent); }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const location = middle.filter((s) => s.kind === "location");
      const rest = middle.filter((s) => s.kind !== "location");
      const anchor = (s: RenderedSection) =>
        `<div id="cit-sec-${s.kind}" class="cit-arch-anchor">${s.html}</div>`;
      // Side dot nav from the anchored kinds (plain CSS anchors — no JS dependency).
      const dotTargets = [...rest, ...location];
      const dots = dotTargets.length
        ? `<nav class="cit-dots" aria-label="Szakasz-navigáció">${dotTargets
            .map((s) => `<a href="#cit-sec-${s.kind}" aria-label="${s.kind}"></a>`)
            .join("")}</nav>`
        : "";
      const dock = enquiry.length
        ? `<div class="cit-arch-dock">${join(enquiry)}</div>`
        : "";
      return [dots, join(hero), dock, rest.map(anchor).join("\n    "), location.map(anchor).join("\n    ")]
        .filter(Boolean)
        .join("\n    ");
    },
  },

  // Bento: an asymmetric middle grid (features narrow, gallery wide) with denser gallery
  // tiles. A dynamic, magazine-mosaic arrangement. Collapses to a single column on mobile.
  bento: {
    id: "bento",
    label: "Bento — aszimmetrikus rács",
    retired: true,
    hint: "aszimmetrikus rács, sűrű galéria-csempék; magazinos, dinamikus.",
    css: `@media (min-width: 900px) {
    .cit-arch-bento .cit-arch-bento-grid { display: grid; grid-template-columns: 5fr 7fr; align-items: start; }
  }
  .cit-arch-bento .cit-gallery-grid { grid-template-columns: repeat(3, 1fr); gap: 4px; }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const mid = middle.length ? `<div class="cit-arch-bento-grid">${join(middle)}</div>` : "";
      return [join(hero), mid, join(enquiry)].filter(Boolean).join("\n    ");
    },
  },
};
