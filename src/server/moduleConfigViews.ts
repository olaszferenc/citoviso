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
import { T } from "../i18n/mail.js";
import {
  AMENITY_CATALOG,
  AMENITY_CATEGORIES,
  amenitySvg,
  splitAmenities,
  type AmenityItem as AmenityItem_,
} from "../tenant/amenityCatalog.js";

// ADR-0067: tenant-facing module settings — every label from the language pack.
// eslint-disable-next-line
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

/* ── calendar: COLLAPSIBLE card (owner, 2026-09-08) ───────────────── */
/* A wide screen gets the legend + save BESIDE the grid; the grid itself stops
   growing at ~500px (approved contract §3). Below that: one column, as before. */
.cal-two{display:grid;gap:16px}
@media(min-width:900px){
  .cal-two{grid-template-columns:minmax(0,500px) 1fr;align-items:start}
  .cal-two__side .cal-save{flex-direction:column;align-items:stretch;border-top:0;
    padding-top:0;margin-top:14px}
  .cal-two__side .cal-save .citui-btn{width:100%}
}
.cal-card{padding-top:6px}
.cal-sum{display:flex;align-items:center;gap:12px;padding:10px 0;cursor:pointer;list-style:none;
  min-height:44px}
.cal-sum::-webkit-details-marker{display:none}
.cal-sum .adm-ico{flex:0 0 auto}
.cal-sum__txt{flex:1;min-width:0}
.cal-sum__txt strong{display:block;font-family:var(--citui-font-display);font-size:1rem}
.cal-sum__txt span{display:block;font-size:.82rem;color:var(--citui-muted);margin-top:2px}
/* Closed, the badge still answers the question the card asks. */
.cal-sum__badge{font-size:.78rem;padding:5px 11px;border-radius:var(--citui-radius-pill);
  background:var(--citui-navy-800);color:var(--citui-white);white-space:nowrap}
.cal-sum__badge.is-free{background:var(--citui-surface-2);color:var(--citui-muted)}
.cal-sum__chev{display:inline-flex;color:var(--citui-muted);transition:var(--citui-transition)}
details[open] > .cal-sum .cal-sum__chev{transform:rotate(180deg)}

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
/* Tapped by the OWNER: solid, and re-tappable. Deliberately a lighter navy than a
   guest booking — the two used to be pixel-identical while behaving differently
   (one frees the night, the other opens a card). */
.cal-cell input:checked+label{background:var(--citui-navy-700);color:var(--citui-white);
  border-color:var(--citui-navy-700);font-weight:600}
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
.cal-legend i.is-manual{background:var(--citui-navy-700);border-color:var(--citui-navy-700)}
.cal-legend i.is-full{background:var(--citui-navy-950);border-color:var(--citui-navy-950)}
.cal-legend i.is-portal{background:repeating-linear-gradient(135deg,var(--citui-surface-2),
  var(--citui-surface-2) 4px,color-mix(in srgb,var(--citui-navy-800) 16%,transparent) 4px,
  color-mix(in srgb,var(--citui-navy-800) 16%,transparent) 8px)}

/* ── taken days: a LINK, because something stands behind them ─────── */
.cal-cell--booked a,.cal-cell--linked a,.cal-cell--portal a{display:flex;align-items:center;
  justify-content:center;aspect-ratio:1/1;min-height:42px;border:1px solid var(--citui-line);
  border-radius:var(--citui-radius-sm);font-size:.95rem;text-decoration:none;
  transition:var(--citui-transition);color:var(--citui-ink);background:var(--citui-surface)}
/* A GUEST holds it: the darkest tone + the cyan signature dot, so it reads apart
   from the owner's own block at a glance. */
.cal-cell--booked a{background:var(--citui-navy-950);color:var(--citui-white);
  border-color:var(--citui-navy-950);font-weight:600;position:relative}
.cal-cell--booked a::after{content:"";position:absolute;right:6px;bottom:6px;width:6px;height:6px;
  border-radius:50%;background:var(--citui-cyan-400)}
.cal-cell--booked a:hover{background:var(--citui-navy-900)}
/* ADR-0114: another unit holds it — visible, explainable, but not releasable here. */
.cal-cell--linked a{border-color:var(--citui-line-strong);
  background:repeating-linear-gradient(135deg,var(--citui-surface-2),var(--citui-surface-2) 5px,
    color-mix(in srgb,var(--citui-navy-800) 18%,transparent) 5px,
    color-mix(in srgb,var(--citui-navy-800) 18%,transparent) 10px)}
.cal-cell--portal a{border-color:var(--citui-line-strong);
  background:repeating-linear-gradient(45deg,var(--citui-surface-2),var(--citui-surface-2) 5px,
    color-mix(in srgb,var(--citui-cyan-500) 22%,transparent) 5px,
    color-mix(in srgb,var(--citui-cyan-500) 22%,transparent) 10px)}
.cal-cell--linked a:hover,.cal-cell--portal a:hover{border-color:var(--citui-cyan-500)}
.cal-legend i.is-linked{background:repeating-linear-gradient(135deg,var(--citui-surface-2),
  var(--citui-surface-2) 4px,color-mix(in srgb,var(--citui-navy-800) 18%,transparent) 4px,
  color-mix(in srgb,var(--citui-navy-800) 18%,transparent) 8px)}

/* ── the day's detail card: a CENTERED pop-up, as the owner asked for on
      2026-09-08 (see the approved contract in design-refs/tenant-admin/
      booking-screen). The :target selector = zero JS, so it also works when a
      script fails — same rule as the calendar cells. ─────────────────── */
.daycard{display:none}
.daycard:target{display:block}
.daycard__bg{position:fixed;inset:0;background:color-mix(in srgb,var(--citui-navy-950) 45%,transparent);
  z-index:59}
.daycard__box{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;
  width:min(440px,calc(100vw - 28px));max-height:calc(100vh - 40px);overflow:auto;
  background:var(--citui-surface);border-radius:var(--citui-radius);padding:16px;
  box-shadow:var(--citui-shadow-md)}
