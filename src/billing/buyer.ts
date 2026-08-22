// Buyer declaration validation (0029) — the ONE place that decides whether a
// billing identity is good enough to invoice, shared by every caller so the
// client and the server cannot drift apart.
//
// Returns per-field Hungarian messages rather than a bare boolean: the buyer is
// at the checkout step with their wallet out, and "érvénytelen adat" without
// saying WHICH field loses the sale.

import {
  checkVies,
  huTaxNumberProblem,
  normalizeHuTaxNumber,
  parseEuVat,
  vatTreatmentFor,
  type BuyerType,
  type VatTreatment,
  type ViesStatus,
} from "./taxId.js";

/** Raw, untrusted payload as it arrives from the configurator. */
export interface BuyerInput {
  readonly buyer_type?: unknown;
  readonly buyer_name?: unknown;
  readonly buyer_tax_number?: unknown;
  readonly buyer_eu_vat_number?: unknown;
  readonly buyer_country?: unknown;
  readonly buyer_zip?: unknown;
  readonly buyer_city?: unknown;
  readonly buyer_address?: unknown;
  readonly buyer_email?: unknown;
  readonly terms_accepted?: unknown;
  readonly withdrawal_waiver?: unknown;
}

/** Validated, normalised buyer identity — safe to persist and to invoice from. */
export interface BuyerDeclaration {
  readonly buyerType: BuyerType;
  readonly buyerName: string;
  readonly buyerTaxNumber: string | null;
  readonly buyerEuVatNumber: string | null;
  readonly buyerCountry: string;
  readonly buyerZip: string;
  readonly buyerCity: string;
  readonly buyerAddress: string;
  readonly buyerEmail: string;
  readonly vatTreatment: VatTreatment;
  readonly viesStatus: ViesStatus;
  readonly viesCheckedAt: Date | null;
  readonly viesName: string | null;
  readonly termsAccepted: boolean;
  readonly withdrawalWaived: boolean;
  /**
   * Non-blocking conditions the OPERATOR must see: VIES unreachable, or the
   * VIES legal name differing from what the buyer typed. These never reject an
   * order — they queue it for review before the invoice goes out.
   */
  readonly flags: readonly string[];
}

export type BuyerValidation =
  | { readonly ok: true; readonly value: BuyerDeclaration }
  | { readonly ok: false; readonly errors: Readonly<Record<string, string>> };

const MAX = 200;
function str(v: unknown, max = MAX): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Deliberately permissive: rejecting an unusual but real address loses a sale. */
function emailLooksValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Compare legal names loosely — casing, accents and company-form noise differ. */
function nameRoughlyMatches(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(kft|bt|zrt|nyrt|kkt|ev|e\.v|gmbh|sp z o o|s r o|ltd|inc)\b/g, "")
      .replace(/[^a-z0-9]/g, "");
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return true;
  return x.includes(y) || y.includes(x);
}

/**
 * Validate a buyer declaration. Async because a foreign business buyer's VAT
 * number is checked against VIES — but VIES being down NEVER fails validation
 * (it downgrades the tax treatment to AAM and raises an operator flag).
 *
 * `requireTerms` is false while the ÁSZF document does not exist yet; flip it
 * on with the published document (see legal.ts TERMS_ACCEPTANCE_V1).
 */
