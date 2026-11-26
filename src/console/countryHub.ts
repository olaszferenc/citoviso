// „Országok / Árazás” — ONE CRM lap for the countries and their prices (owner 2026-11-26; frozen plan
// assets/design-refs/console/orszagok-arazas/, README = the contract). Phase 1 (no migration):
//   · the opening TABLE of the countries (desktop) / cards with the next thing to do (phone) — the
//     two layouts switch on the container width (@container), not on the window;
//   · a country opens on three tabs: „Ország” (master data, the opening box, the launch list with
//     who fills what is missing), „Árazás” (the old /pricing page of the country's region — the same
//     form, the same POST) and „Kiküldés” (READ-ONLY in phase 1: today's values and what decides them);
//   · the „Adatok” editor (countryViews.ts, ADR-0460) opens over the tab, unchanged.
// Every number comes from countryData.ts (which reads the runtime's own functions); every text is T().
import type { ReadinessItem } from "../countryReadiness.js";
import { T } from "../i18n/mail.js";
import type { LaunchStep } from "../scout/discoveryAreas.js";
import { formatNumber } from "../text/money.js";
import type { CountryOverview, CountryOverviewRow, CountryStatusKey, OutreachInfo, RunState } from "./countryData.js";
import { COUNTRY_CSS, editorOverlay, editorScript, gateBlock, ICON, type CountryEditor } from "./countryViews.js";
import { consoleLang } from "./i18nCtx.js";
import { jsonForScript } from "../text/jsonForScript.js";
import { esc, helpLink, layout } from "./views.js";

export type HubTab = "country" | "price" | "out";
export const HUB_TABS: readonly HubTab[] = ["country", "price", "out"];
export function parseHubTab(v: string | null): HubTab {
  return v === "price" || v === "out" ? v : "country";
}

const n = (x: number): string => formatNumber(x);
const hrefCountry = (iso: string, tab: HubTab = "country"): string =>
  `/countries?iso=${encodeURIComponent(iso)}${tab === "country" ? "" : `&tab=${tab}`}`;

function statusLabel(lang: string, s: CountryStatusKey): string {
  switch (s) {
    case "home": return T(lang, "Fut · hazai");
    case "open": return T(lang, "Fut");
    case "approvedIncomplete": return T(lang, "Jóváhagyva, hiányos");
    case "ready": return T(lang, "Indítható");
    case "added": return T(lang, "Felvéve");
  }
}
const statusTone: Readonly<Record<CountryStatusKey, string>> = { home: "ok", open: "ok", approvedIncomplete: "warn", ready: "info", added: "" };

function statusTag(lang: string, s: CountryStatusKey): string {
  return `<span class="cty-tag${statusTone[s] ? ` cty-tag--${statusTone[s]}` : ""}">${esc(statusLabel(lang, s))}</span>`;
}

function runTag(lang: string, r: RunState): string {
  const label = r === "run" ? T(lang, "megy") : r === "stop" ? T(lang, "áll") : T(lang, "nem indult");
  return `<span class="hub-run hub-run--${r}"><i aria-hidden="true"></i>${esc(label)}</span>`;
}

function priceTag(lang: string, gaps: readonly string[]): string {
  return gaps.length
    ? `<span class="cty-tag cty-tag--bad" title="${esc(gaps.join(" · "))}">${esc(T(lang, "hiányos"))}</span>`
    : `<span class="cty-tag cty-tag--ok">${esc(T(lang, "kész"))}</span>`;
}

function subsCell(lang: string, r: CountryOverviewRow): string {
  return `${n(r.subsActive)}${r.subsFrozen ? ` <span class="cty-mut cty-small">${esc(T(lang, "+{n} szünetel", { n: r.subsFrozen }))}</span>` : ""}`;
}

/** The first missing gating item — the card's „next thing to do”. */
function nextItem(r: CountryOverviewRow): ReadinessItem | null {
  return r.entry.readiness.items.find((i) => i.gating && i.state === "bad") ?? null;
}

// ── the opening table ──────────────────────────────────────────────────────────────────────────
function tableRow(lang: string, r: CountryOverviewRow): string {
  const e = r.entry;
  return `<tr id="ovrow-${esc(e.iso)}" data-row="${esc(e.iso)}">
    <td><a class="cty-mx__name" href="${esc(hrefCountry(e.iso))}"><span class="cty-iso">${esc(e.iso)}</span><span class="cty-mx__n"><b>${esc(e.name || e.iso)}</b><span>${esc(e.lang)} · ${esc(e.timeZone)}</span></span></a></td>
    <td>${esc(e.currency)}</td>
    <td><a href="${esc(hrefCountry(e.iso, "price"))}" class="hub-cl">${priceTag(lang, r.pricingGaps)}</a></td>
    <td class="hub-st">${statusTag(lang, r.status)}</td>
    <td>${runTag(lang, r.collecting)}</td>
    <td><a href="${esc(hrefCountry(e.iso, "out"))}" class="hub-cl">${runTag(lang, r.sending)}</a></td>
    <td class="hub-num">${n(r.leads)}</td>
    <td class="hub-num">${subsCell(lang, r)}</td>
    <td class="hub-num">${n(r.dailyCap)}</td>
    <td class="hub-num">${n(r.sentToday)}</td></tr>`;
}

function card(lang: string, r: CountryOverviewRow): string {
  const e = r.entry;
  const next = nextItem(r);
  const line = next
    ? `${esc(T(lang, "Következő:"))} <b>${esc(next.title)}</b> — ${esc(next.detail)}`
    : esc(T(lang, "Minden zárófeltétel rendben."));
  return `<a id="ovcard-${esc(e.iso)}" class="cty-card" href="${esc(hrefCountry(e.iso))}">
    <span class="cty-card__h"><span><span class="cty-iso">${esc(e.iso)}</span><b>${esc(e.name || e.iso)}</b></span>${statusTag(lang, r.status)}</span>
    <span class="hub-kv"><span>${esc(e.currency)} · ${esc(T(lang, "Árazás"))} ${priceTag(lang, r.pricingGaps)}</span>
      <span>${esc(T(lang, "Leadgyűjtés"))} ${runTag(lang, r.collecting)}</span>
      <span>${esc(T(lang, "Kiküldés"))} ${runTag(lang, r.sending)}</span></span>
    <span class="hub-kv hub-kv--n"><span><b>${n(r.leads)}</b> ${esc(T(lang, "lead"))}</span><span><b>${n(r.subsActive)}</b> ${esc(T(lang, "előfizető"))}${r.subsFrozen ? ` (${esc(T(lang, "+{n} szünetel", { n: r.subsFrozen }))})` : ""}</span><span><b>${n(r.sentToday)}</b> / ${n(r.dailyCap)} ${esc(T(lang, "ma"))}</span></span>
    <span class="cty-card__next">${line}</span></a>`;
}

