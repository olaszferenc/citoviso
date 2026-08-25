// Per-module settings UI for the tenant admin (ADR-0044).
//
// This is the screen the whole config layer exists for: the owner who PAID for a
// module gets to set it. Two renderers:
//   · a generic form driven by MODULE_CONFIG_REGISTRY fields — covers most modules;
//   · a bespoke editor where a form cannot express the job (the booking calendar).
//
// ERGONOMICS — the target owner has no digital footprint in 2026, and uses this on
// a phone (~390px). The rules applied here:
//   · one screen = one module. No endless settings page.
//   · the calendar is plain checkbox+label, so a tap fills the day INSTANTLY with
//     zero JavaScript. No spinner, no "saving…", no way to be left uncertain.
//   · imported (portal) days are visibly different and not tappable — the owner is
//     never invited to "free up" a day the portal considers sold.
//   · jargon is banned: "Mikor van tele?", never "availability"; the word iCal
//     never appears — the owner sees "Booking.com összekötése".
//   · every screen states what happens next in plain terms.
//
// Colours/typography come only from the design core (--citui-*), per ADR-0021 ①.

import {
  MODULE_CONFIG_REGISTRY,
  type ModuleConfigValues,
  type ModuleField,
} from "../moduleConfig.js";
import { MODULE_CATALOG } from "../modules.js";
import type { MonthView } from "../tenant/availability.js";
import type { PhotoEdit } from "../tenant/editor.js";
import { ic } from "../ui/icons.js";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Styles for the settings screens; loaded only on this tab. */
export const MODCFG_STYLE = `<style>
.mcfg-back{display:inline-flex;align-items:center;gap:6px;color:var(--citui-muted);
  text-decoration:none;font-size:.92rem;margin-bottom:12px}
.mcfg-back:hover{color:var(--citui-ink)}
.mcfg-price{font-size:.82rem;color:var(--citui-muted)}
.mcfg-note{background:var(--citui-surface-2);border:1px solid var(--citui-line);
  border-radius:var(--citui-radius-sm);padding:12px 14px;color:var(--citui-muted);
  font-size:.92rem;margin:0 0 18px}
.mcfg-err{background:color-mix(in srgb,var(--citui-bad) 10%,transparent);
  border:1px solid color-mix(in srgb,var(--citui-bad) 40%,transparent);
  border-radius:var(--citui-radius-sm);padding:12px 14px;margin:0 0 18px}
.mcfg-err ul{margin:0;padding-left:18px}
.mcfg-sub{font-family:var(--citui-font-display);font-size:1.02rem;margin:26px 0 10px}
.mcfg-sub:first-child{margin-top:0}
.mcfg-row{display:flex;align-items:center;justify-content:space-between;gap:14px;
  padding:12px 0;border-bottom:1px solid var(--citui-line)}
.mcfg-row:last-child{border-bottom:0}
.mcfg-row__txt strong{display:block;font-weight:600}
.mcfg-row__txt span{display:block;color:var(--citui-muted);font-size:.86rem;margin-top:2px}
.mcfg-suffix{display:flex;align-items:center;gap:8px}
.mcfg-suffix .citui-input{max-width:110px}
.mcfg-suffix>span{color:var(--citui-muted);font-size:.9rem}

/* ── calendar ─────────────────────────────────────────────────────── */
.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cal-head a{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;
  border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);
  text-decoration:none;color:var(--citui-ink);font-size:1.1rem}
.cal-head b{font-family:var(--citui-font-display);font-size:1.05rem}
.cal-dow,.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.cal-dow span{text-align:center;font-size:.74rem;color:var(--citui-muted);padding-bottom:4px}
.cal-cell{position:relative}
.cal-cell input{position:absolute;opacity:0;width:0;height:0}
.cal-cell label{display:flex;align-items:center;justify-content:center;
  aspect-ratio:1/1;min-height:42px;border:1px solid var(--citui-line);
  border-radius:var(--citui-radius-sm);cursor:pointer;font-size:.95rem;
  transition:var(--citui-transition);background:var(--citui-surface)}
.cal-cell label:hover{border-color:var(--citui-line-strong)}
/* Tapped = full — instant, no JS, no round trip. */
.cal-cell input:checked+label{background:var(--citui-navy-800);color:var(--citui-white);
  border-color:var(--citui-navy-800);font-weight:600}
.cal-cell input:focus-visible+label{outline:2px solid var(--citui-cyan-400);outline-offset:2px}
.cal-cell--blank{visibility:hidden}
.cal-cell--past label{color:var(--citui-muted);background:var(--citui-surface-2);
  cursor:default;opacity:.5}
/* Portal-owned: striped, clearly not the owner's to change here. */
.cal-cell--locked label{cursor:not-allowed;color:var(--citui-ink);
  border-color:var(--citui-line-strong);
  background:repeating-linear-gradient(135deg,var(--citui-surface-2),
    var(--citui-surface-2) 5px,color-mix(in srgb,var(--citui-navy-800) 16%,transparent) 5px,
    color-mix(in srgb,var(--citui-navy-800) 16%,transparent) 10px)}
.cal-legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:14px;font-size:.85rem;
  color:var(--citui-muted)}
.cal-legend i{display:inline-block;width:16px;height:16px;border-radius:4px;
  border:1px solid var(--citui-line);vertical-align:-3px;margin-right:6px}
.cal-legend i.is-full{background:var(--citui-navy-800);border-color:var(--citui-navy-800)}
.cal-legend i.is-portal{background:repeating-linear-gradient(135deg,var(--citui-surface-2),
  var(--citui-surface-2) 4px,color-mix(in srgb,var(--citui-navy-800) 16%,transparent) 4px,
  color-mix(in srgb,var(--citui-navy-800) 16%,transparent) 8px)}
/* Deliberately NOT sticky. A sticky bar collides with the fixed mobile nav bar
   (measured: it buried 65px of the save button), and sticky cannot lift itself
   above the end of its own containing block anyway. The rest of the admin ends
   its cards with a plain button and .adm-main__inner already reserves 96px at
   the bottom for the nav — so the boring version is the reliable one. */
.cal-save{background:var(--citui-surface);padding:14px 0 4px;
  margin-top:16px;border-top:1px solid var(--citui-line);display:flex;
  align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}

/* ── portal links ─────────────────────────────────────────────────── */
.plink{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--citui-line);
  border-radius:var(--citui-radius-sm);margin-bottom:10px}
.plink__txt{flex:1}
.plink__txt strong{display:block}
.plink__txt span{color:var(--citui-muted);font-size:.85rem}
.plink--ok{border-color:color-mix(in srgb,var(--citui-ok) 45%,transparent);
  background:color-mix(in srgb,var(--citui-ok) 7%,transparent)}
.plink--bad{border-color:color-mix(in srgb,var(--citui-warn) 50%,transparent);
  background:color-mix(in srgb,var(--citui-warn) 8%,transparent)}

/* ── unit switcher: only rendered when there really is more than one ─ */
.unit-switch{margin:0 0 18px}
.unit-switch__lbl{display:block;font-size:.82rem;color:var(--citui-muted);margin-bottom:6px}
.unit-switch__tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.unit-switch__tabs a{flex:0 0 auto;padding:10px 16px;border:1px solid var(--citui-line);
  border-radius:var(--citui-radius-pill);text-decoration:none;color:var(--citui-ink);
  font-size:.9rem;background:var(--citui-surface);white-space:nowrap}
.unit-switch__tabs a.is-active{background:var(--citui-navy-800);color:var(--citui-white);
  border-color:var(--citui-navy-800);font-weight:600}

/* ── photo cards: order + caption (ADR-0044) ────────────────────────── */
.adm-photo{position:relative;border:1px solid var(--citui-line);border-radius:10px;
  padding:6px;background:var(--citui-surface)}
.adm-photo.is-cover{border-color:var(--citui-cyan-500);
  box-shadow:0 0 0 2px color-mix(in srgb,var(--citui-cyan-500) 22%,transparent)}
.adm-photo img{width:100%;height:92px;object-fit:cover;border-radius:6px;display:block}
.adm-photo__badge{position:absolute;top:10px;left:10px;background:var(--citui-navy-800);
  color:var(--citui-white);font-size:.68rem;font-weight:600;padding:2px 7px;border-radius:999px}
.adm-photo__del{position:absolute;top:10px;right:10px;margin:0}
.adm-photo__bar{display:flex;gap:4px;margin-top:6px}
/* Each button sits in its own <form>, so the FORM is the flex child — putting
   flex:1 only on the button left thumb-sized taps on a phone. */
.adm-photo__bar form{flex:1;display:flex;margin:0}
/* 44px is the accepted minimum tap target; measured at 38px before this. */
.adm-photo-btn{flex:1;font:inherit;font-size:.95rem;line-height:1;padding:9px 0;cursor:pointer;
  min-height:44px;
  color:var(--citui-ink);background:var(--citui-surface-2);border:1px solid var(--citui-line);
  border-radius:6px}
.adm-photo-btn:hover{border-color:var(--citui-line-strong)}
.adm-photo__cap{display:flex;gap:5px;margin-top:6px}
.adm-photo__cap .citui-input{flex:1;min-width:0;padding:7px 9px;font-size:.85rem}
.adm-photo__cap .citui-btn{padding:7px 10px;font-size:.8rem;white-space:nowrap}
/* The caption is now a real control, so the thumbnail grid must give it room.
   Measured at 390px: the auto-fill grid left ~150px per card, which truncated the
   field to "Kert a h" — unreadable and unusable. One column below 560px trades a
   little thumbnail density for a caption the owner can actually read while typing. */
@media(max-width:560px){
  .adm-gallery{grid-template-columns:1fr}
  .adm-photo img{height:150px}
}

.adm-photo__units{margin-top:6px;padding-top:6px;border-top:1px solid var(--citui-line);
  display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}
.adm-photo__units-lbl{width:100%;font-size:.76rem;color:var(--citui-muted);font-weight:600}
.adm-photo__units label{display:inline-flex;align-items:center;gap:5px;font-size:.86rem;
  min-height:32px}
.adm-photo__units .citui-btn{padding:6px 10px;font-size:.8rem}

/* ── unit rows ──────────────────────────────────────────────────────── */
.unit-row{display:flex;align-items:center;gap:10px;padding:12px 0;
  border-bottom:1px solid var(--citui-line);flex-wrap:wrap}
.unit-row--new{border-bottom:0;padding-top:16px}
.unit-row__name{flex:1;min-width:160px}
.unit-row__cap{width:90px}
.unit-row__del{color:var(--citui-bad);border-color:color-mix(in srgb,var(--citui-bad) 35%,transparent)}

/* ── prices, one card per unit ───────────────────────────────────────── */
.price-row{display:flex;align-items:center;gap:12px;padding:11px 0;
  border-bottom:1px solid var(--citui-line);flex-wrap:wrap}
.price-row__txt{flex:1;min-width:150px}
.price-row__txt strong{display:block}
.price-row__txt span{color:var(--citui-muted);font-size:.85rem}
.price-row__amt{font-weight:600;white-space:nowrap}
.price-new{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:14px}
.price-new .citui-input{min-width:0}
.price-new>.citui-input{flex:1;min-width:140px}
.price-new__dates{display:flex;align-items:center;gap:6px}
.price-new__dates .citui-input{width:88px;text-align:center}
@media(max-width:520px){
  .price-new{flex-direction:column;align-items:stretch}
  .price-new__dates .citui-input{flex:1;width:auto}
  .price-new .citui-btn{width:100%}
  .price-row__amt{margin-left:auto}
}

/* ── booking requests inbox ─────────────────────────────────────────── */
.breq{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;
  padding:14px 0;border-bottom:1px solid var(--citui-line);flex-wrap:wrap}
.breq:last-child{border-bottom:0}
.breq__who{flex:1;min-width:180px}
.breq__who strong{display:block;font-size:1.02rem}
.breq__who span{display:block;color:var(--citui-muted);font-size:.88rem;margin-top:2px}
.breq__msg{font-style:italic}
.breq__act form{display:flex;gap:8px;flex-wrap:wrap}
/* ── module list row: switch + a separate "settings" affordance ───── */
.adm-modrow{display:flex;align-items:center;gap:8px}
.adm-modrow .adm-mod{flex:1;min-width:0}
.adm-mod__cfg{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;
  padding:8px 12px;border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);
  text-decoration:none;color:var(--citui-ink);font-size:.86rem;white-space:nowrap}
.adm-mod__cfg:hover{border-color:var(--citui-line-strong);background:var(--citui-surface-2)}
/* Replaced module (booking took over enquiry's slot): visibly inactive but still
   listed, with the reason — hiding it would read as "my module disappeared". */
.adm-modrow.is-replaced{opacity:.62}
.adm-chip--off{background:var(--citui-surface-2);color:var(--citui-muted)}
/* KB help row (ADR-0045 §J): textual entry into the guide for THIS screen */
.mcfg-help{margin:2px 0 14px}
.mcfg-help a{display:inline-flex;align-items:center;gap:7px;color:var(--citui-ink);text-decoration:none;
  font-size:.88rem;border:1px solid var(--citui-line);border-radius:var(--citui-radius-pill);padding:7px 14px}
.mcfg-help a:hover{border-color:var(--citui-cyan-500)}
@media(max-width:520px){
  .mcfg-row{flex-direction:column;align-items:stretch}
  .mcfg-suffix .citui-input{max-width:none}
  .adm-mod__cfg span{display:none}
  .adm-mod__cfg{padding:8px 10px}
  .cal-save{flex-direction:column;align-items:stretch;gap:8px}
  .cal-save .citui-btn{width:100%}
  .unit-row{flex-direction:column;align-items:stretch}
  .unit-row__cap{width:100%}
  .breq__act,.breq__act form{width:100%}
  .breq__act .citui-btn{flex:1}
}
</style>`;

