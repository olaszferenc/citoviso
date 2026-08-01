// Issue / reset a tenant login (ADR-0023). Generates a memorable password, stores
// only its hash, and returns the plaintext ONCE so it can be emailed to the owner.
// Called at conversion (post-purchase) and by the operator on a forgot-password reset.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { generateMemorablePassword, hashPassword } from "../auth/tenantAuth.js";
import { getEmailSender } from "../email/sender.js";
import { buildCredentialsEmail } from "../email/loginEmail.js";
import { config } from "../config.js";

export interface IssuedLogin {
  email: string;
  password: string; // plaintext — shown/sent once, never stored
}

/** Create or reset the login for a tenant's owner email. Returns the plaintext once. */
export async function issueTenantLogin(tenantId: string, emailRaw: string): Promise<IssuedLogin> {
  const email = emailRaw.trim().toLowerCase();
  const password = generateMemorablePassword();
  const password_hash = hashPassword(password);

  const existing = await db
    .selectFrom("tenant_user")
    .select(["id"])
    .where(sql<boolean>`lower(email) = ${email}`)
    .executeTakeFirst();
  if (existing) {
    await db.updateTable("tenant_user").set({ password_hash }).where("id", "=", existing.id).execute();
  } else {
    await db
      .insertInto("tenant_user")
      .values({ tenant_id: tenantId, email, password_hash })
      .execute();
  }
  return { email, password };
}

/** Issue the login AND email the credentials to the owner. */
export async function issueAndSendTenantLogin(tenantId: string, email: string): Promise<IssuedLogin> {
  const login = await issueTenantLogin(tenantId, email);
  const loginUrl = `${config.publicSiteUrl.replace(/\/$/, "")}/belepes`;
  await getEmailSender().send(buildCredentialsEmail({ to: login.email, password: login.password, loginUrl }));
  return login;
}