function summaryBar(lang: string, ov: CountryOverview): string {
  const leads = ov.rows.reduce((a, r) => a + r.leads, 0);
  const subs = ov.rows.reduce((a, r) => a + r.subsActive, 0);
  const frozen = ov.rows.reduce((a, r) => a + r.subsFrozen, 0);
  const sent = ov.rows.reduce((a, r) => a + r.sentToday, 0);
  const cap = ov.rows.reduce((a, r) => a + r.dailyCap, 0);
  const kpi = (v: string, l: string): string => `<div class="hub-kpi"><b>${v}</b><span>${esc(l)}</span></div>`;
  return `<div class="hub-kpis" id="hub-kpis">
    ${kpi(n(ov.rows.length), T(lang, "felvett ország"))}
    ${kpi(n(leads), T(lang, "összes lead"))}
    ${kpi(`${n(subs)}${frozen ? ` <small>+${n(frozen)}</small>` : ""}`, frozen ? T(lang, "aktív előfizető (+ szünetel)") : T(lang, "aktív előfizető"))}
    ${kpi(`${n(sent)} <small>/ ${n(cap)}</small>`, T(lang, "ma kiküldve / napi keret"))}
  </div>${ov.dispatchOn ? "" : `<p class="cty-notice cty-notice--bad" role="status">${esc(T(lang, "Az automata kiküldés főkapcsolója ki van kapcsolva — egyik országban sem megy ki megkeresés."))}</p>`}`;
}

export function hubOverviewPage(opts: {
  readonly ov: CountryOverview;
  readonly notice: { ok: boolean; text: string } | null;
  readonly newIso?: string;
  readonly newErr?: string;
  /** ?new=XX — the „Adatok” editor of a new country, over the table. */
  readonly editor: CountryEditor | null;
}): string {
  const lang = consoleLang();
  const { ov } = opts;
  const head = [
    T(lang, "Ország"), T(lang, "Pénznem"), T(lang, "Árazás"), T(lang, "Státusz"), T(lang, "Leadgyűjtés"),
    T(lang, "Kiküldés"), T(lang, "Lead"), T(lang, "Előfizető"), T(lang, "Napi keret"), T(lang, "Ma kiküldve"),
  ];
  const body = `<div class="cty hub" id="cty">
    <div class="cty-top">
      <div><h2>${esc(T(lang, "Országok / Árazás"))} ${helpLink("console.countries")}</h2>
        <p class="cty-lead">${esc(T(lang, "Egy sor egy felvett ország: az ára, az állapota, és hogy megy-e benne a leadgyűjtés és a kiküldés. Egy országra kattintva három fül nyílik: Ország, Árazás, Kiküldés."))}</p></div>
      <form class="cty-new" method="get" action="/countries" novalidate>
        <input name="new" maxlength="2" placeholder="${esc(T(lang, "ISO"))}" aria-label="${esc(T(lang, "Új ország ISO-kódja"))}" value="${esc(opts.newIso ?? "")}" autocomplete="off">
        <button class="cty-btn cty-btn--sm ghost" type="submit">${ICON.plus} ${esc(T(lang, "Új ország"))}</button>
        <p class="cty-f__e" role="alert">${esc(opts.newErr ?? "")}</p></form>
    </div>
    ${opts.notice ? `<p class="cty-notice cty-notice--${opts.notice.ok ? "ok" : "bad"}" role="status">${esc(opts.notice.text)}</p>` : ""}
    ${summaryBar(lang, ov)}
    <div class="cty-panel cty-mxwrap hub-tablewrap"><table class="cty-mx hub-table"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${ov.rows.map((r) => tableRow(lang, r)).join("")}</tbody></table></div>
    <div class="cty-cards">${ov.rows.map((r) => card(lang, r)).join("")}</div>
    <p class="hub-note" id="hub-global">${esc(T(lang, "A „Globális” ársor nem ország: a bejelentkezés nélküli főoldal-látogató árkijelzése."))} <a class="cty-lnk" href="/countries/global-pricing">${esc(T(lang, "Globális ársor szerkesztése ›"))}</a></p>
    ${ov.unlisted.length ? `<p class="hub-note" id="hub-unlisted">${esc(T(lang, "Találkoztunk velük (terület vagy vevő), de még nincs soruk:"))} ${ov.unlisted.map((iso) => `<a class="cty-lnk" href="/countries?new=${encodeURIComponent(iso)}">${esc(iso)}</a>`).join(" · ")}</p>` : ""}
    ${opts.editor ? editorOverlay(opts.editor, "/countries") : ""}
  </div>${opts.editor ? editorScript() : ""}`;
  return layout(T(lang, "Országok / Árazás"), body, { active: "/countries", head: `<style>${COUNTRY_CSS}${HUB_CSS}</style>` });
}

// ── one country: the tab frame ─────────────────────────────────────────────────────────────────
function tabLabel(lang: string, t: HubTab): string {
  return t === "country" ? T(lang, "Ország") : t === "price" ? T(lang, "Árazás") : T(lang, "Kiküldés");
}

