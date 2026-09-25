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
//   · jargon is banned: "Mikor nem kiadó?", never "availability"; the word iCal
//     never appears — the owner sees "Booking.com összekötése".
//   · every screen states what happens next in plain terms.
//
// Colours/typography come only from the design core (--citui-*), per ADR-0021 ①.

import {
  MODULE_CONFIG_REGISTRY,
  type ModuleConfigValues,
  type ModuleField,
} from "../moduleConfig.js";
import { currencySign } from "../text/money.js";
import { formatMoney, formatNumber } from "../text/money.js";
import { MODULE_CATALOG } from "../modules.js";
import type { MonthView } from "../tenant/availability.js";
import type { UnitPriceStatus } from "../tenant/prices.js";
import type { PhotoEdit } from "../tenant/editor.js";
import { icAdmin as ic } from "../ui/icons.js";
import { SEASON_JS, seasonRule } from "../tenant/seasonRule.js";
import { huArticleLower } from "../hu.js";
import { T } from "../i18n/mail.js";
import {
  AMENITY_CATALOG,
  AMENITY_CATEGORIES,
  amenityByLabel,
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
/* ── Automata heti programajánló (poi) — approved contract B,
   assets/design-refs/console/programajanlo/. Two panes need 720px of CONTAINER
   width (@container, not @media: the admin column is narrower than the window). */
.pa{container-type:inline-size}
.pa-intro b{color:var(--citui-ink)}
.pa-tabs{display:flex;gap:6px;margin-bottom:12px}
.pa-tabs button{flex:1;border:1px solid var(--citui-line-strong);background:var(--citui-panel);
  border-radius:var(--citui-radius-pill);padding:9px 8px;font:700 .82rem/1 var(--citui-font-text);
  color:var(--citui-muted);cursor:pointer}
.pa-tabs button.is-on{background:var(--citui-navy-900);border-color:var(--citui-navy-900);color:var(--citui-white)}
.pa-cols{display:grid;grid-template-columns:1fr;gap:16px}
.pa-pane{min-width:0;display:flex;flex-direction:column}
.pa-pane.is-hide{display:none}
@container (min-width:720px){
  .pa-tabs{display:none}
  .pa-cols{grid-template-columns:1fr 1fr;gap:20px;align-items:stretch}
  .pa-pane.is-hide{display:flex}
}
.pa-paneh{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}
.pa-paneh h3{margin:0;font:700 .92rem/1.3 var(--citui-font-display);color:var(--citui-ink)}
.pa-c{font-size:.8rem;color:var(--citui-muted);font-variant-numeric:tabular-nums}
.pa-c.is-full{color:var(--citui-warn-ink);font-weight:700}
.pa-box{border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);background:var(--citui-surface);
  padding:6px;flex:1;display:flex;flex-direction:column}
.pa-box--sel{background:var(--citui-ok-soft);border-color:color-mix(in srgb,var(--citui-ok) 28%,transparent)}
.pa-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  padding:22px 12px;text-align:center;color:var(--citui-muted);font-size:.84rem;line-height:1.5;min-height:140px}
.pa-empty svg{color:var(--citui-line-strong)}
.pa-it{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;background:var(--citui-panel);
  border:1px solid var(--citui-line);border-radius:11px;padding:9px 10px;margin:5px 0}
.pa-body{min-width:0}
.pa-d{font:700 .72rem/1 var(--citui-font-display);color:var(--citui-link-ink);letter-spacing:.3px}
.pa-n{font:600 .88rem/1.3 var(--citui-font-text);margin-top:3px;overflow-wrap:anywhere;color:var(--citui-ink)}
.pa-n[contenteditable=true]{outline:2px solid var(--citui-cyan-500);outline-offset:2px;border-radius:4px}
.pa-m{font-size:.75rem;color:var(--citui-muted);margin-top:2px;overflow-wrap:anywhere}
.pa-m a{color:var(--citui-link-ink);text-decoration:underline;text-underline-offset:2px}
.pa-dist.is-here{font-weight:700;color:var(--citui-ok-ink)}
.pa-acts{display:flex;gap:5px;align-items:center}
.pa-ctrl{display:flex;flex-direction:column;gap:3px}
.pa-ctrl button{width:28px;height:24px;border:1px solid var(--citui-line-strong);background:var(--citui-panel);
  border-radius:7px;font:700 .8rem/1 var(--citui-font-text);color:var(--citui-ink);cursor:pointer;padding:0}
.pa-ctrl button:disabled,.pa-add:disabled{opacity:.3;cursor:not-allowed}
.pa-add{width:30px;height:30px;border-radius:50%;border:1px solid var(--citui-cyan-500);background:var(--citui-panel);
  color:var(--citui-link-ink);font:700 1.05rem/1 var(--citui-font-text);cursor:pointer;padding:0}
.pa-add:disabled{border-color:var(--citui-line-strong);color:var(--citui-muted)}
.pa-rm{width:30px;height:30px;border-radius:50%;border:1px solid var(--citui-line-strong);background:var(--citui-panel);
  color:var(--citui-muted);font:700 1rem/1 var(--citui-font-text);cursor:pointer;padding:0}
.pa-pen{border:1px solid var(--citui-line-strong);background:var(--citui-panel);border-radius:7px;
  padding:2px 8px;font:600 .7rem/1.35 var(--citui-font-text);cursor:pointer;color:var(--citui-ink)}
.pa-full{background:color-mix(in srgb,var(--citui-warn) 10%,var(--citui-panel));
  border:1px solid color-mix(in srgb,var(--citui-warn) 45%,transparent);border-radius:11px;
  padding:9px 11px;font:700 .8rem/1.4 var(--citui-font-text);color:var(--citui-warn-ink);margin-bottom:8px}
.pa-full[hidden],.pa-saved[hidden],.pa-auto[hidden]{display:none}
.pa-auto{margin:0 0 10px;font-size:.84rem;color:var(--citui-muted)}
.pa-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:18px;padding-top:16px;border-top:1px solid var(--citui-line)}
.pa-sp{flex:1}
.pa-saved{display:inline-flex;align-items:center;gap:6px;color:var(--citui-ok-ink);font-weight:700;font-size:.88rem}
.pa-refresh{margin:14px 0 0;background:var(--citui-surface-2);border-radius:var(--citui-radius-sm);
  padding:11px 13px;font-size:.82rem;color:var(--citui-muted);line-height:1.5}
.pa-refresh b{color:var(--citui-ink)}
.mcfg-back{display:inline-flex;align-items:center;gap:6px;color:var(--citui-muted);
  text-decoration:none;font-size:.92rem;margin-bottom:12px}
.mcfg-back:hover{color:var(--citui-ink)}
.mcfg-price{font-size:.82rem;color:var(--citui-muted)}
.mcfg-note{background:var(--citui-surface-2);border:1px solid var(--citui-line);
  border-radius:var(--citui-radius-sm);padding:12px 14px;color:var(--citui-muted);
  font-size:.92rem;margin:0 0 18px}
/* Állapot-függő emlékeztető: NEM hiba (az üres mező jogos állapot, §B.17 szerint
   inkább nincs szám, mint kitalált), ezért borostyán és nem piros — de nem is néma. */
.mcfg-empty{display:flex;align-items:flex-start;gap:8px;margin:8px 0 0;padding:10px 12px;
  border-radius:var(--citui-radius-sm);font-size:.88rem;line-height:1.55;
  color:var(--citui-ink);
  background:color-mix(in srgb,var(--citui-warn) 10%,var(--citui-panel));
  border:1px solid color-mix(in srgb,var(--citui-warn) 38%,transparent)}
.mcfg-empty svg{flex:0 0 auto;margin-top:2px;color:var(--citui-warn)}
/* ADR-0208 ⑥.2: the owner's STATED decision is not a warning — same shape, calm colour. */
.mcfg-empty--said{background:var(--citui-surface-2);border-color:var(--citui-line)}
.mcfg-empty--said svg{color:var(--citui-cyan-500)}
.pr-decl{display:flex;align-items:flex-start;gap:10px;margin:0 0 12px;padding:11px 12px;
  border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-sm);cursor:pointer;
  font-size:.92rem;line-height:1.45}
.pr-decl input{width:20px;height:20px;margin:1px 0 0;flex:none;accent-color:var(--citui-navy-800)}
.pr-decl strong{display:block;font-weight:600}
.pr-decl span span{display:block;color:var(--citui-muted);font-size:.84rem;margin-top:2px}
.pr-decl.is-off{opacity:.55;cursor:not-allowed}
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
.mcfg-bkline a{display:inline-block;margin-top:6px;font-weight:600;white-space:nowrap}
/* Approved plan B (design-refs/console/pricing-rooms-link): the note is a row — text
   left, the rooms button right; below 640px of ITS OWN width the button drops under
   the text and spans it. @container on the note itself (the admin column is narrower
   than the window, so @media would lie). */
.mcfg-note--act{container-type:inline-size;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between}
.mcfg-note--act>span{flex:1 1 320px}
.mcfg-note--act .citui-btn{flex:0 0 auto;white-space:nowrap}
@container (max-width:639px){.mcfg-note--act .citui-btn{width:100%}}

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
  border-color:var(--citui-ink);font-weight:600}
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

/* (ADR-0224: the Fotók tab's photo kit moved to citui-admin.css — .adm-t / .adm-r) */

/* ── unit rows ──────────────────────────────────────────────────────── */
.unit-row{display:flex;align-items:center;gap:10px;padding:12px 0;
  border-bottom:1px solid var(--citui-line);flex-wrap:wrap}
.unit-row--new{border-bottom:0;padding-top:16px}
.unit-row__name{flex:1;min-width:160px}
.unit-row__cap{width:90px}
.unit-row__price{width:130px}
.unit-row--new .pr-decl{flex-basis:100%;margin:0}
.nu-flash{margin:0 0 16px;scroll-margin-top:16px}
.nu-flash .mcfg-empty{margin:0}
.nu-flash__acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.nu-flash__acts form{margin:0}
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
.price-new .mcfg-suffix>span{white-space:nowrap}
@media(max-width:520px){
  .price-new{flex-direction:column;align-items:stretch}
  /* Measured 2026-09-23 @390px: the date and amount rows were 482px wide in a 320px
     card — flex items default to min-width:auto, so the inputs' intrinsic width won
     and the second date field was cut off. Let every row shrink to the card. */
  .price-new>*{min-width:0}
  .price-new__dates .citui-input,.price-new .mcfg-suffix .citui-input{flex:1 1 0;width:0;max-width:none}
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
  .unit-row__price{width:100%}
  .breq__act,.breq__act form{width:100%}
  .breq__act .citui-btn{flex:1}
}

/* ══ SZOBA-SZERKESZTŐ — a jóváhagyott D kontraktus (ADR-0198) ══════════════════
   assets/design-refs/tenant-admin/room-editor/README.md. Kártyarács + felugró +
   fülek. A felugró :target-tel nyílik és rádió-gombos fülekkel vált, tehát
   JavaScript NÉLKÜL is teljes — ugyanaz a szabály, mint a naptáré. */
.rs-head{display:flex;align-items:flex-start;gap:10px;margin:0 0 14px}
.rs-head h1{margin:0;font:600 1.15rem/1.25 var(--citui-font-display);color:var(--citui-ink)}
.rs-head p{margin:4px 0 0;color:var(--citui-muted);font-size:.85rem;line-height:1.5}
.rs-head .adm-ico{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;flex:none;
  background:var(--citui-navy-900);color:var(--citui-cyan-300)}
@media(min-width:900px){.rs-head h1{font-size:1.45rem}.rs-head p{font-size:.92rem}}

/* ── a rács: mobilon KÉT oszlop (mind a négy szoba egy képernyőn), asztalin négy ── */
.rs-grid{display:grid;gap:10px;grid-template-columns:1fr 1fr}
@media(min-width:900px){.rs-grid{grid-template-columns:repeat(4,1fr);gap:14px}}
.rs-gcard{background:var(--citui-panel);border:1px solid var(--citui-line);
  border-radius:var(--citui-radius-sm);overflow:hidden;text-align:left;padding:0;
  font:inherit;color:var(--citui-ink);text-decoration:none;
  display:flex;flex-direction:column;transition:var(--citui-transition)}
.rs-gcard:hover{border-color:var(--citui-cyan-500);box-shadow:var(--citui-shadow-sm)}
.rs-gcard:focus-visible{outline:2px solid var(--citui-cyan-500);outline-offset:2px}
.rs-gim{position:relative;width:100%;aspect-ratio:4/3;background:var(--citui-surface-2)}
.rs-gim img{width:100%;height:100%;object-fit:cover;display:block}
.rs-cover__none{display:grid;place-items:center;height:100%;color:var(--citui-muted);
  font-size:.7rem;text-align:center;padding:8px;line-height:1.3}
.rs-gcount{position:absolute;right:6px;bottom:6px;display:inline-flex;align-items:center;gap:4px;
  background:color-mix(in srgb,var(--citui-navy-950) 74%,transparent);color:var(--citui-white);
  font:700 .62rem/1 var(--citui-font-text);padding:5px 8px;border-radius:var(--citui-radius-pill)}
