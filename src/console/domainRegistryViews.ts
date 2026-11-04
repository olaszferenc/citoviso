// /domains — the domain registry page. Approved plan: the A+B HYBRID
// (assets/design-refs/console/domain-nyilvantartas/, owner decision 2026-11-04 via the
// coordinator). Desktop: 4 summary tiles + a table whose „Életút” column carries the 7-dot
// life-path bar; a row opens a right-hand drawer (life-path bar on top, then the timeline,
// expiry/renewal, ownership, traffic slot). Phone: cards instead of the table, full-screen drawer.
//
// Data comes ONLY from domainRegistry.ts (the same record the partner page reads). An
// unmeasured time renders „nincs adat” — never an invented one (§B.17).
//
// Filter + sort are links (server-side, shareable URL, works without JS); the search box,
// the drawer and the help box are the small inline script at the end.
//
// i18n note: operator-facing (internal console) — outside the §B.18 customer scope; the
// labels still go through T() so a non-Hungarian operator gets them translated (ADR-0067 ③).

import { esc, helpLink, layout } from "./views.js";
import { formatMoney } from "../text/money.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import type { DomainRecord, DomainStats, DomainStep, DomainStepKey } from "./domainRegistry.js";

const DAY = 86_400_000;

export type DomainFilter = "all" | "att" | "run" | "live" | "exp";
export type DomainSort = "att" | "domain" | "tenant" | "exp";

export interface DomainsQuery {
  readonly f: DomainFilter;
  readonly sort: DomainSort;
  readonly q: string;
  /** provisioningId of the row whose drawer opens on load. */
  readonly open: string | null;
}

export function parseDomainsQuery(u: URL): DomainsQuery {
  const f = u.searchParams.get("f");
  const sort = u.searchParams.get("sort");
  return {
    f: f === "att" || f === "run" || f === "live" || f === "exp" ? f : "all",
    sort: sort === "domain" || sort === "tenant" || sort === "exp" ? sort : "att",
    q: (u.searchParams.get("q") ?? "").trim().slice(0, 120),
    open: /^[0-9a-f-]{36}$/i.test(u.searchParams.get("open") ?? "") ? u.searchParams.get("open") : null,
  };
}

// ── formatting ───────────────────────────────────────────────────────────────

function parts(d: Date): (t: string) => string {
  const p = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  return (t: string) => p.find((x) => x.type === t)?.value ?? "";
}
/** "2026-11-03 10:16" Budapest wall clock. */
const fmt = (d: Date): string => {
  const g = parts(d);
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
};
/** "2026-11-03" Budapest calendar date. */
const fmtD = (d: Date): string => {
  const g = parts(d);
  return `${g("year")}-${g("month")}-${g("day")}`;
};

function dur(lang: string, ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return T(lang, "{n} perc", { n: m });
  const h = Math.floor(m / 60);
  if (h < 48) return T(lang, "{h} óra {m} perc", { h, m: m % 60 });
  return T(lang, "{d} nap {h} óra", { d: Math.floor(h / 24), h: h % 24 });
}

const money = (n: number, cur: string): string => esc(formatMoney(n, cur));

// ── labels ───────────────────────────────────────────────────────────────────

function stepLabel(lang: string, k: DomainStepKey): string {
  switch (k) {
    case "ordered":
      return T(lang, "Megrendelve");
    case "paid":
      return T(lang, "Kifizetve");
    case "bought":
      return T(lang, "Megvéve a regisztrátornál");
    case "confirm":
      return T(lang, ".hu Nyilvántartó-megerősítés");
    case "ns":
      return T(lang, "Bejegyezve, névszerver aktív");
    case "tls":
      return T(lang, "TLS-tanúsítvány");
    case "live":
      return T(lang, "Beköltözve — az oldal ezen a címen él");
  }
}
function stepShort(lang: string, k: DomainStepKey): string {
  switch (k) {
    case "ordered":
      return T(lang, "Rendelés");
    case "paid":
      return T(lang, "Fizetés");
    case "bought":
      return T(lang, "Vétel");
    case "confirm":
      return T(lang, "Megerősítés");
    case "ns":
      return T(lang, "Névszerver");
    case "tls":
      return T(lang, "TLS");
    case "live":
      return T(lang, "Él");
  }
}

