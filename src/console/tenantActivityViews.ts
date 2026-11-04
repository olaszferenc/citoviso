// Tenant activity + site visits — the VIEWS. Frozen plan: assets/design-refs/console/tenant-aktivitas/
// (owner decision 2026-11-04: 1A = the partner sheet's two-column block, 2A = the Riport ›
// Tenantok table). Data: tenantActivityData.ts. Only already-measured data is shown; what is
// not measured (country, UTM, sub-page, phone/e-mail click) is SAID, not drawn.
//
// The page works without JS: filters and sorting are links; the only script opens a table
// row's detail line (the same text is reachable through the partner link, and mobile uses
// <details> cards).

import { esc, layout } from "./views.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import { APP_TZ, partsIn } from "../text/zoneTime.js";
import { reportTabs } from "./reportViews.js";
import type { SourceGroup } from "../analytics/referrerGroup.js";
import type { OwnerEvent, TenantActivity, TenantVerdict } from "./tenantActivityData.js";

const DAY = 86_400_000;

function fmtAt(d: Date): string {
  const p = partsIn(d, APP_TZ);
  return `${p.month}. ${p.day}. ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
function fmtDay(d: Date): string {
  const p = partsIn(d, APP_TZ);
  return `${p.month}. ${p.day}.`;
}
const isoShort = (iso: string): string => `${Number(iso.slice(5, 7))}. ${Number(iso.slice(8, 10))}.`;

export const SOURCE_LABEL = (lang: string): Record<SourceGroup, string> => ({
  direct: T(lang, "közvetlen / ismeretlen"),
  google: T(lang, "Google"),
  bing: T(lang, "Bing"),
  search_other: T(lang, "egyéb kereső"),
  social: T(lang, "Facebook / Instagram / közösségi"),
  portal: T(lang, "szállásportál"),
  mail: T(lang, "e-mail / levelezőapp"),
  self: T(lang, "az oldalon belül"),
  ours: T(lang, "admin / konzol (saját)"),
  other: T(lang, "egyéb weboldal"),
});

const VERDICT = (lang: string): Record<TenantVerdict, { cls: string; label: string }> => ({
  sleeping: { cls: "rp-pill--bad", label: T(lang, "Alvó") },
  not_logged_in: { cls: "rp-pill--warn", label: T(lang, "Még nem lépett be") },
  new: { cls: "rp-pill--ok", label: T(lang, "Új") },
  active: { cls: "rp-pill--ok", label: T(lang, "Aktív") },
  ended: { cls: "", label: T(lang, "Lezárult") },
  test: { cls: "", label: T(lang, "Teszt") },
});

const SAVE_AREA = (lang: string): Record<string, string> => ({
  szovegek: T(lang, "Szövegek"),
  fotok: T(lang, "Fotók"),
  elerhetoseg: T(lang, "Elérhetőség"),
  modulok: T(lang, "Modulok"),
  foglalasok: T(lang, "Foglalások"),
});

export function kindLabel(a: TenantActivity, lang: string, now = new Date()): string {
  const base =
    a.kind === "paying"
      ? T(lang, "Fizető")
      : a.kind === "trial"
        ? a.trialStartedAt
          ? T(lang, "Próba · {n}. nap / 14", { n: Math.floor((now.getTime() - a.trialStartedAt.getTime()) / DAY) + 1 })
          : T(lang, "Próba")
        : a.kind === "lapsed"
          ? T(lang, "Lejárt / megszűnt")
          : T(lang, "Próba és előfizetés nélkül");
  return a.isTest ? `${base} · ${T(lang, "teszt")}` : base;
}

function pill(v: TenantVerdict, lang: string): string {
  const x = VERDICT(lang)[v];
  return `<span class="rp-pill ${x.cls}"><i></i>${esc(x.label)}</span>`;
}

/** One sentence: WHY the tenant has its verdict. */
export function verdictReason(a: TenantActivity, lang: string, now = new Date()): string {
  const quiet = a.owner.lastLifeAt ? Math.floor((now.getTime() - a.owner.lastLifeAt.getTime()) / DAY) : null;
  switch (a.verdict) {
    case "sleeping":
      return a.owner.lastLoginAt
        ? T(lang, "{n} napja nincs belépés vagy mentés.", { n: quiet ?? 0 })
        : T(lang, "{n} napja indult, és még nem lépett be.", { n: a.ageDays });
    case "not_logged_in":
      return T(lang, "Friss ({n} napos), még nem lépett be.", { n: a.ageDays });
    case "new":
      return T(lang, "Friss ({n} napos), már belépett.", { n: a.ageDays });
    case "active":
      return quiet !== null && quiet > 0 ? T(lang, "Utolsó életjel {n} napja.", { n: quiet }) : T(lang, "Ma dolgozott rajta.");
    case "ended":
      return T(lang, "A próba vagy az előfizetés lezárult.");
    case "test":
      return T(lang, "Teszt-tenant — az összesítő alapból kihagyja.");
  }
}

function eventText(e: OwnerEvent, lang: string): string {
  switch (e.kind) {
    case "login":
      return e.detail === "link"
        ? T(lang, "Belépett (egyszeri link)")
        : e.detail === "password"
          ? T(lang, "Belépett (jelszó)")
          : T(lang, "Belépett");
    case "admin_open":
      return T(lang, "Megnyitotta az admint");
    case "save":
      return e.detail ? T(lang, "Mentett — {area}", { area: SAVE_AREA(lang)[e.detail] ?? e.detail }) : T(lang, "Mentett");
    case "site_view":
      return T(lang, "Megnyitotta a saját oldalát az adminból");
    case "order_open":
      return T(lang, "Megnyitotta a Megrendelem utat");
    case "checkout":
      return T(lang, "Rendelés-lépés: {step}", { step: e.detail ?? "–" });
    case "credentials":
      return T(lang, "Kiment a belépő levél");
    case "trial_start":
      return T(lang, "Próba indult");
    case "trial_converted":
      return T(lang, "Megrendelte a próbából");
    case "trial_lapsed":
      return T(lang, "A próba lejárt");
    case "subscribed":
      return T(lang, "Előfizetés indult");
  }
}

/** The verdict sentence at the top of the block. */
function summary(a: TenantActivity, lang: string): string {
  const o = a.owner;
  const v = a.visitors;
  const owner = o.logins30
    ? T(lang, "A tulaj 30 nap alatt {n}× lépett be (utoljára {d}).", { n: o.logins30, d: fmtAt(o.lastLoginAt ?? new Date()) })
    : o.lastLoginAt
      ? T(lang, "A tulaj utoljára {d} lépett be.", { d: fmtAt(o.lastLoginAt) })
      : T(lang, "A tulaj még nem lépett be.");
  const save = o.lastSave
    ? T(lang, "Utoljára {d} mentett.", { d: fmtAt(o.lastSave.at) })
    : T(lang, "Mentése még nincs.");
  const guests = v.v30
    ? v.mainSource
      ? T(lang, "Az élő oldalt 30 nap alatt {v} vendég nézte meg ({n} megnyitás), főleg innen: {src}.", {
          v: v.v30,
          n: v.views30,
          src: SOURCE_LABEL(lang)[v.mainSource],
        })
      : T(lang, "Az élő oldalt 30 nap alatt {v} vendég nézte meg ({n} megnyitás).", { v: v.v30, n: v.views30 })
    : T(lang, "Az élő oldalt 30 nap alatt vendég nem nyitotta meg.");
  const own = v.ownViews30 ? ` ${T(lang, "A tulaj és az operátor saját megnyitása ({n}) nem számít bele.", { n: v.ownViews30 })}` : "";
  return `<b>${esc(owner)}</b> ${esc(save)} ${esc(guests)}<span class="mut">${esc(own)}</span>`;
}

function chart(a: TenantActivity, lang: string): string {
  const d = a.visitors.daily;
  const W = 600;
  const H = 56;
  const max = Math.max(1, ...d.map((x) => x.n));
  const bw = W / d.length;
  const bars = d
    .map((x, i) => {
      const h = (x.n / max) * (H - 6);
      return (
        `<rect class="ta-chart__base" x="${(i * bw + 1).toFixed(1)}" y="${H - 1}" width="${(bw - 2).toFixed(1)}" height="1"/>` +
        (x.n
          ? `<rect class="ta-chart__bar" x="${(i * bw + 1).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="1"><title>${esc(isoShort(x.day))}: ${x.n}</title></rect>`
          : "")
      );
    })
    .join("");
  const mid = d[Math.floor(d.length / 2)]!;
  return (
    `<svg class="ta-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(T(lang, "Vendégek naponta, 30 nap"))}">${bars}</svg>` +
    `<div class="ta-axis"><span>${esc(isoShort(d[0]!.day))}</span><span>${esc(isoShort(mid.day))}</span><span>${esc(T(lang, "ma"))}</span></div>`
  );
}

