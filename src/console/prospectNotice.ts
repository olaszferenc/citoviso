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
  // "Olasz Ferenc e.v.." — a name that ends with a period must not get a second one
  // (measured on the served footer, 2026-09-26).
  return advertiser ? `A megkeresés küldője: ${escapeHtml(advertiser)}${advertiser.endsWith(".") ? "" : "."} ` : "";
}

/**
 * A finger-sized link. The footer and the bar are set in 12–12,5 px type, so a bare
 * inline <a> is a 15 px tall target — measured on 38 pages at 390 px (Elek FK-009,
 * 2026-09-26). WCAG 2.5.8 asks for 24 px; the padding buys it without changing the
 * type size or the wording the framing contract binds.
 */
const TAP_LINK = "display:inline-block;padding:6px 2px;text-decoration:underline";

/**
 * Clearance under the LAST block of the page. On a phone the bottom of the viewport
 * is a stack of fixed layers — the consent bar, a template's own fixed booking bar,
 * and the configurator's invite pill climbing above both — and the legal footer,
 * being the last in-flow block, ended up UNDER that stack: at the very bottom of
 * the page the opt-out link was covered on every one of the 19 templates
 * (measured 2026-09-26, 390/360/844×390). The configurator runtime measures the
 * stack it sits on and publishes it as `--citui-cfg-clear`; without that script the
 * consent runtime's own `--citui-consent-h` is the fallback, and with neither the
 * padding is the plain 14 px it always was.
 */
const FOOTER_CLEARANCE = "padding-bottom:calc(14px + var(--citui-cfg-clear, var(--citui-consent-h, 0px)))";

/**
 * The framing bar's own rules — a <style> that travels with the bar, because the mock
 * never loads citui.css. @media is right here: this is a real page in a real viewport.
 * The expander keeps a visible ▸/▾ marker (the native one is dropped by
 * `display:inline-block`, which the tap-target padding needs).
 */
const FRAMING_CSS =
  `<style data-cit-framing-css>` +
  `.cit-fr{padding:8px 14px}` +
  `.cit-fr-in{max-width:78ch;margin:0 auto}` +
  `.cit-fr strong{display:block}` +
  `.cit-fr-det{display:inline}` +
  `.cit-fr-det summary{display:inline-block;list-style:none;padding:4px 6px;margin-left:2px;font-size:12.5px}` +
  `.cit-fr-det summary::-webkit-details-marker{display:none}` +
  `.cit-fr-det summary::before{content:"\\25B8\\00a0"}` +
  `.cit-fr-det[open] summary::before{content:"\\25BE\\00a0"}` +
  `.cit-fr-body{display:block;margin:4px auto 2px;font-size:12.5px;line-height:1.55}` +
  `@media (max-width:560px){.cit-fr-long{display:none}}` +
  `@media (min-width:561px){.cit-fr{padding:9px 18px;font-size:13px}.cit-fr-in{max-width:none}` +
  `.cit-fr strong{display:inline;margin-right:6px}}` +
  `</style>`;

/**
 * THE CONSENT QUESTION WAITS FOR THE FIRST ENGAGEMENT on a page we send out
 * (2026-09-26, owner's mandate — plan B of first-screen-compact). The bar took 13–24 %
 * of the phone's first screen before the lead had seen anything. The runtime
 * (cit-consent.js) reads this attribute and renders the bar on the first scroll,
 * tap or key — never later than the first interaction, and nothing tracks before it:
 * the Pixel still loads only after „Elfogadom". Only the tracked/opted-out branches of
 * /p/<token> set it; every other page asks at once, as before.
 */
export function deferConsentUntilEngagement(html: string): string {
  if (/<html[^>]*\sdata-cit-consent-defer/i.test(html)) return html;
  return /<html\b/i.test(html) ? html.replace(/<html\b/i, "<html data-cit-consent-defer") : html;
}

