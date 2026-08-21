// Tenant-set module content, rendered ONCE for every art template (ADR-0044).
//
// WHY ONE SHARED BLOCK AND NOT 16 TEMPLATE EDITS: the architecture doctrine
// (ADR-0016) is a single token-themed module set precisely so a new section costs
// O(1), not O(templates). Writing an amenities section into all 16 templates would
// be the 100×N trap, and the 17th template would silently ship without it.
//
// These sections are pure TENANT CONTENT: what the owner typed in the admin. They
// carry no invented facts — an empty setting renders nothing at all rather than a
// plausible placeholder (§B.17). Every block is anchored with data-cit-module so
// detection, the configurator and the runtime can find it, and every colour comes
// from the skin's --cit-* contract, so the block inherits whatever template it
// lands in instead of fighting it.

import type { SiteData } from "./recipe.js";
import { T, esc } from "./templateKit.js";

/** Scoped styles for the shared blocks; emitted once, only when something renders. */
const CSS = `<style data-cit-modsec>
/* The 16 templates do not agree on a global box-sizing reset, so every box here
   states its own. Measured, not assumed: without this the amenity cards overran
   their section by 27px on fullbleed and pushed editorial into a 12px horizontal
   scroll — a sideways-scrolling page is the classic broken-on-a-phone symptom. */
.cit-modsec,.cit-modsec *{box-sizing:border-box}
.cit-modsec{padding:56px 0;border-top:1px solid var(--cit-line);overflow-x:hidden}
.cit-modsec__in{width:100%;max-width:1120px;margin:0 auto;padding:0 4vw}
.cit-modsec h2{font-family:var(--cit-font-display,inherit);font-size:clamp(1.3rem,3.2vw,1.9rem);
  margin:0 0 22px;color:var(--cit-ink)}
.cit-modsec__grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.cit-modsec__item{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;
  border:1px solid var(--cit-line);border-radius:calc(var(--cit-radius) * 0.6);
  background:var(--cit-bg);color:var(--cit-ink)}
.cit-modsec__item svg{flex:0 0 auto;width:18px;height:18px;stroke:var(--cit-accent);
  fill:none;stroke-width:1.8;margin-top:2px}
.cit-modsec__facts{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.cit-modsec__fact{padding:14px 16px;border:1px solid var(--cit-line);
  border-radius:calc(var(--cit-radius) * 0.6);background:var(--cit-bg)}
.cit-modsec__fact b{display:block;font-size:1.25rem;color:var(--cit-ink)}
.cit-modsec__fact span{font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;
  color:var(--cit-muted);font-weight:600}
.cit-modsec__note{margin:16px 0 0;color:var(--cit-muted)}
.cit-modsec table{width:100%;border-collapse:collapse;table-layout:fixed}
.cit-modsec th,.cit-modsec td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--cit-line);
  overflow-wrap:anywhere}
.cit-modsec th{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--cit-muted)}
.cit-modsec td{color:var(--cit-ink)}
/* A 3-column price table cannot shrink below its content, which pushed a narrow
   template into horizontal scroll (measured: 23px on card-sidebar). On a phone the
   right answer is not a scrollable table but stacked rows, each labelled. */
@media (max-width:560px){
  .cit-modsec table,.cit-modsec tbody,.cit-modsec tr,.cit-modsec td{display:block;width:100%}
  .cit-modsec thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .cit-modsec tr{padding:12px 0;border-bottom:1px solid var(--cit-line)}
  .cit-modsec td{border:0;padding:2px 0}
  .cit-modsec td:first-child{font-weight:600}
  .cit-modsec td:empty{display:none}
}
.cit-news{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.cit-news input{flex:1;min-width:220px;font:inherit;padding:12px 14px;color:var(--cit-ink);
  background:var(--cit-bg);border:1px solid var(--cit-line);
  border-radius:calc(var(--cit-radius) * 0.6)}
</style>`;

// Own SVG set — emoji icons are forbidden (§B.4).
const ICON_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>`;
const ICON_PIN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>`;
const ICON_STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 2.3 4.9 5.2.7-3.8 3.6 1 5.2-4.7-2.6-4.7 2.6 1-5.2L4.5 9.6l5.2-.7Z"/></svg>`;

function listBlock(
  d: SiteData,
  module: string,
  heading: string,
  items: readonly string[],
  icon: string,
): string {
  if (!items.length) return "";
  const li = items
    .map((t) => `<li class="cit-modsec__item">${icon}<span>${esc(t)}</span></li>`)
    .join("");
  return (
    `<section class="cit-modsec" data-cit-module="${module}">` +
    `<div class="cit-modsec__in"><h2>${heading}</h2>` +
    `<ul class="cit-modsec__grid" style="list-style:none;margin:0;padding:0">${li}</ul>` +
    `</div></section>`
  );
}

