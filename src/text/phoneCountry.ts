// Phone numbers IN A COUNTRY (ADR-0437): the country layer row says which national numbering
// plan a number written without "+CC" belongs to — its dial code, its trunk prefix, its
// mobile ranges and the national number's length.
//
//   · phone_plan 'hu' → the full Hungarian plan in phone.ts (area-code table, per-range
//     lengths, glued-run splitting). The HU row selects it; the result is exactly what
//     normalizePhone() always returned.
//   · phone_plan 'generic' → trunk prefix + national number within [nsn_min, nsn_max] digits
//     → +<dial><nsn>. Coarser than a full plan, but it never invents a number: anything that
//     does not fit the row's shape is refused (null), like phone.ts refuses a bad HU length.
//
// International input ("+CC…", "00CC…") is the same for every country: phone.ts's rules.
import type { CountryConfig } from "../country.js";
import { isHuMobileE164, normalizePhone } from "./phone.js";

type PhoneRules = Pick<CountryConfig, "dialCode" | "trunkPrefix" | "mobilePrefixes" | "phonePlan" | "phoneNsnMin" | "phoneNsnMax">;

/** One number as written in `cfg`'s country → E.164, or null. No row (cfg null) → only an
 *  internationally written number is accepted — a national one has no country to belong to. */
export function normalizePhoneIn(raw: string, cfg: PhoneRules | null): string | null {
  if (cfg?.phonePlan === "hu") return normalizePhone(raw);
  const c = raw.replace(/[\s\-()./]/g, "");
  if (!/^\+?[0-9]{6,15}$/.test(c)) return null;
  const intl = c.startsWith("+") ? c : c.startsWith("00") && c[2] !== "0" ? `+${c.slice(2)}` : null;
  if (intl) return /^\+[1-9][0-9]{6,14}$/.test(intl) ? intl : null;
  if (!cfg) return null;
  // A number already carrying the dial code without "+" ("359888040056").
  let nsn: string | null = null;
  if (cfg.trunkPrefix && c.startsWith(cfg.trunkPrefix)) nsn = c.slice(cfg.trunkPrefix.length);
  else if (c.startsWith(cfg.dialCode)) nsn = c.slice(cfg.dialCode.length);
  if (nsn === null || nsn.startsWith("0")) return null;
  return nsn.length >= cfg.phoneNsnMin && nsn.length <= cfg.phoneNsnMax ? `+${cfg.dialCode}${nsn}` : null;
}

/** Is this E.164 number a mobile of `cfg`'s country (the SMS/MMS/messenger channels need one)? */
export function isMobileE164In(e164: string, cfg: PhoneRules | null): boolean {
  if (!cfg) return false;
  if (cfg.phonePlan === "hu") return isHuMobileE164(e164);
  const prefix = `+${cfg.dialCode}`;
  if (!e164.startsWith(prefix)) return false;
  const nsn = e164.slice(prefix.length);
  return cfg.mobilePrefixes.some((m) => nsn.startsWith(m));
}

/** Does a number belong to `cfg`'s country? A national-format number carries no country
 *  code at all, so it cannot contradict one. No row → no basis to reject (true). */
export function plausibleInCountry(phone: string, cfg: Pick<CountryConfig, "dialCode"> | null): boolean {
  if (!cfg) return true;
  const digits = phone.replace(/\D/g, "");
  if (!/^(\+|00)/.test(phone.trim()) && !digits.startsWith(cfg.dialCode)) return true;
  return digits.startsWith(cfg.dialCode) || digits.startsWith(`00${cfg.dialCode}`);
}
