// Checkout prefill from lead data (0029).
//
// ⚠️ READ THIS BEFORE REUSING: everything here is a GUESS. It exists so the
// buyer confirms their details instead of typing them, which is what keeps a
// mandatory checkout step from costing conversions.
//
// The very same address split used to be the invoice's source of truth (in
// payment/service.ts), and that was the bug: a wrong guess there is a legally
// broken invoice, while a wrong guess HERE is a field the buyer corrects in two
// seconds. Same code, opposite consequence — so it lives on the prefill side of
// the line and must never drift back.

import type { BillingPrefill } from "../generator/configurator.js";
import { allCountriesSync, resolveCountryCode } from "../country.js";

/**
 * Split a single-string address into HU invoice parts. Handles the Google Maps
 * "Város, Utca hsz, IRSZ Hungary" shape and degrades to nulls on anything else.
 */
export function splitAddressForPrefill(raw: string | null | undefined): {
  zip: string | null;
  city: string | null;
  street: string | null;
} {
  if (!raw) return { zip: null, city: null, street: null };
  const zip = raw.match(/\b(\d{4})\b/)?.[1] ?? null;
  const rest = raw.replace(/\b\d{4}\b/, "").replace(/\bHungary\b|\bMagyarország\b/gi, "");
  const parts = rest
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { zip, city: parts[0] ?? null, street: parts.slice(1).join(", ") || null };
}

/**
 * Build the checkout prefill for a lead.
 *
 * ⛔⛔ NO ADDRESS (Elek F-1, owner-approved 2026-10-02). The lead's address is the
 * ACCOMMODATION's, not the buyer's billing address — and "a wrong guess is a field
 * the buyer corrects in two seconds" turned out false: measured live, the buyer
 * overwrote only the street, and "8360 Keszthely" (the guesthouse) + their own
 * street went to NAV on a real invoice. A half-right address is worse than an empty
 * one, because it LOOKS confirmed. Zip, city and street therefore start empty;
 * the e-mail (the owner's own outreach address) and the country stay.
 * `splitAddressForPrefill` remains for reading a lead address, never for billing.
 *
 * NB: the lead NAME is deliberately NOT
 * prefilled into the legal-name field — lead.name is the Google Maps marketing
 * name ("Ferenc Ház"), and pre-filling it invites the buyer to accept it as
 * their legal name, which is exactly the defect this slice removes. They must
 * state the legal name themselves (or, for an EU company, VIES supplies it).
 */
export function buildBillingPrefill(lead: {
  address?: string | null;
  country?: string | null;
  city?: string | null;
}, contactEmail?: string | null, pricingRegion?: string | null): BillingPrefill {
  const out: {
    email?: string;
    country?: string;
  } = {};
  if (contactEmail) out.email = contactEmail;
  const country = prefillCountry(lead.country, pricingRegion ?? null);
  if (country) out.country = country;
  return out;
}

/**
 * NEMZETKÖZI C: the country the checkout preselects — the lead's own country value as ISO-2
 * ("HU", or an alias the layer knows: "MAGYARORSZÁG" → "HU"), else the ONE country whose layer
 * row buys in the page's pricing region (the region was itself picked from the lead's country).
 * Neither → nothing: the buyer chooses, and a missing country is a validation error — never a
 * silent "HU" (that default sent a Croatian buyer's invoice to the Hungarian path).
 */
export function prefillCountry(raw: string | null | undefined, pricingRegion: string | null): string | null {
  const own = resolveCountryCode(raw);
  if (own) return own;
  if (!pricingRegion) return null;
  const inRegion = allCountriesSync().filter((c) => c.pricingRegion === pricingRegion);
  return inRegion.length === 1 ? inRegion[0]!.iso2 : null;
}
