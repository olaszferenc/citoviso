// The client address the per-IP brakes key on (ADR-0280): the booking/enquiry/review
// throttle in public.ts and the failed-login throttle in src/auth/loginGuard.ts.
// ONE rule, one copy — two copies drifting apart would let one brake be dodged.
import { BlockList, isIPv6 } from "node:net";
import type http from "node:http";

/**
 * Cloudflare's edge ranges — https://www.cloudflare.com/ips-v4 and /ips-v6, fetched
 * 2026-09-30. Prod traffic reaches nginx THROUGH Cloudflare (the public DNS points at
 * 2606:4700::/32), and nginx has no `set_real_ip_from`, so its `$remote_addr` — and with
 * it X-Real-IP — is the EDGE, shared by every guest of a whole PoP. A stale list only
 * makes a new edge count as one client (the pre-Cloudflare behaviour), never lets a
 * client choose its own key.
 */
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
  "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
];
const cloudflare = new BlockList();
for (const cidr of CLOUDFLARE_RANGES) {
  const [net, bits] = cidr.split("/");
  cloudflare.addSubnet(net!, Number(bits), isIPv6(net!) ? "ipv6" : "ipv4");
}

/** Is this peer a Cloudflare edge? (IPv4-mapped IPv6 "::ffff:a.b.c.d" is unwrapped.) */
export function isCloudflareEdge(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIPv6(v4)) return cloudflare.check(v4, "ipv6");
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(v4) && cloudflare.check(v4, "ipv4");
}

function header(req: http.IncomingMessage, name: string): string {
  const raw = req.headers[name];
  return ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
}

/**
 * ① The peer: X-Real-IP — nginx sets it to `$remote_addr`, OVERWRITING whatever the
 *   client sent; without a proxy (dev) the socket address.
 * ② If that peer is a Cloudflare edge, the client is `CF-Connecting-IP`: Cloudflare
 *   overwrites that header too, and it is trusted ONLY from an edge — a request sent
 *   straight to the origin cannot choose its key with it.
 * `X-Forwarded-For` is NEVER read: nginx builds it with `$proxy_add_x_forwarded_for`,
 * i.e. APPENDS to the client's own value, so its first element is whatever the client
 * claims — a fresh one per request would reset the brake.
 */
export function clientIp(req: http.IncomingMessage): string {
  const peer = header(req, "x-real-ip") || req.socket?.remoteAddress || "?";
  if (isCloudflareEdge(peer)) {
    const client = header(req, "cf-connecting-ip");
    if (client) return client;
  }
  return peer;
}
