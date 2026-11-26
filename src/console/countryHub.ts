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
    [T(lang, "Csatorna"), out ? out.channels.filter((c) => c.live).map((c) => c.id).join(", ") || "—" : "—"],
    [T(lang, "Kiküldési ablak"), out ? `${out.hours.fromHour}:00–${out.hours.toHour}:00 (${out.timeZone})` : "—"],
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

// ── „Kiküldés” tab (read-only in phase 1) ──────────────────────────────────────────────────────
function decides(lang: string, today: string, decided = false): string {
  return `<p class="hub-dec"><b>${esc(T(lang, "Ma dönt:"))}</b> ${esc(today)} <span class="cty-tag">${esc(T(lang, "országonkénti beállítás lesz"))}</span>${decided ? ` <span class="cty-tag cty-tag--ok">${esc(T(lang, "döntve"))}</span>` : ""}</p>`;
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

export function outreachTab(row: CountryOverviewRow, o: OutreachInfo): string {
  const lang = consoleLang();
  const total = o.eligibleOwn + (o.photoMode === "town" ? o.eligibleFew : 0);
  const days = o.dailyCap > 0 ? Math.ceil(total / o.dailyCap) : null;
  const kpi = (v: string, l: string): string => `<div class="hub-kpi"><b>${v}</b><span>${esc(l)}</span></div>`;
  const mobileLive = o.channels.some((c) => c.live && c.id !== "email");
  const radio = (mode: "own" | "town", label: string): string =>
    `<label class="hub-radio"><input type="radio" name="out-mode" value="${mode}" disabled${o.photoMode === mode ? " checked" : ""}> <span>${esc(label)}</span></label>`;
  const capWhy =
    o.capSource === "setting"
      ? T(lang, "globális beállítás (az automata kiküldés napi kerete, a hazai piacé)")
      : o.capSource === "override"
        ? T(lang, "globális beállítás (az országra külön megadott keret)")
        : T(lang, "az ország sora (napi kvóta)");
  const rules = [
    T(lang, "két mock saját képpel vagy településképpel"),
    T(lang, "településképes mock MMS-ben nem megy"),
    T(lang, "akinek van e-mailje, csak e-mailt kap"),
    T(lang, "ellenőrizetlen mobilú lead e-mailben mehet"),
    T(lang, "e-mail cím nélkül nem küldünk"),
  ];
  return `<p class="cty-notice cty-notice--info" role="status">${esc(T(lang, "Ez a fül egyelőre csak olvasható: a mai valós működést mutatja, és hogy ma mi dönt róla. A szerkesztés a következő lépésben jön."))}</p>
  <div class="hub-kpis" id="out-sum">
    ${kpi(n(total), T(lang, "lead felel meg most"))}
    ${kpi(n(o.dailyCap), T(lang, "megkeresés naponta"))}
    ${kpi(esc(o.firstDay ?? "—"), o.windowOpenNow ? T(lang, "első küldési nap (az ablak most nyitva)") : T(lang, "első küldési nap"))}
    ${kpi(days == null ? "—" : n(days), T(lang, "küldési nap alatt fogy el"))}
  </div>
  <p class="cty-small cty-mut">${esc(T(lang, "A szám a még meg nem keresett, nem tiltott leadekből jön. A mock-, a render- és a minőségi kapu ezen felül szűr, ezért a ténylegesen kimenő szám kisebb lehet."))}</p>
  ${o.dispatchOn ? "" : `<p class="cty-notice cty-notice--bad">${esc(T(lang, "Az automata kiküldés főkapcsolója ki van kapcsolva — most egyik országban sem megy ki megkeresés."))}</p>`}
  <div class="hub-out">
  <div class="cty-panel hub-card" id="out-1"><h3>${esc(T(lang, "1. Milyen lead mehet"))}</h3>
    <div class="hub-radios">
      ${radio("own", T(lang, "Csak saját képes — legalább {n} saját kép; kevesebb képes lead nem megy ki", { n: o.minOwn }))}
      ${radio("town", T(lang, "Saját képes (legalább {n}) + kevés képes is, településképes nyitóképpel", { n: o.minOwn }))}
    </div>
    <p class="cty-small">${esc(T(lang, "ebből saját képpel: {own} · településképpel: {town}", { own: n(o.eligibleOwn), town: n(o.photoMode === "town" ? o.eligibleFew : 0) }))}</p>
    ${decides(lang, T(lang, "a kód ({n} saját kép) és a globális „településképes kiküldés” kapcsoló", { n: o.minOwn }))}
    <dl class="cty-facts"><dt>${esc(T(lang, "MINTA-jelölt szoba- és galériakép"))}</dt><dd>${esc(T(lang, "mehet (6 saját kép alatt)"))}</dd>
      <dt>${esc(T(lang, "Honlap szerinti sorrend"))}</dt><dd>${esc(T(lang, "nincs honlap → elavult → modern → besorolatlan; az e-mailesek elöl"))}</dd></dl>
    ${decides(lang, T(lang, "a kód (render-kapu, kiküldési sorrend)"))}</div>
  <div class="cty-panel hub-card" id="out-2"><h3>${esc(T(lang, "2. Csatornák sorrendben"))}</h3>
    <ol class="hub-ch">${o.channels.map((c) => `<li class="${c.live ? "" : "hub-off"}">${esc(chName(lang, c.id))}${c.live ? "" : ` <span class="cty-tag">${esc(T(lang, "nem él"))}</span>`}</li>`).join("")}</ol>
    ${mobileLive ? `<p class="cty-notice cty-notice--warn">${esc(T(lang, "Mobilcsatorna be van kapcsolva, de az „e-mail cím nélkül nem küldünk” szabály él — mobilon nem indul megkeresés."))}</p>` : ""}
    ${decides(lang, T(lang, "az ország sora (csatornák)"))}</div>
  <div class="cty-panel hub-card" id="out-3"><h3>${esc(T(lang, "3. Napi keret"))}</h3>
    <p class="hub-big"><b>${n(o.dailyCap)}</b> ${esc(T(lang, "megkeresés az ország napján · ma eddig {n}", { n: n(o.sentToday) }))}</p>
    ${o.ramp ? `<p class="cty-small">${esc(T(lang, "Felfutás él: ma legfeljebb {n} megkeresés megy ki az összes országban együtt.", { n: n(o.ramp.capToday) }))}</p>` : ""}
    ${decides(lang, capWhy)}</div>
  <div class="cty-panel hub-card" id="out-4"><h3>${esc(T(lang, "4. Jóváhagyás"))}</h3>
    <p class="hub-big"><b>${esc(T(lang, "Automata"))}</b></p>
    <ul class="hub-rules">${rules.map((r) => `<li>${ICON.check} ${esc(r)}</li>`).join("")}</ul>
    ${decides(lang, T(lang, "az éles gép jóváhagyó szkriptje (auto-approve.mts, a fejlesztőgép ütemezője 20 percenként, hétköznap) — a pipálható szabálylista váltja ki"), true)}</div>
  <div class="cty-panel hub-card" id="out-5"><h3>${esc(T(lang, "5. Időkeret"))}</h3>
    <dl class="cty-facts"><dt>${esc(T(lang, "Napok"))}</dt><dd>${esc(T(lang, "hétfő–péntek"))}</dd>
      <dt>${esc(T(lang, "Órák"))}</dt><dd>${esc(`${o.hours.fromHour}:00–${o.hours.toHour}:00 (${o.timeZone})`)}</dd>
      <dt>${esc(T(lang, "Ünnepnap"))}</dt><dd>${esc(o.holidays ? T(lang, "az ország {n} ünnepnapján nem küldünk", { n: o.holidays }) : T(lang, "nincs felvett ünnepnap"))}</dd></dl>
    ${decides(lang, T(lang, "a kód ({cf}–{ct} óra) és az ország sora ({rf}–{rt} óra) metszete; a napok a kódban", { cf: o.codeHours.fromHour, ct: o.codeHours.toHour, rf: o.rowHours.fromHour, rt: o.rowHours.toHour }), true)}</div>
  <div class="cty-panel hub-card" id="out-6"><h3>${esc(T(lang, "6. Utánkövetés"))}</h3>
    <dl class="cty-facts"><dt>${esc(T(lang, "Nem-nyitó levél"))}</dt><dd>${esc(o.nonOpener.dailyCap > 0
      ? T(lang, "{d} nap után, 1 levél, napi {n}", { d: o.nonOpener.days, n: n(o.nonOpener.dailyCap) })
      : T(lang, "{d} nap után, 1 levél — szünetel (a napi keret 0)", { d: o.nonOpener.days }))}</dd>
      <dt>${esc(T(lang, "Eszkalációs ajánlat e-mailben"))}</dt><dd>${esc(o.escalationFollowup ? T(lang, "be") : T(lang, "ki"))}</dd></dl>
    ${decides(lang, T(lang, "a kód ({d} nap) és két globális beállítás (nem-nyitó napi keret, eszkalációs levél kapcsolója)", { d: o.nonOpener.days }), true)}</div>
  </div>`;
}

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
@container cty (max-width:760px){
  .hub-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .hub-two,.hub-out{grid-template-columns:minmax(0,1fr)}
  .hub-facts{grid-template-columns:1fr}
}`;
