// The tenant admin's "Foglalások" tab — the APPROVED plan made server-side.
//
// Contract (owner sign-off 2026-09-06, frozen at
// assets/design-refs/tenant-admin/foglalasok-README.md + foglalasok-b.html):
//   · collapsible calendar on top (closed = one-line summary), day taps work:
//     free → manual block toggle, booked → day panel with CANCEL, portal → explainer
//   · clickable summary tiles (pending list / next arrivals / accepted this year)
//   · pending requests in TIME ORDER (stay date, then who asked first)
//   · verdict WITH a comment (quoted in the guest's mail)
//   · overlap chooser popup: accepting a contested stay names who gets auto-declined,
//     asks for confirmation, then the server declines the losers with honest mail
//   · cancel an accepted booking from the calendar day panel AND the history list
//
// Interactivity is server-rendered first (links + forms work with JS off — the
// overlap popup then degrades to a plain accept whose result page reports the
// auto-declines); the small script below only adds the approved popup and the
// collapse animation on top.

import { T } from "../i18n/mail.js";
import type { MonthView } from "../tenant/availability.js";
import type { InboxItem } from "../booking/requests.js";
import { ic } from "../ui/icons.js";
import { formatAmount } from "../tenant/prices.js";

export interface BookingsTabData {
  readonly units: readonly { id: string; name: string }[];
  /** Selected unit (calendar + day panel scope). */
  readonly unitId: string;
  readonly month: MonthView;
  readonly calendarOpen: boolean;
  /** Day panel: the booked day the owner tapped (ISO), and its booking. */
  readonly openDay: string | null;
  readonly openDayBooking: InboxItem | null;
  /** Which summary tile is expanded. */
  readonly panel: "pend" | "arr" | "year" | null;
  /** Every request of the site (pending + decided), newest data included. */
  readonly requests: readonly InboxItem[];
  /** Accepted verdicts in the current year (tile number). */
  readonly yearAccepted: number;
  /** The module's answer window, for the deadline chips (0 = never expires). */
  readonly expireHours: number;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function huDay(iso: string): string {
  return `${iso.slice(0, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;
}

function huShort(iso: string, lang: string): string {
  const M = [
    T(lang, "jan."), T(lang, "febr."), T(lang, "márc."), T(lang, "ápr."),
    T(lang, "máj."), T(lang, "jún."), T(lang, "júl."), T(lang, "aug."),
    T(lang, "szept."), T(lang, "okt."), T(lang, "nov."), T(lang, "dec."),
  ];
  return `${M[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}.`;
}

function nightsOf(r: InboxItem): number {
  return Math.max(
    1,
    Math.round((Date.parse(r.dateTo) - Date.parse(r.dateFrom)) / 86_400_000),
  );
}

/** Hours left before expiry (null → no deadline / already past). */
function hoursLeft(r: InboxItem, expireHours: number): number | null {
  if (!expireHours) return null;
  const left = Math.round(
    (r.createdAt.getTime() + expireHours * 3_600_000 - Date.now()) / 3_600_000,
  );
  return left > 0 ? left : null;
}

/** Pending requests in the CONTRACT's order: stay date, then who asked first. */
export function pendingInOrder(requests: readonly InboxItem[]): InboxItem[] {
  return requests
    .filter((r) => r.status === "pending")
    .sort((a, b) =>
      a.dateFrom < b.dateFrom
        ? -1
        : a.dateFrom > b.dateFrom
          ? 1
          : a.createdAt.getTime() - b.createdAt.getTime(),
    );
}

/** reqId → the other PENDING requests sharing at least one night. */
function overlapGroups(pend: readonly InboxItem[]): Map<string, InboxItem[]> {
  const out = new Map<string, InboxItem[]>();
  for (const r of pend) {
    const others = pend.filter(
      (x) => x.id !== r.id && x.dateFrom < r.dateTo && x.dateTo > r.dateFrom,
    );
    if (others.length) out.set(r.id, others);
  }
  return out;
}

const tabHref = (extra: string) => `/admin?tab=foglalasok${extra}`;

/* ── calendar ──────────────────────────────────────────────────────────── */

function calendarCard(d: BookingsTabData, lang: string): string {
  const m = d.month;
  const qsBase = `&u=${encodeURIComponent(d.unitId)}&ho=${m.month}`;
  const bookedCount = m.cells.filter((c) => c.source === "booking").length;
  const manualCount = m.cells.filter((c) => c.source === "manual").length;
  // ADR-0114: nights another unit holds are FULL nights here too — leaving them out
  // of the summary could print "nincs foglalt nap" over a month that is sold out.
  const linkedCount = m.cells.filter((c) => c.source === "linked").length;
  const summary =
    [
      bookedCount ? T(lang, "{n} éj vendég-foglalás", { n: bookedCount }) : "",
      manualCount ? T(lang, "{n} nap kézi blokk", { n: manualCount }) : "",
      linkedCount ? T(lang, "{n} nap másik egység foglalása", { n: linkedCount }) : "",
      m.importedCount ? T(lang, "{n} nap portál-naptárból", { n: m.importedCount }) : "",
    ]
      .filter(Boolean)
      .join(" · ") || T(lang, "nincs foglalt nap");

  // Per-day toggle forms: each tap posts the month's resulting MANUAL set — the
  // existing /admin/availability semantics (replace month), no new write path.
  const manualDays = new Set(
    m.cells.filter((c) => c.source === "manual").map((c) => c.day),
  );
  const dayCell = (c: MonthView["cells"][number]): string => {
    if (c.past) return `<span class="bk-day bk-day--past">${c.dom}</span>`;
    if (c.source === "booking") {
      const on = d.openDay === c.day ? " bk-day--sel" : "";
      return (
        // The id is a STABLE machine hook (Elek/FK selector rule: no nth-child).
        `<a class="bk-day bk-day--booked${on}" id="nap-${c.day}" ` +
        `href="${tabHref(`${qsBase}&naptar=1&nap=${c.day}`)}#naptar">` +
        `${c.dom}</a>`
      );
    }
    if (c.source === "ical") {
      return (
        `<span class="bk-day bk-day--ical" title="${esc(T(lang, "Ezt a napot a portál-naptár blokkolja — ott lehet törölni; a következő frissítéskor itt is eltűnik."))}">` +
        `${c.dom}</span>`
      );
    }
    // ADR-0114 — a night ANOTHER unit holds (the whole place, or a room the whole
    // place cannot be sold over). Without this branch it fell into "free" below:
    // it looked bookable HERE while the module screen showed it locked, and one tap
    // would have written a manual block over someone else's night.
    if (c.source === "linked") {
      const who = c.detail?.booking?.guestName ?? c.detail?.otherUnitName ?? "";
      const title = c.detail?.booking
        ? T(lang, "{who} foglalása — {unit}", { who: esc(who), unit: esc(c.detail.otherUnitName ?? "") })
        : T(lang, "A(z) {unit} naptárában van tele jelölve.", { unit: esc(c.detail?.otherUnitName ?? "") });
      return `<span class="bk-day bk-day--linked" title="${esc(title)}">${c.dom}</span>`;
    }
    // free or manual → one-tap toggle
    const next = new Set(manualDays);
    if (c.source === "manual") next.delete(c.day);
    else next.add(c.day);
    const hidden = [...next]
      .map((day) => `<input type="hidden" name="day" value="${day}">`)
      .join("");
    const cls = c.source === "manual" ? " bk-day--manual" : "";
    const label =
      c.source === "manual"
        ? T(lang, "Kézi blokk feloldása: {day}", { day: huDay(c.day) })
        : T(lang, "Nap kézi blokkolása: {day}", { day: huDay(c.day) });
    return (
      `<form method="post" action="/admin/availability" class="bk-dayform">` +
      `<input type="hidden" name="unit" value="${esc(d.unitId)}">` +
      `<input type="hidden" name="month" value="${m.month}">` +
      `<input type="hidden" name="back" value="foglalasok">` +
      hidden +
      `<button class="bk-day${cls}" type="submit" title="${esc(label)}" aria-label="${esc(label)}">${c.dom}</button>` +
      `</form>`
    );
  };

  const dows = [
    T(lang, "H"), T(lang, "K"), T(lang, "Sze"), T(lang, "Cs"),
    T(lang, "P"), T(lang, "Szo"), T(lang, "V"),
  ]
    .map((x) => `<span class="bk-dow">${x}</span>`)
    .join("");

  const unitSelect =
    d.units.length > 1
      ? `<form method="get" action="/admin" class="bk-unitsel">` +
        `<input type="hidden" name="tab" value="foglalasok"><input type="hidden" name="naptar" value="1">` +
        `<select name="u" class="citui-input" onchange="this.form.submit()">` +
        d.units
          .map(
            (u) =>
              `<option value="${esc(u.id)}"${u.id === d.unitId ? " selected" : ""}>${esc(u.name)}</option>`,
          )
          .join("") +
        `</select></form>`
      : "";

  const dayPanel =
    d.openDay && d.openDayBooking
      ? dayPanelCard(d.openDayBooking, lang)
      : "";

  const openQs = d.calendarOpen ? "" : "&naptar=1";
  return (
    `<div class="bk-cal${d.calendarOpen ? " is-open" : ""}" id="naptar">` +
    `<a class="bk-cal__top" href="${tabHref(`${qsBase}${openQs}`)}#naptar" data-bk-caltoggle>` +
    `<span class="bk-cal__ico">${ic("bookings", 20)}</span>` +
    `<span class="bk-cal__t"><b>${T(lang, "Naptár")} — ${esc(m.label)}</b><span>${esc(summary)}</span></span>` +
    `<span class="bk-cal__chev">${ic("close", 16)}</span>` +
    `</a>` +
    `<div class="bk-cal__body">` +
    unitSelect +
    `<div class="bk-cal__hd">` +
    `<a class="bk-cal__nav" href="${tabHref(`&u=${encodeURIComponent(d.unitId)}&ho=${m.prevMonth}&naptar=1`)}#naptar">‹</a>` +
    `<b>${esc(m.label)}</b>` +
    `<a class="bk-cal__nav" href="${tabHref(`&u=${encodeURIComponent(d.unitId)}&ho=${m.nextMonth}&naptar=1`)}#naptar">›</a>` +
    `</div>` +
    `<div class="bk-grid">${dows}${"<span class=\"bk-day bk-day--out\"></span>".repeat(m.leadingBlanks)}${m.cells.map(dayCell).join("")}</div>` +
    dayPanel +
    `<div class="bk-legend">` +
    `<span><i class="bk-lg bk-lg--free"></i>${T(lang, "szabad — koppintásra blokkolható")}</span>` +
    `<span><i class="bk-lg bk-lg--booked"></i>${T(lang, "vendég-foglalás — koppintásra lemondható")}</span>` +
    `<span><i class="bk-lg bk-lg--manual"></i>${T(lang, "kézzel blokkolva")}</span>` +
    (m.importedCount
      ? `<span><i class="bk-lg bk-lg--ical"></i>${T(lang, "portál-naptárból")}</span>`
      : "") +
    `</div>` +
    `</div></div>`
  );
}

/** The booked day's panel: whose stay it is + the owner's cancel (approved ⑦). */
function dayPanelCard(b: InboxItem, lang: string): string {
  return (
    `<div class="bk-dayinfo">` +
    `<b>${esc(b.guestName)}</b>` +
    `<span>${esc(huDay(b.dateFrom))} — ${esc(huDay(b.dateTo))} · ${T(lang, "{n} éj", { n: nightsOf(b) })} · ${T(lang, "{n} fő", { n: b.guests })}${
      b.quotedTotal ? ` · <b>${esc(formatAmount(b.quotedTotal, b.quotedCurrency ?? "HUF"))}</b>` : ""
    }</span>` +
    (b.decisionNote
      ? `<span>${T(lang, "Üzenet a vendégnek:")} „${esc(b.decisionNote)}"</span>`
      : "") +
    `<span>${esc(b.guestEmail)}${b.guestPhone ? ` · ${esc(b.guestPhone)}` : ""}</span>` +
    cancelForm(b, lang, T(lang, "Foglalás lemondása")) +
    `</div>`
  );
}

