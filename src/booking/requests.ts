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
import { getEmailSender } from "../email/sender.js";
import { T, langForSite, prepareMailLang } from "../i18n/mail.js";
import { effectiveModuleConfig } from "../moduleConfig.js";
import { logTenantMessage } from "../tenant/messages.js";
import { blockingUnitIds } from "../tenant/unitScope.js";
import { formatAmount, getUnitPrices, quoteStayFrom, seasonCovers } from "../tenant/prices.js";
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

export interface CreateResult {
  readonly ok: boolean;
  readonly id?: string;
  /** Guest-facing messages when ok === false. */
  readonly errors: string[];
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
  const unit = await db
    .selectFrom("site_unit")
    .select("seasonal_only")
    .where("id", "=", unitId)
    .executeTakeFirst();
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
    const md = day.slice(5); // 'MM-DD'
    const match = seasons.find((s) => seasonCovers(s.from!, s.to!, md));
    // seasonal_only: a night outside every listed season is simply not for sale.
    if (!match && unit?.seasonal_only) closed = true;
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
    `\n${T(lang, "Ár (a foglaláskor érvényes árak szerint):")}\n` +
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
  const pricingRow = await db
    .selectFrom("site_module_config")
    .select("config")
    .where("site_id", "=", input.siteId)
    .where("module", "=", "pricing")
    .executeTakeFirst();
  const pricing = effectiveModuleConfig(
    "pricing",
    (pricingRow?.config ?? null) as Record<string, unknown> | null,
    null,
  );
  const quote = quoteStayFrom(await getUnitPrices(input.unitId), {
    dateFrom,
    dateTo,
    guests: Math.max(1, Math.round(input.guests || 1)),
    currency: String(pricing.currency ?? "HUF"),
    unitMode: String(pricing.unit ?? "per_night"),
    baseLabel: T(lang, "Alapár"),
  });

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
  return { ok: true, id: row.id, errors: [] };
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

  const body =
    T(lang, "Kedves {name}!", { name: req.guest_name }) +
    `\n\n` +
    T(lang, "Köszönjük! A foglalási kérése megérkezett a szállásadóhoz{unit}.", { unit }) +
    `\n\n` +
    T(
      lang,
      "A foglalás még nem végleges — a szállásadó személyesen igazolja vissza. Amint döntött, azonnal e-mailt küldünk.",
    ) +
    (ctx.expireHours
      ? `\n` +
        T(lang, "Ha {n} órán belül nem érkezik válasz, arról is értesítjük.", {
          n: ctx.expireHours,
        })
      : "") +
    `\n\n` +
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
    subject: T(lang, "Foglalási kérését rögzítettük: {from} — {to}", { from, to }),
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

  const text =
    T(lang, "Új foglalási kérés") +
    `${unit}\n\n` +
    `${T(lang, "Vendég:")} ${req.guest_name}\n` +
    `${T(lang, "Érkezés:")} ${huDate(from)}\n${T(lang, "Távozás:")} ${huDate(until)}\n` +
    `${T(lang, "Létszám:")} ${T(lang, "{n} fő", { n: req.guests })}\n` +
    (req.quoted_total
      ? `${T(lang, "Ár összesen (a foglaláskori árlista szerint):")} ${formatAmount(req.quoted_total, req.quoted_currency ?? "HUF")}\n`
      : "") +
    (req.guest_phone ? `${T(lang, "Telefon:")} ${req.guest_phone}\n` : "") +
    `${T(lang, "E-mail:")} ${req.guest_email}\n` +
    (req.message ? `\n${T(lang, "Üzenete:")}\n${req.message}\n` : "") +
    `\n${T(lang, "Elfogadom:")} ${yes}\n${T(lang, "Nem szabad:")} ${no}\n\n` +
    T(lang, "A vendég csak azután kap visszaigazolást, hogy Ön döntött.");

  const html =
    `<p style="font-size:17px"><strong>${T(lang, "Új foglalási kérés")}${esc(unit)}</strong></p>` +
    `<p style="font-size:16px;line-height:1.7">` +
    `<strong>${esc(req.guest_name)}</strong><br>` +
    `${esc(huDate(from))} — ${esc(huDate(until))}<br>` +
    `${esc(T(lang, "{n} fő", { n: req.guests }))}` +
    (req.quoted_total
      ? `<br><strong>${esc(formatAmount(req.quoted_total, req.quoted_currency ?? "HUF"))}</strong>`
      : "") +
    (req.guest_phone ? `<br>${T(lang, "Telefon:")} ${esc(req.guest_phone)}` : "") +
    `</p>` +
    (req.message ? `<p style="font-size:15px;color:#444">„${esc(req.message)}"</p>` : "") +
    `<p style="margin:28px 0">` +
    `<a href="${esc(yes)}" style="display:inline-block;padding:16px 28px;background:#16283f;` +
    `color:#fff;text-decoration:none;border-radius:10px;font-size:17px;font-weight:600">${T(lang, "Elfogadom")}</a>` +
    `&nbsp;&nbsp;` +
    `<a href="${esc(no)}" style="display:inline-block;padding:16px 28px;border:1px solid #ccc;` +
    `color:#16283f;text-decoration:none;border-radius:10px;font-size:17px">${T(lang, "Nem szabad")}</a>` +
    `</p>` +
    `<p style="font-size:14px;color:#666">${T(lang, "A vendég csak azután kap visszaigazolást, hogy Ön döntött.")}</p>`;

  const msg = {
    to,
    // Goes to the TENANT, but every line of it is their guest's personal data
    // (name, phone, dates) — the tenant is its controller, so no pilot BCC.
    audience: "guest" as const,
    subject: T(lang, "Foglalási kérés: {guest}, {from}–{to}", {
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
    return { ok: true, outcome: "declined", ...base };
  }

  // ACCEPT — the only place double booking is actually prevented. Re-check and
  // write the day rows in ONE transaction; a conflicting night aborts the whole thing.
  let conflict = false;
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
    await trx
      .updateTable("booking_request")
      .set({
        status: "accepted",
        decided_at: new Date(),
        decided_by: "owner",
        decision_note: decisionNote,
      })
      .where("id", "=", req.id)
      .execute();
  });

  if (conflict) return { ok: false, outcome: "conflict", ...base };
  void mailSafe("guest-accepted", () => sendGuestVerdict(req, "accepted", publicBaseUrl, decisionNote));

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
  return { ok: true, outcome: "accepted", autoDeclined: losers.length, ...base };
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
    expired++;
  }
  return expired;
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
