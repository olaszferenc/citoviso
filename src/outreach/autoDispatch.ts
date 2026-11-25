// ADR-0405 — AUTOMATIC OUTREACH DISPATCH (owner, 2026-10-26: "SOS … hogy mielőbb elindulhasson
// az automata kiküldés … ezerszer kértem … ez a cél").
//
// The go list (MEHET) used to be text files on the dev machine and a Claude session clicked
// send-all lead by lead; when no session sat there, nothing went out (10-08 → 10-26). Now the
// go list is the `outreach_dispatch` table and a prod timer drains it.
//
// ⛔ EQUIVALENCE, NOT A SHORTCUT. One tick does what the console's send-all does, in the same
// order, with the same functions: photo gate → createProspect → guard/Vera confirm check →
// sendOutreachMail → activity log (no mobile pair since 2026-11-20). Every send gate (unsubscribe, one-shot,
// address lock, §C, language pack, photo health, verdicts, weekday 9–16 window) re-runs inside
// those functions. What the console solves with a human click (a confirmable guard finding, a
// photo-gate acknowledgement, a pending Vera review) the timer NEVER acknowledges: the row
// goes to `held` with the reason, and a person decides.
//
// Pacing: ONE lead per tick (the timer fires every few minutes), a daily cap from the
// `outreach_auto` setting, and the master switch in the same setting (off by default).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { getSetting, setSetting } from "../console/appSettings.js";
import { createProspect, setProspectVariants } from "../console/data.js";
import { logLeadActivity, SYSTEM_ACTOR } from "../console/leadActivity.js";
import { assessMockPhotos, photoAcksOf, photoGateBlocks } from "./mockPhotoHealth.js";
import { ackCoversVerdicts, blockingVerdicts, copyHashOf, hasPendingReview, reviewOf, verdictAckOf } from "./mockVerdictGate.js";
import { sendOutreachMail } from "./sendBatch.js";
import { DISPATCH_MIN_OWN_PHOTOS, LEAD_OWN_PHOTOS_SQL, MOCK_CURRENT_GENERATOR_SQL, MOCK_OWN_PHOTOS_OK_SQL } from "./mockPhotoGate.js";
import { MOCK_QA_PASSED_SQL, QA_STALE_NOTE, qaBlockReason, qaReviewState } from "./mockQaReview.js";
import { dailyCapFor, outreachWindowBlocksIn } from "./countryOutreach.js";
import { leadEmails, outreachPrefill } from "../email/leadEmails.js";
import { sharedContactBlocks, twinAlreadyContacted } from "./sharedContactGate.js";
import { isAllowlistedTestNumber } from "./sendOutreachSms.js";
import { ownerTestPhoneExempt } from "./ownerTestPhone.js";
import { normalizePhoneIn } from "../text/phoneCountry.js";
import { allCountriesSync, countryConfigSync, countryOf, countryOfLeads, type CountryConfig } from "../country.js";
import type { QualifiedLead } from "../scraper/types.js";
import { applyColdBrake, parseColdRamp, rampCapOn, type ColdRamp } from "./coldRamp.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import { ensureDailyPlan } from "./experiment.js";

/**
 * ADR-0409 — the queue's ORDER (owner, 2026-10-27: „a honlap nélküliek mennek elsőként, és ha
 * elfogytak, jöhetnek a többiek”). A claim takes the best-placed lead first:
 *   0 — no own site (lead.qualification no_site, or raw.websiteStatus none / portal_only),
 *   1 — an outdated own site, 2 — a modern own site, 3 — not classified;
 * owner 2026-11-17 („Haladjunk azokkal, akiknek van e-mail-címük, de nincs honlapjuk. Aztán WhatsApp,
 * ahol nincs e-mail nincs honlap”): within a site rank a lead WITH an e-mail address (raw.email or
 * raw.otherEmails) goes before one without; within that the oldest queued row. A subquery, not a
 * join: the FOR UPDATE SKIP LOCKED claim keeps locking the dispatch row alone.
 */
export const DISPATCH_PRIORITY = sql<number>`(
  select (case
    when l.qualification = 'no_site' or l.raw->>'websiteStatus' in ('none', 'portal_only') then 0
    when l.qualification = 'outdated' then 1
    when l.qualification = 'modern' then 2
    else 3
  end) * 2 + (case
    when btrim(coalesce(l.raw->>'email', '')) <> '' then 0
    when jsonb_typeof(l.raw->'otherEmails') = 'array' and exists (
      select 1 from jsonb_array_elements_text(l.raw->'otherEmails') e where btrim(e) <> ''
    ) then 0
    else 1
  end)
  from lead l where l.id = outreach_dispatch.lead_id
)`;

export const AUTO_SETTING_KEY = "outreach_auto";
export const DEFAULT_DAILY_CAP = 40;
/**
 * ORSZÁG-RÉTEG 3/5: the country whose cap is `dailyCap` (the operator's 40) — the home market.
 * Every other country counts on its own (countryCaps, else its row's daily_quota).
 */
export const DISPATCH_HOME_COUNTRY = "HU";

