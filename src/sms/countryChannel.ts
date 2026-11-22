// NEMZETKÖZI C — the destination country's channel rule for every SMS / MMS we send (dunning,
// trial notices and escalation, login reminders, partner messages …), not only cold outreach.
//
// The owner's rule (2026-11-19, „HR = csak e-mail”): a country whose layer row does not list a
// channel gets nothing on it — today every non-Hungarian country is e-mail only, because the
// only SMS/MMS route is the Hungarian modem. Before this, a Croatian trial's phone (+385…)
// went to the modem with a Hungarian MMS subject.
//
// The country is read from the number itself (its dial code against the layer rows, longest
// match): the number is what the modem would dial, whoever's record it came from. A number
// with no "+"/00 is read the way the senders read it (src/text/phone.ts: Hungarian national
// format), so the Hungarian flow answers exactly what it answered before. An international
// number of a country without a layer row → refused (fail closed).
import { allCountriesSync, type CountryConfig } from "../country.js";
import { normalizePhone } from "../text/phone.js";

export type PhoneChannel = "sms" | "mms";

/** The layer row whose dial code an E.164 number carries (longest match); null = none. */
export function countryOfE164(e164: string): CountryConfig | null {
  if (!e164.startsWith("+")) return null;
  let best: CountryConfig | null = null;
  for (const c of allCountriesSync()) {
    if (e164.startsWith(`+${c.dialCode}`) && (!best || c.dialCode.length > best.dialCode.length)) best = c;
  }
  return best;
}

/**
 * May `channel` carry a message to this number? true for an unreadable number (the sender
 * itself reports "érvénytelen telefonszám" — no second, contradicting reason here).
 */
export function phoneChannelAllowed(raw: string, channel: PhoneChannel): boolean {
  const e164 = normalizePhone(raw);
  if (!e164) return true;
  const row = countryOfE164(e164);
  return !!row && row.outreachChannels.includes(channel);
}

/** The operator-facing reason a refused number gets in the ledger / log. */
export function phoneChannelRefusal(raw: string, channel: PhoneChannel): string {
  const e164 = normalizePhone(raw) ?? raw;
  const row = countryOfE164(e164);
  return row
    ? `${row.iso2}: az ország csatornája nem engedi (${channel.toUpperCase()}) — csak ${row.outreachChannels.join(", ")}` // i18n-exempt: operátori napló
    : `ismeretlen ország (${e164.slice(0, 5)}…): ${channel.toUpperCase()} nem mehet ki`; // i18n-exempt: operátori napló
}
