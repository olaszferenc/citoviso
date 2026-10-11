// Árazás és értékesítés — the redesigned page (ADR-0360 ⑦; frozen plan
// assets/design-refs/console/pricing-redesign/, variant A — one page with section jumps).
//
// This file holds the NEW blocks of the page: the head, the market tabs, the overview
// (three summary cards + „Figyelmet kér”), the section jumps, the drag-and-drop packages,
// the module table, the base fee, the own-domain panel with the per-ending table, the
// confirmation and the sticky save bar — plus the ONE script that keeps them live.
// The lead-offer, trial and coupon sections keep their own fields, validation and POST
// names (views.ts); this page only wraps them into panels.
//
// ⛔ The script mirrors the server, it never decides: the POST re-validates the package
// composition (packageAssignmentErrors) and the ending list (tldRowErrors) and writes
// NOTHING when either is wrong.

import { esc, helpLink } from "./views.js";
import { T } from "../i18n/mail.js";
import { huArticleLower } from "../hu.js";
import { formatMoney, formatNumber } from "../text/money.js";
import { consoleLang } from "./i18nCtx.js";
import { GROUP_LABELS, MODULE_CATALOG, MULTILANG_TIERS, applicableRequirements, sellableModuleIds } from "../modules.js";
import { DOMAIN_PSEUDO_MODULE, TIERS, packageableIds, tierModules, type Tier } from "../packages.js";
import { computeMonthly, type PricingSnapshot, type TldRow } from "../pricing.js";

type Lang = ReturnType<typeof consoleLang>;

/** Everything the page needs beyond the region snapshot. */
export interface PricingPageExtras {
  readonly assignment: ReadonlyMap<string, Tier>;
  readonly disabledSales: ReadonlySet<string>;
  readonly liveCounts: ReadonlyMap<string, number>;
  readonly trialPackage: Tier | null;
}

const unitOf = (snap: PricingSnapshot): string =>
  snap.currency === "HUF" ? "Ft" : snap.currency === "EUR" ? "€" : snap.currency;

export function regionLabel(lang: Lang, r: string): string {
  return r === "hu" ? T(lang, "Magyarország") : r === "global" ? T(lang, "Globális") : r;
}

function tierLabel(lang: Lang, t: Tier): string {
  return t === "alap" ? T(lang, "Alap") : t === "ajanlott" ? T(lang, "Ajánlott") : T(lang, "Teljes");
}

/** Page head: title, the one-sentence purpose, the confirmation mark. */
export function pricingHead(lang: Lang, snap: PricingSnapshot, notice: { ok: boolean; text: string } | null): string {
  const conf = snap.pricingConfirmed
    ? `<span class="pill approved pr2-conf" id="pr2-conf">${T(lang, "Véglegesítve — a levelek árat hirdethetnek")}</span>`
    : `<span class="pill outdated pr2-conf" id="pr2-conf">${T(lang, "Nincs véglegesítve — a levél nem hirdet árat")}</span>`;
  return `
    <div class="pr2-head">
      <div>
        <h1 class="pr2-title">${T(lang, "Árazás és értékesítés")} ${helpLink("console.pricing")}</h1>
        <p class="pr2-lead">${T(lang, "Az árazás egyetlen forrása — a konfigurátor, a megrendelés és a levelek ár-sora innen olvas. Mentés után azonnal él (a nyilvános oldal ~10 mp-en belül veszi át).")}</p>
      </div>
      ${conf}
    </div>
    ${notice ? `<div class="pr2-notice ${notice.ok ? "is-ok" : "is-bad"}" role="status">${esc(notice.text)}</div>` : ""}`;
}

/** Market tabs (report tab language). The country layer comes later. */
export function regionTabs(lang: Lang, snap: PricingSnapshot, regions: readonly PricingSnapshot[]): string {
  const tabs = regions
    .map((r) => {
      const on = r.region === snap.region;
      const label = `${esc(regionLabel(lang, r.region))} · ${esc(r.currency)}`;
      return on
        ? `<span class="pr2-tab" aria-current="page">${label}</span>`
        : `<a class="pr2-tab" href="/pricing?region=${encodeURIComponent(r.region)}">${label}</a>`;
    })
    .join("");
  return `<nav class="pr2-tabs" aria-label="${esc(T(lang, "Piac"))}">${tabs}<span class="pr2-tab is-later" title="${esc(T(lang, "Az ország-réteg később jön"))}">${T(lang, "+ Ország")}</span></nav>`;
}

