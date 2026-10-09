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
import { formatDayOn, formatDayShortStem, formatDayShortWeekday, formatDayLongStem } from "../text/day.js";
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

  const intro = (v: { site: string; until: string }): string =>
    T(lang, "{site} honlapjának ingyenes próbája {until} lejár.", v);
  const introVars = { site: siteName, until: formatDayOn(trialUntilIso, lang) };
  const offer = (v: { percent: string; until: string }): string =>
    T(lang, "Ha folytatná, a próbához kapott kedvezménnyel teheti: {percent} az első díjból, {until}-ig.", v);
  const offerVars = coupon
    ? { percent: `${coupon.percent}%`, until: formatDayLongStem(coupon.untilIso, lang) }
    : null;
  const stay = T(
    lang,
    "Ha nem folytatja, nem terhelünk semmit — kártyát nem is kértünk. A próba végén a honlap szünetel: a látogatók helyette a szállás nevét, települését és az Ön elérhetőségeit látják. A szerkesztő felülete és minden feltöltött adata megmarad; ha később fizet, a honlap azonnal visszakapcsol.",
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