/** The way out, and the full information — same markup wherever it appears. */
function legalLinks(token: string): string {
  return (
    `<a href="/privacy" style="color:${INK_MUTED};${TAP_LINK}">Adatkezelési tájékoztató</a> · ` +
    `<a href="/p/${token}/unsubscribe" style="color:${INK_MUTED};${TAP_LINK}">Leiratkozás</a>`
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
    `<div data-cit-footer="tracked" style="padding:14px 18px;${FOOTER_CLEARANCE};text-align:center;font:12px/1.6 system-ui,sans-serif;` +
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
  // COMPACT ON THE PHONE (2026-09-26, owner's mandate after Elek FK-009): the bar was
  // 107–127 px of a 844 px first screen (13–15 %), three sentences plus the expander on
  // its own line. It stays the FIRST thing on the page with the contract's three
  // statements — WHAT (bold), WHO (the name), WHY (one tap) — but at ≤560 px the
  // "ingyen, az Ön nyilvánosan elérhető adataiból" clause moves into the expander
  // (its first sentence says the same), the type is 12.5/1.4 and the padding 8 px:
  // 77 px measured. On the desktop it is ONE line. Frozen plan:
  // assets/design-refs/prospect-page/first-screen-compact/.
  const dot = advertiser.endsWith(".") ? "" : ".";
  const made = advertiser
    ? `Készítette: ${escapeHtml(advertiser)}${dot}<span class="cit-fr-long"> — ingyen, az Ön nyilvánosan ` +
      `elérhető adataiból.</span> Ez még nem élő oldal.`
    : `Az Ön nyilvánosan elérhető adataiból készült, ingyen. Ez még nem élő oldal.`;
  const banner =
    FRAMING_CSS +
    `<div data-cit-framing="tracked" class="cit-fr" style="text-align:center;` +
    `font:400 12.5px/1.4 system-ui,sans-serif;color:${INK_MUTED};background:${SURFACE}">` +
    `<div class="cit-fr-in">` +
    `<strong style="color:#fff;font-weight:600">Ez egy honlap-terv az Ön szállásáról.</strong> ` +
    `${made}` +
    `<details class="cit-fr-det">` +
    `<summary style="cursor:pointer;color:${INK_MUTED};text-decoration:underline">` +
    `Miért kaptam?</summary>` +
    `<div class="cit-fr-body">` +
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
  `font-size:12.5px;text-align:center;list-style:none;padding:6px 8px}` +
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
      `style="color:${INK_MUTED};${TAP_LINK}">${escapeHtml(prettyUrl(input.loginUrl))}</a> · `
    : " ";
  const notice =
    `<div data-cit-footer="owned" style="padding:14px 18px;${FOOTER_CLEARANCE};text-align:center;` +
    `font:12px/1.6 system-ui,sans-serif;color:${INK_MUTED};background:${SURFACE}">` +
    `Ön a Citoviso ügyfele — ezt az oldalt a korábbi megkeresésünk linkjéről nyitotta meg. ` +
    `A megtekintést nem rögzítjük.${where}` +
    `<a href="/privacy" style="color:${INK_MUTED};${TAP_LINK}">Adatkezelési tájékoztató</a>` +
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

/**
 * Below-the-fold photos load lazily on a page we SEND OUT. Measured 2026-09-26 on the
 * 38 tracked pages (19 templates × 2 leads) at 390 px: 8–17 <img> per page, NONE with
 * loading="lazy", 1,2–5,3 MB per page, a single Google photo of 2 MB — all requested
 * on first paint, on a link that is opened on a phone, on mobile data. The first two
 * images are the hero and stay eager (LCP); every later <img> without its own
 * loading attribute gets `loading="lazy" decoding="async"`. The artifact file on disk
 * is untouched — this is the serve-time layer, like the framing bar.
 */
export function lazyLoadBelowFold(html: string, eager = 2): string {
  let seen = 0;
  return html.replace(/<img\b([^>]*)>/gi, (tag, attrs: string) => {
    seen++;
    if (seen <= eager || /\bloading\s*=/i.test(attrs)) return tag;
    const decoding = /\bdecoding\s*=/i.test(attrs) ? "" : ' decoding="async"';
    return `<img loading="lazy"${decoding}${attrs}>`;
  });
}

/**
 * NO SIDEWAYS OVERFLOW ON A PAGE WE SEND OUT. A phone does not scroll a too-wide
 * page sideways — Chromium WIDENS the layout viewport to the content, and every
 * fixed layer is laid out on that wider box. Measured 2026-09-26 (Elek FK-009):
 * brutalism's nowrap marquee made a 390 px phone lay the page out at 515 px, so the
 * consent bar and the invite pill were off the screen and the pill could not be
 * tapped at all; parallax and brutalism did the same on the 360 px Android
 * (390/380 px). The template owns the marquee (→ testvér-szál); this is the serve-
 * time net under it: `overflow-x: clip` clips without creating a scroll container,
 * so `position: sticky` in the templates keeps working (the `hidden` value would
 * make <html>/<body> a scroller and break it). Idempotent via the marker.
 */
export function containHorizontalOverflow(html: string): string {
  if (html.includes("data-cit-contain-x")) return html;
  const style = `<style data-cit-contain-x>html,body{overflow-x:clip}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/(<body[^>]*>)/i, `$1${style}`);
  return style + html;
}

/**
 * THE OPT-OUT ASKS ONCE BEFORE IT ACTS (2026-09-26).
 *
 * The unsubscribe link used to opt the prospect out on a plain GET — convenient for the
 * person clicking it, and exactly what a mail scanner does when it "visits" every link
 * in a letter (Outlook SafeLinks, iOS link previews, corporate URL filters, Elek's own
 * measuring run). One GET by a machine, and a lead who never read the letter was gone
 * for good. So the GET renders THIS: a page that names what the button does and does
 * nothing until the button is pressed. The actual opt-out is the POST — the same POST
 * that RFC 8058's List-Unsubscribe-Post already sends from the mail client's own
 * button, which stays one-click.
 *
 * Pure markup so the carrier guard can measure it without a server; the console wraps it
 * in its chrome-less layout. Colours: citui tokens (this page IS a console page, it
 * loads citui.css — unlike the mock underneath the framing bar).
 */
export function unsubscribeConfirmBody(token: string): string {
  const action = `/p/${encodeURIComponent(token)}/unsubscribe`;
  return (
    `<div class="panel" data-cit-unsub-confirm style="max-width:480px;margin:48px auto;text-align:center">` +
    `<h2>Leiratkozás</h2>` +
    `<p class="mut">Ha leiratkozik, ezzel az ajánlattal nem keressük többé, és a megtekintési adatok ` +
    `rögzítését leállítjuk. A honlap-tervet ezután is megnézheti.</p>` +
    `<form method="post" action="${action}" style="margin:18px 0 0">` +
    `<button type="submit" class="citui-btn citui-btn--primary" style="min-height:44px;padding:0 22px">Leiratkozom</button>` +
    `</form>` +
    `<p class="mut small" style="margin:14px 0 0"><a href="/p/${encodeURIComponent(token)}" ` +
    `style="display:inline-block;padding:6px 4px">Mégsem — vissza a tervhez</a></p>` +
    `</div>`
  );
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
    `<div data-cit-footer="opted-out" style="padding:14px 18px;${FOOTER_CLEARANCE};text-align:center;font:12px/1.6 system-ui,sans-serif;` +
    `color:#8a8f98;background:#101216">Ön korábban leiratkozott, ezért nem keressük többé, ` +
    `és ezt a megtekintést nem rögzítjük. Ezt az oldalt Ön nyitotta meg. ` +
    (who ? `A megkeresés küldője volt: ${escapeHtml(who)}. ` : "") +
    `<a href="/privacy" style="color:#8a8f98;${TAP_LINK}">Adatkezelési tájékoztató</a></div>`;
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