export interface AutoDispatchSettings {
  /** Master switch — false = the timer sends nothing (the queue keeps filling). */
  readonly enabled: boolean;
  /** Leads contacted per Budapest day by the timer for the HOME country (e-mail and/or pair counts as one). */
  readonly dailyCap: number;
  /** ORSZÁG-RÉTEG 3/5: per-country caps (ISO-2 → leads per that country's day); absent = the row's daily_quota. */
  readonly countryCaps?: Readonly<Record<string, number>>;
  /**
   * The cold lane's ramp (coldRamp.ts, owner 2026-11-18): while set, the day's TOTAL (all countries)
   * is bounded by the ramp's cap, the home country's cap is lifted to it, each timer firing sends
   * only its even share of the remainder, and the brake judges yesterday before the first send.
   */
  readonly ramp?: ColdRamp | null;
}

export async function getAutoDispatchSettings(): Promise<AutoDispatchSettings> {
  const raw = await getSetting(AUTO_SETTING_KEY);
  let parsed: Partial<AutoDispatchSettings> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as Partial<AutoDispatchSettings>) : {};
  } catch {
    // A broken value must not send: treat it as "off".
    return { enabled: false, dailyCap: DEFAULT_DAILY_CAP };
  }
  const cap = Number(parsed.dailyCap);
  const caps = Object.entries((parsed.countryCaps ?? {}) as Record<string, unknown>).filter(
    (e): e is [string, number] => /^[A-Z]{2}$/.test(e[0]) && Number.isInteger(e[1]) && (e[1] as number) >= 0,
  );
  const ramp = parseColdRamp(parsed.ramp);
  return {
    enabled: parsed.enabled === true,
    dailyCap: Number.isInteger(cap) && cap >= 0 ? cap : DEFAULT_DAILY_CAP,
    ...(caps.length ? { countryCaps: Object.fromEntries(caps) } : {}),
    ...(ramp ? { ramp } : {}),
  };
}

export async function setAutoDispatchSettings(next: Partial<AutoDispatchSettings>): Promise<AutoDispatchSettings> {
  const cur = await getAutoDispatchSettings();
  const merged = { ...cur, ...next };
  await setSetting(AUTO_SETTING_KEY, JSON.stringify(merged));
  return merged;
}

export type EnqueueResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Put one lead on the go list. Refuses a lead already on it (any status — a held or cancelled
 * row is put back with `requeue`, deliberately), a lead already contacted, and an artifact
 * that is not this lead's or not approved by the curator.
 */
export async function enqueueDispatch(input: {
  leadId: string;
  artifactId: string;
  by: string;
}): Promise<EnqueueResult> {
  const art = await db
    .selectFrom("mock_artifact")
    .select(["lead_id", "status", "inputs"])
    .where("id", "=", input.artifactId)
    .executeTakeFirst();
  if (!art) return { ok: false, reason: "nincs ilyen mock" };
  if (art.lead_id !== input.leadId) return { ok: false, reason: "a mock nem ehhez a leadhez tartozik" };
  if (art.status !== "approved") return { ok: false, reason: `a mock nincs jóváhagyva (állapot: ${art.status})` };
  // Vera's PASS on the CURRENT text is a precondition of the go decision (ADR-0329); the tick
  // re-checks it (a later text change makes it stale → held).
  if ((art.inputs as { reviewVerdict?: unknown } | null)?.reviewVerdict !== "pass") {
    return { ok: false, reason: "nincs rögzített Vera-PASS ezen a mockon" };
  }
  const contacted = await alreadyContacted(input.leadId);
  if (contacted) return { ok: false, reason: contacted.reason };
  // A lead that came from the homepage form asked for its mock itself: it gets the
  // "ready" mail on Vera's PASS (deliverInboundMock), never the cold outreach copy.
  const inbound = await db
    .selectFrom("mock_request")
    .select("id")
    .where("lead_id", "=", input.leadId)
    .executeTakeFirst();
  if (inbound) return { ok: false, reason: "a főoldalon kért mintát — a kész linket e-mailben kapja, nem megkeresést" };
  const row = await db
    .insertInto("outreach_dispatch")
    .values({ lead_id: input.leadId, artifact_id: input.artifactId, queued_by: input.by })
    .onConflict((oc) => oc.column("lead_id").doNothing())
    .returning("id")
    .executeTakeFirst();
  if (!row) return { ok: false, reason: "már a kiküldési sorban van (ha tartva/visszavonva: requeue)" };
  return { ok: true, id: row.id };
}

/** Put a held / cancelled / skipped row back to the queue (a human decided). */
export async function requeueDispatch(leadId: string, by: string): Promise<boolean> {
  const r = await db
    .updateTable("outreach_dispatch")
    .set({ status: "queued", note: `újra sorba: ${by}` })
    .where("lead_id", "=", leadId)
    .where("status", "in", ["held", "cancelled", "skipped"])
    .executeTakeFirst();
  return Number(r.numUpdatedRows) > 0;
}

/** The note prefix that marks a RESEND row (requeueResend); the tick reads it to lift the contacted gate. */
export const RESEND_NOTE_PREFIX = "ÚJRAKÜLDÉS";

