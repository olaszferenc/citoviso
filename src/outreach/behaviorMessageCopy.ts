// ADR-0439 — the BEHAVIOUR MESSAGE copy: the SMS and the e-mail the lead gets ONCE, when they act
// on their plan page (came back · opened „Árak és rendelés” · pressed the trial button and did not
// send it). Frozen plan: assets/design-refs/console/viselkedes-uzenet/ (variant A; README = what BINDS).
//
// PURE: every fact is an input (name, link, price, trial days, trial host, plan count, sender
// identity) — read by the caller from its one source each (buildDraftForProspect, helperPersona,
// advertiserIdentity). No LLM, no per-visit API call: the text is deterministic.
//
// What the copy may NOT say (owner 2026-11-11 + the plan's „Közös” block):
//   · no "we saw you looking" — the message answers the step, it does not report it;
//   · no urgency, no expiring discount — and NO discount at all: the escalation offer (−30 %, 72 h)
//     stays on the page, and a message quoting a different number would contradict it (§I);
//   · no „Ha nem érdekli, írja vissza: NEM” — a reply is not an automatic opt-out; the opt-out is
//     on the linked page (ADR-0112), and in the mail as the unsubscribe line;
//   · no promise to forward guest enquiries by SMS (kerdes-inditas, 2026-11-12) and no company
//     phone number (owner: removed everywhere).
// The SMS is accent-free GSM-7 (owner 2026-11-11) and at most BEHAVIOR_SMS_MAX_SEGMENTS long; a
// long name is shortened, the link is never cut.

import { T } from "../i18n/mail.js";
import { config } from "../config.js";
import { smsEncoding, toGsm7 } from "../sms/encoding.js";
import { esc, mailButton, mailNote, mailPara, platformMail } from "../email/platformLayout.js";
import type { EmailMessage } from "../email/sender.js";
import { helperSignature, signatureBlock } from "../email/signature.js";

export type BehaviorTrigger = "return" | "price" | "start";

/** Strongest first: when several happened, the message answers the strongest step. */
export const BEHAVIOR_TRIGGER_RANK: readonly BehaviorTrigger[] = ["start", "price", "return"];

/** The kerdes-inditas anchors (frozen: assets/design-refs/prospect-page/kerdes-inditas/README.md). */
export const BEHAVIOR_ANCHOR: Readonly<Record<BehaviorTrigger, string>> = {
  return: "#kerdes",
  price: "?k=ar#ar",
  start: "#inditas",
};

/** An SMS may cost at most this many segments (GSM-7: 2 × 153 characters). */
export const BEHAVIOR_SMS_MAX_SEGMENTS = 2;

/**
 * The lead's tracked link with the step's anchor. The link is the cold message's own (the lead's
 * preview subdomain, or /p/<slug>/<token> off-platform): a bare host gets its "/" first, so the
 * query/hash lands on the page path ("https://x.citoviso.com/?k=ar#ar").
 */
export function anchoredLink(link: string, trigger: BehaviorTrigger): string {
  const base = /^https?:\/\/[^/]+$/i.test(link) ? `${link}/` : link;
  return `${base}${BEHAVIOR_ANCHOR[trigger]}`;
}

/** The facts one message may state. */
export interface BehaviorCopyInput {
  readonly lang: string;
  readonly leadName: string;
  readonly trigger: BehaviorTrigger;
  /** The tracked link WITHOUT the anchor (the cold message's link). */
  readonly link: string;
  /** Formatted from-price of the cheapest offered package ("2 780"); required for 'price'. */
  readonly priceList: string | null;
  /** The trial length the page offers (trialDaysOnOffer); required for 'start'. */
  readonly trialDays: number | null;
  /** How many plans the link carries (1–3) — the mail's „tervével / terveivel”. */
  readonly planCount: number;
}

/**
 * The step the message can truthfully answer: 'start' needs a trial the page offers, 'price' a
 * price the page shows — otherwise it falls back to the next one (the question panel is always there).
 */
export function effectiveTrigger(t: BehaviorTrigger, facts: { priceList: string | null; trialDays: number | null }): BehaviorTrigger {
  if (t === "start" && !facts.trialDays) return facts.priceList ? "price" : "return";
  if (t === "price" && !facts.priceList) return "return";
  return t;
}

export interface BehaviorSms {
  readonly text: string;
  readonly link: string;
  /** The name as the message carries it (GSM-7, possibly shortened) — what the §C gate checks. */
  readonly name: string;
  readonly segments: number;
  /** The step the text answers (effectiveTrigger). */
  readonly trigger: BehaviorTrigger;
}

