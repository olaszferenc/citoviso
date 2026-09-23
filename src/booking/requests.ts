// Booking requests: guest asks → owner decides → both are told (ADR-0044/b).
//
// The flow is REQUEST-then-CONFIRM by owner decision, not instant booking. For an
// owner with no digital footprint that is the safe shape: nothing is ever committed
// behind their back, and a stale calendar cannot sell a room that is not free.
//
// THE ONE THING THAT MAKES THIS MODULE ALIVE: the owner decides FROM THE E-MAIL.
// Each request carries a single-use token behind an ACCEPT and a DECLINE link, so
// a verdict is one tap with no login. Expecting this segment to sign into an admin
// to approve a booking would leave requests rotting unanswered.
//
// Double booking is prevented in the TRANSACTION, never in the UI: acceptance
// re-checks the nights and writes the day rows in one atomic step, so two requests
// racing for the same nights cannot both win.

import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { tenantSiteUrl } from "../domains.js";
import { getEmailSender } from "../email/sender.js";
import { T, langForSite, prepareMailLang } from "../i18n/mail.js";
import { effectiveModuleConfig } from "../moduleConfig.js";
import { logTenantMessage } from "../tenant/messages.js";
import { siteRendersModule } from "../tenant/modules.js";
import { blockingUnitIds } from "../tenant/unitScope.js";
import { seasonalOnlyInForce } from "../tenant/seasonalOnly.js";
import {
  addDatedBasePrice,
  formatAmount,
  getUnitPrices,
  priceOn,
  quoteStayFrom,
  seasonCovers,
  setBasePrice,
} from "../tenant/prices.js";
import { seasonRule } from "../tenant/seasonRule.js";
import { buildStayCancelIcs, buildStayIcs } from "./ical.js";

export interface BookingRequestInput {
  readonly siteId: string;
  readonly unitId: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly guestPhone?: string | null;
  /** ISO 'YYYY-MM-DD'; `dateTo` is the departure day (that night is NOT booked). */
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly guests: number;
  readonly message?: string | null;
}

/**
 * Everything the guest must be able to re-read the second after they hit send.
 *
 * Elek FK-007 (2026-09-11): the widget answered a 64 000 Ft request with one
 * sentence — "Elküldtük a kérését. A szállásadó hamarosan visszaigazolja." — no
 * dates, no nights, no headcount, no price, no reference, and not a word about the
 * 48-hour clock already ticking on the owner's side. "Hamarosan" is not a promise
 * the guest can hold us to. These fields come from the SERVER's frozen quote, so
 * the number on screen is the one ON the request — not a second computation that
 * could disagree with it.
 */
export interface BookingSummary {
  /** Human reference the guest can quote ("FG-3F9A21"); derived from the row id. */
  readonly ref: string;
  readonly unitName: string | null;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly nights: number;
  readonly guests: number;
  /** Where the answer will be sent — the guest's own address, echoed back. */
  readonly guestEmail: string;
  readonly total: number | null;
  readonly currency: string;
  readonly lines: readonly {
    label: string;
    nights: number;
    perNight: number;
    guests: number;
    sum: number;
  }[];
  /** Hours the owner has to answer (0 = the module has no deadline). */
  readonly expireHours: number;
}

export interface CreateResult {
  readonly ok: boolean;
  readonly id?: string;
  /** Present exactly when ok === true — the guest's itemised receipt. */
  readonly summary?: BookingSummary;
  /** Guest-facing messages when ok === false. */
  readonly errors: string[];
}

/**
 * The guest's REFERENCE — the string they read out on the phone, and the one the
 * owner sees on the same request. Derived from the row id, so it needs no column
 * and can never drift from the record it names. The `action_token` is NOT usable
 * for this: it is the cancel link's only secret.
 */
