// "editorial" art template (ADR-0027) — the 05-editorial reference direction (Kékfestő Porta).
// Newspaper craft: a masthead between thin rules (giant serif nameplate, factual dateline row),
// a sticky pill nav, a BIG lead photograph right under the masthead (the old engine's failure
// was a photo-less masthead — never again), a dropcap lead article with a pull-quote, a
// dashed-frame coupon booking box, classified-ads amenity columns, a contact-sheet polaroid
// gallery, "letters to the editor" reviews and a colophon footer. All styling dresses from the
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
  esc,
  firstSentence,
  honestStarCount,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const EDITORIAL_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);background:var(--cit-bg);color:var(--cit-ink);font-size:16px;line-height:1.65}

  /* shared module sections (.cit-modsec) themed to the newsprint rhythm (ADR-0057):
     left-aligned bold serif heads, 1100px column, sharp-cornered bordered cards */
  body.cit-tpl-editorial{
    --cit-modsec-py:56px;
    --cit-modsec-maxw:1100px;
    --cit-modsec-px:4%;
    --cit-modsec-divider:0;
    --cit-modsec-head-align:left;
    --cit-modsec-head-mb:34px;
    --cit-modsec-head-size:clamp(24px,3vw,34px);
    --cit-modsec-head-weight:600;
    --cit-modsec-card-radius:0;
    --cit-modsec-card-pad:18px}

  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  h1,h2,h3{font-family:var(--cit-font-display);font-weight:600;line-height:1.15}
  .e-wrap{width:min(1100px,92%);margin:0 auto}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);border:1px solid var(--cit-accent);padding:13px 28px;font-family:inherit;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:.25s}
  .cit-btn:hover{filter:brightness(1.12);box-shadow:0 8px 22px color-mix(in srgb, var(--cit-accent) 30%, transparent)}
  .cit-btn-disabled{opacity:.55;pointer-events:none}

  /* masthead — nameplate between rules, factual dateline row (no invented dates) */
  .e-mast{border-bottom:2px solid var(--cit-ink)}
  .e-mast-top{display:flex;justify-content:space-between;align-items:center;gap:8px 22px;flex-wrap:wrap;padding:12px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--cit-muted);border-bottom:1px solid var(--cit-line)}
  .e-mast-top svg{width:13px;height:13px;color:var(--cit-accent);vertical-align:-2px;display:inline-block}
  .e-mast-mid{text-align:center;padding:26px 0 20px}
  .e-mast-mid h1{font-size:clamp(34px,6.5vw,64px);letter-spacing:1px}
  .e-mast-mid p{font-family:var(--cit-font-display);font-style:italic;font-weight:400;color:var(--cit-muted);margin-top:8px}

  /* sticky nav — a body-level sibling so position:sticky actually holds */
  .e-nav{position:sticky;top:0;z-index:40;background:var(--cit-bg);border-bottom:2px solid var(--cit-ink);transition:box-shadow .3s}
  .e-nav.e-stuck{box-shadow:0 8px 24px color-mix(in srgb, var(--cit-ink) 14%, transparent)}
  .e-nav .e-wrap{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:10px 0}
  .e-nav a{font-size:13px;letter-spacing:1.5px;text-transform:uppercase;padding:6px 14px;border-radius:100px;transition:.25s}
  .e-nav a:hover{background:var(--cit-ink);color:var(--cit-bg)}
  .e-nav a.e-hot{background:var(--cit-accent);color:var(--cit-on-accent)}

  /* lead photograph — full column width, immediately under the masthead */
  .e-leadfig{position:relative;margin-top:36px;border:1px solid var(--cit-ink);padding:10px;background:var(--cit-surface)}
  .e-leadfig .e-in{position:relative;overflow:hidden}
  .e-leadfig img{width:100%;aspect-ratio:16/8;object-fit:cover}
  .e-leadfig figcaption{position:absolute;left:0;bottom:0;background:color-mix(in srgb, var(--cit-ink) 92%, black);color:var(--cit-bg);font-size:12px;letter-spacing:1px;padding:8px 14px}

  /* lead article — pull-quote headline + dropcap body + fact box */
  .e-story{display:grid;gap:44px;grid-template-columns:1fr;padding:46px 0 56px}
  @media(min-width:920px){.e-story{grid-template-columns:1.15fr .85fr}}
  .e-kicker{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--cit-accent);font-weight:700;margin-bottom:14px}
  .e-quote{font-size:clamp(28px,3.8vw,44px);margin-bottom:20px}
  .e-quote em{font-style:italic;color:var(--cit-accent)}
  .e-story p{margin-bottom:14px}
  .e-dropcap::first-letter{font-family:var(--cit-font-display);font-size:56px;float:left;line-height:.85;padding-right:10px;color:var(--cit-accent)}
  .e-story .cit-btn{margin-top:8px}
  .e-aside figure{border:1px solid var(--cit-ink);padding:8px;background:var(--cit-surface)}
  .e-aside img{width:100%;aspect-ratio:4/5;object-fit:cover}
  .e-aside figcaption{font-family:var(--cit-font-display);font-style:italic;font-size:13px;color:var(--cit-muted);padding-top:8px;text-align:center}
  .e-facts{border-top:2px solid var(--cit-ink);margin-top:26px}
  .e-facts h3{font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:12px 0 2px;color:var(--cit-muted)}
  .e-fact{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:11px 0;border-bottom:1px solid var(--cit-line);font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--cit-muted)}
  .e-fact b{font-family:var(--cit-font-display);font-size:22px;color:var(--cit-ink);display:flex;align-items:baseline;gap:6px;letter-spacing:0;text-transform:none}
  .e-fact b svg{width:14px;height:14px;color:var(--cit-accent)}

  /* booking — coupon clipping, the canonical hydrated slot inside the dashed frame */
  .e-coupon{border:2px dashed var(--cit-ink);background:var(--cit-surface);padding:26px;margin-bottom:70px}
  .e-coupon h3{font-size:22px}
  .e-coupon .e-sub{font-size:13px;color:var(--cit-muted);margin:4px 0 16px;letter-spacing:1px;text-transform:uppercase}
  .e-coupon .cit-book{background:none;border:0;box-shadow:none}
  .e-coupon .cit-enquiry-bar-inner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem}
  .e-coupon .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.2rem}

  /* section heads — numbered, with a rule running to the margin */
  .e-sech{display:flex;align-items:center;gap:18px;margin:0 0 34px}
  .e-sech h2{font-size:clamp(24px,3vw,34px)}
  .e-sech h2 em{font-style:italic;color:var(--cit-accent)}
  .e-sech::after{content:"";flex:1;border-top:1px solid var(--cit-ink);min-width:40px}
  .e-sech .e-no{font-family:var(--cit-font-display);font-style:italic;color:var(--cit-accent);font-size:20px;flex:none}

  /* amenities — classified-ads columns with rules between */
  .e-ads{column-count:1;column-gap:34px;column-rule:1px solid var(--cit-line);margin-bottom:70px}
  @media(min-width:680px){.e-ads{column-count:2}}
  .e-ad{break-inside:avoid;border:1px solid var(--cit-ink);background:var(--cit-surface);padding:18px;margin-bottom:20px;transition:.25s}
  .e-ad:hover{box-shadow:var(--cit-shadow);transform:translateY(-2px)}
  .e-ad h3{font-size:17px;font-weight:600;display:flex;align-items:flex-start;gap:10px}
  .e-ad h3 svg{width:20px;height:20px;color:var(--cit-accent);flex:none;margin-top:3px}

  /* gallery — contact sheet of slightly rotated polaroids */
  .e-sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:70px}
  @media(min-width:760px){.e-sheet{grid-template-columns:repeat(3,1fr)}}
  .e-shot{position:relative;background:var(--cit-surface);padding:10px 10px 30px;border:1px solid var(--cit-line);box-shadow:0 3px 12px color-mix(in srgb, var(--cit-ink) 10%, transparent);transform:rotate(var(--r,0deg));transition:transform .3s}
  .e-shot:hover{transform:rotate(0) scale(1.03);z-index:2}
  .e-shot figure{aspect-ratio:1;overflow:hidden}
  .e-shot img{width:100%;height:100%;object-fit:cover}
  .e-shot figcaption{font-family:var(--cit-font-display);font-style:italic;font-size:13px;text-align:center;padding-top:10px;color:var(--cit-muted)}

  /* reviews — letters to the editor */
  .e-letters{display:grid;gap:26px;grid-template-columns:1fr;margin-bottom:8px}
  @media(min-width:820px){.e-letters{grid-template-columns:repeat(3,1fr)}}
  .e-letter{background:var(--cit-surface);border-top:4px solid var(--cit-accent);box-shadow:var(--cit-shadow);padding:24px;font-size:14.5px}
  .e-letter .e-st{display:flex;gap:3px;color:var(--cit-accent);margin-bottom:12px}
  .e-letter .e-st svg{width:15px;height:15px}
  .e-letter p{font-family:var(--cit-font-display);font-style:italic;margin-bottom:16px}
  .e-letter footer{font-size:12.5px;letter-spacing:1px;text-transform:uppercase;color:var(--cit-muted)}
  .e-sample{text-align:center;font-size:12.5px;color:var(--cit-muted);letter-spacing:.5px;margin-bottom:62px;padding-top:18px}
  .e-letters-end{margin-bottom:70px}

  /* contact — letter to the editor's desk + framed photo */
  .e-dest{display:grid;gap:34px;grid-template-columns:1fr;margin-bottom:70px}
  @media(min-width:900px){.e-dest{grid-template-columns:1fr 1fr;align-items:start}}
  .e-dest .e-intro{margin-bottom:20px;max-width:48ch;color:color-mix(in srgb, var(--cit-ink) 80%, var(--cit-muted))}
  .e-conline{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--cit-line);font-size:15.5px}
  .e-conline svg{width:20px;height:20px;color:var(--cit-accent);flex:none}
  .e-conline b{font-family:var(--cit-font-display);font-weight:600;font-size:17px}
  .e-conline small{display:block;color:var(--cit-muted);font-size:12.5px;letter-spacing:1px;text-transform:uppercase}
  .e-dest .cit-btn{margin-top:24px}
  .e-mapframe{border:1px solid var(--cit-ink);padding:10px;background:var(--cit-surface)}
  .e-mapframe .e-in{position:relative;aspect-ratio:4/3;overflow:hidden}
  .e-mapframe img{width:100%;height:100%;object-fit:cover}
  .e-mapov{position:absolute;left:0;right:0;bottom:0;background:color-mix(in srgb, var(--cit-ink) 85%, black);color:var(--cit-bg);padding:10px 14px;font-size:13px;display:flex;align-items:center;gap:8px}
  .e-mapov svg{width:15px;height:15px;color:var(--cit-accent);flex:none}

  /* colophon — double-rule footer */
  .e-colo{border-top:2px solid var(--cit-ink);padding:38px 0 30px;font-size:13.5px;color:var(--cit-muted)}
  .e-colo-grid{display:grid;gap:30px;grid-template-columns:1fr;padding-bottom:28px;border-bottom:1px solid var(--cit-line)}
  @media(min-width:760px){.e-colo-grid{grid-template-columns:2fr 1fr 1fr}}
  .e-colo .e-brand{font-family:var(--cit-font-display);font-size:22px;color:var(--cit-ink)}
  .e-colo p{margin-top:10px;max-width:38ch}
  .e-colo h4{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--cit-ink);margin-bottom:12px}
  .e-colo a{display:block;padding:4px 0;transition:.25s}
  .e-colo a:hover{color:var(--cit-accent)}
  .e-colo-legal{display:flex;flex-wrap:wrap;gap:10px 20px;justify-content:space-between;padding-top:22px}
