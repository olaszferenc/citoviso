// Credentials email (ADR-0023) — tells the owner their login name and hands them a
// one-time link to SET their own password. Clear, single call to action.
//
// ⛔ Elek T-3 (owner-approved 2026-10-02, ADR-0303): NO PASSWORD IN THE MAIL. The
// old letter printed it in plain text ("Jelszó: …") and said "if you forget it,
// reply to this mail" — every mailbox and every forward to the accountant held a
// working password. Now the letter carries a link: single use, 7 days, and
// "Elfelejtett jelszó?" on the login page sends a fresh one at any time.
//
// ADR-0067: written in the TENANT's own site language. The caller resolves it
// (langForTenant) and provisions the pack (prepareMailLang) before building.
//
// Frame: platformLayout.ts (approved variant A, 2026-09-24). The letter names
// the SITE — an owner with two places, or one who ordered weeks ago, must not
// have to guess which login this is.
//
// ADR-0344 kiegészítés — the FREE-TRIAL variant (owner-approved 2026-10-09,
// assets/design-refs/console/proba-levelek/): "Elindult … ingyenes próbája", the
// trial's end and the continuation discount in the details box, and one paragraph
// saying we charge nothing. Username, button and the 7-day note are unchanged; the
// footer says the reader is TRYING the site, not that they ordered it.

import { T } from "../i18n/mail.js";
import { huArticleLower } from "../hu.js";
import { mailButton, mailDetails, mailGreeting, mailNote, mailPara, platformMail, esc } from "./platformLayout.js";
import type { MailDetailRow } from "./platformLayout.js";
import type { EmailMessage } from "./sender.js";
import { boldVars, couponValue, type TrialCouponView } from "./trialEmail.js";
import { formatDayLongStem, formatDayShortStem, formatDayShortWeekday } from "../text/day.js";

export function buildCredentialsEmail(input: {
  to: string;
  username: string;
  /** The one-time password-setting link (passwordLinkUrl). */
  setPasswordUrl: string;
  /** The tenant login page — for later visits. */
  loginUrl: string;
  /** The site these credentials edit (tenant display name). */
  siteName: string;
  /** Who ordered (order_intent.buyer_name); absent → neutral salutation. */
  buyerName?: string | null;
  /** true only for a private person — a company gets the neutral salutation. */
  buyerIsPerson?: boolean;
  /** Reader's language (ADR-0067). Absent → Hungarian. */
  lang?: string;
  /** Present = the login of a FREE TRIAL (ADR-0342/0344): its end and coupon. */
  trial?: { readonly untilIso: string; readonly coupon: TrialCouponView | null } | null;
}): EmailMessage {
  const { to, username, setPasswordUrl, loginUrl, siteName, lang } = input;
  const trial = input.trial ?? null;
  const greeting = mailGreeting(lang, input.buyerName, input.buyerIsPerson ?? false);
  const subject = T(lang, "Belépési adatai – {site}", { site: siteName });
  const introVars = { art: huArticleLower(siteName), site: siteName };
  const intro = trial
    ? T(
        lang,
        "Elindult {art} {site} ingyenes próbája: a honlap él, és minden modul be van kapcsolva. Az első belépéshez állítson be egy saját jelszót.",
        introVars,
      )
    : T(
        lang,
        "Elkészült {art} {site} oldalának szerkesztő felülete. Az első belépéshez állítson be egy saját jelszót.",
        introVars,
      );
  const trialPara = (v: { until: string }): string =>
    T(
      lang,
      "A próba {until}-ig tart. Kártyát nem kértünk, és a próba végén sem terhelünk semmit: ha nem folytatja, a honlap szünetel, az adatai megmaradnak. 3 nappal és 1 nappal a vége előtt szólunk.",
      v,
    );
  const trialVars = trial ? { until: formatDayLongStem(trial.untilIso, lang) } : null;
  const details: MailDetailRow[] = [{ label: T(lang, "Felhasználónév"), value: username, mono: true }];
  if (trial) {
    details.push({ label: T(lang, "A próba vége"), value: formatDayShortWeekday(trial.untilIso, lang) });
    if (trial.coupon) {
      details.push({
        label: T(lang, "Kedvezmény, ha folytatja"),
        value: T(lang, "{discount}, {date}-ig", {
          discount: couponValue(lang, trial.coupon),
          date: formatDayShortStem(trial.coupon.untilIso, lang),
        }),
      });
    }
  }
  const note = T(
    lang,
    "A gomb 7 napig érvényes, és egyszer használható. Ha lejárt, a belépő lapon az „Elfelejtett jelszó?” linkre kattintva bármikor kérhet újat. Jelszót e-mailben nem küldünk.",
  );
  const button = T(lang, "Jelszó beállítása");
  const later = T(lang, "Később itt léphet be:");

  const text =
    `${greeting}\n\n${intro}\n\n` +
    `${T(lang, "Felhasználónév:")} ${username}\n\n` +
    `${button}: ${setPasswordUrl}\n\n` +
    (trialVars ? `${trialPara(trialVars)}\n\n` : "") +
    `${note}\n\n${later} ${loginUrl}\n`;

  return platformMail({
    to,
    subject,
    text,
    lang,
    heading: T(lang, "Belépési adatai"),
    greeting,
    siteName,
    footerReason: trial ? "trial" : "order",
    blocks: [
      mailPara(esc(intro).replace(esc(siteName), `<b>${esc(siteName)}</b>`)),
      mailDetails(details),
      mailButton(setPasswordUrl, button),
      ...(trialVars ? [mailPara(boldVars(trialPara, trialVars, ["until"]))] : []),
      mailNote(esc(note)),
      mailNote(`${esc(later)} <a href="${esc(loginUrl)}">${esc(loginUrl.replace(/^https?:\/\//, ""))}</a>`),
    ],
  });
}

/** "Elfelejtett jelszó?" — the letter with a fresh one-time link. */
export function buildPasswordResetEmail(input: {
  to: string;
  username: string;
  setPasswordUrl: string;
  siteName: string;
  lang?: string;
}): EmailMessage {
  const { to, username, setPasswordUrl, siteName, lang } = input;
  const subject = T(lang, "Új jelszó beállítása – {site}", { site: siteName });
  const intro = T(
    lang,
    "Valaki — remélhetőleg Ön — új jelszót kért {art} {site} szerkesztő felületéhez. Az alábbi gombbal állíthatja be.",
    { art: huArticleLower(siteName), site: siteName },
  );
  const note = T(
    lang,
    "A gomb 7 napig érvényes, és egyszer használható. Ha nem Ön kérte, nincs teendője: a jelenlegi jelszava változatlan marad.",
  );
  const button = T(lang, "Jelszó beállítása");
  const text =
    `${intro}\n\n${T(lang, "Felhasználónév:")} ${username}\n\n${button}: ${setPasswordUrl}\n\n${note}\n`;
  return platformMail({
    to,
    subject,
    text,
    lang,
    heading: T(lang, "Új jelszó beállítása"),
    greeting: "",
    siteName,
    blocks: [
      mailPara(esc(intro).replace(esc(siteName), `<b>${esc(siteName)}</b>`)),
      mailDetails([{ label: T(lang, "Felhasználónév"), value: username, mono: true }]),
      mailButton(setPasswordUrl, button),
      mailNote(esc(note)),
    ],
  });
}
