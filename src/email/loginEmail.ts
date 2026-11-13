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
//
// ADR-0354 "C" (owner-approved 2026-10-10, assets/design-refs/console/proba-c/3-levelek-sms.html):
// a C trial's discount is the "Próba-kedvezmény" row ("−{p}%, ha {date}-ig megrendeli …") and
// one closing sentence in the trial paragraph; a pre-C trial keeps its coupon row.
//
// Owner finding 2026-10-15 ([TESZT] Matróz): after closing the admin window the owner could not
// find where to log in again — the address sat only in a small note at the very bottom, and the
// reset letter did not carry it at all. Both letters now put the login address in the details
// box, right under the username, and early in the plain-text part (loginDetailRow / loginTextLine).

import { T } from "../i18n/mail.js";
import { huArticle, huArticleLower } from "../hu.js";
import { smsEncoding, toGsm7 } from "../sms/encoding.js";
import { loginAddressLabel, mailButton, mailDetails, mailGreeting, mailNote, mailPara, platformMail, esc } from "./platformLayout.js";
import type { FooterReason, MailDetailRow } from "./platformLayout.js";
import type { EmailMessage } from "./sender.js";
import { boldVars, couponValue, isTrialOffer, type TrialCouponView } from "./trialEmail.js";
import { formatDayLongStem, formatDayShortStem, formatDayShortWeekday } from "../text/day.js";

/**
 * ADR-0364 (B1, Elek 10-11): a trial that does NOT give every module names what it gives —
 * the package label (untranslated; null = no tier matches) and the modules' lead-facing
 * names (untranslated), from trial/package.ts, the list startTrial granted. Absent/null =
 * every module, and „minden modul be van kapcsolva” is true.
 */
export interface TrialPackageView {
  readonly label: string | null;
  readonly modules: readonly string[];
}

/** The details-box row naming where to log in — directly under „Felhasználónév”. */
function loginDetailRow(lang: string | undefined, loginUrl: string): MailDetailRow {
  return { label: T(lang, "Belépés"), value: loginAddressLabel(loginUrl), href: loginUrl, mono: true };
}

/** The plain-text line naming where to log in — next to the username, never at the end. */
function loginTextLine(lang: string | undefined, loginUrl: string): string {
  return `${T(lang, "Belépés:")} ${loginUrl}`;
}

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
  trial?: {
    readonly untilIso: string;
    readonly coupon: TrialCouponView | null;
    readonly pkg?: TrialPackageView | null;
  } | null;
}): EmailMessage {
  const { to, username, setPasswordUrl, loginUrl, siteName, lang } = input;
  const trial = input.trial ?? null;
  const greeting = mailGreeting(lang, input.buyerName, input.buyerIsPerson ?? false);
  const subject = T(lang, "Belépési adatai – {site}", { site: siteName });
  const introVars = { art: huArticleLower(siteName), site: siteName };
  const pkg = trial?.pkg && trial.pkg.modules.length ? trial.pkg : null;
  const pkgLabel = pkg?.label ? T(lang, pkg.label) : null;
  const intro = trial
    ? pkg && pkgLabel
      ? T(
          lang,
          "Elindult {art} {site} ingyenes próbája: a honlap él, és {art2} {pkg} csomag moduljai be vannak kapcsolva. Az első belépéshez állítson be egy saját jelszót.",
          { ...introVars, art2: huArticleLower(pkgLabel), pkg: pkgLabel },
        )
      : pkg
        ? T(
            lang,
            "Elindult {art} {site} ingyenes próbája: a honlap él, és a próba moduljai be vannak kapcsolva. Az első belépéshez állítson be egy saját jelszót.",
            introVars,
          )
        : T(
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
      "A próba {until}-ig tart. Kártyát nem kértünk, és a próba végén sem terhelünk semmit: ha nem folytatja, a honlap szünetel, az adatai a próbaidő végétől számított 90 napig megmaradnak. 3 nappal és 1 nappal a vége előtt szólunk.",
      v,
    );
  const trialVars = trial ? { until: formatDayLongStem(trial.untilIso, lang) } : null;
  const offerC = trial && isTrialOffer(trial.coupon)
    ? T(lang, "Ha a próba végéig megrendeli, a díjból {p}% kedvezményt kap — évesen az első évre, havinál az első hónapra.", {
        p: String(trial.coupon.percent),
      })
    : null;
  const details: MailDetailRow[] = [
    { label: T(lang, "Felhasználónév"), value: username, mono: true },
    loginDetailRow(lang, loginUrl),
  ];
  if (trial) {
    details.push({ label: T(lang, "A próba vége"), value: formatDayShortWeekday(trial.untilIso, lang) });
    if (pkg) details.push({ label: T(lang, "A próbában"), value: pkg.modules.map((m) => T(lang, m)).join(" · ") });
    if (isTrialOffer(trial.coupon)) {
      details.push({
        label: T(lang, "Próba-kedvezmény"),
        value: T(lang, "−{p}%, ha {date}-ig megrendeli (évesen az első évre)", {
          p: String(trial.coupon.percent),
          date: formatDayShortStem(trial.coupon.untilIso, lang),
        }),
      });
    } else if (trial.coupon) {
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
  const later = T(lang, "Később is ezen a címen léphet be — érdemes elmenteni a könyvjelzők közé:");

  // The plain-text part names the modules too (the details box is HTML-only) — the same list.
  const pkgLine = pkg ? `${T(lang, "A próbában")}: ${pkg.modules.map((m) => T(lang, m)).join(" · ")}\n\n` : "";
  const text =
    `${greeting}\n\n${intro}\n\n` +
    pkgLine +
    `${T(lang, "Felhasználónév:")} ${username}\n` +
    `${loginTextLine(lang, loginUrl)}\n\n` +
    `${button}: ${setPasswordUrl}\n\n` +
    (trialVars ? `${trialPara(trialVars)}${offerC ? ` ${offerC}` : ""}\n\n` : "") +
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
    // The address already stands in the details box, under the username.
    ownerLogin: false,
    blocks: [
      mailPara(esc(intro).replace(esc(siteName), `<b>${esc(siteName)}</b>`)),
      mailDetails(details),
      mailButton(setPasswordUrl, button),
      ...(trialVars ? [mailPara(boldVars(trialPara, trialVars, ["until"]) + (offerC ? ` ${esc(offerC)}` : ""))] : []),
      mailNote(esc(note)),
      mailNote(`${esc(later)} <a href="${esc(loginUrl)}">${esc(loginAddressLabel(loginUrl))}</a>`),
    ],
  });
}

