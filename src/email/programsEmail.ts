// A heti programajánló levele a TULAJNAK (a `poi` modul). ⛔ Csak a tulajnak: a foglalt
// vendégeknek szóló heti levél tulajdonosi döntéssel kiesett (2026-09-22).
//
// JÓVÁHAGYOTT IRÁNY (tulaj, 2026-09-23): a §2b-kör B változata („listával") + egy
// FIGYELMEZTETÉS, hogy a kiválasztás az ő dolga. Mivel a szabad helyeket az automatika
// tölti ki (ugyanaznapi döntés), a figyelmeztetés ezt is kimondja — különben azt hinné,
// hogy amíg nem választ, üres a honlapja, vagy azt, hogy nincs teendője.
//
// A keret a havi forgalmi levélé (trafficEmail.ts): minden szerkezet fix szélességű
// <table>, a 600px-es kalitka MSO-feltételes kommentben (ADR-0101 lecke).

import { T } from "../i18n/mail.js";
import type { EmailMessage } from "./sender.js";
import { bandBrand } from "./platformLayout.js";

const NAVY = "#0e2a47";
const CYAN = "#1fb6d6";
const INK = "#10243a";
const MUTED = "#60748b";
const LINE = "#e3ecf2";
const PAGE = "#eef3f7";
const WARN_BG = "#fdf6e6";
const WARN_LINE = "#ecd39a";
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface ProgramsEmailInput {
  readonly to: string;
  readonly siteName: string;
  /** The tenant's own settlement ("Révfülöp"). */
  readonly area: string;
  /** Programs in the circle for the next two weeks. */
  readonly poolCount: number;
  /** How many of the 10 slots the OWNER chose (still live). */
  readonly pickedCount: number;
  /** Slots the automation fills because the owner has not chosen them. */
  readonly autoCount: number;
  /** The nearest programs, already chosen by the caller (max 5), date-sorted. */
  readonly nearest: readonly {
    readonly start: string;
    readonly name: string;
    readonly settlement: string;
    readonly distanceKm: number | null;
  }[];
  /** The picker's full URL. */
  readonly adminUrl: string;
  readonly lang?: string;
}

export function buildProgramsEmail(input: ProgramsEmailInput): EmailMessage {
  const { to, siteName, area, poolCount, pickedCount, autoCount, nearest, adminUrl, lang } = input;
  let dm: Intl.DateTimeFormat;
  try {
    dm = new Intl.DateTimeFormat(lang || "hu", { month: "short", day: "numeric", timeZone: "UTC" });
  } catch {
    dm = new Intl.DateTimeFormat("hu", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  const day = (iso: string) => dm.format(new Date(`${iso}T12:00:00Z`));
  const dist = (k: number | null) => (k == null ? T(lang, "helyben") : T(lang, "{n} km", { n: String(k) }));

  const subject = T(lang, "{name} — {n} program a környéken a következő két hétben", {
    name: siteName,
    n: String(poolCount),
  });
  const sentence = T(lang, "{n} programot találtunk {area} 30 km-es körzetében a következő két hétre.", {
    n: String(poolCount),
    area,
  });
  const status =
    pickedCount === 0
      ? T(lang, "Még nem választott programot: a honlapján mind a {auto} helyet az automatika töltötte ki a legközelebbiekkel.", {
          auto: String(autoCount),
        })
      : autoCount > 0
      ? T(lang, "A honlapján most {picked} programot Ön választott, {auto} helyet az automatika töltött ki a legközelebbiekkel.", {
          picked: String(pickedCount),
          auto: String(autoCount),
        })
      : T(lang, "A honlapján mind a 10 programot Ön választotta.");
  const warning = T(
    lang,
    "Önnek kell kiválasztania, mely programok kerüljenek a honlapjára. Amíg nem választ, a legközelebbieket tesszük ki automatikusan.",
  );
  const listHead = T(lang, "A legközelebbiek");
  const cta = T(lang, "Kiválasztom, mi kerüljön ki");

  const text =
    `${sentence}\n\n${status}\n\n${warning}\n\n${listHead}:\n` +
    nearest.map((e) => `- ${day(e.start)} · ${e.settlement} · ${dist(e.distanceKm)} — ${e.name}`).join("\n") +
    `\n\n${cta}: ${adminUrl}\n`;

  const tbl = (attrs: string, inner: string): string =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${attrs}>${inner}</table>`;

  const rows = nearest
    .map(
      (e) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid ${LINE};font-family:${FONT}">` +
        `<div style="font-size:12px;font-weight:700;color:${CYAN}">${esc(`${day(e.start)} · ${e.settlement} · ${dist(e.distanceKm)}`)}</div>` +
        `<div style="font-size:15px;color:${INK};margin-top:2px">${esc(e.name)}</div></td></tr>`,
    )
    .join("");

  // E4 logo, CID-inline (owner, 2026-09-25: not the old "CITOVISO." text mark).
  const brand = bandBrand();
  const inner = tbl(
    `width="100%" style="width:100%;max-width:600px;background:#ffffff" bgcolor="#ffffff"`,
    `<tr><td style="padding:18px 20px 12px;border-bottom:2px solid ${CYAN}">` +
      tbl(
        `width="100%"`,
        `<tr><td align="left" style="font-family:${FONT};font-size:13px;font-weight:700;` +
          `letter-spacing:2px;color:${NAVY};text-transform:uppercase">${brand.html}</td>` +
          `<td align="right" style="font-family:${FONT};font-size:10px;letter-spacing:1.5px;` +
          `color:${MUTED};text-transform:uppercase">${esc(T(lang, "Heti programajánló"))}</td></tr>`,
      ) +
      `</td></tr>` +
      `<tr><td style="padding:20px 20px 14px"><p style="margin:0;font-family:${FONT};font-size:21px;line-height:1.35;color:${INK}">` +
      `${esc(sentence)}</p></td></tr>` +
      `<tr><td style="padding:0 20px 12px"><div style="padding:12px 14px;border:1px solid ${LINE};border-radius:10px;` +
      `font-family:${FONT};font-size:15px;line-height:1.5;color:${INK}">${esc(status)}</div></td></tr>` +
      `<tr><td style="padding:0 20px 16px"><div style="padding:12px 14px;background:${WARN_BG};border:1px solid ${WARN_LINE};` +
      `border-radius:10px;font-family:${FONT};font-size:15px;line-height:1.5;font-weight:600;color:${INK}">${esc(warning)}</div></td></tr>` +
      (rows
        ? `<tr><td style="padding:0 20px 6px;font-family:${FONT};font-size:13px;font-weight:700;color:${MUTED};` +
          `text-transform:uppercase;letter-spacing:1px">${esc(listHead)}</td></tr>` +
          `<tr><td style="padding:0 20px 18px">${tbl(`width="100%"`, rows)}</td></tr>`
        : "") +
      `<tr><td style="padding:0 20px 24px">` +
      tbl(
        `cellpadding="0"`,
        `<tr><td bgcolor="${NAVY}" style="background:${NAVY};border-radius:8px">` +
          `<a href="${esc(adminUrl)}" style="display:block;padding:12px 24px;font-family:${FONT};` +
          `font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(cta)}</a></td></tr>`,
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

  return {
    to,
    subject,
    text,
    html,
    audience: "platform",
    ...(brand.attachments.length ? { attachments: brand.attachments } : {}),
  };
}
