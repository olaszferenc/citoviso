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
 * Build the checkout prefill for a lead. NB: the lead NAME is deliberately NOT
 * prefilled into the legal-name field — lead.name is the Google Maps marketing
 * name ("Ferenc Ház"), and pre-filling it invites the buyer to accept it as
 * their legal name, which is exactly the defect this slice removes. They must
 * state the legal name themselves (or, for an EU company, VIES supplies it).
 */
export function buildBillingPrefill(lead: {
  address?: string | null;
  country?: string | null;
  city?: string | null;
}, contactEmail?: string | null): BillingPrefill {
  const split = splitAddressForPrefill(lead.address);
  const out: {
    zip?: string;
    city?: string;
    address?: string;
    email?: string;
    country?: string;
  } = {};
  if (split.zip) out.zip = split.zip;
  // The lead's own city facet is more reliable than the address split.
  const city = lead.city ?? split.city;
  if (city) out.city = city;
  // When the split yields the same token for both (a one-part Maps address like
  // "Balatonföldvár"), it carries no street information — leaving it in both
  // fields just makes the buyer delete it.
  if (split.street && split.street !== city) out.address = split.street;
  if (contactEmail) out.email = contactEmail;
  out.country = (lead.country ?? "HU").toUpperCase();
  return out;
}
