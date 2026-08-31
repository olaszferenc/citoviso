// Számlázz.hu Számla Agent adapter — built to the official XML spec
// (docs.szamlazz.hu/agent/generating_invoice/xml + /response, fetched 2026-07-20):
//
//   POST multipart/form-data to https://www.szamlazz.hu/szamla/
//   field: action-xmlagentxmlfile = the xmlszamla XML
//   auth : <beallitasok><szamlaagentkulcs>KEY</szamlaagentkulcs>
//   AAM  : <tetel><afakulcs>AAM</afakulcs>  (afaErtek 0; netto = brutto)
//   resp : valaszVerzio=2 → <xmlszamlavalasz><sikeres>true</sikeres>
//          <szamlaszam>…</szamlaszam> | <hibakod>/<hibauzenet>; also header
//          szlahu_szamlaszam / szlahu_error_code.
//
// STATUS (corrected 2026-08-22 — the previous note here said "NOT validated
// against a live account (no key here)", which was STALE and actively misleading):
//
//   ✅ VALIDATED against the owner's Számlázz.hu TEST ACCOUNT on 2026-07-21.
//      A full A–Z round went through — Barion sandbox card payment → paid →
//      site live → real AAM test invoice **OV-2026-2** issued through THIS
//      adapter. The wire format works; SZAMLAZZ_AGENT_KEY is present in .env.
//      (Our DB row for it was removed by the 2026-08-20 test-data purge; the
//      document itself still exists in the Számlázz account.)
//
//   ⚠️ INVOICE_PROVIDER is deliberately kept at 'mock' so a local run cannot
//      mint another real document by accident. Flipping it to 'szamlazz' issues
//      REAL invoices in that account.
//
//   ⛔ BUT: every invoice issued before 0029 — OV-2026-2 included — carries a
//      FABRICATED buyer (lead.name as the legal name, a regex-split address, and
//      NO tax number), because that is what the caller passed. The adapter was
//      correct; its input was not. Re-check those documents before treating any
//      of them as a template for what "good" looks like.

import type { InvoiceInput, InvoiceProvider, InvoiceResult } from "./invoice.js";

