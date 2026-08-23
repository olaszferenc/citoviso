// "parallax" art template (ADR-0027) — the 06-immersive-parallax reference direction.
// Full-height fixed-background photo panels (scroll fallback on mobile/touch), a side dot-nav,
// loud uppercase display type, an accent-ruled stat band (REAL stats only), alternating
// photo+highlight feature rows, an amenity grid, a dark review band, the booking slot embedded
// in a sticky dark dock, and a rich dark footer. All styling dresses from the 11 --cit-* tokens
// (+ color-mix derivations) — see templateKit.ts for contracts. Neutral blacks/whites are used
// only for the photo scrims (skin-agnostic legibility, same convention as fullbleed).

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

const PARALLAX_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.65}

  /* shared module sections (.cit-modsec) themed to this template's rhythm (ADR-0057):
     loud left-aligned uppercase display heads, .t-wrap container, no top divider, radius:6px */
  body.cit-tpl-parallax{
    --cit-modsec-py:96px;
    --cit-modsec-maxw:1180px;
    --cit-modsec-px:28px;
    --cit-modsec-divider:0;
    --cit-modsec-head-align:left;
    --cit-modsec-head-mb:18px;
    --cit-modsec-head-size:clamp(30px,4.8vw,54px);
    --cit-modsec-head-weight:800;
    --cit-modsec-card-radius:6px;
    --cit-modsec-card-pad:24px 22px}

  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .t-wrap{max-width:1180px;margin:0 auto;padding:0 28px}
  h1,h2,h3{font-family:var(--cit-font-display);font-weight:800;text-transform:uppercase;letter-spacing:-.5px;line-height:1.05}
  .t-eyebrow{font-size:12px;letter-spacing:4px;text-transform:uppercase;color:var(--cit-accent);font-weight:700;margin-bottom:14px}
  h2{font-size:clamp(30px,4.8vw,54px);margin-bottom:18px}
  h2 em{font-style:normal;color:var(--cit-accent)}
  .t-lead{color:var(--cit-muted);max-width:580px;font-size:17px}
  section.t-sec{padding:96px 0}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);padding:14px 30px;letter-spacing:2px;text-transform:uppercase;font-size:13px;font-weight:700;border-radius:4px;border:1px solid var(--cit-accent);transition:.25s;cursor:pointer}
  .cit-btn:hover{filter:brightness(1.12);transform:translateY(-2px);box-shadow:0 12px 28px color-mix(in srgb, var(--cit-accent) 35%, transparent)}
  .cit-btn-ghost{background:transparent;border-color:rgba(255,255,255,.55);color:#fff}
  .cit-btn-ghost:hover{border-color:#fff;filter:none;box-shadow:none}

  /* PARALLAX PANELS — fixed background on desktop; scroll fallback on touch/small/reduced-motion */
  .t-par{min-height:92svh;background-size:cover;background-position:center;background-attachment:fixed;display:flex;align-items:center;position:relative}
  .t-par--band{min-height:60svh}
  .t-par::after{content:"";position:absolute;inset:0;background:rgba(10,12,14,.48)}
  .t-par .t-parin{position:relative;z-index:2;color:#fff;width:100%}
  .t-par--flat{background-image:linear-gradient(160deg, color-mix(in srgb, var(--cit-ink) 88%, black), color-mix(in srgb, var(--cit-accent) 45%, var(--cit-ink)))}
  @media(max-width:900px){.t-par{background-attachment:scroll;min-height:78svh}.t-par--band{min-height:52svh}}
  @media(prefers-reduced-motion:reduce){.t-par{background-attachment:scroll}}
  @supports (-webkit-touch-callout: none){.t-par{background-attachment:scroll}}

  /* SIDE DOT NAV (desktop only; anchors work without JS, JS only marks the active one) */
  .t-dots{position:fixed;right:20px;top:50%;transform:translateY(-50%);z-index:70;display:none;flex-direction:column;gap:14px}
  @media(min-width:1000px){.t-dots{display:flex}}
  .t-dots a{width:10px;height:10px;border-radius:50%;background:transparent;border:2px solid var(--cit-ink);display:block;transition:background .2s,border-color .2s}
  .t-dots a.on,.t-dots a:hover{background:var(--cit-accent);border-color:var(--cit-accent)}

  /* TOP BAR — overlay on the hero panel only */
  .t-bar{position:absolute;top:0;left:0;right:0;z-index:6;display:flex;justify-content:space-between;align-items:center;padding:20px 4%}
  .t-bar .t-brand{font-family:var(--cit-font-display);font-weight:800;font-size:18px;letter-spacing:1px;text-transform:uppercase;color:#fff;text-shadow:0 1px 8px rgba(10,12,14,.5)}
  .t-bar .cit-btn{padding:11px 22px}

  /* HERO */
  .t-herotag{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:7px 14px;border-radius:4px;margin-bottom:22px}
  .t-hero h1{font-size:clamp(40px,8vw,96px);color:#fff;margin-bottom:18px;max-width:16ch}
  .t-hero h1 em{font-style:normal;color:color-mix(in srgb, var(--cit-accent) 60%, #fff)}
  .t-herosub{max-width:540px;font-size:18px;margin-bottom:34px;opacity:.92}
  .t-heroctas{display:inline-flex;gap:14px;flex-wrap:wrap}

  /* STICKY BOOKING DOCK — the canonical booking slot lives inside this dark bar */
  .t-dock{position:sticky;top:0;z-index:60;background:color-mix(in srgb, var(--cit-ink) 92%, black);box-shadow:0 8px 24px rgba(10,12,14,.25)}
  .t-dock .cit-book{background:none;border:0;box-shadow:none}
  .t-dock .cit-enquiry-bar-inner{max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.05rem 28px}
  .t-dock .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-weight:800;text-transform:uppercase;letter-spacing:2px;font-size:15px;color:color-mix(in srgb, var(--cit-bg) 92%, #fff)}
  @media(max-width:700px){.t-dock{position:static}}

  /* QUOTE / IMAGE BANDS between sections */
  .t-quote{font-family:var(--cit-font-display);font-weight:800;font-size:clamp(22px,3.6vw,40px);text-transform:uppercase;max-width:22ch;text-align:center;margin:0 auto;line-height:1.15}

  /* STATS band — accent-ruled real numbers */
  .t-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:26px;margin-top:50px}
  @media(min-width:800px){.t-stats{grid-template-columns:repeat(4,1fr)}}
  .t-stat{border-left:4px solid var(--cit-accent);padding-left:18px}
  .t-stat b{display:flex;align-items:baseline;gap:8px;font-family:var(--cit-font-display);font-size:clamp(28px,3.4vw,38px);font-weight:800;text-transform:uppercase}
  .t-stat b svg{width:20px;height:20px;color:var(--cit-accent);flex:none;align-self:center}
  .t-stat span{font-size:13px;color:var(--cit-muted);text-transform:uppercase;letter-spacing:1.5px}

  /* FEATURE ROWS — alternating photo + highlight pairs */
  .t-row{display:grid;gap:34px;grid-template-columns:1fr;align-items:center;margin-top:64px}
  @media(min-width:900px){.t-row{grid-template-columns:1.1fr .9fr}.t-row.t-flip .t-rowimg{order:2}}
  .t-rowimg{aspect-ratio:4/3;overflow:hidden;border-radius:6px}
  .t-rowimg img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
  .t-row:hover .t-rowimg img{transform:scale(1.04)}
  .t-rowbody svg{width:34px;height:34px;color:var(--cit-accent);margin-bottom:16px}
  .t-rowbody h3{font-size:clamp(22px,2.6vw,30px);margin-bottom:12px}
  .t-rowbody p{color:var(--cit-muted);margin-bottom:20px}
  .t-rowbody a{display:inline-block;background:color-mix(in srgb, var(--cit-ink) 92%, black);color:color-mix(in srgb, var(--cit-bg) 92%, #fff);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;padding:12px 24px;border-radius:4px;transition:.25s}
  .t-rowbody a:hover{background:var(--cit-accent);color:var(--cit-on-accent)}

  /* AMENITY GRID with hover lift */
  .t-amen{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:50px}
  @media(min-width:820px){.t-amen{grid-template-columns:repeat(4,1fr)}}
  .t-am{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:6px;padding:24px 22px;transition:transform .2s,border-color .2s,box-shadow .2s}
  .t-am:hover{transform:translateY(-4px);border-color:var(--cit-accent);box-shadow:var(--cit-shadow)}
  .t-am svg{width:28px;height:28px;color:var(--cit-accent);margin-bottom:12px}
  .t-am p{font-size:14.5px;font-weight:600;line-height:1.45}

  /* GALLERY grid (img-based → lightbox runtime hook) */
  .t-gal{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:220px;gap:14px;margin-top:50px}
  .t-gal figure{position:relative;border-radius:6px;overflow:hidden}
  .t-gal img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
  .t-gal figure:hover img{transform:scale(1.06)}
  .t-gal figure:nth-child(1){grid-column:span 2;grid-row:span 2}
  .t-gal figure:nth-child(6){grid-column:span 4}
  @media(max-width:760px){.t-gal{grid-template-columns:1fr 1fr;grid-auto-rows:180px}.t-gal figure:nth-child(1){grid-column:span 2}.t-gal figure:nth-child(6){grid-column:span 2}}

  /* REVIEW band — dark, contrast-derived from the token pair */
  .t-rev{background:color-mix(in srgb, var(--cit-ink) 92%, black);color:color-mix(in srgb, var(--cit-bg) 92%, #fff)}
  .t-rev h2{color:color-mix(in srgb, var(--cit-bg) 92%, #fff)}
  .t-rev .t-eyebrow{color:color-mix(in srgb, var(--cit-accent) 60%, #fff)}
  .t-revscore{display:flex;align-items:center;gap:16px;margin-bottom:8px}
  .t-revscore b{font-family:var(--cit-font-display);font-size:clamp(38px,5vw,56px);font-weight:800}
  .t-stars{display:flex;gap:4px}
  .t-stars svg{width:20px;height:20px;color:color-mix(in srgb, var(--cit-accent) 60%, #fff)}
  .t-revscore span{font-size:14px;opacity:.65}
  .t-revgrid{display:grid;gap:22px;grid-template-columns:1fr;margin-top:44px}
  @media(min-width:840px){.t-revgrid{grid-template-columns:repeat(3,1fr)}}
  .t-rv{background:color-mix(in srgb, var(--cit-ink) 78%, black);border:1px solid color-mix(in srgb, var(--cit-accent) 25%, transparent);border-radius:6px;padding:26px}
  .t-rv p{font-size:15px;opacity:.92;margin-bottom:16px;line-height:1.6}
  .t-rv strong{font-size:13.5px;text-transform:uppercase;letter-spacing:1px}
  .t-rv em{display:block;font-style:normal;font-size:12px;color:color-mix(in srgb, var(--cit-accent) 60%, #fff);margin-top:2px}
  .t-sample{margin-top:30px;font-size:12.5px;opacity:.55;letter-spacing:.5px;text-align:center}

  /* CONTACT split */
  .t-congrid{display:grid;gap:40px;grid-template-columns:1fr;margin-top:44px;align-items:center}
  @media(min-width:920px){.t-congrid{grid-template-columns:1fr 1fr}}
  .t-conline{display:flex;align-items:center;gap:16px;padding:16px 0;border-top:1px solid var(--cit-line);font-size:16px}
  .t-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .t-conline b{font-family:var(--cit-font-display);font-weight:800;font-size:16px;text-transform:uppercase;letter-spacing:.5px}
  .t-conline small{color:var(--cit-muted);font-size:13px;display:block;text-transform:none;letter-spacing:0}
  .t-conphoto img{border-radius:6px;box-shadow:var(--cit-shadow);aspect-ratio:4/3;object-fit:cover;width:100%}

  /* FOOTER — dark, multi-column */
  .t-foot{background:color-mix(in srgb, var(--cit-ink) 92%, black);color:color-mix(in srgb, var(--cit-bg) 60%, transparent);padding:64px 0 30px}
  .t-footgrid{display:grid;grid-template-columns:1fr;gap:36px;padding-bottom:44px;border-bottom:1px solid color-mix(in srgb, var(--cit-bg) 12%, transparent)}
  @media(min-width:800px){.t-footgrid{grid-template-columns:2fr 1fr 1fr}}
  .t-foot .t-fbrand{font-family:var(--cit-font-display);font-weight:800;font-size:20px;text-transform:uppercase;letter-spacing:1px;color:color-mix(in srgb, var(--cit-bg) 92%, #fff)}
  .t-foot p{font-size:14.5px;margin-top:12px;max-width:320px}
  .t-foot h4{color:color-mix(in srgb, var(--cit-bg) 92%, #fff);font-size:12px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:14px;font-family:var(--cit-font-body)}
  .t-foot a{display:block;font-size:14.5px;padding:5px 0;transition:.25s}
  .t-foot a:hover{color:color-mix(in srgb, var(--cit-accent) 60%, #fff)}
  .t-footlegal{display:flex;justify-content:space-between;gap:16px;padding-top:24px;font-size:12.5px;flex-wrap:wrap}

  /* MOBILE fixed CTA bar */
  .t-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:80;background:color-mix(in srgb, var(--cit-ink) 94%, black);padding:12px 16px;gap:12px;align-items:center;justify-content:space-between}
  .t-mobcta span{color:color-mix(in srgb, var(--cit-bg) 92%, #fff);font-size:14px}
  .t-mobcta b{color:color-mix(in srgb, var(--cit-accent) 60%, #fff)}
  .t-mobcta .cit-btn{padding:11px 20px}
  @media(max-width:700px){.t-mobcta{display:flex}body{padding-bottom:64px}}
`;

// Tiny behavior layer: the side dot-nav gets its active state marked while scrolling.
// Progressive enhancement only — the dots are plain anchors and work without it.
const PARALLAX_JS = `
  (function(){
    var dots=[].slice.call(document.querySelectorAll('.t-dots a'));if(!dots.length||!('IntersectionObserver' in window))return;
    var secs=dots.map(function(a){return document.querySelector(a.getAttribute('href'))}).filter(Boolean);
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){var i=secs.indexOf(e.target);
        dots.forEach(function(d,j){d.classList.toggle('on',j===i)});}
    })},{threshold:.4});
    secs.forEach(function(s){io.observe(s)});
  })();
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderParallax(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["alpine-bold"]!;
  const heroCopy = copyOf(recipe, "hero");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const heroPhoto = photos[0]?.url;
  const bandAUrl = photos[2]?.url ?? photos[1]?.url;
  const bandBUrl = photos[4]?.url ?? photos[3]?.url;
  const contactPhoto = photos[photos.length - 1]?.url ?? "";

  const h1 = heroCopy.lead || data.tagline || data.name;
  // The hero sub prefers the intro's first sentence: the tagline is saved for the quote band
  // below (the reference's "alt-quote" move), so the same line never appears twice.
  const sub =
    firstSentence(data.intro) || (data.tagline && data.tagline !== h1 ? data.tagline : "");
  const hasContact = Boolean(data.contact.email || data.contact.phone);
  const ratingStat = data.stats?.find((s) => s.icon === "star");

  // -- hero panel (photo → fixed bg; none → token gradient) -------------------
  const heroPanelOpen = heroPhoto
    ? `<header class="t-par" id="top" style="background-image:url('${esc(heroPhoto)}')">`
    : `<header class="t-par t-par--flat" id="top">`;
  const hero = `${heroPanelOpen}
    <div class="t-bar">
      <a class="t-brand" href="#top">${esc(data.name)}</a>
      ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalás")}</a>` : ""}
    </div>
    <div class="t-wrap t-parin t-hero">
      ${heroCopy.eyebrow ? `<span class="t-herotag">${esc(heroCopy.eyebrow)}</span>` : ""}
      <h1>${accented(h1, heroCopy.accent)}</h1>
      ${sub ? `<p class="t-herosub">${esc(sub)}</p>` : ""}
      <div class="t-heroctas">
        ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        ${photos.length ? `<a class="cit-btn cit-btn-ghost" href="#t-gallery">${T(data, "Galéria")}</a>` : ""}
      </div>
    </div>
  </header>`;

  // -- sticky booking dock (the canonical hydrated slot, dressed dark) --------
  const dock = `<div class="t-dock" id="t-book">
    ${bookingSlot(data, phase)}
  </div>`;

  // -- intro + real-stat band -------------------------------------------------
  const statBand = data.stats?.length
    ? `<div class="t-stats">${data.stats
        .map(
          (s) =>
            `<div class="t-stat"><b>${esc(s.value)}${s.icon === "star" ? starIcon() : ""}</b><span>${esc(s.label)}</span></div>`,
        )
        .join("")}</div>`
    : "";
  const intro =
    data.intro || featCopy.title || statBand
      ? `<section class="t-sec" id="t-about">
    <div class="t-wrap">
      ${featCopy.eyebrow ? `<p class="t-eyebrow">${esc(featCopy.eyebrow)}</p>` : ""}
      ${featCopy.title ? `<h2>${accented(featCopy.title, featCopy.accent)}</h2>` : ""}
      ${data.intro ? `<p class="t-lead">${esc(data.intro)}</p>` : ""}
      ${statBand}
    </div>
  </section>`
      : "";

  // -- image band A (quote text only from REAL copy/tagline — never invented) --
  const bandAText =
    data.tagline && data.tagline !== h1 && data.tagline !== sub
      ? data.tagline
      : galCopy.title ?? "";
  const bandA =
    photos.length || bandAText
      ? `<section class="t-par t-par--band${bandAUrl ? "" : " t-par--flat"}"${bandAUrl ? ` style="background-image:url('${esc(bandAUrl)}')"` : ""}>
    <div class="t-wrap t-parin">${bandAText ? `<p class="t-quote">${esc(bandAText)}</p>` : ""}</div>
  </section>`
      : "";

  // -- alternating feature rows: photo + REAL highlight pairs (max 4) ---------
  const rowCount = photos.length ? Math.min(4, data.highlights.length) : 0;
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const h = data.highlights[i]!;
    const p = photos[(i + 1) % photos.length]!;
    return `<div class="t-row${i % 2 ? " t-flip" : ""}">
        <div class="t-rowimg"><img src="${esc(p.url)}" alt="${esc(p.alt)}"></div>
        <div class="t-rowbody">
          ${iconSvg(matchIcon(h))}
          <h3>${esc(h)}</h3>
          ${hasContact ? `<a href="#cit-enquiry">${ctaLabel(data, phase)}</a>` : ""}
        </div>
      </div>`;
  }).join("\n      ");
  const features = rowCount
    ? `<section class="t-sec" id="t-features">
    <div class="t-wrap">
      <p class="t-eyebrow">${T(data, "Kiemelt")}</p>
      <h2>${T(data, "Ami nálunk vár")}</h2>
      ${rows}
    </div>
  </section>`
    : "";

  // -- amenity grid (all real highlights as a compact checklist) --------------
  const amen = data.highlights.length
    ? `<section class="t-sec" id="t-services" style="padding-top:0">
    <div class="t-wrap">
      <p class="t-eyebrow">${T(data, "Szolgáltatások")}</p>
      <h2>${T(data, "Egy pillantásra")}</h2>
      <div class="t-amen">
        ${data.highlights
          .slice(0, 8)
          .map((h) => `<div class="t-am">${iconSvg(matchIcon(h))}<p>${esc(h)}</p></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- image band B -----------------------------------------------------------
  const bandB =
    photos.length >= 2
      ? `<section class="t-par t-par--band${bandBUrl ? "" : " t-par--flat"}"${bandBUrl ? ` style="background-image:url('${esc(bandBUrl)}')"` : ""}>
    <div class="t-wrap t-parin">${revCopy.title ? `<p class="t-quote">${esc(revCopy.title)}</p>` : ""}</div>
  </section>`
      : "";

  // -- gallery grid (img-based, lightbox runtime hook) ------------------------
  const gallery = photos.length
    ? `<section class="t-sec" id="t-gallery">
    <div class="t-wrap">
      ${galCopy.eyebrow ? `<p class="t-eyebrow">${esc(galCopy.eyebrow)}</p>` : `<p class="t-eyebrow">${T(data, "Galéria")}</p>`}
      <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Nézzen körül")}</h2>
      <div class="t-gal" data-cit-module="gallery">
        ${photos
          .slice(0, 6)
          .map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews (real → cards; none → MOCK: marked sample, LIVE: dropped §B.17) --
  const realReviews = data.reviews && data.reviews.length ? data.reviews : null;
  const reviewsData = realReviews;
  const starCount = honestStarCount(data);
  const starRowHtml = starCount ? `<div class="t-stars">${starIcon().repeat(starCount)}</div>` : "";
  const reviews = reviewsData
    ? `<section class="t-sec t-rev" id="t-reviews" data-cit-module="reviews">
    <div class="t-wrap">
      ${revCopy.eyebrow ? `<p class="t-eyebrow">${esc(revCopy.eyebrow)}</p>` : `<p class="t-eyebrow">${T(data, "Vendégeink")}</p>`}
      ${
        ratingStat
          ? `<div class="t-revscore"><b>${esc(ratingStat.value)}</b><div>${starRowHtml}<span>${esc(ratingStat.label)}</span></div></div>`
          : `<h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégeink mondták")}</h2>`
      }
      <div class="t-revgrid">
        ${reviewsData
          .map(
            (r) =>
              `<div class="t-rv"><p>${esc(r.quote)}</p><strong>${esc(r.author)}</strong>${r.meta ? `<em>${esc(r.meta)}</em>` : ""}</div>`,
          )
          .join("\n        ")}
      </div>
      ${realReviews ? "" : `<div class="t-sample">${T(data, "Minta — ide az Ön vendégeinek értékelései kerülnek.")}</div>`}
    </div>
  </section>`
    : "";

  // -- contact ----------------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="t-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="t-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="t-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const contact = contactLines
    ? `<section class="t-sec" id="t-contact">
    <div class="t-wrap">
      <p class="t-eyebrow">${T(data, "Kapcsolat")}</p>
      <h2>${T(data, "Így talál meg minket")}</h2>
      <div class="t-congrid">
        <div>
        ${contactLines}
        ${hasContact ? `<a class="cit-btn" style="margin-top:26px" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        </div>
        ${contactPhoto ? `<div class="t-conphoto"><img src="${esc(contactPhoto)}" alt="${T(data, "{name} környezete", { name: esc(data.name) })}"></div>` : ""}
      </div>
    </div>
  </section>`
    : "";

  // -- footer -----------------------------------------------------------------
  const footer = `<footer class="t-foot">
    <div class="t-wrap">
      <div class="t-footgrid">
        <div>
          <span class="t-fbrand">${esc(data.name)}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Felfedezés")}</h4>
          ${features ? `<a href="#t-features">${T(data, "Kiemelt")}</a>` : ""}
          ${amen ? `<a href="#t-services">${T(data, "Szolgáltatások")}</a>` : ""}
          ${gallery ? `<a href="#t-gallery">${T(data, "Galéria")}</a>` : ""}
          ${reviews ? `<a href="#t-reviews">${T(data, "Vélemények")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Információ")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
          ${contact ? `<a href="#t-contact">${T(data, "Kapcsolat")}</a>` : ""}
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="t-footlegal">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
      </div>
    </div>
  </footer>`;

  // -- side dot nav (anchors to the sections that actually rendered) ----------
  const dotTargets: ReadonlyArray<readonly [string, string, string]> = [
    ["#top", T(data, "Kezdőlap"), hero],
    ["#t-about", T(data, "Bemutatkozás"), intro],
    ["#t-features", T(data, "Kiemelt"), features],
    ["#t-services", T(data, "Szolgáltatások"), amen],
    ["#t-gallery", T(data, "Galéria"), gallery],
    ["#t-reviews", T(data, "Vélemények"), reviews],
    ["#t-contact", T(data, "Kapcsolat"), contact],
  ];
  const dots = `<nav class="t-dots" aria-label="${T(data, "Szekciók")}">
    ${dotTargets
      .filter(([, , html]) => Boolean(html))
      .map(([href, label], i) => `<a href="${href}"${i === 0 ? ` class="on"` : ""} aria-label="${esc(label)}"></a>`)
      .join("\n    ")}
  </nav>`;

  const mobcta = hasContact
    ? `<div class="t-mobcta">
    <span>${ratingStat ? `<b>${esc(ratingStat.value)}</b> · ${esc(ratingStat.label)}` : esc(data.name)}</span>
    <a class="cit-btn" href="#cit-enquiry">${ctaLabel(data, phase)}</a>
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
${PARALLAX_CSS}
  </style>
</head>
<body class="cit-tpl-parallax">
    ${dots}
    ${hero}
    ${dock}
    ${intro}
    ${bandA}
    ${features}
    ${amen}
    ${slotMarker("showcase")}
    ${bandB}
    ${gallery}
    ${reviews}
    ${slotMarker("trust")}
    ${slotMarker("practical")}
    ${contact}
    ${slotMarker("closing")}
    ${footer}
    ${mobcta}
    <script>${PARALLAX_JS}</script>
</body>
</html>`;
}

export const PARALLAX: ArtTemplate = {
  id: "parallax",
  label: "Parallax — immerzív panelek, pont-nav, stat-sáv (referencia 06)", // i18n-exempt: operator-facing (console template picker)
  // The reference's own alpine identity first, then a cool-fresh and a dark-luxury spread.
  skins: ["alpine-bold", "coastal-fresh", "night-azure-gold"],
  render: renderParallax,
};