/**
 * ADR-0459 follow-up (owner 2026-11-18, „küldjük az elbukott gmaileseknek”): put an already-SENT
 * lead back on the go list because its letter is known to have been lost (the main domain's
 * Gmail spam window, 2026-11-16 11:05 → 11-18 12:30). The prospect's e-mail stamp is lifted so
 * sendOutreachMail's per-row one-shot opens, the dispatch row goes back to `queued` with its
 * ORIGINAL queued_at (it sorts before newer leads of the same rank) and a note the tick reads
 * (RESEND_NOTE_PREFIX → the contacted gate is skipped for this one row). Every other gate — §C,
 * window, cap, unsubscribe, reply, customer, address one-shot, photo, verdicts — runs again.
 * Refused when the lead answered, unsubscribed, viewed the plan (a human, not a bot), or is a
 * customer: those are not "lost" letters.
 */
export async function requeueResend(
  leadId: string,
  by: string,
  reason: string,
): Promise<{ ok: true; prospectId: string; originalSentAt: Date } | { ok: false; reason: string }> {
  const row = await db
    .selectFrom("outreach_dispatch")
    .select(["id", "status", "prospect_id", "note"])
    .where("lead_id", "=", leadId)
    .executeTakeFirst();
  if (!row) return { ok: false, reason: "nincs a kiküldési sorban" };
  if (row.status !== "sent") return { ok: false, reason: `a sor állapota ${row.status}, nem 'sent'` };
  if (row.note?.startsWith(RESEND_NOTE_PREFIX)) return { ok: false, reason: "már újraküldésre jelölve" };
  const p = await db
    .selectFrom("prospect")
    .select(["id", "email_sent_at", "sms_sent_at", "mms_sent_at", "sent_at", "unsubscribed_at", "status"])
    .where("lead_id", "=", leadId)
    .where("email_sent_at", "is not", null)
    .where("archived_at", "is", null)
    .orderBy("email_sent_at", "desc")
    .executeTakeFirst();
  if (!p?.email_sent_at) return { ok: false, reason: "nincs kiküldött e-mailje" };
  if (p.unsubscribed_at) return { ok: false, reason: "leiratkozott" };
  if (p.status === "order_intent" || p.status === "converted") return { ok: false, reason: `a prospect állapota ${p.status}` };
  const replied = await db.selectFrom("outreach_reply").select("id").where("lead_id", "=", leadId).executeTakeFirst();
  if (replied) return { ok: false, reason: "válaszolt" };
  const viewed = await db
    .selectFrom("mock_view")
    .select("id")
    .where("prospect_id", "=", p.id)
    .where((eb) => eb.or([eb("device", "is", null), eb("device", "<>", "bot")]))
    .executeTakeFirst();
  if (viewed) return { ok: false, reason: "megnézte a tervet — a levél célba ért" };
  const original = new Date(p.email_sent_at as Date | string);
  // The lost letter was no touch: when it was the prospect's ONLY channel (no SMS/MMS stamp, no
  // messenger send), the shared first-touch stamp (`sent_at`, H1 funnel base, ADR-0082) is lifted
  // too, so the resend becomes the first touch — otherwise the funnel report dates the lead by a
  // letter nobody saw and never shows the resend (owner 2026-11-19: „nem mutat a report ma
  // kiküldött linket”).
  const messengerSent = await db
    .selectFrom("mms_outbox")
    .select("id")
    .where("prospect_id", "=", p.id)
    .where("status", "=", "sent")
    .executeTakeFirst();
  const onlyTouch = p.sms_sent_at == null && p.mms_sent_at == null && !messengerSent;
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("prospect")
      .set({ email_sent_at: null, ...(onlyTouch ? { sent_at: null } : {}) })
      .where("id", "=", p.id)
      .execute();
    await trx
      .updateTable("outreach_dispatch")
      .set({
        status: "queued",
        attempts: 0,
        note: `${RESEND_NOTE_PREFIX} (${reason}; eredeti e-mail ${original.toISOString().slice(0, 16)}; ${by})`.slice(0, 1000),
      })
      .where("id", "=", row.id)
      .execute();
  });
  return { ok: true, prospectId: p.id, originalSentAt: original };
}

export async function cancelDispatch(leadId: string, by: string, reason: string): Promise<boolean> {
  const r = await db
    .updateTable("outreach_dispatch")
    .set({ status: "cancelled", note: `visszavonta ${by}: ${reason}` })
    .where("lead_id", "=", leadId)
    .where("status", "in", ["queued", "held"])
    .executeTakeFirst();
  return Number(r.numUpdatedRows) > 0;
}

/**
 * Why this lead must not get a FIRST contact anymore, or null. `twin`: the lead itself was not
 * contacted, but a lead sharing its e-mail or phone was (one owner, one outreach) → held.
 */