/** Reveal-style cancel form (confirm() guards the irreversible step). */
function cancelForm(b: InboxItem, lang: string, label: string): string {
  return (
    `<details class="bk-cancel"><summary>${esc(label)}</summary>` +
    // ⚠️ The JSON.stringify output is DOUBLE-quoted — raw inside a double-quoted
    // onsubmit attribute it terminated the attribute early, the handler became a
    // SyntaxError, and the confirm() SILENTLY never ran (Elek FK-007 H-lelet:
    // green "Lemondva" with a broken guard). esc() turns the quotes into &quot;.
    `<form method="post" action="/admin/booking/cancel" ` +
    `onsubmit="return confirm(${esc(
      JSON.stringify(
        T(lang, "Biztosan lemondja {name} visszaigazolt foglalását? A napok felszabadulnak, a vendég lemondó e-mailt kap. Ez nem vonható vissza.", { name: b.guestName }),
      ),
    )})">` +
    `<input type="hidden" name="id" value="${esc(b.id)}">` +
    `<label>${T(lang, "Rövid indoklás a vendégnek küldött levélbe (nem kötelező)")}</label>` +
    `<textarea name="uzenet" maxlength="1000"></textarea>` +
    `<div class="bk-row">` +
    `<button type="submit" class="citui-btn bk-btn--danger">${T(lang, "Lemondom a foglalást")}</button>` +
    `</div></form></details>`
  );
}

