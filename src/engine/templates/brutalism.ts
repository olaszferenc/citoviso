// "brutalism" art template (ADR-0027) — the 08-brutalism reference direction (Bunker Hostel).
// Neo-brutalist character: thick --cit-ink borders everywhere, hard offset shadows
// (`Npx Npx 0 var(--cit-ink)`), a top marquee band built ONLY from real facts, a sticky
// cell-link nav, an asymmetric hero grid (giant uppercase display + real-fact tag chips /
// photo), an "industrial console" booking band on dark, numbered section tags, an amenity
// cell grid, a taped polaroid gallery, stamped review cards, a contact block and a dark
// footer. All styling dresses from the 11 --cit-* tokens (+ color-mix derivations) — the
// brutal character comes from THIS template's CSS, the skin only supplies the palette.

import { iconSvg, matchIcon, starIcon, starRow } from "../icons.js";
import { amenityIconSvg } from "../amenityIcon.js";
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

// Monospace stack for the "industrial" voice (labels, tags, marquee). System fonts only —
// the skin decides the display/body families; the mono accent is template character.
const MONO = `ui-monospace, 'SFMono-Regular', 'Cascadia Mono', Menlo, Consolas, monospace`;

// Accent lifted toward the (light) background — keeps accent-toned text readable on the
// dark --cit-ink bands regardless of how dark the skin's raw accent is.
const ACC_LIGHT = `color-mix(in srgb, var(--cit-accent) 55%, var(--cit-bg))`;

// Film-grain overlay as an SVG data URI (turbulence noise). Decorative texture, not an icon.
const GRAIN =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")`;

