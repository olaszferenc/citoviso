// ORSZÁG-RÉTEG 3/8 (ADR-0460) — the console's „Országok” lap: one row per country (the
// `country` table, ADR-0437), its NYITÁS ELŐTTI TELJESSÉG (src/countryReadiness.ts) and the
// market gate's approve / revoke (ADR-0111 — moved here from the old /settings „Piacok” panel).
//
// The approved design (owner, 2026-11-19): assets/design-refs/console/orszagok/ — variant B,
// the OPENING MATRIX. Desktop: a matrix (row = country, column = closing condition), any cell
// opens the right-hand panel AT that step. Phone: cards with a six-part bar and the "next
// thing to do"; the country opens as a full-screen sheet with steps (Adatok → Ár → Nyelv →
// Jog → Megkeresés → Megnyitás). The two layouts switch on the container width (@container),
// not on the window.
//
// Server-rendered, every text through T(): the live check posts the form to /countries/check
// and gets back the field errors and the re-rendered fragments of THESE functions — the
// browser computes nothing on its own (one truth: the readiness function).
import type { CountryReadiness, ReadinessItem, ReadinessState } from "../countryReadiness.js";
import {
  COUNTRY_CHANNELS,
  holidayYearCovered,
  validTimeZone,
  type CountryDraft,
  type CountryErrors,
  type CountryField,
} from "../countryRules.js";
import { isTaxableBuyerCountry } from "../billing/taxCounters.js";
import { T } from "../i18n/mail.js";
import { providerAccepts } from "../payment/providers.js";
import { minorDigits } from "../text/money.js";
import { jsonForScript } from "../text/jsonForScript.js";
import { consoleLang } from "./i18nCtx.js";
import { esc, helpLink, layout } from "./views.js";

// ── data the server hands the view ─────────────────────────────────────────────────────────
export interface CountryMarketInfo {
  readonly approved: boolean;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
  readonly note: string | null;
  readonly log: readonly { action: string; actor: string; reason: string; at: Date }[];
}

export interface CountryListEntry {
  readonly iso: string;
  readonly name: string;
  readonly lang: string;
  readonly currency: string;
  readonly timeZone: string;
  readonly hasRow: boolean;
  readonly home: boolean;
  readonly readiness: CountryReadiness;
  readonly market: CountryMarketInfo;
}

export type CountryStep = "data" | "prices" | "babel" | "legal" | "outreach" | "open";
export type CountrySub = "identity" | "discovery" | "phone" | "legal";

export interface CountryEditor {
  readonly iso: string;
  readonly isNew: boolean;
  readonly draft: CountryDraft;
  readonly errors: CountryErrors;
  /** Fields whose error is shown (a fresh row is not a red wall); "all" after a failed save. */
  readonly touched: readonly string[] | "all";
  /** Readiness of the DRAFT (live) — the stored row's when nothing changed. */
  readonly readiness: CountryReadiness;
  readonly step: CountryStep;
  readonly sub: CountrySub;
  /** The draft differs from the saved row (the gate then asks to save first). */
  readonly dirty: boolean;
  readonly home: boolean;
  readonly market: CountryMarketInfo;
  readonly regions: readonly { region: string; currency: string; complete: boolean }[];
  readonly providers: readonly string[];
  /** "now" — the two holiday years and the zone clock. */
  readonly now: Date;
}

export const COUNTRY_STEPS: readonly CountryStep[] = ["data", "prices", "babel", "legal", "outreach", "open"];
export const COUNTRY_SUBS: readonly CountrySub[] = ["identity", "discovery", "phone", "legal"];

/** Which data sub-tab a field lives on (the save jumps to the first error's place). */
const FIELD_PLACE: Readonly<Record<CountryField, { step: CountryStep; sub?: CountrySub }>> = {
  iso2: { step: "data", sub: "identity" },
  name: { step: "data", sub: "identity" },
  aliases: { step: "data", sub: "identity" },
  defaultLang: { step: "data", sub: "identity" },
  timeZone: { step: "data", sub: "identity" },
  currency: { step: "data", sub: "identity" },
  pricingRegion: { step: "data", sub: "identity" },
  paymentProvider: { step: "data", sub: "identity" },
  touristTaxModel: { step: "data", sub: "identity" },
  invoiceLang: { step: "data", sub: "identity" },
  areaBbox: { step: "data", sub: "discovery" },
  searchKeywords: { step: "data", sub: "discovery" },
  portalDomains: { step: "data", sub: "discovery" },
  ownSiteTlds: { step: "data", sub: "discovery" },
  searchLang: { step: "data", sub: "discovery" },
  searchRegion: { step: "data", sub: "discovery" },
  browserLocale: { step: "data", sub: "discovery" },
  acceptLanguage: { step: "data", sub: "discovery" },
  dialCode: { step: "data", sub: "phone" },
  trunkPrefix: { step: "data", sub: "phone" },
  mobilePrefixes: { step: "data", sub: "phone" },
  phonePlan: { step: "data", sub: "phone" },
  phoneNsn: { step: "data", sub: "phone" },
  outreachChannels: { step: "outreach" },
  sendWindow: { step: "outreach" },
  dailyQuota: { step: "outreach" },
  publicHolidays: { step: "outreach" },
};

/** Where the first error of a failed save is (step + sub-tab). */
export function placeOfFirstError(errors: CountryErrors): { step: CountryStep; sub: CountrySub } | null {
  const k = Object.keys(errors)[0] as CountryField | undefined;
  if (!k) return null;
  const p = FIELD_PLACE[k];
  return { step: p.step, sub: p.sub ?? "identity" };
}

// ── icons (inline SVG, currentColor — the approved design's set) ───────────────────────────
const SVG = (inner: string, size = 16): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
export const ICON = {
  ok: SVG(`<circle cx="12" cy="12" r="10" fill="currentColor" opacity=".16"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`),
  bad: SVG(`<circle cx="12" cy="12" r="10" fill="currentColor" opacity=".16"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`),
  warn: SVG(`<circle cx="12" cy="12" r="10" fill="currentColor" opacity=".16"/><path d="M12 7v6.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.3" fill="currentColor"/>`),
  na: SVG(`<circle cx="12" cy="12" r="3" fill="currentColor"/>`),
  plus: SVG(`<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`),
  x: SVG(`<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`, 14),
  lock: SVG(`<rect x="5" y="10.5" width="14" height="9.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/>`),
  check: SVG(`<path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`, 12),
};

/** The six matrix columns: readiness item → the step its cell opens. */
const COLS: readonly { key: ReadinessItem["key"]; step: CountryStep }[] = [
  { key: "data", step: "data" },
  { key: "prices", step: "prices" },
  { key: "babel", step: "babel" },
  { key: "legal", step: "legal" },
  { key: "holidays", step: "outreach" },
  { key: "channel", step: "outreach" },
];

function colLabel(lang: string, key: ReadinessItem["key"]): string {
  switch (key) {
    case "data": return T(lang, "Adatok");
    case "prices": return T(lang, "Ár");
    case "babel": return T(lang, "Nyelv");
    case "legal": return T(lang, "Jog");
    case "holidays": return T(lang, "Ünnep");
    case "channel": return T(lang, "Csatorna");
    default: return key;
  }
}

function stepTitle(lang: string, s: CountryStep): string {
  switch (s) {
    case "data": return T(lang, "Adatok");
    case "prices": return T(lang, "Ár és fizetés");
    case "babel": return T(lang, "Nyelv");
    case "legal": return T(lang, "Jog");
    case "outreach": return T(lang, "Megkeresés");
    case "open": return T(lang, "Megnyitás");
  }
}

const STEP_KEYS: Readonly<Record<CountryStep, readonly ReadinessItem["key"][]>> = {
  // Piacnyitás 2026-11-26: the chain lexicon box stands on the data step (no new column).
  data: ["data", "lexicon"],
  // NEMZETKÖZI C: the wallet box stands on the price step beside the price sheet (no new column).
  prices: ["prices", "wallet"],
  babel: ["babel"],
  legal: ["legal", "adr"],
  outreach: ["holidays", "channel"],
  open: [],
};

const fmtAt = (d: Date | null): string => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—");

function worst(items: readonly ReadinessItem[]): ReadinessState {
  return items.some((i) => i.state === "bad") ? "bad" : items.some((i) => i.state === "warn") ? "warn" : "ok";
}

function countDone(items: readonly ReadinessItem[]): { done: number; total: number } {
  const g = items.filter((i) => i.gating);
  return { done: g.filter((i) => i.state !== "bad").length, total: g.length };
}

// ── list: status tag, matrix row, card ─────────────────────────────────────────────────────
function statusTag(lang: string, home: boolean, approved: boolean, r: CountryReadiness): string {
  if (home && approved && r.complete) return `<span class="cty-tag cty-tag--ok">${esc(T(lang, "nyitva · hazai"))}</span>`;
  if (approved) {
    return r.complete
      ? `<span class="cty-tag cty-tag--ok">${esc(T(lang, "nyitva"))}</span>`
      : `<span class="cty-tag cty-tag--warn">${esc(T(lang, "jóváhagyva, hiányos"))}</span>`;
  }
  return r.complete
    ? `<span class="cty-tag cty-tag--ok">${esc(T(lang, "megnyitható"))}</span>`
    : `<span class="cty-tag">${esc(T(lang, "zárva"))}</span>`;
}