const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;

/** ADR-0045 §J: contextual guide link for a module settings screen. Textual on purpose
 *  (the IT-novice owner reads words, not icons); the data-kb-anchor is the coverage
 *  hook — a screen carrying it MUST have a KB entry (kb-check --coverage). */
function helpLink(anchor: string): string {
  return (
    `<p class="mcfg-help"><a data-kb-anchor="${anchor}" ` +
    `href="/admin?tab=sugo&topic=${encodeURIComponent(anchor)}">${ic("help", 16)}` +
    `<span>Útmutató ehhez a képernyőhöz</span></a></p>`
  );
}

/**
 * Portal calendar sync (Booking.com/Airbnb) is BUILT and tested, but OUT OF SCOPE
 * for the pilot (tulaj, 2026-08-21): the engine only had to be *compatible* with a
 * portal API, not ship an integration we then have to support. So the UI stays dark
 * — offering "Booking.com összekötése" would promise something we do not stand
 * behind yet, and a half-supported sync is worse than none for this segment.
 * The layer keeps running (src/booking/sync.ts, ical.ts) and is covered by its own
 * checks; flipping this to true is all that is needed when it becomes scope.
 */
export const PORTAL_SYNC_UI = false;

/** One declarative field → an input the owner understands. */
function renderField(f: ModuleField, value: unknown): string {
  const id = `cfg_${f.key}`;
  const v = value ?? "";
  const label = `<label class="citui-label" for="${id}">${esc(f.label)}</label>`;
  const help = f.help ? `<p class="citui-hint" style="margin:6px 0 0">${esc(f.help)}</p>` : "";
  const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";

  if (f.type === "toggle") {
    return (
      `<div class="mcfg-row"><span class="mcfg-row__txt"><strong>${esc(f.label)}</strong>` +
      (f.help ? `<span>${esc(f.help)}</span>` : "") +
      `</span>` +
      `<span class="adm-switch"><input type="checkbox" id="${id}" name="${esc(f.key)}" value="1"` +
      `${v ? " checked" : ""} aria-label="${esc(f.label)}"><span class="tr"></span><span class="th"></span></span>` +
      `</div>`
    );
  }
  if (f.type === "select") {
    const opts = (f.options ?? [])
      .map(
        (o) =>
          `<option value="${esc(o.value)}"${String(v) === o.value ? " selected" : ""}>${esc(o.label)}</option>`,
      )
      .join("");
    return `<div class="citui-field">${label}<select class="citui-input" id="${id}" name="${esc(f.key)}">${opts}</select>${help}</div>`;
  }
  if (f.type === "textarea") {
    return `<div class="citui-field">${label}<textarea class="citui-textarea" id="${id}" name="${esc(f.key)}" style="min-height:120px"${ph}>${esc(v)}</textarea>${help}</div>`;
  }
  if (f.type === "lines") {
    const text = Array.isArray(v) ? v.join("\n") : String(v);
    return `<div class="citui-field">${label}<textarea class="citui-textarea" id="${id}" name="${esc(f.key)}" style="min-height:130px"${ph}>${esc(text)}</textarea>${help}</div>`;
  }
  if (f.type === "number") {
    const attrs =
      (f.min === undefined ? "" : ` min="${f.min}"`) + (f.max === undefined ? "" : ` max="${f.max}"`);
    // inputmode=numeric brings up the number pad on a phone without the desktop spinner quirks.
    return (
      `<div class="citui-field">${label}<span class="mcfg-suffix">` +
      `<input class="citui-input" id="${id}" name="${esc(f.key)}" type="number" inputmode="numeric"${attrs} value="${esc(v)}">` +
      (f.suffix ? `<span>${esc(f.suffix)}</span>` : "") +
      `</span>${help}</div>`
    );
  }
  const type = f.type === "email" ? "email" : f.type === "time" ? "time" : "text";
  return `<div class="citui-field">${label}<input class="citui-input" id="${id}" name="${esc(f.key)}" type="${type}"${ph} value="${esc(v)}">${help}</div>`;
}

