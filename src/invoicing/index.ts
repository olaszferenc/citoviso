// Invoice provider selector — INVOICE_PROVIDER env picks the adapter. Defaults to
// mock so the paid → invoice path runs locally without a key. Set to "szamlazz"
// (with SZAMLAZZ_AGENT_KEY) to issue real Számlázz.hu Számla Agent invoices.

import type { InvoiceProvider } from "./invoice.js";
import { assertInvoiceKeyAllowed } from "./keyGuard.js";
import { MockInvoiceProvider } from "./mock.js";
import { SzamlazzAgent } from "./szamlazz.js";

let cached: InvoiceProvider | null = null;

export function getInvoiceProvider(): InvoiceProvider {
  if (cached) return cached;
  const which = (process.env.INVOICE_PROVIDER ?? "mock").toLowerCase();
  if (which === "szamlazz") {
    // ⛔ Fail-closed: a test-mode (denylisted) Agent key must never serve the
    // live host — see keyGuard.ts for the owner ruling and the failure mode.
    assertInvoiceKeyAllowed({
      agentKey: process.env.SZAMLAZZ_AGENT_KEY ?? "",
      publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "",
      demo: process.env.SZAMLAZZ_DEMO === "1",
    });
  }
  cached = which === "szamlazz" ? new SzamlazzAgent() : new MockInvoiceProvider();
  return cached;
}

export type {
  InvoiceProvider,
  InvoiceInput,
  InvoiceItem,
  InvoiceBuyer,
  InvoiceResult,
} from "./invoice.js";
