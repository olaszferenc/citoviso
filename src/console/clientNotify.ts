// CLIENT NEWS FOR THE HOUSE — a new free trial (mail + SMS) and a booking request the owner
// leaves unanswered (mail) reach the operator (ADR-0386; approved plan
// `assets/design-refs/console/proba-foglalas-lathato/`, owner 2026-10-14 „mehet”: E2 + the
// silent-booking letter).
//
// Why: until now a trial start was a `trial_start` event on the visit and nothing else —
// the operator learnt about it from /pricing ("Most 1 próba fut"), if at all (Elek O-2).
// And a booking request the owner does not answer lapses after autoDeclineHours (48 h by
// default): during a trial that is a lost guest and the worst first impression — the
// operator can still phone the owner, if he knows.
//
// Channel: the house alert (src/console/houseAlert.ts) — the alert e-mail address, and for
// the trial an SMS on the same filtered path: live host only, quiet hours 22–07 (held for
// the 07:00 digest), the 6 h / 4-per-hour noise filter. One message per event: the
// house_alert_once key is claimed before sending and released when no channel carried it,
// so the next hourly sweep retries. The sweep also catches a trial whose instant notice
// was lost (the process died between the start and the send).
//
// Operator text — outside the §B.18 customer-facing i18n scope.

import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { tenantSiteUrl } from "../domains.js";
import { bookingRef, bookingRules } from "../booking/requests.js";
import { budapestHhmm, budapestIsoDay } from "../text/budapestTime.js";
import { formatMoney } from "../text/money.js";
import { alertHouse, type HouseAlert } from "./houseAlert.js";
import { claimOnce } from "./stallWatch.js";
import { BOOKING_SILENT_HOURS } from "./leadClient.js";

/** A trial older than this is history: the first sweep after the deploy must not announce old ones. */
export const TRIAL_NOTICE_LOOKBACK_HOURS = 24;
/** Pending requests older than this are not chased any more (they lapsed or the site never expires them). */
export const SILENT_BOOKING_LOOKBACK_DAYS = 7;

export interface ClientNotifyDeps {
  alert(a: HouseAlert): Promise<boolean>;
  claim(key: string, tag: string): Promise<boolean>;
  release(key: string): Promise<void>;
}

export const realClientNotifyDeps: ClientNotifyDeps = {
  alert: alertHouse,
  claim: claimOnce,
  release: async (key) => {
    await db.deleteFrom("house_alert_once").where("key", "=", key).execute();
  },
};