/** The Monday-first month grid. Checkbox+label = instant tap feedback, zero JS. */
function calendar(mv: MonthView, moduleId: string, unitId: string): string {
  const dow = ["H", "K", "Sz", "Cs", "P", "Sz", "V"]
    .map((d) => `<span>${d}</span>`)
    .join("");
  const blanks = Array.from(
    { length: mv.leadingBlanks },
    () => `<div class="cal-cell cal-cell--blank"></div>`,
  ).join("");
  const cells = mv.cells
    .map((c) => {
      const id = `d_${c.day}`;
      if (!c.editable) {
        const cls = c.past ? "cal-cell--past" : "cal-cell--locked";
        const title = c.past
          ? "Elmúlt nap"
          : c.source === "ical"
            ? "A portálról érkezett — ott tudja módosítani"
            : "Elfogadott foglalás";
        return (
          `<div class="cal-cell ${cls}" title="${esc(title)}">` +
          `<label aria-label="${esc(title)}">${c.dom}</label></div>`
        );
      }
      return (
        `<div class="cal-cell">` +
        `<input type="checkbox" id="${id}" name="day" value="${esc(c.day)}"${c.blocked ? " checked" : ""}>` +
        `<label for="${id}">${c.dom}</label></div>`
      );
    })
    .join("");

  const navBase =
    `/admin?tab=modulok&m=${encodeURIComponent(moduleId)}&e=${encodeURIComponent(unitId)}`;
  return (
    `<div class="cal-head">` +
    `<a href="${navBase}&ho=${mv.prevMonth}" aria-label="Előző hónap">‹</a>` +
    `<b>${esc(mv.label)}</b>` +
    `<a href="${navBase}&ho=${mv.nextMonth}" aria-label="Következő hónap">›</a>` +
    `</div>` +
    `<div class="cal-dow">${dow}</div>` +
    `<div class="cal-grid">${blanks}${cells}</div>` +
    `<div class="cal-legend">` +
    `<span><i></i>Szabad</span>` +
    `<span><i class="is-full"></i>Tele van</span>` +
    (mv.importedCount > 0 ? `<span><i class="is-portal"></i>Portálról érkezett</span>` : "") +
    `</div>`
  );
}

export interface EditorUnit {
  readonly id: string;
  readonly name: string;
  readonly capacity: number | null;
  readonly description: string | null;
  readonly slug?: string | null;
  readonly amenities?: string[];
  /** How many photos the owner has assigned to this unit (drives the subpage note). */
  readonly photoCount?: number;
  /** URLs assigned to THIS unit — the picker's checked state. */
  readonly photoUrls?: readonly string[];
  /** "Csak a felsorolt időszakokban adom ki" (ADR-0049). */
  readonly seasonalOnly?: boolean;
}

/**
 * Per-unit content: description + its own amenities. This is what turns a unit from
 * a line in a list into something worth its own page — and the note underneath says
 * plainly whether the page will exist, because an owner should not have to guess why
 * their apartment has no address.
 */

/**
 * Photo picker ON THE ROOM CARD (owner decree 2026-08-25, approved plan "B").
 *
 * Before this, giving a room a picture meant leaving the room editor for the Fotók
 * tab and assigning from the photo's side — the owner was editing a room and could
 * not do the one thing the room card kept asking for ("0 hozzárendelt fotó").
 *
 * Shape (the frozen plan, assets/design-refs/tenant-admin/room-photo-picker.html):
 * the already-picked thumbnails + a "Képek választása" button that opens the full
 * library as a checkbox grid. <details> so it works with ZERO JavaScript — the same
 * rule as the availability calendar. The checkboxes live in the card's own form, so
 * one Mentés saves text and pictures together.
 *
 * The library is SHARED: a photo may belong to several rooms, and uploading stays on
 * the Fotók tab (one upload, many assignments).
 */
