// ADR-0425 — ESCALATION for a trialist who does not log in (owner-approved 2026-11-05, plan
// assets/design-refs/console/proba-eszkalacio/: lead page „A”, helper letter „P2”).
//
// Measured 2026-11-05 on prod: both live trialists (Sáma day 9, Marilyn day 4) got the
// credentials letter and the ADR-0417 reminders, and neither set a password. The reminders
// repeat ONE channel (text + link); after day 8 nothing happens. On top of l0…l8, while the
// owner has not set a password (tenant_user.password_set_at / last_login_at):
//
//   e4  — from trial day 4: a RED flag in the console (lead list badge, lead page card,
//         dashboard tile). A ledger mark only — nothing is sent, so no window.
//   m5  — trial day 5: an MMS with the picture of the LIVE site („EZ MÁR AZ ÖN HONLAPJA” band)
//         — the channel they first answered. The companion SMS (fresh password link) goes
//         when the relay acks the MMS (the ADR-0083 pair rule: never before the picture).
//   h7  — trial day 7: a personal-tone letter signed with a LOCAL name (helperPersona.ts),
//         in the owner-approved frame (P2: approved ONCE, then automatic — zero human).
//   s10 — from trial day 10: „elakadt” — its own category on the report's trial tab.
//
// Day N = the start's Budapest calendar day + N − 1 (as ADR-0417 and the report count).
// Messages go weekdays 9–16 (the hourly tick); a step that came due on a weekend goes on the
// next weekday. A trial already past several days when this shipped gets every due step once.
// Every row in free_trial_notice is claimed BEFORE the send — a re-run never sends twice.
// A lead marked „ne keressük” (lead.contact_block_at, ADR-0421) gets no message at all.

import { db } from "../db/client.js";
import { config } from "../config.js";
import { issuePasswordToken, passwordLinkUrl } from "../auth/passwordLink.js";
import { buildTrialHelperEmail, buildTrialMmsSmsText } from "../email/loginEmail.js";
import { tenantLoginUrl } from "../email/platformLayout.js";
import { getEmailSender, type EmailSender } from "../email/sender.js";
import { T } from "../i18n/mail.js";
import { tenantSiteUrl } from "../domains.js";
import { sendMms as sendMmsDefault, type MmsMessage, type MmsSendResult } from "../mms/sender.js";
import { isTestLeadName } from "../outreach/ownerTestPhone.js";
import { sendSms as sendSmsDefault } from "../sms/sender.js";
import { mockOutreachWindowOpen } from "../sms/sendWindow.js";
import { logTenantMessage } from "../tenant/messages.js";
import { addIsoDays, budapestIsoDay } from "../text/budapestTime.js";
import { helperFromName, helperName } from "./helperPersona.js";
import { liveHeading, renderLiveShot, type LiveShotResult } from "./liveShot.js";
import { loginContext, ownerHasLoggedIn, sendLoggedSms, type LoginSmsSender } from "./loginReminders.js";
import { trialDaysLeft } from "./notices.js";

export type EscalationStep = "e4" | "m5" | "h7" | "s10";
/** The trial day each step comes due on (day 1 = the start day). */
export const ESCALATION_DAYS: Readonly<Record<EscalationStep, number>> = { e4: 4, m5: 5, h7: 7, s10: 10 };

export interface EscalationDeps {
  readonly email: EmailSender;
  readonly sms: LoginSmsSender;
  readonly mms: (msg: MmsMessage) => Promise<MmsSendResult>;
  readonly shot: (trialId: string, siteUrl: string, lang: string) => Promise<LiveShotResult>;
  readonly heading: (siteUrl: string) => Promise<string | null>;
}

