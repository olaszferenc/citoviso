// Registrar abstraction (ADR-0071). The domain purchase runs behind THIS interface
// so a mock adapter drives the whole beszerzés loop locally, and the real INWX
// adapter drops in unchanged once the account + keys exist (env REGISTRAR_PROVIDER=inwx).
//
// A domain purchase is REAL money and NOT returnable (🚪 one-way) — so the default
// is always the mock, and the live path is guarded by the registrar's own atomic
// check-and-register: if the domain was taken meanwhile, register() throws
// DomainTakenError and we surface it, never buying the wrong thing.

export interface DomainRegistration {
  /** The registrar's ORDER reference — the auto-renew switch is on the service, see getService(). */
  readonly registrarRef: string;
  /** End of the registration period (separate from the 24-month subscription commitment). */
  readonly registeredUntil: Date | null;
}

/**
 * Is the registrar ACCOUNT able to register a name right now? (ADR-0400, overseer.hu
 * 2026-10-22: the account's domain profile had NO identifier, so the registry request was
 * never filed — the money was taken, the row sat in `dns_pending`, and only a support mail
 * in the mailbox said why.) Measured BEFORE any purchase and hourly by the stall watch,
 * so the gap is found before a customer pays, not after.
 */
export interface RegistrarReadiness {
  readonly ok: boolean;
  /** Operator sentences: what is missing at the registrar (each one an action). */
  readonly problems: readonly string[];
  /** Measured facts worth seeing next to the verdict (credit, profile, identifier). */
  readonly facts: readonly string[];
}

/** The registrar account cannot register right now — nothing was ordered or charged. */
export class RegistrarNotReadyError extends Error {
  readonly problems: readonly string[];
  constructor(domain: string, problems: readonly string[]) {
    super(`a regisztrátor-fiók nem áll készen a(z) ${domain} regisztrálására: ${problems.join("; ")}`);
    this.name = "RegistrarNotReadyError";
    this.problems = problems;
  }
}

export interface RegistrarAdapter {
  readonly name: string;
  /**
   * The account-level pre-flight (see RegistrarReadiness). register() MUST run it first
   * and throw RegistrarNotReadyError on a problem — never order with a broken profile.
   */
  readiness(): Promise<RegistrarReadiness>;
  /**
   * Authoritative availability + registrability AT THE REGISTRAR. Distinct from
   * domains.ts::checkAvailability, which is only a cheap preliminary (DNS + RDAP).
   */
  isAvailable(domain: string): Promise<boolean>;
  /**
   * Yearly registration price in EUR (ADR-0093). Feeds the operator-set price cap
   * that guards the zero-touch purchase: a premium domain (potentially thousands
   * of EUR) must never be bought unseen. INWX prices in EUR, so the cap and this
   * quote share a currency and the guard needs no FX. MUST throw when the price
   * cannot be determined — an unknown price is a blocked purchase, not a free pass
   * (the missing-data branch fails loud, §B.17).
   */
  getYearlyPriceEur(domain: string): Promise<number>;
  /**
   * ADR-0360 ③: the yearly NET registration price in the REGISTRAR's own currency — the
   * per-ending cap (domain_tld.max_cost) is compared with this in the same currency, no FX.
   * MUST throw when the price cannot be determined (no price, no buy — §B.17).
   */
  getYearlyNetPrice(domain: string): Promise<{ readonly amount: number; readonly currency: string }>;
  /**
   * Atomic check-and-register for `years`. The security is HERE, not in a human
   * approval: if the domain was taken between the pre-check and this call, it
   * throws DomainTakenError instead of charging for nothing.
   */
  register(domain: string, opts: { readonly years: number }): Promise<DomainRegistration>;
  /** Delegate the domain's authoritative nameservers to our DNS (Cloudflare). */
  setNameservers(domain: string, nameservers: readonly string[]): Promise<void>;
  /**
   * The name's service in OUR registrar account (ADR-XXXX): the real expiry and the
   * auto-renew switch as the registrar holds them. null = the name is not (or no longer)
   * in the account. Read-only.
   */
  getService(domain: string): Promise<DomainService | null>;
  /**
   * Flip the auto-renew switch on the service (renewal is paid from the account credit
   * before expiry). Returns the service as the registrar answers AFTER the change; throws
   * when the registrar refuses or does not confirm the wanted state.
   */
  setAutoRenew(serviceRef: string, on: boolean): Promise<DomainService>;
  /** The account's credit in the registrar's currency (renewals are paid from it); null = unknown. */
  accountCredit(): Promise<number | null>;
}

/** A registered name as our registrar account holds it (ADR-XXXX). */
export interface DomainService {
  readonly serviceRef: string;
  readonly domain: string;
  readonly expiresAt: Date | null;
  readonly autoRenew: boolean;
  /** The yearly renewal price in the registrar's currency (net); null = unknown. */
  readonly renewalPrice: number | null;
}

/** The domain was registrable at pre-check but taken by the time we tried to buy it. */
export class DomainTakenError extends Error {
  constructor(domain: string) {
    super(`domain már foglalt: ${domain}`);
    this.name = "DomainTakenError";
  }
}