const hrefOf = (iso: string, step: CountryStep): string => `/countries?iso=${encodeURIComponent(iso)}&step=${step}`;

/** One matrix row (also a live-check fragment: #mxrow-<ISO>). */
export function matrixRow(e: CountryListEntry, selected: boolean): string {
  const lang = consoleLang();
  const cells = COLS.map((c) => {
    const it = e.readiness.items.find((i) => i.key === c.key);
    const st = it ? it.state : "na";
    const label = `${e.name || e.iso} — ${colLabel(lang, c.key)}: ${it ? it.detail : ""}`;
    const href = e.hasRow ? hrefOf(e.iso, c.step) : `/countries?new=${encodeURIComponent(e.iso)}`;
    return `<td><a class="cty-mx__c cty-mx__c--${st}" href="${esc(href)}" data-open="${esc(e.iso)}" data-step="${c.step}" title="${esc(label)}" aria-label="${esc(label)}">${ICON[st]}</a></td>`;
  }).join("");
  const sub = e.hasRow
    ? `${esc(e.lang)} · ${esc(e.currency)} · ${esc(e.timeZone)}`
    : esc(T(lang, "nincs ország-sor — találkoztunk vele (terület vagy vevő)"));
  return `<tr id="mxrow-${esc(e.iso)}" data-row="${esc(e.iso)}"${selected ? ' aria-selected="true"' : ""}>
    <td><a class="cty-mx__name" href="${esc(e.hasRow ? hrefOf(e.iso, "data") : `/countries?new=${encodeURIComponent(e.iso)}`)}" data-open="${esc(e.iso)}" data-step="data"><span class="cty-iso">${esc(e.iso)}</span><span class="cty-mx__n"><b>${esc(e.name || e.iso)}</b><span>${sub}</span></span></a></td>
    ${cells}
    <td class="cty-mx__st">${statusTag(lang, e.home, e.market.approved, e.readiness)}</td></tr>`;
}

/** One phone card (also a live-check fragment: #card-<ISO>). */
export function countryCard(e: CountryListEntry): string {
  const lang = consoleLang();
  const items = e.readiness.items;
  const next = items.find((i) => i.gating && i.state === "bad");
  const warn = items.find((i) => i.state === "warn");
  const step = next ? ((Object.keys(STEP_KEYS) as CountryStep[]).find((s) => STEP_KEYS[s].includes(next.key)) ?? "data") : "open";
  const href = e.hasRow ? hrefOf(e.iso, step) : `/countries?new=${encodeURIComponent(e.iso)}`;
  const line = next
    ? `${esc(T(lang, "Következő:"))} <b>${esc(next.title)}</b> — ${esc(next.detail)}`
    : warn
      ? `${esc(T(lang, "Nem zár, de figyelj:"))} <b>${esc(warn.title)}</b> — ${esc(warn.detail)}`
      : e.market.approved
        ? esc(T(lang, "Minden feltétel rendben."))
        : `<b>${esc(T(lang, "Minden kész — megnyitható."))}</b>`;
  return `<a id="card-${esc(e.iso)}" class="cty-card" href="${esc(href)}" data-open="${esc(e.iso)}" data-step="${step}">
    <span class="cty-card__h"><span><span class="cty-iso">${esc(e.iso)}</span><b>${esc(e.name || e.iso)}</b></span>${statusTag(lang, e.home, e.market.approved, e.readiness)}</span>
    <span class="cty-seg">${COLS.map((c) => {
      const it = items.find((i) => i.key === c.key);
      return `<i class="${it ? it.state : ""}" title="${esc(colLabel(lang, c.key))}"></i>`;
    }).join("")}</span>
    <span class="cty-card__next">${e.hasRow ? line : esc(T(lang, "Nincs ország-sor — koppints a felvételhez."))}</span></a>`;
}

// ── editor pieces ──────────────────────────────────────────────────────────────────────────
function stBox(lang: string, it: ReadinessItem): string {
  const bar = typeof it.pct === "number" && it.pct < 100 ? `<span class="cty-bar"><span style="width:${it.pct}%"></span></span>` : "";
  return `<div class="cty-st cty-st--${it.state}">${ICON[it.state]}<div><b>${esc(it.title)}</b>${it.gating ? "" : ` (${esc(T(lang, "nem zár"))})`}<br>${esc(it.detail)}${bar}</div></div>`;
}

/** The status boxes on top of a step (fragment: #st-<step>). */
export function stepStatus(ed: CountryEditor, step: CountryStep): string {
  const lang = consoleLang();
  return ed.readiness.items.filter((i) => STEP_KEYS[step].includes(i.key)).map((i) => stBox(lang, i)).join("");
}

function stepState(ed: CountryEditor, s: CountryStep): ReadinessState {
  if (s === "open") return ed.market.approved && ed.readiness.complete ? "ok" : ed.readiness.complete ? "warn" : "bad";
  const its = ed.readiness.items.filter((i) => STEP_KEYS[s].includes(i.key));
  return its.length ? worst(its) : "ok";
}

/** The step pills (fragment: #cty-steps). */
export function stepNav(ed: CountryEditor): string {
  const lang = consoleLang();
  return COUNTRY_STEPS.map((s, i) => {
    const st = stepState(ed, s);
    return `<button type="button" class="cty-step cty-step--${st}" data-goto="${s}"${s === ed.step ? ' aria-current="step"' : ""}><span class="cty-step__n">${st === "ok" ? ICON.check : i + 1}</span>${esc(stepTitle(lang, s))}</button>`;
  }).join("");
}

function subTitle(lang: string, s: CountrySub): string {
  switch (s) {
    case "identity": return T(lang, "Azonosság és pénz");
    case "discovery": return T(lang, "Felderítés");
    case "phone": return T(lang, "Telefonszám-szabály");
    case "legal": return T(lang, "Jog");
  }
}

function subHint(lang: string, s: CountrySub): string {
  switch (s) {
    case "identity": return T(lang, "Nyelv, időzóna, pénznem, ár-régió — ebből jön a mock, a levél és a számla nyelve, és amiben a vevő fizet.");
    case "discovery": return T(lang, "Hol és mivel keressük a szállásokat; mely oldalak portálok (nem saját honlap).");
    case "phone": return T(lang, "Ebből lesz a lead számából nemzetközi alak, és ebből tudjuk, mobil-e.");
    case "legal": return T(lang, "A jogi csomag kulcsa. A szövegeket Bábel fordítja; itt a teljességét látod.");
  }
}

const SUB_FIELDS: Readonly<Record<CountrySub, readonly CountryField[]>> = {
  identity: ["iso2", "name", "aliases", "defaultLang", "timeZone", "currency", "pricingRegion", "paymentProvider", "touristTaxModel", "invoiceLang"],
  discovery: ["areaBbox", "searchKeywords", "portalDomains", "ownSiteTlds", "searchLang", "searchRegion", "browserLocale", "acceptLanguage"],
  phone: ["dialCode", "trunkPrefix", "mobilePrefixes", "phonePlan", "phoneNsn"],
  legal: [],
};

/** The data sub-tabs with their error counts (fragment: #cty-subtabs). */
export function subTabs(ed: CountryEditor): string {
  const lang = consoleLang();
  const errs = visibleErrors(ed);
  return COUNTRY_SUBS.map((s) => {
    const n = SUB_FIELDS[s].filter((k) => errs[k]).length;
    return `<button type="button" data-sub="${s}" aria-pressed="${ed.sub === s}">${esc(subTitle(lang, s))}${n ? ` <span class="cty-tag cty-tag--bad">${n}</span>` : ""}</button>`;
  }).join("");
}

/** Errors of the touched fields only. */
export function visibleErrors(ed: CountryEditor): CountryErrors {
  if (ed.touched === "all") return ed.errors;
  const t = new Set(ed.touched);
  return Object.fromEntries(Object.entries(ed.errors).filter(([k]) => t.has(k))) as CountryErrors;
}

function field(id: CountryField | string, label: string, control: string, err: string | undefined, help = "", wide = false): string {
  return `<div class="cty-f${wide ? " cty-f--wide" : ""}${err ? " cty-f--err" : ""}" data-field="${esc(id)}">
    <label class="cty-f__l" for="fld-${esc(id)}">${esc(label)}</label>${control}
    ${help ? `<p class="cty-f__h" id="help-${esc(id)}">${help}</p>` : ""}
    <p class="cty-f__e" role="alert">${err ? esc(err) : ""}</p></div>`;
}

const inp = (name: string, v: string, extra = ""): string =>
  `<input id="fld-${esc(name)}" name="${esc(name)}" value="${esc(v)}" autocomplete="off" ${extra}>`;

function chips(name: string, list: readonly string[], placeholder: string, extra = ""): string {
  const lang = consoleLang();
  const items = list
    .map((v) => `<span class="cty-chip">${esc(v)}<input type="hidden" name="${esc(name)}" value="${esc(v)}"><button type="button" data-chip-del aria-label="${esc(T(lang, "{v} törlése", { v }))}">${ICON.x}</button></span>`)
    .join("");
  return `<div class="cty-chips" data-chips="${esc(name)}">${items}<input id="fld-${esc(name)}" class="cty-chips__in" placeholder="${esc(placeholder)}" data-chip-in="${esc(name)}" ${extra}></div>`;
}