function photoPicker(u: EditorUnit, library: readonly PhotoEdit[]): string {
  if (!library.length) {
    return (
      `<p class="citui-hint" style="margin:0 0 14px">Még nincs feltöltött kép. ` +
      `A <strong>Fotók</strong> fülön tölthet fel, utána itt rendelheti a szobákhoz.</p>`
    );
  }
  const picked = new Set(u.photoUrls ?? []);
  const minis = library
    .filter((p) => picked.has(p.url))
    .slice(0, 8)
    .map(
      (p) =>
        `<img class="mcfg-pf__mini" src="${esc(p.url)}" alt="${esc(p.alt ?? "")}" loading="lazy">`,
    )
    .join("");
  const cells = library
    .map((p) => {
      const on = picked.has(p.url);
      return (
        `<label class="mcfg-pf__cell${on ? " is-on" : ""}">` +
        `<input type="checkbox" name="photo" value="${esc(p.url)}"${on ? " checked" : ""}>` +
        `<img src="${esc(p.url)}" alt="${esc(p.alt ?? "")}" loading="lazy">` +
        // The gallery's DEFAULT alt is "<szállás> — 3. kép": identical on every
        // tile, so it labels nothing. Only the owner's own caption is shown.
        (p.alt && !/—\s*\d+\.\s*kép\s*$/.test(p.alt) ? `<span>${esc(p.alt)}</span>` : "") +
        `</label>`
      );
    })
    .join("");
  return (
    `<div class="citui-field">` +
    `<label class="citui-label">Képek ehhez az egységhez</label>` +
    // Marker: distinguishes "never opened the picker" from "opened and cleared it",
    // so a save cannot silently wipe an assignment the owner did not touch.
    `<input type="hidden" name="photos_touched" value="1">` +
    `<div class="mcfg-pf__sel">${minis}` +
    `<span class="citui-hint" style="margin:0">${picked.size} kiválasztva</span></div>` +
    `<details class="mcfg-pf"><summary><span class="citui-btn citui-btn--ghost citui-btn--sm">` +
    `Képek választása</span></summary>` +
    `<div class="mcfg-pf__grid">${cells}</div>` +
    `<p class="citui-hint" style="margin:8px 0 0">Pipálja ki, melyik kép tartozik ehhez az egységhez. ` +
    `Új képet a <strong>Fotók</strong> fülön tölthet fel — egy kép több szobához is tartozhat.</p>` +
    `</details></div>`
  );
}

function unitContentCards(units: EditorUnit[], library: readonly PhotoEdit[] = []): string {
  if (units.length < 2) return "";
  return units
    .map((u) => {
      const photos = u.photoCount ?? 0;
      const hasText = Boolean(u.description?.trim()) || (u.amenities?.length ?? 0) > 0;
      const ready = photos > 0 && hasText;
      const status = ready
        ? `<p class="mcfg-note" style="margin:14px 0 0">Saját oldala: <code>/apartman/${esc(u.slug ?? "")}</code> — ` +
          `a keresők külön is megtalálják.</p>`
        : `<p class="mcfg-note" style="margin:14px 0 0">Ennek az egységnek még nincs saját oldala. ` +
          `Ahhoz kell legalább <strong>egy hozzárendelt fotó</strong> (itt lent, a ` +
          `„Képek választása” gombbal) és ` +
          `<strong>leírás vagy felszereltség</strong>. Üres oldallal többet ártanánk, mint használnánk.</p>`;
      return (
        `<form method="POST" action="/admin/units/content" class="adm-card">` +
        `<input type="hidden" name="id" value="${esc(u.id)}">` +
        `<div class="adm-card__head"><span class="adm-ico">${ic("texts")}</span><h2>${esc(u.name)}</h2></div>` +
        `<div class="citui-field"><label class="citui-label" for="d_${esc(u.id)}">Leírás</label>` +
        `<textarea class="citui-textarea" id="d_${esc(u.id)}" name="description" style="min-height:110px" ` +
        `placeholder="Mi jellemzi ezt a szobát? Mit szeretnek benne a vendégek?">${esc(u.description ?? "")}</textarea></div>` +
        `<div class="citui-field"><label class="citui-label" for="a_${esc(u.id)}">Ebben az egységben van</label>` +
        `<textarea class="citui-textarea" id="a_${esc(u.id)}" name="amenities" style="min-height:100px" ` +
        `placeholder="Soronként egy&#10;Saját fürdőszoba&#10;Erkély&#10;Klíma">${esc((u.amenities ?? []).join("\n"))}</textarea>` +
        `<p class="citui-hint" style="margin:6px 0 0">Csak ami ERRE az egységre igaz. Ami az egész házra, az a „Felszereltség” modulban van.</p></div>` +
        photoPicker(u, library) +
        `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">` +
        `<button class="citui-btn citui-btn--primary" type="submit">Mentés</button>` +
        `<span class="citui-hint" style="margin:0">${photos} hozzárendelt fotó</span></div>` +
        status +
        `</form>`
      );
    })
    .join("");
}

export interface EditorRequest {
  readonly id: string;
  readonly unitName: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly guestPhone: string | null;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly guests: number;
  readonly message: string | null;
  readonly status: string;
  readonly token: string;
}

export interface BookingEditorData {
  readonly month: MonthView;
  /** Every bookable unit of the site (always at least one). */
  readonly units: EditorUnit[];
  /** The unit currently being edited. */
  readonly unitId: string;
  readonly links: {
    id: string;
    provider: string;
    direction: string;
    lastSyncAt: Date | null;
    lastError: string | null;
    lastDayCount: number | null;
  }[];
  /** Our own feed URL for THIS unit, handed to a portal (export direction). */
  readonly exportUrl: string | null;
  readonly requests: EditorRequest[];
}