export function bookingRef(id: string): string {
  return `FG-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function nights(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function huDate(iso: string): string {
  return `${iso.slice(0, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;
}

export interface SeasonRules {
  /** The unit is not let during (part of) the requested stay. */
  readonly closed: boolean;
  /** Strictest minimum across the nights requested; null → use the module default. */
  readonly minNights: number | null;
  /** Human list of when it IS let, for the refusal message ("Foglalható: …"). */
  readonly openLabel: string;
}

/**
 * What the SEASONS say about a requested stay (ADR-0049).
 *
 * Checked per NIGHT, not just on the arrival day: a stay may start inside an open
 * season and run out of it, and "the first night was fine" is not a reason to accept
 * the rest. For the same reason the minimum is the STRICTEST of the nights touched —
 * a booking that straddles high season has to satisfy high season.
 */
export async function seasonRulesFor(
  unitId: string,
  dateFrom: string,
  dateTo: string,
): Promise<SeasonRules> {
  // The shared answer (booking on the page AND the switch on) — not the raw column.
  const seasonalOnly = await seasonalOnlyInForce(unitId);
  const prices = await getUnitPrices(unitId);
  const seasons = prices.filter((p) => !p.isBase && p.from && p.to);
  const openLabel = seasons
    .map((s) => `${s.label || ""} (${s.from}–${s.to})`.trim())
    .join(", ");

  let closed = false;
  let strictest: number | null = null;
  const nightCount = Math.max(0, nights(dateFrom, dateTo));
  for (let i = 0; i < nightCount; i++) {
    const day = addDays(dateFrom, i);
    const md = seasonRule.monthDayOf(day); // the shared month-day rule, not a 5th slice
    // 0072: a year-bound season only counts inside its own window.
    const match = seasons.find((s) => seasonRule.inWindow(s, day) && seasonCovers(s.from!, s.to!, md));
    // seasonal_only: a night outside every listed season is simply not for sale.
    if (!match && seasonalOnly) closed = true;
    const min = match?.minNights ?? null;
    if (min && (strictest === null || min > strictest)) strictest = min;
  }
  return { closed, minNights: strictest, openLabel };
}

/** The unit's booking rules, with defaults applied (an unset module still works). */
async function bookingRules(siteId: string): Promise<Record<string, unknown>> {
  const row = await db
    .selectFrom("site_module_config")
    .select(["config", "version"])
    .where("site_id", "=", siteId)
    .where("module", "=", "booking")
    .executeTakeFirst();
  return effectiveModuleConfig("booking", (row?.config ?? null) as Record<string, unknown> | null, null);
}

/**
 * The module's notify addresses as a LIST (approved plan, 2026-09-06 ④): the owner
 * may name several ("recepció + tulaj"), comma/semicolon-separated. Falls back to
 * the tenant's contact e-mail so an unset module still reaches someone.
 */
export function parseNotifyList(configured: unknown, fallback: string | null): string[] {
  const raw = String(configured ?? "").trim();
  const list = raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  if (list.length) return [...new Set(list.map((s) => s.toLowerCase()))];
  return fallback ? [fallback] : [];
}

/** Everything a booking mail needs to know about the site, in one query round. */
interface SiteMailContext {
  readonly tenantId: string | null;
  /** The property's display name — the guest booked with THEM, not with us. */
  readonly hostName: string;
  /** Street address for the calendar event LOCATION (may be missing). */
  readonly address: string | null;
  /** Owner notify addresses (parsed list; [0] doubles as the guest's Reply-To). */
  readonly notifyList: string[];
  readonly lang: string;
  /** autoDeclineHours with default applied (0 = never expires). */
  readonly expireHours: number;
}

async function siteMailContext(siteId: string): Promise<SiteMailContext> {
  const row = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .leftJoin("lead", "lead.id", "tenant.lead_id")
    .leftJoin("tenant_user", "tenant_user.tenant_id", "site.tenant_id")
    .select([
      "site.tenant_id as tenantId",
      "tenant.display_name as hostName",
      "lead.address as address",
      "tenant_user.contact_email as contactEmail",
    ])
    .where("site.id", "=", siteId)
    .executeTakeFirst();
  const rules = await bookingRules(siteId);
  const lang = await prepareMailLang(await langForSite(siteId));
  return {
    tenantId: row?.tenantId ?? null,
    hostName: row?.hostName ?? T(lang, "A szállásadó"),
    address: row?.address ?? null,
    notifyList: parseNotifyList(rules.notifyEmail, row?.contactEmail ?? null),
    lang,
    expireHours: Number(rules.autoDeclineHours ?? 48),
  };
}

/**
 * From/Reply-To identity for GUEST-facing booking mail (approved plan C):
 * the From NAME is the property (the guest booked with them), the address stays
 * our verified sender, and Reply-To routes the guest's answer to the host.
 */
function guestIdentity(ctx: SiteMailContext): {
  fromName: string;
  replyTo?: string;
  fromAddress?: string;
} {
  return {
    fromName: `${ctx.hostName} — Citoviso`,
    ...(ctx.notifyList[0] ? { replyTo: ctx.notifyList[0] } : {}),
    ...(config.bookingFrom ? { fromAddress: config.bookingFrom } : {}),
  };
}

/**
 * The frozen price block for guest mails (owner decree 2026-09-06): breakdown
 * lines + grand total, rendered from what the REQUEST stored — never recomputed,
 * a later price change must not rewrite what the guest was shown.
 */
function quoteBlock(req: RequestRow, lang: string): string {
  if (!req.quoted_total || !req.quoted_lines?.length) return "";
  const cur = req.quoted_currency ?? "HUF";
  const lines = req.quoted_lines
    .map((l) => {
      if (l.nights && l.per_night * Math.max(1, l.guests) * l.nights !== l.sum && l.guests === 1) {
        // per_stay: one price for the whole stay
        return `  ${l.label}: ${T(lang, "a teljes tartózkodásra")} = ${formatAmount(l.sum, cur)}`;
      }
      const per = formatAmount(l.per_night, cur);
      const guests = l.guests > 1 ? ` × ${T(lang, "{n} fő", { n: l.guests })}` : "";
      return `  ${l.label}: ${T(lang, "{n} éj", { n: l.nights })} × ${per}${guests} = ${formatAmount(l.sum, cur)}`;
    })
    .join("\n");
  return (
    // An OFFER's price was set by the owner for this very stay (booking-offer ⑧) —
    // "the price list at booking time" would misdescribe where the number came from.
    `\n${req.offered_at ? T(lang, "Az ajánlott ár:") : T(lang, "Ár (a foglaláskor érvényes árak szerint):")}\n` +
    lines +
    `\n${T(lang, "Összesen:")} ${formatAmount(req.quoted_total, cur)}\n`
  );
}

/**
 * Guard around every booking mail: the DECISION is already committed when the
 * mail goes out, so a transport failure must not abort the rest of the flow —
 * measured (FK-007 first run): an SMTP 553 after the accept left the overlapping
 * loser request pending FOREVER because the auto-decline loop never ran. Loud on
 * stderr; the state machine marches on.
 */
async function mailSafe(label: string, send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (err) {
    console.error(`[booking:mail] ${label} — a levél NEM ment ki:`, err);
  }
}

/** Simple HTML rendering of a plain-text booking mail (shared by every letter). */
function bookingHtml(body: string, quote?: string | null): string {
  const quoted = quote
    ? `<blockquote style="border-left:3px solid #35c4e0;margin:14px 0;padding:8px 14px;` +
      `color:#33495e;font-style:italic">${esc(quote)}</blockquote>`
    : "";
  return `<p style="font-size:16px;line-height:1.7">${esc(body).replace(/\n/g, "<br>")}</p>${quoted}`;
}

/**
 * Record a guest's request. Validated against the owner's rules AND against the
 * live calendar, so an obviously impossible request never reaches the owner's
 * inbox — but acceptance re-checks anyway (see decideRequest).
 */
export async function createBookingRequest(
  input: BookingRequestInput,
  publicBaseUrl: string | null,
): Promise<CreateResult> {
  const errors: string[] = [];
  const { dateFrom, dateTo } = input;
  // ADR-0067: every one of these lands in front of the GUEST on the tenant's own
  // booking form — in the page's language, never Hungarian by default.
  const lang = await prepareMailLang(await langForSite(input.siteId));

  if (!ISO_DAY.test(dateFrom) || !ISO_DAY.test(dateTo)) {
    return { ok: false, errors: [T(lang, "Kérjük, adja meg az érkezés és a távozás napját.")] };
  }
  const n = nights(dateFrom, dateTo);
  if (n < 1) errors.push(T(lang, "A távozás napja az érkezés után kell legyen."));
  if (!input.guestName.trim()) errors.push(T(lang, "Kérjük, adja meg a nevét."));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.guestEmail.trim())) {
    errors.push(T(lang, "Kérjük, adjon meg egy érvényes e-mail címet."));
  }
  // Phone is REQUIRED (owner decree 2026-08-23): this is a request the owner has to
  // confirm, often with a question ("hány éves a gyerek?", "mikor érkeznek?") — and
  // an unanswered e-mail kills the booking. At least 6 digits, so a stray character
  // does not pass as a number; formatting (spaces, +36, dashes) stays the guest's.
  if ((input.guestPhone ?? "").replace(/\D/g, "").length < 6) {
    errors.push(T(lang, "Kérjük, adja meg a telefonszámát — a visszaigazoláshoz szükség lehet rá."));
  }

  const rules = await bookingRules(input.siteId);
  const maxNights = Number(rules.maxNights ?? 30);
  const horizonMonths = Number(rules.horizonMonths ?? 12);
  const leadTimeDays = Number(rules.leadTimeDays ?? 0);

  // ADR-0049 — the SEASON decides two things the site-wide rules cannot: whether the
  // unit is let at all in that part of the year, and how few nights are accepted then
  // (a fortnight in August is not a February weekend). Both hang off the same season
  // rows the owner already fills in for pricing — one list, not two.
  const season = await seasonRulesFor(input.unitId, dateFrom, dateTo);
  if (season.closed) {
    errors.push(
      season.openLabel
        ? T(lang, "Ebben az időszakban nem adjuk ki. Foglalható: {label}.", {
            label: season.openLabel,
          })
        : T(lang, "Ebben az időszakban nem adjuk ki."),
    );
  }
  const minNights = season.minNights ?? Number(rules.minNights ?? 1);

  if (n > 0 && n < minNights) {
    errors.push(T(lang, "Legalább {n} éjszakára lehet foglalni.", { n: minNights }));
  }
  if (n > maxNights) {
    errors.push(T(lang, "Legfeljebb {n} éjszakára lehet foglalni.", { n: maxNights }));
  }
  const earliest = addDays(today(), leadTimeDays);
  if (dateFrom < earliest) {
    errors.push(T(lang, "A legkorábbi foglalható érkezés: {date}.", { date: huDate(earliest) }));
  }
  if (dateFrom > addMonths(today(), horizonMonths)) {
    errors.push(T(lang, "Ennyire előre még nem lehet foglalni."));
  }
  if (errors.length) return { ok: false, errors };

  // Fast rejection on the live calendar. Not the real guard — that is the accept
  // transaction — but it spares the guest a pointless wait and the owner a dead request.
  // ADR-0114: the whole place and its rooms block each other, so this asks about all
  // of the units that stand in the way, not just the one the guest picked.
  const taken = await db
    .selectFrom("availability_day")
    .select("day")
    .where("unit_id", "in", await blockingUnitIds(input.unitId))
    .where("day", ">=", dateFrom)
    .where("day", "<", dateTo)
    .executeTakeFirst();
  if (taken) {
    return {
      ok: false,
      errors: [T(lang, "Sajnos ezek a napok már foglaltak. Válasszon másik időpontot.")],
    };
  }

  // Owner decree 2026-09-06: freeze the price IN FORCE NOW onto the request —
  // seasonal rows win per night; no (complete) price list → no quote anywhere.
  //
  // ⛔⛔ THE PRICE MAY ONLY BE FROZEN IF THE SITE ACTUALLY QUOTES PRICES (ADR-0193).
  // A frozen quote is a BINDING offer: it goes out in the guest's confirmation mail
  // and the guest may hold the owner to it. Measured 2026-09-21 (ADR-0192 ②): with
  // `pricing` cancelled the page showed no price at all and this line still froze
  // 84 000 Ft onto the request — the letter contradicted the site it came from.
  // The booking itself is NOT refused: a request is not a purchase (ADR-0044 §6), and
  // a module the tenant DID pay for (`booking`) must not die with one they did not.
  // §B.17: no number is better than a wrong number.
  const pricingLive = await siteRendersModule(input.siteId, "pricing");
  const pricingRow = pricingLive
    ? await db
        .selectFrom("site_module_config")
        .select("config")
        .where("site_id", "=", input.siteId)
        .where("module", "=", "pricing")
        .executeTakeFirst()
    : null;
  const pricing = effectiveModuleConfig(
    "pricing",
    (pricingRow?.config ?? null) as Record<string, unknown> | null,
    null,
  );
  const quote = pricingLive
    ? quoteStayFrom(await getUnitPrices(input.unitId), {
        dateFrom,
        dateTo,
        guests: Math.max(1, Math.round(input.guests || 1)),
        currency: String(pricing.currency ?? "HUF"),
        unitMode: String(pricing.unit ?? "per_night"),
        baseLabel: T(lang, "Alapár"),
      })
    : null;

  const token = randomBytes(24).toString("base64url");
  const row = await db
    .insertInto("booking_request")
    .values({
      site_id: input.siteId,
      unit_id: input.unitId,
      guest_name: input.guestName.trim().slice(0, 160),
      guest_email: input.guestEmail.trim().slice(0, 200),
      guest_phone: input.guestPhone?.trim().slice(0, 60) || null,
      date_from: dateFrom,
      date_to: dateTo,
      guests: Math.max(1, Math.min(50, Math.round(input.guests || 1))),
      message: input.message?.trim().slice(0, 2000) || null,
      action_token: token,
      ...(quote
        ? {
            quoted_total: quote.total,
            quoted_currency: quote.currency,
            quoted_lines: JSON.stringify(
              quote.lines.map((l) => ({
                label: l.label,
                nights: l.nights,
                per_night: l.perNight,
                guests: l.guests,
                sum: l.sum,
              })),
            ),
          }
        : {}),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  // Fire-and-forget (measured, FK-007: two synchronous Zoho sends held the guest's
  // "Küldés…" spinner >10 s): the request row IS committed — the mails follow.
  void mailSafe("owner-notify", () => notifyOwner(row.id, token, String(rules.notifyEmail ?? ""), publicBaseUrl));
  // Approved plan C ① (owner decision 2026-09-06): the guest gets an immediate
  // "rögzítettük" mail — on-screen confirmation alone dies with the browser tab,
  // and the 48-hour promise needs to live somewhere the guest can re-read it.
  void mailSafe("guest-ack", () => sendGuestAck(row.id));

  const unitRow = await db
    .selectFrom("site_unit")
    .select("name")
    .where("id", "=", input.unitId)
    .executeTakeFirst();
  return {
    ok: true,
    id: row.id,
    summary: {
      ref: bookingRef(row.id),
      unitName: unitRow?.name ?? null,
      dateFrom,
      dateTo,
      nights: n,
      guests: Math.max(1, Math.min(50, Math.round(input.guests || 1))),
      guestEmail: input.guestEmail.trim().slice(0, 200),
      total: quote?.total ?? null,
      currency: quote?.currency ?? String(pricing.currency ?? "HUF"),
      lines: (quote?.lines ?? []).map((l) => ({
        label: l.label,
        nights: l.nights,
        perNight: l.perNight,
        guests: l.guests,
        sum: l.sum,
      })),
      expireHours: Math.max(0, Number(rules.autoDeclineHours ?? 48)),
    },
    errors: [],
  };
}

/** Plan C ①: "kérését rögzítettük" — explicitly NOT a confirmation. */
async function sendGuestAck(id: string): Promise<void> {
  const req = await loadRequest({ id });
  if (!req) return;
  const ctx = await siteMailContext(req.site_id);
  const lang = ctx.lang;
  const from = huDate(dayStr(req.date_from));
  const to = huDate(dayStr(req.date_to));
  const unit = req.unit_name ? ` (${req.unit_name})` : "";

  // Booking-offer ⑭: no frozen price = the guest asked for a QUOTE (the page said so,
  // ADR-0208). The letter must say the same thing the page did, not "foglalási kérés".
  const isQuote = !req.quoted_total;
  const body =
    T(lang, "Kedves {name}!", { name: req.guest_name }) +
    `\n\n` +
    (isQuote
      ? T(lang, "Köszönjük! Az árajánlat-kérése megérkezett a szállásadóhoz{unit}.", { unit }) +
        `\n\n` +
        T(
          lang,
          "A szállásadó e-mailben árajánlatot küld Önnek. A foglalás csak akkor válik véglegessé, ha az ajánlatot elfogadja.",
        )
      : T(lang, "Köszönjük! A foglalási kérése megérkezett a szállásadóhoz{unit}.", { unit }) +
        `\n\n` +
        T(
          lang,
          "A foglalás még nem végleges — a szállásadó személyesen igazolja vissza. Amint döntött, azonnal e-mailt küldünk.",
        )) +
    (ctx.expireHours
      ? `\n` +
        T(lang, "Ha {n} órán belül nem érkezik válasz, arról is értesítjük.", {
          n: ctx.expireHours,
        })
      : "") +
    `\n\n` +
    `${T(lang, "Hivatkozás:")} ${bookingRef(req.id)}\n` +
    `${T(lang, "Érkezés:")} ${from}\n${T(lang, "Távozás:")} ${to}\n` +
    `${T(lang, "Létszám:")} ${T(lang, "{n} fő", { n: req.guests })}\n` +
    quoteBlock(req, lang) +
    `\n` +
    T(lang, "Ha addig kérdése van, válaszoljon erre a levélre — közvetlenül a szállásadónak ír.") +
    `\n\n${ctx.hostName}\n`;

  await getEmailSender().send({
    to: req.guest_email,
    audience: "guest",
    ...guestIdentity(ctx),
    subject: isQuote
      ? T(lang, "Árajánlat-kérését rögzítettük: {from} — {to}", { from, to })
      : T(lang, "Foglalási kérését rögzítettük: {from} — {to}", { from, to }),
    text: body,
    html: bookingHtml(body),
  });
}

interface RequestRow {
  id: string;
  site_id: string;
  unit_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  date_from: unknown;
  date_to: unknown;
  guests: number;
  message: string | null;
  status: string;
  action_token: string;
  created_at: Date;
  quoted_total: number | null;
  quoted_currency: string | null;
  quoted_lines:
    | { label: string; nights: number; per_night: number; guests: number; sum: number }[]
    | null;
  offered_at: Date | null;
  offer_token: string | null;
  decision_note?: string | null;
  unit_name?: string;
}

function dayStr(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 10) : new Date(v as string).toISOString().slice(0, 10);
}

async function loadRequest(where: { id?: string; token?: string }): Promise<RequestRow | null> {
  let q = db
    .selectFrom("booking_request")
    .innerJoin("site_unit", "site_unit.id", "booking_request.unit_id")
    .selectAll("booking_request")
    .select("site_unit.name as unit_name");
  if (where.id) q = q.where("booking_request.id", "=", where.id);
  if (where.token) q = q.where("booking_request.action_token", "=", where.token);
  return ((await q.executeTakeFirst()) as RequestRow | undefined) ?? null;
}

/** Owner's notification, carrying the two one-tap verdict links. */
async function notifyOwner(
  id: string,
  token: string,
  configuredEmail: string,
  publicBaseUrl: string | null,
): Promise<void> {
  const req = await loadRequest({ id });
  if (!req) return;

  // Where to write: the module's notify LIST (several addresses allowed —
  // approved plan ④), else the tenant's contact.
  const owner = await db
    .selectFrom("site")
    .leftJoin("tenant_user", "tenant_user.tenant_id", "site.tenant_id")
    .select(["site.tenant_id as tenantId", "tenant_user.contact_email as email"])
    .where("site.id", "=", req.site_id)
    .executeTakeFirst();
  const to = parseNotifyList(configuredEmail, owner?.email ?? null).join(", ");
  if (!to) {
    // Nowhere to send. The request itself is safe (it waits on the Foglalások tab),
    // but the owner will not learn about it until they log in — so this must never
    // be a silent return: a background job owes the reason it did nothing.
    console.error(`[booking] NINCS ÉRTESÍTÉSI CÍM — a kérés (${id}) e-mail nélkül maradt: sem a modul „Hová küldjük" mezője, sem a fiók e-mail címe nincs kitöltve (site ${req.site_id}).`);
    return;
  }

  const base = publicBaseUrl ?? "";
  const from = dayStr(req.date_from);
  const until = dayStr(req.date_to);
  const yes = `${base}/foglalas/${token}/elfogadom`;
  const no = `${base}/foglalas/${token}/elutasitom`;
  const unit = req.unit_name ? ` — ${req.unit_name}` : "";

  // ADR-0067: the owner is written to in their own site's language.
  const lang = await prepareMailLang(await langForSite(req.site_id));

  // Booking-offer ①–②: NO frozen price = the guest saw no amount and asked for a
  // quote. The letter says so, names the unpriced nights, and offers the offer page
  // instead of a one-tap accept that would confirm the stay at no price at all.
  const isQuote = !req.quoted_total;
  const offerUrl = `${base}/foglalas/${token}/ajanlat`;
  const missing = isQuote ? await unpricedNights(req.unit_id, from, until) : [];
  const unitName = req.unit_name ?? "";
  const quoteNote = isQuote
    ? T(lang, "A vendég nem látott árat.") +
      " " +
      (missing.length
        ? T(
            lang,
            "{unit}: {n} éjszakára nincs megadott ár ({from} – {to}). Adja meg itt, és a rendszer elküldi neki az ajánlatot — az ár bekerül az árlistájába, így a következő vendég már látja.",
            {
              unit: unitName,
              n: missing.length,
              from: huDate(missing[0]!),
              to: huDate(addDays(missing[missing.length - 1]!, 1)),
            },
          )
        : T(lang, "Adja meg az árat, és a rendszer elküldi neki az ajánlatot."))
    : "";

  const text =
    (isQuote ? T(lang, "Új árajánlat-kérés") : T(lang, "Új foglalási kérés")) +
    `${unit}\n\n` +
    (isQuote ? `${quoteNote}\n\n` : "") +
    `${T(lang, "Vendég:")} ${req.guest_name}\n` +
    // The guest reads the same reference on screen and in their own mail — without
    // it a phone call ("a hétvégi foglalásom ügyében…") has nothing to match on.
    `${T(lang, "Hivatkozás:")} ${bookingRef(req.id)}\n` +
    `${T(lang, "Érkezés:")} ${huDate(from)}\n${T(lang, "Távozás:")} ${huDate(until)}\n` +
    `${T(lang, "Létszám:")} ${T(lang, "{n} fő", { n: req.guests })}\n` +
    (req.quoted_total
      ? `${T(lang, "Ár összesen (a foglaláskori árlista szerint):")} ${formatAmount(req.quoted_total, req.quoted_currency ?? "HUF")}\n`
      : "") +
    (req.guest_phone ? `${T(lang, "Telefon:")} ${req.guest_phone}\n` : "") +
    `${T(lang, "E-mail:")} ${req.guest_email}\n` +
    (req.message ? `\n${T(lang, "Üzenete:")}\n${req.message}\n` : "") +
    (isQuote
      ? `\n${T(lang, "Ajánlatot küldök:")} ${offerUrl}\n${T(lang, "Nem szabad:")} ${no}\n\n` +
        T(lang, "A foglalás csak akkor lesz végleges, ha a vendég elfogadja az ajánlatát.")
      : `\n${T(lang, "Elfogadom:")} ${yes}\n${T(lang, "Nem szabad:")} ${no}\n\n` +
        T(lang, "A vendég csak azután kap visszaigazolást, hogy Ön döntött."));

  const html =
    `<p style="font-size:17px"><strong>${isQuote ? T(lang, "Új árajánlat-kérés") : T(lang, "Új foglalási kérés")}${esc(unit)}</strong></p>` +
    (isQuote
      ? `<p style="border-left:4px solid #d29922;background:#fdf6e6;padding:10px 12px;border-radius:6px;` +
        `font-size:15px;line-height:1.55">${esc(quoteNote)}</p>`
      : "") +
    `<p style="font-size:16px;line-height:1.7">` +
    `<strong>${esc(req.guest_name)}</strong><br>` +
    `${T(lang, "Hivatkozás:")} ${esc(bookingRef(req.id))}<br>` +
    `${esc(huDate(from))} — ${esc(huDate(until))}<br>` +
    `${esc(T(lang, "{n} fő", { n: req.guests }))}` +
    (req.quoted_total
      ? `<br><strong>${esc(formatAmount(req.quoted_total, req.quoted_currency ?? "HUF"))}</strong>`
      : "") +
    (req.guest_phone ? `<br>${T(lang, "Telefon:")} ${esc(req.guest_phone)}` : "") +
    `</p>` +
    (req.message ? `<p style="font-size:15px;color:#444">„${esc(req.message)}"</p>` : "") +
    `<p style="margin:28px 0">` +
    `<a href="${esc(isQuote ? offerUrl : yes)}" style="display:inline-block;padding:16px 28px;background:#16283f;` +
    `color:#fff;text-decoration:none;border-radius:10px;font-size:17px;font-weight:600">${isQuote ? T(lang, "Ajánlatot küldök") : T(lang, "Elfogadom")}</a>` +
    `&nbsp;&nbsp;` +
    `<a href="${esc(no)}" style="display:inline-block;padding:16px 28px;border:1px solid #ccc;` +
    `color:#16283f;text-decoration:none;border-radius:10px;font-size:17px">${T(lang, "Nem szabad")}</a>` +
    `</p>` +
    `<p style="font-size:14px;color:#666">${
      isQuote
        ? T(lang, "A foglalás csak akkor lesz végleges, ha a vendég elfogadja az ajánlatát.")
        : T(lang, "A vendég csak azután kap visszaigazolást, hogy Ön döntött.")
    }</p>`;

  const msg = {
    to,
    // Goes to the TENANT, but every line of it is their guest's personal data
    // (name, phone, dates) — the tenant is its controller, so no pilot BCC.
    audience: "guest" as const,
    subject: isQuote
      ? T(lang, "Árajánlat-kérés: {guest}, {from}–{to}", {
          guest: req.guest_name,
          from: huDate(from),
          to: huDate(until),
        })
      : T(lang, "Foglalási kérés: {guest}, {from}–{to}", {
          guest: req.guest_name,
          from: huDate(from),
          to: huDate(until),
        }),
    text,
    html,
  };
  await getEmailSender().send(msg);
  // ADR-0084: also into the tenant's mailbox — the owner asked for ONE place for
  // every system message. ⚠️ This row carries the GUEST's personal data, but it is
  // not new exposure: the same fields already live in booking_request, the same
  // tenant is its controller, and only that tenant can read it (the query is
  // scoped by tenant_id). The anchor ties it to the request, so a future
  // booking-retention cleanup can find and remove this row with it.
  if (owner?.tenantId) {
    await logTenantMessage({
      tenantId: owner.tenantId,
      channel: "email",
      kind: "booking",
      subject: msg.subject,
      bodyText: text,
      recipient: to,
      relatedKind: "booking_request",
      relatedId: id,
    });
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export interface DecisionResult {
  readonly ok: boolean;
  /** 'accepted' | 'declined' | 'already' | 'conflict' | 'unknown' */
  readonly outcome: string;
  readonly guestName?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  /** ADR-0067: the site's language — the verdict page renders in it. */
  readonly lang?: string;
  /** On accept: how many overlapping pending requests were auto-declined. */
  readonly autoDeclined?: number;
  /** The decided request's own id — the admin result banner names it back. */
  readonly id?: string;
  /**
   * On accept: the ids auto-declined by this very verdict. IDs, not names: they
   * travel in the redirect URL, and the screen resolves them from the rows it has
   * already loaded. Elek FK-007 — the owner used to get "Mentve — az oldalad
   * frissült." after a verdict that confirmed one guest and refused two others by
   * mail; who got what had to be read off the bottom of the page.
   */
  readonly autoDeclinedIds?: readonly string[];
}

/** Pending requests of the same unit whose nights intersect [from, to). */
async function overlappingPending(
  unitIds: string[],
  exceptId: string,
  from: string,
  to: string,
): Promise<RequestRow[]> {
  const rows = await db
    .selectFrom("booking_request")
    .innerJoin("site_unit", "site_unit.id", "booking_request.unit_id")
    .selectAll("booking_request")
    .select("site_unit.name as unit_name")
    .where("booking_request.unit_id", "in", unitIds)
    .where("booking_request.status", "=", "pending")
    .where("booking_request.id", "!=", exceptId)
    .where("booking_request.date_from", "<", to)
    .where("booking_request.date_to", ">", from)
    .execute();
  return rows as unknown as RequestRow[];
}

/**
 * Apply the owner's verdict. Idempotent: the link may be opened twice (e-mail
 * clients prefetch, owners double-tap), and the second visit must report the
 * decision already made rather than erroring or flipping it.
 *
 * `note` is the owner's word to the guest (approved plan ⑤): quoted in the
 * verdict mail, stored as decision_note.
 *
 * ACCEPT also settles the nights' OTHER suitors (approved plan ⑥): every pending
 * request overlapping the accepted stay is auto-declined and its guest told the
 * period has filled — silence would leave them waiting for nights already gone.
 */
export async function decideRequest(
  token: string,
  verdict: "accepted" | "declined",
  publicBaseUrl: string | null,
  note?: string | null,
): Promise<DecisionResult> {
  const req = await loadRequest({ token });
  if (!req) return { ok: false, outcome: "unknown" };

  const from = dayStr(req.date_from);
  const to = dayStr(req.date_to);
  const base = {
    guestName: req.guest_name,
    dateFrom: from,
    dateTo: to,
    // ADR-0067: the owner opens this from their (localized) e-mail — the result
    // page must not switch back to Hungarian.
    lang: await prepareMailLang(await langForSite(req.site_id)),
  };
  if (req.status !== "pending") {
    return { ok: true, outcome: req.status === verdict ? "already" : req.status, ...base };
  }
  const decisionNote = note?.trim().slice(0, 1000) || null;

  if (verdict === "declined") {
    await db
      .updateTable("booking_request")
      .set({
        status: "declined",
        decided_at: new Date(),
        decided_by: "owner",
        decision_note: decisionNote,
      })
      .where("id", "=", req.id)
      .execute();
    void mailSafe("guest-declined", () => sendGuestVerdict(req, "declined", publicBaseUrl, decisionNote));
    return { ok: true, outcome: "declined", id: req.id, ...base };
  }

  // ⛔ A request with NO frozen price is a quote request (approved plan booking-offer
  // ①–②): accepting it here would confirm a stay at an amount the guest never saw.
  // Mails sent before the offer flow still carry a one-tap "Elfogadom" link — it
  // must not confirm; the owner is sent to price it first.
  if (!req.quoted_total) return { ok: false, outcome: "needs_offer", ...base };
  return acceptCore(req, "owner", "pending", decisionNote, publicBaseUrl, base);
}

class AcceptRaceLost extends Error {}

/**
 * ACCEPT — the only place double booking is actually prevented. Re-check and write
 * the day rows in ONE transaction; a conflicting night aborts the whole thing.
 * Shared by the owner's verdict and by an accepted price offer (approved plan
 * booking-offer ⑪/⑬), so there is one lock, one conflict rule and one set of mails.
 */
async function acceptCore(
  req: RequestRow,
  by: "owner" | "guest",
  fromStatus: "pending" | "offered",
  decisionNote: string | null,
  publicBaseUrl: string | null,
  base: { guestName: string; dateFrom: string; dateTo: string; lang: string },
): Promise<DecisionResult> {
  const from = base.dateFrom;
  const to = base.dateTo;
  let conflict = false;
  let lost = false;
  // ADR-0114: read the whole-place relation ONCE, outside the transaction — it is
  // structure (which units exclude this one), not state that the transaction protects.
  const blockers = await blockingUnitIds(req.unit_id);
  await db.transaction().execute(async (trx) => {
    const taken = await trx
      .selectFrom("availability_day")
      .select("day")
      .where("unit_id", "in", blockers)
      .where("day", ">=", from)
      .where("day", "<", to)
      .executeTakeFirst();
    if (taken) {
      conflict = true;
      return;
    }
    const nightCount = nights(from, to);
    for (let i = 0; i < nightCount; i++) {
      await trx
        .insertInto("availability_day")
        .values({
          unit_id: req.unit_id,
          day: addDays(from, i),
          state: "booked",
          source: `booking:${req.id}`,
        })
        .execute();
    }
    const upd = await trx
      .updateTable("booking_request")
      .set({
        status: "accepted",
        decided_at: new Date(),
        decided_by: by,
        decision_note: decisionNote,
      })
      .where("id", "=", req.id)
      // The state the caller saw (pending for a verdict, offered for an offer): a
      // second tap that races the first finds it gone and changes nothing.
      .where("status", "=", fromStatus)
      .executeTakeFirst();
    if (!Number(upd.numUpdatedRows)) {
      lost = true;
      throw new AcceptRaceLost();
    }
  }).catch((err) => {
    if (!(err instanceof AcceptRaceLost)) throw err;
  });

  if (lost) return { ok: true, outcome: "already", ...base };
  if (conflict) return { ok: false, outcome: "conflict", ...base };
  // Reload: an accepted OFFER carries the price frozen when it was sent, and the
  // confirmation must quote exactly that.
  const fresh = (await loadRequest({ id: req.id })) ?? req;
  void mailSafe("guest-accepted", () => sendGuestVerdict(fresh, "accepted", publicBaseUrl, decisionNote));

  // Approved plan ⑥: the nights are gone — every overlapping pending request is
  // auto-declined NOW, with an honest mail, instead of rotting until expiry.
  // ADR-0114: accepting the whole place kills the pending requests for its ROOMS too
  // (and accepting a room kills the pending requests for the whole place) — those
  // nights are genuinely gone, and letting them rot until expiry lies to the guest.
  const losers = await overlappingPending(blockers, req.id, from, to);
  for (const loser of losers) {
    await db
      .updateTable("booking_request")
      .set({
        status: "declined",
        decided_at: new Date(),
        decided_by: "auto",
        decision_note: T(
          base.lang,
          "Az időszakra a szállásadó másik kérést igazolt vissza — automatikus elutasítás.",
        ),
      })
      .where("id", "=", loser.id)
      .execute();
    void mailSafe("guest-auto-declined", () => sendGuestVerdict(loser, "auto_declined", publicBaseUrl, null));
  }
  return {
    ok: true,
    outcome: "accepted",
    id: req.id,
    autoDeclined: losers.length,
    autoDeclinedIds: losers.map((l) => l.id),
    ...base,
  };
}

type GuestOutcome = "accepted" | "declined" | "auto_declined";

/** The guest hears the outcome — and only ever after the owner has decided. */
async function sendGuestVerdict(
  req: RequestRow,
  outcome: GuestOutcome,
  publicBaseUrl: string | null,
  note: string | null,
): Promise<void> {
  const from = huDate(dayStr(req.date_from));
  const to = huDate(dayStr(req.date_to));
  // ADR-0067: the GUEST is written to in the site's language — the language they
  // just booked in. A Hungarian confirmation from a Polish guesthouse is a defect
  // the guest sees before the tenant ever does.
  const ctx = await siteMailContext(req.site_id);
  const lang = ctx.lang;
  const host = ctx.hostName;
  const unit = req.unit_name ? ` (${req.unit_name})` : "";
  const cancelUrl = publicBaseUrl
    ? `${publicBaseUrl}/foglalas/${req.action_token}/lemondom`
    : null;

  let subject: string;
  let body: string;
  let attachments: { filename: string; content: Buffer; contentType: string }[] = [];

  if (outcome === "accepted") {
    subject = T(lang, "Visszaigazolt foglalás: {from} — {to}", { from, to });
    body =
      T(lang, "Kedves {name}!", { name: req.guest_name }) +
      `\n\n` +
      T(lang, "{host} visszaigazolta a foglalását{unit}.", { host, unit }) +
      `\n\n` +
      `${T(lang, "Érkezés:")} ${from}\n${T(lang, "Távozás:")} ${to}\n` +
      `${T(lang, "Létszám:")} ${T(lang, "{n} fő", { n: req.guests })}\n` +
      quoteBlock(req, lang) +
      `\n` +
      (note ? `${T(lang, "A szállásadó üzenete:")} „${note}"\n\n` : "") +
      T(lang, "A fizetés a helyszínen történik. Ha bármi változna, válaszoljon erre a levélre.") +
      `\n\n` +
      T(
        lang,
        "A mellékelt naptár-fájllal a tartózkodást egy kattintással naptárába teheti (Google, Outlook, Apple).",
      ) +
      (cancelUrl
        ? `\n\n` +
          T(lang, "Ha mégsem tudnak jönni, kérjük, mondja le itt:") +
          `\n${cancelUrl}`
        : "") +
      `\n\n${host}\n`;
    // Plan C ②: the .ics is the "add to calendar" affordance — PUBLISH, one event.
    attachments = [
      {
        filename: "foglalas.ics",
        content: Buffer.from(
          buildStayIcs({
            requestId: req.id,
            hostName: host,
            ...(ctx.address ? { location: ctx.address } : {}),
            dateFrom: dayStr(req.date_from),
            dateTo: dayStr(req.date_to),
          }),
          "utf8",
        ),
        contentType: "text/calendar; method=PUBLISH",
      },
    ];
  } else if (outcome === "declined") {
    subject = T(lang, "A kért időpont sajnos nem szabad: {from} — {to}", { from, to });
    body =
      T(lang, "Kedves {name}!", { name: req.guest_name }) +
      `\n\n` +
      T(lang, "Sajnáljuk, a kért időpont ({from} — {to}) nem szabad{unit}.", { from, to, unit }) +
      `\n\n` +
      (note ? `${T(lang, "A szállásadó üzenete:")} „${note}"\n\n` : "") +
      T(lang, "Ha más időpont is szóba jöhet, keressen minket bizalommal.") +
      `\n\n${host}\n`;
  } else {
    // auto_declined — another request won the same nights (approved plan ⑥).
    subject = T(lang, "A kért időszak időközben betelt: {from} — {to}", { from, to });
    body =
      T(lang, "Kedves {name}!", { name: req.guest_name }) +
      `\n\n` +
      T(
        lang,
        "Sajnáljuk — a kért időszakra ({from} — {to}) a szállásadó időközben másik foglalást igazolt vissza, így az betelt{unit}.",
        { from, to, unit },
      ) +
      `\n\n` +
      T(lang, "Ha más időpont is szóba jöhet, keressen minket bizalommal.") +
      `\n\n${host}\n`;
  }

  await getEmailSender().send({
    to: req.guest_email,
    // Addressed to the tenant's GUEST — never blind-copy this to us.
    audience: "guest",
    ...guestIdentity(ctx),
    subject,
    text: body,
    html: bookingHtml(body),
    ...(attachments.length ? { attachments } : {}),
  });
}

/**
 * Read-only view for the guest-cancel CONFIRM page (GET must not mutate — mail
 * clients prefetch links, and a prefetch must never cancel a booking).
 */
/**
 * The property's public address — the way OUT of a guest-facing dead-end page.
 * Custom domain wins over the platform subdomain, exactly as the site is served.
 */
async function siteUrlFor(siteId: string): Promise<string | undefined> {
  const row = await db
    .selectFrom("site")
    .select(["slug", "custom_domain", "custom_domain_status"])
    .where("id", "=", siteId)
    .executeTakeFirst();
  if (!row) return undefined;
  // ADR-0071: the own domain only goes live in the 'live' state — linking it any
  // earlier would send the guest to a name that does not resolve yet.
  const custom = row.custom_domain_status === "live" ? row.custom_domain : null;
  return tenantSiteUrl(config.publicSiteUrl, row.slug, custom) ?? undefined;
}

export async function peekCancelView(token: string): Promise<CancelResult> {
  const req = await loadRequest({ token });
  if (!req) return { ok: false, outcome: "unknown" };
  const ctx = await siteMailContext(req.site_id);
  const base = {
    guestName: req.guest_name,
    dateFrom: dayStr(req.date_from),
    dateTo: dayStr(req.date_to),
    hostName: ctx.hostName,
    lang: ctx.lang,
    siteUrl: await siteUrlFor(req.site_id),
    ref: bookingRef(req.id),
  };
  if (req.status === "cancelled") return { ok: true, outcome: "already", ...base };
  if (req.status !== "accepted") return { ok: false, outcome: "not_accepted", ...base };
  return { ok: true, outcome: "accepted", ...base };
}

export interface CancelResult {
  readonly ok: boolean;
  /** 'cancelled' | 'already' | 'not_accepted' | 'unknown' */
  readonly outcome: string;
  readonly guestName?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly hostName?: string;
  readonly lang?: string;
  /**
   * The property's own page. Elek FK-007: the cancel pages were unbranded
   * dead-ends with no way out but closing the tab — a guest who lands there by
   * mistake needs a door back to the place they booked, and needs to see WHOSE
   * page they are on before they hit an irreversible red button.
   */
  readonly siteUrl?: string;
  /** Reference of the booking being cancelled ("FG-3F9A21"). */
  readonly ref?: string;
}

/**
 * Cancel an ACCEPTED booking (approved plan ⑦ + guest-cancel decision 2026-09-06).
 *
 * Either side may end it: the owner from the admin (calendar day panel / history),
 * the guest from the single-use link in their confirmation mail. The nights are
 * freed in the same transaction that flips the status, the other party is told,
 * and the calendar attachment (METHOD:CANCEL) removes the guest's calendar entry.
 */
export async function cancelRequest(opts: {
  readonly token?: string;
  readonly id?: string;
  readonly by: "owner" | "guest";
  readonly note?: string | null;
  readonly publicBaseUrl: string | null;
}): Promise<CancelResult> {
  const req = opts.token
    ? await loadRequest({ token: opts.token })
    : opts.id
      ? await loadRequest({ id: opts.id })
      : null;
  if (!req) return { ok: false, outcome: "unknown" };

  const ctx = await siteMailContext(req.site_id);
  const from = dayStr(req.date_from);
  const to = dayStr(req.date_to);
  const base = {
    guestName: req.guest_name,
    dateFrom: from,
    dateTo: to,
    hostName: ctx.hostName,
    lang: ctx.lang,
    siteUrl: await siteUrlFor(req.site_id),
    ref: bookingRef(req.id),
  };
  if (req.status === "cancelled") return { ok: true, outcome: "already", ...base };
  if (req.status !== "accepted") return { ok: false, outcome: "not_accepted", ...base };

  const note = opts.note?.trim().slice(0, 1000) || null;
  await db.transaction().execute(async (trx) => {
    // Free exactly OUR nights: the source anchor keeps a later manual block or a
    // portal-imported day out of this delete.
    await trx
      .deleteFrom("availability_day")
      .where("unit_id", "=", req.unit_id)
      .where("source", "=", `booking:${req.id}`)
      .execute();
    await trx
      .updateTable("booking_request")
      .set({
        status: "cancelled",
        decided_at: new Date(),
        decided_by: opts.by,
        decision_note: note,
      })
      .where("id", "=", req.id)
      .execute();
  });

  const hu = { from: huDate(from), to: huDate(to) };
  const cancelIcs = {
    filename: "foglalas-lemondas.ics",
    content: Buffer.from(
      buildStayCancelIcs({
        requestId: req.id,
        hostName: ctx.hostName,
        ...(ctx.address ? { location: ctx.address } : {}),
        dateFrom: from,
        dateTo: to,
      }),
      "utf8",
    ),
    contentType: "text/calendar; method=CANCEL",
  };

  if (opts.by === "owner") {
    // Plan C ⑤: the guest learns it from us, with the owner's reason quoted.
    const body =
      T(ctx.lang, "Kedves {name}!", { name: req.guest_name }) +
      `\n\n` +
      T(
        ctx.lang,
        "A szállásadó sajnálattal lemondta a {from} — {to} közötti, korábban visszaigazolt foglalását.",
        hu,
      ) +
      `\n\n` +
      (note ? `${T(ctx.lang, "A szállásadó üzenete:")} „${note}"\n\n` : "") +
      T(
        ctx.lang,
        "Ha korábban naptárába vette a foglalást, a mellékelt frissítés törli a bejegyzést.",
      ) +
      `\n\n${ctx.hostName}\n`;
    await mailSafe("guest-cancelled-by-owner", () =>
      getEmailSender().send({
        to: req.guest_email,
        audience: "guest",
        ...guestIdentity(ctx),
        subject: T(ctx.lang, "Foglalása lemondva: {from} — {to}", hu),
        text: body,
        html: bookingHtml(body),
        attachments: [cancelIcs],
      }).then(() => undefined));
  } else {
    // Guest cancelled: confirm to the guest…
    const guestBody =
      T(ctx.lang, "Kedves {name}!", { name: req.guest_name }) +
      `\n\n` +
      T(
        ctx.lang,
        "Megerősítjük: a {from} — {to} közötti foglalását lemondta, a napok felszabadultak.",
        hu,
      ) +
      `\n\n` +
      T(
        ctx.lang,
        "Ha korábban naptárába vette a foglalást, a mellékelt frissítés törli a bejegyzést.",
      ) +
      `\n\n${ctx.hostName}\n`;
    await mailSafe("guest-cancel-ack", () =>
      getEmailSender().send({
        to: req.guest_email,
        audience: "guest",
        ...guestIdentity(ctx),
        subject: T(ctx.lang, "Lemondás megerősítve: {from} — {to}", hu),
        text: guestBody,
        html: bookingHtml(guestBody),
        attachments: [cancelIcs],
      }).then(() => undefined));
    // …and tell the OWNER their calendar just changed.
    if (ctx.notifyList.length) {
      const ownerBody =
        T(ctx.lang, "{guest} lemondta a {from} — {to} közötti, visszaigazolt foglalását.", {
          guest: req.guest_name,
          ...hu,
        }) +
        `\n\n` +
        (note ? `${T(ctx.lang, "A vendég üzenete:")} „${note}"\n\n` : "") +
        T(ctx.lang, "A napok újra szabadok a naptárban — a honlapon máris foglalhatók.");
      const subject = T(ctx.lang, "Foglalás lemondva: {guest}, {from} — {to}", {
        guest: req.guest_name,
        ...hu,
      });
      await mailSafe("owner-notify-guest-cancel", () =>
        getEmailSender().send({
          to: ctx.notifyList.join(", "),
          // The mail carries the guest's data to their controller (the tenant).
          audience: "guest",
          subject,
          text: ownerBody,
          html: bookingHtml(ownerBody),
        }).then(() => undefined));
      if (ctx.tenantId) {
        await logTenantMessage({
          tenantId: ctx.tenantId,
          channel: "email",
          kind: "booking",
          subject,
          bodyText: ownerBody,
          recipient: ctx.notifyList.join(", "),
          relatedKind: "booking_request",
          relatedId: req.id,
        });
      }
    }
  }
  return { ok: true, outcome: "cancelled", ...base };
}

export interface InboxItem {
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
  readonly createdAt: Date;
  readonly decidedAt: Date | null;
  /** 'owner' | 'guest' | 'auto' | 'system' | null (pending). */
  readonly decidedBy: string | null;
  readonly decisionNote: string | null;
  readonly seen: boolean;
  /** 0052: total frozen from the price list at request time (null = no price list then). */
  readonly quotedTotal: number | null;
  readonly quotedCurrency: string | null;
  /** 0072: when the price offer went out (status 'offered'). */
  readonly offeredAt: Date | null;
}

/** The owner's request list for the admin (pending first, newest first). */
export async function getRequests(siteId: string, limit = 40): Promise<InboxItem[]> {
  const rows = await db
    .selectFrom("booking_request")
    .innerJoin("site_unit", "site_unit.id", "booking_request.unit_id")
    .selectAll("booking_request")
    .select("site_unit.name as unit_name")
    .where("booking_request.site_id", "=", siteId)
    .orderBy("booking_request.status")
    .orderBy("booking_request.created_at", "desc")
    .limit(limit)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    unitName: r.unit_name,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    guestPhone: r.guest_phone,
    dateFrom: dayStr(r.date_from),
    dateTo: dayStr(r.date_to),
    guests: r.guests,
    message: r.message,
    status: r.status,
    token: r.action_token,
    createdAt: new Date(r.created_at as unknown as string),
    decidedAt: r.decided_at ? new Date(r.decided_at as unknown as string) : null,
    decidedBy: (r.decided_by as string | null) ?? null,
    decisionNote: (r.decision_note as string | null) ?? null,
    seen: r.seen_at != null,
    quotedTotal: r.quoted_total ?? null,
    quotedCurrency: r.quoted_currency ?? null,
    offeredAt: r.offered_at ? new Date(r.offered_at as unknown as string) : null,
  }));
}