function hoursBlock(d: SiteData): string {
  const h = d.hours;
  if (!h) return "";
  const facts: string[] = [];
  if (h.checkInFrom || h.checkInTo) {
    const range = [h.checkInFrom, h.checkInTo].filter(Boolean).join(" – ");
    facts.push(`<div class="cit-modsec__fact"><b>${esc(range)}</b><span>${T(d, "Érkezés")}</span></div>`);
  }
  if (h.checkOutUntil) {
    facts.push(
      `<div class="cit-modsec__fact"><b>${esc(h.checkOutUntil)}</b><span>${T(d, "Távozás eddig")}</span></div>`,
    );
  }
  if (!facts.length && !h.note) return "";
  return (
    `<section class="cit-modsec" data-cit-module="hours">` +
    `<div class="cit-modsec__in"><h2>${T(d, "Érkezés és távozás")}</h2>` +
    (facts.length ? `<div class="cit-modsec__facts">${facts.join("")}</div>` : "") +
    (h.note ? `<p class="cit-modsec__note">${esc(h.note)}</p>` : "") +
    `</div></section>`
  );
}

function pricingBlock(d: SiteData): string {
  const p = d.pricing;
  if (!p) return "";
  const cur = p.currency === "EUR" ? "€" : "Ft";
  const unit =
    p.unit === "per_person_night"
      ? T(d, "fő / éjszaka")
      : p.unit === "per_stay"
        ? T(d, "a teljes tartózkodásra")
        : T(d, "éjszakánként");
  const seasons = p.seasons ?? [];
  const rows = seasons
    .map((s) => {
      const period = [s.from, s.to].filter(Boolean).join(" – ");
      const price = s.price ? `${String(s.price).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${cur}` : "";
      return `<tr><td>${esc(s.label)}</td><td>${esc(period)}</td><td>${esc(price)}</td></tr>`;
    })
    .join("");
  if (!rows && !p.note) return "";
  return (
    `<section class="cit-modsec" data-cit-module="pricing">` +
    `<div class="cit-modsec__in"><h2>${T(d, "Árak")}</h2>` +
    (rows
      ? `<table><thead><tr><th>${T(d, "Időszak")}</th><th>${T(d, "Mikor")}</th>` +
        `<th>${esc(unit)}</th></tr></thead><tbody>${rows}</tbody></table>`
      : "") +
    (p.note ? `<p class="cit-modsec__note">${esc(p.note)}</p>` : "") +
    `</div></section>`
  );
}

function locationBlock(d: SiteData): string {
  const l = d.location;
  if (!l || (!l.approachNote && !l.parkingNote)) return "";
  return (
    `<section class="cit-modsec" data-cit-module="map">` +
    `<div class="cit-modsec__in"><h2>${T(d, "Megközelítés")}</h2>` +
    (l.approachNote ? `<p class="cit-modsec__note" style="margin-top:0">${esc(l.approachNote)}</p>` : "") +
    (l.parkingNote
      ? `<ul class="cit-modsec__grid" style="list-style:none;margin:16px 0 0;padding:0">` +
        `<li class="cit-modsec__item">${ICON_PIN}<span>${esc(l.parkingNote)}</span></li></ul>`
      : "") +
    `</div></section>`
  );
}

function newsletterBlock(d: SiteData): string {
  const n = d.newsletter;
  if (!n || (!n.title && !n.subtitle)) return "";
  return (
    `<section class="cit-modsec" data-cit-module="newsletter">` +
    `<div class="cit-modsec__in">` +
    `<h2>${esc(n.title ?? T(d, "Maradjunk kapcsolatban"))}</h2>` +
    (n.subtitle ? `<p class="cit-modsec__note" style="margin-top:0">${esc(n.subtitle)}</p>` : "") +
    `<form class="cit-news" method="POST" action="/api/hirlevel">` +
    `<input type="email" name="email" required placeholder="${T(d, "E-mail cím")}" ` +
    `aria-label="${T(d, "E-mail cím")}">` +
    `<button class="cit-btn" type="submit">${T(d, "Feliratkozom")}</button>` +
    `</form></div></section>`
  );
}

/**
 * All tenant-set module sections for this site, in a stable order, or "" when the
 * owner has set nothing. The CSS rides along only when something actually renders,
 * so a page with no configured modules is byte-identical to before.
 */
export function moduleSections(d: SiteData): string {
  const blocks = [
    listBlock(d, "usp", T(d, "Miért minket válasszon?"), d.usp ?? [], ICON_STAR),
    listBlock(d, "amenities", T(d, "Amit kínálunk"), d.amenities ?? [], ICON_CHECK),
    hoursBlock(d),
    pricingBlock(d),
    locationBlock(d),
    listBlock(d, "poi", T(d, "A környéken"), d.poi ?? [], ICON_PIN),
    newsletterBlock(d),
  ].filter(Boolean);
  return blocks.length ? CSS + blocks.join("") : "";
}
