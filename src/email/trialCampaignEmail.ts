// ADR-0348 — the RETROACTIVE trial letter: "{name}: {days} napig ingyen, élesben", sent once to
// the leads that already received the cold outreach, plus its accent-free SMS twin for the
// mobile-only ones.
//
// Approved design (owner, 2026-10-09, §2b): variant "C · Személyes" + "SMS" of the proba-E mock,
// with the sentence "Helyezést nem ígérünk." REMOVED (also from the Google bullet). The frozen
// contract is assets/design-refs/console/proba-visszamenoleges-level/ (README = what BINDS).
//
// SINGLE SOURCE OF TRUTH (§I, the cold letter's rule, outreachEmail.ts): the HTML and the
// plain-text part render the SAME named parts — the text is COMPOSED from them, and the
// builder refuses to render HTML that states a part the text lacks.
//
// ⛔ OUTLOOK-SAFE MARKUP, the same discipline as the cold letter: every structure is a
// <table>, the fixed 600px wrapper goes to Outlook only (MSO ghost table), no float/flex/grid,
// max-width only on tables and images. Structural guard: scripts/outlook-lint.mts (this
// letter is on its list).
//
// The builder is PURE: the sender's identity, the legal-entity line and every number (trial
// days, retention days, the offer percent) are inputs — read by the caller from the one source
// each (senderParts/advertiserIdentity, getFreeTrialConfig, TRIAL_RETENTION_DAYS,
// trialCampaignOfferPercent — the rule pinTrialOffer applies at trial start).
//
// ADR-0354 "C" (owner-approved 2026-10-10, assets/design-refs/console/proba-c/3-levelek-sms.html):
// the lead's earlier offer STAYS during the trial (to its end, on the first fee — never "instead
// of" the trial); the opening is one sentence (Elek #22); TWO buttons (Elek #10): the primary
// opens the plan with the trial form open (`forras=proba&proba=nyit`), the secondary the plan
// itself (`forras=proba`).

import path from "node:path";
import { T } from "../i18n/mail.js";
import { huArticleLower } from "../hu.js";
import { config } from "../config.js";
import { formatDayShortOn, formatMonthDayOn } from "../text/day.js";
import { smsEncoding, toGsm7 } from "../sms/encoding.js";
import { bandBrand, esc } from "./platformLayout.js";
import { boldVars } from "./trialEmail.js";
import type { EmailAttachment, EmailMessage } from "./sender.js";

/** CID of the embedded hero screenshot — the same image the cold letter carried. */
export const TRIAL_CAMPAIGN_HERO_CID = "hero-terv";

/**
 * The three "mi tartja vissza?" answers the letter offers as one-tap links, in the approved
 * order. ONE list for the mail and for the page the links open: only these values may arrive
 * PRE-SELECTED there (src/console/prospectFeedback.ts) — any other `ok=` is ignored.
 */
export const TRIAL_MAIL_REASONS = ["expensive", "not_now", "distrust"] as const;
export type TrialMailReason = (typeof TRIAL_MAIL_REASONS)[number];

export function isTrialMailReason(v: unknown): v is TrialMailReason {
  return typeof v === "string" && (TRIAL_MAIL_REASONS as readonly string[]).includes(v);
}

/** The why-link of one answer: the unsubscribe link's sibling (same /p/<slug>/<token> path,
 *  like the escalation follow-up's), with the campaign marker and the pre-selected answer. */
export function trialWhyLink(unsubscribeLink: string, reason: TrialMailReason): string {
  return `${unsubscribeLink.replace(/\/unsubscribe$/, "/why")}?forras=proba&ok=${reason}`;
}

