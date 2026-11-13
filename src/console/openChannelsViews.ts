// „Megnyitás csatornánként” — the dashboard card (frozen plan:
// assets/design-refs/console/csatorna-megnyitas/, „B” — channel tiles, owner 2026-11-13).
// Four tiles (E-mail · SMS / MMS · Viber · WhatsApp): the big number is the 7-day rate,
// below it the three periods side by side. A tile opens the Riport „Honnan nyitották”
// panel with the channel's row unfolded.

import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import { OPEN_CHANNELS, OPEN_PERIODS, type OpenCell, type OpenChannel, type OpenChannelsData, type OpenPeriod } from "./openChannels.js";

// Local escaper: views.ts imports this module, so importing its `esc` back would be a cycle.
const esc = (v: unknown): string =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const CHANNEL_LABEL = (lang: string): Record<OpenChannel, string> => ({
  email: T(lang, "E-mail"),
  sms: T(lang, "SMS / MMS"),
  viber: T(lang, "Viber"),
  whatsapp: T(lang, "WhatsApp"),
});

const PERIOD_LABEL = (lang: string): Record<OpenPeriod, string> => ({
  today: T(lang, "Ma"),
  "7": T(lang, "7 nap"),
  "0": T(lang, "Összes"),
});

/** Rate with one decimal, a whole number without it; nothing sent → „—”. */
export function openRate(c: OpenCell): string {
  if (!c.got) return "—";
  const p = Math.round((c.opened / c.got) * 1000) / 10;
  return `${Number.isInteger(p) ? p.toFixed(0) : p.toFixed(1).replace(".", ",")}%`;
}

function tile(ch: OpenChannel, d: OpenChannelsData, lang: string): string {
  const c = d["7"].cells[ch];
  const fill = c.got ? Math.min(100, (c.opened / c.got) * 200) : 0; // the bar is full at 50%
  const trio = OPEN_PERIODS.map((k) => {
    const x = d[k].cells[ch];
    return `<div class="oc-p${k === "7" ? " is-on" : ""}"><b${x.got ? "" : ' class="oc-z"'}>${esc(openRate(x))}</b><span>${esc(PERIOD_LABEL(lang)[k])}</span></div>`;
  }).join("");
  return (
    `<a class="oc-tile" data-oc="${ch}" href="/report?days=7#os-${ch}">` +
    `<span class="oc-h"><i class="oc-sq rp-os-${ch}"></i>${esc(CHANNEL_LABEL(lang)[ch])}</span>` +
    `<span class="oc-hero">${esc(openRate(c))}<small>${esc(T(lang, "7 nap"))}</small></span>` +
    `<span class="oc-of">${esc(c.got ? T(lang, "{o} megnyitotta a {g} kapottból", { o: c.opened, g: c.got }) : T(lang, "nem ment ki"))}</span>` +
    `<span class="oc-meter"><i class="rp-os-${ch}" style="width:${fill.toFixed(1)}%"></i></span>` +
    `<span class="oc-trio">${trio}</span></a>`
  );
}

export function openChannelsCard(d: OpenChannelsData, icon: string, lang = consoleLang()): string {
  return (
    `<div class="con-w oc-card" data-widget="open-channels" id="open-channels">` +
    `<div class="con-w__h">${icon}${esc(T(lang, "Megnyitás csatornánként"))}<a class="oc-more" href="/report?days=7#honnan">${esc(T(lang, "Riport ▸ Honnan nyitották"))}</a></div>` +
    `<div class="con-w__s">${esc(T(lang, "Nagy szám: elmúlt 7 nap. Alatta mindhárom időszak egymás mellett. A sáv 50%-nál telik meg."))}</div>` +
    `<div class="oc-tiles">${OPEN_CHANNELS.map((ch) => tile(ch, d, lang)).join("")}</div>` +
    `<div class="oc-foot">${esc(T(lang, "Megnyitás = a kiküldött linkre kattintott ebből a csatornából; a levél megnyitását nem mérjük. Kapta = az időszakban ezen a csatornán ment ki neki a link."))} ` +
    `<b>${esc(T(lang, "Nem eldönthető"))}</b> ${esc(T(lang, "(több csatornán kapta, a link még jel nélküli volt): {n} megnyitó lead (7 nap).", { n: d["7"].unknown }))}</div>` +
    `</div>`
  );
}