.daycard__head{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
.daycard__head strong{font-family:var(--citui-font-display);font-size:1.02rem;flex:1;min-width:0}
.daycard__close{text-decoration:none;color:var(--citui-muted);font-size:1.35rem;line-height:1;
  padding:0 4px;min-height:32px;display:inline-flex;align-items:center}
.daycard__tag{font-size:.72rem;padding:4px 10px;border-radius:var(--citui-radius-pill);
  white-space:nowrap;background:var(--citui-surface-2);color:var(--citui-muted);
  border:1px solid var(--citui-line-strong)}
.daycard__tag--ok{background:color-mix(in srgb,var(--citui-ok) 14%,#fff);
  color:color-mix(in srgb,var(--citui-ok) 80%,black);
  border-color:color-mix(in srgb,var(--citui-ok) 40%,transparent)}
.daycard dl{display:grid;grid-template-columns:auto 1fr;gap:7px 14px;margin:0 0 12px;font-size:.88rem}
.daycard dt{color:var(--citui-muted)}
.daycard dd{margin:0}
.daycard__note{font-size:.82rem;color:var(--citui-muted);line-height:1.5;margin:0 0 12px}
.daycard__acts{display:flex;gap:8px;flex-wrap:wrap}
.daycard__acts .citui-btn{font-size:.86rem}
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

/* ── module header: ONE block, not five scattered lines (approved 2026-09-08) ─ */
.mhead{background:var(--citui-navy-900);color:var(--citui-white);border-radius:var(--citui-radius-sm);
  padding:14px 15px;margin:0 0 14px}
.mhead__top{display:flex;align-items:center;gap:10px}
.mhead__top h2{font-family:var(--citui-font-display);font-size:1.06rem;margin:0;flex:1;min-width:0}
.mhead__ico{display:inline-flex;color:var(--citui-cyan-400)}
.mhead__price{font-size:.78rem;padding:4px 10px;border-radius:var(--citui-radius-pill);
  background:color-mix(in srgb,var(--citui-white) 16%,transparent);white-space:nowrap}
.mhead__links{display:flex;gap:14px;margin-top:9px;font-size:.82rem;flex-wrap:wrap}
.mhead__links a{color:var(--citui-white);opacity:.82;text-decoration:none}
.mhead__links a:hover{opacity:1;text-decoration:underline}

/* ── unit tabs: only rendered when there really is more than one ───── */
.unit-tabs-card{padding-bottom:0}
.unit-tabs__h{font-family:var(--citui-font-display);font-size:1rem;margin:0 0 3px}
.unit-tabs{display:flex;overflow-x:auto;border-bottom:1px solid var(--citui-line);margin-top:10px}
.unit-tabs a{flex:0 0 auto;padding:11px 14px 10px;text-decoration:none;color:var(--citui-muted);
  font-size:.92rem;white-space:nowrap;border-bottom:2.5px solid transparent;min-height:44px}
.unit-tabs a small{display:block;font-size:.72rem;color:var(--citui-muted);font-weight:400}
.unit-tabs a[aria-current="true"]{color:var(--citui-ink);font-weight:600;
  border-bottom-color:var(--citui-cyan-500)}

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
function helpLink(anchor: string, lang = "hu"): string {
  return (
    `<p class="mcfg-help"><a data-kb-anchor="${anchor}" ` +
    `href="/admin?tab=sugo&topic=${encodeURIComponent(anchor)}">${ic("help", 16)}` +
    `<span>${T(lang, "Útmutató ehhez a képernyőhöz")}</span></a></p>`
  );
}

/** The same KB anchor, worn as a plain link inside the module header block. */
function helpLinkInHead(anchor: string, lang = "hu"): string {
  return (
    `<a data-kb-anchor="${anchor}" href="/admin?tab=sugo&topic=${encodeURIComponent(anchor)}">` +
    `${T(lang, "Útmutató ehhez a képernyőhöz")}</a>`
  );
}

/**
 * MODULE HEADER — one block instead of five scattered lines.
 *
 * Owner, 2026-09-08: "az egységek és a naptár teljesen gagyi kinézetű felül". The screen
 * opened with a title, the property name, a back link, a help pill, a price line and a
 * "Melyik egység?" label, each on its own row — six starts before the first real control.
 * The approved contract (assets/design-refs/tenant-admin/booking-screen/) puts the four
 * that matter into one navy block: what this module is, what it costs, back, and help.
 */
/** A module fee in the period the account is billed in — the twin of the Modulok
 *  tab's `priceForm` (adminViews.ts). On an annual plan a bare "/hó" understates
 *  what the owner pays by 10× (Elek FK-002 Z1). */
function priceInPeriod(monthly: number, annualMult: number, lang: string): string {
  const m = T(lang, "+{price}/hó", { price: esc(huf(monthly)) });
  return annualMult > 0
    ? `${m} <em>${T(lang, "= {yearly}/év", { yearly: esc(huf(monthly * annualMult)) })}</em>`
    : m;
}

function moduleHeader(
  title: string,
  priceMonthly: number | null,
  anchor: string,
  lang = "hu",
  annualMult = 0,
): string {
  return (
    `<div class="mhead">` +
    `<div class="mhead__top"><span class="mhead__ico">${ic("modules", 20)}</span>` +
    `<h2>${esc(title)}</h2>` +
    (priceMonthly && priceMonthly > 0
      ? `<span class="mhead__price">${priceInPeriod(priceMonthly, annualMult, lang)}</span>`
      : "") +
    `</div>` +
    `<div class="mhead__links"><a href="/admin?tab=modulok">‹ ${T(lang, "Vissza a modulokhoz")}</a>` +
    helpLinkInHead(anchor, lang) +
    `</div></div>`
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
function renderField(f: ModuleField, value: unknown, lang = "hu"): string {
  const id = `cfg_${f.key}`;
  const v = value ?? "";
  const label = `<label class="citui-label" for="${id}">${esc(T(lang, f.label))}</label>`;
  const help = f.help ? `<p class="citui-hint" style="margin:6px 0 0">${esc(T(lang, f.help))}</p>` : "";
  const ph = f.placeholder ? ` placeholder="${esc(T(lang, f.placeholder))}"` : "";

  if (f.type === "toggle") {
    return (
      `<div class="mcfg-row"><span class="mcfg-row__txt"><strong>${esc(T(lang, f.label))}</strong>` +
      (f.help ? `<span>${esc(T(lang, f.help))}</span>` : "") +
      `</span>` +
      `<span class="adm-switch"><input type="checkbox" id="${id}" name="${esc(f.key)}" value="1"` +
      `${v ? " checked" : ""} aria-label="${esc(T(lang, f.label))}"><span class="tr"></span><span class="th"></span></span>` +
      `</div>`
    );
  }
  if (f.type === "select") {
    const opts = (f.options ?? [])
      .map(
        (o) =>
          `<option value="${esc(o.value)}"${String(v) === o.value ? " selected" : ""}>${esc(T(lang, o.label))}</option>`,
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
      (f.suffix ? `<span>${esc(T(lang, f.suffix))}</span>` : "") +
      `</span>${help}</div>`
    );
  }
  const type = f.type === "email" ? "email" : f.type === "time" ? "time" : "text";
  // Approved plan 2026-09-06 ④: notify addresses may be a comma-separated LIST —
  // without `multiple` the browser's type=email validation rejects the comma.
  const multi = f.type === "email" ? " multiple" : "";
  return `<div class="citui-field">${label}<input class="citui-input" id="${id}" name="${esc(f.key)}" type="${type}"${multi}${ph} value="${esc(v)}">${help}</div>`;
}

/** Day label for the detail card ("szept. 12.") — same shape the Foglalások tab uses. */
function dayLabel(iso: string, lang: string): string {
  const M = [
    T(lang, "jan."), T(lang, "febr."), T(lang, "márc."), T(lang, "ápr."),
    T(lang, "máj."), T(lang, "jún."), T(lang, "júl."), T(lang, "aug."),
    T(lang, "szept."), T(lang, "okt."), T(lang, "nov."), T(lang, "dec."),
  ];
  return `${M[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}.`;
}

function dayRange(from: string, to: string, lang: string): string {
  return `${dayLabel(from, lang)} – ${dayLabel(to, lang)}`;
}

/**
 * WHAT HOLDS THIS NIGHT — the card that opens when the owner taps a taken day.
 *
 * Owner's request (2026-09-08): "ha foglalt napra kattint, tudja megnézni a foglalások
 * részleteit"; the hordozó is a CENTERED pop-up ("felugró ablak de középre igazítva").
 * Approved contract: assets/design-refs/tenant-admin/booking-screen/.
 *
 * ZERO JS, like the calendar itself: the day is an anchor, the card is `:target`.
 * A modal that needs a script would be dark exactly when the script fails.
 */
function dayDetailCard(c: MonthView["cells"][number], moduleId: string, unitId: string, lang: string): string {
  const d = c.detail;
  if (!d) return "";
  const id = `nap-${c.day}`;
  const close = `<a class="daycard__close" href="#cit-naptar" aria-label="${T(lang, "Bezárás")}">×</a>`;
  const linked = c.source === "linked";
  const holder = d.otherUnitName ?? "";

  let head: string;
  let body: string;
  if (d.kind === "booking" && d.booking) {
    const b = d.booking;
    const rows =
      `<dl><dt>${T(lang, "Időszak")}</dt><dd>${esc(dayRange(b.from, b.to, lang))} · ${T(lang, "{n} éjszaka", { n: b.nights })}</dd>` +
      `<dt>${T(lang, "Létszám")}</dt><dd>${T(lang, "{n} fő", { n: b.guests })}</dd>` +
      // §B.17: a request without a frozen price shows NO price line at all.
      (b.amount ? `<dt>${T(lang, "Ár")}</dt><dd>${esc(b.amount)}</dd>` : "") +
      `<dt>${T(lang, "E-mail")}</dt><dd><a href="mailto:${esc(b.guestEmail)}">${esc(b.guestEmail)}</a></dd>` +
      (b.guestPhone
        ? `<dt>${T(lang, "Telefon")}</dt><dd><a href="tel:${esc(b.guestPhone.replace(/\s+/g, ""))}">${esc(b.guestPhone)}</a></dd>`
        : "") +
      (linked && holder ? `<dt>${T(lang, "Melyik egység")}</dt><dd>${esc(holder)}</dd>` : "") +
      `</dl>` +
      (b.message ? `<p class="daycard__note"><b>${T(lang, "A vendég üzenete:")}</b> ${esc(b.message)}</p>` : "");
    head =
      `<strong>${esc(b.guestName)}</strong>` +
      `<span class="daycard__tag daycard__tag--ok">${T(lang, "Visszaigazolva")}</span>`;
    body =
      rows +
      (linked && holder
        ? `<p class="daycard__note">${T(lang, "Ezért nem foglalható itt: a(z) {unit} erre a napra el van adva.", { unit: esc(holder) })}</p>`
        : "") +
      `<div class="daycard__acts">` +
      `<a class="citui-btn citui-btn--primary" href="/admin?tab=foglalasok&q=${encodeURIComponent(b.id)}">${T(lang, "Foglalás megnyitása")}</a>` +
      (linked && d.otherUnitId
        ? `<a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&m=${encodeURIComponent(moduleId)}&e=${encodeURIComponent(d.otherUnitId)}&ho=${c.day.slice(0, 7)}">${T(lang, "Átváltok a naptárára")}</a>`
        : `<a class="citui-btn citui-btn--ghost" href="mailto:${esc(b.guestEmail)}">${T(lang, "Írok a vendégnek")}</a>`) +
      `</div>`;
  } else if (d.kind === "ical") {
    const provider = d.provider ?? T(lang, "portál");
    head = `<strong>${esc(dayLabel(c.day, lang))}</strong><span class="daycard__tag">${esc(provider)}</span>`;
    body =
      `<p class="daycard__note">${T(lang, "Ez a foglalás a(z) {provider} naptárában él, ezért itt nem módosítható — ott tudja kezelni.", { provider: esc(provider) })}</p>`;
  } else {
    // Manual block on ANOTHER unit: nothing is booked, but this screen still cannot
    // free it — and the owner has to be told WHERE it can be freed.
    head =
      `<strong>${esc(dayLabel(c.day, lang))}</strong>` +
      (holder ? `<span class="daycard__tag">${esc(holder)}</span>` : "");
    body =
      `<p class="daycard__note">${T(lang, "Ezt a napot a(z) {unit} naptárában jelölte tele, ezért itt sem adható ki.", { unit: esc(holder) })}</p>` +
      (d.otherUnitId
        ? `<div class="daycard__acts"><a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&m=${encodeURIComponent(moduleId)}&e=${encodeURIComponent(d.otherUnitId)}&ho=${c.day.slice(0, 7)}">${T(lang, "Átváltok a naptárára")}</a></div>`
        : "");
  }

  return (
    `<div class="daycard" id="${id}" role="dialog" aria-label="${esc(dayLabel(c.day, lang))}">` +
    `<a class="daycard__bg" href="#cit-naptar" aria-label="${T(lang, "Bezárás")}"></a>` +
    `<div class="daycard__box"><div class="daycard__head">${head}${close}</div>${body}</div>` +
    `</div>`
  );
}

/** The Monday-first month grid. Checkbox+label = instant tap feedback, zero JS. */
function calendar(mv: MonthView, moduleId: string, unitId: string, lang = "hu"): string {
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
      if (c.past) {
        return `<div class="cal-cell cal-cell--past" title="${T(lang, "Elmúlt nap")}"><label>${c.dom}</label></div>`;
      }
      if (!c.editable) {
        // Taken by a guest, a portal or another unit — NOT this screen's to release,
        // but tappable: behind it stands a person, and the owner may need the phone
        // number more urgently than the calendar itself (owner, 2026-09-08).
        const cls =
          c.source === "linked" ? "cal-cell--linked" : c.source === "ical" ? "cal-cell--portal" : "cal-cell--booked";
        const who =
          c.detail?.booking?.guestName ??
          (c.source === "ical"
            ? (c.detail?.provider ?? T(lang, "portál"))
            : (c.detail?.otherUnitName ?? T(lang, "másik egység")));
        const title = T(lang, "{who} — koppintson a részletekért", { who: esc(who) });
        return (
          `<div class="cal-cell ${cls}">` +
          `<a href="#nap-${c.day}" title="${esc(title)}" aria-label="${esc(title)}">${c.dom}</a></div>`
        );
      }
      return (
        `<div class="cal-cell">` +
        `<input type="checkbox" id="${id}" name="day" value="${esc(c.day)}"${c.blocked ? " checked" : ""}>` +
        `<label for="${id}">${c.dom}</label></div>`
      );
    })
    .join("");
  const detailCards = mv.cells
    .filter((c) => !c.past && !c.editable && c.detail)
    .map((c) => dayDetailCard(c, moduleId, unitId, lang))
    .join("");

  const navBase =
    `/admin?tab=modulok&m=${encodeURIComponent(moduleId)}&e=${encodeURIComponent(unitId)}`;
  return (
    `<div class="cal-head">` +
    `<a href="${navBase}&ho=${mv.prevMonth}" aria-label="${T(lang, "Előző hónap")}">‹</a>` +
    `<b>${esc(mv.label)}</b>` +
    `<a href="${navBase}&ho=${mv.nextMonth}" aria-label="${T(lang, "Következő hónap")}">›</a>` +
    `</div>` +
    `<div class="cal-dow">${dow}</div>` +
    `<div class="cal-grid">${blanks}${cells}</div>` +
    detailCards
  );
}

/**
 * The legend — its own block because on a wide screen it sits BESIDE the grid, not
 * under it: a month stretched to 1100px is not more information, only bigger
 * (approved contract §3; feedback_size_inflation_is_not_design).
 */
function calendarLegend(mv: MonthView, lang = "hu"): string {
  const linkedCount = mv.cells.filter((c) => c.source === "linked").length;
  return (
    `<div class="cal-legend">` +
    `<span><i></i>${T(lang, "Szabad")}</span>` +
    // Two different things used to share one legend entry — and one of them is
    // re-tappable while the other is not (KB guard, 2026-09-08).
    `<span><i class="is-manual"></i>${T(lang, "Ön jelölte tele")}</span>` +
    `<span><i class="is-full"></i>${T(lang, "Vendég foglalása")}</span>` +
    // ADR-0114: a night another unit holds looks different, because it behaves
    // differently — it cannot be released here.
    (linkedCount > 0 ? `<span><i class="is-linked"></i>${T(lang, "Másik egység foglalása")}</span>` : "") +
    (mv.importedCount > 0 ? `<span><i class="is-portal"></i>${T(lang, "Portálról érkezett")}</span>` : "") +
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
  /** ADR-0114 — this unit IS the whole place; it and the rooms exclude each other.
   *  The unit tabs say so, because it changes what a blocked day MEANS. */
  readonly isWholeProperty?: boolean;
}

/**
 * Per-unit content: description + its own amenities. This is what turns a unit from
 * a line in a list into something worth its own page — and the note underneath says
 * plainly whether the page will exist, because an owner should not have to guess why
 * their apartment has no address.
 */

/**
 * AMENITY PICKER (owner-approved plan F, 2026-08-26 — the frozen contract is
 * assets/design-refs/tenant-admin/amenity-picker-f*.html): E's head (selected
 * items as removable chips + a search box) over D's body (icon tiles per
 * category, two columns even at 390px).
 *
 * Selection is plain <label><input type=checkbox> — it works with ZERO
 * JavaScript, same rule as the calendar and the photo picker. JS adds the
 * conveniences on top: live search, the chip row, the counter. The checkbox
 * VALUE is the catalogue's Hungarian label, because the label is what the
 * storage holds (see amenityCatalog.ts) — the id never leaves the code.
 *
 * `inherited` (per-unit mode): the site-wide picks render as dashed, untogglable
 * tiles with an "az egész szállásra" tag — the owner sees the full picture at
 * the room without being able to double-claim (approved decision: greyed, not
 * hidden and not editable).
 */
interface AmenityPickerOpts {
  /** "property" offers property+both, "unit" offers unit+both. */
  readonly scope: "property" | "unit";
  /** Currently stored catalogue labels (checked state). */
  readonly selected: readonly string[];
  /** Stored free-text lines (the Egyéb box). */
  readonly other: readonly string[];
  /** Site-wide picks shown greyed in unit mode. */
  readonly inherited?: readonly string[];
  /** Unique DOM id prefix — several pickers may share a page (one per room). */
  readonly idPrefix: string;
  /** Field names to POST: checked labels under `checkName`, textarea under `otherName`. */
  readonly checkName: string;
  readonly otherName: string;
  readonly lang: string;
}

function amenityPicker(o: AmenityPickerOpts): string {
  const lang = o.lang;
  const sel = new Set(o.selected.map((s) => s.trim()));
  const inh = new Set((o.inherited ?? []).map((s) => s.trim()));
  const fits = (a: AmenityItem_): boolean =>
    o.scope === "property" ? a.scope !== "unit" : a.scope !== "property";
  let tiles = "";
  let selectable = 0;
  for (const cat of AMENITY_CATEGORIES) {
    const items = AMENITY_CATALOG.filter((a) => a.category === cat.key && (fits(a) || inh.has(a.label)));
    const inherited = items.filter((a) => inh.has(a.label));
    const own = items.filter((a) => !inh.has(a.label) && fits(a));
    if (!inherited.length && !own.length) continue;
    selectable += own.length;
    tiles +=
      `<h3 class="ampick__cat">${T(lang, cat.label)}</h3><div class="ampick__grid">` +
      inherited
        .map(
          (a) =>
            `<div class="ampick__tile ampick__tile--inh" data-t="${esc(T(lang, a.label).toLowerCase())}" ` +
            `title="${T(lang, "Az egész szállásra beállítva — a szoba automatikusan örökli")}">` +
            `<span class="ampick__ico">${amenitySvg(a)}</span>` +
            `<span>${T(lang, a.label)}<span class="ampick__inhtag">${T(lang, "az egész szállásra")}</span></span></div>`,
        )
        .join("") +
      own
        .map(
          (a) =>
            `<label class="ampick__tile" data-t="${esc(T(lang, a.label).toLowerCase())}">` +
            `<input type="checkbox" name="${esc(o.checkName)}" value="${esc(a.label)}"${sel.has(a.label) ? " checked" : ""}>` +
            `<span class="ampick__ico">${amenitySvg(a)}</span><span>${T(lang, a.label)}</span></label>`,
        )
        .join("") +
      `</div>`;
  }
  const p = esc(o.idPrefix);
  return (
    `<div class="ampick" id="${p}">` +
    `<div class="ampick__chips" data-empty="${T(lang, "Még nincs kiválasztott tétel — koppintson a csempékre, vagy keressen rá.")}"></div>` +
    `<div class="ampick__search">${ic("zoom")}` +
    `<input type="search" placeholder="${T(lang, "Keresés — pl. medence, wifi, stég…")}" autocomplete="off"></div>` +
    `<div class="ampick__count" data-total="${selectable}"></div>` +
    `<div class="ampick__list">${tiles}` +
    `<p class="ampick__empty" hidden>${T(lang, "Nincs ilyen tétel a listában — írja be lentebb az „Egyéb” mezőbe.")}</p></div>` +
    `<div class="ampick__foot"><label class="citui-label" for="${p}_o">${T(lang, "Egyéb, ami nincs a listában")}</label>` +
    `<textarea class="citui-textarea" id="${p}_o" name="${esc(o.otherName)}" style="min-height:64px" ` +
    `placeholder="${T(lang, "Soronként egy — pl. „saját mólóhasználat”")}">${esc(o.other.join("\n"))}</textarea>` +
    `<p class="citui-hint" style="margin:6px 0 0">${T(lang, "A listás tételeket a vendég a honlap nyelvén látja; a szabad szöveg úgy jelenik meg, ahogy beírja.")}</p></div>` +
    `</div>`
  );
}

/** One shared runtime for every picker on the page (chips + search + counter).
 *  Progressive enhancement only — selection itself is native checkboxes. */
function amenityPickerScript(lang: string): string {
  const one = T(lang, "{n} kiválasztva");
  const more = T(lang, "{n} további választható");
  return (
    `<script>(function(){document.querySelectorAll(".ampick").forEach(function(pk){` +
    `var chips=pk.querySelector(".ampick__chips"),count=pk.querySelector(".ampick__count"),` +
    `q=pk.querySelector(".ampick__search input"),empty=pk.querySelector(".ampick__empty"),` +
    `list=pk.querySelector(".ampick__list");` +
    `function boxes(){return [].slice.call(list.querySelectorAll("input[type=checkbox]"))}` +
    `function render(){var on=boxes().filter(function(b){return b.checked});` +
    `var total=Number(count.dataset.total||0);` +
    `count.textContent=${JSON.stringify(one)}.replace("{n}",on.length)+(total-on.length>0?" · "+${JSON.stringify(more)}.replace("{n}",total-on.length):"");` +
    `chips.innerHTML="";if(!on.length){chips.classList.add("ampick__chips--empty");chips.textContent=chips.dataset.empty;return}` +
    `chips.classList.remove("ampick__chips--empty");` +
    `on.forEach(function(b){var t=b.closest(".ampick__tile"),c=document.createElement("button");` +
    `c.type="button";c.className="ampick__chip";` +
    `c.innerHTML=t.querySelector(".ampick__ico").innerHTML+"<span>"+t.textContent.trim()+"</span><span class=\\"ampick__chip-x\\">×</span>";` +
    `c.onclick=function(){b.checked=false;render()};chips.appendChild(c)})}` +
    `list.addEventListener("change",render);` +
    `if(q)q.addEventListener("input",function(){var v=q.value.trim().toLowerCase(),hit=0;` +
    `[].slice.call(list.querySelectorAll(".ampick__tile")).forEach(function(t){` +
    `var m=!v||(t.dataset.t||"").indexOf(v)>-1;t.hidden=!m;if(m)hit++});` +
    `[].slice.call(list.querySelectorAll(".ampick__grid")).forEach(function(g){` +
    `var any=[].slice.call(g.children).some(function(t){return !t.hidden});` +
    `g.hidden=!any;if(g.previousElementSibling)g.previousElementSibling.hidden=!any});` +
    `if(empty)empty.hidden=hit>0});` +
    `render()})})();</script>`
  );
}

/**
 * The room card's amenity block when the Felszereltség module is NOT bought
 * (approved plan F-locked): a conversion surface, not an error — the offer on
 * top, real but faded tiles underneath so the owner sees what the module gives.
 */
function amenityLockedPanel(lang: string): string {
  const preview = AMENITY_CATEGORIES.slice(0, 2)
    .map((cat) => {
      const items = AMENITY_CATALOG.filter((a) => a.category === cat.key && a.scope !== "property").slice(0, 4);
      if (!items.length) return "";
      return (
        `<h3 class="ampick__cat">${T(lang, cat.label)}</h3><div class="ampick__grid">` +
        items
          .map(
            (a) =>
              `<div class="ampick__tile"><span class="ampick__ico">${amenitySvg(a)}</span><span>${T(lang, a.label)}</span></div>`,
          )
          .join("") +
        `</div>`
      );
    })
    .join("");
  return (
    `<div class="amlock">` +
    `<h3>${T(lang, "Mutassa meg, mi van ebben a szobában")}</h3>` +
    `<p>${T(lang, "A vendég a szoba adatlapján külön is látja, mit kap: saját fürdőszoba, erkély, klíma, konyhasarok. Ma csak a szoba nevét és leírását olvassa — a felszereltséget nem.")}</p>` +
    `<a class="citui-btn citui-btn--primary" href="/admin?tab=modulok">${T(lang, "Felszereltség modul bekapcsolása")}</a>` +
    `<div class="amlock__prev">${preview}` +
    `<p class="amlock__cap">${T(lang, "…és további {n} tétel, ikonnal és keresővel — {c} kategóriában.", { n: AMENITY_CATALOG.length - 8, c: AMENITY_CATEGORIES.length })}</p></div>` +
    `</div>`
  );
}

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
function photoPicker(u: EditorUnit, library: readonly PhotoEdit[], lang = "hu"): string {
  if (!library.length) {
    return (
      `<p class="citui-hint" style="margin:0 0 14px">${T(lang, "Még nincs feltöltött kép. A {tab} fülön tölthet fel, utána itt rendelheti a szobákhoz.", { tab: `<strong>${T(lang, "Fotók")}</strong>` })}</p>`
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
    `<label class="citui-label">${T(lang, "Képek ehhez az egységhez")}</label>` +
    // Marker: distinguishes "never opened the picker" from "opened and cleared it",
    // so a save cannot silently wipe an assignment the owner did not touch.
    `<input type="hidden" name="photos_touched" value="1">` +
    `<div class="mcfg-pf__sel">${minis}` +
    `<span class="citui-hint" style="margin:0">${T(lang, "{n} kiválasztva", { n: picked.size })}</span></div>` +
    `<details class="mcfg-pf"><summary><span class="citui-btn citui-btn--ghost citui-btn--sm">` +
    `${T(lang, "Képek választása")}</span></summary>` +
    `<div class="mcfg-pf__grid">${cells}</div>` +
    `<p class="citui-hint" style="margin:8px 0 0">${T(lang, "Pipálja ki, melyik kép tartozik ehhez az egységhez. Új képet a {tab} fülön tölthet fel — egy kép több szobához is tartozhat.", { tab: `<strong>${T(lang, "Fotók")}</strong>` })}</p>` +
    `</details></div>`
  );
}

/** What the room card needs to know about the amenities module (owner decision
 *  2026-08-26: per-unit amenities require the rooms AND the amenities module). */
export interface UnitAmenityContext {
  /** Is the Felszereltség module active? false → conversion panel, no inputs. */
  readonly active: boolean;
  /** Site-wide catalogue picks — shown greyed and untogglable on the room card. */
  readonly siteSelected: readonly string[];
}

function unitContentCards(
  units: EditorUnit[],
  library: readonly PhotoEdit[] = [],
  lang = "hu",
  amenityCtx?: UnitAmenityContext,
): string {
  if (units.length < 2) return "";
  return units
    .map((u) => {
      const photos = u.photoCount ?? 0;
      const hasText = Boolean(u.description?.trim()) || (u.amenities?.length ?? 0) > 0;
      const ready = photos > 0 && hasText;
      const status = ready
        ? `<p class="mcfg-note" style="margin:14px 0 0">${T(lang, "Saját oldala: {url} — a keresők külön is megtalálják.", { url: `<code>/apartman/${esc(u.slug ?? "")}</code>` })}</p>`
        : `<p class="mcfg-note" style="margin:14px 0 0">${T(lang, "Ennek az egységnek még nincs saját oldala. Ahhoz kell legalább {photo} (itt lent, a „Képek választása” gombbal) és {text}. Üres oldallal többet ártanánk, mint használnánk.", { photo: `<strong>${T(lang, "egy hozzárendelt fotó")}</strong>`, text: `<strong>${T(lang, "leírás vagy felszereltség")}</strong>` })}</p>`;
      // The amenity block, in one of three shapes: the approved picker (module
      // active), the conversion panel (module missing), or — when the caller gave
      // no context (booking screen reuses this card) — the stored list read-only.
      const stored = splitAmenities(u.amenities ?? []);
      const amenityBlock = amenityCtx
        ? amenityCtx.active
          ? `<div class="citui-field"><span class="citui-label">${T(lang, "Ebben az egységben van")}</span>` +
            amenityPicker({
              scope: "unit",
              selected: stored.selected,
              other: stored.other,
              inherited: amenityCtx.siteSelected,
              idPrefix: `amp_${u.id}`,
              checkName: "am",
              otherName: "amenities_other",
              lang,
            }) +
            `</div>`
          : amenityLockedPanel(lang)
        : "";
      return (
        `<form method="POST" action="/admin/units/content" class="adm-card">` +
        `<input type="hidden" name="id" value="${esc(u.id)}">` +
        `<div class="adm-card__head"><span class="adm-ico">${ic("texts")}</span><h2>${esc(u.name)}</h2></div>` +
        `<div class="citui-field"><label class="citui-label" for="d_${esc(u.id)}">${T(lang, "Leírás")}</label>` +
        `<textarea class="citui-textarea" id="d_${esc(u.id)}" name="description" style="min-height:110px" ` +
        `placeholder="${T(lang, "Mi jellemzi ezt a szobát? Mit szeretnek benne a vendégek?")}">${esc(u.description ?? "")}</textarea></div>` +
        amenityBlock +
        photoPicker(u, library, lang) +
        `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">` +
        `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Mentés")}</button>` +
        `<span class="citui-hint" style="margin:0">${T(lang, "{n} hozzárendelt fotó", { n: photos })}</span></div>` +
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
function requestsCard(reqs: EditorRequest[], multiUnit: boolean, lang = "hu"): string {
  const pending = reqs.filter((r) => r.status === "pending");
  if (!pending.length) return "";
  const rows = pending
    .map(
      (r) =>
        `<div class="breq">` +
        `<div class="breq__who"><strong>${esc(r.guestName)}</strong>` +
        `<span>${esc(huDay(r.dateFrom))} — ${esc(huDay(r.dateTo))} · ${T(lang, "{n} fő", { n: r.guests })}` +
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
    `<h2>${T(lang, "Válaszra vár ({n})", { n: pending.length })}</h2></div>` +
    `<p class="adm-lead">${T(lang, "A vendég csak azután kap visszaigazolást, hogy Ön döntött. Ugyanezt a levélben is elintézheti.")}</p>` +
    rows +
    `</div>`
  );
}

/**
 * Unit switcher — rendered ONLY when there is genuinely more than one unit.
 *
 * Approved contract (assets/design-refs/tenant-admin/booking-screen/, owner 2026-09-08):
 * TABS, not floating pills. Two lines per tab — the name, and under it what the owner
 * needs to tell them apart: the capacity, and for the whole place the fact that it IS
 * the whole house (ADR-0114 made it the unit the others hang off).
 */
function unitSwitcher(booking: BookingEditorData, moduleId: string, lang = "hu"): string {
  if (booking.units.length < 2) return "";
  const tabs = booking.units
    .map((u) => {
      const meta = [
        u.capacity ? T(lang, "{n} fő", { n: u.capacity }) : T(lang, "férőhely nincs megadva"),
        u.isWholeProperty ? T(lang, "az egész ház") : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        `<a href="/admin?tab=modulok&m=${encodeURIComponent(moduleId)}&e=${encodeURIComponent(u.id)}"` +
        `${u.id === booking.unitId ? ' aria-current="true"' : ""}>${esc(u.name)}` +
        `<small>${esc(meta)}</small></a>`
      );
    })
    .join("");
  return (
    `<div class="adm-card unit-tabs-card">` +
    `<h3 class="unit-tabs__h">${T(lang, "Mit ad ki?")}</h3>` +
    `<p class="adm-lead">${T(lang, "Minden egységnek külön naptára van, így külön telhet be.")}</p>` +
    `<div class="unit-tabs" role="tablist">${tabs}</div></div>`
  );
}

/** Add / rename / remove the bookable units. */
function unitsCard(booking: BookingEditorData, lang = "hu"): string {
  const multi = booking.units.length > 1;
  const rows = booking.units
    .map(
      (u) =>
        `<form method="POST" action="/admin/units/save" class="unit-row">` +
        `<input type="hidden" name="id" value="${esc(u.id)}">` +
        `<input class="citui-input unit-row__name" name="name" value="${esc(u.name)}" aria-label="${T(lang, "Egység neve")}">` +
        `<span class="mcfg-suffix"><input class="citui-input unit-row__cap" name="capacity" type="number" ` +
        `inputmode="numeric" min="1" max="50" value="${u.capacity ?? ""}" aria-label="${T(lang, "Férőhely")}"><span>${T(lang, "fő")}</span></span>` +
        `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mentés")}</button>` +
        // ADR-0114: the whole place cannot be deleted (it anchors the exclusion), so
        // the button is not offered — a button whose only answer is "nem lehet" is
        // worse than no button.
        (multi && !u.isWholeProperty
          ? `<button class="citui-btn citui-btn--ghost unit-row__del" type="submit" ` +
            `formaction="/admin/units/delete">${T(lang, "Törlés")}</button>`
          : "") +
        `</form>`,
    )
    .join("");

  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>Mit ad ki?</h2></div>` +
    `<p class="adm-lead">` +
    (multi
      ? T(lang, "Minden egységnek külön naptára van, így külön telhet be.")
      : T(lang, "Ha nem egy egészet, hanem több szobát vagy apartmant ad ki, vegye fel őket külön — mindegyiknek saját naptára lesz.")) +
    `</p>` +
    rows +
    `<form method="POST" action="/admin/units/save" class="unit-row unit-row--new">` +
    `<input class="citui-input unit-row__name" name="name" placeholder="${T(lang, "Pl. Kertre néző apartman")}" aria-label="${T(lang, "Új egység neve")}">` +
    `<span class="mcfg-suffix"><input class="citui-input unit-row__cap" name="capacity" type="number" ` +
    `inputmode="numeric" min="1" max="50" placeholder="2" aria-label="${T(lang, "Férőhely")}"><span>${T(lang, "fő")}</span></span>` +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Hozzáadás")}</button>` +
    `</form></div>`
  );
}

/**
 * The owner's review inbox (ADR-0046). The e-mail is the primary door — this is the
 * second one, for an owner who is already logged in or wants to take something down
 * later. A published review can still be withdrawn: the page is theirs.
 */
function reviewsEditor(data: ReviewsEditorData, lang = "hu"): string {
  const stars = (n: number): string =>
    `<span class="rev-stars" aria-label="${n} csillag">${"★".repeat(n)}<span>${"★".repeat(5 - n)}</span></span>`;

  const card = (r: ReviewsEditorData["items"][number]): string => {
    const pending = r.status === "pending";
    const meta = [r.stayMonth, r.unitName].filter(Boolean).join(" · ");
    const state = pending
      ? `<span class="rev-badge rev-badge--wait">${T(lang, "Döntésre vár")}</span>`
      : r.status === "published"
        ? `<span class="rev-badge rev-badge--ok">Az oldalon</span>`
        : `<span class="rev-badge">${T(lang, "Nem került ki")}</span>`;
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
      `<div class="adm-card__head"><span class="adm-ico">${ic("star")}</span><h2>${T(lang, "Google-értékelés")}</h2></div>` +
      `<p class="adm-lead">${T(lang, "Ez látszik most az oldalán:")} <strong>${data.google.value
        .toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        .replace(/</g, "")}</strong> · ${T(lang, "{n} értékelés. A vendég rákattintva a Google-véleményekhez jut.", { n: data.google.count })}</p>` +
      `<p class="citui-hint">${T(lang, "A vélemények SZÖVEGÉT a Google feltételei miatt nem másolhatjuk át az oldalára — csak az átlagot és a darabszámot mutathatjuk, ezért visz a kattintás a Google-re.")}</p>` +
      `<p style="margin:14px 0 0"><a class="citui-btn citui-btn--ghost" href="${esc(data.google.url)}" ` +
      `target="_blank" rel="noopener">${T(lang, "Megnézem, mit írnak a Google-on")}</a></p>` +
      `</div>`
    : "";

  return (
    googleCard +
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>${T(lang, "Vendégvélemények")}</h2></div>` +
    (data.items.length
      ? `<p class="adm-lead">${
          waiting.length
            ? T(lang, "{n} vélemény vár a döntésére.", { n: waiting.length })
            : T(lang, "Minden véleményről döntött.")
        }</p>` +
        waiting.map(card).join("") +
        rest.map(card).join("")
      : `<p class="adm-lead">${T(lang, "Még nem érkezett vélemény. Az oldalán van egy űrlap, ahol a vendégek írhatnak — amint jön egy, e-mailt kap róla, és egy koppintással eldöntheti, kikerüljön-e.")}</p>`) +
    `</div>`
  );
}

function bookingEditor(moduleId: string, booking: BookingEditorData, lang = "hu"): string {
  const mv = booking.month;
  const imported = booking.links.filter((l) => l.direction === "import");
  const multi = booking.units.length > 1;
  const unitName = booking.units.find((u) => u.id === booking.unitId)?.name ?? "";

  const linkCards = imported.length
    ? imported
        .map((l) => {
          const state = l.lastError
            ? T(lang, "Nem sikerült frissíteni: {err}", { err: l.lastError })
            : l.lastSyncAt
              ? T(lang, "Utoljára frissült: {date}", { date: new Date(l.lastSyncAt).toLocaleString("hu-HU") }) +
                (l.lastDayCount !== null ? ` · ${l.lastDayCount} foglalt nap` : "")
              : T(lang, "Még nem frissült");
          return (
            `<div class="plink ${l.lastError ? "plink--bad" : "plink--ok"}">` +
            `<span class="adm-ico">${ic(l.lastError ? "alert" : "check", 18)}</span>` +
            `<span class="plink__txt"><strong>${T(lang, "{provider} összekötve", { provider: esc(l.provider) })}</strong>` +
            `<span>${esc(state)}</span></span>` +
            `<button class="citui-btn citui-btn--ghost" type="submit" form="unlink_${esc(l.id)}">${T(lang, "Leválasztás")}</button>` +
            `<form id="unlink_${esc(l.id)}" method="POST" action="/admin/calendar-link/delete">` +
            `<input type="hidden" name="id" value="${esc(l.id)}">` +
            `<input type="hidden" name="unit" value="${esc(booking.unitId)}"></form>` +
            `</div>`
          );
        })
        .join("")
    : `<p class="mcfg-note">${T(lang, "Még nincs összekötve semmi. Ha máshol is hirdeti{what}, kösse össze — így soha nem lesz dupla foglalás.", { what: multi ? T(lang, " ezt az egységet") : T(lang, " a szállását") })}</p>`;

  return (
    // Approved plan 2026-09-06: the requests moved to their OWN "Foglalások" tab
    // (badge, time order, overlap chooser). ONE place decides — this screen points
    // there instead of keeping a second, weaker inbox.
    (booking.requests.filter((r) => r.status === "pending").length
      ? `<div class="adm-card"><p class="adm-lead" style="margin:0">` +
        `${T(lang, "{n} foglalási kérés vár döntésre.", { n: booking.requests.filter((r) => r.status === "pending").length })} ` +
        `<a class="citui-btn citui-btn--primary" style="margin-left:10px" href="/admin?tab=foglalasok">${T(lang, "Foglalások megnyitása")}</a>` +
        `</p></div>`
      : "") +
    unitSwitcher(booking, moduleId, lang) +

    // ① the calendar of the selected unit — COLLAPSIBLE (owner, 2026-09-08), and
    // closed it still answers the question: how full is this month. <details> does
    // it with zero JS, same rule as the day cells.
    `<details class="adm-card cal-card" id="cit-naptar" open>` +
    `<summary class="cal-sum">` +
    `<span class="adm-ico">${ic("overview")}</span>` +
    `<span class="cal-sum__txt"><strong>${T(lang, "Mikor van tele?")}${multi ? ` — ${esc(unitName)}` : ""}</strong>` +
    `<span>${esc(mv.label)}</span></span>` +
    `<span class="cal-sum__badge${mv.blockedCount === 0 ? " is-free" : ""}">${
      mv.blockedCount === 0
        ? T(lang, "nincs tele nap")
        : T(lang, "{n} nap tele", { n: mv.blockedCount })
    }</span>` +
    `<span class="cal-sum__chev">${ic("chevron-down", 18)}</span>` +
    `</summary>` +
    `<p class="adm-lead">${T(lang, "Koppintson azokra a napokra, amikor nem tud vendéget fogadni. A sötét napokra a vendég nem tud foglalni.")}</p>` +
    `<form method="POST" action="/admin/availability">` +
    `<input type="hidden" name="month" value="${esc(mv.month)}">` +
    `<input type="hidden" name="unit" value="${esc(booking.unitId)}">` +
    `<div class="cal-two"><div class="cal-two__main">` +
    calendar(mv, moduleId, booking.unitId, lang) +
    `</div><div class="cal-two__side">` +
    calendarLegend(mv, lang) +
    `<div class="cal-save">` +
    `<span class="citui-hint" style="margin:0">${T(lang, "A foglalt napra koppintva látja, ki foglalta.")}</span>` +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Naptár mentése")}</button>` +
    `</div></div></div></form></details>` +

    // ② portal connections — dark until portal sync is in scope (PORTAL_SYNC_UI)
    (!PORTAL_SYNC_UI
      ? ""
      : `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("external")}</span><h2>${T(lang, "Hirdeti máshol is?")}</h2></div>` +
    `<p class="adm-lead">${T(lang, "Ha {what} fent van a Booking.com-on vagy az Airbnb-n, összekötjük a naptárakat. Amit ott lefoglalnak, itt is foglalt lesz.", { what: multi ? T(lang, "ez az egység") : T(lang, "a szállása") })}</p>` +
    linkCards +
    `<form method="POST" action="/admin/calendar-link">` +
    `<input type="hidden" name="unit" value="${esc(booking.unitId)}">` +
    `<div class="citui-field"><label class="citui-label" for="provider">Hol hirdeti?</label>` +
    `<select class="citui-input" id="provider" name="provider">` +
    `<option value="Booking.com">Booking.com</option>` +
    `<option value="Airbnb">Airbnb</option>` +
    `<option value=T(lang, "Szállás.hu")>${T(lang, "Szállás.hu")}</option>` +
    `<option value=T(lang, "Egyéb")>${T(lang, "Egyéb")}</option></select></div>` +
    `<div class="citui-field"><label class="citui-label" for="ical_url">${T(lang, "A naptár linkje")}</label>` +
    `<input class="citui-input" id="ical_url" name="url" type="url" placeholder="https://…" required>` +
    `<p class="citui-hint" style="margin:6px 0 0">${T(lang, "Nem tudja, hol találja?")} ` +
    `<a href="/admin/segitseg/naptar" target="_blank" rel="noopener">${T(lang, "Megmutatjuk lépésről lépésre")}</a>.</p></div>` +
    `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Összekötés")}</button>` +
    `</form>` +
    (booking.exportUrl
      ? `<div style="margin-top:22px;padding-top:18px;border-top:1px solid var(--citui-line)">` +
        `<h3 class="mcfg-sub" style="margin-top:0">${T(lang, "A másik irány")}</h3>` +
        `<p class="citui-hint">${T(lang, "Adja meg ezt a linket a portálnak, hogy ő is lássa az itteni foglalásait")}` +
        (multi ? ` ${T(lang, "{unit} egységnél", { unit: esc(unitName) })}` : "") +
        `:</p>` +
        `<input class="citui-input" readonly value="${esc(booking.exportUrl)}" onclick="this.select()">` +
        `</div>`
      : "") +
    `</div>`) +

    // ③ units
    unitsCard(booking, lang)
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
function pricingEditor(data: PricingEditorData, lang = "hu"): string {
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
                (s.minNights ? `<em style="display:block;font-style:normal;font-size:.8rem;color:var(--citui-muted)">${T(lang, "min. {n} éj", { n: s.minNights })}</em>` : "") +
                `</span>` +
                `<form method="POST" action="/admin/prices/delete">` +
                `<input type="hidden" name="id" value="${esc(s.id)}">` +
                `<button class="citui-btn citui-btn--ghost unit-row__del" type="submit">${T(lang, "Törlés")}</button>` +
                `</form></div>`,
            )
            .join("")
        : `<p class="citui-hint" style="margin:6px 0 12px">${T(lang, "Nincs külön időszaki ár — mindig az alapár érvényes.")}</p>`;

      return (
        `<div class="adm-card">` +
        `<div class="adm-card__head"><span class="adm-ico">${ic("pricing")}</span>` +
        `<h2>${esc(u.name)}</h2></div>` +
        // ① base price
        `<form method="POST" action="/admin/prices/base" class="unit-row" style="border-bottom:0">` +
        `<input type="hidden" name="unit" value="${esc(u.id)}">` +
        `<label class="citui-label" style="flex:1;min-width:150px">${T(lang, "Alapár")}` +
        `<span class="mcfg-suffix" style="margin-top:5px">` +
        `<input class="citui-input" name="amount" type="number" inputmode="numeric" min="0" ` +
        `value="${base ? base.amount : ""}" placeholder="0"><span>${esc(cur)}</span></span></label>` +
        `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mentés")}</button>` +
        `</form>` +
        `<p class="citui-hint" style="margin:0 0 18px">${T(lang, "Ez érvényes, amikor egyik időszak sem.")}</p>` +
        // ② seasons
        `<h3 class="mcfg-sub">${T(lang, "Időszaki árak")}</h3>` +
        seasonRows +
        `<form method="POST" action="/admin/prices/season" class="price-new">` +
        `<input type="hidden" name="unit" value="${esc(u.id)}">` +
        `<input class="citui-input" name="label" placeholder="${T(lang, "Pl. Főszezon")}" aria-label="${T(lang, "Időszak neve")}">` +
        `<span class="price-new__dates">` +
        `<input class="citui-input" name="from" placeholder="06-15" aria-label="${T(lang, "Kezdet (hónap-nap)")}" maxlength="5">` +
        `<span>–</span>` +
        `<input class="citui-input" name="to" placeholder="08-31" aria-label="${T(lang, "Vég (hónap-nap)")}" maxlength="5">` +
        `</span>` +
        `<span class="mcfg-suffix"><input class="citui-input" name="amount" type="number" ` +
        `inputmode="numeric" min="0" placeholder="0" aria-label="${T(lang, "Ár")}"><span>${esc(cur)}</span></span>` +
        // ADR-0049: the period carries its own minimum stay. A fortnight in August is
        // not a February weekend, and the owner should say so where they say the price.
        `<span class="mcfg-suffix"><input class="citui-input" name="min_nights" type="number" ` +
        `inputmode="numeric" min="1" max="60" placeholder="—" aria-label="${T(lang, "Legrövidebb foglalás ebben az időszakban")}">` +
        `<span>${T(lang, "éj min.")}</span></span>` +
        `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Hozzáadás")}</button>` +
        `</form>` +
        `<p class="citui-hint" style="margin-top:10px">${T(lang, "A dátumot hónap-nap alakban kérjük (06-15). Minden évben ugyanígy érvényes, nem kell újra megadni. A „éj min.” üresen hagyva a foglalás-modulnál beállított általános minimum érvényes.")}</p>` +
        // ③ is this unit let all year, or only in the listed periods?
        `<form method="POST" action="/admin/units/seasonal" class="mcfg-row" style="margin-top:16px">` +
        `<input type="hidden" name="unit" value="${esc(u.id)}">` +
        `<span class="mcfg-row__txt"><strong>${T(lang, "Csak a felsorolt időszakokban adom ki")}</strong>` +
        `<span>${T(lang, "Bekapcsolva a többi napot a vendég nem is tudja kiválasztani. Kikapcsolva egész évben foglalható.")}</span></span>` +
        `<label class="adm-switch"><input type="checkbox" name="seasonal_only" value="1"` +
        `${u.seasonalOnly ? " checked" : ""} onchange="this.form.submit()" ` +
        `aria-label="${T(lang, "Csak a felsorolt időszakokban adom ki")}">` +
        `<span class="tr"></span><span class="th"></span></label>` +
        `<noscript><button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mentés")}</button></noscript>` +
        `</form>` +
        `</div>`
      );
    })
    .join("");

  return (
    `<p class="mcfg-note">${T(lang, "Az árat egységenként adja meg — a vendég is így látja majd.")} ` +
    (data.units.length > 1
      ? T(lang, "Minden szobának/apartmannak saját ára lehet.")
      : T(lang, "Ha több szobát ad ki külön, előbb vegye fel őket a „Szobák, apartmanok” modulnál.")) +
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
  /** Invoice months per year on an ANNUAL subscription (12 − free months, today
   *  10); 0 on a monthly account. Approved contract: a price shown to the owner
   *  is shown in the period he is actually billed in — the Modulok tab chips and
   *  this screen must not disagree (design-refs/console/modules-annual-pricing/). */
  readonly annualMult?: number;
  /** Guest reviews awaiting or past the owner's verdict (ADR-0046). */
  readonly reviews?: ReviewsEditorData;
  /** The shared photo library, so a ROOM CARD can assign pictures without
   *  sending the owner to the Fotók tab (approved plan B, 2026-08-25). */
  readonly photoLibrary?: readonly PhotoEdit[];
  /** Rooms screen: state of the amenities module for the per-unit picker
   *  (owner decision 2026-08-26: unit amenities need rooms AND amenities). */
  readonly unitAmenities?: UnitAmenityContext;
  /** ADR-0067: the site's own language — the settings screens render in it. */
  readonly lang?: string;
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
  const lang = opts.lang ?? "hu";
  const def = MODULE_CONFIG_REGISTRY[moduleId];
  const cat = MODULE_CATALOG.find((m) => m.id === moduleId);
  if (!def || !cat) {
    return `<div class="adm-card"><p class="citui-hint">${T(lang, "Ez a modul nem található.")}</p></div>`;
  }
  const back = `<a class="mcfg-back" href="/admin?tab=modulok">‹ ${T(lang, "Vissza a modulokhoz")}</a>`;
  const errs = opts.errors?.length
    ? `<div class="mcfg-err"><strong>Nem tudtuk menteni:</strong><ul>` +
      opts.errors.map((e) => `<li>${esc(e)}</li>`).join("") +
      `</ul></div>`
    : "";

  // AMENITIES (approved plan F): the module keeps its `items` lines storage, but
  // the screen is the icon picker, not a textarea. The picker posts `am` (checked
  // catalogue labels) + `other` free lines; the route composes them back into
  // `items` — storage, guest render and the multilang path stay untouched.
  const amenityStored = moduleId === "amenities" ? splitAmenities(
    Array.isArray(opts.values.items) ? (opts.values.items as unknown[]).map(String) : [],
  ) : null;

  const bespoke =
    def.editor === "booking" && opts.booking
      ? bookingEditor(moduleId, opts.booking, lang)
      : def.editor === "rooms" && opts.units
        ? // The SAME units card the booking screen shows — one truth, two doors.
          `<p class="mcfg-note">${T(lang, "Ezek jelennek meg az oldalán. Ugyanezeket az egységeket használja a foglalás és az árazás is, tehát elég egy helyen karbantartani.")}</p>` +
          unitsCard({ units: opts.units, unitId: opts.units[0]?.id ?? "" } as BookingEditorData) +
          unitContentCards(opts.units, opts.photoLibrary ?? [], lang, opts.unitAmenities) +
          amenityPickerScript(lang)
        : def.editor === "pricing" && opts.pricing
          ? pricingEditor(opts.pricing, lang)
          : def.editor === "reviews" && opts.reviews
            ? reviewsEditor(opts.reviews, lang)
            : amenityStored
              ? `<form method="POST" action="/admin/module-config" class="adm-card">` +
                `<input type="hidden" name="module" value="amenities">` +
                `<div class="adm-card__head"><span class="adm-ico">${ic("settings")}</span><h2>${esc(T(lang, cat.publicLabel))}</h2></div>` +
                `<p class="adm-lead">${T(lang, "Koppintson arra, ami az egész szállásra igaz. A szobánkénti eltéréseket a Szobák modulban, az adott szobánál állítja be.")}</p>` +
                amenityPicker({
                  scope: "property",
                  selected: amenityStored.selected,
                  other: amenityStored.other,
                  idPrefix: "amp_site",
                  checkName: "am",
                  otherName: "other",
                  lang,
                }) +
                `<div style="margin-top:20px"><button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Beállítások mentése")}</button>` +
                (opts.canRestore
                  ? ` <button class="citui-btn citui-btn--ghost" type="submit" formaction="/admin/module-config/restore">${T(lang, "Vissza az előzőre")}</button>`
                  : "") +
                `</div></form>` +
                amenityPickerScript(lang)
              : "";

  // Literal anchors on purpose: the coverage gate extracts the helpLink call sites.
  const help =
    def.editor === "booking" && opts.booking
      ? helpLink("admin.modules.booking", lang)
      : def.editor === "rooms" && opts.units
        ? helpLink("admin.modules.rooms", lang)
        : def.editor === "pricing" && opts.pricing
          ? helpLink("admin.modules.pricing", lang)
          : amenityStored
            ? helpLink("admin.modules.amenities", lang)
            : helpLink("admin.modules.settings", lang);

  // amenityStored set → the picker above IS the form; the generic one would duplicate it.
  const form = def.fields.length && !amenityStored
    ? `<form method="POST" action="/admin/module-config" class="adm-card">` +
      `<input type="hidden" name="module" value="${esc(moduleId)}">` +
      `<div class="adm-card__head"><span class="adm-ico">${ic("settings")}</span>` +
      `<h2>${bespoke ? T(lang, "Szabályok") : esc(T(lang, cat.publicLabel))}</h2></div>` +
      (bespoke
        ? `<p class="adm-lead">${T(lang, "Ezeket ritkán kell módosítani — alapból működnek.")}</p>`
        : `<p class="adm-lead">${esc(T(lang, cat.publicDesc))}</p>`) +
      def.fields.map((f) => renderField(f, opts.values[f.key], lang)).join("") +
      `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">` +
      `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Beállítások mentése")}</button>` +
      (opts.canRestore
        ? `<button class="citui-btn citui-btn--ghost" type="submit" formaction="/admin/module-config/restore">${T(lang, "Vissza az előzőre")}</button>`
        : "") +
      `</div></form>`
    : "";

  const priceNote =
    opts.priceMonthly && opts.priceMonthly > 0
      ? `<p class="mcfg-price">${esc(T(lang, cat.publicLabel))} · ${priceInPeriod(opts.priceMonthly, opts.annualMult ?? 0, lang)}</p>`
      : "";

  // An editor that is declared but not built yet is stated plainly, at the bottom,
  // rather than leaving the owner staring at a screen that seems to be missing something.
  const pendingNote =
    def.editor && !IMPLEMENTED_EDITORS.has(def.editor) && def.editorNote
      ? `<p class="mcfg-note" style="margin:18px 0 0">${esc(def.editorNote)}</p>`
      : "";

  // The booking screen wears the approved HEADER BLOCK (owner, 2026-09-08): the same
  // four things — what this is, what it costs, back, help — but as one block instead
  // of four stacked rows. The other settings screens keep their current opening,
  // because their KB screenshots are frozen against it.
  if (def.editor === "booking" && opts.booking) {
    return (
      moduleHeader(
        T(lang, cat.publicLabel),
        opts.priceMonthly ?? null,
        "admin.modules.booking",
        lang,
        opts.annualMult ?? 0,
      ) +
      errs +
      bespoke +
      form +
      pendingNote
    );
  }
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
  /** ADR-0067: reader's language (the site's own). */
  lang?: string;
  /** Accept only: overlapping pending requests auto-declined alongside. */
  autoDeclined?: number;
}): string {
  const lang = r.lang ?? "hu";
  const who = r.guestName ? esc(r.guestName) : T(lang, "a vendég");
  const when =
    r.dateFrom && r.dateTo ? `${esc(huDay(r.dateFrom))} — ${esc(huDay(r.dateTo))}` : "";

  const auto =
    r.outcome === "accepted" && (r.autoDeclined ?? 0) > 0
      ? " " +
        T(
          lang,
          "Az időszakot kérő {n} másik kérést automatikusan elutasítottuk — azok a vendégek is e-mailt kaptak.",
          { n: r.autoDeclined! },
        )
      : "";
  const M: Record<string, { title: string; body: string; tone: string }> = {
    accepted: {
      title: "Elfogadva",
      body:
        T(lang, "Visszaigazoltuk {who} foglalását{when}, és e-mailben értesítettük. A napok mostantól foglaltak a naptárban.", { who, when: when ? ` (${when})` : "" }) + auto,
      tone: "ok",
    },
    declined: {
      title: T(lang, "Elutasítva"),
      body: T(lang, "Értesítettük {who}, hogy a kért időpont{when} nem szabad. A naptár nem változott.", { who, when: when ? ` (${when})` : "" }),
      tone: "muted",
    },
    already: {
      title: T(lang, "Erről már döntött"),
      body: T(lang, "Ezt a kérést korábban már elintézte, nem történt újabb változás."),
      tone: "muted",
    },
    conflict: {
      title: T(lang, "Ezek a napok időközben elkeltek"),
      body: T(lang, "Nem tudtuk elfogadni, mert {when}időközben foglalttá vált. A vendég nem kapott visszaigazolást — kérjük, egyeztessen vele közvetlenül.", { when: when ? `${when} ` : "" }),
      tone: "bad",
    },
    unknown: {
      title: T(lang, "Ez a link már nem él"),
      body: T(lang, "Lehet, hogy régi levélből nyitotta meg. A foglalási kéréseit az admin felületen is megtalálja."),
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
    `<p style="margin-top:26px"><a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&m=booking">${T(lang, "Foglalások megnyitása")}</a></p>` +
    `</div></div></body></html>`
  );
}

/* ── Guest cancel screens (approved plan C, 2026-09-06) ─────────────────────
   The cancel link in the confirmation mail opens a CONFIRM page — a stray tap
   must never end a booking. The POST frees the nights; the done page says so. */

/**
 * Shared shell for the guest-facing cancel pages (site language, citui tokens).
 *
 * Elek FK-007 (2026-09-11): these pages were unbranded dead-ends. The guest opens a
 * link from a mail signed by "ELEK-TESZT Vendégház" and lands on a white card that
 * never names the property — immediately above an irreversible red button. So the
 * shell carries the host's name at the top and a way BACK to their page at the
 * bottom. Both are optional: a stale token resolves neither, and half a header is
 * better than an invented one (§B.17).
 */
function guestPageShell(
  title: string,
  inner: string,
  opts: { host?: string | null; back?: string | null; backLabel?: string } = {},
): string {
  const head = opts.host
    ? `<p style="font-weight:800;font-size:1rem;color:var(--citui-navy-900);margin:0 0 14px;` +
      `padding-bottom:12px;border-bottom:1px solid var(--citui-line)">${esc(opts.host)}</p>`
    : "";
  const foot =
    opts.back && opts.backLabel
      ? `<p style="margin:18px 0 0"><a href="${esc(opts.back)}" class="citui-btn citui-btn--ghost" ` +
        `style="text-decoration:none;display:inline-block">${esc(opts.backLabel)}</a></p>`
      : "";
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<link rel="stylesheet" href="/assets/ui/citui.css">` +
    `<title>${esc(title)}</title></head><body>` +
    `<div class="citui-container" style="max-width:520px;padding:48px 20px">` +
    `<div class="citui-card">${head}${inner}${foot}</div></div></body></html>`
  );
}

export interface GuestCancelView {
  readonly outcome: string;
  readonly guestName?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly hostName?: string;
  readonly lang?: string;
  /** The property's own page — the door out of these pages. */
  readonly siteUrl?: string;
  /** Booking reference, so the guest can see WHICH stay this is about. */
  readonly ref?: string;
}

/** GET /foglalas/<token>/lemondom — the confirm step (nothing has happened yet). */
export function guestCancelConfirmPage(v: GuestCancelView, token: string): string {
  const lang = v.lang ?? "hu";
  if (v.outcome === "unknown" || v.outcome === "not_accepted" || v.outcome === "already") {
    // Loud dead-end (approved contract): a used or stale link says so, no silent nothing.
    const msg =
      v.outcome === "already"
        ? T(lang, "Ezt a foglalást korábban már lemondták — nincs újabb teendő.")
        : T(lang, "Ez a lemondó-link már nem él. Ha kérdése van, válaszoljon a foglalásról kapott levélre.");
    return guestPageShell(
      T(lang, "A link már nem él"),
      `<h1 style="font-size:1.4rem;margin-top:0">${T(lang, "A link már nem él")}</h1>` +
        `<p style="font-size:1rem;line-height:1.7">${msg}</p>`,
      { host: v.hostName, back: v.siteUrl, backLabel: T(lang, "Vissza a szállás oldalára") },
    );
  }
  const when = `${esc(huDay(v.dateFrom!))} — ${esc(huDay(v.dateTo!))}`;
  return guestPageShell(
    T(lang, "Foglalás lemondása"),
    `<h1 style="font-size:1.4rem;margin-top:0;color:var(--citui-navy-900)">${T(lang, "Biztosan lemondja a foglalását?")}</h1>` +
      `<div style="background:color-mix(in srgb,var(--citui-bad) 7%,var(--citui-white));` +
      `border:1px solid color-mix(in srgb,var(--citui-bad) 30%,transparent);border-radius:13px;` +
      `padding:14px 16px;margin:14px 0;font-size:.95rem;line-height:1.6">` +
      `<b>${esc(v.guestName ?? "")} · ${when}</b>${v.ref ? ` · ${esc(v.ref)}` : ""}<br>` +
      `${T(lang, "A lemondás végleges: a napok felszabadulnak, és a szállásadó azonnal értesítést kap. Ha csak módosítani szeretne, inkább írjon a szállásadónak.")}` +
      `</div>` +
      `<form method="post" action="/foglalas/${esc(token)}/lemondom">` +
      `<label style="display:block;font-weight:700;font-size:.88rem;margin-bottom:6px">${T(lang, "Üzenet a szállásadónak (nem kötelező)")}</label>` +
      `<textarea name="uzenet" maxlength="1000" style="width:100%;box-sizing:border-box;border:1.5px solid var(--citui-line);border-radius:11px;padding:10px 12px;font:inherit;min-height:72px"></textarea>` +
      `<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px">` +
      `<button type="submit" class="citui-btn" style="background:var(--citui-bad);border-color:var(--citui-bad)">${T(lang, "Igen, lemondom a foglalást")}</button>` +
      // "Zárja be ezt az oldalt" is not a way out, it is the absence of one — and it
      // sat under the red button as the only alternative (Elek FK-007). The way back
      // must be a BUTTON next to the irreversible one, not a sentence below it.
      (v.siteUrl
        ? `<a href="${esc(v.siteUrl)}" class="citui-btn citui-btn--ghost" style="text-decoration:none;display:inline-block">${T(lang, "Mégsem — megtartom")}</a>`
        : "") +
      `</div></form>` +
      `<p style="font-size:.82rem;color:var(--citui-muted);line-height:1.6;margin-top:16px">${T(lang, "Amíg nem nyomja meg a piros gombot, a foglalása változatlanul él.")}</p>`,
    {
      host: v.hostName,
      // No second exit at the bottom: the "Mégsem" above IS the way back, and two
      // buttons doing the same thing on one short page read as two choices.
      backLabel: undefined,
    },
  );
}

/** POST result — the nights are free, both sides told. */
export function guestCancelDonePage(v: GuestCancelView): string {
  const lang = v.lang ?? "hu";
  if (v.outcome !== "cancelled") return guestCancelConfirmPage(v, "");
  const when = `${esc(huDay(v.dateFrom!))} — ${esc(huDay(v.dateTo!))}`;
  return guestPageShell(
    T(lang, "Foglalása lemondva"),
    `<h1 style="font-size:1.4rem;margin-top:0;color:var(--citui-navy-900)">${T(lang, "Foglalása lemondva")}</h1>` +
      `<div style="background:var(--citui-ok-soft);border:1px solid color-mix(in srgb,var(--citui-ok) 35%,transparent);` +
      `border-radius:13px;padding:14px 16px;font-size:.95rem;line-height:1.7">` +
      T(lang, "A {when} közötti foglalás lemondva, a napok felszabadultak. A szállásadó értesítést kapott, és Ön is kap egy megerősítő e-mailt.", { when }) +
      (v.ref ? `<br><span style="font-size:.85rem">${T(lang, "Hivatkozás:")} ${esc(v.ref)}</span>` : "") +
      `</div>`,
    { host: v.hostName, back: v.siteUrl, backLabel: T(lang, "Vissza a szállás oldalára") },
  );
}

/** The owner's one-tap verdict on a guest review (ADR-0046), same shape as booking. */
export function reviewVerdictPage(r: {
  ok: boolean;
  outcome: string;
  authorName?: string;
  /** ADR-0067: reader's language (the site's own). */
  lang?: string;
}): string {
  const lang = r.lang ?? "hu";
  const who = r.authorName ? esc(r.authorName) : T(lang, "a vendég");
  const M: Record<string, { title: string; body: string; tone: string }> = {
    published: {
      title: T(lang, "Kikerült az oldalra"),
      body: T(lang, "{who} véleménye mostantól látható az oldalán. Ha megadta az e-mail címét, értesítettük róla.", { who }),
      tone: "ok",
    },
    rejected: {
      title: T(lang, "Nem tesszük ki"),
      body: T(lang, "{who} véleménye nem jelenik meg az oldalán. A vendég erről nem kap értesítést.", { who }),
      tone: "muted",
    },
    already: {
      title: T(lang, "Erről már döntött"),
      body: T(lang, "Ezt a véleményt korábban már elintézte, nem történt újabb változás."),
      tone: "muted",
    },
    unknown: {
      title: T(lang, "Ez a link már nem él"),
      body: T(lang, "Lehet, hogy régi levélből nyitotta meg. A véleményeket az admin felületen is megtalálja."),
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
    `<p style="margin-top:26px"><a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&m=reviews">${T(lang, "Vélemények megnyitása")}</a></p>` +
    `</div></div></body></html>`
  );
}

/**
 * What the GUEST sees after submitting. Deliberately honest that a human still has
 * to approve it — a "köszönjük, megjelent!" would be a small lie, and the guest
 * would come back to look for words that are not there yet.
 */
export function reviewThanksPage(opts: { errors?: string[]; backUrl: string; lang?: string }): string {
  const lang = opts.lang ?? "hu";
  const bad = opts.errors?.length;
  const title = bad ? T(lang, "Nem sikerült elküldeni") : T(lang, "Köszönjük a véleményét");
  const body = bad
    ? `<ul style="text-align:left;line-height:1.8">${opts.errors!.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`
    : `<p style="font-size:1.02rem;line-height:1.7">${T(lang, "Elküldtük a szállásadónak. A véleménye azután jelenik meg az oldalon, hogy jóváhagyta.")}</p>`;
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