type Tone = "ok" | "run" | "warn" | "bad" | "mute";
function statusOf(lang: string, status: string): [string, Tone] {
  switch (status) {
    case "pending":
      return [T(lang, "Fizetve, vételre vár"), "run"];
    case "registering":
      return [T(lang, "Vétel folyamatban"), "run"];
    case "registered":
      return [T(lang, "Megvéve, névszerver hátra"), "run"];
    case "dns_pending":
      return [T(lang, "Bejegyzésre / névszerverre vár"), "run"];
    case "tls_pending":
      return [T(lang, "Tanúsítványra vár"), "run"];
    case "setup_retry":
      return [T(lang, "Beállítás újrapróbálva"), "warn"];
    case "live":
      return [T(lang, "Él"), "ok"];
    case "failed":
      return [T(lang, "Elakadt (hiba)"), "bad"];
    default:
      return [status, "mute"];
  }
}
const pill = (tone: Tone, txt: string, dot = false): string =>
  `<span class="dm-pill dm-pill--${tone}">${dot ? "<i></i>" : ""}${esc(txt)}</span>`;
const statusPill = (lang: string, r: DomainRecord): string => {
  const [t, tone] = statusOf(lang, r.status);
  return pill(tone, t, true);
};
const nodata = (lang: string): string => `<span class="dm-nodata">${esc(T(lang, "nincs adat"))}</span>`;

/** Why a step has no time, or what the current step waits for. */
function stepNote(lang: string, r: DomainRecord, s: DomainStep): string | null {
  if (s.gap === "house") return s.key === "ordered" ? T(lang, "saját cím — nincs megrendelés") : T(lang, "saját cím — nincs fizetés");
  if (s.gap === "untracked") {
    if (s.key === "confirm") return T(lang, "megtörtént (a bejegyzés feltétele), de az időpontját ez a sor nem tárolja");
    if (s.key === "tls") return T(lang, "az élesedéssel együtt; külön időpontot nem tárolunk");
    if (s.key === "ns") return T(lang, "a sor a névszerver-időpont mérése előtti, időpont nélkül");
    return T(lang, "megtörtént, az időpontja nincs tárolva");
  }
  if (s.key === "confirm" && (s.state === "current" || s.state === "stuck")) {
    return r.confirmLinkAt
      ? T(lang, "a megerősítő link megérkezett; a Nyilvántartó „adatok rögzítése” levelére vár")
      : T(lang, "a megerősítő link még nem érkezett meg a postafiókba");
  }
  return null;
}

interface Stuck {
  readonly lvl: "bad" | "warn" | "info";
  readonly t: string;
}
function stuckInfo(lang: string, r: DomainRecord, now: Date): Stuck | null {
  if (r.status === "failed") return { lvl: "bad", t: T(lang, "Elakadt: {hiba}", { hiba: r.error ?? T(lang, "hiba") }) };
  if (r.status === "live" || !r.waitingSince) return null;
  const ms = now.getTime() - r.waitingSince.getTime();
  const lvl = r.stuckStage >= 2 ? "bad" : r.stuckStage === 1 || ms > DAY ? "warn" : "info";
  let t = T(lang, "Vár {ido} óta ({mikor} óta)", { ido: dur(lang, ms), mikor: fmt(r.waitingSince) });
  if (r.stuckStage === 1) t += ` · ${T(lang, "24 órás riasztás kiment")}`;
  if (r.stuckStage >= 2) t += ` · ${T(lang, "72 órás riasztás + levél a vevőnek")}`;
  return { lvl, t };
}

interface Expiry {
  readonly tone: Tone;
  readonly t: string;
  readonly lvl: 0 | 1 | 2 | 3;
}
function expiryInfo(lang: string, r: DomainRecord): Expiry {
  if (r.attention.includes("subscription_ended")) return { tone: "bad", t: T(lang, "Előfizetés megszűnt, a cím él"), lvl: 3 };
  if (!r.expiresAt || r.daysLeft === null) return { tone: "mute", t: T(lang, "nincs lejárat"), lvl: 0 };
  const dl = r.daysLeft;
  if (r.house) return { tone: "mute", t: fmtD(r.expiresAt), lvl: 0 };
  if (dl < 0) return { tone: "bad", t: T(lang, "lejárt {n} napja", { n: -dl }), lvl: 3 };
  if (dl <= 7) return { tone: "bad", t: T(lang, "{n} nap múlva lejár", { n: dl }), lvl: 3 };
  if (dl <= 30) return { tone: "bad", t: T(lang, "{n} nap múlva lejár", { n: dl }), lvl: 2 };
  if (dl <= 60) return { tone: "warn", t: T(lang, "{n} nap múlva lejár", { n: dl }), lvl: 1 };
  return { tone: "mute", t: fmtD(r.expiresAt), lvl: 0 };
}

function coverText(lang: string, r: DomainRecord): string {
  switch (r.cover) {
    case "house":
      return T(lang, "saját cím");
    case "package":
      return T(lang, "csomagban (nincs külön díj)");
    case "fee":
      return T(lang, "havidíj: {osszeg}/hó", { osszeg: formatMoney(r.monthlyFee, r.feeCurrency) });
    case "settled":
      return T(lang, "kilépéskor kivásárolta");
  }
}

