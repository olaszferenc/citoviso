// Legal document pages for the PUBLIC site (ADR-0056): Impresszum, ÁSZF,
// Elállási tájékoztató, Adatfeldolgozási feltételek.
//
// The wording itself lives in src/legal.ts (deterministic, versioned, §H.22) —
// this module only dresses it. The provider's registry facts come from
// `config.legalEntity` (prod .env), never from git: an invented tax number on a
// public page is worse than a visibly missing one, so unfilled fields render as
// a loud `[KITÖLTENDŐ: …]` marker that `scripts/legal-check.mts` refuses to ship.

import { config } from "../config.js";
import { runWithConsoleLang } from "../console/i18nCtx.js";
import { esc, layout, privacyPage } from "../console/views.js";
import {
  ASZF_EFFECTIVE_FROM,
  ASZF_V1,
  ASZF_VERSION,
  DPA_V1,
  legalLocalFor,
  WITHDRAWAL_NOTICE_V1,
  type LegalSection,
} from "../legal.js";
import {
  consumerAdrValue,
  LEGAL_PLACEHOLDER,
  legalCountryForLang,
  legalHtmlUnits,
  translateLegalHtml,
  withCountryLinks,
  type LegalDoc,
  type LegalPack,
} from "../legalPack.js";

/** Our registry facts as the pages read them (config.legalEntity's shape). */
type Entity = typeof config.legalEntity;

/** The marker every unfilled legal field renders as. The guard greps for it. */
export const FILL_ME = "KITÖLTENDŐ";

/** Render a required identity field, or a loud placeholder when it is missing. */
function field(value: string, label: string): string {
  return value ? esc(value) : `<b>[${FILL_ME}: ${esc(label)}]</b>`;
}

/** Shared chrome for a legal document: title, sections, back-link to the site. */
function legalPage(title: string, intro: string, sections: readonly LegalSection[]): string {
  const body = `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>${esc(title)}</h2>
      <div class="small" style="line-height:1.7">
        ${intro}
        ${sections
          .map(
            (s) =>
              `<h3 style="margin-top:1.4em">${esc(s.heading)}</h3>` +
              s.body.map((p) => `<p>${esc(p)}</p>`).join(""),
          )
          .join("")}
        <p class="mut" style="margin-top:2em"><a href="/">← Vissza a főoldalra</a></p>
      </div>
    </div>`;
  return layout(title, body, { chrome: false });
}

/**
 * Impresszum — mandatory service-provider disclosure (Eker.tv. 4. §).
 * Every field the statute names is listed; a missing one shows as a marker
 * rather than being silently omitted, so the gap is visible in review.
 */
export function impresszumPage(pack?: LegalPack): string {
  if (pack && !pack.home) return countryPage(pack, (e) => impresszumHtml(e));
  return impresszumHtml(config.legalEntity);
}

function impresszumHtml(e: Entity): string {
  const body = `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>Impresszum</h2>
      <div class="small" style="line-height:1.7">
        <p>A Citoviso szolgáltatás üzemeltetője és a jelen honlap tartalmáért felelős
        szolgáltató — az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII.
        törvény 4. §-a szerinti adatok:</p>

        <p><b>Szolgáltató neve:</b> ${field(e.name, "cégnév / egyéni vállalkozó neve")}<br>
        <b>Székhely:</b> ${field(e.address, "székhely címe")}<br>
        <b>Nyilvántartási szám:</b> ${field(e.regNumber, "egyéni vállalkozói nyilvántartási szám")}<br>
        <b>Adószám:</b> ${field(e.taxNumber, "adószám")}<br>
        <b>E-mail:</b> ${field(e.email, "e-mail cím")}${
          e.phone ? `<br><b>Telefon:</b> ${esc(e.phone)}` : ""
        }</p>

        <p><b>Tárhelyszolgáltató:</b> Hetzner Online GmbH (Industriestr. 25, 91710 Gunzenhausen,
        Németország).</p>

        <p><b>Felügyeleti szerv:</b> a szolgáltatási tevékenység felügyeletét a székhely szerint
        illetékes kormányhivatal látja el. Fogyasztóvédelmi panasz esetén a lakóhely szerint
        illetékes békéltető testület jár el.</p>

        <p class="mut">Kapcsolódó dokumentumok:
        <a href="/aszf">ÁSZF</a> ·
        <a href="/adatvedelem">Adatkezelési tájékoztató</a> ·
        <a href="/elallas">Elállási tájékoztató</a> ·
        <a href="/adatfeldolgozas">Adatfeldolgozási feltételek</a></p>

        <p class="mut"><a href="/">← Vissza a főoldalra</a></p>
      </div>
    </div>`;
  return layout("Impresszum", body, { chrome: false });
}

/** ÁSZF (Eker.tv. 5. §) — the document `config.termsUrl` points at. */
export function aszfPage(pack?: LegalPack): string {
  if (pack && !pack.home) return countryPage(pack, (e) => aszfHtml(e, LEGAL_PLACEHOLDER("supportEmail"), pack.country));
  return aszfHtml(config.legalEntity, config.supportEmail, null);
}