function zoneNow(tz: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("hu-HU", { timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short" }).format(now);
  } catch {
    return "";
  }
}

/** Small live hints that follow the inputs (fragments: #help-currency, #tz-live, #hol-years, #help-sendWindow). */
export function liveHints(ed: CountryEditor): Record<string, string> {
  const lang = consoleLang();
  const r = ed.draft;
  const md = minorDigits(r.currency);
  const ccy =
    md === null
      ? T(lang, "ISO 4217 kód.")
      : T(lang, "{n} tizedes. Fix az országra, átváltás nincs.", { n: md });
  const y = yearIn(ed.now, r.timeZone);
  return {
    "help-currency": esc(ccy) + (md !== null && !providerAccepts(r.paymentProvider, r.currency) ? ` <b>${esc(T(lang, "A fizetési szolgáltató nem fogadja."))}</b>` : ""),
    "tz-live": validTimeZone(r.timeZone) ? esc(T(lang, "most ott: {t}", { t: zoneNow(r.timeZone, ed.now) })) : "",
    "hol-years": [y, y + 1]
      .map((yy) => `<span><b>${yy}</b> ${holidayYearCovered(r.publicHolidays, yy) ? `<span class="cty-tag cty-tag--ok">${esc(T(lang, "lefedve"))}</span>` : `<span class="cty-tag cty-tag--bad">${esc(T(lang, "hiányzik"))}</span>`}</span>`)
      .join(""),
    "help-sendWindow": validTimeZone(r.timeZone)
      ? esc(T(lang, "Az ország helyi idejében ({tz}, most {t}).", { tz: r.timeZone, t: zoneNow(r.timeZone, ed.now) }))
      : "",
    "help-outreachChannels": r.dialCode && r.dialCode !== "36"
      ? esc(T(lang, "A modem magyar SIM-mel küld: SMS/MMS csak +36 számra megy. Helyi szolgáltató nélkül a csak mobilszámos lead TARTVA marad."))
      : "",
  };
}

function yearIn(now: Date, tz: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en", { timeZone: tz, year: "numeric" }).format(now));
  } catch {
    return now.getUTCFullYear();
  }
}