/** The overview: three summary cards + „Figyelmet kér” (both drawn by the script). */
export function overviewBlock(lang: Lang): string {
  return `
    <div class="pr2-wg" id="pr2-wg" aria-live="polite"></div>
    <div class="pr2-att" id="pr2-att">
      <div class="pr2-att__h">${T(lang, "Figyelmet kér")} <span id="pr2-att-n"></span></div>
      <div id="pr2-att-list"></div>
    </div>`;
}

const SECTIONS = (lang: Lang): ReadonlyArray<{ id: string; label: string }> => [
  { id: "pr2-s-pk", label: T(lang, "Csomagok") },
  { id: "pr2-s-mod", label: T(lang, "Modulok") },
  { id: "pr2-s-base", label: T(lang, "Alapdíj") },
  { id: "pr-coupon", label: T(lang, "Kupon") },
  { id: "pr2-s-dom", label: T(lang, "Saját domain") },
  { id: "pr-esc", label: T(lang, "Lead-ajánlatok") },
  { id: "pr-trial", label: T(lang, "Ingyenes próba") },
  { id: "pr2-s-fin", label: T(lang, "Véglegesítés") },
];

/** The sticky section jumps (a dot marks an unsaved section — set by the script). */
export function sectionNav(lang: Lang): string {
  return `<nav class="pr2-snav" id="pr2-snav" aria-label="${esc(T(lang, "Szakaszok"))}">${SECTIONS(lang)
    .map((s) => `<a class="pr2-chip" href="#${s.id}" data-sec="${s.id}">${esc(s.label)}</a>`)
    .join("")}</nav>`;
}

// ADR-0162: one amount, one spelling — the shared formatter, never a local grouping.
const grp3 = (n: number): string => formatNumber(Math.round(n));
const moneyOf = (snap: PricingSnapshot, n: number): string => formatMoney(Math.round(n), snap.currency);

/**
 * The SERVER render of the pool + the three columns — the first paint, and what a guard
 * reads. The script redraws the same markup live (cit-pricing-admin.js renderPackages).
 * ⛔ ADR-0192 ② (module-sales-check ⑤): the price and the „nem eladó” mark come from the
 * SAME closure — a module off sale takes down everything that hard-requires it.
 */