const isRunning = (r: DomainRecord): boolean => r.status !== "live" && r.status !== "failed";
const isExp90 = (r: DomainRecord): boolean => r.daysLeft !== null && r.daysLeft <= 90;

export function filterDomains(rows: readonly DomainRecord[], q: Pick<DomainsQuery, "f" | "sort">): DomainRecord[] {
  const ok = (r: DomainRecord): boolean =>
    q.f === "att" ? r.attention.length > 0 : q.f === "run" ? isRunning(r) : q.f === "live" ? r.status === "live" : q.f === "exp" ? isExp90(r) : true;
  return rows.filter(ok).sort((a, b) => {
    if (q.sort === "domain") return a.domain.localeCompare(b.domain);
    if (q.sort === "tenant") return a.tenantName.localeCompare(b.tenantName, "hu");
    if (q.sort === "exp") return (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity);
    const aa = a.attention.length ? 0 : 1;
    const bb = b.attention.length ? 0 : 1;
    return aa - bb || b.startedAt.getTime() - a.startedAt.getTime();
  });
}

// ── pieces ───────────────────────────────────────────────────────────────────

function stepper(lang: string, r: DomainRecord, labels: boolean): string {
  let h = `<div class="dm-steps" role="img" aria-label="${esc(
    r.steps.map((s) => `${stepShort(lang, s.key)}: ${s.state === "done" ? "✓" : s.state === "todo" ? "–" : "●"}`).join(", "),
  )}">`;
  r.steps.forEach((s, i) => {
    if (i) h += `<span class="dm-steps__l${s.state === "todo" ? "" : " is-done"}"></span>`;
    h += `<span class="dm-steps__s is-${s.state}" title="${esc(stepLabel(lang, s.key))}"></span>`;
  });
  h += `</div>`;
  if (labels) h += `<div class="dm-steplabels">${r.steps.map((s) => `<span>${esc(stepShort(lang, s.key))}</span>`).join("")}</div>`;
  return h;
}

interface TlEvent {
  readonly at: Date;
  readonly t: string;
  readonly x: string;
}

/** Stored side-events of the row — only what the database actually holds. */
function eventsOf(lang: string, r: DomainRecord): TlEvent[] {
  const ev: TlEvent[] = [];
  if (r.confirmLinkAt)
    ev.push({ at: r.confirmLinkAt, t: T(lang, "Megerősítő link érkezett (cfm.drr.hu)"), x: T(lang, "a postafiók-figyelő látta") });
  if (r.registrarNoteAt && r.registrarNote)
    ev.push({ at: r.registrarNoteAt, t: T(lang, "A regisztrátor írt"), x: r.registrarNote });
  if (r.delayNoticeAt)
    ev.push({ at: r.delayNoticeAt, t: T(lang, "A vevő „tovább tart” levelet kapott"), x: T(lang, "72 órás elakadás után") });
  return ev;
}

function timeline(lang: string, r: DomainRecord): string {
  const items: Array<{ at: Date | null; html: string }> = r.steps.map((s) => {
    const when = s.at ? esc(fmt(s.at)) : s.state === "todo" ? `<span class="dm-mut">${esc(T(lang, "még nem"))}</span>` : nodata(lang);
    const note = stepNote(lang, r, s);
    return {
      at: s.at,
      html: `<li class="is-${s.state}"><span class="dm-tl__dot"></span><div class="dm-tl__t">${esc(stepLabel(lang, s.key))}</div><div class="dm-tl__d">${when}</div>${
        note ? `<div class="dm-tl__x">${esc(note)}</div>` : ""
      }</li>`,
    };
  });
  for (const e of eventsOf(lang, r)) {
    const html = `<li class="is-ev"><span class="dm-tl__dot"></span><div class="dm-tl__t">${esc(e.t)}</div><div class="dm-tl__d">${esc(fmt(e.at))}</div><div class="dm-tl__x">${esc(e.x)}</div></li>`;
    // Right after the last dated item that is not later than the event — so a side-event of a
    // row still in progress sits next to where it happened, not after the steps still to come.
    let idx = 0;
    items.forEach((it, i) => {
      if (it.at && it.at.getTime() <= e.at.getTime()) idx = i + 1;
    });
    items.splice(idx, 0, { at: e.at, html });
  }
  return `<ol class="dm-tl">${items.map((i) => i.html).join("")}</ol>`;
}

function siteHref(r: DomainRecord): { href: string; text: string } | null {
  if (r.status === "live") return { href: `https://${r.domain}`, text: r.domain };
  if (r.slug) return { href: `https://${r.slug}.citoviso.com`, text: `${r.slug}.citoviso.com` };
  return null;
}