export function hubCountryPage(opts: {
  readonly row: CountryOverviewRow;
  readonly tab: HubTab;
  readonly notice: { ok: boolean; text: string } | null;
  /** The stored row's editor — the opening box reads it; shown as the sheet when `editorOpen`. */
  readonly editor: CountryEditor;
  readonly editorOpen: boolean;
  /** The tab's body (built by the caller: the pricing form needs the pricing extras). */
  readonly tabHtml: string;
}): string {
  const lang = consoleLang();
  const e = opts.row.entry;
  const tabs = HUB_TABS.map((t) =>
    t === opts.tab
      ? `<span class="hub-tab" aria-current="page" data-tab="${t}">${esc(tabLabel(lang, t))}</span>`
      : `<a class="hub-tab" href="${esc(hrefCountry(e.iso, t))}" data-tab="${t}">${esc(tabLabel(lang, t))}</a>`,
  ).join("");
  const body = `<div class="cty hub" id="cty">
    <p class="hub-crumb"><a class="cty-lnk" href="/countries">${esc(T(lang, "‹ Országok / Árazás"))}</a></p>
    <div class="hub-h"><span class="cty-iso">${esc(e.iso)}</span><h2>${esc(e.name || e.iso)} ${helpLink(opts.tab === "price" ? "console.pricing" : "console.countries")}</h2>${statusTag(lang, opts.row.status)}<span class="cty-mut cty-small">${esc(e.currency)} · ${esc(opts.row.region)}</span></div>
    <nav class="hub-tabs" aria-label="${esc(T(lang, "Fülek"))}">${tabs}</nav>
    ${opts.notice && opts.tab !== "price" ? `<p class="cty-notice cty-notice--${opts.notice.ok ? "ok" : "bad"}" role="status">${esc(opts.notice.text)}</p>` : ""}
    <section class="hub-body" id="hub-${opts.tab}">${opts.tabHtml}</section>
    ${opts.editorOpen ? editorOverlay(opts.editor, hrefCountry(e.iso)) : ""}
  </div>${opts.editorOpen ? editorScript() : ""}`;
  return layout(`${e.name || e.iso} — ${T(lang, "Országok / Árazás")}`, body, {
    active: "/countries",
    head: `<style>${COUNTRY_CSS}${HUB_CSS}</style>`,
  });
}

// ── „Ország” tab ───────────────────────────────────────────────────────────────────────────────
/** Who fills a missing readiness item (the plan ⑧: a machine or a colleague; a person only for money). */
function whoFills(lang: string, key: ReadinessItem["key"]): string {
  switch (key) {
    case "data": return T(lang, "Az ország felvételekor a gép tölti ki; ami hibás, az „Adatok” szerkesztőben javítható.");
    case "lexicon": return T(lang, "Fejlesztés: az ország szótára (területek, keresőszavak) a gyűjtő-lánc kódjával készül.");
    case "prices": return T(lang, "Tulaj: a kezdő ár jóváhagyása (pénzdöntés) — az Árazás fülön.");
    case "wallet": return T(lang, "Tulaj: a pénztárca megnyitása a fizetési szolgáltatónál.");
    case "babel": return T(lang, "Bábel (fordító munkatárs) fordítja a hiányzó vevő-oldali szövegeket.");
    case "legal": return T(lang, "Bábel fordítja a jogi csomagot az ország nyelvére.");
    case "adr": return T(lang, "Bábel: a fogyasztói vitarendező adatai a jogi csomagban.");
    case "holidays": return T(lang, "A gép a nyilvános ünnepnap-naptárból tölti; mozgó ünnep évenként a „Megkeresés” lépésben.");
    case "channel": return T(lang, "A gép: az e-mail csatorna minden országban él; mobil csak modem-párral.");
  }
}

function launchTitle(lang: string, k: LaunchStep["key"]): string {
  switch (k) {
    case "open": return T(lang, "Piacnyitás");
    case "areas": return T(lang, "Régió-felbontás (területek)");
    case "tiles": return T(lang, "Csempék");
    case "walk": return T(lang, "Felderítés (bejárt csempék)");
    case "leads": return T(lang, "Lead");
    case "contact": return T(lang, "Kontakt (e-mail cím)");
    case "mock": return T(lang, "Mock");
    case "sent": return T(lang, "Kiküldés");
  }
}

function launchWho(lang: string, k: LaunchStep["key"]): string {
  switch (k) {
    case "open": return T(lang, "A piac a lenti „Indítás” dobozból nyílik, ha minden zárófeltétel zöld.");
    case "areas":
    case "tiles": return T(lang, "A gép a piacnyitás után magától felbontja az országot területekre és csempékre.");
    case "walk": return T(lang, "A gép a nyitott piac csempéit magától bejárja.");
    case "leads": return T(lang, "A felderítés találja meg a szállásokat.");
    case "contact": return T(lang, "A kontakt-lánc keresi meg a szállás e-mail címét.");
    case "mock": return T(lang, "A mock-generátor készíti el a bemutató oldalt.");
    case "sent": return T(lang, "A kiküldő időzítő küldi ki, a Kiküldés fül szabályai szerint.");
  }
}

const STATE_ICON = { ok: ICON.ok, bad: ICON.bad, warn: ICON.warn, run: ICON.warn, wait: ICON.na } as const;

function stateLabel(lang: string, s: keyof typeof STATE_ICON): string {
  switch (s) {
    case "ok": return T(lang, "kész");
    case "bad": return T(lang, "hiányzik");
    case "warn": return T(lang, "figyelem");
    case "run": return T(lang, "folyamatban");
    case "wait": return T(lang, "vár");
  }
}

function listItem(lang: string, key: string, state: keyof typeof STATE_ICON, title: string, detail: string, who: string, pct?: number, gating = true): string {
  const bar = typeof pct === "number" && pct < 100 ? `<span class="cty-bar"><span style="width:${pct}%"></span></span>` : "";
  return `<li class="cty-rd__i cty-rd__i--${state === "run" ? "warn" : state === "wait" ? "na" : state}" data-launch="${esc(key)}">
    <span class="cty-rd__ic">${STATE_ICON[state]}</span>
    <div class="cty-rd__t"><b>${esc(title)}</b> <span class="cty-tag">${esc(stateLabel(lang, state))}</span>${gating ? "" : ` <span class="cty-tag">${esc(T(lang, "nem zár"))}</span>`}
      <span class="cty-rd__d">${esc(detail)}</span>${bar}
      ${state === "ok" ? "" : `<span class="hub-who"><b>${esc(T(lang, "Mi hiányzik, ki pótolja:"))}</b> ${esc(who)}</span>`}
    </div></li>`;
}

function stepDetail(lang: string, s: LaunchStep): string {
  if (s.key === "open") return s.state === "ok" ? T(lang, "a piac nyitva") : T(lang, "a piac zárva");
  if (s.total == null) return T(lang, "{n} db", { n: n(s.done) });
  return T(lang, "{done} / {total}", { done: n(s.done), total: n(s.total) });
}

