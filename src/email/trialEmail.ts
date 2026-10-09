// ADR-0344 — the free-trial letters: the T−3 / T−1 warning before the trial ends.
//
// Approved design (owner, 2026-10-09, §2b): assets/design-refs/console/proba-levelek/
// — the wording, the details box and the ONE button ("Folytatom") are the contract.
// The frame is the platform letter (platformLayout.ts) with the TRIAL footer: a
// trialist did not order anything, so "…a Citovisónál rendelte meg" would be false.
//
// ⛔ The heading follows the REAL distance to the end, not the step's name. A step
// that falls on a weekend is sent on the Friday before (noticeSendDay), so a Monday
// expiry's T−1 leaves on Friday: "Holnap lejár" would then be a lie (§B.17 binds us
// about ourselves too). The approved forms are "Holnap lejár…" (1 day) and
// "N nap múlva lejár…" / "Még N nap…" (N days); the day itself (a late catch-up after
// an outage) says "Ma lejár…".

import { T } from "../i18n/mail.js";
import { formatDayOn, formatDayShortOn, formatDayShortStem, formatDayShortWeekday, formatDayLongStem } from "../text/day.js";
import { huArticle, huArticleLower } from "../hu.js";
import { smsEncoding, toGsm7 } from "../sms/encoding.js";
import { esc, mailButton, mailDetails, mailGreeting, mailNote, mailPara, platformMail } from "./platformLayout.js";
import type { EmailMessage } from "./sender.js";

/** The trial's continuation coupon, as the letters show it. */
export interface TrialCouponView {
  readonly percent: number;
  /** ISO day (Budapest) the coupon is valid until. */
  readonly untilIso: string;
}

/**
 * Escape a translated sentence and bold the named placeholder VALUES — the approved
 * letters bold the site name, the percent and the dates inside running sentences.
 * `sentence` is a literal `T(lang, "…", v)` wrapper (the catalog extractor only sees
 * literal keys). A Hungarian case ending right after a bold value ("…20</b>-ig")
 * moves inside the bold, the way the approved image shows it ("<b>2027. január 20-ig</b>").
 */
export function boldVars<V extends Record<string, string>>(
  sentence: (v: V) => string,
  vars: V,
  bold: readonly (keyof V)[],
): string {
  const marked = { ...vars };
  for (const k of bold) (marked as Record<string, string>)[k as string] = `\u0001${vars[k]}\u0002`;
  return esc(sentence(marked))
    .replace(/\u0001/g, "<b>")
    .replace(/\u0002/g, "</b>")
    .replace(/<\/b>(-\p{Ll}+)/gu, "$1</b>");
}

/** "25% az első díjból" — the coupon's one-line value. */
export function couponValue(lang: string | undefined, c: TrialCouponView): string {
  return T(lang, "{percent}% az első díjból", { percent: String(c.percent) });
}

