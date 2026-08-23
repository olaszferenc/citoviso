// "organic" art template (ADR-0027) — the mock_07 "anti-grid" reference direction.
// A light, earthy stay (loam-moss-linen): a floating pill nav, an ASYMMETRIC hero (copy left,
// BLOB-cropped photos right), a soft booking card, the units in a SCATTERED anti-grid rack
// (the signature move — :nth-child translateY offsets), the real highlights woven into a
// FLOWING dotted TIMELINE ("the rhythm of a day here") plus organic chips, a blob-masked
// gallery, handwritten-note reviews, an optional FAQ, a contact split and a rounded footer.
// All styling dresses from the 11 --cit-* tokens (+ color-mix / neutral scrims) — the
// loam-organic skin is the intended pairing. See templateKit.ts for the shared contract.

import { iconSvg, matchIcon, starIcon } from "../icons.js";
import { slotMarker } from "../moduleSections.js";
import { SAMPLE_FAQS } from "../primitives.js";
import type { Recipe, RenderPhase, SiteData } from "../recipe.js";
import { renderSeoHead, seoTitle } from "../seo.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "../skins.js";
import {
  accented,
  bookingSlot,
  copyOf,
  esc,
  firstSentence,
  photoFill,
  sampleRooms,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const ORGANIC_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.7}

  /* shared module sections (.cit-modsec) themed to the organic rhythm (ADR-0057):
     soft, left-flowing, large rounded cards — matches .og-sec (88px) / .og-wrap (1160px). */
  body.cit-tpl-organic{
    --cit-modsec-py:88px;
    --cit-modsec-maxw:1160px;
    --cit-modsec-px:24px;
    --cit-modsec-divider:0;
    --cit-modsec-head-align:left;
    --cit-modsec-head-mb:40px;
    --cit-modsec-head-size:clamp(28px,4vw,44px);
    --cit-modsec-head-weight:600;
    --cit-modsec-card-radius:26px;
    --cit-modsec-card-pad:24px}

  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .og-wrap{width:min(1160px,92%);margin:0 auto}
  .og-eyeb{display:inline-block;background:color-mix(in srgb, var(--cit-ink) 8%, var(--cit-surface));border:1px solid var(--cit-line);border-radius:100px;padding:6px 16px;font-size:12.5px;font-weight:600;letter-spacing:1px;color:var(--cit-muted);margin-bottom:16px}
  h1,h2,h3{font-family:var(--cit-font-display);font-weight:600;line-height:1.18}
  h2{font-size:clamp(28px,4vw,44px);margin-bottom:14px}
  h2 em{font-style:italic;color:var(--cit-accent)}
  .og-lead{color:var(--cit-muted);max-width:560px}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);padding:14px 30px;border-radius:100px;font-weight:600;font-size:14.5px;letter-spacing:.3px;transition:.22s;cursor:pointer}
  .cit-btn:hover{filter:brightness(1.06);transform:translateY(-2px)}
  .cit-btn-ghost{background:transparent;color:var(--cit-ink);border:1.5px solid color-mix(in srgb, var(--cit-ink) 45%, transparent);margin-left:10px}
  .cit-btn-ghost:hover{border-color:var(--cit-accent);color:var(--cit-accent);filter:none}
  .cit-btn-disabled{opacity:.5;pointer-events:none}

  /* organic blob helpers — the signature crop */
  .og-blob-a{border-radius:58% 42% 55% 45% / 48% 55% 45% 52%}
  .og-blob-b{border-radius:42% 58% 46% 54% / 55% 44% 56% 45%}
  .og-blob-c{border-radius:50% 50% 42% 58% / 58% 46% 54% 42%}

  /* nav — floating pill */
  .og-nav{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:100;background:color-mix(in srgb, var(--cit-surface) 86%, transparent);backdrop-filter:blur(12px);border:1px solid var(--cit-line);border-radius:100px;padding:8px 10px;display:flex;align-items:center;gap:4px;box-shadow:0 8px 30px rgba(0,0,0,.10);max-width:94%;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .og-nav .og-brand{font-family:var(--cit-font-display);font-size:16px;letter-spacing:.5px;color:var(--cit-ink);padding:9px 14px;white-space:nowrap}
  .og-nav a{white-space:nowrap;color:var(--cit-muted);font-size:13.5px;font-weight:500;padding:9px 16px;border-radius:100px;transition:.2s}
  .og-nav a:hover{background:color-mix(in srgb, var(--cit-ink) 8%, transparent);color:var(--cit-ink)}
  .og-nav a.cit-btn{color:var(--cit-on-accent);padding:9px 18px}
  .og-nav a.cit-btn:hover{background:var(--cit-accent)}

  /* hero — asymmetric, anti-grid */
  .og-hero{position:relative;padding:130px 0 60px;overflow:hidden}
  .og-hero-grad{position:absolute;inset:0;pointer-events:none;background:
    radial-gradient(52% 44% at 82% 12%, color-mix(in srgb, var(--cit-accent) 20%, transparent), transparent 70%),
    radial-gradient(46% 40% at 8% 78%, color-mix(in srgb, var(--cit-accent) 14%, transparent), transparent 70%)}
  .og-hero-in{position:relative;display:grid;gap:34px;grid-template-columns:1fr}
  @media(min-width:940px){.og-hero-in{grid-template-columns:1.05fr .95fr;align-items:center}}
  .og-season{display:inline-flex;align-items:center;gap:8px;background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:100px;padding:7px 16px;font-size:13px;color:var(--cit-muted);margin-bottom:22px}
  .og-hero h1{font-family:var(--cit-font-display);font-size:clamp(38px,5.6vw,66px);margin-bottom:20px}
  .og-hero h1 em{font-style:italic;color:var(--cit-accent)}
  .og-hero p{max-width:480px;color:var(--cit-muted);margin-bottom:30px}
  .og-hero-visual{position:relative;min-height:420px}
  .og-hv1{position:absolute;width:64%;aspect-ratio:4/5;top:0;right:4%;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.22);z-index:2}
  .og-hv1 img{width:100%;height:100%;object-fit:cover}
  .og-hv2{position:absolute;width:44%;aspect-ratio:1;bottom:0;left:0;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.18);z-index:3}
  .og-hv2 img{width:100%;height:100%;object-fit:cover}
  .og-hv-leaf{position:absolute;width:110px;height:110px;bottom:8%;right:0;background:color-mix(in srgb, var(--cit-accent) 28%, transparent);z-index:1;animation:og-drift 9s ease-in-out infinite}
  .og-hero-visual--flat{background:linear-gradient(155deg, var(--cit-surface), color-mix(in srgb, var(--cit-accent) 30%, var(--cit-surface)));border:1px solid var(--cit-line)}
  @keyframes og-drift{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-16px) rotate(6deg)}}
  @media(prefers-reduced-motion:reduce){.og-hv-leaf{animation:none}}

  /* booking — soft organic card */
  .og-bookwrap{position:relative;z-index:5;margin-top:46px}
  .og-bookcard{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:28px;padding:14px clamp(16px,3vw,26px);box-shadow:0 18px 44px rgba(0,0,0,.10)}
  .og-bookcard .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem .4rem}
  .og-bookcard .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.25rem;color:var(--cit-ink)}

  /* sections */
  section.og-sec{padding:88px 0}
  .og-sec--tint{background:var(--cit-surface);border-radius:44px}

  /* stays — anti-grid scatter (THE signature) */
  .og-stays{position:relative;display:grid;gap:40px;grid-template-columns:1fr;margin-top:54px}
  @media(min-width:900px){.og-stays{grid-template-columns:repeat(3,1fr)}
    .og-stay:nth-child(2){transform:translateY(44px)}
    .og-stay:nth-child(3){transform:translateY(14px)}
    .og-stay:nth-child(5){transform:translateY(30px)}}
  .og-stay{background:color-mix(in srgb, var(--cit-surface) 60%, var(--cit-bg));border:1px solid var(--cit-line);border-radius:26px;overflow:hidden;transition:box-shadow .25s,transform .25s}
  .og-stay:hover{box-shadow:0 20px 50px rgba(0,0,0,.16)}
  .og-stay .og-im{aspect-ratio:4/3;overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 10%, var(--cit-surface))}
  .og-stay .og-im img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
  .og-stay:hover .og-im img{transform:scale(1.05)}
  .og-stay .og-bd{padding:24px}
  .og-stay h3{font-size:22px;margin-bottom:6px}
  .og-stay .og-mt{font-size:13px;color:var(--cit-accent);margin-bottom:12px}
  .og-stay p{font-size:14.5px;color:var(--cit-muted);margin-bottom:16px}
  .og-stay .og-ft{display:flex;justify-content:space-between;align-items:center;border-top:1px dashed var(--cit-line);padding-top:15px}
  .og-stay .og-pr{font-family:var(--cit-font-display);font-size:19px;color:var(--cit-accent)}
  .og-stay .og-lk{color:var(--cit-accent);font-weight:600;font-size:14px}
  .og-stay .og-lk:hover{text-decoration:underline}
  .og-sample{font-size:13px;color:var(--cit-muted);letter-spacing:.3px;margin-top:28px}

  /* rhythm — flowing dotted timeline of REAL highlights */
  .og-rhythm{position:relative;margin-top:54px;padding-left:26px}
  .og-rhythm::before{content:"";position:absolute;left:6px;top:6px;bottom:6px;width:2px;background:repeating-linear-gradient(180deg, var(--cit-accent) 0 10px, transparent 10px 18px);border-radius:2px}
  .og-beat{position:relative;margin-bottom:26px;max-width:640px}
  .og-beat::before{content:"";position:absolute;left:-26px;top:5px;width:13px;height:13px;background:var(--cit-accent);border-radius:58% 42% 55% 45% / 48% 55% 45% 52%}
  .og-beat h3{font-size:18px;margin:0 0 3px;display:flex;align-items:center;gap:10px}
  .og-beat h3 svg{width:20px;height:20px;color:var(--cit-accent);flex:none}
  .og-beat p{font-size:14.5px;color:var(--cit-muted)}

  /* chips — organic amenity pills */
  .og-chips{display:flex;flex-wrap:wrap;gap:12px;margin-top:44px}
  .og-chip{display:flex;align-items:center;gap:10px;background:color-mix(in srgb, var(--cit-surface) 60%, var(--cit-bg));border:1px solid var(--cit-line);border-radius:100px;padding:12px 20px;font-size:14.5px;font-weight:500;color:color-mix(in srgb, var(--cit-ink) 88%, transparent);transition:transform .2s,border-color .2s}
  .og-chip:hover{transform:translateY(-3px);border-color:var(--cit-accent)}
  .og-chip svg{width:20px;height:20px;color:var(--cit-accent);flex:none}

  /* gallery — organic masks, scattered baseline */
  .og-gal{display:grid;gap:20px;grid-template-columns:repeat(2,1fr);margin-top:50px}
  @media(min-width:840px){.og-gal{grid-template-columns:repeat(4,1fr)}}
  .og-gal figure{aspect-ratio:3/4;overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 10%, var(--cit-surface))}
  .og-gal figure:nth-child(odd){margin-top:22px}
  .og-gal img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
  .og-gal figure:hover img{transform:scale(1.06)}

  /* reviews — handwritten-ish notes */
  .og-notes{display:grid;gap:24px;grid-template-columns:1fr;margin-top:50px}
  @media(min-width:860px){.og-notes{grid-template-columns:repeat(3,1fr)}}
  .og-note{background:color-mix(in srgb, var(--cit-surface) 60%, var(--cit-bg));border:1px solid var(--cit-line);border-radius:24px;padding:28px;position:relative}
  .og-note .og-q{font-family:var(--cit-font-display);font-size:44px;color:var(--cit-accent);line-height:1;display:block;margin-bottom:8px}
  .og-note p{font-family:var(--cit-font-display);font-style:italic;font-size:16.5px;line-height:1.5;margin-bottom:16px}
  .og-note footer{font-size:13px;color:var(--cit-muted)}
  .og-note .og-st{display:flex;gap:3px;margin-top:8px}
  .og-note .og-st svg{width:15px;height:15px;color:var(--cit-accent)}
  .og-revscore{display:flex;align-items:center;gap:14px;margin-top:6px}
  .og-revscore b{font-family:var(--cit-font-display);font-size:44px;color:var(--cit-accent)}
  .og-revscore .og-st{display:flex;gap:3px}
  .og-revscore .og-st svg{width:18px;height:18px;color:var(--cit-accent)}
  .og-revscore span{font-size:13.5px;color:var(--cit-muted)}

  /* faq */
  .og-faq{max-width:800px}
  .og-faq details{background:color-mix(in srgb, var(--cit-surface) 60%, var(--cit-bg));border:1px solid var(--cit-line);border-radius:18px;margin-bottom:12px;overflow:hidden}
  .og-faq summary{list-style:none;cursor:pointer;padding:18px 22px;font-family:var(--cit-font-display);font-size:18px;display:flex;justify-content:space-between;align-items:center;gap:14px}
  .og-faq summary::-webkit-details-marker{display:none}
  .og-faq summary::after{content:"○";color:var(--cit-accent);font-size:17px}
  .og-faq details[open] summary::after{content:"●"}
  .og-faq details p{padding:0 22px 18px;color:var(--cit-muted);font-size:15px}

  /* contact split */
  .og-reach{display:grid;gap:30px;grid-template-columns:1fr;margin-top:50px;align-items:stretch}
  @media(min-width:920px){.og-reach{grid-template-columns:1.1fr .9fr}}
  .og-conphoto{position:relative;border-radius:26px;overflow:hidden;min-height:340px;background:color-mix(in srgb, var(--cit-ink) 10%, var(--cit-surface))}
  .og-conphoto img{width:100%;height:100%;object-fit:cover}
  .og-conphoto--flat{background:linear-gradient(155deg, var(--cit-surface), color-mix(in srgb, var(--cit-accent) 30%, var(--cit-surface)))}
  .og-concard{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:26px;padding:30px}
  .og-concard h3{font-size:22px;margin-bottom:18px}
  .og-conline{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--cit-line);font-size:15.5px}
  .og-conline:first-of-type{border-top:none}
  .og-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .og-conline b{font-family:var(--cit-font-display);font-size:16px}
  .og-conline small{color:var(--cit-muted);font-size:13px;display:block}

  /* footer — rounded */
  .og-foot{background:color-mix(in srgb, var(--cit-bg) 88%, black);color:color-mix(in srgb, var(--cit-ink) 70%, transparent);padding:60px 0 30px;margin-top:90px;border-radius:44px 44px 0 0}
  .og-fg{display:grid;gap:34px;grid-template-columns:1fr;margin-bottom:40px}
  @media(min-width:800px){.og-fg{grid-template-columns:2fr 1fr 1fr}}
  .og-foot h4{color:var(--cit-ink);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px}
  .og-foot .og-brand{font-family:var(--cit-font-display);font-size:20px;color:var(--cit-ink)}
  .og-foot p{font-size:14.5px;margin-top:12px;max-width:290px}
  .og-foot a{display:block;padding:5px 0;font-size:14.5px;transition:.2s}
  .og-foot a:hover{color:var(--cit-accent)}
  .og-fb{border-top:1px solid var(--cit-line);padding-top:24px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:13px}

  /* mobile fixed CTA */
  .og-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:110;background:color-mix(in srgb, var(--cit-surface) 96%, transparent);border-top:1px solid var(--cit-line);backdrop-filter:blur(10px);padding:12px 16px;gap:12px;align-items:center;justify-content:space-between}
  .og-mobcta span{font-size:14px;color:var(--cit-ink)}
  .og-mobcta b{color:var(--cit-accent)}
  @media(max-width:700px){.og-mobcta{display:flex}body{padding-bottom:64px}}
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderOrganic(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["loam-organic"]!;
  const heroCopy = copyOf(recipe, "hero");
  const roomCopy = copyOf(recipe, "rooms");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const heroPhoto = photos[0]?.url ?? "";
  const heroPhoto2 = photos[1]?.url ?? "";
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
    roomsData ? `<a href="#og-rooms">${T(data, "Szobák")}</a>` : "",
    data.highlights.length ? `<a href="#og-rhythm">${T(data, "A birtok élete")}</a>` : "",
    photos.length ? `<a href="#og-gallery">${T(data, "Galéria")}</a>` : "",
    reviewsData ? `<a href="#og-reviews">${T(data, "Vendégeink")}</a>` : "",
    hasContact ? `<a href="#og-contact">${T(data, "Kapcsolat")}</a>` : "",
    hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalás")}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n      ");
  const nav = `<nav class="og-nav">
      <a class="og-brand" href="#top">${esc(data.name)}</a>
      ${navLinks}
  </nav>`;

  // -- hero (asymmetric: copy left, blob photos right) ----------------------
  const heroVisual = heroPhoto
    ? `<div class="og-hero-visual">
        <div class="og-hv1 og-blob-a"><img src="${esc(heroPhoto)}" alt="${esc(data.name)}"></div>
        ${heroPhoto2 ? `<div class="og-hv2 og-blob-b"><img src="${esc(heroPhoto2)}" alt="${esc(data.name)}"></div>` : ""}
        <div class="og-hv-leaf og-blob-c"></div>
      </div>`
    : `<div class="og-hero-visual og-hero-visual--flat og-blob-a"></div>`;
  const hero = `<header class="og-hero" id="top">
    <div class="og-hero-grad"></div>
    <div class="og-wrap og-hero-in">
      <div>
        ${heroCopy.eyebrow ? `<span class="og-season">${esc(heroCopy.eyebrow)}</span>` : ""}
        <h1>${accented(h1, heroCopy.accent)}</h1>
        ${sub ? `<p>${esc(sub)}</p>` : ""}
        <div>
          ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
          ${data.highlights.length ? `<a class="cit-btn cit-btn-ghost" href="#og-rhythm">${T(data, "A birtok élete")}</a>` : ""}
        </div>
      </div>
      ${heroVisual}
    </div>
    <div class="og-wrap og-bookwrap">
      <div class="og-bookcard">
        ${bookingSlot(data, phase)}
      </div>
    </div>
  </header>`;

  // -- rooms (anti-grid scatter) -------------------------------------------
  const rooms = roomsData
    ? `<section class="og-sec" id="og-rooms" style="padding-top:60px">
    <div class="og-wrap">
      ${roomCopy.eyebrow ? `<span class="og-eyeb">${esc(roomCopy.eyebrow)}</span>` : `<span class="og-eyeb">${T(data, "Szobáink")}</span>`}
      <h2>${roomCopy.title ? accented(roomCopy.title, roomCopy.accent) : T(data, "Ahol megszállhat")}</h2>
      ${data.tagline ? `<p class="og-lead">${esc(data.tagline)}</p>` : ""}
      <div class="og-stays" data-cit-module="rooms">
        ${roomsData
          .map(
            (r) => `<article class="og-stay">
          <div class="og-im">${r.photo?.url ? `<img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt || r.name)}">` : photoFill(r.name)}</div>
          <div class="og-bd">
            <h3>${esc(r.name)}</h3>
            ${r.capacity ? `<p class="og-mt">${esc(r.capacity)}</p>` : ""}
            ${r.note ? `<p>${esc(r.note)}</p>` : ""}
            <div class="og-ft">
              ${r.price ? `<span class="og-pr">${esc(r.price)}</span>` : "<span></span>"}
              ${hasContact ? `<a class="og-lk" href="#cit-enquiry">${T(data, "Kiválasztom")} →</a>` : "<span></span>"}
            </div>
          </div>
        </article>`,
          )
          .join("\n        ")}
      </div>
      ${roomsSample ? `<p class="og-sample">${T(data, "Minta — ide az Ön szobái és árai kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- rhythm: REAL highlights woven into a flowing dotted timeline ---------
  const rhythm = data.highlights.length
    ? `<section class="og-sec og-sec--tint" id="og-rhythm">
    <div class="og-wrap">
      <span class="og-eyeb">${T(data, "A birtok élete")}</span>
      <h2>${T(data, "Egy nap nálunk")}</h2>
      <p class="og-lead">${T(data, "Semmi sem kötelező — de minden kipróbálható.")}</p>
      <div class="og-rhythm">
        ${data.highlights
          .slice(0, 6)
          .map(
            (h) =>
              `<div class="og-beat"><h3>${iconSvg(matchIcon(h))}${esc(h)}</h3></div>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- chips: the REMAINING selling points as compact organic pills ---------
  // Disjoint from the timeline above (ADR-0059: one content type once) — the
  // timeline takes the first six, the chips show only what did not fit there.
  // With six or fewer highlights the chip section simply does not render.
  const chipItems = data.highlights.slice(6, 16);
  const chips = chipItems.length
    ? `<section class="og-sec">
    <div class="og-wrap">
      <span class="og-eyeb">${T(data, "Ami jár")}</span>
      <h2>${T(data, "A kényelem itt sem hiányzik")}</h2>
      <div class="og-chips">
        ${chipItems
          .map((h) => `<div class="og-chip">${iconSvg(matchIcon(h))}<span>${esc(h)}</span></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- gallery (blob-masked, scattered) ------------------------------------
  const gallery = photos.length
    ? `<section class="og-sec" id="og-gallery" style="padding-top:0">
    <div class="og-wrap">
      ${galCopy.eyebrow ? `<span class="og-eyeb">${esc(galCopy.eyebrow)}</span>` : `<span class="og-eyeb">${T(data, "Galéria")}</span>`}
      <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Évszakról évszakra")}</h2>
      <div class="og-gal" data-cit-module="gallery">
        ${photos
          .slice(0, 4)
          .map(
            (p, i) =>
              `<figure class="${["og-blob-a", "og-blob-b", "og-blob-c", "og-blob-a"][i % 4]}"><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews (handwritten notes) -----------------------------------------
  const stars5 = starCount ? `<div class="og-st">${starIcon().repeat(starCount)}</div>` : "";
  const reviews = reviewsData
    ? `<section class="og-sec" id="og-reviews" style="padding-top:0" data-cit-module="reviews">
    <div class="og-wrap">
      ${revCopy.eyebrow ? `<span class="og-eyeb">${esc(revCopy.eyebrow)}</span>` : `<span class="og-eyeb">${T(data, "Vendégeink írták")}</span>`}
      ${
        ratingStat
          ? `<div class="og-revscore"><b>${esc(ratingStat.value)}</b><div>${stars5}<span>${esc(ratingStat.label)}</span></div></div>`
          : `<h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégeink")}</h2>`
      }
      <div class="og-notes">
        ${reviewsData
          .map(
            (r) =>
              `<div class="og-note"><span class="og-q">&ldquo;</span><p>${esc(r.quote)}</p><footer>— ${esc(r.author)}${r.meta ? ` · ${esc(r.meta)}` : ""}${starCount ? `<div class="og-st">${starIcon().repeat(starCount)}</div>` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${reviewsSample ? `<p class="og-sample">${T(data, "Minta — ide az Ön vendégeinek értékelései kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- faq ------------------------------------------------------------------
  const faq = faqsData
    ? `<section class="og-sec" id="og-faq" style="padding-top:0">
    <div class="og-wrap og-faq">
      <span class="og-eyeb">${T(data, "Jó tudni")}</span>
      <h2>${T(data, "Gyakori kérdések")}</h2>
      <div style="margin-top:30px">
        ${faqsData
          .map(
            (f, i) =>
              `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
          )
          .join("\n        ")}
      </div>
      ${faqsSample ? `<p class="og-sample">${T(data, "Minta — ide az Ön saját válaszai kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- contact --------------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="og-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="og-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="og-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const contact = contactLines
    ? `<section class="og-sec" id="og-contact" style="padding-top:0">
    <div class="og-wrap">
      <span class="og-eyeb">${T(data, "Így talál ide")}</span>
      <h2>${T(data, "Megközelítés és kapcsolat")}</h2>
      <div class="og-reach">
        ${
          contactPhoto
            ? `<div class="og-conphoto"><img src="${esc(contactPhoto)}" alt="${esc(data.name)}"></div>`
            : `<div class="og-conphoto og-conphoto--flat"></div>`
        }
        <div class="og-concard">
          <h3>${T(data, "Kérdezne valamit?")}</h3>
          ${contactLines}
          ${hasContact ? `<a class="cit-btn" style="margin-top:20px;width:100%;text-align:center" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        </div>
      </div>
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="og-foot">
    <div class="og-wrap">
      <div class="og-fg">
        <div>
          <span class="og-brand">${esc(data.name)}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Felfedezés")}</h4>
          ${roomsData ? `<a href="#og-rooms">${T(data, "Szobák")}</a>` : ""}
          ${data.highlights.length ? `<a href="#og-rhythm">${T(data, "A birtok élete")}</a>` : ""}
          ${photos.length ? `<a href="#og-gallery">${T(data, "Galéria")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Információ")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
          ${reviewsData ? `<a href="#og-reviews">${T(data, "Vendégeink")}</a>` : ""}
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="og-fb">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
      </div>
    </div>
  </footer>`;

  const mobcta = hasContact
    ? `<div class="og-mobcta">
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
${ORGANIC_CSS}
  </style>
</head>
<body class="cit-tpl-organic">
    ${nav}
    ${hero}
    ${rooms}
    ${rhythm}
    ${chips}
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
</body>
</html>`;
}

export const ORGANIC: ArtTemplate = {
  id: "organic",
  label: "Organikus — antigrid szórt kártyák, világos agyag-moha-len, blob-formák (referencia 07)", // i18n-exempt: operator-facing (console template picker)
  skins: ["loam-organic", "sand-cream-airy", "coastal-fresh"],
  render: renderOrganic,
};
