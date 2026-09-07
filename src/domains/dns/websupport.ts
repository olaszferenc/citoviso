// Websupport DNS adapter — the "terv-B" zone leg (ADR-0103 ③).
//
// The registrar has NO nameserver-changing API, so we do not move the zone to
// Cloudflare: a domain bought here STAYS on the registrar's own nameservers and we
// drive its zone through the v1 zone API. That is why this adapter exists and why
// CLOUDFLARE_API_TOKEN is no longer a pilot blocker.
//
// ENDPOINTS (from the published v1 API docs, rest.websupport.sk/docs/v1.zone):
//   GET    /v1/user/:id/zone/:domain/record            → { items: [...] }
//   POST   /v1/user/:id/zone/:domain/record            → 201 { status, item, errors }
//   PUT    /v1/user/:id/zone/:domain/record/:recordId  → 200 (⛔ `type` not allowed)
//   DELETE /v1/user/:id/zone/:domain/record/:recordId  → 200
// The list shape is additionally MEASURED on our own live zone (2026-09-07).
//
// ⚠️ A FRESHLY BOUGHT DOMAIN ARRIVES WITH PARKING RECORDS, not an empty zone —
// measured on citoviso.hu: A + AAAA on `@`, `www` and `*` pointing at the registrar's
// parking host, plus a full mail set (MX/SPF/DMARC/webmail…). Two consequences this
// adapter must handle, both of which would otherwise break the site SILENTLY:
//   ① Records must be UPDATED, not created — a second A record on `@` would round-robin
//      half the visitors to the parking page.
//   ② The AAAA records must GO. Our server has no IPv6 here, and a client that prefers
//      IPv6 (most do) would resolve the parking address and never reach the site, while
//      an IPv4-only check reports everything green.
// The mail records are deliberately LEFT ALONE: they are the owner's mail service.

import { createHmac } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { connect as tlsConnect } from "node:tls";
import type { DnsAdapter, ZoneCreation } from "./dns.js";

const BASE = "https://rest.websupport.hu";

interface ZoneRecord {
  readonly id: number;
  readonly type: string;
  readonly name: string;
  readonly content: string;
  readonly ttl?: number | null;
}

export interface WebsupportDnsOptions {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly userId: string;
}

export class WebsupportDns implements DnsAdapter {
  readonly name = "websupport";
  #apiKey: string;
  #apiSecret: string;
  #userId: string;

  constructor(opts: WebsupportDnsOptions) {
    if (!opts.apiKey || !opts.apiSecret || !opts.userId) {
      throw new Error(
        "DNS_PROVIDER=websupport, de a WEBSUPPORT_API_KEY / WEBSUPPORT_API_SECRET / " +
          "WEBSUPPORT_USER_ID valamelyike hiányzik — állítsd be a kulcsokat, vagy maradj " +
          "DNS_PROVIDER=mock lokálban.",
      );
    }
    this.#apiKey = opts.apiKey;
    this.#apiSecret = opts.apiSecret;
    this.#userId = opts.userId;
  }

  /** HMAC-SHA1 over "{METHOD} {path} {ts}"; the signed path carries NO query string. */
  #headers(method: string, pathWithQuery: string): Record<string, string> {
    const path = pathWithQuery.split("?")[0];
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha1", this.#apiSecret).update(`${method} ${path} ${ts}`).digest("hex");
    return {
      Authorization: `Basic ${Buffer.from(`${this.#apiKey}:${sig}`).toString("base64")}`,
      Date: new Date(ts * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""),
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  async #request<T>(method: string, pathWithQuery: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${pathWithQuery}`, {
      method,
      headers: this.#headers(method, pathWithQuery),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`DNS ${method} ${pathWithQuery}: nem JSON válasz (${res.status})`);
    }
    if (!res.ok) {
      const msg = (parsed as { message?: string })?.message ?? text.slice(0, 200);
      throw new Error(`DNS ${method} ${pathWithQuery}: HTTP ${res.status} — ${msg}`);
    }
    // The API answers 200 with status:"error" + an errors object for validation failures,
    // so a 2xx alone is NOT success — checking only the HTTP code would swallow those.
    const p = parsed as { status?: string; errors?: unknown };
    const errs = p.errors;
    const hasErrors = Array.isArray(errs) ? errs.length > 0 : Boolean(errs && Object.keys(errs).length);
    if (p.status === "error" || (p.status !== undefined && hasErrors)) {
      throw new Error(`DNS ${method} ${pathWithQuery}: ${JSON.stringify(errs)}`);
    }
    return parsed as T;
  }

