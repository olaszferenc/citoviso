// Page chrome (ADR-0018): the sticky nav + rich footer that frame EVERY generated page and
// make it feel complete — distilled from the reference-quality samples. Chrome is page-level
// (not archetype-arranged): render.ts places the nav before, and the footer after, the
// archetype's section arrangement. Deterministic, token-only, no fabricated facts (brand =
// name; contact from the lead; the © line carries no year to stay date-stable for mock=live).

import type { SectionKind, SiteData } from "./recipe.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Nav link labels per section kind — links render only for kinds the page actually has
 *  (and only when the archetype opts in via `navLinks`, because the anchor targets are the
 *  `cit-sec-<kind>` wrappers that such an archetype's arrange() emits). */
const NAV_LABELS: Partial<Record<SectionKind, string>> = {
  rooms: "Szobák",
  features: "Szolgáltatások",
  gallery: "Galéria",
  reviews: "Vélemények",
  location: "Kapcsolat",
};

/** Sticky top nav: brand + optional section links + (if reachable) an enquiry CTA. Solid
 *  surface bar — readable on any skin, works with no JS (links are plain anchors). */
export function renderNav(d: SiteData, kinds?: readonly SectionKind[]): string {
  // The enquiry band is reachable with email OR phone (its fallback CTA adapts) — so the
  // nav CTA renders for both; phone-only leads keep a working action on mobile.
  const cta =
    d.contact.email || d.contact.phone
      ? `<a class="cit-nav-cta" href="#cit-enquiry">Érdeklődés</a>`
      : "";
  const links = (kinds ?? [])
    .filter((k) => NAV_LABELS[k])
    .map((k) => `<li><a href="#cit-sec-${k}">${NAV_LABELS[k]}</a></li>`)
    .join("");
  const linkList = links ? `<ul class="cit-nav-links">${links}</ul>` : "";
  return `<header id="top" class="cit-nav">
      <div class="cit-nav-inner">
        <a class="cit-nav-brand" href="#top">${esc(d.name)}</a>
        ${linkList}
        ${cta}
      </div>
    </header>`;
}

/** Rich multi-column footer: brand + tagline, contact facts, standard site links, © line. */
export function renderFooter(d: SiteData): string {
  const c = d.contact;
  const contactItems = [
    c.phone ? `<li>${esc(c.phone)}</li>` : "",
    c.email ? `<li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : "",
    c.address ? `<li>${esc(c.address)}</li>` : "",
  ]
    .filter(Boolean)
    .join("\n          ");
  const contactCol = contactItems
    ? `<div class="cit-footer-col">
        <h4>Kapcsolat</h4>
        <ul>
          ${contactItems}
        </ul>
      </div>`
    : "";
  return `<footer class="cit-footer">
      <div class="cit-footer-inner">
        <div class="cit-footer-brand">
          <div class="cit-footer-name">${esc(d.name)}</div>
          ${d.tagline ? `<p>${esc(d.tagline)}</p>` : ""}
        </div>
        ${contactCol}
        <div class="cit-footer-col">
          <h4>Információ</h4>
          <ul>
            <li><a href="#top">Kezdőlap</a></li>
            <li><a href="#cit-enquiry">Kapcsolat</a></li>
            <li><a href="#">Adatkezelés</a></li>
          </ul>
        </div>
      </div>
      <div class="cit-footer-bottom">© ${esc(d.name)} — Minden jog fenntartva.</div>
    </footer>`;
}

/** Chrome CSS — dresses ONLY from --cit-* tokens (skin-agnostic). */
export const CHROME_CSS = `  .cit-nav { position: sticky; top: 0; z-index: 50; background: var(--cit-surface);
    border-bottom: 1px solid var(--cit-line); }
  .cit-nav-inner { max-width: 1120px; margin: 0 auto; display: flex; align-items: center;
    justify-content: space-between; gap: 1rem; padding: .85rem clamp(1.25rem, 4vw, 2.5rem); }
  .cit-nav-brand { font-family: var(--cit-font-display); font-size: 1.3rem; font-weight: 600;
    color: var(--cit-ink); text-decoration: none; letter-spacing: .01em; }
  .cit-nav-cta { background: var(--cit-accent); color: var(--cit-on-accent); text-decoration: none;
    padding: .55rem 1.2rem; border-radius: var(--cit-radius); font-weight: 600; font-size: .9rem; }
  .cit-nav-links { display: none; list-style: none; margin: 0; padding: 0; gap: 1.7rem; }
  .cit-nav-links a { color: var(--cit-ink); text-decoration: none; font-size: .82rem;
    letter-spacing: .12em; text-transform: uppercase; }
  .cit-nav-links a:hover { color: var(--cit-accent); }
  @media (min-width: 900px) { .cit-nav-links { display: flex; } }
  .cit-footer { background: var(--cit-surface); border-top: 1px solid var(--cit-line); color: var(--cit-muted); }
  .cit-footer-inner { max-width: 1120px; margin: 0 auto; display: grid; gap: 2.5rem;
    grid-template-columns: 1fr; padding: clamp(3rem, 6vw, 4.5rem) clamp(1.25rem, 4vw, 2.5rem); }
  @media (min-width: 720px) { .cit-footer-inner { grid-template-columns: 2fr 1fr 1fr; } }
  .cit-footer-name { font-family: var(--cit-font-display); font-size: 1.4rem; color: var(--cit-ink); margin-bottom: .5rem; }
  .cit-footer-brand p { margin: 0; max-width: 42ch; line-height: 1.6; }
  .cit-footer-col h4 { font-size: .76rem; letter-spacing: .16em; text-transform: uppercase;
    color: var(--cit-ink); margin: 0 0 1rem; }
  .cit-footer-col ul { list-style: none; padding: 0; margin: 0; }
  .cit-footer-col li { margin-bottom: .55rem; }
  .cit-footer-col a { color: var(--cit-muted); text-decoration: none; }
  .cit-footer-col a:hover { color: var(--cit-accent); }
  .cit-footer-bottom { border-top: 1px solid var(--cit-line); text-align: center;
    padding: 1.4rem; font-size: .85rem; }`;
