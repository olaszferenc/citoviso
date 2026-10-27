// Operator (control-plane) auth for the internal console (ADR-0021 dual realm).
// Same proven mechanics as the tenant realm (scrypt + HMAC-signed stateless
// cookie, tenantAuth.ts) but a SEPARATE user table and a SEPARATE cookie name —
// an operator session must never be readable as a tenant session or vice versa.
// This is what makes the console safe to deploy on the public internet: network
// trust (Tailscale) is a dev convenience, not the auth model.

import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { hashPassword, verifyPassword } from "./tenantAuth.js";
import { sessionCookieAttrs } from "./loginGuard.js";
import { setConsoleLang } from "../console/i18nCtx.js";
import { prepareRenderLang } from "../i18n/mail.js";

const SESSION_TTL_DAYS = 30;
const COOKIE = "cit_op_session";
/** Realm prefix inside the signed value — a tenant cookie can never validate here. */
const REALM = "op";

/** Authenticate username + password → operator_user id (or null). */
export async function authenticateOperator(
  usernameRaw: string,
  pw: string,
): Promise<string | null> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username || !pw) return null;
  const user = await db
    .selectFrom("operator_user")
    .select(["id", "password_hash"])
    .where(sql<boolean>`lower(username) = ${username}`)
    .executeTakeFirst();
  if (!user || !verifyPassword(pw, user.password_hash)) return null;
  await db
    .updateTable("operator_user")
    .set({ last_login_at: new Date() })
    .where("id", "=", user.id)
    .execute();
  return user.id;
}

function signValue(value: string): string {
  return createHmac("sha256", config.sessionSecret).update(`${REALM}:${value}`).digest("base64url");
}

function setCookie(res: http.ServerResponse, value: string, maxAgeSec: number): void {
  res.setHeader(
    "Set-Cookie",
    // ADR-0277: `Secure` only over HTTPS — dev runs on plain HTTP (loginGuard.ts).
    [`${COOKIE}=${value}`, ...sessionCookieAttrs(res.req, maxAgeSec)].join("; "),
  );
}

/**
 * Signed cookie value for an operator id. Split out so the ui-shot screenshot
 * tool (scripts/ui-shot.mts) can mint a session against its own in-process
 * server without a password round-trip or a DB write.
 *
 * Elek IT-kör B1 (ADR-0363): the value carries its ISSUE TIME, signed with the id —
 * `<id>.<iat ms>.<hmac(id.iat)>`. The gate (verifyOperatorSession) ends it after
 * SESSION_TTL_DAYS, when the operator row is gone, or when the row's
 * sessions_valid_from (password change / reset) is later than `iat`.
 */
export function mintOperatorCookieValue(operatorUserId: string): string {
  const v = `${operatorUserId}.${Date.now()}`;
  return `${v}.${signValue(v)}`;
}

export function setOperatorSession(res: http.ServerResponse, operatorUserId: string): void {
  setCookie(res, mintOperatorCookieValue(operatorUserId), SESSION_TTL_DAYS * 86_400);
}

export function clearOperatorSession(res: http.ServerResponse): void {
  setCookie(res, "", 0);
}

/** A cookie issued this far in the future is not ours (clock skew tolerance). */
const FUTURE_SKEW_MS = 5 * 60_000;

/**
 * The SIGNED part of the cookie only — id + issue time, no DB. A legacy cookie
 * (`<id>.<hmac(id)>`, before ADR-0363) has no issue time and does not read: the
 * format switch logs every operator out once, by design.
 * ⛔ Not a gate on its own — use verifyOperatorSession / currentOperator.
 */
export function readOperatorSession(req: http.IncomingMessage): { id: string; iat: number } | null {
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
  if (parts.length !== 2 || !parts[0] || !/^\d{1,15}$/.test(parts[1]!)) return null;
  const iat = Number(parts[1]);
  const now = Date.now();
  if (iat > now + FUTURE_SKEW_MS || now - iat > SESSION_TTL_DAYS * 86_400_000) return null;
  return { id: parts[0], iat };
}

/** Is this (signed) session still live for the operator row as it is NOW? */
function sessionLive(iat: number, row: { sessions_valid_from: Date | string | null } | undefined): boolean {
  if (!row) return false; // operator removed → no console
  if (row.sessions_valid_from && new Date(row.sessions_valid_from).getTime() > iat) return false;
  return true;
}

/**
 * The console gate (ADR-0363): signature + age + the operator row on EVERY request —
 * a deleted operator, or a session older than the last password change, is out.
 * Returns the operator id, or null.
 */
export async function verifyOperatorSession(req: http.IncomingMessage): Promise<string | null> {
  const s = readOperatorSession(req);
  if (!s) return null;
  const row = await db
    .selectFrom("operator_user")
    .select("sessions_valid_from")
    .where("id", "=", s.id)
    .executeTakeFirst();
  return sessionLive(s.iat, row) ? s.id : null;
}

/**
 * Change an operator's password after verifying the current one.
 * Returns an operator-facing error string, or null on success.
 */
export async function changeOperatorPassword(
  operatorUserId: string,
  current: string,
  next: string,
): Promise<string | null> {
  if (next.length < 8) return "Az új jelszó legyen legalább 8 karakter.";
  const user = await db
    .selectFrom("operator_user")
    .select("password_hash")
    .where("id", "=", operatorUserId)
    .executeTakeFirst();
  if (!user || !verifyPassword(current, user.password_hash)) {
    return "A jelenlegi jelszó nem stimmel.";
  }
  await db
    .updateTable("operator_user")
    // ADR-0363: the change ends every session issued before it (the caller re-issues its own).
    .set({ password_hash: hashPassword(next), sessions_valid_from: new Date() })
    .where("id", "=", operatorUserId)
    .execute();
  return null;
}

export interface OperatorSession {
  operatorUserId: string;
  username: string;
  displayName: string;
  role: string;
  /** ADR-0067 ③: the console language of THIS operator (migration 0037) — the
   *  setting belongs to the person, not the installation. */
  lang: string;
}

export async function currentOperator(
  req: http.IncomingMessage,
): Promise<OperatorSession | null> {
  const s = readOperatorSession(req);
  if (!s) return null;
  const found = await db
    .selectFrom("operator_user")
    .select([
      "id as operatorUserId",
      "username",
      "display_name as displayName",
      "role",
      // ADR-0067 ③: the console renders in the operator's own language.
      "lang",
      "sessions_valid_from",
    ])
    .where("id", "=", s.id)
    .executeTakeFirst();
  // ADR-0363: same rule as the gate — a session older than the last password change is over.
  if (!found || !sessionLive(s.iat, found)) return null;
  const { sessions_valid_from: _cut, ...row } = found;
  // ADR-0067 ③: the ONE place the operator is loaded is the one place that can
  // reliably arm the request's language — and warm the pack, because the views'
  // T() lookups are synchronous. Doing it here means no route can forget to.
  // ⛔ ADR-XXXX: warm only — an incomplete pack is provisioned in the background, the page
  // renders with the hu-fallback (2026-10-27: awaiting it here cost $130 in an hour).
  setConsoleLang(row.lang);
  await prepareRenderLang(row.lang);
  return row;
}
