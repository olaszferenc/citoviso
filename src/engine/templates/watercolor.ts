// "watercolor" art template (ADR-0027) — the mock_21 "Kis Hullám" reference direction.
// A LIGHT, airy seaside stay: soft watercolor washes (blurred token-tinted blobs), inline SVG
// WAVE dividers between sections (the signature move), a curved photo hero with a CSS sun disc,
// blob-radius gallery frames and soft-shadow rounded cards. All styling dresses from the 11
// --cit-* tokens (+ color-mix / neutral white/black scrims) — the watercolor-lake skin is the
// intended pairing. Doctrine §B.4: icons/waves/sun are SVG or CSS, NEVER emoji/★/☀/🌊/◈.
// See templateKit.ts for the shared contract.

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

const WATERCOLOR_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.75}
  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .wc-wrap{width:min(1140px,92%);margin:0 auto}
  .wc-eyebrow{display:inline-block;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:var(--cit-accent);margin-bottom:12px}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);font-weight:700;font-size:15px;padding:14px 30px;border-radius:100px;box-shadow:0 8px 20px color-mix(in srgb, var(--cit-accent) 40%, transparent);transition:.2s;cursor:pointer}
  .cit-btn:hover{filter:brightness(1.06);transform:translateY(-2px)}
  .cit-btn-ghost{background:var(--cit-surface);color:var(--cit-ink);box-shadow:var(--cit-shadow)}
  .cit-btn-ghost:hover{filter:none;color:var(--cit-accent)}
  .cit-btn-disabled{opacity:.5;pointer-events:none}

  /* watercolor washes — blurred token-tinted blobs (signature b) */
  .wc-wash{position:absolute;border-radius:50%;filter:blur(48px);opacity:.5;pointer-events:none;z-index:0}
  .wc-wash--accent{background:color-mix(in srgb, var(--cit-accent) 55%, transparent)}
  .wc-wash--cool{background:color-mix(in srgb, var(--cit-line) 90%, var(--cit-accent))}
  .wc-wash--warm{background:color-mix(in srgb, var(--cit-accent) 30%, var(--cit-surface));opacity:.4}

  /* wave dividers — inline SVG, path fill = token (signature a) */
  .wc-wavesep{display:block;width:100%;height:64px;position:relative;z-index:1;margin-bottom:-1px}
  .wc-wavesep path{fill:var(--cit-surface)}
  .wc-wavesep--up path{fill:var(--cit-bg)}

  /* nav — clean SVG wave logo */
  .wc-nav{position:sticky;top:0;z-index:100;background:color-mix(in srgb, var(--cit-bg) 92%, transparent);backdrop-filter:blur(8px)}
  .wc-nv{display:flex;align-items:center;justify-content:space-between;padding:16px 0;gap:12px}
  .wc-lg{display:flex;align-items:center;gap:10px;font-family:var(--cit-font-display);font-size:21px;font-weight:600;color:var(--cit-ink)}
  .wc-lg svg{width:36px;height:22px;flex:none}
  .wc-lg .wc-wv{fill:none;stroke:var(--cit-accent);stroke-width:4;stroke-linecap:round}
  .wc-lg .wc-sn{fill:color-mix(in srgb, var(--cit-accent) 62%, var(--cit-surface))}
  .wc-menu{display:none;gap:24px;align-items:center}
  @media(min-width:900px){.wc-menu{display:flex}}
  .wc-menu a{color:var(--cit-muted);font-size:14.5px;font-weight:600;transition:.2s}
  .wc-menu a:hover{color:var(--cit-accent)}

  /* hero — left copy, right curved photo + CSS sun */
  .wc-hero{position:relative;padding:60px 0 24px;overflow:hidden}
  .wc-hero .wc-w1{width:520px;height:400px;top:-120px;right:-100px}
  .wc-hero .wc-w2{width:380px;height:320px;bottom:-80px;left:-120px}
  .wc-hgrid{position:relative;z-index:1;display:grid;gap:36px;grid-template-columns:1fr;align-items:center}
  @media(min-width:940px){.wc-hgrid{grid-template-columns:1.05fr .95fr}}
  .wc-k{display:inline-block;font-size:13.5px;font-weight:700;color:var(--cit-accent);background:var(--cit-surface);border-radius:100px;padding:8px 18px;box-shadow:var(--cit-shadow);margin-bottom:20px}
  .wc-hero h1{font-family:var(--cit-font-display);font-weight:600;font-size:clamp(38px,5.6vw,62px);line-height:1.12;margin-bottom:18px}
  .wc-hero h1 em{font-style:italic;color:var(--cit-accent)}
  .wc-herosub{color:var(--cit-muted);max-width:460px;margin-bottom:28px}
  .wc-heroctas{display:flex;gap:12px;flex-wrap:wrap}
  .wc-hvis{position:relative}
  .wc-hvis .wc-main{border-radius:200px 200px 26px 26px;overflow:hidden;aspect-ratio:4/5;box-shadow:var(--cit-shadow)}
  .wc-hvis .wc-main img{width:100%;height:100%;object-fit:cover}
  .wc-hvis .wc-main--flat{background:linear-gradient(160deg, color-mix(in srgb, var(--cit-accent) 30%, var(--cit-surface)), color-mix(in srgb, var(--cit-line) 80%, var(--cit-surface)))}
  .wc-hvis .wc-sun{position:absolute;top:-16px;left:-14px;width:78px;height:78px;border-radius:50%;background:color-mix(in srgb, var(--cit-accent) 60%, var(--cit-surface));opacity:.8;z-index:-1}

  /* booking card */
  .wc-book{position:relative;z-index:1;margin-top:40px;background:var(--cit-surface);border-radius:28px;padding:12px clamp(16px,3vw,26px);box-shadow:var(--cit-shadow)}
  .wc-book .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem .4rem}
  .wc-book .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.3rem;color:var(--cit-ink)}

  /* sections */
  section.wc-sec{padding:78px 0;position:relative}
  .wc-surf{background:var(--cit-surface)}
  .wc-sechead h2{font-family:var(--cit-font-display);font-weight:600;font-size:clamp(28px,4.2vw,44px);line-height:1.15;margin-bottom:12px}
  .wc-sechead h2 em{font-style:italic;color:var(--cit-accent)}
  .wc-lead{color:var(--cit-muted);max-width:540px}

  /* rooms — soft cards */
  .wc-rooms{display:grid;gap:28px;grid-template-columns:1fr;margin-top:44px}
  @media(min-width:880px){.wc-rooms{grid-template-columns:repeat(3,1fr)}}
  .wc-room{background:var(--cit-bg);border:1px solid var(--cit-line);border-radius:26px;overflow:hidden;box-shadow:var(--cit-shadow);transition:transform .22s}
  .wc-room:hover{transform:translateY(-6px)}
  .wc-room .wc-im{aspect-ratio:4/3;position:relative;background:color-mix(in srgb, var(--cit-accent) 12%, var(--cit-surface))}
  .wc-room .wc-im img{width:100%;height:100%;object-fit:cover}
  .wc-room .wc-tag{position:absolute;top:14px;left:14px;background:var(--cit-surface);border-radius:100px;font-size:12px;font-weight:700;padding:6px 14px;color:var(--cit-accent)}
  .wc-room .wc-bd{padding:22px}
  .wc-room h3{font-family:var(--cit-font-display);font-size:22px;margin-bottom:4px}
  .wc-room .wc-mt{font-size:13.5px;color:var(--cit-muted);margin-bottom:12px}
  .wc-room p{font-size:15px;color:var(--cit-muted);margin-bottom:16px}
  .wc-room .wc-ft{display:flex;justify-content:space-between;align-items:center;border-top:1.5px dashed var(--cit-line);padding-top:15px}
  .wc-room .wc-pr{font-family:var(--cit-font-display);font-size:21px;color:var(--cit-accent)}
  .wc-room .wc-ft a{color:var(--cit-accent);font-weight:700;font-size:14px}
  .wc-room .wc-ft a:hover{text-decoration:underline}

  /* highlights — illustrated circles */
  .wc-am{display:grid;gap:22px;grid-template-columns:repeat(2,1fr);margin-top:44px}
  @media(min-width:880px){.wc-am{grid-template-columns:repeat(4,1fr)}}
  .wc-a{text-align:center;background:var(--cit-surface);border-radius:24px;padding:26px 20px;box-shadow:var(--cit-shadow)}
  .wc-a .wc-ic{width:66px;height:66px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center}
  .wc-a .wc-ic svg{width:30px;height:30px;color:var(--cit-accent)}
  .wc-a:nth-child(4n+1) .wc-ic{background:color-mix(in srgb, var(--cit-accent) 16%, var(--cit-surface))}
  .wc-a:nth-child(4n+2) .wc-ic{background:color-mix(in srgb, var(--cit-line) 70%, var(--cit-surface))}
  .wc-a:nth-child(4n+3) .wc-ic{background:color-mix(in srgb, var(--cit-accent) 22%, var(--cit-surface))}
  .wc-a:nth-child(4n+4) .wc-ic{background:color-mix(in srgb, var(--cit-line) 90%, var(--cit-accent))}
  .wc-a strong{display:block;font-family:var(--cit-font-display);font-size:16px;color:var(--cit-ink)}

  /* "one day" timeline — from REAL highlights */
  .wc-day{margin-top:44px;display:grid;gap:24px;grid-template-columns:1fr}
  @media(min-width:880px){.wc-day{grid-template-columns:repeat(4,1fr)}}
  .wc-dy{background:var(--cit-surface);border-radius:24px;padding:24px;box-shadow:var(--cit-shadow)}
  .wc-dy .wc-no{font-family:var(--cit-font-display);font-style:italic;font-size:19px;color:var(--cit-accent);display:block;margin-bottom:8px}
  .wc-dy strong{display:block;font-family:var(--cit-font-display);font-size:17px;color:var(--cit-ink)}

  /* gallery — blob-radius frames (signature c) */
  .wc-gal{display:grid;gap:22px;grid-template-columns:repeat(2,1fr);margin-top:44px}
  @media(min-width:860px){.wc-gal{grid-template-columns:repeat(4,1fr)}}
  .wc-gal figure{aspect-ratio:3/4;overflow:hidden;box-shadow:var(--cit-shadow);background:color-mix(in srgb, var(--cit-accent) 12%, var(--cit-surface))}
  .wc-gal figure:nth-child(odd){border-radius:140px 140px 22px 22px}
  .wc-gal figure:nth-child(even){border-radius:22px 22px 140px 140px}
  .wc-gal img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
  .wc-gal figure:hover img{transform:scale(1.06)}

  /* reviews */
  .wc-revs{display:grid;gap:26px;grid-template-columns:1fr;margin-top:44px}
  @media(min-width:880px){.wc-revs{grid-template-columns:repeat(3,1fr)}}
  .wc-rv{background:var(--cit-bg);border:1px solid var(--cit-line);border-radius:26px;padding:26px;box-shadow:var(--cit-shadow)}
  .wc-rv .wc-st{display:flex;gap:3px;margin-bottom:12px}
  .wc-rv .wc-st svg{width:16px;height:16px;color:var(--cit-accent)}
  .wc-rv p{font-family:var(--cit-font-display);font-style:italic;font-size:17px;color:var(--cit-ink);margin-bottom:16px}
  .wc-rv footer{font-size:13.5px;color:var(--cit-muted);font-weight:600}
  .wc-revscore{display:flex;align-items:center;gap:14px;margin-top:8px}
  .wc-revscore b{font-family:var(--cit-font-display);font-size:44px;color:var(--cit-accent)}
  .wc-revscore .wc-st svg{width:18px;height:18px;color:var(--cit-accent)}
  .wc-revscore span{font-size:13.5px;color:var(--cit-muted)}

  /* faq */
  .wc-faq{max-width:820px;margin-top:40px}
  .wc-faq details{background:var(--cit-surface);border-radius:20px;margin-bottom:14px;box-shadow:var(--cit-shadow)}
  .wc-faq summary{list-style:none;cursor:pointer;padding:18px 24px;font-family:var(--cit-font-display);font-size:18px;display:flex;justify-content:space-between;gap:14px}
  .wc-faq summary::after{content:"+";color:var(--cit-accent);font-size:22px;line-height:1}
  .wc-faq details[open] summary::after{content:"\\2013"}
  .wc-faq details p{padding:0 24px 20px;color:var(--cit-muted);font-size:15.5px}
  .wc-sample{color:var(--cit-muted);font-size:13.5px;margin-top:22px}

  /* contact */
  .wc-loc{display:grid;gap:26px;grid-template-columns:1fr;margin-top:44px;align-items:center}
  @media(min-width:920px){.wc-loc{grid-template-columns:1.1fr .9fr}}
  .wc-conline{display:flex;align-items:center;gap:15px;padding:16px 0;border-top:1px solid var(--cit-line);font-size:16px}
  .wc-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .wc-conline b{font-family:var(--cit-font-display);font-size:17px}
  .wc-conline small{display:block;color:var(--cit-muted);font-size:13px}
  .wc-conphoto img{border-radius:26px;box-shadow:var(--cit-shadow);aspect-ratio:4/3;object-fit:cover;width:100%}

  /* footer */
  .wc-foot{background:var(--cit-surface);border-top:1px solid var(--cit-line);padding:60px 0 28px;color:var(--cit-muted)}
  .wc-fg{display:grid;gap:30px;grid-template-columns:1fr;margin-bottom:36px}
  @media(min-width:800px){.wc-fg{grid-template-columns:2fr 1fr 1fr}}
  .wc-foot h4{font-family:var(--cit-font-display);color:var(--cit-ink);font-size:17px;margin-bottom:14px}
  .wc-foot p{font-size:14.5px;margin-top:12px;max-width:300px}
  .wc-foot a{display:block;padding:5px 0;font-size:14.5px;transition:.2s}
  .wc-foot a:hover{color:var(--cit-accent)}
  .wc-fb{border-top:1px solid var(--cit-line);padding-top:22px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:12.5px}

  /* mobile fixed CTA */
  .wc-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:60;background:color-mix(in srgb, var(--cit-surface) 96%, transparent);border-top:1px solid var(--cit-line);backdrop-filter:blur(10px);padding:12px 16px;gap:12px;align-items:center;justify-content:space-between}
  .wc-mobcta span{font-size:14px;color:var(--cit-ink)}
  .wc-mobcta b{color:var(--cit-accent)}
  @media(max-width:700px){.wc-mobcta{display:flex}body{padding-bottom:64px}}
