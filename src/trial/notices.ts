// ADR-0344 — the LIVE senders of the free-trial T−3 / T−1 warnings, wired into the
// hourly tick (scripts/offer-followup.mts → runTrialNotices).
//
//   · e-mail — LIVE with the owner-approved wording (2026-10-09, trialEmail.ts;
//              contract: assets/design-refs/console/proba-levelek/).
//   · SMS    — ⛔ DRY. Its form (accents → UCS-2 segments, link or no link) is still
//              the owner's decision, so `sendSms` is null: runTrialNotices then neither
//              sends nor CLAIMS the SMS row — a dry claim would burn the step for good
//              and the day the SMS is approved the trialist would get nothing.

import { db } from "../db/client.js";
import { config } from "../config.js";
import { buildTrialNoticeEmail } from "../email/trialEmail.js";
import { getEmailSender, type EmailSender } from "../email/sender.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import type { TrialNoticeDeps, TrialNoticeTarget } from "./expiry.js";

/** Whole calendar days (Budapest) from `now` to the trial's last day. */
export function trialDaysLeft(now: Date, trialUntil: Date): number {
  const a = Date.parse(`${budapestIsoDay(now)}T00:00:00Z`);
  const b = Date.parse(`${budapestIsoDay(trialUntil)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Build and send one step's e-mail, then log it into the tenant's own mailbox (ADR-0084). */
export async function sendTrialNoticeEmail(
  t: TrialNoticeTarget,
  now: Date,
  sender: EmailSender = getEmailSender(),
): Promise<void> {
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
  // The button IS the letter's purpose: without a reachable /folytatas link the mail
  // would tell them to continue and give them no way to — fail loudly instead.
  if (!base) throw new Error("PUBLIC_BASE_URL hiányzik — a Folytatom link nem építhető");
  if (!row.token) throw new Error("a próbához nincs prospect-token — a Folytatom link nem építhető");

  const couponUntil = row.couponUntil ? new Date(row.couponUntil as unknown as string) : null;
  const couponLive =
    row.percent && couponUntil && couponUntil > now && Number(row.usedCount ?? 0) < Number(row.maxUses ?? 1);
  const lang = await prepareMailLang(await langForTenant(t.tenantId));
  const msg = buildTrialNoticeEmail({
    to: t.email,
    daysLeft: trialDaysLeft(now, t.trialUntil),
    siteName: row.siteName,
    contactName: row.contactName,
    trialUntilIso: budapestIsoDay(t.trialUntil),
    coupon: couponLive ? { percent: row.percent!, untilIso: budapestIsoDay(couponUntil!) } : null,
    continueUrl: `${base}/p/${row.token}/folytatas`,
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

/** What the hourly tick runs with: e-mail live, SMS DRY (null — see the header). */
export function trialNoticeDeps(now: Date, sender?: EmailSender): TrialNoticeDeps {
  return {
    sendEmail: (t) => sendTrialNoticeEmail(t, now, sender),
    sendSms: null,
  };
}
