// First-party forgalom-mérés az élő tenant-oldalon (ADR-0108).
//
// WHY THIS EXISTS AT ALL: we are the host. Every request to a tenant page passes
// through serveTenantHost, so the traffic figure needs no third party, no approval
// and no client-side script — and no ad blocker can remove it. The slug host and the
// custom domain arrive on the SAME code path, so both are covered by construction.
//
// WHAT IT IS FOR: the honest evidence behind our own promise. Instead of claiming
// visibility, we show what actually happened — and the monthly "ennyi vendég talált
// meg" figure is the strongest argument the tenant has at renewal time.
//
// ⛔ TWO RULES THIS FILE ENFORCES, because both decide whether the number we later
// show the customer is TRUE (§B.17):
//   1. BOTS ARE MARKED. A crawler hit is not a guest. We still store the row (so the
//      filter itself stays measurable and fixable) but flag it, and every report
//      filters on the flag.
//   2. RECORDING MAY NEVER BREAK OR SLOW THE PAGE. The guest's page load does not
//      wait for the insert and does not fail with it — a measurement problem must
//      never become an availability problem.

import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { db } from "../db/client.js";

/**
 * Known crawler/monitor signatures. Deliberately broad substrings: a bot counted as
 * a guest inflates the number we show the paying customer, which is the failure that
 * matters here — while a guest miscounted as a bot only costs us a data point.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|showyoubot|outbrain|pinterest|vkshare|w3c_validator|whatsapp|flipboard|tumblr|telegram|discord|slack|preview|monitor|uptime|pingdom|lighthouse|headless|curl|wget|python-requests|axios|go-http-client|java\/|okhttp/i;

/** Bare hostname of the referrer ("google.com"), never the full URL. */
function referrerHost(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const h = new URL(raw).hostname.replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}

function deviceOf(ua: string): "mobile" | "desktop" {
  return /mobile|android|iphone|ipad|ipod|windows phone/i.test(ua) ? "mobile" : "desktop";
}

/**
 * Per-day rotating salt. The hash must be stable WITHIN a day (so one visitor
 * reading three pages is one visitor) and unlinkable ACROSS days — that is what
 * keeps this a counter rather than a profile. SESSION_SECRET is the server-side
 * secret component, so the hash cannot be recomputed from public data either.
 */
function visitorHash(ip: string, ua: string, day: string): string {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHash("sha256").update(`${day}|${secret}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

/** The client IP, honouring the reverse proxy (nginx sits in front on prod). */
function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0];
  return (first ?? req.socket.remoteAddress ?? "").trim();
}

export interface RecordVisitInput {
  readonly tenantId: string;
  readonly siteId: string;
  /** The host the request arrived on — slug host or the tenant's own domain. */
  readonly host: string;
  /** True when `host` is the tenant's purchased custom domain. */
  readonly isCustomDomain: boolean;
}

/**
 * Record ONE page view. Fire-and-forget by contract: the caller does not await it,
 * and every failure is swallowed after a log line — a broken analytics insert must
 * never take a guest's page down with it.
 */
export function recordSiteVisit(req: IncomingMessage, input: RecordVisitInput): void {
  const ua = String(req.headers["user-agent"] ?? "");
  const day = new Date().toISOString().slice(0, 10);
  const row = {
    tenant_id: input.tenantId,
    site_id: input.siteId,
    host: input.host,
    host_kind: input.isCustomDomain ? "custom" : "slug",
    referrer: referrerHost(req.headers.referer),
    device: deviceOf(ua),
    visitor_hash: visitorHash(clientIp(req), ua, day),
    is_bot: BOT_PATTERN.test(ua) || ua.trim() === "",
  };
  void db
    .insertInto("site_visit")
    .values(row)
    .execute()
    .catch((e) => {
      console.error("[analytics] látogatás-rögzítés nem sikerült (az oldal ettől ép):", e);
    });
}