/** The drawer's body (also the no-JS deep link `?open=`). */
export function domainDetail(r: DomainRecord, now: Date = new Date()): string {
  const lang = consoleLang();
  const s = stuckInfo(lang, r, now);
  const e = expiryInfo(lang, r);
  const alerts: string[] = [];
  if (s) alerts.push(`<div class="dm-alert dm-alert--${s.lvl}">${esc(s.t)}</div>`);
  if (r.registrarNote && isRunning(r))
    alerts.push(
      `<div class="dm-alert dm-alert--warn">${esc(
        T(lang, "A regisztrátor írt ({mikor}): {mit}", { mikor: r.registrarNoteAt ? fmt(r.registrarNoteAt) : "?", mit: r.registrarNote }),
      )}</div>`,
    );
  if (r.renewProblem) alerts.push(`<div class="dm-alert dm-alert--bad">${esc(T(lang, "Megújítás: {gond}", { gond: r.renewProblem }))}</div>`);
  if (e.lvl > 0) {
    const tail = r.attention.includes("subscription_ended")
      ? ` — ${r.renewEnd ? T(lang, "a megújítás {datum} után leáll", { datum: fmtD(r.renewEnd) }) : T(lang, "a megújítás leállítandó")}`
      : "";
    alerts.push(`<div class="dm-alert dm-alert--${e.lvl >= 2 ? "bad" : "warn"}">${esc(e.t + tail)}</div>`);
  }
  const lift = r.house ? `<span class="dm-house">${esc(T(lang, "SAJÁT"))}</span> ` : "";
  const renewTxt = r.house
    ? esc(T(lang, "kézzel (saját cím)"))
    : r.autoRenew === true
      ? esc(T(lang, "automatikus megújítás BE"))
      : r.autoRenew === false
        ? esc(T(lang, "automatikus megújítás KI"))
        : `<span class="dm-nodata">${esc(T(lang, "nincs adat — a napi szinkron még nem futott"))}</span>`;
  const nextRenew = r.expiresAt
    ? r.renewEnd && r.renewEnd.getTime() <= r.expiresAt.getTime()
      ? `<b>${esc(T(lang, "nem újítjuk meg"))}</b> ${esc(T(lang, "(előfizetés megszűnt)"))}`
      : esc(fmtD(r.expiresAt) + (r.autoRenew ? ` ${T(lang, "(automatikus)")}` : ""))
    : nodata(lang);
  const sale =
    r.cover === "fee"
      ? T(lang, "{osszeg}/hó", { osszeg: formatMoney(r.monthlyFee, r.feeCurrency) })
      : r.cover === "house"
        ? T(lang, "saját cím")
        : r.cover === "settled"
          ? T(lang, "kivásárolva")
          : T(lang, "csomagban");
  const cost =
    r.costNet !== null && r.costCurrency
      ? T(lang, "beszerzés {osszeg} nettó/év", { osszeg: formatMoney(r.costNet, r.costCurrency) })
      : T(lang, "beszerzés: nincs mért ár");
  const site = siteHref(r);
  const kv = (rows: ReadonlyArray<readonly [string, string]>): string =>
    `<dl class="dm-kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
  const partnerLink = r.partnerId
    ? `<a href="/partner/${esc(r.partnerId)}?tab=domain">${esc(r.partnerName ?? "?")}</a>`
    : `<span class="dm-nodata">${esc(T(lang, "nincs partner"))}</span>`;
  return (
    `<div class="dm-dhead">${stepper(lang, r, true)}</div>` +
    `<h2 class="dm-dtitle">${esc(r.domain)}</h2><div class="dm-dpills">${lift}${statusPill(lang, r)}</div>` +
    alerts.join("") +
    `<section class="dm-sec"><h3>${esc(T(lang, "Életút"))}</h3>${timeline(lang, r)}</section>` +
    `<section class="dm-sec"><h3>${esc(T(lang, "Lejárat és megújítás"))}</h3>${kv([
      [
        T(lang, "Lejárat"),
        r.expiresAt
          ? `${esc(fmtD(r.expiresAt))}${r.daysLeft !== null ? ` ${pill(e.tone, T(lang, "{n} nap", { n: r.daysLeft }))}` : ""}${
              r.expiryEstimated
                ? `<div class="dm-small dm-mut">${esc(T(lang, "becsült (vétel + 1 év) — a napi szinkron még nem olvasta a regisztrátortól"))}</div>`
                : ""
            }`
          : nodata(lang),
      ],
      [
        T(lang, "Megújítás"),
        renewTxt + (r.renewCheckedAt ? `<div class="dm-small dm-mut">${esc(T(lang, "ellenőrizve: {mikor}", { mikor: fmt(r.renewCheckedAt) }))}</div>` : ""),
      ],
      [T(lang, "Következő megújítás"), nextRenew],
      [T(lang, "Megújítás díja"), esc(`${cost} · ${T(lang, "eladás: {ar}", { ar: sale })}`)],
      [T(lang, "Fedezet"), esc(coverText(lang, r))],
    ])}</section>` +
    `<section class="dm-sec"><h3>${esc(T(lang, "Kié, mi alapján"))}</h3>${kv([
      [T(lang, "Végződés · regisztrátor"), esc(`${r.tld} · ${r.registrar}`)],
      [
        T(lang, "Regisztrátor-azonosító"),
        (r.registrarRef ? esc(T(lang, "rendelés {ref}", { ref: r.registrarRef })) : nodata(lang)) +
          (r.serviceRef ? esc(` · ${T(lang, "szolgáltatás {ref}", { ref: r.serviceRef })}`) : ""),
      ],
      [T(lang, "Tenant"), esc(r.tenantName) + (r.tenantStatus !== "active" ? ` ${pill("warn", r.tenantStatus === "suspended" ? T(lang, "felfüggesztve") : T(lang, "lezárva"))}` : "")],
      [T(lang, "Partner"), partnerLink],
      [
        T(lang, "Oldal"),
        site
          ? `<a href="${esc(site.href)}" target="_blank" rel="noopener">${esc(site.text)}</a>${
              r.status === "live" && !r.house && r.slug
                ? `<div class="dm-small dm-mut">${esc(T(lang, "{regi} → ide irányít", { regi: `${r.slug}.citoviso.com` }))}</div>`
                : ""
            }`
          : nodata(lang),
      ],
      [
        T(lang, "Megrendelés"),
        r.orderKind
          ? esc(r.orderKind === "initial" ? T(lang, "első rendelés") : r.orderKind === "domain_upgrade" ? T(lang, "utólagos domain-vétel") : r.orderKind)
          : `<span class="dm-nodata">${esc(T(lang, "nincs"))}</span>`,
      ],
    ])}</section>` +
    `<section class="dm-sec"><h3>${esc(T(lang, "Forgalom"))}</h3><div class="dm-placeholder">${esc(
      T(lang, "A látogatottságot a tenant-aktivitás modul méri; amint domain szerint bontható, itt jelenik meg (napi látogatók, a régi aldomainről átirányított kérések)."),
    )}</div></section>`
  );
}

function tiles(lang: string, st: DomainStats, cur: string): string {
  const row = (k: string, v: string): string => `<div><span>${esc(k)}</span><b>${v}</b></div>`;
  const tld = st.byTld.map((t) => row(t.tld, String(t.n))).join("");
  const steps: ReadonlyArray<readonly ["paid" | "bought" | "ns" | "live", string]> = [
    ["paid", T(lang, "Rendelés → fizetés")],
    ["bought", T(lang, "Fizetés → vétel")],
    ["ns", T(lang, "Vétel → névszerver")],
    ["live", T(lang, "Névszerver → él")],
  ];
  const avg = steps.map(([k, l]) => row(l, st.turnaround[k] ? esc(dur(lang, st.turnaround[k]!.ms)) : nodata(lang))).join("");
  const max = Math.max(1, ...st.months.map((m) => Math.max(m.cost, m.revenue)));
  const bars = st.months
    .map((m) => {
      const lbl = `${Number(m.month.slice(5))}.`;
      const title = T(lang, "{honap}: beszerzés {k}, külön domain-díj {b}", {
        honap: m.month,
        k: formatMoney(m.cost, cur),
        b: formatMoney(m.revenue, cur),
      });
      return `<div class="dm-bars__b" title="${esc(title)}"><div class="dm-bars__pair"><span class="dm-bars__c" style="height:${((m.cost / max) * 46).toFixed(1)}px"></span><span class="dm-bars__r" style="height:${((m.revenue / max) * 46).toFixed(1)}px"></span></div>${esc(lbl)}</div>`;
    })
    .join("");
  const soon = st.expiring90.length
    ? st.expiring90
        .slice(0, 3)
        .map((e) => row(e.domain, esc(T(lang, "{n} nap", { n: e.daysLeft }))))
        .join("")
    : `<div class="dm-mut">${esc(T(lang, "a következő 90 napban nincs"))}</div>`;
  const total = st.turnaround.total;
  return (
    `<div class="dm-stats">` +
    `<div class="dm-stat"><div class="dm-tag">${esc(T(lang, "Domainek"))}</div><div class="dm-big">${st.total}</div><div class="dm-rows">${row(
      T(lang, "Él"),
      String(st.byState.live),
    )}${row(T(lang, "Folyamatban"), String(st.byState.running))}${row(T(lang, "Elakadt (hiba)"), String(st.byState.failed))}</div><div class="dm-rows dm-rows--sep">${tld}</div></div>` +
    `<div class="dm-stat"><div class="dm-tag">${esc(T(lang, "Lejár 90 napon belül"))}</div><div class="dm-big">${st.expiring90.length}</div><div class="dm-rows">${soon}<div class="dm-rows--sep"><span>${esc(
      T(lang, "Megújítás beszerzési díja"),
    )}</span><b>${money(st.expiring90Cost, cur)}</b></div></div></div>` +
    `<div class="dm-stat"><div class="dm-tag">${esc(T(lang, "Átlagos átfutás"))}</div><div class="dm-big">${total ? esc(dur(lang, total.ms)) : "—"}</div><div class="dm-small dm-mut">${esc(
      T(lang, "megrendeléstől élesig, {n} domain alapján", { n: total?.n ?? 0 }),
    )}</div><div class="dm-rows">${avg}</div></div>` +
    `<div class="dm-stat"><div class="dm-tag">${esc(T(lang, "Költség és bevétel havonta"))}</div><div class="dm-bars">${bars}</div><div class="dm-legend"><span><i class="dm-legend__c"></i>${esc(
      T(lang, "beszerzés"),
    )}</span><span><i class="dm-legend__r"></i>${esc(T(lang, "külön domain-díj"))}</span></div><div class="dm-small dm-mut">${esc(
      T(lang, "a csomagban adott cím nem hoz külön bevételt"),
    )}</div></div>` +
    `</div>`
  );
}

function href(q: DomainsQuery, over: Partial<DomainsQuery>): string {
  const m = { ...q, ...over };
  const p = new URLSearchParams();
  if (m.f !== "all") p.set("f", m.f);
  if (m.sort !== "att") p.set("sort", m.sort);
  if (m.q) p.set("q", m.q);
  if (m.open) p.set("open", m.open);
  const s = p.toString();
  return `/domains${s ? `?${s}` : ""}`;
}

/** The whole page. `all` = every record (counts + tiles); the table shows the filtered set. */
export function domainsPage(all: readonly DomainRecord[], stats: DomainStats, q: DomainsQuery, now: Date = new Date()): string {
  const lang = consoleLang();
  const cur = all.find((r) => r.costCurrency)?.costCurrency ?? "HUF";
  const rows = filterDomains(all, q);
  const counts: Record<DomainFilter, number> = {
    all: all.length,
    att: all.filter((r) => r.attention.length > 0).length,
    run: all.filter(isRunning).length,
    live: all.filter((r) => r.status === "live").length,
    exp: all.filter(isExp90).length,
  };
  const chipDefs: ReadonlyArray<readonly [DomainFilter, string]> = [
    ["all", T(lang, "Mind")],
    ["att", T(lang, "Figyelmet kér")],
    ["run", T(lang, "Folyamatban")],
    ["live", T(lang, "Él")],
    ["exp", T(lang, "Lejár 90 napon belül")],
  ];
  const chips = `<nav class="dm-chips" aria-label="${esc(T(lang, "Szűrő"))}">${chipDefs
    .map(
      ([id, l]) =>
        `<a class="dm-chip${q.f === id ? " is-on" : ""}" href="${esc(href(q, { f: id, open: null }))}" data-filter="${id}"${
          q.f === id ? ' aria-current="true"' : ""
        }>${esc(l)}<b>${counts[id]}</b></a>`,
    )
    .join("")}</nav>`;
  const cols: ReadonlyArray<readonly [DomainSort | null, string]> = [
    ["domain", T(lang, "Domain")],
    ["tenant", T(lang, "Tenant · partner")],
    [null, T(lang, "Életút")],
    ["exp", T(lang, "Lejárat")],
    [null, T(lang, "Fedezet")],
    [null, T(lang, "Regisztrátor")],
  ];
  const thead = cols
    .map(([k, l]) =>
      k
        ? `<th${q.sort === k ? ' class="is-on" aria-sort="ascending"' : ""}><a href="${esc(href(q, { sort: q.sort === k ? "att" : k, open: null }))}" data-sort="${k}">${esc(l)}${q.sort === k ? " ↓" : ""}</a></th>`
        : `<th>${esc(l)}</th>`,
    )
    .join("");
  let trs = "";
  let cards = "";
  let tpls = "";
  for (const r of rows) {
    const s = stuckInfo(lang, r, now);
    const e = expiryInfo(lang, r);
    const att = r.attention.length > 0;
    const open = href(q, { open: r.provisioningId });
    const search = `${r.domain} ${r.tenantName} ${r.partnerName ?? ""}`.toLowerCase();
    const tags = r.house ? ` <span class="dm-house">${esc(T(lang, "SAJÁT"))}</span>` : "";
    const stuckLine = s ? `<div class="dm-small dm-ink-${s.lvl}">${esc(s.t)}</div>` : "";
    const sel = q.open === r.provisioningId ? " is-sel" : "";
    trs +=
      `<tr class="dm-row${att ? " is-att" : ""}${sel}" data-open="${esc(r.provisioningId)}" data-q="${esc(search)}">` +
      `<td class="dm-name"><a href="${esc(open)}">${esc(r.domain)}</a>${tags}</td>` +
      `<td>${esc(r.tenantName)}<div class="dm-small dm-mut">${esc(r.partnerName ?? T(lang, "nincs partner"))}</div></td>` +
      `<td class="dm-life">${stepper(lang, r, false)}${statusPill(lang, r)}${stuckLine}</td>` +
      `<td>${pill(e.tone, e.t)}${r.renewProblem ? `<div class="dm-small dm-ink-bad">${esc(T(lang, "megújítási gond"))}</div>` : ""}</td>` +
      `<td class="dm-small">${esc(coverText(lang, r))}</td>` +
      `<td class="dm-small">${esc(r.registrar)}<div class="dm-mut">${esc(r.registrarRef ?? "—")}</div></td></tr>`;
    cards +=
      `<a class="dm-card${att ? " is-att" : ""}" href="${esc(open)}" data-open="${esc(r.provisioningId)}" data-q="${esc(search)}">` +
      `<span class="dm-card__top"><span class="dm-card__dn">${esc(r.domain)}${tags}</span>${statusPill(lang, r)}</span>` +
      `<span class="dm-small dm-mut">${esc(r.tenantName)} · ${esc(r.partnerName ?? T(lang, "nincs partner"))}</span>` +
      stepper(lang, r, true) +
      (s && s.lvl !== "info" ? `<span class="dm-alert dm-alert--${s.lvl}">${esc(s.t)}</span>` : "") +
      `<span class="dm-card__meta">${pill(e.tone, T(lang, "Lejár: {mikor}", { mikor: e.t }))}${pill("mute", coverText(lang, r))}</span></a>`;
    tpls += `<template id="dm-d-${esc(r.provisioningId)}">${domainDetail(r, now)}</template>`;
  }
  const empty = esc(T(lang, "Nincs ilyen domain."));
  if (!rows.length) {
    trs = `<tr><td colspan="6" class="dm-mut">${empty}</td></tr>`;
    cards = `<div class="dm-mut">${empty}</div>`;
  }
  const opened = q.open ? all.find((r) => r.provisioningId === q.open) ?? null : null;
  const closeHref = href(q, { open: null });
  const help = `<div class="dm-modal" id="dm-help" hidden><div class="dm-modal__box" role="dialog" aria-modal="true" aria-labelledby="dm-help-t">
    <button type="button" class="dm-x" data-help-close aria-label="${esc(T(lang, "Bezárás"))}">×</button>
    <h3 id="dm-help-t">${esc(T(lang, "Mit mutat ez a lap?"))}</h3>
    <p>${esc(T(lang, "Minden webcím, amit mi vettünk és kezelünk, a saját címeinkkel együtt (SAJÁT jel)."))}</p>
    <p><b>${esc(T(lang, "Életút:"))}</b> ${esc(
      T(
        lang,
        "megrendelve → kifizetve → megvéve a regisztrátornál → (.hu: Nyilvántartó-megerősítés) → bejegyezve, névszerver aktív → TLS-tanúsítvány → beköltözve. Ahol nincs mért időpont, „nincs adat” áll — nem találunk ki időt.",
      ),
    )}</p>
    <p><b>${esc(T(lang, "Lejárat-jelzés:"))}</b> ${esc(T(lang, "60, 30 és 7 nappal a lejárat előtt, és akkor is, ha az előfizetés megszűnt, de a cím még él."))}</p>
    <p><b>${esc(T(lang, "Fedezet:"))}</b> ${esc(
      T(lang, "„csomagban” = a csomag tartalma, külön havidíj nincs; „havidíj” = külön fizeti; „kivásárolta” = kilépéskor megvette."),
    )}</p>
  </div></div>`;
  const body = `<div class="dm-page">
  <div class="dm-hrow"><h1 class="dm-h1">${esc(T(lang, "Domainek"))} ${helpLink("console.domains")}</h1><button type="button" class="dm-q" data-help aria-label="${esc(T(lang, "Súgó"))}">?</button><span class="dm-grow"></span>
    <form method="get" action="/domains" class="dm-searchf" role="search">${q.f !== "all" ? `<input type="hidden" name="f" value="${q.f}">` : ""}${
      q.sort !== "att" ? `<input type="hidden" name="sort" value="${q.sort}">` : ""
    }<input class="dm-search" type="search" name="q" id="dm-q" value="${esc(q.q)}" placeholder="${esc(T(lang, "Domain, tenant, partner…"))}" aria-label="${esc(
      T(lang, "Keresés"),
    )}" autocomplete="off"></form></div>
  ${tiles(lang, stats, cur)}
  ${chips}
  <div class="dm-tw"><table class="dm-table"><thead><tr>${thead}</tr></thead><tbody>${trs}</tbody></table></div>
  <div class="dm-cards">${cards}</div>
  <div class="dm-small dm-mut dm-foot" data-count-tpl="${esc(T(lang, "{n} domain · nincs lapozás"))}">${esc(T(lang, "{n} domain · nincs lapozás", { n: rows.length }))}</div>