export function buildTrialNoticeEmail(input: {
  to: string;
  /** Whole days from today (Budapest) to the trial's last day: 0 = today, 1 = tomorrow. */
  daysLeft: number;
  siteName: string;
  /** The trialist (free_trial.contact_name) — always a person. */
  contactName: string | null;
  /** ISO day (Budapest) the trial ends. */
  trialUntilIso: string;
  coupon: TrialCouponView | null;
  /** GET /p/<token>/folytatas — the configurator with the trial coupon. */
  continueUrl: string;
  lang?: string;
}): EmailMessage {
  const { to, daysLeft, siteName, trialUntilIso, coupon, continueUrl, lang } = input;
  const greeting = mailGreeting(lang, input.contactName, true);
  const n = String(daysLeft);
  const subject =
    daysLeft <= 0
      ? T(lang, "Ma lejár az ingyenes próba – {site}", { site: siteName })
      : daysLeft === 1
        ? T(lang, "Holnap lejár az ingyenes próba – {site}", { site: siteName })
        : T(lang, "Még {n} nap az ingyenes próbából – {site}", { n, site: siteName });
  const heading =
    daysLeft <= 0
      ? T(lang, "Ma lejár az ingyenes próba")
      : daysLeft === 1
        ? T(lang, "Holnap lejár az ingyenes próba")
        : T(lang, "{n} nap múlva lejár az ingyenes próba", { n });

  // The sentence opens with the site's name, so it needs its article ("A Napfény…",
  // "Az Üdülő…") — without it the letter read "Napfény Vendégház honlapjának…" (Elek, 2026-10-09).
  const intro = (v: { Art: string; site: string; until: string }): string =>
    T(lang, "{Art} {site} honlapjának ingyenes próbája {until} lejár.", v);
  const introVars = { Art: huArticle(siteName), site: siteName, until: formatDayOn(trialUntilIso, lang) };
  const offer = (v: { percent: string; until: string }): string =>
    T(lang, "Ha folytatná, a próbához kapott kedvezménnyel teheti: {percent} az első díjból, {until}-ig.", v);
  const offerVars = coupon
    ? { percent: `${coupon.percent}%`, until: formatDayLongStem(coupon.untilIso, lang) }
    : null;
  const stay = T(
    lang,
    "Ha nem folytatja, nem terhelünk semmit — kártyát nem is kértünk. A próba végén a honlap szünetel: a látogatók helyette a szállás nevét, települését és az Ön elérhetőségeit látják. A szerkesztő felülete és minden feltöltött adata a próbaidő végétől számított 90 napig megmarad; ha addig fizet, a honlap azonnal visszakapcsol.",
  );
  const button = T(lang, "Folytatom");

  const details = [{ label: T(lang, "A próba vége"), value: formatDayShortWeekday(trialUntilIso, lang) }];
  if (coupon) {
    details.push(
      { label: T(lang, "Kedvezmény"), value: couponValue(lang, coupon) },
      { label: T(lang, "A kedvezmény érvényes"), value: T(lang, "{date}-ig", { date: formatDayShortStem(coupon.untilIso, lang) }) },
    );
  }

  const text =
    `${greeting}\n\n${intro(introVars)}\n\n` +
    (offerVars ? `${offer(offerVars)}\n\n` : "") +
    `${button}: ${continueUrl}\n\n${stay}\n`;

  return platformMail({
    to,
    subject,
    text,
    lang,
    heading,
    greeting,
    siteName,
    footerReason: "trial",
    blocks: [
      mailPara(boldVars(intro, introVars, ["site"])),
      ...(offerVars ? [mailPara(boldVars(offer, offerVars, ["percent", "until"]))] : []),
      mailDetails(details),
      mailButton(continueUrl, button),
      mailNote(esc(stay)),
    ],
  });
}

/**
 * ADR-0345 — the purge warning, 7 days before a lapsed trial's data is deleted (approved
 * design "A", owner 2026-10-09, §2b: assets/design-refs/console/proba-torles-level/).
 * The count in the subject and heading is the REAL distance to the deletion day: a warning
 * moved back to Friday (purgeWarningDay) says 9 days, never a rounded 7 (§B.17). Without a
 * live coupon the coupon paragraph and its details row are left out — no promise we lack.
 */
export function buildPurgeWarningEmail(input: {
  to: string;
  /** Whole Budapest days from the send day to the deletion day (≥ 7 by construction). */
  daysToPurge: number;
  siteName: string;
  contactName: string | null;
  /** ISO day (Budapest) the trial ended. */
  trialUntilIso: string;
  /** ISO day (Budapest) the data is deleted — the day the letter promises. */
  purgeIso: string;
  coupon: TrialCouponView | null;
  /** GET /p/<token>/folytatas — the configurator with the trial coupon. */
  continueUrl: string;
  lang?: string;
}): EmailMessage {
  const { to, siteName, trialUntilIso, purgeIso, coupon, continueUrl, lang } = input;
  const greeting = mailGreeting(lang, input.contactName, true);
  const n = String(input.daysToPurge);
  const subject = T(lang, "{n} nap múlva töröljük a próba-honlap adatait – {site}", { n, site: siteName });
  const heading = T(lang, "{n} nap múlva töröljük a próba-honlap adatait", { n });

  const intro = (v: { Art: string; site: string; until: string; purge: string }): string =>
    T(
      lang,
      "{Art} {site} honlapjának ingyenes próbája {until} lejárt. Az adatait azóta megőriztük; {purge} véglegesen töröljük a honlapot, a szerkesztő-fiókot és a feltöltött fényképeket.",
      v,
    );
  const introVars = {
    Art: huArticle(siteName),
    site: siteName,
    until: formatDayOn(trialUntilIso, lang),
    purge: formatDayOn(purgeIso, lang),
  };
  const offer = (v: { percent: string; until: string }): string =>
    T(lang, "Ha folytatná, a próbához kapott kedvezménnyel még megteheti: {percent} az első díjból, {until}-ig.", v);
  const offerVars = coupon
    ? { percent: `${coupon.percent}%`, until: formatDayLongStem(coupon.untilIso, lang) }
    : null;
  const calm = T(lang, "Ha nem folytatja, nincs teendője — díjat nem számítunk fel.");
  const button = T(lang, "Folytatom");

  const details = [
    { label: T(lang, "A próba vége"), value: formatDayShortWeekday(trialUntilIso, lang) },
    { label: T(lang, "Törlés napja"), value: formatDayShortWeekday(purgeIso, lang) },
  ];
  if (coupon) {
    details.push({
      label: T(lang, "Kedvezmény"),
      value: T(lang, "{discount}, {date}-ig", { discount: couponValue(lang, coupon), date: formatDayShortStem(coupon.untilIso, lang) }),
    });
  }

  const text =
    `${greeting}\n\n${intro(introVars)}\n\n` +
    (offerVars ? `${offer(offerVars)}\n\n` : "") +
    `${button}: ${continueUrl}\n\n${calm}\n`;

  return platformMail({
    to,
    subject,
    text,
    lang,
    heading,
    greeting,
    siteName,
    footerReason: "trial",
    blocks: [
      mailPara(boldVars(intro, introVars, ["site", "purge"])),
      ...(offerVars ? [mailPara(boldVars(offer, offerVars, ["percent", "until"]))] : []),
      mailDetails(details),
      mailButton(continueUrl, button),
      mailNote(esc(calm)),
    ],
  });
}