function huDay(iso: string): string {
  return `${iso.slice(0, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;
}

/** Pending requests, at the very top — this is the one thing that needs an answer. */
function requestsCard(reqs: EditorRequest[], multiUnit: boolean): string {
  const pending = reqs.filter((r) => r.status === "pending");
  if (!pending.length) return "";
  const rows = pending
    .map(
      (r) =>
        `<div class="breq">` +
        `<div class="breq__who"><strong>${esc(r.guestName)}</strong>` +
        `<span>${esc(huDay(r.dateFrom))} — ${esc(huDay(r.dateTo))} · ${r.guests} fő` +
        (multiUnit ? ` · ${esc(r.unitName)}` : "") +
        `</span>` +
        (r.guestPhone ? `<span>${esc(r.guestPhone)}</span>` : "") +
        (r.message ? `<span class="breq__msg">„${esc(r.message)}"</span>` : "") +
        `</div>` +
        `<div class="breq__act">` +
        `<form method="POST" action="/admin/booking/decide">` +
        `<input type="hidden" name="token" value="${esc(r.token)}">` +
        `<button class="citui-btn citui-btn--primary" type="submit" name="verdict" value="accepted">Elfogadom</button>` +
        `<button class="citui-btn citui-btn--ghost" type="submit" name="verdict" value="declined">Nem szabad</button>` +
        `</form></div></div>`,
    )
    .join("");
  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("alert")}</span>` +
    `<h2>Válaszra vár (${pending.length})</h2></div>` +
    `<p class="adm-lead">A vendég csak azután kap visszaigazolást, hogy Ön döntött. Ugyanezt a levélben is elintézheti.</p>` +
    rows +
    `</div>`
  );
}

/** Unit switcher — rendered ONLY when there is genuinely more than one unit. */
function unitSwitcher(booking: BookingEditorData, moduleId: string): string {
  if (booking.units.length < 2) return "";
  const tabs = booking.units
    .map(
      (u) =>
        `<a href="/admin?tab=modulok&m=${encodeURIComponent(moduleId)}&e=${encodeURIComponent(u.id)}"` +
        `${u.id === booking.unitId ? ' class="is-active"' : ""}>${esc(u.name)}</a>`,
    )
    .join("");
  return (
    `<div class="unit-switch"><span class="unit-switch__lbl">Melyik egység?</span>` +
    `<div class="unit-switch__tabs">${tabs}</div></div>`
  );
}

/** Add / rename / remove the bookable units. */
function unitsCard(booking: BookingEditorData): string {
  const multi = booking.units.length > 1;
  const rows = booking.units
    .map(
      (u) =>
        `<form method="POST" action="/admin/units/save" class="unit-row">` +
        `<input type="hidden" name="id" value="${esc(u.id)}">` +
        `<input class="citui-input unit-row__name" name="name" value="${esc(u.name)}" aria-label="Egység neve">` +
        `<span class="mcfg-suffix"><input class="citui-input unit-row__cap" name="capacity" type="number" ` +
        `inputmode="numeric" min="1" max="50" value="${u.capacity ?? ""}" aria-label="Férőhely"><span>fő</span></span>` +
        `<button class="citui-btn citui-btn--ghost" type="submit">Mentés</button>` +
        (multi
          ? `<button class="citui-btn citui-btn--ghost unit-row__del" type="submit" ` +
            `formaction="/admin/units/delete">Törlés</button>`
          : "") +
        `</form>`,
    )
    .join("");

  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>Mit ad ki?</h2></div>` +
    `<p class="adm-lead">` +
    (multi
      ? "Minden egységnek külön naptára van, így külön telhet be."
      : "Ha nem egy egészet, hanem több szobát vagy apartmant ad ki, vegye fel őket külön — mindegyiknek saját naptára lesz.") +
    `</p>` +
    rows +
    `<form method="POST" action="/admin/units/save" class="unit-row unit-row--new">` +
    `<input class="citui-input unit-row__name" name="name" placeholder="Pl. Kertre néző apartman" aria-label="Új egység neve">` +
    `<span class="mcfg-suffix"><input class="citui-input unit-row__cap" name="capacity" type="number" ` +
    `inputmode="numeric" min="1" max="50" placeholder="2" aria-label="Férőhely"><span>fő</span></span>` +
    `<button class="citui-btn citui-btn--primary" type="submit">Hozzáadás</button>` +
    `</form></div>`
  );
}

/**
 * The owner's review inbox (ADR-0046). The e-mail is the primary door — this is the
 * second one, for an owner who is already logged in or wants to take something down
 * later. A published review can still be withdrawn: the page is theirs.
 */
function reviewsEditor(data: ReviewsEditorData): string {
  const stars = (n: number): string =>
    `<span class="rev-stars" aria-label="${n} csillag">${"★".repeat(n)}<span>${"★".repeat(5 - n)}</span></span>`;

  const card = (r: ReviewsEditorData["items"][number]): string => {
    const pending = r.status === "pending";
    const meta = [r.stayMonth, r.unitName].filter(Boolean).join(" · ");
    const state = pending
      ? `<span class="rev-badge rev-badge--wait">Döntésre vár</span>`
      : r.status === "published"
        ? `<span class="rev-badge rev-badge--ok">Az oldalon</span>`
        : `<span class="rev-badge">Nem került ki</span>`;
    // Both actions stay available whatever the current state: taking a published
    // review down must not require finding the original e-mail.
    const actions =
      `<form method="POST" action="/admin/review/decide" class="rev-acts">` +
      `<input type="hidden" name="id" value="${esc(r.id)}">` +
      (r.status !== "published"
        ? `<button class="citui-btn citui-btn--primary" type="submit" name="verdict" value="published">Kiteszem</button>`
        : "") +
      (r.status !== "rejected"
        ? `<button class="citui-btn citui-btn--ghost" type="submit" name="verdict" value="rejected">` +
          (r.status === "published" ? "Leveszem" : "Nem teszem ki") +
          `</button>`
        : "") +
      `</form>`;
    return (
      `<div class="rev-card${pending ? " is-wait" : ""}">` +
      `<div class="rev-card__head"><strong>${esc(r.authorName)}</strong>${stars(r.rating)}${state}</div>` +
      (meta ? `<p class="citui-hint" style="margin:2px 0 8px">${esc(meta)}</p>` : "") +
      `<p class="rev-card__body">„${esc(r.body)}"</p>` +
      actions +
      `</div>`
    );
  };

  const waiting = data.items.filter((r) => r.status === "pending");
  const rest = data.items.filter((r) => r.status !== "pending");

  const googleCard = data.google
    ? `<div class="adm-card">` +
      `<div class="adm-card__head"><span class="adm-ico">${ic("star")}</span><h2>Google-értékelés</h2></div>` +
      `<p class="adm-lead">Ez látszik most az oldalán: <strong>${data.google.value
        .toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        .replace(/</g, "")}</strong> · ${data.google.count} értékelés. ` +
      `A vendég rákattintva a Google-véleményekhez jut.</p>` +
      `<p class="citui-hint">A vélemények SZÖVEGÉT a Google feltételei miatt nem másolhatjuk át az oldalára — ` +
      `csak az átlagot és a darabszámot mutathatjuk, ezért visz a kattintás a Google-re.</p>` +
      `<p style="margin:14px 0 0"><a class="citui-btn citui-btn--ghost" href="${esc(data.google.url)}" ` +
      `target="_blank" rel="noopener">Megnézem, mit írnak a Google-on</a></p>` +
      `</div>`
    : "";

  return (
    googleCard +
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>Vendégvélemények</h2></div>` +
    (data.items.length
      ? `<p class="adm-lead">${
          waiting.length
            ? `${waiting.length} vélemény vár a döntésére.`
            : "Minden véleményről döntött."
        }</p>` +
        waiting.map(card).join("") +
        rest.map(card).join("")
      : `<p class="adm-lead">Még nem érkezett vélemény. Az oldalán van egy űrlap, ahol a vendégek írhatnak — ` +
        `amint jön egy, e-mailt kap róla, és egy koppintással eldöntheti, kikerüljön-e.</p>`) +
    `</div>`
  );
}

function bookingEditor(moduleId: string, booking: BookingEditorData): string {
  const mv = booking.month;
  const imported = booking.links.filter((l) => l.direction === "import");
  const multi = booking.units.length > 1;
  const unitName = booking.units.find((u) => u.id === booking.unitId)?.name ?? "";

  const linkCards = imported.length
    ? imported
        .map((l) => {
          const state = l.lastError
            ? `Nem sikerült frissíteni: ${l.lastError}`
            : l.lastSyncAt
              ? `Utoljára frissült: ${new Date(l.lastSyncAt).toLocaleString("hu-HU")}` +
                (l.lastDayCount !== null ? ` · ${l.lastDayCount} foglalt nap` : "")
              : "Még nem frissült";
          return (
            `<div class="plink ${l.lastError ? "plink--bad" : "plink--ok"}">` +
            `<span class="adm-ico">${ic(l.lastError ? "alert" : "check", 18)}</span>` +
            `<span class="plink__txt"><strong>${esc(l.provider)} összekötve</strong>` +
            `<span>${esc(state)}</span></span>` +
            `<button class="citui-btn citui-btn--ghost" type="submit" form="unlink_${esc(l.id)}">Leválasztás</button>` +
            `<form id="unlink_${esc(l.id)}" method="POST" action="/admin/calendar-link/delete">` +
            `<input type="hidden" name="id" value="${esc(l.id)}">` +
            `<input type="hidden" name="unit" value="${esc(booking.unitId)}"></form>` +
            `</div>`
          );
        })
        .join("")
    : `<p class="mcfg-note">Még nincs összekötve semmi. Ha máshol is hirdeti${multi ? " ezt az egységet" : " a szállását"}, kösse össze — így soha nem lesz dupla foglalás.</p>`;

  return (
    requestsCard(booking.requests, multi) +
    unitSwitcher(booking, moduleId) +

    // ① the calendar of the selected unit
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("overview")}</span>` +
    `<h2>Mikor van tele?${multi ? ` — ${esc(unitName)}` : ""}</h2></div>` +
    `<p class="adm-lead">Koppintson azokra a napokra, amikor nem tud vendéget fogadni. A sötét napokra a vendég nem tud foglalni.</p>` +
    `<form method="POST" action="/admin/availability">` +
    `<input type="hidden" name="month" value="${esc(mv.month)}">` +
    `<input type="hidden" name="unit" value="${esc(booking.unitId)}">` +
    calendar(mv, moduleId, booking.unitId) +
    `<div class="cal-save">` +
    `<span class="citui-hint" style="margin:0">Ebben a hónapban ${mv.blockedCount} nap foglalt.</span>` +
    `<button class="citui-btn citui-btn--primary" type="submit">Naptár mentése</button>` +
    `</div></form></div>` +

    // ② portal connections — dark until portal sync is in scope (PORTAL_SYNC_UI)
    (!PORTAL_SYNC_UI
      ? ""
      : `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("external")}</span><h2>Hirdeti máshol is?</h2></div>` +
    `<p class="adm-lead">Ha ${multi ? "ez az egység" : "a szállása"} fent van a Booking.com-on vagy az Airbnb-n, összekötjük a naptárakat. Amit ott lefoglalnak, itt is foglalt lesz.</p>` +
    linkCards +
    `<form method="POST" action="/admin/calendar-link">` +
    `<input type="hidden" name="unit" value="${esc(booking.unitId)}">` +
    `<div class="citui-field"><label class="citui-label" for="provider">Hol hirdeti?</label>` +
    `<select class="citui-input" id="provider" name="provider">` +
    `<option value="Booking.com">Booking.com</option>` +
    `<option value="Airbnb">Airbnb</option>` +
    `<option value="Szállás.hu">Szállás.hu</option>` +
    `<option value="Egyéb">Egyéb</option></select></div>` +
    `<div class="citui-field"><label class="citui-label" for="ical_url">A naptár linkje</label>` +
    `<input class="citui-input" id="ical_url" name="url" type="url" placeholder="https://…" required>` +
    `<p class="citui-hint" style="margin:6px 0 0">Nem tudja, hol találja? ` +
    `<a href="/admin/segitseg/naptar" target="_blank" rel="noopener">Megmutatjuk lépésről lépésre</a>.</p></div>` +
    `<button class="citui-btn citui-btn--ghost" type="submit">Összekötés</button>` +
    `</form>` +
    (booking.exportUrl
      ? `<div style="margin-top:22px;padding-top:18px;border-top:1px solid var(--citui-line)">` +
        `<h3 class="mcfg-sub" style="margin-top:0">A másik irány</h3>` +
        `<p class="citui-hint">Adja meg ezt a linket a portálnak, hogy ő is lássa az itteni foglalásait` +
        (multi ? ` ${esc(unitName)} egységnél` : "") +
        `:</p>` +
        `<input class="citui-input" readonly value="${esc(booking.exportUrl)}" onclick="this.select()">` +
        `</div>`
      : "") +
    `</div>`) +

    // ③ units
    unitsCard(booking)
  );
}