/** "Elfelejtett jelszó?" — the letter with a fresh one-time link. */
export function buildPasswordResetEmail(input: {
  to: string;
  username: string;
  setPasswordUrl: string;
  /** The tenant login page — named next to the username (owner finding 2026-10-15). */
  loginUrl: string;
  siteName: string;
  lang?: string;
  /** ADR-0344 C2c: an account in its free trial did not order yet — footerReasonForTenant(). */
  footerReason?: FooterReason;
}): EmailMessage {
  const { to, username, setPasswordUrl, loginUrl, siteName, lang, footerReason } = input;
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
    `${intro}\n\n${T(lang, "Felhasználónév:")} ${username}\n${loginTextLine(lang, loginUrl)}\n\n` +
    `${button}: ${setPasswordUrl}\n\n${note}\n`;
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
      mailDetails([
        { label: T(lang, "Felhasználónév"), value: username, mono: true },
        loginDetailRow(lang, loginUrl),
      ]),
      mailButton(setPasswordUrl, button),
      mailNote(esc(note)),
    ],
    footerReason,
    // The address already stands in the details box, under the username.
    ownerLogin: false,
  });
}

// ── ADR-0417 — the trial LOGIN REMINDER (owner-approved 2026-11-03) ─────────────────────
//
// Measured 2026-11-03: both live trialists (Sáma 10-28, Marilyn 11-02) got the credentials
// letter and NEITHER clicked it — they were reached by MMS/SMS and do not watch their inbox.
// So a trialist who has not set a password yet gets, until they do: an SMS at the start
// (next to the credentials letter), then an e-mail + SMS on trial day 2, 4, 6 and 8. Every
// reminder carries a FRESH one-time link, so an expired first link can never strand them.

