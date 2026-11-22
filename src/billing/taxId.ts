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

import { T } from "../i18n/mail.js";

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

/**
 * A VALID Hungarian adószám hiding in free text (an address, a city, a name) —
 * normalised, or null. Elek F-1 (measured live 2026-10-01): a sole trader who
 * stayed on "Magánszemélyként" had no tax field, typed `24393470213` after the
 * street, and NAV received it as part of the address. Only a number that passes
 * the full check counts, so a house number or a lot number never trips it.
 */
export function findHuTaxNumberInText(text: string): string | null {
  for (const m of (text ?? "").matchAll(/(?<!\d)\d{8}-?\d-?\d{2}(?!\d)/g)) {
    if (huTaxNumberProblem(m[0]) === null) return normalizeHuTaxNumber(m[0]);
  }
  return null;
}

export function isValidHuTaxNumber(raw: string): boolean {
  return huTaxNumberProblem(raw) === null;
}

/**
 * Croatian OIB (osobni identifikacijski broj): 11 digits, the last one an ISO 7064
 * MOD 11,10 check digit over the first ten. Offline and authoritative like the HU
 * checksum: an obrt with no VAT number is absent from VIES, the OIB still identifies it.
 * Accepts an optional "HR" prefix and separators (people paste "HR 694 351 515 30").
 */
export function normalizeHrOib(raw: string): string | null {
  const digits = (raw ?? "").trim().replace(/^HR/i, "").replace(/[\s.\-]/g, "");
  return /^\d{11}$/.test(digits) ? digits : null;
}

/** ISO 7064 MOD 11,10 over the first ten digits; true when the 11th is the check digit. */
export function hrOibChecksumOk(elevenDigits: string): boolean {
  if (!/^\d{11}$/.test(elevenDigits)) return false;
  let t = 10;
  for (let i = 0; i < 10; i++) {
    t = (t + Number(elevenDigits[i])) % 10;
    if (t === 0) t = 10;
    t = (t * 2) % 11;
  }
  const check = (11 - t) % 10;
  return check === Number(elevenDigits[10]);
}

/**
 * Why this OIB is not acceptable, in the reader's language (`lang`, default Hungarian), or
 * null when valid. Returning the REASON lets the form say which digit to look at.
 */
export function hrOibProblem(raw: string, lang = "hu"): string | null {
  const stripped = (raw ?? "").trim().replace(/^HR/i, "").replace(/[\s.\-]/g, "");
  if (!stripped) return T(lang, "Adja meg az OIB-t.");
  if (!/^\d+$/.test(stripped) || stripped.length !== 11) return T(lang, "Az OIB 11 számjegyű.");
  if (!hrOibChecksumOk(stripped)) return T(lang, "Az OIB ellenőrző számjegye nem stimmel — valószínűleg elgépelés.");
  return null;
}

/** The offline national tax-id checks a country's legal schema can name (legal.ts taxIdCheck). */
export type NationalTaxIdCheck = "hr_oib" | "it_piva_cf" | "es_nif" | "pt_nif" | "fr_siren" | "bg_eik";

/** Luhn over a digit string (FR SIREN/SIRET, the IT Partita IVA). */
function luhnOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** IT codice fiscale (16 characters): the check letter over the first fifteen (DM 23/12/1976). */
const CF_ODD: Readonly<Record<string, number>> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
function itCfOk(cf: string): boolean {
  if (!/^[A-Z0-9]{15}[A-Z]$/.test(cf)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = cf[i]!;
    sum += i % 2 === 0 ? CF_ODD[ch]! : /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (sum % 26)) === cf[15];
}

/** ES NIF: DNI (8 digits + letter), NIE (X/Y/Z + 7 digits + letter) or CIF (entity letter + 7 digits + control). */
const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
function esNifOk(n: string): boolean {
  const dni = /^(\d{8})([A-Z])$/.exec(n);
  if (dni) return DNI_LETTERS[Number(dni[1]) % 23] === dni[2];
  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(n);
  if (nie) return DNI_LETTERS[Number(`${"XYZ".indexOf(nie[1]!)}${nie[2]}`) % 23] === nie[3];
  const cif = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(n);
  if (!cif) return false;
  const d = cif[2]!;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const v = Number(d[i]);
    if (i % 2 === 1) sum += v;
    else sum += Math.floor((v * 2) / 10) + ((v * 2) % 10);
  }
  const c = (10 - (sum % 10)) % 10;
  return cif[3] === String(c) || cif[3] === "JABCDEFGHI"[c];
}

