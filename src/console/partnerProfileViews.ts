// Partner sheet — the approved A — Fülek layout (assets/design-refs/console/partner-adatlap/,
// owner decision 2026-11-03). Header + KPI, the „Figyelendő” list, and the tabs that are
// NOT the money ledger: Áttekintés, Adatok és kapcsolattartók (editable), Előfizetés,
// Domain, Aktivitás (SUB-D slot). The Számlák/Bizonylatok and Előzmények tabs stay in
// partnerViews.ts (documentsTab / activityTab).
//
// i18n note: operator-facing (internal console) — outside the §B.18 customer scope; the
// labels still go through T() so a non-Hungarian operator gets them translated (ADR-0067 ③).

import { esc } from "./views.js";
import { ic } from "../ui/icons.js";
import { formatMoney } from "../text/money.js";
import { normalizePhone, prettyPhone } from "../text/phone.js";
import { MODULE_CATALOG } from "../modules.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import type { PartnerDetail } from "./partnerData.js";
import type {
  AttentionItem,
  ContactKind,
  PartnerContactInput,
  PartnerDomain,
  PartnerProfile,
  PartnerRelations,
  PartnerSubscription,
} from "./partnerProfile.js";

export type PartnerTabId = "overview" | "messages" | "data" | "subscription" | "domain" | "documents" | "usage" | "activity";

const huf = (n: number, cur = "HUF") => esc(formatMoney(n, cur));
const dash = `<span class="mut">–</span>`;

/** "2026-11-03 10:16" in Budapest wall-clock time — what the operator reads. */
export function fmtTime(isoTs: string): string {
  const p = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoTs));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

