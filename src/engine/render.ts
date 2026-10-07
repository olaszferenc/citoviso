// Deterministic renderer: Recipe + SiteData → complete HTML page (ADR-0016). No AI,
// no randomness. The SAME (recipe) with demo vs. real data yields structurally
// identical HTML — the mock=live guarantee. The skin is named by the recipe.

import { ARCHETYPES, type RenderedSection } from "./archetypes.js";
import { CHROME_CSS, renderFooter, renderNav } from "./chrome.js";
import { EMPHASIS_CSS, PRIMITIVE_CSS, PRIMITIVES } from "./primitives.js";
import { isSampleOnly, type Recipe, type RenderPhase, type SiteData } from "./recipe.js";
import { renderSeoHead, seoTitle } from "./seo.js";
import { stripTenantLegalLinks } from "./legalPages.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "./skins.js";
import { TEMPLATES } from "./templates.js";
import { MODULE_SLOTS, moduleSectionGroups, wholeBandBlock } from "./moduleSections.js";
import { esc, roomsForMock, sampleRooms } from "./templateKit.js";
import { addressWithoutOwnCountry } from "./displayAddress.js";
import { setHighlightSources } from "./copyFields.js";

/** Templates escape their text, so compare against the escaped form. */
function escapeForCompare(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * ADR-0059 §1 — weave the module DATA into the template's native channel before
 * rendering. usp + amenities are the same content type as the highlights every
 * template already renders natively ("selling points"); appending them as separate
 * blocks was the "ugyanaz a tartalomtípus 2-3×" the owner rejected twice. The
 * merged list keeps the owner's usp first (they curated it), then the lead's real
 * highlights, then the amenities; duplicates collapse on a normalized key.
 * Deterministic — mock=live holds.
 */
function weaveSellingPoints(data: SiteData): SiteData {
  // ONLY the usp weaves in. usp = this property's UNIQUE strengths — the same
  // content type as the lead's highlights, so it belongs in the native section.
  // amenities = a general facilities CHECKLIST (wifi, parking, breakfast): a
  // different content type, so it keeps its own block. Merging both left the two
  // paid modules sharing one surface, where switching either off changed nothing
  // on the page — indistinguishable from a con (owner report 2026-08-23, §I).
  if (!data.usp?.length) return data;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const seen = new Set<string>();
  const tagged = [...data.usp.map((s) => [s, -1] as const), ...data.highlights.map((s, i) => [s, i] as const)].filter(
    ([s]) => !seen.has(norm(s)) && Boolean(seen.add(norm(s))),
  );
  const woven = { ...data, highlights: tagged.map(([s]) => s) };
  // The preview editor's highlight hooks must name the FIELD's index, not the list's.
  setHighlightSources(woven.highlights, tagged.map(([, i]) => i));
  return woven;
}

/**
 * The measured native-coverage stamp (ADR-0059 ①): which content types this page
 * demonstrates in the template's OWN sections. Read by the configurator so it never
 * appends a generic sample block next to a native section of the same type, and by
 * the inventory/dedup gate. Measured on the rendered page, never assumed — the
 * roomsAlreadyShown lesson generalized.
 */
function stampNativeCoverage(html: string, types: readonly string[]): string {
  if (!types.length) return html;
  return html.replace(/<body([^>]*)>/i, (m, attrs: string) =>
    attrs.includes("data-cit-native") ? m : `<body${attrs} data-cit-native="${types.join(" ")}">`,
  );
}

/**
 * A dead image URL must never surface as broken-icon-plus-alt-text (ADR-0058). Google Places
 * photo URLs expire, and a gallery photo's alt is "<name> — N. kép", so an expired image reads
 * on the page as a bare number (owner report 2026-08-23: "1,2,3,4 a galériánál — katasztrófa").
 * This framework-free runtime swaps any broken <img> for the SAME token-themed designed fill the
 * templates use for empty slots — never a false photo (§B.17). Injected once per rendered page.
 *
 * ⛔⛔ WHY IT PAINTS THE IMAGE INSTEAD OF REPLACING THE ELEMENT (measured, 2026-09-13).
 * The first version built a <div> with `position:absolute;inset:0;min-height:150px` and put it
 * into the image's PARENT. That parent is only an image frame in the templates that happen to
 * have one. On the shared room card (`li.cit-modsec__item`) — and on the transit table cell —
 * the parent IS THE WHOLE CARD, so the panel covered the room name and the description, and the
 * 150px floor pushed it out of a 110px card. Elek measured it from both sides: FK-004b H-2 (the
 * lead's eye: "a mondatból csak az »M« és a »k.« látszik") and FK-005a H-3 — i.e. the PAYING
 * customer's live page carried it too, because portal photo URLs rot there just the same.
 * The same class of bug the MINTAKÉP band already hit once and solved with a tight wrapper.
 *
 * The rule this encodes: a stand-in must inherit the layout contract of what it stands in for.
 * So the <img> STAYS — with every rule the template wrote for it (width, aspect-ratio,
 * object-fit, border-radius, grid placement, rotation) — and only its PIXELS are swapped for a
 * token-themed panel drawn as an inline SVG. A stand-in that occupies exactly the photo's box
 * cannot overflow the card or cover a sentence, on ANY template, at ANY width — it is not a
 * rule that has to be re-checked per template, it is a structural impossibility.
 * Guard: scripts/room-card-overflow-check.mts (19 templates × 3 scenarios × 2 widths).
 */
const IMG_FALLBACK_JS = `<script data-cit-imgfallback>(function(){
var cs=getComputedStyle(document.documentElement);
function tok(n,d){var v=cs.getPropertyValue(n);return (v&&v.trim())||d;}
function svg(){
var a=tok('--cit-accent','#8a8f7a'),s=tok('--cit-surface','#f3f1ec'),i=tok('--cit-ink','#2b2b2b');
return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice">'+
'<defs><radialGradient id="g1" cx="18%" cy="0%" r="95%"><stop offset="0" stop-color="'+a+'" stop-opacity=".30"/><stop offset=".6" stop-color="'+a+'" stop-opacity="0"/></radialGradient>'+
'<radialGradient id="g2" cx="100%" cy="100%" r="95%"><stop offset="0" stop-color="'+a+'" stop-opacity=".16"/><stop offset=".55" stop-color="'+a+'" stop-opacity="0"/></radialGradient></defs>'+
'<rect width="900" height="600" fill="'+s+'"/><rect width="900" height="600" fill="url(#g1)"/><rect width="900" height="600" fill="url(#g2)"/>'+
'<g transform="translate(450 300) scale(4.5) translate(-12 -12)" fill="none" stroke="'+i+'" stroke-opacity=".28" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+
'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 15l-5-5L5 20"/></g></svg>';}
var uri=null;
function f(img){if(img.getAttribute('data-cit-filled'))return;img.setAttribute('data-cit-filled','1');
if(!uri)uri='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg());
img.removeAttribute('srcset');img.removeAttribute('sizes');img.setAttribute('src',uri);}
window.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG')f(t);},true);
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('img').forEach(function(i){if(i.complete&&i.naturalWidth===0)f(i);});});
})();</script>`;

// ── Responsive Google photos (FK-009 E2/V4, 2026-09-26) ──────────────────────────
// The page we send out is opened on a PHONE, on mobile data: 8–17 <img> per page at
// `=s4800-w1200` (measured 553 KB for one Places photo) while a 390px screen needs 480–800px.
// The lh3 URL's size suffix is honoured by Google (measured: =w480 → 480px / 110 KB,
// =w800 → 302 KB, =w1200 → 553 KB), so the SAME photo is offered in three widths and the
// browser picks by viewport + DPR. The `-rw` flag asks for WebP: a 780×800 upload that
// Google re-encodes to a 2 034 KB JPEG comes back as 320 KB (=w780-rw) / 86 KB (=w480-rw);
// swept on the park's 34 Google photos × 3 widths: 102/102 answered 200 image/webp
// (2026-09-26). The `src` keeps the ORIGINAL URL — every consumer that reads it (liveness,
// provenance, the curator's proxy) sees the stored photo, and a browser without srcset
// support still gets the picture it always got. Nothing is stored or re-hosted (the provenance row keeps
// the original URL; memory: source portal photos die — we never write the photo store from
// here). Portal photos (hovamenjek, lake-balaton.com, apartman.hu) carry no size parameter
// and are left untouched — named in the session note, not silently "optimised".
//   <img src="…lh3…=s4800-w1200">           → + srcset (480/800/1200 w) + sizes
//   style="background-image:url('…lh3…')"  → data-cit-bg + --cit-bg-{s,m,l} custom props,
//                                             one <style data-cit-bgset> picks by width/DPR
// Pure and idempotent; the guard `scripts/photo-srcset-check.mts` measures it.
const LH3_SIZED = /^(https:\/\/lh3\.googleusercontent\.com\/[^"'\s=]+)=((?:s\d+-)?w(\d+))$/;
const LH3_WIDTHS: readonly number[] = [480, 800, 1200];
const BGSET_STYLE =
  `<style data-cit-bgset>[data-cit-bg]{background-image:var(--cit-bg-l)}` +
  `@media(max-width:480px){[data-cit-bg]{background-image:-webkit-image-set(var(--cit-bg-s) 1x,var(--cit-bg-m) 2x,var(--cit-bg-l) 3x);` +
  `background-image:image-set(var(--cit-bg-s) 1x,var(--cit-bg-m) 2x,var(--cit-bg-l) 3x)}}</style>`;

function lh3Candidates(url: string): { base: string; widths: number[] } | null {
  const m = LH3_SIZED.exec(url);
  if (!m) return null;
  const max = Number(m[3]);
  const widths = LH3_WIDTHS.filter((w) => w < max);
  widths.push(max);
  return { base: m[1]!, widths };
}

export function responsiveGooglePhotos(html: string): string {
  if (html.includes("data-cit-bgset")) return html;
  let heroSeen = false;
  let bgSeen = false;
  let out = html.replace(/<img\b([^>]*)>/gi, (tag, attrs: string) => {
    if (/\bsrcset\s*=/i.test(attrs)) return tag;
    const src = /\bsrc="([^"]+)"/i.exec(attrs);
    const c = src ? lh3Candidates(src[1]!) : null;
    if (!c) return tag;
    const lazy = /\bloading\s*=\s*"lazy"/i.test(attrs);
    // the hero: marked, or the first eager Google photo in document order — full width
    const hero = /\bdata-cit-hero-img\b/.test(attrs) || (!heroSeen && !lazy);
    if (hero) heroSeen = true;
    const srcset = c.widths.map((w) => `${c.base}=w${w}-rw ${w}w`).join(", ");
    // `auto` = the laid-out width for lazy images (Chromium); other engines fall through
    const sizes = hero ? "100vw" : "auto, (max-width: 560px) 100vw, 50vw";
    return `<img srcset="${srcset}" sizes="${sizes}"${attrs}>`;
  });
  out = out.replace(/style="background-image:url\('([^']+)'\)"/g, (decl, url: string) => {
    const c = lh3Candidates(url);
    if (!c) return decl;
    bgSeen = true;
    const at = (w: number): string => `${c.base}=w${Math.min(w, c.widths[c.widths.length - 1]!)}-rw`;
    return `data-cit-bg style="--cit-bg-s:url('${at(480)}');--cit-bg-m:url('${at(800)}');--cit-bg-l:url('${at(1200)}')"`;
  });
  if (bgSeen) out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${BGSET_STYLE}</head>`) : BGSET_STYLE + out;
  return out;
}

function injectImgFallback(html: string): string {
  return html.includes("</body>")
    ? html.replace("</body>", `${IMG_FALLBACK_JS}</body>`)
    : html + IMG_FALLBACK_JS;
}

/**
 * A template may hand the closing booking section a one-line lead (walk-through: the
 * „Telefonon is kereshető” line): it marks a <p data-cit-booking-lead> anywhere, and the
 * line is moved right under the section's „Foglalás” heading, so it belongs to the booking
 * block instead of floating above it (owner: „ok javítsd.”, 2026-10-04). Without a booking
 * section the line stays where the template put it.
 */
function placeBookingLead(html: string): string {
  const lead = /<p [^>]*data-cit-booking-lead[^>]*>[\s\S]*?<\/p>/.exec(html);
  if (!lead) return html;
  const rest = html.replace(lead[0], "");
  const head = /<section class="cit-modsec" id="cit-booking"[^>]*><div class="cit-modsec__in"><h2>[\s\S]*?<\/h2>/.exec(rest);
  return head ? rest.replace(head[0], () => head[0] + lead[0]) : html;
}

/**
 * Weave the tenant-set module sections into a rendered page (ADR-0047).
 *
 * PREFERRED PATH — the template names the places: it plants `data-cit-slot` markers
 * where each GROUP of modules belongs, and each group is rendered there. This is why
 * a paid module reads as part of the site instead of an appendix.
 *
 * FALLBACK — a template with no markers gets the old single lump before its enquiry
 * slot. That path is measured, not assumed: scripts/module-slot-check.mts fails if a
 * template ships without markers, so the fallback cannot quietly become the norm.
 *
 * WHY THE OLD BEHAVIOUR WAS WRONG: "before the enquiry slot" sounds like "at the
 * end", but a template is free to put its CTA anywhere. On `editorial` the enquiry
 * IS the coupon near the top, so all ten module blocks landed ahead of the gallery
 * and the reviews — on live tenant pages too, not just mocks.
 */
/**
 * ADR-0061 — which modules the MOCK shows as marked, native-styled samples: every
 * module the lead could buy, wherever real data is absent. Real data always wins;
 * the live phase gets an empty set, so nothing sample-like can reach a tenant page.
 * The map is listed only when we hold REAL location data to feed it.
 */
function demoModuleSamples(
  data: SiteData,
  phase: RenderPhase,
  /**
   * ADR-0089 tenant-admin preview: the sample keys the caller EXPLICITLY allows.
   * When given it decides on its own (the phase no longer gates) — the tenant's
   * "how would this look" preview is neither a cold mock nor a live page, and it
   * must show exactly the modules currently in the cart, not every sellable one.
   * Absent, behaviour is unchanged: samples only on the mock, never on live.
   */
  allow?: ReadonlySet<string>,
  /**
   * Sample keys the caller FORBIDS (module-sales switch, owner decree 2026-09-06):
   * a not-sellable module must not appear as an ALL-IN sample in the mock (§I).
   * Subtract-only — unlike `allow` it never widens the phase gate, so it is safe
   * to pass on any phase.
   */
  deny?: ReadonlySet<string>,
): Set<string> {
  const s = new Set<string>();
  if (!allow && phase !== "mock") return s;
  const ok = (k: string) => (!allow || allow.has(k)) && !deny?.has(k);
  // Booking joins the samples on the PREVIEW path (`allow` present) even when
  // real config exists: the preview's question is "how would the calendar look",
  // and a tenant with zero bookings would get an all-free — blank — answer
  // (measured 2026-09-08 on the Dencs preview). The section then renders with
  // the tenant's own units but clearly-labelled minta-foglaltság; the live page
  // is untouched (no `allow` there).
  if ((!data.booking || !!allow) && ok("booking")) s.add("booking");
  if (!data.rooms?.length && ok("rooms")) s.add("rooms");
  if (!data.hours && ok("hours")) s.add("hours");
  if (!data.pricing && ok("pricing")) s.add("pricing");
  if (!data.poi?.length && ok("poi")) s.add("poi");
  if (!data.amenities?.length && ok("amenities")) s.add("amenities");
  if (!data.newsletter && ok("newsletter")) s.add("newsletter");
  if (!data.reviewForm && ok("review-form")) s.add("review-form");
  if (!data.location && (data.geo || data.contact.address) && ok("map")) s.add("map");
  return s;
}

/**
 * Anchor the template's NATIVE selling-points section as the amenities/usp module's
 * surface (owner report 2026-08-23, §I).
 *
 * ADR-0059 sends amenities + usp INTO the template's own highlights section, which
 * left those two modules with no anchor at all: switching them off in the
 * configurator changed nothing on the page, so the prospect would pay for something
 * they never saw move. Anchoring is measured, not assumed — we find where the first
 * highlight actually rendered and stamp the <section> containing it.
 */
function stampSellingPointsAnchor(html: string, data: SiteData): string {
  if (!data.highlights.length || /data-cit-module="usp"/.test(html)) return html;
  const needle = escapeForCompare(data.highlights[0]!);
  // Walk EVERY occurrence, not just the first (T-1 matrix, 2026-10-01): `dopamine`
  // prints the first highlight as a hero sticker outside any <section>, and stopping
  // there left the paid usp module without an anchor on every dopamine page. An
  // occurrence counts only when a <section> actually ENCLOSES it — the nearest
  // preceding one may already be closed, and stamping that would mark a stranger.
  for (let at = html.indexOf(needle); at >= 0; at = html.indexOf(needle, at + needle.length)) {
    const open = html.lastIndexOf("<section", at);
    if (open < 0) continue;
    if (html.lastIndexOf("</section", at) > open) continue; // that section ended before us
    const close = html.indexOf(">", open);
    if (close < 0 || close > at) continue;
    const tag = html.slice(open, close);
    if (tag.includes("data-cit-module=")) return html; // already a module's surface
    // The section may hold MORE than the highlights (LV-1, measured on wordmark-grow:
    // the about section carries the intro AND the highlight chips). Stamping it would
    // make the intro part of the paid usp surface — the configurator toggle hid it in
    // the mock, and the not-bought cut took it off the live page. Then the anchor goes
    // on the innermost element that holds every highlight and not the intro.
    const secEnd = elementEnd(html, open, "section");
    const lede = data.intro ? escapeForCompare(data.intro.slice(0, 30)) : "";
    if (lede && secEnd > 0 && html.slice(open, secEnd).includes(lede)) {
      return stampInnermostHighlightBox(html, data, open, at, secEnd, lede);
    }
    return html.slice(0, close) + ` data-cit-module="usp"` + html.slice(close);
  }
  return html;
}

/** See stampSellingPointsAnchor: the narrowest element around all highlights inside
 *  [secOpen, secEnd) that does not also hold the intro. No such element → no anchor
 *  (an unanchored list is what the 5 templates without a section already have). */
function stampInnermostHighlightBox(
  html: string,
  data: SiteData,
  secOpen: number,
  first: number,
  secEnd: number,
  lede: string,
): string {
  const lastNeedle = escapeForCompare(data.highlights[data.highlights.length - 1]!);
  const last = html.indexOf(lastNeedle, first);
  if (last < 0 || last > secEnd) return html;
  const lastEnd = last + lastNeedle.length;
  for (let cur = html.lastIndexOf("<", first); cur > secOpen; cur = html.lastIndexOf("<", cur - 1)) {
    const name = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(cur, cur + 40))?.[1];
    if (!name) continue; // a closing tag or a comment
    const end = elementEnd(html, cur, name);
    if (end < lastEnd) continue; // closes before the last highlight
    const box = html.slice(cur, end);
    if (box.includes(lede) || box.includes("data-cit-module=")) return html;
    const close = html.indexOf(">", cur);
    return html.slice(0, close) + ` data-cit-module="usp"` + html.slice(close);
  }
  return html;
}

/**
 * Mark the SAMPLE room photos so the runtime can watermark them (owner decree
 * 2026-08-23).
 *
 * The lead opens the mock, sees a room card with a photo of their own house and
 * reads it as a claim: "nálam nincs is apartman — ez nem az én szállásom". The alt
 * text says "Minta", but nobody reads alt text. A photo that stands for a room we
 * do not know about needs a marker you cannot miss — and it has to work in all 16
 * templates, whose room markup differs, so the flag is stamped here and the visual
 * band is drawn once by the runtime (O(1), not O(templates)).
 */
function stampSampleRoomPhotos(html: string, data: SiteData, phase: RenderPhase): string {
  if (phase !== "mock") return html;
  let out = html;
  // Covers both branches: numbered samples AND real rooms wearing a borrowed photo. The VALUE
  // tells them apart — the fact gate cuts a sample room's card, never a real room's (OP3-1).
  const kind = data.rooms?.length ? "borrowed" : "sample";
  for (const r of roomsForMock(data)) {
    const alt = r.photo?.alt;
    if (!alt) continue;
    const needle = `alt="${escapeForCompare(alt).replace(/"/g, "&quot;")}"`;
    out = out.replaceAll(needle, `${needle} data-cit-sample-photo="${kind}"`);
  }
  return out;
}