.rs-gcount svg{width:11px;height:11px}
.rs-gbd{padding:9px 10px 11px;display:grid;gap:5px}
.rs-gbd b{font:600 .88rem/1.25 var(--citui-font-display);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
/* ⛔ A :not(.rs-b) KELL: a .rs-gbd span (0,1,1) VERNÉ a .rs-b--ok/--warn (0,1,0)
   színét, és mind a négy státusz-jelvény semleges szürke lenne — a szín elvesztené a
   jelentését (mérve a terv-körben: a kontraszt 5,5-ről 4,2-re esett). Ugyanaz a fajta
   ütközés, mint amikor egy link-szabály ette meg a gomb színét. */
.rs-gbd>span:not(.rs-b){color:var(--citui-muted);font-size:.74rem}
/* a jelvény a SZÖVEGÉIG érjen, ne a kártya széléig (rács-cellában a nyújtás az alap) */
.rs-gbd>.rs-b{justify-self:start}
@media(min-width:900px){.rs-gbd b{font-size:1rem}.rs-gbd>span:not(.rs-b){font-size:.8rem}}

/* ⛔ NINCS white-space:nowrap — azzal a hosszú állapot-szöveg darabja a kártya
   overflow:hidden-je alá esne, vagyis pont AZT nem lehetne elolvasni, AMI HIÁNYZIK.
   A jelvény inkább TÖRJÖN KÉT SORBA. */
.rs-b{display:inline-flex;align-items:flex-start;gap:4px;
  font:600 .68rem/1.35 var(--citui-font-text);border-radius:12px;padding:5px 9px;
  white-space:normal;text-align:left;max-width:100%}
.rs-b svg{width:12px;height:12px;flex:none;margin-top:1px}
.rs-b--ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.rs-b--warn{background:color-mix(in srgb,var(--citui-warn) 15%,var(--citui-panel));
  color:var(--citui-warn-ink)}
.rs-b--clash{background:color-mix(in srgb,var(--citui-bad) 12%,var(--citui-panel));
  color:var(--citui-bad-ink)}

/* ── új egység: a rács alatt, egyetlen szaggatott vezérlő ── */
.rs-new{border:1.5px dashed var(--citui-line-strong);border-radius:var(--citui-radius-sm);
  margin-top:12px;background:transparent}
.rs-new>summary{display:flex;align-items:center;gap:9px;padding:13px;cursor:pointer;
  font:600 .88rem/1 var(--citui-font-text);color:var(--citui-link-ink);list-style:none}
.rs-new>summary::-webkit-details-marker{display:none}
.rs-new>summary svg{width:18px;height:18px}
.rs-new:hover{border-color:var(--citui-cyan-500)}
.rs-new .unit-row{padding:0 13px 13px;margin:0}

/* ── a felugró: :target = nulla JS ── */
.rs-modal{display:none}
.rs-modal:target{display:block}
.rs-backdrop{position:fixed;inset:0;z-index:59;
  background:color-mix(in srgb,var(--citui-navy-950) 62%,transparent)}
/* KÖT: mobilon majdnem teljes képernyő, de LÁTHATÓ kerettel — ha kitöltené, már nem
   felugrónak, hanem másik oldalnak olvasódna. */
.rs-pop{position:fixed;z-index:60;left:9px;right:9px;top:15px;
  bottom:max(15px,env(safe-area-inset-bottom));display:flex;flex-direction:column;
  overflow:hidden;background:var(--citui-panel);border-radius:18px;
  box-shadow:var(--citui-shadow-md);border:1px solid var(--citui-line-strong)}
/* KÖT: asztalin NEM lapot borít — középre zárt párbeszéd, a rács ott marad mögötte. */
@media(min-width:900px){
  .rs-pop{left:50%;right:auto;transform:translateX(-50%);width:min(960px,92%);top:34px;bottom:34px}
}
.rs-pop__top{flex:none;display:flex;align-items:center;gap:10px;padding:11px 12px;
  background:var(--citui-navy-900);color:var(--citui-white)}
.rs-pop__top b{font:600 .98rem/1.2 var(--citui-font-display);flex:1;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.rs-pop__meta{font-size:.76rem;color:var(--citui-cyan-300);white-space:nowrap;flex:none}
.rs-pop__x{width:34px;height:34px;border-radius:50%;border:1px solid var(--citui-line-strong);
  background:transparent;color:var(--citui-white);cursor:pointer;display:grid;place-items:center;
  flex:none;text-decoration:none}
.rs-pop__x:hover{background:var(--citui-cyan-500);color:var(--citui-navy-950);
  border-color:var(--citui-cyan-500)}
@media(min-width:900px){.rs-pop__top{padding:14px 18px}.rs-pop__top b{font-size:1.15rem}}
.rs-pop__body{flex:1;overflow-y:auto;padding:14px 12px}
@media(min-width:900px){.rs-pop__body{padding:20px 22px}}
/* KÖT: a Mentés RÖGZÍTETT lábazatban — a törzs görget, a lábazat nem mozdul. */
.rs-pop__foot{flex:none;border-top:1px solid var(--citui-line);background:var(--citui-panel);
  padding:10px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
@media(min-width:900px){.rs-pop__foot{padding:12px 22px}}
.rs-del{margin-left:auto;background:transparent;border:0;cursor:pointer;color:var(--citui-muted);
  font:600 .76rem/1 var(--citui-font-text);text-decoration:underline;text-underline-offset:3px}
.rs-del:hover{color:var(--citui-bad)}

/* ── fülek: rádió-gomb + label, tehát JS nélkül is váltanak ── */
.rs-tabin{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.rs-tabs{flex:none;display:flex;gap:4px;border-bottom:1px solid var(--citui-line);padding:0 10px;
  overflow-x:auto;background:var(--citui-surface)}
.rs-tab{padding:11px 10px 9px;font:600 .8rem/1 var(--citui-font-text);color:var(--citui-muted);
  white-space:nowrap;border-bottom:2.5px solid transparent;margin-bottom:-1px;cursor:pointer}
.rs-tab:hover{color:var(--citui-ink)}
.rs-tab em{font-style:normal;font-weight:700;opacity:.7;margin-left:4px}
@media(min-width:900px){.rs-tabs{padding:0 16px}.rs-tab{padding:13px 14px 11px;font-size:.88rem}}
.rs-pane{display:none}
.rs-tabin--alap:checked~.rs-tabs .rs-tab--alap,
.rs-tabin--kep:checked~.rs-tabs .rs-tab--kep,
.rs-tabin--fel:checked~.rs-tabs .rs-tab--fel{color:var(--citui-link-ink);
  border-bottom-color:var(--citui-cyan-500)}
.rs-tabin--alap:checked~.rs-pop__body .rs-pane--alap,
.rs-tabin--kep:checked~.rs-pop__body .rs-pane--kep,
.rs-tabin--fel:checked~.rs-pop__body .rs-pane--fel{display:block}

/* ── szakaszok a felugróban ── */
.rs-sec{display:grid;gap:10px}
.rs-sec>h4{margin:0;font:600 .8rem/1.2 var(--citui-font-text);color:var(--citui-ink);
  display:flex;align-items:center;gap:6px}
.rs-sec>h4 svg{width:15px;height:15px;color:var(--citui-cyan-500)}
.rs-why{margin:0;color:var(--citui-muted);font-size:.76rem;line-height:1.5}
.rs-row2{display:grid;gap:10px;grid-template-columns:1fr}
@media(min-width:560px){.rs-row2{grid-template-columns:1fr 130px}}
/* asztali külön tervezői döntés: űrlap BAL + élő vendég-előnézet JOBB */
@media(min-width:900px){
  .rs-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:22px;
    align-items:start}
}
.rs-gcard--preview{max-width:290px;border-style:dashed}
.rs-gcard--preview:hover{box-shadow:none;border-color:var(--citui-line)}

/* ── a nagy borító-előnézet ── */
.rs-hero{position:relative;border-radius:12px;overflow:hidden;background:var(--citui-surface-2);
  border:1px solid var(--citui-line);aspect-ratio:16/10}
@media(min-width:900px){.rs-hero{aspect-ratio:16/7}}
.rs-hero img{width:100%;height:100%;object-fit:cover;display:block}
.rs-hero .rs-cover__none{font-size:.82rem;padding:14px;line-height:1.4}
.rs-herolab{position:absolute;left:8px;top:8px;display:inline-flex;align-items:center;gap:5px;
  background:color-mix(in srgb,var(--citui-navy-950) 76%,transparent);color:var(--citui-white);
  font:600 .68rem/1 var(--citui-font-text);padding:6px 9px;border-radius:var(--citui-radius-pill)}
.rs-herolab svg{width:12px;height:12px;color:var(--citui-cyan-300)}

/* ── feltöltés: elsődleges gomb a fül TETEJÉN (nem a szalag végén, ahol kiszorul) ── */
.rs-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.rs-upbtn{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.rs-upbtn svg{width:15px;height:15px}
.rs-upbtn input{position:absolute;width:1px;height:1px;opacity:0}

/* ── üzenet-sávok ── */
.rs-msg{display:flex;align-items:flex-start;gap:7px;border-radius:10px;padding:8px 10px;
  font-size:.77rem;line-height:1.45}
.rs-msg svg{width:14px;height:14px;flex:none;margin-top:1px}
.rs-msg--ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.rs-msg--bad{background:color-mix(in srgb,var(--citui-bad) 10%,var(--citui-panel));
  color:var(--citui-bad-ink)}
.rs-msg--warn{background:color-mix(in srgb,var(--citui-warn) 14%,var(--citui-panel));
  color:var(--citui-warn-ink)}
.rs-msg b{font-weight:700}

/* ── a ház KÖZÖS képtára ── */
.rs-lib{border:1px solid var(--citui-line);border-radius:12px;padding:10px;
  background:var(--citui-surface)}
.rs-libgrid{display:grid;gap:8px;grid-template-columns:repeat(3,1fr)}
@media(min-width:560px){.rs-libgrid{grid-template-columns:repeat(4,1fr)}}
/* KÖT: asztalin HAT oszlop — a szélesebb hely vigyen is valamit */
@media(min-width:900px){.rs-libgrid{grid-template-columns:repeat(6,1fr)}}
.rs-libcell{position:relative;display:block;cursor:pointer}
/* KÖT: a nem hozzárendelt kép HALVÁNY — ránézésre látszik, mi tartozik ide */
.rs-libcell img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:9px;display:block;
  border:1px solid var(--citui-line);opacity:.45;transition:var(--citui-transition)}
.rs-libcell input{position:absolute;opacity:0;width:1px;height:1px}
.rs-libtick{position:absolute;left:5px;top:5px;width:20px;height:20px;border-radius:50%;
  display:grid;place-items:center;background:var(--citui-panel);
  border:1px solid var(--citui-line-strong);color:var(--citui-muted)}
.rs-libcell input:checked~.rs-libtick{background:var(--citui-cyan-500);
  border-color:var(--citui-cyan-500);color:var(--citui-navy-950)}
.rs-libcell input:checked~img{opacity:1;border-color:var(--citui-cyan-500);
  box-shadow:0 0 0 2px color-mix(in srgb,var(--citui-cyan-500) 40%,transparent)}
.rs-libtick svg{width:12px;height:12px}
.rs-libcov{position:absolute;right:4px;bottom:4px;border:0;border-radius:var(--citui-radius-pill);
  padding:4px 7px;display:inline-flex;align-items:center;gap:3px;cursor:pointer;
  background:color-mix(in srgb,var(--citui-navy-950) 70%,transparent);color:var(--citui-white);
  font:700 .6rem/1 var(--citui-font-text)}
.rs-libcov svg{width:11px;height:11px}
.rs-libcov[data-on=true]{background:var(--citui-cyan-500);color:var(--citui-navy-950)}
.rs-libcov:hover{background:var(--citui-cyan-400);color:var(--citui-navy-950)}
.rs-libfoot{margin:9px 0 0;color:var(--citui-muted);font-size:.74rem;line-height:1.5}

/* ── felszereltség: kompakt csempék + egy gombra nyíló katalógus ── */
.rs-ams{display:flex;flex-wrap:wrap;gap:6px}
.rs-am{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--citui-line);
  border-radius:var(--citui-radius-pill);padding:5px 9px;background:var(--citui-panel);
  font-size:.75rem;color:var(--citui-ink)}
.rs-am svg{width:14px;height:14px;color:var(--citui-cyan-500);flex:none}
.rs-am--other svg{color:var(--citui-muted)}
.rs-amcat{border:1px solid var(--citui-line);border-radius:12px;background:var(--citui-surface);
  margin-top:4px}
.rs-amcat>summary{display:inline-flex;align-items:center;gap:6px;padding:9px 13px;cursor:pointer;
  font:600 .78rem/1 var(--citui-font-text);color:var(--citui-link-ink);list-style:none}
.rs-amcat>summary::-webkit-details-marker{display:none}
.rs-amcat>summary svg{width:13px;height:13px}
.rs-amcat .ampick{padding:0 10px 10px}
/* ── Review inbox — approved contract B, assets/design-refs/console/reviews-inbox/.
   Grouped by state; rows lay out in three columns once the CONTAINER is 640px. */
.rv-inbox{container-type:inline-size}
.rv-flash{margin:0 0 12px}
.rv-group{margin-top:18px}
.rv-group:first-of-type{margin-top:6px}
.rv-group__h{display:flex;align-items:center;gap:8px;margin:0 0 8px;font:700 .8rem/1 var(--citui-font-display);
  letter-spacing:.5px;text-transform:uppercase;color:var(--citui-muted)}
.rv-group__h .n{font-variant-numeric:tabular-nums;background:var(--citui-surface-2);border-radius:var(--citui-radius-pill);
  padding:3px 8px;color:var(--citui-ink)}
.rv-group--wait .rv-group__h{color:var(--citui-ink)}
.rv-group--wait .rv-group__h .n{background:var(--citui-cyan-500);color:var(--citui-navy-950)}
.rv-group__rows{border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);overflow:hidden;background:var(--citui-panel)}
.rv-group--wait .rv-group__rows{border-color:color-mix(in srgb,var(--citui-cyan-500) 55%,transparent)}
.rv-row{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;padding:14px 16px}
.rv-row + .rv-row{border-top:1px solid var(--citui-line)}
.rv-row__who strong{font:700 .98rem/1.3 var(--citui-font-text);color:var(--citui-ink);overflow-wrap:anywhere}
.rv-row__meta{display:block;font-size:.8rem;color:var(--citui-muted)}
.rv-row__text{min-width:0}
.rv-row__body{margin:2px 0 4px;font-size:.92rem;line-height:1.55;color:var(--citui-ink);overflow-wrap:anywhere}
.rv-row__body--clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.rv-row__tgl{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.rv-row__tgl:checked + .rv-row__body--clamp{display:block;-webkit-line-clamp:unset;overflow:visible}
.rv-row__more{display:inline-block;color:var(--citui-link-ink);font:600 .82rem/1.4 var(--citui-font-text);cursor:pointer}
.rv-row__tgl:focus-visible ~ .rv-row__more{outline:2px solid var(--citui-cyan-500);outline-offset:2px;border-radius:4px}
.rv-more-close{display:none}
.rv-row__tgl:checked ~ .rv-row__more .rv-more-open{display:none}
.rv-row__tgl:checked ~ .rv-row__more .rv-more-close{display:inline}
.rv-row__acts{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 0}
.rv-row__acts .citui-btn{padding:9px 16px;font-size:.88rem}
.rv-group--off .rv-row{background:var(--citui-surface)}
.rv-group--off .rv-row__body{color:var(--citui-muted)}
.rv-group__empty{margin:0;padding:12px 16px;font-size:.86rem;color:var(--citui-muted)}
@container (min-width:640px){
  .rv-row{grid-template-columns:190px minmax(0,1fr) auto;column-gap:20px;align-items:start}
  .rv-row__who{grid-column:1;grid-row:1}
  .rv-row > .rv-stars{grid-column:1;grid-row:2}
  .rv-row__text{grid-column:2;grid-row:1 / span 2}
  .rv-row__acts{grid-column:3;grid-row:1 / span 2;flex-direction:column;align-items:stretch;margin:0}
}
.rv-stars{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.rv-stars__g{font-size:1.02rem;letter-spacing:1px;line-height:1}
.rv-stars__g .on{color:var(--citui-warn)}
.rv-stars__g .off{color:var(--citui-line-strong)}
.rv-stars__n{font:700 .82rem/1 var(--citui-font-text);font-variant-numeric:tabular-nums;color:var(--citui-ink);
  background:var(--citui-surface-2);border-radius:var(--citui-radius-pill);padding:4px 8px}
.rv-stars--low .rv-stars__n{background:color-mix(in srgb,var(--citui-bad) 14%,transparent);color:var(--citui-bad-ink)}
.rv-gr{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 10px}
.rv-gr__num{font:700 2rem/1 var(--citui-font-display);color:var(--citui-ink)}
.rv-gr__cnt{font-size:.88rem;color:var(--citui-muted)}
.rv-gr.is-off > *{opacity:.45}
.rv-gr-state{display:flex;gap:8px;align-items:flex-start;margin:0 0 10px;padding:10px 12px;border-radius:12px;font-size:.88rem;line-height:1.5}
.rv-gr-state svg{flex:none;margin-top:2px}
.rv-gr-state--on{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.rv-gr-state a{color:inherit;font-weight:700}
.rv-gr-state--off{background:color-mix(in srgb,var(--citui-warn) 14%,transparent);color:var(--citui-warn-ink)}
/* ── 0074 season editor + year strip — approved plan season-year-price (B·1),
   assets/design-refs/tenant-admin/season-year-price/. The strip measures ITS OWN
   width (@container), so the phone gets one card + a peeking edge, a desktop ~2⅓. */
.season-block{border-bottom:1px solid var(--citui-line);padding-bottom:14px;margin-bottom:4px;scroll-margin-top:80px}
.season-block .price-row{border-bottom:0}
.season-act{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.season-act form{margin:0}
.s-move{display:inline-flex;flex-direction:column;gap:2px}
.s-move button{width:30px;height:22px;display:grid;place-items:center;padding:0;border-radius:7px;
  border:1px solid var(--citui-line-strong);background:var(--citui-panel);color:var(--citui-ink);cursor:pointer}
.s-move button:disabled{opacity:.3;cursor:default}
.s-move .up svg{transform:rotate(180deg)}
.s-edit{background:var(--citui-surface-2);border-radius:var(--citui-radius-sm);padding:12px;margin:4px 0 10px}
.s-edit__grid{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.s-edit__grid>.citui-input{flex:1;min-width:140px}
.s-edit .price-new__dates .citui-input{width:84px;text-align:center}
.s-edit .mcfg-suffix>span{white-space:nowrap}
.s-prev{margin:10px 0 0;font-size:.86rem;line-height:1.5;padding:9px 11px;border-radius:var(--citui-radius-sm);
  background:var(--citui-panel);border:1px solid var(--citui-line)}
.s-prev b{color:var(--citui-ink)}
.s-prev--bad{color:var(--citui-bad);border-color:color-mix(in srgb,var(--citui-bad) 40%,transparent)}
.s-warn{margin:8px 0 0;font-size:.84rem;line-height:1.5;padding:9px 11px;border-radius:var(--citui-radius-sm);
  background:color-mix(in srgb,var(--citui-warn) 10%,var(--citui-panel));border:1px solid color-mix(in srgb,var(--citui-warn) 38%,transparent)}
.s-btns{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.s-flash{color:var(--citui-ok-ink);font-size:.84rem;font-weight:600;margin:6px 0 0}
.s-err{color:var(--citui-bad);font-size:.84rem;margin:6px 0 0}
.wrap-tag{display:inline-block;margin-left:6px;font-size:.72rem;font-weight:700;padding:1px 7px;border-radius:999px;
  background:color-mix(in srgb,var(--citui-cyan-400) 16%,var(--citui-panel));color:var(--citui-ink)}
.ys-head{display:flex;align-items:center;gap:8px;margin:6px 0 8px}
.ys-head__t{flex:1;font-size:.84rem;color:var(--citui-muted)}
.ys-head__t b{color:var(--citui-ink)}
.ys-arrow{width:36px;height:36px;flex:0 0 36px;border-radius:50%;border:1px solid var(--citui-line-strong);
  background:var(--citui-panel);display:grid;place-items:center;cursor:pointer;color:var(--citui-ink);padding:0}
.ys-arrow[hidden]{display:none}
.ys-arrow:disabled{opacity:.35;cursor:default}
.ys-arrow--l svg{transform:rotate(90deg)}
.ys-arrow--r svg{transform:rotate(-90deg)}
.ys-wrap{position:relative;container-type:inline-size}
.ys{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 12px;
  scrollbar-width:thin;overscroll-behavior-x:contain}
.ys-cell{flex:0 0 80%;scroll-snap-align:start;border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);
  padding:10px 12px;background:var(--citui-panel);box-sizing:border-box;margin:0}
@container (min-width:560px){.ys-cell{flex-basis:calc((100% - 20px) / 2.35)}}
.ys-wrap::after{content:"";position:absolute;top:0;right:0;bottom:12px;width:44px;pointer-events:none;
  background:linear-gradient(to right,transparent,var(--citui-white))}
.ys-cell.is-own{border-color:color-mix(in srgb,var(--citui-cyan-400) 70%,transparent);
  background:color-mix(in srgb,var(--citui-cyan-400) 7%,var(--citui-panel))}
.ys-cell__y{display:flex;justify-content:space-between;gap:6px;font-weight:700;font-size:.95rem}
.ys-cell__y em{font-style:normal;font-weight:600;font-size:.74rem;color:var(--citui-muted);align-self:center}
.ys-cell.is-own .ys-cell__y em{color:var(--citui-ink)}
.ys-cell__d{font-size:.78rem;color:var(--citui-muted);margin:2px 0 8px}
.ys-cell .mcfg-suffix .citui-input{max-width:none;flex:1;min-width:0}
.ys-cell__act{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.ys-cell__act .citui-btn{padding:6px 12px;font-size:.82rem}
.ys-days>summary{font-size:.8rem;font-weight:600;color:var(--citui-link-ink);padding:6px 0 0;cursor:pointer;
  text-decoration:underline;text-underline-offset:3px;list-style:none}
.ys-days>summary::-webkit-details-marker{display:none}
.ys-days__in{display:flex;align-items:center;gap:6px;margin-top:6px}
.ys-days__in .citui-input{width:74px;text-align:center;padding-left:6px;padding-right:6px}
.ys-more{flex:0 0 60px;display:grid;place-items:center;color:var(--citui-muted)}
.ys-more svg{transform:rotate(-90deg)}
</style>`;

const huf = (n: number) => formatMoney(n, "HUF");

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
 *  what the owner pays by 10× (Elek FK-002 Z1).
 *
 *  ⭐ APPROVED CONTRACT 2026-09-14 (modules-quiet-list §6–7): this screen is reached
 *  from a module the tenant ALREADY OWNS, so it carries no „+" — and on an annual
 *  account the YEARLY figure leads. ⛔ The twin must move with its pair: leaving the
 *  old „+490 Ft/hó = 4 900 Ft/év" here would put two different price languages one
 *  click apart (the modules-annual-pricing contract binds this file too). */
function priceInPeriod(monthly: number, annualMult: number, lang: string): string {
  const price = esc(huf(monthly));
  if (annualMult <= 0) return `<b class="adm-price__lead">${T(lang, "{price}/hó", { price })}</b>`;
  return (
    `<b class="adm-price__lead">${T(lang, "{yearly}/év", { yearly: esc(huf(monthly * annualMult)) })}</b>` +
    ` <em class="adm-price__alt">${T(lang, "{price}/hó", { price })}</em>`
  );
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
  // ⛔ ÁLLAPOT-FÜGGŐ EMLÉKEZTETŐ (tulaj kérése, 2026-09-14). A `help` az időtlen
  // szabály; ez azt mondja meg, mit lát a vendég MOST, amíg a mező üres. Üresnek
  // számít a hiányzó érték, az üres string és a 0 — a szám-mezők alapértéke 0, tehát
  // a „kitöltetlen" ott nullaként érkezik, nem undefined-ként.
  // ⛔ A 0 NEM üresség (KB-őr FLAG, 2026-09-14): szám-mezőnél a 0 lehet a tulaj
  // kimondott nyilatkozata („nálam nincs idegenforgalmi adó"). Ha üresnek vennénk, az
  // emlékeztető ÖRÖKRE ott ragadna nála — és hazudna is. Üres = üres string / hiány.
  const isEmpty = v === "" || v === null || v === undefined;
  const emptyNote =
    f.emptyNote && isEmpty
      ? `<p class="mcfg-empty" data-cfg-empty="${esc(f.key)}">${ic("alert", 15)}` +
        `<span>${esc(T(lang, f.emptyNote))}</span></p>`
      : "";
  const help =
    (f.help ? `<p class="citui-hint" style="margin:6px 0 0">${esc(T(lang, f.help))}</p>` : "") +
    emptyNote;
  const ph = f.placeholder ? ` placeholder="${esc(T(lang, f.placeholder))}"` : "";

  if (f.type === "toggle") {
    return (
      `<div class="mcfg-row"><span class="mcfg-row__txt"><strong>${esc(T(lang, f.label))}</strong>` +
      (f.help ? `<span>${esc(T(lang, f.help))}</span>` : "") +
      emptyNote +
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
        ? // ⛔ ADR-0101 ①: az egység NEVÉBŐL dől el a névelő, nem „a(z)"-zel kerüljük ki.
          `<p class="daycard__note">${T(lang, "Ezért nem foglalható itt: {art} {unit} erre a napra el van adva.", { art: huArticleLower(holder), unit: esc(holder) })}</p>`
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
      `<p class="daycard__note">${T(lang, "Ez a foglalás {art} {provider} naptárában él, ezért itt nem módosítható — ott tudja kezelni.", { art: huArticleLower(provider), provider: esc(provider) })}</p>`;
  } else {
    // Manual block on ANOTHER unit: nothing is booked, but this screen still cannot
    // free it — and the owner has to be told WHERE it can be freed.
    head =
      `<strong>${esc(dayLabel(c.day, lang))}</strong>` +
      (holder ? `<span class="daycard__tag">${esc(holder)}</span>` : "");
    body =
      `<p class="daycard__note">${T(lang, "Ezt a napot {art} {unit} naptárában jelölte nem kiadónak, ezért itt sem adható ki.", { art: huArticleLower(holder), unit: esc(holder) })}</p>` +
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
    `<span><i class="is-manual"></i>${T(lang, "Ön jelölte: nem kiadó")}</span>` +
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
  /** ADR-0198: the picture the public room card shows — the owner's own pick if they
   *  made one, otherwise the first assigned photo. Resolved by ONE function
   *  (`unitCoverPhoto`), the same the renderer uses, so the admin and the page can
   *  never disagree about which picture is out there. */
  readonly coverUrl?: string | null;
  /** "Csak a felsorolt időszakokban adom ki" (ADR-0049). */
  readonly seasonalOnly?: boolean;
  /** ADR-0208 ⑥.2: "nem adok meg árat" — the owner's stated decision (0075). */
  readonly priceOnRequest?: boolean;
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
 * `inherited` (per-unit mode): the site-wide picks are offered at the room TOO,
 * toggleable, with an "a ház egészénél is" tag for orientation (owner decision
 * 2026-09-25, ADR-0232 — replaces the greyed, untogglable tiles: a room may list
 * what the house also has, the guest reads the room page on its own).
 */
interface AmenityPickerOpts {
  /** "property" offers property+both, "unit" offers unit+both. */
  readonly scope: "property" | "unit";
  /** Currently stored catalogue labels (checked state). */
  readonly selected: readonly string[];
  /** Stored free-text lines (the Egyéb box). */
  readonly other: readonly string[];
  /** Site-wide picks — offered (toggleable) and tagged in unit mode. */
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
    if (!items.length) continue;
    selectable += items.length;
    tiles +=
      `<h3 class="ampick__cat">${T(lang, cat.label)}</h3><div class="ampick__grid">` +
      items
        .map(
          (a) =>
            `<label class="ampick__tile${inh.has(a.label) ? " ampick__tile--house" : ""}" data-t="${esc(T(lang, a.label).toLowerCase())}">` +
            `<input type="checkbox" name="${esc(o.checkName)}" value="${esc(a.label)}"${sel.has(a.label) ? " checked" : ""}>` +
            `<span class="ampick__ico">${amenitySvg(a)}</span><span>${T(lang, a.label)}` +
            (inh.has(a.label) ? `<span class="ampick__inhtag">${T(lang, "a ház egészénél is")}</span>` : "") +
            `</span></label>`,
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
 * ADR-0198 — THE ROOM EDITOR (jóváhagyott D kontraktus, tulaj 2026-09-22).
 * Kontraktus: assets/design-refs/tenant-admin/room-editor/README.md
 *
 * Mit vált le és miért (mind MÉRT tény, nem ízlés):
 *   · a 4 szoba egyetlen, 9 103 px hosszú görgetés volt mobilon → kártyarács;
 *   · egy szoba KÉT űrlapon élt (név+férőhely a „Mit ad ki?"-on, a többi külön) →
 *     egy felugró, három füllel;
 *   · a 70 tételes felszereltség-választó mind a négy szobánál kinyitva ült;
 *   · borítókép-fogalom NEM volt: a honlap a szobához rendelt ELSŐ képet mutatta a
 *     KÖZÖS galéria sorrendjében, ezért két szoba ugyanazt a fotót kapta, és a
 *     tulajnak nem volt eszköze orvosolni.
 *
 * A felugró `:target`-tel nyílik, a fülek rádió-gombok, a vezérlők ugyanannak az
 * egy űrlapnak a submit-gombjai — tehát a felület JavaScript NÉLKÜL is teljes
 * (ugyanaz a szabály, mint a naptárnál). A JS csak rátesz: ESC-zárás, élő számlálók
 * és élő vendég-előnézet, és a helyben feltöltés.
 */

/** A kártya és az Alapok fül ugyanazt a mondatot mondja: mi hiányzik a saját oldalhoz. */
function roomGate(u: EditorUnit): { ok: boolean; missing: ("photo" | "text")[] } {
  const hasText = Boolean(u.description?.trim()) || (u.amenities?.length ?? 0) > 0;
  const hasPhoto = (u.photoCount ?? 0) > 0;
  const missing: ("photo" | "text")[] = [];
  if (!hasPhoto) missing.push("photo");
  if (!hasText) missing.push("text");
  return { ok: hasPhoto && hasText, missing };
}

function roomMeta(u: EditorUnit, units: readonly EditorUnit[], lang: string): string {
  const bits = [
    u.capacity ? T(lang, "{n} fő", { n: u.capacity }) : T(lang, "férőhely nincs megadva"),
    // ADR-0232: with one unit the concept is invisible — a renamed default ("Apartman 1")
    // must not carry "az egész ház" on a screen where there is nothing else.
    u.isWholeProperty && units.length > 1 ? T(lang, "az egész ház") : "",
  ].filter(Boolean);
  return bits.join(" · ");
}

/**
 * ADR-0232 (approved plan whole-property-choice B): the card above the rooms grid where
 * the owner says whether the place is ALSO let as one, and which unit that is. Only
 * with 2+ units — a single-unit owner never meets the concept. Plain form: works with
 * zero JS; unchecked → no unit is the whole place, the rooms are independent.
 */
function wholePropertyCard(units: readonly EditorUnit[], lang: string): string {
  if (units.length < 2) return "";
  const whole = units.find((u) => u.isWholeProperty) ?? null;
  const opts = units
    .map(
      (u) =>
        `<option value="${esc(u.id)}"${u.isWholeProperty ? " selected" : ""}>${esc(u.name)}` +
        (u.capacity ? ` · ${esc(T(lang, "{n} fő", { n: u.capacity }))}` : "") +
        `</option>`,
    )
    .join("");
  return (
    `<form method="POST" action="/admin/units/whole" class="rs-wcard${whole ? " is-on" : ""}" data-cit-whole-card>` +
    `<div class="rs-wcard__t"><b>${ic("modules", 15)}${T(lang, "Az egész szállás egyben")}</b>` +
    `<p>` +
    (whole
      ? T(lang, "Az egész szállás most: {name}. Ha lefoglalják, minden más egység tele lesz arra az éjszakára — és bármelyik szoba foglalása az egészet zárja.", {
          name: `<b>${esc(whole.name)}</b>`,
        })
      : T(lang, "Most minden egység külön naptárral, egymástól függetlenül telik be. Ha a házat egyben is kiadja, kapcsolja be, és mondja meg, melyik egység az.")) +
    `</p></div>` +
    `<div class="rs-wcard__c">` +
    `<label class="rs-wtoggle"><input type="checkbox" name="on" value="1"${whole ? " checked" : ""} data-cit-whole-on>` +
    `<span>${T(lang, "Kiadom egyben is")}</span></label>` +
    `<select class="citui-input rs-wpick" name="unit" aria-label="${T(lang, "Melyik egység az egész szállás")}" data-cit-whole-pick>` +
    (whole ? "" : `<option value="">${T(lang, "— melyik egység —")}</option>`) +
    opts +
    `</select>` +
    `<button class="citui-btn citui-btn--ghost citui-btn--sm" type="submit">${T(lang, "Mentés")}</button>` +
    `</div></form>`
  );
}

/**
 * ADR-0232: the question asked at the moment of adding the SECOND unit — inside the
 * add form (required radios), because that is where the decision is made. With any
 * other count the form has no such block and the flag stays as it is.
 */
function wholeQuestion(units: readonly { id: string; name: string }[], lang: string): string {
  if (units.length !== 1) return "";
  const first = units[0]!;
  const opt = (value: string, title: string, why: string): string =>
    `<label class="rs-wq__o"><input type="radio" name="whole" value="${value}" required>` +
    `<span><b>${title}</b><small>${why}</small></span></label>`;
  return (
    `<fieldset class="rs-wq" data-cit-whole-q><legend>${T(lang, "Az egész szállást is kiadja egyben?")}</legend>` +
    `<p>${T(lang, "Eddig egy egysége volt: {name}. A második felvételekor el kell dönteni, mi a viszonyuk.", { name: `<b>${esc(first.name)}</b>` })}</p>` +
    opt(
      "igen",
      T(lang, "Igen, az egészet is kiadom egyben"),
      T(lang, "{name} marad az egész szállás. A foglalása minden szobát lezár, és bármelyik szoba foglalása az egészet.", { name: esc(first.name) }),
    ) +
    opt(
      "nem",
      T(lang, "Nem, csak külön egységeket adok ki"),
      T(lang, "{name} sima egység lesz. A szobák egymástól függetlenül telnek be. Később bármikor megjelölhet egyet az egész szállásnak.", { name: esc(first.name) }),
    ) +
    `</fieldset>`
  );
}

/** The badge the GUEST sees on the public room card — the admin shows the same words.
 *  ⛔ Soha nem „1 kép": az galériát ígérne (rooms-card kontraktus §1). */
function roomCountBadge(n: number, lang: string): string {
  return n > 1 ? T(lang, "{n} kép", { n }) : n === 1 ? T(lang, "Részletek") : T(lang, "nincs kép");
}

/** Ugyanaz a kép két egység borítója? Ez a MAI, valódi hiba egyetlen látható jelzése. */
function coverClash(u: EditorUnit, units: readonly EditorUnit[], lang: string): string {
  if (!u.coverUrl) return "";
  const others = units.filter((o) => o.id !== u.id && o.coverUrl === u.coverUrl).map((o) => o.name);
  if (!others.length) return "";
  return (
    `<span class="rs-b rs-b--clash">${ic("alert", 12)}` +
    `${T(lang, "ugyanaz a borító, mint: {names}", { names: esc(others.join(", ")) })}</span>`
  );
}

/** ONE room card in the grid: exactly what the guest gets on the public page. */
function roomCard(u: EditorUnit, units: readonly EditorUnit[], lang: string): string {
  const g = roomGate(u);
  const n = u.photoCount ?? 0;
  const cover = u.coverUrl
    ? `<img src="${esc(u.coverUrl)}" alt="" loading="lazy">`
    : `<span class="rs-cover__none">${T(lang, "nincs borítókép")}</span>`;
  return (
    `<a class="rs-gcard" href="#szoba-${esc(u.id)}" data-rs-card="${esc(u.id)}">` +
    `<span class="rs-gim">${cover}` +
    `<span class="rs-gcount">${ic("photos", 11)}${esc(roomCountBadge(n, lang))}</span></span>` +
    `<span class="rs-gbd"><b>${esc(u.name)}</b><span>${esc(roomMeta(u, units, lang))}</span>` +
    `<span class="rs-b rs-b--${g.ok ? "ok" : "warn"}">${ic(g.ok ? "check" : "alert", 12)}` +
    `${g.ok ? T(lang, "Van saját oldala") : T(lang, "Hiányos")}</span>` +
    coverClash(u, units, lang) +
    `</span></a>`
  );
}

/** Mi hiányzik a saját oldalhoz — a hiányzó részek NEVÉVEL, nem „nem elég adat"-tal. */
function roomMissingText(u: EditorUnit, lang: string): string {
  const parts = roomGate(u).missing.map((m) =>
    m === "photo" ? T(lang, "fotó") : T(lang, "leírás vagy felszereltség"),
  );
  return T(lang, "Nincs saját oldala — hiányzik: {mi}", { mi: parts.join(T(lang, " és ")) });
}

/** Az állapot-sáv az Alapok fülön: vagy a kész oldal címe, vagy ami hiányzik hozzá. */
function roomStatus(u: EditorUnit, lang: string): string {
  const g = roomGate(u);
  if (g.ok) {
    return (
      `<div class="rs-msg rs-msg--ok" data-rs-status>${ic("check", 14)}<div>` +
      `${T(lang, "Saját oldala: {url} — a keresők külön is megtalálják.", { url: `<b>/apartman/${esc(u.slug ?? "")}</b>` })}</div></div>`
    );
  }
  return (
    `<div class="rs-msg rs-msg--warn" data-rs-status>${ic("alert", 14)}<div>` +
    `${esc(roomMissingText(u, lang))} ${T(lang, "Üres oldallal többet ártanánk, mint használnánk.")}</div></div>`
  );
}

/** ÉLŐ vendég-előnézet (asztali külön tervezői döntés): pontosan az, amit a vendég a
 *  szoba-rácsban lát — borító, név, férőhely, jelvény, és SEMMI MÁS
 *  (assets/design-refs/tenant-site/rooms-card/README.md §1). */
function roomGuestPreview(u: EditorUnit, lang: string): string {
  const n = u.photoCount ?? 0;
  const cover = u.coverUrl
    ? `<img src="${esc(u.coverUrl)}" alt="" loading="lazy">`
    : `<span class="rs-cover__none">${T(lang, "nincs borítókép")}</span>`;
  return (
    `<div class="rs-sec"><h4>${ic("preview", 15)}${T(lang, "Ezt látja a vendég a honlapon")}</h4>` +
    `<div class="rs-gcard rs-gcard--preview" aria-hidden="true">` +
    `<span class="rs-gim">${cover}` +
    (n ? `<span class="rs-gcount">${ic("photos", 11)}${esc(roomCountBadge(n, lang))}</span>` : "") +
    `</span><span class="rs-gbd"><b data-rs-prev-name>${esc(u.name)}</b>` +
    `<span data-rs-prev-cap>${esc(u.capacity ? T(lang, "{n} fő", { n: u.capacity }) : T(lang, "férőhely nincs megadva"))}</span>` +
    `</span></div>` +
    `<p class="rs-why">${T(lang, "A jelvény felirata a képek számától függ: több képnél a darabszám, egyetlen képnél „Részletek” — mert az „1 kép” galériát ígérne.")}</p></div>`
  );
}

/** „Alapok" fül — a név, a férőhely és a leírás EGY helyen (eddig két űrlapon volt). */
function roomBasicsPane(u: EditorUnit, lang: string): string {
  const form =
    `<div class="rs-sec"><h4>${ic("texts", 15)}${T(lang, "Alapadatok")}</h4>` +
    `<div class="rs-row2">` +
    `<div class="citui-field" style="margin:0"><label class="citui-label" for="n_${esc(u.id)}">${T(lang, "Az egység neve")}</label>` +
    `<input class="citui-input" id="n_${esc(u.id)}" name="name" value="${esc(u.name)}" data-rs-name></div>` +
    `<div class="citui-field" style="margin:0"><label class="citui-label" for="c_${esc(u.id)}">${T(lang, "Férőhely")}</label>` +
    `<input class="citui-input" id="c_${esc(u.id)}" name="capacity" type="number" min="1" max="50" ` +
    `inputmode="numeric" value="${u.capacity ?? ""}" data-rs-cap></div></div>` +
    `<div class="citui-field" style="margin:0"><label class="citui-label" for="d_${esc(u.id)}">${T(lang, "Leírás")}</label>` +
    `<textarea class="citui-textarea" id="d_${esc(u.id)}" name="description" style="min-height:96px" ` +
    `placeholder="${T(lang, "Mi jellemzi ezt a szobát? Mit szeretnek benne a vendégek?")}" data-rs-desc>${esc(u.description ?? "")}</textarea></div></div>`;
  // ⭐ KÉT KÜLÖN TERVEZŐI DÖNTÉS: 390 px-en egy hasáb, 1280 px-en űrlap BAL + élő
  // vendég-előnézet JOBB. Egyetlen 1200 px széles mezősor nem elrendezés.
  return (
    `<div class="rs-two"><div class="rs-sec">${form}</div>` +
    `<div class="rs-sec">${roomGuestPreview(u, lang)}${roomStatus(u, lang)}</div></div>`
  );
}

/** A művelet nyugtázása, a szerver ÁLLAPOTÁBÓL — nem a kattintás szándékából. */
function roomNotice(u: EditorUnit, notice: string | null | undefined, lang: string): string {
  if (!notice) return "";
  const box = (kind: string, icon: string, html: string): string =>
    `<div class="rs-msg rs-msg--${kind}" data-rs-notice>${ic(icon, 14)}<div>${html}</div></div>`;
  // ⛔ NEM „a(z)": a névelőt a NÉV dönti el, és azt a ház függvénye tudja (src/hu.ts).
  // A zárójeles alak azt kérné a tulajtól, hogy ő ragozzon helyettünk.
  const cover = T(lang, "A honlap ezentúl ezt a képet mutatja {art} {name} kártyáján.", {
    art: huArticleLower(u.name),
    name: `<b>${esc(u.name)}</b>`,
  });
  switch (notice) {
    case "borito":
      return box("ok", "check", cover);
    case "boritoplus":
      return box(
        "ok",
        "check",
        cover + " " + T(lang, "Egyben hozzá is rendeltem ehhez az egységhez."),
      );
    // A levétel HÁROM külön tényállás — és a tulaj mindháromban mást kell hogy tudjon.
    case "le":
      return box("ok", "check", T(lang, "A kép lekerült erről az egységről. A közös képtárban benne marad, más szobánál is állhat."));
    case "lekov":
      return box(
        "ok",
        "check",
        T(lang, "A kép lekerült erről az egységről. A közös képtárban benne marad, más szobánál is állhat.") +
          " " +
          T(lang, "Ez volt a borítókép, ezért a sorban következő lépett a helyébe."),
      );
    case "lenincs":
      return box(
        "warn",
        "alert",
        T(lang, "A kép lekerült erről az egységről. A közös képtárban benne marad, más szobánál is állhat.") +
          " " +
          T(lang, "Ez volt a borítókép — most nincs borító, a honlap kártyáján nem lesz kép."),
      );
    default:
      return "";
  }
}

/** „Képek" fül — a terv magja: nagy borító-előnézet → feltöltés → a KÖZÖS képtár. */
function roomPhotosPane(
  u: EditorUnit,
  units: readonly EditorUnit[],
  library: readonly PhotoEdit[],
  notice: string | null | undefined,
  lang: string,
): string {
  const picked = new Set(u.photoUrls ?? []);
  const hero = u.coverUrl
    ? `<img src="${esc(u.coverUrl)}" alt="" data-rs-hero>`
    : `<span class="rs-cover__none">${T(lang, "Ennek az egységnek még nincs borítóképe — a honlap kártyáján nem lesz kép.")}</span>`;
  const clashNames = u.coverUrl
    ? units.filter((o) => o.id !== u.id && o.coverUrl === u.coverUrl).map((o) => o.name)
    : [];
  const warn = clashNames.length
    ? `<div class="rs-msg rs-msg--warn">${ic("alert", 14)}<div>` +
      T(lang, "Ez a kép {names} borítója is — a honlapon két kártya ugyanazt mutatja. Válasszon másikat lent.", {
        names: `<b>${esc(clashNames.join(", "))}</b>`,
      }) +
      `</div></div>`
    : "";
  // ⛔ A feltöltő vezérlő a fül TETEJÉN áll, nem a képek végén: ott a negyedik kép
  // után kiszorult a vízszintes görgetésbe, vagyis a tulaj LEGFŐBB kérése a képen
  // nem is látszott.
  const acts =
    `<div class="rs-acts">` +
    `<label class="citui-btn citui-btn--primary citui-btn--sm rs-upbtn">${ic("plus", 15)}` +
    `${T(lang, "Kép feltöltése")}` +
    `<input type="file" multiple accept="image/jpeg,image/png,image/webp" data-rs-upload="${esc(u.id)}"></label>` +
    `<span class="rs-why" style="align-self:center">${T(lang, "A feltöltött kép a közös képtárba kerül, és ehhez az egységhez rendelem.")}</span></div>`;

  const cells = library
    .map((p) => {
      const on = picked.has(p.url);
      const isCover = u.coverUrl === p.url;
      const owners = units
        .filter((o) => o.id !== u.id && (o.photoUrls ?? []).includes(p.url))
        .map((o) => o.name);
      const title = owners.length
        ? T(lang, "Ehhez is tartozik: {names}", { names: esc(owners.join(", ")) })
        : T(lang, "Még nincs egységhez rendelve");
      return (
        `<label class="rs-libcell${on ? " is-on" : ""}" title="${title}">` +
        `<input type="checkbox" name="photo" value="${esc(p.url)}"${on ? " checked" : ""}>` +
        `<img src="${esc(p.url)}" alt="${esc(p.alt ?? "")}" loading="lazy">` +
        `<span class="rs-libtick">${ic("check", 12)}</span>` +
        // ⛔ A csillag egy még NEM hozzárendelt képen hozzá is rendel — tiltott,
        // semmit nem csináló gomb helyett az értelmes dolgot teszi.
        `<button class="rs-libcov" type="submit" name="set_cover" value="${esc(p.url)}" ` +
        `data-on="${isCover}" title="${T(lang, "Ez legyen a borítókép")}">${ic("star", 11)}` +
        `${isCover ? T(lang, "borító") : ""}</button>` +
        `</label>`
      );
    })
    .join("");

  const lib = library.length
    ? `<div class="rs-lib"><div class="rs-libgrid">${cells}</div>` +
      `<p class="rs-libfoot">${T(lang, "A halvány képek még nem tartoznak ehhez az egységhez. A pipa rendeli hozzá, a csillag teszi borítóvá (a csillag hozzá is rendeli, ha még nem volt). A képtár a ház ÖSSZES képét tartalmazza — egy kép több szobánál is állhat.")}</p></div>`
    : `<p class="rs-why">${T(lang, "Még nincs kép a képtárban. Töltsön fel egyet a fenti gombbal — rögtön ehhez az egységhez is rendelem.")}</p>`;

  return (
    `<div class="rs-sec">` +
    `<div class="rs-hero">${hero}` +
    `<span class="rs-herolab">${ic("preview", 12)}${T(lang, "Ezt mutatja a honlap ezen a kártyán")}</span></div>` +
    warn +
    acts +
    `<div data-rs-msg>${roomNotice(u, notice, lang)}</div>` +
    `<h4>${ic("photos", 15)}${T(lang, "A ház közös képtára")}</h4>` +
    `<p class="rs-why">${T(lang, "A {tick} rendeli a képet ehhez az egységhez, a {star} teszi borítóvá. Egy kép több szobánál is állhat — ezért tölt fel egyszer, és jelöli meg, hova tartozik.", { tick: `<b>${T(lang, "pipa")}</b>`, star: `<b>${T(lang, "csillag")}</b>` })}</p>` +
    lib +
    `</div>`
  );
}

/** „Felszereltség" fül — kompakt csempék, a katalógus egy gombra nyílik.
 *  ⛔ ÜRES felszereltségnél RÖGTÖN nyitva: csukva a fül egy nagy fehér semmi volt
 *  egyetlen gombbal (a tartalom a doboz 21 %-át töltötte ki). */
function roomAmenityPane(u: EditorUnit, ctx: UnitAmenityContext | undefined, lang: string): string {
  if (!ctx) return "";
  if (!ctx.active) return `<div class="rs-sec">${amenityLockedPanel(lang)}</div>`;
  const stored = splitAmenities(u.amenities ?? []);
  const chips =
    stored.selected
      .map((label) => {
        const item = amenityByLabel(label);
        return (
          `<span class="rs-am${item ? "" : " rs-am--other"}">` +
          `${item ? amenitySvg(item) : ic("texts", 14)}${esc(T(lang, label))}</span>`
        );
      })
      .join("") +
    stored.other
      .map((label) => `<span class="rs-am rs-am--other">${ic("texts", 14)}${esc(label)}</span>`)
      .join("");
  const total = stored.selected.length + stored.other.length;
  // A csempesor SZERVER-oldalon születik, hogy JS nélkül is látszódjon, mi van
  // kiválasztva — a picker saját szkriptje utána élővé teszi ugyanezt a sort.
  return (
    `<div class="rs-sec"><h4>${ic("modules", 15)}${T(lang, "Felszereltség")}</h4>` +
    `<p class="rs-why">${T(lang, "Jelölje, ami EBBEN az egységben van — akkor is, ha a Felszereltség lapon a ház egészénél is szerepel: a vendég a szoba adatlapján külön látja.")}</p>` +
    (total ? `<div class="rs-ams" data-rs-chips>${chips}</div>` : "") +
    `<details class="rs-amcat"${total ? "" : " open"}>` +
    // ⛔ A felirat NEM írja bele a katalógus darabszámát: a „70 tételes lista" attól
    // a pillanattól hazudik, hogy a katalógus bővül — és a súgó is azt idézné.
    `<summary>${ic("plus", 13)}${T(lang, "Hozzáadás a listából")}</summary>` +
    amenityPicker({
      scope: "unit",
      selected: stored.selected,
      other: stored.other,
      inherited: ctx.siteSelected,
      idPrefix: `amp_${u.id}`,
      checkName: "am",
      otherName: "amenities_other",
      lang,
    }) +
    `</details></div>`
  );
}

/** A felugró: fejléc + fülek + törzs + RÖGZÍTETT lábazat (a Mentés görgetés nélkül). */
function roomPopup(
  u: EditorUnit,
  units: readonly EditorUnit[],
  library: readonly PhotoEdit[],
  ctx: UnitAmenityContext | undefined,
  view: RoomsView,
  lang: string,
): string {
  const openTab = view.openUnitId === u.id && (view.tab === "kep" || view.tab === "fel") ? view.tab : "alap";
  const notice = view.openUnitId === u.id ? view.notice : null;
  const n = u.photoCount ?? 0;
  const amCount = (u.amenities ?? []).filter((a) => a.trim()).length;
  const radio = (t: string): string =>
    `<input class="rs-tabin rs-tabin--${t}" type="radio" name="fl" value="${t}" ` +
    `id="fl_${esc(u.id)}_${t}"${openTab === t ? " checked" : ""}>`;
  const tab = (t: string, label: string, count: number | null): string =>
    `<label class="rs-tab rs-tab--${t}" for="fl_${esc(u.id)}_${t}" role="tab">${esc(label)}` +
    (count === null ? "" : `<em data-rs-count="${t}">${count}</em>`) +
    `</label>`;
  return (
    `<div class="rs-modal" id="szoba-${esc(u.id)}" data-rs-modal="${esc(u.id)}">` +
    `<a class="rs-backdrop" href="#szobak" aria-label="${T(lang, "Bezárás")}"></a>` +
    `<form class="rs-pop" method="POST" action="/admin/units/content" role="dialog" aria-modal="true" ` +
    `aria-label="${esc(u.name)}">` +
    `<input type="hidden" name="id" value="${esc(u.id)}">` +
    // Marker: distinguishes "never opened the picker" from "opened and cleared it",
    // so a save cannot silently wipe an assignment the owner did not touch.
    `<input type="hidden" name="photos_touched" value="1">` +
    radio("alap") +
    radio("kep") +
    radio("fel") +
    `<div class="rs-pop__top">` +
    `<a class="rs-pop__x" href="#szobak" aria-label="${T(lang, "Bezárás")}">${ic("close", 16)}</a>` +
    `<b>${esc(u.name)}</b><span class="rs-pop__meta">${esc(roomMeta(u, units, lang))}</span></div>` +
    `<div class="rs-tabs" role="tablist">` +
    tab("alap", T(lang, "Alapok"), null) +
    tab("kep", T(lang, "Képek"), n) +
    (ctx?.active ? tab("fel", T(lang, "Felszereltség"), amCount) : tab("fel", T(lang, "Felszereltség"), null)) +
    `</div>` +
    `<div class="rs-pop__body">` +
    `<div class="rs-pane rs-pane--alap">${roomBasicsPane(u, lang)}</div>` +
    `<div class="rs-pane rs-pane--kep">${roomPhotosPane(u, units, library, notice, lang)}</div>` +
    `<div class="rs-pane rs-pane--fel">${roomAmenityPane(u, ctx, lang)}</div>` +
    `</div>` +
    `<div class="rs-pop__foot">` +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Mentés")}</button>` +
    // ADR-0232: every unit is deletable while another remains — the whole place too
    // (afterwards the rooms are independent). The last one has no button: a site with
    // nothing bookable is not a state we allow (deleteUnit says so).
    (units.length > 1
      ? `<input type="hidden" name="back" value="rooms">` +
        `<button class="rs-del" type="submit" formaction="/admin/units/delete">${T(lang, "Egység törlése")}</button>`
      : "") +
    `</div></form></div>`
  );
}

/** ADR-0198 — melyik szoba van nyitva, melyik fülön, és mi történt az imént. */
export interface RoomsView {
  readonly openUnitId?: string | null;
  readonly tab?: string | null;
  readonly notice?: string | null;
}

/** ADR-0208 ⑥.3 — the new-unit row's price state and the flash after a save. */
export interface NewUnitView {
  /** Is the pricing module on? Off → the row stays name + capacity, as before. */
  readonly pricingActive: boolean;
  /** The pricing module's currency — the suffix reads what the price table will. */
  readonly currency: string;
  /** Which screen the row lives on — the save comes back HERE, where the flash is read. */
  readonly back: "rooms" | "booking";
  readonly flash?: {
    readonly state: "ar" | "ajanlat" | "kimondva" | "nincs" | "rossz";
    readonly unitId: string;
    readonly unitName: string;
  } | null;
}

/**
 * The price half of the new-unit row: an amount, or the stated "nem adok meg árat".
 * ⛔ Nothing here is `required` — the save never refuses a unit (ADR-0193 ①); the
 * flash says what a unit without either means.
 */
function newUnitPriceFields(nu: NewUnitView | undefined, lang: string): string {
  const back = `<input type="hidden" name="back" value="${nu?.back ?? "booking"}">`;
  if (!nu?.pricingActive) return back;
  return (
    back +
    `<span class="mcfg-suffix"><input class="citui-input unit-row__price" name="price" inputmode="numeric" ` +
    `placeholder="${T(lang, "Alapár")}" aria-label="${T(lang, "Alapár")}"><span>${esc(currencySign(nu.currency))}</span></span>`
  );
}

function newUnitDecl(nu: NewUnitView | undefined, lang: string): string {
  if (!nu?.pricingActive) return "";
  return (
    `<label class="pr-decl"><input type="checkbox" name="price_on_request" value="1">` +
    `<span><strong>${T(lang, "Nem adok meg árat — egyedi ajánlatot küldök")}</strong>` +
    `<span>${T(lang, "Később az Árazás lapon bármikor megadhatja.")}</span></span></label>`
  );
}

/** The flash after the save — one of four outcomes, each saying what the guest now sees. */
function newUnitFlash(nu: NewUnitView | undefined, lang: string): string {
  const f = nu?.flash;
  if (!f) return "";
  return newUnitFlashBox(f, nu!.back, lang);
}

function newUnitFlashBox(
  f: NonNullable<NewUnitView["flash"]>,
  back: NewUnitView["back"],
  lang: string,
): string {
  const name = esc(f.unitName);
  if (f.state === "ar") {
    return (
      `<div class="nu-flash" id="nu-flash" data-nu-flash="ar"><p class="mcfg-empty mcfg-empty--said">${ic("check", 16)}<span>` +
      `<strong>${T(lang, "Felvettük: {name}.", { name })}</strong> ` +
      `${T(lang, "Az alapára mentve, a vendég azonnal látja.")}</span></p></div>`
    );
  }
  if (f.state === "ajanlat" || f.state === "kimondva") {
    return (
      `<div class="nu-flash" id="nu-flash" data-nu-flash="${f.state}"><p class="mcfg-empty mcfg-empty--said">${ic("check", 16)}<span>` +
      `<strong>${f.state === "ajanlat" ? T(lang, "Felvettük: {name}.", { name }) : T(lang, "Rendben: {name}.", { name })}</strong> ` +
      `${T(lang, "Árat nem ad meg: a vendég árajánlatot kér, és Ön a rendszerből válaszol.")}</span></p></div>`
    );
  }
  const unit = encodeURIComponent(f.unitId);
  return (
    `<div class="nu-flash" id="nu-flash" data-nu-flash="${f.state}"><div class="mcfg-empty">${ic("alert", 16)}<span>` +
    `<strong>${T(lang, "Felvettük: {name} — de nincs ára.", { name })}</strong> ` +
    (f.state === "rossz" ? `${T(lang, "A beírt árat nem tudtuk értelmezni, ezért nem mentettük.")} ` : "") +
    `${T(lang, "A vendég nem lát rá árat, és árajánlatot kér. Amíg nem ad meg árat, vagy nem jelöli, hogy nem ad meg, hetente emlékeztetjük.")}` +
    `<span class="nu-flash__acts">` +
    `<a class="citui-btn citui-btn--primary citui-btn--sm" href="/admin?tab=modulok&m=pricing#ar-${unit}">${T(lang, "Árat adok meg")}</a>` +
    `<form method="POST" action="/admin/prices/request">` +
    `<input type="hidden" name="unit" value="${esc(f.unitId)}"><input type="hidden" name="on" value="1">` +
    `<input type="hidden" name="back" value="${back}">` +
    `<button class="citui-btn citui-btn--ghost citui-btn--sm" type="submit">${T(lang, "Nem adok meg árat")}</button></form>` +
    `</span></span></div></div>`
  );
}

/** A teljes szoba-szerkesztő: vezető mondat + kártyarács + felugrók + új egység. */
function roomsEditor(
  units: readonly EditorUnit[],
  library: readonly PhotoEdit[],
  ctx: UnitAmenityContext | undefined,
  view: RoomsView,
  lang: string,
  nu?: NewUnitView,
): string {
  const cards = units.map((u) => roomCard(u, units, lang)).join("");
  const pops = units.map((u) => roomPopup(u, units, library, ctx, view, lang)).join("");
  return (
    // A `.rs-wrap` a felugrók NÉLKÜLI rész: ez a súgó-kép tárgya is (a felugró
    // fixed pozíciójú, és egy teljes-lapos kép a rács fölé festené).
    `<div class="rs-wrap">` +
    `<div class="rs-head"><span class="adm-ico">${ic("modules")}</span><div>` +
    `<h1>${T(lang, "A szobái")}</h1>` +
    `<p>${T(lang, "A kártya azt mutatja, amit a vendég lát a honlapon. Koppintson rá — a szerkesztő felugrik.")}</p></div></div>` +
    newUnitFlash(nu, lang) +
    wholePropertyCard(units, lang) +
    `<div class="rs-grid" id="szobak">${cards}</div>` +
    // A felvétel a MAI viselkedés marad (a terv szándékosan nem kötötte be), csak a
    // helye változik: a rács alatt, egyetlen szaggatott vezérlőben.
    `<details class="rs-new"><summary>${ic("plus")}${T(lang, "Új egység felvétele")}</summary>` +
    `<form method="POST" action="/admin/units/save" class="unit-row unit-row--new">` +
    wholeQuestion(units, lang) +
    `<input class="citui-input unit-row__name" name="name" placeholder="${T(lang, "Pl. Kertre néző apartman")}" aria-label="${T(lang, "Új egység neve")}">` +
    `<span class="mcfg-suffix"><input class="citui-input unit-row__cap" name="capacity" type="number" ` +
    `inputmode="numeric" min="1" max="50" placeholder="2" aria-label="${T(lang, "Férőhely")}"><span>${T(lang, "fő")}</span></span>` +
    newUnitPriceFields(nu, lang) +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Hozzáadás")}</button>` +
    newUnitDecl(nu, lang) +
    `</form></details></div>` +
    pops
  );
}

/** What the room card needs to know about the amenities module (owner decision
 *  2026-08-26: per-unit amenities require the rooms AND the amenities module). */
export interface UnitAmenityContext {
  /** Is the Felszereltség module active? false → conversion panel, no inputs. */
  readonly active: boolean;
  /** Site-wide catalogue picks — offered (toggleable) and tagged on the room card. */
  readonly siteSelected: readonly string[];
}

/**
 * A szoba-szerkesztő JS-RÁTÉTE — a felület nélküle is teljes (`:target` felugró,
 * rádió-gombos fülek, submit-gombos vezérlők). Ez a szkript hármat tesz hozzá:
 *   · ESC-zárás (a kontraktus köti; billentyűzet nélkül nincs más útja),
 *   · élő számlálók + élő vendég-előnézet gépelés közben,
 *   · helyben feltöltés (a termék ma sem tud JS nélkül feltölteni — nincs
 *     multipart-értelmezőnk —, tehát ez nem VESZTESÉG a JS nélküli úton, hanem
 *     ugyanaz, amit a Fotók fül nyújt).
 * A felhasználónak szóló szövegek SZERVER-oldalon fordulnak (ADR-0067).
 */
function roomEditorScript(lang: string): string {
  // ⚠️ A T() hívás LÁTHATÓ alakban kell maradjon (az i18n-őr a forrás-stringet a
  // T() argumentumából gyűjti): a `j(T(lang,"…"))` burkolás azt adja, a saját
  // rövidítő segéd (s("…")) viszont ELREJTENÉ a kulcsot a katalógus elől.
  const j = (v: string): string => JSON.stringify(v);
  return (
    `<script>(function(){` +
    // ESC: a felugró a :target-en ül, tehát a bezárás = a horgony elhagyása.
    // ⛔ A history.replaceState NEM értékeli újra a :target-et: az ESC „megtörtént",
    // a felugró meg nyitva maradt (mérve az őrrel). A horgonyt TÉNYLEGESEN el kell hagyni.
    `document.addEventListener("keydown",function(e){` +
    `if(e.key!=="Escape")return;if(!document.querySelector(".rs-modal:target"))return;` +
    `location.hash="#szobak"});` +
    // Élő előnézet + számlálók: a beírt név/férőhely azonnal látszik ott, ahol a
    // vendég is látni fogja.
    `document.addEventListener("input",function(e){` +
    `var el=e.target,pop=el.closest&&el.closest(".rs-pop");if(!pop)return;` +
    `if(el.hasAttribute("data-rs-name")){var t=pop.querySelector("[data-rs-prev-name]");` +
    `if(t)t.textContent=el.value;var h=pop.querySelector(".rs-pop__top b");if(h)h.textContent=el.value;` +
    `var c=document.querySelector('[data-rs-card="'+pop.querySelector('[name=id]').value+'"] .rs-gbd b');` +
    `if(c)c.textContent=el.value}` +
    `if(el.hasAttribute("data-rs-cap")){var p=pop.querySelector("[data-rs-prev-cap]");` +
    `if(p)p.textContent=el.value?el.value+${j(T(lang, " fő"))}:${j(T(lang, "férőhely nincs megadva"))}}` +
    `});` +
    // A Képek fül számlálója a PIPÁKAT követi (azt menti a Mentés).
    `document.addEventListener("change",function(e){` +
    `var el=e.target,pop=el.closest&&el.closest(".rs-pop");if(!pop)return;` +
    `if(el.type==="checkbox"&&el.name==="photo"){` +
    `var n=pop.querySelectorAll('input[name=photo]:checked').length;` +
    `var c=pop.querySelector('[data-rs-count=kep]');if(c)c.textContent=n;` +
    `var cell=el.closest(".rs-libcell");if(cell)cell.classList.toggle("is-on",el.checked)}` +
    `if(el.type==="checkbox"&&el.name==="am"){` +
    `var m=pop.querySelectorAll('input[name=am]:checked').length;` +
    `var d=pop.querySelector('[data-rs-count=fel]');if(d)d.textContent=m}` +
    `});` +
    // Helyben feltöltés. A korlátok a SZERVER mért korlátai; a hiba MEGNEVEZI a
    // fájlt és az okot, és hibaként jelenik meg — nem sikerként.
    `function read(f){return new Promise(function(res,rej){var r=new FileReader();` +
    `r.onload=function(){res(r.result)};r.onerror=rej;r.readAsDataURL(f)})}` +
    `function esc(s){return String(s).replace(/[&<>"]/g,function(c){` +
    `return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}` +
    `document.addEventListener("change",async function(e){` +
    `var inp=e.target;if(!inp.hasAttribute||!inp.hasAttribute("data-rs-upload"))return;` +
    `var unit=inp.getAttribute("data-rs-upload"),files=[].slice.call(inp.files||[]);` +
    `if(!files.length)return;` +
    `var pop=inp.closest(".rs-pop"),slot=pop.querySelector("[data-rs-msg]");` +
    `slot.innerHTML='<div class="rs-msg rs-msg--n">'+${j(T(lang, "Feltöltés…"))}+'</div>';` +
    `var bad=[],good=[];` +
    `for(var i=0;i<files.length;i++){var f=files[i];` +
    `if(["image/jpeg","image/png","image/webp"].indexOf(f.type)<0){` +
    `bad.push("<b>"+esc(f.name)+"</b> "+${j(T(lang, "nem kép (JPEG, PNG vagy WEBP kell)"))});continue}` +
    `if(f.size>6000000){bad.push("<b>"+esc(f.name)+"</b> "+(f.size/1000000).toFixed(1).replace(".",",")+" MB — "+` +
    `${j(T(lang, "a legnagyobb feltölthető méret 6 MB"))});continue}good.push(f)}` +
    `try{var images=[];for(var j=0;j<good.length;j++){images.push({dataUrl:await read(good[j]),name:good[j].name,alt:""})}` +
    `var res=images.length?await (await fetch("/admin/photos",{method:"POST",` +
    `headers:{"Content-Type":"application/json"},body:JSON.stringify({images:images,unit:unit})})).json():{count:0,errors:[]};` +
    `(res.errors||[]).forEach(function(er){bad.push((er.file?"<b>"+esc(er.file)+"</b> ":"")+esc(er.reason))});` +
    `var parts=[];` +
    `if(res.count)parts.push(${j(T(lang, "{n} kép bekerült a közös képtárba, és hozzárendeltem ehhez az egységhez."))}.replace("{n}",res.count));` +
    `if(res.becameCover)parts.push(${j(T(lang, "Mivel nem volt borítóképe, az első feltöltött lett a borító."))});` +
    `if(bad.length)parts.push(bad.join(" "));` +
    // A részleges sikert MINDKÉT felével megőrizzük az újratöltés után: a rácsnak
    // és a képtárnak a szerver igazsága kell, az üzenetnek meg a teljes története.
    `sessionStorage.setItem("citRsMsg",JSON.stringify({u:unit,kind:bad.length?(res.count?"warn":"bad"):"ok",html:parts.join(" ")}));` +
    `if(res.count){location.href="/admin?tab=modulok&m=rooms&saved=1&e="+encodeURIComponent(unit)+"&fl=kep#szoba-"+unit}` +
    `else{show(slot,unit)}}` +
    `catch(err){sessionStorage.setItem("citRsMsg",JSON.stringify({u:unit,kind:"bad",html:${j(T(lang, "Hiba a feltöltéskor."))}}));show(slot,unit)}});` +
    `function show(slot,unit){var raw=sessionStorage.getItem("citRsMsg");if(!raw)return;` +
    `sessionStorage.removeItem("citRsMsg");var m=JSON.parse(raw);if(m.u!==unit)return;` +
    `slot.innerHTML='<div class="rs-msg rs-msg--'+m.kind+'" data-rs-notice>'+m.html+'</div>'}` +
    `var raw=sessionStorage.getItem("citRsMsg");` +
    `if(raw){var m=JSON.parse(raw);var slot=document.querySelector('[data-rs-modal="'+m.u+'"] [data-rs-msg]');` +
    `if(slot)show(slot,m.u);else sessionStorage.removeItem("citRsMsg")}` +
    `})();</script>`
  );
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
function unitsCard(booking: BookingEditorData, lang = "hu", nu?: NewUnitView): string {
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
        // ADR-0232: every unit is deletable while another remains — the whole place too.
        (multi
          ? `<button class="citui-btn citui-btn--ghost unit-row__del" type="submit" ` +
            `formaction="/admin/units/delete">${T(lang, "Törlés")}</button>`
          : "") +
        `</form>`,
    )
    .join("");

  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>Mit ad ki?</h2></div>` +
    newUnitFlash(nu, lang) +
    `<p class="adm-lead">` +
    (multi
      ? T(lang, "Minden egységnek külön naptára van, így külön telhet be.")
      : T(lang, "Ha nem egy egészet, hanem több szobát vagy apartmant ad ki, vegye fel őket külön — mindegyiknek saját naptára lesz.")) +
    `</p>` +
    rows +
    `<form method="POST" action="/admin/units/save" class="unit-row unit-row--new">` +
    wholeQuestion(booking.units, lang) +
    `<input class="citui-input unit-row__name" name="name" placeholder="${T(lang, "Pl. Kertre néző apartman")}" aria-label="${T(lang, "Új egység neve")}">` +
    `<span class="mcfg-suffix"><input class="citui-input unit-row__cap" name="capacity" type="number" ` +
    `inputmode="numeric" min="1" max="50" placeholder="2" aria-label="${T(lang, "Férőhely")}"><span>${T(lang, "fő")}</span></span>` +
    newUnitPriceFields(nu, lang) +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Hozzáadás")}</button>` +
    newUnitDecl(nu, lang) +
    `</form></div>`
  );
}

/**
 * The owner's review inbox (ADR-0046). The e-mail is the primary door — this is the
 * second one, for an owner who is already logged in or wants to take something down
 * later. A published review can still be withdrawn: the page is theirs.
 */
function reviewsEditor(data: ReviewsEditorData, showGoogle: boolean, lang = "hu"): string {
  // Approved contract: assets/design-refs/console/reviews-inbox/README.md.
  // The filled and the empty star are DIFFERENT glyphs and the count is written out,
  // so a 1-star review can never read as five — with or without colour.
  const stars = (n: number): string =>
    `<span class="rv-stars${n <= 2 ? " rv-stars--low" : ""}" role="img" data-rv-stars="${n}" ` +
    `aria-label="${esc(T(lang, "{n} csillag az 5-ből", { n }))}">` +
    `<span class="rv-stars__g" aria-hidden="true"><span class="on">${"★".repeat(n)}</span>` +
    `<span class="off">${"☆".repeat(5 - n)}</span></span>` +
    `<span class="rv-stars__n" aria-hidden="true">${n}/5</span></span>`;

  const row = (r: ReviewsEditorData["items"][number]): string => {
    const meta = [r.stayMonth, r.unitName].filter(Boolean).join(" · ");
    // Long words only get a toggle when there is something to unfold (≈3 lines).
    const long = r.body.length > 180;
    const tgl = `rvt_${esc(r.id)}`;
    // Both directions stay available whatever the current state: taking a published
    // review down must not require finding the original e-mail.
    const actions =
      `<form method="POST" action="/admin/review/decide" class="rv-row__acts">` +
      `<input type="hidden" name="id" value="${esc(r.id)}">` +
      (r.status !== "published"
        ? `<button class="citui-btn citui-btn--primary" type="submit" name="verdict" value="published">${T(lang, "Kiteszem")}</button>`
        : "") +
      (r.status !== "rejected"
        ? `<button class="citui-btn citui-btn--ghost" type="submit" name="verdict" value="rejected">` +
          (r.status === "published" ? T(lang, "Leveszem") : T(lang, "Nem teszem ki")) +
          `</button>`
        : "") +
      `</form>`;
    return (
      `<div class="rv-row" id="rv-${esc(r.id)}" data-rv="${esc(r.id)}" data-rating="${r.rating}">` +
      `<div class="rv-row__who"><strong>${esc(r.authorName)}</strong>` +
      (meta ? `<span class="rv-row__meta">${esc(meta)}</span>` : "") +
      `</div>` +
      stars(r.rating) +
      `<div class="rv-row__text">` +
      (long ? `<input type="checkbox" class="rv-row__tgl" id="${tgl}">` : "") +
      `<p class="rv-row__body${long ? " rv-row__body--clamp" : ""}">„${esc(r.body)}"</p>` +
      (long
        ? `<label class="rv-row__more" for="${tgl}"><span class="rv-more-open">${T(lang, "Teljes szöveg")}</span>` +
          `<span class="rv-more-close">${T(lang, "Kevesebb")}</span></label>`
        : "") +
      `</div>` +
      actions +
      `</div>`
    );
  };

  const groups: readonly [string, string, string][] = [
    ["pending", "wait", T(lang, "Döntésre vár")],
    ["published", "ok", T(lang, "Az oldalon")],
    ["rejected", "off", T(lang, "Nem került ki")],
  ];
  const waiting = data.items.filter((r) => r.status === "pending");
  const list = groups
    .map(([status, tone, label]) => {
      const rows = data.items.filter((r) => r.status === status);
      // The waiting group always shows (its zero is news); the others only when used.
      if (!rows.length && status !== "pending") return "";
      return (
        `<section class="rv-group rv-group--${tone}" data-rv-group="${status}">` +
        `<h3 class="rv-group__h">${label} <span class="n">${rows.length}</span></h3>` +
        `<div class="rv-group__rows">` +
        (rows.length
          ? rows.map(row).join("")
          : `<p class="rv-group__empty">${T(lang, "Nincs döntésre váró vélemény.")}</p>`) +
        `</div></section>`
      );
    })
    .join("");

  // What the last tap did, named — the owner should not have to find the row to check.
  const doneRow = data.done ? data.items.find((r) => r.id === data.done!.id) : undefined;
  const flash = doneRow
    ? `<p class="adm-saved rv-flash" role="status">${ic("check", 18)} <span>${
        data.done!.verdict === "published"
          ? T(lang, "{name} véleménye kikerült az oldalára.", { name: esc(doneRow.authorName) })
          : data.done!.verdict === "withdrawn"
            ? T(lang, "{name} véleményét levette az oldaláról.", { name: esc(doneRow.authorName) })
            : T(lang, "{name} véleménye nem kerül ki.", { name: esc(doneRow.authorName) })
      }</span></p>`
    : "";

  // The Google card mirrors the owner's toggle: with it off the number is REMOVED from
  // the page (tenant/editor.ts), so "this is on your page now" would be false.
  const googleCard = data.google
    ? `<div class="adm-card" data-rv-google="${showGoogle ? "on" : "off"}">` +
      `<div class="adm-card__head"><span class="adm-ico">${ic("star")}</span><h2>${T(lang, "Google-értékelés")}</h2></div>` +
      `<div class="rv-gr${showGoogle ? "" : " is-off"}"><span class="rv-gr__num">${data.google.value
        .toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>` +
      // The same rounding the page's stars use (honestStarCount) — this row shows what the visitor sees.
      `<span class="rv-stars" role="img" aria-label="${esc(T(lang, "{n} csillag az oldalon", { n: Math.max(1, Math.min(5, Math.round(data.google.value))) }))}">` +
      `<span class="rv-stars__g" aria-hidden="true"><span class="on">${"★".repeat(Math.max(1, Math.min(5, Math.round(data.google.value))))}</span></span></span>` +
      `<span class="rv-gr__cnt">${T(lang, "{n} értékelés a Google-on", { n: data.google.count })}</span></div>` +
      (showGoogle
        ? `<p class="rv-gr-state rv-gr-state--on">${ic("check", 16)}<span>${T(lang, "Ez látszik most az oldalán. A vendég rákattintva a Google-véleményekhez jut.")}</span></p>`
        : `<p class="rv-gr-state rv-gr-state--off">${ic("alert", 16)}<span>${T(lang, "Ez most nem látszik az oldalán: kikapcsolta lent, a Szabályok között („{label}”).", { label: T(lang, "A Google-értékelés csillagai az oldalon") })} ` +
          `<a href="#cfg_showGoogleRating">${T(lang, "Ugrás a kapcsolóhoz")}</a></span></p>`) +
      `<p class="citui-hint">${T(lang, "A vélemények SZÖVEGÉT a Google feltételei miatt nem másolhatjuk át az oldalára — csak az átlagot és a darabszámot mutathatjuk, ezért visz a kattintás a Google-re.")}</p>` +
      `<p style="margin:14px 0 0"><a class="citui-btn citui-btn--ghost" href="${esc(data.google.url)}" ` +
      `target="_blank" rel="noopener">${T(lang, "Megnézem, mit írnak a Google-on")}</a></p>` +
      `</div>`
    : "";

  return (
    googleCard +
    `<div class="adm-card rv-inbox" id="velemenyek">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>${T(lang, "Vendégvélemények")}</h2></div>` +
    flash +
    (data.items.length
      ? `<p class="adm-lead">${
          waiting.length
            ? T(lang, "{n} vélemény vár a döntésére.", { n: waiting.length })
            : T(lang, "Minden véleményről döntött.")
        }</p>` + list
      : `<p class="adm-lead">${T(lang, "Még nem érkezett vélemény. Az oldalán van egy űrlap, ahol a vendégek írhatnak — amint jön egy, e-mailt kap róla, és egy koppintással eldöntheti, kikerüljön-e.")}</p>`) +
    `</div>`
  );
}

function bookingEditor(
  moduleId: string,
  booking: BookingEditorData,
  lang = "hu",
  nu?: NewUnitView,
): string {
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
    `<span class="cal-sum__txt"><strong>${T(lang, "Mikor nem kiadó?")}${multi ? ` — ${esc(unitName)}` : ""}</strong>` +
    `<span>${esc(mv.label)}</span></span>` +
    `<span class="cal-sum__badge${mv.blockedCount === 0 ? " is-free" : ""}">${
      mv.blockedCount === 0
        ? T(lang, "minden nap kiadó")
        : T(lang, "{n} nap nem kiadó", { n: mv.blockedCount })
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
    unitsCard(booking, lang, nu)
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
  /** 0072: year-bound window ('YYYY-MM-DD'); null = timeless / recurring. */
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
  /** 0074: the recurring season this row is one YEAR's price of. */
  readonly parentId?: string | null;
}

export interface PricingEditorData {
  readonly units: EditorUnit[];
  /** unit id → its price rows (base first is not required; order is the owner's). */
  readonly prices: Record<string, EditorPrice[]>;
  readonly currency: string;
  /**
   * Is the booking module active? The per-period minimum and the "only in the
   * listed periods" switch act on the booking calendar alone; without it the guest
   * sends an enquiry the owner decides, so both would be switches that do nothing.
   * Required on purpose: a caller that forgets it must fail the type check.
   */
  readonly bookingActive: boolean;
  /**
   * Is the rooms module active? A module settings screen opens ONLY for an active
   * module (serveAdmin), so the "edit your rooms" button on top of this screen must
   * know where to send the owner: the rooms editor, or the Modulok tab to switch the
   * module on first (approved plan design-refs/console/pricing-rooms-link, 2026-09-25).
   * Required for the same reason as `bookingActive`.
   */
  readonly roomsActive: boolean;
  /** 0074: the season open for editing (`?edit=`), the one just saved (`?sv=`), and
   *  the year card just saved or refused (`?ev=<seasonId>-<year>`). */
  readonly editSeason?: string | null;
  readonly savedSeason?: string | null;
  readonly yearFocus?: string | null;
  /** A refusal that belongs next to the edited season / year card, not on top. */
  readonly inlineErrors?: string[];
  /** Tests pin the day; the page uses the real one. */
  readonly today?: string;
  /**
   * ADR-0208 ⑥.2–⑥.4: unit id → how complete its price list is, from the ONE
   * predicate (`unitPriceStatus`) the overview to-do and the reminder also read.
   * Required: a card that cannot say "hiányos" would contradict the to-do row.
   */
  readonly status: Readonly<Record<string, UnitPriceStatus>>;
}

/** "28 000" — grouped, no currency (the field shows the unit next to it). */
function grouped(n: number): string {
  return formatNumber(n);
}

/** "2027. 06. 15." — the admin's full-date spelling (the dated-base row uses it too). */
function isoNice(iso: string): string {
  return `${iso.slice(0, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;
}

/** JSON inside a <script> block: "<" escaped so a label can never close the tag. */
function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

/**
 * One recurring season on the Árazás page — approved plan season-year-price (B·1):
 * the season row (move · Szerkesztés · Törlés) or its edit form, then the YEAR STRIP:
 * one card per year, the next card always peeking at the right edge, endless to the
 * right (the script appends years as the owner scrolls). A card holds ONE year's own
 * price; empty, the recurring price holds that year — nothing breaks without one.
 */
function seasonBlock(
  s: EditorPrice,
  index: number,
  count: number,
  rows: readonly EditorPrice[],
  data: PricingEditorData,
  cur: string,
  lang: string,
  today: string,
): string {
  const bk = data.bookingActive;
  const from = s.from!;
  const to = s.to!;
  const wraps = from > to;
  const children = new Map<number, EditorPrice>();
  for (const r of rows) if (r.parentId === s.id && r.validFrom) children.set(Number(r.validFrom.slice(0, 4)), r);
  const editing = data.editSeason === s.id;
  const focus = data.yearFocus?.startsWith(`${s.id}-`) ? Number(data.yearFocus.slice(s.id.length + 1)) : null;
  const inlineErr = (data.inlineErrors ?? []).map((e) => `<p class="s-err" role="alert">${esc(e)}</p>`).join("");

  let head: string;
  if (editing) {
    const kept = [...children.values()].map((c) => seasonRule.occurrence(c.from!, c.to!, Number(c.validFrom!.slice(0, 4))).label);
    head =
      `<form method="POST" action="/admin/prices/season/edit" class="s-edit" data-sedit="${esc(s.id)}">` +
      `<input type="hidden" name="id" value="${esc(s.id)}">` +
      `<div class="s-edit__grid">` +
      `<input class="citui-input" name="label" value="${esc(s.label)}" aria-label="${T(lang, "Időszak neve")}">` +
      `<span class="price-new__dates"><input class="citui-input" name="from" value="${esc(from)}" maxlength="7" aria-label="${T(lang, "Kezdet (hónap-nap)")}">` +
      `<span>–</span><input class="citui-input" name="to" value="${esc(to)}" maxlength="7" aria-label="${T(lang, "Vég (hónap-nap)")}"></span>` +
      `<span class="mcfg-suffix"><input class="citui-input" name="amount" inputmode="numeric" value="${esc(grouped(s.amount))}" aria-label="${T(lang, "Ár")}"><span>${esc(cur)}</span></span>` +
      (bk
        ? `<span class="mcfg-suffix"><input class="citui-input" name="min_nights" inputmode="numeric" value="${s.minNights ?? ""}" placeholder="—" aria-label="${T(lang, "Legrövidebb foglalás ebben az időszakban")}"><span>${T(lang, "éj min.")}</span></span>`
        : "") +
      `</div>` +
      `<div data-sprev></div>` +
      (kept.length
        ? `<p class="citui-hint" style="margin:8px 0 0">${T(lang, "Az évre szóló árak ({years}) megmaradnak. Ahol nem adott meg saját napokat, ott az új napokra vonatkoznak.", { years: kept.join(", ") })}</p>`
        : "") +
      inlineErr +
      `<div class="s-btns"><button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Mentés")}</button>` +
      `<a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&amp;m=pricing#s-${esc(s.id)}">${T(lang, "Mégse")}</a></div>` +
      `</form>`;
  } else {
    const move =
      count > 1
        ? `<form method="POST" action="/admin/prices/season/move" class="s-move">` +
          `<input type="hidden" name="id" value="${esc(s.id)}">` +
          `<button class="up" type="submit" name="dir" value="up"${index === 0 ? " disabled" : ""} aria-label="${T(lang, "Feljebb")}" title="${T(lang, "Feljebb")}">${ic("chevron-down", 16)}</button>` +
          `<button type="submit" name="dir" value="down"${index === count - 1 ? " disabled" : ""} aria-label="${T(lang, "Lejjebb")}" title="${T(lang, "Lejjebb")}">${ic("chevron-down", 16)}</button>` +
          `</form>`
        : "";
    head =
      `<div class="price-row">` +
      `<span class="price-row__txt"><strong>${esc(s.label)}</strong>` +
      `<span>${esc(from)} – ${esc(to)} · ${T(lang, "minden évben")}` +
      (wraps ? `<span class="wrap-tag">${T(lang, "átnyúlik az év végén")}</span>` : "") +
      `</span></span>` +
      `<span class="price-row__amt">${esc(grouped(s.amount))} ${esc(cur)}` +
      (bk && s.minNights ? `<em style="display:block;font-style:normal;font-size:.8rem;color:var(--citui-muted)">${T(lang, "min. {n} éj", { n: s.minNights })}</em>` : "") +
      `</span>` +
      `<span class="season-act">${move}` +
      `<a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&amp;m=pricing&amp;edit=${esc(s.id)}#s-${esc(s.id)}">${T(lang, "Szerkesztés")}</a>` +
      `<form method="POST" action="/admin/prices/delete"><input type="hidden" name="id" value="${esc(s.id)}">` +
      `<button class="citui-btn citui-btn--ghost unit-row__del" type="submit">${T(lang, "Törlés")}</button></form>` +
      `</span></div>` +
      (data.savedSeason === s.id ? `<p class="s-flash">${T(lang, "Mentve.")}</p>` : "");
  }

  // The strip: from the first year not yet over, at least six cards, and always one
  // past the last year that has a price (and past the card just saved or refused).
  const first = seasonRule.firstOpenYear(from, to, today);
  const lastOwn = Math.max(first, ...children.keys(), focus ?? first);
  const n = Math.max(6, lastOwn - first + 2);
  const cells: string[] = [];
  for (let y = first; y < first + n; y++) {
    cells.push(yearCell(s, y, children.get(y) ?? null, focus === y ? data : null, cur, lang));
  }
  const firstLabel = seasonRule.occurrence(from, to, first).label;
  return (
    `<div class="season-block" id="s-${esc(s.id)}">` +
    head +
    `<div class="ys-head"><span class="ys-head__t" data-ys-t><b>${esc(firstLabel)}</b> · ${T(lang, "húzza oldalra a további évekért")}</span>` +
    `<button class="ys-arrow ys-arrow--l" type="button" data-ys-prev hidden aria-label="${T(lang, "Előző év")}">${ic("chevron-down", 18)}</button>` +
    `<button class="ys-arrow ys-arrow--r" type="button" data-ys-next hidden aria-label="${T(lang, "Következő év")}">${ic("chevron-down", 18)}</button></div>` +
    `<div class="ys-wrap"><div class="ys" data-strip data-sid="${esc(s.id)}" data-label="${esc(s.label)}" data-from="${esc(from)}" data-to="${esc(to)}" ` +
    `data-amount="${esc(grouped(s.amount))}" data-last="${first + n - 1}">` +
    cells.join("") +
    `<div class="ys-more" aria-hidden="true">${ic("chevron-down", 18)}</div>` +
    `</div></div></div>`
  );
}

/** One year of the strip — a form of its own, so it works without the script too. */
function yearCell(
  s: EditorPrice,
  y: number,
  own: EditorPrice | null,
  focusData: PricingEditorData | null,
  cur: string,
  lang: string,
): string {
  const ownDays = !!own && (own.from !== s.from || own.to !== s.to);
  const o = seasonRule.occurrence(own?.from ?? s.from!, own?.to ?? s.to!, y);
  const errs = focusData?.inlineErrors ?? [];
  const saved = !!focusData && !errs.length;
  return (
    `<form method="POST" action="/admin/prices/year" class="ys-cell${own ? " is-own" : ""}" id="ev-${esc(s.id)}-${y}" data-y="${y}" data-ylabel="${esc(o.label)}">` +
    `<input type="hidden" name="season" value="${esc(s.id)}"><input type="hidden" name="year" value="${y}">` +
    `<div class="ys-cell__y">${esc(o.label)}<em>${own ? T(lang, "saját ár") : T(lang, "az ismétlődő ár")}</em></div>` +
    `<div class="ys-cell__d">${esc(isoNice(o.start))} – ${esc(isoNice(o.end))}${ownDays ? ` · ${T(lang, "saját napok")}` : ""}</div>` +
    `<span class="mcfg-suffix"><input class="citui-input" name="amount" inputmode="numeric" value="${own ? esc(grouped(own.amount)) : ""}" ` +
    `placeholder="${esc(grouped(s.amount))}" aria-label="${T(lang, "{season} {year} ára", { season: s.label, year: o.label })}"><span>${esc(cur)}</span></span>` +
    `<details class="ys-days"><summary>${ownDays ? T(lang, "Napok módosítása") : T(lang, "Más napokon ebben az évben")}</summary>` +
    `<div class="ys-days__in"><input class="citui-input" name="from" value="${esc(own?.from ?? s.from)}" maxlength="7" aria-label="${T(lang, "Kezdet ebben az évben")}">` +
    `<span>–</span><input class="citui-input" name="to" value="${esc(own?.to ?? s.to)}" maxlength="7" aria-label="${T(lang, "Vég ebben az évben")}"></div></details>` +
    `<div class="ys-cell__act"><button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Mentés")}</button>` +
    (own ? `<button class="citui-btn citui-btn--ghost" type="submit" name="op" value="clear">${T(lang, "Vissza az ismétlődőre")}</button>` : "") +
    `</div>` +
    errs.map((e) => `<p class="s-err" role="alert">${esc(e)}</p>`).join("") +
    (saved
      ? `<p class="s-flash">${
          own
            ? T(lang, "Mentve — {season} {year}: {amount}. A honlap frissül.", { season: s.label, year: o.label, amount: `${grouped(own.amount)} ${cur}` })
            : T(lang, "Mentve — {year}: az ismétlődő ár érvényes ({amount}).", { year: o.label, amount: `${grouped(s.amount)} ${cur}` })
        }</p>`
      : "") +
    `</form>`
  );
}

/**
 * The strip and the live previews. Plain ES5, like the other editors' scripts. The
 * season rule (cit-season.cjs) rides along INLINE, so the preview names and dates a
 * year, and normalises "11.01", exactly as the server will store it.
 */
function seasonEditorScript(lang: string): string {
  const L = {
    drag: T(lang, "húzza oldalra a további évekért"),
    rec: T(lang, "az ismétlődő ár"),
    otherDays: T(lang, "Más napokon ebben az évben"),
    save: T(lang, "Mentés"),
    priceOf: T(lang, "{season} {year} ára"),
    startY: T(lang, "Kezdet ebben az évben"),
    endY: T(lang, "Vég ebben az évben"),
    valid: T(lang, "Így érvényes: {range}, minden évben."),
    wrapRange: T(lang, "{from} – a következő év {to}"),
    wrapEx: T(lang, "Átnyúlik az év végén, például {example}"),
    nextEx: T(lang, "Legközelebb: {example}"),
    bad: T(lang, "A dátumot hónap-nap alakban kérjük, például 11-01 vagy 11.01."),
    overlap: T(lang, "Átfed ezzel: {name} ({range}). A közös napokon a listán feljebb álló időszak ára számít: {winner}."),
    thisNew: T(lang, "ez az időszak (az új)"),
    thisOne: T(lang, "ez az időszak"),
  };
  return (
    `<script type="application/json" data-season-l>${scriptJson({ lang, L })}</script>` +
    `<script>${SEASON_JS}</script>` +
    `<script>(function(){` +
    `var D=JSON.parse(document.querySelector("[data-season-l]").textContent),L=D.L,S=window.CitSeason;if(!S)return;` +
    `var TODAY=new Date().toISOString().slice(0,10);` +
    `var fmt;try{fmt=new Intl.DateTimeFormat(D.lang,{month:"long",day:"numeric",timeZone:"UTC"})}catch(_){fmt=new Intl.DateTimeFormat("hu",{month:"long",day:"numeric",timeZone:"UTC"})}` +
    `function md(x){return fmt.format(new Date("2000-"+x+"T12:00:00Z"))}` +
    `function nice(i){return i.slice(0,4)+". "+i.slice(5,7)+". "+i.slice(8,10)+"."}` +
    `function esc(x){return String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")}` +
    `function sub(t,o){return t.replace(/\\{(\\w+)\\}/g,function(m,k){return o[k]!=null?o[k]:m})}` +
    // ── year strips ──
    `function cell(st,y){var o=S.occurrence(st.dataset.from,st.dataset.to,y),sid=st.dataset.sid;` +
    `return '<form method="POST" action="/admin/prices/year" class="ys-cell" id="ev-'+esc(sid)+'-'+y+'" data-y="'+y+'" data-ylabel="'+esc(o.label)+'">'` +
    `+'<input type="hidden" name="season" value="'+esc(sid)+'"><input type="hidden" name="year" value="'+y+'">'` +
    `+'<div class="ys-cell__y">'+esc(o.label)+'<em>'+esc(L.rec)+'</em></div>'` +
    `+'<div class="ys-cell__d">'+nice(o.start)+' – '+nice(o.end)+'</div>'` +
    `+'<span class="mcfg-suffix"><input class="citui-input" name="amount" inputmode="numeric" value="" placeholder="'+esc(st.dataset.amount)+'" aria-label="'+esc(sub(L.priceOf,{season:st.dataset.label,year:o.label}))+'"><span>'+esc(st.dataset.cur||"")+'</span></span>'` +
    `+'<details class="ys-days"><summary>'+esc(L.otherDays)+'</summary><div class="ys-days__in"><input class="citui-input" name="from" value="'+esc(st.dataset.from)+'" maxlength="7" aria-label="'+esc(L.startY)+'"><span>–</span><input class="citui-input" name="to" value="'+esc(st.dataset.to)+'" maxlength="7" aria-label="'+esc(L.endY)+'"></div></details>'` +
    `+'<div class="ys-cell__act"><button class="citui-btn citui-btn--primary" type="submit">'+esc(L.save)+'</button></div></form>'}` +
    `function sync(st){var b=st.closest(".season-block"),cs=st.querySelectorAll(".ys-cell"),left=st.scrollLeft,f=cs[0];` +
    `for(var i=0;i<cs.length;i++){if(cs[i].offsetLeft-st.offsetLeft+cs[i].offsetWidth/2>left){f=cs[i];break}}` +
    `var t=b.querySelector("[data-ys-t]");if(t&&f)t.innerHTML="<b>"+esc(f.dataset.ylabel)+"</b> · "+esc(L.drag);` +
    `var p=b.querySelector("[data-ys-prev]");if(p)p.disabled=left<4;` +
    `if(left+st.clientWidth>st.scrollWidth-260){var more=st.querySelector(".ys-more"),last=+st.dataset.last,h="";` +
    `for(var y=last+1;y<=last+4;y++)h+=cell(st,y);more.insertAdjacentHTML("beforebegin",h);st.dataset.last=last+4}}` +
    `document.querySelectorAll("[data-strip]").forEach(function(st){` +
    `var cur=st.querySelector(".mcfg-suffix span");if(cur)st.dataset.cur=cur.textContent;` +
    `var b=st.closest(".season-block");["prev","next"].forEach(function(k){var a=b.querySelector("[data-ys-"+k+"]");a.hidden=false;` +
    `a.addEventListener("click",function(){var c=st.querySelector(".ys-cell");st.scrollBy({left:(k==="next"?1:-1)*(c.offsetWidth+10),behavior:"smooth"})})});` +
    `st.addEventListener("scroll",function(){sync(st)},{passive:true});sync(st)});` +
    // a mail link or a save lands on #ev-<season>-<year>: bring that card into view
    `var h=location.hash.slice(1),el=h&&h.indexOf("ev-")===0?document.getElementById(h):null;` +
    `if(el){var st=el.closest("[data-strip]");st.scrollLeft=el.offsetLeft-st.offsetLeft-2;el.scrollIntoView({block:"center"});` +
    // ⛔ The browser's own jump to the #fragment runs AFTER this script and resets focus to
    // <body> (measured) — so the cursor goes in once the page has loaded.
    `if(!/[?&]saved=1/.test(location.search)){var inp=el.querySelector('input[name="amount"]');` +
    `if(inp){var go=function(){setTimeout(function(){el.scrollIntoView({block:"center"});inp.focus({preventScroll:true})},0)};if(document.readyState==="complete")go();else window.addEventListener("load",go)}}sync(st)}` +
    // ── previews: what the typed days MEAN, and which other season shares them ──
    `function preview(box,isNew){var out=box.querySelector("[data-sprev]");if(!out)return;` +
    `var fi=box.querySelector('input[name="from"]'),ti=box.querySelector('input[name="to"]');` +
    `if(!fi.value.trim()&&!ti.value.trim()){out.innerHTML="";return}` +
    `var f=S.normMonthDay(fi.value),t=S.normMonthDay(ti.value);` +
    `if(!f||!t){out.innerHTML='<p class="s-prev s-prev--bad">'+esc(L.bad)+"</p>";return}` +
    `var w=f>t,o=S.occurrence(f,t,S.firstOpenYear(f,t,TODAY)),ex="<b>"+nice(o.start)+" – "+nice(o.end)+"</b>";` +
    `var html='<p class="s-prev">'+sub(L.valid,{range:"<b>"+esc(w?sub(L.wrapRange,{from:md(f),to:md(t)}):md(f)+" – "+md(t))+"</b>"})+" "+sub(w?L.wrapEx:L.nextEx,{example:ex})+"</p>";` +
    `var card=box.closest("[data-seasons]"),all=card?JSON.parse(card.dataset.seasons):[],self=box.dataset.sedit||null,idx=self?all.map(function(x){return x.id}).indexOf(self):all.length;` +
    `all.forEach(function(x,i){if(x.id===self)return;var hit=false;for(var m=1;m<=12&&!hit;m++)for(var d=1;d<=31;d++){var k=(m<10?"0":"")+m+"-"+(d<10?"0":"")+d;` +
    `if(S.normMonthDay(k)&&S.covers(f,t,k)&&S.covers(x.from,x.to,k)){hit=true;break}}` +
    `if(hit)html+='<p class="s-warn">'+sub(L.overlap,{name:"<b>"+esc(x.label)+"</b>",range:'<span style="white-space:nowrap">'+esc(x.from+" – "+x.to)+"</span>",winner:"<b>"+esc(i<idx?x.label:(isNew?L.thisNew:L.thisOne))+"</b>"})+"</p>"});` +
    `out.innerHTML=html}` +
    `document.querySelectorAll("[data-sedit],[data-sadd]").forEach(function(box){var isNew=box.hasAttribute("data-sadd");` +
    `box.addEventListener("input",function(e){if(e.target.name==="from"||e.target.name==="to")preview(box,isNew)});preview(box,isNew)});` +
    `})();</script>`
  );
}

/**
 * ADR-0208 ⑥.2 — approved plan price-on-request, variant A: the "nem adok meg alapárat"
 * box under the base field, and ONE state line saying where the unit stands.
 *
 * The box is off while a timeless base exists: with it every night is priced, so the
 * decision would mean nothing (and saving a base clears it — see setBasePrice). It
 * saves on toggle, like the seasonal switch below; <noscript> keeps a button.
 * ⛔ "hetente emlékeztetjük" is a PROMISE on this screen: the weekly reminder
 * (priceGap.ts) reads the same status, so the sentence and the mail cannot drift.
 */
function priceDecision(
  u: EditorUnit,
  hasBase: boolean,
  hasSeasons: boolean,
  status: UnitPriceStatus,
  lang: string,
): string {
  const box =
    `<form method="POST" action="/admin/prices/request">` +
    `<input type="hidden" name="unit" value="${esc(u.id)}">` +
    `<label class="pr-decl${hasBase ? " is-off" : ""}">` +
    `<input type="checkbox" name="on" value="1"${u.priceOnRequest && !hasBase ? " checked" : ""}` +
    `${hasBase ? " disabled" : ""} onchange="this.form.submit()">` +
    `<span><strong>${T(lang, "Nem adok meg alapárat — ahol nincs ár, egyedi ajánlatot küldök")}</strong>` +
    `<span>${
      hasBase
        ? T(lang, "Alapárral minden éjszakának van ára — ehhez előbb törölje az alapárat.")
        : T(lang, "A vendég ilyenkor árajánlatot kér, és Ön a rendszerből válaszol.")
    }</span></span></label>` +
    `<noscript><button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mentés")}</button></noscript>` +
    `</form>`;
  const line =
    status === "on_request"
      ? `<p class="mcfg-empty mcfg-empty--said" data-price-state="on_request">${ic("check", 16)}<span>` +
        `<strong>${T(lang, "Kimondva: nem ad meg alapárat.")}</strong> ` +
        (hasSeasons
          ? T(lang, "Az időszaki árak érvényesek, a többi éjszakára a vendég árajánlatot kér.")
          : T(lang, "A vendég árajánlatot kér, és Ön a rendszerből válaszol.")) +
        ` ${T(lang, "Emlékeztetőt erről a szobáról nem küldünk.")}</span></p>`
      : status === "none" || status === "partial"
        ? `<p class="mcfg-empty" data-price-state="${status}">${ic("alert", 16)}<span>` +
          `<strong>${status === "none" ? T(lang, "Nincs ára.") : T(lang, "Az év egy részére nincs ára.")}</strong> ` +
          (status === "none"
            ? T(lang, "A vendég nem lát árat, és árajánlatot kér.")
            : T(lang, "Ott a vendég nem lát árat, és árajánlatot kér.")) +
          ` ${T(lang, "Adjon meg alapárat, vagy jelölje be, hogy nem ad meg. Amíg egyik sincs, hetente emlékeztetjük.")}</span></p>`
        : "";
  return box + (line ? `<div style="margin:0 0 18px">${line}</div>` : "");
}

/**
 * Prices, one card per unit. The owner prices a ROOM, so the screen is organised by
 * room and never asks them to think in a season × unit matrix — a grid is unusable
 * on a phone and unreadable to someone who has never met one.
 * Seasons are recurring MONTH-DAY, so a high season is entered once and holds every
 * year; making them re-enter it each January would guarantee stale prices.
 */
/**
 * ADR-0232 (owner 2026-09-25): the whole place has its OWN price, never the rooms'
 * sum — a derived figure would be a number nobody set (§B.17). This line is owner-side
 * orientation only: what the rooms cost together, so the owner knows what to price
 * against. The guest never sees it.
 */
function wholeSumHint(data: PricingEditorData, cur: string, today: string, lang: string): string {
  const rooms = data.units.filter((u) => !u.isWholeProperty);
  const bases = rooms.map((r) =>
    (data.prices[r.id] ?? []).find((p) => p.isBase && !p.validFrom && (!p.validTo || p.validTo >= today)),
  );
  const sum = bases.reduce((s, b) => s + (b?.amount ?? 0), 0);
  if (!sum) return "";
  const missing = bases.filter((b) => !b).length;
  return (
    `<p class="citui-hint" data-cit-whole-sum style="margin:-8px 0 14px">` +
    T(lang, "Tájékoztatásul: a szobák külön, együtt {sum} {cur} / éj.", { sum: grouped(sum), cur: esc(cur) }) +
    (missing ? " " + T(lang, "({n} egységnek nincs alapára.)", { n: missing }) : "") +
    " " +
    T(lang, "Az egész szállás ára ettől független — azt Ön adja meg.") +
    `</p>`
  );
}

function pricingEditor(data: PricingEditorData, lang = "hu"): string {
  // ⛔ Was `=== "EUR" ? "€" : "Ft"`, i.e. ANY other currency printed as forint.
  const cur = currencySign(data.currency);
  const bk = data.bookingActive;
  const cards = data.units
    .map((u) => {
      // 0072: a lapsed dated row can never price a night again — it is not shown
      // (the maintenance tick removes it). The "Alapár" field is the TIMELESS base
      // only; a dated base from the offer page is its own row below, with its dates,
      // so saving the field can neither overwrite it nor hide it.
      const today = data.today ?? new Date().toISOString().slice(0, 10);
      const rows = (data.prices[u.id] ?? []).filter((r) => !r.validTo || r.validTo >= today);
      const base = rows.find((r) => r.isBase && !r.validFrom);
      // 0074: a year price hangs under its season (parentId); only RECURRING seasons
      // are rows of their own. A year-bound season without a parent cannot be made
      // from this screen, but is still listed (with its dates) rather than hidden.
      const seasons = rows.filter((r) => !r.isBase && !r.parentId && !r.validFrom);
      const looseYearSeasons = rows.filter((r) => !r.isBase && !r.parentId && r.validFrom);
      const datedBases = rows.filter((r) => r.isBase && r.validFrom && r.validTo);
      const datedRows = datedBases
        .map(
          (b) =>
            `<div class="price-row">` +
            `<span class="price-row__txt"><strong>${T(lang, "Alapár, dátummal")}</strong>` +
            `<span>${esc(isoNice(b.validFrom!))} – ${esc(isoNice(b.validTo!))}</span></span>` +
            `<span class="price-row__amt">${esc(grouped(b.amount))} ${esc(cur)}</span>` +
            `<form method="POST" action="/admin/prices/delete">` +
            `<input type="hidden" name="id" value="${esc(b.id)}">` +
            `<button class="citui-btn citui-btn--ghost unit-row__del" type="submit">${T(lang, "Törlés")}</button>` +
            `</form></div>`,
        )
        .join("");

      const seasonRows = seasons.length || looseYearSeasons.length
        ? seasons.map((sn, i) => seasonBlock(sn, i, seasons.length, rows, data, cur, lang, today)).join("") +
          looseYearSeasons
            .map(
              (sn) =>
                `<div class="price-row"><span class="price-row__txt"><strong>${esc(sn.label)}</strong>` +
                `<span>${esc(isoNice(sn.validFrom!))} – ${esc(isoNice(sn.validTo!))}</span></span>` +
                `<span class="price-row__amt">${esc(grouped(sn.amount))} ${esc(cur)}</span>` +
                `<form method="POST" action="/admin/prices/delete"><input type="hidden" name="id" value="${esc(sn.id)}">` +
                `<button class="citui-btn citui-btn--ghost unit-row__del" type="submit">${T(lang, "Törlés")}</button></form></div>`,
            )
            .join("")
        : `<p class="citui-hint" style="margin:6px 0 12px">${T(lang, "Nincs külön időszaki ár — mindig az alapár érvényes.")}</p>`;

      return (
        `<div class="adm-card" id="ar-${esc(u.id)}" data-seasons="${esc(JSON.stringify(seasons.map((x) => ({ id: x.id, label: x.label, from: x.from, to: x.to }))))}">` +
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
        `<p class="citui-hint" style="margin:0 0 14px">${T(lang, "Ez érvényes, amikor egyik időszak sem.")}</p>` +
        (u.isWholeProperty && data.units.length > 1 ? wholeSumHint(data, cur, today, lang) : "") +
        priceDecision(u, Boolean(base), seasons.length > 0, data.status[u.id] ?? "none", lang) +
        (datedRows
          ? datedRows +
            `<p class="citui-hint" style="margin:6px 0 18px">${T(lang, "A dátumos alapár az árajánlatból került ide: a megadott napig érvényes, ahol nincs időszaki ár. Lejárat előtt e-mailben emlékeztetjük.")}</p>`
          : "") +
        // ② seasons
        `<h3 class="mcfg-sub">${T(lang, "Időszaki árak")}</h3>` +
        seasonRows +
        `<form method="POST" action="/admin/prices/season" class="price-new" data-sadd>` +
        `<input type="hidden" name="unit" value="${esc(u.id)}">` +
        `<input class="citui-input" name="label" placeholder="${T(lang, "Pl. Holtszezon")}" aria-label="${T(lang, "Időszak neve")}">` +
        `<span class="price-new__dates">` +
        `<input class="citui-input" name="from" placeholder="11-01" aria-label="${T(lang, "Kezdet (hónap-nap)")}" maxlength="7">` +
        `<span>–</span>` +
        `<input class="citui-input" name="to" placeholder="03-01" aria-label="${T(lang, "Vég (hónap-nap)")}" maxlength="7">` +
        `</span>` +
        `<span class="mcfg-suffix"><input class="citui-input" name="amount" type="number" ` +
        `inputmode="numeric" min="0" placeholder="0" aria-label="${T(lang, "Ár")}"><span>${esc(cur)}</span></span>` +
        // ADR-0049: the period carries its own minimum stay. A fortnight in August is
        // not a February weekend, and the owner should say so where they say the price.
        // Booking-only: without the calendar nothing would ever ask for it.
        (bk
          ? `<span class="mcfg-suffix"><input class="citui-input" name="min_nights" type="number" ` +
            `inputmode="numeric" min="1" max="60" placeholder="—" aria-label="${T(lang, "Legrövidebb foglalás ebben az időszakban")}">` +
            `<span>${T(lang, "éj min.")}</span></span>`
          : "") +
        `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Hozzáadás")}</button>` +
        `<div data-sprev style="flex-basis:100%"></div>` +
        `</form>` +
        `<p class="citui-hint" style="margin-top:10px">${T(lang, "A dátumot hónap-nap alakban kérjük (11-01). Ha a vége korábbi, mint az eleje (11-01 – 03-01), az időszak átnyúlik az év végén. Minden évben ugyanígy érvényes.")}` +
        (bk ? ` ${T(lang, "A „éj min.” üresen hagyva a foglalás-modulnál beállított általános minimum érvényes.")}` : "") +
        `</p>` +
        // ③ is this unit let all year, or only in the listed periods? Booking-only,
        // like the minimum: without booking the switch would flip and change nothing,
        // so it is not offered — one line says what booking would add (approved plan B).
        (bk
          ? `<form method="POST" action="/admin/units/seasonal" class="mcfg-row" style="margin-top:16px">` +
            `<input type="hidden" name="unit" value="${esc(u.id)}">` +
            `<span class="mcfg-row__txt"><strong>${T(lang, "Csak a felsorolt időszakokban adom ki")}</strong>` +
            `<span>${T(lang, "Bekapcsolva a többi napot a vendég nem is tudja kiválasztani. Kikapcsolva egész évben foglalható.")}</span></span>` +
            `<label class="adm-switch"><input type="checkbox" name="seasonal_only" value="1"` +
            `${u.seasonalOnly ? " checked" : ""} onchange="this.form.submit()" ` +
            `aria-label="${T(lang, "Csak a felsorolt időszakokban adom ki")}">` +
            `<span class="tr"></span><span class="th"></span></label>` +
            `<noscript><button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mentés")}</button></noscript>` +
            `</form>`
          : `<p class="citui-hint mcfg-bkline" data-cit-booking-only style="margin-top:16px">` +
            `<span class="adm-ico" style="vertical-align:middle">${ic("bookings")}</span> ` +
            `${T(lang, "Online foglalással azt is megadhatja, hogy csak ezekben az időszakokban adja ki, és időszakonként hány éjszaka a minimum.")} ` +
            `<br><a href="/admin?tab=modulok">${T(lang, "Online foglalás")} ›</a></p>`) +
        `</div>`
      );
    })
    .join("");

  // Approved plan B (design-refs/console/pricing-rooms-link, 2026-09-25): the note
  // keeps its sentence and gains a secondary button — the owner who wants to price
  // ROOMS rather than the whole property must add them first, and this screen had
  // no way there. A module screen opens only for an ACTIVE module (serveAdmin), so
  // without the rooms module the button goes to the Modulok tab to switch it on.
  const roomsHref = data.roomsActive ? "/admin?tab=modulok&m=rooms" : "/admin?tab=modulok";
  const roomsLabel = data.roomsActive
    ? T(lang, "Szobák, apartmanok szerkesztése")
    : T(lang, "Szobák modul bekapcsolása");

  return (
    `<p class="mcfg-note mcfg-note--act"><span>${T(lang, "Az árat egységenként adja meg — a vendég is így látja majd.")} ` +
    (data.units.length > 1
      ? T(lang, "Minden szobának/apartmannak saját ára lehet.")
      : T(lang, "Ha több szobát ad ki külön, előbb vegye fel őket a „Szobák, apartmanok” modulnál.")) +
    `</span>` +
    `<a class="citui-btn citui-btn--ghost citui-btn--sm" data-cit-rooms-link href="${roomsHref}">${roomsLabel}</a>` +
    `</p>` +
    cards +
    seasonEditorScript(lang)
  );
}

/**
 * The rooms screen's top note, with the way BACK to the pricing screen — the mirror
 * of the pricing screen's rooms button (approved plan B, design-refs/console/
 * pricing-rooms-link; the mirror by owner exception, 2026-09-25). Same rule: a module
 * screen opens only for an ACTIVE module, so without the pricing module the button
 * goes to the Modulok tab. `newUnit` carries the pricing state the server already
 * resolves for this screen (tenantHasModule = active in the tenant's module list);
 * a caller without it (a bare fixture) gets the note without the button — never a
 * button that claims a state nobody measured.
 */
function roomsNote(lang: string, nu: NewUnitView | undefined): string {
  const text = T(lang, "Ezek jelennek meg az oldalán. Ugyanezeket az egységeket használja a foglalás és az árazás is, tehát elég egy helyen karbantartani.");
  if (!nu) return `<p class="mcfg-note">${text}</p>`;
  const href = nu.pricingActive ? "/admin?tab=modulok&m=pricing" : "/admin?tab=modulok";
  const label = nu.pricingActive ? T(lang, "Árak, szezonok szerkesztése") : T(lang, "Árak modul bekapcsolása");
  return (
    `<p class="mcfg-note mcfg-note--act"><span>${text}</span>` +
    `<a class="citui-btn citui-btn--ghost citui-btn--sm" data-cit-pricing-link href="${href}">${label}</a></p>`
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
  /** The weekly program recommender's picker (`poi`, approved contract B). */
  readonly programs?: ProgramsEditorData;
  /** The shared photo library, so a ROOM CARD can assign pictures without
   *  sending the owner to the Fotók tab (approved plan B, 2026-08-25). */
  readonly photoLibrary?: readonly PhotoEdit[];
  /** Rooms screen: state of the amenities module for the per-unit picker
   *  (owner decision 2026-08-26: unit amenities need rooms AND amenities). */
  readonly unitAmenities?: UnitAmenityContext;
  /** ADR-0198 — which room is open, on which tab, and what the last action did.
   *  A POST round trip carries these back, so a star-click does not dump the owner
   *  on the first tab of a closed editor. */
  readonly roomsView?: RoomsView;
  /** ADR-0208 ⑥.3 — the new-unit row asks for a price when pricing is on, and the
   *  flash after a save says where the new unit stands (approved plan price-on-request ②). */
  readonly newUnit?: NewUnitView;
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
  /** The owner's last tap on this screen (PRG round trip), so the page can name it. */
  readonly done?: { id: string; verdict: "published" | "rejected" | "withdrawn" } | null;
}

/**
 * The weekly program recommender's picker (`poi`). APPROVED CONTRACT:
 * assets/design-refs/console/programajanlo/README.md — every "KÖT" line there is
 * behaviour this editor owes, and the guard (scripts/programs-editor-check.mts)
 * runs the README's measured list against THIS screen.
 */
export interface ProgramsEditorData {
  /** ok · no_location (the lead has no coordinates → no circle) · not_gathered
   *  (the first weekly run has not reached this tenant's settlements yet). */
  readonly state: "ok" | "no_location" | "not_gathered";
  readonly pool: readonly {
    id: string;
    start: string;
    end: string | null;
    name: string;
    settlement: string;
    /** null = "Helyben" (the tenant's own settlement). */
    distanceKm: number | null;
    sourceUrl: string;
    sourceHost: string;
  }[];
  /** The stored choice, in the tenant's order (contract ③). Ids whose program has
   *  expired are already filtered out by the caller — they fell off by themselves. */
  readonly picks: readonly { id: string; title?: string }[];
  readonly saved?: boolean;
}

/** Contract ②: at most this many programs go on the page. */
export const PROGRAMS_MAX = 10;

function programsEditor(data: ProgramsEditorData, lang = "hu"): string {
  const j = (v: unknown): string => JSON.stringify(v).replace(/</g, "\\u003c");
  const head =
    `<div class="adm-card__head"><span class="adm-ico">${ic("bookings")}</span>` +
    `<h2>${T(lang, "Automata heti programajánló")}</h2></div>`;
  if (data.state !== "ok") {
    const msg =
      data.state === "no_location"
        ? T(lang, "Nem ismerjük a szállás pontos helyét, ezért nem tudjuk, melyik környék programjait gyűjtsük. Írjon nekünk, és beállítjuk.")
        : T(lang, "Most gyűjtjük a környéke programjait. Körülbelül egy órán belül itt lesznek — addig nincs miből választani, és a honlapján sem jelenik meg a szakasz.");
    return `<div class="adm-card">${head}<p class="adm-lead">${msg}</p></div>`;
  }
  // Every owner-facing string is born here, through T(), and handed to the client
  // as data — the i18n guard reads the T() argument, a client literal would escape it.
  const L = {
    here: T(lang, "Helyben"),
    km: T(lang, "{n} km"),
    add: T(lang, "Felveszem"),
    remove: T(lang, "Leveszem"),
    up: T(lang, "Feljebb"),
    down: T(lang, "Lejjebb"),
    edit: T(lang, "átírom"),
    done: T(lang, "kész"),
    programs: T(lang, "{n} program"),
    emptyPool: T(lang, "Minden javasolt programot felvett."),
    autoFill: T(lang, "A szabad {n} helyre automatikusan a legközelebbi programok kerülnek, amíg Ön nem választ."),
    noneThisWeek: T(lang, "Ezen a héten nem találtunk programot a környékén. Hétfő reggel újra keresünk."),
    emptySel: T(lang, "Még nincs kiválasztva program. Vegyen fel a javasoltak közül — legfeljebb 10-et."),
  };
  const empty = (t: string): string =>
    `<div class="pa-empty">${ic("bookings", 30)}<span>${esc(t)}</span></div>`;
  return (
    `<div class="adm-card pa" data-pa-max="${PROGRAMS_MAX}">` +
    head +
    `<p class="adm-lead pa-intro">${T(lang, "A héten összegyűjtött programokból válassza ki, <b>melyik 10 jelenjen meg a honlapján</b>. A sorrend is az Öné — ami felül van, az kerül legelőre.")}</p>` +
    `<div class="pa-tabs" role="tablist">` +
    `<button type="button" class="is-on" data-pa-tab="pool" role="tab">${T(lang, "Javasolt")} (<span data-pa-n="pool">0</span>)</button>` +
    `<button type="button" data-pa-tab="sel" role="tab">${T(lang, "Az Ön oldalán")} (<span data-pa-n="sel">0</span>)</button>` +
    `</div>` +
    `<p class="pa-auto" data-pa-auto></p>` +
    `<div class="pa-full" data-pa-full hidden>${T(lang, "Betelt a 10 hely. Vegyen le egyet, ha mást szeretne felvenni.")}</div>` +
    `<div class="pa-cols">` +
    `<div class="pa-pane" data-pa-pane="pool"><div class="pa-paneh"><h3>${T(lang, "Javasolt programok")}</h3><span class="pa-c" data-pa-c="pool"></span></div>` +
    `<div class="pa-box" data-pa-list="pool">${empty(L.emptyPool)}</div></div>` +
    `<div class="pa-pane is-hide" data-pa-pane="sel"><div class="pa-paneh"><h3>${T(lang, "Az Ön oldalán")}</h3><span class="pa-c" data-pa-c="sel"></span></div>` +
    `<div class="pa-box pa-box--sel" data-pa-list="sel">${empty(L.emptySel)}</div></div>` +
    `</div>` +
    `<form method="POST" action="/admin/programs" class="pa-foot">` +
    `<input type="hidden" name="picks" value="">` +
    `<span class="pa-sp"></span>` +
    `<span class="pa-saved"${data.saved ? "" : " hidden"}>${ic("check", 16)} ${T(lang, "Mentve")}</span>` +
    `<button class="citui-btn citui-btn--primary" type="submit" data-pa-save disabled>${T(lang, "Mentés a honlapra")}</button>` +
    `</form>` +
    `<p class="pa-refresh"><b>${T(lang, "Következő frissítés:")}</b> ${T(lang, "hétfő reggel. Az Ön választása és sorrendje megmarad; a lejárt programok maguktól lekerülnek a honlapjáról.")}</p>` +
    `<script type="application/json" data-pa-data>${j({ pool: data.pool, picks: data.picks, lang, L })}</script>` +
    `</div>` +
    programsEditorScript()
  );
}

/** The picker's behaviour. Plain ES5 in a string, like the other editors' scripts. */
function programsEditorScript(): string {
  return (
    `<script>(function(){` +
    `var root=document.querySelector(".pa");if(!root)return;` +
    `var D=JSON.parse(root.querySelector("[data-pa-data]").textContent),L=D.L,MAX=+root.dataset.paMax;` +
    `var byId={};D.pool.forEach(function(e){byId[e.id]=e});` +
    `var sel=[],titles={};D.picks.forEach(function(p){if(byId[p.id]&&sel.indexOf(p.id)<0){sel.push(p.id);if(p.title)titles[p.id]=p.title}});` +
    `var initial=JSON.stringify(state());` +
    `var fmt;try{fmt=new Intl.DateTimeFormat(D.lang,{month:"short",day:"numeric",timeZone:"UTC"})}catch(_){fmt=new Intl.DateTimeFormat("hu",{month:"short",day:"numeric",timeZone:"UTC"})}` +
    `function day(s){return fmt.format(new Date(s+"T12:00:00Z"))}` +
    `function when(e){return e.end?day(e.start)+" – "+day(e.end):day(e.start)}` +
    `function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")}` +
    `function dist(e){return e.distanceKm==null?L.here:L.km.replace("{n}",e.distanceKm)}` +
    `function state(){return sel.map(function(id){return titles[id]?{id:id,title:titles[id]}:{id:id}})}` +
    `function item(e,where,i){var ctrl=where==="pool"` +
    `?'<button type="button" class="pa-add" data-pa-act="add" data-id="'+e.id+'" title="'+esc(L.add)+'" aria-label="'+esc(L.add+": "+e.name)+'"'+(sel.length>=MAX?" disabled":"")+'>+</button>'` +
    `:'<div class="pa-ctrl"><button type="button" data-pa-act="up" data-id="'+e.id+'" title="'+esc(L.up)+'" aria-label="'+esc(L.up)+'"'+(i===0?" disabled":"")+'>&#9650;</button>'` +
    `+'<button type="button" data-pa-act="down" data-id="'+e.id+'" title="'+esc(L.down)+'" aria-label="'+esc(L.down)+'"'+(i===sel.length-1?" disabled":"")+'>&#9660;</button></div>'` +
    `+'<button type="button" class="pa-rm" data-pa-act="remove" data-id="'+e.id+'" title="'+esc(L.remove)+'" aria-label="'+esc(L.remove+": "+e.name)+'">&times;</button>';` +
    `var name=where==="sel"&&titles[e.id]?titles[e.id]:e.name;` +
    `return '<div class="pa-it" data-pa-item="'+e.id+'"><div class="pa-body"><div class="pa-d">'+esc(when(e))+'</div>'` +
    `+'<div class="pa-n" data-pa-name="'+where+'">'+esc(name)+'</div>'` +
    `+'<div class="pa-m">'+esc(e.settlement)+' · <span class="pa-dist'+(e.distanceKm==null?" is-here":"")+'">'+esc(dist(e))+'</span> · '` +
    `+'<a href="'+esc(e.sourceUrl)+'" target="_blank" rel="noopener nofollow">'+esc(e.sourceHost)+'</a>'` +
    `+(where==="sel"?' · <button type="button" class="pa-pen" data-pa-act="edit" data-id="'+e.id+'">'+esc(L.edit)+'</button>':"")` +
    `+'</div></div><div class="pa-acts">'+ctrl+'</div></div>'}` +
    `var emptyIcon=root.querySelector(".pa-empty svg");emptyIcon=emptyIcon?emptyIcon.outerHTML:"";` +
    `function render(){var pool=D.pool.filter(function(e){return sel.indexOf(e.id)<0});` +
    `root.querySelector('[data-pa-list=pool]').innerHTML=pool.length?pool.map(function(e){return item(e,"pool")}).join(""):'<div class="pa-empty">'+emptyIcon+"<span>"+esc(D.pool.length?L.emptyPool:L.noneThisWeek)+"</span></div>";` +
    `root.querySelector('[data-pa-list=sel]').innerHTML=sel.length?sel.map(function(id,i){return item(byId[id],"sel",i)}).join(""):'<div class="pa-empty">'+emptyIcon+"<span>"+esc(L.emptySel)+"</span></div>";` +
    `root.querySelector('[data-pa-c=pool]').textContent=L.programs.replace("{n}",pool.length);` +
    `var c=root.querySelector('[data-pa-c=sel]');c.textContent=sel.length+" / "+MAX;c.classList.toggle("is-full",sel.length>=MAX);` +
    `root.querySelector('[data-pa-n=pool]').textContent=pool.length;root.querySelector('[data-pa-n=sel]').textContent=sel.length;` +
    `root.querySelector("[data-pa-full]").hidden=sel.length<MAX;` +
    `var au=root.querySelector("[data-pa-auto]");au.hidden=sel.length>=MAX||!D.pool.length;au.textContent=L.autoFill.replace("{n}",MAX-sel.length);` +
    `var st=JSON.stringify(state());root.querySelector("input[name=picks]").value=st;` +
    `root.querySelector("[data-pa-save]").disabled=st===initial;` +
    `if(st!==initial){var sv=root.querySelector(".pa-saved");if(sv)sv.hidden=true}}` +
    `function commitEdit(){var t=root.querySelector('[data-pa-name=sel][contenteditable=true]');if(!t)return;` +
    `var id=t.closest("[data-pa-item]").getAttribute("data-pa-item");var v=t.textContent.replace(/\\s+/g," ").trim().slice(0,120);` +
    `if(v&&v!==byId[id].name)titles[id]=v;else delete titles[id]}` +
    `root.addEventListener("click",function(ev){var b=ev.target.closest("button[data-pa-act],button[data-pa-tab]");if(!b)return;` +
    `if(b.dataset.paTab){root.querySelectorAll("[data-pa-tab]").forEach(function(x){x.classList.toggle("is-on",x===b)});` +
    `root.querySelectorAll("[data-pa-pane]").forEach(function(p){p.classList.toggle("is-hide",p.dataset.paPane!==b.dataset.paTab)});return}` +
    `var id=b.dataset.id,a=b.dataset.paAct,k=sel.indexOf(id);` +
    `if(a==="edit"){var t=b.closest("[data-pa-item]").querySelector("[data-pa-name]");` +
    `if(t.getAttribute("contenteditable")==="true"){commitEdit();render()}` +
    `else{commitEdit();t.setAttribute("contenteditable","true");b.textContent=L.done;t.focus()}return}` +
    `commitEdit();` +
    `if(a==="add"&&k<0&&sel.length<MAX)sel.push(id);` +
    `else if(a==="remove"&&k>=0){sel.splice(k,1);delete titles[id]}` +
    `else if(a==="up"&&k>0){sel[k]=sel[k-1];sel[k-1]=id}` +
    `else if(a==="down"&&k>=0&&k<sel.length-1){sel[k]=sel[k+1];sel[k+1]=id}` +
    `render()});` +
    `root.addEventListener("keydown",function(ev){if(ev.key==="Enter"&&ev.target.matches("[contenteditable=true]")){ev.preventDefault();commitEdit();render()}});` +
    `root.querySelector("form.pa-foot").addEventListener("submit",function(){commitEdit();render()});` +
    `render()})();</script>`
  );
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
      ? bookingEditor(moduleId, opts.booking, lang, opts.newUnit)
      : def.editor === "rooms" && opts.units
        ? // ADR-0198 — a kártyarács + felugró + fülek szerkesztő. EGY egységnél a mai
          // képernyő marad: ott nincs mit „átlátni", és saját aloldal sem születik
          // (a szoba-oldal feltétele több egység), tehát a rács állapot-jelvénye
          // olyat állítana, ami egy egységnél nem igaz.
          opts.units.length > 1
          ? roomsNote(lang, opts.newUnit) +
            roomsEditor(
              opts.units,
              opts.photoLibrary ?? [],
              opts.unitAmenities,
              opts.roomsView ?? {},
              lang,
              opts.newUnit,
            ) +
            amenityPickerScript(lang) +
            roomEditorScript(lang)
          : roomsNote(lang, opts.newUnit) +
            unitsCard({ units: opts.units, unitId: opts.units[0]?.id ?? "" } as BookingEditorData, lang, opts.newUnit)
        : def.editor === "pricing" && opts.pricing
          ? pricingEditor(opts.pricing, lang)
          : def.editor === "reviews" && opts.reviews
            ? reviewsEditor(opts.reviews, opts.values.showGoogleRating !== false, lang)
            : def.editor === "programs" && opts.programs
              ? programsEditor(opts.programs, lang)
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
          : def.editor === "programs" && opts.programs
            ? helpLink("admin.modules.programs", lang)
            : amenityStored
            ? helpLink("admin.modules.amenities", lang)
            : def.editor === "reviews" && opts.reviews
              ? helpLink("admin.modules.reviews", lang)
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
export function guestPageShell(
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
      `<div style="background:color-mix(in srgb,var(--citui-bad) 7%,var(--citui-panel));` +
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
  "programs",
]);

/** Can the owner set anything on this module TODAY? (Drives the link and the lint.) */
export function hasSettingsScreen(moduleId: string): boolean {
  const def = MODULE_CONFIG_REGISTRY[moduleId];
  if (!def) return false;
  return def.fields.length > 0 || (def.editor !== undefined && IMPLEMENTED_EDITORS.has(def.editor));
}
