// One-time password-setting links for the tenant owner (Elek T-3, owner-approved
// 2026-10-02, variant B; ADR-0303).
//
// WHY. The credentials mail carried the password in plain text ("Jelszó: …") and
// said "if you forget it, reply to this mail" — no self-service reset at all, and a
// two-words-and-a-number password (~50 000 possibilities) sitting in every mailbox
// and every forward to the accountant. Now: the mail carries a LINK; the link is
// single-use and lives 7 days; "Elfelejtett jelszó?" sends a fresh one; setting a
// password ends every session opened before it (the cookie's signed issue time vs
// tenant_user.password_set_at — tenantAuth.currentTenant).
//
// ⛔ The table stores only the SHA-256 of the token: a leaked DB row cannot be
//    replayed as a link.
// ⛔ A GET never consumes (mail scanners open links): peek shows the form, only the
//    POST of a password spends the token (same rule as ADR-0291).

import { createHash, randomBytes } from "node:crypto";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { hashPassword } from "./tenantAuth.js";

/** How long a mailed link lives (owner: 7 days). */
export const PASSWORD_LINK_DAYS = 7;
/** The pay-done page's inline form: only right after the payment, only once. */
export const PAYDONE_LINK_MINUTES = 120;
/** The one minimum, shared with the in-admin password change. */
export const MIN_PASSWORD_LENGTH = 8;

const digest = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Mint a link token for a user; returns the RAW token (only the hash is stored). */
export async function issuePasswordToken(
  tenantUserId: string,
  ttlMs: number = PASSWORD_LINK_DAYS * 86_400_000,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db
    .insertInto("login_token")
    .values({ tenant_user_id: tenantUserId, token: digest(token), expires_at: new Date(Date.now() + ttlMs) })
    .execute();
  return token;
}

/** The absolute URL a mail carries. */
export function passwordLinkUrl(token: string, lang?: string | null): string {
  const base = config.publicSiteUrl.replace(/\/+$/, "");
  return `${base}/login/jelszo/${token}${lang && lang !== "hu" ? `?lang=${encodeURIComponent(lang)}` : ""}`;
}

export type PasswordLinkPeek =
  | { readonly ok: true; readonly tenantUserId: string; readonly username: string; readonly siteName: string; readonly tenantId: string }
  | { readonly ok: false; readonly reason: "unknown" | "used" | "expired" };

/** Look at a token WITHOUT spending it (the GET). */
export async function peekPasswordToken(token: string): Promise<PasswordLinkPeek> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { ok: false, reason: "unknown" };
  const row = await db
    .selectFrom("login_token")
    .innerJoin("tenant_user", "tenant_user.id", "login_token.tenant_user_id")
    .innerJoin("tenant", "tenant.id", "tenant_user.tenant_id")
    .select([
      "login_token.used_at as usedAt",
      "login_token.expires_at as expiresAt",
      "tenant_user.id as tenantUserId",
      "tenant_user.username as username",
      "tenant.id as tenantId",
      "tenant.display_name as siteName",
    ])
    .where("login_token.token", "=", digest(token))
    .executeTakeFirst();
  if (!row) return { ok: false, reason: "unknown" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (new Date(row.expiresAt as unknown as string).getTime() <= Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, tenantUserId: row.tenantUserId, username: row.username, siteName: row.siteName, tenantId: row.tenantId };
}

export type PasswordSetResult =
  | { readonly ok: true; readonly tenantUserId: string }
  | { readonly ok: false; readonly error: "short" | "mismatch" | "link" };

/**
 * Spend the token and set the password (the POST). Atomic: the token is claimed
 * with a conditional UPDATE, so a double submit cannot set two passwords. Every
 * OTHER open link of the user dies with it, and password_set_at moves — every
 * cookie issued before this moment stops working.
 */
export async function setPasswordWithToken(token: string, pw: string, pw2: string): Promise<PasswordSetResult> {
  if (pw.length < MIN_PASSWORD_LENGTH) return { ok: false, error: "short" };
  if (pw !== pw2) return { ok: false, error: "mismatch" };
  return db.transaction().execute(async (trx) => {
    const claimed = await trx
      .updateTable("login_token")
      .set({ used_at: new Date() })
      .where("token", "=", digest(token))
      .where("used_at", "is", null)
      .where("expires_at", ">", new Date())
      .returning("tenant_user_id")
      .executeTakeFirst();
    if (!claimed) return { ok: false as const, error: "link" as const };
    const uid = claimed.tenant_user_id;
    await trx
      .updateTable("tenant_user")
      .set({
        password_hash: hashPassword(pw),
        // Node's clock, the same one that stamps the next cookie (tenantAuth).
        password_set_at: new Date(),
      })
      .where("id", "=", uid)
      .execute();
    await trx
      .updateTable("login_token")
      .set({ used_at: new Date() })
      .where("tenant_user_id", "=", uid)
      .where("used_at", "is", null)
      .execute();
    return { ok: true as const, tenantUserId: uid };
  });
}

/**
 * "Elfelejtett jelszó?" — find the user by username OR contact e-mail. Returns the
 * users to mail (one e-mail may own several places — each gets its link), or []; the
 * CALLER answers the same page either way (no account
 * enumeration).
 */
export async function findUserForReset(
  identifier: string,
): Promise<{ readonly tenantUserId: string; readonly tenantId: string; readonly username: string; readonly email: string; readonly siteName: string }[]> {
  const id = identifier.trim().toLowerCase();
  if (id.length < 3 || id.length > 254) return [];
  return db
    .selectFrom("tenant_user")
    .innerJoin("tenant", "tenant.id", "tenant_user.tenant_id")
    .select([
      "tenant_user.id as tenantUserId",
      "tenant_user.tenant_id as tenantId",
      "tenant_user.username as username",
      "tenant_user.contact_email as email",
      "tenant.display_name as siteName",
    ])
    .where((eb) => eb.or([sql<boolean>`lower(tenant_user.username) = ${id}`, sql<boolean>`lower(tenant_user.contact_email) = ${id}`]))
    .orderBy("tenant_user.created_at", "asc")
    .limit(10)
    .execute();
}

/**
 * Variant B (owner, 2026-10-02): the pay-done page offers the password form at once.
 * Only for the payment that just went through (paid within PAYDONE_LINK_MINUTES),
 * only while the owner never set a password, and the token dies with that window —
 * the page is reachable by its payment reference, so it must not stay a door.
 */
export async function payDonePasswordUrl(gatewayRef: string, username: string): Promise<string | null> {
  const pay = await db
    .selectFrom("payment")
    .select(["paid_at"])
    .where("gateway_ref", "=", gatewayRef)
    .where("status", "=", "paid")
    .executeTakeFirst();
  if (!pay?.paid_at) return null;
  const left = new Date(pay.paid_at as unknown as string).getTime() + PAYDONE_LINK_MINUTES * 60_000 - Date.now();
  if (left <= 0) return null;
  const user = await db
    .selectFrom("tenant_user")
    .select(["id", "password_set_at"])
    .where(sql<boolean>`lower(username) = ${username.toLowerCase()}`)
    .executeTakeFirst();
  if (!user || user.password_set_at) return null;
  return passwordLinkUrl(await issuePasswordToken(user.id, left));
}