const ENDPOINT = process.env.SZAMLAZZ_URL ?? "https://www.szamlazz.hu/szamla/";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function t(name: string, value: string | number): string {
  return `<${name}>${esc(String(value))}</${name}>`;
}
function num(n: number): string {
  // Számlázz accepts dot-decimal; keep integers clean.
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
function pick(m: RegExpExecArray | null): string | null {
  return m ? m[1]!.trim() : null;
}

export class SzamlazzAgent implements InvoiceProvider {
  readonly name = "szamlazz";
  private readonly key: string;

  constructor(key = process.env.SZAMLAZZ_AGENT_KEY ?? "") {
    if (!key) {
      throw new Error(
        "SZAMLAZZ_AGENT_KEY missing — set INVOICE_PROVIDER=mock for the pilot, " +
          "or provide the Számla Agent key to enable real invoicing.",
      );
    }
    this.key = key;
  }

  private buildXml(input: InvoiceInput): string {
    const b = input.buyer;
    const items = input.items
      .map(
        (i) =>
          "<tetel>" +
          t("megnevezes", i.name) +
          t("mennyiseg", num(i.quantity)) +
          t("mennyisegiEgyseg", "db") +
          t("nettoEgysegar", num(i.unitNet)) +
          t("afakulcs", i.vatKey) +
          t("nettoErtek", num(i.net)) +
          t("afaErtek", num(i.vat)) +
          t("bruttoErtek", num(i.gross)) +
          "</tetel>",
      )
      .join("");
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla ' +
      'https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">' +
      "<beallitasok>" +
      t("szamlaagentkulcs", this.key) +
      t("eszamla", "false") +
      // ASK FOR THE PDF (0029). This was hardcoded 'false', so we never received
      // the document at all — no invoice could be stored, shown to the buyer or
      // handed to an accountant. The response PDF lands in InvoiceResult.pdfBase64.
      t("szamlaLetoltes", "true") +
      t("valaszVerzio", "2") +
      "</beallitasok>" +
      "<fejlec>" +
      t("keltDatum", input.issueDate) +
      t("teljesitesDatum", input.fulfillmentDate) +
      t("fizetesiHataridoDatum", input.dueDate) +
      t("fizmod", input.paymentMethod) +
      t("penznem", input.currency) +
      t("szamlaNyelve", "hu") +
      (input.comment ? t("megjegyzes", input.comment) : "") +
      t("fizetve", input.paid ? "true" : "false") +
      "</fejlec>" +
      "<elado></elado>" +
      "<vevo>" +
      t("nev", b.name) +
      // Country is required once the buyer is not domestic (reverse charge cases).
      (b.country && b.country.toUpperCase() !== "HU" ? t("orszag", b.country) : "") +
      t("irsz", b.zip ?? "") +
      t("telepules", b.city ?? "") +
      t("cim", b.address ?? "") +
      (b.email ? t("email", b.email) : "") +
      (b.email ? t("sendEmail", "false") : "") +
      // Domestic company ⇒ adószám; foreign EU company ⇒ közösségi adószám.
      // Both are now real values from the checkout declaration (0029) rather than
      // the hardcoded null this adapter used to be fed.
      (b.taxNumber ? t("adoszam", b.taxNumber) : "") +
      (b.euVatNumber ? t("adoszamEU", b.euVatNumber) : "") +
      "</vevo>" +
      "<tetelek>" +
      items +
      "</tetelek>" +
      "</xmlszamla>"
    );
  }

  async issueInvoice(input: InvoiceInput): Promise<InvoiceResult> {
    const xml = this.buildXml(input);
    const form = new FormData();
    form.append(
      "action-xmlagentxmlfile",
      new Blob([xml], { type: "text/xml" }),
      "szamla.xml",
    );
    const resp = await fetch(ENDPOINT, { method: "POST", body: form });
    const errCode = resp.headers.get("szlahu_error_code");
    const body = await resp.text();

    if (errCode) {
      const msg = resp.headers.get("szlahu_error") ?? "";
      throw new Error(`Számlázz error ${errCode}: ${decodeURIComponent(msg)}`);
    }
    const ok = /<sikeres>\s*true\s*<\/sikeres>/i.test(body);
    if (!ok) {
      const code = pick(/<hibakod>([\s\S]*?)<\/hibakod>/i.exec(body));
      const hmsg = pick(/<hibauzenet>([\s\S]*?)<\/hibauzenet>/i.exec(body));
      throw new Error(`Számlázz sikertelen (${code ?? "?"}): ${hmsg ?? "ismeretlen hiba"}`);
    }
    const invoiceNumber =
      pick(/<szamlaszam>([\s\S]*?)<\/szamlaszam>/i.exec(body)) ??
      (resp.headers.get("szlahu_szamlaszam")
        ? decodeURIComponent(resp.headers.get("szlahu_szamlaszam")!)
        : "");
    const net = Number(pick(/<szamlanetto>([\s\S]*?)<\/szamlanetto>/i.exec(body)) ?? "0");
    const gross = Number(pick(/<szamlabrutto>([\s\S]*?)<\/szamlabrutto>/i.exec(body)) ?? "0");
    const pdf = pick(/<pdf>([\s\S]*?)<\/pdf>/i.exec(body)) ?? undefined;
    return { invoiceNumber, net, gross, pdfBase64: pdf };
  }
}