function hbars(rows: readonly [string, number][], lang: string): string {
  if (!rows.length) return `<p class="ta-empty">${esc(T(lang, "Nincs vendég-megnyitás az elmúlt 30 napban."))}</p>`;
  const max = Math.max(...rows.map((r) => r[1]));
  return rows
    .map(
      ([l, n]) =>
        `<div class="ta-hb"><span>${esc(l)}</span><span class="ta-hb__tr"><span class="ta-hb__fi" style="width:${max ? Math.max(2, Math.round((n / max) * 100)) : 0}%"></span></span><span class="ta-hb__n">${n}</span></div>`,
    )
    .join("");
}

const FOOTNOTE = (lang: string): string =>
  T(
    lang,
    "Látogató = napi lenyomat (IP + böngésző napi sóval, IP nélkül tárolva), botok nélkül; ha egy lenyomat aznap a tenant-adminból vagy a konzolból érkezett, az aznapi megnyitásai a tulajéi/operátoréi, nem számítanak. Ha a tulaj beírja a címet, azt nem tudjuk kiszűrni. Csak a főoldal megnyitását mérjük; ország, UTM, aloldal és telefon-/e-mail-kattintás nincs mérve. Alvó = fizetőnél 14 napja, próbánál 5 napja nincs belépés vagy mentés, vagy 3 nap után sem lépett be.",
  );

