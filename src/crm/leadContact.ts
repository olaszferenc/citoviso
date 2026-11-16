// ORSZÁG-RÉTEG 3/4 — a lead's CONTACT read in its own country (ADR-0437, ADR-0455).
//
// Vera's first rule (charter §3b ①, ADR-0419) is "a mobile of the lead's country, or an own
// e-mail → OK; only a landline or nothing → TARTVA". It used to be written as "+36 20/30/31/
// 50/70", so EVERY foreign lead was held for not being Hungarian. The mobile ranges, the dial
// code and the trunk prefix are the country row's (mobile_prefixes, dial_code, trunk_prefix,
// phone_plan); the HU row selects the full Hungarian plan, so a Hungarian verdict is the old one.
//
// Pure over the loaded country snapshot; the e-mail half of the rule stays Vera's judgement
// (own domain vs. intermediary) — this only answers the phone half, and says why.
import type { CountryConfig } from "../country.js";
import { isMobileE164In, normalizePhoneIn, prettyPhoneIn } from "../text/phoneCountry.js";

export interface PhoneVerdict {
  /** E.164, or null when the number does not read in the lead's country. */
  readonly e164: string | null;
  /** A mobile of the lead's country (the SMS/MMS/messenger channels need one). */
  readonly mobile: boolean;
  /** Operator-facing, one line (Vera's ticket / the CLI). */
  readonly note: string;
}

/** The lead's phone, read in its country: number, mobile or not, and why. */
export function leadPhoneVerdict(phone: string | null | undefined, cfg: CountryConfig | null): PhoneVerdict {
  const raw = (phone ?? "").trim();
  if (!cfg) return { e164: null, mobile: false, note: "a lead országa nincs az ország-rétegben — nem ítélhető (zárva)" };
  if (!raw) return { e164: null, mobile: false, note: "nincs telefonszám" };
  const e164 = normalizePhoneIn(raw, cfg);
  if (!e164) return { e164: null, mobile: false, note: `a szám (${raw}) nem olvasható ${cfg.name} számaként` };
  const mobile = isMobileE164In(e164, cfg);
  const ranges = cfg.mobilePrefixes.map((p) => `+${cfg.dialCode} ${p}`).join(", ");
  return {
    e164,
    mobile,
    note: mobile
      ? `${prettyPhoneIn(e164, cfg)} — ${cfg.name} mobilszám (rendben)`
      : `${prettyPhoneIn(e164, cfg)} — nem ${cfg.name} mobil (mobil-előtagok: ${ranges})`,
  };
}