function packagesInitial(lang: Lang, snap: PricingSnapshot, x: PricingPageExtras): string {
  const a = x.assignment;
  const pkgable = packageableIds();
  const allPkg = [...a.keys()].filter((id) => id !== DOMAIN_PSEUDO_MODULE);
  const sellable = new Set(sellableModuleIds(allPkg, x.disabledSales));
  const domOn = snap.domainFreeInPackage;
  const label = (id: string): string =>
    id === DOMAIN_PSEUDO_MODULE ? T(lang, "Saját domain") : (MODULE_CATALOG.find((m) => m.id === id)?.label ?? id);
  const pill = (id: string, o: { inh?: boolean; pool?: boolean } = {}): string => {
    const m = MODULE_CATALOG.find((d) => d.id === id);
    const isDom = id === DOMAIN_PSEUDO_MODULE;
    const stop = !isDom && !m?.spine && !sellable.has(id) && a.has(id);
    const cls = `pr2-pl${isDom ? " is-dom" : ""}${m?.spine ? " is-spine" : ""}${o.inh ? " is-inh" : ""}${stop ? " is-stop" : ""}${isDom && !domOn && o.pool ? " is-off" : ""}`;
    const p = isDom
      ? domOn ? "" : T(lang, "felár")
      : m?.spine ? T(lang, "gerinc") : stop ? T(lang, "nem eladó") : `+${grp3(snap.modulePrices.get(id) ?? 0)}`;
    const xBtn = !o.inh && !o.pool && !m?.spine
      ? `<button class="pr2-x" type="button" data-rm="${esc(id)}" aria-label="${esc(T(lang, "Kivétel: {m}", { m: label(id) }))}">×</button>`
      : "";
    return `<span class="${cls}" data-id="${esc(id)}"${o.inh || m?.spine ? ' data-fixed="1"' : ""}><b>${esc(label(id))}</b>${p ? ` <small>${esc(p)}</small>` : ""}${xBtn}</span>`;
  };
  const outside = pkgable.filter((id) => !a.has(id));
  const cols = TIERS.map((t, i) => {
    const full = tierModules(a, t);
    const price = computeMonthly(full.filter((id) => sellable.has(id) || MODULE_CATALOG.find((m) => m.id === id)?.spine), snap.region);
    const mine = [...a].filter(([, tt]) => tt === t).map(([id]) => id);
    const inh = i ? [...tierModules(a, TIERS[i - 1]!), ...(a.get(DOMAIN_PSEUDO_MODULE) && TIERS.indexOf(a.get(DOMAIN_PSEUDO_MODULE)!) < i ? [DOMAIN_PSEUDO_MODULE] : [])] : [];
    return `<div class="pr2-pk" data-tier="${t}"><div class="pr2-pk__h"><span class="pr2-pk__n">${esc(tierLabel(lang, t))}</span><span class="pr2-pk__p">${esc(moneyOf(snap, price))}<small> ${T(lang, "/hó")}</small></span></div>
      <div class="pr2-pk__lbl">${i ? (i === 1 ? T(lang, "Minden az Alapból") : T(lang, "Minden az Ajánlottból")) : T(lang, "Tartalma")}</div>
      <div class="pr2-chips">${(i ? inh.map((id) => pill(id, { inh: true })) : []).concat(mine.map((id) => pill(id))).join("")}</div></div>`;
  }).join("");
  return `<div class="pr2-pool" id="pr2-pool">
        <div class="pr2-pool__h"><b>${T(lang, "Csomagon kívül")}</b><span>${T(lang, "külön vehető, a felárával")}</span></div>
        <div class="pr2-chips" id="pr2-pool-chips">${outside.map((id) => pill(id, { pool: true })).join("")}</div>
      </div>
      <div class="pr2-cols" id="pr2-cols">${cols}</div>`;
}

/** The packages panel — server-rendered first paint, redrawn live by the script. */
export function packagesPanel(lang: Lang, snap: PricingSnapshot, x: PricingPageExtras): string {
  return `
    <section class="pr2-pn" id="pr2-s-pk">
      <div class="pr2-pn__h"><h2>${T(lang, "Csomagok")}</h2><span class="pr2-sub">— ${T(lang, "húzd a modult a csomagba")}</span></div>
      <p class="pr2-desc">${T(lang, "Amit az alacsonyabb csomag tartalmaz, azt a magasabb is (halvány = öröklött). A csomag ára = alapdíj + a benne lévő modulok felára. Ami egyik csomagban sincs, az csak külön vehető. Ujjal: koppints a pirulára, aztán a csomagra.")}</p>
      <input type="hidden" name="pkg_json" id="pkg_json">
      ${packagesInitial(lang, snap, x)}
      <div class="pr2-toast" id="pr2-pk-msg" role="status" aria-live="polite"></div>
    </section>`;
}

