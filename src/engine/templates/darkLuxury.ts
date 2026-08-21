// "dark-luxury" art template (ADR-0027) — the 03-dark-luxury reference direction (Silva).
// Cinematic dark resort page: fixed letterspaced nav over a 100svh photo hero with a deep
// scrim, a dark booking dock overlapping the hero bottom, a horizontally scrolling photo
// showcase strip (photo cards, NOT fabricated suites), a hairline-grid "ritual" amenity
// board, a centered quote band, an offset (staggered) gallery, a contact split with a photo
// overlay card, a rich multi-column footer and a mobile fixed CTA bar. All styling dresses
// from the 11 --cit-* tokens (+ color-mix derivations); the curated skins are all dark with
// a gold/brass accent, so the reference's brass glow comes from --cit-accent.

import { iconSvg, matchIcon, starIcon } from "../icons.js";
import { slotMarker } from "../moduleSections.js";
import { SAMPLE_REVIEWS } from "../primitives.js";
import type { Recipe, RenderPhase, SiteData } from "../recipe.js";
import { renderSeoHead, seoTitle } from "../seo.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "../skins.js";
import {
  accented,
  bookingSlot,
  copyOf,
  esc,
  firstSentence,
  honestStarCount,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const DARK_LUXURY_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);background:var(--cit-bg);color:var(--cit-ink);font-size:16px;line-height:1.7;font-weight:300}
  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  h1,h2,h3{font-family:var(--cit-font-display);font-weight:400;line-height:1.2}
  h1 em,h2 em{font-style:normal;color:var(--cit-accent)}
  .t-wrap{width:min(1200px,92%);margin:0 auto}
  .t-eyebrow{font-size:12px;letter-spacing:5px;text-transform:uppercase;color:var(--cit-accent);margin-bottom:16px;font-weight:500}
  .t-sec{padding:104px 0}
  .t-sec h2{font-size:clamp(30px,4.5vw,50px);margin-bottom:18px}
  .t-lead{color:var(--cit-muted);max-width:640px}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);padding:15px 34px;font-size:13px;letter-spacing:2.5px;text-transform:uppercase;font-weight:600;border:1px solid var(--cit-accent);cursor:pointer;transition:.25s}
  .cit-btn:hover{filter:brightness(1.12)}
  .t-btn-ghost{background:transparent;border-color:var(--cit-line);color:var(--cit-ink)}
  .t-btn-ghost:hover{border-color:var(--cit-accent);color:var(--cit-accent);filter:none}
  .cit-btn-disabled{opacity:.55;pointer-events:none}

  /* nav — fixed over the hero, gradient veil condensing to a solid dark bar on scroll */
  .t-nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 0;background:linear-gradient(180deg,color-mix(in srgb,var(--cit-bg) 85%,transparent),transparent);transition:background .3s,padding .3s}
  .t-nav.t-solid{background:color-mix(in srgb,var(--cit-bg) 95%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--cit-line);padding:12px 0}
  .t-nav .t-wrap{display:flex;align-items:center;justify-content:space-between;gap:20px}
  .t-brand{font-family:var(--cit-font-display);font-size:19px;letter-spacing:4px;text-transform:uppercase;color:var(--cit-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .t-menu{display:none;gap:32px;align-items:center}
  .t-menu a{color:var(--cit-muted);font-size:13px;letter-spacing:2px;text-transform:uppercase;transition:color .2s}
  .t-menu a:hover{color:var(--cit-accent)}
  .t-resbtn{display:none;border:1px solid var(--cit-accent);color:var(--cit-accent);padding:11px 26px;font-size:12px;letter-spacing:2.5px;text-transform:uppercase;transition:.25s;white-space:nowrap}
  .t-resbtn:hover{background:var(--cit-accent);color:var(--cit-on-accent)}
  @media(min-width:960px){.t-menu{display:flex}.t-resbtn{display:inline-block}}

  /* hero — 100svh photo + bottom-heavy scrim; photo-less (live policy) → token gradient */
  .t-hero{position:relative;height:100svh;min-height:640px;display:flex;align-items:flex-end;overflow:hidden}
  .t-herobg{position:absolute;inset:0;background-size:cover;background-position:center;transform:scale(1.05);animation:t-drift 16s ease-out forwards}
  @keyframes t-drift{to{transform:scale(1)}}
  .t-herobg--flat{background:linear-gradient(165deg,color-mix(in srgb,var(--cit-accent) 26%,var(--cit-bg)),var(--cit-bg) 62%);animation:none;transform:none}
  .t-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--cit-bg) 30%,transparent),color-mix(in srgb,var(--cit-bg) 92%,transparent) 92%)}
  .t-heroin{position:relative;z-index:2;padding-bottom:130px}
  .t-kicker{font-size:12px;letter-spacing:6px;text-transform:uppercase;color:var(--cit-accent);margin-bottom:22px}
  .t-hero h1{font-size:clamp(42px,7vw,86px);max-width:14ch;margin-bottom:22px}
  .t-herosub{max-width:520px;color:color-mix(in srgb,var(--cit-ink) 72%,var(--cit-muted));margin-bottom:34px}
  .t-heroctas{display:flex;gap:16px;flex-wrap:wrap}
  @media(max-width:700px){.t-heroin{padding-bottom:96px}}

  /* booking dock — dark panel overlapping the hero bottom, hosting the canonical slot */
  .t-dock{position:relative;z-index:5;margin-top:-72px}
  .t-dockin{background:var(--cit-surface);border:1px solid var(--cit-line);box-shadow:var(--cit-shadow)}
  .t-dockin .cit-book{background:none;border:0;box-shadow:none}
  .t-dockin .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.5rem clamp(1.1rem,3vw,2rem)}
  .t-dockin .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.3rem;color:var(--cit-ink);letter-spacing:.5px}

  /* showcase — section head + real-stat row + horizontally scrolling photo cards */
  .t-stats{display:flex;gap:38px;margin-top:34px;flex-wrap:wrap}
  .t-stat b{font-family:var(--cit-font-display);font-size:36px;font-weight:400;color:var(--cit-ink);display:flex;align-items:baseline;gap:8px}
  .t-stat b svg{width:18px;height:18px;color:var(--cit-accent)}
  .t-stat span{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--cit-muted)}
  .t-strip{display:flex;gap:22px;overflow-x:auto;padding:46px 4% 26px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-color:var(--cit-accent) var(--cit-surface)}
  .t-strip::-webkit-scrollbar{height:4px}
  .t-strip::-webkit-scrollbar-track{background:var(--cit-surface)}
  .t-strip::-webkit-scrollbar-thumb{background:var(--cit-accent)}
  .t-card{min-width:min(340px,84vw);scroll-snap-align:start;background:var(--cit-surface);border:1px solid var(--cit-line)}
  .t-card .t-im{height:250px;overflow:hidden}
  .t-card .t-im img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
  .t-card:hover .t-im img{transform:scale(1.06)}
  .t-card figcaption{padding:22px 24px;display:flex;gap:16px;align-items:center;border-top:1px solid var(--cit-line)}
  .t-card .t-no{font-family:var(--cit-font-display);color:var(--cit-accent);font-size:14px;letter-spacing:2px;flex:none}
  .t-card figcaption p{font-size:14.5px;color:var(--cit-muted);line-height:1.55}
  .t-card .t-rule{flex:1;height:1px;background:linear-gradient(90deg,var(--cit-accent),var(--cit-line))}

  /* rituals — hairline-grid amenity board (real highlights; icon is decorative dressing) */
  .t-rituals{display:grid;gap:1px;background:var(--cit-line);border:1px solid var(--cit-line);grid-template-columns:1fr;margin-top:50px}
  @media(min-width:760px){.t-rituals.t-cols2{grid-template-columns:repeat(2,1fr)}.t-rituals.t-cols3{grid-template-columns:repeat(3,1fr)}}
  .t-rit{background:var(--cit-bg);padding:38px 32px;transition:background .3s}
  .t-rit:hover{background:var(--cit-surface)}
  .t-rit .t-no{display:flex;justify-content:space-between;align-items:center;font-family:var(--cit-font-display);color:var(--cit-accent);font-size:14px;letter-spacing:2px;margin-bottom:18px}
  .t-rit .t-no svg{width:26px;height:26px;color:var(--cit-accent)}
  .t-rit h3{font-size:20px;font-weight:400}

  /* quote band — centered serif blockquote, honest star row, extra quotes in a grid */
  .t-quote{background:var(--cit-surface);border-top:1px solid var(--cit-line);border-bottom:1px solid var(--cit-line);text-align:center}
  .t-qstars{display:flex;justify-content:center;gap:5px;margin-bottom:20px}
  .t-qstars svg{width:18px;height:18px;color:var(--cit-accent)}
  .t-qscore{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--cit-muted);margin-bottom:30px}
  .t-quote blockquote{font-family:var(--cit-font-display);font-size:clamp(22px,3.2vw,34px);max-width:22ch;margin:0 auto 24px;line-height:1.45;color:var(--cit-ink)}
  .t-quote cite{font-style:normal;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--cit-muted)}
  .t-qgrid{display:grid;gap:26px;grid-template-columns:1fr;margin-top:56px;text-align:left}
  @media(min-width:820px){.t-qgrid{grid-template-columns:1fr 1fr}}
  .t-q{background:var(--cit-bg);border:1px solid var(--cit-line);padding:30px 28px}
  .t-q p{font-family:var(--cit-font-display);font-size:18px;line-height:1.5;margin-bottom:16px}
  .t-q footer{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--cit-muted)}
  .t-sample{margin-top:36px;font-size:12.5px;color:var(--cit-muted);letter-spacing:.5px}

  /* offset gallery — staggered 3:4 figures, desaturated until hover */
  .t-gal{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:50px;padding-bottom:26px}
  @media(min-width:860px){.t-gal{grid-template-columns:repeat(4,1fr)}}
  .t-gal figure{overflow:hidden;aspect-ratio:3/4}
  .t-gal figure:nth-child(even){transform:translateY(26px)}
  .t-gal img{width:100%;height:100%;object-fit:cover;filter:saturate(.85);transition:transform .6s,filter .4s}
  .t-gal figure:hover img{transform:scale(1.05);filter:saturate(1.05)}

  /* contact — photo overlay card + contact lines */
  .t-dest{display:grid;gap:30px;grid-template-columns:1fr;margin-top:44px}
  @media(min-width:920px){.t-dest{grid-template-columns:1.1fr .9fr}}
  .t-dmap{position:relative;min-height:360px;border:1px solid var(--cit-line);overflow:hidden}
  .t-dmap img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .t-ov{position:absolute;inset:0;background:color-mix(in srgb,var(--cit-bg) 55%,transparent);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;gap:6px}
  .t-ov svg{width:30px;height:30px;color:var(--cit-accent);margin-bottom:6px}
  .t-ov strong{font-family:var(--cit-font-display);font-size:22px;font-weight:400}
  .t-ov span{color:color-mix(in srgb,var(--cit-ink) 80%,var(--cit-muted));font-size:15px}
  .t-conline{display:flex;align-items:center;gap:16px;padding:18px 0;border-top:1px solid var(--cit-line)}
  .t-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .t-conline b{font-family:var(--cit-font-display);font-weight:400;font-size:18px}
  .t-conline small{color:var(--cit-muted);font-size:13px;display:block}

  /* footer — rich multi-column, hairline separations */
  .t-foot{border-top:1px solid var(--cit-line);padding:64px 0 30px;color:var(--cit-muted);font-size:14px}
  .t-fgrid{display:grid;gap:36px;grid-template-columns:1fr;margin-bottom:44px}
  @media(min-width:760px){.t-fgrid{grid-template-columns:2fr 1fr 1fr}}
  .t-foot .t-brand{font-size:18px}
  .t-foot p{max-width:320px;margin-top:14px}
  .t-foot h4{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--cit-ink);margin-bottom:16px;font-weight:500}
  .t-foot a{display:block;padding:4px 0;transition:.25s}
  .t-foot a:hover{color:var(--cit-accent)}
  .t-foot li{list-style:none;padding:4px 0}
  .t-fbot{border-top:1px solid var(--cit-line);padding-top:24px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:12px;letter-spacing:1px}

  /* mobile fixed CTA bar */
  .t-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:60;background:color-mix(in srgb,var(--cit-bg) 96%,transparent);backdrop-filter:blur(10px);border-top:1px solid var(--cit-line);padding:12px 16px;gap:12px;align-items:center;justify-content:space-between}
  .t-mobcta span{font-size:14px;color:var(--cit-ink)}
  .t-mobcta b{color:var(--cit-accent)}
  .t-mobcta .cit-btn{padding:11px 20px}
  @media(max-width:700px){.t-mobcta{display:flex}body{padding-bottom:64px}}