async function alreadyContacted(leadId: string, opts: { ignoreOwnStamps?: boolean } = {}): Promise<{ reason: string; twin: boolean } | null> {
  const p = opts.ignoreOwnStamps ? undefined : await db
    .selectFrom("prospect")
    .select(["id"])
    .where("lead_id", "=", leadId)
    .where((eb) =>
      eb.or([
        eb("sent_at", "is not", null),
        eb("email_sent_at", "is not", null),
        eb("mms_sent_at", "is not", null),
        eb("sms_sent_at", "is not", null),
      ]),
    )
    .executeTakeFirst();
  if (p) return { reason: "ez a lead már kapott megkeresést", twin: false };
  const lead = await db.selectFrom("lead").select(["raw"]).where("id", "=", leadId).executeTakeFirst();
  const raw = (typeof lead?.raw === "string" ? JSON.parse(lead.raw) : lead?.raw) as QualifiedLead | undefined;
  const twin = raw ? await twinAlreadyContacted(leadId, raw) : null;
  return twin ? { reason: twin, twin: true } : null;
}

/** The shared-contact reason for the lead's own phone, or null (no phone / the number is its alone). */
async function sharedPhoneHold(leadId: string): Promise<string | null> {
  const lead = await db.selectFrom("lead").select(["name", "raw"]).where("id", "=", leadId).executeTakeFirst();
  const raw = (typeof lead?.raw === "string" ? JSON.parse(lead.raw) : lead?.raw) as QualifiedLead | undefined;
  const phone = typeof raw?.phone === "string" ? raw.phone.trim() : "";
  if (!lead || !phone) return null;
  // ADR-0455: the number in the lead's own country (a Czech "777 123 456" is +420…); the HU
  // row keeps the Hungarian plan, so a Hungarian lead's key is what it always was.
  const e164 = normalizePhoneIn(phone, countryConfigSync(countryOf(raw))) ?? phone;
  return sharedContactBlocks(leadId, "phone", e164, isAllowlistedTestNumber(e164) || ownerTestPhoneExempt(lead.name, e164));
}

/**
 * ORSZÁG-RÉTEG 3/5: leads the timer contacted today in ONE country — that country's day, in its
 * zone. NEMZETKÖZI B: a row without a country is NOBODY's (fail closed — never counted as HU).
 * Only rows claimed before migration 0140 carry a NULL country, and those were all sent on
 * earlier days; since 0140 a row of an unknown country is held, never sent.
 */
export async function sentTodayIn(cfg: Pick<CountryConfig, "iso2" | "timeZone">): Promise<number> {
  const r = await db
    .selectFrom("outreach_dispatch")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("status", "=", "sent")
    .where("country", "=", cfg.iso2)
    .where("sent_at", ">=", sql<Date>`(date_trunc('day', now() AT TIME ZONE ${cfg.timeZone}) AT TIME ZONE ${cfg.timeZone})`)
    .executeTakeFirstOrThrow();
  return Number(r.n);
}

/**
 * Leads the timer contacted today, every country together — the cold RAMP's day total. The ramp
 * is the sending DOMAIN's reputation, not a market's (coldRamp.ts), so it counts on the house day.
 * country-layer-check ALLOW: house (domain) day, not a lead's clock.
 */
export async function sentToday(): Promise<number> {
  const r = await db
    .selectFrom("outreach_dispatch")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("status", "=", "sent")
    .where(
      "sent_at",
      ">=",
      sql<Date>`(date_trunc('day', now() AT TIME ZONE 'Europe/Budapest') AT TIME ZONE 'Europe/Budapest')`,
    )
    .executeTakeFirstOrThrow();
  return Number(r.n);
}

export type TickOutcome =
  | { readonly kind: "off" }
  | { readonly kind: "window"; readonly reason: string }
  | { readonly kind: "cap"; readonly sent: number; readonly cap: number }
  | { readonly kind: "empty" }
  | { readonly kind: "done"; readonly leadId: string; readonly status: "sent" | "held" | "skipped"; readonly note: string };

/**
 * ORSZÁG-RÉTEG 3/5 — which countries may get a lead NOW: their window is open (the lead's zone,
 * working days) and their own daily cap has room. The home country's closed window / full cap
 * is what the tick reports when nothing is open — a Hungarian-only queue sees today's answers.
 */
async function openCountries(
  now: Date,
  settings: AutoDispatchSettings,
): Promise<{ open: Set<string>; homeWindow: string | null; homeCap: { sent: number; cap: number } | null }> {
  const open = new Set<string>();
  let homeWindow: string | null = null;
  let homeCap: { sent: number; cap: number } | null = null;
  // The ramp governs the home market's cap (the operator's static 40 would stall the climb);
  // the day's total stays bounded by the ramp in runDispatchTick.
  const capSettings = settings.ramp
    ? { ...settings, dailyCap: Math.max(settings.dailyCap, rampCapOn(settings.ramp, budapestIsoDay(now))) }
    : settings;
  for (const cfg of allCountriesSync()) {
    const home = cfg.iso2 === DISPATCH_HOME_COUNTRY;
    const w = outreachWindowBlocksIn(now, cfg);
    if (w) {
      if (home) homeWindow = w;
      continue;
    }
    const cap = dailyCapFor(cfg, capSettings, DISPATCH_HOME_COUNTRY);
    const sent = await sentTodayIn(cfg);
    if (sent >= cap) {
      if (home) homeCap = { sent, cap };
      continue;
    }
    open.add(cfg.iso2);
  }
  return { open, homeWindow, homeCap };
}