/* ── summary tiles + panels ────────────────────────────────────────────── */

function tiles(d: BookingsTabData, pend: InboxItem[], arrivals: InboxItem[], lang: string): string {
  const qs = `&u=${encodeURIComponent(d.unitId)}&ho=${d.month.month}${d.calendarOpen ? "&naptar=1" : ""}`;
  const tile = (key: string, label: string, value: string): string =>
    `<a class="bk-tile${d.panel === key ? " is-on" : ""}" ` +
    `href="${tabHref(d.panel === key ? qs : `${qs}&panel=${key}`)}#osszegzo">` +
    `<span class="bk-tile__l">${label}</span><span class="bk-tile__v">${value}</span></a>`;

  const next = arrivals[0];
  return (
    `<div class="bk-tiles" id="osszegzo">` +
    tile("pend", T(lang, "Döntésre vár"), T(lang, "{n} kérés", { n: pend.length })) +
    tile("arr", T(lang, "Következő érkezés"), next ? huShort(next.dateFrom, lang) : "—") +
    tile("year", T(lang, "Idén visszaigazolt"), T(lang, "{n} foglalás", { n: d.yearAccepted })) +
    `</div>` +
    tilePanel(d, pend, arrivals, lang)
  );
}

function tilePanel(d: BookingsTabData, pend: InboxItem[], arrivals: InboxItem[], lang: string): string {
  if (!d.panel) return "";
  const row = (main: string, sub: string, right: string, href?: string): string =>
    `<${href ? `a href="${href}"` : "div"} class="bk-prow">` +
    `<div class="bk-prow__t"><b>${main}</b><span>${sub}</span></div>` +
    `<div class="bk-prow__r">${right}</div></${href ? "a" : "div"}>`;

  if (d.panel === "pend") {
    if (!pend.length)
      return `<div class="bk-panel"><div class="bk-panel__more">${T(lang, "Nincs döntésre váró kérés.")} ✔</div></div>`;
    return (
      `<div class="bk-panel">` +
      pend
        .map((r) => {
          const left = hoursLeft(r, d.expireHours);
          return row(
            esc(r.guestName),
            `${esc(huDay(r.dateFrom))} → ${esc(huDay(r.dateTo))} · ${T(lang, "{n} fő", { n: r.guests })}`,
            left != null
              ? `<span class="bk-deadline">${ic("clock", 12)}${T(lang, "még {n} óra", { n: left })}</span>`
              : "",
            `#req-${r.id}`,
          );
        })
        .join("") +
      `<div class="bk-panel__more">${T(lang, "Koppintson egy sorra — a kéréshez ugrik.")}</div></div>`
    );
  }
  if (d.panel === "arr") {
    if (!arrivals.length)
      return `<div class="bk-panel"><div class="bk-panel__more">${T(lang, "Nincs közelgő érkezés.")}</div></div>`;
    return (
      `<div class="bk-panel">` +
      arrivals
        .map((r) =>
          row(
            esc(r.guestName),
            `${esc(huDay(r.dateFrom))} — ${esc(huDay(r.dateTo))} · ${T(lang, "{n} fő", { n: r.guests })}`,
            `<span class="bk-chip bk-chip--ok">${esc(huShort(r.dateFrom, lang))}</span>`,
            tabHref(
              `&u=${encodeURIComponent(r.unitName ? d.unitId : d.unitId)}&ho=${r.dateFrom.slice(0, 7)}&naptar=1&nap=${r.dateFrom}#naptar`,
            ),
          ),
        )
        .join("") +
      `<div class="bk-panel__more">${T(lang, "Koppintson egy sorra — a naptár a foglalásra nyílik.")}</div></div>`
    );
  }
  // year
  const yearNow = new Date().getFullYear();
  const acc = d.requests.filter(
    (r) =>
      r.status === "accepted" &&
      r.decidedAt &&
      r.decidedAt.getFullYear() === yearNow,
  );
  return (
    `<div class="bk-panel">` +
    (acc.length
      ? acc
          .map((r) =>
            row(
              esc(r.guestName),
              `${esc(huDay(r.dateFrom))} — ${esc(huDay(r.dateTo))} · ${T(lang, "{n} fő", { n: r.guests })}`,
              `<span class="bk-chip bk-chip--ok">${T(lang, "Visszaigazolva")}</span>`,
            ),
          )
          .join("")
      : `<div class="bk-panel__more">${T(lang, "Idén még nincs visszaigazolt foglalás.")}</div>`) +
    `</div>`
  );
}

