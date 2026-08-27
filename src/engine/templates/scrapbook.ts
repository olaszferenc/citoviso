// "scrapbook" art template (ADR-0027) — the mock_15 "scrapbook" reference direction.
// A LIGHT, handmade memory-book stay: paper-grain body, washi-tape strip nav, a scrapbook
// hero of glued/pinned Polaroid photos with a hand-written kicker, a "recipe" booking card,
// the units as a rotated Polaroid stack, amenities as pantry "jar" labels, a photo album,
// a lined-notebook guestbook of reviews, sticky-note FAQ and a tilted map-frame contact.
// All styling dresses from the 11 --cit-* tokens (+ color-mix / neutral scrims) — the
// scrapbook-paper skin is the intended pairing (Caveat/Grandstander/Zilla Slab). The washi
// tape, pins, hearts and flowers of the reference are rebuilt as pure CSS shapes / SVG icons:
// NO emoji / ★ glyph ever reaches the output (design doctrine §B.4). See templateKit.ts.

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
  esc,
  firstSentence,
  photoFill,
  sampleRooms,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const SCRAPBOOK_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  /* paper-grain body: a faint ink-tint dot on the paper bg, all token/neutral derived */
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.7;
    background-image:radial-gradient(color-mix(in srgb, var(--cit-ink) 6%, transparent) 1px, transparent 1px);
    background-size:22px 22px}

  /* shared module sections (.cit-modsec) themed to the scrapbook rhythm (ADR-0057):
     playful, left-aligned, bold display headings, small hand-cut card corners —
     matches .sb-sec (82px) / .sb-wrap (1120px) / h2 weight 800. */
  body.cit-tpl-scrapbook{
    --cit-modsec-py:82px;
    --cit-modsec-maxw:1120px;
    --cit-modsec-px:22px;
    --cit-modsec-divider:0;
    --cit-modsec-head-align:left;
    --cit-modsec-head-mb:36px;
    --cit-modsec-head-size:clamp(30px,4.6vw,48px);
    --cit-modsec-head-weight:800;
    --cit-modsec-card-radius:6px;
    --cit-modsec-card-pad:22px 24px}

  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .sb-wrap{width:min(1120px,93%);margin:0 auto}
  .sb-hand{font-family:'Caveat',cursive}
  .sb-eyebrow{font-family:'Caveat',cursive;font-size:24px;color:color-mix(in srgb, var(--cit-ink) 55%, var(--cit-accent));display:inline-block;transform:rotate(-2deg);margin-bottom:8px}
  section.sb-sec{padding:82px 0}
  .sb-sec h2{font-family:var(--cit-font-display);font-weight:800;font-size:clamp(30px,4.6vw,48px);line-height:1.1;margin-bottom:14px}
  .sb-sec h2 em{font-style:normal;color:var(--cit-accent);position:relative;white-space:nowrap}
  .sb-sec h2 em::after{content:"";position:absolute;left:-2%;bottom:4px;width:104%;height:11px;background:color-mix(in srgb, var(--cit-accent) 32%, transparent);z-index:-1;transform:rotate(-1deg)}
  .sb-lead{max-width:560px;color:var(--cit-muted)}

  /* buttons — hand-cut sticker with a hard offset shadow, faintly rotated */
  .cit-btn{display:inline-block;font-family:var(--cit-font-display);font-weight:800;font-size:15px;background:var(--cit-accent);color:var(--cit-on-accent);padding:14px 28px;border:2.5px solid var(--cit-ink);border-radius:14px;box-shadow:4px 4px 0 color-mix(in srgb, var(--cit-ink) 45%, transparent);transform:rotate(-1deg);transition:transform .15s, box-shadow .15s;cursor:pointer}
  .cit-btn:hover{transform:rotate(0) translate(2px,2px);box-shadow:2px 2px 0 color-mix(in srgb, var(--cit-ink) 45%, transparent)}
  .cit-btn-ghost{background:var(--cit-surface);color:var(--cit-ink);transform:rotate(1deg)}
  .cit-btn-ghost:hover{background:var(--cit-surface);color:var(--cit-accent)}
  .cit-btn-disabled{opacity:.5;pointer-events:none}

  /* tape + pin decorations (pure CSS — never emoji) */
  .sb-tape{position:relative}
  .sb-tape::before{content:"";position:absolute;top:-13px;left:50%;transform:translateX(-50%) rotate(-3deg);width:92px;height:24px;background:color-mix(in srgb, var(--cit-accent) 26%, color-mix(in srgb, white 60%, transparent));border-left:1px dashed color-mix(in srgb, var(--cit-ink) 25%, transparent);border-right:1px dashed color-mix(in srgb, var(--cit-ink) 25%, transparent);z-index:3}
  .sb-pin::after{content:"";position:absolute;top:-9px;right:16px;width:15px;height:15px;border-radius:50%;background:radial-gradient(circle at 35% 30%, color-mix(in srgb, white 55%, var(--cit-accent)), var(--cit-accent));box-shadow:0 2px 4px color-mix(in srgb, var(--cit-ink) 45%, transparent);z-index:3}

  /* NAV — washi strip, sticky */
  .sb-nav{position:sticky;top:0;z-index:100;background:var(--cit-bg);border-bottom:2px dashed var(--cit-muted)}
  .sb-nv{display:flex;align-items:center;justify-content:space-between;padding:13px 0;gap:10px}
  .sb-brand{font-family:'Caveat',cursive;font-weight:700;font-size:27px;color:var(--cit-accent);transform:rotate(-2deg)}
  .sb-menu{display:none;gap:4px;align-items:center}
  @media(min-width:900px){.sb-menu{display:flex}}
  .sb-menu a{font-family:var(--cit-font-display);font-weight:600;font-size:13.5px;padding:8px 13px;border-radius:10px;border:2px solid transparent;transition:.2s}
  .sb-menu a:hover{border-color:var(--cit-ink);background:var(--cit-surface);transform:rotate(-1.5deg)}
  .sb-menu a.cit-btn{padding:10px 18px;font-size:14px}

  /* HERO — scrapbook spread */
  .sb-hero{padding:64px 0 40px;overflow:hidden}
  .sb-herogrid{display:grid;gap:40px;grid-template-columns:1fr;align-items:center}
  @media(min-width:940px){.sb-herogrid{grid-template-columns:1fr 1fr}}
  .sb-hero h1{font-family:var(--cit-font-display);font-weight:800;font-size:clamp(38px,6vw,64px);line-height:1.1;margin:2px 0 18px}
  .sb-hero p{max-width:460px;margin-bottom:26px;color:color-mix(in srgb, var(--cit-ink) 88%, transparent)}
  .sb-heroctas{display:flex;flex-wrap:wrap;gap:12px}
  .sb-scrap{position:relative;min-height:420px}
  .sb-scrap--solo{min-height:340px}
  .sb-ph{position:absolute;background:var(--cit-surface);border:1px solid color-mix(in srgb, var(--cit-ink) 20%, transparent);padding:10px 10px 34px;box-shadow:0 10px 26px color-mix(in srgb, var(--cit-ink) 18%, transparent)}
  .sb-ph figure{overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 10%, var(--cit-surface))}
  .sb-ph img{width:100%;height:100%;object-fit:cover}
  .sb-ph .sb-cap{font-family:'Caveat',cursive;font-size:19px;text-align:center;padding-top:8px;color:var(--cit-muted)}
  .sb-ph1{width:60%;top:0;left:2%;transform:rotate(-4deg);z-index:1}
  .sb-ph1 figure{aspect-ratio:4/3}
  .sb-ph2{width:46%;bottom:4%;right:0;transform:rotate(3.5deg);z-index:2}
  .sb-ph2 figure{aspect-ratio:1}
  .sb-solo{position:relative;width:78%;margin:0 auto;transform:rotate(-2deg)}
  .sb-solo figure{aspect-ratio:4/3}
  .sb-flat{width:100%;aspect-ratio:4/3;border-radius:var(--cit-radius);background:linear-gradient(155deg, var(--cit-surface), color-mix(in srgb, var(--cit-accent) 22%, var(--cit-surface)))}

  /* BOOKING — "recipe" card */
  .sb-book{padding:8px 0 24px}
  .sb-recipe{background:var(--cit-surface);border:2px solid var(--cit-ink);border-radius:6px;padding:22px clamp(16px,3vw,26px);position:relative;box-shadow:5px 5px 0 color-mix(in srgb, var(--cit-ink) 25%, transparent)}
  .sb-recipe .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:.6rem .2rem}
  .sb-recipe .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-weight:800;font-size:1.3rem;color:var(--cit-accent)}

  /* ROOMS — Polaroid stack */
  .sb-rooms{display:grid;gap:36px;grid-template-columns:1fr;margin-top:48px}
  @media(min-width:900px){.sb-rooms{grid-template-columns:repeat(3,1fr)}}
  .sb-room{background:var(--cit-surface);border:1px solid color-mix(in srgb, var(--cit-ink) 20%, transparent);padding:12px 12px 20px;box-shadow:0 12px 30px color-mix(in srgb, var(--cit-ink) 15%, transparent);transform:rotate(var(--r,0deg));transition:transform .2s}
  .sb-room:hover{transform:rotate(0) translateY(-6px)}
  .sb-room figure{aspect-ratio:4/3;overflow:hidden;margin-bottom:14px;background:color-mix(in srgb, var(--cit-ink) 10%, var(--cit-surface))}
  .sb-room img{width:100%;height:100%;object-fit:cover}
  .sb-room h3{font-family:var(--cit-font-display);font-weight:600;font-size:20px;color:var(--cit-accent);margin-bottom:2px;padding:0 6px}
  .sb-room .sb-mt{font-family:'Caveat',cursive;font-size:19px;color:var(--cit-muted);padding:0 6px;margin-bottom:8px}
  .sb-room p{font-size:15px;padding:0 6px;margin-bottom:14px}
  .sb-room .sb-ft{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:2px dashed var(--cit-muted);padding:13px 6px 0}
  .sb-room .sb-pr{font-family:var(--cit-font-display);font-weight:800;font-size:18px}
  .sb-room .sb-cta{font-family:var(--cit-font-display);font-weight:600;font-size:13.5px;color:var(--cit-accent)}
  .sb-room .sb-cta:hover{text-decoration:underline}

  /* KAMRA — amenities as pantry "jar" labels */
  .sb-kamra{display:flex;flex-wrap:wrap;gap:16px;margin-top:44px}
  .sb-jar{background:var(--cit-surface);border:2px solid var(--cit-ink);border-radius:30px 30px 12px 12px;padding:16px 20px 12px;position:relative;transform:rotate(var(--r,0deg));display:flex;align-items:center;gap:12px}
  .sb-jar::before{content:"";position:absolute;top:-2px;left:14px;right:14px;height:8px;background:color-mix(in srgb, var(--cit-accent) 55%, var(--cit-surface));border:2px solid var(--cit-ink);border-radius:6px}
  .sb-jar svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .sb-jar b{font-family:var(--cit-font-display);font-weight:600;font-size:14.5px}

  /* GALLERY — photo album page */
  .sb-album{display:grid;gap:30px;grid-template-columns:repeat(2,1fr);margin-top:48px}
  @media(min-width:860px){.sb-album{grid-template-columns:repeat(4,1fr)}}
  .sb-ap{background:var(--cit-surface);border:1px solid color-mix(in srgb, var(--cit-ink) 20%, transparent);padding:9px 9px 12px;transform:rotate(var(--r,0deg));box-shadow:0 8px 22px color-mix(in srgb, var(--cit-ink) 14%, transparent);position:relative;transition:transform .2s}
  .sb-ap:hover{transform:rotate(0) scale(1.05);z-index:2}
  .sb-ap figure{aspect-ratio:1;overflow:hidden;background:color-mix(in srgb, var(--cit-ink) 10%, var(--cit-surface))}
  .sb-ap img{width:100%;height:100%;object-fit:cover}

  /* GUESTBOOK — lined-notebook reviews */
  .sb-gbwrap{background:color-mix(in srgb, var(--cit-bg) 70%, var(--cit-surface));border-top:2px dashed var(--cit-muted);border-bottom:2px dashed var(--cit-muted)}
  .sb-revscore{display:flex;align-items:center;gap:14px;margin:6px 0 4px}
  .sb-revscore b{font-family:var(--cit-font-display);font-weight:800;font-size:44px;color:var(--cit-accent)}
  .sb-stars{display:flex;gap:3px}
  .sb-stars svg{width:18px;height:18px;color:color-mix(in srgb, var(--cit-accent) 70%, var(--cit-ink))}
  .sb-revscore span{font-size:13.5px;color:var(--cit-muted)}
  .sb-gbook{display:grid;gap:28px;grid-template-columns:1fr;margin-top:48px}
  @media(min-width:880px){.sb-gbook{grid-template-columns:repeat(3,1fr)}}
  .sb-gb{background:color-mix(in srgb, white 40%, var(--cit-surface));border:1px solid color-mix(in srgb, var(--cit-ink) 25%, transparent);padding:26px;position:relative;box-shadow:3px 4px 0 color-mix(in srgb, var(--cit-ink) 18%, transparent);transform:rotate(var(--r,0deg));background-image:repeating-linear-gradient(180deg,transparent 0 27px,color-mix(in srgb, var(--cit-ink) 12%, transparent) 27px 28px)}
  .sb-gb p{font-family:'Caveat',cursive;font-size:22px;line-height:28px;margin-bottom:12px}
  .sb-gb footer{font-family:var(--cit-font-display);font-weight:600;font-size:13px;color:var(--cit-accent)}

  /* FAQ — sticky notes */
  .sb-faq{display:grid;gap:22px;grid-template-columns:1fr;margin-top:44px}
  @media(min-width:860px){.sb-faq{grid-template-columns:1fr 1fr}}
  .sb-faq details{background:color-mix(in srgb, var(--cit-accent) 12%, var(--cit-surface));border:1px solid color-mix(in srgb, var(--cit-ink) 20%, transparent);box-shadow:3px 4px 10px color-mix(in srgb, var(--cit-ink) 15%, transparent);transform:rotate(var(--r,0deg))}
  .sb-faq details:nth-child(2n){background:color-mix(in srgb, var(--cit-muted) 16%, var(--cit-surface))}
  .sb-faq summary{list-style:none;cursor:pointer;padding:18px 20px;font-family:var(--cit-font-display);font-weight:600;font-size:15.5px;display:flex;justify-content:space-between;gap:10px}
  .sb-faq summary::after{content:"+";color:var(--cit-accent)}
  .sb-faq details[open] summary::after{content:"−"}
  .sb-faq details p{padding:0 20px 18px;font-size:15px;color:color-mix(in srgb, var(--cit-ink) 88%, transparent)}

  /* MAP + CONTACT — tilted frame + note form */
  .sb-visit{display:grid;gap:30px;grid-template-columns:1fr;margin-top:48px}
  @media(min-width:920px){.sb-visit{grid-template-columns:1.1fr .9fr}}
  .sb-vmap{position:relative;border:10px solid var(--cit-surface);outline:1px solid color-mix(in srgb, var(--cit-ink) 25%, transparent);box-shadow:0 14px 34px color-mix(in srgb, var(--cit-ink) 18%, transparent);min-height:320px;overflow:hidden;transform:rotate(-1deg)}
  .sb-vmap img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
  .sb-vmap .sb-ov{position:absolute;inset:0;background:color-mix(in srgb, var(--cit-ink) 42%, transparent);color:var(--cit-on-accent);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;padding:18px}
  .sb-vmap .sb-ov svg{width:26px;height:26px}
  .sb-vmap b{font-family:var(--cit-font-display);font-weight:800;font-size:19px}
  .sb-vmap span{font-size:14px}
  .sb-note{background:var(--cit-surface);border:2px solid var(--cit-ink);border-radius:6px;padding:28px;box-shadow:5px 5px 0 color-mix(in srgb, var(--cit-ink) 25%, transparent)}
  .sb-note h3{font-family:var(--cit-font-display);font-weight:800;font-size:21px;color:var(--cit-accent);margin-bottom:16px}
  .sb-conline{display:flex;align-items:flex-start;gap:13px;padding:12px 0;border-top:2px dashed var(--cit-muted);font-size:15px}
  .sb-conline:first-of-type{border-top:none}
  .sb-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none;margin-top:2px}
  .sb-conline b{font-family:var(--cit-font-display);font-weight:600;font-size:16px}
  .sb-conline small{display:block;color:var(--cit-muted);font-size:13px}

  /* FOOTER */
  .sb-foot{border-top:2px dashed var(--cit-muted);padding:52px 0 28px;margin-top:60px;color:var(--cit-muted)}
  .sb-fg{display:grid;gap:30px;grid-template-columns:1fr;margin-bottom:34px}
  @media(min-width:800px){.sb-fg{grid-template-columns:2fr 1fr 1fr}}
  .sb-foot h4{font-family:var(--cit-font-display);font-weight:800;font-size:15px;color:var(--cit-accent);margin-bottom:12px}
  .sb-foot .sb-brand{color:var(--cit-accent);font-size:24px}
  .sb-foot p{margin-top:10px;max-width:300px;font-size:15px}
  .sb-foot a{display:block;padding:4px 0;font-size:15px;transition:.2s}
  .sb-foot a:hover{color:var(--cit-accent)}
  .sb-fb{border-top:1px solid color-mix(in srgb, var(--cit-ink) 18%, transparent);padding-top:20px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:13px}

  /* mobile fixed CTA */
  .sb-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:120;background:var(--cit-bg);border-top:2px dashed var(--cit-muted);padding:10px 16px;gap:12px;align-items:center;justify-content:space-between}
  .sb-mobcta span{font-size:14px;color:var(--cit-ink)}
  .sb-mobcta b{color:var(--cit-accent)}
  @media(max-width:700px){.sb-mobcta{display:flex}body{padding-bottom:66px}}

  .sb-sample{font-family:'Caveat',cursive;font-size:18px;color:var(--cit-muted);margin-top:26px;transform:rotate(-1deg);display:inline-block}
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

