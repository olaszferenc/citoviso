// KÍSÉRLET-MOTOR — the wording of the code-defined variants (ADR-0462). Every sentence goes through
// T() so Bábel can translate it; a foreign letter takes a variant only where Bábel translated it
// in full, else that dimension's control (assignVariants, NEMZETKÖZI B).
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
import { collectFallbacks } from "../i18n/packs.js";
import { config } from "../config.js";
import { pricingRegionForCountry } from "../country.js";
import { carriesCurrencySign } from "../email/outreachEmail.js";
import { getDomainFreeInPackage, getPackageAssignment, offeredTlds } from "../pricing.js";
import { TIERS, domainTier } from "../packages.js";
import { composeBody, type DraftInput, type OutreachDraft, type OutreachParts } from "./draft.js";
import type { OwnerLayout } from "../email/outreachEmail.js";

/**
 * The source the billboard paragraph cites (owner's text, 2026-11-22) — ONE place, so a moved page is
 * a one-line fix. The study itself on Cornell eCommons („The Billboard Effect: Still Alive and Well”,
 * owner 2026-11-23: the 11-22 news-article link „nem nyitja meg a kutatást”). eCommons answers 429 to
 * bots, a browser opens it (checked 2026-11-23). The sentence itself stays as the owner wrote it.
 */
export const CORNELL_BILLBOARD_URL = "https://ecommons.cornell.edu/entities/publication/cc99c641-5795-4e66-b35b-9795385c6f52";

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
    // ADR-0498 (HR live run 2026-11-27): the sentence quotes the CHEAPEST package's price („havi X-tól”) —
    // the ending rides along only when the domain is that package's content (the package composition's
    // domain tier = the lowest tier). With the domain in no package (or a higher one) the order page asks
    // the ending's fee next to that price, so the letter must not promise it.
    if (domainTier(getPackageAssignment()) !== TIERS[0]) return null;
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
  if ((country ?? "").toUpperCase() === "HU") {
    return packageDomainTld("HU")
      ? T(lang, "Ha tetszik: havi {offerPrice} Ft-tól, saját .hu címmel.", { offerPrice })
      : T(lang, "Ha tetszik: havi {offerPrice} Ft-tól, saját címmel.", { offerPrice });
  }
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

/**
 * THE OWNER'S LETTER (owner 2026-11-23: „a javított szöveg kell a régi kinézettel”; the sample sent to
 * the owner that evening, with his three fixes: link under the picture, „Ha tetszik:” in the price box,
 * the Cornell words linking to the study). The owner's 11-22 text in the boxed design: sender = the
 * personal sender name, subject „Ez az Ön szállása? (név, település)”, no inbox line, no multi-plan
 * caption. The body is composed from the parts (§I: the HTML shows nothing the gated text lacks).
 * Null when it cannot be built in full (no sender name configured, or an untranslated sentence in a
 * foreign letter) — the caller then holds the lead: the OLD letter never goes out again.
 */
export function ownerLetter(
  d: DraftInput,
  base: OutreachDraft,
  lang: string,
  country: string | null | undefined,
  city: string | null | undefined,
): { draft: OutreachDraft; layout: OwnerLayout; fromName: string; untranslated: readonly string[] } | null {
  const sender = personalSenderName();
  if (!sender) return null;
  const { value, fallbacks } = collectFallbacks(() => {
    const priceLine = priceSentence(lang, base.parts.priceOffer ?? "", country);
    const pp = personalParts(d, base, priceLine, sender);
    const cc = (country ?? "").toUpperCase();
    const tld = packageDomainTld(cc === "HU" ? "HU" : country);
    const priceTail = tld ? T(lang, "saját {tld} címmel", { tld }) : T(lang, "saját címmel");
    const layout: OwnerLayout = { priceTail, researchUrl: CORNELL_BILLBOARD_URL, researchWords: T(lang, "A Cornell Egyetem kutatása") };
    const subject = subjectIsThisYours(lang, d.leadName, city);
    return { pp, layout, subject, priceLine };
  });
  const { pp, layout, subject, priceLine } = value;
  // greet · hook · [hero, link, button] · billboard paragraph (p2) · price sentence (trial: plain text
  // only — the HTML shows it in the box) · „not mine” (p4) · today's discount sentence (p3) + its footnote.
  const parts: OutreachParts = {
    ...base.parts,
    greet: pp.greet,
    hook: pp.hook,
    p1: "",
    p2: pp.p1,
    trial: priceLine,
    p4: pp.p4,
    planNote: undefined,
    sigName: sender,
    sigCo: "",
    sigMail: "",
  };
  const links = { cta: base.link, unsub: base.unsubscribeLink, privacy: base.privacyLink, ...(base.whyLink ? { why: base.whyLink } : {}) };
  // The emptied parts (p1, sigCo, sigMail) leave runs of blank lines in the plain text — one blank line is enough.
  const body = composeBody(parts, links, lang).replace(/\n{3,}/g, "\n\n");
  return { draft: { ...base, parts, body, subject }, layout, fromName: sender, untranslated: fallbacks };
}
