// ADR-0344 — the LIVE senders of the free-trial T−3 / T−1 warnings, wired into the
// hourly tick (scripts/offer-followup.mts → runTrialNotices).
//
//   · e-mail — LIVE with the owner-approved wording (2026-10-09, trialEmail.ts;
//              contract: assets/design-refs/console/proba-levelek/).
//   · SMS    — LIVE since C2b (owner, 2026-10-09): ACCENT-FREE (GSM-7), WITH the
//              /folytatas link, ≤ 2 segments (buildTrialNoticeSmsText). Logged in the
//              tenant's mailbox like the letter; a 'blocked' send throws, so the ledger
//              row says failed — never "sent" for an SMS that never left.

import { db } from "../db/client.js";
import { config } from "../config.js";
import { buildTrialNoticeEmail, buildTrialNoticeSmsText } from "../email/trialEmail.js";
import { getEmailSender, type EmailSender } from "../email/sender.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import { sendSms as sendSmsDefault, type SmsMessage, type SmsSendResult } from "../sms/sender.js";
import type { TrialNoticeDeps, TrialNoticeTarget } from "./expiry.js";

/** Whole calendar days (Budapest) from `now` to the trial's last day. */
export function trialDaysLeft(now: Date, trialUntil: Date): number {
  const a = Date.parse(`${budapestIsoDay(now)}T00:00:00Z`);
  const b = Date.parse(`${budapestIsoDay(trialUntil)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * The trial coupon as the owner may still use it — or null (0 %, expired, used up). ONE
 * rule for every place that promises the discount (the warnings AND the admin strip): a
 * screen offering 25 % while the letter says nothing would be two answers to one question.
 */
export function liveTrialCoupon(
  row: {
    readonly percent: number | null;
    readonly couponUntil: unknown;
    readonly usedCount: number | string | null;
    readonly maxUses: number | string | null;
  },
  now: Date,
): { percent: number; untilIso: string } | null {
  const until = row.couponUntil ? new Date(row.couponUntil as string) : null;
  const live = row.percent && until && until > now && Number(row.usedCount ?? 0) < Number(row.maxUses ?? 1);
  return live ? { percent: row.percent!, untilIso: budapestIsoDay(until!) } : null;
}

interface NoticeContext {
  readonly siteName: string;
  readonly contactName: string | null;
  readonly coupon: { percent: number; untilIso: string } | null;
  readonly continueUrl: string;
  readonly daysLeft: number;
  readonly trialUntilIso: string;
}

/** What both channels say: the site, the live coupon and the /folytatas link. */
async function noticeContext(t: TrialNoticeTarget, now: Date): Promise<NoticeContext> {
  const row = await db
    .selectFrom("free_trial")
    .innerJoin("tenant", "tenant.id", "free_trial.tenant_id")
    .leftJoin("prospect", "prospect.id", "free_trial.prospect_id")
    .leftJoin("offer", "offer.id", "free_trial.coupon_offer_id")
    .select([
      "free_trial.contact_name as contactName",
      "tenant.display_name as siteName",
      "prospect.token as token",
      "offer.percent as percent",
      "offer.expires_at as couponUntil",
      "offer.used_count as usedCount",
      "offer.max_uses as maxUses",
    ])
    .where("free_trial.id", "=", t.trialId)
    .executeTakeFirst();
  if (!row) throw new Error("a próba/tenant nem található");
  const base = config.publicBaseUrl.replace(/\/+$/, "");
  // The button / link IS the message's purpose: without a reachable /folytatas link it
  // would tell them to continue and give them no way to — fail loudly instead.
  if (!base) throw new Error("PUBLIC_BASE_URL hiányzik — a Folytatom link nem építhető");
  if (!row.token) throw new Error("a próbához nincs prospect-token — a Folytatom link nem építhető");

  return {
    siteName: row.siteName,
    contactName: row.contactName,
    coupon: liveTrialCoupon(row, now),
    continueUrl: `${base}/p/${row.token}/folytatas`,
    daysLeft: trialDaysLeft(now, t.trialUntil),
    trialUntilIso: budapestIsoDay(t.trialUntil),
  };
}

/** Build and send one step's e-mail, then log it into the tenant's own mailbox (ADR-0084). */
export async function sendTrialNoticeEmail(
  t: TrialNoticeTarget,
  now: Date,
  sender: EmailSender = getEmailSender(),
): Promise<void> {
  const c = await noticeContext(t, now);
  const lang = await prepareMailLang(await langForTenant(t.tenantId));
  const msg = buildTrialNoticeEmail({
    to: t.email,
    daysLeft: c.daysLeft,
    siteName: c.siteName,
    contactName: c.contactName,
    trialUntilIso: c.trialUntilIso,
    coupon: c.coupon,
    continueUrl: c.continueUrl,
    lang,
  });
  await sender.send(msg);
  await logTenantMessage({
    tenantId: t.tenantId,
    channel: "email",
    kind: "other",
    subject: msg.subject,
    bodyText: msg.text,
    recipient: msg.to,
    relatedKind: `free_trial_${t.step}`,
    relatedId: t.trialId,
  });
}

export type TrialSmsSender = (msg: SmsMessage) => Promise<SmsSendResult>;

/** Build and send one step's SMS, then log it into the tenant's mailbox. Throws when the
 *  send was 'blocked' (sendSms never throws): the ledger then records failed, not sent. */
export async function sendTrialNoticeSms(
  t: TrialNoticeTarget & { phone: string },
  now: Date,
  send: TrialSmsSender = sendSmsDefault,
): Promise<void> {
  const c = await noticeContext(t, now);
  const lang = await prepareMailLang(await langForTenant(t.tenantId));
  const text = buildTrialNoticeSmsText({
    daysLeft: c.daysLeft,
    siteName: c.siteName,
    trialUntilIso: c.trialUntilIso,
    coupon: c.coupon,
    continueUrl: c.continueUrl,
    lang,
  });
  const r = await send({ to: t.phone, text });
  if (r.provider === "blocked") throw new Error("az SMS nem ment ki (blocked) — lásd a [sms] naplót");
  // ADR-0084: logged only once it actually left (SMS has no subject; the view titles it).
  await logTenantMessage({
    tenantId: t.tenantId,
    channel: "sms",
    kind: "other",
    subject: null,
    bodyText: text,
    recipient: t.phone,
    relatedKind: `free_trial_${t.step}`,
    relatedId: t.trialId,
  });
}

/** What the hourly tick runs with: e-mail AND SMS live (see the header). */
export function trialNoticeDeps(now: Date, sender?: EmailSender, sms?: TrialSmsSender): TrialNoticeDeps {
  return {
    sendEmail: (t) => sendTrialNoticeEmail(t, now, sender),
    sendSms: (t) => sendTrialNoticeSms(t, now, sms),
  };
}
