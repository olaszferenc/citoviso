// KÍSÉRLET-MOTOR — the wording of the code-defined variants (ADR-0462). Every sentence goes through
// T() so Bábel can translate it; experiments run on Hungarian letters only (assignVariants).
//
//   subject   ez_az_on_szallasa — „Ez az Ön szállása? ({név}, {település})”, without a town „… ({név})”
//   body_style szemelyes        — the PERSONAL letter: the OWNER'S FINAL TEXT (2026-11-22, via the
//                                 coordinator citb64f0ed0). First person singular, no logo, no button,
//                                 no box, no inbox line above it — its first visible text is the greeting.
//                                 No Google-star proof, no „the colleague sets it up”, no trial sentence.
//                                 The §A framing is „csak Ön látja” (true: the link is not public) — the
//                                 owner expressly did NOT want „még nem nyilvános”; the §C gate counts it.
//   price_line mondat           — „Ha tetszik: havi {offerPrice} Ft-tól, saját .hu címmel.” — ONLY with
//                                 the personal letter (the from-price is the base package WITHOUT
//                                 booking). „.hu” is true on prod: the base package carries the domain
//                                 (package_module alap = domain,enquiry,gallery,location; pricing_config
//                                 hu domain_free_in_package). Outside HU the sentence says „saját címmel”.
//   sender    szemelyes         — the From display name = OUTREACH_FOLLOWUP_SENDER_NAME (never hardcoded)
//
// The personal letter is expressed as OutreachParts (greet · hook = intro · p1 = the billboard
// paragraph · p2 = "" · p3 = price · p4 = „not mine”), so the §I guard (every part in the gated body)
// and the §C gate judge it exactly like today's letter. composePersonalBody is its plain-text body.

import { T } from "../i18n/mail.js";
import { config } from "../config.js";
import { pricingRegionForCountry } from "../country.js";
import { carriesCurrencySign } from "../email/outreachEmail.js";
import { getDomainFreeInPackage, offeredTlds } from "../pricing.js";
import type { DraftInput, OutreachDraft, OutreachParts } from "./draft.js";

/**
 * The source the billboard paragraph cites (owner's text, 2026-11-22) — ONE place, so a moved page is
 * a one-line fix. Cornell's 2017 news article on the study (coordinator 2026-11-22; measured 200). The
 * first address (…/research-publications/billboard-effect-still-alive-and-well) answered 404, and the
 * eCommons record answers 429 to bots. The sentence itself stays as the owner wrote it (his decision).
 */
export const CORNELL_BILLBOARD_URL = "https://business.cornell.edu/news/2017/04/14/online-travel-sites-still-important-hotel/";

/** The personal sender's name (config), or "" when unset → the personal variants do not apply. */
export function personalSenderName(): string {
  return (config.outreachFollowupSenderName || "").trim();
}

export function subjectIsThisYours(lang: string, name: string, city: string | null | undefined): string {
  const town = (city ?? "").trim();
  return town ? T(lang, "Ez az Ön szállása? ({name}, {city})", { name, city: town }) : T(lang, "Ez az Ön szállása? ({name})", { name });
}

/**
 * ORSZÁG-RÉTEG 3/10 (tulaj 11-22: a személyes levél minden országba): the domain ending a lead of
 * `country` gets IN its base package — the country's pricing region must make the domain package
 * content (`domain_free_in_package`) and offer an ending that is (`domain_tld.free_in_package`).
 * Null = no such ending (the sentence then names no ending — never a claim the package cannot keep).
 */
export function packageDomainTld(country: string | null | undefined): string | null {
  try {
    const region = pricingRegionForCountry(country);
    if (!getDomainFreeInPackage(region)) return null;
    return offeredTlds(region).find((t) => t.freeInPackage)?.tld ?? null;
  } catch {
    return null;
  }
}

/**
 * The price line of the personal letter; `country` = the lead's ISO-2. HU: the forint sentence with
 * the „.hu” (byte-identical). Elsewhere (3/10): the amount carries its own currency sign (draft.ts
 * fromPricePair → formatMinor, so no „Ft” after it) and the ending is the region's package domain.
 */
export function priceSentence(lang: string, offerPrice: string, country: string | null | undefined = "HU"): string {
  if ((country ?? "").toUpperCase() === "HU") return T(lang, "Ha tetszik: havi {offerPrice} Ft-tól, saját .hu címmel.", { offerPrice });
  if (!carriesCurrencySign(offerPrice)) return T(lang, "Ha tetszik: havi {offerPrice} Ft-tól, saját címmel.", { offerPrice });
  const tld = packageDomainTld(country);
  return tld
    ? T(lang, "Ha tetszik: havi {offerPrice}-tól, saját {tld} címmel.", { offerPrice, tld })
    : T(lang, "Ha tetszik: havi {offerPrice}-tól, saját címmel.", { offerPrice });
}

/**
 * The personal letter's parts. `priceLine`: undefined = today's price sentence (with its discount
 * footnote), "" = none, a string = that sentence.
 */
export function personalParts(d: DraftInput, base: OutreachDraft, priceLine: string | undefined, senderName: string): OutreachParts {
  const keepToday = priceLine === undefined;
  return {
    ...base.parts,
    greet: T(d.lang, "Tisztelt {name}!", { name: d.leadName }),
    hook: T(d.lang, "Elkészítettem a szállása honlapját: teljesen működik, csak Ön látja, és telefonon is kipróbálhatja."),
    p1: T(
      d.lang,
      "Tudta, hogy a vendégek többsége a Bookingon talál rá egy szállásra, aztán megkeresi a saját honlapját is? A Cornell Egyetem kutatása szerint a közvetlenül foglalók 75%-a előtte egy foglalóoldalon nézte meg a szállást ({url}). Akinek nincs saját oldala, annál ezek a vendégek a Bookingon foglalnak, jutalékkal.",
      { url: CORNELL_BILLBOARD_URL },
    ),
    p2: "",
    p3: keepToday ? base.parts.p3 : priceLine,
    p4: T(d.lang, "Ha nem Ön a gazda, írjon vissza egy „nem”-et, és nem keresem többet."),
    trial: undefined,
    sigName: senderName,
    sigCo: "",
    sigMail: "",
    fine: keepToday ? base.parts.fine : "",
  };
}

/** The personal letter as plain text — the gated body (same order as the HTML). */
export function composePersonalBody(t: OutreachParts, l: { cta: string; unsub: string; privacy: string; why?: string }, lang: string): string {
  return [
    t.greet,
    "",
    t.hook,
    l.cta,
    "",
    ...(t.planNote ? [t.planNote, ""] : []),
    t.p1,
    "",
    ...(t.p2 ? [t.p2, ""] : []),
    ...(t.p3 ? [t.p3, ""] : []),
    t.p4,
    "",
    T(lang, "Üdvözlettel,"),
    t.sigName,
    ...(t.sigCo ? [t.sigCo] : []),
    "",
    ...(t.fine ? [t.fine, ""] : []),
    ...(t.why && l.why ? [`${t.why}\n${l.why}`, ""] : []),
    `${t.unsubTxt}\n${l.unsub}`,
    "",
    `${t.legal} ${l.privacy}`,
    "",
    t.identity,
  ].join("\n");
}
