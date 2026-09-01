// "cinematic" art template (ADR-0027) — the mock_12 "movie screen" reference direction.
// A LIGHT, editorial stay: a Ken-Burns CROSSFADE hero built from the property's first photos,
// with a STICKY booking DOCK slid onto the hero's lower edge (the signature move), then room
// cards, an amenity grid, a mosaic gallery, a review band, an optional FAQ, a contact split
// and a rich footer. All styling dresses from the 11 --cit-* tokens (+ color-mix / neutral
// scrims) — the cinematic-navy skin (cream base, dark hero) is the intended pairing. The mock's
// AI-concierge widget and "local guide" map tabs are NOT rendered (fabricated / non-data). See
// templateKit.ts for the shared contract.

import { iconSvg, matchIcon, starIcon } from "../icons.js";
import { amenityIconSvg } from "../amenityIcon.js";
import { slotMarker } from "../moduleSections.js";
import { SAMPLE_FAQS } from "../primitives.js";
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
  mastheadCss,
  mastheadHtml,
  photoFill,
  sampleRooms,
  T,
  type ArtTemplate,
  type MastheadLink,
} from "../templateKit.js";

const CINEMATIC_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.65}

  /* shared module sections (.cit-modsec) dressed to match this template's rhythm (ADR-0057) */
  body.cit-tpl-cinematic{
    --cit-modsec-py:96px;
    --cit-modsec-maxw:1200px;
    --cit-modsec-px:28px;
    --cit-modsec-divider:0;
    --cit-modsec-head-align:left;
    --cit-modsec-head-mb:46px;
    --cit-modsec-head-size:clamp(28px,4vw,44px);
    --cit-modsec-head-weight:600;
    --cit-modsec-card-radius:var(--cit-radius);
    --cit-modsec-card-pad:22px}

  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .cn-wrap{width:min(1200px,93%);margin:0 auto}
  .cn-eyebrow{font-size:12px;letter-spacing:4px;text-transform:uppercase;color:var(--cit-accent);font-weight:600}
  section.cn-sec{padding:96px 0}
  .cn-sechead{max-width:600px;margin-bottom:46px}
  .cn-sechead h2{font-family:var(--cit-font-display);font-weight:600;font-size:clamp(28px,4vw,44px);line-height:1.14;margin-top:14px}
  .cn-sechead h2 em{font-style:italic;color:var(--cit-accent)}
  .cn-sechead p{color:var(--cit-muted);max-width:560px;margin-top:12px}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);padding:14px 30px;letter-spacing:1px;text-transform:uppercase;font-size:13px;font-weight:700;border-radius:var(--cit-radius);transition:.25s;cursor:pointer}
  .cit-btn:hover{filter:brightness(1.08);transform:translateY(-2px)}
  .cit-btn-ghost{background:transparent;color:var(--cit-ink);border:1px solid color-mix(in srgb, var(--cit-ink) 32%, transparent)}
  .cit-btn-ghost:hover{border-color:var(--cit-accent);color:var(--cit-accent);filter:none}
  .cit-btn-disabled{opacity:.5;pointer-events:none}

  /* nav — the SCROLLED state only (masthead contract): hidden at the top, where the
     centered masthead owns the name; condenses in as the light bar on scroll */
  .cn-nav{position:fixed;inset:0 0 auto 0;z-index:120;transition:.3s;padding:18px 0;
    opacity:0;pointer-events:none;transform:translateY(-10px)}
  .cn-nav .cn-brand,.cn-nav .cn-navlinks a{color:color-mix(in srgb, white 90%, transparent)}
  .cn-nav.cn-on{opacity:1;pointer-events:auto;transform:none;
    background:color-mix(in srgb, var(--cit-surface) 96%, transparent);backdrop-filter:blur(12px);box-shadow:0 2px 18px rgba(0,0,0,.12);padding:12px 0}

  /* masthead dialect (owner contract 2026-08-30): film-title voice, accent kicker subline */
  .cit-mast{--mast-track:1.5px;--mast-sub:color-mix(in srgb, var(--cit-accent) 88%, white)}
  body.cit-tpl-cinematic .cit-mast-links{max-width:800px}
  .cn-nav.cn-on .cn-brand,.cn-nav.cn-on .cn-navlinks a{color:var(--cit-ink)}
  .cn-nav .cn-wrap{display:flex;align-items:center;justify-content:space-between}
  .cn-brand{font-family:var(--cit-font-display);font-size:20px;letter-spacing:1px;transition:.3s}
  .cn-navlinks{display:flex;gap:28px;align-items:center}
  .cn-navlinks a{font-size:14px;font-weight:500;transition:.25s}
  .cn-navlinks a:hover{color:var(--cit-accent)}
  @media(max-width:900px){.cn-navlinks a:not(.cit-btn){display:none}}

  /* cinematic hero — Ken-Burns crossfade */
  .cn-cine{position:relative;height:100svh;min-height:640px;overflow:hidden;display:flex;align-items:flex-end;color:white}
  .cn-slide{position:absolute;inset:0;opacity:0;transition:opacity 1.6s ease}
  .cn-slide:first-child,.cn-slide.cn-vis{opacity:1}
  .cn-slide .cn-im{width:100%;height:100%;background-size:cover;background-position:center;animation:cn-kb 14s ease-in-out infinite alternate}
  .cn-slide--flat{background:linear-gradient(155deg, color-mix(in srgb, var(--cit-ink) 82%, black), color-mix(in srgb, var(--cit-accent) 44%, var(--cit-ink)))}
  @keyframes cn-kb{from{transform:scale(1) translate(0,0)}to{transform:scale(1.12) translate(-1.5%,1.5%)}}
  @media(prefers-reduced-motion:reduce){.cn-slide .cn-im{animation:none}}
  /* scrim darkens BOTH ends (masthead contract): the top carries the name lockup.
     Lower band strengthened for a legible accent headline on a BRIGHT photo
     (contract: design-refs/engine/hero-contrast, guard: hero-contrast-check). */
  .cn-cine::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.2) 38%, rgba(0,0,0,.6) 66%, rgba(0,0,0,.9) 100%);pointer-events:none}
  .cn-cinein{position:relative;z-index:2;width:100%;padding-bottom:150px}
  .cn-cine h1{font-family:var(--cit-font-display);font-weight:600;font-size:clamp(38px,6.4vw,74px);line-height:1.06;max-width:16ch;margin:16px 0 16px}
  .cn-cine h1 em{font-style:italic;color:color-mix(in srgb, var(--cit-accent) 88%, white)}
  .cn-cinesub{max-width:480px;color:color-mix(in srgb, white 88%, transparent);margin-bottom:28px}
  .cn-heroctas{display:flex;gap:14px;flex-wrap:wrap}
  .cn-heroctas .cit-btn-ghost{color:white;border-color:color-mix(in srgb, white 55%, transparent)}
  .cn-heroctas .cit-btn-ghost:hover{border-color:var(--cit-accent);color:var(--cit-accent)}
  .cn-dots{position:absolute;bottom:120px;right:5%;z-index:3;display:flex;gap:8px}
  .cn-dots button{width:34px;height:4px;border:none;background:color-mix(in srgb, white 40%, transparent);cursor:pointer;padding:0;transition:.3s}
  .cn-dots button.cn-vis{background:var(--cit-accent)}

  /* sticky booking dock — slid onto the hero's lower edge */
  .cn-dock{position:sticky;top:0;z-index:110;background:var(--cit-surface);border:1px solid var(--cit-line);box-shadow:0 10px 30px rgba(0,0,0,.14);margin:-84px auto 0;width:min(1200px,93%);border-radius:var(--cit-radius)}
  .cn-dock .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem clamp(16px,3vw,24px)}
  .cn-dock .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.3rem;color:var(--cit-ink)}
  /* mobile: never pin the tall booking form — it would cover the whole viewport (matches parallax .t-dock) */
  @media(max-width:700px){.cn-dock{position:static}}

  /* room cards */
  .cn-rooms{display:grid;gap:26px;grid-template-columns:1fr;margin-top:46px}
  @media(min-width:880px){.cn-rooms{grid-template-columns:repeat(3,1fr)}}
  .cn-rc{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);overflow:hidden;display:flex;flex-direction:column;transition:.25s}
  .cn-rc:hover{box-shadow:0 16px 40px rgba(0,0,0,.12);transform:translateY(-4px)}
  .cn-rc .cn-im2{aspect-ratio:16/10;overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .cn-rc .cn-im2 img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
  .cn-rc:hover .cn-im2 img{transform:scale(1.05)}
  .cn-rc .cn-bd{padding:22px;display:flex;flex-direction:column;flex:1}
  .cn-rc h3{font-family:var(--cit-font-display);font-size:21px;margin-bottom:6px}
  .cn-rc .cn-mt{font-size:13px;color:var(--cit-accent);margin-bottom:12px}
  .cn-rc p{font-size:14px;color:var(--cit-muted);margin-bottom:16px}
  .cn-rc .cn-ft{margin-top:auto;border-top:1px solid var(--cit-line);padding-top:16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .cn-rc .cn-pr{font-family:var(--cit-font-display);font-size:19px;color:var(--cit-accent)}
  .cn-sample{font-size:12.5px;color:var(--cit-muted);letter-spacing:.5px;margin-top:26px}

  /* amenity grid */
  .cn-exp{display:grid;gap:18px;grid-template-columns:1fr;margin-top:46px}
  @media(min-width:560px){.cn-exp{grid-template-columns:1fr 1fr}}
  @media(min-width:900px){.cn-exp{grid-template-columns:repeat(4,1fr)}}
  .cn-ex{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);padding:26px 22px;transition:.3s}
  .cn-ex:hover{border-color:var(--cit-accent);transform:translateY(-4px)}
  .cn-ex svg{width:30px;height:30px;color:var(--cit-accent);margin-bottom:14px}
  .cn-ex p{font-size:14.5px;color:color-mix(in srgb, var(--cit-ink) 84%, transparent)}

  /* mosaic gallery */
  .cn-mosaic{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:220px;gap:14px;margin-top:46px}
  .cn-mosaic figure{position:relative;border-radius:var(--cit-radius);overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .cn-mosaic img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
  .cn-mosaic figure:hover img{transform:scale(1.05)}
  .cn-mosaic figure:nth-child(1){grid-column:span 2;grid-row:span 2}
  .cn-mosaic figure:nth-child(4){grid-row:span 2}
  @media(max-width:760px){.cn-mosaic{grid-template-columns:1fr 1fr;grid-auto-rows:180px}.cn-mosaic figure:nth-child(1){grid-column:span 2}}

  /* review band */
  .cn-rev{background:color-mix(in srgb, var(--cit-bg) 94%, black);border-top:1px solid var(--cit-line);border-bottom:1px solid var(--cit-line)}
  .cn-revscore{display:flex;align-items:center;gap:14px;margin-top:14px}
  .cn-revscore b{font-family:var(--cit-font-display);font-size:44px;color:var(--cit-accent)}
  .cn-stars{display:flex;gap:3px}
  .cn-stars svg{width:18px;height:18px;color:var(--cit-accent)}
  .cn-revscore span{font-size:13.5px;color:var(--cit-muted)}
  .cn-rev3{display:grid;gap:22px;grid-template-columns:1fr;margin-top:36px}
  @media(min-width:880px){.cn-rev3{grid-template-columns:repeat(3,1fr)}}
  .cn-rv{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);padding:26px}
  .cn-rv p{font-family:var(--cit-font-display);font-style:italic;font-size:16px;line-height:1.5;margin-bottom:16px}
  .cn-rv footer{font-size:13px;color:var(--cit-accent)}

  /* faq */
  .cn-faq{max-width:820px;margin-top:36px}
  .cn-faq details{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);margin-bottom:10px}
  .cn-faq summary{list-style:none;cursor:pointer;padding:18px 20px;font-family:var(--cit-font-display);font-size:18px;display:flex;justify-content:space-between;gap:14px}
  .cn-faq summary::after{content:"+";color:var(--cit-accent);font-size:20px}
  .cn-faq details[open] summary::after{content:"−"}
  .cn-faq details p{padding:0 20px 18px;color:var(--cit-muted);font-size:14.5px}

  /* contact split */
  .cn-cwrap{display:grid;gap:56px;grid-template-columns:1fr;align-items:center;margin-top:46px}
  @media(min-width:860px){.cn-cwrap{grid-template-columns:1fr 1fr}}
  .cn-conline{display:flex;align-items:center;gap:15px;padding:16px 0;border-top:1px solid var(--cit-line);font-size:16px}
  .cn-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .cn-conline b{font-family:var(--cit-font-display);font-size:17px}
  .cn-conline small{color:var(--cit-muted);font-size:13px;display:block}
  .cn-conphoto img{border-radius:var(--cit-radius);box-shadow:var(--cit-shadow);aspect-ratio:4/3;object-fit:cover;width:100%}

  /* footer */
  .cn-foot{background:color-mix(in srgb, var(--cit-ink) 92%, black);color:color-mix(in srgb, white 66%, transparent);padding:60px 0 30px;font-size:14px}
  .cn-footgrid{display:grid;gap:32px;grid-template-columns:1fr;padding-bottom:40px;border-bottom:1px solid color-mix(in srgb, white 14%, transparent)}
  @media(min-width:800px){.cn-footgrid{grid-template-columns:2fr 1fr 1fr}}
  .cn-foot .cn-brand{font-family:var(--cit-font-display);font-size:20px;color:white}
  .cn-foot p{margin-top:12px;max-width:300px}
  .cn-foot h4{color:white;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px}
  .cn-foot a{display:block;padding:4px 0;transition:.2s}
  .cn-foot a:hover{color:var(--cit-accent)}
  .cn-footlegal{padding-top:22px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:12.5px}

  /* mobile fixed CTA */
  .cn-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:130;background:color-mix(in srgb, var(--cit-surface) 96%, black);border-top:1px solid var(--cit-line);backdrop-filter:blur(10px);padding:12px 16px;gap:12px;align-items:center;justify-content:space-between}
  .cn-mobcta span{font-size:14px;color:var(--cit-ink)}
  .cn-mobcta b{color:var(--cit-accent)}
  @media(max-width:700px){.cn-mobcta{display:flex}body{padding-bottom:64px}}
