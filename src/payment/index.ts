// Gateway selector — PAYMENT_GATEWAY env picks the adapter. Defaults to the mock
// so the whole loop runs locally without keys. The Barion adapter is a stub until
// the account + keys exist; building it needs a live account to validate the
// webhook signature + exact /Payment/Start shape (see RESEARCH-2026-07-billing).

import type { PaymentGateway } from "./gateway.js";
import { BarionGateway } from "./barion.js";
import { MockGateway } from "./mock.js";

let cached: PaymentGateway | null = null;

/** The configured gateway's name WITHOUT constructing it (no key check). */
export function configuredGatewayName(): "barion" | "mock" {
  return (process.env.PAYMENT_GATEWAY ?? "mock").toLowerCase() === "barion" ? "barion" : "mock";
}

/**
 * Elek IT G1 (2026-10-11): may the /pay/mock pages (and their "mark paid" buttons) answer?
 * Only where no real money can be involved: the mock gateway, or Barion pointed at its TEST
 * environment (the dev box runs PAYMENT_GATEWAY=barion against api.test.barion.com, and its
 * gates and Elek's walks pay `mock_` rows on that same process). Against LIVE Barion — prod:
 * barion, no BARION_URL → api.barion.com — they do not exist (404).
 */
export function mockPayRoutesEnabled(): boolean {
  if (configuredGatewayName() === "mock") return true;
  return /^https:\/\/api\.test\.barion\.com\/?$/i.test(process.env.BARION_URL ?? "");
}

export function getGateway(): PaymentGateway {
  if (cached) return cached;
  const which = configuredGatewayName();
  // BarionGateway throws in its constructor if POSKey/Payee are missing — that's
  // intentional: PAYMENT_GATEWAY=barion means "use Barion", so a missing key is a
  // misconfiguration, not a silent fallback to mock.
  cached = which === "barion" ? new BarionGateway() : new MockGateway();
  return cached;
}

export type { PaymentGateway, PaymentRequest, PayLink, WebhookResult } from "./gateway.js";
