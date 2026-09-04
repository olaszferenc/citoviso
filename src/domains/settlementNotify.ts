// The promised settlement pay-link mail (ADR-0094 ②, approved plan B) — the
// done screen says "a fizetéshez e-mailben küldjük a linket", so this MUST fire
// when the settlement is recorded.
//
// Lives in its own module ON PURPOSE (ADR-0070 ② derived i18n scope): importing
// the mail adapter from public.ts would turn the whole route file — and its
// entire import tree — into an i18n mail-seed. Here the seed's closure is only
// this dispatcher; the customer-facing wording comes from domainEmail.ts, which
// sits on I18N_SOURCES.

import { getEmailSender } from "../email/sender.js";
import { buildDomainSettlementEmail } from "../email/domainEmail.js";
import { billingEmails } from "../payment/billing.js";
import { logTenantMessage } from "../tenant/messages.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";

export interface SettlementMailInput {
  readonly tenantId: string;
  readonly orderId: string;
  readonly domainName: string;
  /** Total to pay (HUF). */
  readonly total: number;
  readonly monthsRemaining: number;
  /** Monthly base of the kötbér (HUF). */
  readonly penaltyBase: number;
  readonly takeDomain: boolean;
  readonly payUrl: string;
  readonly accessEndDate: string | null;
}

const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;

/**
 * Send the pay-link mail to the SAME list the dunning ladder writes to, and log
 * each copy on the tenant's Üzenetek tab (ADR-0084). An empty recipient list is
 * reported loudly with the pay-link, so the operator can hand it over.
 */
export async function sendSettlementMail(input: SettlementMailInput): Promise<void> {
  const recipients = await billingEmails(input.tenantId);
  if (!recipients.length) {
    console.error(
      `[settlement] nincs értesítési cím — a fizetési link e-mail NEM ment ki · tenant ${input.tenantId} · payUrl: ${input.payUrl}`,
    );
    return;
  }
  const lang = await prepareMailLang(await langForTenant(input.tenantId));
  for (const to of recipients) {
    const msg = buildDomainSettlementEmail({
      to,
      domain: input.domainName,
      totalFormatted: huf(input.total),
      monthsRemaining: input.monthsRemaining,
      penaltyBaseFormatted: huf(input.penaltyBase),
      takeDomain: input.takeDomain,
      payUrl: input.payUrl,
      accessEndDate: input.accessEndDate,
      lang,
    });
    await getEmailSender().send(msg);
    await logTenantMessage({
      tenantId: input.tenantId,
      channel: "email",
      kind: "domain",
      subject: msg.subject,
      bodyText: msg.text,
      recipient: to,
      relatedKind: "order_intent",
      relatedId: input.orderId,
    });
  }
}
