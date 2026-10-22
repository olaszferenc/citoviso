// Registrar selector — REGISTRAR_PROVIDER env picks the adapter. Defaults to the
// mock so the whole beszerzés loop runs locally without buying a real domain.

import { config } from "../../config.js";
import type { RegistrarAdapter, RegistrarReadiness } from "./registrar.js";
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

let readinessMemo: { at: number; value: RegistrarReadiness } | null = null;

/**
 * The account pre-flight, memoized for `maxAgeMs` (the 2-minute resume timer and the
 * hourly stall watch both ask; two GETs per ask). Only a LIVE registrar is asked — the mock
 * answers from its test hook, instantly. Pass maxAgeMs=0 for a fresh measurement.
 */
export async function registrarReadiness(maxAgeMs = 10 * 60_000): Promise<RegistrarReadiness> {
  const now = Date.now();
  if (readinessMemo && now - readinessMemo.at < maxAgeMs) return readinessMemo.value;
  const value = await getRegistrar().readiness();
  readinessMemo = { at: now, value };
  return value;
}

export type { RegistrarAdapter, DomainRegistration, RegistrarReadiness } from "./registrar.js";
export { DomainTakenError, RegistrarNotReadyError } from "./registrar.js";