/** How many queued rows one claim looks through for a lead of an open country. */
const CLAIM_SCAN = 500;

/**
 * One tick: at most ONE lead. `force` skips only the master switch (for a supervised first
 * run); the window and the cap always hold.
 */
/** Owner 2026-11-23 („csak azoknak akiknek min 5 saját képük van”, again „csak a sok minőségi
 *  képpel ellátott leadek”): the automatic dispatch takes only leads with at least this many OWN
 *  photos (Places + portal + own website — the same sum as the console's lead stock, leadStock.ts). */
export { DISPATCH_MIN_OWN_PHOTOS } from "./mockPhotoGate.js";

export async function runDispatchTick(now: Date, opts: { force?: boolean } = {}): Promise<TickOutcome> {
  // A tick that died mid-send leaves `sending`: it may or may not have sent, so a person
  // looks (held), never an automatic retry.
  await db
    .updateTable("outreach_dispatch")
    .set({ status: "held", note: "megszakadt futás — nézd meg a lead lapján, kiment-e, mielőtt újra sorba teszed" })
    .where("status", "=", "sending")
    .where("last_attempt_at", "<", new Date(now.getTime() - 30 * 60_000))
    .execute();

  let settings = await getAutoDispatchSettings();
  if (!settings.enabled && !opts.force) return { kind: "off" };
  if (settings.ramp) {
    // The brake first (once a day, before the first send), then the day's total against the ramp.
    settings = await applyColdBrake(now, settings, setAutoDispatchSettings);
    if (!settings.enabled && !opts.force) return { kind: "off" };
    const cap = rampCapOn(settings.ramp!, budapestIsoDay(now));
    const sent = await sentToday();
    if (sent >= cap) return { kind: "cap", sent, cap };
  }
  // ORSZÁG-RÉTEG 3/5: the window and the cap are the LEAD's country's (zone, working days, its
  // own counter). Nothing open anywhere → the home country's reason, as before.
  const { open, homeWindow, homeCap } = await openCountries(now, settings);
  if (!open.size) {
    if (homeWindow) return { kind: "window", reason: homeWindow };
    if (homeCap) return { kind: "cap", ...homeCap };
    return { kind: "window", reason: "egyik ország küldési ablaka sincs nyitva, vagy mindegyik napi kvótája betelt" }; // i18n-exempt: operátori ok, sosem éri el a leadet
  }

  // KÍSÉRLET-MOTOR (experiment.ts): the day's split of the cap among the enabled variants — the
  // guard runs and the split is computed on the first tick of the day; later ticks refresh the cap.
  // A failure never stops the send (the letter then goes out as the control).
  await ensureDailyPlan(now, settings.ramp ? rampCapOn(settings.ramp, budapestIsoDay(now)) : settings.dailyCap).catch((e) =>
    console.error(`[experiment] napi osztás hiba: ${(e as Error).message}`),
  );

  // Claim the best-placed queued row (DISPATCH_PRIORITY: no own site first, ADR-0409), the oldest
  // within its rank, among the leads of an OPEN country — the order holds within each country. A
  // lead whose country has no layer row is claimed too, and held with the reason (fail closed).
  // An overlapping tick finds nothing (SKIP LOCKED + status flip).
  const claimed = await db.transaction().execute(async (trx) => {
    const rows = await trx
      .selectFrom("outreach_dispatch")
      .select(["id", "lead_id", "artifact_id", "note"])
      .where("status", "=", "queued")
      // Owner 2026-11-23: only leads with at least DISPATCH_MIN_OWN_PHOTOS own photos go out; the
      // rest stay QUEUED, untouched, until the rule changes (no hold churn, no lost place).
      .where(sql<boolean>`exists (select 1 from lead l where l.id = outreach_dispatch.lead_id and ${LEAD_OWN_PHOTOS_SQL} >= ${DISPATCH_MIN_OWN_PHOTOS})`)
      // …and the mock that goes out actually shows them (2026-11-24) — else it stays queued for a rerender.
      .where(sql<boolean>`exists (select 1 from mock_artifact a where a.id = outreach_dispatch.artifact_id and ${MOCK_OWN_PHOTOS_OK_SQL} and ${MOCK_CURRENT_GENERATOR_SQL})`)
      // …and the quality colleague passed it (owner 2026-11-25, mockQaReview.ts) — else it stays queued for the look.
      .where(sql<boolean>`exists (select 1 from mock_artifact a where a.id = outreach_dispatch.artifact_id and ${MOCK_QA_PASSED_SQL})`)
      .orderBy(DISPATCH_PRIORITY)
      .orderBy("queued_at")
      .limit(CLAIM_SCAN)
      .execute();
    const cc = await countryOfLeads(rows.map((r) => r.lead_id));
    for (const cand of rows) {
      const iso = cc.get(cand.lead_id) ?? null;
      const known = iso ? countryConfigSync(iso) : null;
      if (known && !open.has(known.iso2)) continue;
      const row = await trx
        .selectFrom("outreach_dispatch")
        .select(["id", "lead_id", "artifact_id", "note"])
        .where("id", "=", cand.id)
        .where("status", "=", "queued")
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();
      if (!row) continue;
      await trx
        .updateTable("outreach_dispatch")
        .set({ status: "sending", attempts: sql`attempts + 1`, last_attempt_at: now, country: known?.iso2 ?? iso })
        .where("id", "=", row.id)
        .execute();
      return { ...row, country: known };
    }
    return null;
  });
  if (!claimed) return { kind: "empty" };

  let result: { status: "sent" | "held" | "skipped"; note: string; prospectId?: string };
  try {
    // Owner rule 2026-10-26 (again 11-09): whoever already answered (refusal, "not mine", closed) or
    // unsubscribed gets NOTHING more. In doubt we do not send — any reply or unsubscribe skips the lead.
    const answered = await db
      .selectFrom("outreach_reply")
      .select("id")
      .where("lead_id", "=", claimed.lead_id)
      .union(db.selectFrom("prospect").select("id").where("lead_id", "=", claimed.lead_id).where("unsubscribed_at", "is not", null))
      .limit(1)
      .executeTakeFirst();
    result = answered
      ? { status: "skipped", note: "nem küldjük: a lead már válaszolt vagy leiratkozott (tulaj-szabály 2026-10-26)" }
      : !claimed.country
        ? { status: "held", note: "a lead országa nincs az ország-rétegben — nem küldhető (zárva)" }
        : await dispatchOne(claimed.lead_id, claimed.artifact_id, { resend: Boolean(claimed.note?.startsWith(RESEND_NOTE_PREFIX)) });
  } catch (e) {
    result = { status: "held", note: `hiba: ${(e as Error).message}`.slice(0, 500) };
  }
  await db
    .updateTable("outreach_dispatch")
    .set({
      status: result.status,
      note: result.note.slice(0, 1000),
      ...(result.prospectId ? { prospect_id: result.prospectId } : {}),
      ...(result.status === "sent" ? { sent_at: new Date() } : {}),
    })
    .where("id", "=", claimed.id)
    .execute();
  return { kind: "done", leadId: claimed.lead_id, status: result.status, note: result.note };
}

