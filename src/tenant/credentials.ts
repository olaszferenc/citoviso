// Issue / reset a tenant login (ADR-0023). The login identifier is a stable USERNAME
// we generate from the business name; the email is a changeable communication address.
//
// ⛔ Elek T-3 (owner-approved 2026-10-02, ADR-XXXX): the owner SETS their password
// through a one-time link; the mail carries NO password. The hash stored here is a
// random placeholder nobody is ever told (a dev demo may ask for a memorable one it
// prints itself). A password the owner has set (password_set_at) is never overwritten.

import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { generateMemorablePassword, hashPassword } from "../auth/tenantAuth.js";
import { findUserForReset, issuePasswordToken, passwordLinkUrl } from "../auth/passwordLink.js";
import { getEmailSender } from "../email/sender.js";
import { buildCredentialsEmail, buildPasswordResetEmail } from "../email/loginEmail.js";
import { T, langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "./messages.js";
import { config } from "../config.js";

export interface IssuedLogin {
  readonly tenantUserId: string;
  readonly username: string;
  /** Plaintext of the PLACEHOLDER — never mailed; only a dev demo prints it. Null
   *  when the owner's own password was kept. */
  readonly password: string | null;
  readonly contactEmail: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "vendeg";
}

/** A username unique on lower(username), derived from the business name. */
async function uniqueUsername(businessName: string): Promise<string> {
  const base = slugify(businessName);
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await db
      .selectFrom("tenant_user")
      .select("id")
      .where(sql<boolean>`lower(username) = ${candidate}`)
      .executeTakeFirst();
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Create or re-issue the owner login for a tenant. Idempotent per tenant (one owner
 * user). The placeholder password is replaced ONLY while the owner never set one.
 */
export async function issueTenantLogin(
  tenantId: string,
  businessName: string,
  contactEmail: string,
  opts: { readonly memorable?: boolean } = {},
): Promise<IssuedLogin> {
  const email = contactEmail.trim();
  const password = opts.memorable ? generateMemorablePassword() : randomBytes(24).toString("base64url");
  const password_hash = hashPassword(password);

  const existing = await db
    .selectFrom("tenant_user")
    .select(["id", "username", "password_set_at"])
    .where("tenant_id", "=", tenantId)
    .orderBy("created_at", "asc")
    .executeTakeFirst();

  if (existing) {
    const keep = existing.password_set_at != null;
    await db
      .updateTable("tenant_user")
      .set(keep ? { contact_email: email } : { password_hash, contact_email: email })
      .where("id", "=", existing.id)
      .execute();
    return { tenantUserId: existing.id, username: existing.username, password: keep ? null : password, contactEmail: email };
  }

  const username = await uniqueUsername(businessName);
  const row = await db
    .insertInto("tenant_user")
    .values({ tenant_id: tenantId, username, contact_email: email, password_hash })
    .returning("id")
    .executeTakeFirstOrThrow();
  return { tenantUserId: row.id, username, password, contactEmail: email };
}

/** Issue the login AND email the credentials to the owner's communication address. */
export async function issueAndSendTenantLogin(
  tenantId: string,
  businessName: string,
  contactEmail: string,
  /** Who ordered — only for the salutation (a company gets a neutral one). */
  buyer?: { name: string | null; isPerson: boolean },
): Promise<IssuedLogin> {
  const login = await issueTenantLogin(tenantId, businessName, contactEmail);
  const loginUrl = `${config.publicSiteUrl.replace(/\/$/, "")}/login`;
  // ADR-0067: the owner reads their credentials in their own site's language.
  const lang = await prepareMailLang(await langForTenant(tenantId));
  const token = await issuePasswordToken(login.tenantUserId);
  const msg = buildCredentialsEmail({
    to: login.contactEmail,
    username: login.username,
    setPasswordUrl: passwordLinkUrl(token, lang),
    loginUrl,
    siteName: businessName,
    buyerName: buyer?.name ?? null,
    buyerIsPerson: buyer?.isPerson ?? false,
    lang,
  });
  await getEmailSender().send(msg);
  // ADR-0084: log AFTER a successful send — a failed log must not fake a delivery,
  // and a failed delivery must not leave a "sent" row behind.
  await logTenantMessage({
    tenantId,
    channel: "email",
    kind: "credentials",
    subject: msg.subject,
    // ⛔ The logged copy must not carry a usable link: the DB keeps only the token's
    // hash, so its plaintext must not reappear in the message log.
    bodyText: msg.text.split(token).join(T(lang, "[egyszer használható link — kitakarva]")),
    recipient: msg.to,
  });
  return login;
}

/**
 * "Elfelejtett jelszó?" (Elek T-3): mail a fresh one-time link to every login the
 * username / e-mail names. Returns how many letters went out — for the LOG only:
 * the page answers the same whether it is 0 or 2 (no account enumeration).
 */
export async function sendPasswordResetLinks(identifier: string): Promise<number> {
  const users = await findUserForReset(identifier);
  let sent = 0;
  for (const u of users) {
    if (!u.email.includes("@")) continue;
    const lang = await prepareMailLang(await langForTenant(u.tenantId));
    const token = await issuePasswordToken(u.tenantUserId);
    const msg = buildPasswordResetEmail({
      to: u.email,
      username: u.username,
      setPasswordUrl: passwordLinkUrl(token, lang),
      siteName: u.siteName,
      lang,
    });
    await getEmailSender().send(msg);
    await logTenantMessage({
      tenantId: u.tenantId,
      channel: "email",
      kind: "credentials",
      subject: msg.subject,
      bodyText: msg.text.split(token).join(T(lang, "[egyszer használható link — kitakarva]")),
      recipient: msg.to,
    });
    sent++;
  }
  return sent;
}
