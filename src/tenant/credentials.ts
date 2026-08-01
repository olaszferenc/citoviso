// Issue / reset a tenant login (ADR-0023). The login identifier is a stable USERNAME
// we generate from the business name; the email is a changeable communication address.
// Generates a memorable password, stores only its hash, returns the plaintext ONCE.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { generateMemorablePassword, hashPassword } from "../auth/tenantAuth.js";
import { getEmailSender } from "../email/sender.js";
import { buildCredentialsEmail } from "../email/loginEmail.js";
import { config } from "../config.js";

export interface IssuedLogin {
  username: string;
  password: string; // plaintext — shown/sent once, never stored
  contactEmail: string;
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
 * Create or reset the owner login for a tenant. Idempotent per tenant (one owner
 * user); on reset it keeps the username and resets the password. Returns plaintext once.
 */
export async function issueTenantLogin(
  tenantId: string,
  businessName: string,
  contactEmail: string,
): Promise<IssuedLogin> {
  const email = contactEmail.trim();
  const password = generateMemorablePassword();
  const password_hash = hashPassword(password);

  const existing = await db
    .selectFrom("tenant_user")
    .select(["id", "username"])
    .where("tenant_id", "=", tenantId)
    .orderBy("created_at", "asc")
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable("tenant_user")
      .set({ password_hash, contact_email: email })
      .where("id", "=", existing.id)
      .execute();
    return { username: existing.username, password, contactEmail: email };
  }

  const username = await uniqueUsername(businessName);
  await db
    .insertInto("tenant_user")
    .values({ tenant_id: tenantId, username, contact_email: email, password_hash })
    .execute();
  return { username, password, contactEmail: email };
}

/** Issue the login AND email the credentials to the owner's communication address. */
export async function issueAndSendTenantLogin(
  tenantId: string,
  businessName: string,
  contactEmail: string,
): Promise<IssuedLogin> {
  const login = await issueTenantLogin(tenantId, businessName, contactEmail);
  const loginUrl = `${config.publicSiteUrl.replace(/\/$/, "")}/login`;
  await getEmailSender().send(
    buildCredentialsEmail({
      to: login.contactEmail,
      username: login.username,
      password: login.password,
      loginUrl,
    }),
  );
  return login;
}
