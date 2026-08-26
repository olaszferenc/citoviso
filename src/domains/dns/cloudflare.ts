// Cloudflare DNS/TLS adapter (ADR-0024 / ADR-0071). DNS_PROVIDER=cloudflare selects it.
//
// STUB, deliberately (same stance as the INWX + Barion stubs): the real REST calls
// (zones POST, dns_records POST, zone status GET, ssl/universal GET) are validated
// against the live account at the first custom-domain order, not against a fabricated
// shape (§B.17). The constructor throws on missing creds so DNS_PROVIDER=cloudflare
// can never silently fall back to the mock.

import type { DnsAdapter, ZoneCreation } from "./dns.js";

export class CloudflareDns implements DnsAdapter {
  readonly name = "cloudflare";
  #token: string;
  #accountId: string;

  constructor(apiToken: string, accountId: string) {
    if (!apiToken || !accountId) {
      throw new Error(
        "DNS_PROVIDER=cloudflare, de CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID hiányzik — állítsd be a kulcsokat, vagy maradj DNS_PROVIDER=mock lokálban.",
      );
    }
    this.#token = apiToken;
    this.#accountId = accountId;
  }

  async createZone(_domain: string): Promise<ZoneCreation> {
    throw new Error("CloudflareDns.createZone: nincs implementálva — Cloudflare REST integráció az első éles domain-rendeléskor (ADR-0024).");
  }

  async pointToServer(_domain: string, _serverIp: string): Promise<void> {
    throw new Error("CloudflareDns.pointToServer: nincs implementálva — Cloudflare REST integráció az első éles domain-rendeléskor (ADR-0024).");
  }

  async zoneStatus(_domain: string): Promise<"pending" | "active"> {
    throw new Error("CloudflareDns.zoneStatus: nincs implementálva — Cloudflare REST integráció az első éles domain-rendeléskor (ADR-0024).");
  }

  async certificateStatus(_domain: string): Promise<"pending" | "active"> {
    throw new Error("CloudflareDns.certificateStatus: nincs implementálva — Cloudflare REST integráció az első éles domain-rendeléskor (ADR-0024).");
  }
}