export function countryTab(row: CountryOverviewRow, ed: CountryEditor, out: OutreachInfo | null): string {
  const lang = consoleLang();
  const e = row.entry;
  const d = ed.draft;
  const items = e.readiness.items;
  const it = (k: ReadinessItem["key"]): ReadinessItem | undefined => items.find((i) => i.key === k);
  const step = (k: LaunchStep["key"]): LaunchStep | undefined => row.launch.steps.find((s) => s.key === k);
  // The contract's order (⑧): data → regions → language → ADR → holidays → prices → wallet → channel →
  // discovery → contact → mock → sending (the lexicon beside the regions, the gate before the chain).
  const order: ({ r: ReadinessItem["key"] } | { l: LaunchStep["key"] })[] = [
    { r: "data" }, { r: "lexicon" }, { l: "areas" }, { l: "tiles" }, { r: "babel" }, { r: "legal" }, { r: "adr" },
    { r: "holidays" }, { r: "prices" }, { r: "wallet" }, { r: "channel" }, { l: "open" }, { l: "walk" }, { l: "leads" },
    { l: "contact" }, { l: "mock" }, { l: "sent" },
  ];
  const list = order
    .map((o) => {
      if ("r" in o) {
        const i = it(o.r);
        return i ? listItem(lang, i.key, i.state, i.title, i.detail, whoFills(lang, i.key), i.pct, i.gating) : "";
      }
      const s = step(o.l);
      return s ? listItem(lang, s.key, s.state, launchTitle(lang, s.key), stepDetail(lang, s), launchWho(lang, s.key)) : "";
    })
    .join("");
  const wallet = it("wallet");
  const facts: [string, string][] = [
    [T(lang, "Státusz"), `${statusLabel(lang, row.status)}${e.market.approvedAt ? ` · ${new Date(e.market.approvedAt).toISOString().slice(0, 10)}` : ""}`],
    [T(lang, "Pénznem"), d.currency || "—"],
    [T(lang, "Ár-régió"), row.region],
    [T(lang, "Nyelv"), d.defaultLang || "—"],
    [T(lang, "Időzóna"), d.timeZone || "—"],
    [T(lang, "Hívószám"), d.dialCode ? `+${d.dialCode}` : "—"],
    [T(lang, "Fizetés"), `${d.paymentProvider}${wallet ? ` · ${wallet.detail}` : ""}`],
    [T(lang, "Csatorna"), out ? out.draft.channels.join(", ") || "—" : "—"],
    [T(lang, "Kiküldési ablak"), out ? `${out.draft.sendWindowFrom}:00–${out.draft.sendWindowTo}:00 (${out.cfg.timeZone})` : "—"],
    [T(lang, "Napi keret"), n(row.dailyCap)],
    [T(lang, "Lead / előfizető"), `${n(row.leads)} / ${n(row.subsActive)}${row.subsFrozen ? ` (${T(lang, "+{n} szünetel", { n: row.subsFrozen })})` : ""}`],
  ];
  return `<div class="hub-two">
    <div class="cty-panel hub-card"><div class="hub-card__h"><h3>${esc(T(lang, "Alapadatok"))}</h3>
        <a class="cty-btn cty-btn--sm ghost" id="hub-edit" href="${esc(`/countries?iso=${encodeURIComponent(e.iso)}&step=data`)}">${esc(T(lang, "Adatok szerkesztése"))}</a></div>
      <dl class="cty-facts hub-facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
    <div class="cty-panel hub-card"><h3>${esc(T(lang, "Indítás"))}</h3><div id="hub-gate">${gateBlock(ed)}</div></div>
  </div>
  <div class="cty-panel hub-card"><h3>${esc(T(lang, "Az indulás állapota"))}</h3>
    <p class="cty-small cty-mut">${esc(T(lang, "Sorrendben, ahogy a lánc halad. Ami nem kész, annál ott áll, mi hiányzik és ki pótolja. A piac a zárófeltételek zöldje után nyitható; a felderítés, a kontakt, a mock és a kiküldés utána magától indul."))}</p>
    <ol class="cty-rd" id="hub-launch">${list}</ol></div>`;
}

// ── „Kiküldés” tab (4. fázis: editable — POST /countries/dispatch, live check /countries/dispatch/check) ──
function decides(lang: string, today: string, decided = false): string {
  return `<p class="hub-dec"><b>${esc(T(lang, "Korábban döntött:"))}</b> ${esc(today)} <span class="cty-tag">${esc(T(lang, "most országonkénti beállítás"))}</span>${decided ? ` <span class="cty-tag cty-tag--ok">${esc(T(lang, "döntve"))}</span>` : ""}</p>`;
}

function chName(lang: string, id: string): string {
  switch (id) {
    case "email": return T(lang, "E-mail");
    case "sms": return T(lang, "SMS");
    case "mms": return T(lang, "MMS");
    case "viber": return T(lang, "Viber");
    case "whatsapp": return T(lang, "WhatsApp");
    default: return id;
  }
}

function siteName(lang: string, id: string): string {
  switch (id) {
    case "no_site": return T(lang, "nincs honlap");
    case "outdated": return T(lang, "elavult honlap");
    case "modern": return T(lang, "modern honlap");
    default: return T(lang, "besorolatlan");
  }
}

function ruleName(lang: string, k: string): string {
  switch (k) {
    case "twoMocks": return T(lang, "két mock saját képpel vagy településképpel");
    case "townNoMms": return T(lang, "településképes mock MMS-ben nem megy");
    case "emailOnly": return T(lang, "akinek van e-mailje, csak e-mailt kap");
    case "uncheckedEmail": return T(lang, "ellenőrizetlen mobilú lead e-mailben mehet");
    default: return T(lang, "e-mail cím nélkül nem küldünk");
  }
}

const ARROWS = (lang: string, name: string): string =>
  `<span class="hub-ord"><button type="button" class="cty-btn cty-btn--sm" data-up aria-label="${esc(T(lang, "{v} feljebb", { v: name }))}">↑</button><button type="button" class="cty-btn cty-btn--sm" data-down aria-label="${esc(T(lang, "{v} lejjebb", { v: name }))}">↓</button></span>`;