export interface TrialCampaignLetterInput {
  readonly lang: string;
  readonly leadName: string;
  /** Budapest ISO day the cold outreach went out on this channel. */
  readonly sentIso: string;
  /** getFreeTrialConfig().days */
  readonly days: number;
  /** The trial site's promised host (plannedSiteSlug + platform domain, ADR-0347 ④). */
  readonly host: string;
  /** TRIAL_RETENTION_DAYS (ADR-0345). */
  readonly retentionDays: number;
  /** The lead's best live initial offer today (trialCampaignOfferPercent) — null (or 0%) =
   *  the offer sentence is left out. */
  readonly coupon: { readonly percent: number } | null;
  /** senderParts() — the cold letter's signature. */
  readonly sender: { readonly sigName: string; readonly sigCo: string; readonly sigMail: string };
  /** advertiserIdentity(lang) — §C.2 registry identification. */
  readonly identity: string;
  readonly links: {
    /** The mock link AGAIN — the lead's preview subdomain (draft.link, ADR-0330). */
    readonly cta: string;
    readonly unsub: string;
    readonly privacy: string;
  };
}

/** The letter's sentences as NAMED parts (the HTML lays them out, the text joins them). */
export interface TrialCampaignParts {
  readonly subject: string;
  readonly headerTag: string;
  readonly greet: string;
  readonly p1: string;
  readonly p2: string;
  /** The primary button: try it (the plan with the trial form open). */
  readonly ctaTry: string;
  /** The secondary button: the plan itself. */
  readonly cta: string;
  readonly heroAlt: string;
  readonly whyQ: string;
  readonly whySub: string;
  readonly whyLabels: readonly { readonly reason: TrialMailReason; readonly label: string; readonly href: string }[];
  readonly getsTitle: string;
  readonly gets: readonly string[];
  /** The first bullet with the host in bold — HTML only; its plain twin is gets[0]. */
  readonly getsHostHtml: string;
  readonly end: string;
  readonly coupon: string | null;
  readonly regards: string;
  readonly sigName: string;
  readonly sigCo: string;
  readonly sigMail: string;
  readonly oneShot: string;
  readonly unsubTxt: string;
  readonly legal: string;
  readonly identity: string;
}

/** Add query parameters to a link, keeping whatever it already carries (tracking, etc.). */
export function withQuery(url: string, params: Readonly<Record<string, string>>): string {
  const hashAt = url.indexOf("#");
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const hash = hashAt >= 0 ? url.slice(hashAt) : "";
  const add = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  if (!add) return url;
  const sep = !base.includes("?") ? "?" : /[?&]$/.test(base) ? "" : "&";
  return `${base}${sep}${add}${hash}`;
}

/** The two button links (the main session's plan page reads them): the primary opens the
 *  trial form (`proba=nyit`), both say the visit came from this letter (`forras=proba`). */
export function trialCampaignLinks(planLink: string): { readonly tryLink: string; readonly planLink: string } {
  return {
    tryLink: withQuery(planLink, { forras: "proba", proba: "nyit" }),
    planLink: withQuery(planLink, { forras: "proba" }),
  };
}

function upperFirst(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("hu") + s.slice(1) : s;
}