export async function validateBuyer(
  raw: BuyerInput,
  opts: { readonly requireTerms?: boolean } = {},
): Promise<BuyerValidation> {
  const errors: Record<string, string> = {};

  const buyerType = raw.buyer_type === "business" ? "business" : raw.buyer_type === "individual" ? "individual" : null;
  if (!buyerType) {
    errors.buyer_type = "Válassza ki, hogy magánszemélyként vagy cégként rendel.";
  }

  const buyerName = str(raw.buyer_name);
  if (buyerName.length < 2) {
    errors.buyer_name =
      buyerType === "business"
        ? "Adja meg a cég teljes, hivatalos nevét."
        : "Adja meg a teljes nevét.";
  }

  const buyerCountry = (str(raw.buyer_country, 2) || "HU").toUpperCase();
  if (!/^[A-Z]{2}$/.test(buyerCountry)) errors.buyer_country = "Válasszon országot.";

  const buyerZip = str(raw.buyer_zip, 16);
  if (!buyerZip) errors.buyer_zip = "Adja meg az irányítószámot.";
  else if (buyerCountry === "HU" && !/^\d{4}$/.test(buyerZip)) {
    errors.buyer_zip = "A magyar irányítószám 4 számjegyű.";
  }

  const buyerCity = str(raw.buyer_city, 100);
  if (!buyerCity) errors.buyer_city = "Adja meg a települést.";

  const buyerAddress = str(raw.buyer_address);
  if (!buyerAddress) errors.buyer_address = "Adja meg az utcát és házszámot.";

  const buyerEmail = str(raw.buyer_email, 254).toLowerCase();
  if (!buyerEmail) errors.buyer_email = "Adja meg a számlázási e-mail címet.";
  else if (!emailLooksValid(buyerEmail)) errors.buyer_email = "Ez az e-mail cím nem tűnik érvényesnek.";

  // ── tax identity ──────────────────────────────────────────────────────────
  let buyerTaxNumber: string | null = null;
  let buyerEuVatNumber: string | null = null;
  let viesStatus: ViesStatus = "not_checked";
  let viesCheckedAt: Date | null = null;
  let viesName: string | null = null;
  const flags: string[] = [];

  if (buyerType === "business") {
    if (buyerCountry === "HU") {
      // The CHECKSUM is authoritative for a domestic buyer: a Hungarian AAM
      // business is legitimately absent from VIES, so we must not require it.
      const rawTax = str(raw.buyer_tax_number, 32);
      const problem = huTaxNumberProblem(rawTax);
      if (problem) errors.buyer_tax_number = problem;
      else buyerTaxNumber = normalizeHuTaxNumber(rawTax);
    } else {
      const parsed = parseEuVat(str(raw.buyer_eu_vat_number, 32), buyerCountry);
      if (!parsed) {
        errors.buyer_eu_vat_number =
          "Adja meg az érvényes közösségi adószámot (pl. DE123456789).";
      } else {
        buyerEuVatNumber = parsed.formatted;
        const vies = await checkVies(parsed.country, parsed.number);
        viesStatus = vies.status;
        viesCheckedAt = new Date();
        viesName = vies.name;
        if (vies.status === "invalid") {
          errors.buyer_eu_vat_number =
            "Ezt a közösségi adószámot a VIES nem ismeri el érvényesként. Ellenőrizze, vagy rendeljen magánszemélyként.";
        } else if (vies.status === "unavailable") {
          // NEVER block on an EU-side outage — invoice as AAM and let the
          // operator resolve the treatment before the invoice goes out.
          flags.push(
            "A VIES nem volt elérhető a közösségi adószám ellenőrzésekor — a számlázás előtt kézzel ellenőrizendő.",
          );
        } else if (vies.name && !nameRoughlyMatches(buyerName, vies.name)) {
          flags.push(
            `A megadott név ("${buyerName}") eltér a VIES-ben szereplő névtől ("${vies.name}") — számlázás előtt egyeztetendő.`,
          );
        }
      }
    }
  }

  // ── consents ──────────────────────────────────────────────────────────────
  const termsAccepted = raw.terms_accepted === true;
  if (opts.requireTerms && !termsAccepted) {
    errors.terms_accepted = "Az ÁSZF elfogadása a megrendeléshez szükséges.";
  }

  // A consumer must expressly consent to immediate performance, otherwise they
  // keep a 14-day withdrawal right over an already-built site.
  const withdrawalWaived = raw.withdrawal_waiver === true;
  if (buyerType === "individual" && !withdrawalWaived) {
    errors.withdrawal_waiver =
      "Az azonnali élesítéshez a hozzájárulás szükséges — enélkül csak 14 nap után tudjuk elindítani az oldalt.";
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const vatTreatment = vatTreatmentFor(buyerType!, buyerCountry, viesStatus);

  return {
    ok: true,
    value: {
      buyerType: buyerType!,
      buyerName,
      buyerTaxNumber,
      buyerEuVatNumber,
      buyerCountry,
      buyerZip,
      buyerCity,
      buyerAddress,
      buyerEmail,
      vatTreatment,
      viesStatus,
      viesCheckedAt,
      viesName,
      termsAccepted,
      withdrawalWaived,
      flags,
    },
  };
}
