// "fullbleed" art template (ADR-0027) — the 01-fullbleed-glass reference direction.
// Full-height photo hero under a fixed overlay nav, the glass booking bar floated over the
// hero bottom, dropcap intro with a framed portrait, amenity cards, mosaic gallery, dark
// review band, contact split, rich dark footer, mobile fixed CTA bar. All styling dresses
// from the 11 --cit-* tokens (+ color-mix derivations) — see templateKit.ts for contracts.

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
  T,
  type ArtTemplate,
} from "../templateKit.js";
const FULLBLEED_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.65}
  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  /* Template-native module contract (ADR-0057): the shared module sections adopt this
     template's OWN section rhythm — centred display headings, 100px breathing room,
     the same card radius as .t-amencard — so a paid module reads as part of the page,
     not a grey appendix bolted to the bottom. */
  body.cit-tpl-fullbleed{
    --cit-modsec-py:100px;
    --cit-modsec-maxw:1180px;
    --cit-modsec-px:28px;
    --cit-modsec-divider:0;
    --cit-modsec-head-align:center;
    --cit-modsec-head-mb:44px;
    --cit-modsec-head-size:clamp(30px,4.5vw,50px);
    --cit-modsec-head-weight:500;
    --cit-modsec-card-radius:var(--cit-radius);
    --cit-modsec-card-pad:22px 24px}
  /* Centred header wants its section-level intro copy and rating badge centred too —
     but NOT the notes that live inside a form (child combinator, not descendant). */
  .cit-tpl-fullbleed .cit-modsec__in > .cit-modsec__note{text-align:center;max-width:640px;margin-left:auto;margin-right:auto}
  .cit-tpl-fullbleed .cit-modsec__badge{text-align:center}
  .t-wrap{max-width:1180px;margin:0 auto;padding:0 28px}
  .t-eyebrow{font-size:12px;letter-spacing:5px;text-transform:uppercase;color:var(--cit-accent);font-weight:600}
  .t-sechead{text-align:center;max-width:720px;margin:0 auto 56px}
  .t-sechead h2{font-family:var(--cit-font-display);font-weight:500;font-size:clamp(30px,4.5vw,50px);line-height:1.12;margin-top:14px}
  .t-sechead h2 em{font-style:italic;color:var(--cit-accent)}
  section.t-sec{padding:100px 0}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);padding:15px 34px;letter-spacing:2.5px;text-transform:uppercase;font-size:13px;font-weight:600;border-radius:4px;border:1px solid var(--cit-accent);transition:.3s;cursor:pointer}
  .cit-btn:hover{filter:brightness(1.12);transform:translateY(-2px);box-shadow:0 12px 28px color-mix(in srgb, var(--cit-accent) 35%, transparent)}
  .cit-btn-ghost{background:transparent;border-color:rgba(255,255,255,.55);color:#fff}
  .cit-btn-ghost:hover{border-color:#fff;filter:none;box-shadow:none}
  .cit-btn-disabled{opacity:.55;pointer-events:none}

  /* nav — overlay over the photo hero, condensing to a dark bar on scroll */
  .t-nav{position:fixed;inset:0 0 auto 0;z-index:50;transition:.35s;padding:22px 0}
  .t-nav .t-wrap{display:flex;align-items:center;justify-content:space-between}
  .t-nav.t-scrolled{background:color-mix(in srgb, var(--cit-ink) 86%, black);backdrop-filter:blur(14px);padding:12px 0;box-shadow:0 6px 30px rgba(0,0,0,.25)}
  .t-brand{font-family:var(--cit-font-display);font-size:22px;color:#fff;letter-spacing:.5px}
  .t-navlinks{display:flex;gap:34px;align-items:center}
  .t-navlinks a{color:rgba(255,255,255,.85);font-size:13px;letter-spacing:2.5px;text-transform:uppercase;font-weight:500;transition:.25s}
  .t-navlinks a:hover{color:var(--cit-accent)}
  .t-navlinks .cit-btn{padding:11px 24px}
  @media(max-width:860px){.t-navlinks a:not(.cit-btn){display:none}}

  /* hero — full height, real photo + scrim; photo-less (live policy) → token gradient */
  .t-hero{position:relative;height:100svh;min-height:660px;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;overflow:hidden}
  .t-herobg{position:absolute;inset:0;background-size:cover;background-position:center;transform:scale(1.06);animation:t-drift 18s ease-out forwards}
  .t-herobg--flat{background:linear-gradient(160deg, var(--cit-ink), color-mix(in srgb, var(--cit-accent) 45%, var(--cit-ink)));animation:none;transform:none}
  @keyframes t-drift{to{transform:scale(1)}}
  .t-herobg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,8,6,.35),rgba(10,8,6,.5) 55%,rgba(10,8,6,.9))}
  .t-heroin{position:relative;z-index:2;padding:0 24px;max-width:900px}
  .t-heroin .t-eyebrow{color:color-mix(in srgb, var(--cit-accent) 55%, #fff)}
  .t-hero h1{font-family:var(--cit-font-display);font-weight:500;font-size:clamp(42px,7.2vw,96px);line-height:1.04;margin:20px auto 22px;max-width:15ch}
  .t-hero h1 em{font-style:italic;color:color-mix(in srgb, var(--cit-accent) 55%, #fff)}
  .t-herosub{font-size:clamp(16px,2vw,19px);color:rgba(255,255,255,.85);max-width:560px;margin:0 auto 38px}
  .t-heroctas{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}

  /* glass booking bar overlapping the hero bottom (the signature move) */
  .t-bookwrap{position:relative;z-index:5;margin-top:-72px}
  .t-glass{background:color-mix(in srgb, var(--cit-surface) 74%, transparent);backdrop-filter:blur(18px);border:1px solid color-mix(in srgb, #fff 60%, transparent);border-radius:var(--cit-radius);box-shadow:0 24px 60px color-mix(in srgb, var(--cit-ink) 30%, transparent)}
  .t-glass .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.5rem clamp(1.25rem,4vw,2rem)}
  .t-glass .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.25rem;color:var(--cit-ink)}
  .t-glass .cit-book{background:none;border:0;box-shadow:none}

  /* intro — dropcap editorial + framed portrait + real-stat row */
  .t-intro{padding-top:110px}
  .t-introgrid{display:grid;grid-template-columns:1.05fr .95fr;gap:70px;align-items:center}
  .t-introcopy h2{font-family:var(--cit-font-display);font-weight:500;font-size:clamp(30px,4vw,46px);line-height:1.14;margin:14px 0 24px}
  .t-introcopy h2 em{font-style:italic;color:var(--cit-accent)}
  .t-introcopy p{color:color-mix(in srgb, var(--cit-ink) 78%, var(--cit-muted));font-size:17px}
  .t-introcopy p::first-letter{font-family:var(--cit-font-display);font-size:64px;float:left;line-height:.9;padding:6px 12px 0 0;color:var(--cit-accent)}
  .t-stats{display:flex;gap:38px;margin-top:36px;flex-wrap:wrap}
  .t-stat b{font-family:var(--cit-font-display);font-size:38px;font-weight:500;color:var(--cit-ink);display:flex;align-items:baseline;gap:8px}
  .t-stat b svg{width:20px;height:20px;color:var(--cit-accent)}
  .t-stat span{font-size:12.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--cit-muted)}
  .t-introphoto{position:relative}
  .t-introphoto img{border-radius:var(--cit-radius);box-shadow:var(--cit-shadow);aspect-ratio:4/5;object-fit:cover;width:100%}
  .t-introphoto::before{content:"";position:absolute;inset:24px -24px -24px 24px;border:1px solid var(--cit-accent);opacity:.55;border-radius:var(--cit-radius);z-index:-1}
  @media(max-width:900px){.t-introgrid{grid-template-columns:1fr;gap:46px}}

  /* amenity cards */
  .t-amen{background:var(--cit-surface);border-top:1px solid var(--cit-line);border-bottom:1px solid var(--cit-line)}
  .t-amengrid{display:grid;grid-template-columns:repeat(4,1fr);gap:26px}
  .t-amencard{background:var(--cit-bg);border:1px solid var(--cit-line);border-radius:var(--cit-radius);padding:34px 28px;transition:.35s}
  .t-amencard:hover{transform:translateY(-6px);box-shadow:var(--cit-shadow);border-color:var(--cit-accent)}
  .t-amencard svg{width:34px;height:34px;color:var(--cit-accent);margin-bottom:18px}
  .t-amencard p{font-size:15.5px;color:color-mix(in srgb, var(--cit-ink) 82%, var(--cit-muted));line-height:1.5}
  @media(max-width:960px){.t-amengrid{grid-template-columns:1fr 1fr}}
  @media(max-width:560px){.t-amengrid{grid-template-columns:1fr}}

  /* mosaic gallery */
  .t-mosaic{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:230px;gap:14px}
  .t-mosaic figure{position:relative;border-radius:10px;overflow:hidden}
  .t-mosaic img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
  .t-mosaic figure:hover img{transform:scale(1.06)}
  .t-mosaic figure:nth-child(1){grid-column:span 2;grid-row:span 2}
  .t-mosaic figure:nth-child(4){grid-row:span 2}
  .t-mosaic figure::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,color-mix(in srgb, var(--cit-ink) 40%, transparent));opacity:0;transition:.35s}
  .t-mosaic figure:hover::after{opacity:1}
  @media(max-width:760px){.t-mosaic{grid-template-columns:1fr 1fr;grid-auto-rows:190px}.t-mosaic figure:nth-child(1){grid-column:span 2}}

  /* review band — dark, giant decorative quote, star row */
  .t-rev{background:color-mix(in srgb, var(--cit-ink) 94%, black);color:color-mix(in srgb, var(--cit-bg) 92%, #fff);position:relative;overflow:hidden}
  .t-rev::before{content:"\\201E";font-family:var(--cit-font-display);position:absolute;font-size:520px;line-height:1;color:color-mix(in srgb, var(--cit-accent) 10%, transparent);top:-60px;left:4%}
  .t-revhead{text-align:center;margin-bottom:60px;position:relative}
  .t-revscore{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:18px}
  .t-revscore b{font-family:var(--cit-font-display);font-size:56px;font-weight:500;color:color-mix(in srgb, var(--cit-accent) 55%, #fff)}
  .t-stars{display:flex;gap:4px}
  .t-stars svg{width:20px;height:20px;color:color-mix(in srgb, var(--cit-accent) 55%, #fff)}
  .t-revscore span{color:color-mix(in srgb, var(--cit-bg) 60%, transparent);font-size:14px}
  .t-revgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;position:relative}
  .t-revcard{background:color-mix(in srgb, var(--cit-ink) 82%, black);border:1px solid color-mix(in srgb, var(--cit-accent) 22%, transparent);border-radius:var(--cit-radius);padding:34px 30px}
  .t-revcard p{font-family:var(--cit-font-display);font-size:18.5px;line-height:1.5;font-style:italic}
  .t-revcard footer{margin-top:22px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:color-mix(in srgb, var(--cit-bg) 55%, transparent)}
  .t-sample{text-align:center;margin-top:34px;font-size:12.5px;color:color-mix(in srgb, var(--cit-bg) 45%, transparent);letter-spacing:.5px}
  @media(max-width:860px){.t-revgrid{grid-template-columns:1fr}}

  /* contact split */
  .t-congrid{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}
  .t-concopy h2{font-family:var(--cit-font-display);font-weight:500;font-size:clamp(30px,4vw,46px);line-height:1.14;margin:14px 0 20px}
  .t-concopy > p{color:var(--cit-muted);font-size:16.5px;margin-bottom:30px}
  .t-conline{display:flex;align-items:center;gap:16px;padding:18px 0;border-top:1px solid var(--cit-line);font-size:16px}
  .t-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .t-conline b{font-family:var(--cit-font-display);font-weight:500;font-size:18px}
  .t-conline small{color:var(--cit-muted);font-size:13.5px;display:block}
  .t-conphoto img{border-radius:var(--cit-radius);box-shadow:var(--cit-shadow);aspect-ratio:4/3;object-fit:cover;width:100%}
  @media(max-width:860px){.t-congrid{grid-template-columns:1fr}}

  /* footer — dark, multi-column */
  .t-foot{background:color-mix(in srgb, var(--cit-ink) 94%, black);color:color-mix(in srgb, var(--cit-bg) 65%, transparent);padding:70px 0 34px}
  .t-footgrid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:50px;padding-bottom:46px;border-bottom:1px solid color-mix(in srgb, var(--cit-bg) 12%, transparent)}
  .t-foot .t-brand{font-size:24px}
  .t-foot p{font-size:14.5px;margin-top:14px;max-width:340px}
  .t-foot h4{color:color-mix(in srgb, var(--cit-bg) 92%, #fff);font-size:12px;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:18px}
  .t-foot a{display:block;font-size:14.5px;padding:5px 0;transition:.25s}
  .t-foot a:hover{color:color-mix(in srgb, var(--cit-accent) 55%, #fff)}
  .t-footlegal{display:flex;justify-content:space-between;gap:20px;padding-top:26px;font-size:13px;flex-wrap:wrap}
  @media(max-width:760px){.t-footgrid{grid-template-columns:1fr}}

  /* mobile fixed CTA bar */
  .t-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:60;background:color-mix(in srgb, var(--cit-ink) 95%, black);backdrop-filter:blur(10px);padding:12px 16px;gap:12px;align-items:center;justify-content:space-between}
  .t-mobcta span{color:color-mix(in srgb, var(--cit-bg) 92%, #fff);font-size:14px}
  .t-mobcta b{color:color-mix(in srgb, var(--cit-accent) 55%, #fff)}
  .t-mobcta .cit-btn{padding:11px 22px}
  @media(max-width:700px){.t-mobcta{display:flex}body{padding-bottom:64px}}
`;

// Tiny behavior layer: nav condenses on scroll. Progressive enhancement only — the page is
// complete without it (fixed nav stays overlay; the hero scrim keeps it readable).
const FULLBLEED_JS = `
  (function(){var n=document.querySelector('.t-nav');if(!n)return;
  addEventListener('scroll',function(){n.classList.toggle('t-scrolled',scrollY>40)},{passive:true});})();
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderFullbleed(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["editorial-warm"]!;
  const heroCopy = copyOf(recipe, "hero");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const heroPhoto = photos[0]?.url ?? "";
  const introPhoto = photos[1]?.url ?? photos[0]?.url ?? "";
  const contactPhoto = photos[3]?.url ?? photos[photos.length - 1]?.url ?? "";

  const h1 = heroCopy.lead || data.tagline || data.name;
  const sub = data.tagline && data.tagline !== h1 ? data.tagline : firstSentence(data.intro);
  const hasContact = Boolean(data.contact.email || data.contact.phone);
  const ratingStat = data.stats?.find((s) => s.icon === "star");
  // A #t-reviews anchor exists whenever the reviews area renders: real reviews (t-rev),
  // or the reviews-pending stand-in (shown once a Google rating is known).
  const hasReviewsAnchor = Boolean(
    (data.reviews && data.reviews.length) || data.rating || data.googleRating,
  );

  // -- nav ------------------------------------------------------------------
  const navLinks = [
    data.highlights.length ? `<a href="#t-services">${T(data, "Szolgáltatások")}</a>` : "",
    photos.length ? `<a href="#t-gallery">${T(data, "Galéria")}</a>` : "",
    // Only link to reviews when a #t-reviews anchor will actually exist (real review
    // section, or the reviews-pending stand-in that renders once a rating is known) —
    // otherwise the nav points at a section that is not on the page.
    hasReviewsAnchor ? `<a href="#t-reviews">${T(data, "Vélemények")}</a>` : "",
    hasContact ? `<a href="#t-contact">${T(data, "Kapcsolat")}</a>` : "",
    hasContact ? `<a class="cit-btn" href="#cit-enquiry">${ctaLabel(data)}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="t-nav">
    <div class="t-wrap">
      <a class="t-brand" href="#top">${esc(data.name)}</a>
      <div class="t-navlinks">
        ${navLinks}
      </div>
    </div>
  </nav>`;

  // -- hero -----------------------------------------------------------------
  const heroBg = heroPhoto
    ? `<div class="t-herobg" style="background-image:url('${esc(heroPhoto)}')"></div>`
    : `<div class="t-herobg t-herobg--flat"></div>`;
  const hero = `<header class="t-hero" id="top">
    ${heroBg}
    <div class="t-heroin">
      ${heroCopy.eyebrow ? `<div class="t-eyebrow">${esc(heroCopy.eyebrow)}</div>` : ""}
      <h1>${accented(h1, heroCopy.accent)}</h1>
      ${sub ? `<p class="t-herosub">${esc(sub)}</p>` : ""}
      <div class="t-heroctas">
        ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        ${photos.length ? `<a class="cit-btn cit-btn-ghost" href="#t-gallery">${T(data, "Nézzen körül")}</a>` : ""}
      </div>
    </div>
  </header>`;

  // -- glass booking bar (canonical hydrated slot inside the glass container) --
  const bookbar = `<div class="t-bookwrap t-wrap">
    <div class="t-glass">
      ${bookingSlot(data, phase)}
    </div>
  </div>`;

  // -- intro ----------------------------------------------------------------
  const statRow = data.stats?.length
    ? `<div class="t-stats">${data.stats
        .map(
          (s) =>
            `<div class="t-stat"><b>${esc(s.value)} ${s.icon === "star" ? starIcon() : ""}</b><span>${esc(s.label)}</span></div>`,
        )
        .join("")}</div>`
    : "";
  const intro =
    data.intro || featCopy.title
      ? `<section class="t-sec t-intro">
    <div class="t-wrap t-introgrid">
      <div class="t-introcopy">
        ${featCopy.eyebrow ? `<div class="t-eyebrow">${esc(featCopy.eyebrow)}</div>` : ""}
        ${featCopy.title ? `<h2>${accented(featCopy.title, featCopy.accent)}</h2>` : ""}
        ${data.intro ? `<p>${esc(data.intro)}</p>` : ""}
        ${statRow}
      </div>
      ${introPhoto ? `<div class="t-introphoto"><img src="${esc(introPhoto)}" alt="${esc(data.name)}"></div>` : ""}
    </div>
  </section>`
      : "";

  // -- amenities (real highlights only; icon is decorative dressing) --------
  const amen = data.highlights.length
    ? `<section class="t-sec t-amen" id="t-services">
    <div class="t-wrap">
      <div class="t-sechead">
        <div class="t-eyebrow">${T(data, "Szolgáltatások")}</div>
        <h2>${T(data, "Amiért érdemes betérni")}</h2>
      </div>
      <div class="t-amengrid">
        ${data.highlights
          .slice(0, 4)
          .map((h) => `<div class="t-amencard">${iconSvg(matchIcon(h))}<p>${esc(h)}</p></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- gallery mosaic -------------------------------------------------------
  const gallery = photos.length
    ? `<section class="t-sec" id="t-gallery">
    <div class="t-wrap">
      <div class="t-sechead">
        ${galCopy.eyebrow ? `<div class="t-eyebrow">${esc(galCopy.eyebrow)}</div>` : ""}
        <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Galéria")}</h2>
      </div>
      <div class="t-mosaic" data-cit-module="gallery">
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
  // §B.17: the star row mirrors the REAL rating (rounded) — never a flattering 5-of-5 default.
  const starCount = data.rating ? Math.max(1, Math.min(5, Math.round(data.rating.value))) : 0;
  const stars5 = starCount ? `<div class="t-stars">${starIcon().repeat(starCount)}</div>` : "";
  const reviews = reviewsData
    ? `<section class="t-sec t-rev" id="t-reviews" data-cit-module="reviews">
    <div class="t-wrap">
      <div class="t-revhead">
        ${revCopy.eyebrow ? `<div class="t-eyebrow">${esc(revCopy.eyebrow)}</div>` : ""}
        ${
          ratingStat
            ? `<div class="t-revscore"><b>${esc(ratingStat.value)}</b><div>${stars5}<span>${esc(ratingStat.label)}</span></div></div>`
            : revCopy.title
              ? `<h2 style="font-family:var(--cit-font-display);font-weight:500;font-size:clamp(30px,4.5vw,50px);line-height:1.12;margin-top:14px">${accented(revCopy.title, revCopy.accent)}</h2>`
              : ""
        }
      </div>
      <div class="t-revgrid">
        ${reviewsData
          .map(
            (r) =>
              `<div class="t-revcard"><p>${esc(r.quote)}</p><footer>— ${esc(r.author)}${r.meta ? `, ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${realReviews ? "" : `<div class="t-sample">${T(data, "Minta — ide a valós vendégértékeléseid kerülnek.")}</div>`}
    </div>
  </section>`
    : "";

  // -- contact --------------------------------------------------------------
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
    .join("\n      ");
  const contact = contactLines
    ? `<section class="t-sec" id="t-contact">
    <div class="t-wrap t-congrid">
      <div class="t-concopy">
        <div class="t-eyebrow">${T(data, "Kapcsolat")}</div>
        <h2>${T(data, "Megközelítés és kapcsolat")}</h2>
        ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        ${contactLines}
        ${hasContact ? `<a class="cit-btn" style="margin-top:26px" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
      </div>
      ${contactPhoto ? `<div class="t-conphoto"><img src="${esc(contactPhoto)}" alt="${T(data, "{name} környezete", { name: esc(data.name) })}"></div>` : ""}
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="t-foot">
    <div class="t-wrap">
      <div class="t-footgrid">
        <div>
          <span class="t-brand">${esc(data.name)}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Oldal")}</h4>
          ${data.highlights.length ? `<a href="#t-services">${T(data, "Szolgáltatások")}</a>` : ""}
          ${photos.length ? `<a href="#t-gallery">${T(data, "Galéria")}</a>` : ""}
          ${hasReviewsAnchor ? `<a href="#t-reviews">${T(data, "Vélemények")}</a>` : ""}
          ${contactLines ? `<a href="#t-contact">${T(data, "Kapcsolat")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Információ")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="t-footlegal">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
      </div>
    </div>
  </footer>`;

  const mobcta = hasContact
    ? `<div class="t-mobcta">
    <span>${ratingStat ? `<b>${esc(ratingStat.value)}</b> · ${esc(ratingStat.label)}` : esc(data.name)}</span>
    <a class="cit-btn" href="#cit-enquiry">${ctaLabel(data)}</a>
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
${FULLBLEED_CSS}
  </style>
</head>
<body class="cit-tpl-fullbleed">
    ${nav}
    ${hero}
    ${bookbar}
    ${intro}
    ${amen}
    ${slotMarker("showcase")}
    ${gallery}
    ${reviews}
    ${slotMarker("trust")}
    ${slotMarker("practical")}
    ${contact}
    ${slotMarker("closing")}
    ${footer}
    ${mobcta}
    <script>${FULLBLEED_JS}</script>
</body>
</html>`;
}

export const FULLBLEED: ArtTemplate = {
  id: "fullbleed",
  label: "Fullbleed — teljes-képernyős hero, üveg foglaló-sáv (referencia 01)", // i18n-exempt: operator-facing (console template picker)
  // Warm→cool spread over the LIGHT skins (the template's dark bands derive from --cit-ink).
  skins: ["tuscan-terracotta", "coastal-fresh", "stone-masonry", "sand-cream-airy", "editorial-magazine"],
  render: renderFullbleed,
};
