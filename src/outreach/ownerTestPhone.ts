// OWNER TEST PHONE exemption (ADR-0319, owner decision 2026-10-04).
//
// The owner tests the mobile channel with their own phone, and that number sits on
// several "[TESZT]" leads by design. Two person-level gates read it as a real
// person's number and made testing structurally impossible:
//   · shared-contact gate — "this number also belongs to another lodging" (live:
//     [TESZT] Lovász ↔ [TESZT] Muschel); past 6 holders even the Duplikátumok page
//     stops offering the pair, so no ruling could release it any more
//   · number-level opt-out — one unsubscribe click while testing the mail on ANY
//     test lead blocked the phone on all of them (dev: Éden üdülőház, 2026-09-25)
//
// The exemption needs BOTH: the number is listed in OUTREACH_TEST_PHONES AND the
// lead is a test lead by name. A REAL lead carrying the same number changes in
// nothing — that is the negative control in scripts/owner-test-phone-check.mts.
// The opt-out exemption applies OFF the live host only: on the live host an
// opt-out stays an opt-out, whoever clicked it.

import { config } from "../config.js";
import { normalizePhone } from "../sms/sender.js";

/** A test lead is marked by its name — the same "[TESZT]" prefix the owner uses everywhere. */
export function isTestLeadName(name: string | null | undefined): boolean {
  return /^\s*\[TESZT\]/.test(name ?? "");
}

/** OUTREACH_TEST_PHONES, normalised to E.164. `raw` is injectable for the check. */
export function ownerTestPhones(raw: string = config.outreachTestPhones): string[] {
  return raw
    .split(",")
    .map((s) => normalizePhone(s.trim()))
    .filter((s): s is string => Boolean(s));
}

/** True only for a listed test number on a "[TESZT]" lead. */
export function ownerTestPhoneExempt(
  leadName: string | null | undefined,
  phoneE164: string,
  raw: string = config.outreachTestPhones,
): boolean {
  return isTestLeadName(leadName) && ownerTestPhones(raw).includes(phoneE164);
}
