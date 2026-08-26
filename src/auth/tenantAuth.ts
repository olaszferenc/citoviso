// Tenant (data-plane) auth — issued memorable password + signed session cookie (ADR-0023).
// We generate a friendly passphrase, hand it to the owner, and store only its scrypt
// hash. Chosen over magic-link for the non-technical owner segment (no email hunt per
// login). Internal control-plane auth is a separate realm (ADR-0021).

import http from "node:http";
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { T, langForTenant, prepareMailLang } from "../i18n/mail.js";

const SESSION_TTL_DAYS = 30;
const COOKIE = "cit_session";

// ── Password: scrypt hash "salt:hex" (node built-in, no dependency) ──
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const cand = scryptSync(pw, salt, 32);
  const known = Buffer.from(hex, "hex");
  return cand.length === known.length && timingSafeEqual(cand, known);
}

// Memorable passphrase: two Hungarian-friendly words + two digits (e.g. "kilato-levendula-47").
const WORDS = [
  "napfeny", "topart", "szello", "levendula", "kavezo", "erdo", "patak", "kilato",
  "terasz", "muhely", "kert", "piac", "varos", "folyo", "hegy", "tavasz", "pihenő", // i18n-exempt: jelszó-szógenerátor ADAT, nem felirat
  "vendeg", "csillag", "harmat", "meleg", "otthon", "kikoto", "liget",
];

export function generateMemorablePassword(): string {
  const a = WORDS[randomInt(WORDS.length)];
  let b = WORDS[randomInt(WORDS.length)];
  while (b === a) b = WORDS[randomInt(WORDS.length)];
  return `${a}-${b}-${randomInt(10, 100)}`;
}

/** Authenticate username + password → tenant_user id (or null). */
export async function authenticate(usernameRaw: string, pw: string): Promise<string | null> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username || !pw) return null;
  const user = await db
    .selectFrom("tenant_user")
    .select(["id", "password_hash"])
    .where(sql<boolean>`lower(username) = ${username}`)
    .executeTakeFirst();
  if (!user || !verifyPassword(pw, user.password_hash)) return null;
  await db
    .updateTable("tenant_user")
    .set({ last_login_at: new Date() })
    .where("id", "=", user.id)
    .execute();
  return user.id;
}

// ── Session cookie (HMAC-signed, stateless) ──
function signValue(value: string): string {
  return createHmac("sha256", config.sessionSecret).update(value).digest("base64url");
}

function setCookie(res: http.ServerResponse, value: string, maxAgeSec: number): void {
  res.setHeader(
    "Set-Cookie",
    [`${COOKIE}=${value}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAgeSec}`].join("; "),
  );
}

export function setSession(res: http.ServerResponse, tenantUserId: string): void {
  setCookie(res, `${tenantUserId}.${signValue(tenantUserId)}`, SESSION_TTL_DAYS * 86_400);
}

export function clearSession(res: http.ServerResponse): void {
  setCookie(res, "", 0);
}

export function readSession(req: http.IncomingMessage): string | null {
  const raw = req.headers.cookie ?? "";
  const c = raw.split(/;\s*/).find((x) => x.startsWith(`${COOKIE}=`));
  if (!c) return null;
  const val = c.slice(COOKIE.length + 1);
  const dot = val.lastIndexOf(".");
  if (dot < 1) return null;
  const id = val.slice(0, dot);
  const a = Buffer.from(val.slice(dot + 1));
  const b = Buffer.from(signValue(id));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

export interface TenantSession {
  tenantUserId: string;
  tenantId: string;
  username: string;
  contactEmail: string;
  displayName: string;
}

export async function currentTenant(req: http.IncomingMessage): Promise<TenantSession | null> {
  const tenantUserId = readSession(req);
  if (!tenantUserId) return null;
  const row = await db
    .selectFrom("tenant_user")
    .innerJoin("tenant", "tenant.id", "tenant_user.tenant_id")
    .select([
      "tenant_user.id as tenantUserId",
      "tenant_user.username as username",
      "tenant_user.contact_email as contactEmail",
      "tenant.id as tenantId",
      "tenant.display_name as displayName",
    ])
    .where("tenant_user.id", "=", tenantUserId)
    .executeTakeFirst();
  return row ?? null;
}

/**
 * Change a tenant user's password after verifying the current one.
 * Returns a user-facing error string, or null on success.
 */
export async function changeTenantPassword(
  tenantUserId: string,
  current: string,
  next: string,
): Promise<string | null> {
  // ADR-0067/0070: the owner reads these on the admin — in their site's language.
  const u = await db
    .selectFrom("tenant_user")
    .select(["password_hash", "tenant_id"])
    .where("id", "=", tenantUserId)
    .executeTakeFirst();
  const lang = await prepareMailLang(u ? await langForTenant(u.tenant_id) : "hu");
  if (next.length < 8) return T(lang, "Az új jelszó legyen legalább 8 karakter.");
  if (!u || !verifyPassword(current, u.password_hash)) {
    return T(lang, "A jelenlegi jelszó nem stimmel.");
  }
  const user = u;
  await db
    .updateTable("tenant_user")
    .set({ password_hash: hashPassword(next) })
    .where("id", "=", tenantUserId)
    .execute();
  return null;
}

/** Update the tenant owner's changeable communication email. */
export async function updateContactEmail(tenantUserId: string, emailRaw: string): Promise<boolean> {
  const email = emailRaw.trim();
  if (!email.includes("@")) return false;
  await db
    .updateTable("tenant_user")
    .set({ contact_email: email })
    .where("id", "=", tenantUserId)
    .execute();
  return true;
}
