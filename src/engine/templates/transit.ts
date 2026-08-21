// "transit" art template (ADR-0027) — the mock_20 "departure board" reference direction.
// A dark, kiosk-flavoured stay: signage nav, a split hero (copy left / photo right), then the
// units presented as a DEPARTURE-BOARD TABLE (the signature move) with condensed uppercase
// column heads and a tabular-nums price feel, a check-in kiosk booking panel, a pictogram
// service grid, a gallery, a review band, an optional FAQ, a contact split and a rich footer.
// All styling dresses from the 11 --cit-* tokens (+ color-mix / neutral scrims) — the
// signage-amber skin is the intended pairing. See templateKit.ts for the shared contract.
//
// §B.17 NOTE: the reference mock fabricated LIVE availability ("SZABAD · 7 db", "UTOLSÓ 2",
// "90 MÁSODPERC check-in", "FRISSÍTVE 2 perce"). Those are invented facts and are intentionally
// NOT rendered here — the board shows only the REAL rooms (name, capacity, price-if-any).

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
  T,
  type ArtTemplate,
} from "../templateKit.js";

const TRANSIT_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:var(--cit-font-body);color:var(--cit-ink);background:var(--cit-bg);line-height:1.65}
  img{display:block;max-width:100%}
  a{color:inherit;text-decoration:none}
  .tb-wrap{max-width:1220px;margin:0 auto;padding:0 28px}
  .tb-eyebrow{font-family:var(--cit-font-display);font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:var(--cit-accent);font-weight:600}
  .tb-num{font-variant-numeric:tabular-nums;letter-spacing:.06em}
  .cit-btn{display:inline-block;background:var(--cit-accent);color:var(--cit-on-accent);padding:14px 32px;letter-spacing:.08em;text-transform:uppercase;font-family:var(--cit-font-display);font-size:16px;font-weight:700;transition:.22s;cursor:pointer}
  .cit-btn:hover{filter:brightness(1.08)}
  .cit-btn-ghost{background:transparent;color:var(--cit-ink);border:1px solid var(--cit-line)}
  .cit-btn-ghost:hover{border-color:var(--cit-accent);color:var(--cit-accent);filter:none}
  .cit-btn-disabled{opacity:.5;pointer-events:none}

  /* nav — signage bar, sticky */
  .tb-nav{position:sticky;top:0;z-index:100;background:var(--cit-surface);border-bottom:3px solid var(--cit-accent)}
  .tb-nav .tb-wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 28px}
  .tb-brand{display:flex;align-items:center;gap:10px}
  .tb-brand b{font-family:var(--cit-font-display);font-size:19px;text-transform:uppercase;letter-spacing:.12em;font-weight:600}
  .tb-navlinks{display:flex;gap:2px;align-items:center}
  .tb-navlinks a{font-family:var(--cit-font-display);font-size:16px;text-transform:uppercase;letter-spacing:.08em;color:var(--cit-muted);padding:9px 15px;transition:.2s}
  .tb-navlinks a:hover{color:var(--cit-ink);background:var(--cit-bg)}
  .tb-navlinks a.cit-btn{color:var(--cit-on-accent)}
  .tb-navlinks a.cit-btn:hover{background:var(--cit-accent);color:var(--cit-on-accent)}
  @media(max-width:900px){.tb-navlinks a:not(.cit-btn){display:none}}

  /* hero — split copy/photo */
  .tb-hero{border-bottom:1px solid var(--cit-line)}
  .tb-hgrid{display:grid;grid-template-columns:1fr;align-items:stretch}
  @media(min-width:960px){.tb-hgrid{grid-template-columns:1.05fr .95fr}}
  .tb-hl{padding:56px 0 50px}
  @media(min-width:960px){.tb-hl{padding-right:46px}}
  .tb-hero h1{font-family:var(--cit-font-display);font-weight:700;text-transform:uppercase;letter-spacing:.02em;font-size:clamp(40px,7.2vw,84px);line-height:1.04;margin-bottom:16px}
  .tb-hero h1 em{font-style:normal;color:var(--cit-accent)}
  .tb-hero p{color:var(--cit-muted);max-width:470px;margin:20px 0 28px}
  .tb-heroctas{display:flex;gap:12px;flex-wrap:wrap}
  .tb-hr{position:relative;min-height:320px;background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .tb-hr img{width:100%;height:100%;object-fit:cover}
  .tb-hr--flat{background:linear-gradient(155deg, var(--cit-surface), color-mix(in srgb, var(--cit-accent) 34%, var(--cit-bg)))}

  /* board — units as departure-board table */
  .tb-board{background:var(--cit-surface);border-bottom:1px solid var(--cit-line);padding:56px 0}
  .tb-boardhead{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;border-bottom:1px solid var(--cit-line);padding-bottom:14px;margin-bottom:8px}
  .tb-boardhead h2{font-family:var(--cit-font-display);font-weight:700;text-transform:uppercase;letter-spacing:.02em;font-size:clamp(26px,4.4vw,44px)}
  .tb-boardhead .tb-note{font-family:var(--cit-font-display);font-size:15px;text-transform:uppercase;letter-spacing:.12em;color:var(--cit-muted);white-space:nowrap}
  .tb-table{width:100%;border-collapse:collapse}
  .tb-table th{font-family:var(--cit-font-display);font-size:13.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--cit-muted);text-align:left;padding:14px 12px 14px 0;font-weight:600;border-bottom:1px solid var(--cit-line)}
  .tb-table td{padding:16px 12px 16px 0;border-bottom:1px solid var(--cit-line);font-size:15px;vertical-align:middle}
  .tb-table td.tb-u{font-family:var(--cit-font-display);font-size:21px;letter-spacing:.04em;text-transform:uppercase}
  .tb-table td.tb-cap{color:var(--cit-muted)}
  .tb-table td.tb-pr{font-family:var(--cit-font-display);font-size:20px;color:var(--cit-accent);white-space:nowrap}
  .tb-table td.tb-act{text-align:right}
  .tb-table a.tb-go{display:inline-block;background:transparent;border:1px solid var(--cit-accent);color:var(--cit-accent);font-family:var(--cit-font-display);font-size:15px;text-transform:uppercase;letter-spacing:.08em;padding:8px 16px;white-space:nowrap;transition:.2s}
  .tb-table a.tb-go:hover{background:var(--cit-accent);color:var(--cit-on-accent)}
  @media(max-width:640px){.tb-table td.tb-cap,.tb-table th.tb-cap-h{display:none}}
  .tb-sample{font-size:12.5px;color:var(--cit-muted);letter-spacing:.04em;padding:14px 0 0}

  /* kiosk booking */
  .tb-kiosk{border-bottom:1px solid var(--cit-line);padding:40px 0}
  .tb-kioskpanel{border:1px solid var(--cit-line);background:var(--cit-surface);padding:14px clamp(16px,3vw,26px)}
  .tb-kioskpanel .cit-enquiry-bar-inner{max-width:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem .4rem}
  .tb-kioskpanel .cit-enquiry-bar-title{margin:0;font-family:var(--cit-font-display);font-size:1.3rem;text-transform:uppercase;letter-spacing:.08em;color:var(--cit-ink)}

  /* sections */
  section.tb-sec{padding:74px 0;border-bottom:1px solid var(--cit-line)}
  .tb-shead{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;border-bottom:1px solid var(--cit-line);padding-bottom:14px;margin-bottom:38px}
  .tb-shead h2{font-family:var(--cit-font-display);font-weight:700;text-transform:uppercase;letter-spacing:.02em;font-size:clamp(26px,4.4vw,44px)}
  .tb-shead h2 em{font-style:normal;color:var(--cit-accent)}
  .tb-shead .tb-note{font-family:var(--cit-font-display);font-size:15px;text-transform:uppercase;letter-spacing:.12em;color:var(--cit-muted);white-space:nowrap}

  /* services — pictogram grid */
  .tb-pict{display:grid;gap:1px;grid-template-columns:repeat(2,1fr);background:var(--cit-line);border:1px solid var(--cit-line)}
  @media(min-width:880px){.tb-pict{grid-template-columns:repeat(4,1fr)}}
  .tb-pi{background:var(--cit-surface);padding:24px 22px}
  .tb-pi svg{width:28px;height:28px;color:var(--cit-accent);margin-bottom:14px}
  .tb-pi p{font-size:14.5px;color:color-mix(in srgb, var(--cit-ink) 84%, transparent)}

  /* gallery */
  .tb-gal{display:grid;gap:16px;grid-template-columns:repeat(2,1fr)}
  @media(min-width:860px){.tb-gal{grid-template-columns:repeat(4,1fr)}}
  .tb-gal figure{position:relative;aspect-ratio:3/4;overflow:hidden;border:1px solid var(--cit-line);background:color-mix(in srgb, var(--cit-ink) 12%, var(--cit-surface))}
  .tb-gal img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
  .tb-gal figure:hover img{transform:scale(1.05)}

  /* reviews */
  .tb-rev{background:color-mix(in srgb, var(--cit-bg) 92%, black)}
  .tb-revscore{display:flex;align-items:center;gap:14px}
  .tb-revscore b{font-family:var(--cit-font-display);font-size:44px;color:var(--cit-accent)}
  .tb-stars{display:flex;gap:3px}
  .tb-stars svg{width:18px;height:18px;color:var(--cit-accent)}
  .tb-revscore span{font-size:13.5px;color:var(--cit-muted)}
  .tb-revgrid{display:grid;gap:18px;grid-template-columns:1fr}
  @media(min-width:880px){.tb-revgrid{grid-template-columns:repeat(3,1fr)}}
  .tb-rv{background:var(--cit-surface);border:1px solid var(--cit-line);padding:24px;display:flex;flex-direction:column}
  .tb-rv p{font-size:14.5px;margin-bottom:16px}
  .tb-rv footer{margin-top:auto;font-family:var(--cit-font-display);font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:var(--cit-accent)}

  /* faq */
  .tb-faq{max-width:860px}
  .tb-faq details{border:1px solid var(--cit-line);margin-bottom:10px;background:var(--cit-surface)}
  .tb-faq summary{list-style:none;cursor:pointer;padding:16px 20px;font-family:var(--cit-font-display);font-size:19px;text-transform:uppercase;letter-spacing:.05em;display:flex;justify-content:space-between;gap:14px}
  .tb-faq summary::after{content:"+";color:var(--cit-accent)}
  .tb-faq details[open] summary{border-bottom:1px solid var(--cit-line)}
  .tb-faq details[open] summary::after{content:"−"}
  .tb-faq details p{padding:16px 20px;color:var(--cit-muted);font-size:14.5px}

  /* contact split */
  .tb-congrid{display:grid;gap:18px;grid-template-columns:1fr}
  @media(min-width:920px){.tb-congrid{grid-template-columns:1.15fr .85fr;align-items:center}}
  .tb-concopy h2{font-family:var(--cit-font-display);font-weight:700;text-transform:uppercase;letter-spacing:.02em;font-size:clamp(26px,4vw,42px);margin:12px 0 20px}
  .tb-conline{display:flex;align-items:center;gap:15px;padding:16px 0;border-top:1px solid var(--cit-line);font-size:16px}
  .tb-conline svg{width:22px;height:22px;color:var(--cit-accent);flex:none}
  .tb-conline b{font-family:var(--cit-font-display);font-size:17px}
  .tb-conline small{color:var(--cit-muted);font-size:13px;display:block}
  .tb-conphoto img{aspect-ratio:4/3;object-fit:cover;width:100%;border:1px solid var(--cit-line)}

  /* footer */
  .tb-foot{background:var(--cit-surface);border-top:1px solid var(--cit-line);padding:52px 0 26px;color:var(--cit-muted)}
  .tb-footgrid{display:grid;gap:30px;grid-template-columns:1fr;margin-bottom:34px}
  @media(min-width:800px){.tb-footgrid{grid-template-columns:2fr 1fr 1fr}}
  .tb-foot .tb-brand b{font-size:19px}
  .tb-foot p{font-size:14px;margin-top:12px;max-width:300px}
  .tb-foot h4{font-family:var(--cit-font-display);color:var(--cit-accent);font-size:14px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:14px}
  .tb-foot a{display:block;padding:4px 0;font-size:14px;transition:.2s}
  .tb-foot a:hover{color:var(--cit-accent)}
  .tb-footlegal{border-top:1px solid var(--cit-line);padding-top:20px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-family:var(--cit-font-display);font-size:13px;letter-spacing:.08em;text-transform:uppercase}

  /* mobile fixed CTA */
  .tb-mobcta{display:none;position:fixed;bottom:0;left:0;right:0;z-index:110;background:color-mix(in srgb, var(--cit-bg) 96%, black);border-top:1px solid var(--cit-line);backdrop-filter:blur(10px);padding:12px 16px;gap:12px;align-items:center;justify-content:space-between}
  .tb-mobcta span{font-family:var(--cit-font-display);font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:var(--cit-ink)}
  @media(max-width:700px){.tb-mobcta{display:flex}body{padding-bottom:64px}}