function smsBody(lang: string, trigger: BehaviorTrigger, name: string, mark: string, price: string | null, days: number | null): string {
  if (trigger === "price") {
    return T(lang, "{name}: a honlap-terve havi {price} Ft-tól indul. Hogy mi van benne és mi nem, itt látja: {link} Citoviso", {
      name,
      price: price ?? "",
      link: mark,
    });
  }
  if (trigger === "start") {
    return T(lang, "{name}: a honlap-tervéből egy kattintással élő honlap lesz, {days} napig ingyen, kártya nélkül. {link} Citoviso", {
      name,
      days: String(days ?? ""),
      link: mark,
    });
  }
  return T(lang, "{name}: ha a honlap-tervével kapcsolatban kérdése van, a terv alján azonnal választ kap rá. {link} Citoviso", {
    name,
    link: mark,
  });
}

/** The accent-free SMS. The link is substituted after the GSM-7 fold, byte for byte. */
export function buildBehaviorSms(input: BehaviorCopyInput): BehaviorSms {
  const trigger = effectiveTrigger(input.trigger, input);
  const link = anchoredLink(input.link, trigger);
  const MARK = "@@LINK@@";
  const build = (name: string): string =>
    toGsm7(smsBody(input.lang, trigger, name, MARK, input.priceList, input.trialDays)).replace(MARK, link);
  const fits = (t: string): boolean => smsEncoding(t).segments <= BEHAVIOR_SMS_MAX_SEGMENTS;
  let name = input.leadName;
  let text = build(name);
  for (let n = [...input.leadName].length - 1; !fits(text) && n > 8; n--) {
    name = `${[...input.leadName].slice(0, n).join("").trimEnd()}...`;
    text = build(name);
  }
  return { text, link, name: toGsm7(name), segments: smsEncoding(text).segments, trigger };
}

export interface BehaviorMailInput extends BehaviorCopyInput {
  readonly to: string;
  /** The trial site's promised host (trialCampaignHost) — 'start' names it, else unused. */
  readonly trialHost: string | null;
  readonly unsubscribeLink: string;
  readonly privacyLink: string;
  /** advertiserIdentity(lang) — „A megkeresés küldője: …” (§C.2). */
  readonly identity: string;
  /** The local helper's name (helperPersona), or null → team signature. */
  readonly helperName: string | null;
  readonly fromName: string;
  /** config.outreachListUnsubscribe — add the List-Unsubscribe / One-Click headers. */
  readonly listUnsubscribe?: boolean;
}

export interface BehaviorMail {
  readonly message: EmailMessage;
  /** What the §C gate judges (checkOutreachDraft's CheckableLetter). */
  readonly letter: {
    readonly subject: string;
    readonly body: string;
    readonly link: string;
    readonly unsubscribeLink: string;
    readonly privacyLink: string;
    readonly parts: { readonly identity: string };
  };
  readonly trigger: BehaviorTrigger;
}

