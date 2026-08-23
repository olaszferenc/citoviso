// Tenant-set module content, rendered ONCE for every art template (ADR-0044).
//
// WHY ONE SHARED BLOCK AND NOT 16 TEMPLATE EDITS: the architecture doctrine
// (ADR-0016) is a single token-themed module set precisely so a new section costs
// O(1), not O(templates). Writing an amenities section into all 16 templates would
// be the 100×N trap, and the 17th template would silently ship without it.
//
// ADR-0059 integration doctrine: a shared block is the FALLBACK, not the default.
// Where the template natively renders a content type (rooms, selling points), the
// module data flows INTO that native section (render.ts weave) and the shared block
// carries only the measured leftover — one content type appears ONCE on a page.
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
/* Template-native contract (ADR-0057): each art template overrides these vars to its
   OWN section rhythm, so a paid module reads as part of the site instead of a generic
   grey appendix. The defaults reproduce the pre-contract look verbatim, so a template
   that sets nothing renders byte-identically to before. This is O(templates) one-liners
   per template, NOT the O(templates × modules) trap — the module MARKUP stays single-
   source here; only the section's rhythm/card treatment is themed per template. */
.cit-modsec{
  --_py:var(--cit-modsec-py,56px);
  --_maxw:var(--cit-modsec-maxw,1120px);
  --_px:var(--cit-modsec-px,4vw);
  --_align:var(--cit-modsec-head-align,left);
  --_head-mb:var(--cit-modsec-head-mb,22px);
  --_head-size:var(--cit-modsec-head-size,clamp(1.3rem,3.2vw,1.9rem));
  --_head-weight:var(--cit-modsec-head-weight,700);
  --_card-bg:var(--cit-modsec-card-bg,var(--cit-bg));
  --_card-border:var(--cit-modsec-card-border,1px solid var(--cit-line));
  --_card-radius:var(--cit-modsec-card-radius,calc(var(--cit-radius) * 0.6));
  --_card-pad:var(--cit-modsec-card-pad,12px 14px);
  padding:var(--_py) 0;border-top:var(--cit-modsec-divider,1px solid var(--cit-line));
  overflow-x:hidden}
.cit-modsec__in{width:100%;max-width:var(--_maxw);margin:0 auto;padding:0 var(--_px)}
.cit-modsec h2{font-family:var(--cit-font-display,inherit);font-size:var(--_head-size);
  font-weight:var(--_head-weight);text-align:var(--_align);
  margin:0 0 var(--_head-mb);color:var(--cit-ink)}
.cit-modsec__grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.cit-modsec__item{display:flex;align-items:flex-start;gap:10px;padding:var(--_card-pad);
  border:var(--_card-border);border-radius:var(--_card-radius);
  background:var(--_card-bg);color:var(--cit-ink)}
.cit-modsec__item svg{flex:0 0 auto;width:18px;height:18px;stroke:var(--cit-accent);
  fill:none;stroke-width:1.8;margin-top:2px}
