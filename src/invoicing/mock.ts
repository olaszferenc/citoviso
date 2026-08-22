// Mock invoice provider — issues a fake invoice number locally, no external call.
// Lets the paid → invoice path run end-to-end without a Számlázz.hu Agent key.
// Swap for SzamlazzAgent via INVOICE_PROVIDER=szamlazz once the key exists.

import { randomBytes } from "node:crypto";

import type { InvoiceInput, InvoiceProvider, InvoiceResult } from "./invoice.js";

export class MockInvoiceProvider implements InvoiceProvider {
  readonly name = "mock";

  async issueInvoice(input: InvoiceInput): Promise<InvoiceResult> {
    // VALIDATE WHAT THE REAL PROVIDER WOULD REJECT (0029). This mock used to
    // accept anything, which is precisely how the fabricated buyer survived for
    // months: name = a Google Maps marketing name, address fields = nulls from a
    // failed regex split, taxNumber = null — and the local run was always green
    // because nothing on this path ever looked. A mock that is more permissive
    // than production hides production bugs; this one refuses the same documents
    // Számlázz.hu would refuse.
    const b = input.buyer;
    const missing = (["name", "zip", "city", "address"] as const).filter((k) => !b[k]);
    if (missing.length) {
      throw new Error(
        `Hiányos vevő-adat a számlához: ${missing.join(", ")} — a Számlázz.hu is elutasítaná. ` +
          "(Számlázási nyilatkozat nélkül számlát nem állítunk ki.)",
      );
    }
    const net = input.items.reduce((s, i) => s + i.net, 0);
    const gross = input.items.reduce((s, i) => s + i.gross, 0);
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    // Log the tax identity: the one field whose absence silently broke every
    // company invoice, so it is visible in a local run without a debugger.
    console.log(
      `[invoice:mock] vevő: ${b.name} · ${b.zip} ${b.city}, ${b.address} · ` +
        `adószám: ${b.taxNumber ?? b.euVatNumber ?? "nincs (magánszemély)"} · ` +
        `áfakulcs: ${input.items[0]?.vatKey ?? "?"}`,
    );
    return {
      invoiceNumber: `MOCK-${input.issueDate.slice(0, 4)}-${suffix}`,
      net,
      gross,
    };
  }
}
