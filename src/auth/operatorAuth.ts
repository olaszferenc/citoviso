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
    [`${COOKIE}=${value}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAgeSec}`].join("; "),
  );
}

/**
 * Signed stateless cookie value for an operator id. Split out so the ui-shot
 * screenshot tool (scripts/ui-shot.mts) can mint a session against its own
 * in-process server without a password round-trip or a DB write.
 */
export function mintOperatorCookieValue(operatorUserId: string): string {
  return `${operatorUserId}.${signValue(operatorUserId)}`;
}

export function setOperatorSession(res: http.ServerResponse, operatorUserId: string): void {
  setCookie(res, mintOperatorCookieValue(operatorUserId), SESSION_TTL_DAYS * 86_400);
}

export function clearOperatorSession(res: http.ServerResponse): void {
  setCookie(res, "", 0);
}

export function readOperatorSession(req: http.IncomingMessage): string | null {
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
    .set({ password_hash: hashPassword(next) })
    .where("id", "=", operatorUserId)
    .execute();
  return null;
}

export interface OperatorSession {
  operatorUserId: string;
  username: string;
  displayName: string;
  role: string;
}

export async function currentOperator(
  req: http.IncomingMessage,
): Promise<OperatorSession | null> {
  const id = readOperatorSession(req);
  if (!id) return null;
  const row = await db
    .selectFrom("operator_user")
    .select([
      "id as operatorUserId",
      "username",
      "display_name as displayName",
      "role",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
  return row ?? null;
}