const pill = (cls: "ok" | "warn" | "bad" | "info" | "muted", txt: string) => `<span class="pa-pill pa-pill--${cls}">${esc(txt)}</span>`;
const kv = (rows: readonly (readonly [string, string])[]) =>
  `<dl class="pa-kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v || dash}</dd>`).join("")}</dl>`;

const SITE_LABEL: Readonly<Record<string, string>> = {
  live: "élő",
  provisioned: "előnézet",
  suspended: "felfüggesztve",
  deactivated: "leállítva",
  draft: "piszkozat",
};
const SUB_LABEL: Readonly<Record<PartnerSubscription["status"], [string, "ok" | "warn" | "bad" | "muted"]>> = {
  active: ["aktív", "ok"],
  past_due: ["elmaradt fizetés", "bad"],
  frozen: ["befagyasztva", "bad"],
  cancelled: ["megszűnt", "muted"],
};
const DOMAIN_LABEL: Readonly<Record<string, [string, "ok" | "warn" | "bad"]>> = {
  pending: ["sorban", "warn"],
  registering: ["vásárlás folyamatban", "warn"],
  registered: ["megvéve", "warn"],
  dns_pending: ["megerősítésre vár", "warn"],
  tls_pending: ["tanúsítványra vár", "warn"],
  setup_retry: ["beállítás újrapróbálva", "warn"],
  live: ["élő", "ok"],
  failed: ["sikertelen", "bad"],
};
const STAGE_LABEL: Readonly<Record<string, string>> = {
  qualified: "minősítve",
  mock_curation: "mock-kurálás",
  outreach: "megkeresés",
  conversion: "konverzió",
  subscription: "előfizetés",
  activation: "aktiválás",
  modification: "módosítás",
  terminated: "megszűnt",
  disqualified: "kizárva",
};
const KIND_LABEL: Readonly<Record<ContactKind, string>> = {
  billing: "Számlázás",
  general: "Általános",
  technical: "Műszaki",
  legal: "Jogi",
};

// ── HEADER + TABS ────────────────────────────────────────────────────────────

export function partnerHeader(d: PartnerDetail, prof: PartnerProfile): string {
  const lang = consoleLang();
  const sub = prof.subscription;
  const domain = prof.domains[0];
  const addr = [[d.zip, d.city].filter(Boolean).join(" "), d.address].filter(Boolean).join(", ");
  const pills = [
    d.isCustomer ? pill("ok", T(lang, "vevő")) : "",
    d.isSupplier ? pill("info", T(lang, "szállító")) : "",
    d.active ? "" : pill("bad", T(lang, "inaktív")),
    sub ? pill(SUB_LABEL[sub.status][1], `${T(lang, "előfizetés")}: ${SUB_LABEL[sub.status][0]}`) : "",
    prof.relations.site ? pill(prof.relations.site.status === "live" ? "ok" : "muted", `${T(lang, "oldal")}: ${SITE_LABEL[prof.relations.site.status] ?? prof.relations.site.status}`) : "",
    domain ? pill(DOMAIN_LABEL[domain.status]?.[1] ?? "warn", `${T(lang, "domain")}: ${DOMAIN_LABEL[domain.status]?.[0] ?? domain.status}`) : "",
  ].filter(Boolean);
  const kpi = (v: string, l: string) => `<div class="pa-kpi"><b>${v}</b><span>${l}</span></div>`;
  const kpis: string[] = [];
  if (d.isCustomer) {
    kpis.push(
      kpi(sub?.monthlyRate != null ? huf(sub.monthlyRate) : d.tenant ? huf(d.tenant.monthlyFee) : "–", esc(T(lang, "havi díj (listaár)"))),
      kpi(
        sub ? esc(sub.periodEnd) : "–",
        sub
          ? esc(`${T(lang, "következő terhelés")}${sub.nextCharge != null ? ` · ${formatMoney(sub.nextCharge, "HUF")}` : ""}${sub.card ? ` · ${sub.card.brand ?? ""} ••${sub.card.last4}` : ""}`)
          : esc(T(lang, "nincs előfizetés")),
      ),
      kpi(moneyTile(d.receivable), esc(T(lang, "kintlévőség"))),
      kpi(d.tenant ? String(d.tenant.modules.length) : "–", esc(T(lang, "aktív modul"))),
    );
  }
  if (d.isSupplier) kpis.push(kpi(moneyTile(d.yearSpend), esc(T(lang, "éves költség"))), kpi(moneyTile(d.payable), esc(T(lang, "tartozásunk"))));
  return `<header class="pa-head">
    <div class="pa-head__id">
      <div class="pa-crumb"><a href="/partners">${esc(T(lang, "Partnerek"))}</a> › ${esc(d.isCustomer ? T(lang, "vevő") : T(lang, "szállító"))}</div>
      <h1>${esc(d.name)}</h1>
      <div class="pa-head__sub">${addr ? esc(addr) : ""}${d.country !== "HU" ? ` · ${esc(d.country)}` : ""} · ${esc(T(lang, "partner {d} óta", { d: d.createdAt.slice(0, 10) }))}</div>
      <div class="pa-head__pills">${pills.join(" ")}</div>
    </div>
    <div class="pa-kpis">${kpis.join("")}</div>
  </header>`;
}

function moneyTile(m: Readonly<Record<string, number>>): string {
  const e = Object.entries(m).filter(([, v]) => v !== 0);
  return e.length ? e.map(([c, v]) => huf(v, c)).join("<br>") : huf(0);
}

export function partnerTabNav(d: PartnerDetail, prof: PartnerProfile, active: PartnerTabId, waiting = 0): string {
  const lang = consoleLang();
  const hasTenant = Boolean(prof.relations.tenant);
  const tabs: [PartnerTabId, string, number?][] = [
    ["overview", T(lang, "Áttekintés"), prof.attention.length || undefined],
    // M1 (owner decision 2026-11-04): right after Áttekintés; the badge = partner messages
    // newer than our last outbound one.
    ["messages", T(lang, "Üzenetváltások"), waiting || undefined],
    ["data", T(lang, "Adatok és kapcsolattartók")],
    ...(d.isCustomer ? ([["subscription", T(lang, "Előfizetés")]] as [PartnerTabId, string][]) : []),
    ...(hasTenant ? ([["domain", T(lang, "Domain")]] as [PartnerTabId, string][]) : []),
    ["documents", d.isCustomer && !d.isSupplier ? T(lang, "Számlák") : T(lang, "Bizonylatok")],
    ...(hasTenant ? ([["usage", T(lang, "Aktivitás")]] as [PartnerTabId, string][]) : []),
    ["activity", T(lang, "Előzmények")],
  ];
  return `<nav class="pa-tabs">${tabs
    .map(
      ([id, label, n]) =>
        `<a href="/partner/${esc(d.id)}?tab=${id}"${id === active ? ' class="active" aria-current="page"' : ""}>${esc(label)}${n ? ` <span class="pa-count">${n}</span>` : ""}</a>`,
    )
    .join("")}</nav>`;
}

// ── FIGYELENDŐ ───────────────────────────────────────────────────────────────

export function attentionBlock(d: PartnerDetail, items: readonly AttentionItem[]): string {
  const lang = consoleLang();
  if (!items.length) return "";
  const icon = (k: AttentionItem["kind"]) => (k === "wait" ? ic("clock", 16) : ic("alert", 16));
  return `<section class="pa-card pa-todo">
    <h2 class="pa-h">${esc(T(lang, "Figyelendő"))} <span class="pa-count">${items.length}</span></h2>
    <ul class="pa-todo__list">${items
      .map(
        (it) => `<li class="pa-todo__it pa-todo__it--${it.kind}">${icon(it.kind)}<div><b>${esc(it.title)}</b><span>${esc(it.detail)}${
          it.takePhone
            ? ` <strong>${esc(prettyPhone(it.takePhone))}</strong> <a class="pa-linkbtn" href="/partner/${esc(d.id)}?tab=data&amp;edit=1&amp;phone=${encodeURIComponent(it.takePhone)}">${esc(T(lang, "Átveszem a partnerre"))}</a>`
            : ""
        }</span></div></li>`,
      )
      .join("")}</ul>
  </section>`;
}

// ── KAPCSOLATOK ──────────────────────────────────────────────────────────────

export function relationsBlock(rel: PartnerRelations): string {
  const lang = consoleLang();
  if (!rel.tenant) return `<p class="mut">${esc(T(lang, "Ehhez a partnerhez nem tartozik tenant (szállító, vagy kézzel rögzített vevő)."))}</p>`;
  const rows: string[] = [];
  rows.push(
    `<div class="pa-relrow"><span class="pa-relk">Tenant</span><div><b>${esc(rel.tenant.displayName)}</b> ${pill(rel.tenant.status === "active" ? "ok" : "muted", rel.tenant.status === "active" ? T(lang, "aktív") : rel.tenant.status)}<small>${esc(fmtTime(rel.tenant.createdAt))} ${esc(T(lang, "óta"))} · <code>${esc(rel.tenant.id.slice(0, 8))}…</code></small></div></div>`,
  );
  if (rel.lead)
    rows.push(
      `<div class="pa-relrow"><span class="pa-relk">Lead</span><div><a class="pa-a" href="/lead/${esc(rel.lead.id)}">${esc(rel.lead.name)} ${ic("external", 14)}</a> ${pill("info", STAGE_LABEL[rel.lead.stage] ?? rel.lead.stage)}<small>${rel.lead.place ? `${esc(rel.lead.place)} · ` : ""}${esc(T(lang, "marketing-arc (mock, megkeresés)"))}</small></div></div>`,
    );
  if (rel.site) {
    const host = rel.site.customDomain ?? (rel.site.slug ? `${rel.site.slug}.citoviso.com` : null);
    const link =
      rel.site.status === "live" && host
        ? `<a class="pa-a" href="https://${esc(host)}" target="_blank" rel="noopener">${esc(host)} ${ic("external", 14)}</a>`
        : rel.site.previewToken
          ? `<a class="pa-a" href="/site/${esc(rel.site.previewToken)}" target="_blank" rel="noopener">${esc(T(lang, "privát előnézet"))} ${ic("external", 14)}</a>`
          : esc(host ?? "–");
    rows.push(
      `<div class="pa-relrow"><span class="pa-relk">${esc(T(lang, "Oldal"))}</span><div>${link} ${pill(rel.site.status === "live" ? "ok" : "muted", SITE_LABEL[rel.site.status] ?? rel.site.status)}<small>${rel.site.liveAt ? `${esc(T(lang, "élesítve"))} ${esc(fmtTime(rel.site.liveAt))}` : esc(T(lang, "még nem élő"))}${rel.site.customDomain && rel.site.slug ? ` · ${esc(T(lang, "platform-cím"))}: ${esc(rel.site.slug)}.citoviso.com` : ""}</small></div></div>`,
    );
  }
  for (const u of rel.users)
    rows.push(
      `<div class="pa-relrow"><span class="pa-relk">${esc(T(lang, "Belépés"))}</span><div><b><code>${esc(u.username)}</code></b> ${pill("muted", u.role === "owner" ? T(lang, "tulaj") : u.role)}<small>${esc(u.email)}${u.passwordSetAt ? ` · ${esc(T(lang, "jelszó beállítva"))} ${esc(fmtTime(u.passwordSetAt))}` : ` · ${esc(T(lang, "jelszót még nem állított"))}`} · ${esc(T(lang, "utolsó jelszavas belépés"))}: ${u.lastLoginAt ? esc(fmtTime(u.lastLoginAt)) : `<b>${esc(T(lang, "nincs rögzítve"))}</b>`}</small></div></div>`,
    );
  return `<div class="pa-rel">${rows.join("")}</div>`;
}

// ── ADATOK ÉS KAPCSOLATTARTÓK ────────────────────────────────────────────────

export interface PartnerEditState {
  readonly open: boolean;
  /** Re-rendered values after a refused POST (or a prefill), keyed by form field name. */
  readonly values?: Readonly<Record<string, string>>;
  readonly contacts?: readonly PartnerContactInput[];
  readonly problems?: Readonly<Record<string, string>>;
  /** „Mentve 10:42” after a successful save. */
  readonly savedAt?: string | null;
}

function partnerDataView(d: PartnerDetail): string {
  const lang = consoleLang();
  const banks = d.bankAccounts.length
    ? d.bankAccounts.map((b) => `<code>${esc(b.accountNo)}</code>${b.bankName ? ` <span class="mut small">(${esc(b.bankName)})</span>` : ""}`).join("<br>")
    : "";
  return kv([
    [T(lang, "Számlázási (jogi) név"), esc(d.name)],
    [T(lang, "Cím"), esc([[d.zip, d.city].filter(Boolean).join(" "), d.address].filter(Boolean).join(", "))],
    [T(lang, "Ország"), esc(d.country)],
    [T(lang, "Adószám"), d.taxNumber ? `<code>${esc(d.taxNumber)}</code>` : ""],
    [T(lang, "Közösségi adószám"), d.euVatNumber ? `<code>${esc(d.euVatNumber)}</code>` : ""],
    [T(lang, "Cégjegyzékszám"), d.registrationNo ? `<code>${esc(d.registrationNo)}</code>` : ""],
    ["E-mail", d.email ? esc(d.email) : ""],
    ["Telefon", d.phone ? esc(prettyPhone(d.phone)) : ""],
    [T(lang, "Bankszámla"), banks],
    [T(lang, "Megjegyzés"), d.note ? esc(d.note) : ""],
  ]);
}

function contactsView(contacts: readonly PartnerContactInput[]): string {
  const lang = consoleLang();
  if (!contacts.length) return `<p class="mut">${esc(T(lang, "Még nincs rögzített kapcsolattartó."))}</p>`;
  return `<table class="pa-tbl"><thead><tr><th>${esc(T(lang, "Szerep"))}</th><th>${esc(T(lang, "Név"))}</th><th>E-mail</th><th>Telefon</th><th></th></tr></thead><tbody>${contacts
    .map(
      (c) =>
        `<tr><td>${esc(T(lang, KIND_LABEL[c.kind]))}</td><td>${c.name ? esc(c.name) : dash}</td><td>${c.email ? esc(c.email) : dash}</td><td>${c.phone ? esc(prettyPhone(c.phone)) : dash}</td><td>${c.primary ? pill("ok", T(lang, "elsődleges")) : ""}</td></tr>`,
    )
    .join("")}</tbody></table>
    <p class="pa-hint">${esc(T(lang, "A számla és a díjbekérő a „Számlázás” elsődleges címére megy, a többi számlázási cím másolatot kap."))}</p>`;
}

function contactRow(c: PartnerContactInput, i: number, problem?: string): string {
  const lang = consoleLang();
  return `<div class="pa-crow" data-crow>
    <input type="hidden" name="c${i}_id" value="${esc(c.id ?? "")}">
    <div class="pa-crow__top">
      <select name="c${i}_kind" aria-label="${esc(T(lang, "Szerep"))}">${(Object.keys(KIND_LABEL) as ContactKind[])
        .map((k) => `<option value="${k}"${k === c.kind ? " selected" : ""}>${esc(T(lang, KIND_LABEL[k]))}</option>`)
        .join("")}</select>
      <label><input type="checkbox" name="c${i}_primary" value="1"${c.primary ? " checked" : ""}> ${esc(T(lang, "elsődleges"))}</label>
      <button type="button" class="pa-crow__del" data-del>${ic("close", 14)} ${esc(T(lang, "törlés"))}</button>
    </div>
    <div class="pa-crow__f">
      <input name="c${i}_name" placeholder="${esc(T(lang, "Név"))}" value="${esc(c.name)}" autocomplete="off">
      <input name="c${i}_email" placeholder="e-mail" inputmode="email" value="${esc(c.email)}" autocomplete="off"${problem ? ' class="is-bad"' : ""}>
      <input name="c${i}_phone" placeholder="telefon" inputmode="tel" value="${esc(c.phone ? prettyPhone(c.phone) : "")}" autocomplete="off">
    </div>
    <em class="pa-ferr" data-cerr>${problem ? esc(problem) : ""}</em>
  </div>`;
}

/** The phone field's value: a re-rendered/prefilled one as typed (pretty when it parses), else the stored one. */
function phoneShown(typed: string | undefined, stored: string | null): string {
  if (typed !== undefined) {
    const n = normalizePhone(typed);
    return n ? prettyPhone(n) : typed;
  }
  return stored ? prettyPhone(stored) : "";
}

function partnerEditor(d: PartnerDetail, contacts: readonly PartnerContactInput[], st: PartnerEditState): string {
  const lang = consoleLang();
  const pr = st.problems ?? {};
  const val = (k: string, fallback: string | null) => esc(st.values?.[k] ?? fallback ?? "");
  const f = (name: string, label: string, value: string, o: { req?: boolean; wide?: boolean; ph?: string; mode?: string; hint?: string; err?: string } = {}) =>
    `<label class="pa-f${o.wide ? " pa-f--wide" : ""}${pr[o.err ?? name] ? " is-bad" : ""}"><span>${esc(label)}${o.req ? " *" : ""}</span>
      <input name="${name}" value="${value}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ""}${o.mode ? ` inputmode="${o.mode}"` : ""} autocomplete="off">
      <em class="pa-ferr" data-err="${o.err ?? name}">${pr[o.err ?? name] ? esc(pr[o.err ?? name]!) : ""}</em>${o.hint ? `<small>${esc(o.hint)}</small>` : ""}</label>`;
  const rows = st.contacts ?? contacts;
  const nProblems = Object.keys(pr).length;
  return `<form class="pa-form" method="post" action="/partner/${esc(d.id)}/edit" data-editor novalidate>
    <div class="pa-src">${ic("shield", 16)}<div><b>${esc(T(lang, "Mire hat a mentés?"))}</b> ${esc(
      T(
        lang,
        "A következő számla, díjbekérő és megújítás EZT használja. NEM változik: a már kiállított számla, a rendeléskori nyilatkozat, a lead neve és címe (marketing-arc), a tulaj belépési e-mailje. Ha a vevő egy újabb rendelésnél új számlázási adatot ad meg, az felülírja ezt.",
      ),
    )}</div></div>
    <fieldset><legend>${esc(T(lang, "Számlázási adatok"))}</legend><div class="pa-grid">
      ${f("name", T(lang, "Számlázási (jogi) név"), val("name", d.name), { req: true, wide: true })}
      ${f("country", T(lang, "Ország (ISO-2)"), val("country", d.country), { req: true, ph: "HU" })}
      ${f("zip", T(lang, "Irányítószám"), val("zip", d.zip), { mode: "numeric" })}
      ${f("city", T(lang, "Város"), val("city", d.city))}
      ${f("address", T(lang, "Utca, házszám"), val("address", d.address), { wide: true })}
      ${f("tax_number", T(lang, "Adószám"), val("tax_number", d.taxNumber), { ph: "12345678-2-41", err: "tax", hint: T(lang, "Magánszemélynél üres. Cégnél kötelező, a 8. jegy ellenőrzőszám.") })}
      ${f("eu_vat_number", T(lang, "Közösségi adószám"), val("eu_vat_number", d.euVatNumber), { ph: "DE812871812", err: "euvat" })}
      ${f("email", T(lang, "Céges e-mail"), val("email", d.email), { mode: "email" })}
      ${f("phone", "Telefon", esc(phoneShown(st.values?.phone, d.phone)), { mode: "tel", ph: "+36 30 123 4567", err: "phone" })}
      <label class="pa-f pa-f--wide"><span>${esc(T(lang, "Megjegyzés (belső)"))}</span><textarea name="note" rows="2">${val("note", d.note)}</textarea></label>
    </div></fieldset>
    <fieldset><legend>${esc(T(lang, "Kapcsolattartók"))}</legend>
      <div class="pa-crows" data-crows>${rows.map((c, i) => contactRow(c, i, pr[`c${i}`])).join("")}</div>
      <template data-crow-tpl>${contactRow({ id: null, kind: "general", name: "", email: "", phone: "", primary: false }, 999)}</template>
      <button type="button" class="pa-linkbtn" data-add-contact>${ic("plus", 14)} ${esc(T(lang, "Kapcsolattartó hozzáadása"))}</button>
      <em class="pa-ferr" data-err="contacts">${pr.contacts ? esc(pr.contacts) : ""}</em>
    </fieldset>
    <div class="pa-sync" data-sync hidden><label><input type="checkbox" name="sync_billing" value="1" checked> ${esc(T(lang, "A számla-címzett (Számlázás, elsődleges) is erre változzon:"))} <b data-sync-to></b></label></div>
    <div class="pa-actions">
      <button type="submit" class="citui-btn citui-btn--primary pa-btn" data-save>${esc(T(lang, "Mentés"))}</button>
      <a class="citui-btn citui-btn--ghost pa-btn" href="/partner/${esc(d.id)}?tab=data" data-cancel>${esc(T(lang, "Mégse"))}</a>
      <span class="pa-state" data-state></span>
    </div>
    <div class="pa-errsum" data-errsum${nProblems ? "" : " hidden"}>${nProblems ? esc(T(lang, "{n} hiba miatt nem menthető: {first}", { n: nProblems, first: Object.values(pr)[0]! })) : ""}</div>
  </form>`;
}

export function dataTab(d: PartnerDetail, contacts: readonly PartnerContactInput[], st: PartnerEditState): string {
  const lang = consoleLang();
  return `<section class="pa-card" data-inline-wrap>
    <h2 class="pa-h">${esc(T(lang, "Számlázási adatok és kapcsolattartók"))}${
      st.open ? "" : `<a class="pa-editbtn" href="/partner/${esc(d.id)}?tab=data&amp;edit=1" data-edit-inline>${ic("pen", 16)} ${esc(T(lang, "Szerkesztés"))}</a>`
    }${st.savedAt ? ` <span class="pa-state is-ok">${ic("check", 16)} ${esc(T(lang, "Mentve {t}", { t: st.savedAt }))}</span>` : ""}</h2>
    ${st.open ? partnerEditor(d, contacts, st) : `${partnerDataView(d)}<h3 class="pa-h3">${esc(T(lang, "Kapcsolattartók"))}</h3>${contactsView(contacts)}`}
  </section>${st.open ? `<script>${EDITOR_JS}</script>` : ""}`;
}

// The client mirror of partnerEditProblems(): taxId.ts (checksum) + text/phone.ts
// (normalisation) + the contact rules. The server stays the authority.
const EDITOR_JS = `(function(){
const form=document.querySelector('form[data-editor]');if(!form)return;
const W=[9,7,3,1,9,7,3];
function taxProblem(r){const d=(r||"").replace(/\\D/g,"");if(!d)return null;if(d.length!==11)return "Az adószám 11 számjegyű (pl. 12345678-2-41) — ez "+d.length+" számjegy.";let s=0;for(let i=0;i<7;i++)s+=Number(d[i])*W[i];if((10-(s%10))%10!==Number(d[7]))return "Az adószám első 8 jegye nem érvényes — valószínűleg elgépelés.";if(!"12345".includes(d[8]))return "Az adószám 9. jegye (ÁFA-kód) csak 1 és 5 közötti lehet.";const c=Number(d.slice(9,11));if(!((c>=2&&c<=44)||c===51))return "Az adószám utolsó két jegye (megyekód) nem érvényes.";return null}
const fmtTax=r=>{const d=r.replace(/\\D/g,"");return d.slice(0,8)+"-"+d.slice(8,9)+"-"+d.slice(9,11)};
const MOB=new Set(["20","30","31","50","70"]),NINE=new Set(["21"]),AREA=new Set("22 23 24 25 26 27 28 29 32 33 34 35 36 37 40 42 44 45 46 47 48 49 52 53 54 56 57 59 62 63 66 68 69 72 73 74 75 76 77 78 79 80 82 83 84 85 87 88 89 92 93 94 95 96 99".split(" "));
function nsn(n){if(n.startsWith("1"))return 8;const p=n.slice(0,2);if(MOB.has(p)||NINE.has(p))return 9;if(AREA.has(p))return 8;return 0}
function normPhone(raw){const c=raw.replace(/[\\s\\-()./]/g,"");if(!/^\\+?[0-9]{8,15}$/.test(c))return null;let hu=null;if(c.startsWith("+36"))hu=c.slice(3);else if(c.startsWith("0036"))hu=c.slice(4);else if(c.startsWith("06"))hu=c.slice(2);else if(c.startsWith("36"))hu=c.slice(2);if(hu!==null)return /^[0-9]+$/.test(hu)&&nsn(hu)===hu.length?"+36"+hu:null;if(c.startsWith("+"))return c;if(c.startsWith("00")&&c[2]!=="0")return "+"+c.slice(2);return null}
function pretty(e){if(!e.startsWith("+36"))return e;const n=e.slice(3);if(n.startsWith("1"))return "+36 1 "+n.slice(1,4)+" "+n.slice(4);return "+36 "+n.slice(0,2)+" "+n.slice(2,5)+" "+n.slice(5)}
const EMAIL=/^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i;
const crows=form.querySelector('[data-crows]'),tpl=form.querySelector('[data-crow-tpl]');
const initial=new FormData(form),origEmail=(form.elements.email.value||"").trim();
let next=crows.children.length;
function snapshot(){return JSON.stringify([...new FormData(form)].filter(([k])=>k!=="sync_billing"))}
const base=snapshot();
function dirty(){const d=snapshot()!==base;form.dataset.dirty=d?"1":"";const st=form.querySelector('[data-state]');if(!st.dataset.busy)st.textContent=d?"Nem mentett változás":"";
 const em=form.elements.email.value.trim(),sync=form.querySelector('[data-sync]');sync.hidden=!(em&&EMAIL.test(em)&&em.toLowerCase()!==origEmail.toLowerCase()&&origEmail);form.querySelector('[data-sync-to]').textContent=em;return d}
function setErr(name,msg){const e=form.querySelector('[data-err="'+name+'"]');if(e)e.textContent=msg||"";const lab=e&&e.closest('.pa-f');if(lab)lab.classList.toggle('is-bad',!!msg)}
function rows(){return [...crows.querySelectorAll('[data-crow]')].map(r=>({r,kind:r.querySelector('select').value,primary:r.querySelector('input[type=checkbox]').checked,email:r.querySelector('input[name$=_email]').value.trim(),phone:r.querySelector('input[name$=_phone]').value.trim()}))}
function validate(){const v=k=>(form.elements[k].value||"").trim(),errs=[];const E=(k,m)=>{setErr(k,m);if(m)errs.push(m)};
 E("name",v("name").length<2?"A számlázási név kötelező (legalább 2 karakter).":"");const c=v("country").toUpperCase();
 E("country",/^[A-Z]{2}$/.test(c)?"":"Az ország ISO-2 kód (pl. HU, DE).");E("zip",c==="HU"&&v("zip")&&!/^[1-9][0-9]{3}$/.test(v("zip"))?"Magyar irányítószám: 4 számjegy (pl. 1188).":"");
 E("tax",c==="HU"&&v("tax_number")?(taxProblem(v("tax_number"))||""):"");E("email",v("email")&&!EMAIL.test(v("email"))?"Ez nem e-mail-cím alak (pl. nev@domain.hu).":"");
 E("phone",v("phone")&&!normPhone(v("phone"))?"Nem érvényes telefonszám — a magyar számnál a körzet/szolgáltató és a hossz is számít.":"");
 const rs=rows();let cerr="";for(const x of rs){let m="";const em=x.r.querySelector('input[name$=_email]'),ph=x.r.querySelector('input[name$=_phone]');em.classList.remove('is-bad');ph.classList.remove('is-bad');
  if(!x.email&&!x.phone)m="Adj meg e-mailt vagy telefont.";else if(x.email&&!EMAIL.test(x.email)){m="Hibás e-mail.";em.classList.add('is-bad')}else if(x.phone&&!normPhone(x.phone)){m="Hibás telefonszám.";ph.classList.add('is-bad')}
  x.r.querySelector('[data-cerr]').textContent=m;if(m)errs.push(m)}
 const bill=rs.filter(x=>x.kind==="billing");if(bill.length&&!bill.some(x=>x.primary&&x.email))cerr="Kell egy elsődleges SZÁMLÁZÁSI e-mail — oda megy a számla.";
 for(const k of ["billing","general","technical","legal"]){const ins=rs.filter(x=>x.kind===k);if(ins.filter(x=>x.primary).length>1)cerr="Szerepenként egy elsődleges lehet.";const ms=ins.map(x=>x.email.toLowerCase()).filter(Boolean);if(new Set(ms).size!==ms.length)cerr="Ugyanaz az e-mail egy szerepben csak egyszer szerepelhet."}
 form.querySelector('[data-err=contacts]').textContent=cerr;if(cerr)errs.push(cerr);
 const sum=form.querySelector('[data-errsum]');sum.hidden=!errs.length;sum.textContent=errs.length?errs.length+" hiba miatt nem menthető: "+errs[0]:"";return !errs.length}
form.addEventListener('input',e=>{if(e.target.closest('.is-bad')||e.target.classList.contains('is-bad'))validate();dirty()});
form.addEventListener('change',e=>{if(e.target.type==="checkbox"&&e.target.name.endsWith("_primary")&&e.target.checked){const r=e.target.closest('[data-crow]'),k=r.querySelector('select').value;rows().forEach(x=>{if(x.r!==r&&x.kind===k)x.r.querySelector('input[type=checkbox]').checked=false})}dirty()});
form.addEventListener('focusout',e=>{const n=e.target.name||"";if(n==="tax_number"&&e.target.value.trim()&&!taxProblem(e.target.value))e.target.value=fmtTax(e.target.value);
 if((n==="phone"||n.endsWith("_phone"))&&normPhone(e.target.value))e.target.value=pretty(normPhone(e.target.value));if(n==="country")e.target.value=e.target.value.toUpperCase();
 if(["name","country","zip","tax_number","email","phone"].includes(n))validate();dirty()});
form.addEventListener('click',e=>{if(e.target.closest('[data-del]')){e.target.closest('[data-crow]').remove();dirty()}
 if(e.target.closest('[data-add-contact]')){const i=next++;crows.insertAdjacentHTML('beforeend',tpl.innerHTML.replace(/c999_/g,"c"+i+"_"));crows.lastElementChild.querySelector('input[name$=_name]').focus();dirty()}
 if(e.target.closest('[data-cancel]')&&form.dataset.dirty&&!confirm("Elveted a nem mentett változásokat?"))e.preventDefault()});
form.addEventListener('submit',e=>{if(!validate()){e.preventDefault();form.querySelector('.is-bad input,input.is-bad')?.focus();return}
 const st=form.querySelector('[data-state]');st.dataset.busy="1";st.textContent="Mentés…";form.querySelector('[data-save]').disabled=true;window.removeEventListener('beforeunload',guard)});
function guard(e){if(form.dataset.dirty){e.preventDefault();e.returnValue=""}}
window.addEventListener('beforeunload',guard);
dirty();if(form.querySelector('.pa-ferr:not(:empty)'))form.querySelector('.is-bad input,input.is-bad')?.focus();
})();`;

// ── ELŐFIZETÉS ───────────────────────────────────────────────────────────────

export function subscriptionBlock(d: PartnerDetail, prof: PartnerProfile): string {
  const lang = consoleLang();
  const s = prof.subscription;
  if (!s) return `<p class="mut">${esc(T(lang, "Ehhez a partnerhez nem tartozik platform-előfizetés."))}</p>`;
  const modLabel = (id: string): string => MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;
  const mods = d.tenant?.modules ?? [];
  const st = SUB_LABEL[s.status];
  const state = [
    s.cancelAtPeriodEnd ? T(lang, "lemondva — {d}-én lezárul", { d: s.periodEnd }) : "",
    s.frozenAt ? T(lang, "befagyasztva {t} óta", { t: fmtTime(s.frozenAt) }) : "",
    s.cancelledAt ? T(lang, "megszűnt {t}", { t: fmtTime(s.cancelledAt) }) : "",
    s.pendingPeriod === "annual" ? T(lang, "éves fizetésre vált a következő megújítással") : "",
  ].filter(Boolean);
  const period = s.billingPeriod === "annual" ? T(lang, "éves") : T(lang, "havi");
  return `<div class="pa-subs__top">
      <div><span class="pa-mut pa-small">${esc(T(lang, "Modulok"))}</span><b>${mods.length} ${esc(T(lang, "aktív"))}</b></div>
      <div><span class="pa-mut pa-small">${esc(T(lang, "Havi díj (listaár)"))}</span><b>${s.monthlyRate != null ? huf(s.monthlyRate) : dash}</b></div>
      <div><span class="pa-mut pa-small">${esc(T(lang, "Időszak"))}</span><b>${esc(s.periodStart)} – ${esc(s.periodEnd)}</b><small class="pa-mut">${esc(period)}</small></div>
      <div><span class="pa-mut pa-small">${esc(T(lang, "Következő terhelés"))}</span><b>${esc(s.periodEnd)}</b><small class="pa-mut">${s.nextCharge != null ? `${huf(s.nextCharge)} · ` : ""}${esc(s.autoCharge ? T(lang, "automatikusan, kártyáról") : T(lang, "díjbekérővel"))}</small></div>
    </div>
    ${
      s.card
        ? `<div class="pa-cardrow">${ic("card", 18)}<div><b>${esc(s.card.brand ?? "")} •••• ${esc(s.card.last4)}</b><small class="pa-mut"> ${s.card.exp ? `${esc(T(lang, "lejár"))} ${esc(s.card.exp)}` : ""}${s.card.savedAt ? ` · ${esc(T(lang, "mentve"))} ${esc(fmtTime(s.card.savedAt))}` : ""}</small></div></div>`
        : ""
    }
    ${kv([
      [T(lang, "Állapot"), `${pill(st[1], st[0])}${state.length ? ` <small class="pa-mut">${esc(state.join(" · "))}</small>` : ` <small class="pa-mut">${esc(T(lang, "nincs lemondva, nincs befagyasztva"))}</small>`}`],
      [T(lang, "Fizetési mód"), esc(s.paymentMethod === "token" ? T(lang, "kártya (automatikus terhelés)") : T(lang, "díjbekérő + fizetési link"))],
    ])}
    <details class="pa-mods"><summary>${esc(T(lang, "Aktív modulok ({n})", { n: mods.length }))}</summary><div class="pa-chips">${mods
      .map((m) => `<span class="pa-chip">${esc(modLabel(m))}</span>`)
      .join("")}</div></details>
    <h3 class="pa-h3">${esc(T(lang, "Fizetések"))}</h3>
    ${
      prof.payments.length
        ? `<table class="pa-tbl"><thead><tr><th>${esc(T(lang, "Időpont"))}</th><th>${esc(T(lang, "Összeg"))}</th><th>${esc(T(lang, "Időszak"))}</th><th>${esc(T(lang, "Kapu"))}</th><th>${esc(T(lang, "Állapot"))}</th></tr></thead><tbody>${prof.payments
            .map(
              (p) =>
                `<tr><td>${esc(fmtTime(p.at))}</td><td><b>${huf(p.amount, p.currency)}</b></td><td>${esc(p.period === "annual" ? T(lang, "éves") : T(lang, "havi"))}</td><td>${esc(p.gateway)}${p.ref ? ` <code>${esc(p.ref.slice(0, 8))}</code>` : ""}</td><td>${
                  p.status === "paid" ? pill("ok", T(lang, "fizetve")) : p.status === "failed" ? pill("bad", T(lang, "sikertelen")) : pill("warn", T(lang, "folyamatban"))
                }</td></tr>`,
            )
            .join("")}</tbody></table>`
        : `<p class="mut">${esc(T(lang, "Még nincs fizetés."))}</p>`
    }`;
}

// ── DOMAIN ───────────────────────────────────────────────────────────────────

const STEPS: readonly (readonly [string, readonly string[]])[] = [
  ["Megrendelve", ["pending"]],
  ["Megvéve", ["registering", "registered"]],
  ["Nyilvántartó megerősítés / DNS", ["dns_pending"]],
  ["Tanúsítvány", ["tls_pending", "setup_retry"]],
  ["Élő a saját címen", ["live"]],
];

export function domainBlock(prof: PartnerProfile): string {
  const lang = consoleLang();
  const site = prof.relations.site;
  const platform = site?.slug ? `${site.slug}.citoviso.com` : null;
  if (!prof.domains.length)
    return kv([
      [T(lang, "Saját domain"), esc(T(lang, "nincs — a platform-címen él"))],
      [T(lang, "Platform-cím"), platform ? esc(platform) : ""],
    ]);
  return prof.domains
    .map((d) => {
      const at = STEPS.findIndex(([, sts]) => sts.includes(d.status));
      const steps =
        d.status === "failed"
          ? ""
          : `<ol class="pa-steps">${STEPS.map(([t], i) => {
              const cls = d.status === "live" || i < at ? "ok" : i === at ? "now" : "todo";
              return `<li class="pa-step pa-step--${cls}"><i></i><b>${esc(T(lang, t))}</b></li>`;
            }).join("")}</ol>`;
      const lab = DOMAIN_LABEL[d.status] ?? [d.status, "warn" as const];
      return `<div class="pa-dom">
        <div class="pa-dom__top">${ic("domain", 18)}<b>${esc(d.domain)}</b> ${pill(lab[1], lab[0])}</div>
        ${steps}
        ${kv([
          [T(lang, "Regisztrátor-azonosító"), d.registrarRef ? `<code>${esc(d.registrarRef)}</code>` : ""],
          [T(lang, "Megrendelve"), esc(fmtTime(d.orderedAt))],
          [T(lang, "Elkészült"), d.finishedAt ? esc(fmtTime(d.finishedAt)) : ""],
          [
            T(lang, "Lejárat"),
            d.expiresAt
              ? `<b>${esc(d.expiresAt.slice(0, 10))}</b> ${d.expiresConfirmed ? pill("ok", T(lang, "a regisztrátortól")) : pill("warn", T(lang, "becsült"))}`
              : "",
          ],
          [T(lang, "Automatikus megújítás"), d.autoRenew == null ? "" : esc(d.autoRenew ? T(lang, "bekapcsolva") : T(lang, "kikapcsolva"))],
          [T(lang, "Megújítási gond"), d.renewProblem ? `<span class="pa-bad">${esc(d.renewProblem)}</span>` : ""],
          [T(lang, "Regisztrátor üzenete"), d.registrarNote ? esc(d.registrarNote) : ""],
          [T(lang, "Platform-cím"), platform ? esc(platform) : ""],
          [T(lang, "„Megvettük” levél"), d.boughtNoticeAt ? esc(`${T(lang, "elküldve")} ${fmtTime(d.boughtNoticeAt)}`) : ""],
        ])}
      </div>`;
    })
    .join("<hr class=\"pa-hr\">");
}

// ── ÁTTEKINTÉS ───────────────────────────────────────────────────────────────

export function overviewCards(d: PartnerDetail, prof: PartnerProfile): string {
  const lang = consoleLang();
  const card = (h: string, inner: string, more?: string) =>
    `<section class="pa-card"><h2 class="pa-h">${esc(h)}${more ? `<a class="pa-more" href="${more}">${esc(T(lang, "Részletek"))} ›</a>` : ""}</h2>${inner}</section>`;
  const s = prof.subscription;
  const dm: PartnerDomain | undefined = prof.domains[0];
  const base = `/partner/${esc(d.id)}?tab=`;
  const cards: string[] = [];
  if (d.isCustomer)
    cards.push(
      card(
        T(lang, "Előfizetés"),
        s
          ? kv([
              [T(lang, "Állapot"), pill(SUB_LABEL[s.status][1], SUB_LABEL[s.status][0])],
              [T(lang, "Havi díj"), s.monthlyRate != null ? huf(s.monthlyRate) : ""],
              [T(lang, "Következő terhelés"), esc(`${s.periodEnd}${s.nextCharge != null ? ` · ${formatMoney(s.nextCharge, "HUF")}` : ""}${s.card ? ` · ${s.card.brand ?? ""} ••${s.card.last4}` : ""}`)],
            ])
          : `<p class="mut">${esc(T(lang, "Nincs előfizetés."))}</p>`,
        `${base}subscription`,
      ),
    );
  if (prof.relations.tenant)
    cards.push(
      card(
        T(lang, "Domain"),
        kv([
          [T(lang, "Saját domain"), dm ? `${esc(dm.domain)} ${pill(DOMAIN_LABEL[dm.status]?.[1] ?? "warn", DOMAIN_LABEL[dm.status]?.[0] ?? dm.status)}` : esc(T(lang, "nincs"))],
          [T(lang, "Lejárat"), dm?.expiresAt ? `${esc(dm.expiresAt.slice(0, 10))} ${dm.expiresConfirmed ? "" : pill("warn", T(lang, "becsült"))}` : ""],
          [T(lang, "Platform-cím"), prof.relations.site?.slug ? esc(`${prof.relations.site.slug}.citoviso.com`) : ""],
        ]),
        `${base}domain`,
      ),
      card(T(lang, "Kapcsolatok"), relationsBlock(prof.relations)),
    );
  cards.push(
    card(
      T(lang, "Számlázási adatok"),
      kv([
        [T(lang, "Név"), esc(d.name)],
        [T(lang, "Cím"), esc([[d.zip, d.city].filter(Boolean).join(" "), d.address].filter(Boolean).join(", "))],
        [T(lang, "Adószám"), d.taxNumber ? `<code>${esc(d.taxNumber)}</code>` : ""],
        ["E-mail", d.email ? esc(d.email) : ""],
        ["Telefon", d.phone ? esc(prettyPhone(d.phone)) : ""],
      ]),
      `${base}data`,
    ),
  );
  return `<div class="pa-ov">${cards.join("")}</div>`;
}

export function usageBlock(html: string | null): string {
  const lang = consoleLang();
  return html ?? `<p class="mut">${esc(T(lang, "A tenant-aktivitás és az oldal-látogatottság itt jelenik meg (fejlesztés alatt)."))}</p>`;
}
