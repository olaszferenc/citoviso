// Mock DNS/TLS — drives the whole beszerzés loop locally without touching Cloudflare.
// Returns "active" immediately so provisionDomain.ts runs pending → live in one pass;
// a domain whose label contains "dnsfail" stays "pending" so the tls-timeout / retry
// path stays testable.

import type { DnsAdapter, ZoneCreation } from "./dns.js";

export class MockDns implements DnsAdapter {
  readonly name = "mock";

  async createZone(domain: string): Promise<ZoneCreation> {
    return {
      zoneRef: `mock-zone:${domain}`,
      nameservers: ["ns1.mock-cloudflare.test", "ns2.mock-cloudflare.test"],
    };
  }

  async pointToServer(_domain: string, _serverIp: string): Promise<void> {
    // no-op locally.
  }

  async zoneStatus(domain: string): Promise<"pending" | "active"> {
    return /dnsfail/i.test(domain) ? "pending" : "active";
  }

  async certificateStatus(domain: string): Promise<"pending" | "active"> {
    return /dnsfail/i.test(domain) ? "pending" : "active";
  }

  /** TXT records "written" locally (the Search Console tick's dev path reads them back). */
  readonly txt = new Map<string, Set<string>>();

  async ensureApexTxt(domain: string, content: string): Promise<void> {
    if (/dnsfail/i.test(domain)) throw new Error(`mock DNS: a(z) ${domain} zónája nem írható`);
    const set = this.txt.get(domain) ?? new Set<string>();
    set.add(content);
    this.txt.set(domain, set);
  }
}