export function outreachTab(row: CountryOverviewRow, o: OutreachInfo): string {
  const lang = consoleLang();
  const d = o.draft;
  const iso = o.iso;
  const chk = (on: boolean): string => (on ? " checked" : "");
  const kpi = (id: string, v: string, l: string): string => `<div class="hub-kpi" id="${id}"><b>${v}</b><span>${esc(l)}</span></div>`;
  const days = d.dailyQuota > 0 ? Math.ceil(o.count.total / d.dailyQuota) : null;
  const sitesOrdered = [...d.sites, ...(["no_site", "outdated", "modern", "unclassified"] as const).filter((x) => !d.sites.includes(x))];
  const chOrdered = [...d.channels, ...["email", "sms", "mms", "viber", "whatsapp"].filter((c) => !d.channels.includes(c))];
  const wdNames = [T(lang, "H"), T(lang, "K"), T(lang, "Sze"), T(lang, "Cs"), T(lang, "P"), T(lang, "Szo"), T(lang, "V")];
  const radio = (mode: "own" | "own_town", text: string): string =>
    `<label class="hub-radio"><input type="radio" name="photoMode" value="${mode}"${chk(d.photoMode === mode)}> <span>${text}</span></label>`;
  const nTag = `<b data-n>${d.minOwnPhotos}</b>`;
  const radioText = (key: string): string => esc(T(lang, key, { n: "{n}" })).replace("{n}", nTag);
  const err = (k: string): string => `<p class="cty-f__e" role="alert" data-err="${k}"></p>`;
  const body = `<form id="out-form" method="post" action="/countries/dispatch" novalidate>
  <input type="hidden" name="iso" value="${esc(iso)}">
  <p class="cty-small cty-mut">${esc(T(lang, "Minden tétel ennek az országnak a saját beállítása; az alapérték a mai valós működés. Mentés előtt összesítő mutatja, mi változik és hány leadet érint."))}</p>
  <div class="hub-kpis" id="out-sum">
    ${kpi("out-k-total", n(o.count.total), T(lang, "lead felel meg (holnaptól)"))}
    ${kpi("out-k-day", n(o.dailyCap), T(lang, "megkeresés naponta"))}
    ${kpi("out-k-first", esc(o.firstDay ?? "—"), o.windowOpenNow ? T(lang, "első küldési nap (az ablak most nyitva)") : T(lang, "első küldési nap"))}
    ${kpi("out-k-days", days == null ? "—" : n(days), T(lang, "küldési nap alatt fogy el"))}
  </div>
  <p class="cty-small cty-mut">${esc(T(lang, "A szám a még meg nem keresett, nem tiltott, e-mail címes leadekből jön. A mock-, a render- és a minőségi kapu ezen felül szűr, ezért a ténylegesen kimenő szám kisebb lehet."))}</p>
  ${o.dispatchOn ? "" : `<p class="cty-notice cty-notice--bad">${esc(T(lang, "Az automata kiküldés főkapcsolója ki van kapcsolva — most egyik országban sem megy ki megkeresés."))}</p>`}
  <div class="hub-out">
  <div class="cty-panel hub-card" id="out-1"><h3>${esc(T(lang, "1. Milyen lead mehet"))}</h3>
    <label class="hub-inl">${esc(T(lang, "Legalább ennyi saját kép"))} <input type="number" name="minOwnPhotos" min="1" max="20" value="${d.minOwnPhotos}" class="hub-num-in"></label>${err("minOwnPhotos")}
    <div class="hub-radios">
      ${radio("own", radioText("Csak saját képes — legalább {n} saját kép; kevesebb képes lead nem megy ki"))}
      ${radio("own_town", radioText("Saját képes (legalább {n}) + kevés képes is, településképes nyitóképpel"))}
    </div>
    <p class="cty-small" id="out-split">${esc(T(lang, "ebből saját képpel: {own} · településképpel: {town}", { own: n(o.count.own), town: n(o.count.town) }))}</p>
    <label class="hub-chk"><input type="checkbox" name="stockOk" value="1"${chk(d.stockOk)}> ${esc(T(lang, "MINTA-jelölt szoba- és galériakép mehet (kevés saját képnél)"))}</label>
    <p class="hub-sub">${esc(T(lang, "Honlap szerinti kör, sorrendben (a ki nem pipált nem megy ki):"))}</p>
    <ol class="hub-ordlist" data-order="sites">${sitesOrdered.map((x) => `<li><label class="hub-chk"><input type="checkbox" name="sites" value="${x}"${chk(d.sites.includes(x))}> ${esc(siteName(lang, x))}</label>${ARROWS(lang, siteName(lang, x))}</li>`).join("")}</ol>${err("sites")}
    ${decides(lang, T(lang, "a kód (5 saját kép, kiküldési sorrend, render-kapu) és a globális „településképes kiküldés” kapcsoló"))}</div>
  <div class="cty-panel hub-card" id="out-2"><h3>${esc(T(lang, "2. Csatornák sorrendben"))}</h3>
    <ol class="hub-ordlist" data-order="channels">${chOrdered.map((c) => {
      const live = o.cfg.outreachChannels.includes(c);
      // The e-mail is locked on (the dispatcher sends e-mail only, owner 2026-11-20): shown checked, sent hidden.
      if (c === "email") return `<li><label class="hub-chk"><input type="checkbox" checked disabled> ${esc(chName(lang, c))}</label><input type="hidden" name="channels" value="email"> <span class="cty-tag">${esc(T(lang, "mindig be"))}</span>${ARROWS(lang, chName(lang, c))}</li>`;
      return `<li class="${live ? "" : "hub-off"}"><label class="hub-chk"><input type="checkbox" name="channels" value="${c}"${chk(d.channels.includes(c))}${live ? "" : " disabled"}> ${esc(chName(lang, c))}</label>${live ? ARROWS(lang, chName(lang, c)) : ` <span class="cty-tag">${esc(T(lang, "nem él"))}</span>`}</li>`;
    }).join("")}</ol>${err("channels")}
    <p class="cty-notice cty-notice--warn" id="out-mobwarn"${d.channels.some((c) => c !== "email") ? "" : " hidden"}>${esc(T(lang, "Mobilcsatorna be van kapcsolva, de az „e-mail cím nélkül nem küldünk” szabály él — mobilon nem indul megkeresés."))}</p>
    ${decides(lang, T(lang, "az ország sora (csatornák) és a tulaj 11-20-i szabálya: csak e-mail"))}</div>
  <div class="cty-panel hub-card" id="out-3"><h3>${esc(T(lang, "3. Napi keret"))}</h3>
    <label class="hub-inl"><input type="number" name="dailyQuota" min="0" max="5000" value="${d.dailyQuota}" class="hub-num-in"> ${esc(T(lang, "megkeresés az ország napján · ma eddig {n}", { n: n(o.sentToday) }))}</label>${err("dailyQuota")}
    ${o.ramp ? `<p class="cty-small">${esc(T(lang, "Felfutás él: ma legfeljebb {n} megkeresés megy ki az összes országban együtt, és a hazai keret eddig emelkedik.", { n: n(o.ramp.capToday) }))}</p>` : ""}
    ${decides(lang, row.entry.home ? T(lang, "globális beállítás (az automata kiküldés napi kerete)") : T(lang, "az ország sora (napi kvóta)"))}</div>
  <div class="cty-panel hub-card" id="out-4"><h3>${esc(T(lang, "4. Jóváhagyás"))}</h3>
    <div class="hub-radios">
      <label class="hub-radio"><input type="radio" name="approval" value="owner"${chk(d.approval === "owner")}> <span><b>${esc(T(lang, "Tulaj-jóváhagyás"))}</b> — ${esc(T(lang, "minden levél a Jóváhagyás lapon vár a „Mehet”-re"))}</span></label>
      <label class="hub-radio"><input type="radio" name="approval" value="auto"${chk(d.approval === "auto")}> <span><b>${esc(T(lang, "Automata"))}</b> — ${esc(T(lang, "a gép hagyja jóvá, ha az alábbi feltételek teljesülnek"))}</span></label>
    </div>
    <ul class="hub-rules">${(["twoMocks", "townNoMms", "emailOnly", "uncheckedEmail", "noMailNoSend"] as const).map((k) =>
      k === "noMailNoSend"
        ? `<li><label class="hub-chk"><input type="checkbox" checked disabled> ${esc(ruleName(lang, k))}</label><input type="hidden" name="rule_noMailNoSend" value="1"> <span class="cty-tag">${esc(T(lang, "a kiküldő tartja"))}</span></li>`
        : `<li><label class="hub-chk"><input type="checkbox" name="rule_${k}" value="1"${chk(d.rules[k])}> ${esc(ruleName(lang, k))}</label></li>`,
    ).join("")}</ul>${err("rules")}
    <p class="cty-small cty-mut">${esc(o.autoApproveOn
      ? T(lang, "Az automata jóváhagyás a kiküldő ütemében fut (20 percenként).")
      : T(lang, "Az automata jóváhagyás a kiküldő ütemében fut; az átállásig ki van kapcsolva, addig az „Automata” beállítás sem hagy jóvá semmit."))}</p>
    ${decides(lang, T(lang, "az éles gép jóváhagyó szkriptje (auto-approve.mts, a fejlesztőgép ütemezője) — a pipálható szabálylista váltja ki; tulaj 2026-11-26: most minden országban a tulaj hagy jóvá"), true)}</div>
  <div class="cty-panel hub-card" id="out-5"><h3>${esc(T(lang, "5. Időkeret"))}</h3>
    <div class="hub-wd">${wdNames.map((nm, i) => `<label class="hub-chk hub-chk--day"><input type="checkbox" name="weekdays" value="${1 << i}"${chk((d.weekdays & (1 << i)) !== 0)}> ${esc(nm)}</label>`).join("")}</div>${err("weekdays")}
    <label class="hub-inl">${esc(T(lang, "Órák"))} <input type="number" name="windowFrom" min="0" max="23" value="${d.sendWindowFrom}" class="hub-num-in"> – <input type="number" name="windowTo" min="1" max="24" value="${d.sendWindowTo}" class="hub-num-in"> ${esc(T(lang, "({tz} szerint)", { tz: o.cfg.timeZone }))}</label>${err("window")}
    <label class="hub-chk"><input type="checkbox" name="skipHolidays" value="1"${chk(d.skipHolidays)}> ${esc(o.cfg.publicHolidays.length ? T(lang, "az ország {n} ünnepnapján nem küldünk", { n: o.cfg.publicHolidays.length }) : T(lang, "az ország ünnepnapjain nem küldünk (nincs felvett ünnepnap)"))}</label>
    ${decides(lang, T(lang, "a kód (8–17 óra, hétfő–péntek) és az ország sora — a kódba égetett 8–17 megszűnt"), true)}</div>
  <div class="cty-panel hub-card" id="out-6"><h3>${esc(T(lang, "6. Utánkövetés"))}</h3>
    <label class="hub-chk"><input type="checkbox" name="nonOpenerOn" value="1"${chk(d.nonOpener.on)}> ${esc(T(lang, "Nem-nyitó levél"))}</label>
    <label class="hub-inl"><input type="number" name="nonOpenerDays" min="1" max="90" value="${d.nonOpener.days}" class="hub-num-in"> ${esc(T(lang, "nap után, 1 levél, napi"))} <input type="number" name="nonOpenerCap" min="0" max="5000" value="${d.nonOpener.dailyCap}" class="hub-num-in"></label>${err("nonOpener")}
    <p class="cty-notice cty-notice--warn" id="out-nowarn"${d.nonOpener.on && d.nonOpener.dailyCap === 0 ? "" : " hidden"}>${esc(T(lang, "A nem-nyitó levél be van kapcsolva, de a napi kerete 0 — így egy sem megy ki."))}</p>
    <label class="hub-chk"><input type="checkbox" name="escalationFollowup" value="1"${chk(d.escalationFollowup)}> ${esc(T(lang, "Eszkalációs ajánlat e-mailben"))}</label>
    ${decides(lang, T(lang, "a kód (14 nap) és két globális beállítás (nem-nyitó napi keret, eszkalációs levél kapcsolója)"), true)}</div>
  </div>
  <div class="hub-savebar" id="out-bar" hidden><span id="out-dirty"></span>
    <a class="cty-btn cty-btn--sm ghost" href="${esc(`/countries?iso=${encodeURIComponent(iso)}&tab=out`)}">${esc(T(lang, "Visszaállítás"))}</a>
    <button type="button" class="cty-btn cty-btn--primary ghost" id="out-review">${esc(T(lang, "Mentés…"))}</button>
    <noscript><button type="submit" class="cty-btn cty-btn--primary ghost">${esc(T(lang, "Mentés"))}</button></noscript></div>
  <dialog class="hub-dlg" id="out-dlg" aria-labelledby="out-dlg-h"><h3 id="out-dlg-h">${esc(T(lang, "Kiküldés — mentés előtt"))}</h3>
    <div id="out-dlg-b"></div>
    <div class="hub-dlg__f"><button type="button" class="cty-btn cty-btn--sm ghost" id="out-dlg-x">${esc(T(lang, "Vissza"))}</button>
      <button type="submit" class="cty-btn cty-btn--primary ghost" id="out-save">${esc(T(lang, "Mentés"))}</button></div></dialog>
  </form>
  <script type="application/json" id="out-cfg">${jsonForScript({
    dirty: T(lang, "{n} módosítás — még nincs mentve"),
    split: T(lang, "ebből saját képpel: {own} · településképpel: {town}"),
    nowThen: T(lang, "{now} lead felel meg most → {next} lead holnaptól"),
    perDay: T(lang, "naponta {n} megkeresés"),
    first: T(lang, "első küldési nap: {d}"),
    lasts: T(lang, "az állomány {n} küldési nap alatt fogy el"),
    changes: T(lang, "Módosítások"),
    nowCol: T(lang, "Most"),
    newCol: T(lang, "Új"),
    none: T(lang, "Nincs módosítás."),
    errs: T(lang, "Javítandó mező van — nem menthető."),
    gates: T(lang, "A mock-, a render- és a minőségi kapu ezen felül szűr."),
  })}</script>
  <script>${OUT_JS}</script>`;
  return body;
}