/** The module table — the existing m_<id> / sell_<id> fields, one row per module. */
export function modulesPanel(lang: Lang, snap: PricingSnapshot, x: PricingPageExtras): string {
  if (snap.region !== "hu") {
    return `
    <section class="pr2-pn" id="pr2-s-mod">
      <div class="pr2-pn__h"><h2>${T(lang, "Modulok")}</h2><span class="pr2-sub">— ${T(lang, "felár és értékesítés")}</span></div>
      <p class="pr2-desc">${T(lang, "A modul-felárak jelenleg globálisak (HUF); a")} <a href="/pricing?region=hu">${T(lang, "Magyarország")}</a> ${T(lang, "oldalon szerkeszthetők.")}</p>
    </section>`;
  }
  const rows = (Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[])
    .map((g) => {
      const mods = MODULE_CATALOG.filter((m) => m.group === g && !m.retired);
      if (!mods.length) return "";
      const body = mods
        .map((m) => {
          const live = x.liveCounts.get(m.id) ?? 0;
          const livePill = live ? `<span class="pill approved">${live} ${T(lang, "élő")}</span>` : `<span class="mut">—</span>`;
          if (m.spine)
            return `<tr data-m="${esc(m.id)}"><td class="pr2-full"><b>${esc(m.label)}</b> <span class="mut small">${T(lang, "gerinc — az alapdíjban")}</span></td>
              <td><span class="pr2-lm">${T(lang, "Csomag")}</span><span class="pill" data-tier-of="${esc(m.id)}"></span></td>
              <td class="pr2-num"><span class="pr2-lm">${T(lang, "Élő")}</span>${livePill}</td>
              <td class="pr2-num"><span class="pr2-lm">${T(lang, "Felár")}</span><span class="mut">—</span></td>
              <td><span class="pr2-lm">${T(lang, "Eladó")}</span><span class="mut small">${T(lang, "mindig")}</span></td></tr>`;
          const off = x.disabledSales.has(m.id);
          const price = snap.modulePrices.get(m.id) ?? 0;
          const unit = m.billing === "once" ? T(lang, "Ft / alkalom") : T(lang, "Ft / hó");
          const tierCell = packageableIds().includes(m.id)
            ? `<span class="pill" data-tier-of="${esc(m.id)}"></span>`
            : `<span class="mut small">${T(lang, "csak külön")}</span>`;
          return `<tr data-m="${esc(m.id)}" class="${off ? "is-off" : ""}">
              <td class="pr2-full"><b class="pr2-mname">${esc(m.label)}</b><span class="pr2-why">${T(lang, "Leállítva — új előfizetés nem köthető rá; a meglévők futnak tovább.")}</span></td>
              <td><span class="pr2-lm">${T(lang, "Csomag")}</span>${tierCell}</td>
              <td class="pr2-num"><span class="pr2-lm">${T(lang, "Élő")}</span>${livePill}</td>
              <td class="pr2-num"><span class="pr2-lm">${T(lang, "Felár")}</span><input class="pr2-tin" name="m_${esc(m.id)}" type="number" min="0" step="1" inputmode="numeric" value="${esc(price)}" aria-label="${esc(m.label)}"><span class="pr2-u">${esc(unit)}</span></td>
              <td><span class="pr2-lm">${T(lang, "Eladó")}</span><label class="con-sell"><input type="checkbox" name="sell_${esc(m.id)}"${off ? "" : " checked"} aria-label="${esc(T(lang, "{m} eladó", { m: m.label }))}"><span class="con-sell__track"></span></label></td>
            </tr>${m.id === "multilang" ? multilangRows(lang, snap) : ""}`;
        })
        .join("");
      return `<tr class="pr2-grp"><td colspan="5">${esc(GROUP_LABELS[g])}</td></tr>${body}`;
    })
    .join("");
  return `
    <section class="pr2-pn" id="pr2-s-mod">
      <div class="pr2-pn__h"><h2>${T(lang, "Modulok")}</h2><span class="pr2-sub">— ${T(lang, "felár és értékesítés")}</span></div>
      <p class="pr2-desc">${T(lang, "A kikapcsolt modult új ügyfél nem kapja meg (konfigurátor, kiküldött mock, konverzió) — a meglévő előfizetéseket nem érinti.")}</p>
      <table class="pr2-tb pr2-resp" id="pr2-mods">
        <thead><tr><th>${T(lang, "Modul")}</th><th>${T(lang, "Csomag")}</th><th class="pr2-num">${T(lang, "Élő")}</th><th class="pr2-num">${T(lang, "Felár")}</th><th>${T(lang, "Eladó")}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

/** ADR-0128: the multilang TIER prices (not catalog modules — one module's package sizes). */
function multilangRows(lang: Lang, snap: PricingSnapshot): string {
  return MULTILANG_TIERS.filter((t) => t.priceId !== "multilang")
    .map((t) => {
      const price = snap.modulePrices.get(t.priceId) ?? t.priceDefault;
      const cap = t.cap === null ? T(lang, "mind a nyelv") : T(lang, "legfeljebb {n} nyelv", { n: t.cap });
      return `<tr class="pr2-subrow"><td class="pr2-full"><span class="mut">↳ ${esc(t.name)} — ${esc(cap)}</span></td><td></td><td></td>
        <td class="pr2-num"><span class="pr2-lm">${T(lang, "Felár")}</span><input class="pr2-tin" name="m_${esc(t.priceId)}" type="number" min="0" step="1" inputmode="numeric" value="${esc(price)}" aria-label="${esc(t.name)}"><span class="pr2-u">${T(lang, "Ft / alkalom")}</span></td><td></td></tr>`;
    })
    .join("");
}

/** One priced field (label above, unit inside the field row). */
function field(id: string, name: string, label: string, value: number, unit: string, hint = ""): string {
  return `<div class="pr-field" id="f_${id}">
      <label class="pr-field__l" for="${id}">${esc(label)}</label>
      <div class="pr-input"><input id="${id}" name="${name}" type="number" min="0" step="1" inputmode="numeric" value="${esc(value)}"><span class="pr-input__u">${esc(unit)}</span></div>
      ${hint ? `<div class="pr-hint">${esc(hint)}</div>` : ""}
    </div>`;
}

/** Base fee + annual free months. */
export function basePanel(lang: Lang, snap: PricingSnapshot): string {
  const u = unitOf(snap);
  return `
    <section class="pr2-pn" id="pr2-s-base">
      <div class="pr2-pn__h"><h2>${T(lang, "Alapdíj és éves fizetés")}</h2></div>
      <p class="pr2-desc">${T(lang, "Minden csomag alja — a gerinccel (érdeklődés-CTA) együtt.")}</p>
      <div class="pr2-g2">
        ${field("pr-base_monthly", "base_monthly", T(lang, "Alapdíj"), snap.baseMonthly, `${u} ${T(lang, "/ hó")}`)}
        ${field("pr-annual_free_months", "annual_free_months", T(lang, "Éves előfizetés — ingyen hónapok"), snap.annualFreeMonths, T(lang, "hónap"))}
      </div>
      <div class="pr2-run" id="pr2-run-base"></div>
    </section>`;
}

/** Own domain: the switch, the terms, the per-ending table (drawn by the script). */
export function domainPanel(lang: Lang, snap: PricingSnapshot): string {
  const u = unitOf(snap);
  return `
    <section class="pr2-pn" id="pr2-s-dom">
      <div class="pr2-pn__h"><h2>${T(lang, "Saját domain")}</h2><span class="pr2-sub">— ${T(lang, "a vevő maga választ nevet és végződést")}</span></div>
      <p class="pr2-desc"><b>${T(lang, "Ha a domain-pirula egy csomagban van, ott a saját címnek nincs havidíja")}</b> ${T(lang, "(a „csomagban ingyen” jelölt végződésekre). Csomagon kívül a végződés havidíja jár.")}</p>
      <input type="hidden" name="dom_present" value="1">
      <label class="pr-esc__head pr2-switch">
        <span class="con-sell"><input type="checkbox" id="dom_free" name="domain_free_in_package"${snap.domainFreeInPackage ? " checked" : ""}><span class="con-sell__track"></span></span>
        <span><b>${T(lang, "Ingyen domain csomagban")}</b> <span class="mut small">— ${T(lang, "kikapcsolva a domain mindig felár")}</span></span>
      </label>
      <div class="pr2-g3">
        ${field("pr-domain_min_package_monthly", "domain_min_package_monthly", T(lang, "Belépési küszöb (csomag havidíja legalább)"), snap.domainMinPackageMonthly, `${u} ${T(lang, "/ hó")}`, T(lang, "0 = nincs küszöb"))}
        ${field("pr-domain_min_commitment_months", "domain_min_commitment_months", T(lang, "Hűség saját domainnel"), snap.domainMinCommitmentMonths, T(lang, "hónap"))}
        ${field("pr-domain_buyout_price", "domain_buyout_price", T(lang, "Kivásárlás (név elvitele hűség alatt)"), snap.domainBuyoutPrice, u)}
      </div>
      <input type="hidden" name="tld_json" id="tld_json">
      <table class="pr2-tb pr2-resp pr2-tld" id="pr2-tld">
        <thead><tr><th>${T(lang, "Végződés")}</th><th>${T(lang, "Kínáljuk")}</th><th>${T(lang, "Beszerzés / év (nettó)")}</th><th>${T(lang, "Max. beszerzés")}</th><th>${T(lang, "Havidíj csomagon kívül")}</th><th>${T(lang, "Csomagban ingyen")}</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
      <div class="pr2-add">
        <div id="f_pr2-new"><input id="pr2-new-tld" placeholder=".at, .de…" aria-label="${esc(T(lang, "Új végződés"))}"><div class="pr2-ferr" id="pr2-new-err" role="alert"></div></div>
        <button class="pr2-btn" type="button" id="pr2-add-tld">${T(lang, "+ Végződés")}</button>
      </div>
      <div class="pr2-note"><b>${T(lang, "Kötelező platform-cím:")}</b> ${T(lang, "minden előfizetőnek lesz egy általa választott / jóváhagyott")} <b>&lt;${T(lang, "név")}&gt;.citoviso.com</b> ${T(lang, "címe is, saját domain mellett is (ÁSZF). Nem kapcsolható ki.")}</div>
      <div class="pr2-run" id="pr2-run-dom"></div>
    </section>`;
}

/** The §C confirmation (meaning unchanged). */
export function finalPanel(lang: Lang, snap: PricingSnapshot): string {
  return `
    <section class="pr2-pn pr2-final" id="pr2-s-fin">
      <label class="pr2-final__l">
        <input type="checkbox" name="pricing_confirmed" id="pr2-confirmed"${snap.pricingConfirmed ? " checked" : ""}>
        <span><b>${T(lang, "Az árak véglegesek, élesíthetők")}</b>
          <span class="pr2-desc" style="display:block;margin:2px 0 0">${T(lang, "Enélkül a levél nem hirdethet árat, és a nyilvános oldal „Egyedi ajánlat”-ot mutat (Fttv. / jogszerűségi kapu).")}</span></span>
      </label>
    </section>`;
}

/** The sticky save bar: unsaved count · reset · save. */
export function saveBar(lang: Lang, snap: PricingSnapshot): string {
  return `
    <div class="pr2-save">
      <span class="pr2-dirty" id="pr2-dirty"></span>
      <span class="pr2-errsum" id="pr2-err-sum" role="alert"></span>
      <button class="pr2-btn" type="button" id="pr2-reset">${T(lang, "Visszaállítás")}</button>
      <button class="ok pr2-btn pr2-btn--pri" type="submit">${T(lang, "Mentés — {region}", { region: esc(regionLabel(lang, snap.region)) })}</button>
    </div>`;
}

/** The trial's package select (ADR-0360 ⑥) — inserted into the trial section. */
export function trialPackageField(lang: Lang, pkg: Tier | null, enabled: boolean): string {
  const cur = pkg ?? "teljes";
  const opts = [...TIERS]
    .reverse()
    .map((t) => `<option value="${t}" data-art="${esc(`${huArticleLower(tierLabel(lang, t))} ${tierLabel(lang, t)}`)}"${t === cur ? " selected" : ""}>${esc(T(lang, "{t} csomag", { t: tierLabel(lang, t) }))}</option>`)
    .join("");
  return `<div class="pr-field" id="f_trial_pkg">
      <label class="pr-field__l" for="trial_pkg">${T(lang, "A próbázó ezt kapja")}</label>
      <div class="pr-input"><select id="trial_pkg" name="trial_package"${enabled ? "" : " disabled"}>${opts}</select></div>
    </div>`;
}

/** The data blob the script runs on (every sentence pre-translated here). */
export function pricingPageData(lang: Lang, snap: PricingSnapshot, x: PricingPageExtras): string {
  const modules = MODULE_CATALOG.filter((m) => !m.retired && (m.billing !== "once" || m.id === "multilang")).map((m) => ({
    id: m.id,
    label: m.label,
    price: m.spine ? 0 : (snap.modulePrices.get(m.id) ?? 0),
    spine: !!m.spine,
    once: m.billing === "once",
    packageable: packageableIds().includes(m.id),
    sell: !x.disabledSales.has(m.id),
    requires: applicableRequirements(m.id)
      .filter((r) => r.strength === "hard")
      .map((r) => r.id),
  }));
  const data = {
    region: snap.region,
    currency: snap.currency,
    unit: unitOf(snap),
    base: snap.baseMonthly,
    freeM: snap.annualFreeMonths,
    modules,
    domainId: DOMAIN_PSEUDO_MODULE,
    // The article travels with the name (huArticle), never bracketed in the sentence.
    tiers: TIERS.map((t) => ({ id: t, label: tierLabel(lang, t), withArt: `${huArticleLower(tierLabel(lang, t))} ${tierLabel(lang, t)}` })),
    assign: Object.fromEntries(x.assignment),
    domFree: snap.domainFreeInPackage,
    tlds: snap.tlds.map((t: TldRow) => ({ ...t })),
    minPkg: snap.domainMinPackageMonthly,
    commit: snap.domainMinCommitmentMonths,
    buyout: snap.domainBuyoutPrice,
    confirmed: snap.pricingConfirmed,
    measureUrl: "/pricing/tld-measure",
    msgs: {
      pkgTitle: T(lang, "Csomagok"),
      modTitle: T(lang, "Modulok"),
      offTitle: T(lang, "Ajánlatok és próba"),
      perMonth: T(lang, "/hó"),
      monthly: T(lang, "{tier}, havonta", { tier: "{tier}" }),
      domIn: T(lang, " · saját cím benne"),
      annual: T(lang, "Éves fizetés"),
      annualV: T(lang, "−{n} hó", { n: "{n}" }),
      sellable: T(lang, "eladó modul"),
      outside: T(lang, "Csomagon kívül"),
      stopped: T(lang, "Leállítva"),
      dom: T(lang, "Saját domain"),
      domPkg: T(lang, "csomagban"),
      domFee: T(lang, "felár"),
      intro: T(lang, "bemutatkozó kedvezmény"),
      esc: T(lang, "Döntés-segítő"),
      escV: T(lang, "−{p}% · {n}. megnyitás", { p: "{p}", n: "{n}" }),
      off: T(lang, "ki"),
      trial: T(lang, "Ingyenes próba"),
      trialV: T(lang, "{d} nap", { d: "{d}" }),
      coupon: T(lang, "Kupon"),
      couponV: T(lang, "−{p}% · {d} nap", { p: "{p}", d: "{d}" }),
      attNone: T(lang, "Minden rendben — nincs teendő ezen a piacon."),
      attStopped: T(lang, "{m} leállítva", { m: "{m}" }),
      attKnocked: T(lang, "{m} nem eladó ({dep} nélkül nem működik)", { m: "{m}", dep: "{dep}" }),
      attStoppedWhy: T(lang, ", de {tierArt} csomagban van — ott nem kerül az árba", { tierArt: "{tierArt}" }),
      attNoFree: T(lang, "Domain csomagban, de nincs ingyenes végződés"),
      attNoFreeWhy: T(lang, " — a vevő nem kapna ingyen címet"),
      attNoTld: T(lang, "Nincs kínált végződés"),
      attNoTldWhy: T(lang, " — saját cím nem rendelhető"),
      attUnmeasured: T(lang, "{t} ára nincs mérve", { t: "{t}" }),
      attUnmeasuredWhy: T(lang, " — kérdezd le, mielőtt kínálod"),
      attConf: T(lang, "Az árak nincsenek véglegesítve"),
      attConfWhy: T(lang, " — a levél nem hirdet árat, a nyilvános oldal „Egyedi ajánlat”-ot mutat"),
      confOn: T(lang, "Véglegesítve — a levelek árat hirdethetnek"),
      confOff: T(lang, "Nincs véglegesítve — a levél nem hirdet árat"),
      modN: T(lang, "{n} modul", { n: "{n}" }),
      yearly: T(lang, "éves: {p}", { p: "{p}" }),
      inhFromAlap: T(lang, "Minden az Alapból"),
      inhFromAjanlott: T(lang, "Minden az Ajánlottból"),
      own0: T(lang, "Tartalma"),
      ownN: T(lang, "Ebben jön még"),
      drop: T(lang, "Húzd ide a modult"),
      dropSel: T(lang, "Koppints ide: {m} → {t}", { m: "{m}", t: "{t}" }),
      gerinc: T(lang, "gerinc"),
      notForSale: T(lang, "nem eladó"),
      onceFee: T(lang, "{p} egyszeri", { p: "{p}" }),
      domainLineIn: T(lang, "Saját cím benne ({t})", { t: "{t}" }),
      domainLineNoFree: T(lang, "nincs ingyenes végződés"),
      domainLineMin: T(lang, "Saját cím nem választható (küszöb: {p}/hó)", { p: "{p}" }),
      domainLineFee: T(lang, "Saját cím: +{p}/hó ({t})", { p: "{p}", t: "{t}" }),
      domainLineNone: T(lang, "Saját cím: nincs kínált végződés"),
      remove: T(lang, "Kivétel: {m}", { m: "{m}" }),
      inhTitle: T(lang, "Öröklött az alacsonyabb csomagból"),
      stopTitle: T(lang, "Leállítva — nem kerül az árba"),
      allIn: T(lang, "Minden modul csomagban van."),
      movedTo: T(lang, "{m} → {t}", { m: "{m}", t: "{t}" }),
      movedUp: T(lang, " (és a magasabb csomagokban is)"),
      removed: T(lang, "{m} kivéve a csomagokból — külön vehető.", { m: "{m}" }),
      pulled: T(lang, "Vele ment: {list} (kemény függőség).", { list: "{list}" }),
      dropped: T(lang, "Vele kikerült: {list} (rá épül).", { list: "{list}" }),
      raised: T(lang, "Feljebb került: {list} (rá épül).", { list: "{list}" }),
      selected: T(lang, "Kiválasztva: {m} — koppints egy csomagra.", { m: "{m}" }),
      domOffPkg: T(lang, "Az ingyen domain csomagban ki van kapcsolva."),
      domOffMoved: T(lang, "Ingyen domain kikapcsolva — a domain-pirula csomagon kívülre került."),
      tierFrom: T(lang, "{t}-tól", { t: "{t}" }),
      tierTop: T(lang, "{t}", { t: "{t}" }),
      notMeasured: T(lang, "nincs mérve"),
      measure: T(lang, "Lekérdezés"),
      measuring: T(lang, "…"),
      measuredNow: T(lang, "most mérve"),
      measureFail: T(lang, "{t}: a regisztrátor nem ad árat — nem kínálható", { t: "{t}" }),
      measureOk: T(lang, "{t}: {p} nettó / év", { t: "{t}", p: "{p}" }),
      overCap: T(lang, "A beszerzés a plafon felett — nem kínálható."),
      needMeasure: T(lang, "Előbb kérdezd le az árat."),
      needInt: T(lang, "Egész szám kell."),
      del: T(lang, "Törlés"),
      tldBad: T(lang, "Csak betűk, legalább 2 (pl. .at)."),
      tldDup: T(lang, "{t} már a listán van.", { t: "{t}" }),
      tldAdded: T(lang, "{t} hozzáadva — kérdezd le az árát, mielőtt kínálod.", { t: "{t}" }),
      lmOffered: T(lang, "Kínáljuk"),
      lmCost: T(lang, "Beszerzés / év"),
      lmCap: T(lang, "Max. beszerzés"),
      lmFee: T(lang, "Havidíj csomagon kívül"),
      lmFree: T(lang, "Csomagban ingyen"),
      runBase: T(lang, "Így fut: havi fizetésnél az Ajánlott {m}/hó; éves fizetésnél {k} hónap árát fizeti: {y}/év ({n} hónap ingyen).", { m: "{m}", k: "{k}", y: "{y}", n: "{n}" }),
      runDom: T(lang, "Így fut: {lines}. Mindegyik mellé jár a <név>.citoviso.com cím. A domaint a fizetés után regisztráljuk; {c} hónap hűség alatt a név elvitele {b}.", { lines: "{lines}", c: "{c}", b: "{b}" }),
      runDomIn: T(lang, "{t}: saját {e} cím az árban", { t: "{t}", e: "{e}" }),
      runDomMin: T(lang, "{t}: saját cím nem kérhető", { t: "{t}" }),
      runDomFee: T(lang, "{t}: saját cím +{p}/hó", { t: "{t}", p: "{p}" }),
      dirty: T(lang, "● {n} szakaszban mentetlen változás", { n: "{n}" }),
      errSum: T(lang, "A mentés addig nem megy, amíg a végződés-tábla jelölt mezője hibás."),
      unsavedLeave: T(lang, "Mentetlen változás van az Árazás lapon."),
    },
  };
  return `<script type="application/json" id="pr2_data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}
