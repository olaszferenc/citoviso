// "card-sidebar" art template (ADR-0027) — the 04-card-sidebar reference direction.
// Airbnb-style listing page: compact sticky header, photo-mosaic masthead (first photo
// large), serif title row with honest stars, a two-column body (dropcap intro, iconed
// amenity list, review summary + cards, contact block) next to a STICKY elevated booking
// card, rich soft footer and a fixed mobile booking bar. All styling dresses from the
// 11 --cit-* tokens (+ color-mix derivations) — see templateKit.ts for contracts.

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

const CARD_SIDEBAR_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);font-size:15.5px;line-height:1.65}

  /* shared module sections (.cit-modsec) themed to the listing rhythm (ADR-0057):
     left-aligned heads, 1140px column, soft rounded surface cards */
  body.cit-tpl-card-sidebar{
    --cit-modsec-py:44px;
    --cit-modsec-maxw:1140px;
    --cit-modsec-px:22px;
    --cit-modsec-divider:1px solid var(--cit-line);
    --cit-modsec-head-align:left;
    --cit-modsec-head-mb:18px;
    --cit-modsec-head-size:23px;
    --cit-modsec-head-weight:600;
    --cit-modsec-card-radius:var(--cit-radius);
    --cit-modsec-card-pad:22px}

  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1140px;margin:0 auto;padding:0 22px}
  h1,h2,h3{font-family:var(--cit-font-display);font-weight:600;line-height:1.22}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);font-weight:700;font-size:14px;padding:11px 20px;border-radius:calc(var(--cit-radius)*0.7);border:1px solid var(--cit-accent);cursor:pointer;transition:.25s}
  .cit-btn:hover{filter:brightness(1.1);transform:translateY(-1px);box-shadow:0 8px 22px color-mix(in srgb, var(--cit-accent) 30%, transparent)}
  .stars{display:inline-flex;gap:2px;color:var(--cit-accent)}
  .stars svg{width:15px;height:15px}

  /* compact sticky header */
  .top{position:sticky;top:0;z-index:100;background:color-mix(in srgb, var(--cit-bg) 94%, transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--cit-line);transition:box-shadow .3s}
  .top.top-scrolled{box-shadow:0 6px 24px color-mix(in srgb, var(--cit-ink) 10%, transparent)}
  .top-in{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0}
  .brand{display:flex;align-items:center;gap:10px;font-family:var(--cit-font-display);font-weight:600;font-size:19px}
  .brand .mark{width:34px;height:34px;flex:none;background:var(--cit-accent);color:var(--cit-on-accent);border-radius:calc(var(--cit-radius)*0.6);display:grid;place-items:center}
  .brand .mark svg{width:19px;height:19px}
  .top-nav{display:none;gap:26px;list-style:none;font-size:13.5px;font-weight:600}
  .top-nav a{color:var(--cit-muted);transition:.2s}
  .top-nav a:hover{color:var(--cit-ink)}
  @media(min-width:900px){.top-nav{display:flex}}

  /* photo mosaic masthead (first photo large, Airbnb-style) */
  .mast{padding-top:20px}
  .mosaic{position:relative;display:grid;gap:8px;grid-template-columns:1fr 1fr;border-radius:calc(var(--cit-radius)*1.2);overflow:hidden}
  .mosaic figure{overflow:hidden;min-height:150px}
  .mosaic figure:first-child{grid-column:1/-1;min-height:250px}
  .mosaic figure:nth-child(n+4){display:none}
  .mosaic img{width:100%;height:100%;object-fit:cover;transition:transform .45s ease}
  .mosaic figure:hover img{transform:scale(1.05)}
  @media(min-width:800px){
    .mosaic figure{min-height:0}
    .mosaic figure:first-child{grid-column:auto}
    .mosaic figure:nth-child(n+4){display:block}
    .mos-5{grid-template-columns:2fr 1fr 1fr;grid-template-rows:218px 218px}
    .mos-5 figure:first-child{grid-row:span 2}
    .mos-4{grid-template-columns:2fr 1fr 1fr;grid-template-rows:218px 218px}
    .mos-4 figure:first-child{grid-row:span 2}
    .mos-4 figure:last-child{grid-column:span 2}
    .mos-3{grid-template-columns:2fr 1fr;grid-template-rows:218px 218px}
    .mos-3 figure:first-child{grid-row:span 2}
    .mos-2{grid-template-columns:2fr 1fr;grid-template-rows:400px}
    .mos-1{grid-template-columns:1fr;grid-template-rows:440px}
  }
  .ph-count{position:absolute;right:14px;bottom:14px;display:inline-flex;align-items:center;gap:8px;background:color-mix(in srgb, var(--cit-surface) 92%, transparent);border:1px solid var(--cit-line);border-radius:calc(var(--cit-radius)*0.6);padding:7px 13px;font-size:12.5px;font-weight:700;box-shadow:var(--cit-shadow)}
  .ph-count svg{width:15px;height:15px;color:var(--cit-accent)}
  .mosaic-flat{height:250px;border-radius:calc(var(--cit-radius)*1.2);background:linear-gradient(160deg, var(--cit-ink), color-mix(in srgb, var(--cit-accent) 45%, var(--cit-ink)))}

  /* title row under the mosaic */
  .title-row{padding:26px 0 6px}
  .title-row .eyebrow{font-size:12px;letter-spacing:3.5px;text-transform:uppercase;color:var(--cit-accent);font-weight:700;margin-bottom:10px}
  .title-row h1{font-size:clamp(28px,4vw,42px);margin-bottom:8px}
  .title-row .sub{font-size:clamp(15.5px,1.8vw,18px);color:color-mix(in srgb, var(--cit-ink) 72%, var(--cit-muted));max-width:62ch;margin-bottom:12px}
  .meta-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;font-size:14px;color:var(--cit-muted)}
  .meta-row .rate{display:inline-flex;align-items:center;gap:8px;color:var(--cit-ink);font-weight:700}
  .meta-row .addr{display:inline-flex;align-items:center;gap:7px}
  .meta-row .addr svg{width:15px;height:15px;color:var(--cit-accent)}

  /* two-column layout: content + sticky booking card */
  .layout{display:grid;gap:48px;grid-template-columns:1fr;padding:26px 0 80px}
  @media(min-width:960px){.layout{grid-template-columns:1.55fr 1fr;align-items:start}}
  .blk{padding:30px 0;border-bottom:1px solid var(--cit-line)}
  .blk:first-child{padding-top:6px}
  .blk:last-child{border-bottom:none}
  .blk .eyebrow{font-size:11.5px;letter-spacing:3px;text-transform:uppercase;color:var(--cit-accent);font-weight:700;margin-bottom:8px}
  .blk h2{font-size:23px;margin-bottom:18px}
  .blk h2 em{font-style:italic;color:var(--cit-accent)}

  /* dropcap intro */
  .intro-copy{font-size:16.5px;color:color-mix(in srgb, var(--cit-ink) 80%, var(--cit-muted))}
  .intro-copy::first-letter{font-family:var(--cit-font-display);font-size:56px;float:left;line-height:.9;padding:5px 11px 0 0;color:var(--cit-accent)}

  /* amenity list */
  .amen-grid{display:grid;grid-template-columns:1fr;gap:16px}
  @media(min-width:640px){.amen-grid{grid-template-columns:1fr 1fr}}
  .amen-i{display:flex;gap:13px;align-items:flex-start;font-size:15.5px;line-height:1.5}
  .amen-i svg{width:23px;height:23px;flex:none;color:var(--cit-accent);margin-top:1px}

  /* reviews */
  .rev-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .rev-head .stars svg{width:19px;height:19px}
  .rev-head b{font-family:var(--cit-font-display);font-size:28px;font-weight:600}
  .rev-head span{color:var(--cit-muted);font-size:14.5px}
  .rev-grid{display:grid;grid-template-columns:1fr;gap:18px;margin-top:22px}
  @media(min-width:640px){.rev-grid{grid-template-columns:1fr 1fr}}
  .rev-i{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);padding:22px;transition:.3s}
  .rev-i:hover{transform:translateY(-3px);box-shadow:var(--cit-shadow)}
  .rev-i .who{display:flex;gap:12px;align-items:center;margin-bottom:12px}
  .rev-i .who .av{width:42px;height:42px;flex:none;border-radius:50%;background:color-mix(in srgb, var(--cit-accent) 14%, var(--cit-surface));color:var(--cit-accent);display:grid;place-items:center;font-family:var(--cit-font-display);font-weight:600;font-size:18px}
  .rev-i .who strong{display:block;font-size:15px}
  .rev-i .who span{font-size:12.5px;color:var(--cit-muted)}
  .rev-i p{font-size:14.5px;color:color-mix(in srgb, var(--cit-ink) 82%, var(--cit-muted))}
  .rev-sample{margin-top:18px;font-size:12.5px;color:var(--cit-muted);letter-spacing:.3px}

  /* location / contact */
  .con-lines{display:grid;gap:0;margin-bottom:6px}
  .con-line{display:flex;align-items:center;gap:15px;padding:15px 0;border-top:1px solid var(--cit-line);font-size:15.5px}
  .con-line:first-child{border-top:none}
  .con-line svg{width:21px;height:21px;flex:none;color:var(--cit-accent)}
  .con-line b{font-family:var(--cit-font-display);font-weight:600;font-size:17px;display:block}
  .con-line small{color:var(--cit-muted);font-size:13px;display:block}
  .con-photo{margin-top:14px;border-radius:var(--cit-radius);overflow:hidden;box-shadow:var(--cit-shadow)}
  .con-photo img{width:100%;aspect-ratio:16/9;object-fit:cover}

  /* sticky booking card (the reference's signature move) */
  .side{position:relative}
  .bcard{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:calc(var(--cit-radius)*1.2);box-shadow:0 10px 34px color-mix(in srgb, var(--cit-ink) 14%, transparent);padding:24px}
  @media(min-width:960px){.bcard{position:sticky;top:86px}}
  .bc-head{display:flex;align-items:baseline;gap:9px;padding-bottom:16px;margin-bottom:18px;border-bottom:1px solid var(--cit-line)}
  .bc-head .stars{position:relative;top:1px}
  .bc-head b{font-family:var(--cit-font-display);font-size:22px;font-weight:600}
  .bc-head span{font-size:13.5px;color:var(--cit-muted)}
  .bc-name{font-family:var(--cit-font-display);font-size:19px;font-weight:600;padding-bottom:16px;margin-bottom:18px;border-bottom:1px solid var(--cit-line)}
  .bc-line{display:flex;align-items:center;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--cit-line);font-size:14.5px}
  .bc-line svg{width:19px;height:19px;flex:none;color:var(--cit-accent)}
  .bc-line b{display:block;font-weight:700}
  .bc-line small{display:block;color:var(--cit-muted);font-size:12.5px}
  /* the canonical booking slot melts into the card (the card is the elevated surface) */
  .bcard .cit-book{background:none;border:0;box-shadow:none;padding:0}
  .cit-tpl-card-sidebar .bcard .cit-book--bar{grid-template-columns:1fr}
  .cit-tpl-card-sidebar .bcard .cit-book--bar .cit-book__title{grid-column:auto}
  .cit-tpl-card-sidebar .bcard .cit-book--bar .cit-book__fields{grid-column:auto;grid-template-columns:1fr 1fr;align-items:start}
  .cit-tpl-card-sidebar .bcard .cit-book--bar .cit-book__fields .cit-book__field:last-child{grid-column:1/-1}
  .cit-tpl-card-sidebar .bcard .cit-book--bar .cit-book__submit{grid-column:auto;height:auto;white-space:normal;width:100%}
  .cit-tpl-card-sidebar .bcard .cit-book--bar .cit-book__note{grid-column:auto}
  /* no-JS fallback markup of the slot, styled to sit inside the card */
  .bcard .cit-enquiry-bar-inner{display:grid;gap:14px;justify-items:start}
  .bcard .cit-enquiry-bar-title{font-family:var(--cit-font-display);font-size:18px;font-weight:600}
  .bcard .cit-btn-disabled{opacity:.55;pointer-events:none}

  /* mobile fixed booking bar (the reference's mobile pattern) */
  .mob-book{position:fixed;left:0;right:0;bottom:0;z-index:120;background:color-mix(in srgb, var(--cit-surface) 97%, transparent);backdrop-filter:blur(8px);border-top:1px solid var(--cit-line);padding:11px 16px;padding-bottom:max(11px,env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:space-between;gap:12px}
  .mob-book .mb-rate{display:flex;align-items:center;gap:8px;font-weight:800;font-size:16px}
  .mob-book .mb-rate .stars svg{width:14px;height:14px}
  .mob-book small{display:block;font-weight:400;font-size:12px;color:var(--cit-muted)}
  @media(min-width:960px){.mob-book{display:none}}
  @media(max-width:959px){body{padding-bottom:74px}}

  /* rich soft footer */
  .foot{background:var(--cit-surface);border-top:1px solid var(--cit-line);padding:52px 0 30px;font-size:14px;color:var(--cit-muted)}
  .f-grid{display:grid;grid-template-columns:1fr;gap:34px;padding-bottom:34px;border-bottom:1px solid var(--cit-line)}
  @media(min-width:760px){.f-grid{grid-template-columns:2fr 1fr 1fr}}
  .f-brand{display:flex;align-items:center;gap:10px;font-family:var(--cit-font-display);font-weight:600;font-size:20px;color:var(--cit-ink)}
  .f-brand .mark{width:30px;height:30px;flex:none;background:var(--cit-accent);color:var(--cit-on-accent);border-radius:calc(var(--cit-radius)*0.5);display:grid;place-items:center}
  .f-brand .mark svg{width:16px;height:16px}
  .f-grid p{margin-top:12px;max-width:340px}
  .f-grid h4{font-size:11.5px;letter-spacing:2.5px;text-transform:uppercase;color:var(--cit-ink);margin-bottom:14px}
  .f-grid a,.f-grid .f-line{display:block;padding:4px 0;transition:.2s}
  .f-grid a:hover{color:var(--cit-accent)}
  .f-legal{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:22px;font-size:13px}
`;

// Tiny behavior layer: the sticky header gains a shadow after scrolling. Progressive
// enhancement only — the page is complete without it.
const CARD_SIDEBAR_JS = `
  (function(){var h=document.querySelector('.top');if(!h)return;
  addEventListener('scroll',function(){h.classList.toggle('top-scrolled',scrollY>10)},{passive:true});})();
`;

const BRAND_MARK = iconSvg("location");
const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderCardSidebar(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["editorial-warm"]!;
  const heroCopy = copyOf(recipe, "hero");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const c = data.contact;
  const hasContact = Boolean(c.email || c.phone);

  // §B.17 honest rating facts: value/count come ONLY from real data (stats/rating).
  const ratingStat = data.stats?.find((s) => s.icon === "star");
  const ratingValue =
    ratingStat?.value ?? (data.rating ? String(data.rating.value).replace(".", ",") : "");
  const ratingCount = data.rating?.count;
  const starCount = honestStarCount(data);
  const stars = starCount
    ? `<span class="stars">${starIcon().repeat(starCount)}</span>`
    : "";

  // Reviews: real → cards; none → MOCK shows marked sample, LIVE drops the block (§B.17).
  const realReviews = data.reviews && data.reviews.length ? data.reviews : null;
  const reviewsData = realReviews;

  // -- compact sticky header ------------------------------------------------
  const navLinks = [
    photos.length ? `<li><a href="#photos">${T(data, "Fotók")}</a></li>` : "",
    data.intro ? `<li><a href="#about">${T(data, "Bemutatkozás")}</a></li>` : "",
    data.highlights.length ? `<li><a href="#amenities">${T(data, "Felszereltség")}</a></li>` : "",
    reviewsData ? `<li><a href="#reviews">${T(data, "Vélemények")}</a></li>` : "",
    c.phone || c.email || c.address ? `<li><a href="#contact">${T(data, "Kapcsolat")}</a></li>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const header = `<header class="top">
    <div class="wrap top-in">
      <a class="brand" href="#top"><span class="mark">${BRAND_MARK}</span>${esc(data.name)}</a>
      <ul class="top-nav">
        ${navLinks}
      </ul>
      <a class="cit-btn" href="#cit-enquiry">${ctaLabel(data, phase)}</a>
    </div>
  </header>`;

  // -- photo mosaic masthead (0 photos → token gradient band) ---------------
  const mosaicPhotos = photos.slice(0, 5);
  const mosaic = mosaicPhotos.length
    ? `<div class="mosaic mos-${mosaicPhotos.length}" data-cit-module="gallery"${
        galCopy.title ? ` aria-label="${esc(galCopy.title)}"` : ""
      }>
      ${mosaicPhotos
        .map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`)
        .join("\n      ")}
      <span class="ph-count">${iconSvg("view")}${T(data, "{n} fotó", { n: photos.length })}</span>
    </div>`
    : `<div class="mosaic-flat" aria-hidden="true"></div>`;

  // -- title row: the NAME leads (listing logic); the hero lead is the subtitle --
  const sub = heroCopy.lead || data.tagline || firstSentence(data.intro);
  const rateText =
    ratingValue && ratingCount
      ? `${ratingValue} · ${T(data, "{n} értékelés", { n: ratingCount })}`
      : ratingStat
        ? `${ratingStat.value} · ${ratingStat.label}`
        : "";
  const titleRow = `<div class="title-row">
      ${heroCopy.eyebrow ? `<div class="eyebrow">${esc(heroCopy.eyebrow)}</div>` : ""}
      <h1>${esc(data.name)}</h1>
      ${sub && sub !== data.name ? `<p class="sub">${esc(sub)}</p>` : ""}
      <div class="meta-row">
        ${rateText ? `<span class="rate">${stars}${esc(rateText)}</span>` : ""}
        ${c.address ? `<span class="addr">${CONTACT_ICONS.location}${esc(c.address)}</span>` : ""}
      </div>
    </div>`;

  // -- left column: dropcap intro -------------------------------------------
  const intro = data.intro
    ? `<div class="blk" id="about">
          ${featCopy.eyebrow ? `<div class="eyebrow">${esc(featCopy.eyebrow)}</div>` : ""}
          <h2>${featCopy.title ? accented(featCopy.title, featCopy.accent) : T(data, "Bemutatkozás")}</h2>
          <p class="intro-copy">${esc(data.intro)}</p>
        </div>`
    : "";

  // -- amenity list (real highlights only; the icon is decorative dressing) --
  const amenities = data.highlights.length
    ? `<div class="blk" id="amenities">
          <h2>${T(data, "Amit ez a hely kínál")}</h2>
          <div class="amen-grid">
            ${data.highlights
              .map((h) => `<div class="amen-i">${iconSvg(matchIcon(h))}<span>${esc(h)}</span></div>`)
              .join("\n            ")}
          </div>
        </div>`
    : "";

  // -- reviews: honest summary + cards; no rating-bar breakdown (no such data) --
  const revHead = rateText
    ? `<div class="rev-head">${stars}<b>${esc(ratingValue)}</b><span>· ${
        ratingCount ? T(data, "{n} értékelés", { n: ratingCount }) : esc(ratingStat?.label ?? "")
      }</span></div>`
    : `<h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégeink mondták")}</h2>`;
  const reviews = reviewsData
    ? `<div class="blk" id="reviews" data-cit-module="reviews">
          ${revCopy.eyebrow ? `<div class="eyebrow">${esc(revCopy.eyebrow)}</div>` : ""}
          ${revHead}
          <div class="rev-grid">
            ${reviewsData
              .map(
                (r) =>
                  `<div class="rev-i"><div class="who"><span class="av">${esc(
                    r.author.charAt(0),
                  )}</span><div><strong>${esc(r.author)}</strong>${
                    r.meta ? `<span>${esc(r.meta)}</span>` : ""
                  }</div></div><p>${esc(r.quote)}</p></div>`,
              )
              .join("\n            ")}
          </div>
          ${realReviews ? "" : `<p class="rev-sample">${T(data, "Minta — ide az Ön vendégeinek értékelései kerülnek.")}</p>`}
        </div>`
    : "";

  // -- location / contact ---------------------------------------------------
  const contactLines = [
    c.phone
      ? `<div class="con-line">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívható telefonszám")}</small></div></div>`
      : "",
    c.email
      ? `<div class="con-line">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="con-line">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n            ");
  const extraPhoto = photos[5];
  const contact = contactLines
    ? `<div class="blk" id="contact">
          <h2>${T(data, "Elhelyezkedés és kapcsolat")}</h2>
          <div class="con-lines">
            ${contactLines}
          </div>
          ${extraPhoto ? `<div class="con-photo"><img src="${esc(extraPhoto.url)}" alt="${esc(extraPhoto.alt)}"></div>` : ""}
        </div>`
    : "";

  // -- sticky booking card (canonical slot melted into the elevated card) ---
  // NO price row: we have no price data — the card serves the enquiry (§B.17).
  const cardHead = rateText
    ? `<div class="bc-head">${stars}<b>${esc(ratingValue)}</b><span>${
        ratingCount ? `· ${T(data, "{n} vélemény", { n: ratingCount })}` : ""
      }</span></div>`
    : `<p class="bc-name">${esc(data.name)}</p>`;
  const cardLines = [
    c.phone
      ? `<div class="bc-line">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívható telefonszám")}</small></div></div>`
      : "",
    c.email
      ? `<div class="bc-line">${CONTACT_ICONS.mail}<div><b>${esc(c.email)}</b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const side = `<aside class="side">
      <div class="bcard">
        ${cardHead}
        ${bookingSlot(data, phase)}
        ${cardLines}
      </div>
    </aside>`;

  // -- main column ----------------------------------------------------------
  const main = `<div class="main">
      ${intro}
      ${amenities}
      ${reviews}
      ${contact}
    </div>`;

  // -- mobile fixed booking bar ---------------------------------------------
  const mobBook = `<div class="mob-book">
    <div class="mb-rate">${
      rateText
        ? `${stars}<span>${esc(ratingValue)}<small>${
            ratingCount ? T(data, "{n} értékelés", { n: ratingCount }) : esc(ratingStat?.label ?? "")
          }</small></span>`
        : `<span>${esc(data.name)}</span>`
    }</div>
    <a class="cit-btn" href="#cit-enquiry">${ctaLabel(data, phase)}</a>
  </div>`;

  // -- rich soft footer -----------------------------------------------------
  const footContact = [
    c.phone ? `<span class="f-line">${esc(c.phone)}</span>` : "",
    c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "",
    c.address ? `<span class="f-line">${esc(c.address)}</span>` : "",
  ]
    .filter(Boolean)
    .join("\n          ");
  const footer = `<footer class="foot">
    <div class="wrap">
      <div class="f-grid">
        <div>
          <span class="f-brand"><span class="mark">${BRAND_MARK}</span>${esc(data.name)}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Oldal")}</h4>
          ${photos.length ? `<a href="#photos">${T(data, "Fotók")}</a>` : ""}
          ${data.intro ? `<a href="#about">${T(data, "Bemutatkozás")}</a>` : ""}
          ${data.highlights.length ? `<a href="#amenities">${T(data, "Felszereltség")}</a>` : ""}
          ${reviewsData ? `<a href="#reviews">${T(data, "Vélemények")}</a>` : ""}
          <a href="#cit-enquiry">${ctaLabel(data, phase)}</a>
        </div>
        ${
          footContact
            ? `<div>
          <h4>${T(data, "Kapcsolat")}</h4>
          ${footContact}
        </div>`
            : `<div>
          <h4>${T(data, "Információ")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
        </div>`
        }
      </div>
      <div class="f-legal">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        <a href="#top">${T(data, "Vissza a tetejére")}</a>
      </div>
    </div>
  </footer>`;

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
${CARD_SIDEBAR_CSS}
  </style>
</head>
<body class="cit-tpl-card-sidebar" id="top">
    ${header}
    <div class="wrap mast" id="photos">
      ${mosaic}
      ${titleRow}
      <div class="layout">
        ${main}
        ${side}
      </div>
    </div>
    ${slotMarker("showcase")}
    ${slotMarker("trust")}
    ${slotMarker("practical")}
    ${slotMarker("closing")}
    ${mobBook}
    ${footer}
    <script>${CARD_SIDEBAR_JS}</script>
</body>
</html>`;
}

export const CARD_SIDEBAR: ArtTemplate = {
  id: "card-sidebar",
  label: "Kártyás — foto-mozaik fejléc, ragadós foglaló-kártya (referencia 04)", // i18n-exempt: operator-facing (console template picker)
  // Light, airy skins — the listing-card look wants a bright, friendly base.
  skins: ["editorial-warm", "sand-cream-airy", "coastal-fresh", "tuscan-terracotta"],
  render: renderCardSidebar,
};