/** PT NIF: 9 digits, mod-11 check digit (weights 9…2). */
function ptNifOk(n: string): boolean {
  if (!/^\d{9}$/.test(n)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(n[i]) * (9 - i);
  const r = sum % 11;
  return (r < 2 ? 0 : 11 - r) === Number(n[8]);
}

/** BG ЕИК / BULSTAT: 9 digits (legal entity) or 13 (branch), the official two-pass mod-11 check. */
function bgEikOk(n: string): boolean {
  const pass = (digits: string, w1: readonly number[], w2: readonly number[]): number => {
    let s = 0;
    for (let i = 0; i < w1.length; i++) s += Number(digits[i]) * w1[i]!;
    let r = s % 11;
    if (r === 10) {
      s = 0;
      for (let i = 0; i < w2.length; i++) s += Number(digits[i]) * w2[i]!;
      r = s % 11;
      if (r === 10) r = 0;
    }
    return r;
  };
  if (!/^\d{9}(?:\d{4})?$/.test(n)) return false;
  if (pass(n, [1, 2, 3, 4, 5, 6, 7, 8], [3, 4, 5, 6, 7, 8, 9, 10]) !== Number(n[8])) return false;
  if (n.length === 9) return true;
  return pass(n.slice(8), [2, 7, 3, 5], [4, 9, 5, 7]) === Number(n[12]);
}

/** A national tax id as typed → its stored form (upper case, no separators, no VAT prefix). */
export function normalizeNationalTaxId(check: NationalTaxIdCheck, raw: string): string {
  const prefix: Record<NationalTaxIdCheck, RegExp> = {
    hr_oib: /^HR/, it_piva_cf: /^IT/, es_nif: /^ES/, pt_nif: /^PT/, fr_siren: /^FR/, bg_eik: /^BG/,
  };
  const s = (raw ?? "").trim().toUpperCase().replace(/[\s.\-/]/g, "");
  // The VAT prefix is stripped only where what follows still has the id's own shape (an ES NIF
  // may itself start with a letter, but never with "ES" + 9 characters of a NIF).
  return check === "es_nif" ? (/^ES[0-9A-Z]{9}$/.test(s) ? s.slice(2) : s) : s.replace(prefix[check], "");
}

/** Is the (normalized) id valid for its check? */
export function nationalTaxIdOk(check: NationalTaxIdCheck, id: string): boolean {
  switch (check) {
    case "hr_oib":
      return hrOibChecksumOk(id);
    case "it_piva_cf":
      return /^\d{11}$/.test(id) ? luhnOk(id) : itCfOk(id);
    case "es_nif":
      return esNifOk(id);
    case "pt_nif":
      return ptNifOk(id);
    case "fr_siren":
      return /^\d{9}$|^\d{14}$/.test(id) && luhnOk(id);
    case "bg_eik":
      return bgEikOk(id);
  }
}

/** The shape each id has, as the error names it (the digits/letters a buyer can count). */
const NATIONAL_ID_SHAPE: Record<Exclude<NationalTaxIdCheck, "hr_oib">, RegExp> = {
  it_piva_cf: /^(?:\d{11}|[A-Z0-9]{16})$/,
  es_nif: /^[0-9XYZA-W]\d{7}[0-9A-Z]$/,
  pt_nif: /^\d{9}$/,
  fr_siren: /^(?:\d{9}|\d{14})$/,
  bg_eik: /^(?:\d{9}|\d{13})$/,
};

/**
 * The national tax-id check named by a country's legal schema: the problem (in `lang`) or
 * null. No check named → any value is accepted (the imprint shows what the tenant typed;
 * VIES stays the VAT authority). HR keeps its own OIB wording (byte-identical); the other
 * countries share three sentences — empty, wrong shape (with a valid example), wrong check.
 */
export function nationalTaxIdProblem(check: NationalTaxIdCheck | undefined, raw: string, lang = "hu"): string | null {
  if (!check) return null;
  if (check === "hr_oib") return hrOibProblem(raw, lang);
  const id = normalizeNationalTaxId(check, raw);
  if (!id) return T(lang, "Adja meg az adóazonosítót.");
  if (!NATIONAL_ID_SHAPE[check].test(id)) {
    return T(lang, "Ez nem tűnik adóazonosítónak — a helyes alak például: {pelda}.", { pelda: NATIONAL_ID_EXAMPLE[check] });
  }
  if (!nationalTaxIdOk(check, id)) return T(lang, "Az adóazonosító ellenőrző jele nem stimmel — valószínűleg elgépelés.");
  return null;
}

/** A VALID example per check (the form's placeholder and the shape error; selftested). */
export const NATIONAL_ID_EXAMPLE: Readonly<Record<NationalTaxIdCheck, string>> = {
  hr_oib: "69435151530",
  it_piva_cf: "12345678903",
  es_nif: "12345678Z",
  pt_nif: "123456789",
  fr_siren: "732829320",
  bg_eik: "121759222",
};

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
