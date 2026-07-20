// Invoice provider selector — INVOICE_PROVIDER env picks the adapter. Defaults to
// mock so the paid → invoice path runs locally without a key. Set to "szamlazz"
// (with SZAMLAZZ_AGENT_KEY) to issue real Számlázz.hu Számla Agent invoices.

import type { InvoiceProvider } from "./invoice.js";
import { MockInvoiceProvider } from "./mock.js";
import { SzamlazzAgent } from "./szamlazz.js";

let cached: InvoiceProvider | null = null;

export function getInvoiceProvider(): InvoiceProvider {
  if (cached) return cached;
  const which = (process.env.INVOICE_PROVIDER ?? "mock").toLowerCase();
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
