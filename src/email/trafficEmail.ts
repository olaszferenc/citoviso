// Havi forgalmi levél a tenantnak (ADR-0108).
//
// MIÉRT LÉTEZIK: a tenant a fordulónapon azt mérlegeli, megérte-e. Ez a levél az
// egyetlen, ami magától odaviszi a választ — a Forgalom fülre be kell lépni, a levél
// viszont megérkezik. A megújítás melletti legerősebb érv nem érvelés, hanem szám.
//
// A LEVÉL A KÉPERNYŐ KERETÉT KÖVETI (jóváhagyott terv:
// assets/design-refs/tenant-admin/traffic/): MONDATTAL kezd, a bontás csak alatta jön,
// és minden mondat elmarad, amit nem tudunk igazul kimondani.
//
// ⛔ OUTLOOK-BIZTOS SZERKEZET (ADR-0101 lecke): a Word-motor eldobja a `max-width`-et
// <div>-en, ezért itt minden szerkezet fix szélességű <table>, a 600px-es kalitka pedig
// MSO-feltételes kommentben megy — a többi kliens a folyékony táblát kapja, különben
// 390px-en levágná a sorokat. A régebbi tenant-levelek még div+max-width alakúak; azok
// egyszerűbbek, de ez a levél táblázatos tartalmat hordoz, ahol a törés látványos.

import { T } from "../i18n/mail.js";
import type { TrafficReport } from "../analytics/trafficReport.js";
import type { EmailMessage } from "./sender.js";

const NAVY = "#0e2a47";
const CYAN = "#1fb6d6";
const INK = "#10243a";
const MUTED = "#60748b";
const LINE = "#e3ecf2";
const PAGE = "#eef3f7";
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface TrafficEmailInput {
  readonly to: string;
  /** A szállás neve — a tárgysorban ez a horog. */
  readonly siteName: string;
  /** Az időszak emberi neve, pl. „augusztus". */
  readonly periodLabel: string;
  readonly report: TrafficReport;
  /** A tenant-admin Forgalom fülének teljes URL-je. */
  readonly adminUrl: string;
  readonly lang?: string;
}

/**
 * A havi kimutatás levele. CSAK akkor hívd, ha van mit mondani — az üres hónapról
 * küldött „0 vendég" levél nem tájékoztat, csak elkedvetlenít (a hívó szűr).
 */
export function buildTrafficEmail(input: TrafficEmailInput): EmailMessage {
  const { to, siteName, periodLabel, report: r, adminUrl, lang } = input;

  const sentence = T(lang, "{v} nézte meg az oldalát, és {c} kereste meg Önt.", {
    v: T(lang, "{n} vendég", { n: String(r.visitors) }),
    c: String(r.contacts),
  });

  const rows: [string, string][] = [
    [T(lang, "Megnyitások"), String(r.views)],
    [T(lang, "Megkeresés (foglalás, érdeklődés)"), String(r.contacts)],
  ];
  if (r.fromGooglePct !== null) rows.push([T(lang, "Google-ből érkezett"), `${r.fromGooglePct}%`]);
  if (r.mobilePct !== null) rows.push([T(lang, "Telefonon nézte"), `${r.mobilePct}%`]);

  // Ugyanaz a kihagyási szabály, mint a képernyőn: mintát nem hazudunk.
  const ratio =
    r.visitorsPerContact !== null
      ? T(lang, "Minden {n}. látogatóból lesz megkeresés.", { n: String(r.visitorsPerContact) })
      : "";
  const hosts = r.hostSplit
    ? T(lang, "A saját címén ({domain}) {a}, a citoviso-címen {b} megnyitás.", {
        domain: r.hostSplit.domain,
        a: String(r.hostSplit.custom),
        b: String(r.hostSplit.slug),
      })
    : "";
  const botNote = T(lang, "A keresőrobotokat nem számoljuk bele.");

  const subject = T(lang, "{name} — {period}i forgalom", { name: siteName, period: periodLabel });

  const text =
    `${sentence}\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\n` +
    [ratio, hosts, botNote].filter(Boolean).join(" ") +
    `\n\n${T(lang, "Részletek és korábbi időszakok:")} ${adminUrl}\n`;

  const tbl = (attrs: string, inner: string): string =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${attrs}>${inner}</table>`;

  // Egy sor = EGY keretezett cella, benne egy keret nélküli belső tábla tartja a
  // címke/érték párt. (Két külön keretes cellából két külön „pirula" lenne — a
  // képernyőn egy doboz van, és a levél a képernyő keretét követi.)
  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 13px;border:1px solid ${LINE};border-radius:10px">` +
        tbl(
          `width="100%"`,
          `<tr><td align="left" style="font-family:${FONT};font-size:15px;color:${INK}">${esc(k)}</td>` +
            `<td align="right" style="font-family:${FONT};font-size:16px;font-weight:700;color:${INK}">${esc(v)}</td></tr>`,
        ) +
        `</td></tr>` +
        `<tr><td style="height:8px;line-height:8px">&nbsp;</td></tr>`,
    )
    .join("");

  const inner = tbl(
    `width="100%" style="width:100%;max-width:600px;background:#ffffff" bgcolor="#ffffff"`,
    `<tr><td style="padding:18px 20px 12px;border-bottom:2px solid ${CYAN}">` +
      tbl(
        `width="100%"`,
        `<tr><td align="left" style="font-family:${FONT};font-size:13px;font-weight:700;` +
          `letter-spacing:2px;color:${NAVY};text-transform:uppercase">Citoviso<span style="color:${CYAN}">.</span></td>` +
          `<td align="right" style="font-family:${FONT};font-size:10px;letter-spacing:1.5px;` +
          `color:${MUTED};text-transform:uppercase">${esc(T(lang, "Havi forgalom"))}</td></tr>`,
      ) +
      `</td></tr>` +
      `<tr><td style="padding:20px 20px 0">` +
      `<p style="margin:0 0 16px;font-family:${FONT};font-size:21px;line-height:1.35;color:${INK}">` +
      `${esc(sentence)}</p></td></tr>` +
      `<tr><td style="padding:0 20px">${tbl(`width="100%"`, rowHtml)}</td></tr>` +
      `<tr><td style="padding:4px 20px 18px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED}">` +
      (ratio ? `<b style="color:${INK}">${esc(ratio)}</b><br>` : "") +
      `${esc([hosts, botNote].filter(Boolean).join(" "))}</td></tr>` +
      `<tr><td style="padding:0 20px 24px">` +
      tbl(
        `cellpadding="0"`,
        `<tr><td bgcolor="${NAVY}" style="background:${NAVY};border-radius:8px">` +
          `<a href="${esc(adminUrl)}" style="display:block;padding:12px 24px;font-family:${FONT};` +
          `font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(T(lang, "Részletek megnyitása"))}</a>` +
          `</td></tr>`,
      ) +
      `</td></tr>`,
  );

  const html =
    `<!DOCTYPE html><html lang="${lang || "hu"}"><body style="margin:0;padding:0;background:${PAGE}">` +
    tbl(
      `width="100%" bgcolor="${PAGE}" style="background:${PAGE}"`,
      `<tr><td align="center" style="padding:0">` +
        `<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
        inner +
        `<!--[if mso]></td></tr></table><![endif]-->` +
        `</td></tr>`,
    ) +
    `</body></html>`;

  return { to, subject, text, html, audience: "platform" };
}