/**
 * Page-level module coverage for the stamp (measured on the FINAL page): the
 * configurator must never inject a generic sample card for content the page
 * already carries as a real, native-styled section (ADR-0061).
 */
function measureModuleCoverage(html: string): string[] {
  const types: string[] = [];
  if (/data-cit-module="rooms"/.test(html)) types.push("rooms");
  if (/data-cit-module="hours"/.test(html)) types.push("hours");
  if (/data-cit-module="pricing"/.test(html)) types.push("pricing");
  if (/data-cit-module="poi"/.test(html)) types.push("poi");
  if (/data-cit-module="amenities"/.test(html)) types.push("amenities");
  if (/data-cit-module="usp"/.test(html)) types.push("usp");
  if (/data-cit-module="newsletter"/.test(html)) types.push("newsletter");
  if (/data-cit-module="map"/.test(html)) types.push("map");
  if (/data-cit-module="(reviews|reviews-pending|review-form)"/.test(html)) types.push("reviews");
  if (/data-cit-variant="request"/.test(html)) types.push("booking");
  return types;
}

function withModuleSections(
  html: string,
  data: SiteData,
  phase: RenderPhase,
  opts: { sampleAllow?: ReadonlySet<string>; sampleDeny?: ReadonlySet<string>; demoForms?: boolean } = {},
): string {
  // Only some templates render a rooms section of their own. Rather than editing the
  // others (and forgetting the next one), the shared block fills the gap — but only
  // when the template did NOT already show them, so nothing prints twice. On the
  // mock the probe is the SAMPLE rooms' first name (ADR-0061): the 9 native-rooms
  // templates render them in-template, the other 7 get the shared sample block.
  const samples = demoModuleSamples(data, phase, opts.sampleAllow, opts.sampleDeny);
  const firstRoom =
    data.rooms?.[0]?.name ?? (samples.has("rooms") ? sampleRooms(data)[0]?.name : undefined);
  // The booking widget's data-cit-units attribute carries the SAME room names as
  // JSON — an attribute is not a rooms section, so it must not satisfy the probe.
  const probeHtml = html.replace(/ data-cit-units="[^"]*"/g, "");
  const roomsAlreadyShown = firstRoom ? probeHtml.includes(escapeForCompare(firstRoom)) : true;
  // ADR-0059 §1: the usp/amenities items were woven into `highlights` before render;
  // whatever the template's native section did not fit (its own slice caps) goes into
  // ONE shared leftover block. Measured on the output — the module promise ("what you
  // type shows up", ADR-0044) survives any template cap without a second section.
  const sellingLeftover = (data.usp ?? []).filter(
    (item) => !html.includes(escapeForCompare(item)),
  );
  // One rating, stated once, with its source link (ADR-0046 ③ + ADR-0057 ②). A template
  // whose OWN review section already links the Google number (walk-through, gate-opening)
  // has said it — the shared badge right below it would be the same number a second
  // time. Measured on the template's output (an href to the reviews page), not a
  // template list, so template no. 22 is judged the same way.
  const ratingUrl = data.googleRating?.url ?? data.rating?.url;
  const ratingAlreadyLinked = ratingUrl ? html.includes(`href="${esc(ratingUrl)}"`) : false;
  const { css, groups } = moduleSectionGroups(data, {
    roomsAlreadyShown,
    ratingAlreadyLinked,
    sellingLeftover,
    // ADR-0061 mock all-in: absent module data renders as a MARKED native sample
    // section, and every mock form is try-able without submitting anywhere.
    samples,
    demo: opts.demoForms ?? phase === "mock",
  });
  if (!css) return html;

  // ADR-0062: with the full booking surface living in the closing section, every
  // "Foglalás" button on the page (nav, hero, sticky bar — they all target the
  // template slot) jumps straight to the decision point instead of the slim band.
  const retarget = (raw: string): string => {
    const h = placeBookingLead(raw);
    const jumped =
      data.booking || samples.has("booking")
        ? h.replaceAll('href="#cit-enquiry"', 'href="#cit-booking"')
        : h;
    // Demo render (mock / tenant preview): the template-placed enquiry BAR must
    // not post a real enquiry — mark it so the runtime simulates the send, the
    // same contract the request widget and the other demo forms already follow.
    return (opts.demoForms ?? phase === "mock")
      ? jumped.replaceAll(
          'data-cit-module="booking" data-cit-variant="bar"',
          'data-cit-module="booking" data-cit-variant="bar" data-cit-demo="1"',
        )
      : jumped;
  };

  // Slot path: replace each marker with its group (an unfilled marker disappears).
  if (/data-cit-slot="/.test(html)) {
    let out = html;
    let placed = "";
    for (const slot of MODULE_SLOTS) {
      const marker = new RegExp(`<div data-cit-slot="${slot}"\\s*></div>`);
      const block = groups[slot] ?? "";
      if (marker.test(out)) {
        out = out.replace(marker, block);
        placed += block;
      }
    }
    // Anything whose slot the template does not define still has to reach the page —
    // the tenant paid for it. It goes where the fallback would have put it.
    const orphans = MODULE_SLOTS.map((s) => groups[s] ?? "")
      .filter((b) => b && !placed.includes(b))
      .join("");
    out = out.replace(/<\/head>/i, `${css}</head>`);
    if (!orphans) return retarget(out);
    const m = /<section id="cit-enquiry"/.exec(out);
    return retarget(m ? out.slice(0, m.index) + orphans + out.slice(m.index) : out + orphans);
  }

  const block = css + MODULE_SLOTS.map((s) => groups[s] ?? "").join("");
  const anchors = [/<section id="cit-enquiry"/, /<footer/i, /<\/body>/i];
  for (const re of anchors) {
    const m = re.exec(html);
    if (m) return retarget(html.slice(0, m.index) + block + html.slice(m.index));
  }
  return retarget(html + block);
}