/** Owner 2026-11-12 („122 mehet”): app_setting of lead ids allowed e-mail before the presence check.
 *  Since 2026-11-16 no e-mail lead waits for the check, so the dispatcher no longer reads it; the
 *  auto-approve script still writes it. */
export const EMAIL_UNCHECKED_OK_KEY = "email_unchecked_ok";

/**
 * Owner rule 2026-11-16 („mehet ki whatsappon … de csak olyan ahol nincs email”, then „2: igen” to
 * „van e-mail → e-mail, nincs e-mail → WhatsApp”): a lead with a recipient address gets the e-mail,
 * never held for the phone's Viber / WhatsApp check. The mobile pair goes ONLY when no e-mail went out
 * (no address, or the address was refused by a guard). Replaces the 2026-11-11 rule (Viber or WhatsApp present →
 * messenger only, no e-mail), which held e-mail leads for the presence check.
 *
 * The console's send-all, step by step, without the human clicks (those → held).
 */
async function dispatchOne(
  leadId: string,
  artifactId: string,
  opts: { resend?: boolean } = {},
): Promise<{ status: "sent" | "held" | "skipped"; note: string; prospectId?: string }> {
  // A RESEND row (requeueResend) is contacted by definition — its own lost letter is why it is
  // here — so only the twin half of the gate applies; everything downstream runs unchanged.
  const contacted = await alreadyContacted(leadId, { ignoreOwnStamps: opts.resend === true });
  // A twin (another lead on the same contact got the outreach) is held: a person decides.
  if (contacted) return { status: contacted.twin ? "held" : "skipped", note: contacted.reason };

  const art = await db
    .selectFrom("mock_artifact")
    .select(["status", "inputs", "path"])
    .where("id", "=", artifactId)
    .executeTakeFirst();
  if (!art) return { status: "skipped", note: "a mock időközben törlődött" };
  if (art.status !== "approved") return { status: "held", note: `a mock nincs jóváhagyva (állapot: ${art.status})` };
  // The quality colleague's look (owner 2026-11-25): the pass must be on THIS file — a re-render since
  // makes it stale, and the row waits (held) for a new look; the colleague's next pass re-queues it.
  const qa = await qaReviewState(artifactId);
  const qaBlock = qaBlockReason(qa);
  if (qaBlock) return { status: "held", note: qa.state === "stale" ? QA_STALE_NOTE : qaBlock };
  if (!(await planHasRooms(art.path))) {
    return { status: "held", note: "a mockból hiányzik a szobamodul — szobamodul nélküli terv nem megy ki" };
  }

  // Photo gate — the same check POST /lead/:id/prospect runs before createProspect.
  const health = await assessMockPhotos(artifactId);
  if (photoGateBlocks(health, photoAcksOf(art.inputs))) {
    return { status: "held", note: `kép-kapu: ${health.verdict} — a lead lapján kell dönteni` };
  }

  // Guard findings + Vera review — what heldForVerdictConfirm sends to the confirm dialog.
  const blocking = blockingVerdicts(art.inputs);
  if (blocking.length > 0 && (hasPendingReview(blocking) || !ackCoversVerdicts(verdictAckOf(art.inputs), blocking))) {
    return {
      status: "held",
      note: hasPendingReview(blocking)
        ? "Vera-ellenőrzés hiányzik vagy elavult (a szöveg változott)"
        : "őr-lelet megerősítésre vár (a konzol küldés-felugrójában)",
    };
  }

  const rcpt = await dispatchRecipient(leadId, artifactId);
  if (rcpt.ambiguous) {
    return { status: "held", note: "több e-mail-cím — a lead lapján válaszd ki, kinek menjen, majd küldd kézzel vagy tedd újra sorba" };
  }
  // A phone that also belongs to ANOTHER lodging means the whole contact set is suspect, not only
  // the mobile pair (owner 2026-11-09, Benó Balatongyörök ↔ BeNo Kőröshegy: the pair was held on
  // the shared number, the e-mail — attached by the same wrong match — still went to the other
  // business). So the collision holds the ENTIRE dispatch before anything is sent.
  const phoneHold = await sharedPhoneHold(leadId);
  if (phoneHold) return { status: "held", note: `e-mail sem ment: ${phoneHold}` };
  const prepared = await prepareDispatchProspect(leadId, artifactId, rcpt.contactEmail);
  if (!prepared.ok) return { status: prepared.status, note: prepared.note, ...(prepared.prospectId ? { prospectId: prepared.prospectId } : {}) };
  const prospectId = prepared.prospectId;

  const mail: Pick<Awaited<ReturnType<typeof sendOutreachMail>>, "outcome"> = await sendOutreachMail(prospectId);
  const mailNote =
    mail.outcome.kind === "sent"
      ? "e-mail kiment"
      : mail.outcome.kind === "flagged"
        ? `e-mail FLAG: ${mail.outcome.reasons.join(" · ")}`
        : mail.outcome.kind === "skipped"
          ? `e-mail nem ment: ${mail.outcome.reason}`
          : "e-mail: dry-run";
  // Owner 2026-11-16: e-mail out → no mobile message (WhatsApp / Viber / MMS) for this lead.
  // Owner 2026-11-20 („Email cím nélkül nem küldünk ki. Sms mms nem megy ki”, then „egyetértek”): when
  // the e-mail did not go out (no address, or a guard refused it) NO mobile pair is started either —
  // the row is held, so it neither counts as sent nor eats a slot of the day's cap. Measured 11-20:
  // 6 guard-refused e-mails were marked 'sent' because only an MMS (never delivered, cap 0) was queued.
  if (mail.outcome.kind !== "sent") {
    return { status: "held", note: `${mailNote} · mobilüzenet nem indul: e-mail nélkül nem küldünk (tulaj 2026-11-20)`, prospectId };
  }
  const note = `${mailNote} · mobil-pár nem ment: e-mail kiment, ezért mobilüzenet nem megy (tulaj 2026-11-16)`;
  await logLeadActivity({ leadId, tab: "ls-outreach", action: "prospect.send_all", actor: SYSTEM_ACTOR, subjectId: prospectId });
  return { status: "sent", note, prospectId };
}

