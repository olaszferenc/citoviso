// DNS selector — DNS_PROVIDER env picks the adapter. Defaults to the mock so the
// whole beszerzés loop runs locally without touching Cloudflare.

import { config } from "../../config.js";
import type { DnsAdapter } from "./dns.js";
import { CloudflareDns } from "./cloudflare.js";
import { MockDns } from "./mock.js";
import { WebsupportDns } from "./websupport.js";

let cached: DnsAdapter | null = null;

export function getDns(): DnsAdapter {
  if (cached) return cached;
  const which = config.domains.dnsProvider.toLowerCase();
  cached =
    which === "websupport"
      ? new WebsupportDns({
          apiKey: config.domains.websupport.apiKey,
          apiSecret: config.domains.websupport.apiSecret,
          userId: config.domains.websupport.userId,
        })
      : which === "cloudflare"
        ? new CloudflareDns(config.domains.cloudflare.apiToken, config.domains.cloudflare.accountId)
        : new MockDns();
  return cached;
}

export type { DnsAdapter, ZoneCreation } from "./dns.js";