/** Build the parts (pure). */
export function trialCampaignParts(i: TrialCampaignLetterInput): TrialCampaignParts {
  const { lang, leadName: name } = i;
  const when = formatMonthDayOn(i.sentIso, lang);
  const days = String(i.days);
  const hostSentence = (v: { host: string }): string =>
    T(lang, "A honlap élesben elérhető egy saját aldomainen: {host} (saját domain a megrendeléssel jár)", v);
  const labels: Record<TrialMailReason, string> = {
    expensive: T(lang, "Drágának találom"),
    not_now: T(lang, "Most nem időszerű"),
    distrust: T(lang, "Nem értem, vagy nem bízom benne"),
  };
  const coupon =
    i.coupon && i.coupon.percent > 0
      ? T(
          lang,
          "A korábbi levelünkben ajánlott {p}% kedvezmény a próba alatt is megmarad: ha a próba végéig megrendeli, megkapja — éves fizetésnél az első évre, havinál az első hónapra. Utána a listaár érvényes.",
          { p: String(i.coupon.percent) },
        )
      : null;
  return {
    subject: T(lang, "{name}: {days} napig ingyen, élesben", { name, days }),
    headerTag: T(lang, "Ingyenes próba"),
    greet: T(lang, "Tisztelt {name}!", { name }),
    p1: T(lang, "{when} küldtünk Önnek egy honlap-tervet.", { when: upperFirst(when) }),
    p2: T(lang, "Most nem kell rögtön döntenie: {days} napig ingyen, élesben kipróbálhatja — kártya és előfizetés nélkül.", { days }),
    ctaTry: T(lang, "Kipróbálom {days} napig ingyen", { days }),
    cta: T(lang, "Megnézem a tervemet"),
    heroAlt: T(lang, "A honlap-terv nyitóképe"),
    whyQ: T(lang, "Ha nem érdekli: mi tartja vissza?"),
    whySub: T(lang, "Egy koppintás, és megtudjuk. Ez nem leiratkozás."),
    whyLabels: TRIAL_MAIL_REASONS.map((reason) => ({
      reason,
      label: labels[reason],
      href: trialWhyLink(i.links.unsub, reason),
    })),
    getsTitle: T(lang, "Ha kipróbálja"),
    gets: [
      hostSentence({ host: i.host }),
      T(lang, "Saját szerkesztő felület: a fotókat, szövegeket, árakat Ön cseréli"),
      T(lang, "Minden funkció be van kapcsolva, az online foglalással együtt"),
      // ⛔ Owner, 2026-10-09: "Helyezést nem ígérünk." is OUT — here and everywhere in the letter.
      T(lang, "A Google számára olvasható felépítés (szállás-adatok, oldaltérkép)."),
    ],
    getsHostHtml: boldVars(hostSentence, { host: i.host }, ["host"]),
    end: T(
      lang,
      "Ha nem folytatja, a honlap szünetel, és semmit nem terhelünk. A próba-honlap adatai a próba végétől {days} napig megmaradnak, utána töröljük őket.",
      { days: String(i.retentionDays) },
    ),
    coupon,
    regards: T(lang, "Üdvözlettel,"),
    sigName: i.sender.sigName,
    sigCo: i.sender.sigCo,
    sigMail: i.sender.sigMail,
    oneShot: T(lang, "Erről a próbáról több levelet nem küldünk; ha nem kér tőlünk több megkeresést, leiratkozhat."),
    unsubTxt: T(lang, "Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat:"),
    legal: T(
      lang,
      "Ezt a levelet azért kapta, mert {when} a szálláshelye nyilvánosan közzétett üzleti elérhetőségére honlap-tervet küldtünk. Adatai kezelésének jogalapja jogos érdek (GDPR 6. cikk (1) f)). Ön bármikor tiltakozhat az adatai közvetlen üzletszerzési célú kezelése ellen: egy kattintással leiratkozhat, és ezután nem keressük. Adatkezelési tájékoztató:",
      { when },
    ),
    identity: i.identity,
  };
}

/** The plain-text letter, COMPOSED from the parts — what the §C gate judges (§I). */
export function composeTrialCampaignText(t: TrialCampaignParts, l: TrialCampaignLetterInput["links"]): string {
  const b = trialCampaignLinks(l.cta);
  return [
    t.greet,
    "",
    t.p1,
    "",
    t.p2,
    "",
    `${t.ctaTry}: ${b.tryLink}`,
    `${t.cta}: ${b.planLink}`,
    "",
    t.whyQ,
    t.whySub,
    ...t.whyLabels.map((w) => `${w.label}: ${w.href}`),
    "",
    `${t.getsTitle}:`,
    ...t.gets.map((g) => `- ${g}`),
    "",
    t.coupon ? `${t.end} ${t.coupon}` : t.end,
    "",
    t.regards,
    t.sigName,
    t.sigCo,
    t.sigMail,
    "",
    t.oneShot,
    "",
    `${t.unsubTxt}\n${l.unsub}`,
    "",
    `${t.legal} ${l.privacy}`,
    "",
    t.identity,
  ].join("\n");
}

/** The rendered letter: subject, gated text, parts and links. */
export interface TrialCampaignLetter {
  readonly subject: string;
  readonly body: string;
  readonly parts: TrialCampaignParts;
  readonly link: string;
  readonly unsubscribeLink: string;
  readonly privacyLink: string;
}