/** The e-mail: one paragraph, one button, the helper's signature, the opt-out and the identity. */
export function buildBehaviorMail(input: BehaviorMailInput): BehaviorMail {
  const { lang, leadName: name } = input;
  const trigger = effectiveTrigger(input.trigger, input);
  const link = anchoredLink(input.link, trigger);
  const many = input.planCount > 1;
  let subject: string;
  let heading: string;
  let para: string;
  let button: string;
  if (trigger === "price") {
    subject = T(lang, "{name} – mennyibe kerül a honlap?", { name });
    heading = T(lang, "Mennyibe kerül a honlap?");
    para =
      T(lang, "A honlap-terve havi {price} forinttól indul (a legkisebb csomag listaára).", { price: input.priceList ?? "" }) +
      " " +
      T(lang, "Hogy pontosan mi van benne, mi kerül pluszba, és lemondható-e, a terv alján egy helyen megtalálja — és ha más kérdése van, ott azonnal választ kap.");
    button = T(lang, "Mi van benne?");
  } else if (trigger === "start") {
    subject = T(lang, "{name} – egy kattintással elindul", { name });
    heading = T(lang, "Egy kattintással elindul");
    para =
      (input.trialHost
        ? T(lang, "A honlap-tervéből egy kattintással élő honlap lesz a saját címén ({host}), és {days} napig ingyen fut, kártya nélkül.", {
            host: input.trialHost,
            days: String(input.trialDays ?? ""),
          })
        : T(lang, "A honlap-tervéből egy kattintással élő honlap lesz a saját címén, és {days} napig ingyen fut, kártya nélkül.", {
            days: String(input.trialDays ?? ""),
          })) +
      " " +
      T(lang, "A próba végén Ön dönt, folytatja-e.");
    button = T(lang, "Elindítom");
  } else {
    subject = T(lang, "{name} – kérdése van a tervvel?", { name });
    heading = T(lang, "Kérdése van a tervvel?");
    para = input.trialDays
      ? many
        ? T(lang, "Ha a honlap-terveivel kapcsolatban kérdése van — mennyibe kerül, mi van benne, mi lesz a próba után —, a terv alján a „Kérdése van?” résznél azonnal választ kap rá, várakozás nélkül.")
        : T(lang, "Ha a honlap-tervével kapcsolatban kérdése van — mennyibe kerül, mi van benne, mi lesz a próba után —, a terv alján a „Kérdése van?” résznél azonnal választ kap rá, várakozás nélkül.")
      : many
        ? T(lang, "Ha a honlap-terveivel kapcsolatban kérdése van — mennyibe kerül, mi van benne, lemondható-e —, a terv alján a „Kérdése van?” résznél azonnal választ kap rá, várakozás nélkül.")
        : T(lang, "Ha a honlap-tervével kapcsolatban kérdése van — mennyibe kerül, mi van benne, lemondható-e —, a terv alján a „Kérdése van?” résznél azonnal választ kap rá, várakozás nélkül.");
    button = T(lang, "Kérdezek");
  }
  const greeting = T(lang, "Tisztelt {name}!", { name });
  const bye = T(lang, "Üdvözlettel:");
  const sig = input.helperName ? `${input.helperName}\n${T(lang, "Citoviso ügyfélsegítő")}` : T(lang, "A Citoviso csapata");
  const unsubTxt = T(lang, "Ha nem szeretne több levelet kapni tőlünk, egy kattintással leiratkozhat:");
  // The trial campaign's legal sentence (one translated source, jog-őr 2026-11-12): WHY they get it is the
  // plan we sent to the public business contact — never "because you looked at it" (the copy must not
  // report the visit) — plus the right to object.
  const legal = T(
    lang,
    "Ezt a levelet azért kapta, mert {when} a szálláshelye nyilvánosan közzétett üzleti elérhetőségére honlap-tervet küldtünk. Adatai kezelésének jogalapja jogos érdek (GDPR 6. cikk (1) f)). Ön bármikor tiltakozhat az adatai közvetlen üzletszerzési célú kezelése ellen: egy kattintással leiratkozhat, és ezután nem keressük. Adatkezelési tájékoztató:",
    { when: T(lang, "korábban") },
  );
  const body =
    `${greeting}\n\n${para}\n\n${button}: ${link}\n\n${bye}\n${sig}\n\n` +
    `---\n${unsubTxt} ${input.unsubscribeLink}\n${legal} ${input.privacyLink}\n${input.identity}\n`;
  // ADR-XXXX: the approved variant-A signature block (src/email/signature.ts).
  const sigBlock = signatureBlock(helperSignature(input.helperName, lang, config.supportEmail, bye));
  const mail = platformMail({
    to: input.to,
    subject,
    text: body,
    lang,
    heading,
    greeting,
    siteName: null,
    ownerLogin: false,
    blocks: [
      mailPara(esc(para)),
      mailButton(link, button),
      sigBlock.html,
      mailNote(
        `${esc(unsubTxt)} <a href="${esc(input.unsubscribeLink)}">${esc(input.unsubscribeLink)}</a><br>` +
          `${esc(legal)} <a href="${esc(input.privacyLink)}">${esc(input.privacyLink)}</a><br>${esc(input.identity)}`,
      ),
    ],
    attachments: sigBlock.attachments,
  });
  // The List-Unsubscribe header follows the cold letter's switch (ADR-0069), as the trial campaign's.
  const headers = input.listUnsubscribe
    ? { "List-Unsubscribe": `<${input.unsubscribeLink}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;
  return {
    message: { ...mail, fromName: input.fromName, ...(headers ? { headers } : {}) },
    letter: { subject, body, link, unsubscribeLink: input.unsubscribeLink, privacyLink: input.privacyLink, parts: { identity: input.identity } },
    trigger,
  };
}
