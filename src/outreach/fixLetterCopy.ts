// THE CORRECTION LETTER'S TEXT (owner 2026-11-27, brief javito-level-20261127, ADR-XXXX). The owner's own sentences,
// letter for letter; after them the part already reviewed for the law: the signature of the cold letter
// (draft.ts senderParts) and its legal footer (OUTREACH_LETTER_LEGAL_V1 with the privacy notice + advertiserIdentity).
// ⛔ Do not reword: a change needs the owner's word first (brief: „A levél szövegén ne változtass”).
//
// One source for the plain text the gates judge and the HTML the lead sees (outreachEmail.ts bodyStyle "fix" renders
// these very parts, in this order): greeting · p1 + the link · p2 · the opt-out sentence + its link · signature ·
// legal line + privacy link · advertiser identity.
import { collectFallbacks } from "../i18n/packs.js";
import { T } from "../i18n/mail.js";
import type { OutreachDraft } from "./draft.js";

export interface FixLetterText {
  readonly subject: string;
  readonly greet: string;
  readonly p1: string;
  readonly p2: string;
  readonly unsubTxt: string;
}

export function fixLetterText(lang: string, leadName: string): FixLetterText {
  return {
    subject: T(lang, "{name} – javított honlapterv", { name: leadName }),
    greet: T(lang, "Tisztelt {name}!", { name: leadName }),
    p1: T(lang, "A napokban küldtünk Önnek egy honlaptervet, amelyet sajnálatos módon meghibásodott generátorunkkal állítottunk elő. A tervet újra elkészítettük:"),
    p2: T(lang, "Ez egy előzetes terv, még nem nyilvános oldal. A képek csak bemutatásra szolgálnak, és lecserélhetők az Önök saját fotóira. A megtekintés ingyenes, és semmire nem kötelez."),
    unsubTxt: T(lang, "Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat:"),
  };
}

/** The plain-text body, composed from the parts (the HTML renders the same parts — §I consistency). */
export function composeFixBody(
  t: FixLetterText,
  links: { readonly cta: string; readonly unsub: string; readonly privacy: string },
  sig: { readonly sigName: string; readonly sigCo: string; readonly sigMail: string },
  legal: string,
  identity: string,
): string {
  return [
    t.greet,
    "",
    t.p1,
    links.cta,
    "",
    t.p2,
    "",
    t.unsubTxt,
    links.unsub,
    "",
    sig.sigName,
    sig.sigCo,
    sig.sigMail,
    "",
    `${legal} ${links.privacy}`,
    identity,
  ].join("\n");
}

/**
 * The correction letter as a sendable draft, built on the cold letter's own draft of the same prospect (its links,
 * signature, legal line and identity — one source with the cold letter). Every part the HTML shows is in the body.
 */
export function fixLetterDraft(base: OutreachDraft, leadName: string, lang: string): OutreachDraft {
  // a foreign letter's own strings are measured: a Hungarian fallback holds it („Bábelre vár”), like the cold letter
  const { value: t, fallbacks } = collectFallbacks(() => fixLetterText(lang, leadName));
  const bp = base.parts;
  const body = composeFixBody(t, { cta: base.link, unsub: base.unsubscribeLink, privacy: base.privacyLink }, bp, bp.legal, bp.identity);
  const { whyLink: _why, untranslated: _u, ...rest } = base;
  void _why;
  void _u;
  return {
    ...rest,
    ...(fallbacks.length ? { untranslated: fallbacks } : {}),
    subject: t.subject,
    body,
    parts: {
      greet: t.greet,
      hook: t.p1,
      p1: t.p2,
      p2: "",
      p3: "",
      p4: "",
      priceList: "",
      priceOffer: "",
      percent: "",
      sigName: bp.sigName,
      sigCo: bp.sigCo,
      sigMail: bp.sigMail,
      fine: "",
      unsubTxt: t.unsubTxt,
      legal: bp.legal,
      identity: bp.identity,
      planCount: bp.planCount,
    },
  };
}