/** The partner sheet's block (frozen plan 1A). */
export function tenantActivityBlock(a: TenantActivity, now = new Date()): string {
  const lang = consoleLang();
  const o = a.owner;
  const v = a.visitors;
  const kbox = (t: string, val: string, sub: string): string =>
    `<div class="con-kbox"><div class="con-kbox__t">${esc(t)}</div><div class="con-kbox__r"><span class="con-kbox__v">${esc(val)}</span></div><div class="con-kbox__s">${esc(sub)}</div></div>`;
  const kpis =
    `<div class="con-kstrip ta-kstrip">` +
    kbox(T(lang, "Belépés 7 / 30 nap"), `${o.logins7} / ${o.logins30}`, o.lastLoginAt ? T(lang, "utolsó: {d}", { d: fmtAt(o.lastLoginAt) }) : T(lang, "még soha")) +
    kbox(
      T(lang, "Utolsó mentés"),
      o.lastSave ? fmtDay(o.lastSave.at) : T(lang, "nincs"),
      o.lastSave?.area ? (SAVE_AREA(lang)[o.lastSave.area] ?? o.lastSave.area) : T(lang, "a mentések naplója 10. 27. óta él"),
    ) +
    kbox(T(lang, "Látogató 7 / 30 nap"), `${v.v7} / ${v.v30}`, T(lang, "botok és saját megnyitás nélkül")) +
    kbox(T(lang, "Érdeklődés 30 nap"), String(a.enquiries30), T(lang, "érdeklődés + foglalási kérés")) +
    `</div>`;
  const events = o.events.length
    ? `<ul class="ta-ev">${o.events.map((e) => `<li><time>${esc(fmtAt(e.at))}</time><span>${esc(eventText(e, lang))}</span></li>`).join("")}</ul>`
    : `<p class="ta-empty">${esc(T(lang, "Még nincs rögzített esemény."))}</p>`;
  const src = SOURCE_LABEL(lang);
  const right =
    `<h3 class="ta-h3">${esc(T(lang, "Vendégek naponta (30 nap)"))}</h3>${chart(a, lang)}` +
    `<h3 class="ta-h3">${esc(T(lang, "Honnan jönnek (a küldő oldal szerint)"))}</h3>${hbars(v.sources.map((s) => [src[s.group], s.views]), lang)}` +
    `<p class="ta-note">${esc(v.mobilePct === null ? T(lang, "Eszköz: nincs adat.") : T(lang, "Telefonról: {p}%", { p: v.mobilePct }))}</p>`;
  return (
    `<section class="ta-block">` +
    `<div class="ta-head"><span class="ta-kind">${esc(kindLabel(a, lang, now))}</span>${pill(a.verdict, lang)}</div>` +
    `<p class="ta-sum">${summary(a, lang)}</p>` +
    kpis +
    `<div class="ta-cols"><div><h3 class="ta-h3">${esc(T(lang, "A tulaj — utolsó események"))}</h3>${events}</div><div>${right}</div></div>` +
    `<p class="ta-foot">${esc(FOOTNOTE(lang))}</p>` +
    `</section>`
  );
}