const huDay = (iso: string): string => `${iso.slice(0, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;
const mmdd = (iso: string): string => `${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;
const consoleLead = (leadId: string): string =>
  `${(config.consoleUrl ?? "").replace(/\/$/, "")}/lead/${leadId}`;

export interface TrialNoticeFacts {
  readonly leadId: string;
  readonly name: string;
  readonly city: string | null;
  readonly startedAt: Date;
  readonly untilDay: string;
  readonly lengthDays: number;
  readonly contact: string;
  readonly siteUrl: string | null;
  readonly discountPercent: number | null;
  readonly outreachAt: Date | null;
}

/** The new-trial letter + SMS — pure, so the guard reads the exact texts. */
export function trialNoticeMessage(f: TrialNoticeFacts): { subject: string; text: string; sms: string } {
  const where = f.city ? `${f.name}, ${f.city}` : f.name;
  const subject = `Citoviso: új ingyenes próba — ${f.name}${f.city ? ` (${f.city})` : ""}`;
  const lines = [
    "Új ingyenes próba indult.",
    "",
    `Szállás: ${where}`,
    `Indult: ${huDay(budapestIsoDay(f.startedAt))} ${budapestHhmm(f.startedAt)} · lejár: ${huDay(f.untilDay)} (${f.lengthDays} nap)`,
    `Kapcsolattartó: ${f.contact}`,
    `Honnan: a minta-honlap próba-űrlapja${f.outreachAt ? ` (előtte megkeresés: ${mmdd(budapestIsoDay(f.outreachAt))})` : " (megkeresés nélkül)"}`,
    ...(f.siteUrl ? [`Élő oldal: ${f.siteUrl}`] : []),
    ...(f.discountPercent ? [`Folytatási kedvezmény: ${f.discountPercent}%, a lejáratig`] : []),
    "",
    "Ezzel a leaddel nincs teendőd. Hideg megkeresés neki már nem megy.",
    "A lejárat előtt 3 és 1 nappal a rendszer magától emlékezteti.",
    "",
    `Konzol: ${consoleLead(f.leadId)}`,
  ];
  const host = f.siteUrl ? ` ${f.siteUrl.replace(/^https?:\/\//, "")}` : "";
  const sms = `Citoviso: UJ PROBA - ${where.replace(/[[\]]/g, "")}. Lejar: ${f.untilDay.slice(5).replace("-", ".")}.${host}`;
  return { subject, text: lines.join("\n"), sms };
}

async function trialFacts(trialId: string): Promise<TrialNoticeFacts | null> {
  const r = await db
    .selectFrom("free_trial")
    .innerJoin("lead", "lead.id", "free_trial.lead_id")
    .leftJoin("tenant", "tenant.id", "free_trial.tenant_id")
    .leftJoin("site", "site.tenant_id", "tenant.id")
    .leftJoin("offer", "offer.id", "free_trial.offer_id")
    .select([
      "free_trial.lead_id as leadId", "free_trial.started_at as startedAt", "free_trial.trial_until as until",
      "free_trial.contact_name as cName", "free_trial.contact_email as cEmail", "free_trial.contact_phone as cPhone",
      "free_trial.status as status", "lead.name as name", "lead.raw as raw",
      "site.slug as slug", "site.custom_domain as customDomain", "offer.percent as percent",
    ])
    .where("free_trial.id", "=", trialId)
    .executeTakeFirst();
  if (!r || r.status !== "active") return null;
  const sent = await db
    .selectFrom("prospect")
    .select("sent_at")
    .where("lead_id", "=", r.leadId)
    .where("sent_at", "is not", null)
    .orderBy("sent_at", "asc")
    .executeTakeFirst();
  const startedAt = new Date(r.startedAt as unknown as string);
  const untilDay = budapestIsoDay(new Date(r.until as unknown as string));
  const startDay = budapestIsoDay(startedAt);
  return {
    leadId: r.leadId,
    name: r.name,
    city: ((r.raw ?? {}) as { city?: string }).city ?? null,
    startedAt,
    untilDay,
    lengthDays: Math.round((Date.parse(`${untilDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86_400_000),
    contact: [r.cName, r.cEmail, r.cPhone].filter(Boolean).join(" · "),
    siteUrl: r.slug || r.customDomain ? tenantSiteUrl(config.publicSiteUrl, r.slug ?? null, r.customDomain ?? null) : null,
    discountPercent: r.percent && r.percent > 0 ? r.percent : null,
    outreachAt: sent?.sent_at ? new Date(sent.sent_at as unknown as string) : null,
  };
}

/**
 * Tell the house about ONE new trial — once (house_alert_once `trial-start:<id>`). Called
 * fire-and-forget right after startTrial, and by the hourly sweep. Never throws.
 */
export async function notifyTrialStarted(
  trialId: string,
  deps: ClientNotifyDeps = realClientNotifyDeps,
): Promise<"sent" | "skip" | "failed"> {
  const key = `trial-start:${trialId}`;
  try {
    const f = await trialFacts(trialId);
    if (!f) return "skip";
    if (!(await deps.claim(key, "trial-start"))) return "skip";
    const m = trialNoticeMessage(f);
    const ok = await deps.alert({ tag: "trial-start", subject: m.subject, text: m.text, sms: true, smsKey: key, smsText: m.sms });
    if (!ok) {
      await deps.release(key);
      console.error(`[client-notify] új próba (${trialId}) értesítése NEM ment ki — a következő óra újrapróbálja`);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error(`[client-notify] új próba (${trialId}) értesítése elhasalt:`, e);
    return "failed";
  }
}

export interface SilentBookingFacts {
  readonly leadId: string | null;
  readonly name: string;
  readonly bookingId: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly guests: number;
  readonly children: number | null;
  readonly total: number | null;
  readonly currency: string | null;
  readonly createdAt: Date;
  readonly ageHours: number;
  /** autoDeclineHours of the site (0 = never lapses). */
  readonly expiresAfterHours: number;
  readonly inTrial: boolean;
}

/** The silent-booking letter — pure, so the guard reads the exact text. */
export function silentBookingMessage(f: SilentBookingFacts): { subject: string; text: string } {
  const nights = Math.round((Date.parse(`${f.dateTo}T00:00:00Z`) - Date.parse(`${f.dateFrom}T00:00:00Z`)) / 86_400_000);
  const people = `${f.guests} fő${f.children ? ` (ebből ${f.children} gyerek)` : ""}`;
  const money = f.total != null ? ` · ${formatMoney(f.total, f.currency ?? "HUF", "hu")}` : "";
  const at = (d: Date) => `${mmdd(budapestIsoDay(d))} ${budapestHhmm(d)}`;
  const expiry =
    f.expiresAfterHours > 0
      ? `lejár: ${at(new Date(f.createdAt.getTime() + f.expiresAfterHours * 3_600_000))}, ha addig sem válaszol`
      : "magától nem jár le — a vendég vár";
  return {
    subject: `Citoviso: válasz nélküli foglalás — ${f.name} (${f.ageHours} órája)`,
    text: [
      `A(z) ${f.name} tulaja ${f.ageHours} órája nem válaszolt egy foglalási kérésre.`,
      "",
      `Kérés: ${bookingRef(f.bookingId)} · ${mmdd(f.dateFrom)}–${mmdd(f.dateTo)} (${nights} éj) · ${people}${money}`,
      `Beérkezett: ${at(f.createdAt)} · ${expiry}`,
      "",
      f.inTrial
        ? "Érdemes felhívni: a próba alatt egy elveszett vendég a legrosszabb első élmény."
        : "Érdemes felhívni: egy elveszett vendég a tulajnak is kár.",
      ...(f.leadId ? [`Konzol: ${consoleLead(f.leadId)}`] : []),
    ].join("\n"),
  };
}

/** One sweep: new trials not yet announced + pending requests silent for 24 h. Never throws per item. */
export async function runClientNotices(
  now: Date,
  deps: ClientNotifyDeps = realClientNotifyDeps,
): Promise<{ trials: number; silentBookings: number; failed: number }> {
  let trials = 0;
  let silentBookings = 0;
  let failed = 0;

  const fresh = await db
    .selectFrom("free_trial")
    .select("id")
    .where("status", "=", "active")
    .where("started_at", ">", new Date(now.getTime() - TRIAL_NOTICE_LOOKBACK_HOURS * 3_600_000))
    .execute();
  const announced = fresh.length
    ? new Set(
        (await db.selectFrom("house_alert_once").select("key").where("key", "in", fresh.map((t) => `trial-start:${t.id}`)).execute()).map(
          (r) => r.key,
        ),
      )
    : new Set<string>();
  for (const t of fresh) {
    if (announced.has(`trial-start:${t.id}`)) continue;
    const r = await notifyTrialStarted(t.id, deps);
    if (r === "sent") trials++;
    else if (r === "failed") failed++;
  }

  const silent = await db
    .selectFrom("booking_request")
    .innerJoin("site", "site.id", "booking_request.site_id")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .leftJoin("free_trial", (j) => j.onRef("free_trial.tenant_id", "=", "tenant.id").on("free_trial.status", "=", "active"))
    .select([
      "booking_request.id as id", "booking_request.site_id as siteId", "booking_request.date_from as dateFrom",
      "booking_request.date_to as dateTo", "booking_request.guests as guests", "booking_request.children as children",
      "booking_request.quoted_total as total", "booking_request.quoted_currency as currency",
      "booking_request.created_at as createdAt", "tenant.display_name as name", "tenant.lead_id as leadId",
      "free_trial.id as trialId",
    ])
    .where("booking_request.status", "=", "pending")
    .where(sql<boolean>`booking_request.created_at <= ${new Date(now.getTime() - BOOKING_SILENT_HOURS * 3_600_000)}`)
    .where(sql<boolean>`booking_request.created_at > ${new Date(now.getTime() - SILENT_BOOKING_LOOKBACK_DAYS * 86_400_000)}`)
    .execute();
  for (const b of silent) {
    const key = `booking-silent:${b.id}`;
    try {
      const hours = Number((await bookingRules(b.siteId)).autoDeclineHours ?? 48);
      // A window shorter than the mark: the request lapses before anyone could act on a letter.
      if (hours > 0 && hours <= BOOKING_SILENT_HOURS) continue;
      if (!(await deps.claim(key, "booking-silent"))) continue;
      const createdAt = new Date(b.createdAt as unknown as string);
      const m = silentBookingMessage({
        leadId: b.leadId,
        name: b.name,
        bookingId: b.id,
        dateFrom: String(b.dateFrom).slice(0, 10),
        dateTo: String(b.dateTo).slice(0, 10),
        guests: Number(b.guests),
        children: b.children == null ? null : Number(b.children),
        total: b.total == null ? null : Number(b.total),
        currency: b.currency ?? null,
        createdAt,
        ageHours: Math.floor((now.getTime() - createdAt.getTime()) / 3_600_000),
        expiresAfterHours: hours,
        inTrial: !!b.trialId,
      });
      // Mail only, one per request (approved plan): the owner may still answer today.
      const ok = await deps.alert({ tag: "booking-silent", subject: m.subject, text: m.text });
      if (ok) silentBookings++;
      else {
        await deps.release(key);
        failed++;
      }
    } catch (e) {
      console.error(`[client-notify] válasz nélküli foglalás (${b.id}) jelzése elhasalt:`, e);
      failed++;
    }
  }
  return { trials, silentBookings, failed };
}
