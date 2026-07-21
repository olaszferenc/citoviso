// Gateway selector — PAYMENT_GATEWAY env picks the adapter. Defaults to the mock
// so the whole loop runs locally without keys. The Barion adapter is a stub until
// the account + keys exist; building it needs a live account to validate the
// webhook signature + exact /Payment/Start shape (see RESEARCH-2026-07-billing).

import type { PaymentGateway } from "./gateway.js";
import { BarionGateway } from "./barion.js";
import { MockGateway } from "./mock.js";

let cached: PaymentGateway | null = null;

export function getGateway(): PaymentGateway {
  if (cached) return cached;
  const which = (process.env.PAYMENT_GATEWAY ?? "mock").toLowerCase();
  // BarionGateway throws in its constructor if POSKey/Payee are missing — that's
  // intentional: PAYMENT_GATEWAY=barion means "use Barion", so a missing key is a
  // misconfiguration, not a silent fallback to mock.
  cached = which === "barion" ? new BarionGateway() : new MockGateway();
  return cached;
}

export type { PaymentGateway, PaymentRequest, PayLink, WebhookResult } from "./gateway.js";
