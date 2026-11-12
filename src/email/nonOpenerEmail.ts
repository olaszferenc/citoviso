// ADR-XXXX — the ONE follow-up letter to a lead who never opened the outreach link (owner,
// 2026-11-12: „ezt a verziót 2 hét után küldenénk azoknak, akik nem nyitották meg … ha nem a
// duma hanem a képpel indulna”). Frozen plan: assets/design-refs/console/nem-nyito-level/.
//
// What the approved plan BINDS (README there):
//   · subject = "<lead name> – közvetlen foglalás / érdeklődés" (the owner's own wording, refined
//     with direct bookability);
//   · the visible From is a PERSON (OUTREACH_FOLLOWUP_SENDER_NAME — owner: „ne citoviso legyen a
//     látható küldő hanem a nevem”), and the signature carries the same name;
//   · NO marketing preheader („a tárgya alatti marketing bullshit nem kell”): the hidden preview
//     text is the letter's own first lines (salutation + first sentence), so the inbox shows what
//     a personal letter would;
//   · the letter OPENS WITH THE IMAGE (the plan's first screen, linked), then the salutation, the
//     owner's two paragraphs, one button + the bare URL, the cold letter's price box, signature,
//     and the cold letter's legal footer.
//
// Same rules as the other outreach renderers: Outlook-safe tables (scripts/outlook-lint.mts),
// the MSO ghost table, and the §I consistency guard — the HTML shows nothing the gated text
// does not carry.

import path from "node:path";
import { T } from "../i18n/mail.js";
import { config } from "../config.js";
import { bandBrand, esc } from "./platformLayout.js";
import type { EmailAttachment, EmailMessage } from "./sender.js";

export const NON_OPENER_HERO_CID = "hero-terv";

export interface NonOpenerLetterInput {
  readonly lang: string;
  readonly leadName: string;
  /** How many plans the link shows (1–3) — the sentence and the button follow it. */
  readonly planCount: number;
  /** The trial length the linked page offers; null = no trial, no word of one. */
  readonly trialDays: number | null;
  /** The person the letter is from (From display name + signature). */
  readonly senderName: string;
  /** The cold letter's parts this letter reuses unchanged (price box, signature company line,
   *  legal footer) — ONE source, so the two letters cannot quote different numbers. */
  readonly cold: {
    readonly priceList: string;
    readonly priceOffer: string;
    readonly percent: string;
    readonly sigCo: string;
    readonly sigMail: string;
    readonly fine: string;
    readonly unsubTxt: string;
    readonly legal: string;
    readonly identity: string;
  };
  /** cta = the lead's link already carrying the `?f` channel letter. */
  readonly links: { readonly cta: string; readonly unsub: string; readonly privacy: string };
}

export interface NonOpenerParts {
  readonly subject: string;
  readonly greet: string;
  readonly p1: string;
  readonly p2: string;
  readonly planNote: string | null;
  readonly cta: string;
  readonly heroAlt: string;
  readonly headerTag: string;
  readonly offerTitle: string;
  readonly priceListTxt: string;
  readonly priceOfferTxt: string;
  readonly p3: string;
  readonly regards: string;
  readonly sigName: string;
  readonly sigCo: string;
  readonly sigMail: string;
  readonly fine: string;
  readonly unsubTxt: string;
  readonly legal: string;
  readonly identity: string;
  readonly percent: string;
}

export interface NonOpenerLetter {
  readonly subject: string;
  readonly body: string;
  readonly parts: NonOpenerParts;
  /** The hidden preview text — the letter's own first lines, nothing added. */
  readonly preheader: string;
  readonly fromName: string;
  readonly link: string;
  readonly unsubscribeLink: string;
  readonly privacyLink: string;
}