/** The reminder letter: "Még nem lépett be" — one button, the username, our phone. */
export function buildLoginReminderEmail(input: {
  to: string;
  username: string;
  setPasswordUrl: string;
  loginUrl: string;
  siteName: string;
  contactName: string | null;
  /** Whole Budapest days left (trialDaysLeft). */
  daysLeft: number;
  trialUntilIso: string;
  /** ADR-0429 — the open setup topics, named by the registry (src/tenant/moduleSetup.ts remindTopics). */
  missing?: readonly string[];
  lang?: string;
}): EmailMessage {
  const { to, username, setPasswordUrl, loginUrl, siteName, lang } = input;
  const missing = input.missing ?? [];
  const missHead = T(lang, "Ahhoz, hogy a vendég foglalni tudjon, még ez hiányzik:");
  const missTail = T(lang, "Belépés után lépésről lépésre végigvezetjük.");
  const greeting = mailGreeting(lang, input.contactName, true);
  const subject = T(lang, "Még nem lépett be – {site}", { site: siteName });
  const intro = T(
    lang,
    "{Art} {site} honlapja már él, de még nem lépett be a szerkesztőbe. A próbából még {n} nap van, {until}-ig.",
    {
      Art: huArticle(siteName),
      site: siteName,
      n: String(input.daysLeft),
      until: formatDayLongStem(input.trialUntilIso, lang),
    },
  );
  const button = T(lang, "Jelszó beállítása");
  const fresh = T(lang, "Új link, 7 napig érvényes, és egyszer használható.");
  // ⛔ ADR-0440 ⑧ (owner, 2026-11-12): no „hívjon minket: {phone}” line any more — the company
  // phone is left out of every customer-facing text.
  const text =
    `${greeting}\n\n${intro}\n\n` +
    (missing.length ? `${missHead}\n${missing.map((m) => `• ${m}`).join("\n")}\n${missTail}\n\n` : "") +
    `${button}: ${setPasswordUrl}\n${fresh}\n\n` +
    `${T(lang, "Felhasználónév:")} ${username}\n` +
    `${loginTextLine(lang, loginUrl)}\n`;
  return platformMail({
    to,
    subject,
    text,
    lang,
    heading: T(lang, "Még nem lépett be"),
    greeting,
    siteName,
    footerReason: "trial",
    ownerLogin: false,
    blocks: [
      mailPara(esc(intro).replace(esc(siteName), `<b>${esc(siteName)}</b>`)),
      ...(missing.length ? [mailPara(`<b>${esc(missHead)}</b><br>${missing.map((m) => `• ${esc(m)}`).join("<br>")}<br>${esc(missTail)}`)] : []),
      mailButton(setPasswordUrl, button),
      mailNote(esc(fresh)),
      mailDetails([{ label: T(lang, "Felhasználónév"), value: username, mono: true }, loginDetailRow(lang, loginUrl)]),
    ],
  });
}

