// The legal footer of the TRACKED prospect page — extracted from the console
// server so it can be MEASURED without booting the server (ADR-0112).
//
// Why it moved: since the outreach SMS stopped carrying the opt-out in its own
// text, this footer became the ONLY carrier of the legal mandatories on the
// mobile channel. A silent regression here (a refactor dropping the injection,
// a link shape the router no longer matches) would produce a megkeresés with no
// way out — the exact thing §C exists to prevent. Living in its own module, it
// is importable by scripts/optout-carrier-check.mts, which runs the real
// function and matches the emitted URL against the real router.

import { config } from "../config.js";

/** Local escape on purpose: this module must stay importable without dragging in
 *  the console views or the template kit (i18n packs, icons) — a guard that costs
 *  a second to boot gets skipped, and the point of the module is to be measured. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── THE SENTENCES, WRITTEN ONCE ──────────────────────────────────────────────
//
// The framing bar at the TOP and the legal footer at the BOTTOM are two PLACES,
// not two truths (approved contract, 2026-09-14 —
// assets/design-refs/prospect-page/framing/README.md §6). Two hand-written copies
// of the same paragraph is how one screen ends up carrying two versions of the
// same rule, so the shared sentences live here, in one place, and both carriers
// compose from them.

/** WHY we were allowed to contact them at all. NOT the same statement as the
 *  tracking notice below — the guard was once green while only the second one
 *  was ever printed (2026-09-08). */
const LEGAL_BASIS =
  "Ezt az előnézetet személyre szabottan Önnek készítettük, " +
  "mert vállalkozása nyilvánosan elérhető adatai alapján úgy láttuk, a szolgáltatásunk hasznos " +
  "lehet Önnek (jogos érdekű megkeresés — Grt. 6. § / GDPR 6. cikk (1) f)).";

/** WHAT we record while they look. */
const TRACKING_NOTICE =
  "A megtekintés adatai (megnyitás, görgetés, kipróbált elemek) rögzülnek, hogy az ajánlatot " +
  "az igényeihez igazíthassuk.";

/** The two greys are this module's ONLY allowed literals (design-token-lint
 *  ALLOW list): the page is an ENGINE-rendered mock that never loads citui.css,
 *  so --citui-* would not resolve, and a third colour would need its own
 *  exception. White is a neutral, not a palette colour. */
const INK_MUTED = "#8a8f98";
const SURFACE = "#101216";

/** WHO is advertising — an advertiser may not stay anonymous (Grt.), and the SMS
 *  signs off with the brand only, so the operating entity is named on this page. */
function senderSentence(): string {
  const advertiser = advertiserName();
  // an unset env may not invent an identity — §B.17 binds us about ourselves too
  return advertiser ? `A megkeresés küldője: ${escapeHtml(advertiser)}. ` : "";
}

/** The way out, and the full information — same markup wherever it appears. */
function legalLinks(token: string): string {
  return (
    `<a href="/privacy" style="color:${INK_MUTED};text-decoration:underline">Adatkezelési tájékoztató</a> · ` +
    `<a href="/p/${token}/unsubscribe" style="color:${INK_MUTED};text-decoration:underline">Leiratkozás</a>`
  );
}

/**
 * GDPR/Grt. transparency footer for the TRACKED prospect page (PILOT.md §6):
 * a discreet, honest notice that viewing data is recorded (legitimate-interest
 * B2B outreach) + a working unsubscribe link. Injected before </body>.
 * Colours are literal on purpose: this overlays an ENGINE-rendered mock
 * (data plane, --cit-* skins) that never loads citui.css, so --citui-* tokens
 * would not resolve here. Neutral greys, no brand chrome.
 *
 * ⛔ IT STAYS AT THE BOTTOM even now that the page also carries a framing bar at
 * the top (ADR-0112, owner's ruling): the opt-out is reachable at the very end of
 * the page, and nothing of the mock renders below it.
 */
export function injectTrackingNotice(html: string, token: string): string {
  const notice =
    `<div style="padding:14px 18px;text-align:center;font:12px/1.6 system-ui,sans-serif;` +
    `color:${INK_MUTED};background:${SURFACE}">${LEGAL_BASIS} ${senderSentence()}` +
    `${TRACKING_NOTICE} ` +
    legalLinks(token) +
    `</div>`;
  return appendToBody(html, notice);
}

/**
 * THE FRAMING BAR — the first thing every visitor of a tracked preview sees
 * (approved plan „A", 2026-09-14; the frozen contract is in
 * `assets/design-refs/prospect-page/framing/`).
 *
 * WHAT IT FIXES (Elek FK-004b): the explanation lived at the BOTTOM of the page,
 * and a TOP bar was served ONLY to a visitor who had already opted out. Someone
 * opening the link from a cold letter therefore met a stranger's website built
 * from their own property, with nothing telling them what it was, who made it or
 * why they got it — on the first and often only screen they ever see of us.
 *
 * DESIGN DECISIONS THE CONTRACT BINDS:
 *  · IN NORMAL FLOW, not an overlay. It pushes the page down and scrolls away;
 *    it never floats over the mock, so no template CSS can steal its place and
 *    no page element can paint on top of it (the injected-overlay trap: an
 *    `aurora`-style `body>*{position:relative}` once dropped a FIXED element to
 *    the bottom of the page). Measured on the rendered page, 19 templates.
 *  · <details>, NOT a scripted toggle. This mock opens in a stranger's browser;
 *    the legal detail may not depend on a script having loaded, so the expander
 *    is the native element that works with JS off.
 *  · The visible line answers WHAT and WHO; one click answers WHY, and carries
 *    the privacy notice and the working opt-out with it.
 */
