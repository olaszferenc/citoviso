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

/**
 * GDPR/Grt. transparency footer for the TRACKED prospect page (PILOT.md §6):
 * a discreet, honest notice that viewing data is recorded (legitimate-interest
 * B2B outreach) + a working unsubscribe link. Injected before </body>.
 * Colours are literal on purpose: this overlays an ENGINE-rendered mock
 * (data plane, --cit-* skins) that never loads citui.css, so --citui-* tokens
 * would not resolve here. Neutral greys, no brand chrome.
 */
export function injectTrackingNotice(html: string, token: string): string {
  // Two DIFFERENT legal bases, and the footer must state both — the guard found
  // that it only ever stated the second one (2026-09-08):
  //   1. WHY we contacted you at all (Grt. 6. § / GDPR 6. cikk (1) f)) — on the
  //      mail path this sentence is in the letter (draft.ts `legal`), but on the
  //      mobile path the message no longer carries it, so this page is its only
  //      home. "Viewing data is recorded" is NOT the same statement.
  //   2. WHO is advertising — an advertiser may not stay anonymous, and the SMS
  //      signs off with the brand only, so the operating entity is named here.
  const advertiser = [config.outreachSender.company, config.outreachSender.name]
    .map((v) => (v ?? "").trim())
    .find((v) => v.length > 0);
  const who = advertiser
    ? `A megkeresés küldője: ${escapeHtml(advertiser)}. `
    : ""; // an unset env may not invent an identity — §B.17 binds us about ourselves too
  const notice =
    `<div style="padding:14px 18px;text-align:center;font:12px/1.6 system-ui,sans-serif;` +
    `color:#8a8f98;background:#101216">Ezt az előnézetet személyre szabottan Önnek készítettük, ` +
    `mert vállalkozása nyilvánosan elérhető adatai alapján úgy láttuk, a szolgáltatásunk hasznos ` +
    `lehet Önnek (jogos érdekű megkeresés — Grt. 6. § / GDPR 6. cikk (1) f)). ${who}` +
    `A megtekintés adatai (megnyitás, görgetés, kipróbált elemek) rögzülnek, hogy az ajánlatot ` +
    `az igényeihez igazíthassuk. ` +
    `<a href="/privacy" style="color:#8a8f98;text-decoration:underline">Adatkezelési tájékoztató</a> · ` +
    `<a href="/p/${token}/unsubscribe" style="color:#8a8f98;text-decoration:underline">Leiratkozás</a></div>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${notice}</body>`);
  return html + notice;
}
