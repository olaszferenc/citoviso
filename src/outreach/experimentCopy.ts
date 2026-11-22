// KÍSÉRLET-MOTOR — the wording of the code-defined variants (ADR-0462; texts from the coordinator
// citb64f0ed0, 2026-11-22, the owner's final approval pending). Every sentence goes through T() so
// Bábel can translate it; experiments run on Hungarian letters only (assignVariants).
//
//   subject   ez_az_on_szallasa — „Ez az Ön szállása? ({név}, {település})”, without a town „… ({név})”
//   body_style szemelyes        — the PERSONAL letter, first person singular: no logo, no button, no box,
//                                 and no inbox line above it — its first visible text is the greeting
//   price_line mondat           — „Bemutatkozó áron havi {offerPrice} Ft-tól.” — ONLY with the
//                                 personal body: the from-price is the base package WITHOUT booking,
//                                 so it must never stand next to the boxed letter's booking/commission
//                                 promise (coordinator, 2026-11-22)
//   sender    szemelyes         — the From display name = OUTREACH_FOLLOWUP_SENDER_NAME (never hardcoded)
//
// The personal letter is expressed as OutreachParts (greet · hook = intro · p1 = proof · p2 = no-work
// promise · p3 = price · p4 = „not mine”), so the §I guard (every part in the gated body) and the
// §C gate judge it exactly like today's letter. composePersonalBody is its plain-text body.

import { T } from "../i18n/mail.js";
import { formatNumber } from "../text/money.js";
import { config } from "../config.js";
import { MIN_QUOTED_STARS, type DraftInput, type OutreachDraft, type OutreachParts } from "./draft.js";

/** The personal sender's name (config), or "" when unset → the personal variants do not apply. */
export function personalSenderName(): string {
  return (config.outreachFollowupSenderName || "").trim();
}

export function subjectIsThisYours(lang: string, name: string, city: string | null | undefined): string {
  const town = (city ?? "").trim();
  return town ? T(lang, "Ez az Ön szállása? ({name}, {city})", { name, city: town }) : T(lang, "Ez az Ön szállása? ({name})", { name });
}

export function priceSentence(lang: string, offerPrice: string): string {
  return T(lang, "Bemutatkozó áron havi {offerPrice} Ft-tól.", { offerPrice });
}

/** The first-person proof sentence — the same rules as draft.ts hookText (stars from 4,0, measured site check). */
export function personalProof(d: DraftInput): string {
  const seg = d.segment ?? "";
  const quotes = Boolean(d.rating?.count) && (d.rating?.value ?? 0) >= MIN_QUOTED_STARS;
  const kind =
    seg === "elavult" && d.siteCheck === "unreachable"
      ? "unreachable"
      : seg === "elavult" && d.siteCheck === "no_viewport"
        ? "no_viewport"
        : seg === "elavult" || seg === "van_labnyom"
          ? "seen"
          : "none";
  if (quotes) {
    const v = { count: formatNumber(d.rating!.count), stars: String(d.rating!.value).replace(".", ",") };
    if (kind === "unreachable") return T(d.lang, "A Google-on {count} értékelés alapján {stars} csillagos a ház, a honlapját viszont nem tudtam megnyitni, amikor megnéztem.", v);
    if (kind === "no_viewport") return T(d.lang, "A Google-on {count} értékelés alapján {stars} csillagos a ház, a mostani honlapja viszont nincs telefonra igazítva.", v);
    if (kind === "seen") return T(d.lang, "A Google-on {count} értékelés alapján {stars} csillagos a ház, a mostani honlapját is megnéztem.", v);
    return T(d.lang, "A Google-on {count} értékelés alapján {stars} csillagos a ház, saját honlapot viszont nem találtam, ezért megcsináltam.", v);
  }
  const obs =
    kind === "unreachable"
      ? T(d.lang, "A honlapját viszont nem tudtam megnyitni, amikor megnéztem.")
      : kind === "no_viewport"
        ? T(d.lang, "A mostani honlapja viszont nincs telefonra igazítva.")
        : kind === "seen"
          ? T(d.lang, "A mostani honlapját is megnéztem.")
          : T(d.lang, "Saját honlapot viszont nem találtam.");
  return T(d.lang, "Átnéztem a nyilvánosan elérhető adatait. {obs}", { obs });
}

/**
 * The personal letter's parts. `priceLine`: undefined = today's price sentence (with its discount
 * footnote), "" = none, a string = that sentence. `host` = the cold host for the signature line.
 */
export function personalParts(d: DraftInput, base: OutreachDraft, priceLine: string | undefined, senderName: string, host: string): OutreachParts {
  const keepToday = priceLine === undefined;
  return {
    ...base.parts,
    greet: T(d.lang, "Tisztelt {name}!", { name: d.leadName }),
    hook: T(d.lang, "Elkészítettem a szállása honlapját; még nem nyilvános, egyelőre csak Ön látja. Nem kép, hanem működő oldal, telefonon is:"),
    p1: personalProof(d),
    p2: T(d.lang, "Ha tetszik, Önnek semmit nem kell beállítania: a kollégám megcsinálja, Ön csak jóváhagyja."),
    p3: keepToday ? base.parts.p3 : priceLine,
    p4: T(d.lang, "Ha nem Ön a gazda, egy „nem”-et írjon vissza, és nem keresem többet."),
    trial: undefined,
    sigName: senderName,
    sigCo: `Citoviso · ${host}`,
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
    t.p2,
    "",
    ...(t.p3 ? [t.p3, ""] : []),
    t.p4,
    "",
    T(lang, "Üdvözlettel,"),
    t.sigName,
    t.sigCo,
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
