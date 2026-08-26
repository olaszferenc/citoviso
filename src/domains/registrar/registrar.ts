// Registrar abstraction (ADR-0071). The domain purchase runs behind THIS interface
// so a mock adapter drives the whole beszerzés loop locally, and the real INWX
// adapter drops in unchanged once the account + keys exist (env REGISTRAR_PROVIDER=inwx).
//
// A domain purchase is REAL money and NOT returnable (🚪 one-way) — so the default
// is always the mock, and the live path is guarded by the registrar's own atomic
// check-and-register: if the domain was taken meanwhile, register() throws
// DomainTakenError and we surface it, never buying the wrong thing.

export interface DomainRegistration {
  /** The registrar's reference (INWX order/roId) — kept for auto-renew + ownership transfer. */
  readonly registrarRef: string;
  /** End of the registration period (separate from the 24-month subscription commitment). */
  readonly registeredUntil: Date | null;
}

export interface RegistrarAdapter {
  readonly name: string;
  /**
   * Authoritative availability + registrability AT THE REGISTRAR. Distinct from
   * domains.ts::checkAvailability, which is only a cheap preliminary (DNS + RDAP).
   */
  isAvailable(domain: string): Promise<boolean>;
  /**
   * Atomic check-and-register for `years`. The security is HERE, not in a human
   * approval: if the domain was taken between the pre-check and this call, it
   * throws DomainTakenError instead of charging for nothing.
   */
  register(domain: string, opts: { readonly years: number }): Promise<DomainRegistration>;
  /** Delegate the domain's authoritative nameservers to our DNS (Cloudflare). */
  setNameservers(domain: string, nameservers: readonly string[]): Promise<void>;
}

/** The domain was registrable at pre-check but taken by the time we tried to buy it. */
export class DomainTakenError extends Error {
  constructor(domain: string) {
    super(`domain már foglalt: ${domain}`);
    this.name = "DomainTakenError";
  }
}
