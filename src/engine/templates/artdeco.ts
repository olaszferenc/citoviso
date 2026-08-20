// "artdeco" art template (ADR-0027) — the mock_19 "poster / anno MCMXXVIII" reference.
// A DARK deco stay: a centered POSTER hero inside a double-brass DECO FRAME, a "porta" booking
// desk, deco-framed room cards, a right-aligned deco service list, a sepia gallery, a quote-
// SWITCHER review band (progressive-enhancement JS when >1 review), an optional FAQ, a deco-
// framed contact split and a rich footer. All styling dresses from the 11 --cit-* tokens
// (+ color-mix / neutral scrims) — the deco-brass skin is the intended pairing. The signature
// ornaments (double frame, rotated-square rhombus rule) are pure CSS (border/transform), never
// a ◆/◇ dingbat glyph and never emoji. See templateKit.ts for the shared contract.

import { iconSvg, matchIcon, starIcon } from "../icons.js";
import { SAMPLE_FAQS, SAMPLE_REVIEWS, SAMPLE_ROOMS } from "../primitives.js";
import type { Recipe, RenderPhase, SiteData } from "../recipe.js";
import { renderSeoHead, seoTitle } from "../seo.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "../skins.js";
import {
  accented,
  bookingSlot,
  copyOf,
  esc,
  firstSentence,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const ARTDECO_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.75;letter-spacing:.02em}
  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .ad-wrap{width:min(1160px,92%);margin:0 auto}
  h1,h2,h3{font-family:var(--cit-font-display);font-weight:400;line-height:1.12;letter-spacing:.06em}

  /* deco ornaments — pure CSS, no dingbat glyphs */
  .ad-rule{display:flex;align-items:center;gap:14px;color:var(--cit-accent);margin:0 auto}
  .ad-rule::before,.ad-rule::after{content:"";height:1px;background:linear-gradient(90deg,transparent,var(--cit-accent),transparent);flex:1}
  .ad-rule i{width:9px;height:9px;background:var(--cit-accent);transform:rotate(45deg);display:inline-block;flex:none}
  .ad-frame{position:relative;border:1px solid color-mix(in srgb, var(--cit-accent) 45%, transparent);padding:2px}
  .ad-frame::before{content:"";position:absolute;inset:5px;border:1px solid color-mix(in srgb, var(--cit-accent) 28%, transparent);pointer-events:none;z-index:2}

  .ad-eyebrow{font-size:11px;letter-spacing:.4em;text-transform:uppercase;color:var(--cit-accent);font-weight:600}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);font-size:12px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;padding:16px 38px;transition:.25s;cursor:pointer}
  .cit-btn:hover{filter:brightness(1.08)}
  .cit-btn-ghost{background:transparent;color:var(--cit-ink);border:1px solid color-mix(in srgb, var(--cit-ink) 40%, transparent)}
  .cit-btn-ghost:hover{border-color:var(--cit-accent);color:var(--cit-accent);filter:none}
  .cit-btn-disabled{opacity:.5;pointer-events:none}

  /* NAV — sticky, brass underline */
  .ad-nav{position:sticky;top:0;z-index:100;background:color-mix(in srgb, var(--cit-bg) 94%, transparent);border-bottom:1px solid color-mix(in srgb, var(--cit-accent) 35%, transparent);backdrop-filter:blur(8px)}
  .ad-nav .ad-wrap{display:flex;align-items:center;justify-content:space-between;padding:16px 0;gap:14px}
  .ad-brand{font-family:var(--cit-font-display);font-size:23px;color:var(--cit-ink);letter-spacing:.16em;display:inline-flex;align-items:center;gap:12px}
  .ad-brand i{width:9px;height:9px;background:var(--cit-accent);transform:rotate(45deg);display:inline-block;flex:none}
  .ad-menu{display:none;gap:28px;align-items:center}
  @media(min-width:900px){.ad-menu{display:flex}}
  .ad-menu a{color:var(--cit-ink);font-size:12.5px;letter-spacing:.22em;text-transform:uppercase;opacity:.8;transition:.25s}
  .ad-menu a:hover{color:var(--cit-accent);opacity:1}
  .ad-nav .cit-btn.ad-navbtn{padding:11px 22px;font-size:11.5px;letter-spacing:.22em;background:transparent;color:var(--cit-accent);border:1px solid var(--cit-accent)}
  .ad-nav .cit-btn.ad-navbtn:hover{background:var(--cit-accent);color:var(--cit-on-accent)}

  /* HERO — centered poster inside deco frame */
  .ad-hero{padding:60px 0 40px;position:relative;overflow:hidden}
  .ad-hero::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg, color-mix(in srgb, var(--cit-accent) 5%, transparent) 0 1px, transparent 1px 46px);pointer-events:none}
  .ad-poster{position:relative;padding:44px 26px;text-align:center}
  .ad-poster .ad-est{font-size:11.5px;letter-spacing:.42em;text-transform:uppercase;color:var(--cit-accent);margin-bottom:22px}
  .ad-poster h1{font-size:clamp(44px,9vw,104px);letter-spacing:.1em;margin-bottom:6px}
  .ad-poster h1 em{font-style:normal;color:var(--cit-accent)}
  .ad-poster .ad-sub{font-style:italic;font-size:clamp(17px,2.4vw,25px);color:color-mix(in srgb, var(--cit-accent) 60%, var(--cit-ink));margin-bottom:26px}
  .ad-poster .ad-rule{max-width:420px;margin-bottom:26px}
  .ad-poster p.ad-intro{max-width:56ch;margin:0 auto 32px;color:var(--cit-muted)}
  .ad-heroctas{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
  .ad-heroimg{margin-top:40px;aspect-ratio:21/9;overflow:hidden}
  .ad-heroimg img{width:100%;height:100%;object-fit:cover;filter:sepia(.35) contrast(1.06) brightness(.9)}
  .ad-heroimg--flat{background:linear-gradient(155deg, var(--cit-bg), color-mix(in srgb, var(--cit-accent) 40%, var(--cit-bg)))}

  /* BOOKING — "porta" panel */
  .ad-desk{border-top:1px solid color-mix(in srgb, var(--cit-accent) 35%, transparent);border-bottom:1px solid color-mix(in srgb, var(--cit-accent) 35%, transparent);background:var(--cit-surface);padding:34px 0}
  .ad-desk .ad-desktitle{text-align:center;font-family:var(--cit-font-display);font-size:22px;letter-spacing:.16em;margin-bottom:8px;color:var(--cit-ink)}
  .ad-desk .ad-desksub{text-align:center;font-style:italic;color:var(--cit-muted);margin-bottom:24px}
  .ad-desk .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:1.4rem}
  .ad-desk .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.3rem;letter-spacing:.06em;color:var(--cit-ink)}

  /* SECTIONS */
  section.ad-sec{padding:92px 0}
  .ad-sechead{text-align:center;margin-bottom:56px}
  .ad-sechead h2{font-size:clamp(28px,4.4vw,46px)}
  .ad-sechead h2 em{font-style:italic;color:var(--cit-accent)}
  .ad-sechead .ad-rule{max-width:260px;margin-top:18px}
  .ad-sechead .ad-lead{color:var(--cit-muted);max-width:58ch;margin:18px auto 0}

  /* ROOMS — deco-framed cards */
  .ad-rooms{display:grid;gap:30px;grid-template-columns:1fr}
  @media(min-width:900px){.ad-rooms{grid-template-columns:repeat(3,1fr)}}
  .ad-room .ad-im{aspect-ratio:3/4;overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .ad-room .ad-im img{width:100%;height:100%;object-fit:cover;filter:sepia(.3) contrast(1.05) brightness(.92);transition:filter .5s,transform .6s}
  .ad-room:hover .ad-im img{filter:sepia(.1);transform:scale(1.04)}
  .ad-room .ad-bd{text-align:center;padding:24px 16px 6px}
  .ad-room h3{font-size:25px;margin-bottom:6px}
  .ad-room .ad-mt{font-style:italic;font-size:16px;color:color-mix(in srgb, var(--cit-accent) 60%, var(--cit-ink));margin-bottom:14px}
  .ad-room p{font-size:14.5px;color:var(--cit-muted);margin-bottom:18px}
  .ad-room .ad-ft{padding-top:16px;border-top:1px solid color-mix(in srgb, var(--cit-accent) 30%, transparent)}
  .ad-room .ad-pr{font-family:var(--cit-font-display);font-size:22px;letter-spacing:.05em;color:var(--cit-accent);display:block;margin-bottom:12px}

  /* SERVICES — deco list, right-aligned italic value */
  .ad-svc{display:grid;gap:0;grid-template-columns:1fr;max-width:840px;margin:0 auto}
  @media(min-width:760px){.ad-svc{grid-template-columns:1fr 1fr;column-gap:56px}}
  .ad-sv{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:15px 0;border-bottom:1px solid color-mix(in srgb, var(--cit-accent) 22%, transparent);font-size:15px}
  .ad-sv .ad-svlabel{display:flex;align-items:center;gap:12px}
  .ad-sv svg{width:20px;height:20px;color:var(--cit-accent);flex:none}
  .ad-sv .ad-svval{font-style:italic;color:var(--cit-muted);text-align:right;font-size:15px}

  /* GALLERY — sepia + figcaption */
  .ad-gal{display:grid;gap:22px;grid-template-columns:repeat(2,1fr)}
  @media(min-width:860px){.ad-gal{grid-template-columns:repeat(4,1fr)}}
  .ad-gal figure{aspect-ratio:3/4;overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .ad-gal img{width:100%;height:100%;object-fit:cover;filter:sepia(.35) contrast(1.05) brightness(.88);transition:filter .5s}
  .ad-gal figure:hover img{filter:sepia(.05) brightness(1)}
  .ad-gal figcaption{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--cit-accent);padding-top:12px;text-align:center}

  /* REVIEWS — quote switcher */
  .ad-rev{background:color-mix(in srgb, var(--cit-bg) 92%, black);border-top:1px solid var(--cit-line);border-bottom:1px solid var(--cit-line)}
  .ad-revscore{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:14px}
  .ad-revscore b{font-family:var(--cit-font-display);font-size:44px;color:var(--cit-accent)}
  .ad-stars{display:flex;gap:3px}
  .ad-stars svg{width:18px;height:18px;color:var(--cit-accent)}
  .ad-revscore span{font-size:13.5px;color:var(--cit-muted)}
  .ad-tst{text-align:center;max-width:760px;margin:0 auto}
  .ad-tst blockquote{font-style:italic;font-size:clamp(22px,3.2vw,32px);line-height:1.5;margin-bottom:22px;color:var(--cit-ink)}
  .ad-tst cite{font-style:normal;font-size:11.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--cit-accent)}
  .ad-tst .ad-sw{display:flex;justify-content:center;gap:16px;margin-top:34px}
  .ad-tst .ad-sw button{width:11px;height:11px;background:transparent;border:1px solid var(--cit-accent);transform:rotate(45deg);cursor:pointer;padding:0}
  .ad-tst .ad-sw button.ad-on{background:var(--cit-accent)}

  /* FAQ */
  .ad-faq{max-width:800px;margin:0 auto}
  .ad-faq details{border-bottom:1px solid color-mix(in srgb, var(--cit-accent) 25%, transparent)}
  .ad-faq details:first-child{border-top:1px solid color-mix(in srgb, var(--cit-accent) 25%, transparent)}
  .ad-faq summary{list-style:none;cursor:pointer;padding:21px 0;font-family:var(--cit-font-display);font-size:20px;letter-spacing:.06em;display:flex;justify-content:space-between;align-items:center;gap:16px}
  .ad-faq summary::-webkit-details-marker{display:none}
  .ad-faq summary i{width:9px;height:9px;border:1px solid var(--cit-accent);transform:rotate(45deg);display:inline-block;flex:none;transition:.25s}
  .ad-faq details[open] summary i{background:var(--cit-accent)}
  .ad-faq details p{padding-bottom:22px;color:var(--cit-muted);font-size:15px}

  /* CONTACT — deco map + form-slot split */
  .ad-loc{display:grid;gap:30px;grid-template-columns:1fr}
  @media(min-width:920px){.ad-loc{grid-template-columns:1.05fr .95fr}}
  .ad-lmap{position:relative;min-height:360px;overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .ad-lmap img{width:100%;height:100%;object-fit:cover;filter:sepia(.5) brightness(.7)}
  .ad-lmap .ad-ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;gap:8px;background:color-mix(in srgb, var(--cit-bg) 55%, transparent)}
  .ad-lmap b{font-family:var(--cit-font-display);font-size:22px;letter-spacing:.12em;color:var(--cit-ink)}
  .ad-lmap span{font-size:13px;color:var(--cit-muted);letter-spacing:.08em}
  .ad-cform{padding:34px 30px}
  .ad-cform h3{font-size:23px;text-align:center;margin-bottom:8px}
  .ad-cform .ad-rule{max-width:180px;margin:0 auto 24px}
  .ad-conline{display:flex;align-items:center;gap:15px;padding:14px 0;border-top:1px solid color-mix(in srgb, var(--cit-accent) 22%, transparent);font-size:15px}
  .ad-conline:first-of-type{border-top:none}
  .ad-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .ad-conline b{font-family:var(--cit-font-display);font-size:17px;letter-spacing:.04em}
  .ad-conline small{color:var(--cit-muted);font-size:12.5px;display:block;letter-spacing:.06em}
  .ad-cform .cit-btn{width:100%;text-align:center;margin-top:22px}

  /* FOOTER */
  .ad-foot{border-top:1px solid color-mix(in srgb, var(--cit-accent) 35%, transparent);padding:62px 0 30px;background:var(--cit-surface);color:var(--cit-muted)}
  .ad-footgrid{display:grid;gap:32px;grid-template-columns:1fr;margin-bottom:40px}
  @media(min-width:800px){.ad-footgrid{grid-template-columns:2fr 1fr 1fr}}
  .ad-foot .ad-brand{font-size:22px}
  .ad-foot p{max-width:290px;font-size:14.5px;margin-top:14px}
  .ad-foot h4{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--cit-accent);margin-bottom:16px}
  .ad-foot a{display:block;padding:5px 0;font-size:14.5px;transition:.2s}
  .ad-foot a:hover{color:var(--cit-accent)}
  .ad-footlegal{border-top:1px solid color-mix(in srgb, var(--cit-accent) 20%, transparent);padding-top:22px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:12.5px;letter-spacing:.08em}