/**
 * Which content types the page's OWN sections demonstrate (measured on the raw
 * template/composition output, BEFORE the shared module blocks are woven in — a
 * shared block must not count as native coverage of itself).
 */
function measureNativeCoverage(html: string, data: SiteData): string[] {
  const types: string[] = [];
  if (/data-cit-module="rooms"/.test(html)) types.push("rooms");
  if (data.highlights.some((h) => html.includes(escapeForCompare(h)))) types.push("selling-points");
  if (/data-cit-module="gallery"/.test(html)) types.push("gallery");
  if (/data-cit-module="reviews"/.test(html)) types.push("reviews");
  return types;
}

/** End index (exclusive) of the balanced `<tag …>…</tag>` that starts at `open`. */
function elementEnd(html: string, open: number, tag: string): number {
  const openRe = new RegExp(`<${tag}\\b`, "gi");
  const closeRe = new RegExp(`</${tag}\\s*>`, "gi");
  let depth = 0;
  let i = open;
  for (;;) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const o = openRe.exec(html);
    const c = closeRe.exec(html);
    if (!c) return -1;
    if (o && o.index < c.index) {
      depth++;
      i = o.index + 1;
      continue;
    }
    depth--;
    if (depth === 0) return c.index + c[0].length;
    i = c.index + 1;
  }
}

