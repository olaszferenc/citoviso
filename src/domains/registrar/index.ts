// Registrar selector — REGISTRAR_PROVIDER env picks the adapter. Defaults to the
// mock so the whole beszerzés loop runs locally without buying a real domain.

import { config } from "../../config.js";
import type { RegistrarAdapter } from "./registrar.js";
import { InwxRegistrar } from "./inwx.js";
import { MockRegistrar } from "./mock.js";

let cached: RegistrarAdapter | null = null;

export function getRegistrar(): RegistrarAdapter {
  if (cached) return cached;
  const which = config.domains.registrarProvider.toLowerCase();
  cached =
    which === "inwx"
      ? new InwxRegistrar(config.domains.inwx.user, config.domains.inwx.password)
      : new MockRegistrar();
  return cached;
}

export type { RegistrarAdapter, DomainRegistration } from "./registrar.js";
export { DomainTakenError } from "./registrar.js";