`;

// Tiny behavior layer: nav condenses on scroll. Progressive enhancement only — the page is
// complete without it (the fixed nav's gradient veil keeps it readable over the hero).
const DARK_LUXURY_JS = `
  (function(){var n=document.querySelector('.t-nav');if(!n)return;
  addEventListener('scroll',function(){n.classList.toggle('t-solid',scrollY>60)},{passive:true});})();
`;

/** Roman numerals for the ritual board markers (max 6 highlights). */
const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderDarkLuxury(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["cellar-dark-wine"]!;
  const heroCopy = copyOf(recipe, "hero");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const heroPhoto = photos[0]?.url ?? "";
  // Photo card spread: with >4 photos the strip skips the hero shot; the offset gallery takes
  // the tail; the contact overlay card takes the last one. Degrades gracefully down to 0.
  const stripPhotos = photos.length > 4 ? photos.slice(1, 5) : photos.slice(0, 4);
  const galPhotos = photos.slice(-4);
  const contactPhoto = photos[photos.length - 1]?.url ?? "";

  const h1 = heroCopy.lead || data.tagline || data.name;
  const sub = data.tagline && data.tagline !== h1 ? data.tagline : firstSentence(data.intro);
  const hasContact = Boolean(data.contact.email || data.contact.phone);
  const ratingStat = data.stats?.find((s) => s.icon === "star");
  const highlights = data.highlights.slice(0, 6);

  // -- reviews data first (nav + footer links depend on whether the band renders) ----------
  // §B.17: real reviews → the band; none → MOCK shows the marked sample, LIVE drops the band.
  const realReviews = data.reviews && data.reviews.length ? data.reviews : null;
  const reviewsData = realReviews ?? (phase === "mock" ? SAMPLE_REVIEWS : null);
  const starCount = honestStarCount(data);

  // -- nav ---------------------------------------------------------------------------------
  const menuLinks = [
    stripPhotos.length ? `<a href="#t-showcase">${T(data, "Betekintés")}</a>` : "",
    highlights.length ? `<a href="#t-services">${T(data, "Szolgáltatások")}</a>` : "",
    galPhotos.length ? `<a href="#t-gallery">${T(data, "Galéria")}</a>` : "",
    reviewsData ? `<a href="#t-reviews">${T(data, "Vélemények")}</a>` : "",
    hasContact || data.contact.address ? `<a href="#t-contact">${T(data, "Elérhetőség")}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="t-nav">
    <div class="t-wrap">
      <a class="t-brand" href="#top">${esc(data.name)}</a>
      <div class="t-menu">
        ${menuLinks}
      </div>
      ${hasContact ? `<a class="t-resbtn" href="#cit-enquiry">${T(data, "Érdeklődés")}</a>` : ""}
    </div>
  </nav>`;

  // -- hero --------------------------------------------------------------------------------
  const heroBg = heroPhoto
    ? `<div class="t-herobg" style="background-image:url('${esc(heroPhoto)}')"></div>`
    : `<div class="t-herobg t-herobg--flat"></div>`;
  const hero = `<header class="t-hero" id="top">
    ${heroBg}
    <div class="t-wrap t-heroin">
      ${heroCopy.eyebrow ? `<p class="t-kicker">${esc(heroCopy.eyebrow)}</p>` : ""}
      <h1>${accented(h1, heroCopy.accent)}</h1>
      ${sub ? `<p class="t-herosub">${esc(sub)}</p>` : ""}
      <div class="t-heroctas">
        ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Érdeklődés")}</a>` : ""}
        ${galPhotos.length ? `<a class="cit-btn t-btn-ghost" href="#t-gallery">${T(data, "Fedezd fel")}</a>` : ""}
      </div>
    </div>
  </header>`;

  // -- booking dock (canonical hydrated slot inside the dark panel) ------------------------
  const dock = `<div class="t-dock t-wrap">
    <div class="t-dockin">
      ${bookingSlot(data)}
    </div>
  </div>`;

  // -- showcase — intro head + real stats + scrolling photo cards (NO fabricated suites) ---
  const statRow = data.stats?.length
    ? `<div class="t-stats">${data.stats
        .map(
          (s) =>
            `<div class="t-stat"><b>${esc(s.value)} ${s.icon === "star" ? starIcon() : ""}</b><span>${esc(s.label)}</span></div>`,
        )
        .join("")}</div>`
    : "";
  const showcase =
    stripPhotos.length || data.intro
      ? `<section class="t-sec" id="t-showcase" style="padding-bottom:60px">
    <div class="t-wrap">
      <p class="t-eyebrow">${featCopy.eyebrow ? esc(featCopy.eyebrow) : T(data, "Betekintés")}</p>
      <h2>${featCopy.title ? accented(featCopy.title, featCopy.accent) : esc(data.name)}</h2>
      ${data.intro ? `<p class="t-lead">${esc(data.intro)}</p>` : ""}
      ${statRow}
    </div>
    ${
      stripPhotos.length
        ? `<div class="t-strip">
      ${stripPhotos
        .map((p, i) => {
          // A scraper-generated alt ("<name> — N. kép") is a11y-only filler — the visible
          // caption then stays a quiet numbered marker with a brass rule (no noise text).
          const meaningful = !/—\s*\d+\.\s*kép\s*$/.test(p.alt);
          const cap = meaningful ? `<p>${esc(p.alt)}</p>` : `<span class="t-rule"></span>`;
          return `<figure class="t-card"><div class="t-im"><img src="${esc(p.url)}" alt="${esc(p.alt)}"></div><figcaption><span class="t-no">0${i + 1}</span>${cap}</figcaption></figure>`;
        })
        .join("\n      ")}
    </div>`
        : ""
    }
  </section>`
      : "";

  // -- rituals — hairline amenity board on the real highlights -----------------------------
  const ritualCols = highlights.length === 4 || highlights.length === 2 ? "t-cols2" : "t-cols3";
  const rituals = highlights.length
    ? `<section class="t-sec" id="t-services" style="padding-top:60px">
    <div class="t-wrap">
      <p class="t-eyebrow">${T(data, "Szolgáltatások")}</p>
      <h2>${T(data, "Amit a hely kínál")}</h2>
      <div class="t-rituals ${ritualCols}">
        ${highlights
          .map(
            (h, i) =>
              `<div class="t-rit"><p class="t-no"><span>${ROMAN[i] ?? ""}.</span>${iconSvg(matchIcon(h))}</p><h3>${esc(h)}</h3></div>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- quote band (all quotes visible — no JS-hidden carousel content) ---------------------
  const lead = reviewsData?.[0];
  const rest = reviewsData ? reviewsData.slice(1) : [];
  const reviews =
    reviewsData && lead
      ? `<section class="t-sec t-quote" id="t-reviews" data-cit-module="reviews">
    <div class="t-wrap">
      ${revCopy.eyebrow ? `<p class="t-eyebrow">${esc(revCopy.eyebrow)}</p>` : ""}
      ${starCount ? `<div class="t-qstars">${starIcon().repeat(starCount)}</div>` : ""}
      ${ratingStat ? `<p class="t-qscore">${esc(ratingStat.value)} · ${esc(ratingStat.label)}</p>` : ""}
      <blockquote>„${esc(lead.quote)}"</blockquote>
      <cite>— ${esc(lead.author)}${lead.meta ? ` · ${esc(lead.meta)}` : ""}</cite>
      ${
        rest.length
          ? `<div class="t-qgrid">
        ${rest
          .map(
            (r) =>
              `<div class="t-q"><p>„${esc(r.quote)}"</p><footer>— ${esc(r.author)}${r.meta ? ` · ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>`
          : ""
      }
      ${realReviews ? "" : `<div class="t-sample">${T(data, "Minta — ide a valós vendégértékeléseid kerülnek.")}</div>`}
    </div>
  </section>`
      : "";

  // -- offset gallery ----------------------------------------------------------------------
  const gallery = galPhotos.length
    ? `<section class="t-sec" id="t-gallery">
    <div class="t-wrap">
      ${galCopy.eyebrow ? `<p class="t-eyebrow">${esc(galCopy.eyebrow)}</p>` : `<p class="t-eyebrow">${T(data, "Galéria")}</p>`}
      <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Galéria")}</h2>
      <div class="t-gal" data-cit-module="gallery">
        ${galPhotos
          .map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- contact -----------------------------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="t-conline">${CONTACT_ICONS.phone}<div><b><a href="tel:${esc(c.phone.replace(/\s+/g, ""))}">${esc(c.phone)}</a></b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
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
  const overlayCard = contactPhoto
    ? `<div class="t-dmap">
        <img src="${esc(contactPhoto)}" alt="${T(data, "{name} környezete", { name: esc(data.name) })}">
        <div class="t-ov">
          ${CONTACT_ICONS.location}
          <strong>${esc(data.name)}</strong>
          ${c.address ? `<span>${esc(c.address)}</span>` : ""}
        </div>
      </div>`
    : "";
  const contact = contactLines
    ? `<section class="t-sec" id="t-contact" style="padding-top:0">
    <div class="t-wrap">
      <p class="t-eyebrow">${T(data, "Elérhetőség")}</p>
      <h2>${T(data, "Kapcsolat")}</h2>
      <div class="t-dest">
        ${overlayCard}
        <div>
        ${contactLines}
        ${hasContact ? `<a class="cit-btn" style="margin-top:26px" href="#cit-enquiry">${T(data, "Érdeklődés")}</a>` : ""}
        </div>
      </div>
    </div>
  </section>`
    : "";

  // -- footer ------------------------------------------------------------------------------
  const footContact = [
    c.phone ? `<li>${esc(c.phone)}</li>` : "",
    c.email ? `<li>${esc(c.email)}</li>` : "",
    c.address ? `<li>${esc(c.address)}</li>` : "",
  ]
    .filter(Boolean)
    .join("");
  const footer = `<footer class="t-foot">
    <div class="t-wrap">
      <div class="t-fgrid">
        <div>
          <span class="t-brand">${esc(data.name)}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Felfedezés")}</h4>
          ${stripPhotos.length ? `<a href="#t-showcase">${T(data, "Betekintés")}</a>` : ""}
          ${highlights.length ? `<a href="#t-services">${T(data, "Szolgáltatások")}</a>` : ""}
          ${galPhotos.length ? `<a href="#t-gallery">${T(data, "Galéria")}</a>` : ""}
          ${reviewsData ? `<a href="#t-reviews">${T(data, "Vélemények")}</a>` : ""}
        </div>
        <div>
          <h4>${footContact ? T(data, "Kapcsolat") : T(data, "Információ")}</h4>
          ${footContact || `<a href="#top">${T(data, "Kezdőlap")}</a>`}
        </div>
      </div>
      <div class="t-fbot">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        <span><a href="#">${T(data, "Adatkezelés")}</a></span>
      </div>
    </div>
  </footer>`;

  const mobcta = hasContact
    ? `<div class="t-mobcta">
    <span>${ratingStat ? `<b>${esc(ratingStat.value)}</b> · ${esc(ratingStat.label)}` : esc(data.name)}</span>
    <a class="cit-btn" href="#cit-enquiry">${T(data, "Érdeklődés")}</a>
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
${DARK_LUXURY_CSS}
  </style>
</head>
<body class="cit-tpl-dark-luxury">
    ${nav}
    ${hero}
    ${dock}
    ${showcase}
    ${rituals}
    ${slotMarker("showcase")}
    ${reviews}
    ${slotMarker("trust")}
    ${gallery}
    ${slotMarker("practical")}
    ${contact}
    ${slotMarker("closing")}
    ${footer}
    ${mobcta}
    <script>${DARK_LUXURY_JS}</script>
</body>
</html>`;
}

export const DARK_LUXURY: ArtTemplate = {
  id: "dark-luxury",
  label: "Sötét luxus — cinematic, brass akcent (referencia 03)", // i18n-exempt: operator-facing (console template picker)
  // All-dark curated skins: the reference's brass glow comes from the gold --cit-accent.
  skins: ["cellar-dark-wine", "immersive-dark", "night-azure-gold"],
  render: renderDarkLuxury,
};