export interface EditorPrice {
  readonly id: string;
  readonly label: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly amount: number;
  readonly isBase: boolean;
  /** Minimum stay inside this period (ADR-0049); null → the module-wide minimum. */
  readonly minNights: number | null;
}

export interface PricingEditorData {
  readonly units: EditorUnit[];
  /** unit id → its price rows (base first is not required; order is the owner's). */
  readonly prices: Record<string, EditorPrice[]>;
  readonly currency: string;
}

/** "28 000" — grouped, no currency (the field shows the unit next to it). */
function grouped(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Prices, one card per unit. The owner prices a ROOM, so the screen is organised by
 * room and never asks them to think in a season × unit matrix — a grid is unusable
 * on a phone and unreadable to someone who has never met one.
 * Seasons are recurring MONTH-DAY, so a high season is entered once and holds every
 * year; making them re-enter it each January would guarantee stale prices.
 */
function pricingEditor(data: PricingEditorData): string {
  const cur = data.currency === "EUR" ? "€" : "Ft";
  const cards = data.units
    .map((u) => {
      const rows = data.prices[u.id] ?? [];
      const base = rows.find((r) => r.isBase);
      const seasons = rows.filter((r) => !r.isBase);

      const seasonRows = seasons.length
        ? seasons
            .map(
              (s) =>
                `<div class="price-row">` +
                `<span class="price-row__txt"><strong>${esc(s.label)}</strong>` +
                `<span>${esc(s.from ?? "")} – ${esc(s.to ?? "")}</span></span>` +
                `<span class="price-row__amt">${esc(grouped(s.amount))} ${esc(cur)}` +
                (s.minNights ? `<em style="display:block;font-style:normal;font-size:.8rem;color:var(--citui-muted)">min. ${s.minNights} éj</em>` : "") +
                `</span>` +
                `<form method="POST" action="/admin/prices/delete">` +
                `<input type="hidden" name="id" value="${esc(s.id)}">` +
                `<button class="citui-btn citui-btn--ghost unit-row__del" type="submit">Törlés</button>` +
                `</form></div>`,
            )
            .join("")
        : `<p class="citui-hint" style="margin:6px 0 12px">Nincs külön időszaki ár — mindig az alapár érvényes.</p>`;

      return (
        `<div class="adm-card">` +
        `<div class="adm-card__head"><span class="adm-ico">${ic("pricing")}</span>` +
        `<h2>${esc(u.name)}</h2></div>` +
        // ① base price
        `<form method="POST" action="/admin/prices/base" class="unit-row" style="border-bottom:0">` +
        `<input type="hidden" name="unit" value="${esc(u.id)}">` +
        `<label class="citui-label" style="flex:1;min-width:150px">Alapár` +
        `<span class="mcfg-suffix" style="margin-top:5px">` +
        `<input class="citui-input" name="amount" type="number" inputmode="numeric" min="0" ` +
        `value="${base ? base.amount : ""}" placeholder="0"><span>${esc(cur)}</span></span></label>` +
        `<button class="citui-btn citui-btn--ghost" type="submit">Mentés</button>` +
        `</form>` +
        `<p class="citui-hint" style="margin:0 0 18px">Ez érvényes, amikor egyik időszak sem.</p>` +
        // ② seasons
        `<h3 class="mcfg-sub">Időszaki árak</h3>` +
        seasonRows +
        `<form method="POST" action="/admin/prices/season" class="price-new">` +
        `<input type="hidden" name="unit" value="${esc(u.id)}">` +
        `<input class="citui-input" name="label" placeholder="Pl. Főszezon" aria-label="Időszak neve">` +
        `<span class="price-new__dates">` +
        `<input class="citui-input" name="from" placeholder="06-15" aria-label="Kezdet (hónap-nap)" maxlength="5">` +
        `<span>–</span>` +
        `<input class="citui-input" name="to" placeholder="08-31" aria-label="Vég (hónap-nap)" maxlength="5">` +
        `</span>` +
        `<span class="mcfg-suffix"><input class="citui-input" name="amount" type="number" ` +
        `inputmode="numeric" min="0" placeholder="0" aria-label="Ár"><span>${esc(cur)}</span></span>` +
        // ADR-0049: the period carries its own minimum stay. A fortnight in August is
        // not a February weekend, and the owner should say so where they say the price.
        `<span class="mcfg-suffix"><input class="citui-input" name="min_nights" type="number" ` +
        `inputmode="numeric" min="1" max="60" placeholder="—" aria-label="Legrövidebb foglalás ebben az időszakban">` +
        `<span>éj min.</span></span>` +
        `<button class="citui-btn citui-btn--primary" type="submit">Hozzáadás</button>` +
        `</form>` +
        `<p class="citui-hint" style="margin-top:10px">A dátumot hónap-nap alakban kérjük (06-15). ` +
        `Minden évben ugyanígy érvényes, nem kell újra megadni. A „éj min." üresen hagyva ` +
        `a foglalás-modulnál beállított általános minimum érvényes.</p>` +
        // ③ is this unit let all year, or only in the listed periods?
        `<form method="POST" action="/admin/units/seasonal" class="mcfg-row" style="margin-top:16px">` +
        `<input type="hidden" name="unit" value="${esc(u.id)}">` +
        `<span class="mcfg-row__txt"><strong>Csak a felsorolt időszakokban adom ki</strong>` +
        `<span>Bekapcsolva a többi napot a vendég nem is tudja kiválasztani. Kikapcsolva egész évben foglalható.</span></span>` +
        `<label class="adm-switch"><input type="checkbox" name="seasonal_only" value="1"` +
        `${u.seasonalOnly ? " checked" : ""} onchange="this.form.submit()" ` +
        `aria-label="Csak a felsorolt időszakokban adom ki">` +
        `<span class="tr"></span><span class="th"></span></label>` +
        `<noscript><button class="citui-btn citui-btn--ghost" type="submit">Mentés</button></noscript>` +
        `</form>` +
        `</div>`
      );
    })
    .join("");

  return (
    `<p class="mcfg-note">Az árat egységenként adja meg — a vendég is így látja majd. ` +
    (data.units.length > 1
      ? "Minden szobának/apartmannak saját ára lehet."
      : "Ha több szobát ad ki külön, előbb vegye fel őket a „Szobák, apartmanok” modulnál.") +
    `</p>` +
    cards
  );
}

export interface ModuleSettingsOpts {
  readonly values: ModuleConfigValues;
  readonly errors?: string[];
  readonly canRestore?: boolean;
  readonly booking?: BookingEditorData;
  /** Units for the rooms editor (the same site_unit rows booking uses). */
  readonly units?: EditorUnit[];
  readonly pricing?: PricingEditorData;
  readonly priceMonthly?: number;
  /** Guest reviews awaiting or past the owner's verdict (ADR-0046). */
  readonly reviews?: ReviewsEditorData;
  /** The shared photo library, so a ROOM CARD can assign pictures without
   *  sending the owner to the Fotók tab (approved plan B, 2026-08-25). */
  readonly photoLibrary?: readonly PhotoEdit[];
}

export interface ReviewsEditorData {
  readonly items: readonly {
    id: string;
    authorName: string;
    rating: number;
    body: string;
    stayMonth: string | null;
    unitName: string | null;
    status: string;
    verified: boolean;
    token: string;
  }[];
  /** The Google badge currently on the page, if any — shown so the owner can see
   *  what the visitor sees rather than having to trust the toggle. */
  readonly google?: { value: number; count: number; url: string } | null;
}

/** The settings screen for ONE module. */
export function moduleSettingsSection(moduleId: string, opts: ModuleSettingsOpts): string {
  const def = MODULE_CONFIG_REGISTRY[moduleId];
  const cat = MODULE_CATALOG.find((m) => m.id === moduleId);
  if (!def || !cat) {
    return `<div class="adm-card"><p class="citui-hint">Ez a modul nem található.</p></div>`;
  }
  const back = `<a class="mcfg-back" href="/admin?tab=modulok">‹ Vissza a modulokhoz</a>`;
  const errs = opts.errors?.length
    ? `<div class="mcfg-err"><strong>Nem tudtuk menteni:</strong><ul>` +
      opts.errors.map((e) => `<li>${esc(e)}</li>`).join("") +
      `</ul></div>`
    : "";

  const bespoke =
    def.editor === "booking" && opts.booking
      ? bookingEditor(moduleId, opts.booking)
      : def.editor === "rooms" && opts.units
        ? // The SAME units card the booking screen shows — one truth, two doors.
          `<p class="mcfg-note">Ezek jelennek meg az oldalán. Ugyanezeket az egységeket ` +
          `használja a foglalás és az árazás is, tehát elég egy helyen karbantartani.</p>` +
          unitsCard({ units: opts.units, unitId: opts.units[0]?.id ?? "" } as BookingEditorData) +
          unitContentCards(opts.units, opts.photoLibrary ?? [])
        : def.editor === "pricing" && opts.pricing
          ? pricingEditor(opts.pricing)
          : def.editor === "reviews" && opts.reviews
            ? reviewsEditor(opts.reviews)
            : "";

  // Literal anchors on purpose: the coverage gate extracts the helpLink call sites.
  const help =
    def.editor === "booking" && opts.booking
      ? helpLink("admin.modules.booking")
      : def.editor === "rooms" && opts.units
        ? helpLink("admin.modules.rooms")
        : def.editor === "pricing" && opts.pricing
          ? helpLink("admin.modules.pricing")
          : helpLink("admin.modules.settings");

  const form = def.fields.length
    ? `<form method="POST" action="/admin/module-config" class="adm-card">` +
      `<input type="hidden" name="module" value="${esc(moduleId)}">` +
      `<div class="adm-card__head"><span class="adm-ico">${ic("settings")}</span>` +
      `<h2>${bespoke ? "Szabályok" : esc(cat.publicLabel)}</h2></div>` +
      (bespoke
        ? `<p class="adm-lead">Ezeket ritkán kell módosítani — alapból működnek.</p>`
        : `<p class="adm-lead">${esc(cat.publicDesc)}</p>`) +
      def.fields.map((f) => renderField(f, opts.values[f.key])).join("") +
      `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">` +
      `<button class="citui-btn citui-btn--primary" type="submit">Beállítások mentése</button>` +
      (opts.canRestore
        ? `<button class="citui-btn citui-btn--ghost" type="submit" formaction="/admin/module-config/restore">Vissza az előzőre</button>`
        : "") +
      `</div></form>`
    : "";

  const priceNote =
    opts.priceMonthly && opts.priceMonthly > 0
      ? `<p class="mcfg-price">${esc(cat.publicLabel)} · +${esc(huf(opts.priceMonthly))}/hó</p>`
      : "";

  // An editor that is declared but not built yet is stated plainly, at the bottom,
  // rather than leaving the owner staring at a screen that seems to be missing something.
  const pendingNote =
    def.editor && !IMPLEMENTED_EDITORS.has(def.editor) && def.editorNote
      ? `<p class="mcfg-note" style="margin:18px 0 0">${esc(def.editorNote)}</p>`
      : "";

  return back + help + priceNote + errs + bespoke + form + pendingNote;
}

/**
 * What the owner sees after tapping ACCEPT / DECLINE in the notification e-mail.
 * Standalone and login-free by design: this page is the end of a one-tap flow, so
 * it says plainly what just happened and what the guest was told. Opening the link
 * twice is normal (mail clients prefetch), hence the "already decided" wording
 * instead of an error.
 */
export function bookingVerdictPage(r: {
  ok: boolean;
  outcome: string;
  guestName?: string;
  dateFrom?: string;
  dateTo?: string;
}): string {
  const who = r.guestName ? esc(r.guestName) : "a vendég";
  const when =
    r.dateFrom && r.dateTo ? `${esc(huDay(r.dateFrom))} — ${esc(huDay(r.dateTo))}` : "";

  const M: Record<string, { title: string; body: string; tone: string }> = {
    accepted: {
      title: "Elfogadva",
      body: `Visszaigazoltuk ${who} foglalását${when ? ` (${when})` : ""}, és e-mailben értesítettük. A napok mostantól foglaltak a naptárban.`,
      tone: "ok",
    },
    declined: {
      title: "Elutasítva",
      body: `Értesítettük ${who}, hogy a kért időpont${when ? ` (${when})` : ""} nem szabad. A naptár nem változott.`,
      tone: "muted",
    },
    already: {
      title: "Erről már döntött",
      body: `Ezt a kérést korábban már elintézte, nem történt újabb változás.`,
      tone: "muted",
    },
    conflict: {
      title: "Ezek a napok időközben elkeltek",
      body: `Nem tudtuk elfogadni, mert ${when ? `${when} ` : ""}időközben foglalttá vált. A vendég nem kapott visszaigazolást — kérjük, egyeztessen vele közvetlenül.`,
      tone: "bad",
    },
    unknown: {
      title: "Ez a link már nem él",
      body: `Lehet, hogy régi levélből nyitotta meg. A foglalási kéréseit az admin felületen is megtalálja.`,
      tone: "bad",
    },
  };
  const m = M[r.outcome] ?? M.unknown!;
  const color =
    m.tone === "ok" ? "var(--citui-ok)" : m.tone === "bad" ? "var(--citui-bad)" : "var(--citui-muted)";

  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<link rel="stylesheet" href="/assets/ui/citui.css">` +
    `<title>${esc(m.title)}</title></head><body>` +
    `<div class="citui-container" style="max-width:460px;padding:64px 20px;text-align:center">` +
    `<div class="citui-card">` +
    `<h1 style="font-size:1.5rem;color:${color};margin-top:0">${esc(m.title)}</h1>` +
    `<p style="font-size:1.02rem;line-height:1.7">${m.body}</p>` +
    `<p style="margin-top:26px"><a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&m=booking">Foglalások megnyitása</a></p>` +
    `</div></div></body></html>`
  );
}