/** The trial day `now` falls on (1 = the start's Budapest day). */
export function trialDayOf(now: Date, startedAt: Date): number {
  const a = Date.parse(`${budapestIsoDay(startedAt)}T00:00:00Z`);
  const b = Date.parse(`${budapestIsoDay(now)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/** The Budapest day a step comes due on. */
export function escalationDay(step: EscalationStep, startedAt: Date): string {
  return addIsoDays(budapestIsoDay(startedAt), ESCALATION_DAYS[step] - 1);
}

type Channel = "email" | "sms" | "mms" | "mark";
type Status = "claimed" | "sent" | "failed" | "skipped";

async function claim(trialId: string, step: EscalationStep, channel: Channel, status: Status, detail: string | null): Promise<boolean> {
  const r = await db
    .insertInto("free_trial_notice")
    .values({ free_trial_id: trialId, step, channel, status, detail })
    .onConflict((oc) => oc.columns(["free_trial_id", "step", "channel"]).doNothing())
    .returning("id")
    .executeTakeFirst();
  return Boolean(r);
}

async function mark(trialId: string, step: EscalationStep, channel: Channel, status: Status, detail: string | null): Promise<void> {
  await db
    .updateTable("free_trial_notice")
    .set({ status, detail })
    .where("free_trial_id", "=", trialId)
    .where("step", "=", step)
    .where("channel", "=", channel)
    .execute();
}

/** Is the lead behind this trial marked „ne keressük” (ADR-0421)? */
async function contactBlocked(trialId: string): Promise<boolean> {
  const r = await db
    .selectFrom("free_trial")
    .innerJoin("lead", "lead.id", "free_trial.lead_id")
    .select("lead.contact_block_at as at")
    .where("free_trial.id", "=", trialId)
    .executeTakeFirst();
  return Boolean(r?.at);
}

async function siteUrlOf(tenantId: string): Promise<string | null> {
  const s = await db
    .selectFrom("site")
    .select(["slug", "status"])
    .where("tenant_id", "=", tenantId)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (!s?.slug || s.status !== "live") return null;
  return tenantSiteUrl(config.publicSiteUrl, s.slug, null);
}

/** ASCII MMS subject (WSP text-string), ~40 chars. */
function mmsSubject(siteName: string): string {
  const flat = siteName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "");
  return `Az On honlapja - ${flat}`.slice(0, 40).trim(); // i18n-exempt: ASCII MMS subject, HU-only channel
}

export interface EscalationRun {
  flagged: number;
  stalled: number;
  sent: number;
  queued: number;
  skipped: number;
  failed: number;
  windowClosed: boolean;
}

/** The hourly tick: marks (any time) + messages (weekdays 9–16). `deps` null = dry run (marks only). */
export async function runTrialEscalation(
  now: Date,
  deps: EscalationDeps | null,
  opts: { readonly onlyTrialIds?: readonly string[] } = {},
): Promise<EscalationRun> {
  const out: EscalationRun = { flagged: 0, stalled: 0, sent: 0, queued: 0, skipped: 0, failed: 0, windowClosed: !mockOutreachWindowOpen(now) };
  if (opts.onlyTrialIds && opts.onlyTrialIds.length === 0) return out;
  let q = db
    .selectFrom("free_trial")
    .innerJoin("lead", "lead.id", "free_trial.lead_id")
    .select([
      "free_trial.id as id",
      "free_trial.tenant_id as tenant_id",
      "free_trial.contact_email as contact_email",
      "free_trial.contact_phone as contact_phone",
      "free_trial.started_at as started_at",
      "free_trial.trial_until as trial_until",
      "lead.name as lead_name",
    ])
    .where("free_trial.status", "=", "active")
    .where("free_trial.tenant_id", "is not", null)
    .where("free_trial.trial_until", ">", now);
  if (opts.onlyTrialIds) q = q.where("free_trial.id", "in", [...opts.onlyTrialIds]);

  for (const t of await q.execute()) {
    // Owner, 2026-10-26: our own [TESZT] trials do not message anybody from the tick.
    if (!opts.onlyTrialIds && isTestLeadName(t.lead_name)) continue;
    const started = new Date(t.started_at as unknown as string);
    const until = new Date(t.trial_until as unknown as string);
    const day = trialDayOf(now, started);
    if (day < ESCALATION_DAYS.e4) continue;
    if (await ownerHasLoggedIn(t.tenant_id!)) continue;

    if (await claim(t.id, "e4", "mark", "sent", null)) out.flagged++;
    if (day >= ESCALATION_DAYS.s10 && (await claim(t.id, "s10", "mark", "sent", null))) out.stalled++;
    if (out.windowClosed || !deps) continue;
    if (day < ESCALATION_DAYS.m5) continue;
    if (await contactBlocked(t.id)) {
      for (const [s, ch] of [["m5", "mms"], ["h7", "email"]] as const) {
        if (day >= ESCALATION_DAYS[s] && (await claim(t.id, s, ch, "skipped", "ne keressük (contact_block)"))) out.skipped++;
      }
      continue;
    }
    const siteUrl = await siteUrlOf(t.tenant_id!);

    // m5 — the live-site MMS
    if (!t.contact_phone) {
      if (await claim(t.id, "m5", "mms", "skipped", "nincs telefonszám")) out.skipped++;
    } else if (!siteUrl) {
      if (await claim(t.id, "m5", "mms", "skipped", "nincs élő oldal")) out.skipped++;
    } else if (await claim(t.id, "m5", "mms", "claimed", null)) {
      try {
        const c = await loginContext(t.id);
        const shot = await deps.shot(t.id, siteUrl, c.lang);
        if (!shot.path) throw new Error(`az élő oldal képe nem készült el: ${shot.error ?? "?"}`);
        const r = await deps.mms({ to: t.contact_phone, imagePath: shot.path, subject: mmsSubject(c.siteName), freeTrialId: t.id });
        if (!r.ok) throw new Error(r.error ?? "az MMS nem ment ki");
        if (r.queued) {
          await mark(t.id, "m5", "mms", "claimed", `sorban (mms_outbox ${r.messageId ?? "?"})`);
          out.queued++;
        } else {
          await settleTrialMms(t.id, true, null, deps.sms);
          out.sent++;
        }
      } catch (e) {
        await mark(t.id, "m5", "mms", "failed", (e as Error).message.slice(0, 500));
        out.failed++;
        console.error(`[trial] m5 MMS SIKERTELEN · próba ${t.id}: ${(e as Error).message}`); // i18n-exempt: operátori napló
      }
    }

    // h7 — the helper letter
    if (day < ESCALATION_DAYS.h7) continue;
    if (!t.contact_email) {
      if (await claim(t.id, "h7", "email", "skipped", "nincs e-mail-cím")) out.skipped++;
      continue;
    }
    if (!(await claim(t.id, "h7", "email", "claimed", null))) continue;
    try {
      const c = await loginContext(t.id);
      const url = passwordLinkUrl(await issuePasswordToken(c.tenantUserId), c.lang);
      const msg = buildTrialHelperEmail({
        to: t.contact_email,
        username: c.username,
        setPasswordUrl: url,
        loginUrl: tenantLoginUrl(c.lang),
        siteName: c.siteName,
        contactName: c.contactName,
        daysLive: day - 1,
        daysLeft: trialDaysLeft(now, until),
        trialUntilIso: budapestIsoDay(until),
        heroHeading: siteUrl ? await deps.heading(siteUrl) : null,
        helperName: helperName(c.lang),
        fromName: helperFromName(c.lang),
        lang: c.lang,
      });
      await deps.email.send(msg);
      await logTenantMessage({
        tenantId: t.tenant_id!,
        channel: "email",
        kind: "credentials",
        subject: msg.subject,
        bodyText: msg.text.split(url).join(T(c.lang, "[egyszer használható link — kitakarva]")),
        recipient: msg.to,
        relatedKind: "free_trial_h7",
        relatedId: t.id,
      });
      await mark(t.id, "h7", "email", "sent", null);
      out.sent++;
    } catch (e) {
      await mark(t.id, "h7", "email", "failed", (e as Error).message.slice(0, 500));
      out.failed++;
      console.error(`[trial] h7 segítő levél SIKERTELEN · próba ${t.id}: ${(e as Error).message}`); // i18n-exempt: operátori napló
    }
  }
  return out;
}

/**
 * The MMS's verdict (the relay's ack, or the synchronous send on the dev box): on success
 * the ledger says sent and the companion SMS goes with a FRESH link; on a final failure the
 * ledger says failed. Never throws (the ack route must not fail on our side effect).
 */
export async function settleTrialMms(
  trialId: string,
  ok: boolean,
  error: string | null,
  sms: LoginSmsSender = sendSmsDefault,
): Promise<"sent" | "failed" | "skipped" | "already"> {
  try {
    if (!ok) {
      await mark(trialId, "m5", "mms", "failed", (error ?? "").slice(0, 500) || null);
      return "failed";
    }
    await mark(trialId, "m5", "mms", "sent", null);
    const t = await db.selectFrom("free_trial").select(["tenant_id", "contact_phone"]).where("id", "=", trialId).executeTakeFirst();
    if (!t?.tenant_id || !t.contact_phone) return "skipped";
    if (await ownerHasLoggedIn(t.tenant_id)) return (await claim(trialId, "m5", "sms", "skipped", "közben belépett")) ? "skipped" : "already";
    if (!(await claim(trialId, "m5", "sms", "claimed", null))) return "already";
    try {
      const c = await loginContext(trialId);
      const url = passwordLinkUrl(await issuePasswordToken(c.tenantUserId), c.lang);
      await sendLoggedSms(sms, t.tenant_id, trialId, "m5", t.contact_phone, buildTrialMmsSmsText({ setPasswordUrl: url, lang: c.lang }));
      await mark(trialId, "m5", "sms", "sent", null);
      return "sent";
    } catch (e) {
      await mark(trialId, "m5", "sms", "failed", (e as Error).message.slice(0, 500));
      console.error(`[trial] m5 kísérő SMS SIKERTELEN · próba ${trialId}: ${(e as Error).message}`); // i18n-exempt: operátori napló
      return "failed";
    }
  } catch (e) {
    console.error(`[trial] m5 nyugta-feldolgozás hiba · próba ${trialId}: ${(e as Error).message}`); // i18n-exempt: operátori napló
    return "failed";
  }
}

/** What the hourly tick runs with: real e-mail, SMS, MMS and live-site shot. */
export function escalationDeps(email?: EmailSender): EscalationDeps {
  return {
    email: email ?? getEmailSender(),
    sms: sendSmsDefault,
    mms: sendMmsDefault,
    shot: renderLiveShot,
    heading: liveHeading,
  };
}

/** One trial's escalation state for the console (lead page card, list badge, dashboard). */
export interface TrialEscalationView {
  readonly trialId: string;
  /** Trial day today (1-based). */
  readonly day: number;
  /** True from day 4 while the owner has not logged in. */
  readonly noLogin: boolean;
  readonly stalled: boolean;
  /** Every free_trial_notice row of the trial, oldest first. */
  readonly notices: readonly { step: string; channel: string; status: string; detail: string | null; at: Date }[];
}