`;

// Inline wave-divider SVGs (path fill dressed by --cit tokens via the .wc-wavesep classes).
const WAVE_DOWN = `<svg class="wc-wavesep" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30c120 26 240-26 360-4s240 40 360 18 240-40 360-22 240 40 360 24v28H0z"/></svg>`;
const WAVE_UP = `<svg class="wc-wavesep wc-wavesep--up" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true"><path d="M0 34c120-26 240 26 360 4s240-40 360-18 240 40 360 22 240-40 360-24v28H0z"/></svg>`;

// Clean SVG wave-and-sun logo mark (doctrine §B.4: SVG, never an emoji glyph).
const LOGO_SVG = `<svg viewBox="0 0 60 30" aria-hidden="true"><path class="wc-wv" d="M2 20c8-12 16 12 24 0s16 12 24 0"/><circle class="wc-sn" cx="48" cy="8" r="5"/></svg>`;

const WATERCOLOR_JS = `
  (function(){/* progressive enhancement only — the page is fully usable without JS */})();
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderWatercolor(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["watercolor-lake"]!;
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
  const reviewsData = data.reviews?.length ? data.reviews : phase === "mock" ? SAMPLE_REVIEWS : null;
  const reviewsSample = !(data.reviews && data.reviews.length);
  const faqsData = data.faqs?.length ? data.faqs : phase === "mock" ? SAMPLE_FAQS : null;
  const faqsSample = !(data.faqs && data.faqs.length);

  // -- nav ------------------------------------------------------------------
  const navLinks = [
    roomsData ? `<a href="#wc-rooms">${T(data, "Szobák")}</a>` : "",
    data.highlights.length ? `<a href="#wc-services">${T(data, "Szolgáltatások")}</a>` : "",
    data.highlights.length ? `<a href="#wc-day">${T(data, "Egy nap nálunk")}</a>` : "",
    photos.length ? `<a href="#wc-gallery">${T(data, "Galéria")}</a>` : "",
    faqsData ? `<a href="#wc-faq">${T(data, "Kérdések")}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="wc-nav">
    <div class="wc-wrap wc-nv">
      <a class="wc-lg" href="#top">${LOGO_SVG}${esc(data.name)}</a>
      <div class="wc-menu">
        ${navLinks}
      </div>
      ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalás")}</a>` : ""}
    </div>
  </nav>`;

  // -- hero -----------------------------------------------------------------
  const heroVisual = heroPhoto
    ? `<div class="wc-main"><img src="${esc(heroPhoto)}" alt="${esc(data.name)}"></div>`
    : `<div class="wc-main wc-main--flat"></div>`;
  const hero = `<header class="wc-hero" id="top">
    <span class="wc-wash wc-wash--cool wc-w1"></span><span class="wc-wash wc-wash--warm wc-w2"></span>
    <div class="wc-wrap">
      <div class="wc-hgrid">
        <div>
          ${data.contact.address ? `<span class="wc-k">${esc(data.contact.address)}</span>` : ""}
          <h1>${accented(h1, heroCopy.accent)}</h1>
          ${sub ? `<p class="wc-herosub">${esc(sub)}</p>` : ""}
          <div class="wc-heroctas">
            ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
            ${roomsData ? `<a class="cit-btn cit-btn-ghost" href="#wc-rooms">${T(data, "Szobáink")}</a>` : ""}
          </div>
        </div>
        <div class="wc-hvis">
          <span class="wc-sun"></span>
          ${heroVisual}
        </div>
      </div>
      <div class="wc-book">
        ${bookingSlot(data)}
      </div>
    </div>
  </header>`;

  // -- rooms (soft cards) ---------------------------------------------------
  const rooms = roomsData
    ? `${WAVE_DOWN}
  <section class="wc-sec wc-surf" id="wc-rooms">
    <div class="wc-wrap">
      <div class="wc-sechead">
        <span class="wc-eyebrow">${roomCopy.eyebrow ? esc(roomCopy.eyebrow) : T(data, "Szobáink")}</span>
        <h2>${roomCopy.title ? accented(roomCopy.title, roomCopy.accent) : T(data, "Válassz sarkot magadnak")}</h2>
      </div>
      <div class="wc-rooms" data-cit-module="rooms">
        ${roomsData
          .map(
            (r) => `<article class="wc-room">
          <div class="wc-im">${r.photo?.url ? `<img src="${esc(r.photo.url)}" alt="${esc(r.name)}">` : ""}${r.capacity ? `<span class="wc-tag">${esc(r.capacity)}</span>` : ""}</div>
          <div class="wc-bd">
            <h3>${esc(r.name)}</h3>
            ${r.capacity ? `<p class="wc-mt">${esc(r.capacity)}</p>` : ""}
            ${r.note ? `<p>${esc(r.note)}</p>` : ""}
            <div class="wc-ft">
              ${r.price ? `<span class="wc-pr">${esc(r.price)}</span>` : "<span></span>"}
              ${hasContact ? `<a href="#cit-enquiry">${T(data, "Kiválasztom")}</a>` : ""}
            </div>
          </div>
        </article>`,
          )
          .join("\n        ")}
      </div>
      ${roomsSample ? `<p class="wc-sample">${T(data, "Minta — ide a valós szobáid/áraid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- highlights (illustrated circles, real highlights only) --------------
  const amen = data.highlights.length
    ? `${roomsData ? WAVE_UP : ""}
  <section class="wc-sec" id="wc-services">
    <div class="wc-wrap">
      <div class="wc-sechead">
        <span class="wc-eyebrow">${T(data, "Ami jár")}</span>
        <h2>${T(data, "Amiért érdemes betérni")}</h2>
      </div>
      <div class="wc-am">
        ${data.highlights
          .slice(0, 8)
          .map((h) => `<div class="wc-a"><div class="wc-ic">${iconSvg(matchIcon(h))}</div><strong>${esc(h)}</strong></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- "one day" timeline (from REAL highlights — never fabricated events) --
  const dayItems = data.highlights.slice(0, 4);
  const day =
    dayItems.length >= 3
      ? `${WAVE_DOWN}
  <section class="wc-sec wc-surf" id="wc-day">
    <div class="wc-wrap">
      <div class="wc-sechead">
        <span class="wc-eyebrow">${T(data, "Egy nap nálunk")}</span>
        <h2>${T(data, "Így telik majd")}</h2>
      </div>
      <div class="wc-day">
        ${dayItems
          .map(
            (h, i) => `<div class="wc-dy"><span class="wc-no">${String(i + 1).padStart(2, "0")}</span><strong>${esc(h)}</strong></div>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
      : "";

  // -- gallery (blob-radius frames) ----------------------------------------
  const gallery = photos.length
    ? `${day ? WAVE_UP : dayItems.length ? "" : data.highlights.length ? WAVE_DOWN : ""}
  <section class="wc-sec${day ? "" : " wc-surf"}" id="wc-gallery">
    <div class="wc-wrap">
      <div class="wc-sechead">
        <span class="wc-eyebrow">${galCopy.eyebrow ? esc(galCopy.eyebrow) : T(data, "Galéria")}</span>
        <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Képek a nyárból")}</h2>
      </div>
      <div class="wc-gal" data-cit-module="gallery">
        ${photos
          .slice(0, 8)
          .map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews --------------------------------------------------------------
  const stars5 = starCount ? `<div class="wc-st">${starIcon().repeat(starCount)}</div>` : "";
  const reviews = reviewsData
    ? `<section class="wc-sec wc-surf" id="wc-reviews" data-cit-module="reviews">
    <div class="wc-wrap">
      <div class="wc-sechead">
        <span class="wc-eyebrow">${revCopy.eyebrow ? esc(revCopy.eyebrow) : T(data, "Vendégeink")}</span>
        ${
          ratingStat
            ? `<div class="wc-revscore"><b>${esc(ratingStat.value)}</b><div>${stars5}<span>${esc(ratingStat.label)}</span></div></div>`
            : `<h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégeink mondták")}</h2>`
        }
      </div>
      <div class="wc-revs">
        ${reviewsData
          .map(
            (r) =>
              `<div class="wc-rv">${stars5 ? `<div class="wc-st">${starIcon().repeat(starCount)}</div>` : ""}<p>${esc(r.quote)}</p><footer>— ${esc(r.author)}${r.meta ? ` · ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${reviewsSample ? `<p class="wc-sample">${T(data, "Minta — ide a valós vendégértékeléseid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- faq ------------------------------------------------------------------
  const faq = faqsData
    ? `<section class="wc-sec" id="wc-faq">
    <div class="wc-wrap">
      <div class="wc-sechead">
        <span class="wc-eyebrow">${T(data, "Kérdések")}</span>
        <h2>${T(data, "Amit gyakran kérdeztek")}</h2>
      </div>
      <div class="wc-faq">
        ${faqsData
          .map(
            (f, i) =>
              `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
          )
          .join("\n        ")}
      </div>
      ${faqsSample ? `<p class="wc-sample">${T(data, "Minta — ide a saját válaszaid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- contact --------------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="wc-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="wc-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="wc-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const contact = contactLines
    ? `<section class="wc-sec wc-surf" id="wc-contact">
    <div class="wc-wrap">
      <div class="wc-sechead">
        <span class="wc-eyebrow">${T(data, "Ide gyertek")}</span>
        <h2>${T(data, "Megközelítés és kapcsolat")}</h2>
      </div>
      <div class="wc-loc">
        <div>
          ${data.tagline ? `<p class="wc-lead" style="margin-bottom:6px">${esc(data.tagline)}</p>` : ""}
          ${contactLines}
          ${hasContact ? `<a class="cit-btn" style="margin-top:22px" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        </div>
        ${contactPhoto ? `<div class="wc-conphoto"><img src="${esc(contactPhoto)}" alt="${esc(data.name)}"></div>` : ""}
      </div>
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="wc-foot">
    <div class="wc-wrap">
      <div class="wc-fg">
        <div>
          <a class="wc-lg" href="#top">${LOGO_SVG}${esc(data.name)}</a>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Nálunk")}</h4>
          ${roomsData ? `<a href="#wc-rooms">${T(data, "Szobák")}</a>` : ""}
          ${data.highlights.length ? `<a href="#wc-services">${T(data, "Ami jár")}</a>` : ""}
          ${photos.length ? `<a href="#wc-gallery">${T(data, "Galéria")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Jó tudni")}</h4>
          ${faqsData ? `<a href="#wc-faq">${T(data, "Kérdések")}</a>` : ""}
          <a href="#top">${T(data, "Kezdőlap")}</a>
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="wc-fb">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
      </div>
    </div>
  </footer>`;

  const mobcta = hasContact
    ? `<div class="wc-mobcta">
    <span>${ratingStat ? `<b>${esc(ratingStat.value)}</b> · ${esc(ratingStat.label)}` : esc(data.name)}</span>
    <a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalás")}</a>
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
${WATERCOLOR_CSS}
  </style>
</head>
<body class="cit-tpl-watercolor">
    ${nav}
    ${hero}
    ${rooms}
    ${amen}
    ${day}
    ${gallery}
    ${reviews}
    ${faq}
    ${contact}
    ${footer}
    ${mobcta}
    <script>${WATERCOLOR_JS}</script>
</body>
</html>`;
}

export const WATERCOLOR: ArtTemplate = {
  id: "watercolor",
  label: "Akvarell — lágy vízkék-korall, hullám-elválasztók, világos nyári (referencia 21)", // i18n-exempt: operator-facing (console template picker)
  skins: ["watercolor-lake", "coastal-fresh", "sand-cream-airy"],
  render: renderWatercolor,
};