.cit-modsec__facts{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.cit-modsec__fact{padding:var(--_card-pad);border:var(--_card-border);
  border-radius:var(--_card-radius);background:var(--_card-bg)}
.cit-modsec__fact b{display:block;font-size:1.25rem;color:var(--cit-ink)}
.cit-modsec__fact span{font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;
  color:var(--cit-muted);font-weight:600}
.cit-modsec__note{margin:16px 0 0;color:var(--cit-muted)}
.cit-modsec__badge{margin:0 0 16px}
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
/* Review form: one column on a phone, two where there is room. minmax(0,1fr) not
   1fr — a bare 1fr refuses to shrink below its content and re-creates the sideways
   scroll the box-sizing note above describes. */
.cit-rev-f{display:grid;gap:14px;grid-template-columns:1fr;margin-top:6px}
@media (min-width:620px){.cit-rev-f{grid-template-columns:repeat(2,minmax(0,1fr))}}
.cit-rev-f__wide{grid-column:1/-1}
.cit-rev-f__lbl{display:flex;flex-direction:column;gap:6px;font-size:.86rem;
  color:var(--cit-muted);font-weight:600}
.cit-rev-f input,.cit-rev-f select,.cit-rev-f textarea{font:inherit;padding:12px 14px;
  color:var(--cit-ink);background:var(--cit-bg);border:1px solid var(--cit-line);
  border-radius:calc(var(--cit-radius) * 0.6);width:100%;max-width:100%}
.cit-rev-f textarea{resize:vertical}
/* Google rating badge — a number and a way to verify it. */
.cit-grat{display:inline-flex;align-items:center;gap:14px;text-decoration:none;
  padding:14px 20px;border:1px solid var(--cit-line);background:var(--cit-bg);
  border-radius:calc(var(--cit-radius) * 0.6);color:var(--cit-ink);max-width:100%}
.cit-grat__icon svg{width:26px;height:26px;stroke:var(--cit-accent);fill:none;stroke-width:1.8}
.cit-grat__num{font-size:1.7rem;font-weight:700;line-height:1}
.cit-grat__meta{display:flex;flex-direction:column;gap:2px;font-size:.85rem;color:var(--cit-muted)}
.cit-grat__meta em{font-style:normal;color:var(--cit-accent);font-weight:600}
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

/** 'MM-DD' → "06. 15." so a guest is not asked to read a database format. */
function niceDay(md: string): string {
  return `${md.slice(0, 2)}. ${md.slice(3, 5)}.`;
}

function money(amount: number, currency?: string): string {
  const n = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return currency === "EUR" ? `${n} €` : `${n} Ft`;
}

/**
 * ADR-0059 §2 (unit-first): when every priced unit has ONLY a base price and the
 * room cards already carry a price line, the season table would restate the same
 * numbers one screen lower — the "same content type twice" the doctrine forbids.
 * The table earns its place only when it adds what the cards cannot hold: seasons,
 * or a pricing note, or a priced unit the rooms list does not show.
 */
function pricingCoveredByRooms(d: SiteData): boolean {
  const p = d.pricing;
  if (!p || p.note || !p.units?.length || !d.rooms?.length) return false;
  const pricedRooms = new Set(d.rooms.filter((r) => r.price).map((r) => r.name));
  return p.units.every((u) => !u.seasons?.length && pricedRooms.has(u.name));
}

/**
 * Prices, grouped BY UNIT — one small table per room/apartment. A single flat table
 * cannot answer "which of the three apartments costs what", which is the only
 * question a guest actually has here.
 */
function pricingBlock(d: SiteData): string {
  const p = d.pricing;
  if (!p || pricingCoveredByRooms(d)) return "";
  const unitLabel =
    p.unit === "per_person_night"
      ? T(d, "fő / éjszaka")
      : p.unit === "per_stay"
        ? T(d, "a teljes tartózkodásra")
        : T(d, "éjszakánként");

  const groups = (p.units ?? [])
    .map((u) => {
      const rows: string[] = [];
      for (const s of u.seasons ?? []) {
        rows.push(
          `<tr><td>${esc(s.label)}</td><td>${esc(niceDay(s.from))} – ${esc(niceDay(s.to))}</td>` +
            `<td>${esc(money(s.amount, p.currency))}</td></tr>`,
        );
      }
      if (u.base) {
        rows.push(
          `<tr><td>${T(d, "Egyéb időszakban")}</td><td></td>` +
            `<td>${esc(money(u.base, p.currency))}</td></tr>`,
        );
      }
      if (!rows.length) return "";
      // The unit heading is dropped for a single-unit site: naming "A szállás egésze"
      // above its own price is noise the owner never wrote.
      const heading =
        (p.units?.length ?? 0) > 1
          ? `<h3 style="margin:26px 0 8px;font-size:1.02rem">${esc(u.name)}</h3>`
          : "";
      return (
        heading +
        `<table><thead><tr><th>${T(d, "Időszak")}</th><th>${T(d, "Mikor")}</th>` +
        `<th>${esc(unitLabel)}</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
      );
    })
    .filter(Boolean)
    .join("");

  if (!groups && !p.note) return "";
  return (
    `<section class="cit-modsec" data-cit-module="pricing">` +
    `<div class="cit-modsec__in"><h2>${T(d, "Árak")}</h2>` +
    groups +
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
/**
 * The units the owner rents out, as cards. Only used as a FALLBACK: 7 of the 16 art
 * templates have no rooms section of their own, and a tenant who bought the rooms
 * module must not get nothing just because of which template their site drew.
 * The caller decides (see `alreadyShown`) so we never print the rooms twice.
 */
function roomsBlock(d: SiteData): string {
  const rooms = d.rooms ?? [];
  if (!rooms.length) return "";
  const cards = rooms
    .map(
      (r) =>
        `<li class="cit-modsec__item" style="flex-direction:column;gap:4px">` +
        `<strong>${esc(r.name)}</strong>` +
        (r.capacity ? `<span style="color:var(--cit-muted)">${esc(r.capacity)}</span>` : "") +
        (r.note ? `<span style="color:var(--cit-muted)">${esc(r.note)}</span>` : "") +
        (r.price ? `<span style="font-weight:600">${esc(r.price)}</span>` : "") +
        `</li>`,
    )
    .join("");
  return (
    `<section class="cit-modsec" data-cit-module="rooms">` +
    `<div class="cit-modsec__in"><h2>${T(d, "Szobák, apartmanok")}</h2>` +
    `<ul class="cit-modsec__grid" style="list-style:none;margin:0;padding:0">${cards}</ul>` +
    `</div></section>`
  );
}

/**
 * "Írjon véleményt" — the collection form (ADR-0046).
 *
 * WHY IT IS A PLAIN FORM POST and not a hydrated widget: it must work without JS,
 * like the newsletter block, and a guest typing on a phone should not depend on a
 * script having loaded.
 *
 * WHY IT LIVES HERE AND NOT IN THE 16 REVIEW SECTIONS: those only render when
 * reviews already exist, so a tenant switching the module on would have nowhere to
 * receive the FIRST one — the form would appear only once it was no longer needed.
 */
function reviewFormBlock(d: SiteData): string {
  const f = d.reviewForm;
  if (!f) return "";
  const units = f.units ?? [];
  const unitPicker = units.length
    ? `<label class="cit-rev-f__lbl">${T(d, "Melyik egységben szállt meg?")}` +
      `<select name="unit"><option value="">${T(d, "Nem tudom / az egész szállás")}</option>` +
      units.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join("") +
      `</select></label>`
    : "";

  // A native <select> beats a custom star widget on a phone: it is the OS picker,
  // it is reachable by screen readers, and it cannot break without JS.
  const scale: [number, string][] = [
    [5, T(d, "5 — Kiváló")],
    [4, T(d, "4 — Jó")],
    [3, T(d, "3 — Megfelelő")],
    [2, T(d, "2 — Gyenge")],
    [1, T(d, "1 — Rossz")],
  ];

  return (
    `<section class="cit-modsec" data-cit-module="review-form">` +
    `<div class="cit-modsec__in">` +
    `<h2>${T(d, "Járt már nálunk? Írja meg, milyen volt")}</h2>` +
    `<form class="cit-rev-f" method="POST" action="/api/velemeny">` +
    `<label class="cit-rev-f__lbl">${T(d, "Az Ön neve")}` +
    `<input type="text" name="name" required maxlength="160"></label>` +
    `<label class="cit-rev-f__lbl">${T(d, "Értékelés")}` +
    `<select name="rating" required>` +
    scale.map(([v, l]) => `<option value="${v}">${l}</option>`).join("") +
    `</select></label>` +
    unitPicker +
    `<label class="cit-rev-f__lbl cit-rev-f__wide">${T(d, "Az élménye")}` +
    `<textarea name="body" required rows="4" maxlength="2000"></textarea></label>` +
    `<label class="cit-rev-f__lbl">${T(d, "E-mail cím (nem jelenik meg)")}` +
    `<input type="email" name="email" maxlength="200"></label>` +
    `<div class="cit-rev-f__wide">` +
    `<button class="cit-btn" type="submit">${T(d, "Vélemény elküldése")}</button>` +
    `<p class="cit-modsec__note">${T(d, "A véleménye azután jelenik meg, hogy a szállásadó jóváhagyta.")}</p>` +
    `</div></form></div></section>`
  );
}

/**
 * The Google rating as a NUMBER, with the click going to Google's own reviews
 * (ADR-0046). The texts are NOT copied: Places content may not be stored, and
 * fetching it per view costs more than the module sells for. The link doubles as
 * the attribution the policy requires.
 *
 * Only renders when the data layer already applied both gates (match confidence +
 * freshness) — a badge is a factual claim about this business (§B.17).
 */
function googleRatingBlock(d: SiteData): string {
  const g = d.googleRating;
  if (!g) return "";
  const value = g.value.toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    `<section class="cit-modsec" data-cit-module="google-rating">` +
    `<div class="cit-modsec__in">` +
    `<a class="cit-grat" href="${esc(g.url)}" target="_blank" rel="noopener nofollow">` +
    `<span class="cit-grat__icon">${ICON_STAR}</span>` +
    `<span class="cit-grat__num">${esc(value)}</span>` +
    `<span class="cit-grat__meta">${T(d, "{count} Google-értékelés", { count: g.count })}` +
    `<em>${T(d, "Megnézem a Google-on")}</em></span>` +
    `</a></div></section>`
  );
}

/**
 * WHERE a module block belongs on the page (ADR-0047).
 *
 * Until now every block was concatenated into ONE lump dropped in front of the
 * enquiry slot. Measured consequence: on `editorial` the enquiry slot sits near the
 * TOP (it is the coupon), so ten modules landed ahead of the gallery and the
 * reviews — the template's composition broken by a uniform grey list, live pages
 * included. A paid module has to look like part of the site, not an appendix.
 *
 * FOUR slots, not one per module. Ten slots would mean ten decisions per template
 * (160 in total, and the 17th template silently wrong); four MEANINGFUL groups is
 * one line each per template and still puts every block somewhere sensible.
 */
export type ModuleSlot = "showcase" | "trust" | "practical" | "closing";

export const MODULE_SLOTS: readonly ModuleSlot[] = ["showcase", "trust", "practical", "closing"];

/** The marker a template plants where a slot's blocks should be rendered. */
export function slotMarker(slot: ModuleSlot): string {
  return `<div data-cit-slot="${slot}"></div>`;
}

/**
 * Module blocks grouped by slot. Empty groups are omitted, so a template with
 * nothing to place in a slot renders byte-identically to before.
 */
/**
 * The honest stand-in where guest reviews will go (ADR-0048).
 *
 * WHAT THIS REPLACES: the engine used to fill an empty review section with
 * SAMPLE_REVIEWS — three invented quotes attributed to "Péter" and "a Kovács
 * család", on a REAL business's page, directly under that business's REAL Google
 * average. The combination read as "three of those 143 reviews". The sample marker
 * existed but sat ~1200 characters below, off-screen at the moment of reading.
 *
 * Invented praise about a named business is not a placeholder, it is a false claim
 * (§B.17). What replaces it is stronger anyway: the owner's ACTUAL Google rating,
 * plus a plain sentence about what the section will hold.
 */
function reviewsPendingBlock(d: SiteData): string {
  if (d.reviews?.length) return ""; // real words — nothing to stand in for
  // Either source is the SAME real Google number: `googleRating` on a live tenant
  // page (gated on match confidence + freshness), `rating` on a mock built from the
  // lead. Both are facts about this business; neither is invented.
  const g = d.googleRating ?? (d.rating?.count ? { value: d.rating.value, count: d.rating.count } : null);
  const value = g
    ? g.value.toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "";
  // Show the real average as a DESIGNED badge (a star row + number), not a muted
  // sentence that reads as a restatement of the hero stat — that "the rating twice"
  // look is the exact complaint (2026-08-23). Skipped when the google-rating module
  // already renders its own badge right above, so the number is never stated twice.
  const badge =
    g && !d.googleRating
      ? `<div class="cit-grat cit-grat--static">` +
        `<span class="cit-grat__icon">${ICON_STAR}</span>` +
        `<span class="cit-grat__num">${esc(value)}</span>` +
        `<span class="cit-grat__meta">${T(d, "{count} Google-értékelés", { count: g.count })}</span>` +
        `</div>`
      : "";
  // Stable anchor so a template's "Vélemények" nav link always has a target here (the
  // real-reviews section carries the same id; the two are mutually exclusive).
  return (
    `<section class="cit-modsec" id="t-reviews" data-cit-module="reviews-pending">` +
    `<div class="cit-modsec__in">` +
    `<h2>${T(d, "Vendégek véleménye")}</h2>` +
    (badge ? `<div class="cit-modsec__badge">${badge}</div>` : "") +
    `<p class="cit-modsec__note" style="margin:0">` +
    `${T(d, "Az oldalon leadott véleményeket Ön hagyja jóvá, és itt jelennek meg — így csak valódi vendégek szava kerül ki.")}</p>` +
    `</div></section>`
  );
}

export function moduleSectionGroups(
  d: SiteData,
  opts: { roomsAlreadyShown?: boolean; sellingLeftover?: readonly string[] } = {},
): { css: string; groups: Partial<Record<ModuleSlot, string>> } {
  const bySlot: Record<ModuleSlot, string[]> = {
    // What the guest is buying: the rooms, what they cost, what is included.
    // ADR-0059 §1: the usp/amenities DATA is woven into the template's native
    // selling-points section before render (render.ts weave); the shared block here
    // renders ONLY the measured leftover — the items the template's own section did
    // not fit. One merged block, never a second section of the same content type.
    showcase: [
      opts.roomsAlreadyShown ? "" : roomsBlock(d),
      listBlock(d, "amenities", T(d, "Amit kínálunk"), opts.sellingLeftover ?? [], ICON_CHECK),
      pricingBlock(d),
    ],
    // Why they should believe it — next to the template's own review section.
    trust: [googleRatingBlock(d), reviewsPendingBlock(d), reviewFormBlock(d)],
    // Practicalities they check before deciding.
    practical: [hoursBlock(d), locationBlock(d), listBlock(d, "poi", T(d, "A környéken"), d.poi ?? [], ICON_PIN)],
    // After the decision.
    closing: [newsletterBlock(d)],
  };

  const groups: Partial<Record<ModuleSlot, string>> = {};
  let any = false;
  for (const slot of MODULE_SLOTS) {
    const html = bySlot[slot].filter(Boolean).join("");
    if (html) {
      groups[slot] = html;
      any = true;
    }
  }
  return { css: any ? CSS : "", groups };
}

/**
 * All blocks as one lump — the FALLBACK for a template that plants no slot markers.
 * Kept so an un-migrated template still shows everything the tenant paid for; the
 * slot-coverage guard is what stops this from quietly becoming the normal path.
 */
export function moduleSections(d: SiteData, opts: { roomsAlreadyShown?: boolean } = {}): string {
  const { css, groups } = moduleSectionGroups(d, opts);
  const all = MODULE_SLOTS.map((s) => groups[s] ?? "").join("");
  return all ? css + all : "";
}