export function renderTrialCampaignLetter(i: TrialCampaignLetterInput): TrialCampaignLetter {
  const parts = trialCampaignParts(i);
  return {
    subject: parts.subject,
    body: composeTrialCampaignText(parts, i.links),
    parts,
    link: i.links.cta,
    unsubscribeLink: i.links.unsub,
    privacyLink: i.links.privacy,
  };
}

// Brand constants COPIED from citui.css — a mail client has no var() (the cold letter's
// rule: src/email/ is outside the design-token-lint chain for exactly this reason).
const NAVY = "#0e2a47";
const CYAN = "#1fb6d6";
const INK = "#10243a";
const MUTED = "#60748b";
const FOOT = "#8a97a5";
const LINE = "#e3ecf2";
const LINE_STRONG = "#c3ced8";
const PAGE_BG = "#eef2f6";
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif";
const W = 600;
const PAD = 20;

function tbl(attrs: string, inner: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${attrs}>${inner}</table>`;
}

function para(html: string, extra = ""): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};font-family:${FONT}${extra}">${html}</p>`;
}

/** The letter's inner HTML (the fluid table inside the MSO ghost table). */
function letterHtml(heroSrc: string | null, t: TrialCampaignParts, l: TrialCampaignLetterInput["links"], brand: string): string {
  const b = trialCampaignLinks(l.cta);
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

  const intro =
    `<tr><td style="padding:20px ${PAD}px 0">` +
    para(esc(t.greet), ";font-size:17px;line-height:1.55") +
    para(esc(t.p1)) +
    para(esc(t.p2)) +
    `</td></tr>`;

  const hero = heroSrc
    ? `<tr><td style="padding:0 ${PAD}px">` +
      `<a href="${esc(b.planLink)}" style="text-decoration:none">` +
      `<img src="${heroSrc}" alt="${esc(t.heroAlt)}" width="${W - 2 * PAD}" ` +
      `style="display:block;width:100%;max-width:${W - 2 * PAD}px;height:auto;border:1px solid ${LINE}" border="0"></a>` +
      `</td></tr>`
    : "";

  // bgcolor ON THE TD — Outlook can drop the CSS background of the link. The pair is stacked
  // (primary, then the outlined secondary — the house ghost button, bookingLayout.ts): two
  // tables cannot wrap side by side in Outlook, and stacked they read the same on a phone.
  const cta =
    `<tr><td style="padding:14px ${PAD}px 6px">` +
    tbl(
      `cellpadding="0"`,
      `<tr><td bgcolor="${NAVY}" style="background:${NAVY};border-radius:8px">` +
        `<a href="${esc(b.tryLink)}" data-cta="try" style="display:block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(t.ctaTry)}</a>` +
        `</td></tr>`,
    ) +
    tbl(
      `cellpadding="0" style="margin:10px 0 0"`,
      `<tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${LINE_STRONG};border-radius:8px">` +
        `<a href="${esc(b.planLink)}" data-cta="plan" style="display:block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;color:${NAVY};text-decoration:none">${esc(t.cta)}</a>` +
        `</td></tr>`,
    ) +
    `</td></tr>`;
  const rawUrl = `<tr><td style="padding:0 ${PAD}px 16px;font-family:${FONT};font-size:12px;line-height:1.5;color:${FOOT};word-break:break-all">${esc(l.cta)}</td></tr>`;

  // The question comes RIGHT AFTER the plan (variant C). The pills are inline-block links:
  // they wrap on a 390px phone, and Outlook (no inline padding) still shows bordered links.
  const pills = t.whyLabels
    .map(
      (w) =>
        `<a href="${esc(w.href)}" data-why="${w.reason}" style="display:inline-block;margin:0 6px 8px 0;padding:10px 16px;border:1px solid ${LINE_STRONG};border-radius:999px;font-family:${FONT};font-size:14px;color:${INK};text-decoration:none;background:#ffffff">${esc(w.label)}</a>`,
    )
    .join("");
  const why =
    `<tr><td style="padding:4px ${PAD}px 6px">` +
    `<div style="border-top:1px solid ${LINE};padding-top:16px">` +
    `<p style="margin:0 0 4px;font-family:${FONT};font-size:15px;font-weight:700;color:${INK}">${esc(t.whyQ)}</p>` +
    `<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;color:${MUTED}">${esc(t.whySub)}</p>` +
    pills +
    `</div></td></tr>`;

  const gets =
    `<tr><td style="padding:10px ${PAD}px 0">` +
    `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};font-weight:700">${esc(t.getsTitle)}</p>` +
    tbl(
      `width="100%" style="margin:0 0 14px"`,
      [t.getsHostHtml, ...t.gets.slice(1).map(esc)]
        .map(
          (g) =>
            `<tr><td valign="top" width="18" style="width:18px;padding:0 0 6px;font-family:${FONT};font-size:15px;line-height:1.55;color:${CYAN}">&#9679;</td>` +
            `<td valign="top" style="padding:0 0 6px;font-family:${FONT};font-size:15px;line-height:1.55;color:${INK}">${g}</td></tr>`,
        )
        .join(""),
    ) +
    `</td></tr>`;

  const endPara = `<tr><td style="padding:0 ${PAD}px">${para(esc(t.coupon ? `${t.end} ${t.coupon}` : t.end))}</td></tr>`;

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
    `<p style="margin:0 0 8px">${esc(t.oneShot)}</p>` +
    `<p style="margin:0 0 8px">${esc(t.unsubTxt)}<br><a href="${esc(l.unsub)}" style="color:${FOOT}">${esc(l.unsub)}</a></p>` +
    `<p style="margin:0 0 8px">${esc(t.legal)} <a href="${esc(l.privacy)}" style="color:${FOOT}">${esc(l.privacy)}</a></p>` +
    `<p style="margin:0">${esc(t.identity)}</p>` +
    `</div></td></tr>`;

  const inner = tbl(
    `width="100%" style="width:100%;max-width:${W}px;background:#ffffff" bgcolor="#ffffff"`,
    header + intro + hero + cta + rawUrl + why + gets + endPara + signature + footer,
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
 * The sendable e-mail. Call ONLY after the §C gate passed on `letter` (the sender does) —
 * this renders, it does not judge. `heroShotPath`: the mock's opening-screen PNG (CID inline),
 * omitted entirely when absent rather than shown as a broken frame.
 */
export function buildTrialCampaignEmail(
  letter: TrialCampaignLetter,
  to: string,
  opts: { heroShotPath?: string | null; lang?: string } = {},
): EmailMessage {
  // ⛔ §I CONSISTENCY GUARD (the cold letter's): every sentence the HTML shows must be in
  // the gated text. Composing the text from the parts makes this hold by construction; the
  // check keeps a later hand-edit from breaking it silently.
  const t = letter.parts;
  const shown = [
    t.greet, t.p1, t.p2, t.ctaTry, t.cta, t.whyQ, t.whySub, ...t.whyLabels.map((w) => w.label), t.getsTitle,
    ...t.gets, t.end, ...(t.coupon ? [t.coupon] : []), t.oneShot, t.unsubTxt, t.legal, t.identity,
  ];
  for (const s of shown) {
    if (!letter.body.includes(s)) {
      throw new Error(
        `próba-kampány levél: a HTML olyat állítana, ami a kapuzott szövegben NINCS benne („${s.slice(0, 60)}”) — nem küldjük`, // i18n-exempt: fejlesztői kivétel-üzenet, sosem éri el a vevőt
      );
    }
  }
  const hasShot = Boolean(opts.heroShotPath);
  const brand = bandBrand();
  const html =
    `<!DOCTYPE html><html lang="${opts.lang || "hu"}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:${PAGE_BG}">` +
    letterHtml(hasShot ? `cid:${TRIAL_CAMPAIGN_HERO_CID}` : null, t, {
      cta: letter.link,
      unsub: letter.unsubscribeLink,
      privacy: letter.privacyLink,
    }, brand.html) +
    `</body></html>`;
  const list: EmailAttachment[] = [
    ...brand.attachments,
    ...(hasShot
      ? [
          {
            filename: path.basename(opts.heroShotPath as string),
            path: opts.heroShotPath as string,
            cid: TRIAL_CAMPAIGN_HERO_CID,
            contentType: "image/png",
          },
        ]
      : []),
  ];
  // The List-Unsubscribe header follows the cold letter's switch (ADR-0069): the in-body
  // opt-out is always there and gated; the header is the operator's deliverability choice.
  const headers = config.outreachListUnsubscribe
    ? { "List-Unsubscribe": `<${letter.unsubscribeLink}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;
  return {
    to,
    audience: "platform",
    subject: letter.subject,
    text: letter.body,
    html,
    ...(headers ? { headers } : {}),
    ...(list.length ? { attachments: list } : {}),
  };
}

/** The campaign SMS may cost at most this many segments (owner, 2026-10-09). */
export const TRIAL_CAMPAIGN_SMS_MAX_SEGMENTS = 2;

/**
 * The SMS twin for the mobile-only leads (owner, 2026-10-09: accent-free GSM-7, with the link,
 * ≤ 2 segments) — built like buildTrialNoticeSmsText: the sentence is translated WITH accents
 * (the catalog key is the Hungarian source), then folded to GSM-7. Too long (a long name) →
 * the name is shortened; the link is the message's purpose and is never cut. The legal
 * mandatories and the opt-out ride on the linked page's footer (ADR-0112).
 *
 * Returns the text AND the name as it stands in it (folded, maybe shortened) — the §C
 * personalization check must look for THAT, not for the accented original.
 */
export function buildTrialCampaignSmsText(input: {
  readonly lang: string;
  readonly leadName: string;
  readonly sentIso: string;
  readonly days: number;
  readonly link: string;
  /** The lead's live offer percent (trialCampaignOfferPercent) — null/0 = the text without it. */
  readonly percent?: number | null;
}): { readonly text: string; readonly name: string } {
  const { lang } = input;
  const date = formatDayShortOn(input.sentIso, lang);
  const percent = input.percent && input.percent > 0 ? input.percent : null;
  // The article follows the date's first sound ("az okt. 4-én", "a szept. 24-én") —
  // a fixed "a" read "a okt. 4-en" (Elek, 2026-10-09).
  const build = (name: string, withOffer = percent !== null): string => {
    const v = { name, art: huArticleLower(date), date, days: String(input.days), link: input.link };
    return toGsm7(
      withOffer && percent
        ? T(
            lang,
            "{name}: {art} {date} küldött honlap-tervet most {days} napig ingyen, élesben is kipróbálhatja, kártya nélkül. Ha a próba végéig megrendeli, {pa} {p}% kedvezmény megmarad. {link} Leiratkozás a lap alján. Citoviso",
            { ...v, p: String(percent), pa: huArticleLower(String(percent)) },
          )
        : T(
            lang,
            "{name}: {art} {date} küldött honlap-tervet most {days} napig ingyen, élesben is kipróbálhatja. Nincs kártya, nincs előfizetés, a végén nem terhelünk. {link} Leiratkozás a lap alján. Citoviso",
            v,
          ),
    );
  };
  const fits = (t: string): boolean => smsEncoding(t).segments <= TRIAL_CAMPAIGN_SMS_MAX_SEGMENTS;
  const shorten = (withOffer: boolean): { text: string; name: string } => {
    let name = input.leadName;
    let text = build(name, withOffer);
    for (let n = [...input.leadName].length - 1; !fits(text) && n > 8; n--) {
      name = `${[...input.leadName].slice(0, n).join("").trimEnd()}...`;
      text = build(name, withOffer);
    }
    return { text, name };
  };
  // The offer sentence is ~20 characters longer: when even the shortest name leaves no room
  // for it next to a long link, the approved text WITHOUT it goes (the offer still holds — it
  // is pinned at the trial's start); the link is never cut.
  let r = shorten(percent !== null);
  if (!fits(r.text) && percent !== null) r = shorten(false);
  return { text: r.text, name: toGsm7(r.name) };
}
