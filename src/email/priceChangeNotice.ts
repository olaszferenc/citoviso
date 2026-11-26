// „Országok / Árazás” 5. fázis (0156) — the PRICE-CHANGE NOTICE of a raise. Frozen design (owner 2026-11-26,
// variant A, no cancellation sentence): assets/design-refs/console/arvaltozas-ertesito/ (README = contract).
//
// Sent on the save day to every subscriber the raise touches, the frozen ones too, in the tenant's language
// (the caller resolves and provisions it — the same contract as billingEmail.ts). Amounts arrive as MINOR-unit
// integers of the subscription's currency and are formatted HERE (formatMinor), dates as ISO days (formatDay).
// Nothing here sends.
import { T } from "../i18n/mail.js";
import { formatDay } from "../text/day.js";
import { formatMinor } from "../text/money.js";
import { mailButton, mailDetails, mailNote, mailPara, platformMail, tenantLoginUrl } from "./platformLayout.js";
import type { EmailMessage } from "./sender.js";

export interface PriceChangeNoticeInput {
  readonly to: string;
  readonly lang?: string;
  readonly siteName: string;
  readonly currency: string;
  readonly cycle: "monthly" | "annual";
  /** Minor units: the price the subscriber pays now / from the first new charge. */
  readonly now: number;
  readonly next: number;
  /** ISO day the new prices start. */
  readonly effectiveFrom: string;
  /** ISO day of this subscriber's first charge at the new price. */
  readonly firstNewCharge: string;
  readonly frozen: boolean;
}

export function buildPriceChangeNoticeEmail(input: PriceChangeNoticeInput): EmailMessage {
  const { to, lang, siteName, currency, cycle, now, next, effectiveFrom, firstNewCharge, frozen } = input;
  const per = cycle === "annual" ? T(lang, "/ év") : T(lang, "/ hó");
  const money = (n: number): string => `${formatMinor(n, currency, lang)} ${per}`;
  const subject = T(lang, "Változik a honlap-előfizetése díja — {site}", { site: siteName });
  const heading = T(lang, "Változik az előfizetése díja");
  const intro = T(lang, "A Citoviso díjai {date} napjától változnak. Az Ön előfizetésére ez így vonatkozik:", { date: formatDay(effectiveFrom, lang) });
  const firstLabel = T(lang, "Első terhelés az új díjjal");
  const firstValue = frozen
    ? T(lang, "a folytatás utáni első terhelés (legkorábban {date})", { date: formatDay(effectiveFrom, lang) })
    : formatDay(firstNewCharge, lang);
  const frozenLine = frozen
    ? T(lang, "Az előfizetése most szünetel. Ha folytatja, a {date} utáni első terheléstől az új díj érvényes.", { date: formatDay(effectiveFrom, lang) })
    : null;
  const payLabel = T(lang, "Fizetés");
  const payValue = cycle === "annual" ? T(lang, "évente") : T(lang, "havonta");
  const blocks = [
    mailPara(intro),
    mailDetails([
      { label: T(lang, "Mostani díj"), value: money(now) },
      { label: T(lang, "Új díj"), value: money(next), emphasis: true, note: `(+${formatMinor(next - now, currency, lang)})` },
      { label: firstLabel, value: firstValue, rule: true },
      { label: payLabel, value: payValue },
    ]),
    ...(frozenLine ? [mailNote(frozenLine)] : []),
    mailButton(tenantLoginUrl(lang), T(lang, "Előfizetés kezelése")),
  ];
  const text = [
    intro,
    `${T(lang, "Mostani díj")}: ${money(now)}`,
    `${T(lang, "Új díj")}: ${money(next)}`,
    `${firstLabel}: ${firstValue}`,
    `${payLabel}: ${payValue}`,
    frozenLine,
  ]
    .filter(Boolean)
    .join("\n");
  return platformMail({ to, subject, text: `${text}\n`, lang, heading, siteName, blocks });
}
