// Tax identifier validation for the invoice buyer (0029).
//
// Two independent authorities, deliberately NOT conflated:
//
//   HU adószám  → the CHECKSUM is authoritative and offline. A Hungarian
//                 alanyi adómentes (AAM) business is legitimately absent from
//                 VIES, so a VIES miss must never reject a domestic buyer.
//   EU VAT      → VIES is authoritative. Applying reverse charge without a
//                 confirmed VIES answer shifts tax liability on an unverified
//                 claim, so 'valid' is required for that treatment — but VIES
//                 being DOWN must never block a sale (it is down often).
//
// VIES also returns the registered LEGAL NAME, which is how we stop putting a
// Google Maps marketing name on an invoice.

/** VIES REST (verified live 2026-08-22): GET .../ms/{CC}/vat/{number}. */
const VIES_BASE = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";
const VIES_TIMEOUT_MS = 6000;

/**
 * Per-member-state VAT formats — a fast pre-filter so we do not burn a VIES
 * round-trip on an obvious typo, and can answer the buyer instantly. VIES stays
 * the authority; these are intentionally permissive rather than clever.
 * NB: Greece is 'EL' in VIES, not 'GR'.
 */
const EU_VAT_PATTERNS: Readonly<Record<string, RegExp>> = {
  AT: /^U\d{8}$/,
  BE: /^\d{10}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  EL: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/,
  FR: /^[A-Z0-9]{2}\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/,
  IT: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
};

export const EU_VAT_COUNTRIES: readonly string[] = Object.keys(EU_VAT_PATTERNS);

/** ÁFA-kód (9th digit) — the taxpayer's VAT status. 1..5 are the defined values. */
const HU_VAT_CODES = new Set(["1", "2", "3", "4", "5"]);

/**
 * Checksum over the first 8 digits of a Hungarian adószám (törzsszám).
 * Weights 9,7,3,1,9,7,3 over digits 1-7; the 8th is the check digit:
 *   check = (10 - (Σ dᵢ·wᵢ mod 10)) mod 10
 * Verified against four real, published tax numbers (Számlázz.hu/KBOSS 13421739,
 * MOL 10625790, OTP 10537914, Magyar Telekom 10773381).
 */
function huChecksumOk(eightDigits: string): boolean {
  const weights = [9, 7, 3, 1, 9, 7, 3];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(eightDigits[i]) * weights[i]!;
  const check = (10 - (sum % 10)) % 10;
  return check === Number(eightDigits[7]);
}

/** Normalised HU adószám: '12345678-2-41', or null if it is not 11 digits. */
export function normalizeHuTaxNumber(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 8)}-${digits.slice(8, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Why this adószám is not acceptable, in Hungarian, for the buyer to read —
 * or null when it is valid. Returning the REASON (not just false) is what lets
 * the configurator tell someone they typed a digit wrong instead of stonewalling.
 */
export function huTaxNumberProblem(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "Adja meg az adószámot.";
  if (digits.length !== 11) {
    return `Az adószám 11 számjegyű (pl. 12345678-2-41) — ez ${digits.length} számjegy.`;
  }
  if (!huChecksumOk(digits.slice(0, 8))) {
    return "Az adószám első 8 jegye nem érvényes — valószínűleg elgépelés.";
  }
  if (!HU_VAT_CODES.has(digits[8]!)) {
    return "Az adószám 9. jegye (ÁFA-kód) csak 1 és 5 közötti lehet.";
  }
  const county = Number(digits.slice(9, 11));
  if (!((county >= 2 && county <= 44) || county === 51)) {
    return "Az adószám utolsó két jegye (megyekód) nem érvényes.";
  }
  return null;
}

export function isValidHuTaxNumber(raw: string): boolean {
  return huTaxNumberProblem(raw) === null;
}

export interface ParsedEuVat {
  /** VIES member-state code (Greece = 'EL'). */
  readonly country: string;
  /** The number WITHOUT the country prefix, upper-cased and stripped. */
  readonly number: string;
  /** Canonical form for storage/display, e.g. 'PL1234567890'. */
  readonly formatted: string;
}

/**
 * Parse an EU VAT number, with or without its country prefix. `fallbackCountry`
 * supplies the prefix when the buyer typed only digits (they usually do).
 */
export function parseEuVat(raw: string, fallbackCountry?: string): ParsedEuVat | null {
  const cleaned = (raw ?? "").toUpperCase().replace(/[\s.\-_/]/g, "");
  if (!cleaned) return null;

  let country = cleaned.slice(0, 2);
  let number = cleaned.slice(2);
  if (!EU_VAT_PATTERNS[country]) {
    // No usable prefix — treat the whole string as the number.
    const fb = (fallbackCountry ?? "").toUpperCase();
    country = fb === "GR" ? "EL" : fb;
    number = cleaned;
  }
  const pattern = EU_VAT_PATTERNS[country];
  if (!pattern || !pattern.test(number)) return null;
  return { country, number, formatted: `${country}${number}` };
}

export type ViesStatus = "valid" | "invalid" | "unavailable" | "not_checked";

export interface ViesResult {
  readonly status: ViesStatus;
  /** Registered legal name, when the member state discloses it. */
  readonly name: string | null;
  /** Registered address, when disclosed. */
  readonly address: string | null;
}

/** VIES returns '---' for fields a member state chooses not to disclose. */
function disclosed(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return !s || s === "---" ? null : s;
}

/**
 * Check a VAT number against VIES. NEVER throws and never blocks: a network
 * failure, a timeout or a member-state outage yields 'unavailable', which the
 * caller records and the operator resolves before invoicing. Treating VIES
 * downtime as "invalid" would reject paying customers for an EU outage.
 */
export async function checkVies(
  country: string,
  number: string,
  timeoutMs = VIES_TIMEOUT_MS,
): Promise<ViesResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(
      `${VIES_BASE}/${encodeURIComponent(country)}/vat/${encodeURIComponent(number)}`,
      { signal: ctl.signal, headers: { accept: "application/json" } },
    );
    if (!resp.ok) return { status: "unavailable", name: null, address: null };
    const data = (await resp.json()) as {
      isValid?: boolean;
      userError?: string;
      name?: string;
      address?: string;
    };
    // A member-state-side failure comes back as a userError other than
    // VALID/INVALID (e.g. MS_UNAVAILABLE, TIMEOUT) — that is NOT a verdict.
    const err = (data.userError ?? "").toUpperCase();
    if (data.isValid === true) {
      return { status: "valid", name: disclosed(data.name), address: disclosed(data.address) };
    }
    if (data.isValid === false && (err === "INVALID" || err === "VALID")) {
      return { status: "invalid", name: null, address: null };
    }
    return { status: "unavailable", name: null, address: null };
  } catch {
    return { status: "unavailable", name: null, address: null };
  } finally {
    clearTimeout(timer);
  }
}

export type BuyerType = "individual" | "business";
export type VatTreatment = "aam" | "reverse_charge";

/**
 * The tax treatment of a sale. Reverse charge (Áfa tv. 37. §) applies ONLY to a
 * business buyer in another EU member state whose VAT number VIES confirmed —
 * our own AAM status does not exempt us from it. Everything else is AAM.
 */
export function vatTreatmentFor(
  buyerType: BuyerType,
  country: string,
  viesStatus: ViesStatus,
): VatTreatment {
  const cc = (country ?? "").toUpperCase();
  const isForeignEu = cc !== "HU" && (EU_VAT_PATTERNS[cc] !== undefined || cc === "GR");
  if (buyerType === "business" && isForeignEu && viesStatus === "valid") return "reverse_charge";
  return "aam";
}