const BRUTALISM_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);background:var(--cit-bg);color:var(--cit-ink);font-size:16px;line-height:1.55;position:relative}
  body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:999;opacity:.06;background-image:${GRAIN}}

  /* shared module sections (.cit-modsec) themed to the brutal rhythm (ADR-0057):
     sharp corners (radius:0), heavy uppercase left-aligned heads, visible band divider */
  body.cit-tpl-brutalism{
    --cit-modsec-py:76px;
    --cit-modsec-maxw:1200px;
    --cit-modsec-px:28px;
    --cit-modsec-divider:1px solid var(--cit-line);
    --cit-modsec-head-align:left;
    --cit-modsec-head-mb:16px;
    --cit-modsec-head-size:clamp(32px,5.5vw,60px);
    --cit-modsec-head-weight:700;
    --cit-modsec-card-radius:0;
    --cit-modsec-card-pad:24px 22px}

  img{display:block;width:100%;height:100%;object-fit:cover;filter:contrast(1.05) saturate(.92)}
  a{color:inherit;text-decoration:none}
  h1,h2,h3{font-family:var(--cit-font-display);font-weight:700;text-transform:uppercase;line-height:1.03;letter-spacing:-.5px}
  .b-wrap{width:min(1200px,93%);margin:0 auto}
  .b-mono{font-family:${MONO}}

  /* buttons — hard offset shadow, no radius (the brutal signature) */
  .cit-btn{display:inline-block;background:var(--cit-ink);color:var(--cit-bg);font-weight:700;text-transform:uppercase;font-size:14px;letter-spacing:.5px;padding:15px 28px;border:3px solid var(--cit-ink);box-shadow:6px 6px 0 var(--cit-accent);cursor:pointer;transition:transform .12s,box-shadow .12s}
  .cit-btn:hover{transform:translate(3px,3px);box-shadow:3px 3px 0 var(--cit-accent)}
  .cit-btn--alt{background:var(--cit-accent);color:var(--cit-on-accent);box-shadow:6px 6px 0 var(--cit-ink)}
  .cit-btn--alt:hover{box-shadow:3px 3px 0 var(--cit-ink)}
  .cit-btn-disabled{opacity:.55;pointer-events:none}

  /* marquee — real facts on a dark band; deterministic CSS loop, motion-gated */
  .b-marq{background:var(--cit-ink);color:${ACC_LIGHT};overflow:hidden;white-space:nowrap}
  .b-marq-in{display:inline-block;padding:9px 0;font-family:${MONO};font-size:13px;letter-spacing:.5px;text-transform:uppercase;animation:b-roll 28s linear infinite}
  .b-marq-in span{display:inline-block}
  @keyframes b-roll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @media(prefers-reduced-motion:reduce){.b-marq-in{animation:none}}

  /* sticky nav — thick bottom rule, cell links with left rules */
  .b-nav{position:sticky;top:0;z-index:100;background:var(--cit-bg);border-bottom:3px solid var(--cit-ink)}
  .b-nav-in{display:flex;align-items:stretch;justify-content:space-between}
  .b-brand{display:flex;align-items:center;gap:10px;font-family:var(--cit-font-display);font-weight:700;font-size:18px;text-transform:uppercase;padding:14px 0;letter-spacing:-.3px}
  .b-brand .b-sq{width:14px;height:14px;background:var(--cit-accent);flex:none}
  .b-menu{display:none;list-style:none}
  @media(min-width:960px){.b-menu{display:flex}}
  .b-menu a{display:flex;align-items:center;height:100%;padding:0 18px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.5px;border-left:3px solid var(--cit-ink);transition:background .15s}
  .b-menu a:hover{background:var(--cit-accent);color:var(--cit-on-accent)}
  .b-menu a.b-bk{background:var(--cit-ink);color:var(--cit-bg)}
  .b-menu a.b-bk:hover{background:var(--cit-accent);color:var(--cit-on-accent)}

  /* hero — asymmetric grid: giant display left, framed photo right */
  .b-hero{border-bottom:3px solid var(--cit-ink)}
  .b-hero-grid{display:grid;grid-template-columns:1fr}
  @media(min-width:960px){.b-hero-grid{grid-template-columns:1.15fr .85fr}}
  .b-hero-l{padding:54px 5% 46px}
  @media(max-width:959px){.b-hero-l{border-bottom:3px solid var(--cit-ink)}}
  @media(min-width:960px){.b-hero-l{border-right:3px solid var(--cit-ink)}}
  .b-hero-l h1{font-size:clamp(42px,8.5vw,100px);margin-bottom:20px;overflow-wrap:anywhere}
  .b-hero-l h1 em{font-style:normal;color:var(--cit-accent)}
  .b-hero-sub{max-width:480px;font-size:17px;margin-bottom:26px;color:color-mix(in srgb, var(--cit-ink) 78%, var(--cit-muted))}
  .b-tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:30px}
  .b-tag{font-family:${MONO};font-size:12px;text-transform:uppercase;border:2px solid var(--cit-ink);padding:6px 12px;background:var(--cit-surface);display:inline-flex;align-items:center;gap:7px}
  .b-tag svg{width:13px;height:13px;color:var(--cit-accent);flex:none}
  .b-ctas{display:flex;flex-wrap:wrap;gap:14px}
  .b-hero-r{position:relative;min-height:340px}
  .b-hero-r img,.b-hero-r .b-flat{position:absolute;inset:0;width:100%;height:100%}
  .b-flat{background:linear-gradient(150deg, color-mix(in srgb, var(--cit-accent) 30%, var(--cit-bg)), color-mix(in srgb, var(--cit-ink) 62%, var(--cit-accent)))}
  .b-stamp{position:absolute;top:18px;right:18px;background:var(--cit-accent);color:var(--cit-on-accent);font-family:${MONO};font-size:11px;text-transform:uppercase;padding:10px 14px;border:3px solid var(--cit-ink);transform:rotate(4deg);z-index:2}
  .b-stamp strong{display:block;font-size:20px;font-family:var(--cit-font-display)}

  /* booking — industrial console band on dark (canonical hydrated slot inside) */
  .b-console{background:var(--cit-ink);color:var(--cit-bg);border-bottom:3px solid var(--cit-ink);padding:26px 0 30px}
  .b-console-label{font-family:${MONO};font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${ACC_LIGHT};margin-bottom:14px}
  .b-console .cit-book{background:none;border:0;box-shadow:none;padding:0;color:var(--cit-bg)}
  .b-console .cit-book__label{color:${ACC_LIGHT};font-family:${MONO}}
  .b-console .cit-book__input{border:0;border-radius:0;background:var(--cit-bg);color:var(--cit-ink)}
  .b-console .cit-book__step{border-radius:0}
  .b-console .cit-book__submit{border-radius:0;background:${ACC_LIGHT};color:var(--cit-ink);font-family:var(--cit-font-body);text-transform:uppercase;letter-spacing:.5px}
  .b-console .cit-book__note{color:color-mix(in srgb, var(--cit-bg) 65%, transparent)}
  .b-console .cit-enquiry-bar-inner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem}
  .b-console .cit-enquiry-bar-title{font-family:${MONO};font-size:14px;text-transform:uppercase;letter-spacing:1px;color:var(--cit-bg);margin:0}
  .b-console .cit-btn{background:${ACC_LIGHT};color:var(--cit-ink);border-color:var(--cit-ink);box-shadow:4px 4px 0 color-mix(in srgb, var(--cit-bg) 35%, transparent)}

  /* sections — numbered tags, thick band rules */
  section.b-sec{padding:76px 0;border-bottom:3px solid var(--cit-ink)}
  .b-sectag{display:inline-block;font-family:${MONO};font-size:12px;text-transform:uppercase;letter-spacing:.5px;background:var(--cit-ink);color:var(--cit-bg);padding:6px 12px;margin-bottom:18px}
  section.b-sec h2{font-size:clamp(32px,5.5vw,60px);margin-bottom:16px}
  section.b-sec h2 em{font-style:normal;color:var(--cit-accent)}
  .b-lead{max-width:560px;color:color-mix(in srgb, var(--cit-ink) 65%, var(--cit-muted));font-size:16.5px}

  /* amenity cell grid — thick inner rules */
  .b-fac{display:grid;grid-template-columns:1fr;border:3px solid var(--cit-ink);margin-top:42px;background:var(--cit-surface)}
  @media(min-width:680px){.b-fac{grid-template-columns:repeat(2,1fr)}}
  .b-fc{padding:24px 22px;border-right:3px solid var(--cit-ink);border-bottom:3px solid var(--cit-ink);transition:background .15s}
  .b-fc:hover{background:color-mix(in srgb, var(--cit-accent) 14%, var(--cit-surface))}
  .b-fc .b-fc-n{display:block;font-family:${MONO};font-size:11px;color:var(--cit-muted);margin-bottom:10px}
  .b-fc svg{width:28px;height:28px;color:var(--cit-accent);margin-bottom:12px}
  .b-fc p{font-size:15px;line-height:1.5}

  /* gallery — taped polaroids (deterministic nth-child tilt, no randomness) */
  .b-gal{display:grid;gap:28px;grid-template-columns:repeat(2,1fr);margin-top:44px}
  @media(min-width:860px){.b-gal{grid-template-columns:repeat(3,1fr)}}
  .b-tp{background:var(--cit-surface);border:3px solid var(--cit-ink);padding:8px 8px 24px;position:relative;transform:rotate(var(--r,0deg));transition:transform .2s}
  .b-tp:hover{transform:rotate(0) scale(1.03);z-index:2}
  .b-tp::before{content:"";position:absolute;top:-12px;left:50%;transform:translateX(-50%) rotate(-2deg);width:80px;height:24px;background:color-mix(in srgb, var(--cit-accent) 65%, var(--cit-bg));opacity:.85;border:1px solid color-mix(in srgb, var(--cit-ink) 25%, transparent)}
  .b-tp:nth-child(4n+1){--r:-2deg}.b-tp:nth-child(4n+2){--r:1.6deg}.b-tp:nth-child(4n+3){--r:-1deg}.b-tp:nth-child(4n){--r:2.2deg}
  .b-tp figure{aspect-ratio:1;overflow:hidden}
  .b-tp figcaption{font-family:${MONO};font-size:11px;text-align:center;padding-top:9px;color:var(--cit-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* reviews — stamped cards with hard shadows */
  .b-revhead{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:24px}
  .b-score-stamp{background:var(--cit-accent);color:var(--cit-on-accent);border:3px solid var(--cit-ink);font-family:${MONO};font-size:11px;text-transform:uppercase;padding:12px 16px;transform:rotate(3deg);flex:none}
  .b-score-stamp strong{display:block;font-size:24px;font-family:var(--cit-font-display)}
  .b-rev{display:grid;gap:28px;grid-template-columns:1fr;margin-top:42px}
  @media(min-width:860px){.b-rev{grid-template-columns:repeat(3,1fr)}}
  .b-rv{background:var(--cit-surface);border:3px solid var(--cit-ink);padding:24px;box-shadow:8px 8px 0 var(--cit-ink)}
  .b-rv .cit-stars{display:inline-flex;gap:3px;color:var(--cit-accent);margin-bottom:14px}
  .b-rv .cit-stars svg{width:15px;height:15px}
  .b-rv p{font-size:14.5px;margin-bottom:16px}
  .b-rv footer{font-family:${MONO};font-size:12px;text-transform:uppercase;color:var(--cit-muted)}
  .b-sample{margin-top:30px;font-family:${MONO};font-size:12px;color:var(--cit-muted)}

  /* contact — bordered split block */
  .b-loc{display:grid;grid-template-columns:1fr;border:3px solid var(--cit-ink);margin-top:42px;background:var(--cit-surface)}
  @media(min-width:900px){.b-loc{grid-template-columns:1fr 1fr}}
  .b-conlines{padding:26px}
  .b-conline{display:flex;gap:14px;align-items:flex-start;padding:16px 0;border-bottom:2px solid var(--cit-line)}
  .b-conline:last-of-type{border-bottom:none}
  .b-conline svg{width:20px;height:20px;color:var(--cit-accent);flex:none;margin-top:2px}
  .b-conline b{display:block;font-size:16px}
  .b-conline small{font-family:${MONO};font-size:11px;text-transform:uppercase;color:var(--cit-muted)}
  .b-conlines .cit-btn{margin-top:22px}
  .b-conphoto{position:relative;min-height:300px;border-top:3px solid var(--cit-ink)}
  @media(min-width:900px){.b-conphoto{border-top:none;border-left:3px solid var(--cit-ink)}}
  .b-conphoto img{position:absolute;inset:0;width:100%;height:100%}

  /* footer — dark, mono legal line */
  .b-foot{background:var(--cit-ink);color:var(--cit-bg);padding:50px 0 24px}
  .b-fg{display:grid;gap:30px;grid-template-columns:1fr;margin-bottom:36px}
  @media(min-width:800px){.b-fg{grid-template-columns:2fr 1fr 1fr}}
  .b-foot .b-brand{padding:0;margin-bottom:12px}
  .b-foot p{max-width:300px;font-size:14px;color:color-mix(in srgb, var(--cit-bg) 80%, transparent)}
  .b-foot h4{font-family:${MONO};font-size:12px;text-transform:uppercase;color:${ACC_LIGHT};margin-bottom:14px}
  .b-foot ul{list-style:none}
  .b-foot li{margin-bottom:8px;font-size:14px}
  .b-foot a:hover{color:${ACC_LIGHT}}
  .b-fb{border-top:3px solid ${ACC_LIGHT};padding-top:20px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-family:${MONO};font-size:11px;text-transform:uppercase;color:color-mix(in srgb, var(--cit-bg) 75%, transparent)}

  /* mobile fixed CTA bar */
  .b-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:120;background:var(--cit-ink);border-top:3px solid var(--cit-accent);padding:10px 14px;align-items:center;justify-content:space-between;gap:12px}
  .b-mobcta span{color:var(--cit-bg);font-family:${MONO};font-size:12px;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .b-mobcta .cit-btn{padding:11px 18px;font-size:13px;background:${ACC_LIGHT};color:var(--cit-ink);border-color:var(--cit-ink);box-shadow:none;flex:none}
  @media(max-width:700px){.b-mobcta{display:flex}body{padding-bottom:64px}}
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

/** Real rating as a display pair ("4,8" + "65 értékelés"-style label), or null. §B.17: built
 *  only from the lead's real rating data — never a default. */
function ratingDisplay(data: SiteData): { value: string; label: string } | null {
  const stat = data.stats?.find((s) => s.icon === "star");
  if (stat) return { value: stat.value, label: stat.label };
  if (data.rating) {
    return {
      value: String(data.rating.value).replace(".", ","),
      label: data.rating.count
        ? T(data, "{n} értékelés", { n: data.rating.count })
        : T(data, "értékelés"),
    };
  }
  return null;
}

function renderBrutalism(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["alpine-bold"]!;
  const heroCopy = copyOf(recipe, "hero");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");
  const locCopy = copyOf(recipe, "location");

  const photos = data.photos;
  const heroPhoto = photos[0];
  const contactPhoto = photos[3] ?? photos[photos.length - 1];
  const c = data.contact;
  const hasContact = Boolean(c.email || c.phone);
  const rating = ratingDisplay(data);
  const stars = honestStarCount(data);

  const h1 = heroCopy.lead || data.tagline || data.name;
  const sub = data.tagline && data.tagline !== h1 ? data.tagline : firstSentence(data.intro);

  // Sections actually present (drives nav links + the numbered section tags).
  const hasFeatures = Boolean(data.highlights.length || data.intro);
  const hasGallery = photos.length > 0;
  const realReviews = data.reviews && data.reviews.length ? data.reviews : null;
  // §B.17 phase gate: no real reviews → marked sample in MOCK, dropped on LIVE.
  const reviewsData = realReviews;
  const contactLines = [
    c.phone
      ? `<div class="b-conline">${CONTACT_ICONS.phone}<div><b><a href="tel:${esc(c.phone.replace(/\s+/g, ""))}">${esc(c.phone)}</a></b><small>${T(data, "Telefon")}</small></div></div>`
      : "",
    c.email
      ? `<div class="b-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "E-mail")}</small></div></div>`
      : "",
    c.address
      ? `<div class="b-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Cím")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");

  // -- marquee (REAL facts only: name, rating, address, phone, email) -------
  const marqItems = [
    data.name,
    rating ? `${rating.value} — ${rating.label}` : "",
    c.address ?? "",
    c.phone ? T(data, "Tel: {phone}", { phone: c.phone }) : "",
    c.email ?? "",
  ].filter(Boolean);
  // Two identical halves → the -50% keyframe loops seamlessly; each half repeats the
  // sequence 3× so the band stays filled even with a short fact list.
  const marqHalf = esc(`${marqItems.join(" // ")} // `.repeat(3));
  const marquee = `<div class="b-marq"><div class="b-marq-in"><span>${marqHalf}</span><span aria-hidden="true">${marqHalf}</span></div></div>`;

  // -- sticky nav -----------------------------------------------------------
  const navLinks = [
    hasFeatures ? `<li><a href="#b-features">${T(data, "Adottságok")}</a></li>` : "",
    hasGallery ? `<li><a href="#b-gallery">${T(data, "Galéria")}</a></li>` : "",
    reviewsData ? `<li><a href="#b-reviews">${T(data, "Vélemények")}</a></li>` : "",
    contactLines ? `<li><a href="#b-contact">${T(data, "Kapcsolat")}</a></li>` : "",
    `<li><a class="b-bk" href="#cit-enquiry">${T(data, "Foglalás")}</a></li>`,
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="b-nav">
    <div class="b-wrap b-nav-in">
      <a class="b-brand" href="#top"><span class="b-sq"></span>${esc(data.name)}</a>
      <ul class="b-menu">
        ${navLinks}
      </ul>
    </div>
  </nav>`;

  // -- hero -----------------------------------------------------------------
  const tags = [
    rating
      ? `<span class="b-tag">${starIcon()}${esc(rating.value)} — ${esc(rating.label)}</span>`
      : "",
    c.address ? `<span class="b-tag">${CONTACT_ICONS.location}${esc(c.address)}</span>` : "",
    c.phone ? `<span class="b-tag">${CONTACT_ICONS.phone}${esc(c.phone)}</span>` : "",
  ]
    .filter(Boolean)
    .join("");
  const heroMedia = heroPhoto
    ? `<img src="${esc(heroPhoto.url)}" alt="${esc(heroPhoto.alt)}">`
    : `<div class="b-flat"></div>`;
  const heroStamp = rating
    ? `<div class="b-stamp">${esc(rating.label)}<strong>${esc(rating.value)} / 5</strong></div>`
    : "";
  const hero = `<header class="b-hero" id="top">
    <div class="b-hero-grid">
      <div class="b-hero-l">
        <h1>${accented(h1, heroCopy.accent)}<em>.</em></h1>
        ${sub ? `<p class="b-hero-sub">${esc(sub)}</p>` : ""}
        ${tags ? `<div class="b-tags">${tags}</div>` : ""}
        <div class="b-ctas">
          <a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalási igény")}</a>
          ${hasGallery ? `<a class="cit-btn cit-btn--alt" href="#b-gallery">${T(data, "Mi van bent?")}</a>` : ""}
        </div>
      </div>
      <div class="b-hero-r">
        ${heroMedia}
        ${heroStamp}
      </div>
    </div>
  </header>`;

  // -- booking: industrial console band (canonical hydrated slot inside) ----
  const console_ = `<div class="b-console">
    <div class="b-wrap">
      <p class="b-console-label">&gt;&gt; ${T(data, "Foglalási konzol // közvetlen kapcsolat, közvetítő nélkül")}</p>
      ${bookingSlot(data, phase)}
    </div>
  </div>`;

  // -- numbered section tags (sequential over the sections actually shown) --
  let secNo = 0;
  const secTag = (label: string): string =>
    `<span class="b-sectag">${String(++secNo).padStart(2, "0")} / ${esc(label)}</span>`;

  // -- features: intro lead + amenity cell grid (real highlights only) ------
  const facCells = data.highlights
    .map(
      (h, i) =>
        `<div class="b-fc"><span class="b-fc-n">${String(i + 1).padStart(2, "0")}</span>${amenityIconSvg(h, data.amenityIconMap)}<p>${esc(h)}</p></div>`,
    )
    .join("\n        ");
  const features = hasFeatures
    ? `<section class="b-sec" id="b-features">
    <div class="b-wrap">
      ${secTag(featCopy.eyebrow ?? T(data, "Adottságok"))}
      <h2>${featCopy.title ? accented(featCopy.title, featCopy.accent) : T(data, "Amit itt talál")}</h2>
      ${data.intro ? `<p class="b-lead">${esc(data.intro)}</p>` : ""}
      ${facCells ? `<div class="b-fac">${facCells}</div>` : ""}
    </div>
  </section>`
    : "";

  // -- gallery: taped polaroids, captions from the real alt texts -----------
  const gallery = hasGallery
    ? `<section class="b-sec" id="b-gallery">
    <div class="b-wrap">
      ${secTag(galCopy.eyebrow ?? T(data, "A fal"))}
      <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Képek a helyszínről")}</h2>
      <div class="b-gal" data-cit-module="gallery">
        ${photos
          .slice(0, 6)
          .map(
            (p) =>
              `<div class="b-tp"><figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure><figcaption>${esc(p.alt)}</figcaption></div>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews: stamped cards; score stamp ONLY from the real rating (§B.17) --
  const cardStars = stars ? starRow(stars) : "";
  const reviews = reviewsData
    ? `<section class="b-sec" id="b-reviews" data-cit-module="reviews">
    <div class="b-wrap">
      <div class="b-revhead">
        <div>
          ${secTag(revCopy.eyebrow ?? T(data, "Vendégek mondták"))}
          <h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégek mondták")}</h2>
        </div>
        ${rating ? `<div class="b-score-stamp">${esc(rating.label)}<strong>${esc(rating.value)} / 5</strong></div>` : ""}
      </div>
      <div class="b-rev">
        ${reviewsData
          .map(
            (r) =>
              `<div class="b-rv">${cardStars}<p>„${esc(r.quote)}"</p><footer>— ${esc(r.author)}${r.meta ? `, ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${realReviews ? "" : `<div class="b-sample">${T(data, "Minta — ide az Ön vendégeinek értékelései kerülnek.")}</div>`}
    </div>
  </section>`
    : "";

  // -- contact block --------------------------------------------------------
  const contact = contactLines
    ? `<section class="b-sec" id="b-contact">
    <div class="b-wrap">
      ${secTag(locCopy.eyebrow ?? T(data, "Infó"))}
      <h2>${locCopy.title ? accented(locCopy.title, locCopy.accent) : T(data, "Kapcsolat és elérés")}</h2>
      <div class="b-loc">
        <div class="b-conlines">
          ${contactLines}
          ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalási igény")}</a>` : ""}
        </div>
        ${contactPhoto ? `<div class="b-conphoto"><img src="${esc(contactPhoto.url)}" alt="${esc(contactPhoto.alt)}"></div>` : ""}
      </div>
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="b-foot">
    <div class="b-wrap">
      <div class="b-fg">
        <div>
          <span class="b-brand"><span class="b-sq"></span>${esc(data.name)}</span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Menü")}</h4>
          <ul>
            ${hasFeatures ? `<li><a href="#b-features">${T(data, "Adottságok")}</a></li>` : ""}
            ${hasGallery ? `<li><a href="#b-gallery">${T(data, "Galéria")}</a></li>` : ""}
            ${reviewsData ? `<li><a href="#b-reviews">${T(data, "Vélemények")}</a></li>` : ""}
            <li><a href="#cit-enquiry">${T(data, "Foglalás")}</a></li>
          </ul>
        </div>
        <div>
          <h4>${T(data, "Kontakt")}</h4>
          <ul>
            ${c.phone ? `<li>${esc(c.phone)}</li>` : ""}
            ${c.email ? `<li>${esc(c.email)}</li>` : ""}
            ${c.address ? `<li>${esc(c.address)}</li>` : ""}
            ${!hasContact && !c.address ? `<li><a href="#cit-enquiry">${ctaLabel(data, phase)}</a></li>` : ""}
          </ul>
        </div>
      </div>
      <div class="b-fb">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        <span><a href="#top">${T(data, "Vissza a tetejére")}</a></span>
      </div>
    </div>
  </footer>`;

  // -- mobile fixed CTA bar -------------------------------------------------
  const mobcta = hasContact
    ? `<div class="b-mobcta">
    <span>${rating ? `${esc(rating.value)} — ${esc(rating.label)}` : esc(data.name)}</span>
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
${BRUTALISM_CSS}
  </style>
</head>
<body class="cit-tpl-brutalism">
    ${marquee}
    ${nav}
    ${hero}
    ${console_}
    ${features}
    ${slotMarker("showcase")}
    ${gallery}
    ${reviews}
    ${slotMarker("trust")}
    ${slotMarker("practical")}
    ${contact}
    ${slotMarker("closing")}
    ${footer}
    ${mobcta}
</body>
</html>`;
}

export const BRUTALISM: ArtTemplate = {
  id: "brutalism",
  label: "Brutalizmus — vastag keretek, acid akcent, marquee (referencia 08)", // i18n-exempt: operator-facing (console template picker)
  // Light skins with a punchy accent — the brutal character (thick ink borders, hard
  // shadows, mono tags) comes from this template's CSS; the skin supplies the palette.
  // alpine-bold: amber accent + heavy Archivo display = closest to the reference's voice.
  skins: ["alpine-bold", "editorial-magazine", "tuscan-terracotta", "coastal-fresh"],
  render: renderBrutalism,
};