// deterministic tilt per index — stable, no randomness (mock=live safe)
const TILTS = ["-1.5deg", "1.2deg", "-0.8deg", "2deg", "-1deg", "1.5deg", "-2deg", "0.7deg"];
const tilt = (i: number): string => TILTS[i % TILTS.length]!;

function renderScrapbook(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["scrapbook-paper"]!;
  const heroCopy = copyOf(recipe, "hero");
  const roomCopy = copyOf(recipe, "rooms");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const heroPhoto = photos[0]?.url ?? "";
  const heroPhoto2 = photos[1]?.url ?? "";
  const mapPhoto = photos[2]?.url ?? photos[photos.length - 1]?.url ?? "";
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
    roomsData ? `<a href="#sb-rooms">${T(data, "Szobák")}</a>` : "",
    data.highlights.length ? `<a href="#sb-services">${T(data, "A kamra")}</a>` : "",
    photos.length ? `<a href="#sb-gallery">${T(data, "Fotóalbum")}</a>` : "",
    reviewsData ? `<a href="#sb-reviews">${T(data, "Vendégkönyv")}</a>` : "",
    hasContact ? `<a href="#sb-contact">${T(data, "Kapcsolat")}</a>` : "",
    hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalás")}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="sb-nav">
    <div class="sb-wrap sb-nv">
      <a class="sb-brand" href="#top">${esc(data.name)}</a>
      <div class="sb-menu">
        ${navLinks}
      </div>
    </div>
  </nav>`;

  // -- hero (scrapbook spread) ---------------------------------------------
  let heroScrap: string;
  if (heroPhoto && heroPhoto2) {
    heroScrap = `<div class="sb-scrap">
        <div class="sb-ph sb-ph1 sb-tape"><figure><img src="${esc(heroPhoto)}" alt="${esc(data.name)}"></figure><p class="sb-cap">${T(data, "otthon")}</p></div>
        <div class="sb-ph sb-ph2 sb-pin"><figure><img src="${esc(heroPhoto2)}" alt="${esc(data.name)}"></figure><p class="sb-cap">${T(data, "nálunk")}</p></div>
      </div>`;
  } else if (heroPhoto) {
    heroScrap = `<div class="sb-scrap sb-scrap--solo">
        <div class="sb-solo sb-ph sb-tape"><figure><img src="${esc(heroPhoto)}" alt="${esc(data.name)}"></figure><p class="sb-cap">${T(data, "otthon")}</p></div>
      </div>`;
  } else {
    heroScrap = `<div class="sb-scrap sb-scrap--solo"><div class="sb-flat"></div></div>`;
  }
  const hero = `<header class="sb-hero" id="top">
    <div class="sb-wrap">
      <div class="sb-herogrid">
        <div>
          ${heroCopy.eyebrow ? `<span class="sb-eyebrow">${esc(heroCopy.eyebrow)}</span>` : ""}
          <h1>${accented(h1, heroCopy.accent)}</h1>
          ${sub ? `<p>${esc(sub)}</p>` : ""}
          <div class="sb-heroctas">
            ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szobát foglalnék")}</a>` : ""}
            ${photos.length ? `<a class="cit-btn cit-btn-ghost" href="#sb-gallery">${T(data, "Fotóalbum")}</a>` : ""}
          </div>
        </div>
        ${heroScrap}
      </div>
    </div>
  </header>`;

  // -- booking (recipe card) -----------------------------------------------
  const bookbar = `<div class="sb-book">
    <div class="sb-wrap">
      <div class="sb-recipe sb-tape">
        ${bookingSlot(data, phase)}
      </div>
    </div>
  </div>`;

  // -- rooms (Polaroid stack) ----------------------------------------------
  const rooms = roomsData
    ? `<section class="sb-sec" id="sb-rooms">
    <div class="sb-wrap">
      ${roomCopy.eyebrow ? `<span class="sb-eyebrow">${esc(roomCopy.eyebrow)}</span>` : `<span class="sb-eyebrow">${T(data, "a szobák")}</span>`}
      <h2>${roomCopy.title ? accented(roomCopy.title, roomCopy.accent) : T(data, "Ahol megszállhat")}</h2>
      <div class="sb-rooms" data-cit-module="rooms">
        ${roomsData
          .map(
            (r, i) => `<article class="sb-room" style="--r:${tilt(i)}">
          ${r.photo?.url ? `<figure><img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt || r.name)}"></figure>` : `<figure>${photoFill(r.name)}</figure>`}
          <h3>${esc(r.name)}</h3>
          ${r.capacity ? `<p class="sb-mt">${esc(r.capacity)}</p>` : ""}
          ${r.note ? `<p>${esc(r.note)}</p>` : ""}
          <div class="sb-ft">
            ${r.price ? `<span class="sb-pr">${esc(r.price)}</span>` : "<span></span>"}
            ${hasContact ? `<a class="sb-cta" href="#cit-enquiry">${T(data, "Ezt kérjük")}</a>` : ""}
          </div>
        </article>`,
          )
          .join("\n        ")}
      </div>
      ${roomsSample ? `<span class="sb-sample">${T(data, "Minta — ide az Ön szobái és árai kerülnek.")}</span>` : ""}
    </div>
  </section>`
    : "";

  // -- amenities (pantry jars, real highlights only) -----------------------
  const amen = data.highlights.length
    ? `<section class="sb-sec" id="sb-services" style="padding-top:24px">
    <div class="sb-wrap">
      <span class="sb-eyebrow">${T(data, "a kamra polcáról")}</span>
      <h2>${T(data, "Ami nálunk jár")}</h2>
      <div class="sb-kamra">
        ${data.highlights
          .slice(0, 8)
          .map((h, i) => `<div class="sb-jar" style="--r:${tilt(i)}">${amenityIconSvg(h, data.amenityIconMap)}<b>${esc(h)}</b></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- gallery (photo album) -----------------------------------------------
  const gallery = photos.length
    ? `<section class="sb-sec" id="sb-gallery" style="padding-top:24px">
    <div class="sb-wrap">
      ${galCopy.eyebrow ? `<span class="sb-eyebrow">${esc(galCopy.eyebrow)}</span>` : `<span class="sb-eyebrow">${T(data, "lapozzon bele")}</span>`}
      <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Fotóalbum")}</h2>
      <div class="sb-album" data-cit-module="gallery">
        ${photos
          .slice(0, 8)
          .map((p, i) => `<div class="sb-ap${i % 3 === 2 ? " sb-pin" : i % 3 === 0 ? " sb-tape" : ""}" style="--r:${tilt(i)}"><figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews (guestbook) -------------------------------------------------
  const stars5 = starCount ? `<div class="sb-stars">${starIcon().repeat(starCount)}</div>` : "";
  const reviews = reviewsData
    ? `<div class="sb-gbwrap"><section class="sb-sec" id="sb-reviews" data-cit-module="reviews" style="padding-top:64px;padding-bottom:64px">
    <div class="sb-wrap">
      ${revCopy.eyebrow ? `<span class="sb-eyebrow">${esc(revCopy.eyebrow)}</span>` : `<span class="sb-eyebrow">${T(data, "a vendégkönyvből")}</span>`}
      <h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Ide írtak nekünk")}</h2>
      ${ratingStat ? `<div class="sb-revscore"><b>${esc(ratingStat.value)}</b>${stars5}<span>${esc(ratingStat.label)}</span></div>` : ""}
      <div class="sb-gbook">
        ${reviewsData
          .map(
            (r, i) =>
              `<div class="sb-gb" style="--r:${tilt(i)}"><p>${esc(r.quote)}</p><footer>— ${esc(r.author)}${r.meta ? `, ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${reviewsSample ? `<span class="sb-sample">${T(data, "Minta — ide az Ön vendégeinek értékelései kerülnek.")}</span>` : ""}
    </div>
  </section></div>`
    : "";

  // -- faq (sticky notes) --------------------------------------------------
  const faq = faqsData
    ? `<section class="sb-sec" id="sb-faq" style="padding-top:64px">
    <div class="sb-wrap">
      <span class="sb-eyebrow">${T(data, "felragasztott cetlik")}</span>
      <h2>${T(data, "Jó, ha tudja")}</h2>
      <div class="sb-faq">
        ${faqsData
          .map(
            (f, i) =>
              `<details${i === 0 ? " open" : ""} style="--r:${tilt(i)}"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
          )
          .join("\n        ")}
      </div>
      ${faqsSample ? `<span class="sb-sample">${T(data, "Minta — ide az Ön saját válaszai kerülnek.")}</span>` : ""}
    </div>
  </section>`
    : "";

  // -- contact (tilted map frame + note) -----------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="sb-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="sb-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="sb-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const mapFrame = c.address
    ? `<div class="sb-vmap">
        ${mapPhoto ? `<img src="${esc(mapPhoto)}" alt="${esc(data.name)}">` : ""}
        <div class="sb-ov">${CONTACT_ICONS.location}<b>${esc(data.name)}</b><span>${esc(c.address)}</span></div>
      </div>`
    : "";
  const contact = contactLines
    ? `<section class="sb-sec" id="sb-contact" style="padding-top:24px">
    <div class="sb-wrap">
      <span class="sb-eyebrow">${T(data, "várjuk szeretettel")}</span>
      <h2>${T(data, "Itt talál minket")}</h2>
      <div class="sb-visit">
        ${mapFrame}
        <div class="sb-note">
          <h3>${T(data, "Írjon nekünk")}</h3>
          ${contactLines}
          ${hasContact ? `<a class="cit-btn" style="margin-top:18px" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        </div>
      </div>
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="sb-foot">
    <div class="sb-wrap">
      <div class="sb-fg">
        <div>
          <span class="sb-brand sb-hand">${esc(data.name)}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Lapozó")}</h4>
          ${roomsData ? `<a href="#sb-rooms">${T(data, "Szobák")}</a>` : ""}
          ${photos.length ? `<a href="#sb-gallery">${T(data, "Fotóalbum")}</a>` : ""}
          ${reviewsData ? `<a href="#sb-reviews">${T(data, "Vendégkönyv")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Tudnivalók")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="sb-fb">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
      </div>
    </div>
  </footer>`;

  const mobcta = hasContact
    ? `<div class="sb-mobcta">
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
${SCRAPBOOK_CSS}
  </style>
</head>
<body class="cit-tpl-scrapbook">
    ${nav}
    ${hero}
    ${bookbar}
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
</body>
</html>`;
}

export const SCRAPBOOK: ArtTemplate = {
  id: "scrapbook",
  label: "Scrapbook — papír-emlékkönyv, ragasztott polaroidok, kézzel írt (referencia 15)", // i18n-exempt: operator-facing (console template picker)
  skins: ["scrapbook-paper", "sand-cream-airy", "watercolor-lake"],
  render: renderScrapbook,
};
