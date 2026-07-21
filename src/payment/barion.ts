// Barion gateway adapter — built to the Barion Smart Gateway v2 spec
// (docs.barion.com Payment-Start-v2 + Callback_mechanism + GetPaymentState-v2,
// researched 2026-07-21). Pilot flow = one-off pay-link per cycle (PaymentType
// "Immediate", GuestCheckOut) — NOT stored-card/MIT (that needs a separate Barion
// approval; later phase).
//
// SANDBOX-READY: point BARION_URL/BARION_PAY_URL at the test environment to run
// with test cards and no real money — the code is identical to production.
//   sandbox: BARION_URL=https://api.test.barion.com  BARION_PAY_URL=https://secure.test.barion.com
//   prod   : BARION_URL=https://api.barion.com        BARION_PAY_URL=https://secure.barion.com
// Required env: BARION_POSKEY (shop secret), BARION_PAYEE (shop Barion e-mail),
// PUBLIC_BASE_URL (absolute base for CallbackUrl/RedirectUrl — Barion validates).
//
// ⚠️ NOT yet validated against a live sandbox account — built to the documented
// spec; run the sandbox test pass (test cards) before flipping to production.

import type { PaymentGateway, PaymentRequest, PayLink, WebhookResult } from "./gateway.js";

const API = (process.env.BARION_URL ?? "https://api.barion.com").replace(/\/$/, "");
const PAY = (process.env.BARION_PAY_URL ?? "https://secure.barion.com").replace(/\/$/, "");

/** Barion PaymentStatus values (docs: PaymentStatus). */
const SUCCEEDED = "Succeeded";
const FAILED_STATES = new Set(["Canceled", "Expired", "Failed", "Rejected"]);

export class BarionGateway implements PaymentGateway {
  readonly name = "barion";
  private readonly posKey: string;
  private readonly payee: string;

  constructor(posKey = process.env.BARION_POSKEY ?? "", payee = process.env.BARION_PAYEE ?? "") {
    if (!posKey) {
      throw new Error(
        "BARION_POSKEY missing — set PAYMENT_GATEWAY=mock for local, or provide the " +
          "Barion POSKey (sandbox or production) to enable Barion.",
      );
    }
    if (!payee) {
      throw new Error("BARION_PAYEE missing — the shop's Barion account e-mail is required.");
    }
    this.posKey = posKey;
    this.payee = payee;
  }

  async createPayLink(req: PaymentRequest): Promise<PayLink> {
    const body = {
      POSKey: this.posKey,
      PaymentType: "Immediate",
      PaymentRequestId: req.paymentId,
      FundingSources: ["All"],
      GuestCheckOut: true,
      Currency: req.currency,
      Locale: "hu-HU",
      RedirectUrl: req.returnUrl,
      CallbackUrl: req.callbackUrl,
      Transactions: [
        {
          POSTransactionId: req.paymentId,
          Payee: this.payee,
          Total: req.amount,
          Comment: req.description,
          Items: [
            {
              Name: req.description,
              Description: req.description,
              Quantity: 1,
              Unit: "db",
              UnitPrice: req.amount,
              ItemTotal: req.amount,
            },
          ],
        },
      ],
    };
    const resp = await fetch(`${API}/v2/Payment/Start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as {
      PaymentId?: string;
      GatewayUrl?: string;
      Errors?: { ErrorCode?: string; Title?: string; Description?: string }[];
    };
    if (data.Errors && data.Errors.length) {
      const e = data.Errors[0]!;
      throw new Error(`Barion Start hiba: ${e.ErrorCode ?? "?"} — ${e.Title ?? e.Description ?? ""}`);
    }
    if (!data.PaymentId) throw new Error("Barion Start: hiányzó PaymentId a válaszból");
    const payUrl = data.GatewayUrl || `${PAY}/Pay?Id=${data.PaymentId}`;
    return { gatewayRef: data.PaymentId, payUrl };
  }

  async parseWebhook(params: Record<string, unknown>): Promise<WebhookResult | null> {
    // Barion's callback is only a PING carrying the paymentId — it does NOT contain
    // the status; GetPaymentState is mandatory to learn the real outcome.
    const paymentId =
      (typeof params.paymentId === "string" && params.paymentId) ||
      (typeof params.PaymentId === "string" && params.PaymentId) ||
      "";
    if (!paymentId) return null;

    const url = `${API}/v2/Payment/GetPaymentState?POSKey=${encodeURIComponent(
      this.posKey,
    )}&PaymentId=${encodeURIComponent(paymentId)}`;
    const resp = await fetch(url);
    const data = (await resp.json()) as { Status?: string; Errors?: unknown[] };
    const status = data.Status ?? "";
    if (status === SUCCEEDED) return { gatewayRef: paymentId, status: "paid" };
    if (FAILED_STATES.has(status)) return { gatewayRef: paymentId, status: "failed" };
    return null; // Prepared / Started / InProgress / Reserved / Authorized → not final
  }
}