/* ── request cards + history ───────────────────────────────────────────── */

function requestCard(
  r: InboxItem,
  overlaps: InboxItem[] | undefined,
  expireHours: number,
  lang: string,
): string {
  const left = hoursLeft(r, expireHours);
  const fresh = !r.seen;
  const conflictNote = overlaps?.length
    ? `<span class="bk-conflict">${ic("alert", 13)}${T(lang, "Fedés: az időszakot {names} is kéri — visszaigazoláskor a rendszer választatni fog.", { names: overlaps.map((o) => o.guestName).join(", ") })}</span>`
    : "";

  const verdictPanel = (accept: boolean): string =>
    `<details class="bk-verdict"><summary class="${accept ? "bk-btn--ok" : "bk-btn--ghost"}">` +
    `${ic(accept ? "check" : "close", 15)}${accept ? T(lang, "Visszaigazolom") : T(lang, "Elutasítom")}</summary>` +
    `<form method="post" action="/admin/booking/decide"${accept && overlaps?.length ? ` data-bk-overlap="${esc(r.id)}"` : ""}>` +
    `<input type="hidden" name="token" value="${esc(r.token)}">` +
    `<input type="hidden" name="verdict" value="${accept ? "accepted" : "declined"}">` +
    `<label>${accept ? T(lang, "Üzenet a vendégnek a visszaigazoló levélbe (nem kötelező)") : T(lang, "Miért utasítja el? (a vendég ezt olvassa majd — nem kötelező)")}</label>` +
    `<textarea name="uzenet" maxlength="1000"></textarea>` +
    `<p class="bk-hint">${
      accept
        ? T(lang, "A visszaigazolással a napok foglalttá válnak a naptárban, a vendég e-mailt kap naptár-melléklettel, benne az Ön üzenetével és a lemondó-linkkel.")
        : T(lang, "A vendég udvarias elutasító e-mailt kap; ha ír ide üzenetet, az bekerül a levélbe. A napok szabadok maradnak.")
    }</p>` +
    `<div class="bk-row"><button type="submit" class="citui-btn ${accept ? "bk-btn--ok" : "bk-btn--danger"}">` +
    `${accept ? T(lang, "Megerősítem a visszaigazolást") : T(lang, "Elutasítás küldése")}</button></div>` +
    `</form></details>`;

  return (
    `<div class="bk-req${fresh ? " is-new" : ""}" id="req-${esc(r.id)}">` +
    `<div class="bk-req__hd">` +
    `<span class="bk-req__ico">${ic("account", 20)}</span>` +
    `<div class="bk-req__t">` +
    `<strong>${esc(r.guestName)}</strong>` +
    `<span class="bk-req__dates">${esc(huDay(r.dateFrom))} → ${esc(huDay(r.dateTo))} · ${T(lang, "{n} éj", { n: nightsOf(r) })} · ${T(lang, "{n} fő", { n: r.guests })}${
      r.quotedTotal ? ` · <b>${esc(formatAmount(r.quotedTotal, r.quotedCurrency ?? "HUF"))}</b>` : ""
    }</span>` +
    `<span class="bk-req__meta">${esc(r.guestEmail)}${r.guestPhone ? ` · ${esc(r.guestPhone)}` : ""}${r.unitName ? ` · ${esc(r.unitName)}` : ""}</span>` +
    (left != null
      ? `<span class="bk-deadline">${ic("clock", 13)}${T(lang, "Válasz-határidő: még {n} óra", { n: left })}</span> `
      : "") +
    conflictNote +
    `</div></div>` +
    (r.message ? `<div class="bk-req__msg">„${esc(r.message)}"</div>` : "") +
    `<div class="bk-req__act">${verdictPanel(true)}${verdictPanel(false)}</div>` +
    `</div>`
  );
}

function historyRow(r: InboxItem, lang: string): string {
  const chip: Record<string, [string, string]> = {
    accepted: ["bk-chip--ok", T(lang, "Visszaigazolva")],
    declined: [
      "bk-chip--bad",
      r.decidedBy === "auto" ? T(lang, "Elutasítva (automatikus)") : T(lang, "Elutasítva"),
    ],
    expired: ["bk-chip--mut", T(lang, "Lejárt ({n} óra)", { n: 48 })],
    cancelled: [
      "bk-chip--bad",
      r.decidedBy === "guest" ? T(lang, "A vendég lemondta") : T(lang, "Lemondva"),
    ],
  };
  const [cls, label] = chip[r.status] ?? ["bk-chip--mut", esc(r.status)];
  const decided = r.decidedAt ? ` · ${T(lang, "döntés:")} ${esc(huShort(r.decidedAt.toISOString().slice(0, 10), lang))}` : "";
  return (
    `<div class="bk-hist">` +
    `<div class="bk-hist__t"><strong>${esc(r.guestName)}</strong>` +
    `<span>${esc(huDay(r.dateFrom))} — ${esc(huDay(r.dateTo))} · ${T(lang, "{n} éj", { n: nightsOf(r) })} · ${T(lang, "{n} fő", { n: r.guests })}${
      r.quotedTotal ? ` · ${esc(formatAmount(r.quotedTotal, r.quotedCurrency ?? "HUF"))}` : ""
    }${decided}</span>` +
    (r.decisionNote ? `<div class="bk-hist__note">„${esc(r.decisionNote)}"</div>` : "") +
    `</div>` +
    `<div class="bk-hist__r"><span class="bk-chip ${cls}">${label}</span>` +
    (r.status === "accepted" ? cancelForm(r, lang, T(lang, "Lemondom")) : "") +
    `</div></div>`
  );
}

/* ── the tab ───────────────────────────────────────────────────────────── */