// ── Riport › Tenantok (frozen plan 2A) ────────────────────────────────────────

export const TENANT_FILTERS = ["active", "paying", "trial", "sleeping", "all"] as const;
export type TenantFilter = (typeof TENANT_FILTERS)[number];
export const TENANT_SORTS = ["flag", "name", "logins", "save", "visitors", "source", "enquiries"] as const;
export type TenantSort = (typeof TENANT_SORTS)[number];

export interface TenantReportQuery {
  readonly f: TenantFilter;
  readonly test: boolean;
  readonly sort: TenantSort;
  readonly desc: boolean;
}

const FLAG_ORDER: Record<TenantVerdict, number> = { sleeping: 0, not_logged_in: 1, new: 2, active: 3, ended: 4, test: 5 };

/** Filter + sort, pure (the check pins it). */
export function selectTenantRows(all: readonly TenantActivity[], q: TenantReportQuery): TenantActivity[] {
  let r = all.filter((a) => q.test || !a.isTest);
  if (q.f === "active") r = r.filter((a) => a.kind === "paying" || a.kind === "trial");
  if (q.f === "paying") r = r.filter((a) => a.kind === "paying");
  if (q.f === "trial") r = r.filter((a) => a.kind === "trial");
  if (q.f === "sleeping") r = r.filter((a) => a.verdict === "sleeping");
  const key = (a: TenantActivity): number | string => {
    switch (q.sort) {
      case "flag":
        return FLAG_ORDER[a.verdict];
      case "name":
        return a.name.toLocaleLowerCase("hu");
      case "logins":
        return a.owner.logins30 * 1000 + a.owner.logins7;
      case "save":
        return a.owner.lastSave?.at.getTime() ?? 0;
      case "visitors":
        return a.visitors.v30 * 1000 + a.visitors.v7;
      case "source":
        return a.visitors.mainSource ?? "~";
      case "enquiries":
        return a.enquiries30;
    }
  };
  const dir = q.desc ? -1 : 1;
  return [...r].sort((x, y) => {
    const a = key(x);
    const b = key(y);
    const c = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "hu");
    return c * dir || x.name.localeCompare(y.name, "hu");
  });
}

function reportHref(q: TenantReportQuery, over: Partial<TenantReportQuery> = {}): string {
  const n = { ...q, ...over };
  const p = new URLSearchParams();
  if (n.f !== "active") p.set("f", n.f);
  if (n.test) p.set("test", "1");
  if (n.sort !== "flag") p.set("sort", n.sort);
  if (n.desc) p.set("dir", "desc");
  const s = p.toString();
  return `/report/tenants${s ? `?${s}` : ""}`;
}

function spark(days: readonly { n: number }[]): string {
  const last = days.slice(-7);
  const m = Math.max(1, ...last.map((d) => d.n));
  return (
    `<svg class="ta-spk" width="56" height="16" viewBox="0 0 56 16" aria-hidden="true">` +
    last
      .map((d, i) => {
        const h = Math.max(1, (d.n / m) * 14);
        return `<rect class="${d.n ? "ta-chart__bar" : "ta-chart__base"}" x="${i * 8}" y="${(16 - h).toFixed(1)}" width="6" height="${h.toFixed(1)}" rx="1"/>`;
      })
      .join("") +
    `</svg>`
  );
}