`;

// Progressive enhancement ONLY: cycles the review quote when >1 review exists. Without JS the
// first quote stays visible (static fallback) — nothing is empty, nothing is fabricated.
const ARTDECO_JS = `
  (function(){
    var box=document.querySelector('[data-ad-switcher]');if(!box)return;
    var quotes=JSON.parse(box.getAttribute('data-ad-quotes')||'[]');if(quotes.length<2)return;
    var q=box.querySelector('[data-ad-q]'),c=box.querySelector('[data-ad-c]'),dots=box.querySelectorAll('[data-ad-dot]');
    function show(i){q.textContent=quotes[i].q;c.textContent=quotes[i].c;dots.forEach(function(d,j){d.classList.toggle('ad-on',j===i)});}
    dots.forEach(function(d,i){d.addEventListener('click',function(){show(i)})});
  })();
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderArtdeco(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["deco-brass"]!;
  const heroCopy = copyOf(recipe, "hero");
  const roomCopy = copyOf(recipe, "rooms");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const heroPhoto = photos[0]?.url ?? "";
  const mapPhoto = photos[3]?.url ?? photos[photos.length - 1]?.url ?? "";
  const hasContact = Boolean(data.contact.email || data.contact.phone);

  const h1 = heroCopy.lead || data.tagline || data.name;
  const sub = data.tagline && data.tagline !== h1 ? data.tagline : firstSentence(data.intro);
  const intro = firstSentence(data.intro, 260);
  const ratingStat = data.stats?.find((s) => s.icon === "star");
  const starCount = data.rating ? Math.max(1, Math.min(5, Math.round(data.rating.value))) : 0;

  // §B.17 phase gate: real → render; none → MOCK sample (marked), LIVE dropped. NEVER a
  // fabricated number — the mock's "1928 / 84 rooms" facts stay out unless data carries them.
  const roomsData = data.rooms?.length ? data.rooms : phase === "mock" ? SAMPLE_ROOMS : null;
  const roomsSample = !(data.rooms && data.rooms.length);
  const reviewsData = data.reviews?.length ? data.reviews : phase === "mock" ? SAMPLE_REVIEWS : null;
  const reviewsSample = !(data.reviews && data.reviews.length);
  const faqsData = data.faqs?.length ? data.faqs : phase === "mock" ? SAMPLE_FAQS : null;
  const faqsSample = !(data.faqs && data.faqs.length);

  const rhombus = `<i></i>`;
  const decoRule = `<p class="ad-rule">${rhombus}</p>`;

  // -- nav ------------------------------------------------------------------
  const navLinks = [
    roomsData ? `<a href="#ad-rooms">${T(data, "Szobák")}</a>` : "",
    data.highlights.length ? `<a href="#ad-services">${T(data, "Szolgáltatások")}</a>` : "",
    photos.length ? `<a href="#ad-gallery">${T(data, "Galéria")}</a>` : "",
    reviewsData ? `<a href="#ad-reviews">${T(data, "Vélemények")}</a>` : "",
    hasContact ? `<a href="#ad-contact">${T(data, "Kapcsolat")}</a>` : "",
    hasContact ? `<a class="cit-btn ad-navbtn" href="#cit-enquiry">${T(data, "Foglalás")}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="ad-nav">
    <div class="ad-wrap">
      <a class="ad-brand" href="#top">${esc(data.name)}${rhombus}</a>
      <div class="ad-menu">
        ${navLinks}
      </div>
    </div>
  </nav>`;

  // -- hero — centered poster in a deco frame -------------------------------
  const heroFig = heroPhoto
    ? `<figure class="ad-heroimg"><img src="${esc(heroPhoto)}" alt="${esc(data.name)}"></figure>`
    : `<figure class="ad-heroimg ad-heroimg--flat"></figure>`;
  const hero = `<header class="ad-hero" id="top">
    <div class="ad-wrap">
      <div class="ad-frame ad-poster">
        ${heroCopy.eyebrow ? `<p class="ad-est">${esc(heroCopy.eyebrow)}</p>` : ""}
        <h1>${accented(h1, heroCopy.accent)}</h1>
        ${sub ? `<p class="ad-sub">${esc(sub)}</p>` : ""}
        ${decoRule}
        ${intro ? `<p class="ad-intro">${esc(intro)}</p>` : ""}
        <div class="ad-heroctas">
          ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szoba lefoglalása")}</a>` : ""}
          ${roomsData ? `<a class="cit-btn cit-btn-ghost" href="#ad-rooms">${T(data, "A szobák")}</a>` : ""}
        </div>
      </div>
      ${heroFig}
    </div>
  </header>`;

  // -- booking "porta" ------------------------------------------------------
  const bookbar = `<div class="ad-desk">
    <div class="ad-wrap">
      <p class="ad-desktitle">${T(data, "A porta")}</p>
      <p class="ad-desksub">${T(data, "Kérjük, adja meg utazásának adatait")}</p>
      ${bookingSlot(data)}
    </div>
  </div>`;

  // -- rooms (deco-framed cards) -------------------------------------------
  const rooms = roomsData
    ? `<section class="ad-sec" id="ad-rooms">
    <div class="ad-wrap">
      <div class="ad-sechead">
        ${roomCopy.eyebrow ? `<div class="ad-eyebrow">${esc(roomCopy.eyebrow)}</div>` : `<div class="ad-eyebrow">${T(data, "Szobáink")}</div>`}
        <h2>${roomCopy.title ? accented(roomCopy.title, roomCopy.accent) : T(data, "Válassz sarkot magadnak")}</h2>
        ${decoRule.replace("ad-rule", "ad-rule")}
      </div>
      <div class="ad-rooms" data-cit-module="rooms">
        ${roomsData
          .map(
            (r) => `<article class="ad-room">
          <div class="ad-frame"><div class="ad-im">${r.photo?.url ? `<img src="${esc(r.photo.url)}" alt="${esc(r.name)}">` : ""}</div></div>
          <div class="ad-bd">
            <h3>${esc(r.name)}</h3>
            ${r.capacity ? `<p class="ad-mt">${esc(r.capacity)}</p>` : ""}
            ${r.note ? `<p>${esc(r.note)}</p>` : ""}
            <div class="ad-ft">
              ${r.price ? `<span class="ad-pr">${esc(r.price)}</span>` : ""}
              ${hasContact ? `<a class="cit-btn cit-btn-ghost" href="#cit-enquiry">${T(data, "Foglalás")}</a>` : ""}
            </div>
          </div>
        </article>`,
          )
          .join("\n        ")}
      </div>
      ${roomsSample ? `<p class="ad-sample ad-sechead" style="margin-top:34px;margin-bottom:0;color:var(--cit-muted);font-size:12.5px;letter-spacing:.5px">${T(data, "Minta — ide a valós szobáid/áraid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- services (deco list, real highlights only) ---------------------------
  const services = data.highlights.length
    ? `<section class="ad-sec" id="ad-services" style="padding-top:0">
    <div class="ad-wrap">
      <div class="ad-sechead">
        <div class="ad-eyebrow">${T(data, "A ház szolgálata")}</div>
        <h2>${T(data, "Ami magától értetődő")}</h2>
        ${decoRule}
      </div>
      <div class="ad-svc">
        ${data.highlights
          .slice(0, 10)
          .map(
            (h) =>
              `<div class="ad-sv"><span class="ad-svlabel">${iconSvg(matchIcon(h))}<span>${esc(h)}</span></span></div>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- gallery (sepia + figcaption) ----------------------------------------
  const gallery = photos.length
    ? `<section class="ad-sec" id="ad-gallery" style="padding-top:0">
    <div class="ad-wrap">
      <div class="ad-sechead">
        ${galCopy.eyebrow ? `<div class="ad-eyebrow">${esc(galCopy.eyebrow)}</div>` : `<div class="ad-eyebrow">${T(data, "Képek")}</div>`}
        <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "A ház arcai")}</h2>
        ${decoRule}
      </div>
      <div class="ad-gal" data-cit-module="gallery">
        ${photos
          .slice(0, 8)
          .map(
            (p) =>
              `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}">${p.alt ? `<figcaption>${esc(p.alt)}</figcaption>` : ""}</figure>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews (quote switcher; PE JS if >1) --------------------------------
  const stars5 = starCount ? `<div class="ad-stars">${starIcon().repeat(starCount)}</div>` : "";
  const quotesJson = reviewsData
    ? esc(
        JSON.stringify(
          reviewsData.map((r) => ({
            q: `„${r.quote}"`,
            c: r.meta ? `${r.author} — ${r.meta}` : r.author,
          })),
        ),
      )
    : "[]";
  const first = reviewsData?.[0];
  const reviews = reviewsData
    ? `<section class="ad-sec ad-rev" id="ad-reviews" data-cit-module="reviews">
    <div class="ad-wrap">
      <div class="ad-sechead">
        ${revCopy.eyebrow ? `<div class="ad-eyebrow">${esc(revCopy.eyebrow)}</div>` : `<div class="ad-eyebrow">${T(data, "Vendégeink")}</div>`}
        ${
          ratingStat
            ? `<div class="ad-revscore"><b>${esc(ratingStat.value)}</b><div>${stars5}<span>${esc(ratingStat.label)}</span></div></div>`
            : `<h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégeink")}</h2>`
        }
        ${decoRule}
      </div>
      <div class="ad-tst" data-ad-switcher data-ad-quotes="${quotesJson}">
        <blockquote data-ad-q>${first ? esc(`„${first.quote}"`) : ""}</blockquote>
        <cite data-ad-c>${first ? esc(first.meta ? `${first.author} — ${first.meta}` : first.author) : ""}</cite>
        ${
          reviewsData.length > 1
            ? `<div class="ad-sw">${reviewsData
                .map(
                  (_, i) =>
                    `<button data-ad-dot${i === 0 ? ' class="ad-on"' : ""} aria-label="${T(data, "Vélemény {n}", { n: String(i + 1) })}"></button>`,
                )
                .join("")}</div>`
            : ""
        }
      </div>
      ${reviewsSample ? `<p class="ad-tst" style="margin-top:34px;color:var(--cit-muted);font-size:12.5px;letter-spacing:.5px">${T(data, "Minta — ide a valós vendégértékeléseid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- faq ------------------------------------------------------------------
  const faq = faqsData
    ? `<section class="ad-sec" id="ad-faq" style="padding-top:0">
    <div class="ad-wrap">
      <div class="ad-sechead">
        <div class="ad-eyebrow">${T(data, "Tudnivaló")}</div>
        <h2>${T(data, "Kérdések a portához")}</h2>
        ${decoRule}
      </div>
      <div class="ad-faq">
        ${faqsData
          .map(
            (f, i) =>
              `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}<i></i></summary><p>${esc(f.a)}</p></details>`,
          )
          .join("\n        ")}
      </div>
      ${faqsSample ? `<p class="ad-tst" style="margin-top:20px;color:var(--cit-muted);font-size:12.5px;letter-spacing:.5px">${T(data, "Minta — ide a saját válaszaid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- contact (deco map + contact lines) ----------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="ad-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="ad-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="ad-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const contact = contactLines
    ? `<section class="ad-sec" id="ad-contact" style="padding-top:0">
    <div class="ad-wrap">
      <div class="ad-sechead">
        <div class="ad-eyebrow">${T(data, "Elhelyezkedés")}</div>
        <h2>${T(data, "Megközelítés és kapcsolat")}</h2>
        ${decoRule}
      </div>
      <div class="ad-loc">
        <div class="ad-frame"><div class="ad-lmap">
          ${mapPhoto ? `<img src="${esc(mapPhoto)}" alt="${esc(data.name)}">` : ""}
          <div class="ad-ov">
            <b>${esc(data.name)}</b>
            ${c.address ? `<span>${esc(c.address)}</span>` : ""}
          </div>
        </div></div>
        <div class="ad-frame ad-cform">
          <h3>${T(data, "Üzenet a portának")}</h3>
          ${decoRule}
          ${contactLines}
          ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        </div>
      </div>
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="ad-foot">
    <div class="ad-wrap">
      <div class="ad-footgrid">
        <div>
          <span class="ad-brand">${esc(data.name)}${rhombus}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "A ház")}</h4>
          ${roomsData ? `<a href="#ad-rooms">${T(data, "Szobák")}</a>` : ""}
          ${data.highlights.length ? `<a href="#ad-services">${T(data, "Szolgáltatások")}</a>` : ""}
          ${photos.length ? `<a href="#ad-gallery">${T(data, "Galéria")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Kapcsolat")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
          ${reviewsData ? `<a href="#ad-reviews">${T(data, "Vélemények")}</a>` : ""}
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="ad-footlegal">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
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
${ARTDECO_CSS}
  </style>
</head>
<body class="cit-tpl-artdeco">
    ${nav}
    ${hero}
    ${bookbar}
    ${rooms}
    ${services}
    ${gallery}
    ${reviews}
    ${faq}
    ${contact}
    ${footer}
    <script>${ARTDECO_JS}</script>
</body>
</html>`;
}

export const ARTDECO: ArtTemplate = {
  id: "artdeco",
  label: "Art-deco — központi poszter-hero, éjkék-réz sepia, deco-keret ornamensek (referencia 19)", // i18n-exempt: operator-facing (console template picker)
  skins: ["deco-brass", "night-azure-gold", "cellar-dark-wine"],
  render: renderArtdeco,
};