export function injectTrackingBanner(html: string, token: string): string {
  const advertiser = advertiserName();
  // "Készítette: X." and not "A(z) X készítette" on purpose: a Hungarian article
  // in front of an unknown company name forces the "a(z)" crutch, and the ADR-0101
  // letter round already ruled that the fix is to keep the NAME OUT of the
  // inflected clause, not to guess a better article.
  const made = advertiser
    ? `Készítette: ${escapeHtml(advertiser)} — ingyen, az Ön nyilvánosan elérhető adataiból. ` +
      `Ez még nem élő oldal.`
    : `Az Ön nyilvánosan elérhető adataiból készült, ingyen. Ez még nem élő oldal.`;
  const banner =
    `<div data-cit-framing="tracked" style="padding:11px 18px;text-align:center;` +
    `font:400 13px/1.55 system-ui,sans-serif;color:${INK_MUTED};background:${SURFACE}">` +
    `<div style="max-width:78ch;margin:0 auto">` +
    `<strong style="color:#fff;font-weight:600">Ez egy honlap-terv az Ön szállásáról.</strong> ` +
    `${made}` +
    `<details style="margin-top:5px">` +
    `<summary style="cursor:pointer;color:${INK_MUTED};text-decoration:underline;font-size:12.5px">` +
    `Miért kaptam?</summary>` +
    `<div style="margin:8px auto 2px;font-size:12.5px;line-height:1.65">` +
    `${LEGAL_BASIS} ${TRACKING_NOTICE} ${legalLinks(token)}</div>` +
    `</details></div></div>`;
  return prependToBody(html, banner);
}

/** Put a block at the very END of the page (the opt-out lives at the bottom). */
function appendToBody(html: string, block: string): string {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`);
  return html + block;
}

/** Put a block at the very START of the page (both framing bars live there). */
function prependToBody(html: string, block: string): string {
  if (/<body[^>]*>/i.test(html)) return html.replace(/(<body[^>]*>)/i, `$1${block}`);
  return block + html;
}

/** The advertiser's name, or "" when the config is unset — never invented. */
function advertiserName(): string {
  const v = [config.outreachSender.company, config.outreachSender.name]
    .map((x) => (x ?? "").trim())
    .find((x) => x.length > 0);
  return v ?? "";
}

/**
 * Footer for a visitor who ALREADY OPTED OUT and opened the link anyway (owner's
 * ruling, ADR-0112: they may look and they may buy — we just stop measuring and
 * stop pushing).
 *
 * ⛔ It must NOT reuse the tracked footer: that one states "a megtekintés adatai
 * rögzülnek", which would be a lie here — nothing is recorded on this path (no
 * recordView, no beacon). §B.17 binds us about ourselves too. It also offers no
 * unsubscribe link: they already did that, and re-offering it would suggest the
 * first one did not take.
 */
export function injectOptedOutNotice(html: string, _token: string): string {
  const who = advertiserName();
  const notice =
    `<div style="padding:14px 18px;text-align:center;font:12px/1.6 system-ui,sans-serif;` +
    `color:#8a8f98;background:#101216">Ön korábban leiratkozott, ezért nem keressük többé, ` +
    `és ezt a megtekintést nem rögzítjük. Ezt az oldalt Ön nyitotta meg. ` +
    (who ? `A megkeresés küldője volt: ${escapeHtml(who)}. ` : "") +
    `<a href="/privacy" style="color:#8a8f98;text-decoration:underline">Adatkezelési tájékoztató</a></div>`;
  return appendToBody(html, notice);
}

/**
 * The honest banner at the TOP for the same visitor: they should not have to
 * scroll to the bottom to learn why this page still works after they opted out.
 * Approved wording (owner, 2026-09-08).
 */
export function injectOptedOutBanner(html: string): string {
  // Same two greys as the footer (the module's only allowed literals): this bar
  // sits on an ENGINE-rendered mock that never loads citui.css, so --citui-*
  // would not resolve — and a third colour would need its own exception.
  const banner =
    `<div data-cit-framing="opted-out" style="padding:10px 18px;text-align:center;` +
    `font:13px/1.5 system-ui,sans-serif;color:${INK_MUTED};background:${SURFACE}">` +
    `Leiratkozott, ezért nem keressük többé — ` +
    `ezt az oldalt Ön nyitotta meg. Megnézheti és meg is rendelheti; nem mérjük és nem küldünk ` +
    `emlékeztetőt.</div>`;
  return prependToBody(html, banner);
}
