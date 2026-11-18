// A süti-hozzájárulás sáv + a Barion Pixel — EGY FORRÁS, KÉT KISZOLGÁLÓ.
//
// ⛔ MIÉRT KÖZÖS MODUL (2026-09-15, ADR-0172). A `citoviso.com` élesben KÉT processz
// között van felosztva (nginx: `/etc/nginx/sites-enabled/citoviso`), és a hasítás
// pont a vásárlási úton megy át:
//   · public (:4800) — `/`, `/login`, `/adatvedelem`, `/aszf`, tenant-admin …
//   · konzol (:4600) — `/pay/…` (köztük a `/pay/done`, a Barion RedirectUrl!),
//     `/configure/…`, `/p/…`, `/privacy`, `/site/…`, `/mock/…`
// A sávot eddig CSAK a public tette ki, tehát a vevő fizetési útja MÉRTEN Pixel
// nélkül futott — miközben a Barion előírása szerint a Pixelnek a webshop MINDEN
// oldalán ott kell lennie. Ha a snippet két példányban élne, a két processz két
// igazságot mondana ugyanarról a dokumentumról (a `/privacy` és az `/adatvedelem`
// pontosan ezt csinálta: ugyanaz a lap, az egyiken sáv+Pixel, a másikon semmi).
//
// A beillesztés a KÖZÖS KIMENETEN történik (mindkét szerver `send()`-je), nem
// oldalanként — ott egy új route könnyen kimaradna.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { config } from "../config.js";
import { jsonForScript } from "../text/jsonForScript.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { COOKIE_BAR_TEXT_V1 } from "../legal.js";
import { legalTextForLang } from "../legalPack.js";

const escAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The bar's labels for a NON-Hungarian page, as data-t-* attributes of the loader script
 * (cit-consent.js reads them, its Hungarian literals are the fallback). ORSZÁG-RÉTEG 3/7
 * (ADR-0458): the wording is part of the country's LEGAL pack (src/legal.ts COOKIE_BAR_TEXT_V1),
 * printed in the page's declared language. A Hungarian page — or one that declares no
 * language — gets nothing: its markup is byte for byte the old one.
 */
function consentLabelAttrs(lang: string | undefined): string {
  if (!lang || lang === DEFAULT_LANG) return "";
  return (
    Object.entries(COOKIE_BAR_TEXT_V1)
      .map(([k, hu]) => ` data-t-${k}="${escAttr(legalTextForLang(lang, hu))}"`)
      .join("") +
    // …and its privacy link opens the notice in the same language (legalViews `?l=`).
    ` data-t-href="/adatvedelem?l=${escAttr(lang)}"`
  );
}

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

/**
 * Content fingerprint of a consent runtime asset — see the CDN note at withAssetVersions.
 *
 * Mindkét fájl a CDN-en át megy, tehát tartalom-ujjlenyomat kell — különben egy
 * jövőbeli javítás (a Pixel-indítás szigorítása vagy épp a sáv stílusa) órákig nem
 * érne el a látogatókhoz. A `withAssetVersions` ITT NEM SEGÍT: az MÉRTEN csak a
 * honlapra fut, a jogi/belépés/admin lapok stíluslapjai verzió nélkül hivatkozódnak.
 * Szinkron olvasás, mert a hívó ág (`send`) szinkron; a fájl a deploy után nem
 * változik, ezért egyszer számoljuk ki.
 */
function consentAssetVersion(file: string): string {
  try {
    return createHash("sha1")
      .update(readFileSync(path.join(PUBLIC_DIR, "assets/runtime", file)))
      .digest("hex")
      .slice(0, 8);
  } catch {
    return "0";
  }
}
const CONSENT_JS_VERSION = consentAssetVersion("cit-consent.js");
const CONSENT_CSS_VERSION = consentAssetVersion("cit-consent.css");

/**
 * KINEK SZÓL EZ A LAP — a süti-sáv és a Barion Pixel EGYETLEN hatókör-szabálya.
 *
 * ⛔ A HIBAOSZTÁLY: „hol húzódik a határ". A korábbi jelölő egy BOOLEAN volt, amit
 * egy adott SORBAN tettünk ki — a hatókör tehát attól függött, hogy egy route a
 * jelölő fölött vagy alatt áll. Ez MÉRTEN háromszor volt rossz:
 *   · 2026-09-14 (ADR-0145): a `/t/<slug>` dev-ág a jelölő ALATT volt → a vendég-oldal
 *     megkapta a sávot és a Pixelt. A javítás: az ág a jelölő FÖLÉ került.
 *   · 2026-09-14 (ADR-0151): a vendég LEMONDÓ lapjai a jelölő alatt élnek, ezért
 *     ugyanúgy megkapták — és velük együtt a `/site/<token>` és a `/m/<token>`,
 *     vagyis UGYANAZ a generált szállás-oldal két további kiszolgálási úton.
 *   · 2026-09-15 (ADR-0172): a MÁSIK PROCESSZ egyáltalán nem ismerte a szabályt —
 *     a vevő fizetési útja Pixel nélkül futott. A hatókör-kérdés tehát nem is
 *     egyetlen fájl belügye volt.
 *
 * A SZABÁLY: a sáv+Pixel a MI webshopunk lapjaira való — ahol a látogató a mi
 * (leendő) ügyfelünk, és ahol a mi fizetési utunk futhat. Kimarad
 *   ① minden lap, amelynek CÍMZETTJE a tenant VENDÉGE (a generált szállás-oldal
 *      BÁRMELYIK kiszolgálási útján, és a mock, ami azt mutatja be),
 *   ② a belső, OPERÁTOR-felület (nem webshop-lap; a saját munkatársaink követése a
 *      csalásmegelőző jelzést is hígítaná).
 *
 * ⭐ A sáv és a Pixel EGYÜTT mozog: mindkettő ugyanabból az egy `consentSnippet()`-ből
 * kerül ki, ezért „vegyük ki a sávot, de hagyjuk a Pixelt" szerkezetileg lehetetlen
 * (ADR-0145 ③ ezt mondta ki a tenant-adminra; azóta ez tartja a vendég-oldalt és a
 * fizetési utat is).
 */