</div>
<div class="dm-scrim${opened ? " is-open" : ""}" data-close></div>
<aside class="dm-drawer${opened ? " is-open" : ""}" role="dialog" aria-modal="true" aria-label="${esc(T(lang, "Domain adatlap"))}"${opened ? "" : " hidden"}>
  <a class="dm-btn dm-close" href="${esc(closeHref)}" data-close>${esc(T(lang, "Bezárás"))}</a>
  <div class="dm-dbody">${opened ? domainDetail(opened, now) : ""}</div>
</aside>
${help}${tpls}
<script>${DOMAINS_JS}</script>`;
  return layout(T(lang, "Domainek"), body, { active: "/domains" });
}

// Search (live, client-side over the rendered rows), drawer and help. Filter/sort are links.
const DOMAINS_JS = `(function(){
"use strict";
var dr=document.querySelector(".dm-drawer"),sc=document.querySelector(".dm-scrim"),body=dr&&dr.querySelector(".dm-dbody");
var help=document.getElementById("dm-help"),last=null;
/* .con-main__in is a size container (= containing block for position:fixed): the overlays live on <body>. */
[sc,dr,help].forEach(function(el){if(el)document.body.appendChild(el)});
function url(id){var u=new URL(location.href);if(id)u.searchParams.set("open",id);else u.searchParams.delete("open");return u.pathname+u.search}
function sel(id){document.querySelectorAll(".dm-row").forEach(function(r){r.classList.toggle("is-sel",r.getAttribute("data-open")===id)})}
function open(id){var t=document.getElementById("dm-d-"+id);if(!t||!dr)return false;body.innerHTML="";body.appendChild(t.content.cloneNode(true));
  dr.hidden=false;dr.classList.add("is-open");sc.classList.add("is-open");dr.scrollTop=0;sel(id);history.replaceState(null,"",url(id));
  var c=dr.querySelector("[data-close]");if(c)c.focus({preventScroll:true});return true}
function close(){if(!dr||!dr.classList.contains("is-open"))return;dr.classList.remove("is-open");sc.classList.remove("is-open");dr.hidden=true;sel(null);
  history.replaceState(null,"",url(null));if(last&&last.focus)last.focus({preventScroll:true})}
document.addEventListener("click",function(ev){
  if(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.button)return;
  var t=ev.target.closest("[data-help],[data-help-close],[data-close],[data-open],#dm-help");if(!t)return;
  if(t.hasAttribute("data-help")){help.hidden=false;help.querySelector("[data-help-close]").focus();return}
  if(t.hasAttribute("data-help-close")||(t.id==="dm-help"&&ev.target===t)){help.hidden=true;return}
  if(t.id==="dm-help")return;
  if(t.hasAttribute("data-close")){ev.preventDefault();close();return}
  var a=ev.target.closest("a");if(a&&!a.hasAttribute("data-open")&&!a.closest(".dm-name"))return;
  last=t;if(open(t.getAttribute("data-open")))ev.preventDefault();
});
document.addEventListener("keydown",function(ev){if(ev.key!=="Escape")return;if(help&&!help.hidden){help.hidden=true;return}close()});
document.querySelectorAll(".dm-row").forEach(function(r){r.tabIndex=-1});
var q=document.getElementById("dm-q"),foot=document.querySelector(".dm-foot");
function apply(){var v=(q.value||"").trim().toLowerCase(),n=0,seen={};
  document.querySelectorAll(".dm-row,.dm-card").forEach(function(el){var hit=!v||el.getAttribute("data-q").indexOf(v)>=0;el.hidden=!hit;
    if(hit&&el.classList.contains("dm-row"))n++});
  if(foot)foot.textContent=foot.getAttribute("data-count-tpl").replace("{n}",n);
  var u=new URL(location.href);if(v)u.searchParams.set("q",q.value.trim());else u.searchParams.delete("q");history.replaceState(null,"",u.pathname+u.search)}
if(q){q.addEventListener("input",apply);q.form.addEventListener("submit",function(ev){ev.preventDefault();apply()});if(q.value)apply()}
})();`;
