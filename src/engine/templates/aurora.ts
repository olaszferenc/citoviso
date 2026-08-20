// "aurora" art template (ADR-0027) — the mock_14 "app" reference direction.
// A dark, glassmorphic stay: animated AURORA background blobs, floating glass app-bar,
// a HERO DASHBOARD (left copy + right widget-stack fed ONLY by real data.stats/rating),
// a glass app-style booking bar, glass unit cards, an amenity icon grid, a portrait
// gallery, a glass review band, glass FAQ, a contact split and a rich footer.
// Every color dresses from the 11 --cit-* tokens (+ color-mix / neutral scrims) — even the
// aurora blobs are color-mix() tints of --cit-accent, never a raw hex. The aurora-indigo
// skin is the intended pairing. See templateKit.ts for the shared contract.

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

const AURORA_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.65;overflow-x:hidden}
  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .au-wrap{width:min(1180px,93%);margin:0 auto}
  .au-k{display:inline-block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--cit-accent);margin-bottom:14px}
  .au-h2{font-family:var(--cit-font-display);font-size:clamp(28px,4vw,44px);line-height:1.15;margin-bottom:12px}
  .au-h2 em{font-style:italic;color:var(--cit-accent)}
  .au-lead{color:var(--cit-muted);max-width:560px}
  section.au-sec{padding:84px 0}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);font-weight:700;font-size:15px;padding:15px 30px;border-radius:14px;box-shadow:var(--cit-shadow);transition:.22s;cursor:pointer}
  .cit-btn:hover{filter:brightness(1.12);transform:translateY(-2px)}
  .cit-btn-ghost{background:color-mix(in srgb, var(--cit-ink) 8%, transparent);border:1px solid var(--cit-line);box-shadow:none;color:var(--cit-ink)}
  .cit-btn-ghost:hover{filter:none;border-color:var(--cit-accent);color:var(--cit-accent)}
  .cit-btn-disabled{opacity:.5;pointer-events:none}

  /* AURORA background — color-mix tints of the accent token (never a raw hex) */
  .au-aurora{position:fixed;inset:-20%;z-index:0;filter:blur(90px);opacity:.42;pointer-events:none}
  .au-aurora i{position:absolute;border-radius:50%}
  .au-aurora i:nth-child(1){width:55vw;height:55vw;background:color-mix(in srgb, var(--cit-accent) 78%, transparent);top:-12%;left:-10%;animation:au-b1 22s ease-in-out infinite alternate}
  .au-aurora i:nth-child(2){width:45vw;height:45vw;background:color-mix(in srgb, var(--cit-accent) 40%, var(--cit-surface));bottom:-10%;right:-8%;animation:au-b2 26s ease-in-out infinite alternate}
  .au-aurora i:nth-child(3){width:34vw;height:34vw;background:color-mix(in srgb, var(--cit-accent) 55%, var(--cit-ink));top:34%;left:52%;animation:au-b3 30s ease-in-out infinite alternate}
  @keyframes au-b1{to{transform:translate(9vw,12vh)}}
  @keyframes au-b2{to{transform:translate(-10vw,-9vh)}}
  @keyframes au-b3{to{transform:translate(-8vw,10vh)}}
  @media(prefers-reduced-motion:reduce){.au-aurora i{animation:none}}
  body>*:not(.au-aurora){position:relative;z-index:1}

  /* glass helper */
  .au-glass{background:color-mix(in srgb, var(--cit-surface) 42%, transparent);border:1px solid color-mix(in srgb, var(--cit-ink) 12%, transparent);border-radius:var(--cit-radius);backdrop-filter:blur(18px)}

  /* NAV — floating app bar */
  .au-nav{position:fixed;top:14px;left:0;right:0;z-index:100}
  .au-nv{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 10px 20px;border-radius:16px}
  .au-brand{font-family:var(--cit-font-display);font-weight:800;font-size:18px;letter-spacing:-.02em;color:var(--cit-ink)}
  .au-brand span{color:var(--cit-accent)}
  .au-menu{display:none;gap:4px;align-items:center}
  @media(min-width:920px){.au-menu{display:flex}}
  .au-menu a{color:var(--cit-muted);font-size:13.5px;font-weight:600;padding:9px 15px;border-radius:10px;transition:.2s}
  .au-menu a:hover{color:var(--cit-ink);background:color-mix(in srgb, var(--cit-ink) 7%, transparent)}
  .au-navbk{color:var(--cit-on-accent);background:var(--cit-accent);font-weight:700;font-size:13.5px;padding:11px 20px;border-radius:12px;transition:.2s}
  .au-navbk:hover{filter:brightness(1.12)}

  /* HERO — dashboard composition */
  .au-hero{padding:120px 0 60px}
  .au-herogrid{display:grid;gap:22px;grid-template-columns:1fr}
  @media(min-width:960px){.au-herogrid.au-has-widgets{grid-template-columns:1.1fr .9fr;align-items:center}}
  .au-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--cit-line);border-radius:100px;padding:7px 15px;font-size:12.5px;font-weight:600;color:var(--cit-muted);margin-bottom:20px}
  .au-pill i{width:7px;height:7px;border-radius:50%;background:var(--cit-accent);box-shadow:0 0 10px var(--cit-accent);animation:au-pulse 2.4s ease-in-out infinite}
  @keyframes au-pulse{50%{opacity:.4}}
  @media(prefers-reduced-motion:reduce){.au-pill i{animation:none}}
  .au-hero h1{font-family:var(--cit-font-display);font-weight:800;font-size:clamp(36px,5.6vw,62px);line-height:1.12;letter-spacing:-.02em;margin-bottom:18px}
  .au-hero h1 em{font-style:italic;color:var(--cit-accent)}
  .au-herosub{color:var(--cit-muted);max-width:480px;margin-bottom:28px}
  .au-heroctas{display:flex;gap:12px;flex-wrap:wrap}
  .au-widgets{display:grid;gap:16px}
  .au-wimg{aspect-ratio:16/10;border-radius:var(--cit-radius);overflow:hidden;border:1px solid var(--cit-line)}
  .au-wimg img{width:100%;height:100%;object-fit:cover}
  .au-wrow{display:grid;gap:16px;grid-template-columns:1fr 1fr}
  @media(max-width:460px){.au-wrow{grid-template-columns:1fr}}
  .au-widget{padding:18px}
  .au-widget .au-wl{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--cit-muted);margin-bottom:8px}
  .au-widget .au-wv{font-family:var(--cit-font-display);font-size:22px;font-weight:800;display:flex;align-items:baseline;gap:8px}
  .au-widget .au-wv small{font-size:12px;color:var(--cit-muted);font-weight:600}
  .au-widget .au-wv svg{width:20px;height:20px;color:var(--cit-accent);align-self:center}
  .au-widget .au-bar{height:6px;border-radius:3px;background:color-mix(in srgb, var(--cit-ink) 10%, transparent);margin-top:10px;overflow:hidden}
  .au-widget .au-bar i{display:block;height:100%;background:var(--cit-accent)}

  /* BOOKING — glass app bar */
  .au-book{padding:0 0 26px;margin-top:-30px}
  .au-bookcard{padding:14px clamp(14px,3vw,22px)}
  .au-bookcard .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1rem .4rem}
  .au-bookcard .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.2rem;color:var(--cit-ink)}

  /* UNITS — glass app cards */
  .au-apts{display:grid;gap:20px;grid-template-columns:1fr;margin-top:42px}
  @media(min-width:880px){.au-apts{grid-template-columns:repeat(3,1fr)}}
  .au-apt{overflow:hidden;transition:transform .25s,border-color .25s}
  .au-apt:hover{transform:translateY(-5px);border-color:color-mix(in srgb, var(--cit-accent) 60%, transparent)}
  .au-apt .au-im{aspect-ratio:16/10;position:relative;overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .au-apt .au-im img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
  .au-apt:hover .au-im img{transform:scale(1.05)}
  .au-apt .au-bdg{position:absolute;top:12px;left:12px;background:color-mix(in srgb, var(--cit-bg) 72%, transparent);backdrop-filter:blur(8px);border:1px solid var(--cit-line);border-radius:100px;font-size:11.5px;font-weight:700;padding:6px 12px}
  .au-apt .au-bd{padding:20px}
  .au-apt h3{font-family:var(--cit-font-display);font-size:19px;margin-bottom:4px}
  .au-apt .au-mt{font-size:13px;color:var(--cit-muted);margin-bottom:14px}
  .au-apt .au-row{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--cit-line);padding-top:15px;gap:12px}
  .au-apt .au-pr{font-family:var(--cit-font-display);font-size:19px;font-weight:800;color:var(--cit-accent)}
  .au-apt a.au-go{font-weight:700;font-size:13.5px;background:color-mix(in srgb, var(--cit-ink) 8%, transparent);border:1px solid var(--cit-line);padding:10px 16px;border-radius:10px;transition:.2s}
  .au-apt a.au-go:hover{background:var(--cit-accent);color:var(--cit-on-accent);border-color:transparent}

  /* SERVICES — icon grid */
  .au-svc{display:grid;gap:16px;grid-template-columns:repeat(2,1fr);margin-top:42px}
  @media(min-width:880px){.au-svc{grid-template-columns:repeat(4,1fr)}}
  .au-sv{padding:22px}
  .au-sv .au-ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb, var(--cit-accent) 22%, transparent);border:1px solid var(--cit-line);margin-bottom:14px}
  .au-sv .au-ic svg{width:22px;height:22px;color:var(--cit-accent)}
  .au-sv strong{display:block;font-size:15px}

  /* GALLERY */
  .au-gal{display:grid;gap:16px;grid-template-columns:repeat(2,1fr);margin-top:42px}
  @media(min-width:860px){.au-gal{grid-template-columns:repeat(4,1fr)}}
  .au-gal figure{border-radius:16px;overflow:hidden;border:1px solid var(--cit-line);aspect-ratio:3/4;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .au-gal img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
  .au-gal figure:hover img{transform:scale(1.06)}

  /* REVIEWS */
  .au-revhead{display:flex;flex-wrap:wrap;align-items:center;gap:16px}
  .au-revscore{display:flex;align-items:center;gap:12px}
  .au-revscore b{font-family:var(--cit-font-display);font-size:40px;color:var(--cit-accent)}
  .au-stars{display:flex;gap:3px}
  .au-stars svg{width:17px;height:17px;color:var(--cit-accent)}
  .au-revscore span{font-size:13px;color:var(--cit-muted)}
  .au-revs{display:grid;gap:20px;grid-template-columns:1fr;margin-top:42px}
  @media(min-width:880px){.au-revs{grid-template-columns:repeat(3,1fr)}}
  .au-rv{padding:24px}
  .au-rv p{font-family:var(--cit-font-display);font-style:italic;font-size:15px;line-height:1.55;margin-bottom:16px}
  .au-rv footer{font-size:13px;color:var(--cit-accent)}

  /* FAQ */
  .au-faq{max-width:820px;margin-top:36px}
  .au-faq details{margin-bottom:10px;overflow:hidden}
  .au-faq summary{list-style:none;cursor:pointer;padding:17px 20px;font-family:var(--cit-font-display);font-weight:700;font-size:15px;display:flex;justify-content:space-between;gap:14px}
  .au-faq summary::after{content:"+";color:var(--cit-accent)}
  .au-faq details[open] summary::after{content:"−"}
  .au-faq details p{padding:0 20px 17px;color:var(--cit-muted);font-size:14.5px}

  /* CONTACT split */
  .au-congrid{display:grid;gap:20px;grid-template-columns:1fr;margin-top:42px;align-items:center}
  @media(min-width:900px){.au-congrid{grid-template-columns:1.1fr .9fr}}
  .au-conphoto{border-radius:var(--cit-radius);overflow:hidden;border:1px solid var(--cit-line);aspect-ratio:4/3;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .au-conphoto img{width:100%;height:100%;object-fit:cover}
  .au-concard{padding:26px}
  .au-conline{display:flex;align-items:center;gap:15px;padding:14px 0;border-top:1px solid var(--cit-line);font-size:15px}
  .au-conline:first-child{border-top:none}
  .au-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .au-conline b{font-family:var(--cit-font-display);font-size:16px}
  .au-conline small{color:var(--cit-muted);font-size:13px;display:block}

  /* FOOTER */
  .au-foot{border-top:1px solid var(--cit-line);padding:54px 0 28px;background:color-mix(in srgb, var(--cit-surface) 22%, transparent)}
  .au-fg{display:grid;gap:30px;grid-template-columns:1fr;margin-bottom:36px}
  @media(min-width:800px){.au-fg{grid-template-columns:2fr 1fr 1fr}}
  .au-foot .au-brand{font-size:20px}
  .au-foot p{max-width:280px;font-size:14px;color:var(--cit-muted);margin-top:12px}
  .au-foot h4{font-size:12.5px;text-transform:uppercase;letter-spacing:2px;color:var(--cit-muted);margin-bottom:14px}
  .au-foot a{display:block;padding:4px 0;font-size:14px;color:var(--cit-ink);transition:.2s}
  .au-foot a:hover{color:var(--cit-accent)}
  .au-fb{border-top:1px solid var(--cit-line);padding-top:20px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:12px;color:var(--cit-muted)}

  /* mobile fixed CTA */
  .au-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:120;background:color-mix(in srgb, var(--cit-bg) 90%, transparent);border-top:1px solid var(--cit-line);backdrop-filter:blur(12px);padding:12px 16px;gap:12px;align-items:center;justify-content:space-between}
  .au-mobcta span{font-size:14px;color:var(--cit-ink)}
  .au-mobcta b{color:var(--cit-accent)}
  @media(max-width:700px){.au-mobcta{display:flex}body{padding-bottom:64px}}

  .au-sample{text-align:center;font-size:12.5px;color:var(--cit-muted);letter-spacing:.5px;margin-top:28px}
`;

// Progressive enhancement only — the page is complete without it (condenses the app bar on scroll).
const AURORA_JS = `
  (function(){var n=document.querySelector('.au-nv');if(!n)return;
  addEventListener('scroll',function(){n.style.background=scrollY>40?'color-mix(in srgb, var(--cit-surface) 62%, transparent)':'';},{passive:true});})();
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderAurora(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["aurora-indigo"]!;
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

  // §B.17: hero widgets come ONLY from REAL data.stats — never a fabricated number.
  const statWidgets = (data.stats ?? []).slice(0, 2);
  const hasWidgets = statWidgets.length > 0 || Boolean(heroPhoto);

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
    roomsData ? `<a href="#au-rooms">${T(data, "Szobák")}</a>` : "",
    data.highlights.length ? `<a href="#au-services">${T(data, "Szolgáltatások")}</a>` : "",
    photos.length ? `<a href="#au-gallery">${T(data, "Galéria")}</a>` : "",
    reviewsData ? `<a href="#au-reviews">${T(data, "Vélemények")}</a>` : "",
    faqsData ? `<a href="#au-faq">${T(data, "GYIK")}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="au-nav">
    <div class="au-wrap">
      <div class="au-glass au-nv">
        <a class="au-brand" href="#top">${esc(data.name)}<span>.</span></a>
        <div class="au-menu">
          ${navLinks}
        </div>
        ${hasContact ? `<a class="au-navbk" href="#cit-enquiry">${T(data, "Foglalás")}</a>` : ""}
      </div>
    </div>
  </nav>`;

  // -- hero (dashboard) -----------------------------------------------------
  const widgetStack = hasWidgets
    ? `<div class="au-widgets">
        ${heroPhoto ? `<div class="au-wimg"><img src="${esc(heroPhoto)}" alt="${esc(data.name)}"></div>` : ""}
        ${
          statWidgets.length
            ? `<div class="au-wrow">
          ${statWidgets
            .map(
              (s) => `<div class="au-glass au-widget">
            <p class="au-wl">${esc(s.label)}</p>
            <p class="au-wv">${s.icon === "star" ? starIcon() : ""}${esc(s.value)}</p>
            <div class="au-bar"><i></i></div>
          </div>`,
            )
            .join("\n          ")}
        </div>`
            : ""
        }
      </div>`
    : "";
  const hero = `<header class="au-hero" id="top">
    <div class="au-wrap">
      <div class="au-herogrid${hasWidgets ? " au-has-widgets" : ""}">
        <div>
          ${heroCopy.eyebrow ? `<span class="au-pill"><i></i> ${esc(heroCopy.eyebrow)}</span>` : ""}
          <h1>${accented(h1, heroCopy.accent)}</h1>
          ${sub ? `<p class="au-herosub">${esc(sub)}</p>` : ""}
          <div class="au-heroctas">
            ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
            ${roomsData ? `<a class="cit-btn cit-btn-ghost" href="#au-rooms">${T(data, "Szobáink")}</a>` : ""}
          </div>
        </div>
        ${widgetStack}
      </div>
    </div>
  </header>`;

  // -- booking (glass app bar) ---------------------------------------------
  const bookbar = `<div class="au-book">
    <div class="au-wrap">
      <div class="au-glass au-bookcard">
        ${bookingSlot(data)}
      </div>
    </div>
  </div>`;

  // -- units (glass cards) --------------------------------------------------
  const rooms = roomsData
    ? `<section class="au-sec" id="au-rooms">
    <div class="au-wrap">
      ${roomCopy.eyebrow ? `<span class="au-k">${esc(roomCopy.eyebrow)}</span>` : `<span class="au-k">${T(data, "Szobák")}</span>`}
      <h2 class="au-h2">${roomCopy.title ? accented(roomCopy.title, roomCopy.accent) : T(data, "Válassz méretet — a minőség fix")}</h2>
      <div class="au-apts" data-cit-module="rooms">
        ${roomsData
          .map(
            (r) => `<article class="au-glass au-apt">
          <div class="au-im">${r.photo?.url ? `<img src="${esc(r.photo.url)}" alt="${esc(r.name)}">` : ""}${r.capacity ? `<span class="au-bdg">${esc(r.capacity)}</span>` : ""}</div>
          <div class="au-bd">
            <h3>${esc(r.name)}</h3>
            ${r.note ? `<p class="au-mt">${esc(r.note)}</p>` : ""}
            <div class="au-row">
              ${r.price ? `<span class="au-pr">${esc(r.price)}</span>` : "<span></span>"}
              ${hasContact ? `<a class="au-go" href="#cit-enquiry">${T(data, "Érdeklődés")}</a>` : ""}
            </div>
          </div>
        </article>`,
          )
          .join("\n        ")}
      </div>
      ${roomsSample ? `<p class="au-sample">${T(data, "Minta — ide a valós szobáid/áraid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- services (real highlights only) -------------------------------------
  const services = data.highlights.length
    ? `<section class="au-sec" id="au-services">
    <div class="au-wrap">
      <span class="au-k">${T(data, "Szolgáltatások")}</span>
      <h2 class="au-h2">${T(data, "Amiért érdemes betérni")}</h2>
      <div class="au-svc">
        ${data.highlights
          .slice(0, 8)
          .map(
            (h) =>
              `<div class="au-glass au-sv"><div class="au-ic">${iconSvg(matchIcon(h))}</div><strong>${esc(h)}</strong></div>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- gallery --------------------------------------------------------------
  const gallery = photos.length
    ? `<section class="au-sec" id="au-gallery">
    <div class="au-wrap">
      ${galCopy.eyebrow ? `<span class="au-k">${esc(galCopy.eyebrow)}</span>` : `<span class="au-k">${T(data, "Galéria")}</span>`}
      <h2 class="au-h2">${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Nézz körül")}</h2>
      <div class="au-gal" data-cit-module="gallery">
        ${photos
          .slice(0, 8)
          .map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews --------------------------------------------------------------
  const stars5 = starCount ? `<div class="au-stars">${starIcon().repeat(starCount)}</div>` : "";
  const reviews = reviewsData
    ? `<section class="au-sec" id="au-reviews" data-cit-module="reviews">
    <div class="au-wrap">
      ${revCopy.eyebrow ? `<span class="au-k">${esc(revCopy.eyebrow)}</span>` : `<span class="au-k">${T(data, "Vélemények")}</span>`}
      ${
        ratingStat
          ? `<div class="au-revhead"><div class="au-revscore"><b>${esc(ratingStat.value)}</b><div>${stars5}<span>${esc(ratingStat.label)}</span></div></div></div>`
          : `<h2 class="au-h2">${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégeink")}</h2>`
      }
      <div class="au-revs">
        ${reviewsData
          .map(
            (r) =>
              `<div class="au-glass au-rv"><p>${esc(r.quote)}</p><footer>— ${esc(r.author)}${r.meta ? `, ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${reviewsSample ? `<p class="au-sample">${T(data, "Minta — ide a valós vendégértékeléseid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- faq ------------------------------------------------------------------
  const faq = faqsData
    ? `<section class="au-sec" id="au-faq">
    <div class="au-wrap">
      <span class="au-k">${T(data, "GYIK")}</span>
      <h2 class="au-h2">${T(data, "Gyors válaszok")}</h2>
      <div class="au-faq">
        ${faqsData
          .map(
            (f, i) =>
              `<details class="au-glass"${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
          )
          .join("\n        ")}
      </div>
      ${faqsSample ? `<p class="au-sample">${T(data, "Minta — ide a saját válaszaid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- contact --------------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="au-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="au-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="au-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const contact = contactLines
    ? `<section class="au-sec" id="au-contact">
    <div class="au-wrap">
      <span class="au-k">${T(data, "Kapcsolat")}</span>
      <h2 class="au-h2">${T(data, "Megközelítés és kapcsolat")}</h2>
      <div class="au-congrid">
        ${contactPhoto ? `<div class="au-conphoto"><img src="${esc(contactPhoto)}" alt="${esc(data.name)}"></div>` : "<div></div>"}
        <div class="au-glass au-concard">
          ${contactLines}
          ${hasContact ? `<a class="cit-btn" style="margin-top:20px" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        </div>
      </div>
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="au-foot">
    <div class="au-wrap">
      <div class="au-fg">
        <div>
          <span class="au-brand">${esc(data.name)}<span>.</span></span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Felfedezés")}</h4>
          ${roomsData ? `<a href="#au-rooms">${T(data, "Szobák")}</a>` : ""}
          ${data.highlights.length ? `<a href="#au-services">${T(data, "Szolgáltatások")}</a>` : ""}
          ${photos.length ? `<a href="#au-gallery">${T(data, "Galéria")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Infó")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
          ${faqsData ? `<a href="#au-faq">${T(data, "GYIK")}</a>` : ""}
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="au-fb">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
      </div>
    </div>
  </footer>`;

  const mobcta = hasContact
    ? `<div class="au-mobcta">
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
${AURORA_CSS}
  </style>
</head>
<body class="cit-tpl-aurora">
    <div class="au-aurora" aria-hidden="true"><i></i><i></i><i></i></div>
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
    ${mobcta}
    <script>${AURORA_JS}</script>
</body>
</html>`;
}

export const AURORA: ArtTemplate = {
  id: "aurora",
  label: "Aurora — sötét üveg app, animált aurora háttér + hero-dashboard (referencia 14)", // i18n-exempt: operator-facing (console template picker)
  skins: ["aurora-indigo", "night-azure-gold", "forest-night"],
  render: renderAurora,
};