// The tab's script: ordering, the live check (the server computes the count and the changes), the dialog.
const OUT_JS = `(function(){
"use strict";
var f=document.getElementById("out-form");if(!f)return;
var cfg=JSON.parse(document.getElementById("out-cfg").textContent||"{}");
var bar=document.getElementById("out-bar"),dlg=document.getElementById("out-dlg"),timer=null,seq=0,last=null;
var start=new URLSearchParams(new FormData(f)).toString();
function esc(t){var d=document.createElement("div");d.textContent=String(t);return d.innerHTML;}
function fmt(s,o){return s.replace(/\\{(\\w+)\\}/g,function(_,k){return o[k];});}
function num(x){return Number(x).toLocaleString("hu-HU");}
function check(){
  var my=++seq;
  fetch("/countries/dispatch/check",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(new FormData(f)).toString(),credentials:"same-origin"})
   .then(function(r){return r.ok?r.json():null;}).then(function(j){
    if(!j||my!==seq)return;last=j;
    Array.prototype.forEach.call(f.querySelectorAll("[data-err]"),function(p){p.textContent=(j.errors||{})[p.getAttribute("data-err")]||"";});
    document.getElementById("out-k-total").querySelector("b").textContent=num(j.count.total);
    document.getElementById("out-k-day").querySelector("b").textContent=num(j.dailyCap);
    document.getElementById("out-k-first").querySelector("b").textContent=j.firstDay||"\\u2014";
    document.getElementById("out-k-days").querySelector("b").textContent=j.days==null?"\\u2014":num(j.days);
    document.getElementById("out-split").textContent=fmt(cfg.split,{own:num(j.count.own),town:num(j.count.town)});
    var n=(j.changes||[]).length;bar.hidden=n===0&&new URLSearchParams(new FormData(f)).toString()===start;
    document.getElementById("out-dirty").textContent=fmt(cfg.dirty,{n:n});
  }).catch(function(){});
}
function schedule(){clearTimeout(timer);timer=setTimeout(check,250);
  var m=f.querySelector('[name="minOwnPhotos"]').value;Array.prototype.forEach.call(f.querySelectorAll("[data-n]"),function(b){b.textContent=m;});
  var mob=Array.prototype.some.call(f.querySelectorAll('[name="channels"]:checked'),function(c){return c.value!=="email";});
  document.getElementById("out-mobwarn").hidden=!mob;
  document.getElementById("out-nowarn").hidden=!(f.querySelector('[name="nonOpenerOn"]').checked&&Number(f.querySelector('[name="nonOpenerCap"]').value)===0);
}
f.addEventListener("input",schedule);f.addEventListener("change",schedule);
f.addEventListener("click",function(ev){
  var b=ev.target.closest("[data-up],[data-down]");if(!b)return;ev.preventDefault();
  var li=b.closest("li"),ul=li.parentNode;
  if(b.hasAttribute("data-up")&&li.previousElementSibling)ul.insertBefore(li,li.previousElementSibling);
  else if(b.hasAttribute("data-down")&&li.nextElementSibling)ul.insertBefore(li.nextElementSibling,li);
  schedule();
});
document.getElementById("out-review").addEventListener("click",function(){
  var j=last;var b=document.getElementById("out-dlg-b");
  if(!j){check();return;}
  var errs=Object.keys(j.errors||{}).length;
  var h='<ul class="hub-dlg__k"><li>'+esc(fmt(cfg.nowThen,{now:num(j.countNow.total),next:num(j.count.total)}))+'</li><li>'+esc(fmt(cfg.split,{own:num(j.count.own),town:num(j.count.town)}))+'</li><li>'+esc(fmt(cfg.perDay,{n:num(j.dailyCap)}))+'</li><li>'+esc(fmt(cfg.first,{d:j.firstDay||"\\u2014"}))+'</li><li>'+esc(fmt(cfg.lasts,{n:j.days==null?"\\u2014":num(j.days)}))+'</li></ul><p class="cty-small cty-mut">'+esc(cfg.gates)+'</p>';
  h+='<h4>'+esc(cfg.changes)+'</h4>';
  h+=(j.changes||[]).length?'<table class="hub-dlg__t"><thead><tr><th></th><th>'+esc(cfg.nowCol)+'</th><th>'+esc(cfg.newCol)+'</th></tr></thead><tbody>'+j.changes.map(function(c){return "<tr><td>"+esc(c.label)+"</td><td>"+esc(c.from)+"</td><td><b>"+esc(c.to)+"</b></td></tr>";}).join("")+"</tbody></table>":"<p>"+esc(cfg.none)+"</p>";
  if(errs)h+='<p class="cty-notice cty-notice--bad">'+esc(cfg.errs)+'</p>';
  b.innerHTML=h;document.getElementById("out-save").disabled=errs>0||!(j.changes||[]).length;
  if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","");
});
document.getElementById("out-dlg-x").addEventListener("click",function(){if(dlg.close)dlg.close();else dlg.removeAttribute("open");});
f.addEventListener("submit",function(){start=new URLSearchParams(new FormData(f)).toString();});
window.addEventListener("beforeunload",function(ev){if(!bar.hidden){ev.preventDefault();ev.returnValue="";}});
})();`;

