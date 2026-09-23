// WHAT THE CONSOLE LAYERS ONTO THE SERVED PROSPECT PAGE — the framing bar at the
// top, the legal footer at the bottom, and the presentation switches that only
// apply to a mock we SEND OUT. Extracted from the console server so all of it can
// be MEASURED without booting the server (ADR-0112, ADR-0159).
//
// Why it moved: since the outreach SMS stopped carrying the opt-out in its own
// text, this footer became the ONLY carrier of the legal mandatories on the
// mobile channel. A silent regression here (a refactor dropping the injection,
// a link shape the router no longer matches) would produce a megkeresés with no
// way out — the exact thing §C exists to prevent. Living in its own module, it
// is importable by scripts/optout-carrier-check.mts and
// scripts/prospect-framing-check.mts, which run the real functions and measure
// the real output.

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
/** WHO made it and WHAT it is not yet — the tracked bar's second statement. */
function trackedMadeSentence(): string {
  const advertiser = advertiserName();
  // "Készítette: X." and not "A(z) X készítette" on purpose: a Hungarian article
  // in front of an unknown company name forces the "a(z)" crutch, and the ADR-0101
  // letter round already ruled that the fix is to keep the NAME OUT of the
  // inflected clause, not to guess a better article.
  return advertiser
    ? `Készítette: ${escapeHtml(advertiser)} — ingyen, az Ön nyilvánosan elérhető adataiból. ` +
        `Ez még nem élő oldal.`
    : `Az Ön nyilvánosan elérhető adataiból készült, ingyen. Ez még nem élő oldal.`;
}

/** The tracked bar's headline — shared with the multi-plan bar. */
const TRACKED_HEADLINE = "Ez egy honlap-terv az Ön szállásáról.";

/**
 * The tracked bar's three statements as PARTS, for the multi-plan bar
 * (assets/design-refs/prospect-page/plan-tabs/ §B.5): the same sentences from the
 * same constants, laid out on one line instead of three. Two bars, one truth.
 */
export function trackedBarParts(token: string): { headline: string; made: string; why: string } {
  return {
    headline: TRACKED_HEADLINE,
    made: trackedMadeSentence(),
    why: `${LEGAL_BASIS} ${TRACKING_NOTICE} ${legalLinks(token)}`,
  };
}

export function injectTrackingBanner(html: string, token: string): string {
  const made = trackedMadeSentence();
  const banner =
    `<div data-cit-framing="tracked" style="padding:11px 18px;text-align:center;` +
    `font:400 13px/1.55 system-ui,sans-serif;color:${INK_MUTED};background:${SURFACE}">` +
    `<div style="max-width:78ch;margin:0 auto">` +
    `<strong style="color:#fff;font-weight:600">${TRACKED_HEADLINE}</strong> ` +
    `${made}` +
    `<details style="margin-top:5px">` +
    `<summary style="cursor:pointer;color:${INK_MUTED};text-decoration:underline;font-size:12.5px">` +
    `Miért kaptam?</summary>` +
    `<div style="margin:8px auto 2px;font-size:12.5px;line-height:1.65">` +
    `${LEGAL_BASIS} ${TRACKING_NOTICE} ${legalLinks(token)}</div>` +
    `</details></div></div>`;
  return prependToBody(html, banner);
}

// ── THE THIRD FRAMING STATE: the visitor ALREADY BOUGHT ──────────────────────
//
// WHY IT CANNOT REUSE EITHER EXISTING PAIR (measured in dev, 2026-09-20): the
// tracked bar ends with "Ez még nem élő oldal." and the tracked footer states
// the view is recorded "hogy az ajánlatot az igényeihez igazíthassuk". Served to
// a paying customer re-opening the cold letter, BOTH are false — §B.17 binds us
// about ourselves too. So `owned` gets its own bar and its own footer, exactly
// as `opted-out` does, and a visitor never sees two of them.
//
// What the bar must do, in this order: say the page is theirs (so a returning
// buyer is not left wondering whether the purchase took), name where the live
// site is, and hand them the way IN. It must NOT sign them in: this link travels
// in e-mail, and a forwarded letter would otherwise be account access.

/** Which promise is actually true for this customer right now. Mirrors
 *  OwnedStage in conversion/owned.ts — kept as a bare string union so this
 *  module stays importable by the guard without dragging in the DB client. */
export type OwnedFraming = "paid_pending" | "provisioned" | "live";

export interface OwnedBannerInput {
  readonly stage: OwnedFraming;
  /** Public URL of the live site, when there is one. */
  readonly siteUrl: string | null;
  /** Where the owner signs in (ADR-0042), when there is a host. */
  readonly loginUrl: string | null;
}

