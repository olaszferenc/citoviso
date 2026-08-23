// "horizontal" art template (ADR-0027) — the mock_17 "chapters" reference direction.
// A dark, literary stay: full-height photo hero, then the units presented as a HORIZONTAL
// SNAP RAIL of "chapters" (the signature move), a dark booking card, an amenity grid, a
// mosaic gallery, a review band, an optional FAQ, a contact split and a rich footer.
// All styling dresses from the 11 --cit-* tokens (+ color-mix / neutral scrims) — the
// forest-night skin is the intended pairing. See templateKit.ts for the shared contract.

import { iconSvg, matchIcon, starIcon } from "../icons.js";
import { slotMarker } from "../moduleSections.js";
import { SAMPLE_FAQS, SAMPLE_ROOMS } from "../primitives.js";
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
  photoFill,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const HORIZONTAL_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.65}

  /* shared module sections (.cit-modsec) dressed to match this template's rhythm (ADR-0057) */
  body.cit-tpl-horizontal{
    --cit-modsec-py:96px;
    --cit-modsec-maxw:1200px;
    --cit-modsec-px:28px;
    --cit-modsec-divider:0;
    --cit-modsec-head-align:center;
    --cit-modsec-head-mb:46px;
    --cit-modsec-head-size:clamp(28px,4.4vw,48px);
    --cit-modsec-head-weight:600;
    --cit-modsec-card-radius:var(--cit-radius);
    --cit-modsec-card-pad:24px}
  .cit-tpl-horizontal .cit-modsec__in > .cit-modsec__note{text-align:center;max-width:640px;margin-left:auto;margin-right:auto}
  .cit-tpl-horizontal .cit-modsec__badge{text-align:center}

  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .h-wrap{max-width:1200px;margin:0 auto;padding:0 28px}
  .h-eyebrow{font-size:12px;letter-spacing:5px;text-transform:uppercase;color:var(--cit-accent);font-weight:600}
  section.h-sec{padding:96px 0}
  .h-sechead{max-width:720px;margin:0 auto 46px;text-align:center}
  .h-sechead h2{font-family:var(--cit-font-display);font-weight:600;font-size:clamp(28px,4.4vw,48px);line-height:1.12;margin-top:14px}
  .h-sechead h2 em{font-style:italic;color:var(--cit-accent)}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);padding:14px 32px;letter-spacing:1.5px;text-transform:uppercase;font-size:13px;font-weight:700;border-radius:100px;transition:.25s;cursor:pointer}
  .cit-btn:hover{filter:brightness(1.08);transform:translateY(-2px)}
  .cit-btn-ghost{background:transparent;color:var(--cit-ink);border:1px solid color-mix(in srgb, var(--cit-ink) 40%, transparent)}
  .cit-btn-ghost:hover{border-color:var(--cit-accent);color:var(--cit-accent);filter:none}
  .cit-btn-disabled{opacity:.5;pointer-events:none}

  /* nav — overlay gradient, condenses on scroll */
  .h-nav{position:fixed;inset:0 0 auto 0;z-index:50;transition:.35s;padding:20px 0;background:linear-gradient(180deg, color-mix(in srgb, var(--cit-bg) 92%, transparent), transparent)}
  .h-nav.h-scrolled{background:color-mix(in srgb, var(--cit-bg) 96%, black);backdrop-filter:blur(12px);padding:12px 0;box-shadow:0 8px 30px rgba(0,0,0,.35)}
  .h-nav .h-wrap{display:flex;align-items:center;justify-content:space-between}
  .h-brand{font-family:var(--cit-font-display);font-size:22px;letter-spacing:3px;color:var(--cit-ink)}
  .h-navlinks{display:flex;gap:30px;align-items:center}
  .h-navlinks a{font-size:13px;letter-spacing:1px;color:color-mix(in srgb, var(--cit-ink) 78%, transparent);transition:.25s}
  .h-navlinks a:hover{color:var(--cit-accent)}
  @media(max-width:900px){.h-navlinks a:not(.cit-btn){display:none}}

  /* hero — full height photo + radial scrim */
  .h-hero{position:relative;height:100svh;min-height:620px;display:flex;align-items:center;overflow:hidden}
  .h-herobg{position:absolute;inset:0;background-size:cover;background-position:center}
  .h-herobg--flat{background:linear-gradient(155deg, var(--cit-bg), color-mix(in srgb, var(--cit-accent) 40%, var(--cit-bg)))}
  .h-hero::after{content:"";position:absolute;inset:0;background:radial-gradient(95% 95% at 50% 115%, color-mix(in srgb, var(--cit-bg) 96%, transparent), transparent 62%),linear-gradient(90deg, color-mix(in srgb, var(--cit-bg) 78%, transparent), transparent 70%)}
  .h-heroin{position:relative;z-index:2;max-width:640px}
  .h-hero h1{font-family:var(--cit-font-display);font-weight:600;font-size:clamp(40px,7vw,84px);line-height:1.05;margin:18px 0 20px}
  .h-hero h1 em{font-style:italic;color:var(--cit-accent)}
  .h-herosub{font-size:clamp(16px,2vw,19px);color:color-mix(in srgb, var(--cit-ink) 72%, transparent);max-width:460px;margin-bottom:32px}
  .h-heroctas{display:flex;gap:14px;flex-wrap:wrap}

  /* chapters head + horizontal snap rail — THE signature */
  .h-railhead{padding:84px 0 24px}
  .h-railhead .h-wrap{max-width:1200px}
  .h-railhead h2{font-family:var(--cit-font-display);font-weight:600;font-size:clamp(28px,4.4vw,48px);margin-top:12px}
  .h-railhint{font-size:13px;color:var(--cit-muted);margin-top:10px;letter-spacing:1px}
  .h-rail{display:flex;gap:24px;overflow-x:auto;scroll-snap-type:x mandatory;padding:10px 28px 40px;-webkit-overflow-scrolling:touch}
  .h-rail::-webkit-scrollbar{height:4px}
  .h-rail::-webkit-scrollbar-thumb{background:var(--cit-accent);border-radius:2px}
  .h-rail::-webkit-scrollbar-track{background:var(--cit-surface)}
  .h-house{flex:0 0 min(540px,86vw);scroll-snap-align:center;background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);overflow:hidden;display:grid;grid-template-rows:auto 1fr}
  .h-house .h-im{aspect-ratio:16/9;position:relative;overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .h-house .h-im img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
  .h-house:hover .h-im img{transform:scale(1.05)}
  .h-house .h-no{position:absolute;top:14px;left:14px;font-family:var(--cit-font-display);font-style:italic;font-size:14px;background:color-mix(in srgb, var(--cit-bg) 80%, transparent);border:1px solid var(--cit-line);border-radius:100px;padding:6px 14px}
  .h-house .h-bd{padding:24px}
  .h-house h3{font-family:var(--cit-font-display);font-size:25px;margin-bottom:4px}
  .h-house .h-mt{font-size:13px;color:var(--cit-accent);margin-bottom:12px}
  .h-house p{font-size:14.5px;color:var(--cit-muted);margin-bottom:16px}
  .h-house .h-ft{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--cit-line);padding-top:16px}
  .h-house .h-pr{font-family:var(--cit-font-display);font-size:20px;color:var(--cit-accent)}
  .h-sample{text-align:center;font-size:12.5px;color:var(--cit-muted);letter-spacing:.5px;padding:4px 28px 8px}

  /* booking card */
  .h-book{padding:64px 0}
  .h-bookcard{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);padding:14px clamp(16px,3vw,26px)}
  .h-bookcard .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem .4rem}
  .h-bookcard .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.3rem;color:var(--cit-ink)}

  /* amenity grid */
  .h-amengrid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
  .h-amencard{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);padding:26px 22px;transition:.3s}
  .h-amencard:hover{border-color:var(--cit-accent);transform:translateY(-4px)}
  .h-amencard svg{width:30px;height:30px;color:var(--cit-accent);margin-bottom:14px}
  .h-amencard p{font-size:14.5px;color:color-mix(in srgb, var(--cit-ink) 84%, transparent)}
  @media(max-width:900px){.h-amengrid{grid-template-columns:1fr 1fr}}
  @media(max-width:520px){.h-amengrid{grid-template-columns:1fr}}

  /* mosaic gallery */
  .h-mosaic{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:220px;gap:14px}
  .h-mosaic figure{position:relative;border-radius:var(--cit-radius);overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .h-mosaic img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
  .h-mosaic figure:hover img{transform:scale(1.05)}
  .h-mosaic figure:nth-child(1){grid-column:span 2;grid-row:span 2}
  .h-mosaic figure:nth-child(4){grid-row:span 2}
  @media(max-width:760px){.h-mosaic{grid-template-columns:1fr 1fr;grid-auto-rows:180px}.h-mosaic figure:nth-child(1){grid-column:span 2}}

  /* review band */
  .h-rev{background:color-mix(in srgb, var(--cit-bg) 92%, black);border-top:1px solid var(--cit-line);border-bottom:1px solid var(--cit-line)}
  .h-revscore{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:14px}
  .h-revscore b{font-family:var(--cit-font-display);font-size:48px;color:var(--cit-accent)}
  .h-stars{display:flex;gap:3px}
  .h-stars svg{width:18px;height:18px;color:var(--cit-accent)}
  .h-revscore span{font-size:13.5px;color:var(--cit-muted)}
  .h-revgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
  .h-revcard{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);padding:28px}
  .h-revcard p{font-family:var(--cit-font-display);font-style:italic;font-size:17px;line-height:1.5;margin-bottom:16px}
  .h-revcard footer{font-size:13px;color:var(--cit-accent)}
  @media(max-width:860px){.h-revgrid{grid-template-columns:1fr}}

  /* faq */
  .h-faq{max-width:800px;margin:0 auto}
  .h-faq details{border-bottom:1px solid var(--cit-line)}
  .h-faq details:first-child{border-top:1px solid var(--cit-line)}
  .h-faq summary{list-style:none;cursor:pointer;padding:20px 0;font-family:var(--cit-font-display);font-size:19px;display:flex;justify-content:space-between;gap:14px}
  .h-faq summary::after{content:"+";color:var(--cit-accent)}
  .h-faq details[open] summary::after{content:"−"}
  .h-faq details p{padding-bottom:20px;color:var(--cit-muted);font-size:15px}

  /* contact split */
  .h-congrid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
  .h-concopy h2{font-family:var(--cit-font-display);font-weight:600;font-size:clamp(28px,4vw,44px);margin:12px 0 20px}
  .h-conline{display:flex;align-items:center;gap:15px;padding:16px 0;border-top:1px solid var(--cit-line);font-size:16px}
  .h-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .h-conline b{font-family:var(--cit-font-display);font-size:17px}
  .h-conline small{color:var(--cit-muted);font-size:13px;display:block}
  .h-conphoto img{border-radius:var(--cit-radius);box-shadow:var(--cit-shadow);aspect-ratio:4/3;object-fit:cover;width:100%}
  @media(max-width:860px){.h-congrid{grid-template-columns:1fr;gap:36px}}

  /* footer */
  .h-foot{background:color-mix(in srgb, var(--cit-bg) 92%, black);border-top:1px solid var(--cit-line);padding:64px 0 30px;color:var(--cit-muted)}
  .h-footgrid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:44px;padding-bottom:40px;border-bottom:1px solid var(--cit-line)}
  .h-foot .h-brand{font-size:22px}
  .h-foot p{font-size:14px;margin-top:12px;max-width:320px}
  .h-foot h4{color:var(--cit-ink);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px}
  .h-foot a{display:block;padding:5px 0;font-size:14px;transition:.2s}
  .h-foot a:hover{color:var(--cit-accent)}
  .h-footlegal{display:flex;justify-content:space-between;gap:16px;padding-top:24px;font-size:13px;flex-wrap:wrap}
  @media(max-width:760px){.h-footgrid{grid-template-columns:1fr}}

  /* mobile fixed CTA */
  .h-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:60;background:color-mix(in srgb, var(--cit-bg) 96%, black);border-top:1px solid var(--cit-line);backdrop-filter:blur(10px);padding:12px 16px;gap:12px;align-items:center;justify-content:space-between}
  .h-mobcta span{font-size:14px;color:var(--cit-ink)}
  .h-mobcta b{color:var(--cit-accent)}
  @media(max-width:700px){.h-mobcta{display:flex}body{padding-bottom:64px}}