export function bookingsSection(d: BookingsTabData, lang = "hu"): string {
  const pend = pendingInOrder(d.requests);
  const groups = overlapGroups(pend);
  const today = new Date().toISOString().slice(0, 10);
  const arrivals = d.requests
    .filter((r) => r.status === "accepted" && r.dateFrom >= today)
    .sort((a, b) => (a.dateFrom < b.dateFrom ? -1 : 1));
  const decided = d.requests
    .filter((r) => r.status !== "pending")
    .sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0));

  // Overlap popup payload (approved ⑥): per contested request the whole group,
  // TIME-ORDERED (who asked first), with everything the modal shows.
  const popupData: Record<string, unknown[]> = {};
  for (const [id, others] of groups) {
    const self = pend.find((r) => r.id === id)!;
    popupData[id] = [self, ...others]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => ({
        id: r.id,
        token: r.token,
        name: r.guestName,
        from: r.dateFrom,
        to: r.dateTo,
        nights: nightsOf(r),
        guests: r.guests,
        got: r.createdAt.toISOString(),
      }));
  }

  const intro =
    `<p class="bk-intro">${T(lang, "Itt válaszol a vendégek foglalási kéréseire. A beállítások (értesítési címek, portál-naptárkapcsolat) a")} ` +
    `<a href="/admin?tab=modulok&m=booking">${T(lang, "Modulok → Foglalás")}</a> ${T(lang, "alatt vannak.")}</p>` +
    // ADR-0045 §J: textual guide entry for this screen; the data-kb-anchor is the
    // coverage hook (kb-check) tying the surface to its KB entry.
    `<p class="bk-intro"><a data-kb-anchor="admin.bookings" href="/admin?tab=sugo&topic=${encodeURIComponent("admin.bookings")}">${ic("help", 15)} ${T(lang, "Útmutató ehhez a képernyőhöz")}</a></p>`;

  const note = d.expireHours
    ? `<div class="bk-note">${T(lang, "A vendég minden döntéséről (visszaigazolás, elutasítás, lemondás) automatikus e-mailt kap. Ha {n} órán belül nem válaszol egy kérésre, az lejár, és a vendég udvarias „sajnos nem kaptunk választ” levelet kap.", { n: d.expireHours })}</div>`
    : "";

  return (
    BOOKINGS_STYLE +
    intro +
    calendarCard(d, lang) +
    tiles(d, pend, arrivals, lang) +
    note +
    `<h2 class="bk-sect">${T(lang, "Döntésre váró kérések")}</h2>` +
    (pend.length
      ? pend.map((r) => requestCard(r, groups.get(r.id), d.expireHours, lang)).join("")
      : `<div class="bk-empty">${T(lang, "Most nincs döntésre váró kérés.")} ✔<br>${T(lang, "Az újakról e-mailt is kap.")}</div>`) +
    `<h2 class="bk-sect">${T(lang, "Korábbi kérések")}</h2>` +
    (decided.length
      ? decided.map((r) => historyRow(r, lang)).join("")
      : `<div class="bk-empty">${T(lang, "Még nincs eldöntött kérés.")}</div>`) +
    overlapScript(popupData, lang)
  );
}

/* ── overlap popup (approved ⑥) — the only JS-required piece ───────────── */

