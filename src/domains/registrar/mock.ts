// Mock registrar — runs the whole beszerzés loop locally without buying anything.
// It mirrors the real shape so provisionDomain.ts is exercised end-to-end: a domain
// whose label contains "taken" behaves as already-registered (so DomainTakenError
// and the failed-path are testable); everything else "registers" deterministically.

import type { DomainRegistration, RegistrarAdapter } from "./registrar.js";
import { DomainTakenError } from "./registrar.js";

export class MockRegistrar implements RegistrarAdapter {
  readonly name = "mock";

  async isAvailable(domain: string): Promise<boolean> {
    return !/taken/i.test(domain);
  }

  async register(domain: string, opts: { readonly years: number }): Promise<DomainRegistration> {
    if (/taken/i.test(domain)) throw new DomainTakenError(domain);
    const until = new Date();
    until.setFullYear(until.getFullYear() + opts.years);
    return { registrarRef: `mock-reg:${domain}`, registeredUntil: until };
  }

  async setNameservers(_domain: string, _nameservers: readonly string[]): Promise<void> {
    // no-op: the mock DNS zone is authoritative on its own.
  }
}