`;

const HORIZONTAL_JS = `
  (function(){var n=document.querySelector('.h-nav');if(!n)return;
  addEventListener('scroll',function(){n.classList.toggle('h-scrolled',scrollY>40)},{passive:true});})();
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderHorizontal(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["forest-night"]!;
  const heroCopy = copyOf(recipe, "hero");
  const roomCopy = copyOf(recipe, "rooms");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const heroPhoto = photos[0]?.url ?? "";
  const contactPhoto = photos[3]?.url ?? photos[photos.length - 1]?.url ?? "";
  const hasContact = Boolean(data.contact.email || data.contact.phone);

  const h1 = heroCopy.lead || data.tagline || data.name;
  const sub = data.tagline && data.tagline !== h1 ? data.tagline : firstSentence(data.intro);
  const ratingStat = data.stats?.find((s) => s.icon === "star");
  const starCount = data.rating ? Math.max(1, Math.min(5, Math.round(data.rating.value))) : 0;

  // §B.17 phase gate: real → render; none → MOCK sample (marked), LIVE dropped.
  const roomsData = data.rooms?.length ? data.rooms : phase === "mock" ? SAMPLE_ROOMS : null;
  const roomsSample = !(data.rooms && data.rooms.length);
  const reviewsData = data.reviews?.length ? data.reviews : null;
  const reviewsSample = !(data.reviews && data.reviews.length);
  const faqsData = data.faqs?.length ? data.faqs : phase === "mock" ? SAMPLE_FAQS : null;
  const faqsSample = !(data.faqs && data.faqs.length);

  // -- nav ------------------------------------------------------------------
  const navLinks = [
    roomsData ? `<a href="#h-rooms">${T(data, "Szobák")}</a>` : "",
    data.highlights.length ? `<a href="#h-services">${T(data, "Szolgáltatások")}</a>` : "",
    photos.length ? `<a href="#h-gallery">${T(data, "Galéria")}</a>` : "",
    reviewsData ? `<a href="#h-reviews">${T(data, "Vélemények")}</a>` : "",
    hasContact ? `<a href="#h-contact">${T(data, "Kapcsolat")}</a>` : "",
    hasContact ? `<a class="cit-btn" href="#cit-enquiry">${ctaLabel(data)}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="h-nav">
    <div class="h-wrap">
      <a class="h-brand" href="#top">${esc(data.name)}</a>
      <div class="h-navlinks">
        ${navLinks}
      </div>
    </div>
  </nav>`;

  // -- hero -----------------------------------------------------------------
  const heroBg = heroPhoto
    ? `<div class="h-herobg" style="background-image:url('${esc(heroPhoto)}')"></div>`
    : `<div class="h-herobg h-herobg--flat"></div>`;
  const hero = `<header class="h-hero" id="top">
    ${heroBg}
    <div class="h-wrap h-heroin">
      ${heroCopy.eyebrow ? `<div class="h-eyebrow">${esc(heroCopy.eyebrow)}</div>` : ""}
      <h1>${accented(h1, heroCopy.accent)}</h1>
      ${sub ? `<p class="h-herosub">${esc(sub)}</p>` : ""}
      <div class="h-heroctas">
        ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        ${roomsData ? `<a class="cit-btn cit-btn-ghost" href="#h-rooms">${T(data, "Szobáink")}</a>` : ""}
      </div>
    </div>
  </header>`;

  // -- rooms rail (signature) ----------------------------------------------
  const rail = roomsData
    ? `<div class="h-railhead" id="h-rooms">
    <div class="h-wrap">
      ${roomCopy.eyebrow ? `<div class="h-eyebrow">${esc(roomCopy.eyebrow)}</div>` : `<div class="h-eyebrow">${T(data, "Szobák")}</div>`}
      <h2>${roomCopy.title ? accented(roomCopy.title, roomCopy.accent) : T(data, "Válassz sarkot magadnak")}</h2>
      <p class="h-railhint">${T(data, "← húzd oldalra a sort →")}</p>
    </div>
  </div>
  <div class="h-rail" data-cit-module="rooms">
    ${roomsData
      .map(
        (r, i) => `<article class="h-house">
      <div class="h-im"><span class="h-no">${T(data, "{n}. fejezet", { n: String(i + 1) })}</span>${r.photo?.url ? `<img src="${esc(r.photo.url)}" alt="${esc(r.name)}">` : photoFill(r.name)}</div>
      <div class="h-bd">
        <h3>${esc(r.name)}</h3>
        ${r.capacity ? `<p class="h-mt">${esc(r.capacity)}</p>` : ""}
        ${r.note ? `<p>${esc(r.note)}</p>` : ""}
        <div class="h-ft">
          ${r.price ? `<span class="h-pr">${esc(r.price)}</span>` : "<span></span>"}
          ${hasContact ? `<a class="cit-btn cit-btn-ghost" href="#cit-enquiry">${ctaLabel(data)}</a>` : ""}
        </div>
      </div>
    </article>`,
      )
      .join("\n    ")}
  </div>
  ${roomsSample ? `<p class="h-sample">${T(data, "Minta — ide a valós szobáid/áraid kerülnek.")}</p>` : ""}`
    : "";

  // -- booking --------------------------------------------------------------
  const bookbar = `<div class="h-book">
    <div class="h-wrap">
      <div class="h-bookcard">
        ${bookingSlot(data)}
      </div>
    </div>
  </div>`;

  // -- amenities (real highlights only) ------------------------------------
  const amen = data.highlights.length
    ? `<section class="h-sec" id="h-services">
    <div class="h-wrap">
      <div class="h-sechead">
        <div class="h-eyebrow">${T(data, "Szolgáltatások")}</div>
        <h2>${T(data, "Amiért érdemes betérni")}</h2>
      </div>
      <div class="h-amengrid">
        ${data.highlights
          .slice(0, 8)
          .map((h) => `<div class="h-amencard">${iconSvg(matchIcon(h))}<p>${esc(h)}</p></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- gallery --------------------------------------------------------------
  const gallery = photos.length
    ? `<section class="h-sec" id="h-gallery">
    <div class="h-wrap">
      <div class="h-sechead">
        ${galCopy.eyebrow ? `<div class="h-eyebrow">${esc(galCopy.eyebrow)}</div>` : `<div class="h-eyebrow">${T(data, "Galéria")}</div>`}
        <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Képek a magasból")}</h2>
      </div>
      <div class="h-mosaic" data-cit-module="gallery">
        ${photos
          .slice(0, 6)
          .map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews --------------------------------------------------------------
  const stars5 = starCount ? `<div class="h-stars">${starIcon().repeat(starCount)}</div>` : "";
  const reviews = reviewsData
    ? `<section class="h-sec h-rev" id="h-reviews" data-cit-module="reviews">
    <div class="h-wrap">
      <div class="h-sechead">
        ${revCopy.eyebrow ? `<div class="h-eyebrow">${esc(revCopy.eyebrow)}</div>` : `<div class="h-eyebrow">${T(data, "Vélemények")}</div>`}
        ${
          ratingStat
            ? `<div class="h-revscore"><b>${esc(ratingStat.value)}</b><div>${stars5}<span>${esc(ratingStat.label)}</span></div></div>`
            : `<h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégeink")}</h2>`
        }
      </div>
      <div class="h-revgrid">
        ${reviewsData
          .map(
            (r) =>
              `<div class="h-revcard"><p>${esc(r.quote)}</p><footer>— ${esc(r.author)}${r.meta ? `, ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${reviewsSample ? `<p class="h-sample" style="margin-top:28px">${T(data, "Minta — ide a valós vendégértékeléseid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- faq ------------------------------------------------------------------
  const faq = faqsData
    ? `<section class="h-sec" id="h-faq">
    <div class="h-wrap">
      <div class="h-sechead">
        <div class="h-eyebrow">${T(data, "Tudnivalók")}</div>
        <h2>${T(data, "Gyakori kérdések")}</h2>
      </div>
      <div class="h-faq">
        ${faqsData
          .map(
            (f, i) =>
              `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
          )
          .join("\n        ")}
      </div>
      ${faqsSample ? `<p class="h-sample" style="margin-top:20px">${T(data, "Minta — ide a saját válaszaid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- contact --------------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="h-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="h-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="h-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n      ");
  const contact = contactLines
    ? `<section class="h-sec" id="h-contact">
    <div class="h-wrap h-congrid">
      <div class="h-concopy">
        <div class="h-eyebrow">${T(data, "Kapcsolat")}</div>
        <h2>${T(data, "Megközelítés és kapcsolat")}</h2>
        ${data.tagline ? `<p style="color:var(--cit-muted);font-size:16px;margin-bottom:6px">${esc(data.tagline)}</p>` : ""}
        ${contactLines}
        ${hasContact ? `<a class="cit-btn" style="margin-top:24px" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
      </div>
      ${contactPhoto ? `<div class="h-conphoto"><img src="${esc(contactPhoto)}" alt="${esc(data.name)}"></div>` : ""}
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="h-foot">
    <div class="h-wrap">
      <div class="h-footgrid">
        <div>
          <span class="h-brand">${esc(data.name)}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Oldal")}</h4>
          ${roomsData ? `<a href="#h-rooms">${T(data, "Szobák")}</a>` : ""}
          ${photos.length ? `<a href="#h-gallery">${T(data, "Galéria")}</a>` : ""}
          ${reviewsData ? `<a href="#h-reviews">${T(data, "Vélemények")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Információ")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="h-footlegal">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
      </div>
    </div>
  </footer>`;

  const mobcta = hasContact
    ? `<div class="h-mobcta">
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
${HORIZONTAL_CSS}
  </style>
</head>
<body class="cit-tpl-horizontal">
    ${nav}
    ${hero}
    ${rail}
    ${bookbar}
    ${amen}
    ${slotMarker("showcase")}
    ${gallery}
    ${reviews}
    ${slotMarker("trust")}
    ${faq}
    ${slotMarker("practical")}
    ${contact}
    ${slotMarker("closing")}
    ${footer}
    ${mobcta}
    <script>${HORIZONTAL_JS}</script>
</body>
</html>`;
}

export const HORIZONTAL: ArtTemplate = {
  id: "horizontal",
  label: "Fejezetes — vízszintes görgethető szoba-sín, sötét irodalmi (referencia 17)", // i18n-exempt: operator-facing (console template picker)
  skins: ["forest-night", "cellar-dark-wine", "night-azure-gold"],
  render: renderHorizontal,
};
