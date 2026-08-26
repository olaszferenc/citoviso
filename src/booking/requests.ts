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
import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { T, langForSite, prepareMailLang } from "../i18n/mail.js";
import { effectiveModuleConfig } from "../moduleConfig.js";
import { getUnitPrices, seasonCovers } from "../tenant/prices.js";

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
  const taken = await db
    .selectFrom("availability_day")
    .select("day")
    .where("unit_id", "=", input.unitId)
    .where("day", ">=", dateFrom)
    .where("day", "<", dateTo)
    .executeTakeFirst();
  if (taken) {
    return {
      ok: false,
      errors: [T(lang, "Sajnos ezek a napok már foglaltak. Válasszon másik időpontot.")],
    };
  }

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
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  await notifyOwner(row.id, token, String(rules.notifyEmail ?? ""), publicBaseUrl);
  return { ok: true, id: row.id, errors: [] };
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

  // Where to write: the module's notification address, else the tenant's contact.
  let to = configuredEmail.trim();
  if (!to) {
    const fallback = await db
      .selectFrom("site")
      .innerJoin("tenant_user", "tenant_user.tenant_id", "site.tenant_id")
      .select("tenant_user.contact_email as email")
      .where("site.id", "=", req.site_id)
      .executeTakeFirst();
    to = fallback?.email ?? "";
  }
  if (!to) return; // nowhere to send; the request still waits in the admin inbox

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

  await getEmailSender().send({
    to,
    // Goes to the TENANT, but every line of it is their guest's personal data
    // (name, phone, dates) — the tenant is its controller, so no pilot BCC.
    audience: "guest",
    subject: T(lang, "Foglalási kérés: {guest}, {from}–{to}", {
      guest: req.guest_name,
      from: huDate(from),
      to: huDate(until),
    }),
    text,
    html,
  });
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
}

/**
 * Apply the owner's verdict. Idempotent: the link may be opened twice (e-mail
 * clients prefetch, owners double-tap), and the second visit must report the
 * decision already made rather than erroring or flipping it.
 */
export async function decideRequest(
  token: string,
  verdict: "accepted" | "declined",
  publicBaseUrl: string | null,
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

  if (verdict === "declined") {
    await db
      .updateTable("booking_request")
      .set({ status: "declined", decided_at: new Date() })
      .where("id", "=", req.id)
      .execute();
    await notifyGuest(req, "declined", publicBaseUrl);
    return { ok: true, outcome: "declined", ...base };
  }

  // ACCEPT — the only place double booking is actually prevented. Re-check and
  // write the day rows in ONE transaction; a conflicting night aborts the whole thing.
  let conflict = false;
  await db.transaction().execute(async (trx) => {
    const taken = await trx
      .selectFrom("availability_day")
      .select("day")
      .where("unit_id", "=", req.unit_id)
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
      .set({ status: "accepted", decided_at: new Date() })
      .where("id", "=", req.id)
      .execute();
  });

  if (conflict) return { ok: false, outcome: "conflict", ...base };
  await notifyGuest(req, "accepted", publicBaseUrl);
  return { ok: true, outcome: "accepted", ...base };
}

/** The guest hears the outcome — and only ever after the owner has decided. */
async function notifyGuest(
  req: RequestRow,
  outcome: "accepted" | "declined",
  publicBaseUrl: string | null,
): Promise<void> {
  const from = huDate(dayStr(req.date_from));
  const to = huDate(dayStr(req.date_to));
  const site = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select("tenant.display_name as name")
    .where("site.id", "=", req.site_id)
    .executeTakeFirst();
  // ADR-0067: the GUEST is written to in the site's language — the language they
  // just booked in. A Hungarian confirmation from a Polish guesthouse is a defect
  // the guest sees before the tenant ever does.
  const lang = await prepareMailLang(await langForSite(req.site_id));
  const host = site?.name ?? T(lang, "A szállásadó");
  const unit = req.unit_name ? ` (${req.unit_name})` : "";

  const subject =
    outcome === "accepted"
      ? T(lang, "Visszaigazolt foglalás: {from} — {to}", { from, to })
      : T(lang, "A kért időpont sajnos nem szabad: {from} — {to}", { from, to });
  const body =
    outcome === "accepted"
      ? T(lang, "Kedves {name}!", { name: req.guest_name }) +
        `\n\n` +
        T(lang, "{host} visszaigazolta a foglalását{unit}.", { host, unit }) +
        `\n\n` +
        `${T(lang, "Érkezés:")} ${from}\n${T(lang, "Távozás:")} ${to}\n` +
        `${T(lang, "Létszám:")} ${T(lang, "{n} fő", { n: req.guests })}\n\n` +
        T(
          lang,
          "A fizetés a helyszínen történik. Ha bármi változna, válaszoljon erre a levélre.",
        ) +
        `\n`
      : T(lang, "Kedves {name}!", { name: req.guest_name }) +
        `\n\n` +
        T(lang, "Sajnáljuk, a kért időpont ({from} — {to}) nem szabad{unit}.", {
          from,
          to,
          unit,
        }) +
        `\n\n` +
        T(lang, "Ha más időpont is szóba jöhet, keressen minket bizalommal.") +
        `\n\n${host}\n`;

  await getEmailSender().send({
    to: req.guest_email,
    // Addressed to the tenant's GUEST — never blind-copy this to us.
    audience: "guest",
    subject,
    text: body,
    ...(publicBaseUrl ? { html: `<p style="font-size:16px;line-height:1.7">${esc(body).replace(/\n/g, "<br>")}</p>` } : {}),
  });
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
  }));
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
      .set({ status: "expired", decided_at: new Date() })
      .where("id", "=", r.id)
      .execute();
    expired++;
  }
  return expired;
}