/** The owner's one-tap verdict on a guest review (ADR-0046), same shape as booking. */
export function reviewVerdictPage(r: {
  ok: boolean;
  outcome: string;
  authorName?: string;
}): string {
  const who = r.authorName ? esc(r.authorName) : "a vendég";
  const M: Record<string, { title: string; body: string; tone: string }> = {
    published: {
      title: "Kikerült az oldalra",
      body: `${who} véleménye mostantól látható az oldalán. Ha megadta az e-mail címét, értesítettük róla.`,
      tone: "ok",
    },
    rejected: {
      title: "Nem tesszük ki",
      body: `${who} véleménye nem jelenik meg az oldalán. A vendég erről nem kap értesítést.`,
      tone: "muted",
    },
    already: {
      title: "Erről már döntött",
      body: `Ezt a véleményt korábban már elintézte, nem történt újabb változás.`,
      tone: "muted",
    },
    unknown: {
      title: "Ez a link már nem él",
      body: `Lehet, hogy régi levélből nyitotta meg. A véleményeket az admin felületen is megtalálja.`,
      tone: "bad",
    },
  };
  const m = M[r.outcome] ?? M.unknown!;
  const color =
    m.tone === "ok" ? "var(--citui-ok)" : m.tone === "bad" ? "var(--citui-bad)" : "var(--citui-muted)";

  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<link rel="stylesheet" href="/assets/ui/citui.css">` +
    `<title>${esc(m.title)}</title></head><body>` +
    `<div class="citui-container" style="max-width:460px;padding:64px 20px;text-align:center">` +
    `<div class="citui-card">` +
    `<h1 style="font-size:1.5rem;color:${color};margin-top:0">${esc(m.title)}</h1>` +
    `<p style="font-size:1.02rem;line-height:1.7">${m.body}</p>` +
    `<p style="margin-top:26px"><a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&m=reviews">Vélemények megnyitása</a></p>` +
    `</div></div></body></html>`
  );
}

