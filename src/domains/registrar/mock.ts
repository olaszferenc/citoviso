// Mock registrar — runs the whole beszerzés loop locally without buying anything.
// It mirrors the real shape so provisionDomain.ts is exercised end-to-end: a domain
// whose label contains "taken" behaves as already-registered (so DomainTakenError
// and the failed-path are testable); everything else "registers" deterministically.

import type { DomainRegistration, RegistrarAdapter } from "./registrar.js";
import { DomainTakenError } from "./registrar.js";

export class MockRegistrar implements RegistrarAdapter {
  readonly name = "mock";

  /**
   * Test hooks for the single-flight guard (2026-10-21, overseer.hu): a SLOW purchase, so a
   * second run can arrive while the first is still at the registrar, and the live registrar's
   * refusal of a second order for the same name — Websupport answers HTTP 500
   * „[OrderAddError] Duplicate order, found <domain> (43) in order <id>" — which
   * provisionDomain.ts must read as "our own order already exists", never as "taken".
   * Both are OFF by default: every other guard sees the instant, forgiving mock.
   */
  static delayMs = 0;
  static refuseDuplicateOrders = false;
  static readonly #placedOrders = new Map<string, number>();
  static resetOrders(): void {
    MockRegistrar.#placedOrders.clear();
  }

  async isAvailable(domain: string): Promise<boolean> {
    return !/taken/i.test(domain);
  }

  // A label containing "premium" quotes way above any sane cap, so the ADR-0093
  // price guard's blocking path is exercisable locally; everything else is a
  // typical standard registration price.
  async getYearlyPriceEur(domain: string): Promise<number> {
    return /premium/i.test(domain) ? 499 : 12;
  }

  /** ADR-0360 ③: HUF like the live registrar; "premium" names are far above any cap. */
  async getYearlyNetPrice(domain: string): Promise<{ readonly amount: number; readonly currency: string }> {
    return { amount: /premium/i.test(domain) ? 199_000 : 1990, currency: "HUF" };
  }

  async register(domain: string, opts: { readonly years: number }): Promise<DomainRegistration> {
    if (/taken/i.test(domain)) throw new DomainTakenError(domain);
    if (MockRegistrar.refuseDuplicateOrders) {
      const prior = MockRegistrar.#placedOrders.get(domain);
      if (prior !== undefined) {
        throw new Error(
          `Mock POST /v1/user/0/order: HTTP 500 — [OrderAddError] Duplicate order, found ${domain} (43) in order ${prior}`,
        );
      }
      MockRegistrar.#placedOrders.set(domain, 22790000 + MockRegistrar.#placedOrders.size + 1);
    }
    if (MockRegistrar.delayMs > 0) await new Promise((r) => setTimeout(r, MockRegistrar.delayMs));
    const until = new Date();
    until.setFullYear(until.getFullYear() + opts.years);
    return { registrarRef: `mock-reg:${domain}`, registeredUntil: until };
  }

  async setNameservers(_domain: string, _nameservers: readonly string[]): Promise<void> {
    // no-op: the mock DNS zone is authoritative on its own.
  }
}