function fmtDay(d: string): string {
  const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${m[1] ? `${m[1]}. ` : ""}${m[2]}. ${m[3]}.`;
}

function subBody(ed: CountryEditor, sub: CountrySub, e: CountryErrors): string {
  const lang = consoleLang();
  const r = ed.draft;
  const live = liveHints(ed);
  switch (sub) {
    case "identity":
      return `<div class="cty-grid">
        ${field("iso2", T(lang, "ISO-kód"), inp("iso2", r.iso2, `maxlength="2" class="cty-mono" ${ed.isNew ? "" : "readonly"}`), e.iso2,
          esc(ed.isNew ? T(lang, "Két betű; mentés után nem változtatható (ez az ország azonosítója).") : T(lang, "Az ország azonosítója — nem változtatható.")))}
        ${field("name", T(lang, "Név a konzolon"), inp("name", r.name), e.name)}
        ${field("defaultLang", T(lang, "Alapnyelv"), inp("defaultLang", r.defaultLang, 'maxlength="3" class="cty-mono"'), e.defaultLang,
          esc(T(lang, "A mock, a levél és a jogi csomag nyelve. Csak ezen megy megkeresés.")))}
        ${field("timeZone", T(lang, "Időzóna"), inp("timeZone", r.timeZone, 'list="cty-tzlist" class="cty-mono"') + `<span class="cty-f__live" id="tz-live">${live["tz-live"]}</span>`, e.timeZone)}
        ${field("currency", T(lang, "Pénznem"), inp("currency", r.currency, 'maxlength="3" class="cty-mono"'), e.currency, live["help-currency"])}
        ${field("pricingRegion", T(lang, "Ár-régió"), `<select id="fld-pricingRegion" name="pricingRegion"><option value="">${esc(T(lang, "— válassz —"))}</option>${ed.regions
          .map((g) => `<option value="${esc(g.region)}"${r.pricingRegion === g.region ? " selected" : ""}>${esc(g.region)} · ${esc(g.currency)}${g.complete ? "" : ` · ${esc(T(lang, "hiányos"))}`}</option>`)
          .join("")}</select>`, e.pricingRegion, `${esc(T(lang, "Az árakat az ország Árazás fülén állítod."))} <a href="/countries?iso=${encodeURIComponent(ed.iso)}&tab=price">${esc(T(lang, "Árazás fül ›"))}</a>`)}
        ${field("paymentProvider", T(lang, "Fizetési szolgáltató"), `<select id="fld-paymentProvider" name="paymentProvider">${ed.providers
          .map((p) => `<option value="${esc(p)}"${r.paymentProvider === p ? " selected" : ""}>${esc(p)}</option>`)
          .join("")}</select>`, e.paymentProvider)}
        ${field("invoiceLang", T(lang, "Számla nyelve"), inp("invoiceLang", r.invoiceLang, 'maxlength="3" class="cty-mono"'), e.invoiceLang)}
        ${field("touristTaxModel", T(lang, "Idegenforgalmi adó a foglalóban"), `<div class="cty-seg-ctl" role="radiogroup">
          <label><input type="radio" name="touristTaxModel" value="none"${r.touristTaxModel === "none" ? " checked" : ""}> ${esc(T(lang, "Nincs szabály"))}</label>
          <label><input type="radio" name="touristTaxModel" value="hu"${r.touristTaxModel === "hu" ? " checked" : ""}> ${esc(T(lang, "Magyar szabály"))}</label></div>`, e.touristTaxModel,
          esc(T(lang, "Magyar szabály = a helyszínen fizetendő, 18 év alatt mentes. Máshol: csak amit a szállásadó beír.")), true)}
        ${field("aliases", T(lang, "Más írásmódok"), chips("aliases", r.aliases, T(lang, "pl. HRVATSKA + Enter")), e.aliases,
          esc(T(lang, "Amit a források az ISO-kód helyett írnak. Nagybetűsre alakul.")), true)}
      </div>`;
    case "discovery":
      return `<div class="cty-grid">
        ${Object.entries(r.searchKeywords).map(([cat, words]) =>
          field(`kw.${cat}`, T(lang, "Keresőszavak ({cat})", { cat }), chips(`kw.${cat}`, words, T(lang, "pl. apartmani + Enter")), e.searchKeywords,
            esc(T(lang, "Az ország nyelvén, ahogy a Mapsben keresnének.")), true)).join("")}
        ${field("areaBbox", T(lang, "Ország-keret (D, Ny, É, K)"), `<div class="cty-bbox">${[T(lang, "dél"), T(lang, "nyugat"), T(lang, "észak"), T(lang, "kelet")]
          .map((p, i) => `<input name="bbox${i}" aria-label="${esc(p)}" value="${esc(r.areaBbox[i])}" inputmode="decimal" class="cty-mono" placeholder="${esc(p)}">`)
          .join("")}</div>`, e.areaBbox, esc(T(lang, "A felderítés befoglaló téglalapja; a lekérdezés az ország határára vág.")), true)}
        ${field("portalDomains", T(lang, "Helyi portálok"), chips("portalDomains", r.portalDomains, T(lang, "pl. booking.hr + Enter")), e.portalDomains,
          esc(T(lang, "Ezeken talált link nem saját honlap. A nemzetközieket (booking.com, airbnb) nem kell ide írni.")), true)}
        ${field("ownSiteTlds", T(lang, "Saját-oldal végződések"), chips("ownSiteTlds", r.ownSiteTlds, T(lang, "pl. hr + Enter")), e.ownSiteTlds,
          esc(T(lang, "Ilyen sorrendben próbáljuk a szállás saját domainjét.")))}
        ${field("searchLang", T(lang, "Keresés nyelve"), inp("searchLang", r.searchLang, 'maxlength="3" class="cty-mono"'), e.searchLang)}
        ${field("searchRegion", T(lang, "Keresési régió"), inp("searchRegion", r.searchRegion, 'maxlength="2" class="cty-mono"'), e.searchRegion)}
        ${field("browserLocale", T(lang, "Böngésző-nyelv"), inp("browserLocale", r.browserLocale, 'class="cty-mono"'), e.browserLocale)}
        ${field("acceptLanguage", T(lang, "Accept-Language"), inp("acceptLanguage", r.acceptLanguage, 'class="cty-mono"'), e.acceptLanguage)}
      </div>`;
    case "phone":
      return `<div class="cty-grid">
        ${field("dialCode", T(lang, "Hívószám"), `<div class="cty-pre"><span>+</span>${inp("dialCode", r.dialCode, 'maxlength="3" inputmode="numeric" class="cty-mono"')}</div>`, e.dialCode)}
        ${field("trunkPrefix", T(lang, "Belföldi előtag"), inp("trunkPrefix", r.trunkPrefix, 'maxlength="2" inputmode="numeric" class="cty-mono"'), e.trunkPrefix,
          esc(T(lang, "Amit belföldön a szám elé tárcsáznak (HU: 06, legtöbb helyen 0, IT: nincs).")))}
        ${field("mobilePrefixes", T(lang, "Mobil-tartományok"), chips("mobilePrefixes", r.mobilePrefixes, T(lang, "pl. 91 + Enter"), 'inputmode="numeric"'), e.mobilePrefixes,
          esc(T(lang, "A hívószám utáni első jegyek, amik mobilt jelentenek.")))}
        ${field("phonePlan", T(lang, "Számozási terv"), `<select id="fld-phonePlan" name="phonePlan"><option value="generic"${r.phonePlan === "generic" ? " selected" : ""}>${esc(T(lang, "általános (előtag + hossz)"))}</option><option value="hu"${r.phonePlan === "hu" ? " selected" : ""}>${esc(T(lang, "magyar (körzetszám-táblával)"))}</option></select>`, e.phonePlan)}
        ${field("phoneNsn", T(lang, "Belföldi szám hossza"), `<div class="cty-pair">${inp("phoneNsnMin", r.phoneNsnMin, `inputmode="numeric" class="cty-mono" aria-label="${esc(T(lang, "legrövidebb"))}"`)}<span>–</span>${inp("phoneNsnMax", r.phoneNsnMax, `inputmode="numeric" class="cty-mono" aria-label="${esc(T(lang, "leghosszabb"))}"`)}<span class="cty-mut">${esc(T(lang, "jegy"))}</span></div>`, e.phoneNsn)}
      </div>`;
    case "legal":
      return `<div class="cty-grid">
        ${field("legalPack", T(lang, "Jogi csomag kulcsa"), inp("legalPack", r.legalPack, 'readonly class="cty-mono"'), undefined,
          esc(T(lang, "Az ISO-kódból jön. A szövegeket Bábel fordítja az ország nyelvére — a teljességet a „Jog” lépés mutatja.")))}
      </div>`;
  }
}

function outreachBody(ed: CountryEditor, e: CountryErrors): string {
  const lang = consoleLang();
  const r = ed.draft;
  const live = liveHints(ed);
  const y = yearIn(ed.now, r.timeZone);
  const channelLabel = (c: string): string =>
    c === "email" ? T(lang, "E-mail") : c === "mms" ? T(lang, "MMS (képes)") : c === "sms" ? "SMS" : c === "viber" ? "Viber" : "WhatsApp";
  const days = [...r.publicHolidays].sort((a, b) => a.slice(-5).localeCompare(b.slice(-5)) || a.length - b.length);
  return `<div class="cty-grid">
    ${field("outreachChannels", T(lang, "Csatornák"), `<div class="cty-checks">${COUNTRY_CHANNELS.map((c) =>
      `<label><input type="checkbox" name="outreachChannels" value="${c}"${r.outreachChannels.includes(c) ? " checked" : ""}> ${esc(channelLabel(c))}</label>`).join("")}</div>`,
      e.outreachChannels, live["help-outreachChannels"], true)}
    ${field("sendWindow", T(lang, "Küldési ablak (helyi idő)"), `<div class="cty-pair">${inp("sendWindowFrom", r.sendWindowFrom, `inputmode="numeric" class="cty-mono" aria-label="${esc(T(lang, "kezdés"))}"`)}<span>:00 –</span>${inp("sendWindowTo", r.sendWindowTo, `inputmode="numeric" class="cty-mono" aria-label="${esc(T(lang, "zárás"))}"`)}<span>:00</span></div>`,
      e.sendWindow, live["help-sendWindow"])}
    ${field("dailyQuota", T(lang, "Napi kvóta"), inp("dailyQuota", r.dailyQuota, 'inputmode="numeric" class="cty-mono"'), e.dailyQuota,
      esc(ed.home
        ? T(lang, "Tájékoztató érték: a hazai napi plafont az automata kiküldés beállítása adja (ma 40).")
        : T(lang, "Hideg megkeresés naponta ebben az országban (ha az automata kiküldés nem ad külön plafont).")))}
    <div class="cty-f cty-f--wide${e.publicHolidays ? " cty-f--err" : ""}" data-field="publicHolidays">
      <span class="cty-f__l">${esc(T(lang, "Ünnepnapok"))}</span>
      <div class="cty-hol" id="hol-years">${live["hol-years"]}</div>
      <div class="cty-chips cty-chips--days" data-days>${days
        .map((d) => `<span class="cty-chip${/^\d{4}/.test(d) ? " cty-chip--once" : ""}" title="${esc(/^\d{4}/.test(d) ? T(lang, "csak ebben az évben") : T(lang, "minden évben"))}">${esc(fmtDay(d))}<input type="hidden" name="publicHolidays" value="${esc(d)}"><button type="button" data-chip-del aria-label="${esc(T(lang, "{v} törlése", { v: d }))}">${ICON.x}</button></span>`)
        .join("") || `<span class="cty-mut cty-small" data-empty>${esc(T(lang, "még nincs nap"))}</span>`}</div>
      <div class="cty-hol__add">
        <input type="date" id="hol-date" min="${y}-01-01" max="${y + 2}-12-31" aria-label="${esc(T(lang, "Nap"))}">
        <label class="cty-small"><input type="checkbox" id="hol-every" checked> ${esc(T(lang, "minden évben"))}</label>
        <button type="button" class="cty-btn cty-btn--sm" id="hol-add">${esc(T(lang, "Hozzáad"))}</button>
      </div>
      <p class="cty-f__h">${esc(T(lang, "Mozgó ünnep (húsvét, pünkösd) évenként külön kell: vedd ki a „minden évben” pipát. Ezeken a napokon a válasz nem megy ki."))}</p>
      <p class="cty-f__e" role="alert">${e.publicHolidays ? esc(e.publicHolidays) : ""}</p>
    </div>
  </div>`;
}

/** The readiness list of the „Megnyitás” step (fragment: #cty-rdlist). */
export function readinessList(ed: CountryEditor): string {
  const lang = consoleLang();
  return `<ol class="cty-rd">${ed.readiness.items.map((i) => `<li class="cty-rd__i cty-rd__i--${i.state}" data-rd="${i.key}">
    <span class="cty-rd__ic">${ICON[i.state]}</span>
    <div class="cty-rd__t"><b>${esc(i.title)}</b>${i.gating ? "" : ` <span class="cty-tag">${esc(T(lang, "nem zár"))}</span>`}
      <span class="cty-rd__d">${esc(i.detail)}</span>
      ${typeof i.pct === "number" && i.pct < 100 ? `<span class="cty-bar"><span style="width:${i.pct}%"></span></span>` : ""}
    </div></li>`).join("")}</ol>`;
}

function marketLogHtml(lang: string, m: CountryMarketInfo): string {
  if (!m.log.length) return "";
  return `<ul class="cty-gate__log">${m.log
    .map((l) => `<li><span class="cty-mut cty-small">${esc(fmtAt(l.at))} · ${esc(l.actor)} · ${esc(l.action === "approve" ? T(lang, "megnyitva") : T(lang, "lezárva"))}</span> — ${esc(l.reason)}</li>`)
    .join("")}</ul>`;
}

/**
 * The market gate block (fragment: #cty-gate) — the old /settings „Piacok” row, merged here.
 * The forms post to /settings/markets (same endpoint, same mandatory reason, same log); the
 * approve button is live only on a COMPLETE, SAVED country, and the server re-checks both.
 */
export function gateBlock(ed: CountryEditor): string {
  const lang = consoleLang();
  const m = ed.market;
  const r = ed.readiness;
  const hidden = `<input type="hidden" name="country" value="${esc(ed.iso)}"><input type="hidden" name="back" value="countries">`;
  if (ed.isNew) {
    return `<div class="cty-gate cty-gate--shut"><div class="cty-gate__h">${ICON.lock}<b>${esc(T(lang, "Előbb vedd fel az országot"))}</b></div><p class="cty-small">${esc(T(lang, "A megnyitás a MENTETT sorra vonatkozik."))}</p></div>`;
  }
  if (ed.dirty && !ed.home) {
    return `<div class="cty-gate cty-gate--shut"><div class="cty-gate__h">${ICON.lock}<b>${esc(T(lang, "Előbb mentsd az országot"))}</b></div><p class="cty-small">${esc(T(lang, "A megnyitás a MENTETT sorra vonatkozik."))}</p></div>`;
  }
  if (ed.home) {
    return `<div class="cty-gate cty-gate--open"><div class="cty-gate__h">${r.open ? ICON.ok : ICON.warn}<b>${esc(r.open ? T(lang, "Nyitva — hazai piac") : T(lang, "Hazai piac — hiányos"))}</b></div>
      <p class="cty-small cty-mut">${esc(T(lang, "A teljes jogi csomag erre készült; innen nem zárható le."))}${m.approvedBy ? ` ${esc(T(lang, "Megnyitotta: {who} · {when}", { who: m.approvedBy, when: fmtAt(m.approvedAt) }))}` : ""}</p>
      ${marketLogHtml(lang, m)}</div>`;
  }
  if (m.approved) {
    return `<div class="cty-gate cty-gate--open"><div class="cty-gate__h">${ICON.ok}<b>${esc(T(lang, "Nyitva"))}</b></div>
      <p class="cty-small cty-mut">${esc(T(lang, "Megnyitotta: {who} · {when}", { who: m.approvedBy ?? "—", when: fmtAt(m.approvedAt) }))}${m.note ? ` — ${esc(m.note)}` : ""}</p>
      ${r.complete ? "" : `<p class="cty-gate__warn">${ICON.warn} ${esc(T(lang, "Jóváhagyva, de közben hiányos lett — a piac-kapu ZÁRVA tart, amíg a piros pontok meg nem lesznek."))}</p>`}
      <details class="cty-gate__act"><summary>${esc(T(lang, "Piac lezárása"))}</summary>
        <p class="cty-small cty-mut">${esc(T(lang, "A lezárás a JÖVŐRE hat: új megkeresés, új rendelés és élesítés nem indul. A már futó előfizetések megújulását nem érinti."))}</p>
        <form method="post" action="/settings/markets" class="cty-gate__form">${hidden}<input type="hidden" name="action" value="revoke">
          <textarea name="reason" rows="2" required minlength="3" placeholder="${esc(T(lang, "Miért zárjuk le? (pl. „a lengyel opt-in szabályozás felülvizsgálat alatt”)"))}"></textarea>
          <button type="submit" class="cty-btn cty-btn--danger ghost">${esc(T(lang, "Lezárás"))}</button></form>
      </details>${marketLogHtml(lang, m)}</div>`;
  }
  const ok = r.complete;
  const { done, total } = countDone(r.items);
  return `<div class="cty-gate ${ok ? "cty-gate--ready" : "cty-gate--shut"}">
    <div class="cty-gate__h">${ok ? ICON.ok : ICON.lock}<b>${esc(ok ? T(lang, "Megnyitható") : T(lang, "Zárva — {done}/{total} feltétel teljes", { done, total }))}</b></div>
    <p class="cty-small">${esc(ok
      ? T(lang, "Minden feltétel teljes. A megnyitás felelősségvállalás: kijelented, hogy az ország jogi csomagja kész és felülvizsgált.")
      : T(lang, "A megnyitás gombja akkor él, ha minden zárófeltétel zöld. Amíg zárva: erre az országra nem megy megkeresés, nincs fizetési link, nem élesíthető oldal."))}</p>
    <form method="post" action="/settings/markets" class="cty-gate__form">${hidden}<input type="hidden" name="action" value="approve">
      <textarea name="reason" rows="2" required minlength="3" ${ok ? "" : "disabled"} placeholder="${esc(T(lang, "Mire hivatkozva? (pl. „lengyel jogi csomag 1.0, ügyvédi felülvizsgálat 2026-10-01”)"))}"></textarea>
      <button type="submit" class="cty-btn cty-btn--primary ghost" ${ok ? "" : 'disabled aria-disabled="true"'}>${esc(T(lang, "Piac megnyitása"))}</button></form>
    ${marketLogHtml(lang, m)}</div>`;
}

function stepBody(ed: CountryEditor, step: CountryStep): string {
  const lang = consoleLang();
  const r = ed.draft;
  const e = visibleErrors(ed);
  const st = `<div id="st-${step}">${stepStatus(ed, step)}</div>`;
  switch (step) {
    case "data":
      return `${st}<div class="cty-subtabs" role="group" id="cty-subtabs">${subTabs(ed)}</div>
        ${COUNTRY_SUBS.map((s) => `<div class="cty-sub" data-subpanel="${s}"${s === ed.sub ? "" : " hidden"}><p class="cty-hint">${esc(subHint(lang, s))}</p>${subBody(ed, s, e)}</div>`).join("")}`;
    case "prices": {
      const reg = ed.regions.find((g) => g.region === r.pricingRegion);
      const eu = isTaxableBuyerCountry(ed.iso);
      return `${st}<dl class="cty-facts"><dt>${esc(T(lang, "Ár-régió"))}</dt><dd>${esc(r.pricingRegion || "—")}${reg ? ` (${esc(reg.currency)})` : ""}</dd>
          <dt>${esc(T(lang, "Az ország pénzneme"))}</dt><dd>${esc(r.currency || "—")}</dd>
          <dt>${esc(T(lang, "Fizetés"))}</dt><dd>${esc(r.paymentProvider)}</dd>
          <dt>${esc(T(lang, "EU-tag"))}</dt><dd>${esc(eu ? T(lang, "igen") : T(lang, "nem"))}</dd></dl>
        <p class="cty-small cty-mut">${esc(T(lang, "Hiányos ársornál a vendég foglalási kérése is elhasal, ezért ez zárófeltétel. Az árakat az ország Árazás fülén töltöd ki; a régiót és a pénznemet az „Adatok” lépésben választod."))}</p>
        <button type="button" class="cty-btn cty-btn--sm" data-goto="data" data-sub="identity">${esc(T(lang, "Ár-régió, pénznem ›"))}</button> <a class="cty-lnk" href="/countries?iso=${encodeURIComponent(ed.iso)}&tab=price">${esc(T(lang, "Árazás fül ›"))}</a>`;
    }
    case "babel":
      return `${st}<p class="cty-small cty-mut">${esc(T(lang, "Megkeresés, mock és vendégoldal csak az ország alapnyelvén megy ({lang}). Ha egy vevő-oldali szöveg is hiányzik, a megkeresés TARTVA („Bábelre vár”). A fordítást Bábel végzi — itt csak a teljességet látod.", { lang: r.defaultLang || "—" }))}</p>
        <button type="button" class="cty-btn cty-btn--sm" data-goto="data" data-sub="identity">${esc(T(lang, "Alapnyelv módosítása ›"))}</button>`;
    case "legal":
      return `${st}<p class="cty-small cty-mut">${esc(T(lang, "ÁSZF, elállás, adatkezelés, DPA, impresszum, süti, megkeresés jogi bekezdése, leiratkozó — az ország nyelvén. A fogyasztói vitarendező (FR, PT) csak a magánszemély-utat zárja, a céges utat nem."))}</p>`;
    case "outreach":
      return `${st}${outreachBody(ed, e)}`;
    case "open":
      return `<div id="cty-rdlist">${readinessList(ed)}</div><div id="cty-gate">${gateBlock(ed)}</div>`;
  }
}

/** The editor sheet (right panel / phone full screen). */
function editorHtml(ed: CountryEditor, closeHref = "/countries"): string {
  const lang = consoleLang();
  const title = ed.draft.name || (ed.isNew ? T(lang, "Új ország") : ed.iso);
  const idx = COUNTRY_STEPS.indexOf(ed.step);
  const formSteps = COUNTRY_STEPS.filter((s) => s !== "open");
  return `<div class="cty-drawer" id="cty-drawer" data-iso="${esc(ed.iso)}" data-new="${ed.isNew ? "1" : "0"}">
    <a class="cty-drawer__bg" href="${esc(closeHref)}" data-close aria-label="${esc(T(lang, "Bezár"))}"></a>
    <div class="cty-drawer__p" role="dialog" aria-modal="true" aria-labelledby="cty-title">
      <div class="cty-drawer__h"><span class="cty-iso">${esc(ed.iso)}</span><h3 id="cty-title">${esc(title)}</h3>
        <span id="cty-saved">${ed.dirty ? `<span class="cty-dirty">${esc(T(lang, "nem mentett"))}</span>` : `<span class="cty-small cty-mut">${esc(ed.isNew ? T(lang, "új") : T(lang, "mentve"))}</span>`}</span>
        <a class="cty-drawer__x" href="${esc(closeHref)}" data-close aria-label="${esc(T(lang, "Bezár"))}">${ICON.x}</a></div>
      <nav class="cty-steps" id="cty-steps" aria-label="${esc(T(lang, "Lépések"))}">${stepNav(ed)}</nav>
      <div class="cty-drawer__b" id="cty-body">
        <form id="cform" method="post" action="/countries/save" novalidate>
          <input type="hidden" name="isNew" value="${ed.isNew ? "1" : "0"}">
          <input type="hidden" name="step" value="${esc(ed.step)}"><input type="hidden" name="sub" value="${esc(ed.sub)}">
          ${formSteps.map((s) => `<section class="cty-stepbox" data-steppanel="${s}"${s === ed.step ? "" : " hidden"}>${stepBody(ed, s)}</section>`).join("")}
        </form>
        <section class="cty-stepbox" data-steppanel="open"${ed.step === "open" ? "" : " hidden"}>${stepBody(ed, "open")}</section>
      </div>
      <div class="cty-drawer__f">
        <button type="button" class="cty-btn cty-btn--sm" data-prev${idx === 0 ? " disabled" : ""}>${esc(T(lang, "‹ Előző"))}</button>
        <button type="submit" form="cform" class="cty-btn cty-btn--primary ghost" data-save>${esc(ed.isNew ? T(lang, "Ország felvétele") : T(lang, "Mentés"))}</button>
        <button type="button" class="cty-btn cty-btn--sm" data-next${idx === COUNTRY_STEPS.length - 1 ? " disabled" : ""}>${esc(T(lang, "Következő ›"))}</button>
      </div>
    </div></div>`;
}

/** Everything the live check sends back: field errors + the fragments to swap. */
export function editorFragments(ed: CountryEditor, entry: CountryListEntry | null): { errors: CountryErrors; fragments: Record<string, string> } {
  const fragments: Record<string, string> = {
    "cty-steps": stepNav(ed),
    "cty-subtabs": subTabs(ed),
    "cty-rdlist": readinessList(ed),
    "cty-gate": gateBlock(ed),
    ...liveHints(ed),
  };
  for (const s of COUNTRY_STEPS) if (s !== "open") fragments[`st-${s}`] = stepStatus(ed, s);
  if (entry) {
    fragments[`mxrow-${entry.iso}`] = matrixRow(entry, true);
    fragments[`card-${entry.iso}`] = countryCard(entry);
  }
  return { errors: visibleErrors(ed), fragments };
}

/** The IANA zones the time-zone field suggests (Europe first; any valid zone is accepted). */
function tzDatalist(): string {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    zones = ["Europe/Budapest"];
  }
  const eu = zones.filter((z) => z.startsWith("Europe/"));
  return `<datalist id="cty-tzlist">${[...eu, ...zones.filter((z) => !z.startsWith("Europe/"))].map((z) => `<option value="${esc(z)}">`).join("")}</datalist>`;
}

export function countriesPage(opts: {
  readonly list: readonly CountryListEntry[];
  readonly editor: CountryEditor | null;
  readonly notice: { ok: boolean; text: string } | null;
  readonly newIso?: string;
  readonly newErr?: string;
}): string {
  const lang = consoleLang();
  const { list, editor, notice } = opts;
  const cur = editor?.iso ?? null;
  const body = `<div class="cty" id="cty">
    <div class="cty-top">
      <div><h2>${esc(T(lang, "Országok"))} ${helpLink("console.countries")}</h2>
        <p class="cty-lead">${esc(T(lang, "Sor = ország, oszlop = zárófeltétel. Kattints egy cellára (mobilon a kártyára): a szerkesztő a hiányzó lépésnél nyílik. Egy ország akkor nyitott, ha minden feltétele teljes ÉS a piacot megnyitottad."))}</p></div>
      <form class="cty-new" method="get" action="/countries" novalidate>
        <input name="new" maxlength="2" placeholder="${esc(T(lang, "ISO"))}" aria-label="${esc(T(lang, "Új ország ISO-kódja"))}" value="${esc(opts.newIso ?? "")}" autocomplete="off">
        <button class="cty-btn cty-btn--sm ghost" type="submit">${ICON.plus} ${esc(T(lang, "Új ország"))}</button>
        <p class="cty-f__e" role="alert">${esc(opts.newErr ?? "")}</p></form>
    </div>
    ${notice ? `<p class="cty-notice cty-notice--${notice.ok ? "ok" : "bad"}" role="status">${esc(notice.text)}</p>` : ""}
    <div class="cty-panel cty-mxwrap"><table class="cty-mx"><thead><tr><th>${esc(T(lang, "Ország"))}</th>${COLS.map((c) => `<th>${esc(colLabel(lang, c.key))}</th>`).join("")}<th>${esc(T(lang, "Piac"))}</th></tr></thead>
      <tbody>${list.map((e) => matrixRow(e, e.iso === cur)).join("")}</tbody></table></div>
    <div class="cty-cards">${list.map((e) => countryCard(e)).join("")}</div>
    ${editor ? editorHtml(editor) : ""}
    ${tzDatalist()}
  </div>
  ${editorScript()}`;
  return layout(T(lang, "Országok"), body, { active: "/countries", head: `<style>${COUNTRY_CSS}</style>` });
}

/**
 * „Országok / Árazás” (orszagok-arazas ⑧): the „Adatok” editor opens over the merged lap — the same
 * sheet, the same live check and save. `closeHref` = where its ✕ goes back to (the country's tab).
 */
export function editorOverlay(ed: CountryEditor, closeHref: string): string {
  return `${editorHtml(ed, closeHref)}${tzDatalist()}`;
}

/** The editor's config + script (needs the `#cty` root around the page). */
export function editorScript(): string {
  const lang = consoleLang();
  return `<script type="application/json" id="cty-cfg">${jsonForScript({
    confirmLeave: T(lang, "A nem mentett változások elvesznek. Továbblépsz?"),
    dirtyLabel: T(lang, "nem mentett"),
    removeLabel: T(lang, "{v} törlése"),
    onceTitle: T(lang, "csak ebben az évben"),
    everyTitle: T(lang, "minden évben"),
    steps: COUNTRY_STEPS,
  })}</script>
  <script>${COUNTRY_JS}</script>`;
}

// ── page script: navigation, chips, holidays, live check (no text of its own) ──────────────
const COUNTRY_JS = `(function(){
"use strict";
var root=document.getElementById("cty");if(!root)return;
var cfg=JSON.parse(document.getElementById("cty-cfg").textContent||"{}");
var dr=document.getElementById("cty-drawer");
var form=document.getElementById("cform");
var dirty=false,touched={},timer=null,seq=0;
function $$(s,el){return Array.prototype.slice.call((el||document).querySelectorAll(s));}
function setParam(k,v){var u=new URL(location.href);u.searchParams.set(k,v);history.replaceState(null,"",u.toString());}
function show(step){
  if(!dr)return;
  $$("[data-steppanel]",dr).forEach(function(p){p.hidden=p.getAttribute("data-steppanel")!==step;});
  $$(".cty-step",dr).forEach(function(b){if(b.getAttribute("data-goto")===step)b.setAttribute("aria-current","step");else b.removeAttribute("aria-current");});
  var i=cfg.steps.indexOf(step);
  var pv=dr.querySelector("[data-prev]"),nx=dr.querySelector("[data-next]");
  if(pv)pv.disabled=i<=0; if(nx)nx.disabled=i>=cfg.steps.length-1;
  if(form)form.elements.step.value=step;
  setParam("step",step);
  var b=document.getElementById("cty-body");if(b)b.scrollTop=0;
}
function sub(s){
  if(!dr)return;
  $$("[data-subpanel]",dr).forEach(function(p){p.hidden=p.getAttribute("data-subpanel")!==s;});
  $$("#cty-subtabs [data-sub]",dr).forEach(function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-sub")===s));});
  if(form)form.elements.sub.value=s; setParam("sub",s);
}
function curStep(){var a=dr&&dr.querySelector(".cty-step[aria-current]");return a?a.getAttribute("data-goto"):"data";}
function curSub(){var a=dr&&dr.querySelector("#cty-subtabs [aria-pressed=true]");return a?a.getAttribute("data-sub"):"identity";}
function markDirty(){
  if(dirty)return;dirty=true;
  var s=document.getElementById("cty-saved");if(s){s.innerHTML="";var d=document.createElement("span");d.className="cty-dirty";d.textContent=cfg.dirtyLabel;s.appendChild(d);}
}
function fieldOf(el){var f=el.closest("[data-field]");return f?f.getAttribute("data-field"):null;}
function schedule(){clearTimeout(timer);timer=setTimeout(check,250);}
function check(){
  if(!form)return;
  var fd=new URLSearchParams(new FormData(form));
  Object.keys(touched).forEach(function(k){fd.append("_touched",k);});
  fd.set("_dirty",dirty?"1":"0");
  var my=++seq;
  fetch("/countries/check",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:fd.toString(),credentials:"same-origin"})
    .then(function(r){return r.ok?r.json():null;}).then(function(j){
      if(!j||my!==seq)return;
      var step=curStep(),sb=curSub();
      Object.keys(j.fragments||{}).forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML=j.fragments[id];});
      $$("[data-field]",form).forEach(function(f){
        var k=f.getAttribute("data-field"),key=k.indexOf("kw.")===0?"searchKeywords":k,msg=(j.errors||{})[key]||"";
        f.classList.toggle("cty-f--err",!!msg);var p=f.querySelector(".cty-f__e");if(p)p.textContent=msg;
      });
      show(step);sub(sb);
    }).catch(function(){});
}
function addChip(box,name,val,cls,title){
  var span=document.createElement("span");span.className="cty-chip"+(cls?" "+cls:"");if(title)span.title=title;
  span.appendChild(document.createTextNode(val.label||val));
  var h=document.createElement("input");h.type="hidden";h.name=name;h.value=val.value||val;span.appendChild(h);
  var b=document.createElement("button");b.type="button";b.setAttribute("data-chip-del","");b.setAttribute("aria-label",cfg.removeLabel.replace("{v}",val.value||val));
  b.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  span.appendChild(b);
  var inp=box.querySelector("[data-chip-in],#hol-date");var empty=box.querySelector("[data-empty]");if(empty)empty.remove();
  if(box.hasAttribute("data-days"))box.appendChild(span);else box.insertBefore(span,box.querySelector("[data-chip-in]"));
}
root.addEventListener("click",function(ev){
  var t=ev.target;
  var o=t.closest("[data-open]");
  if(o&&dirty&&dr&&o.getAttribute("data-open")!==dr.getAttribute("data-iso")&&!confirm(cfg.confirmLeave)){ev.preventDefault();return;}
  if(o&&dr&&o.getAttribute("data-open")===dr.getAttribute("data-iso")){ev.preventDefault();show(o.getAttribute("data-step")||"data");return;}
  var c=t.closest("[data-close]");
  if(c&&dirty&&!confirm(cfg.confirmLeave)){ev.preventDefault();return;}
  var g=t.closest("[data-goto]");var s=t.closest("[data-sub]");
  if(g||s){ev.preventDefault();if(g)show(g.getAttribute("data-goto"));if(s)sub(s.getAttribute("data-sub"));return;}
  if(t.closest("[data-prev]")||t.closest("[data-next]")){var i=cfg.steps.indexOf(curStep())+(t.closest("[data-next]")?1:-1);if(i>=0&&i<cfg.steps.length)show(cfg.steps[i]);return;}
  var del=t.closest("[data-chip-del]");
  if(del){var f=fieldOf(del);if(f)touched[f.indexOf("kw.")===0?"searchKeywords":f]=1;del.parentNode.remove();markDirty();schedule();return;}
  if(t.closest("#hol-add")){
    var d=document.getElementById("hol-date");if(!d.value){d.focus();return;}
    var every=document.getElementById("hol-every").checked,v=every?d.value.slice(5):d.value;
    var box=dr.querySelector("[data-days]");
    var exists=$$('input[name="publicHolidays"]',box).some(function(h){return h.value===v;});
    if(!exists){var m=/^(?:(\\d{4})-)?(\\d{2})-(\\d{2})$/.exec(v);addChip(box,"publicHolidays",{value:v,label:(m[1]?m[1]+". ":"")+m[2]+". "+m[3]+"."},every?"":"cty-chip--once",every?cfg.everyTitle:cfg.onceTitle);}
    touched.publicHolidays=1;markDirty();schedule();return;
  }
});
root.addEventListener("keydown",function(ev){
  var ci=ev.target.closest&&ev.target.closest("[data-chip-in]");
  if(!ci||(ev.key!=="Enter"&&ev.key!==","))return;
  ev.preventDefault();
  var name=ci.getAttribute("data-chip-in"),v=ci.value.trim().replace(/^\\./,"");if(!v)return;
  if(name==="aliases")v=v.toUpperCase();
  if(name==="ownSiteTlds"||name==="portalDomains")v=v.toLowerCase();
  var box=ci.closest("[data-chips]");
  var exists=$$('input[type=hidden]',box).some(function(h){return h.value===v;});
  if(!exists)addChip(box,name,v);
  ci.value="";touched[name.indexOf("kw.")===0?"searchKeywords":name]=1;markDirty();schedule();
});
if(form){
  form.addEventListener("input",function(ev){
    var t=ev.target;if(t.closest("[data-chip-in]")||t.id==="hol-date")return;
    var f=fieldOf(t);if(f)touched[f]=1;markDirty();schedule();
  });
  form.addEventListener("change",function(ev){
    var t=ev.target;if(t.closest("[data-chip-in]")||t.id==="hol-date"||t.id==="hol-every")return;
    var f=fieldOf(t);if(f)touched[f]=1;markDirty();schedule();
  });
  form.addEventListener("submit",function(){dirty=false;});
}
window.addEventListener("beforeunload",function(ev){if(dirty){ev.preventDefault();ev.returnValue="";}});
if(dr)document.body.classList.add("cty-locked");
document.addEventListener("keydown",function(ev){if(ev.key==="Escape"&&dr){var c=dr.querySelector("[data-close]");if(c&&(!dirty||confirm(cfg.confirmLeave)))location.href=c.getAttribute("href");}});
})();`;

// ── page style (the approved design, tokens only) ─────────────────────────────────────────
export const COUNTRY_CSS = `
.cty{container-type:inline-size;container-name:cty}
.cty h2{font:600 20px/1.25 var(--citui-font-display);margin:0 0 4px;display:flex;align-items:center;gap:8px}
.cty-lead{margin:0 0 12px;color:var(--citui-muted);font-size:13px;max-width:72ch}
.cty-top{display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:space-between;align-items:flex-end;margin-bottom:10px}
.cty-new{display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap}
.cty-new input{width:78px;padding:7px 9px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-sm);text-transform:uppercase;background:var(--citui-field);color:var(--citui-ink)}
.cty-new .cty-f__e{flex-basis:100%}
.cty-notice{margin:0 0 10px;padding:8px 12px;border-radius:var(--citui-radius-sm);font-size:13px;font-weight:600}
.cty-notice--ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.cty-notice--bad{background:color-mix(in srgb,var(--citui-bad) 12%,var(--citui-panel));color:var(--citui-bad-ink)}
.cty-panel{background:var(--citui-panel);border:1px solid var(--citui-line);border-radius:var(--citui-radius);box-shadow:var(--citui-shadow-sm)}
.cty-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
.cty-mut{color:var(--citui-muted)} .cty-small{font-size:12.5px}
.cty-iso{display:inline-grid;place-items:center;flex:none;width:30px;height:30px;margin-right:8px;border-radius:50%;font:700 12px var(--citui-font-display);background:var(--citui-surface-2);border:1px solid var(--citui-line);vertical-align:middle;color:var(--citui-ink)}
.cty-tag{display:inline-block;padding:0 7px;border-radius:var(--citui-radius-pill);font-size:11px;font-weight:700;background:var(--citui-surface-2);color:var(--citui-muted);border:1px solid var(--citui-line);white-space:nowrap}
.cty-tag--ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink);border-color:transparent}
.cty-tag--bad{background:color-mix(in srgb,var(--citui-bad) 14%,var(--citui-panel));color:var(--citui-bad-ink);border-color:transparent}
.cty-tag--warn{background:color-mix(in srgb,var(--citui-warn) 20%,var(--citui-panel));color:var(--citui-warn-ink);border-color:transparent}
/* matrix */
.cty-mx{width:100%;border-collapse:separate;border-spacing:0}
.cty-mx th{font-size:11.5px;font-weight:700;color:var(--citui-muted);text-align:center;padding:10px 6px;border-bottom:1px solid var(--citui-line);white-space:nowrap}
.cty-mx th:first-child{text-align:left;padding-left:14px}
.cty-mx td{padding:8px 6px;border-bottom:1px solid var(--citui-line);text-align:center;vertical-align:middle}
.cty-mx td:first-child{text-align:left;padding-left:14px}
.cty-mx tr:last-child td{border-bottom:0}
.cty-mx tbody tr:hover td{background:var(--citui-hover)}
.cty-mx tr[aria-selected="true"] td{background:var(--citui-accent-soft)}
.cty-mx__name{display:flex;align-items:center;color:inherit;text-decoration:none}
.cty-mx__n b{display:block;font-weight:700} .cty-mx__n span{font-size:12px;color:var(--citui-muted)}
.cty-mx__c{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px}
.cty-mx__c--ok{color:var(--citui-ok)} .cty-mx__c--bad{color:var(--citui-bad);background:color-mix(in srgb,var(--citui-bad) 8%,transparent)} .cty-mx__c--warn{color:var(--citui-warn)} .cty-mx__c--na{color:var(--citui-line-strong)}
.cty-mx__c:hover,.cty-mx__c:focus-visible{outline:2px solid var(--citui-cyan-500)}
.cty-mx__st{white-space:nowrap}
/* cards (phone) */
.cty-cards{display:none;gap:10px}
.cty-card{display:block;width:100%;text-align:left;padding:12px;border:1px solid var(--citui-line);border-radius:var(--citui-radius);background:var(--citui-panel);box-shadow:var(--citui-shadow-sm);color:inherit;text-decoration:none}
.cty-card__h{display:flex;align-items:center;gap:8px;justify-content:space-between}
.cty-card__h>span{display:flex;align-items:center}
.cty-card__h b{font:600 15px var(--citui-font-display)}
.cty-seg{display:flex;gap:3px;margin:9px 0 6px}
.cty-seg i{flex:1;height:6px;border-radius:3px;background:var(--citui-surface-2)}
.cty-seg i.ok{background:var(--citui-ok)} .cty-seg i.bad{background:var(--citui-bad)} .cty-seg i.warn{background:var(--citui-warn)}
.cty-card__next{display:block;font-size:12.5px;color:var(--citui-muted)}
.cty-card__next b{color:var(--citui-ink)}
@container cty (max-width:760px){.cty-mxwrap{display:none}.cty-cards{display:grid}}
/* drawer / sheet */
body.cty-locked{overflow:hidden}
.cty-drawer{position:fixed;inset:0;z-index:60}
.cty-drawer__bg{position:absolute;inset:0;background:color-mix(in srgb,var(--citui-navy-950) 45%,transparent)}
.cty-drawer__p{position:absolute;top:0;right:0;bottom:0;width:min(620px,100%);background:var(--citui-panel);color:var(--citui-ink);display:flex;flex-direction:column;box-shadow:var(--citui-shadow-md);container-type:inline-size;container-name:ctyp}
.cty-drawer__h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--citui-line)}
.cty-drawer__h h3{margin:0;font:600 17px var(--citui-font-display);flex:1;min-width:0;overflow-wrap:anywhere}
.cty-drawer__x{display:inline-grid;place-items:center;padding:6px;border-radius:50%;color:inherit}
.cty-drawer__x:hover{background:var(--citui-hover)}
.cty .cty-steps{display:flex;gap:4px;overflow-x:auto;padding:10px 12px;border-bottom:1px solid var(--citui-line);scrollbar-width:thin}
.cty .cty-step{flex:none;display:flex;align-items:center;gap:6px;padding:6px 10px 6px 7px;border-radius:var(--citui-radius-pill);border:1px solid var(--citui-line);background:var(--citui-surface);cursor:pointer;font-size:12.5px;font-weight:600;color:var(--citui-ink)}
.cty .cty-step[aria-current="step"]{border-color:var(--citui-cyan-500);background:var(--citui-accent-soft)}
.cty .cty-step__n{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:11px;background:var(--citui-surface-2)}
.cty .cty-step--ok .cty-step__n{background:var(--citui-ok);color:var(--citui-on-ok)} .cty .cty-step--bad .cty-step__n{background:var(--citui-bad);color:var(--citui-on-bad)} .cty .cty-step--warn .cty-step__n{background:var(--citui-warn);color:var(--citui-warn-ink)}
.cty-drawer__b{flex:1;overflow:auto;overflow-wrap:anywhere}
.cty .cty-stepbox{padding:14px 16px}
.cty-st{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:var(--citui-radius-sm);margin-bottom:10px;font-size:13px}
.cty-st svg{flex:none;margin-top:2px}
.cty-st--ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.cty-st--bad{background:color-mix(in srgb,var(--citui-bad) 9%,var(--citui-panel));color:var(--citui-bad-ink)}
.cty-st--warn{background:color-mix(in srgb,var(--citui-warn) 16%,var(--citui-panel));color:var(--citui-warn-ink)}
.cty-subtabs{display:flex;gap:4px;margin:0 0 6px;flex-wrap:wrap}
.cty .cty-subtabs button{padding:5px 10px;border-radius:var(--citui-radius-pill);border:1px solid var(--citui-line);background:var(--citui-surface);cursor:pointer;font-size:12.5px;font-weight:600;color:var(--citui-ink)}
.cty .cty-subtabs button[aria-pressed="true"]{background:var(--citui-navy-900);color:var(--citui-ink-inverse);border-color:var(--citui-navy-900)}
.cty-hint{margin:0 0 10px;color:var(--citui-muted);font-size:12.5px}
.cty-drawer__f{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:10px 16px;border-top:1px solid var(--citui-line);background:var(--citui-surface)}
.cty-facts{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;margin:6px 0 10px}
.cty-facts dt{color:var(--citui-muted)} .cty-facts dd{margin:0;font-weight:600}
/* buttons — button[type] outranks the console's own submit pill (.con button[type=submit]), so the approved design's colours hold */
.con .cty button[type].cty-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:var(--citui-radius-pill);border:1px solid var(--citui-line-strong);background:var(--citui-surface);cursor:pointer;font-weight:600;font-size:13.5px;color:var(--citui-ink);font-family:inherit}
.con .cty button[type].cty-btn:hover{background:var(--citui-hover)}
.con .cty button[type].cty-btn--sm{padding:5px 11px;font-size:12.5px}
.con .cty button[type].cty-btn--primary{background:var(--citui-cyan-500);border-color:var(--citui-cyan-500);color:var(--citui-accent-ink)}
.con .cty button[type].cty-btn--primary:hover{background:color-mix(in srgb,var(--citui-cyan-500) 88%,var(--citui-ink))}
.con .cty button[type].cty-btn--danger{background:var(--citui-bad);border-color:var(--citui-bad);color:var(--citui-on-bad)}
.con .cty button[type].cty-btn[disabled]{opacity:.45;cursor:not-allowed;filter:grayscale(.4)}
.cty-lnk{color:var(--citui-link-ink);font-weight:600;font-size:12.5px;text-decoration:underline;text-underline-offset:2px}
/* form */
.cty-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:10px 16px}
@container ctyp (min-width:520px){.cty-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.cty-f{min-width:0}
.cty-f--wide{grid-column:1/-1}
.cty-f__l{display:block;font-weight:600;font-size:12.5px;margin-bottom:3px}
.cty-f input:not([type=checkbox]):not([type=radio]),.cty-f select,.cty-gate textarea,.cty-hol__add input[type=date]{width:100%;min-width:0;padding:8px 10px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-sm);background:var(--citui-field);color:var(--citui-ink);font:inherit}
.cty-f input[readonly]{background:var(--citui-surface-2);color:var(--citui-muted)}
.cty-f input:focus,.cty-f select:focus,.cty-gate textarea:focus{outline:2px solid var(--citui-cyan-500);outline-offset:1px}
.cty-f__h{margin:3px 0 0;font-size:12px;color:var(--citui-muted)}
.cty-f__h:empty{display:none}
.cty-f__e{margin:2px 0 0;font-size:12px;color:var(--citui-bad-ink)}
.cty-f__e:empty{display:none}
.cty-f--err input:not([type=checkbox]):not([type=radio]),.cty-f--err select,.cty-f--err .cty-chips{border-color:var(--citui-bad)}
.cty-f__live{display:inline-block;margin-top:3px;font-size:12px;color:var(--citui-ok-ink)}
.cty-pre{display:flex;align-items:center;gap:4px}.cty-pre span{font-weight:700}
.cty-pair{display:flex;align-items:center;gap:6px}.cty-f .cty-pair input{max-width:84px}
.cty-bbox{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.cty-seg-ctl,.cty-checks{display:flex;flex-wrap:wrap;gap:6px}
.cty-seg-ctl label,.cty-checks label{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-pill);cursor:pointer;font-size:13px;background:var(--citui-surface)}
.cty-seg-ctl label:has(input:checked),.cty-checks label:has(input:checked){border-color:var(--citui-cyan-500);background:var(--citui-accent-soft);color:var(--citui-accent-ink);font-weight:600}
.cty-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:5px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-sm);background:var(--citui-field);min-height:40px}
.cty-chip{display:inline-flex;align-items:center;gap:2px;padding:2px 4px 2px 9px;border-radius:var(--citui-radius-pill);background:var(--citui-surface-2);border:1px solid var(--citui-line);font-size:12.5px;max-width:100%}
.cty .cty-chip button{display:inline-grid;place-items:center;width:20px;height:20px;border:0;border-radius:50%;background:none;cursor:pointer;color:var(--citui-muted)}
.cty-chip button:hover{background:var(--citui-hover);color:var(--citui-bad-ink)}
.cty-chip--once{border-style:dashed}
.cty .cty-f .cty-chips input.cty-chips__in{flex:1;width:auto;min-width:120px;border:0;background:none;padding:4px;outline:none;color:var(--citui-ink)}
.cty-chips--days{border-style:dashed;background:var(--citui-surface)}
.cty-hol{display:flex;gap:12px;margin-bottom:6px;font-size:12.5px}
.cty-hol__add{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}
.cty-f .cty-hol__add input[type=date]{width:auto}
/* readiness list */
.cty-rd{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.cty-rd__i{display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border-radius:var(--citui-radius-sm)}
.cty-rd__i--ok .cty-rd__ic{color:var(--citui-ok)} .cty-rd__i--bad .cty-rd__ic{color:var(--citui-bad)} .cty-rd__i--warn .cty-rd__ic{color:var(--citui-warn)}
.cty-rd__i--bad{background:color-mix(in srgb,var(--citui-bad) 6%,transparent)}
.cty-rd__ic{flex:none;margin-top:2px}
.cty-rd__t{min-width:0;font-size:13px}
.cty-rd__t b{font-weight:700}
.cty-rd__d{display:block;color:var(--citui-muted);font-size:12.5px;overflow-wrap:anywhere}
.cty-rd__i--warn .cty-rd__d{color:var(--citui-warn-ink)}
.cty-bar{display:block;height:5px;margin:5px 0 3px;border-radius:3px;background:var(--citui-surface-2);overflow:hidden;max-width:220px}
.cty-bar span{display:block;height:100%;background:var(--citui-cyan-500)}
/* market gate */
.cty-gate{margin-top:10px;padding:12px;border-radius:var(--citui-radius);border:1px solid var(--citui-line);background:var(--citui-surface)}
.cty-gate__h{display:flex;gap:7px;align-items:center;font-size:14px}
.cty-gate--open .cty-gate__h{color:var(--citui-ok-ink)}
.cty-gate--ready{border-color:var(--citui-ok);background:var(--citui-ok-soft)}
.cty-gate--ready .cty-gate__h{color:var(--citui-ok-ink)}
.cty-gate--shut .cty-gate__h{color:var(--citui-muted)}
.cty-gate p{margin:6px 0}
.cty-gate textarea{resize:vertical;margin:4px 0}
.con .cty .cty-gate button[type].cty-btn{margin-top:4px}
.cty-gate__warn{display:flex;gap:6px;color:var(--citui-warn-ink);font-size:12.5px}
.cty-gate__act summary{cursor:pointer;font-weight:600;font-size:13px;margin-top:6px}
.cty-gate__log{margin:8px 0 0;padding-left:16px;font-size:12.5px}
.cty-dirty{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--citui-warn-ink)}
.cty-dirty::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--citui-warn)}
`;
