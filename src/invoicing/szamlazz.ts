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
// NB: NOT validated against a live account (no key here) — the adapter is built
// to spec and gated by SZAMLAZZ_AGENT_KEY; validate the wire format against a
// real test account before flipping INVOICE_PROVIDER=szamlazz in production.

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
      t("szamlaLetoltes", "false") +
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
      t("irsz", b.zip ?? "") +
      t("telepules", b.city ?? "") +
      t("cim", b.address ?? "") +
      (b.email ? t("email", b.email) : "") +
      (b.email ? t("sendEmail", "false") : "") +
      (b.taxNumber ? t("adoszam", b.taxNumber) : "") +
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
