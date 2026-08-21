// "dopamine" art template (ADR-0027) — the 10-dopamine-maximal reference direction.
// Playful sticker-style page: sticky pill nav, sunburst-gradient hero with floating
// data-stickers and a chunky framed photo, "candy" booking card with a hard shadow,
// badge section heads, pastel-alternating fun-grid amenity cards, rotated sticker-collage
// gallery, speech-bubble reviews, contact card, dark footer, mobile fixed CTA bar.
// The reference's fixed neon palette is NOT copied: every hue derives from the 11 --cit-*
// tokens via color-mix (thick --cit-ink outlines + hard shadows + pill shapes carry the
// dopamine character; the skin supplies the palette). No emoji anywhere (§B.4 — SVG only),
// no fabricated facts (§B.17 — sticker text is real data: rating / region / highlight).

import { iconSvg, matchIcon, starIcon } from "../icons.js";
import { slotMarker } from "../moduleSections.js";
import type { Recipe, RenderPhase, SiteData } from "../recipe.js";
import { renderSeoHead, seoTitle } from "../seo.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "../skins.js";
import {
  accented,
  bookingSlot,
  copyOf,
  ctaLabel,
  esc,
  firstSentence,
  honestStarCount,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const DOPAMINE_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.6}
  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  [id]{scroll-margin-top:84px}
  .t-wrap{width:min(1180px,93%);margin:0 auto}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);font-weight:800;font-size:15px;padding:13px 28px;border:3px solid var(--cit-ink);border-radius:100px;box-shadow:4px 4px 0 var(--cit-ink);cursor:pointer;transition:transform .12s,box-shadow .12s}
  .cit-btn:hover{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--cit-ink)}
  .cit-btn-disabled{opacity:.55;pointer-events:none}

  /* nav — sticky sticker bar: pill links + outlined hard-shadow CTA */
  .t-nav{position:sticky;top:0;z-index:100;background:var(--cit-bg);border-bottom:3px solid var(--cit-ink)}
  .t-nv{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0}
  .t-brand{font-family:var(--cit-font-display);font-weight:800;font-size:21px;letter-spacing:.3px}
  .t-menu{display:none;gap:6px;list-style:none;align-items:center}
  @media(min-width:900px){.t-menu{display:flex}}
  .t-menu a{font-weight:700;font-size:14px;padding:9px 16px;border-radius:100px;border:2px solid transparent;transition:.15s}
  .t-menu a:hover{border-color:var(--cit-ink);background:color-mix(in srgb, var(--cit-accent) 16%, var(--cit-bg))}
  .t-menu .cit-btn{padding:9px 18px;font-size:13px;box-shadow:3px 3px 0 var(--cit-ink)}

  /* hero — sunburst gradient built from the skin accent (no fixed neon palette) */
  .t-hero{position:relative;overflow:hidden;text-align:center;color:var(--cit-on-accent);padding:78px 0 0;border-bottom:3px solid var(--cit-ink);background:radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--cit-accent) 28%, #fff) 0%, var(--cit-accent) 46%, color-mix(in srgb, var(--cit-accent) 48%, var(--cit-ink)) 82%)}
  .t-hero--flat{padding-bottom:92px}
  .t-hero h1{font-family:var(--cit-font-display);font-weight:800;font-size:clamp(42px,8.5vw,100px);line-height:1.05;text-shadow:4px 4px 0 var(--cit-ink);max-width:16ch;margin:0 auto}
  .t-hero h1 em{font-style:normal;color:color-mix(in srgb, var(--cit-accent) 18%, #fff)}
  .t-herosub{font-size:clamp(16px,2.2vw,19px);font-weight:600;max-width:560px;margin:18px auto 30px}
  .t-herocta{background:var(--cit-bg);color:var(--cit-ink);font-size:17px;padding:15px 34px;box-shadow:5px 5px 0 var(--cit-ink)}
  .t-heroimgwrap{position:relative;max-width:900px;margin:44px auto 0}
  .t-heroimg{border:3px solid var(--cit-ink);border-bottom:none;border-radius:26px 26px 0 0;overflow:hidden;aspect-ratio:16/7}
  .t-heroimg img{width:100%;height:100%;object-fit:cover}

  /* floating stickers — REAL data only (rating / region / highlight); deterministic tilt.
     Anchored OUTSIDE the headline band so they can never collide with the h1:
     photo hero → riding the photo's top corners; flat hero → the empty bottom band. */
  .t-sticker{position:absolute;z-index:2;display:inline-flex;align-items:center;gap:8px;font-family:var(--cit-font-display);font-weight:800;font-size:15px;background:var(--cit-bg);color:var(--cit-ink);border:3px solid var(--cit-ink);border-radius:100px;padding:10px 18px;box-shadow:4px 4px 0 var(--cit-ink);animation:t-wob 4s ease-in-out infinite}
  .t-sticker svg{width:18px;height:18px;color:var(--cit-accent);flex:none}
  .t-s1{transform:rotate(-8deg)}
  .t-s2{transform:rotate(6deg);background:color-mix(in srgb, var(--cit-accent) 22%, var(--cit-bg));animation-delay:1.2s}
  .t-heroimgwrap .t-s1{top:-24px;left:-12px}
  .t-heroimgwrap .t-s2{top:-24px;right:-12px}
  .t-hero--flat .t-s1{bottom:30px;left:5%}
  .t-hero--flat .t-s2{bottom:38px;right:5%}
  @keyframes t-wob{0%,100%{translate:0 0}50%{translate:0 -10px}}
  @media(prefers-reduced-motion:reduce){.t-sticker{animation:none}}
  @media(max-width:760px){.t-sticker{display:none}}

  /* booking — candy card floated on the dark band (hard accent shadow) */
  .t-candy{margin-top:-3px;background:var(--cit-ink);padding:30px 0;border-bottom:3px solid var(--cit-ink)}
  .t-candycard{background:var(--cit-bg);border:3px solid var(--cit-ink);border-radius:22px;box-shadow:6px 6px 0 var(--cit-accent)}
  .t-candycard .cit-book{background:none;border:0;box-shadow:none}
  .t-candycard .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.4rem clamp(1.25rem,4vw,2rem)}
  .t-candycard .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-weight:800;font-size:1.3rem;color:var(--cit-ink)}

  /* section heads — outlined pill badge (SVG marker) + chunky display h2 */
  section.t-sec{padding:84px 0}
  .t-badge{display:inline-flex;align-items:center;gap:8px;background:color-mix(in srgb, var(--cit-accent) 18%, var(--cit-bg));border:2.5px solid var(--cit-ink);border-radius:100px;padding:8px 18px;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:18px;box-shadow:3px 3px 0 var(--cit-ink)}
  .t-badge svg{width:16px;height:16px;color:var(--cit-ink);flex:none}
  .t-h2{font-family:var(--cit-font-display);font-weight:800;font-size:clamp(30px,5vw,52px);line-height:1.08;margin-bottom:14px}
  .t-h2 em{font-style:normal;color:var(--cit-accent);text-shadow:2px 2px 0 var(--cit-ink)}
  .t-h2 .t-stars{display:inline-flex;gap:3px;vertical-align:baseline}
  .t-h2 .t-stars svg{width:.62em;height:.62em;color:var(--cit-accent)}
  .t-lead{max-width:620px;font-weight:500;color:color-mix(in srgb, var(--cit-ink) 82%, var(--cit-muted))}

  /* fun grid — outlined cards, pastel tints derived from accent/bg (no fixed pastels) */
  .t-fungrid{display:grid;gap:18px;grid-template-columns:repeat(2,1fr);margin-top:44px}
  @media(min-width:880px){.t-fungrid{grid-template-columns:repeat(4,1fr)}}
  .t-fn{border:3px solid var(--cit-ink);border-radius:20px;padding:28px 22px;text-align:center;background:var(--cit-surface);box-shadow:4px 4px 0 var(--cit-ink);transition:transform .15s}
  .t-fn:hover{transform:rotate(-2deg) scale(1.03)}
  .t-fn:nth-child(4n+1){background:color-mix(in srgb, var(--cit-accent) 14%, var(--cit-surface))}
  .t-fn:nth-child(4n+2){background:color-mix(in srgb, var(--cit-accent) 6%, var(--cit-bg))}
  .t-fn:nth-child(4n+3){background:color-mix(in srgb, var(--cit-ink) 7%, var(--cit-surface))}
  .t-fn:nth-child(4n+4){background:color-mix(in srgb, var(--cit-accent) 24%, var(--cit-surface))}
  .t-fn svg{width:34px;height:34px;color:var(--cit-accent);margin:0 auto 12px}
  .t-fn strong{display:block;font-size:15.5px;line-height:1.4}

  /* gallery — sticker collage: rotated, outlined, hard-shadow photos */
  .t-coll{display:grid;gap:20px;grid-template-columns:repeat(2,1fr);margin-top:44px}
  @media(min-width:860px){.t-coll{grid-template-columns:repeat(4,1fr)}}
  .t-coll figure{border:3px solid var(--cit-ink);border-radius:20px;overflow:hidden;aspect-ratio:3/4;box-shadow:5px 5px 0 var(--cit-ink);transform:rotate(var(--r));transition:transform .2s}
  .t-coll figure:hover{transform:rotate(0) scale(1.04)}
  .t-coll img{width:100%;height:100%;object-fit:cover}

  /* reviews — speech bubbles with tails on a pastel band */
  .t-rev{background:color-mix(in srgb, var(--cit-accent) 8%, var(--cit-bg));border-top:3px solid var(--cit-ink);border-bottom:3px solid var(--cit-ink)}
  .t-bubbles{display:grid;gap:34px;grid-template-columns:1fr;margin-top:44px}
  @media(min-width:880px){.t-bubbles{grid-template-columns:repeat(3,1fr)}}
  .t-bub{position:relative;background:var(--cit-surface);border:3px solid var(--cit-ink);border-radius:22px;padding:24px;box-shadow:5px 5px 0 var(--cit-ink)}
  .t-bub::after{content:"";position:absolute;bottom:-16px;left:34px;width:24px;height:24px;background:var(--cit-surface);border-right:3px solid var(--cit-ink);border-bottom:3px solid var(--cit-ink);transform:rotate(45deg)}
  .t-bub .t-stars{display:flex;gap:3px;margin-bottom:10px}
  .t-bub .t-stars svg{width:17px;height:17px;color:var(--cit-accent)}
  .t-bub p{font-size:14.5px;font-weight:500}
  .t-bubwho{margin-top:26px;padding-left:10px;font-weight:800;font-size:14px}
  .t-bubwho span{display:block;font-weight:600;font-size:12.5px;color:var(--cit-muted)}
  .t-sample{margin-top:36px;font-size:12.5px;color:var(--cit-muted);text-align:center}

  /* contact — candy card with dashed rows + tilted framed photo */
  .t-congrid{display:grid;gap:32px;grid-template-columns:1fr;margin-top:44px;align-items:center}
  @media(min-width:900px){.t-congrid{grid-template-columns:1.05fr .95fr}}
  .t-concard{background:var(--cit-surface);border:3px solid var(--cit-ink);border-radius:22px;padding:28px;box-shadow:6px 6px 0 color-mix(in srgb, var(--cit-accent) 45%, var(--cit-bg))}
  .t-conline{display:flex;align-items:center;gap:14px;padding:15px 0;border-bottom:2.5px dashed var(--cit-line);font-size:15.5px}
  .t-conline:last-of-type{border-bottom:none}
  .t-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .t-conline b{display:block;font-size:16px}
  .t-conline small{color:var(--cit-muted);font-size:13px;display:block}
  .t-concard .cit-btn{margin-top:20px}
  .t-conphoto{border:3px solid var(--cit-ink);border-radius:22px;overflow:hidden;aspect-ratio:4/3;box-shadow:5px 5px 0 var(--cit-ink);transform:rotate(1.6deg)}
  .t-conphoto img{width:100%;height:100%;object-fit:cover}

  /* footer — dark band */
  .t-foot{background:var(--cit-ink);color:color-mix(in srgb, var(--cit-bg) 78%, var(--cit-ink));padding:56px 0 26px;border-top:3px solid var(--cit-ink)}
  .t-footgrid{display:grid;gap:32px;grid-template-columns:1fr;margin-bottom:38px}
  @media(min-width:800px){.t-footgrid{grid-template-columns:2fr 1fr 1fr}}
  .t-foot h4{font-family:var(--cit-font-display);font-weight:800;font-size:16px;color:color-mix(in srgb, var(--cit-accent) 55%, #fff);margin-bottom:14px}
  .t-foot p{max-width:300px;font-size:14.5px}
  .t-foot ul{list-style:none}
  .t-foot li{margin-bottom:8px;font-size:14.5px}
  .t-foot a:hover{color:#fff}
  .t-footlegal{border-top:2px solid color-mix(in srgb, var(--cit-bg) 20%, transparent);padding-top:22px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:12.5px}

  /* mobile fixed CTA bar */
  .t-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:110;background:var(--cit-ink);padding:10px 14px;gap:12px;align-items:center;justify-content:space-between}
  .t-mobcta span{color:var(--cit-bg);font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:6px}
  .t-mobcta span svg{width:15px;height:15px;color:color-mix(in srgb, var(--cit-accent) 55%, #fff)}
  .t-mobcta .cit-btn{padding:10px 20px;font-size:13px;border-color:var(--cit-bg);box-shadow:3px 3px 0 color-mix(in srgb, var(--cit-accent) 45%, var(--cit-bg))}
  @media(max-width:700px){.t-mobcta{display:flex}body{padding-bottom:66px}}
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

/** Deterministic collage tilts — fixed values, no randomness (mock=live safe). */
const TILTS: readonly string[] = ["-2deg", "1.6deg", "-1.2deg", "2deg", "-1.8deg", "1.3deg", "-1.5deg", "1.9deg"];

/** Outlined pill badge with an SVG marker (never emoji) + chunky display heading. */
function sectionHead(icon: string, badge: string, title: string, accent?: string): string {
  return `<span class="t-badge">${iconSvg(icon)} ${esc(badge)}</span>
      <h2 class="t-h2">${accented(title, accent)}</h2>`;
}

function renderDopamine(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["coastal-fresh"]!;
  const heroCopy = copyOf(recipe, "hero");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");
  const locCopy = copyOf(recipe, "location");

  const photos = data.photos;
  const heroPhoto = photos[0]?.url ?? "";
  const contactPhoto = photos[3]?.url ?? photos[photos.length - 1]?.url ?? "";

  const h1 = heroCopy.lead || data.tagline || data.name;
  const sub = data.tagline && data.tagline !== h1 ? data.tagline : firstSentence(data.intro);
  const hasContact = Boolean(data.contact.email || data.contact.phone);
  const ratingStat = data.stats?.find((s) => s.icon === "star");
  const starCount = honestStarCount(data);
  const stars = starCount
    ? `<span class="t-stars">${starIcon().repeat(starCount)}</span>`
    : "";

  // -- nav ------------------------------------------------------------------
  const navLinks = [
    data.highlights.length ? `<li><a href="#t-fun">${T(data, "Szolgáltatások")}</a></li>` : "",
    photos.length ? `<li><a href="#t-gallery">${T(data, "Galéria")}</a></li>` : "",
    `<li><a href="#t-reviews">${T(data, "Vélemények")}</a></li>`,
    hasContact ? `<li><a href="#t-contact">${T(data, "Kapcsolat")}</a></li>` : "",
    hasContact ? `<li><a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalnék!")}</a></li>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="t-nav">
    <div class="t-wrap t-nv">
      <a class="t-brand" href="#top">${esc(data.name)}</a>
      <ul class="t-menu">
        ${navLinks}
      </ul>
    </div>
  </nav>`;

  // -- hero stickers: REAL data only (§B.17 — never a fabricated offer/claim) --
  const sticker1 = ratingStat
    ? `<span class="t-sticker t-s1">${starIcon()} ${esc(ratingStat.value)}</span>`
    : "";
  const regionText = heroCopy.eyebrow || data.highlights[0] || "";
  const sticker2 = regionText
    ? `<span class="t-sticker t-s2">${iconSvg("location")} ${esc(regionText)}</span>`
    : "";

  // -- hero -----------------------------------------------------------------
  const stickers = [sticker1, sticker2].filter(Boolean).join("\n      ");
  const hero = `<header class="t-hero${heroPhoto ? "" : " t-hero--flat"}" id="top">
    ${heroPhoto ? "" : stickers}
    <div class="t-wrap">
      <h1>${accented(h1, heroCopy.accent)}</h1>
      ${sub ? `<p class="t-herosub">${esc(sub)}</p>` : ""}
      ${hasContact ? `<a class="cit-btn t-herocta" href="#cit-enquiry">${T(data, "Foglalnék!")}</a>` : ""}
      ${heroPhoto ? `<div class="t-heroimgwrap">
      ${stickers}
      <div class="t-heroimg"><img src="${esc(heroPhoto)}" alt="${esc(photos[0]?.alt ?? data.name)}"></div>
    </div>` : ""}
    </div>
  </header>`;

  // -- candy booking card (canonical hydrated slot inside the candy frame) ---
  const booking = `<div class="t-candy">
    <div class="t-wrap">
      <div class="t-candycard">
        ${bookingSlot(data)}
      </div>
    </div>
  </div>`;

  // -- fun grid (real highlights only; the icon is decorative dressing) ------
  const fun = data.highlights.length
    ? `<section class="t-sec" id="t-fun">
    <div class="t-wrap">
      ${sectionHead("check", featCopy.eyebrow || T(data, "Szolgáltatások"), featCopy.title || T(data, "Amit nálunk találsz"), featCopy.accent)}
      ${data.intro ? `<p class="t-lead">${esc(data.intro)}</p>` : ""}
      <div class="t-fungrid">
        ${data.highlights
          .slice(0, 8)
          .map((h) => `<div class="t-fn">${iconSvg(matchIcon(h))}<strong>${esc(h)}</strong></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- gallery: sticker collage with deterministic tilts ---------------------
  const gallery = photos.length
    ? `<section class="t-sec" id="t-gallery" style="padding-top:0">
    <div class="t-wrap">
      ${sectionHead("view", galCopy.eyebrow || T(data, "Galéria"), galCopy.title || T(data, "Nézz be hozzánk"), galCopy.accent)}
      <div class="t-coll" data-cit-module="gallery">
        ${photos
          .slice(0, 8)
          .map(
            (p, i) =>
              `<figure style="--r:${TILTS[i % TILTS.length]}"><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews (real → bubbles; none → MOCK: marked sample, LIVE: dropped §B.17) --
  const realReviews = data.reviews && data.reviews.length ? data.reviews : null;
  const reviewsData = realReviews;
  const revHead = ratingStat
    ? `<h2 class="t-h2">${esc(ratingStat.value)} ${stars}</h2>
      <p class="t-lead">${esc(ratingStat.label)}</p>`
    : `<h2 class="t-h2">${accented(revCopy.title || T(data, "Vendéghangok"), revCopy.accent)}</h2>`;
  const reviews = reviewsData
    ? `<section class="t-sec t-rev" id="t-reviews" data-cit-module="reviews">
    <div class="t-wrap">
      <span class="t-badge">${starIcon()} ${revCopy.eyebrow ? esc(revCopy.eyebrow) : T(data, "Vendéghangok")}</span>
      ${revHead}
      <div class="t-bubbles">
        ${reviewsData
          .map(
            (r) =>
              `<div>
          <div class="t-bub">${stars}<p>„${esc(r.quote)}"</p></div>
          <div class="t-bubwho">${esc(r.author)}${r.meta ? `<span>${esc(r.meta)}</span>` : ""}</div>
        </div>`,
          )
          .join("\n        ")}
      </div>
      ${realReviews ? "" : `<div class="t-sample">${T(data, "Minta — ide a valós vendégértékeléseid kerülnek.")}</div>`}
    </div>
  </section>`
    : "";

  // -- contact ---------------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="t-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívj bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="t-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írj nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="t-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Így találsz meg")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const contact = contactLines
    ? `<section class="t-sec" id="t-contact">
    <div class="t-wrap">
      ${sectionHead("location", locCopy.eyebrow || T(data, "Itt vagyunk"), locCopy.title || T(data, "Gyere, várunk"), locCopy.accent)}
      <div class="t-congrid">
        <div class="t-concard">
          ${contactLines}
          ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalnék!")}</a>` : ""}
        </div>
        ${contactPhoto ? `<div class="t-conphoto"><img src="${esc(contactPhoto)}" alt="${T(data, "{name} környezete", { name: esc(data.name) })}"></div>` : ""}
      </div>
    </div>
  </section>`
    : "";

  // -- footer ----------------------------------------------------------------
  const footer = `<footer class="t-foot">
    <div class="t-wrap">
      <div class="t-footgrid">
        <div>
          <h4>${esc(data.name)}</h4>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Ugrás")}</h4>
          <ul>
            ${data.highlights.length ? `<li><a href="#t-fun">${T(data, "Szolgáltatások")}</a></li>` : ""}
            ${photos.length ? `<li><a href="#t-gallery">${T(data, "Galéria")}</a></li>` : ""}
            <li><a href="#t-reviews">${T(data, "Vélemények")}</a></li>
          </ul>
        </div>
        <div>
          <h4>${T(data, "Kapcsolat")}</h4>
          <ul>
            ${c.phone ? `<li>${esc(c.phone)}</li>` : ""}
            ${c.email ? `<li>${esc(c.email)}</li>` : ""}
            ${c.address ? `<li>${esc(c.address)}</li>` : ""}
            <li><a href="#cit-enquiry">${ctaLabel(data)}</a></li>
          </ul>
        </div>
      </div>
      <div class="t-footlegal">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        <span><a href="#top">${T(data, "Vissza a tetejére")}</a></span>
      </div>
    </div>
  </footer>`;

  // -- mobile fixed CTA bar (only when a real contact target exists) ---------
  const mobcta = hasContact
    ? `<div class="t-mobcta">
    <span>${ratingStat ? `${starIcon()} <b>${esc(ratingStat.value)}</b>` : esc(data.name)}</span>
    <a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalnék!")}</a>
  </div>`
    : "";

  return `<!doctype html>
<html lang="${data.lang ?? "hu"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(seoTitle(data))}</title>
  ${renderSeoHead(data, phase)}
  ${renderSkinFontLinks(skin)}
  <style>
  ${renderSkinVars(skin, data.palette?.accent)}
${DOPAMINE_CSS}
  </style>
</head>
<body class="cit-tpl-dopamine">
    ${nav}
    ${hero}
    ${booking}
    ${fun}
    ${slotMarker("showcase")}
    ${gallery}
    ${reviews}
    ${slotMarker("trust")}
    ${slotMarker("practical")}
    ${contact}
    ${slotMarker("closing")}
    ${footer}
    ${mobcta}
</body>
</html>`;
}

export const DOPAMINE: ArtTemplate = {
  id: "dopamine",
  label: "Dopamin — élénk, játékos, sticker-stílus (referencia 10)", // i18n-exempt: operator-facing (console template picker)
  // Light, cheerful skins only: the dopamine character (thick outlines, hard shadows, pills,
  // accent-derived sunburst/pastels) needs a bright base + a punchy accent. Dark skins would
  // invert the candy look, so they are excluded.
  skins: ["alpine-bold", "coastal-fresh", "tuscan-terracotta", "sand-cream-airy"],
  render: renderDopamine,
};