/**
 * The recipient the console's „Követett link készítése” field starts with: the lead's ONLY
 * address, or the one an operator already chose on the lead page. With several and no choice,
 * `ambiguous` — the operator chooses there (owner decision 2026-10-04), the timer never picks
 * whom a cold mail reaches. (Measured 2026-10-26: without this the first automatic send went
 * out as a pair only, the lead's single address left out.) Shared with the approval page, so
 * its preview names the same recipient the send will use.
 */
export async function dispatchRecipient(
  leadId: string,
  artifactId: string,
): Promise<{ readonly contactEmail: string | undefined; readonly ambiguous: boolean }> {
  const lead = await db.selectFrom("lead").select("raw").where("id", "=", leadId).executeTakeFirst();
  const raw = (lead?.raw ?? null) as Parameters<typeof leadEmails>[0];
  const chosen = await db
    .selectFrom("prospect")
    .select("contact_email")
    .where("lead_id", "=", leadId)
    .where("mock_artifact_id", "=", artifactId)
    .where("contact_email", "is not", null)
    .executeTakeFirst();
  if (!chosen && leadEmails(raw).length > 1) return { contactEmail: undefined, ambiguous: true };
  return { contactEmail: chosen?.contact_email ?? (outreachPrefill(raw) || undefined), ambiguous: false };
}

/**
 * The tracked link the send goes out on: createProspect (idempotent per lead + mock) and, when
 * the lead has one, the second plan (plan-tabs). The 2026-10-26 „minimum kettő mock” rule is
 * lifted by ADR-0433 (owner 2026-11-08): a missing second plan no longer holds the send. Shared with the approval page: its preview is rendered
 * from the very prospect the send will use, so the link and the plan count in the text are the
 * ones that go out.
 */