`;

const CINEMATIC_JS = `
  (function(){
    var n=document.querySelector('.cn-nav');
    if(n)addEventListener('scroll',function(){n.classList.toggle('cn-on',scrollY>70)},{passive:true});
    var slides=[].slice.call(document.querySelectorAll('.cn-slide'));
    var dots=[].slice.call(document.querySelectorAll('.cn-dots button'));
    if(slides.length<2)return;
    var cur=0;
    function show(i){cur=i;slides.forEach(function(s,j){s.classList.toggle('cn-vis',j===i)});dots.forEach(function(d,j){d.classList.toggle('cn-vis',j===i)});}
    dots.forEach(function(d,j){d.addEventListener('click',function(){show(j)})});
    setInterval(function(){show((cur+1)%slides.length)},6000);
  })();
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderCinematic(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["cinematic-navy"]!;
  const heroCopy = copyOf(recipe, "hero");
  const roomCopy = copyOf(recipe, "rooms");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const heroPhotos = photos.slice(0, 3);
  const contactPhoto = photos[3]?.url ?? photos[photos.length - 1]?.url ?? "";
  const hasContact = Boolean(data.contact.email || data.contact.phone);

  const h1 = heroCopy.lead || data.tagline || data.name;
  const sub = data.tagline && data.tagline !== h1 ? data.tagline : firstSentence(data.intro);
  const ratingStat = data.stats?.find((s) => s.icon === "star");
  const starCount = data.rating ? Math.max(1, Math.min(5, Math.round(data.rating.value))) : 0;

  // §B.17 phase gate: real → render; none → MOCK sample (marked), LIVE dropped.
  const roomsData = data.rooms?.length ? data.rooms : phase === "mock" ? sampleRooms(data) : null;
  const roomsSample = !(data.rooms && data.rooms.length);
  const reviewsData = data.reviews?.length ? data.reviews : null;
  const reviewsSample = !(data.reviews && data.reviews.length);
  const faqsData = data.faqs?.length ? data.faqs : phase === "mock" ? SAMPLE_FAQS : null;
  const faqsSample = !(data.faqs && data.faqs.length);

  // -- nav ------------------------------------------------------------------
  const navLinks = [
    roomsData ? `<a href="#cn-rooms">${T(data, "Szobák")}</a>` : "",
    data.highlights.length ? `<a href="#cn-services">${T(data, "Szolgáltatások")}</a>` : "",
    photos.length ? `<a href="#cn-gallery">${T(data, "Galéria")}</a>` : "",
    reviewsData ? `<a href="#cn-reviews">${T(data, "Vélemények")}</a>` : "",
    hasContact ? `<a href="#cn-contact">${T(data, "Kapcsolat")}</a>` : "",
    hasContact ? `<a class="cit-btn" href="#cit-enquiry">${ctaLabel(data, phase)}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="cn-nav">
    <div class="cn-wrap">
      <a class="cn-brand" href="#top">${esc(data.name)}</a>
      <div class="cn-navlinks">
        ${navLinks}
      </div>
    </div>
  </nav>`;

  // Masthead lockup (owner contract 2026-08-30): same link set as the scrolled bar.
  const mastLinks: MastheadLink[] = [
    ...(roomsData ? [{ label: T(data, "Szobák"), href: "#cn-rooms" }] : []),
    ...(data.highlights.length ? [{ label: T(data, "Szolgáltatások"), href: "#cn-services" }] : []),
    ...(photos.length ? [{ label: T(data, "Galéria"), href: "#cn-gallery" }] : []),
    ...(reviewsData ? [{ label: T(data, "Vélemények"), href: "#cn-reviews" }] : []),
    ...(hasContact ? [{ label: T(data, "Kapcsolat"), href: "#cn-contact" }] : []),
    ...(hasContact ? [{ label: ctaLabel(data, phase), href: "#cit-enquiry", hot: true }] : []),
  ];
  const mast = mastheadHtml(data, { links: mastLinks, place: heroCopy.eyebrow });

  // -- cinematic hero (crossfade) ------------------------------------------
  const slides = heroPhotos.length
    ? heroPhotos
        .map(
          (p) =>
            `<div class="cn-slide"><div class="cn-im" style="background-image:url('${esc(p.url)}')"></div></div>`,
        )
        .join("\n    ")
    : `<div class="cn-slide cn-slide--flat"></div>`;
  const dots =
    heroPhotos.length > 1
      ? `<div class="cn-dots">${heroPhotos
          .map(
            (_, i) =>
              `<button aria-label="${T(data, "{n}. kép", { n: String(i + 1) })}"></button>`,
          )
          .join("")}</div>`
      : "";
  const hero = `<header class="cn-cine" id="top">
    ${slides}
    ${mast}
    <div class="cn-wrap cn-cinein">
      <h1>${accented(h1, heroCopy.accent)}</h1>
      ${sub ? `<p class="cn-cinesub">${esc(sub)}</p>` : ""}
      <div class="cn-heroctas">
        ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        ${roomsData ? `<a class="cit-btn cit-btn-ghost" href="#cn-rooms">${T(data, "Szobáink")}</a>` : ""}
      </div>
    </div>
    ${dots}
  </header>`;

  // -- sticky booking dock (signature) -------------------------------------
  const dock = `<div class="cn-dock">
    ${bookingSlot(data, phase)}
  </div>`;

  // -- rooms ----------------------------------------------------------------
  const rooms = roomsData
    ? `<section class="cn-sec" id="cn-rooms">
    <div class="cn-wrap">
      <div class="cn-sechead">
        ${roomCopy.eyebrow ? `<div class="cn-eyebrow">${esc(roomCopy.eyebrow)}</div>` : `<div class="cn-eyebrow">${T(data, "Szobák")}</div>`}
        <h2>${roomCopy.title ? accented(roomCopy.title, roomCopy.accent) : T(data, "Szobáink")}</h2>
        ${roomCopy.title ? "" : `<p>${T(data, "Amit lát, azt kapja — minden szoba a saját, valós adataival.")}</p>`}
      </div>
      <div class="cn-rooms" data-cit-module="rooms">
        ${roomsData
          .map(
            (r) => `<article class="cn-rc">
          <div class="cn-im2">${r.photo?.url ? `<img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt || r.name)}">` : photoFill(r.name)}</div>
          <div class="cn-bd">
            <h3>${esc(r.name)}</h3>
            ${r.capacity ? `<p class="cn-mt">${esc(r.capacity)}</p>` : ""}
            ${r.note ? `<p>${esc(r.note)}</p>` : ""}
            <div class="cn-ft">
              ${r.price ? `<span class="cn-pr">${esc(r.price)}</span>` : "<span></span>"}
              ${hasContact ? `<a class="cit-btn cit-btn-ghost" href="#cit-enquiry">${ctaLabel(data, phase)}</a>` : ""}
            </div>
          </div>
        </article>`,
          )
          .join("\n        ")}
      </div>
      ${roomsSample ? `<p class="cn-sample">${T(data, "Minta — ide az Ön szobái és árai kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- amenities (real highlights only) ------------------------------------
  const amen = data.highlights.length
    ? `<section class="cn-sec" id="cn-services" style="padding-top:0">
    <div class="cn-wrap">
      <div class="cn-sechead">
        <div class="cn-eyebrow">${T(data, "Szolgáltatások")}</div>
        <h2>${T(data, "Több, mint egy szoba")}</h2>
      </div>
      <div class="cn-exp">
        ${data.highlights
          .slice(0, 8)
          .map((h) => `<div class="cn-ex">${amenityIconSvg(h, data.amenityIconMap)}<p>${esc(h)}</p></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- gallery --------------------------------------------------------------
  const gallery = photos.length
    ? `<section class="cn-sec" id="cn-gallery" style="padding-top:0">
    <div class="cn-wrap">
      <div class="cn-sechead">
        ${galCopy.eyebrow ? `<div class="cn-eyebrow">${esc(galCopy.eyebrow)}</div>` : `<div class="cn-eyebrow">${T(data, "Galéria")}</div>`}
        <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Minden ablak egy mozivászon")}</h2>
      </div>
      <div class="cn-mosaic" data-cit-module="gallery">
        ${photos
          .slice(0, 6)
          .map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews --------------------------------------------------------------
  const stars5 = starCount ? `<div class="cn-stars">${starIcon().repeat(starCount)}</div>` : "";
  const reviews = reviewsData
    ? `<section class="cn-sec cn-rev" id="cn-reviews" data-cit-module="reviews">
    <div class="cn-wrap">
      <div class="cn-sechead">
        ${revCopy.eyebrow ? `<div class="cn-eyebrow">${esc(revCopy.eyebrow)}</div>` : `<div class="cn-eyebrow">${T(data, "Vélemények")}</div>`}
        ${
          ratingStat
            ? `<h2>${T(data, "Ne nekünk higgyen — nekik")}</h2><div class="cn-revscore"><b>${esc(ratingStat.value)}</b><div>${stars5}<span>${esc(ratingStat.label)}</span></div></div>`
            : `<h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégeink")}</h2>`
        }
      </div>
      <div class="cn-rev3">
        ${reviewsData
          .map(
            (r) =>
              `<div class="cn-rv"><p>${esc(r.quote)}</p><footer>— ${esc(r.author)}${r.meta ? `, ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${reviewsSample ? `<p class="cn-sample">${T(data, "Minta — ide az Ön vendégeinek értékelései kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- faq ------------------------------------------------------------------
  const faq = faqsData
    ? `<section class="cn-sec" id="cn-faq" style="padding-top:0">
    <div class="cn-wrap">
      <div class="cn-sechead">
        <div class="cn-eyebrow">${T(data, "Tudnivalók")}</div>
        <h2>${T(data, "Gyakori kérdések")}</h2>
      </div>
      <div class="cn-faq">
        ${faqsData
          .map(
            (f, i) =>
              `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
          )
          .join("\n        ")}
      </div>
      ${faqsSample ? `<p class="cn-sample">${T(data, "Minta — ide az Ön saját válaszai kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- contact --------------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="cn-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="cn-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="cn-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n      ");
  const contact = contactLines
    ? `<section class="cn-sec" id="cn-contact" style="padding-top:0">
    <div class="cn-wrap">
      <div class="cn-sechead">
        <div class="cn-eyebrow">${T(data, "Kapcsolat")}</div>
        <h2>${T(data, "Kérdése van? Szívesen segítünk")}</h2>
      </div>
      <div class="cn-cwrap">
        <div>
          ${data.tagline ? `<p style="color:var(--cit-muted);font-size:16px;margin-bottom:6px">${esc(data.tagline)}</p>` : ""}
          ${contactLines}
          ${hasContact ? `<a class="cit-btn" style="margin-top:24px" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        </div>
        ${contactPhoto ? `<div class="cn-conphoto"><img src="${esc(contactPhoto)}" alt="${esc(data.name)}"></div>` : ""}
      </div>
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="cn-foot">
    <div class="cn-wrap">
      <div class="cn-footgrid">
        <div>
          <span class="cn-brand">${esc(data.name)}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Felfedezés")}</h4>
          ${roomsData ? `<a href="#cn-rooms">${T(data, "Szobák")}</a>` : ""}
          ${data.highlights.length ? `<a href="#cn-services">${T(data, "Szolgáltatások")}</a>` : ""}
          ${photos.length ? `<a href="#cn-gallery">${T(data, "Galéria")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Információ")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="cn-footlegal">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
      </div>
    </div>
  </footer>`;

  const mobcta = hasContact
    ? `<div class="cn-mobcta">
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
${CINEMATIC_CSS}
${mastheadCss("overlay")}
  </style>
</head>
<body class="cit-tpl-cinematic">
    ${nav}
    ${hero}
    ${dock}
    ${rooms}
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
    <script>${CINEMATIC_JS}</script>
</body>
</html>`;
}

export const CINEMATIC: ArtTemplate = {
  id: "cinematic",
  label: "Filmes — Ken-Burns crossfade hero + ragadós foglaló-dokk, világos szerkesztőségi (referencia 12)", // i18n-exempt: operator-facing (console template picker)
  skins: ["cinematic-navy", "night-azure-gold", "sand-cream-airy"],
  render: renderCinematic,
};
