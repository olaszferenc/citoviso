// A CURRENCY, NAMED FOR ITS READER (ADR-0450 ország-réteg 3/2).
//
// The owner picks the currency their prices are in. The list used to be two hard-coded
// options ("forint (Ft)", "euró (€)"); a lodging in any other country could not price in its
// own money. Any ISO 4217 code is valid now — the currency's NAME comes from Intl in the
// page's language, its SIGN from the same rule the amounts use (money.ts currencySign, else
// the locale's narrow symbol). The two Hungarian labels stay the T() strings they always
// were, so a Hungarian page reads byte-for-byte what it did.
import { T } from "../i18n/mail.js";
import { currencySign } from "./money.js";

let isoSet: ReadonlySet<string> | null = null;

/** Is this an ISO 4217 code the runtime knows ("CZK" yes, "Ft" / "XYZ" no)? */
export function isIsoCurrency(code: string | null | undefined): boolean {
  const c = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return false;
  if (!isoSet) {
    try {
      isoSet = new Set((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("currency"));
    } catch {
      isoSet = new Set(["HUF", "EUR"]);
    }
  }
  return isoSet.has(c);
}

/** The local sign: "Ft", "€", "Kč", "zł"; the code itself when the locale has none. */
export function currencySymbol(code: string, lang: string): string {
  const fixed = currencySign(code);
  if (fixed !== code) return fixed;
  try {
    const part = new Intl.NumberFormat(lang || "hu", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(1)
      .find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** The currency's name in the reader's language: "forint", "euró", "česká koruna". */
export function currencyName(code: string, lang: string): string {
  if (code === "HUF") return T(lang, "forint");
  if (code === "EUR") return T(lang, "euró");
  try {
    return new Intl.DisplayNames([lang || "hu"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** An option label: "forint (Ft)", "euró (€)", "česká koruna (Kč)". */
export function currencyOptionLabel(code: string, lang: string): string {
  if (code === "HUF") return T(lang, "forint (Ft)");
  if (code === "EUR") return T(lang, "euró (€)");
  const sym = currencySymbol(code, lang);
  const name = currencyName(code, lang);
  return sym && sym !== name ? `${name} (${sym})` : name;
}

/**
 * The currencies offered to an owner, the country's own first (it is the default), then the
 * one already saved (never drop an owner's choice), then the euro. A Hungarian lodging gets
 * exactly the list it always had: forint, euró.
 */
export function offeredCurrencies(countryCurrency: string | null, saved: string | null): string[] {
  const out: string[] = [];
  for (const c of [countryCurrency ?? "HUF", saved, "EUR"]) {
    const u = String(c ?? "").trim().toUpperCase();
    if (u && isIsoCurrency(u) && !out.includes(u)) out.push(u);
  }
  return out;
}
