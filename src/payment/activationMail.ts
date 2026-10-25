// Sends „Megrendelését aktiváltuk” (email/activationEmail.ts) once per activated order —
// a new purchase AND a free trial continued into one (ADR-XXXX "A").
//
// For a NEW account this letter is also the login letter: activate() only issues the login,
// and the one-time password link travels here (one letter, not a credentials letter next to
// it). An account that existed before the payment (a continued trial, ADR-0344) gets no link —
// the letter says its password did not change.
//
// Best-effort by contract: a paid activation is never undone by a mail failure; the journal
// says so loudly and the operator can resend the password link from the console.

import { db } from "../db/client.js";
import { config } from "../config.js";
import { tenantSiteUrl } from "../domains.js";
import { issuePasswordToken, passwordLinkUrl } from "../auth/passwordLink.js";
import { buildActivationEmail, type OwnerDomainView } from "../email/activationEmail.js";
import { getEmailSender } from "../email/sender.js";
import { T, langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";

type Renewal = { readonly date: string; readonly amount: number; readonly period: "monthly" | "annual" } | null;

/**
 * The own domain as the buyer must hear about it: live on the site, or a beszerzés running /
 * about to start for this tenant (the order's citoviso_registered choice — the provisioning row
 * is created right AFTER activation). Null = none ordered, or the last attempt failed (that
 * has its own letter).
 */
export async function ownerDomainState(tenantId: string, orderIntentId?: string | null): Promise<OwnerDomainView | null> {
  const site = await db
    .selectFrom("site")
    .select(["custom_domain", "custom_domain_status"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (site?.custom_domain && site.custom_domain_status === "live") return { domain: site.custom_domain, live: true };
  const running = await db
    .selectFrom("domain_provisioning")
    .select("domain")
    .where("tenant_id", "=", tenantId)
    .where("status", "not in", ["live", "failed"])
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (running) return { domain: running.domain, live: false };
  if (!orderIntentId) return null;
  const oi = await db
    .selectFrom("order_intent")
    .select(["domain_type", "domain_name"])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (oi?.domain_type === "citoviso_registered" && oi.domain_name && site?.custom_domain_status !== "failed") {
    return { domain: oi.domain_name, live: false };
  }
  return null;
}

/** ① The address that works NOW: the own domain once it is live, else <slug>.citoviso.com. */
async function siteUrlNow(tenantId: string): Promise<string | null> {
  const s = await db
    .selectFrom("site")
    .select(["slug", "custom_domain", "custom_domain_status"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!s) return null;
  return tenantSiteUrl(config.publicSiteUrl, s.slug, s.custom_domain_status === "live" ? s.custom_domain : null);
}

/**
 * Send the activation letter for a paid initial order. Idempotent per order: a re-delivered
 * webhook finds the logged row (related_kind 'order_intent') and sends nothing.
 */
export async function sendActivationMail(
  orderIntentId: string,
  paymentId: string,
  renewalOf: (tenantId: string) => Promise<Renewal>,
): Promise<boolean> {
  try {
    const row = await db
      .selectFrom("order_intent")
      .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
      .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
      .select([
        "tenant.id as tenantId",
        "tenant.display_name as siteName",
        "order_intent.buyer_name as buyerName",
        "order_intent.buyer_type as buyerType",
        "order_intent.buyer_email as buyerEmail",
      ])
      .where("order_intent.id", "=", orderIntentId)
      .executeTakeFirst();
    if (!row) return false;
    const already = await db
      .selectFrom("tenant_message")
      .select("id")
      .where("tenant_id", "=", row.tenantId)
      .where("related_kind", "=", "order_intent")
      .where("related_id", "=", orderIntentId)
      .where("kind", "=", "credentials")
      .executeTakeFirst();
    if (already) return true;
    const user = await db
      .selectFrom("tenant_user")
      .select(["id", "username", "contact_email", "created_at", "password_set_at"])
      .where("tenant_id", "=", row.tenantId)
      .orderBy("created_at", "asc")
      .executeTakeFirst();
    const to = user?.contact_email || row.buyerEmail || null;
    if (!user || !to) {
      console.warn(`[activation-mail] ${orderIntentId}: nincs belépés vagy e-mail-cím — az aktiváló levél NEM ment ki`);
      return false;
    }
    const pay = await db.selectFrom("payment").select(["created_at", "currency"]).where("id", "=", paymentId).executeTakeFirst();
    // The same rule as getActivationSummary(): a login born after the payment is a new account.
    const newAccount =
      !user.password_set_at &&
      (!pay || new Date(user.created_at as unknown as string).getTime() >= new Date(pay.created_at as unknown as string).getTime());
    const siteUrl = await siteUrlNow(row.tenantId);
    if (!siteUrl) {
      console.warn(`[activation-mail] ${orderIntentId}: a site címe nem ismert — az aktiváló levél NEM ment ki`);
      return false;
    }
    const lang = await prepareMailLang(await langForTenant(row.tenantId));
    const token = newAccount ? await issuePasswordToken(user.id) : null;
    const msg = buildActivationEmail({
      to,
      lang,
      siteName: row.siteName ?? "",
      buyerName: row.buyerName,
      buyerIsPerson: row.buyerType === "individual",
      siteUrl,
      domain: await ownerDomainState(row.tenantId, orderIntentId),
      username: user.username,
      setPasswordUrl: token ? passwordLinkUrl(token, lang) : null,
      renewal: await renewalOf(row.tenantId),
      currency: pay?.currency ?? "HUF",
    });
    await getEmailSender().send(msg);
    // ADR-0084: logged AFTER the send; the one-time link is masked in the logged copy.
    await logTenantMessage({
      tenantId: row.tenantId,
      channel: "email",
      kind: "credentials",
      subject: msg.subject,
      bodyText: token ? msg.text.split(token).join(T(lang, "[egyszer használható link — kitakarva]")) : msg.text,
      recipient: msg.to,
      relatedKind: "order_intent",
      relatedId: orderIntentId,
    });
    console.log(`[activation-mail] „Megrendelését aktiváltuk” → ${msg.to} (${newAccount ? "új fiók, jelszó-link" : "meglévő fiók"})`);
    return true;
  } catch (e) {
    console.error(`[activation-mail] ${orderIntentId} SIKERTELEN (a site él, kézzel pótolandó): ${(e as Error).message}`);
    return false;
  }
}