function overlapScript(popupData: Record<string, unknown[]>, lang: string): string {
  if (!Object.keys(popupData).length) return "";
  const L = {
    title: T(lang, "Többen kérik ugyanazt az időszakot"),
    sub: T(lang, "A színek mutatják, ki melyik éjszakákat kéri (időrendben — ki kérte előbb). Válassza ki, KINEK igazolja vissza: a többi fedésben lévő kérés automatikusan elutasításra kerül."),
    pick: T(lang, "Ezt választom"),
    picked: T(lang, "✓ Ő kapja"),
    warn1: T(lang, "automatikusan elutasításra kerül:"),
    warnTail: T(lang, "A vendégek udvarias e-mailt kapnak arról, hogy az időszak betelt."),
    noteLabel: T(lang, "Üzenet a visszaigazolt vendégnek (nem kötelező)"),
    confirmBtn: T(lang, "Visszaigazolom — a többit elutasítom"),
    cancelBtn: T(lang, "Mégsem"),
    confirmQ: T(lang, "Megerősíti? A választott foglalás visszaigazolásra, a többi fedő kérés automatikusan elutasításra kerül — minden vendég e-mailt kap."),
    nights: T(lang, "éj"),
    guests: T(lang, "fő"),
    asked: T(lang, "kérte:"),
    req: T(lang, "kérés"),
    dows: [T(lang, "H"), T(lang, "K"), T(lang, "Sze"), T(lang, "Cs"), T(lang, "P"), T(lang, "Szo"), T(lang, "V")],
  };
  return (
    `<script>(function(){` +
    `var G=${JSON.stringify(popupData)},L=${JSON.stringify(L)};` +
    `var C=["var(--citui-cyan-500)","var(--citui-warn)","var(--citui-navy-700)"];` +
    `function nights(f,t){var o=[];for(var d=new Date(f+"T00:00:00Z");d.toISOString().slice(0,10)<t;d.setUTCDate(d.getUTCDate()+1))o.push(d.toISOString().slice(0,10));return o;}` +
    `function calGrid(g){var f=g[0].from;for(var i=1;i<g.length;i++)if(g[i].from<f)f=g[i].from;` +
    `var y=+f.slice(0,4),m=+f.slice(5,7)-1,days=new Date(Date.UTC(y,m+1,0)).getUTCDate(),lead=(new Date(Date.UTC(y,m,1)).getUTCDay()+6)%7;` +
    `var cover={};g.forEach(function(r,i){nights(r.from,r.to).forEach(function(d){(cover[d]=cover[d]||[]).push(i);});});` +
    `var h=L.dows.map(function(x){return '<span class="bk-ovdow">'+x+'</span>';}).join('');` +
    `for(var b=0;b<lead;b++)h+='<span class="bk-ovday" style="opacity:.25"></span>';` +
    `for(var d=1;d<=days;d++){var k=f.slice(0,7)+"-"+String(d).padStart(2,"0"),cv=cover[k]||[],st="";` +
    `if(cv.length===1)st='background:color-mix(in srgb,'+C[cv[0]%3]+' 30%,var(--citui-white));font-weight:800';` +
    `else if(cv.length>1)st='background:linear-gradient(135deg,color-mix(in srgb,'+C[cv[0]%3]+' 34%,var(--citui-white)) 50%,color-mix(in srgb,'+C[cv[1]%3]+' 34%,var(--citui-white)) 50%);font-weight:800';` +
    `h+='<span class="bk-ovday" style="'+st+'">'+d+'</span>';}` +
    `return '<div class="bk-ovgrid">'+h+'</div>';}` +
    `function fmt(d){return d.slice(0,4)+". "+d.slice(5,7)+". "+d.slice(8,10)+".";}` +
    `function open(form,id){var g=G[id];if(!g)return true;var chosen=id;` +
    `var preNote=(form.querySelector('[name=uzenet]')||{}).value||"";` +
    `var ov=document.createElement("div");ov.className="bk-ovl";` +
    `function render(){var losers=g.filter(function(r){return r.id!==chosen;});` +
    `ov.innerHTML='<div class="bk-ovm"><h3>'+L.title+'</h3><p class="bk-ovsub">'+L.sub+'</p>'+calGrid(g)+` +
    `g.map(function(r,i){var sel=r.id===chosen;` +
    `return '<div class="bk-ovreq'+(sel?' is-sel':'')+'" data-id="'+r.id+'">'+` +
    `'<span class="bk-ovord" style="background:'+C[i%3]+'">'+(i+1)+'.</span>'+` +
    `'<span class="bk-ovt"><b>'+r.name+'</b><span>'+fmt(r.from)+' → '+fmt(r.to)+' · '+r.nights+' '+L.nights+' · '+r.guests+' '+L.guests+' · '+L.asked+' '+r.got.slice(11,16)+'</span></span>'+` +
    `'<span class="bk-ovpick">'+(sel?L.picked:L.pick)+'</span></div>';}).join('')+` +
    `'<div class="bk-ovwarn"><b>'+losers.length+' '+L.req+' '+L.warn1+'</b> '+losers.map(function(r){return r.name;}).join(', ')+'. '+L.warnTail+'</div>'+` +
    `'<label class="bk-ovlabel">'+L.noteLabel+'</label><textarea class="bk-ovnote" maxlength="1000"></textarea>'+` +
    `'<div class="bk-ovrow"><button type="button" class="citui-btn bk-btn--ok" data-ok>'+L.confirmBtn+'</button>'+` +
    `'<button type="button" class="citui-btn bk-btn--ghost" data-no>'+L.cancelBtn+'</button></div></div>';` +
    `ov.querySelector(".bk-ovnote").value=preNote;` +
    `ov.querySelectorAll(".bk-ovreq").forEach(function(el){el.addEventListener("click",function(){chosen=el.getAttribute("data-id");preNote=ov.querySelector(".bk-ovnote").value;render();});});` +
    `ov.querySelector("[data-no]").addEventListener("click",function(){ov.remove();});` +
    `ov.querySelector("[data-ok]").addEventListener("click",function(){` +
    `if(!confirm(L.confirmQ))return;` +
    `var win=g.filter(function(r){return r.id===chosen;})[0];` +
    `form.querySelector('[name=token]').value=win.token;` +
    `form.querySelector('[name=uzenet]').value=ov.querySelector('.bk-ovnote').value;` +
    `form.removeAttribute("data-bk-overlap");form.submit();});}` +
    `render();document.body.appendChild(ov);return false;}` +
    `document.querySelectorAll("form[data-bk-overlap]").forEach(function(f){` +
    `f.addEventListener("submit",function(e){e.preventDefault();open(f,f.getAttribute("data-bk-overlap"));});});` +
    `})();</script>`
  );
}

/* ── styles (citui tokens only — design-token doctrine) ─────────────────── */

