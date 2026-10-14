// Elek P-5 (2026-10-14): the owner's account actions — cancelling the subscription, taking the
// cancellation back, revoking the card mandate — are confirmed by e-mail, and the letter is
// logged like every other platform letter (ADR-0084: „mit írtak nekem?” has one answer).
// A failed send never undoes the action: it is logged loudly, the page still says the truth.

import { db } from "../db/client.js";
import {
  buildAutoChargeRevokedEmail,
  buildSubscriptionCancelArmedEmail,
  buildSubscriptionResumedEmail,
} from "../email/billingEmail.js";
import { getEmailSender, type EmailMessage } from "../email/sender.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";
import { billingEmails } from "../billing/partner.js";

export type AccountAction = "cancel" | "resume" | "revoke";

function isoDay(v: unknown): string {
  return new Date(v as string).toISOString().slice(0, 10);
}

/** Send the confirmation of `action` to the tenant's billing addresses. Returns the count sent. */
export async function sendAccountActionMail(
  tenantId: string,
  action: AccountAction,
  extra: { cardLabel?: string | null } = {},
): Promise<number> {
  try {
    const row = await db
      .selectFrom("subscription")
      .innerJoin("tenant", "tenant.id", "subscription.tenant_id")
      .select([
        "tenant.display_name as siteName",
        "subscription.current_period_end as periodEnd",
        "subscription.cancel_at_period_end as cancelAtPeriodEnd",
        "subscription.payment_method as paymentMethod",
        "subscription.recurrence_token as token",
      ])
      .where("subscription.tenant_id", "=", tenantId)
      .executeTakeFirst();
    if (!row) return 0;
    const recipients = await billingEmails(tenantId);
    if (!recipients.length) {
      console.error(`[account-mail] ${row.siteName}: nincs értesítési cím — a(z) ${action} visszaigazolása NEM ment ki`);
      return 0;
    }
    const lang = await prepareMailLang(await langForTenant(tenantId));
    const day = isoDay(row.periodEnd);
    let sent = 0;
    for (const to of recipients) {
      const msg: EmailMessage =
        action === "cancel"
          ? buildSubscriptionCancelArmedEmail({ to, siteName: row.siteName, closesOn: day, lang })
          : action === "resume"
            ? buildSubscriptionResumedEmail({ to, siteName: row.siteName, renewsOn: day, autoCharge: row.paymentMethod === "token" && !!row.token, lang })
            : buildAutoChargeRevokedEmail({ to, siteName: row.siteName, cardLabel: extra.cardLabel ?? null, nextOn: day, closing: Boolean(row.cancelAtPeriodEnd), lang });
      await getEmailSender().send(msg);
      await logTenantMessage({ tenantId, channel: "email", kind: "other", subject: msg.subject, bodyText: msg.text, recipient: to });
      sent++;
    }
    console.log(`[account-mail] ${action} → ${row.siteName} · ${recipients.join(", ")}`);
    return sent;
  } catch (e) {
    console.error(`[account-mail] a(z) ${action} visszaigazoló levele ELBUKOTT (tenant ${tenantId}):`, e);
    return 0;
  }
}

/** The stored card's mask ("Visa ····4242") — read BEFORE a revoke drops it. */
export async function storedCardLabel(tenantId: string): Promise<string | null> {
  const r = await db
    .selectFrom("subscription")
    .select(["card_brand", "card_last4"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!r?.card_last4) return null;
  return `${r.card_brand ?? ""} ····${r.card_last4}`.trim();
}