/** The brand cyan, literal for the same reason the two greys are: this bar sits
 *  on an ENGINE-rendered mock that never loads citui.css (verified: 0 refs), so
 *  --citui-cyan-400 would not resolve. Value copied from the token, not invented. */
const CYAN = "#35c4e0";

/** Confirmation mark — inline SVG, never an emoji (icon doctrine, §4). */
const CHECK =
  `<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" ` +
  `style="vertical-align:-2px;margin-right:6px"><path d="M2 8.5l4 4 8-9" fill="none" ` +
  `stroke="${CYAN}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Mobile and desktop are two decisions, not one plan shrunk: stacked with a
 *  full-width action on the phone, one row with the action pinned right above
 *  760 px. @media is correct here — this is a real page in a real viewport. */
const OWNED_CSS =
  `<style data-cit-owned-css>` +
  `.ow-wrap{max-width:78ch;margin:0 auto}` +
  `.ow-row{display:flex;flex-direction:column;gap:10px;align-items:stretch}` +
  `.ow-txt{text-align:center}` +
  `.ow-btn{display:block;text-align:center;padding:11px 16px;border-radius:9px;` +
  `font:600 13.5px/1 system-ui,sans-serif;text-decoration:none;white-space:nowrap;` +
  `border:1px solid ${CYAN};color:${SURFACE};background:${CYAN}}` +
  `.ow-det{margin-top:8px}` +
  `.ow-det summary{cursor:pointer;color:${INK_MUTED};text-decoration:underline;` +
  `font-size:12.5px;text-align:center;list-style:none}` +
  `.ow-det summary::-webkit-details-marker{display:none}` +
  `.ow-det .ow-body{margin:8px auto 2px;font-size:12.5px;line-height:1.65;text-align:center}` +
  `@media (min-width:760px){` +
  `.ow-row{flex-direction:row;align-items:center;justify-content:space-between;gap:18px}` +
  `.ow-txt{text-align:left}.ow-btn{display:inline-block}` +
  `.ow-det summary,.ow-det .ow-body{text-align:left}}` +
  `</style>`;

/** WHY they see this instead of the offer. No tracking claim and no "not live
 *  yet" claim — the two sentences that would be false here. */
const OWNED_WHY =
  "Ezt a linket a korábbi megkeresésünkben kapta. Azóta megrendelte a honlapját, ezért itt " +
  "már nem lehet újra megrendelni — a szövegeit és a képeit a kezelőfelületen szerkesztheti. " +
  "Ezt a megtekintést nem rögzítjük és nem használjuk ajánlat-személyre szabásra.";

/** The headline per stage. A stalled activation MUST NOT claim a live site —
 *  that is the buyer most likely to re-open the letter, and the one a confident
 *  "your page is live" would mislead hardest. */
function ownedHeadline(i: OwnedBannerInput): string {
  const strong = (s: string) =>
    `<strong style="color:#fff;font-weight:600">${CHECK}${s}</strong>`;
  if (i.stage === "paid_pending") {
    return (
      strong("Ezt már megrendelte.") +
      " A fizetés beérkezett, az oldala még készül — amint elkészül, e-mailben jelezzük."
    );
  }
  if (i.stage === "provisioned") {
    return (
      strong("Ez az oldal már az Öné.") +
      " Elkészült; a nyilvános megjelenés még folyamatban van."
    );
  }
  return (
    strong("Ez az oldal már az Öné.") +
    (i.siteUrl
      ? ` Az oldala él: <a href="${escapeHtml(i.siteUrl)}" ` +
        `style="color:#fff;text-decoration:underline">${escapeHtml(prettyUrl(i.siteUrl))}</a>`
      : "")
  );
}

/**
 * The URL as a human reads it: protocol and trailing slash dropped, everything
 * else KEPT.
 *
 * ⛔ NOT `new URL(u).host` — measured 2026-09-20 on the real route: off-platform
 * the site lives at `<host>/t/<slug>`, and returning the host alone printed
 * "az oldala él: 100.97.188.105:4800", i.e. an address where the site is NOT.
 * A label that drops the part that identifies the site answers a different
 * question than the sentence around it asks.
 */
function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/**
 * THE OWNED BAR — same place and same mechanics as the other two (in normal
 * flow, native <details>, no script), different truth.
 */
export function injectOwnedBanner(html: string, input: OwnedBannerInput): string {
  const action = input.loginUrl
    ? `<a class="ow-btn" href="${escapeHtml(input.loginUrl)}">Belépés a kezelőfelületre</a>`
    : "";
  const banner =
    OWNED_CSS +
    `<div data-cit-framing="owned" style="padding:13px 18px;` +
    `border-bottom:1px solid rgba(53,196,224,.35);` +
    `font:400 13px/1.55 system-ui,sans-serif;color:${INK_MUTED};background:${SURFACE}">` +
    `<div class="ow-wrap"><div class="ow-row">` +
    `<div class="ow-txt">${ownedHeadline(input)}</div>${action}</div>` +
    `<details class="ow-det"><summary>Miért ezt látom?</summary>` +
    `<div class="ow-body">${OWNED_WHY} ` +
    `<a href="/privacy" style="color:${INK_MUTED};text-decoration:underline">Adatkezelési tájékoztató</a>` +
    `</div></details></div></div>`;
  return prependToBody(html, banner);
}