export const BOOKINGS_STYLE = `<style>
.bk-intro{color:var(--citui-muted);font-size:.92rem;line-height:1.55;margin:0 0 14px}
.bk-intro a{color:var(--citui-cyan-500);font-weight:700}
/* collapsible calendar */
.bk-cal{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:16px;
  box-shadow:var(--citui-shadow-sm);padding:14px;margin-bottom:14px}
.bk-cal__top{display:flex;align-items:center;gap:11px;text-decoration:none;color:inherit}
.bk-cal__ico{flex:0 0 auto;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;
  background:var(--citui-surface-2);color:var(--citui-navy-700)}
.bk-cal__t{flex:1;min-width:0}
.bk-cal__t b{display:block;font-size:.98rem}
.bk-cal__t span{display:block;font-size:.8rem;color:var(--citui-muted);margin-top:1px}
.bk-cal__chev{flex:0 0 auto;color:var(--citui-muted);transform:rotate(45deg);transition:transform .2s}
.bk-cal.is-open .bk-cal__chev{transform:rotate(0)}
.bk-cal__body{display:none;margin-top:13px}
.bk-cal.is-open .bk-cal__body{display:block}
.bk-unitsel{margin-bottom:10px}
.bk-cal__hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.bk-cal__hd b{font-size:1rem}
.bk-cal__nav{display:grid;place-items:center;width:34px;height:34px;border:1.5px solid var(--citui-line);
  border-radius:10px;text-decoration:none;color:var(--citui-navy-900);font-weight:800}
.bk-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.bk-dow{font-size:.68rem;font-weight:700;color:var(--citui-muted);text-align:center;padding:4px 0}
.bk-dayform{display:contents}
.bk-day{aspect-ratio:1;border-radius:9px;display:grid;place-items:center;font-size:.8rem;font-weight:600;
  background:var(--citui-surface-2);color:var(--citui-ink);border:1.5px solid transparent;width:100%;
  cursor:pointer;text-decoration:none;font-family:inherit;padding:0}
.bk-day:hover{border-color:var(--citui-cyan-500)}
.bk-day--past{opacity:.35;cursor:default;pointer-events:none}
.bk-day--out{background:transparent;pointer-events:none}
.bk-day--booked{background:color-mix(in srgb,var(--citui-ok) 22%,var(--citui-white));color:var(--citui-ok)}
.bk-day--sel{border-color:var(--citui-ok)}
.bk-day--manual{background:var(--citui-navy-900);color:var(--citui-white)}
.bk-day--ical{background:color-mix(in srgb,var(--citui-warn) 26%,var(--citui-white));color:var(--citui-warn);cursor:help}
/* ADR-0114: held by ANOTHER unit — striped, not tappable, same language as the
   module screen so the two calendars cannot tell the owner different things. */
.bk-day--linked{cursor:help;color:var(--citui-ink);
  background:repeating-linear-gradient(135deg,var(--citui-surface-2),var(--citui-surface-2) 5px,
    color-mix(in srgb,var(--citui-navy-800) 18%,transparent) 5px,
    color-mix(in srgb,var(--citui-navy-800) 18%,transparent) 10px)}
.bk-legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:11px;font-size:.72rem;color:var(--citui-muted)}
.bk-lg{display:inline-block;width:12px;height:12px;border-radius:4px;margin-right:5px;vertical-align:-1px}
.bk-lg--free{background:var(--citui-surface-2)}
.bk-lg--booked{background:color-mix(in srgb,var(--citui-ok) 22%,var(--citui-white))}
.bk-lg--manual{background:var(--citui-navy-900)}
.bk-lg--ical{background:color-mix(in srgb,var(--citui-warn) 26%,var(--citui-white))}
.bk-dayinfo{margin-top:11px;border:1px solid color-mix(in srgb,var(--citui-ok) 35%,transparent);
  background:var(--citui-ok-soft);border-radius:12px;padding:12px 13px}
.bk-dayinfo>b{display:block;font-size:.92rem;margin-bottom:2px}
.bk-dayinfo>span{display:block;font-size:.8rem;color:var(--citui-ink);line-height:1.5}
/* tiles */
.bk-tiles{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px}
@media(min-width:760px){.bk-tiles{grid-template-columns:repeat(3,1fr)}}
.bk-tile{background:var(--citui-surface-2);border-radius:var(--citui-radius-sm);padding:10px 26px 10px 12px;
  border:1.5px solid transparent;position:relative;text-decoration:none;color:inherit;display:block}
.bk-tile:hover{border-color:var(--citui-cyan-500)}
.bk-tile.is-on{border-color:var(--citui-cyan-500);background:color-mix(in srgb,var(--citui-cyan-500) 9%,var(--citui-white))}
.bk-tile::after{content:"";position:absolute;right:11px;top:50%;width:7px;height:7px;margin-top:-6px;
  border-right:2px solid var(--citui-muted);border-bottom:2px solid var(--citui-muted);transform:rotate(45deg)}
.bk-tile.is-on::after{transform:rotate(225deg);margin-top:-2px}
.bk-tile__l{display:block;font-size:.72rem;font-weight:600;color:var(--citui-muted)}
.bk-tile__v{display:block;font-size:1.02rem;font-weight:700;color:var(--citui-navy-900)}
.bk-panel{background:var(--citui-white);border:1px solid color-mix(in srgb,var(--citui-cyan-500) 35%,transparent);
  border-radius:13px;padding:6px 8px;margin-bottom:14px;box-shadow:var(--citui-shadow-sm)}
.bk-prow{display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:9px;text-decoration:none;color:inherit}
.bk-prow:hover{background:var(--citui-surface)}
.bk-prow+.bk-prow{border-top:1px solid var(--citui-line)}
.bk-prow__t{flex:1;min-width:0}
.bk-prow__t b{display:block;font-size:.87rem}
.bk-prow__t span{display:block;font-size:.77rem;color:var(--citui-muted);margin-top:1px}
.bk-prow__r{margin-left:auto;flex:0 0 auto}
.bk-panel__more{padding:9px 8px;font-size:.77rem;color:var(--citui-muted);text-align:center}
.bk-note{background:color-mix(in srgb,var(--citui-cyan-500) 8%,var(--citui-white));
  border:1px solid color-mix(in srgb,var(--citui-cyan-500) 30%,transparent);
  border-radius:11px;padding:11px 13px;font-size:.8rem;line-height:1.55;color:var(--citui-ink);margin-bottom:14px}
.bk-sect{font-size:.8rem;font-weight:700;color:var(--citui-muted);text-transform:uppercase;
  letter-spacing:.06em;margin:20px 0 10px}
/* request cards */
.bk-req{border:1px solid var(--citui-line);border-radius:15px;margin-bottom:11px;background:var(--citui-white)}
.bk-req.is-new{border-color:color-mix(in srgb,var(--citui-cyan-500) 45%,transparent);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--citui-cyan-500) 9%,transparent)}
.bk-req__hd{display:flex;gap:11px;align-items:flex-start;padding:13px 14px}
.bk-req__ico{flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;
  background:var(--citui-surface-2);color:var(--citui-navy-700)}
.bk-req__t{flex:1;min-width:0}
.bk-req__t strong{display:block;font-size:.97rem}
.bk-req__dates{display:block;font-size:.85rem;font-weight:600;margin-top:2px}
.bk-req__meta{display:block;font-size:.78rem;color:var(--citui-muted);margin-top:2px;line-height:1.5}
.bk-deadline{display:inline-flex;align-items:center;gap:5px;font-size:.72rem;font-weight:700;
  border-radius:999px;padding:5px 10px;margin-top:6px;
  background:color-mix(in srgb,var(--citui-warn) 14%,var(--citui-white));color:var(--citui-warn)}
.bk-conflict{display:inline-flex;align-items:flex-start;gap:6px;font-size:.74rem;font-weight:700;line-height:1.45;
  border-radius:11px;padding:7px 11px;margin-top:6px;
  background:color-mix(in srgb,var(--citui-bad) 12%,var(--citui-white));color:var(--citui-bad)}
.bk-req__msg{background:var(--citui-surface-2);border-radius:10px;padding:10px 12px;margin:0 14px 12px;
  font-size:.83rem;line-height:1.55;color:var(--citui-ink)}
.bk-req__act{display:flex;gap:8px;padding:0 14px 14px;flex-wrap:wrap}
.bk-verdict{flex:1 1 45%}
.bk-verdict summary{list-style:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;
  border-radius:999px;padding:11px 18px;font-size:.84rem;font-weight:700;cursor:pointer;width:100%;
  box-sizing:border-box;min-height:40px}
.bk-verdict summary::-webkit-details-marker{display:none}
.bk-btn--ok{background:var(--citui-ok);color:var(--citui-white);border:0}
.bk-btn--ghost{background:var(--citui-white);color:var(--citui-navy-900);border:1.5px solid var(--citui-line-strong)}
.bk-btn--danger{background:var(--citui-bad);color:var(--citui-white);border:0}
.bk-verdict form,.bk-cancel form{border-top:1px dashed var(--citui-line);margin-top:10px;padding-top:10px}
.bk-verdict label,.bk-cancel label{display:block;font-size:.78rem;font-weight:700;margin-bottom:6px}
.bk-verdict textarea,.bk-cancel textarea{width:100%;box-sizing:border-box;border:1.5px solid var(--citui-line);
  border-radius:11px;padding:10px 12px;font:inherit;min-height:64px;resize:vertical}
.bk-verdict textarea:focus,.bk-cancel textarea:focus{outline:none;border-color:var(--citui-cyan-500)}
.bk-hint{font-size:.75rem;color:var(--citui-muted);margin:6px 0 10px;line-height:1.5}
.bk-row{display:flex;gap:8px;flex-wrap:wrap}
/* history */
.bk-hist{display:flex;align-items:flex-start;gap:11px;padding:12px 14px;border:1px solid var(--citui-line);
  border-radius:13px;margin-bottom:8px;background:var(--citui-white)}
.bk-hist__t{flex:1;min-width:0}
.bk-hist__t strong{display:block;font-size:.88rem}
.bk-hist__t span{display:block;color:var(--citui-muted);font-size:.77rem;margin-top:1px}
.bk-hist__note{font-size:.77rem;color:var(--citui-ink);background:var(--citui-surface-2);border-radius:8px;
  padding:7px 10px;margin-top:6px;line-height:1.45}
.bk-hist__r{flex:0 0 auto;text-align:right}
.bk-chip{display:inline-block;font-size:.7rem;font-weight:700;border-radius:999px;padding:4px 9px;white-space:nowrap}
.bk-chip--ok{background:var(--citui-ok-soft);color:var(--citui-ok)}
.bk-chip--bad{background:color-mix(in srgb,var(--citui-bad) 12%,var(--citui-white));color:var(--citui-bad)}
.bk-chip--mut{background:var(--citui-surface-2);color:var(--citui-muted)}
.bk-cancel summary{list-style:none;color:var(--citui-muted);font-size:.74rem;font-weight:700;
  text-decoration:underline;cursor:pointer;margin-top:5px}
.bk-cancel summary::-webkit-details-marker{display:none}
.bk-cancel summary:hover{color:var(--citui-bad)}
.bk-hist .bk-cancel form{text-align:left;min-width:230px}
.bk-empty{text-align:center;color:var(--citui-muted);font-size:.86rem;padding:26px 10px;line-height:1.6;
  background:var(--citui-white);border:1px dashed var(--citui-line-strong);border-radius:13px}
/* overlap popup */
.bk-ovl{position:fixed;inset:0;background:color-mix(in srgb,var(--citui-navy-950) 55%,transparent);
  z-index:60;display:grid;place-items:center;padding:14px}
.bk-ovm{background:var(--citui-white);border-radius:18px;box-shadow:var(--citui-shadow-md);width:100%;
  max-width:560px;max-height:92vh;overflow:auto;padding:18px 16px;box-sizing:border-box}
.bk-ovm h3{margin:0 0 4px;font-size:1.1rem;color:var(--citui-navy-900)}
.bk-ovsub{font-size:.83rem;color:var(--citui-muted);line-height:1.55;margin:0 0 13px}
.bk-ovgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px}
.bk-ovdow{font-size:.68rem;font-weight:700;color:var(--citui-muted);text-align:center;padding:4px 0}
.bk-ovday{aspect-ratio:1;border-radius:9px;display:grid;place-items:center;font-size:.8rem;font-weight:600;
  background:var(--citui-surface-2)}
.bk-ovreq{display:flex;align-items:flex-start;gap:10px;border:1.5px solid var(--citui-line);border-radius:13px;
  padding:11px 12px;margin-top:9px;cursor:pointer}
.bk-ovreq:hover{border-color:var(--citui-cyan-500)}
.bk-ovreq.is-sel{border-color:var(--citui-ok);background:color-mix(in srgb,var(--citui-ok) 7%,var(--citui-white))}
.bk-ovord{flex:0 0 auto;width:26px;height:26px;border-radius:999px;display:grid;place-items:center;
  font-size:.78rem;font-weight:800;color:var(--citui-white)}
.bk-ovt{flex:1;min-width:0}
.bk-ovt b{display:block;font-size:.9rem}
.bk-ovt span{display:block;font-size:.77rem;color:var(--citui-muted);margin-top:1px;line-height:1.5}
.bk-ovpick{flex:0 0 auto;border:1.5px solid var(--citui-line-strong);border-radius:999px;
  padding:8px 13px;font-size:.76rem;font-weight:700;color:var(--citui-navy-900)}
.bk-ovreq.is-sel .bk-ovpick{background:var(--citui-ok);border-color:var(--citui-ok);color:var(--citui-white)}
.bk-ovwarn{background:color-mix(in srgb,var(--citui-bad) 8%,var(--citui-white));
  border:1px solid color-mix(in srgb,var(--citui-bad) 30%,transparent);border-radius:12px;
  padding:12px 13px;font-size:.82rem;line-height:1.6;margin-top:12px}
.bk-ovlabel{display:block;font-size:.78rem;font-weight:700;margin-top:11px;margin-bottom:6px}
.bk-ovnote{width:100%;box-sizing:border-box;border:1.5px solid var(--citui-line);border-radius:11px;
  padding:10px 12px;font:inherit;min-height:56px;resize:vertical}
.bk-ovrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
</style>`;