`;

const CONTACT_ICONS = {
  phone: iconSvg("phone"),
  mail: iconSvg("mail"),
  location: iconSvg("location"),
};

function renderTransit(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["signage-amber"]!;
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
    roomsData ? `<a href="#tb-rooms">${T(data, "Szobák")}</a>` : "",
    data.highlights.length ? `<a href="#tb-services">${T(data, "Szolgáltatások")}</a>` : "",
    photos.length ? `<a href="#tb-gallery">${T(data, "Galéria")}</a>` : "",
    reviewsData ? `<a href="#tb-reviews">${T(data, "Vélemények")}</a>` : "",
    hasContact ? `<a href="#tb-contact">${T(data, "Kapcsolat")}</a>` : "",
    hasContact ? `<a class="cit-btn" href="#cit-enquiry">${ctaLabel(data)}</a>` : "",
  ]
    .filter(Boolean)
    .join("\n        ");
  const nav = `<nav class="tb-nav">
    <div class="tb-wrap">
      <a class="tb-brand" href="#top"><b>${esc(data.name)}</b></a>
      <div class="tb-navlinks">
        ${navLinks}
      </div>
    </div>
  </nav>`;

  // -- hero (split) ---------------------------------------------------------
  const heroImg = heroPhoto
    ? `<div class="tb-hr"><img src="${esc(heroPhoto)}" alt="${esc(data.name)}"></div>`
    : `<div class="tb-hr tb-hr--flat"></div>`;
  const hero = `<header class="tb-hero" id="top">
    <div class="tb-wrap tb-hgrid">
      <div class="tb-hl">
        ${heroCopy.eyebrow ? `<div class="tb-eyebrow">${esc(heroCopy.eyebrow)}</div>` : ""}
        <h1>${accented(h1, heroCopy.accent)}</h1>
        ${sub ? `<p>${esc(sub)}</p>` : ""}
        <div class="tb-heroctas">
          ${hasContact ? `<a class="cit-btn" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
          ${roomsData ? `<a class="cit-btn cit-btn-ghost" href="#tb-rooms">${T(data, "Szobáink")}</a>` : ""}
        </div>
      </div>
      ${heroImg}
    </div>
  </header>`;

  // -- rooms as a departure board (signature) -------------------------------
  const showPriceCol = Boolean(roomsData?.some((r) => r.price));
  const board = roomsData
    ? `<div class="tb-board" id="tb-rooms">
    <div class="tb-wrap">
      <div class="tb-boardhead">
        <h2>${roomCopy.title ? accented(roomCopy.title, roomCopy.accent) : T(data, "Egységeink")}</h2>
        <span class="tb-note">${roomCopy.eyebrow ? esc(roomCopy.eyebrow) : T(data, "Kiadó egységek")}</span>
      </div>
      <table class="tb-table" data-cit-module="rooms">
        <thead>
          <tr>
            <th>${T(data, "Egység")}</th>
            <th class="tb-cap-h">${T(data, "Típus / kapacitás")}</th>
            ${showPriceCol ? `<th>${T(data, "Ár")}</th>` : ""}
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${roomsData
            .map(
              (r) => `<tr>
            <td class="tb-u">${esc(r.name)}</td>
            <td class="tb-cap">${r.capacity ? esc(r.capacity) : r.note ? esc(r.note) : ""}</td>
            ${showPriceCol ? `<td class="tb-pr tb-num">${r.price ? esc(r.price) : ""}</td>` : ""}
            <td class="tb-act">${hasContact ? `<a class="tb-go" href="#cit-enquiry">${T(data, "Foglalás")}</a>` : ""}</td>
          </tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>
      ${roomsSample ? `<p class="tb-sample">${T(data, "Minta — ide a valós szobáid/áraid kerülnek.")}</p>` : ""}
    </div>
  </div>`
    : "";

  // -- kiosk booking --------------------------------------------------------
  const kiosk = `<div class="tb-kiosk">
    <div class="tb-wrap">
      <div class="tb-kioskpanel">
        ${bookingSlot(data)}
      </div>
    </div>
  </div>`;

  // -- services (real highlights only) --------------------------------------
  const services = data.highlights.length
    ? `<section class="tb-sec" id="tb-services">
    <div class="tb-wrap">
      <div class="tb-shead">
        <h2>${T(data, "Ami a helyhez kell")}</h2>
        <span class="tb-note">${T(data, "Szolgáltatások")}</span>
      </div>
      <div class="tb-pict">
        ${data.highlights
          .slice(0, 8)
          .map((h) => `<div class="tb-pi">${iconSvg(matchIcon(h))}<p>${esc(h)}</p></div>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- gallery --------------------------------------------------------------
  const gallery = photos.length
    ? `<section class="tb-sec" id="tb-gallery">
    <div class="tb-wrap">
      <div class="tb-shead">
        <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Galéria")}</h2>
        <span class="tb-note">${galCopy.eyebrow ? esc(galCopy.eyebrow) : T(data, "Nézd meg")}</span>
      </div>
      <div class="tb-gal" data-cit-module="gallery">
        ${photos
          .slice(0, 8)
          .map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt)}"></figure>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // -- reviews --------------------------------------------------------------
  const stars5 = starCount ? `<div class="tb-stars">${starIcon().repeat(starCount)}</div>` : "";
  const reviews = reviewsData
    ? `<section class="tb-sec tb-rev" id="tb-reviews" data-cit-module="reviews">
    <div class="tb-wrap">
      <div class="tb-shead">
        ${
          ratingStat
            ? `<div class="tb-revscore"><b class="tb-num">${esc(ratingStat.value)}</b><div>${stars5}<span>${esc(ratingStat.label)}</span></div></div>`
            : `<h2>${revCopy.title ? accented(revCopy.title, revCopy.accent) : T(data, "Vélemények")}</h2>`
        }
        <span class="tb-note">${revCopy.eyebrow ? esc(revCopy.eyebrow) : T(data, "Vendégeink")}</span>
      </div>
      <div class="tb-revgrid">
        ${reviewsData
          .map(
            (r) =>
              `<div class="tb-rv"><p>${esc(r.quote)}</p><footer>${esc(r.author)}${r.meta ? ` · ${esc(r.meta)}` : ""}</footer></div>`,
          )
          .join("\n        ")}
      </div>
      ${reviewsSample ? `<p class="tb-sample">${T(data, "Minta — ide a valós vendégértékeléseid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- faq ------------------------------------------------------------------
  const faq = faqsData
    ? `<section class="tb-sec" id="tb-faq">
    <div class="tb-wrap">
      <div class="tb-shead">
        <h2>${T(data, "Gyakori kérdések")}</h2>
        <span class="tb-note">${T(data, "Tudnivalók")}</span>
      </div>
      <div class="tb-faq">
        ${faqsData
          .map(
            (f, i) =>
              `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
          )
          .join("\n        ")}
      </div>
      ${faqsSample ? `<p class="tb-sample">${T(data, "Minta — ide a saját válaszaid kerülnek.")}</p>` : ""}
    </div>
  </section>`
    : "";

  // -- contact --------------------------------------------------------------
  const c = data.contact;
  const contactLines = [
    c.phone
      ? `<div class="tb-conline">${CONTACT_ICONS.phone}<div><b>${esc(c.phone)}</b><small>${T(data, "Hívjon bizalommal")}</small></div></div>`
      : "",
    c.email
      ? `<div class="tb-conline">${CONTACT_ICONS.mail}<div><b><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></b><small>${T(data, "Írjon nekünk")}</small></div></div>`
      : "",
    c.address
      ? `<div class="tb-conline">${CONTACT_ICONS.location}<div><b>${esc(c.address)}</b><small>${T(data, "Megközelítés")}</small></div></div>`
      : "",
  ]
    .filter(Boolean)
    .join("\n      ");
  const contact = contactLines
    ? `<section class="tb-sec" id="tb-contact">
    <div class="tb-wrap tb-congrid">
      <div class="tb-concopy">
        <div class="tb-eyebrow">${T(data, "Kapcsolat")}</div>
        <h2>${T(data, "Megközelítés és kapcsolat")}</h2>
        ${data.tagline ? `<p style="color:var(--cit-muted);font-size:16px;margin-bottom:6px">${esc(data.tagline)}</p>` : ""}
        ${contactLines}
        ${hasContact ? `<a class="cit-btn" style="margin-top:24px" href="#cit-enquiry">${T(data, "Szabad időpontot kérek")}</a>` : ""}
      </div>
      ${contactPhoto ? `<div class="tb-conphoto"><img src="${esc(contactPhoto)}" alt="${esc(data.name)}"></div>` : ""}
    </div>
  </section>`
    : "";

  // -- footer ---------------------------------------------------------------
  const footer = `<footer class="tb-foot">
    <div class="tb-wrap">
      <div class="tb-footgrid">
        <div>
          <span class="tb-brand"><b>${esc(data.name)}</b></span>
          ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ""}
        </div>
        <div>
          <h4>${T(data, "Oldal")}</h4>
          ${roomsData ? `<a href="#tb-rooms">${T(data, "Szobák")}</a>` : ""}
          ${photos.length ? `<a href="#tb-gallery">${T(data, "Galéria")}</a>` : ""}
          ${reviewsData ? `<a href="#tb-reviews">${T(data, "Vélemények")}</a>` : ""}
        </div>
        <div>
          <h4>${T(data, "Információ")}</h4>
          <a href="#top">${T(data, "Kezdőlap")}</a>
          <a href="#">${T(data, "Adatkezelés")}</a>
        </div>
      </div>
      <div class="tb-footlegal">
        <span>© ${esc(data.name)} — ${T(data, "Minden jog fenntartva.")}</span>
        ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
      </div>
    </div>
  </footer>`;

  const mobcta = hasContact
    ? `<div class="tb-mobcta">
    <span>${ratingStat ? `<span class="tb-num">${esc(ratingStat.value)}</span> · ${esc(ratingStat.label)}` : esc(data.name)}</span>
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
${TRANSIT_CSS}
  </style>
</head>
<body class="cit-tpl-transit">
    ${nav}
    ${hero}
    ${board}
    ${kiosk}
    ${services}
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

export const TRANSIT: ArtTemplate = {
  id: "transit",
  label: "Indulási-tábla — sötét kiosk, egységek táblázatban (referencia 20)", // i18n-exempt: operator-facing (console template picker)
  skins: ["signage-amber", "forest-night", "aurora-indigo"],
  render: renderTransit,
};
