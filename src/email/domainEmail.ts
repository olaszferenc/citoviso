// Saját webcím — értesítő a beszerzés végéről (ADR-0071/0078).
//
// MIÉRT LÉTEZIK: a „Webcím" fül és a tudásbázis is AZT ÍGÉRI, hogy „e-mailben jelezzük,
// amint kész". Ígéret, amit a rendszer nem teljesít, ugyanaz a hiba-osztály, mint egy
// kitalált tény a generált oldalon (§B.17 — magunkról sem állítunk valótlant). A
// beszerzés percekig fut a háttérben, a tulaj pedig közben elnavigál — értesítés nélkül
// csak véletlenül tudná meg, hogy kész.
//
// ADR-0067/§B.18: a tenant SAJÁT site-nyelvén szól. A hívó oldja fel (langForTenant) és
// gondoskodik a nyelvi csomagról (prepareMailLang), mielőtt ezt hívja.

import { T } from "../i18n/mail.js";
import { mailButton, mailDetails, mailNote, mailPara, platformMail } from "./platformLayout.js";
import type { EmailMessage } from "./sender.js";
import { huArticle } from "../hu.js";

/** A honlap átköltözött az új saját címre. */
export function buildDomainLiveEmail(input: {
  to: string;
  /** A megvásárolt domain (ez már él). */
  domain: string;
  /** A korábbi platform-cím, ami mostantól ide irányít. */
  previousHost: string | null;
  lang?: string;
}): EmailMessage {
  const { to, domain, previousHost, lang } = input;
  const url = `https://${domain}`;
  const redirectLine = previousHost
    ? T(lang, "A korábbi cím ({host}) automatikusan az új címre irányít, így a már kiadott névjegyek és hivatkozások is működnek tovább.", { host: previousHost })
    : "";

  const text =
    T(lang, "Elkészült a saját webcíme") +
    `\n\n` +
    T(lang, "A honlapja mostantól itt érhető el:") +
    ` ${url}\n\n` +
    (redirectLine ? `${redirectLine}\n\n` : "") +
    T(lang, "Nincs teendője — a beállításokat elvégeztük.") +
    `\n`;

  return platformMail({
    to,
    subject: T(lang, "Elkészült a saját webcíme"),
    text,
    lang,
    heading: T(lang, "Elkészült a saját webcíme"),
    blocks: [
      mailPara(T(lang, "A honlapja mostantól itt érhető el:")),
      mailDetails([{ label: T(lang, "Webcím"), value: domain, emphasis: true }]),
      mailButton(url, T(lang, "Honlap megnyitása")),
      ...(redirectLine ? [mailNote(redirectLine)] : []),
      mailPara(T(lang, "Nincs teendője — a beállításokat elvégeztük.")),
    ],
  });
}

/** A beszerzés elakadt: a nevet időközben elvitték — a tulaj választhat másikat. */
export function buildDomainFailedEmail(input: {
  to: string;
  /** Amit meg akartunk venni, de nem sikerült. */
  domain: string;
  /** A tenant-admin „Webcím" fülének teljes URL-je. */
  adminUrl: string;
  lang?: string;
}): EmailMessage {
  const { to, domain, adminUrl, lang } = input;

  // ⛔ Visszautalást NEM ígérünk (ADR-0078): a Barion Refund API létezik, de nálunk
  // nincs megírva. A tenant másik nevet választ, arra fordítjuk az összeget.
  const body = T(
    lang,
    "{Art} {domain} nevet sajnos időközben más lefoglalta, ezért nem tudtuk megvásárolni. A befizetett összeg nem vész el: egy másik névre fordítjuk.",
    { Art: huArticle(domain), domain },
  );

  const text =
    T(lang, "A választott webcím időközben elkelt") +
    `\n\n${body}\n\n` +
    T(lang, "Válasszon másik nevet itt:") +
    ` ${adminUrl}\n`;

  return platformMail({
    to,
    subject: T(lang, "A választott webcím időközben elkelt"),
    text,
    lang,
    heading: T(lang, "A választott webcím időközben elkelt"),
    blocks: [mailPara(body), mailButton(adminUrl, T(lang, "Másik név választása"))],
  });
}

/** ADR-0094 ② (jóváhagyott B terv): a lemondás-elszámolás rögzült — itt a fizetési
 *  link. A záró képernyő ÍGÉRI ezt a levelet („a fizetéshez e-mailben küldjük a
 *  linket") — a nem teljesített ígéret ugyanaz a hiba-osztály, mint a kitalált tény. */
export function buildDomainSettlementEmail(input: {
  to: string;
  /** A hűséggel érintett webcím. */
  domain: string;
  /** Előre formázott végösszeg, pl. "76 000 Ft". */
  totalFormatted: string;
  /** Hátralévő hónapok száma (a kötbér-sor tétele). */
  monthsRemaining: number;
  /** A vállalt havi minimum, előre formázva, pl. "8 000 Ft". */
  penaltyBaseFormatted: string;
  /** true = a kilépő a webcímet is viszi (a vételár benne van a végösszegben). */
  takeDomain: boolean;
  payUrl: string;
  /** ISO dátum, ameddig a honlap elérhető marad; null = még nem ismert. */
  accessEndDate: string | null;
  lang?: string;
}): EmailMessage {
  const { to, domain, totalFormatted, monthsRemaining, penaltyBaseFormatted, takeDomain, payUrl, accessEndDate, lang } = input;
  const subject = T(lang, "Lemondás-elszámolás — fizetési link");
  const penaltyLine = T(lang, "Kötbér: a hátralévő {k} hónap × {base} vállalt minimum díj.", {
    k: String(monthsRemaining),
    base: penaltyBaseFormatted,
  });
  const fate = takeDomain
    ? T(lang, "{Art} {domain} webcímet elviszi: a tulajdonjog a teljes elszámolás maradéktalan rendezése után száll át, a lépéseket ezután küldjük.", { Art: huArticle(domain), domain })
    : T(lang, "{Art} {domain} webcímet nem viszi el: az nálunk marad.", { Art: huArticle(domain), domain });
  const accessLine = accessEndDate
    ? T(lang, "A honlap {date} napig elérhető marad, utána lekerül.", { date: accessEndDate })
    : "";
  const payLabel = T(lang, "Elszámolás rendezése");
  const lines = [
    T(lang, "Előfizetése lemondását a webcím-hűségidő alatti elszámolással rögzítettük."),
    penaltyLine,
    T(lang, "Összesen fizetendő: {total}.", { total: totalFormatted }),
    fate,
    ...(accessLine ? [accessLine] : []),
  ];

  const text =
    `${subject}\n\n` +
    lines.join("\n\n") +
    `\n\n${payLabel}: ${payUrl}\n`;

  return platformMail({
    to,
    subject,
    text,
    lang,
    heading: subject,
    blocks: [
      ...lines.map(mailPara),
      mailButton(payUrl, payLabel),
      mailNote(T(lang, "Ha a link nem nyílik meg, másolja a böngészőbe: {url}", { url: payUrl })),
    ],
  });
}
