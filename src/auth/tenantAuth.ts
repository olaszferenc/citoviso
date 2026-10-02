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
import { sessionCookieAttrs } from "./loginGuard.js";
import { tenantTimeZone } from "../tenant/timeZone.js";
import { setViewZone } from "../tenant/zoneCtx.js";

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
    // ADR-0277: `Secure` only over HTTPS — dev runs on plain HTTP (loginGuard.ts).
    [`${COOKIE}=${value}`, ...sessionCookieAttrs(res.req, maxAgeSec)].join("; "),
  );
}

/**
 * Where to land after logging in — only somewhere INSIDE the tenant admin.
 *
 * A link in our own mail (the end-of-season question, the price-expiry reminder) points
 * at one card of the Árazás page. On a phone it usually opens in a browser with no
 * session, and the login used to drop the target: the owner landed on the admin's
 * front page and had to find the card themself (owner, 2026-09-24: "menjen a levél link
 * is"). ⛔ The target is user-controlled (a query parameter), so it is accepted ONLY as
 * a same-site "/admin…" path — never "//host", a backslash, a scheme or a control
 * character: an open redirect from our login page would be a phishing tool.
 */
export function safeAdminNext(raw: string | null | undefined): string | null {
  const v = String(raw ?? "");
  if (!v || v.length > 600) return null;
  if (!/^\/admin(?:[/?#]|$)/.test(v)) return null;
  if (/[\\\s\x00-\x1f]|\/\//.test(v)) return null;
  return v;
}

/**
 * Elek T-3 (ADR-XXXX): the cookie carries its ISSUE TIME, signed with the id —
 * `<id>.<iat ms>.<hmac(id.iat)>`. A password set (tenant_user.password_set_at)
 * after `iat` ends that session: setting a password logs out every older one.
 */
export function setSession(res: http.ServerResponse, tenantUserId: string): void {
  const v = `${tenantUserId}.${Date.now()}`;
  setCookie(res, `${v}.${signValue(v)}`, SESSION_TTL_DAYS * 86_400);
}

export function clearSession(res: http.ServerResponse): void {
  setCookie(res, "", 0);
}

/**
 * A session-süti ÉRTÉKE jelszó nélkül — kizárólag a fejlesztői screenshot-hurokhoz
 * (`scripts/ui-shot.mts`), hogy a tenant-admin felületei is lőhetők legyenek.
 *
 * Nem jelent új támadási felületet: a süti stateless HMAC, ugyanazzal a titokkal, amit
 * a `setSession` is használ — aki ezt hívni tudja, az már a szerver-folyamaton belül van.
 * Route SOSEM hívja; ha valaha kérésből hívnád, az hitelesítés-megkerülés lenne.
 */
export function mintTenantCookieValue(tenantUserId: string): string {
  return `${tenantUserId}.${signValue(tenantUserId)}`;
}

/**
 * The signed session: the user id and the cookie's issue time (ms). A LEGACY cookie
 * (`<id>.<hmac(id)>`, before T-3) reads as issued at 0 — still valid, until the
 * owner sets a password, which then ends it like any other older session.
 */
export function readSession(req: http.IncomingMessage): { id: string; iat: number } | null {
  const raw = req.headers.cookie ?? "";
  const c = raw.split(/;\s*/).find((x) => x.startsWith(`${COOKIE}=`));
  if (!c) return null;
  const val = c.slice(COOKIE.length + 1);
  const dot = val.lastIndexOf(".");
  if (dot < 1) return null;
  const signed = val.slice(0, dot);
  const a = Buffer.from(val.slice(dot + 1));
  const b = Buffer.from(signValue(signed));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const parts = signed.split(".");
  if (parts.length === 1) return { id: parts[0]!, iat: 0 };
  if (parts.length === 2 && /^\d{1,15}$/.test(parts[1]!)) return { id: parts[0]!, iat: Number(parts[1]) };
  return null;
}

export interface TenantSession {
  tenantUserId: string;
  tenantId: string;
  username: string;
  contactEmail: string;
  displayName: string;
}

export async function currentTenant(req: http.IncomingMessage): Promise<TenantSession | null> {
  const session = readSession(req);
  if (!session) return null;
  const tenantUserId = session.id;
  const row = await db
    .selectFrom("tenant_user")
    .innerJoin("tenant", "tenant.id", "tenant_user.tenant_id")
    .select([
      "tenant_user.id as tenantUserId",
      "tenant_user.username as username",
      "tenant_user.contact_email as contactEmail",
      "tenant.id as tenantId",
      "tenant.display_name as displayName",
      "tenant_user.password_set_at as passwordSetAt",
    ])
    .where("tenant_user.id", "=", tenantUserId)
    .executeTakeFirst();
  // T-3: a session older than the owner's last password set is over.
  if (row?.passwordSetAt && new Date(row.passwordSetAt as unknown as string).getTime() > session.iat) return null;
  // ADR-0290: the request's views format times in THIS accommodation's zone.
  if (!row) return null;
  setViewZone(await tenantTimeZone(row.tenantId));
  const { passwordSetAt: _set, ...tenant } = row;
  return tenant;
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
    // T-3: the owner's own password — a re-run activation must never overwrite it,
    // and every OTHER session opened before this moment ends (the caller re-issues
    // the cookie of the session that made the change).
    .set({ password_hash: hashPassword(next), password_set_at: new Date() })
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
