// Invoicing abstraction (Slice 3 — the financial end of the loop). On a paid
// payment we issue an invoice via THIS interface, so a mock runs locally and the
// real Számlázz.hu Számla Agent adapter drops in once the account's Agent key
// exists (env SZAMLAZZ_AGENT_KEY). Same "build behind an interface" pattern as
// the payment gateway.
//
// Tax: the pilot seller is a Hungarian egyéni vállalkozó under AAM (alanyi
// adómentesség) → invoices are VAT-EXEMPT. The line vatKey is "AAM" and vatRate
// is 0 NOW; the invoice carries vat PER DOCUMENT (RESEARCH-2026-07 decision), so
// crossing the AAM threshold or converting to KFT just flips future vatKey/rate.

export interface InvoiceBuyer {
  readonly name: string;
  readonly email: string | null;
  /** Best-effort address parts; the buyer address is completed at checkout later. */
  readonly zip: string | null;
  readonly city: string | null;
  readonly address: string | null;
  readonly taxNumber: string | null;
}

export interface InvoiceItem {
  readonly name: string;
  readonly quantity: number;
  readonly unitNet: number;
  /** Számlázz.hu áfakulcs: "AAM" for alanyi adómentes (VAT-exempt). */
  readonly vatKey: string;
  readonly net: number;
  readonly vat: number;
  readonly gross: number;
}

export interface InvoiceInput {
  readonly buyer: InvoiceBuyer;
  readonly items: readonly InvoiceItem[];
  readonly currency: string;
  /** ISO dates (YYYY-MM-DD). */
  readonly issueDate: string;
  readonly fulfillmentDate: string;
  readonly dueDate: string;
  /** Payment method label (e.g. "Bankkártya"). */
  readonly paymentMethod: string;
  /** Already-paid flag → the invoice is marked settled. */
  readonly paid: boolean;
  readonly comment?: string;
}

export interface InvoiceResult {
  readonly invoiceNumber: string;
  readonly net: number;
  readonly gross: number;
  /** base64 PDF if requested/available. */
  readonly pdfBase64?: string;
}

export interface InvoiceProvider {
  readonly name: string;
  issueInvoice(input: InvoiceInput): Promise<InvoiceResult>;
}