/** The trial SMS may cost at most this many segments (owner, 2026-10-09: accent-free, ≤ 2). */
export const TRIAL_SMS_MAX_SEGMENTS = 2;

/**
 * The T−3 / T−1 SMS twin (owner, 2026-10-09: ACCENT-FREE, WITH THE LINK, ≤ 2 segments —
 * mock ~/rc-briefs/proba-C-mock-20261009, contract assets/design-refs/console/proba-levelek/).
 * The sentence is translated with accents (the catalog key is the Hungarian source), THEN
 * folded to GSM-7 (toGsm7): an accent outside GSM-7 would turn the whole text into UCS-2,
 * 70 characters a segment, and the approved text would cost 3–4.
 *
 * Like the letter, it says the REAL distance: a weekend-shifted step reads the date, never
 * "holnap". Too long for 2 segments (a long site name) → the closing reassurance goes first,
 * then the site name is shortened — the link is the message's purpose and is never cut.
 */
export function buildTrialNoticeSmsText(input: {
  daysLeft: number;
  siteName: string;
  trialUntilIso: string;
  coupon: TrialCouponView | null;
  /** The /p/<token>/folytatas link (the scheme is dropped: phones link a bare host too). */
  continueUrl: string;
  lang?: string;
}): string {
  const { daysLeft, trialUntilIso, coupon, lang } = input;
  const url = input.continueUrl.replace(/^https?:\/\//, "");
  const build = (siteName: string, tail: boolean): string => {
    const v = { art: huArticleLower(siteName), site: siteName };
    const when =
      daysLeft <= 0
        ? T(lang, "Citoviso: ma lejár {art} {site} ingyenes próbája.", v)
        : daysLeft === 1
          ? T(lang, "Citoviso: holnap lejár {art} {site} ingyenes próbája.", v)
          : T(lang, "Citoviso: {art} {site} ingyenes próbája {date} lejár.", { ...v, date: formatDayShortOn(trialUntilIso, lang) });
    const go = coupon
      ? T(lang, "Folytatás {percent}% kedvezménnyel: {url}", { percent: String(coupon.percent), url })
      : T(lang, "Folytatás: {url}", { url });
    // The approved T−3 closes with the reassurance; the approved T−1 has no room for it.
    const rest = tail && daysLeft >= 2 ? ` ${T(lang, "Nem terhelünk, ha nem folytatja.")}` : "";
    return toGsm7(`${when} ${go}${rest}`);
  };
  const fits = (t: string): boolean => smsEncoding(t).segments <= TRIAL_SMS_MAX_SEGMENTS;
  let text = build(input.siteName, true);
  if (fits(text)) return text;
  text = build(input.siteName, false);
  for (let n = [...input.siteName].length - 1; !fits(text) && n > 8; n--) {
    text = build(`${[...input.siteName].slice(0, n).join("").trimEnd()}...`, false);
  }
  return text;
}