/**
 * Does a section show the guest anything of its OWN once its module surfaces are gone?
 *
 * Headings, eyebrows, icons and a one-line lede deliberately do NOT count: "No. 1 —
 * Képes krónika" over nothing is the empty band the design doctrine forbids (measured
 * 2026-08-31), and so is "A szállás — Ahol megszállhat — <tagline>" over a cut room
 * list. Until 2026-10-04 any <p> or <svg> counted: organic and art-deco kept that very
 * heading (with the "Szobák" link pointing at it) on a live page without the rooms
 * module. Real content is media, a form, a list item, a table, the page's <h1>, or
 * a paragraph with something to say (≥ 60 characters — a tagline is ~30, an intro
 * is longer).
 */
const OWN_CONTENT_RE = /<(img|figure|iframe|form|input|video|table|li|dl|h1)\b/i;
const MODULE_TAG_RE = /<([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*\sdata-cit-module="[^"]+"[^<>]*>/g;
function hasOwnContent(html: string): boolean {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  if (OWN_CONTENT_RE.test(body)) return true;
  for (const m of body.matchAll(/<(p|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    if (m[2]!.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim().length >= 60) return true;
  }
  return false;
}

/** The section's markup with every module surface inside it taken out. */
function withoutModules(section: string): string {
  let out = section;
  for (let guard = 0; guard < 40; guard++) {
    MODULE_TAG_RE.lastIndex = 1; // never the section's own opening tag
    const m = MODULE_TAG_RE.exec(out);
    if (!m) break;
    const end = elementEnd(out, m.index, m[1]!);
    if (end < 0) break;
    out = out.slice(0, m.index) + out.slice(end);
  }
  return out;
}

/**
 * ONE cut rule for the live page AND the mock (owner 2026-10-04, „egységesítsd”): a
 * module surface nested in a <section> that has content of its OWN is stamped
 * `data-cit-cut="self"` — cutting the module then takes only that element, and the
 * section (and every link into it) stays. Unstamped surfaces take their section
 * along unless another module still lives in it. stripModuleAnchor (live) and the
 * configurator's toggle (cit-configurator.js cutSurface) both READ this stamp, so
 * neither carries its own copy of the content test. Measured before: the mock took
 * the whole about section on gate-opening / walk-through ("A ház" vanished with the
 * usp box), the live page kept it.
 */
function stampCutScope(html: string): string {
  const marks: number[] = [];
  for (const m of html.matchAll(MODULE_TAG_RE)) {
    const open = m.index!;
    if (/\sdata-cit-cut="/.test(m[0])) continue;
    const end = elementEnd(html, open, m[1]!);
    const secOpen = html.lastIndexOf("<section", open);
    if (end < 0 || secOpen < 0 || secOpen === open) continue;
    const secEnd = elementEnd(html, secOpen, "section");
    if (secEnd < end) continue;
    if (hasOwnContent(withoutModules(html.slice(secOpen, secEnd)))) marks.push(open + m[1]!.length + 1);
  }
  let out = html;
  for (const at of marks.reverse()) out = out.slice(0, at) + ` data-cit-cut="self"` + out.slice(at);
  return out;
}

/**
 * ADR-0089 ⑦ — the tenant does not pay for the gallery module: the photo GALLERY
 * section goes, the header photo stays. Owner ruling 2026-08-31; the module sells
 * "a large photo gallery", not "photos at all", and a picture-less page is barred
 * outright (§A photo policy).
 *
 * Done in ONE place on the rendered output, not in all 18 templates — and measured
 * rather than assumed: scripts/module-preview-check.mts renders every template both
 * ways and fails if a gallery anchor survives, if the page loses its last image, or
 * if anything but the gallery disappears.
 */
function stripGallerySections(html: string): string {
  return stripModuleAnchor(html, "gallery");
}

/**
 * Remove every element carrying `data-cit-module="<anchor>"` — and its enclosing
 * <section> when nothing else of substance is left in it — plus the nav links that
 * pointed into the removed markup. The gallery's ADR-0089 ⑦ cut, generalised for the
 * not-bought modules (LV-1): one measured cut, not a branch in every template.
 */
function stripModuleAnchor(html: string, anchor: string): string {
  let out = html;
  // The attribute INSIDE an opening tag — never the `[data-cit-module="usp"]` selector
  // in a <style> block, which a bare indexOf finds first and which would take the
  // whole stylesheet with it.
  const re = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b[^<>]*\\sdata-cit-module="${anchor}"`);
  for (let guard = 0; guard < 12; guard++) {
    const hit = re.exec(out);
    if (!hit) break;
    const open = hit.index;
    const tag = hit[1]!;
    const end = elementEnd(out, open, tag);
    if (end < 0) break;
    // Would the enclosing <section> be left as a heading over nothing? Then it goes
    // too — an empty band is the very thing the design doctrine forbids. It stays when
    // it has content of its own (stamped by stampCutScope) or another module still
    // lives in it. On a collage hero the gallery lives INSIDE the header, not a
    // section, and the headline stays untouched.
    let start = open;
    let stop = end;
    const own = /\sdata-cit-cut="self"/.test(out.slice(open, out.indexOf(">", open)));
    const secOpen = own ? -1 : out.lastIndexOf("<section", open);
    if (secOpen >= 0) {
      const secEnd = elementEnd(out, secOpen, "section");
      if (secEnd >= end) {
        const rest = out.slice(secOpen, open) + out.slice(end, secEnd);
        if (!/\sdata-cit-module="/.test(rest.replace(/<style[\s\S]*?<\/style>/gi, ""))) {
          start = secOpen;
          stop = secEnd;
        }
      }
    }
    const removed = out.slice(start, stop);
    out = out.slice(0, start) + out.slice(stop);
    // A nav entry pointing at a section that no longer exists is a dead button —
    // the same "no control may target a missing section" rule ADR-0062 set for the
    // booking jump. Measured on the editorial template: the header kept "Képes
    // krónika" after the gallery went.
    for (const m of removed.matchAll(/\sid="([^"]+)"/g)) {
      const id = m[1]!.replace(/[^A-Za-z0-9_-]/g, "");
      if (!id) continue;
      out = out.replace(new RegExp(`<a\\b[^>]*href="#${id}"[^>]*>[\\s\\S]*?</a>`, "gi"), "");
    }
    out = out.replace(/<li\b[^>]*>\s*<\/li>/gi, "");
  }
  return out;
}

/**
 * whole-unit-band (contract `design-refs/tenant-site/whole-unit-band/`, owner: „C”):
 * with rooms beside it, the whole place is taken OUT of the room list. Measured
 * (FK-014, 2026-09-28): as the grid's first card it stood with no price and no capacity,
 * yet with a "Foglalás" button. A lone whole place stays in `rooms` — the one-unit
 * panel is already the right shape for it.
 */
function splitWholeBand(data: SiteData): SiteData {
  const rooms = data.rooms ?? [];
  if (rooms.length < 2) return data;
  const i = rooms.findIndex((r) => r.wholeProperty);
  if (i < 0) return data;
  return { ...data, rooms: rooms.filter((_, k) => k !== i), wholeBand: rooms[i] };
}

/**
 * Put the band next to a template's OWN rooms container: after it ("band"), or before it
 * ("main", ADR-0257). Templates without one get the shared fallback section, which
 * draws the band itself (moduleSections `roomsBlock`) — so nothing prints twice.
 * The container is found by its `data-cit-module="rooms"` marker and closed by
 * counting its own tag, so a nested <div> inside a card cannot end it early.
 */
function injectWholeBand(html: string, data: SiteData, phase: RenderPhase): string {
  if (!data.wholeBand) return html;
  const pos = html.indexOf('data-cit-module="rooms"');
  if (pos < 0) return html;
  const open = html.lastIndexOf("<", pos);
  const tag = /^<([a-z][a-z0-9]*)/i.exec(html.slice(open))?.[1]?.toLowerCase();
  if (!tag) return html;
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "gi");
  re.lastIndex = open;
  let depth = 0;
  let end = -1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      end = m.index + m[0].length;
      break;
    }
  }
  if (end < 0) return html;
  const band = wholeBandBlock(data, phase, { slot: true });
  return data.wholeBand.wholeOnly
    ? html.slice(0, open) + band + html.slice(open)
    : html.slice(0, end) + band + html.slice(end);
}

export function renderSite(
  recipe: Recipe,
  data: SiteData,
  opts: {
    phase?: RenderPhase;
    /** ADR-0089: sample keys the tenant-admin preview allows (see demoModuleSamples). */
    sampleAllow?: ReadonlySet<string>;
    /** Module-sales switch: sample keys to FORBID in the mock (see demoModuleSamples). */
    sampleDeny?: ReadonlySet<string>;
    /** ADR-0089: forms are try-able but never submit — a preview must not book a room. */
    demoForms?: boolean;
    /** ADR-0089 ⑦: the gallery module is not paid for — drop the gallery SECTION,
     *  keep the header photo (a picture-less page is barred outright). */
    hideGallery?: boolean;
    /** LV-1: `data-cit-module` anchors of modules the tenant has NOT bought — their
     *  sections are cut from the page (see unboughtPageAnchors in src/modules.ts). */
    hideAnchors?: readonly string[];
  } = {},
): string {
  const phase: RenderPhase = opts.phase ?? "mock";
  const modOpts = { sampleAllow: opts.sampleAllow, sampleDeny: opts.sampleDeny, demoForms: opts.demoForms };
  const finish = (page: string): string => {
    const bought = (opts.hideAnchors ?? []).reduce(stripModuleAnchor, stampCutScope(page));
    const out = responsiveGooglePhotos(opts.hideGallery ? withoutGallery(bought, recipe, data, opts) : bought);
    // ADR-0110 ⑦: the footer's /adatvedelem + /impresszum links are real on a live
    // tenant site and meaningless on a mock (no legal data about the lead, no such
    // page on the preview host). Cut here, once, for both render paths.
    return phase === "mock" ? stripTenantLegalLinks(out) : out;
  };
  // ADR-0059 §1: module data that has a native channel is woven into the data BEFORE
  // the template renders, so it lands inside the template's own sections.
  data = weaveSellingPoints(data);
  // ADR-0338: the guest-facing address drops the property's own country („… 8646 Hungary”).
  if (data.contact.address && data.place?.country) {
    const address = addressWithoutOwnCountry(data.contact.address, data.place.country, data.lang);
    if (address !== data.contact.address) data = { ...data, contact: { ...data.contact, address } };
  }
  // ADR-0059 ③ on the mock: real-but-photoless rooms borrow a gallery photo (marked),
  // so no card is left as a bare icon panel next to a page full of real imagery.
  if (phase === "mock" && data.rooms?.length) data = { ...data, rooms: roomsForMock(data) };
  // ADR-0027 template-first: a recipe naming an art template renders through the COMPLETE
  // reference-fidelity page template — in BOTH phases (mock=live). Unknown id → composition.
  if (recipe.template && TEMPLATES[recipe.template]) {
    // ADR-0044: tenant-set module content (amenities/hours/pricing/POI/…) is woven
    // in HERE, once, for every template — writing it into all 16 would be the 100×N
    // trap the architecture forbids, and template no. 17 would silently ship without it.
    // whole-unit-band (owner: „C”): the whole place leaves the room grid for its own
    // band, in EVERY template — the templates only ever see the rooms.
    data = splitWholeBand(data);
    const raw = injectWholeBand(TEMPLATES[recipe.template]!.render(recipe, data, phase), data, phase);
    const page = stampSampleRoomPhotos(
      stampSellingPointsAnchor(withModuleSections(raw, data, phase, modOpts), data),
      data,
      phase,
    );
    return finish(
      injectImgFallback(
        stampNativeCoverage(page, [
          ...new Set([...measureNativeCoverage(raw, data), ...measureModuleCoverage(page)]),
        ]),
      ),
    );
  }
  const skin = SKINS[recipe.skin];
  if (!skin) throw new Error(`unknown skin: ${recipe.skin}`);
  const archetype = ARCHETYPES[recipe.archetype];
  if (!archetype) throw new Error(`unknown archetype: ${recipe.archetype}`);

  const activeSections = recipe.sections.filter((s) => {
    // Data-only modules (stats): dropped without real data in BOTH phases (never fabricated).
    if (s.kind === "stats" && !(data.stats && data.stats.length)) return false;
    // §B.17 phase gate: on LIVE, drop sample-capable modules (rooms/reviews) that have no real
    // data — their marked sample content is mock-only. On MOCK, keep them (marked sample).
    if (phase === "live" && isSampleOnly(s.kind, data)) return false;
    return true;
  });

  // Each primitive renders a chosen VARIANT to a fixed HTML block; the archetype ARRANGES
  // the blocks (it never adds or drops one — that is enforce()'s job). This keeps mock=live:
  // same recipe (skin + archetype + sections/variants) + different data → identical structure.
  const variantCss = new Set<string>();
  const rendered: RenderedSection[] = activeSections.map((s) => {
    const prim = PRIMITIVES[s.kind];
    if (!prim) throw new Error(`unknown primitive: ${s.kind}`);
    const vid = s.variant && prim.variants[s.variant] ? s.variant : prim.default;
    const variant = prim.variants[vid]!;
    if (variant.css) variantCss.add(variant.css);
    let html = variant.render(data, s.copy);
    // ADR-0025 ② emphasis: stamp the section root so EMPHASIS_CSS can size it in the page
    // hierarchy. The spine (hero/enquiry) never carries emphasis. `.replace` hits the FIRST
    // `<section` = the primitive's root (each primitive renders exactly one).
    const emphasis = s.kind === "hero" || s.kind === "enquiry" ? undefined : s.emphasis;
    if (emphasis && emphasis !== "normal") {
      html = html.replace("<section", `<section data-cit-emphasis="${emphasis}"`);
    }
    return { kind: s.kind, html };
  });
  const body = archetype.arrange(rendered);
  const extraCss = [...variantCss].join("\n");

  // The composition path gets the same tenant-set sections as the template path —
  // a module must not depend on which rendering route the recipe happened to take.
  const rawPage = `<!doctype html>
<html lang="${data.lang ?? "hu"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escText(seoTitle(data))}</title>
  ${renderSeoHead(data, phase)}
  ${renderSkinFontLinks(skin)}
  <style>
  ${renderSkinVars(skin, data.palette?.accent)}
${PRIMITIVE_CSS}
${CHROME_CSS}
${extraCss}
${archetype.css}
${EMPHASIS_CSS}
  </style>
</head>
<body class="cit-arch-${archetype.id}">
    ${renderNav(data, archetype.navLinks ? activeSections.map((s) => s.kind) : undefined)}
    ${body}
    ${renderFooter(data)}
</body>
</html>`;
  const page = stampSampleRoomPhotos(
    stampSellingPointsAnchor(withModuleSections(rawPage, data, phase, modOpts), data),
    data,
    phase,
  );
  return finish(
    injectImgFallback(
      stampNativeCoverage(page, [
        ...new Set([...measureNativeCoverage(rawPage, data), ...measureModuleCoverage(page)]),
      ]),
    ),
  );
}

/**
 * ADR-0089 ⑦ — drop the gallery section, but never leave the page picture-less.
 * On a collage hero the gallery IS the header imagery: there, stripping would take
 * the last photo, so instead the page is re-rendered with a SINGLE photo. Same
 * deterministic renderer, no special-case markup.
 */
function withoutGallery(
  page: string,
  recipe: Recipe,
  data: SiteData,
  opts: Parameters<typeof renderSite>[2],
): string {
  const stripped = stripGallerySections(page);
  if (stripped !== page && /<img\b/i.test(stripped)) return stripped;
  if (data.photos.length > 1) {
    return renderSite(recipe, { ...data, photos: data.photos.slice(0, 1) }, {
      ...opts,
      hideGallery: false,
    });
  }
  return page;
}

function escText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