function aszfHtml(e: Entity, supportEmail: string, country: string | null): string {
  // Barion acquirer checklist (2026-09-15): the T&C page itself must carry the
  // provider's registry number, e-mail and PHONE — the reviewer reads /aszf, and
  // a link to the Impresszum does not count as "included in the T&C".
  const intro =
    `<p class="mut">Verzió ${esc(ASZF_VERSION)} · hatályos ${esc(ASZF_EFFECTIVE_FROM)} napjától. ` +
    `Szolgáltató: ${field(e.name, "cégnév / egyéni vállalkozó neve")} ` +
    `(székhely: ${field(e.address, "székhely címe")}, ` +
    `nyilvántartási szám: ${field(e.regNumber, "egyéni vállalkozói nyilvántartási szám")}, ` +
    `adószám: ${field(e.taxNumber, "adószám")}, ` +
    `e-mail: ${field(e.email, "e-mail cím")}, ` +
    `telefon: ${field(e.phone, "telefonszám")}). ` +
    `A Szolgáltató további adatait az <a href="/impresszum">Impresszum</a> tartalmazza.</p>` +
    `<p>A jelen Általános Szerződési Feltételek (ÁSZF) a Szolgáltató és a Megrendelő között ` +
    `a Citoviso honlap-szolgáltatás tárgyában létrejövő szerződés feltételeit tartalmazzák. ` +
    `Elválaszthatatlan részét képezi az <a href="/elallas">Elállási tájékoztató</a> és az ` +
    `<a href="/adatfeldolgozas">Adatfeldolgozási feltételek</a>.</p>`;
  // Barion remark -003/1 (2026-09-16): §4 names the cancellation address. It is
  // substituted from config here so the T&C can never disagree with the address
  // the console prints (support-email-check ①: no hardcoded buyer-facing e-mail).
  // Substitution runs BEFORE esc() in legalPage; the address carries no markup.
  const sections = ASZF_V1.map((s) => ({
    heading: s.heading,
    body: s.body.map((p) => p.replace("{SUPPORT_EMAIL}", supportEmail)),
  }));
  // ORSZÁG-RÉTEG 3/7: OUR consumer dispute body where the country requires one (FR médiateur,
  // PT RAL). Its value is config; the Hungarian page has no such line (unchanged).
  const adr = country ? legalLocalFor(country).consumerAdr : undefined;
  const adrSection: LegalSection[] = adr
    ? [{ heading: adr.label, body: [`${adr.label}: ${LEGAL_PLACEHOLDER("consumerAdr")}`] }]
    : [];
  return legalPage("Általános Szerződési Feltételek", intro, [...sections, ...adrSection]);
}

/**
 * Withdrawal notice (45/2014. Korm. r.). Not optional decoration: the consumer's
 * waiver recorded at checkout (WITHDRAWAL_WAIVER_V1) is only valid if this
 * information was given BEFOREHAND.
 */
export function elallasPage(pack?: LegalPack): string {
  if (pack && !pack.home) return countryPage(pack, () => elallasPage());
  const intro =
    `<p>Az alábbi tájékoztató a fogyasztó és a vállalkozás közötti szerződések részletes ` +
    `szabályairól szóló 45/2014. (II. 26.) Korm. rendelet szerinti kötelező tájékoztatás. ` +
    `A Szolgáltató adatait az <a href="/impresszum">Impresszum</a> tartalmazza.</p>`;
  return legalPage("Elállási tájékoztató", intro, WITHDRAWAL_NOTICE_V1);
}

/** Data-processing terms (GDPR 28.) — annex to the ÁSZF. */
export function adatfeldolgozasPage(pack?: LegalPack): string {
  if (pack && !pack.home) return countryPage(pack, () => adatfeldolgozasPage());
  const intro =
    `<p>A jelen feltételek a GDPR 28. cikke szerinti adatfeldolgozási szerződésnek minősülnek ` +
    `a Szolgáltató és a Megrendelő között, és az <a href="/aszf">ÁSZF</a> elválaszthatatlan ` +
    `részét képezik. Akkor irányadók, amikor a Megrendelő honlapján keresztül a Megrendelő ` +
    `látogatóinak személyes adatai érkeznek hozzánk.</p>`;
  return legalPage("Adatfeldolgozási feltételek", intro, DPA_V1);
}

// ── ORSZÁG-RÉTEG 3/7 (ADR-XXXX): the same pages in a COUNTRY's pack ──────────────────────
//
// A country page is the Hungarian page rendered with PLACEHOLDER registry facts, translated
// unit by unit from the country's pack (translateLegalHtml — a gap throws, no Hungarian
// fallback), then filled with the real facts. Its cross links carry `?c=<CC>`. The Hungarian
// pages above are untouched: the home pack never takes this path.

const ENTITY_KEYS = ["name", "address", "regNumber", "taxNumber", "email", "phone"] as const;

