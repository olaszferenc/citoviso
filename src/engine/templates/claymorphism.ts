// "claymorphism" art template (ADR-0027) — the mock_18 soft-clay reference direction.
// A LIGHT, friendly wellness stay: neumorphic "clay" surfaces (raised cards with a double
// soft shadow + inset/sunken input fields), big rounded corners, and soft "bubble" icon
// circles for the wellness grid. The signature move is the tactile clay depth: elements feel
// pressed out of, or into, the page. The clay-soft skin (aqua accent on a cool off-white) is
// the intended pairing. All styling dresses from the 11 --cit-* tokens (+ color-mix / neutral
// white/black rgba scrims for the neumorphic light/shadow) — never raw hex. Floating hero
// stat-cards render ONLY from REAL data.stats / data.rating (§B.17: no fabricated numbers).
// See templateKit.ts for the shared contract.

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
  photoFill,
  sampleRooms,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const CLAY_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.7;font-size:16px}

  /* shared module sections (.cit-modsec) themed to this template's soft-clay rhythm (ADR-0057) */
  body.cit-tpl-claymorphism{
    --cit-modsec-py:80px;
    --cit-modsec-maxw:1160px;
    --cit-modsec-px:28px;
    --cit-modsec-divider:0;
    --cit-modsec-head-align:left;
    --cit-modsec-head-mb:46px;
    --cit-modsec-head-size:clamp(28px,4vw,44px);
    --cit-modsec-head-weight:600;
    --cit-modsec-card-radius:26px;
    --cit-modsec-card-pad:28px 30px}

  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .cl-wrap{width:min(1160px,93%);margin:0 auto}
  h1,h2,h3,h4{font-family:var(--cit-font-display);font-weight:600;line-height:1.15}

  /* clay surfaces — the signature neumorphic double shadow (raised) + inset (sunken) */
  .cl-clay{background:var(--cit-surface);border-radius:var(--cit-radius);box-shadow:8px 8px 20px color-mix(in srgb, var(--cit-ink) 14%, transparent), -8px -8px 20px rgba(255,255,255,.9)}
  .cl-inset{background:var(--cit-bg);border-radius:calc(var(--cit-radius) - 6px);box-shadow:inset 5px 5px 12px color-mix(in srgb, var(--cit-ink) 14%, transparent), inset -5px -5px 12px rgba(255,255,255,.9)}

  .cl-eyebrow{display:inline-block;font-family:var(--cit-font-display);font-weight:500;font-size:13px;color:var(--cit-accent);background:var(--cit-bg);padding:8px 18px;border-radius:100px;box-shadow:inset 3px 3px 7px color-mix(in srgb, var(--cit-ink) 14%, transparent), inset -3px -3px 7px rgba(255,255,255,.9);margin-bottom:16px}
  .cl-btn{display:inline-block;font-family:var(--cit-font-display);font-weight:600;font-size:16px;background:linear-gradient(145deg, var(--cit-accent), color-mix(in srgb, var(--cit-accent) 80%, black));color:var(--cit-on-accent);padding:15px 32px;border-radius:100px;box-shadow:7px 7px 16px color-mix(in srgb, var(--cit-accent) 34%, transparent);transition:transform .15s;cursor:pointer}
  .cl-btn:hover{transform:translateY(-3px);filter:brightness(1.05)}
  .cl-btn-soft{background:var(--cit-surface);color:var(--cit-ink);box-shadow:6px 6px 16px color-mix(in srgb, var(--cit-ink) 14%, transparent), -6px -6px 16px rgba(255,255,255,.9);margin-left:12px}
  .cl-btn-soft:hover{filter:none}
  .cl-btn-disabled{opacity:.5;pointer-events:none}

  /* nav — floating clay pill */
  .cl-nav{position:sticky;top:14px;z-index:100;margin-top:14px}
  .cl-nv{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 12px 22px}
  .cl-lg{font-family:var(--cit-font-display);font-weight:600;font-size:20px;color:var(--cit-ink);display:flex;align-items:center;gap:9px}
  .cl-lg i{width:26px;height:26px;border-radius:50%;background:linear-gradient(145deg, var(--cit-accent), color-mix(in srgb, var(--cit-accent) 60%, var(--cit-ink)));box-shadow:3px 3px 7px color-mix(in srgb, var(--cit-ink) 14%, transparent)}
  .cl-menu{display:none;gap:4px;list-style:none}
  @media(min-width:920px){.cl-menu{display:flex}}
  .cl-menu a{color:var(--cit-muted);font-weight:600;font-size:14px;padding:10px 16px;border-radius:100px}
  .cl-menu a:hover{color:var(--cit-ink);background:var(--cit-bg);box-shadow:inset 3px 3px 7px color-mix(in srgb, var(--cit-ink) 14%, transparent), inset -3px -3px 7px rgba(255,255,255,.9)}

  /* hero */
  .cl-hero{padding:56px 0 40px}
  .cl-hgrid{display:grid;gap:34px;grid-template-columns:1fr;align-items:center}
  @media(min-width:940px){.cl-hgrid{grid-template-columns:1.05fr .95fr}}
  .cl-hero h1{font-size:clamp(36px,5.4vw,60px);margin-bottom:18px}
  .cl-hero h1 em{font-style:normal;background:linear-gradient(120deg, var(--cit-accent), color-mix(in srgb, var(--cit-accent) 55%, var(--cit-ink)));-webkit-background-clip:text;background-clip:text;color:transparent}
  .cl-hero p{color:var(--cit-muted);max-width:470px;margin-bottom:30px}
  .cl-hvis{position:relative}
  .cl-big{border-radius:calc(var(--cit-radius) + 6px);overflow:hidden;aspect-ratio:4/3;box-shadow:12px 12px 30px color-mix(in srgb, var(--cit-ink) 14%, transparent), -10px -10px 26px rgba(255,255,255,.9)}
  .cl-big img{width:100%;height:100%;object-fit:cover}
  .cl-big--flat{background:linear-gradient(155deg, var(--cit-surface), color-mix(in srgb, var(--cit-accent) 30%, var(--cit-surface)))}
  .cl-float{position:absolute;padding:16px 20px;display:flex;align-items:center;gap:12px}
  .cl-float .cl-fic{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--cit-bg);box-shadow:inset 3px 3px 7px color-mix(in srgb, var(--cit-ink) 14%, transparent), inset -3px -3px 7px rgba(255,255,255,.9)}
  .cl-float .cl-fic svg{width:20px;height:20px;color:var(--cit-accent)}
  .cl-float b{display:block;font-family:var(--cit-font-display);font-size:16px}
  .cl-float span{font-size:12.5px;color:var(--cit-muted)}
  .cl-f1{bottom:-18px;left:-10px}
  .cl-f2{top:22px;right:-14px}
  @media(max-width:640px){.cl-f1,.cl-f2{position:static;margin-top:16px}}

  /* booking card */
  .cl-book{margin-top:44px;padding:14px clamp(16px,3vw,26px)}
  .cl-book .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem .4rem}
  .cl-book .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.3rem;color:var(--cit-ink)}

  /* sections */
  .cl-sec{padding:80px 0}
  .cl-sec h2{font-size:clamp(28px,4vw,44px);margin-bottom:12px}
  .cl-sec h2 em{font-style:normal;color:var(--cit-accent)}
  .cl-lead{color:var(--cit-muted);max-width:540px}

  /* rooms */
  .cl-rooms{display:grid;gap:28px;grid-template-columns:1fr;margin-top:46px}
  @media(min-width:880px){.cl-rooms{grid-template-columns:repeat(3,1fr)}}
  .cl-room{overflow:hidden;transition:transform .22s}
  .cl-room:hover{transform:translateY(-6px)}
  .cl-room .cl-im{aspect-ratio:4/3;position:relative;padding:14px;background:color-mix(in srgb, var(--cit-ink) 8%, var(--cit-surface))}
  .cl-room .cl-im figure{width:100%;height:100%;border-radius:calc(var(--cit-radius) - 6px);overflow:hidden}
  .cl-room .cl-im img{width:100%;height:100%;object-fit:cover}
  .cl-room .cl-tag{position:absolute;top:26px;left:26px;background:var(--cit-surface);border-radius:100px;font-family:var(--cit-font-display);font-size:12px;font-weight:600;padding:7px 14px;box-shadow:4px 4px 10px color-mix(in srgb, var(--cit-ink) 14%, transparent)}
  .cl-room .cl-bd{padding:6px 24px 26px}
  .cl-room h3{font-size:21px;margin-bottom:4px}
  .cl-room .cl-mt{font-size:13.5px;color:var(--cit-muted);margin-bottom:14px}
  .cl-room .cl-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
  .cl-room .cl-chips span{font-size:12px;font-weight:600;color:var(--cit-muted);background:var(--cit-bg);border-radius:100px;padding:6px 13px;box-shadow:inset 2px 2px 5px color-mix(in srgb, var(--cit-ink) 14%, transparent), inset -2px -2px 5px rgba(255,255,255,.9)}
  .cl-room .cl-ft{display:flex;justify-content:space-between;align-items:center;gap:12px}
  .cl-room .cl-pr{font-family:var(--cit-font-display);font-size:20px;color:var(--cit-accent)}

  /* wellness bubble grid */
  .cl-bubbles{display:grid;gap:22px;grid-template-columns:repeat(2,1fr);margin-top:46px}
  @media(min-width:880px){.cl-bubbles{grid-template-columns:repeat(4,1fr)}}
  .cl-bu{padding:26px;text-align:center;transition:transform .2s}
  .cl-bu:hover{transform:translateY(-5px)}
  .cl-bu .cl-buic{width:64px;height:64px;margin:0 auto 16px;border-radius:50%;display:grid;place-items:center}
  .cl-bu .cl-buic svg{width:28px;height:28px;color:var(--cit-on-accent)}
  .cl-bu:nth-child(4n+1) .cl-buic{background:linear-gradient(145deg, color-mix(in srgb, var(--cit-accent) 55%, var(--cit-surface)), var(--cit-accent))}
  .cl-bu:nth-child(4n+2) .cl-buic{background:linear-gradient(145deg, color-mix(in srgb, var(--cit-accent) 40%, var(--cit-surface)), color-mix(in srgb, var(--cit-accent) 75%, var(--cit-ink)))}
  .cl-bu:nth-child(4n+3) .cl-buic{background:linear-gradient(145deg, color-mix(in srgb, var(--cit-accent) 65%, var(--cit-surface)), color-mix(in srgb, var(--cit-accent) 85%, black))}
  .cl-bu:nth-child(4n+4) .cl-buic{background:linear-gradient(145deg, color-mix(in srgb, var(--cit-accent) 30%, var(--cit-surface)), color-mix(in srgb, var(--cit-accent) 60%, var(--cit-ink)))}
  .cl-bu strong{display:block;font-family:var(--cit-font-display);font-size:16px;margin-bottom:4px}

  /* gallery */
  .cl-gal{display:grid;gap:22px;grid-template-columns:repeat(2,1fr);margin-top:46px}
  @media(min-width:860px){.cl-gal{grid-template-columns:repeat(4,1fr)}}
  .cl-gal figure{border-radius:var(--cit-radius);overflow:hidden;aspect-ratio:3/4;box-shadow:8px 8px 20px color-mix(in srgb, var(--cit-ink) 14%, transparent), -8px -8px 20px rgba(255,255,255,.9)}
  .cl-gal img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
  .cl-gal figure:hover img{transform:scale(1.06)}

  /* reviews */
  .cl-revs{display:grid;gap:26px;grid-template-columns:1fr;margin-top:46px}
  @media(min-width:880px){.cl-revs{grid-template-columns:repeat(3,1fr)}}
  .cl-rv{padding:28px}
  .cl-rv .cl-st{display:flex;gap:3px;margin-bottom:12px}
  .cl-rv .cl-st svg{width:16px;height:16px;color:var(--cit-accent)}
  .cl-rv p{font-size:15px;margin-bottom:18px}
  .cl-rv footer{font-family:var(--cit-font-display);font-size:14.5px;color:var(--cit-accent)}
  .cl-revscore{display:flex;align-items:center;gap:16px;margin-top:14px}
  .cl-revscore b{font-family:var(--cit-font-display);font-size:44px;color:var(--cit-accent)}
  .cl-revscore span{font-size:13.5px;color:var(--cit-muted)}

  /* faq */
  .cl-faq{max-width:820px;margin-top:40px}
  .cl-faq details{margin-bottom:16px;padding:0 6px}
  .cl-faq summary{list-style:none;cursor:pointer;padding:19px 22px;font-family:var(--cit-font-display);font-size:16px;display:flex;justify-content:space-between;gap:14px}
  .cl-faq summary::after{content:"+";color:var(--cit-accent)}
  .cl-faq details[open] summary::after{content:"−"}
  .cl-faq details p{padding:0 22px 20px;color:var(--cit-muted);font-size:15px}

  /* map + contact */
  .cl-loc{display:grid;gap:26px;grid-template-columns:1fr;margin-top:46px}
  @media(min-width:920px){.cl-loc{grid-template-columns:1.1fr .9fr}}
  .cl-map{position:relative;border-radius:var(--cit-radius);overflow:hidden;min-height:340px;box-shadow:8px 8px 20px color-mix(in srgb, var(--cit-ink) 14%, transparent), -8px -8px 20px rgba(255,255,255,.9);background:linear-gradient(145deg, var(--cit-surface), color-mix(in srgb, var(--cit-accent) 22%, var(--cit-surface)))}
  .cl-map .cl-ov{position:absolute;inset:0;background:color-mix(in srgb, var(--cit-ink) 42%, transparent);color:var(--cit-on-accent);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px;gap:8px}
  .cl-map .cl-ov svg{width:26px;height:26px}
  .cl-map b{font-family:var(--cit-font-display);font-size:19px}
  .cl-map span{font-size:13.5px}
  .cl-cline{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--cit-line);font-size:15px}
  .cl-cline:first-child{border-top:none}
  .cl-cline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .cl-cline b{font-family:var(--cit-font-display);font-size:16px}
  .cl-cline small{display:block;color:var(--cit-muted);font-size:13px}
  .cl-cbox{padding:30px}
  .cl-cbox h3{font-size:21px;margin-bottom:20px}

  /* footer */
  .cl-foot{padding:70px 0 30px}
  .cl-fbox{padding:40px 34px}
  .cl-fg{display:grid;gap:30px;grid-template-columns:1fr;margin-bottom:34px}
  @media(min-width:800px){.cl-fg{grid-template-columns:2fr 1fr 1fr}}
  .cl-foot h4{font-family:var(--cit-font-display);font-size:15px;margin-bottom:14px}
  .cl-foot p{max-width:280px;font-size:14.5px;color:var(--cit-muted);margin-top:14px}
  .cl-foot ul{list-style:none}
  .cl-foot li{margin-bottom:9px;font-size:14.5px;color:var(--cit-muted)}
  .cl-foot a:hover{color:var(--cit-accent)}
  .cl-fb2{border-top:1px solid var(--cit-line);padding-top:22px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:12.5px;color:var(--cit-muted)}

  .cl-sample{text-align:center;font-size:12.5px;color:var(--cit-muted);letter-spacing:.3px;margin-top:28px}
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderClaymorphism(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["clay-soft"]!;
  const heroCopy = copyOf(recipe, "hero");
  const roomCopy = copyOf(recipe, "rooms");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");
  const wellCopy = copyOf(recipe, "features");

  const photos = data.photos;
  const heroPhoto = photos[0]?.url ?? "";
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
    roomsData ? `<li><a href="#cl-rooms">${T(data, "Szobák")}</a></li>` : "",
    data.highlights.length ? `<li><a href="#cl-wellness">${T(data, "Wellness")}</a></li>` : "",
    photos.length ? `<li><a href="#cl-gallery">${T(data, "Galéria")}</a></li>` : "",
    reviewsData ? `<li><a href="#cl-reviews">${T(data, "Vélemények")}</a></li>` : "",
    faqsData ? `<li><a href="#cl-faq">${T(data, "GYIK")}</a></li>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="cl-nav"><div class="cl-wrap"><div class="cl-clay cl-nv">
    <a class="cl-lg" href="#top"><i></i>${esc(data.name)}</a>
    <ul class="cl-menu">
        ${navLinks}
    </ul>
    ${hasContact ? `<a class="cl-btn" href="#cit-enquiry">${T(data, "Foglalás")}</a>` : ""}
  </div></div></nav>`;

  // -- hero — floating clay stat cards from REAL stats/rating only ----------
  const floatCards: string[] = [];
  const nonRatingStats = (data.stats ?? []).filter((s) => s.icon !== "star");
  const s0 = nonRatingStats[0];
  if (s0) {
    floatCards.push(
      `<div class="cl-clay cl-float cl-f1"><span class="cl-fic">${iconSvg(s0.icon && s0.icon !== "star" ? s0.icon : "spa")}</span><span><b>${esc(s0.value)}</b><span>${esc(s0.label)}</span></span></div>`,
    );
  }
  if (ratingStat) {
    floatCards.push(
      `<div class="cl-clay cl-float cl-f2"><span class="cl-fic">${starIcon()}</span><span><b>${esc(ratingStat.value)}</b><span>${esc(ratingStat.label)}</span></span></div>`,
    );
  }
  const heroVisual = heroPhoto
    ? `<div class="cl-big"><img src="${esc(heroPhoto)}" alt="${esc(data.name)}"></div>`
    : `<div class="cl-big cl-big--flat"></div>`;
  const hero = `<header class="cl-hero" id="top"><div class="cl-wrap">
    <div class="cl-hgrid">
      <div>
        ${heroCopy.eyebrow ? `<span class="cl-eyebrow">${esc(heroCopy.eyebrow)}</span>` : ""}
        <h1>${accented(h1, heroCopy.accent)}</h1>
        ${sub ? `<p>${esc(sub)}</p>` : ""}
        <div>
          ${hasContact ? `<a class="cl-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
          ${data.highlights.length ? `<a class="cl-btn cl-btn-soft" href="#cl-wellness">${T(data, "Szolgáltatások")}</a>` : ""}
        </div>
      </div>
      <div class="cl-hvis">
        ${heroVisual}
        ${floatCards.join("\n        ")}
      </div>
    </div>
    <div class="cl-clay cl-book">
      ${bookingSlot(data, phase)}
    </div>
  </div></header>`;

  // -- rooms ----------------------------------------------------------------
  const rooms = roomsData
    ? `<section class="cl-sec" id="cl-rooms"><div class="cl-wrap">
      ${roomCopy.eyebrow ? `<span class="cl-eyebrow">${esc(roomCopy.eyebrow)}</span>` : `<span class="cl-eyebrow">${T(data, "Szobák")}</span>`}
      <h2>${roomCopy.title ? accented(roomCopy.title, roomCopy.accent) : T(data, "Puha landolás minden este")}</h2>
      ${roomCopy.lead ? `<p class="cl-lead">${esc(roomCopy.lead)}</p>` : ""}
      <div class="cl-rooms" data-cit-module="rooms">
        ${roomsData
          .map((r) => {
            const chips = [r.capacity, r.note]
              .filter(Boolean)
              .map((c) => `<span>${esc(c as string)}</span>`)
              .join("");
            return `<article class="cl-clay cl-room">
          <div class="cl-im"><figure>${r.photo?.url ? `<img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt || r.name)}">` : photoFill(r.name)}</figure></div>
          <div class="cl-bd">
            <h3>${esc(r.name)}</h3>
            ${chips ? `<div class="cl-chips">${chips}</div>` : ""}
            <div class="cl-ft">
              ${r.price ? `<span class="cl-pr">${esc(r.price)}</span>` : "<span></span>"}
              ${hasContact ? `<a class="cl-btn cl-btn-soft" href="#cit-enquiry">${ctaLabel(data, phase)}</a>` : ""}
            </div>
          </div>
        </article>`;
          })
          .join("\n        ")}
      </div>
      ${roomsSample ? `<p class="cl-sample">${T(data, "Minta — ide az Ön szobái és árai kerülnek.")}</p>` : ""}
    </div></section>`
    : "";

  // -- wellness bubble grid (real highlights only) -------------------------
  const wellness = data.highlights.length
    ? `<section class="cl-sec" id="cl-wellness" style="padding-top:0"><div class="cl-wrap">
      ${wellCopy.eyebrow ? `<span class="cl-eyebrow">${esc(wellCopy.eyebrow)}</span>` : `<span class="cl-eyebrow">${T(data, "Szolgáltatások")}</span>`}
      <h2>${wellCopy.title ? accented(wellCopy.title, wellCopy.accent) : T(data, "Amiért érdemes betérni")}</h2>
      <div class="cl-bubbles">
        ${data.highlights
          .slice(0, 8)
          .map(
            (h) =>
              `<div class="cl-clay cl-bu"><div class="cl-buic">${amenityIconSvg(h, data.amenityIconMap)}</div><strong>${esc(h)}</strong></div>`,
          )
          .join("\n        ")}
      </div>
    </div></section>`
    : "";

  // -- gallery --------------------------------------------------------------
  const gallery = photos.length
    ? `<section class="cl-sec" id="cl-gallery" style="padding-top:0"><div class="cl-wrap">
      ${galCopy.eyebrow ? `<span class="cl-eyebrow">${esc(galCopy.eyebrow)}</span>` : `<span class="cl-eyebrow">${T(data, "Galéria")}</span>`}
      <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Nézzen körül nálunk")}</h2>
      <div class="cl-gal" data-cit-module="gallery">
        ${photos
          .slice(0, 4)
          .map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`)
          .join("\n        ")}
      </div>
    </div></section>`
    : "";

  // -- reviews --------------------------------------------------------------
  const stars5 = starCount ? `<span class="cl-st">${starIcon().repeat(starCount)}</span>` : "";
  const reviews = reviewsData
    ? `<section class="cl-sec" id="cl-reviews" style="padding-top:0" data-cit-module="reviews"><div class="cl-wrap">
      ${revCopy.eyebrow ? `<span class="cl-eyebrow">${esc(revCopy.eyebrow)}</span>` : `<span class="cl-eyebrow">${T(data, "Vélemények")}</span>`}
      ${
        ratingStat
          ? `<h2>${T(data, "Vendégeink")}</h2><div class="cl-revscore"><b>${esc(ratingStat.value)}</b><div>${stars5}<span>${esc(ratingStat.label)}</span></div></div>`
          : `<h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vendégeink")}</h2>`
      }
      <div class="cl-revs">
        ${reviewsData
          .map(
            (r) =>
              `<div class="cl-clay cl-rv">${stars5}<p>${esc(r.quote)}</p><footer>— ${esc(r.author)}${r.meta ? `, ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${reviewsSample ? `<p class="cl-sample">${T(data, "Minta — ide az Ön vendégeinek értékelései kerülnek.")}</p>` : ""}
    </div></section>`
    : "";

  // -- faq ------------------------------------------------------------------
  const faq = faqsData
    ? `<section class="cl-sec" id="cl-faq" style="padding-top:0"><div class="cl-wrap">
      <span class="cl-eyebrow">${T(data, "Tudnivalók")}</span>
      <h2>${T(data, "Gyakori kérdések")}</h2>
      <div class="cl-faq">
        ${faqsData
          .map(
            (f, i) =>
              `<details class="cl-clay"${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
          )
          .join("\n        ")}
      </div>
      ${faqsSample ? `<p class="cl-sample">${T(data, "Minta — ide az Ön saját válaszai kerülnek.")}</p>` : ""}
    </div></section>`
    : "";

  // -- map + contact --------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="cl-cline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="cl-cline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="cl-cline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const mapOverlay = c.address
    ? `<div class="cl-ov">${CONTACT_ICONS.location}<b>${esc(c.address)}</b>${data.tagline ? `<span>${esc(data.tagline)}</span>` : ""}</div>`
    : `<div class="cl-ov"><b>${esc(data.name)}</b></div>`;
  const contact =
    contactLines || c.address
      ? `<section class="cl-sec" id="cl-contact" style="padding-top:0"><div class="cl-wrap">
      <span class="cl-eyebrow">${T(data, "Kapcsolat")}</span>
      <h2>${T(data, "Megközelítés és kapcsolat")}</h2>
      <div class="cl-loc">
        <div class="cl-map">${mapOverlay}</div>
        <div class="cl-clay cl-cbox">
          <h3>${T(data, "Írjon nekünk")}</h3>
          ${contactLines}
          ${hasContact ? `<a class="cl-btn" style="margin-top:22px" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
        </div>
      </div>
    </div></section>`
      : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="cl-foot"><div class="cl-wrap"><div class="cl-clay cl-fbox">
    <div class="cl-fg">
      <div>
        <a class="cl-lg" href="#top"><i></i>${esc(data.name)}</a>
        ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
      </div>
      <div>
        <h4>${T(data, "Oldal")}</h4>
        <ul>
          ${roomsData ? `<li><a href="#cl-rooms">${T(data, "Szobák")}</a></li>` : ""}
          ${data.highlights.length ? `<li><a href="#cl-wellness">${T(data, "Wellness")}</a></li>` : ""}
          ${photos.length ? `<li><a href="#cl-gallery">${T(data, "Galéria")}</a></li>` : ""}
        </ul>
      </div>
      <div>
        <h4>${T(data, "Kapcsolat")}</h4>
        <ul>
          ${c.phone ? `<li>${esc(c.phone)}</li>` : ""}
          ${c.email ? `<li>${esc(c.email)}</li>` : ""}
          <li><a href="#top">${T(data, "Kezdőlap")}</a></li>
        </ul>
      </div>
    </div>
    <div class="cl-fb2">
      <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
      <span><a href="#">${T(data, "Adatkezelés")}</a></span>
    </div>
  </div></div></footer>`;

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
${CLAY_CSS}
  </style>
</head>
<body class="cit-tpl-claymorphism">
    ${nav}
    ${hero}
    ${rooms}
    ${wellness}
    ${slotMarker("showcase")}
    ${gallery}
    ${reviews}
    ${slotMarker("trust")}
    ${faq}
    ${slotMarker("practical")}
    ${contact}
    ${slotMarker("closing")}
    ${footer}
</body>
</html>`;
}

export const CLAYMORPHISM: ArtTemplate = {
  id: "claymorphism",
  label: "Agyag — neumorf clay felület, puha wellness (referencia 18)", // i18n-exempt: operator-facing (console template picker)
  skins: ["clay-soft", "coastal-fresh", "watercolor-lake"],
  render: renderClaymorphism,
};