export const PAGE_AUDIENCE = Symbol.for("cit.pageAudience");
export type PageAudience = "own" | "guest" | "operator";

/**
 * A sáv + a Pixel betöltője. ⛔ Azonosító nélkül üres string: sáv sincs, Pixel sincs
 * (§B.17 — nem kérünk hozzájárulást olyan követésre, ami meg sem történik).
 *
 * ⛔ A STÍLUS A SÁVVAL EGYÜTT UTAZIK (2026-09-14). A `#cit-consent` szabályok
 * korábban a `home.css`-ben éltek, azt viszont MÉRTEN csak a `public/index.html`
 * tölti be — így a sáv 12 saját felületből 11-en CSUPASZ, natív gombos sávként
 * jelent meg (Elek FK-005b H-1, FK-006b HIBA-2, FK-007 H2). Mivel a sávot EZ az
 * egy pont teszi ki, a stíluslapot is ez hivatkozza: egy jövőbeli saját lap nem
 * tudja „elfelejteni" behúzni.
 */
export function consentSnippet(lang?: string): { head: string; body: string } {
  // A Barion azonosító alakja `BP-<10 jel>-<2 jel>` (élő webshopokban mérve). Ami nem
  // ilyen, az el sem jut a lapra: szűrünk, nem escape-elünk — egy rossz konfig-érték
  // így nem kerülhet HTML-be, és a sáv sem jelenik meg.
  const pixelId = /^BP-[A-Za-z0-9]{6,20}-[A-Za-z0-9]{1,4}$/.test(config.barionPixelId)
    ? config.barionPixelId
    : "";
  if (!pixelId) return { head: "", body: "" };
  return {
    head: `<link rel="stylesheet" href="/assets/runtime/cit-consent.css?v=${CONSENT_CSS_VERSION}">`,
    body:
      `<script src="/assets/runtime/cit-consent.js?v=${CONSENT_JS_VERSION}" data-pixel-id="${pixelId}"${consentLabelAttrs(lang)} defer></script>` +
      `<noscript><img height="1" width="1" style="display:none" alt=""` +
      ` src="https://pixel.barion.com/a.gif?__ba_pixel_id=${pixelId}` +
      `&ev=contentView&noscript=1"></noscript>`,
  };
}

/**
 * Egy SZERVER-OLDALON tudott Pixel-esemény beadása a lapnak (ADR-0186).
 *
 * ⛔ A lap nem hívhatja közvetlenül a Pixelt: a hozzájárulás a `cit-consent.js`-ben
 * dől el, és egy közvetlen hívás megkerülné azt. Ezért a lap DEKLARATÍVAN sorba
 * teszi, amit küldene, a sor pedig kizárólag „Elfogadom" után ürül — hozzájárulás
 * nélkül az esemény némán elvész (nem raktározzuk el „majd később" küldésre, mert
 * az a hozzájárulás kijátszása volna).
 *
 * A JSON-t `<` mentesítéssel írjuk ki: egy `</script>` a NÉVBEN (például egy
 * szállás nevében) különben kinyitná a szkript-blokkot.
 */
export function pixelQueueScript(eventName: string, data: unknown): string {
  const json = jsonForScript(data);
  const name = jsonForScript(eventName);
  return (
    `<script>window.citPixelQueue=window.citPixelQueue||[];` +
    `window.citPixelQueue.push([${name},${json}]);</script>`
  );
}

/** Kimondja, kinek szól ez a válasz. A NEM deklarált alapértelmezés a nem-követés. */
export function markAudience(res: { }, audience: PageAudience): void {
  (res as Record<symbol, PageAudience>)[PAGE_AUDIENCE] = audience;
}

/**
 * A beillesztés — mindkét szerver `send()`-je ezt hívja.
 *
 * Csak akkor nyúl a HTML-hez, ha a válasz CÍMZETTJE kimondottan a miénk. Bármi más
 * (vendég, operátor, nem deklarált) érintetlenül megy ki.
 */
export function injectConsent(html: string, res: object): string {
  if ((res as Record<symbol, PageAudience | undefined>)[PAGE_AUDIENCE] !== "own") return html;
  if (!html.includes("</body>")) return html;
  // ORSZÁG-RÉTEG 3/5: the bar speaks the page's declared language (<html lang>).
  const snippet = consentSnippet(/<html\b[^>]*\slang="([a-z]{2,3})"/i.exec(html)?.[1]?.toLowerCase());
  if (!snippet.body) return html;
  // A stíluslap a HEAD-be megy, ha van — ott nem villan fel egy pillanatra a
  // csupasz sáv. Head nélküli (részleges) kimenetnél a body-ág elé fűzzük: a
  // sáv stílus nélkül SOHA ne jelenjen meg, akkor sem, ha a lap szokatlan.
  const withHead = html.includes("</head>")
    ? html.replace("</head>", `${snippet.head}</head>`)
    : html.replace("</body>", `${snippet.head}</body>`);
  return withHead.replace("</body>", `${snippet.body}</body>`);
}