/**
 * The bottom notice for an owned visitor.
 *
 * ⛔ It must NOT reuse the tracked footer (states a measurement we do not make
 * here) and must NOT offer the unsubscribe: on a paying customer's own page a
 * "Leiratkozás" link reads as if their service could be cancelled by a click.
 * Marketing opt-out for an existing customer is an admin setting, not this link.
 */
export function injectOwnedNotice(html: string, input: OwnedBannerInput): string {
  const where = input.loginUrl
    ? ` Kezelőfelület: <a href="${escapeHtml(input.loginUrl)}" ` +
      `style="color:${INK_MUTED};text-decoration:underline">${escapeHtml(prettyUrl(input.loginUrl))}</a> · `
    : " ";
  const notice =
    `<div data-cit-footer="owned" style="padding:14px 18px;text-align:center;` +
    `font:12px/1.6 system-ui,sans-serif;color:${INK_MUTED};background:${SURFACE}">` +
    `Ön a Citoviso ügyfele — ezt az oldalt a korábbi megkeresésünk linkjéről nyitotta meg. ` +
    `A megtekintést nem rögzítjük.${where}` +
    `<a href="/privacy" style="color:${INK_MUTED};text-decoration:underline">Adatkezelési tájékoztató</a>` +
    `</div>`;
  return appendToBody(html, notice);
}

/**
 * NO OPENING ANIMATION ON A MOCK WE SEND OUT (owner's ruling, 2026-09-14 —
 * ADR-0159 nyitott pontja lezárva).
 *
 * WHY: two of the nineteen templates open with a full-screen ADR-0115 intro —
 * `.cit-fintro` (arch-frames) and `.cit-intro` (wordmark-grow). Measured at
 * 390 px: arch-frames holds the page for ~4,7 s, and wordmark-grow was still
 * running its sequence at 6 s. On a cold-outreach link that is the FIRST screen
 * the lead ever sees of us, and the framing bar — the whole point of which is to
 * say what this page is from the first pixel — is behind it the entire time.
 * A motion flourish on a site the owner already chose is a different thing from
 * a delay in front of a stranger deciding whether to keep reading.
 *
 * HOW, AND WHY BOTH HALVES ARE NEEDED:
 *  · the attribute is the motion layer's OWN documented switch — both intro
 *    scripts check `data-cit-no-intro` on <html> and remove the overlay before
 *    they touch anything, so the page is never locked (`overflow:hidden`);
 *  · the <style> is for JS-off AND for OLD ARTIFACTS. The page is read from a
 *    file rendered possibly weeks ago, so it carries the no-JS net that existed
 *    THEN — fixing the net in runtime.ts (as of today) does nothing for a mock
 *    already on disk. The rule travels with the response instead.
 */
export function disableIntroAnimation(html: string): string {
  // ⛔ The idempotency test asks about the <html> TAG, not the document. A plain
  // `includes("data-cit-no-intro")` matched the INTRO SCRIPT'S OWN SOURCE — the
  // template inlines `hasAttribute('data-cit-no-intro')` — so the function
  // returned the page untouched and the animation kept playing. Measured: the
  // guard photographed a full-screen cream overlay on a page that was supposed to
  // have the switch on.
  if (/<html[^>]*\sdata-cit-no-intro/i.test(html)) return html; // already applied
  const style = `<style data-cit-no-intro>.cit-fintro,.cit-intro{display:none!important}</style>`;
  const withAttr = /<html\b/i.test(html)
    ? html.replace(/<html\b/i, "<html data-cit-no-intro")
    : `<html data-cit-no-intro>${html}`;
  if (/<head[^>]*>/i.test(withAttr)) return withAttr.replace(/(<head[^>]*>)/i, `$1${style}`);
  if (/<body[^>]*>/i.test(withAttr)) return withAttr.replace(/(<body[^>]*>)/i, `$1${style}`);
  return style + withAttr;
}

/** Put a block at the very END of the page (the opt-out lives at the bottom). */
export function appendToBody(html: string, block: string): string {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`);
  return html + block;
}

/** Put a block at the very START of the page (both framing bars live there). */
export function prependToBody(html: string, block: string): string {
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