function placeholderEntity(): Entity {
  const ph = Object.fromEntries(ENTITY_KEYS.map((k) => [k, LEGAL_PLACEHOLDER(k)]));
  return { ...config.legalEntity, ...ph } as Entity;
}

/** A missing fact on a COUNTRY page: loud, but language-neutral (never a Hungarian word there). */
export const COUNTRY_FILL_ME = "<b>[ — ]</b>";

/** The real facts for the placeholders; a missing one is the loud neutral marker. */
function entityValues(): Record<string, string> {
  const e = config.legalEntity as unknown as Record<string, string>;
  const out: Record<string, string> = Object.fromEntries(
    ENTITY_KEYS.map((k) => [k, e[k] ? esc(e[k]) : COUNTRY_FILL_ME]),
  );
  out.supportEmail = esc(config.supportEmail);
  return out;
}

function countryPage(pack: LegalPack, render: (e: Entity) => string): string {
  const html = runWithConsoleLang(() => render(placeholderEntity()));
  const adr = consumerAdrValue(pack.country);
  const values = { ...entityValues(), consumerAdr: adr ? esc(adr) : COUNTRY_FILL_ME };
  return withCountryLinks(translateLegalHtml(html, pack, values), pack.country);
}

const SENDER_KEYS = ["name", "company", "email", "phone"] as const;

/** Our privacy notice (outreach + customer chapters) in a country's pack. */
export function privacyPageFor(pack?: LegalPack): string {
  if (!pack || pack.home) return privacyPage(config.outreachSender);
  const ph = Object.fromEntries(SENDER_KEYS.map((k) => [k, LEGAL_PLACEHOLDER(`sender_${k}`)])) as typeof config.outreachSender;
  const html = runWithConsoleLang(() => privacyPage(ph));
  const sender = config.outreachSender as unknown as Record<string, string>;
  const values = Object.fromEntries(
    SENDER_KEYS.map((k) => [`sender_${k}`, sender[k] ? esc(sender[k]) : COUNTRY_FILL_ME]),
  );
  return withCountryLinks(translateLegalHtml(html, pack, values), pack.country);
}

/**
 * The translation units of our own legal pages for a country — what its pack must carry.
 * Rendered exactly as `countryPage` renders them (placeholder facts, Hungarian console).
 */
export async function ownLegalPageSources(country: string): Promise<[LegalDoc, string][]> {
  const pages: [LegalDoc, () => string][] = [
    ["own_imprint", () => impresszumHtml(placeholderEntity())],
    ["aszf", () => aszfHtml(placeholderEntity(), LEGAL_PLACEHOLDER("supportEmail"), country)],
    ["withdrawal", () => elallasPage()],
    ["dpa", () => adatfeldolgozasPage()],
    [
      "privacy_customer",
      () => privacyPage(Object.fromEntries(SENDER_KEYS.map((k) => [k, LEGAL_PLACEHOLDER(`sender_${k}`)])) as typeof config.outreachSender),
    ],
  ];
  return pages.flatMap(([doc, render]) =>
    legalHtmlUnits(runWithConsoleLang(render)).map((u) => [doc, u] as [LegalDoc, string]),
  );
}

/** The paths of our own legal pages (both servers serve them; the checkout lives on the console). */
const OWN_LEGAL_PATHS = new Set(["/impresszum", "/aszf", "/elallas", "/adatfeldolgozas", "/adatvedelem", "/privacy"]);

/**
 * Serve one of our own legal pages — the Hungarian one as before, or with `?c=<CC>` the same
 * page in that country's pack. ⛔ A country whose pack is not complete gets a bare 404, never
 * the Hungarian page under its flag (the checkout of a shut market never links here anyway).
 * null = not a legal path.
 */
export async function serveOwnLegalPage(
  pathname: string,
  query: URLSearchParams,
): Promise<{ status: number; html: string } | null> {
  if (!OWN_LEGAL_PATHS.has(pathname)) return null;
  // `?l=<lang>` (the outreach surfaces know the page language): that language's country pack.
  const l = (query.get("l") ?? "").trim().toLowerCase();
  const c = (query.get("c") ?? (l ? (legalCountryForLang(l) ?? "??") : "")).trim().toUpperCase();
  let pack: LegalPack | undefined;
  if (c && c !== "HU") {
    const { countryLegalPack } = await import("../legalPackCountry.js");
    const p = /^[A-Z]{2}$/.test(c) ? await countryLegalPack(c) : null;
    if (!p) return { status: 404, html: "404" };
    pack = p;
  }
  try {
    const html =
      pathname === "/impresszum" ? impresszumPage(pack)
      : pathname === "/aszf" ? aszfPage(pack)
      : pathname === "/elallas" ? elallasPage(pack)
      : pathname === "/adatfeldolgozas" ? adatfeldolgozasPage(pack)
      : privacyPageFor(pack);
    return { status: 200, html };
  } catch (e) {
    // A gap a complete-pack check missed (a unit rendered only on some path): loud, and no page.
    console.error(`[legal-pack] ${pathname}?c=${c}:`, (e as Error).message);
    return { status: 404, html: "404" };
  }
}