export function nonOpenerParts(i: NonOpenerLetterInput): NonOpenerParts {
  const lang = i.lang;
  const n = Math.max(1, Math.min(3, Math.round(i.planCount)));
  const p2 =
    n === 1
      ? i.trialDays
        ? T(lang, "Érdekli a megoldásunk? Készítettünk Önnek egy honlaptervet, amit {days} napig ingyen próbára tehet.", { days: i.trialDays })
        : T(lang, "Érdekli a megoldásunk? Készítettünk Önnek egy honlaptervet.")
      : i.trialDays
        ? T(lang, "Érdekli a megoldásunk? Készítettünk Önnek {n} honlaptervet, amit {days} napig ingyen próbára tehet.", { n, days: i.trialDays })
        : T(lang, "Érdekli a megoldásunk? Készítettünk Önnek {n} honlaptervet.", { n });
  return {
    subject: T(lang, "{name} – közvetlen foglalás / érdeklődés", { name: i.leadName }),
    greet: T(lang, "Tisztelt {name}!", { name: i.leadName }),
    p1: T(
      lang,
      "Ha a saját honlapján keresztül tudnának a vendégei foglalni, a közvetítői portálok (pl. a Booking.com) jutalékát megspórolhatná. Velünk a különböző foglalási naptárak összehangolásával sem kell foglalkoznia.",
    ),
    p2,
    planNote: n >= 2 ? T(lang, "A képen az első terv látható — a többit a linken találja.") : null,
    cta: n >= 2 ? T(lang, "Megnézem a terveket") : T(lang, "Megnézem a tervet"),
    heroAlt: T(lang, "A honlap-terv nyitóképe"),
    headerTag: T(lang, "Előzetes látványterv"),
    offerTitle: T(lang, "Bemutatkozó ajánlat"),
    priceListTxt: T(lang, "{price} Ft/hó", { price: i.cold.priceList }),
    priceOfferTxt: T(lang, "{price} Ft/hó-tól", { price: i.cold.priceOffer }),
    // The price box as a sentence — the plain-text part's twin of the navy box (§I).
    p3: T(lang, "Bemutatkozó ajánlat: {offer} Ft/hó-tól (listaár {list} Ft/hó, −{percent}%).", {
      offer: i.cold.priceOffer,
      list: i.cold.priceList,
      percent: i.cold.percent,
    }),
    regards: T(lang, "Üdvözlettel,"),
    sigName: i.senderName,
    sigCo: i.cold.sigCo,
    sigMail: i.cold.sigMail,
    fine: i.cold.fine,
    unsubTxt: i.cold.unsubTxt,
    legal: i.cold.legal,
    identity: i.cold.identity,
    percent: i.cold.percent,
  };
}

/** The plain-text part, composed from the SAME parts the HTML renders (§I). */
export function composeNonOpenerText(t: NonOpenerParts, l: NonOpenerLetterInput["links"]): string {
  return [
    t.greet,
    "",
    t.p1,
    "",
    t.p2,
    "",
    `${t.cta}: ${l.cta}`,
    "",
    ...(t.planNote ? [t.planNote, ""] : []),
    t.p3,
    "",
    t.regards,
    t.sigName,
    t.sigCo,
    t.sigMail,
    "",
    t.fine,
    "",
    `${t.unsubTxt}\n${l.unsub}`,
    "",
    `${t.legal} ${l.privacy}`,
    "",
    t.identity,
  ].join("\n");
}

export function renderNonOpenerLetter(i: NonOpenerLetterInput): NonOpenerLetter {
  const parts = nonOpenerParts(i);
  return {
    subject: parts.subject,
    body: composeNonOpenerText(parts, i.links),
    parts,
    preheader: `${parts.greet} ${parts.p1}`,
    fromName: i.senderName,
    link: i.links.cta,
    unsubscribeLink: i.links.unsub,
    privacyLink: i.links.privacy,
  };
}

// Brand constants COPIED from citui.css — a mail client has no var() (src/email/ is outside
// the design-token-lint chain for exactly this reason; the cold letter's rule).
const NAVY = "#0e2a47";
const NAVY_DEEP = "#0a1f36";
const CYAN = "#1fb6d6";
const INK = "#10243a";
const MUTED = "#60748b";
const FOOT = "#8a97a5";
const LINE = "#e3ecf2";
const PAGE_BG = "#eef2f6";
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif";
const W = 600;
const PAD = 20;

function tbl(attrs: string, inner: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${attrs}>${inner}</table>`;
}

function para(text: string, extra = ""): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};font-family:${FONT}${extra}">${esc(text)}</p>`;
}

/** The hidden preview text + a filler, so the client does not append the header label or the
 *  image alt text after it. */
