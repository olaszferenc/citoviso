// Gateway selector — PAYMENT_GATEWAY env picks the adapter. Defaults to the mock
// so the whole loop runs locally without keys. The Barion adapter is a stub until
// the account + keys exist; building it needs a live account to validate the
// webhook signature + exact /Payment/Start shape (see RESEARCH-2026-07-billing).

import type { PaymentGateway } from "./gateway.js";
import { MockGateway } from "./mock.js";

let cached: PaymentGateway | null = null;

class BarionGatewayStub implements PaymentGateway {
  readonly name = "barion";
  async createPayLink(): Promise<never> {
    throw new Error(
      "Barion gateway not configured yet — set PAYMENT_GATEWAY=mock for the pilot, " +
        "or implement src/payment/barion.ts once the Barion account + POSKey exist.",
    );
  }
  parseWebhook(): null {
    return null;
  }
}

export function getGateway(): PaymentGateway {
  if (cached) return cached;
  const which = (process.env.PAYMENT_GATEWAY ?? "mock").toLowerCase();
  cached = which === "barion" ? new BarionGatewayStub() : new MockGateway();
  return cached;
}

export type { PaymentGateway, PaymentRequest, PayLink, WebhookResult } from "./gateway.js";
