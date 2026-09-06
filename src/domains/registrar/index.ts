// Registrar selector — REGISTRAR_PROVIDER env picks the adapter. Defaults to the
// mock so the whole beszerzés loop runs locally without buying a real domain.

import { config } from "../../config.js";
import type { RegistrarAdapter } from "./registrar.js";
import { InwxRegistrar } from "./inwx.js";
import { MockRegistrar } from "./mock.js";
import { WebsupportRegistrar } from "./websupport.js";

let cached: RegistrarAdapter | null = null;

/**
 * Providers that buy REAL domains for REAL money. Kept here (not spelled out at each call
 * site) so adding a registrar can never leave a "is this the live path?" check behind:
 * that exact drift made isMockDomainProvisioning() answer `mock` for websupport.
 */
export const LIVE_REGISTRAR_PROVIDERS: readonly string[] = ["websupport", "inwx"];

export function getRegistrar(): RegistrarAdapter {
  if (cached) return cached;
  const which = config.domains.registrarProvider.toLowerCase();
  cached =
    which === "websupport"
      ? new WebsupportRegistrar({
          apiKey: config.domains.websupport.apiKey,
          apiSecret: config.domains.websupport.apiSecret,
          userId: config.domains.websupport.userId,
          expectedRegistrant: config.domains.websupport.expectedRegistrant,
          hufPerEur: config.domains.hufPerEur,
        })
      : which === "inwx"
        ? new InwxRegistrar(config.domains.inwx.user, config.domains.inwx.password)
        : new MockRegistrar();
  return cached;
}

export type { RegistrarAdapter, DomainRegistration } from "./registrar.js";
export { DomainTakenError } from "./registrar.js";
