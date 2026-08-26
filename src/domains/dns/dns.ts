// DNS + TLS abstraction (ADR-0071). For a domain we register through INWX, the
// zero-touch path is: create an authoritative Cloudflare zone → set the registrar's
// nameservers to the ones Cloudflare assigns → point apex + www at our server →
// wait for the zone to activate → wait for Universal SSL. Env DNS_PROVIDER=cloudflare
// selects the real adapter; the mock returns "active" immediately so the loop
// completes locally in one pass.

export interface ZoneCreation {
  /** The provider's zone reference (Cloudflare zone id). */
  readonly zoneRef: string;
  /** The nameservers to set at the registrar so this zone becomes authoritative. */
  readonly nameservers: string[];
}

export interface DnsAdapter {
  readonly name: string;
  /** Create an authoritative zone for a domain we control; returns the NS to delegate to. */
  createZone(domain: string): Promise<ZoneCreation>;
  /** Point apex + www at our public server (A record on apex, CNAME/A on www). */
  pointToServer(domain: string, serverIp: string): Promise<void>;
  /** NS-delegation / zone activation status (propagation can take minutes). */
  zoneStatus(domain: string): Promise<"pending" | "active">;
  /** Universal-SSL certificate status for the hostname (issued after zone active). */
  certificateStatus(domain: string): Promise<"pending" | "active">;
}
