// ADR-0080 ⑥ — the freeze LIFTED: tell the owner, and close the thread.
//
// Measured 2026-09-11 (Elek FK-006b): paying the arrears flipped the site back
// to 'live' in complete silence. The freeze had cost five notices and a red
// banner; the return produced nothing, so the newest message in the owner's
// Üzenetek feed stayed "Honlapja felfüggesztve" — a notice that was no longer
// true, sitting on top, in the same minute the site came back.
//
// Separate module on purpose: this is called from the subscription lifecycle,
// and billing.ts already imports that — putting it there would close a cycle.

import { db } from "../db/client.js";
import { buildSiteRestoredEmail } from "../email/billingEmail.js";
import { getEmailSender } from "../email/sender.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { getCurrency, loadPricing } from "../pricing.js";
import { billingEmails } from "../billing/partner.js";
import { logTenantMessage } from "../tenant/messages.js";
import { config } from "../config.js";
import { tenantSiteUrl } from "../domains.js";

/** The public URL the owner can click to see their site is really back. */
async function siteUrlFor(tenantId: string): Promise<string | null> {
  const site = await db
    .selectFrom("site")
    .select(["slug", "custom_domain as customDomain", "custom_domain_status as domainStatus"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!site) return null;
  // ADR-0071: the custom domain only points at us once it is 'live'; offering it
  // earlier would send the owner to a dead host to prove their site is alive.
  const custom = site.domainStatus === "live" ? site.customDomain : null;
  return tenantSiteUrl(config.publicSiteUrl, site.slug, custom);
}

/**
 * Announce that a billing freeze has been lifted by payment.
 *
 * Failure here must NEVER undo the thaw: the site is already back, and a
 * mail-server hiccup is not a reason to leave the owner suspended. Loud in the
 * log, silent to the caller — the same contract logTenantMessage keeps.
 */
export async function announceRestore(tenantId: string, amountPaid: number): Promise<void> {
  try {
    const recipients = await billingEmails(tenantId);
    const tenant = await db
      .selectFrom("tenant")
      .select("display_name as displayName")
      .where("id", "=", tenantId)
      .executeTakeFirst();
    const siteName = tenant?.displayName ?? "";
    const lang = await prepareMailLang(await langForTenant(tenantId));
    await loadPricing();
    const siteUrl = await siteUrlFor(tenantId);
    const amount = amountPaid.toLocaleString("hu-HU").replace(/ /g, " ");
    const currency = getCurrency();

    if (!recipients.length) {
      console.error(`[billing] ${siteName}: nincs értesítési cím — a visszakapcsolás CSAK naplózva`);
      return;
    }
    for (const to of recipients) {
      const msg = buildSiteRestoredEmail({ to, siteName, amount, currency, siteUrl, lang });
      await getEmailSender().send(msg);
      // Same kind as the ladder ('dunning') so the restore sorts INTO the thread
      // it closes, instead of landing in an unrelated corner of the feed.
      await logTenantMessage({
        tenantId,
        channel: "email",
        kind: "dunning",
        subject: msg.subject,
        bodyText: msg.text,
        recipient: to,
      });
    }
    console.log(`[billing] VISSZAKAPCSOLVA · ${siteName} · ${amount} ${currency} · ${recipients.join(", ")}`);
  } catch (err) {
    console.error(`[billing] a visszakapcsolás-értesítő HIBÁRA futott (a honlap ettől már ÉL):`, err);
  }
}