// ── page style: tokens only (ADR-0021 ①) ───────────────────────────────────────────────────────
const HUB_CSS = `
.hub-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}
.hub-kpi{background:var(--citui-panel);border:1px solid var(--citui-line);border-radius:var(--citui-radius);padding:10px 12px;box-shadow:var(--citui-shadow-sm)}
.hub-kpi b{display:block;font:700 20px/1.2 var(--citui-font-display);color:var(--citui-ink)}
.hub-kpi b small{font-size:13px;color:var(--citui-muted);font-weight:600}
.hub-kpi span{font-size:12px;color:var(--citui-muted)}
.hub-tablewrap{overflow-x:auto}
.hub-table td,.hub-table th{text-align:left;padding-left:8px;padding-right:8px}
.hub-table th{white-space:normal}
.hub a.cty-card,.hub a.cty-card .hub-kv span{color:var(--citui-ink)}
.hub a.cty-card .hub-kv--n span{color:var(--citui-muted)}
.hub-table .hub-num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.hub-table th:nth-child(n+7){text-align:right}
.hub-cl{text-decoration:none}
.hub-run{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;white-space:nowrap}
.hub-run i{width:8px;height:8px;border-radius:50%;background:var(--citui-line-strong)}
.hub-run--run i{background:var(--citui-ok)} .hub-run--stop i{background:var(--citui-warn)}
.hub-run--none{color:var(--citui-muted)}
.cty-tag--info{background:var(--citui-accent-soft);color:var(--citui-ink);border-color:transparent}
.hub-note{font-size:12.5px;color:var(--citui-muted);margin:10px 0 0}
.hub-kv{display:flex;flex-wrap:wrap;gap:4px 12px;margin:8px 0 0;font-size:12.5px}
.hub-kv--n{color:var(--citui-muted)} .hub-kv--n b{color:var(--citui-ink)}
.hub-crumb{margin:0 0 6px;font-size:13px}
.hub-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin:0 0 10px}
.hub-h h2{margin:0;display:flex;align-items:center;gap:8px}
.hub-tabs{display:flex;gap:4px;border-bottom:1px solid var(--citui-line);margin:0 0 14px;overflow-x:auto}
.hub-tab{padding:9px 14px;font-weight:600;font-size:14px;color:var(--citui-muted);text-decoration:none;border-bottom:2px solid transparent;white-space:nowrap}
.hub-tab[aria-current="page"]{color:var(--citui-ink);border-bottom-color:var(--citui-cyan-500)}
.hub-tab:hover{color:var(--citui-ink)}
.hub-two{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:12px;margin:0 0 12px;align-items:start}
.hub-card{padding:14px 16px;margin:0 0 12px}
.hub-two .hub-card{margin:0}
.hub-card h3{font:600 15px/1.3 var(--citui-font-display);margin:0 0 8px}
.hub-card__h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 8px}
.hub-card__h h3{margin:0}
.hub-facts{grid-template-columns:max-content 1fr}
.hub-who{display:block;margin-top:4px;font-size:12.5px;color:var(--citui-ink)}
.cty-rd__i--na .cty-rd__ic{color:var(--citui-line-strong)}
.hub-out{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.hub-out .hub-card{margin:0}
.hub-dec{font-size:12.5px;color:var(--citui-muted);margin:8px 0 0;border-top:1px dashed var(--citui-line);padding-top:8px}
.hub-radios{display:grid;gap:6px;margin:0 0 6px}
.hub-radio{display:flex;gap:8px;align-items:flex-start;font-size:13.5px}
.hub-ch{margin:0;padding-left:20px;font-size:13.5px;line-height:1.8}
.hub-off{color:var(--citui-muted)}
.hub-rules{list-style:none;margin:0;padding:0;font-size:13px;line-height:1.7}
.hub-rules li{display:flex;gap:6px;align-items:center}
.hub-rules svg{display:inline-block;flex:none;color:var(--citui-ok)}
.hub-big{margin:0 0 6px;font-size:13.5px} .hub-big b{font:700 18px var(--citui-font-display)}
.cty-notice--info{background:var(--citui-accent-soft);color:var(--citui-ink);font-weight:500}
.cty-notice--warn{background:color-mix(in srgb,var(--citui-warn) 18%,var(--citui-panel));color:var(--citui-warn-ink);font-weight:500}
.hub-inl{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13.5px;margin:4px 0}
.hub-num-in{width:72px;padding:5px 8px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-sm);background:var(--citui-field);color:var(--citui-ink)}
.hub-chk{display:inline-flex;gap:8px;align-items:center;font-size:13.5px;margin:3px 0}
.hub-chk--day{margin-right:6px}
.hub-wd{display:flex;flex-wrap:wrap;gap:2px 4px;margin:0 0 6px}
.hub-sub{font-size:12.5px;color:var(--citui-muted);margin:10px 0 4px}
.hub-ordlist{margin:0;padding-left:22px;font-size:13.5px}
.hub-ordlist li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 0}
.hub-ord{display:inline-flex;gap:4px}
.hub-ord .cty-btn{min-width:30px;padding:2px 6px}
.hub-savebar{position:sticky;bottom:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;margin:12px 0 0;padding:10px 14px;background:var(--citui-panel);border:1px solid var(--citui-line);border-radius:var(--citui-radius);box-shadow:var(--citui-shadow-sm)}
.hub-savebar[hidden]{display:none}
.hub-savebar #out-dirty{margin-right:auto;font-weight:600;font-size:13.5px}
.hub-dlg{max-width:min(640px,94vw);border:1px solid var(--citui-line);border-radius:var(--citui-radius);padding:16px 18px;background:var(--citui-panel);color:var(--citui-ink)}
.hub-dlg::backdrop{background:color-mix(in srgb,var(--citui-navy-950) 45%,transparent)}
.hub-dlg h3{margin:0 0 8px;font:600 16px var(--citui-font-display)}
.hub-dlg h4{margin:12px 0 6px;font-size:13.5px}
.hub-dlg__k{margin:0;padding-left:18px;font-size:13.5px;line-height:1.6}
.hub-dlg__t{width:100%;border-collapse:collapse;font-size:13px}
.hub-dlg__t th,.hub-dlg__t td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--citui-line)}
.hub-dlg__f{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
@container cty (max-width:760px){
  .hub-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .hub-two,.hub-out{grid-template-columns:minmax(0,1fr)}
  .hub-facts{grid-template-columns:1fr}
}`;
