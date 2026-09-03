// INWX registrar adapter (ADR-0024 / ADR-0071). INWX is an ICANN registrar with a
// full JSON-RPC purchase API and real-time .hu registration (most API registrars
// cannot do .hu). Env REGISTRAR_PROVIDER=inwx selects it.
//
// STUB, deliberately: like the Barion gateway stub, this is NOT implemented against
// a fabricated API shape. ADR-0024 fixes the integration trigger as "the first
// custom-domain order" — building and validating the JSON-RPC calls (domain.check,
// domain.create, nameserver assignment, the OT&E test endpoint) needs the live
// account, and §B.17 forbids shipping an untested integration as if it worked.
// The constructor throws on missing creds so REGISTRAR_PROVIDER=inwx can never
// silently fall back to the mock (a misconfiguration, not a default).

import type { DomainRegistration, RegistrarAdapter } from "./registrar.js";

export class InwxRegistrar implements RegistrarAdapter {
  readonly name = "inwx";
  #user: string;
  #password: string;

  constructor(user: string, password: string) {
    if (!user || !password) {
      throw new Error(
        "REGISTRAR_PROVIDER=inwx, de INWX_USER/INWX_PASSWORD hiányzik — állítsd be a kulcsokat, vagy maradj REGISTRAR_PROVIDER=mock lokálban.",
      );
    }
    this.#user = user;
    this.#password = password;
  }

  async isAvailable(_domain: string): Promise<boolean> {
    throw new Error("InwxRegistrar.isAvailable: nincs implementálva — INWX JSON-RPC integráció az első éles domain-rendeléskor (ADR-0024).");
  }

  async getYearlyPriceEur(_domain: string): Promise<number> {
    // Throwing here keeps the ADR-0093 cap guard fail-closed: no price, no buy.
    throw new Error("InwxRegistrar.getYearlyPriceEur: nincs implementálva — INWX JSON-RPC integráció az első éles domain-rendeléskor (ADR-0024).");
  }

  async register(_domain: string, _opts: { readonly years: number }): Promise<DomainRegistration> {
    throw new Error("InwxRegistrar.register: nincs implementálva — INWX JSON-RPC integráció az első éles domain-rendeléskor (ADR-0024).");
  }

  async setNameservers(_domain: string, _nameservers: readonly string[]): Promise<void> {
    throw new Error("InwxRegistrar.setNameservers: nincs implementálva — INWX JSON-RPC integráció az első éles domain-rendeléskor (ADR-0024).");
  }
}