/**
 * What the GUEST sees after submitting. Deliberately honest that a human still has
 * to approve it — a "köszönjük, megjelent!" would be a small lie, and the guest
 * would come back to look for words that are not there yet.
 */
export function reviewThanksPage(opts: { errors?: string[]; backUrl: string }): string {
  const bad = opts.errors?.length;
  const title = bad ? "Nem sikerült elküldeni" : "Köszönjük a véleményét";
  const body = bad
    ? `<ul style="text-align:left;line-height:1.8">${opts.errors!.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`
    : `<p style="font-size:1.02rem;line-height:1.7">Elküldtük a szállásadónak. A véleménye azután jelenik meg az oldalon, hogy jóváhagyta.</p>`;
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<link rel="stylesheet" href="/assets/ui/citui.css">` +
    `<title>${esc(title)}</title></head><body>` +
    `<div class="citui-container" style="max-width:460px;padding:64px 20px;text-align:center">` +
    `<div class="citui-card">` +
    `<h1 style="font-size:1.5rem;color:${bad ? "var(--citui-bad)" : "var(--citui-ok)"};margin-top:0">${esc(title)}</h1>` +
    body +
    `<p style="margin-top:26px"><a class="citui-btn citui-btn--ghost" href="${esc(opts.backUrl)}">Vissza az oldalra</a></p>` +
    `</div></div></body></html>`
  );
}

/**
 * Bespoke editors that ACTUALLY EXIST. A module may DECLARE an editor it has not
 * been given yet; counting that as "configurable" is how a guard ends up lying —
 * exactly what it is there to prevent. So availability is judged on what renders.
 */
export const IMPLEMENTED_EDITORS: ReadonlySet<string> = new Set([
  "booking",
  "rooms",
  "pricing",
  "reviews",
]);

/** Can the owner set anything on this module TODAY? (Drives the link and the lint.) */
export function hasSettingsScreen(moduleId: string): boolean {
  const def = MODULE_CONFIG_REGISTRY[moduleId];
  if (!def) return false;
  return def.fields.length > 0 || (def.editor !== undefined && IMPLEMENTED_EDITORS.has(def.editor));
}
