// Invoice DELIVERY (0032) — getting the issued bizonylat to the buyer.
//
// Separate module from payment/service.ts on purpose: delivery is the step that
// was MISSING (the invoice was issued, stored, and sent to nobody), so it gets
// its own seam that a guard can drive directly. Testing it only through
// handleWebhook would mean building the whole activation fixture to observe one
// e-mail — and an untestable step is how this one stayed broken.

import { db } from "../db/client.js";
import { config } from "../config.js";
import { tenantSiteUrl } from "../domains.js";
import { getInvoiceProvider } from "../invoicing/index.js";
import { buildInvoiceEmail } from "../email/invoiceEmail.js";
import { getEmailSender } from "../email/sender.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { invoiceRecipientsForTenant } from "./partner.js";

/**
 * E-mail the issued invoice to the buyer's billing recipients (0032).
 *
 * Best-effort by design: the invoice is already issued and stored, so a mail
 * failure must not roll anything back. But it is LOUD — a silently undelivered
 * bizonylat is exactly the defect this closes, and the operator needs to know
 * to forward it by hand.
 */
export async function deliverInvoiceEmail(input: {
  paymentId: string;
  invoiceNumber: string;
  gross: number;
  currency: string;
  /** Billing cadence — LOCALIZED in the mail builder (ADR-0067), never a
   *  preformatted Hungarian label passed in from the caller. */
  period: "monthly" | "annual" | "once";
  pdfBase64: string | null;
  buyerName: string;
  buyerEmail: string | null;
}): Promise<void> {
  try {
    // payment → order → prospect → lead → tenant: the tenant is what the partner
    // (and thus the billing contacts) hangs off.
    const row = await db
      .selectFrom("payment")
      .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
      .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
      .leftJoin("tenant", "tenant.lead_id", "prospect.lead_id")
      .leftJoin("site", "site.tenant_id", "tenant.id")
      .select([
        "tenant.id as tenantId",
        "site.status as siteStatus",
        "site.slug as siteSlug",
        "site.custom_domain as siteCustomDomain",
      ])
      .where("payment.id", "=", input.paymentId)
      .executeTakeFirst();

    const to = row?.tenantId
      ? await invoiceRecipientsForTenant(row.tenantId, input.buyerEmail)
      : input.buyerEmail
        ? [input.buyerEmail]
        : [];
    if (!to.length) {
      console.error(
        `[invoice] ${input.invoiceNumber} NEM KÜLDHETŐ: nincs egyetlen számlázási címzett sem — az operátornak kézzel kell továbbítania`,
      );
      return;
    }
    if (!input.pdfBase64) {
      // The mock provider issues no document. Still worth sending the notice —
      // but say so, rather than implying a bizonylat is attached.
      console.warn(
        `[invoice] ${input.invoiceNumber}: a szolgáltató nem adott PDF-et (${getInvoiceProvider().name}) — értesítő megy melléklet nélkül`,
      );
    }
    const msg = buildInvoiceEmail({
      to: to.join(", "),
      buyerName: input.buyerName,
      invoiceNumber: input.invoiceNumber,
      gross: input.gross,
      currency: input.currency,
      period: input.period,
      // ADR-0067: the buyer reads the covering mail in their own site's language.
      ...(row?.tenantId
        ? { lang: await prepareMailLang(await langForTenant(row.tenantId)) }
        : {}),
      pdfBase64: input.pdfBase64,
      siteUrl:
        row?.siteStatus === "live"
          ? tenantSiteUrl(config.publicSiteUrl, row.siteSlug, row.siteCustomDomain)
          : null,
    });
    await getEmailSender().send(msg);
    console.log(`[invoice] ${input.invoiceNumber} elküldve → ${to.join(", ")}`);
  } catch (e) {
    console.error(
      `[invoice] ${input.invoiceNumber} KÜLDÉSI HIBA (a számla kiállítva és mentve): ${(e as Error).message}`,
    );
  }
}