function preheaderHtml(text: string): string {
  return (
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE_BG}">` +
    esc(text) +
    "&zwnj;&nbsp;".repeat(90) +
    `</div>`
  );
}

function letterHtml(heroSrc: string | null, letter: NonOpenerLetter, brand: string): string {
  const t = letter.parts;
  const header =
    `<tr><td style="padding:16px ${PAD}px 12px;border-bottom:2px solid ${CYAN}">` +
    tbl(
      `width="100%"`,
      `<tr>` +
        `<td align="left" style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:2px;color:${NAVY};text-transform:uppercase">${brand}</td>` +
        `<td align="right" style="font-family:${FONT};font-size:10px;letter-spacing:1.5px;color:${MUTED};text-transform:uppercase">${esc(t.headerTag)}</td>` +
        `</tr>`,
    ) +
    `</td></tr>`;
  // THE IMAGE FIRST (the approved plan's point): right under the header, linked.
  const hero = heroSrc
    ? `<tr><td style="padding:16px ${PAD}px 0">` +
      `<a href="${esc(letter.link)}" style="text-decoration:none">` +
      `<img src="${heroSrc}" alt="${esc(t.heroAlt)}" width="${W - 2 * PAD}" ` +
      `style="display:block;width:100%;max-width:${W - 2 * PAD}px;height:auto;border:1px solid ${LINE}" border="0"></a>` +
      (t.planNote
        ? `<div style="padding:8px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED}">${esc(t.planNote)}</div>`
        : "") +
      `</td></tr>`
    : "";
  const intro =
    `<tr><td style="padding:18px ${PAD}px 0">` +
    para(t.greet, ";font-size:17px;line-height:1.55") +
    para(t.p1) +
    para(t.p2, ";font-weight:600") +
    `</td></tr>`;
  // bgcolor ON THE TD — Outlook can drop the CSS background of the link.
  const cta =
    `<tr><td style="padding:14px ${PAD}px 6px">` +
    tbl(
      `cellpadding="0"`,
      `<tr><td bgcolor="${NAVY}" style="background:${NAVY};border-radius:8px">` +
        `<a href="${esc(letter.link)}" style="display:block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(t.cta)}</a>` +
        `</td></tr>`,
    ) +
    `</td></tr>`;
  // The bare URL under the button is a TRUST element in a cold letter (ADR-0101 ③).
  const rawUrl = `<tr><td style="padding:0 ${PAD}px 16px;font-family:${FONT};font-size:12px;line-height:1.5;color:${FOOT};word-break:break-all">${esc(letter.link)}</td></tr>`;
  const priceBox =
    `<tr><td style="padding:2px ${PAD}px 18px">` +
    tbl(
      `width="100%" bgcolor="${NAVY_DEEP}"`,
      `<tr><td style="background:${NAVY_DEEP};border-radius:10px;padding:16px 18px;font-family:${FONT}">` +
        `<span style="font-size:12px;letter-spacing:1px;color:${CYAN};text-transform:uppercase">${esc(t.offerTitle)}</span><br>` +
        `<span style="font-size:15px;color:#a9bdd0;text-decoration:line-through">${esc(t.priceListTxt)}</span> ` +
        `<span style="font-size:24px;font-weight:700;color:#ffffff">${esc(t.priceOfferTxt)}</span> ` +
        `<span style="font-size:12px;font-weight:700;color:${CYAN}">&nbsp;−${esc(t.percent)}%</span>` +
        `</td></tr>`,
    ) +
    `</td></tr>`;
  const signature =
    `<tr><td style="padding:4px ${PAD}px 0">` +
    `<div style="padding-top:16px;border-top:1px solid ${LINE}">` +
    `<p style="margin:0 0 4px;font-family:${FONT};font-size:15px;color:${INK}">${esc(t.regards)}</p>` +
    `<p style="margin:0;font-family:${FONT};font-size:15px;font-weight:600;color:${INK}">${esc(t.sigName)}</p>` +
    `<p style="margin:2px 0 0;font-family:${FONT};font-size:13px;color:${MUTED}">${esc(t.sigCo)} · ` +
    `<span style="color:${MUTED}">${esc(t.sigMail)}</span></p></div></td></tr>`;
  const footer =
    `<tr><td style="padding:18px ${PAD}px 22px">` +
    `<div style="padding-top:14px;border-top:1px solid ${LINE};font-family:${FONT};font-size:12px;line-height:1.6;color:${FOOT}">` +
    `<p style="margin:0 0 8px">${esc(t.fine)}</p>` +
    `<p style="margin:0 0 8px">${esc(t.unsubTxt)}<br><a href="${esc(letter.unsubscribeLink)}" style="color:${FOOT}">${esc(letter.unsubscribeLink)}</a></p>` +
    `<p style="margin:0 0 8px">${esc(t.legal)} <a href="${esc(letter.privacyLink)}" style="color:${FOOT}">${esc(letter.privacyLink)}</a></p>` +
    `<p style="margin:0">${esc(t.identity)}</p>` +
    `</div></td></tr>`;
  const inner = tbl(
    `width="100%" style="width:100%;max-width:${W}px;background:#ffffff" bgcolor="#ffffff"`,
    header + hero + intro + cta + rawUrl + priceBox + signature + footer,
  );
  return tbl(
    `width="100%" bgcolor="${PAGE_BG}" style="background:${PAGE_BG}"`,
    `<tr><td align="center" style="padding:0">` +
      `<!--[if mso]><table role="presentation" width="${W}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
      inner +
      `<!--[if mso]></td></tr></table><![endif]-->` +
      `</td></tr>`,
  );
}

/**
 * The sendable e-mail. Call ONLY after the §C gate passed on `letter` — this renders, it does
 * not judge. Without a hero shot the letter is NOT built: the image is the letter's point, and
 * the sender skips such a lead instead (nonOpenerFollowup.ts).
 */
export function buildNonOpenerEmail(
  letter: NonOpenerLetter,
  to: string,
  opts: { heroShotPath: string; lang?: string },
): EmailMessage {
  // ⛔ §I CONSISTENCY GUARD: every sentence the HTML (and the preview text) shows must be in
  // the gated text.
  const t = letter.parts;
  const shown = [
    t.greet, t.p1, t.p2, t.planNote, t.p3, t.regards, t.sigName, t.sigCo, t.sigMail, t.fine,
    t.unsubTxt, t.legal, t.identity, t.cta,
  ].filter((s): s is string => Boolean(s));
  for (const s of shown) {
    if (!letter.body.includes(s)) {
      throw new Error(
        `nem-nyitó utánkövető levél: a HTML olyat állítana, ami a kapuzott szövegben NINCS benne („${s.slice(0, 60)}”) — nem küldjük`, // i18n-exempt: fejlesztői kivétel-üzenet, sosem éri el a vevőt
      );
    }
  }
  if (letter.preheader !== `${t.greet} ${t.p1}`) {
    throw new Error("nem-nyitó utánkövető levél: az előnézeti szöveg nem a levél saját első sora — nem küldjük"); // i18n-exempt: fejlesztői kivétel-üzenet, sosem éri el a vevőt
  }
  const brand = bandBrand();
  const html =
    `<!DOCTYPE html><html lang="${opts.lang || "hu"}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:${PAGE_BG}">` +
    preheaderHtml(letter.preheader) +
    letterHtml(`cid:${NON_OPENER_HERO_CID}`, letter, brand.html) +
    `</body></html>`;
  const list: EmailAttachment[] = [
    ...brand.attachments,
    {
      filename: path.basename(opts.heroShotPath),
      path: opts.heroShotPath,
      cid: NON_OPENER_HERO_CID,
      contentType: "image/png",
    },
  ];
  // The List-Unsubscribe header follows the cold letter's switch (ADR-0069).
  const headers = config.outreachListUnsubscribe
    ? { "List-Unsubscribe": `<${letter.unsubscribeLink}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;
  return {
    to,
    audience: "platform",
    fromName: letter.fromName,
    subject: letter.subject,
    text: letter.body,
    html,
    ...(headers ? { headers } : {}),
    attachments: list,
  };
}

/** Render-only HTML with an explicit image source (the plan freezer + the guard). */
export function nonOpenerHtmlFor(letter: NonOpenerLetter, heroSrc: string | null, brandHtml: string): string {
  return preheaderHtml(letter.preheader) + letterHtml(heroSrc, letter, brandHtml);
}