`;

// Tiny behavior layer: the sticky nav gains a shadow when it pins. Progressive enhancement
// only — the page is complete without it (the nav still sticks via pure CSS).
const EDITORIAL_JS = `
  (function(){var n=document.querySelector('.e-nav');if(!n)return;
  addEventListener('scroll',function(){n.classList.toggle('e-stuck',n.getBoundingClientRect().top<=0&&scrollY>10)},{passive:true});})();
`;

// Deterministic polaroid tilt sequence (no randomness — mock=live safe).
const SHOT_TILTS = ["-1.6deg", "1.2deg", "-0.8deg", "1.8deg", "-1.2deg", "0.9deg"] as const;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

/** Numbered editorial section head ("No. 1 · Heading ————"). */
function sectionHead(no: number, title: string, accent?: string): string {
  return `<div class="e-sech"><span class="e-no">No. ${no}</span><h2>${accented(title, accent)}</h2></div>`;
}

function renderEditorial(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["editorial-magazine"]!;
  const heroCopy = copyOf(recipe, "hero");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const revCopy = copyOf(recipe, "reviews");

  const photos = data.photos;
  const leadPhoto = photos[0];
  const asidePhoto = photos[1];
  const contactPhoto = photos[4] ?? photos[photos.length - 1];

  const hasContact = Boolean(data.contact.email || data.contact.phone);
  const ratingStat = data.stats?.find((s) => s.icon === "star");
  const stars = honestStarCount(data);

  // §B.17: reviews — real data first; mock with none → clearly marked sample; live → dropped.
  const realReviews = data.reviews && data.reviews.length ? data.reviews : null;
  const reviewsData = realReviews;

  // -- masthead -------------------------------------------------------------
  // Dateline row: REAL facts only (region eyebrow, real rating, real phone) — never a
  // fabricated date, issue number or founding year (§B.17).
  const mastTopItems = [
    heroCopy.eyebrow ? `<span>${esc(heroCopy.eyebrow)}</span>` : "",
    ratingStat
      ? `<span>${starIcon()} ${esc(ratingStat.value)} · ${esc(ratingStat.label)}</span>`
      : "",
    data.contact.phone ? `<span>${esc(data.contact.phone)}</span>` : "",
  ]
    .filter(Boolean)
    .join("\n      ");
  const masthead = `<header class="e-mast" id="top">
    <div class="e-wrap">
      ${mastTopItems ? `<div class="e-mast-top">${mastTopItems}</div>` : ""}
      <div class="e-mast-mid">
        <h1>${esc(data.name)}</h1>
        ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
      </div>
    </div>
  </header>`;

  const navLinks = [
    `<a href="#e-story">${T(data, "A ház")}</a>`,
    data.highlights.length ? `<a href="#e-ads">${T(data, "Ami jár")}</a>` : "",
    photos.length ? `<a href="#e-gallery">${T(data, "Képes krónika")}</a>` : "",
    reviewsData ? `<a href="#e-letters">${T(data, "Vendégkönyv")}</a>` : "",
    hasContact ? `<a href="#e-contact">${T(data, "Kapcsolat")}</a>` : "",
    `<a href="#cit-enquiry" class="e-hot">${T(data, "Foglalás")}</a>`,
  ]
    .filter(Boolean)
    .join("\n      ");
  const nav = `<nav class="e-nav">
    <div class="e-wrap">
      ${navLinks}
    </div>
  </nav>`;

  // -- lead photograph (the anti-lesson: never a photo-less masthead) -------
  const leadFig = leadPhoto
    ? `<figure class="e-leadfig">
    <div class="e-in">
      <img src="${esc(leadPhoto.url)}" alt="${esc(leadPhoto.alt)}">
      <figcaption>${esc(leadPhoto.alt)}</figcaption>
    </div>
  </figure>`
    : "";

  // -- lead article: pull-quote headline (hero lead) + dropcap intro --------
  const quoteLine = heroCopy.lead || data.tagline;
  const factRows = data.stats?.length
    ? `<div class="e-facts">
        <h3>${T(data, "A ház számokban")}</h3>
        ${data.stats
          .map(
            (s) =>
              `<div class="e-fact"><b>${esc(s.value)} ${s.icon === "star" ? starIcon() : ""}</b><span>${esc(s.label)}</span></div>`,
          )
          .join("\n        ")}
      </div>`
    : "";
  const aside =
    asidePhoto || factRows
      ? `<aside class="e-aside">
      ${asidePhoto ? `<figure><img src="${esc(asidePhoto.url)}" alt="${esc(asidePhoto.alt)}"><figcaption>${esc(asidePhoto.alt)}</figcaption></figure>` : ""}
      ${factRows}
    </aside>`
      : "";
  const story =
    quoteLine || data.intro
      ? `<div class="e-story" id="e-story">
    <div>
      <p class="e-kicker">${featCopy.eyebrow ? esc(featCopy.eyebrow) : T(data, "Vezércikk")}</p>
      ${quoteLine ? `<h2 class="e-quote">„${accented(quoteLine, heroCopy.accent)}${"”"}</h2>` : ""}
      ${data.intro ? `<p class="e-dropcap">${esc(data.intro)}</p>` : ""}
      ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad szobát kérek")}</a>` : ""}
    </div>
    ${aside}
  </div>`
      : "";

  // -- coupon booking (canonical hydrated slot inside the dashed frame) -----
  const coupon = `<div class="e-coupon">
    <h3>${T(data, "Foglalási szelvény")}</h3>
    <p class="e-sub">${
      data.booking
        ? T(data, "Foglalás — a szállás hamarosan visszajelez")
        : T(data, "Érdeklődés — a szállás hamarosan visszajelez")
    }</p>
    ${bookingSlot(data, phase)}
  </div>`;

  // -- numbered sections (sequential over what actually renders) ------------
  let sectionNo = 0;

  // -- amenities: classified-ads columns (real highlights only) -------------
  const ads = data.highlights.length
    ? `<section id="e-ads">
    ${sectionHead(++sectionNo, featCopy.title || T(data, "Mi jár a szobához"), featCopy.accent)}
    <div class="e-ads">
      ${data.highlights
        .map((h) => `<div class="e-ad"><h3>${iconSvg(matchIcon(h))}<span>${esc(h)}</span></h3></div>`)
        .join("\n      ")}
    </div>
  </section>`
    : "";

  // -- gallery: contact sheet of polaroids, caption from the real alt -------
  const sheet = photos.length
    ? `<section id="e-gallery">
    ${sectionHead(++sectionNo, galCopy.title || T(data, "Képes krónika"), galCopy.accent)}
    <div class="e-sheet" data-cit-module="gallery">
      ${photos
        .slice(0, 6)
        .map(
          (p, i) =>
            `<div class="e-shot" style="--r:${SHOT_TILTS[i % SHOT_TILTS.length]}"><figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure><figcaption>${esc(p.alt)}</figcaption></div>`,
        )
        .join("\n      ")}
    </div>
  </section>`
    : "";

  // -- reviews: letters to the editor (star row mirrors the REAL rating) ----
  const starRowHtml = stars ? `<div class="e-st">${starIcon().repeat(stars)}</div>` : "";
  const letters = reviewsData
    ? `<section id="e-letters" data-cit-module="reviews">
    ${sectionHead(++sectionNo, revCopy.title || T(data, "Levelek a vendégkönyvből"), revCopy.accent)}
    <div class="e-letters${realReviews ? " e-letters-end" : ""}">
      ${reviewsData
        .map(
          (r) =>
            `<div class="e-letter">${starRowHtml}<p>„${esc(r.quote)}${"”"}</p><footer>— ${esc(r.author)}${r.meta ? `, ${esc(r.meta)}` : ""}</footer></div>`,
        )
        .join("\n      ")}
    </div>
    ${realReviews ? "" : `<p class="e-sample">${T(data, "Minta — ide az Ön vendégeinek értékelései kerülnek.")}</p>`}
  </section>`
    : "";

  // -- contact: the editor's desk + framed environs photo -------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="e-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Telefon")}</small></div></div>`
      : "",
    c.email
      ? `<div class="e-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "E-mail")}</small></div></div>`
      : "",
    c.address
      ? `<div class="e-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Cím")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n      ");
  const contact = contactLines
    ? `<section class="e-dest" id="e-contact">
    <div>
      ${sectionHead(++sectionNo, T(data, "Írjon nekünk"))}
      <p class="e-intro">${T(data, "Kérdés, egyedi kérés, csoportos érkezés? A foglalási szelvényen vagy az alábbi elérhetőségeken várjuk a leveled.")}</p>
      ${contactLines}
      ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Foglalási szelvényhez")}</a>` : ""}
    </div>
    ${
      contactPhoto
        ? `<div class="e-mapframe">
      <div class="e-in">
        <img src="${esc(contactPhoto.url)}" alt="${esc(contactPhoto.alt)}">
        ${c.address ? `<div class="e-mapov">${CONTACT_ICONS.location}<span>${esc(c.address)}</span></div>` : ""}
      </div>
    </div>`
        : ""
    }
  </section>`
    : "";

  // -- colophon -------------------------------------------------------------
  const footTag = data.tagline || firstSentence(data.intro);
  const colophon = `<footer class="e-colo">
    <div class="e-wrap">
      <div class="e-colo-grid">
        <div>
          <span class="e-brand">${esc(data.name)}</span>
          ${footTag ? `<p>${esc(footTag)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Rovatok")}</h4>
          <a href="#e-story">${T(data, "A ház")}</a>
          ${data.highlights.length ? `<a href="#e-ads">${T(data, "Ami jár")}</a>` : ""}
          ${photos.length ? `<a href="#e-gallery">${T(data, "Képes krónika")}</a>` : ""}
          ${reviewsData ? `<a href="#e-letters">${T(data, "Vendégkönyv")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Szerkesztőség")}</h4>
          ${c.phone ? `<a href="tel:${esc(c.phone.replace(/\s+/g, ""))}">${esc(c.phone)}</a>` : ""}
          ${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}
          <a href="#cit-enquiry">${T(data, "Foglalás")}</a>
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="e-colo-legal">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        <span>${T(data, "Nyomtatva a világhálón")}</span>
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
${EDITORIAL_CSS}
  </style>
</head>
<body class="cit-tpl-editorial">
    ${masthead}
    ${nav}
    <main class="e-wrap">
      ${leadFig}
      ${story}
      ${coupon}
      ${ads}
      ${slotMarker("showcase")}
      ${sheet}
      ${letters}
      ${slotMarker("trust")}
      ${slotMarker("practical")}
      ${contact}
      ${slotMarker("closing")}
    </main>
    ${colophon}
    <script>${EDITORIAL_JS}</script>
</body>
</html>`;
}

export const EDITORIAL: ArtTemplate = {
  id: "editorial",
  label: "Szerkesztői — masthead, kupon-foglaló, kontakt-lap galéria (referencia 05)", // i18n-exempt: operator-facing (console template picker)
  // Paper-toned LIGHT skins only — the newsprint character needs a light page.
  skins: ["editorial-magazine", "stone-masonry", "editorial-warm"],
  render: renderEditorial,
};