  #recordPath(domain: string): string {
    return `/v1/user/${this.#userId}/zone/${encodeURIComponent(domain)}/record`;
  }

  async #records(domain: string): Promise<ZoneRecord[]> {
    const r = await this.#request<{ items?: ZoneRecord[] }>("GET", this.#recordPath(domain));
    return r.items ?? [];
  }

  /**
   * Terv-B: the zone is NOT created here — buying the domain at this registrar already
   * created it, on the registrar's own nameservers. So this READS the zone back and
   * reports the nameservers it is delegated to, which is what the caller then "sets" at
   * the registrar (a no-op assert there, by design).
   *
   * Fails loudly when the zone is absent: that means the domain is not actually ours
   * yet, and silently continuing would point a live site at nothing.
   */
  async createZone(domain: string): Promise<ZoneCreation> {
    const records = await this.#records(domain);
    if (records.length === 0) {
      throw new Error(
        `a(z) ${domain} zónája üres vagy nem érhető el a registrar-fiókban — ` +
          `a DNS-beállítás nem indult el (terv-B: a zónát a domain vásárlása hozza létre)`,
      );
    }
    const nameservers = records
      .filter((r) => r.type === "NS" && (r.name === "@" || r.name === ""))
      .map((r) => r.content.replace(/\.$/, ""));
    if (nameservers.length === 0) {
      throw new Error(`a(z) ${domain} zónájában nincs NS-rekord — nem állapítható meg a delegálás`);
    }
    return { zoneRef: domain, nameservers };
  }

  /**
   * Point apex + www at our server. UPSERT semantics against the parking defaults:
   * existing A records are UPDATED (a duplicate would send half the visitors to the
   * parking page) and the matching AAAA records are DELETED (we have no IPv6 there, and
   * an IPv6-preferring client would otherwise silently land on the parking host).
   */
  async pointToServer(domain: string, serverIp: string): Promise<void> {
    const records = await this.#records(domain);
    const path = this.#recordPath(domain);

    for (const name of ["@", "www"]) {
      const existingA = records.filter((r) => r.type === "A" && r.name === name);
      if (existingA.length === 0) {
        await this.#request("POST", path, { type: "A", name, content: serverIp, ttl: 600 });
      } else {
        // Update the first, delete any extras — one name must resolve to ONE host.
        // ⛔ `type` must not be sent on update (the API rejects it).
        await this.#request("PUT", `${path}/${existingA[0].id}`, {
          name,
          content: serverIp,
          ttl: 600,
        });
        for (const dup of existingA.slice(1)) await this.#request("DELETE", `${path}/${dup.id}`);
      }
      for (const v6 of records.filter((r) => r.type === "AAAA" && r.name === name)) {
        await this.#request("DELETE", `${path}/${v6.id}`);
      }
    }
  }

  /**
   * Is the domain actually resolving to our server for the whole internet yet?
   *
   * MEASURED, not assumed: we ask the domain's own authoritative nameservers and
   * require the apex A record to be our IP. Reading our own API back would only prove
   * that we wrote the record, not that the world can see it — and the gap between those
   * two is exactly the propagation window this state exists to wait out.
   */
  async zoneStatus(domain: string): Promise<"pending" | "active"> {
    const expectedIp = process.env.DOMAIN_TARGET_IP ?? "";
    try {
      const resolver = new Resolver({ timeout: 5000, tries: 2 });
      const addresses = await resolver.resolve4(domain);
      if (addresses.length === 0) return "pending";
      // Without a configured target we cannot judge WHERE it points, only that it
      // resolves — so require the target to be set rather than guess (fail-closed).
      if (!expectedIp) return "pending";
      return addresses.includes(expectedIp) ? "active" : "pending";
    } catch {
      return "pending"; // NXDOMAIN / SERVFAIL → delegation has not landed yet
    }
  }

  /**
   * Does the host actually serve a VALID certificate for this name?
   *
   * Deliberately provider-agnostic: it opens a real TLS connection and lets Node verify
   * the chain and the hostname. Terv-B issues certificates with Let's Encrypt ON THE VPS
   * (⚠️ not installed yet — measured 2026-09-07: nginx serves a Cloudflare origin cert
   * and certbot is absent), so there is no certificate API to poll. Measuring the socket
   * means this keeps working whatever issues the cert, and it can never report "active"
   * for a certificate a browser would reject.
   */
  async certificateStatus(domain: string): Promise<"pending" | "active"> {
    return await new Promise((resolve) => {
      const socket = tlsConnect(
        { host: domain, port: 443, servername: domain, timeout: 8000, rejectUnauthorized: true },
        () => {
          const ok = socket.authorized;
          socket.destroy();
          resolve(ok ? "active" : "pending");
        },
      );
      socket.on("error", () => {
        socket.destroy();
        resolve("pending");
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve("pending");
      });
    });
  }
}
