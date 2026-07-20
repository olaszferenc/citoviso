// Mock invoice provider — issues a fake invoice number locally, no external call.
// Lets the paid → invoice path run end-to-end without a Számlázz.hu Agent key.
// Swap for SzamlazzAgent via INVOICE_PROVIDER=szamlazz once the key exists.

import { randomBytes } from "node:crypto";

import type { InvoiceInput, InvoiceProvider, InvoiceResult } from "./invoice.js";

export class MockInvoiceProvider implements InvoiceProvider {
  readonly name = "mock";

  async issueInvoice(input: InvoiceInput): Promise<InvoiceResult> {
    const net = input.items.reduce((s, i) => s + i.net, 0);
    const gross = input.items.reduce((s, i) => s + i.gross, 0);
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    return {
      invoiceNumber: `MOCK-${input.issueDate.slice(0, 4)}-${suffix}`,
      net,
      gross,
    };
  }
}
