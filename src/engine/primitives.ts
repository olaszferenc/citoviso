// Deterministic layout primitives. Each is a pure (data) => HTML function producing
// a FIXED structure with token-dressed classes; only DATA fills the slots. No AI, no
// randomness — this is what makes mock=live structurally identical (ADR-0016). Module
// hooks (data-cit-module) let the existing runtime (cit-runtime.js, 06-UI-CONTRACT)
// hydrate these later without changing the markup.

import type { SectionKind, SiteData } from "./recipe.js";

/** Minimal HTML-escape for text slots. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hero(d: SiteData): string {
  return `<section class="cit-hero">
      <div class="cit-hero-inner">
        <h1 class="cit-hero-title">${esc(d.name)}</h1>
        <p class="cit-hero-tagline">${esc(d.tagline)}</p>
      </div>
    </section>`;
}

export function features(d: SiteData): string {
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

export function gallery(d: SiteData): string {
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

export function enquiry(d: SiteData): string {
  const email = d.contact.email ?? "";
  // Booking/enquiry is the SPINE CTA (data-cit-module="booking"); the runtime
  // upgrades this static card into the interactive widget. No-JS: the mailto works.
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

/** Primitive registry — the recipe's section kinds resolve to these renderers. */
export const PRIMITIVES: Record<SectionKind, (d: SiteData) => string> = {
  hero,
  features,
  gallery,
  enquiry,
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
