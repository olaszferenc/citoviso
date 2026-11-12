// ADR-0417 — the trial LOGIN REMINDER (owner-approved 2026-11-03).
//
// Measured 2026-11-03 on prod: both live trialists got the credentials letter, neither clicked
// it (login_token.used_at empty, no /login/jelszo hit) — they were reached by MMS/SMS and do not
// watch their inbox, and the first link expires after 7 days. So, until the owner has set a
// password (tenant_user.password_set_at / last_login_at):
//
//   · l0 — an SMS right at the start, next to the credentials letter (startTrial). It answers
//          the lead's own form submit, so it is not bound to the 9–16 window.
//   · l2 / l4 / l6 / l8 — e-mail + SMS on the trial's day N (day 1 = the start's Budapest
//          calendar day, as the /report timeline counts), weekdays 9–16 only (the hourly tick). Only the HIGHEST due step goes; a missed
//          lower one is recorded as skipped (a weekend never yields two letters on Monday).
//          A reminder whose day reaches the T−3 warning's day is skipped: from there the
//          T−3 / T−1 warnings speak.
//
// Every message carries a FRESH one-time password link (issuePasswordToken), so an expired
// first link can never strand a trialist. The (trial, step, channel) row in free_trial_notice
// is claimed BEFORE the send — a re-run or an overlapping run never sends twice.

