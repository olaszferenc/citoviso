// The site's PUBLIC contact facts — address, map pin, phone, e-mail (ADR-0241).
//
// Until now these came only from the scrape (the lead record frozen into the site
// data), and the owner had no way to correct them: a doubled "hrsz. 083/2" or a
// pin 5 km off stayed on the page. The owner's edit is stored as a site override
// (`edited_site_data.contact` / `.geo`), the same channel as the Szövegek edits.
//
// Pure: validation + normalisation only, so the admin view, the route and the
// guard all share ONE rule. No DB access here.

import { normalizePhone } from "../sms/sender.js";

export interface ContactFacts {
  readonly address: string;
  readonly phone: string;
  readonly email: string;
  readonly geo: { readonly lat: number; readonly lon: number } | null;
}

/** What the form posts. `undefined` = the field was not on the form (keep as is). */
export interface ContactEdits {
  readonly address?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly lat?: string;
  readonly lon?: string;
}

/**
 * Error keys are the Hungarian SOURCE strings — the view translates them with T(),
 * and the catalog extractor sees them here as literals.
 */
export const CONTACT_ERRORS = {
  address: "Adja meg a címet (település, utca, házszám vagy helyrajzi szám).",
  phone: "Ez nem telefonszám. Így írja: 06 30 123 4567",
  email: "Ez nem e-mail-cím. Így néz ki: nev@pelda.hu",
  geo: "A térkép-tű helye érvénytelen — tegye le újra a térképen.",
} as const;

export type ContactErrorKey = keyof typeof CONTACT_ERRORS;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "+36301234567" → "+36 30 123 4567" — how the number is PRINTED on the page. The
 *  `tel:` links strip the spaces, so the stored value stays dialable. */
export function prettyPhone(e164: string): string {
  if (!e164.startsWith("+36")) return e164;
  const n = e164.slice(3);
  if (n.startsWith("1")) return `+36 1 ${n.slice(1, 4)} ${n.slice(4)}`;
  const area = n.slice(0, 2);
  const rest = n.slice(2);
  return `+36 ${area} ${rest.slice(0, 3)} ${rest.slice(3)}`;
}

/** A stored phone as it is PRINTED (an unedited scrape keeps its raw "06305161631"
 *  form in the site data; a letter shows the same readable shape the admin saves). */
export function displayPhone(raw: string): string {
  const n = normalizePhone(raw.trim().replace(/\//g, ""));
  return n ? prettyPhone(n) : raw.trim();
}

type ContactFields = { readonly address?: string; readonly phone?: string; readonly email?: string };

/**
 * The contact facts the page renders: the owner's override replaces the scraped
 * block WHOLE (the site-data merge is shallow) — one rule for the admin view and
 * for every letter that quotes the property's contacts.
 */
export function effectiveContact(
  override: ContactFields | null | undefined,
  base: ContactFields | null | undefined,
): { address: string; phone: string; email: string } {
  const c = override ?? base ?? {};
  return { address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "" };
}

export function cleanAddress(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Apply the posted edits to the current facts. Returns the new facts, or the
 * failing fields — never a half-applied mix (a bad phone must not save the pin).
 */
export function applyContactEdits(
  current: ContactFacts,
  edits: ContactEdits,
): { ok: true; facts: ContactFacts } | { ok: false; errors: ContactErrorKey[] } {
  const errors: ContactErrorKey[] = [];

  let address = current.address;
  if (edits.address !== undefined) {
    address = cleanAddress(edits.address);
    if (address.length < 5) errors.push("address");
  }

  let phone = current.phone;
  if (edits.phone !== undefined) {
    const raw = edits.phone.trim();
    if (!raw) phone = "";
    else {
      // Owners write "06 30/123-4567"; the SMS rule does not know the slash, the
      // admin's live check does — strip it here so the two can never disagree.
      const n = normalizePhone(raw.replace(/\//g, ""));
      if (n) phone = prettyPhone(n);
      else errors.push("phone");
    }
  }

  let email = current.email;
  if (edits.email !== undefined) {
    email = edits.email.trim().slice(0, 160);
    if (email && !EMAIL_RE.test(email)) errors.push("email");
  }

  let geo = current.geo;
  if (edits.lat !== undefined || edits.lon !== undefined) {
    const lat = Number(edits.lat);
    const lon = Number(edits.lon);
    // An empty pair = the form had no map (no key / JS off): keep the stored pin.
    if ((edits.lat ?? "") === "" && (edits.lon ?? "") === "") {
      // keep
    } else if (
      Number.isFinite(lat) && Number.isFinite(lon) &&
      Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)
    ) {
      geo = { lat: Math.round(lat * 1e7) / 1e7, lon: Math.round(lon * 1e7) / 1e7 };
    } else {
      errors.push("geo");
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, facts: { address, phone, email, geo } };
}