/** The START SMS (sent with the credentials letter): accent-free, ≤ 2 segments. */
export function buildLoginStartSmsText(input: {
  siteName: string;
  username: string;
  setPasswordUrl: string;
  lang?: string;
}): string {
  const url = input.setPasswordUrl.replace(/^https?:\/\//, "");
  return toGsm7(
    T(input.lang, "Citoviso: elindult {art} {site} ingyenes próbája. Jelszó beállítása és belépés: {url} Felhasználónév: {user}", {
      art: huArticleLower(input.siteName),
      site: input.siteName,
      url,
      user: input.username,
    }),
  );
}

/** The REMINDER SMS (day 2/4/6/8 while no password is set): accent-free, ≤ 2 segments. */
export function buildLoginReminderSmsText(input: {
  siteName: string;
  daysLeft: number;
  setPasswordUrl: string;
  /** ADR-0429 — the open setup topics; named only while the SMS still fits 2 segments. */
  missing?: readonly string[];
  lang?: string;
}): string {
  const url = input.setPasswordUrl.replace(/^https?:\/\//, "");
  const base = buildReminderSmsBase(input, url);
  const missing = input.missing ?? [];
  if (!missing.length) return base;
  const names = missing.slice(0, 2).join(", ") + (missing.length > 2 ? ` +${missing.length - 2}` : "");
  const withMissing = toGsm7(
    `${base} ${T(input.lang, "Még hiányzik: {list} — belépés után végigvezetjük.", { list: names })}`,
  );
  return smsEncoding(withMissing).segments <= 2 ? withMissing : base;
}

function buildReminderSmsBase(input: { siteName: string; daysLeft: number; lang?: string }, url: string): string {
  return toGsm7(
    T(input.lang, "Citoviso: még nem lépett be {art} {site} honlapjába, a próbából még {n} nap van. Jelszó beállítása egy kattintással: {url}", {
      art: huArticleLower(input.siteName),
      site: input.siteName,
      n: String(input.daysLeft),
      url,
    }),
  );
}

/**
 * ADR-0425 — the trial-day-7 HELPER letter (owner-approved frame, 2026-11-05, plan
 * assets/design-refs/console/proba-eszkalacio/ „P2”): personal tone, signed with a LOCAL
 * name (helperPersona), a fresh one-time password link, the username, and one sentence about
 * the trialist's OWN live page (its first heading, read from the page — never invented).
 * No phone call is offered (owner 2026-11-05: zero human in sales/setup) — the reader is
 * asked to reply in writing.
 */
export function buildTrialHelperEmail(input: {
  to: string;
  username: string;
  setPasswordUrl: string;
  loginUrl: string;
  siteName: string;
  contactName: string | null;
  /** Whole days the site has been live (≥ 6 on trial day 7). */
  daysLive: number;
  /** Whole Budapest days left (trialDaysLeft). */
  daysLeft: number;
  trialUntilIso: string;
  /** The live page's first heading, or null (then the sentence is left out). */
  heroHeading: string | null;
  /** The helper's local name, or null (→ team signature). */
  helperName: string | null;
  fromName: string;
  lang?: string;
}): EmailMessage {
  const { to, username, setPasswordUrl, loginUrl, siteName, lang } = input;
  const greeting = mailGreeting(lang, input.contactName, true);
  const subject = T(lang, "Segíthetek a belépésben? – {site}", { site: siteName });
  const me = input.helperName
    ? T(lang, "{name} vagyok, a Citoviso ügyfélsegítője.", { name: input.helperName })
    : T(lang, "A Citoviso ügyfélsegítőjeként írok.");
  const intro = T(
    lang,
    "Láttam, hogy {art} {site} honlapja már {n} napja él, de a szerkesztőbe még nem lépett be — gondoltam, írok Önnek, hátha valahol elakadt.",
    { art: huArticleLower(siteName), site: siteName, n: String(input.daysLive) },
  );
  const hero = input.heroHeading
    ? T(lang, "Az oldala nyitóképén most ez áll: „{h}” — a szerkesztőben ezt is egy kattintással átírhatja.", { h: input.heroHeading })
    : null;
  const lead = T(lang, "A belépéshez elég egy kattintás, ezzel beállítja a saját jelszavát:");
  const button = T(lang, "Jelszó beállítása");
  const fresh = T(lang, "Új link, 7 napig érvényes, és egyszer használható.");
  const help = T(lang, "Ha valahol elakad, írja meg válaszként, hol — és megmutatom, merre tovább.");
  const left = T(lang, "A próbából még {n} nap van, {until}-ig.", {
    n: String(input.daysLeft),
    until: formatDayLongStem(input.trialUntilIso, lang),
  });
  const bye = T(lang, "Üdvözlettel:");
  const sig = input.helperName
    ? `${input.helperName}\n${T(lang, "Citoviso ügyfélsegítő")}`
    : T(lang, "A Citoviso csapata");
  const text =
    `${greeting}\n\n${me} ${intro}\n\n` +
    (hero ? `${hero}\n\n` : "") +
    `${lead}\n${button}: ${setPasswordUrl}\n${fresh}\n\n` +
    `${T(lang, "Felhasználónév:")} ${username}\n` +
    `${loginTextLine(lang, loginUrl)}\n\n` +
    `${help}\n\n${left}\n\n${bye}\n${sig}\n`;
  const mail = platformMail({
    to,
    subject,
    text,
    lang,
    heading: T(lang, "Segíthetek a belépésben?"),
    greeting,
    siteName,
    footerReason: "trial",
    ownerLogin: false,
    blocks: [
      mailPara(`${esc(me)} ${esc(intro)}`),
      ...(hero ? [mailPara(esc(hero))] : []),
      mailPara(esc(lead)),
      mailButton(setPasswordUrl, button),
      mailNote(esc(fresh)),
      mailDetails([{ label: T(lang, "Felhasználónév"), value: username, mono: true }, loginDetailRow(lang, loginUrl)]),
      mailPara(esc(help)),
      mailPara(esc(left)),
      mailPara(`${esc(bye)}<br>${esc(sig).replace(/\n/g, "<br>")}`),
    ],
  });
  return { ...mail, fromName: input.fromName };
}

/** ADR-0425 — the companion SMS of the day-5 live-site MMS: accent-free, 1 segment with a real link. */
export function buildTrialMmsSmsText(input: { setPasswordUrl: string; lang?: string }): string {
  const url = input.setPasswordUrl.replace(/^https?:\/\//, "");
  return toGsm7(T(input.lang, "Citoviso: a képen már az Ön élő honlapja. Szerkesztés egy kattintással: {url}", { url }));
}