/** The module's answer window for a site (0 = never expires) — for the admin UI. */
export async function bookingExpireHours(siteId: string): Promise<number> {
  const rules = await bookingRules(siteId);
  return Number(rules.autoDeclineHours ?? 48);
}

/** Nav badge truth: pending requests the owner has not yet laid eyes on. */
export async function unseenRequestCount(siteId: string): Promise<number> {
  const row = await db
    .selectFrom("booking_request")
    .select(db.fn.countAll().as("n"))
    .where("site_id", "=", siteId)
    .where("status", "=", "pending")
    .where("seen_at", "is", null)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

/** The Foglalások tab was rendered → its pending requests count as seen. */
export async function markRequestsSeen(siteId: string): Promise<void> {
  await db
    .updateTable("booking_request")
    .set({ seen_at: new Date() })
    .where("site_id", "=", siteId)
    .where("seen_at", "is", null)
    .execute();
}

/**
 * Time out requests the owner never answered, per the module's autoDeclineHours.
 * Silence is not an answer a guest can plan around: after the window the request
 * lapses and the guest is told to look elsewhere, rather than waiting forever.
 */
export async function expireStaleRequests(): Promise<number> {
  const pending = await db
    .selectFrom("booking_request")
    .selectAll()
    .where("status", "=", "pending")
    .execute();

  let expired = 0;
  for (const r of pending) {
    const rules = await bookingRules(r.site_id);
    const hours = Number(rules.autoDeclineHours ?? 48);
    if (!hours) continue; // 0 = never expires
    const age = (Date.now() - new Date(r.created_at as unknown as string).getTime()) / 3_600_000;
    if (age < hours) continue;
    await db
      .updateTable("booking_request")
      .set({ status: "expired", decided_at: new Date(), decided_by: "system" })
      .where("id", "=", r.id)
      .execute();
    // The docstring's promise, now kept (gap found 2026-09-06): the guest is TOLD
    // the window passed — a silently expired request looks exactly like being ignored.
    await mailSafe("guest-expired", () => sendGuestExpired(r as unknown as RequestRow, hours));
    // …and so is the OWNER (gap found 2026-09-11): a lost booking was the one
    // event the owner learned about from nobody. Of 31 messages not one mentioned
    // it; they had to scroll ~1750px down the Foglalások tab to find out at all.
    await mailSafe("owner-expired", () => sendOwnerExpired(r as unknown as RequestRow, hours));
    expired++;
  }
  return expired;
}

/** Tell the owner a request died unanswered — including that the guest was told. */
async function sendOwnerExpired(req: RequestRow, hours: number): Promise<void> {
  const ctx = await siteMailContext(req.site_id);
  const lang = ctx.lang;
  if (!ctx.notifyList.length) {
    console.warn(`[booking] nincs értesítési cím — a lejárt kérés (${req.id}) CSAK naplózva`);
    return;
  }
  const hu = { from: huDate(dayStr(req.date_from)), to: huDate(dayStr(req.date_to)) };
  const subject = T(lang, "Lejárt egy foglalási kérés: {guest}, {from} — {to}", {
    guest: req.guest_name,
    ...hu,
  });
  const body =
    T(
      lang,
      "{guest} {from} — {to} közötti foglalási kérésére {n} órán belül nem érkezett válasz, ezért a kérés lejárt.",
      { guest: req.guest_name, ...hu, n: hours },
    ) +
    `\n\n` +
    T(lang, "A vendégnek elküldtük az udvarias értesítést, és a napok újra szabadok a naptárban.") +
    `\n\n` +
    T(lang, "A válaszidőt a Foglalások fül beállításainál tudja módosítani.") +
    `\n\n${ctx.hostName}\n`;
  await getEmailSender().send({
    to: ctx.notifyList.join(", "),
    // Carries the guest's data to their controller (the tenant) — same basis as
    // the other owner-facing booking mails.
    audience: "guest",
    subject,
    text: body,
    html: bookingHtml(body),
  });
  if (ctx.tenantId) {
    await logTenantMessage({
      tenantId: ctx.tenantId,
      channel: "email",
      kind: "booking",
      subject,
      bodyText: body,
      recipient: ctx.notifyList.join(", "),
      relatedKind: "booking_request",
      relatedId: req.id,
    });
  }
}

/** Plan C ④: "nem érkezett válasz" — the machine closes what the owner left open. */
async function sendGuestExpired(req: RequestRow, hours: number): Promise<void> {
  const ctx = await siteMailContext(req.site_id);
  const lang = ctx.lang;
  const hu = { from: huDate(dayStr(req.date_from)), to: huDate(dayStr(req.date_to)) };
  const body =
    T(lang, "Kedves {name}!", { name: req.guest_name }) +
    `\n\n` +
    T(
      lang,
      "Sajnáljuk: a szállásadó {n} órán belül nem válaszolt a foglalási kérésére, ezért a kérés lejárt. A kért napokra ez a kérés már nem él — nyugodtan foglalhat máshol, vagy próbálkozhat újra.",
      { n: hours },
    ) +
    `\n\n` +
    `${T(lang, "Érkezés:")} ${hu.from}\n${T(lang, "Távozás:")} ${hu.to}\n\n` +
    T(lang, "Elnézést kérünk a kellemetlenségért.") +
    `\n\n${ctx.hostName}\n`;
  await getEmailSender().send({
    to: req.guest_email,
    audience: "guest",
    ...guestIdentity(ctx),
    subject: T(lang, "Nem érkezett válasz a foglalási kérésére: {from} — {to}", hu),
    text: body,
    html: bookingHtml(body),
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * PRICE OFFER ON A QUOTE REQUEST — approved plan booking-offer (tulaj, 2026-09-23)
 * Contract: assets/design-refs/tenant-admin/booking-offer/README.md
 *
 * The owner prices the nights the guest asked about (the price lands in the price
 * list, so the NEXT guest sees it), the offer goes out FROM the system, and the guest
 * accepts it in the system — nothing depends on a private reply the owner would have
 * to keep track of.
 * ──────────────────────────────────────────────────────────────────────────── */

/** The nights of a stay no price row covers ('YYYY-MM-DD' each); empty = fully priced. */
export async function unpricedNights(unitId: string, dateFrom: string, dateTo: string): Promise<string[]> {
  const prices = await getUnitPrices(unitId);
  const out: string[] = [];
  const n = nights(dateFrom, dateTo);
  for (let i = 0; i < n; i++) {
    const day = addDays(dateFrom, i);
    if (!priceOn(prices, day)) out.push(day);
  }
  return out;
}

/**
 * The amount rule of the offer page — the mock's `parseAmount`, byte for byte in
 * behaviour: thousand separators (space, dot, NBSP) and a trailing "Ft" are dropped,
 * only a positive whole number up to 10 000 000 passes.
 */
export function parseOfferAmount(raw: string): {
  value?: number;
  error?: "num" | "pos" | "big";
  empty?: boolean;
} {
  const s = String(raw ?? "").replace(/[\s.\u00a0]/g, "").replace(/ft$/i, "");
  if (s === "") return { empty: true };
  if (!/^\d+$/.test(s)) return { error: "num" };
  const n = parseInt(s, 10);
  if (!(n > 0)) return { error: "pos" };
  if (n > 10_000_000) return { error: "big" };
  return { value: n };
}

export interface OfferLine {
  readonly label: string;
  readonly nights: number;
  readonly perNight: number;
  readonly from: string;
  /** Checkout day of the line's last night. */
  readonly to: string;
}

/** What the owner's offer page shows. */
export interface OfferView {
  readonly outcome: "open" | "already" | "unknown";
  readonly status?: string;
  readonly token?: string;
  readonly lang: string;
  readonly hostName?: string;
  readonly guestName?: string;
  readonly guestPhone?: string | null;
  readonly guestEmail?: string;
  readonly message?: string | null;
  readonly unitName?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly nights?: number;
  readonly guests?: number;
  readonly currency?: string;
  /** per_night | per_person_night | per_stay */
  readonly unitMode?: string;
  /** Nights already priced by the list, merged like the quote lines. */
  readonly known?: OfferLine[];
  /** The unpriced nights ('YYYY-MM-DD'), in order. */
  readonly missing?: string[];
  /** Named seasons that keep their own price whatever the owner enters. */
  readonly seasons?: { label: string; from: string; to: string; amount: number }[];
  readonly today?: string;
  readonly expireHours?: number;
}

async function pricingConfigFor(siteId: string): Promise<{ currency: string; unitMode: string }> {
  const row = await db
    .selectFrom("site_module_config")
    .select("config")
    .where("site_id", "=", siteId)
    .where("module", "=", "pricing")
    .executeTakeFirst();
  const cfg = effectiveModuleConfig(
    "pricing",
    (row?.config ?? null) as Record<string, unknown> | null,
    null,
  );
  return { currency: String(cfg.currency ?? "HUF"), unitMode: String(cfg.unit ?? "per_night") };
}

/** The owner's offer page (GET) — the action token is the owner's key. */
export async function loadOfferView(token: string): Promise<OfferView> {
  const req = await loadRequest({ token });
  if (!req) return { outcome: "unknown", lang: "hu" };
  const ctx = await siteMailContext(req.site_id);
  const from = dayStr(req.date_from);
  const to = dayStr(req.date_to);
  if (req.status !== "pending" || req.quoted_total) {
    return {
      outcome: "already",
      status: req.quoted_total && req.status === "pending" ? "priced" : req.status,
      lang: ctx.lang,
      guestName: req.guest_name,
      dateFrom: from,
      dateTo: to,
      hostName: ctx.hostName,
    };
  }
  const prices = await getUnitPrices(req.unit_id);
  const { currency, unitMode } = await pricingConfigFor(req.site_id);
  const known: OfferLine[] = [];
  const missing: string[] = [];
  const baseLabel = T(ctx.lang, "Alapár");
  for (let i = 0; i < nights(from, to); i++) {
    const day = addDays(from, i);
    const p = priceOn(prices, day);
    if (!p) {
      missing.push(day);
      continue;
    }
    const label = p.isBase ? baseLabel : p.label;
    const last = known[known.length - 1];
    if (last && last.label === label && last.perNight === p.amount && last.to === day) {
      known[known.length - 1] = { ...last, nights: last.nights + 1, to: addDays(day, 1) };
    } else {
      known.push({ label, nights: 1, perNight: p.amount, from: day, to: addDays(day, 1) });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    outcome: "open",
    status: req.status,
    token,
    lang: ctx.lang,
    hostName: ctx.hostName,
    guestName: req.guest_name,
    guestPhone: req.guest_phone,
    guestEmail: req.guest_email,
    message: req.message,
    unitName: req.unit_name ?? "",
    dateFrom: from,
    dateTo: to,
    nights: nights(from, to),
    guests: req.guests,
    currency,
    unitMode,
    known,
    missing,
    seasons: prices
      .filter((p) => !p.isBase && p.from && p.to && (!p.validTo || p.validTo >= today))
      .map((p) => ({ label: p.label, from: p.from!, to: p.to!, amount: p.amount })),
    today,
    expireHours: ctx.expireHours,
  };
}

export interface SendOfferResult {
  readonly ok: boolean;
  /** 'sent' | 'invalid' | 'already' | 'unknown' */
  readonly outcome: string;
  readonly errors: string[];
  readonly total?: number;
  readonly currency?: string;
  readonly guestName?: string;
  readonly amount?: number;
  readonly until?: string | null;
  readonly expiresAt?: Date | null;
  readonly lang: string;
  readonly unitName?: string;
}

/**
 * Send the price offer (POST of the owner's offer page).
 *
 * ⑤ The price ALWAYS lands in the price list: without `until` as the unit's
 * timeless base (there is none — otherwise no night would be unpriced), with it as a
 * dated base from today to `until`. Seasons keep their own price either way.
 * ⑧ The request moves to 'offered' with the recomputed quote FROZEN on it; the
 * nights stay free until the guest accepts.
 */
export async function sendOffer(
  token: string,
  input: { amount: string; until?: string | null; note?: string | null },
  publicBaseUrl: string | null,
): Promise<SendOfferResult> {
  const req = await loadRequest({ token });
  if (!req) return { ok: false, outcome: "unknown", errors: [], lang: "hu" };
  const ctx = await siteMailContext(req.site_id);
  const lang = ctx.lang;
  if (req.status !== "pending" || req.quoted_total) {
    return { ok: false, outcome: "already", errors: [], lang };
  }
  const from = dayStr(req.date_from);
  const to = dayStr(req.date_to);
  const today = new Date().toISOString().slice(0, 10);
  const missing = await unpricedNights(req.unit_id, from, to);

  const errors: string[] = [];
  const amount = parseOfferAmount(input.amount);
  const until = (input.until ?? "").trim() || null;
  if (missing.length) {
    if (amount.empty) errors.push(T(lang, "Írja be az árat."));
    else if (amount.error === "num") errors.push(T(lang, "Csak számot írjon, pl. 26 000."));
    else if (amount.error === "pos") errors.push(T(lang, "Az ár legyen nagyobb nullánál."));
    else if (amount.error === "big") errors.push(T(lang, "Ez túl nagy összeg — ellenőrizze a nullákat."));
    if (until) {
      const last = missing[missing.length - 1]!;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(Date.parse(`${until}T00:00:00Z`))) {
        errors.push(T(lang, "A dátumot év-hónap-nap alakban kérjük."));
      } else if (until < last || until < today) {
        errors.push(
          T(lang, "Legalább {date} legyen — különben az ár erre a kérésre sem vonatkozik.", {
            date: huDate(last),
          }),
        );
      }
    }
  }
  if (errors.length) return { ok: false, outcome: "invalid", errors, lang };

  if (missing.length && amount.value) {
    if (until) await addDatedBasePrice(req.unit_id, amount.value, today, until);
    else await setBasePrice(req.unit_id, amount.value);
  }

  const { currency, unitMode } = await pricingConfigFor(req.site_id);
  const quote = quoteStayFrom(await getUnitPrices(req.unit_id), {
    dateFrom: from,
    dateTo: to,
    guests: Math.max(1, Math.round(req.guests || 1)),
    currency,
    unitMode,
    baseLabel: T(lang, "Alapár"),
  });
  if (!quote) {
    // The price was written, yet the rule still finds an unpriced night: a defect,
    // not an owner mistake. Loud, and nothing goes to the guest (§B.17).
    console.error(`[booking:offer] az ár mentése után sincs teljes ár (${req.id}) — ajánlat NEM ment ki`);
    return { ok: false, outcome: "invalid", errors: [T(lang, "Az árat nem sikerült kiszámolni. Kérjük, próbálja újra.")], lang };
  }

  const offerToken = randomBytes(24).toString("base64url");
  const note = input.note?.trim().slice(0, 1000) || null;
  const offeredAt = new Date();
  const upd = await db
    .updateTable("booking_request")
    .set({
      status: "offered",
      offered_at: offeredAt,
      offer_token: offerToken,
      decision_note: note,
      quoted_total: quote.total,
      quoted_currency: quote.currency,
      quoted_lines: JSON.stringify(
        quote.lines.map((l) => ({
          label: l.label,
          nights: l.nights,
          per_night: l.perNight,
          guests: l.guests,
          sum: l.sum,
        })),
      ),
    })
    .where("id", "=", req.id)
    // A double submit must not send two offers (the second finds it gone).
    .where("status", "=", "pending")
    .executeTakeFirst();
  if (!Number(upd.numUpdatedRows)) return { ok: false, outcome: "already", errors: [], lang };

  // The price list changed → the public page (price table, room-card span, the
  // booking widget's JSON is live already) must say the same thing.
  if (missing.length && ctx.tenantId) {
    try {
      const { rerenderTenantSnapshot } = await import("../tenant/editor.js");
      await rerenderTenantSnapshot(ctx.tenantId);
    } catch (err) {
      console.error(`[booking:offer] az oldal újrarenderelése nem sikerült (${ctx.tenantId}):`, err);
    }
  }

  const fresh = (await loadRequest({ id: req.id }))!;
  void mailSafe("guest-offer", () => sendGuestOffer(fresh, publicBaseUrl));
  const expiresAt = ctx.expireHours ? new Date(offeredAt.getTime() + ctx.expireHours * 3_600_000) : null;
  return {
    ok: true,
    outcome: "sent",
    errors: [],
    total: quote.total,
    currency: quote.currency,
    guestName: req.guest_name,
    amount: amount.value,
    until,
    expiresAt,
    lang,
    unitName: req.unit_name ?? "",
  };
}

/** "2026. szept. 25. 14:05" in the site's time zone (Budapest for the pilot). */
function huDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  return `${huDate(`${get("year")}-${get("month")}-${get("day")}`)} ${get("hour")}:${get("minute")}`;
}

/** When an offer lapses (null = the module never expires anything). */
export function offerExpiresAt(offeredAt: Date | null, hours: number): Date | null {
  if (!offeredAt || !hours) return null;
  return new Date(new Date(offeredAt).getTime() + hours * 3_600_000);
}

/** ⑨ The guest's offer letter: the price, the owner's word, the deadline, one link. */
async function sendGuestOffer(req: RequestRow, publicBaseUrl: string | null): Promise<void> {
  const ctx = await siteMailContext(req.site_id);
  const lang = ctx.lang;
  const from = huDate(dayStr(req.date_from));
  const to = huDate(dayStr(req.date_to));
  const unit = req.unit_name ? ` (${req.unit_name})` : "";
  const url = `${publicBaseUrl ?? ""}/ajanlat/${req.offer_token}`;
  const expires = offerExpiresAt(req.offered_at, ctx.expireHours);
  const body =
    T(lang, "Kedves {name}!", { name: req.guest_name }) +
    `\n\n` +
    T(lang, "{host} árajánlatot küldött a kért időszakra{unit}.", { host: ctx.hostName, unit }) +
    `\n\n` +
    `${T(lang, "Érkezés:")} ${from}\n${T(lang, "Távozás:")} ${to}\n` +
    `${T(lang, "Létszám:")} ${T(lang, "{n} fő", { n: req.guests })}\n` +
    quoteBlock(req, lang) +
    `\n` +
    (req.decision_note ? `${T(lang, "A szállásadó üzenete:")} „${req.decision_note}"\n\n` : "") +
    (expires
      ? T(lang, "Az ajánlat {when}-ig érvényes.", { when: huDateTime(expires) }) + " "
      : "") +
    T(lang, "A foglalás az elfogadással válik véglegessé — addig a napokat más is lefoglalhatja.") +
    `\n\n${T(lang, "Az ajánlat megtekintése és elfogadása:")}\n${url}\n\n` +
    T(lang, "Ha nem kéri, ugyanezen a linken jelezheti.") +
    `\n\n${ctx.hostName}\n`;
  const html =
    bookingHtml(body) +
    `<p style="margin:22px 0"><a href="${esc(url)}" style="display:inline-block;padding:14px 26px;` +
    `background:#16283f;color:#fff;text-decoration:none;border-radius:10px;font-size:16px;font-weight:600">` +
    `${T(lang, "Megnézem és elfogadom")}</a></p>`;
  await getEmailSender().send({
    to: req.guest_email,
    audience: "guest",
    ...guestIdentity(ctx),
    subject: T(lang, "Árajánlat: {from} — {to}", { from, to }),
    text: body,
    html,
  });
}

/** What the guest's offer page shows (GET — it never decides anything). */
export interface GuestOfferView {
  /** 'open' | 'accepted' | 'declined' | 'expired' | 'cancelled' | 'unknown' */
  readonly outcome: string;
  readonly lang: string;
  readonly hostName?: string;
  readonly siteUrl?: string;
  readonly guestName?: string;
  readonly unitName?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly guests?: number;
  readonly total?: number;
  readonly currency?: string;
  readonly lines?: { label: string; nights: number; per_night: number; guests: number; sum: number }[];
  readonly note?: string | null;
  readonly expiresAt?: Date | null;
}

async function loadByOfferToken(offerToken: string): Promise<RequestRow | null> {
  const row = await db
    .selectFrom("booking_request")
    .innerJoin("site_unit", "site_unit.id", "booking_request.unit_id")
    .selectAll("booking_request")
    .select("site_unit.name as unit_name")
    .where("booking_request.offer_token", "=", offerToken)
    .executeTakeFirst();
  return (row as unknown as RequestRow | undefined) ?? null;
}

/** An 'offered' row whose deadline passed is expired even before the tick reaches it. */
function offerLapsed(req: RequestRow, hours: number): boolean {
  const exp = offerExpiresAt(req.offered_at, hours);
  return !!exp && exp.getTime() <= Date.now();
}

export async function peekGuestOffer(offerToken: string): Promise<GuestOfferView> {
  const req = await loadByOfferToken(offerToken);
  if (!req) return { outcome: "unknown", lang: "hu" };
  const ctx = await siteMailContext(req.site_id);
  const lapsed = req.status === "offered" && offerLapsed(req, ctx.expireHours);
  const siteUrl = await siteUrlFor(req.site_id);
  return {
    outcome: lapsed ? "expired" : req.status === "offered" ? "open" : req.status,
    lang: ctx.lang,
    hostName: ctx.hostName,
    ...(siteUrl ? { siteUrl } : {}),
    guestName: req.guest_name,
    unitName: req.unit_name ?? "",
    dateFrom: dayStr(req.date_from),
    dateTo: dayStr(req.date_to),
    guests: req.guests,
    total: req.quoted_total ?? undefined,
    currency: req.quoted_currency ?? "HUF",
    lines: req.quoted_lines ?? [],
    note: req.decision_note ?? null,
    expiresAt: offerExpiresAt(req.offered_at, ctx.expireHours),
  };
}

/**
 * ⑪/⑫ The guest's answer (POST from the offer page). Accept runs the SAME core as
 * the owner's verdict: one transaction checks the nights and books them.
 */
export async function respondToOffer(
  offerToken: string,
  answer: "accept" | "decline",
  publicBaseUrl: string | null,
): Promise<GuestOfferView> {
  const req = await loadByOfferToken(offerToken);
  if (!req) return { outcome: "unknown", lang: "hu" };
  const view = await peekGuestOffer(offerToken);
  if (view.outcome !== "open") {
    // A lapsed offer the tick has not reached yet: close it now, the same way.
    if (view.outcome === "expired" && req.status === "offered") await expireOffer(req);
    return view;
  }
  const ctx = await siteMailContext(req.site_id);
  const base = {
    guestName: req.guest_name,
    dateFrom: dayStr(req.date_from),
    dateTo: dayStr(req.date_to),
    lang: ctx.lang,
  };

  if (answer === "decline") {
    const upd = await db
      .updateTable("booking_request")
      .set({ status: "declined", decided_at: new Date(), decided_by: "guest" })
      .where("id", "=", req.id)
      .where("status", "=", "offered")
      .executeTakeFirst();
    if (Number(upd.numUpdatedRows)) {
      await mailSafe("owner-offer-declined", () =>
        sendOwnerOfferNews(req, "declined"),
      );
    }
    return { ...view, outcome: "declined_now" };
  }

  const r = await acceptCore(req, "guest", "offered", req.decision_note ?? null, publicBaseUrl, base);
  if (r.outcome === "accepted") {
    await mailSafe("owner-offer-accepted", () => sendOwnerOfferNews(req, "accepted"));
    return { ...view, outcome: "accepted_now" };
  }
  if (r.outcome === "conflict") {
    // ⑫ "közben elkelt": the request closes honestly, nothing is booked, the owner hears.
    await db
      .updateTable("booking_request")
      .set({
        status: "declined",
        decided_at: new Date(),
        decided_by: "auto",
        decision_note: T(ctx.lang, "Az ajánlat elfogadásakor a napok már foglaltak voltak."),
      })
      .where("id", "=", req.id)
      .where("status", "=", "offered")
      .execute();
    await mailSafe("owner-offer-conflict", () => sendOwnerOfferNews(req, "conflict"));
    return { ...view, outcome: "conflict" };
  }
  return { ...view, outcome: "accepted" };
}

/**
 * ⑬ The owner records that the guest accepted by phone or by reply — the same step
 * the guest's button runs, started by the owner (admin, ownership-checked by caller).
 */
export async function recordOfferAcceptedByOwner(
  actionToken: string,
  publicBaseUrl: string | null,
): Promise<DecisionResult> {
  const req = await loadRequest({ token: actionToken });
  if (!req) return { ok: false, outcome: "unknown" };
  const ctx = await siteMailContext(req.site_id);
  const base = {
    guestName: req.guest_name,
    dateFrom: dayStr(req.date_from),
    dateTo: dayStr(req.date_to),
    lang: ctx.lang,
  };
  if (req.status !== "offered") return { ok: true, outcome: "already", ...base };
  return acceptCore(req, "owner", "offered", req.decision_note ?? null, publicBaseUrl, base);
}

/** The owner hears how their offer ended (never for the owner's own recording). */
async function sendOwnerOfferNews(
  req: RequestRow,
  kind: "accepted" | "declined" | "conflict" | "expired",
): Promise<void> {
  const ctx = await siteMailContext(req.site_id);
  const lang = ctx.lang;
  if (!ctx.notifyList.length) {
    console.warn(`[booking] nincs értesítési cím — az ajánlat kimenetele (${req.id}, ${kind}) CSAK naplózva`);
    return;
  }
  const hu = {
    guest: req.guest_name,
    from: huDate(dayStr(req.date_from)),
    to: huDate(dayStr(req.date_to)),
    unit: req.unit_name ?? "",
  };
  const total = req.quoted_total ? formatAmount(req.quoted_total, req.quoted_currency ?? "HUF") : "";
  const M = {
    accepted: {
      subject: T(lang, "{guest} elfogadta az ajánlatát", hu),
      body: T(
        lang,
        "A foglalás végleges: {unit}, {from} — {to}, {n} fő, {total}. A napok foglaltak a naptárban.",
        { ...hu, n: req.guests, total },
      ),
    },
    declined: {
      subject: T(lang, "{guest} nem kérte az ajánlatot", hu),
      body: T(lang, "{guest} a {from} — {to} közötti ajánlatot nem kérte. A napok szabadok maradtak.", hu),
    },
    conflict: {
      subject: T(lang, "{guest} elfogadta volna az ajánlatát, de a napok közben elkeltek", hu),
      body: T(
        lang,
        "{guest} elfogadta volna a {from} — {to} közötti ajánlatot, de ezekre a napokra közben másik foglalás került. A foglalás nem jött létre; ha tud másik időpontot, keresse meg a vendéget.",
        hu,
      ),
    },
    expired: {
      subject: T(lang, "Lejárt egy árajánlat: {guest}, {from} — {to}", hu),
      body: T(
        lang,
        "{guest} nem fogadta el időben a {from} — {to} közötti ajánlatot, ezért az lejárt. A vendéget értesítettük, a napok szabadok.",
        hu,
      ),
    },
  }[kind];
  const body = `${M.body}\n\n${ctx.hostName}\n`;
  await getEmailSender().send({
    to: ctx.notifyList.join(", "),
    audience: "guest",
    subject: M.subject,
    text: body,
    html: bookingHtml(body),
  });
  if (ctx.tenantId) {
    await logTenantMessage({
      tenantId: ctx.tenantId,
      channel: "email",
      kind: "booking",
      subject: M.subject,
      bodyText: body,
      recipient: ctx.notifyList.join(", "),
      relatedKind: "booking_request",
      relatedId: req.id,
    });
  }
}

/** Close a lapsed offer: status, then both sides are told (⑫). */
async function expireOffer(req: RequestRow): Promise<boolean> {
  const upd = await db
    .updateTable("booking_request")
    .set({ status: "expired", decided_at: new Date(), decided_by: "system" })
    .where("id", "=", req.id)
    .where("status", "=", "offered")
    .executeTakeFirst();
  if (!Number(upd.numUpdatedRows)) return false;
  await mailSafe("guest-offer-expired", () => sendGuestOfferExpired(req));
  await mailSafe("owner-offer-expired", () => sendOwnerOfferNews(req, "expired"));
  return true;
}

async function sendGuestOfferExpired(req: RequestRow): Promise<void> {
  const ctx = await siteMailContext(req.site_id);
  const lang = ctx.lang;
  const from = huDate(dayStr(req.date_from));
  const to = huDate(dayStr(req.date_to));
  const body =
    T(lang, "Kedves {name}!", { name: req.guest_name }) +
    `\n\n` +
    T(
      lang,
      "A {from} — {to} közötti időszakra küldött árajánlat lejárt, a napokat nem tartottuk tovább. Ha még szeretne jönni, kérjen új ajánlatot a szállás oldalán, vagy válaszoljon erre a levélre.",
      { from, to },
    ) +
    `\n\n${ctx.hostName}\n`;
  await getEmailSender().send({
    to: req.guest_email,
    audience: "guest",
    ...guestIdentity(ctx),
    subject: T(lang, "Az árajánlat lejárt: {from} — {to}", { from, to }),
    text: body,
    html: bookingHtml(body),
  });
}

/** The tick's half of ⑫: every offer past its deadline lapses. */
export async function expireStaleOffers(): Promise<number> {
  const rows = await db
    .selectFrom("booking_request")
    .innerJoin("site_unit", "site_unit.id", "booking_request.unit_id")
    .selectAll("booking_request")
    .select("site_unit.name as unit_name")
    .where("booking_request.status", "=", "offered")
    .execute();
  let n = 0;
  for (const r of rows as unknown as RequestRow[]) {
    const hours = Number((await bookingRules(r.site_id)).autoDeclineHours ?? 48);
    if (offerLapsed(r, hours) && (await expireOffer(r))) n++;
  }
  return n;
}
