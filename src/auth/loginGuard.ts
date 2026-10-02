// Login hardening shared by both auth realms (tenant /login on :4800, operator /login on
// :4600): the Secure cookie decision and the failed-attempt throttle (ADR-0277).
import http from "node:http";
import { clientIp } from "../server/clientIp.js";

/**
 * Was this request made over HTTPS (as the BROWSER sees it)?
 *
 * Prod: nginx terminates TLS and forwards `X-Forwarded-Proto: $scheme` (the header is
 * overwritten, not appended); Cloudflare in front adds `CF-Visitor: {"scheme":"https"}`.
 * Dev: the console and the public server run on plain HTTP — a `Secure` cookie there
 * would never be sent back, i.e. nobody could log in. ⛔ So `Secure` is CONDITIONAL.
 * A client spoofing these headers over plain HTTP only locks ITSELF out.
 */
export function isHttpsRequest(req: http.IncomingMessage | undefined): boolean {
  if (!req) return false;
  if ((req.socket as { encrypted?: boolean } | undefined)?.encrypted === true) return true;
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]!.trim().toLowerCase();
  if (proto === "https") return true;
  return /"scheme"\s*:\s*"https"/i.test(String(req.headers["cf-visitor"] ?? ""));
}

/** The session cookie attribute list; `Secure` only when the request came over HTTPS. */
export function sessionCookieAttrs(req: http.IncomingMessage | undefined, maxAgeSec: number): string[] {
  const attrs = ["HttpOnly", "Path=/", "SameSite=Lax"];
  if (isHttpsRequest(req)) attrs.push("Secure");
  attrs.push(`Max-Age=${maxAgeSec}`);
  return attrs;
}

// ── Failed-login throttle ──
// Counts only FAILED attempts: a correct password never adds to the counter, so the
// gates and the Elek runs that log in many times from 127.0.0.1 are not affected.
// In-memory like the booking throttle in public.ts — a guard, not a ledger (a restart
// resets it; one process per realm).
export const LOGIN_FAIL_LIMIT = 10;
export const LOGIN_FAIL_WINDOW_MS = 10 * 60_000;

/** `pwreset` (Elek T-3): "Elfelejtett jelszó?" requests per IP — each request counts,
 *  so the form cannot be used to flood a mailbox or probe accounts. */
export type LoginRealm = "tenant" | "operator" | "pwreset";

const failures = new Map<string, { n: number; until: number }>();

function key(realm: LoginRealm, req: http.IncomingMessage): string {
  return `${realm}|${clientIp(req)}`;
}

/** True when this IP used up its failed attempts in the current window — checked BEFORE
 *  the password, so a locked IP cannot keep guessing (not even the right password). */
export function loginLocked(realm: LoginRealm, req: http.IncomingMessage, now = Date.now()): boolean {
  const hit = failures.get(key(realm, req));
  if (!hit) return false;
  if (hit.until < now) {
    failures.delete(key(realm, req));
    return false;
  }
  return hit.n >= LOGIN_FAIL_LIMIT;
}

/** Record one failed attempt; the window starts at the first failure. */
export function recordLoginFailure(realm: LoginRealm, req: http.IncomingMessage, now = Date.now()): void {
  const k = key(realm, req);
  const hit = failures.get(k);
  if (!hit || hit.until < now) {
    failures.set(k, { n: 1, until: now + LOGIN_FAIL_WINDOW_MS });
    if (failures.size > 5000) failures.clear(); // bounded
    return;
  }
  hit.n++;
}

/** Test hook: forget every counter. */
export function resetLoginThrottle(): void {
  failures.clear();
}