import { loadSetupCtx, remindTopics } from "../tenant/moduleSetup.js";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { issuePasswordToken, passwordLinkUrl } from "../auth/passwordLink.js";
import { buildLoginReminderEmail, buildLoginReminderSmsText, buildLoginStartSmsText } from "../email/loginEmail.js";
import { tenantLoginUrl } from "../email/platformLayout.js";
import { getEmailSender, type EmailSender } from "../email/sender.js";
import { T, langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";
import { addIsoDays, budapestIsoDay } from "../text/budapestTime.js";
import { mockOutreachWindowOpen } from "../sms/sendWindow.js";
import { isTestLeadName } from "../outreach/ownerTestPhone.js";
import { sendSms as sendSmsDefault, type SmsMessage, type SmsSendResult } from "../sms/sender.js";
import { noticeSendDay } from "./expiry.js";
import { trialDaysLeft } from "./notices.js";
import { CONTACT_BLOCK_DETAIL, trialContactBlocked } from "./contactBlock.js";

export type LoginReminderStep = "l2" | "l4" | "l6" | "l8";
/** The trial day each step goes on — day 1 is the start day (as the /report trial timeline counts). */
export const LOGIN_REMINDER_DAYS: Readonly<Record<LoginReminderStep, number>> = { l2: 2, l4: 4, l6: 6, l8: 8 };
const STEPS_HIGH_FIRST: readonly LoginReminderStep[] = ["l8", "l6", "l4", "l2"];

export type LoginSmsSender = (msg: SmsMessage) => Promise<SmsSendResult>;

export interface LoginReminderDeps {
  readonly email: EmailSender;
  readonly sms: LoginSmsSender;
}

/** The Budapest day a reminder step is due on (trial day N = start day + N − 1), or null when it would reach
 *  the T−3 warning's day (from there the expiry warnings speak) or the trial's last day. */
export function loginReminderDay(step: LoginReminderStep, startedAt: Date, trialUntil: Date): string | null {
  const day = addIsoDays(budapestIsoDay(startedAt), LOGIN_REMINDER_DAYS[step] - 1);
  const t3 = noticeSendDay("t3", startedAt, trialUntil) ?? noticeSendDay("t1", startedAt, trialUntil);
  if (t3 && day >= t3) return null;
  if (day >= budapestIsoDay(trialUntil)) return null;
  return day;
}

/** Has the trial's owner ever set a password or logged in? (Then no reminder is due.) */
export async function ownerHasLoggedIn(tenantId: string): Promise<boolean> {
  const r = await db
    .selectFrom("tenant_user")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where((eb) => eb.or([eb("password_set_at", "is not", null), eb("last_login_at", "is not", null)]))
    .executeTakeFirst();
  return Boolean(r);
}

export interface LoginContext {
  readonly tenantUserId: string;
  readonly username: string;
  readonly siteName: string;
  readonly contactName: string | null;
  readonly lang: string;
}

export async function loginContext(trialId: string): Promise<LoginContext> {
  const row = await db
    .selectFrom("free_trial")
    .innerJoin("tenant", "tenant.id", "free_trial.tenant_id")
    .innerJoin("tenant_user", "tenant_user.tenant_id", "free_trial.tenant_id")
    .select([
      "tenant_user.id as tenantUserId",
      "tenant_user.username as username",
      "tenant.display_name as siteName",
      "tenant.id as tenantId",
      "free_trial.contact_name as contactName",
    ])
    .where("free_trial.id", "=", trialId)
    .orderBy("tenant_user.created_at", "asc")
    .executeTakeFirst();
  if (!row) throw new Error("a próbához nincs belépési fiók (tenant_user)");
  const lang = await prepareMailLang(await langForTenant(row.tenantId));
  return { tenantUserId: row.tenantUserId, username: row.username, siteName: row.siteName, contactName: row.contactName, lang };
}

/** Send one SMS; throws when it was blocked (sendSms never throws), then log it. */
export async function sendLoggedSms(
  send: LoginSmsSender,
  tenantId: string,
  trialId: string,
  step: string,
  phone: string,
  text: string,
): Promise<void> {
  const r = await send({ to: phone, text });
  if (r.provider === "blocked") throw new Error("az SMS nem ment ki (blocked) — lásd a [sms] naplót");
  await logTenantMessage({
    tenantId,
    channel: "sms",
    kind: "credentials",
    subject: null,
    // ⛔ The logged copy must not carry a usable link (the DB keeps only the token's hash).
    bodyText: text.replace(/\/login\/jelszo\/[A-Za-z0-9_-]+/, "/login/jelszo/[kitakarva]"),
    recipient: phone,
    relatedKind: `free_trial_${step}`,
    relatedId: trialId,
  });
}

/**
 * l0 — the start SMS, called by startTrial right after the credentials letter. Never throws:
 * a failed SMS must not fail a trial that already runs (the ledger row says failed).
 */
export async function sendLoginStartSms(
  trialId: string,
  send: LoginSmsSender = sendSmsDefault,
): Promise<"sent" | "skipped" | "failed" | "already"> {
  try {
    const t = await db
      .selectFrom("free_trial")
      .select(["tenant_id", "contact_phone"])
      .where("id", "=", trialId)
      .executeTakeFirst();
    if (!t?.tenant_id) return "skipped";
    if (!t.contact_phone) return (await claim(trialId, "l0", "sms", "skipped", "nincs telefonszám")) ? "skipped" : "already";
    if (await ownerHasLoggedIn(t.tenant_id)) return "skipped";
    if (!(await claim(trialId, "l0", "sms", "claimed", null))) return "already";
    try {
      const c = await loginContext(trialId);
      const url = passwordLinkUrl(await issuePasswordToken(c.tenantUserId), c.lang);
      const text = buildLoginStartSmsText({ siteName: c.siteName, username: c.username, setPasswordUrl: url, lang: c.lang });
      await sendLoggedSms(send, t.tenant_id, trialId, "l0", t.contact_phone, text);
      await mark(trialId, "l0", "sms", "sent", null);
      return "sent";
    } catch (e) {
      await mark(trialId, "l0", "sms", "failed", (e as Error).message.slice(0, 500));
      console.error(`[trial] l0 SMS SIKERTELEN · próba ${trialId}: ${(e as Error).message}`); // i18n-exempt: operátori napló
      return "failed";
    }
  } catch (e) {
    console.error(`[trial] l0 SMS hiba · próba ${trialId}: ${(e as Error).message}`); // i18n-exempt: operátori napló
    return "failed";
  }
}

/** The l2/l4/l6/l8 reminders due at `now` (hourly tick). */
export async function runLoginReminders(
  now: Date,
  deps: LoginReminderDeps | null,
  opts: { readonly onlyTrialIds?: readonly string[] } = {},
): Promise<{ sent: number; skipped: number; failed: number; due: number; windowClosed: boolean }> {
  const out = { sent: 0, skipped: 0, failed: 0, due: 0, windowClosed: false };
  if (!mockOutreachWindowOpen(now)) return { ...out, windowClosed: true };
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
  const today = budapestIsoDay(now);

  for (const t of await q.execute()) {
    // Owner, 2026-10-26: our own [TESZT] trials do not message the owner from the tick.
    if (!opts.onlyTrialIds && isTestLeadName(t.lead_name)) continue;
    const started = new Date(t.started_at as unknown as string);
    const until = new Date(t.trial_until as unknown as string);
    const due = STEPS_HIGH_FIRST.filter((s) => {
      const d = loginReminderDay(s, started, until);
      return d !== null && d <= today;
    });
    if (!due.length) continue;
    if (await ownerHasLoggedIn(t.tenant_id!)) continue;
    const [step, ...older] = due;
    const done = await db
      .selectFrom("free_trial_notice")
      .select("id")
      .where("free_trial_id", "=", t.id)
      .where("step", "=", step!)
      .where("channel", "=", "email")
      .executeTakeFirst();
    if (done) continue;
    const channels = ["email", "sms"] as const;
    for (const s of older) for (const ch of channels) if (await claim(t.id, s, ch, "skipped", "egy későbbi emlékeztető már esedékes")) out.skipped++;
    // Owner doctrine 2026-10-26 (ADR-0421): a „ne keressük” lead gets no further message.
    if (await trialContactBlocked(t.id)) {
      for (const ch of channels) if (await claim(t.id, step!, ch, "skipped", CONTACT_BLOCK_DETAIL)) out.skipped++;
      continue;
    }
    out.due++;
    if (!deps) {
      console.log(`[trial] belépés-emlékeztető ESEDÉKES (száraz) · ${step} · próba ${t.id}`); // i18n-exempt: operátori napló
      continue;
    }
    const daysLeft = trialDaysLeft(now, until);
    const untilIso = budapestIsoDay(until);
    // ADR-0429: the reminder names the open setup topics (the same registry the walk reads).
    const missing = await missingSetupTopics(t.tenant_id!, (await loginContext(t.id)).lang);

    if (await claim(t.id, step!, "email", "claimed", null)) {
      try {
        const c = await loginContext(t.id);
        const url = passwordLinkUrl(await issuePasswordToken(c.tenantUserId), c.lang);
        const msg = buildLoginReminderEmail({
          to: t.contact_email,
          username: c.username,
          setPasswordUrl: url,
          loginUrl: tenantLoginUrl(c.lang),
          siteName: c.siteName,
          contactName: c.contactName,
          daysLeft,
          trialUntilIso: untilIso,
          missing,
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
          relatedKind: `free_trial_${step}`,
          relatedId: t.id,
        });
        await mark(t.id, step!, "email", "sent", null);
        out.sent++;
      } catch (e) {
        await mark(t.id, step!, "email", "failed", (e as Error).message.slice(0, 500));
        out.failed++;
        console.error(`[trial] ${step} belépés-e-mail SIKERTELEN · próba ${t.id}: ${(e as Error).message}`); // i18n-exempt: operátori napló
      }
    }
    if (!t.contact_phone) {
      if (await claim(t.id, step!, "sms", "skipped", "nincs telefonszám")) out.skipped++;
    } else if (await claim(t.id, step!, "sms", "claimed", null)) {
      try {
        const c = await loginContext(t.id);
        const url = passwordLinkUrl(await issuePasswordToken(c.tenantUserId), c.lang);
        const text = buildLoginReminderSmsText({ siteName: c.siteName, daysLeft, setPasswordUrl: url, missing, lang: c.lang });
        await sendLoggedSms(deps.sms, t.tenant_id!, t.id, step!, t.contact_phone, text);
        await mark(t.id, step!, "sms", "sent", null);
        out.sent++;
      } catch (e) {
        await mark(t.id, step!, "sms", "failed", (e as Error).message.slice(0, 500));
        out.failed++;
        console.error(`[trial] ${step} belépés-SMS SIKERTELEN · próba ${t.id}: ${(e as Error).message}`); // i18n-exempt: operátori napló
      }
    }
  }
  return out;
}

/** What the hourly tick runs with: e-mail AND SMS live. */
export function loginReminderDeps(email?: EmailSender, sms?: LoginSmsSender): LoginReminderDeps {
  return { email: email ?? getEmailSender(), sms: sms ?? sendSmsDefault };
}

type LoginStep = LoginReminderStep | "l0";

async function claim(
  trialId: string,
  step: LoginStep,
  channel: "email" | "sms",
  status: "claimed" | "skipped",
  detail: string | null,
): Promise<boolean> {
  const r = await db
    .insertInto("free_trial_notice")
    .values({ free_trial_id: trialId, step, channel, status, detail })
    .onConflict((oc) => oc.columns(["free_trial_id", "step", "channel"]).doNothing())
    .returning("id")
    .executeTakeFirst();
  return Boolean(r);
}

async function mark(
  trialId: string,
  step: LoginStep,
  channel: "email" | "sms",
  status: "sent" | "failed",
  detail: string | null,
): Promise<void> {
  await db
    .updateTable("free_trial_notice")
    .set({ status, detail })
    .where("free_trial_id", "=", trialId)
    .where("step", "=", step)
    .where("channel", "=", channel)
    .execute();
}

/**
 * ADR-0429 — the open setup topics a reminder may name (registry `remind`). A failure here
 * must never stop the reminder itself: it then goes out without the list.
 */
async function missingSetupTopics(tenantId: string, lang: string): Promise<string[]> {
  try {
    const site = await db.selectFrom("site").select("id").where("tenant_id", "=", tenantId).executeTakeFirst();
    if (!site) return [];
    const ctx = await loadSetupCtx(tenantId, site.id);
    return remindTopics(ctx, lang).map((v) => v.topic.title(lang));
  } catch (e) {
    console.error(`[trial] beállítás-hiánylista nem olvasható · ${tenantId}: ${(e as Error).message}`); // i18n-exempt: operátori napló
    return [];
  }
}