/**
 * Re-download an ALREADY ISSUED invoice's PDF by its number (ADR-0086).
 *
 * Why this exists: the bizonylat's system of record is Számlázz.hu — our
 * `invoice.pdf_base64` is a copy. If that copy is missing (issued before 0030
 * turned `szamlaLetoltes` on, or the provider returned no document that time),
 * the tenant would see a row with no PDF forever. This is the cheap repair path.
 *
 * ⚠️ READ-ONLY at Számlázz: querying a PDF issues NOTHING. Safe to call even
 * while INVOICE_PROVIDER=mock — but the CALLER must only pass numbers that were
 * really issued there (i.e. rows with provider='szamlazz'); a 'MOCK-…' number
 * would just produce an error response.
 *
 * Spec (docs.szamlazz.hu/agent/querying_pdf, fetched 2026-08-31):
 *   POST multipart/form-data to https://www.szamlazz.hu/szamla/
 *   field: action-szamla_agent_pdf = the xmlszamlapdf XML
 *   valaszVerzio=2 → XML answer carrying the PDF base64 in <pdf>
 *
 * Returns the base64 PDF, or null when it could not be fetched (reason logged).
 * Never throws: this is a repair path — a failed repair must not break the page
 * the tenant is looking at.
 */
export async function fetchIssuedInvoicePdf(invoiceNumber: string): Promise<string | null> {
  const key = process.env.SZAMLAZZ_AGENT_KEY ?? "";
  if (!key) {
    console.warn(`[szamlazz] ${invoiceNumber}: nincs SZAMLAZZ_AGENT_KEY — PDF-pótlás kihagyva`);
    return null;
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlapdf ` +
    `https://www.szamlazz.hu/szamla/docs/xsds/agentpdf/xmlszamlapdf.xsd">` +
    `<szamlaagentkulcs>${esc(key)}</szamlaagentkulcs>` +
    `<szamlaszam>${esc(invoiceNumber)}</szamlaszam>` +
    // 2 = XML answer with the PDF inside; version 1 would stream raw bytes and
    // give us no way to tell a document apart from a plain-text error.
    `<valaszVerzio>2</valaszVerzio>` +
    `</xmlszamlapdf>`;
  try {
    const form = new FormData();
    form.append("action-szamla_agent_pdf", new Blob([xml], { type: "text/xml" }), "pdf.xml");
    const resp = await fetch(ENDPOINT, { method: "POST", body: form });
    const errCode = resp.headers.get("szlahu_error_code");
    const body = await resp.text();
    if (errCode) {
      const msg = decodeURIComponent(resp.headers.get("szlahu_error") ?? "");
      console.warn(`[szamlazz] ${invoiceNumber}: PDF-pótlás hiba ${errCode}: ${msg}`);
      return null;
    }
    if (/<sikeres>\s*false\s*<\/sikeres>/i.test(body)) {
      const code = pick(/<hibakod>([\s\S]*?)<\/hibakod>/i.exec(body));
      const hmsg = pick(/<hibauzenet>([\s\S]*?)<\/hibauzenet>/i.exec(body));
      console.warn(`[szamlazz] ${invoiceNumber}: PDF-pótlás sikertelen (${code ?? "?"}): ${hmsg ?? ""}`);
      return null;
    }
    const pdf = pick(/<pdf>([\s\S]*?)<\/pdf>/i.exec(body));
    if (!pdf) {
      console.warn(`[szamlazz] ${invoiceNumber}: a válasz nem tartalmazott PDF-et`);
      return null;
    }
    // A base64 PDF mindig '%PDF' fejléccel kezdődik → 'JVBERi0'. Ez fogja meg, ha
    // valami mást (pl. hibaoldalt) kaptunk vissza sikeresnek látszó válaszban.
    if (!/^JVBERi0/.test(pdf.trim())) {
      console.warn(`[szamlazz] ${invoiceNumber}: a kapott tartalom nem PDF — eldobva`);
      return null;
    }
    return pdf.trim();
  } catch (e) {
    console.warn(`[szamlazz] ${invoiceNumber}: PDF-pótlás hálózati hiba: ${(e as Error).message}`);
    return null;
  }
}
