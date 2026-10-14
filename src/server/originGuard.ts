// Cross-origin brake for state-changing requests (Elek IT S-1, 2026-10-14).
//
// The session cookies are SameSite=Lax and host-only — but every *.citoviso.com host is the
// SAME SITE to a browser, so a page on a tenant subdomain or a preview label could POST to
// citoviso.com/admin/* (or the console) WITH the owner's cookie. Measured live by the IT tester:
// a POST with a foreign Origin rewrote a price. Lax does not stop a sibling subdomain; an exact
// origin match does.
//
// The rule, for every non-GET/HEAD/OPTIONS request: when the browser names where the request
// comes from — `Origin`, else `Referer` — that origin's host (with its port) must equal the
// request's own `Host`. A tenant's own host is thereby valid only for itself. `Origin: null`
// (sandboxed frames, file pages, some redirects) is refused. A request with NEITHER header is a
// non-browser client — the payment gateway's callback, the SMS/MMS relay, our own guards — and
// passes: a browser always sends Origin on a cross-origin POST. Server-to-server endpoints that
// authenticate otherwise (bearer secret, gateway signature) are exempt by path as well, so a
// proxy that happens to add a header cannot break them.

import type http from "node:http";

/** Paths that are called server-to-server and authenticate on their own. */
const EXEMPT = [/^\/pay\/webhook\//, /^\/api\/sms-relay\//, /^\/api\/mms-relay\//, /^\/api\/replies\/ingest$/];

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** host[:port], lower-case, the default ports dropped — the scheme is NOT compared (Cloudflare
 *  ends TLS, so the node may see http while the browser said https). */
function norm(host: string): string {
  return host.toLowerCase().replace(/\.$/, "").replace(/:(80|443)$/, "");
}
function hostOf(url: string): string | null {
  try {
    return norm(new URL(url).host);
  } catch {
    return null;
  }
}

/** null = allowed; otherwise the reason the request is refused (for the log). */
export function crossOriginRefusal(req: http.IncomingMessage, pathname: string): string | null {
  if (SAFE.has(String(req.method ?? "GET").toUpperCase())) return null;
  if (EXEMPT.some((re) => re.test(pathname))) return null;
  // The browser's host, as nginx passes it (`proxy_set_header Host $host`, measured on prod
  // 2026-10-14 — every block, custom domains included: there is no default_server). Never
  // X-Forwarded-Host: nginx does not overwrite it, so a client can forge it (ADR-0278).
  const host = norm(String(req.headers.host ?? ""));
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length) {
    if (origin === "null") return "Origin: null";
    const oh = hostOf(origin);
    return oh && oh === host ? null : `Origin ${origin} ≠ Host ${host}`;
  }
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.length) {
    const rh = hostOf(referer);
    return rh && rh === host ? null : `Referer ${referer.slice(0, 80)} ≠ Host ${host}`;
  }
  return null;
}