export async function prepareDispatchProspect(
  leadId: string,
  artifactId: string,
  contactEmail: string | undefined,
): Promise<
  | { readonly ok: true; readonly prospectId: string }
  | { readonly ok: false; readonly status: "held" | "skipped"; readonly note: string; readonly prospectId?: string }
> {
  const prospect = await createProspect({ leadId, artifactId, contactEmail });
  if (!prospect) return { ok: false, status: "skipped", note: "a lead nem található" };
  // ADR-0433 (owner 2026-11-08, „A”): one plan is enough. A reviewed second plan is attached
  // when the lead has one; its absence no longer holds the send (it held 1536 of 1885 approvals).
  await attachSecondPlan(prospect.id);
  return { ok: true, prospectId: prospect.id };
}

export interface DispatchStatus {
  readonly settings: AutoDispatchSettings;
  readonly sentToday: number;
  readonly counts: Readonly<Record<string, number>>;
  /** ORSZÁG-RÉTEG 3/5: per country — sent today (its own day) against its own cap. */
  readonly byCountry: ReadonlyArray<{ readonly country: string; readonly sentToday: number; readonly cap: number }>;
  /** The cold ramp's day (coldRamp.ts): today's ceiling, the day's total, a brake hold if any. */
  readonly ramp?: { readonly capToday: number; readonly sentToday: number; readonly holdCap: number | null };
}

export async function dispatchStatus(): Promise<DispatchStatus> {
  const rows = await db
    .selectFrom("outreach_dispatch")
    .select(["status", (eb) => eb.fn.countAll<string>().as("n")])
    .groupBy("status")
    .execute();
  const settings = await getAutoDispatchSettings();
  const byCountry: { country: string; sentToday: number; cap: number }[] = [];
  for (const cfg of allCountriesSync()) {
    byCountry.push({ country: cfg.iso2, sentToday: await sentTodayIn(cfg), cap: dailyCapFor(cfg, settings, DISPATCH_HOME_COUNTRY) });
  }
  const sent = await sentToday();
  return {
    settings,
    sentToday: sent,
    counts: Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])),
    byCountry,
    ...(settings.ramp ? { ramp: { capToday: rampCapOn(settings.ramp, budapestIsoDay(new Date())), sentToday: sent, holdCap: settings.ramp.holdCap ?? null } } : {}),
  };
}

/**
 * Attach a second plan to a tracked link: another mock of the same lead that Vera PASSed on
 * its CURRENT text (a stale review does not count), different template, same photo set
 * (setProspectVariants enforces the last two). Already has alternatives → nothing to do.
 * `extendOffered`: the link already went out — the owner's one-time extension (2026-10-26).
 */
export async function attachSecondPlan(
  prospectId: string,
  opts: { extendOffered?: boolean } = {},
): Promise<{ ok: true; attached: string | null } | { ok: false; note: string }> {
  const p = await db
    .selectFrom("prospect")
    .select(["lead_id", "mock_artifact_id"])
    .where("id", "=", prospectId)
    .executeTakeFirst();
  if (!p) return { ok: false, note: "nincs ilyen prospect" };
  const has = await db
    .selectFrom("prospect_variant")
    .select("mock_artifact_id")
    .where("prospect_id", "=", prospectId)
    .executeTakeFirst();
  if (has) return { ok: true, attached: null };
  const mocks = await db
    .selectFrom("mock_artifact")
    .select(["id", "inputs", "status", "path"])
    .where("lead_id", "=", p.lead_id)
    .where("id", "!=", p.mock_artifact_id ?? "")
    .where("status", "!=", "rejected")
    .where("path", "is not", null)
    .orderBy("generated_at", "desc")
    .execute();
  const reviewed = mocks.filter((m) => {
    const r = reviewOf(m.inputs);
    return r?.verdict === "pass" && r.copyHash === copyHashOf(m.inputs);
  });
  const passed: typeof reviewed = [];
  for (const m of reviewed) if (await planHasRooms(m.path)) passed.push(m);
  const refusals: string[] = [];
  for (const m of passed) {
    const r = await setProspectVariants(prospectId, [m.id], opts);
    if (r.ok) return { ok: true, attached: m.id };
    refusals.push(r.reason);
  }
  return {
    ok: false,
    note: passed.length
      ? `a második terv nem csatolható (${refusals.join(", ")}) — más sablon és azonos fotókészlet kell`
      : reviewed.length
        ? "a Vera által ellenőrzött második tervből hiányzik a szobamodul — más sablonú, szobamodulos terv kell"
        : "nincs második, Vera által ellenőrzött terv — a lead lapján kell rögzíteni Vera ítéletét a másik mockra",
  };
}

/**
 * Coordinator rule 2026-10-27 (Relax Balaton, PENNY): a plan whose rendered page has no rooms
 * module never goes out — as the main plan the row is held, as a second plan it is skipped.
 * A missing or unreadable file counts as no rooms module.
 */
export async function planHasRooms(mockPath: string | null | undefined): Promise<boolean> {
  if (!mockPath) return false;
  try {
    const html = await readFile(path.resolve(process.cwd(), mockPath), "utf8");
    return html.includes('data-cit-module="rooms"');
  } catch {
    return false;
  }
}
