// Legal document pages for the PUBLIC site (ADR-0056): Impresszum, ÁSZF,
// Elállási tájékoztató, Adatfeldolgozási feltételek.
//
// The wording itself lives in src/legal.ts (deterministic, versioned, §H.22) —
// this module only dresses it. The provider's registry facts come from
// `config.legalEntity` (prod .env), never from git: an invented tax number on a
// public page is worse than a visibly missing one, so unfilled fields render as
// a loud `[KITÖLTENDŐ: …]` marker that `scripts/legal-check.mts` refuses to ship.

import { config } from "../config.js";
import { esc, layout } from "../console/views.js";
import {
  ASZF_EFFECTIVE_FROM,
  ASZF_V1,
  ASZF_VERSION,
  DPA_V1,
  WITHDRAWAL_NOTICE_V1,
  type LegalSection,
} from "../legal.js";

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
export function impresszumPage(): string {
  const e = config.legalEntity;
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
export function aszfPage(): string {
  const e = config.legalEntity;
  const intro =
    `<p class="mut">Verzió ${esc(ASZF_VERSION)} · hatályos ${esc(ASZF_EFFECTIVE_FROM)} napjától. ` +
    `Szolgáltató: ${field(e.name, "cégnév / egyéni vállalkozó neve")} ` +
    `(székhely: ${field(e.address, "székhely címe")}, adószám: ${field(e.taxNumber, "adószám")}). ` +
    `A Szolgáltató további adatait az <a href="/impresszum">Impresszum</a> tartalmazza.</p>` +
    `<p>A jelen Általános Szerződési Feltételek (ÁSZF) a Szolgáltató és a Megrendelő között ` +
    `a Citoviso honlap-szolgáltatás tárgyában létrejövő szerződés feltételeit tartalmazzák. ` +
    `Elválaszthatatlan részét képezi az <a href="/elallas">Elállási tájékoztató</a> és az ` +
    `<a href="/adatfeldolgozas">Adatfeldolgozási feltételek</a>.</p>`;
  return legalPage("Általános Szerződési Feltételek", intro, ASZF_V1);
}

/**
 * Withdrawal notice (45/2014. Korm. r.). Not optional decoration: the consumer's
 * waiver recorded at checkout (WITHDRAWAL_WAIVER_V1) is only valid if this
 * information was given BEFOREHAND.
 */
export function elallasPage(): string {
  const intro =
    `<p>Az alábbi tájékoztató a fogyasztó és a vállalkozás közötti szerződések részletes ` +
    `szabályairól szóló 45/2014. (II. 26.) Korm. rendelet szerinti kötelező tájékoztatás. ` +
    `A Szolgáltató adatait az <a href="/impresszum">Impresszum</a> tartalmazza.</p>`;
  return legalPage("Elállási tájékoztató", intro, WITHDRAWAL_NOTICE_V1);
}

/** Data-processing terms (GDPR 28.) — annex to the ÁSZF. */
export function adatfeldolgozasPage(): string {
  const intro =
    `<p>A jelen feltételek a GDPR 28. cikke szerinti adatfeldolgozási szerződésnek minősülnek ` +
    `a Szolgáltató és a Megrendelő között, és az <a href="/aszf">ÁSZF</a> elválaszthatatlan ` +
    `részét képezik. Akkor irányadók, amikor a Megrendelő honlapján keresztül a Megrendelő ` +
    `látogatóinak személyes adatai érkeznek hozzánk.</p>`;
  return legalPage("Adatfeldolgozási feltételek", intro, DPA_V1);
}