export function reportTenantsPage(all: readonly TenantActivity[], q: TenantReportQuery, now = new Date()): string {
  const lang = consoleLang();
  const rows = selectTenantRows(all, q);
  const tabs = reportTabs("/report/tenants", "", "", lang);
  const FL: Record<TenantFilter, string> = {
    active: T(lang, "Aktív"),
    paying: T(lang, "Fizető"),
    trial: T(lang, "Próba"),
    sleeping: T(lang, "Alvó"),
    all: T(lang, "Mind"),
  };
  const chips = TENANT_FILTERS.map((f) => `<a href="${esc(reportHref(q, { f }))}"${f === q.f ? ' class="on"' : ""}>${esc(FL[f])}</a>`).join("");
  const filter =
    `<div class="rp-filt">` +
    `<div class="rp-chips" role="group" aria-label="${esc(T(lang, "Állapot"))}">${chips}</div>` +
    `<a class="ta-testtoggle" href="${esc(reportHref(q, { test: !q.test }))}" role="checkbox" aria-checked="${q.test}"><span class="ta-box${q.test ? " on" : ""}"></span>${esc(T(lang, "teszt-tenantok is"))}</a>` +
    `<span class="rp-filt__n">${esc(T(lang, "{n} tenant", { n: rows.length }))}${q.test ? "" : ` · ${esc(T(lang, "teszt nélkül"))}`}</span>` +
    `</div>`;

  const scope = all.filter((a) => q.test || !a.isTest);
  const act = scope.filter((a) => a.kind === "paying" || a.kind === "trial");
  const kbox = (t: string, v: string, sub: string, cls = ""): string =>
    `<div class="con-kbox${cls}"><div class="con-kbox__t">${esc(t)}</div><div class="con-kbox__r"><span class="con-kbox__v">${esc(v)}</span></div><div class="con-kbox__s">${esc(sub)}</div></div>`;
  const sleeping = act.filter((a) => a.verdict === "sleeping").length;
  const kpis =
    `<div class="con-kstrip ta-kstrip">` +
    kbox(
      T(lang, "Aktív tenant"),
      String(act.length),
      T(lang, "{p} fizető · {t} próba", { p: act.filter((a) => a.kind === "paying").length, t: act.filter((a) => a.kind === "trial").length }),
    ) +
    kbox(T(lang, "Belépett 7 napja"), `${act.filter((a) => a.owner.logins7 > 0).length} / ${act.length}`, T(lang, "legalább egyszer")) +
    kbox(T(lang, "Alvó"), String(sleeping), T(lang, "rá kell nézni / írni neki"), sleeping ? " con-kbox--bad" : "") +
    kbox(
      T(lang, "Látogató · érdeklődés 30 nap"),
      `${rows.reduce((s, a) => s + a.visitors.v30, 0)} · ${rows.reduce((s, a) => s + a.enquiries30, 0)}`,
      T(lang, "a listázott tenantok, botok és saját megnyitás nélkül"),
    ) +
    `</div>`;

  const src = SOURCE_LABEL(lang);
  const COLS: [TenantSort, string, boolean][] = [
    ["name", T(lang, "Tenant"), false],
    ["logins", T(lang, "Belépés 7/30"), true],
    ["save", T(lang, "Utolsó mentés"), false],
    ["visitors", T(lang, "Látogató 7/30"), true],
    ["source", T(lang, "Fő forrás"), false],
    ["enquiries", T(lang, "Érdeklődés 30 nap"), true],
    ["flag", T(lang, "Jelzés"), false],
  ];
  const th = COLS.map(([k, l, num]) => {
    const on = q.sort === k;
    // First click: numbers high → low, text A → Z; a second click flips it.
    const nextDesc = on ? !q.desc : num;
    return `<th class="${num ? "num" : ""}"><a href="${esc(reportHref(q, { sort: k, desc: nextDesc }))}">${esc(l)}${on ? ` <span aria-hidden="true">${q.desc ? "▼" : "▲"}</span>` : ""}</a></th>`;
  }).join("");
  const partnerLink = (a: TenantActivity): string =>
    a.partnerId ? ` · <a href="/partner/${esc(a.partnerId)}?tab=usage">${esc(T(lang, "a partner-adatlap aktivitás-blokkja →"))}</a>` : "";
  const lastEv = (a: TenantActivity): string => {
    const e = a.owner.events[0];
    return e ? T(lang, "Utolsó esemény: {d} — {t}", { d: fmtAt(e.at), t: eventText(e, lang) }) : T(lang, "Még nincs rögzített esemény.");
  };
  const body = rows
    .map((a) => {
      const id = `ta-d-${a.tenantId.slice(0, 8)}`;
      return (
        `<tr class="ta-row" data-ta-toggle="${id}" tabindex="0" aria-expanded="false">` +
        `<td><div class="ta-nm">${esc(a.name)}</div><div class="ta-st">${esc(kindLabel(a, lang, now))}</div></td>` +
        `<td class="num">${a.owner.logins7} / ${a.owner.logins30}<div class="ta-st">${esc(a.owner.lastLoginAt ? T(lang, "utolsó {d}", { d: fmtDay(a.owner.lastLoginAt) }) : T(lang, "soha"))}</div></td>` +
        `<td>${a.owner.lastSave ? esc(fmtDay(a.owner.lastSave.at)) : `<span class="mut">${esc(T(lang, "nincs"))}</span>`}</td>` +
        `<td class="num">${a.visitors.v7} / ${a.visitors.v30}${spark(a.visitors.daily)}</td>` +
        `<td>${a.visitors.mainSource ? esc(src[a.visitors.mainSource]) : `<span class="mut">—</span>`}</td>` +
        `<td class="num">${a.enquiries30}</td>` +
        `<td>${pill(a.verdict, lang)}</td></tr>` +
        `<tr class="ta-det" id="${id}" hidden><td colspan="7"><b>${esc(verdictReason(a, lang, now))}</b> ${esc(lastEv(a))}${partnerLink(a)}</td></tr>`
      );
    })
    .join("");
  const cards = rows
    .map(
      (a) =>
        `<details class="ta-card"><summary><span class="ta-card__top"><span><span class="ta-nm">${esc(a.name)}</span><span class="ta-st">${esc(kindLabel(a, lang, now))}</span></span>${pill(a.verdict, lang)}</span>` +
        `<span class="ta-card__why">${esc(verdictReason(a, lang, now))}</span>` +
        `<span class="ta-card__nums"><span>${esc(T(lang, "Belépés"))} <b>${a.owner.logins7}/${a.owner.logins30}</b></span><span>${esc(T(lang, "Mentés"))} <b>${esc(a.owner.lastSave ? fmtDay(a.owner.lastSave.at) : T(lang, "nincs"))}</b></span><span>${esc(T(lang, "Látogató"))} <b>${a.visitors.v7}/${a.visitors.v30}</b>${spark(a.visitors.daily)}</span><span>${esc(T(lang, "Forrás"))} <b>${esc(a.visitors.mainSource ? src[a.visitors.mainSource] : "—")}</b></span><span>${esc(T(lang, "Érdeklődés"))} <b>${a.enquiries30}</b></span></span>` +
        `</summary><p class="ta-card__more">${esc(lastEv(a))}${partnerLink(a)}</p></details>`,
    )
    .join("");
  const empty = `<p class="mut">${esc(T(lang, "Nincs ilyen tenant."))}</p>`;
  const panel =
    `<div class="panel"><h2>${esc(T(lang, "Tenantok aktivitása és látogatottsága"))} <span class="rp-q">— ${esc(T(lang, "minden tenant egy sorban; kattints egy sorra a részletért"))}</span></h2>` +
    `<div class="ta-tblwrap"><table class="rp-tbl ta-tbl"><thead><tr>${th}</tr></thead><tbody>${body || `<tr><td colspan="7">${empty}</td></tr>`}</tbody></table></div>` +
    `<div class="ta-cards">${cards || empty}</div>` +
    `</div>` +
    `<p class="ta-foot">${esc(FOOTNOTE(lang))}</p>`;
  const js =
    `<script>document.querySelectorAll("[data-ta-toggle]").forEach(function(r){function t(){var d=document.getElementById(r.getAttribute("data-ta-toggle"));if(!d)return;d.hidden=!d.hidden;r.setAttribute("aria-expanded",String(!d.hidden));}` +
    `r.addEventListener("click",function(e){if(e.target.closest("a"))return;t();});r.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();t();}});});</script>`;
  return layout(
    T(lang, "Megkeresés-riport"),
    `<div class="con-ph"><h1>${esc(T(lang, "Megkeresés-riport"))}</h1></div>${tabs}${filter}${kpis}${panel}${js}`,
    { active: "/report/tenants" },
  );
}
