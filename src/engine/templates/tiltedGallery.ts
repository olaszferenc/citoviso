// "tilted-gallery" art template (ADR-0027 + ADR-0111) — the lasalaplazahotel.com
// reference direction, brought in by the owner as a quality bar.
//
// The signature moves, measured on the reference:
//   • typography leads, not boxes: a small spaced kicker over a large serif line,
//     centred, with a lot of air around it;
//   • the units live in a TILTED, overlapping photo run — as if the prints had been
//     scattered on a table (deterministic rotation by index, so it is generatable);
//   • full-bleed photo bands with the copy floated over a dark veil;
//   • a scattered "mood" cluster with parallax;
//   • a persistent booking bar at the foot of the page.
//
// Motion (ADR-0111): scroll reveals + parallax + the intro sequence, all through the
// shared declarative layer in motion.ts — no library, and every effect degrades to
// "the content is simply there" with JS off or reduced-motion set.

import { starIcon } from "../icons.js";
import {
  introCss,
  introHtml,
  introJs,
  mo,
  motionCss,
  motionJs,
  parallax,
  words,
} from "../motion.js";
import { slotMarker } from "../moduleSections.js";
import type { Recipe, RenderPhase, SiteData } from "../recipe.js";
import { renderSeoHead, seoTitle } from "../seo.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "../skins.js";
import {
  accented,
  bookingSlot,
  centredModsecCss,
  copyOf,
  esc,
  firstSentence,
  mastheadCss,
  mastheadHtml,
  photoFill,
  roomsForMock,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const TILTED_CSS = `
/* shared module sections (.cit-modsec) dressed to this template's rhythm (ADR-0057):
   generous air, centred editorial heading, hairline cards — otherwise the modules
   land as generic grey boxes inside a typography-led page */
:root{
  --cit-modsec-py:104px;
  --cit-modsec-maxw:1120px;
  --cit-modsec-px:24px;
  --cit-modsec-divider:0;
  --cit-modsec-head-align:center;
  --cit-modsec-head-mb:44px;
  --cit-modsec-head-size:clamp(25px,4.2vw,42px);
  --cit-modsec-head-weight:400;
  --cit-modsec-card-radius:var(--cit-radius);
  --cit-modsec-card-pad:26px}
*{box-sizing:border-box}
body{margin:0;background:var(--cit-bg);color:var(--cit-ink);font-family:var(--cit-font-body);
  font-size:16.5px;line-height:1.62}
img{display:block;max-width:100%}
a{color:inherit}
.t-wrap{width:min(1120px,88vw);margin-inline:auto}
.t-kick{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--cit-muted)}
h1,h2,h3{font-family:var(--cit-font-display);font-weight:400;margin:0;letter-spacing:-.01em}
section{padding:clamp(64px,9vh,104px) 0}

/* hero */
.t-hero{position:relative;height:88vh;min-height:520px;overflow:hidden;display:grid;place-items:center;
  background:color-mix(in srgb,var(--cit-ink) 88%,#000)}
.t-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.t-hero .cit-mast{z-index:3}
/* A bright photo (sky, white wall) would leave the hero title below 3:1 — the
   linear veil alone is not enough at the vertical middle where the title sits, so
   a radial pool is laid under it (hero-contrast-check measures this). */
.t-hero::after{content:"";position:absolute;inset:0;background:
  radial-gradient(78% 54% at 50% 52%,color-mix(in srgb,#000 62%,transparent),transparent 72%),
  linear-gradient(180deg,
  color-mix(in srgb,#000 60%,transparent),color-mix(in srgb,#000 42%,transparent) 38%,
  color-mix(in srgb,#000 76%,transparent))}
.t-mast{position:relative;z-index:2;text-align:center;padding:0 22px;color:var(--cit-on-accent)}
.t-mast .t-kick{color:color-mix(in srgb,var(--cit-on-accent) 92%,transparent);
  text-shadow:0 1px 14px rgba(0,0,0,.55)}
.t-mast h1{font-size:clamp(38px,9vw,84px);line-height:1.03;margin:.26em 0 .16em;letter-spacing:.02em;
  text-shadow:0 2px 26px rgba(0,0,0,.34)}
.t-mast .t-sub{font-size:11px;letter-spacing:.4em;text-transform:uppercase;
  color:color-mix(in srgb,var(--cit-on-accent) 86%,transparent)}
/* a long tagline in 11px/.4em tracking is unreadable — measured on a real lead */
.t-mast .t-sub-long{font-size:clamp(13px,1.5vw,16px);letter-spacing:.02em;text-transform:none;
  font-family:var(--cit-font-display);max-width:36ch;margin-inline:auto;line-height:1.45}
.t-scroll{position:absolute;bottom:26px;left:0;right:0;z-index:2;text-align:center;font-size:10px;
  letter-spacing:.34em;text-transform:uppercase;color:color-mix(in srgb,var(--cit-on-accent) 72%,transparent)}

/* intro band: photo with the lede floated over it */
.t-band{position:relative;padding:0;background:color-mix(in srgb,var(--cit-ink) 92%,#000)}
.t-band-ph{position:relative;height:86vh;min-height:460px;overflow:hidden}
.t-band-ph img{position:absolute;inset:-12% 0;width:100%;height:124%;object-fit:cover;opacity:.62}
/* the photo can be bright (sky, white wall) — the copy needs its own floor */
.t-band-ph::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 78% at 50% 50%,
  rgba(10,9,8,.72),rgba(10,9,8,.42) 62%,rgba(10,9,8,.6))}
.t-band-tx{position:absolute;inset:0;z-index:2;display:grid;place-items:center;padding:0 22px;text-align:center}
.t-lede{color:var(--cit-on-accent);font-family:var(--cit-font-display);
  font-size:clamp(20px,3.4vw,34px);line-height:1.5;max-width:22ch;text-shadow:0 2px 26px rgba(0,0,0,.4)}

/* facts */
.t-facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--cit-line);
  border:1px solid var(--cit-line);margin-top:42px}
.t-facts div{background:var(--cit-bg);padding:20px 14px;text-align:center}
.t-facts b{display:block;font-family:var(--cit-font-display);font-size:30px;font-weight:400;line-height:1}
.t-facts span{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--cit-muted)}
@media(max-width:700px){.t-facts{grid-template-columns:1fr 1fr}}

/* THE SIGNATURE: tilted, overlapping photo run */
.t-run{display:flex;gap:26px;padding:34px 0 46px;overflow-x:auto;scroll-snap-type:x mandatory;
  scrollbar-width:none;padding-inline:max(24px,calc((100vw - 1120px)/2))}
.t-run::-webkit-scrollbar{display:none}
.t-run figure{flex:0 0 auto;width:min(330px,74vw);margin:0;scroll-snap-align:center}
/* the tilt sits on <figure>; the motion hook rides an inner wrapper, because a
   reveal's transform:none would silently wipe this rotate() (ADR-0111 rule 3) */
.t-run figure:nth-child(odd){transform:rotate(-1.6deg)}
.t-run figure:nth-child(even){transform:rotate(1.3deg) translateY(26px)}
.t-run figure:nth-child(3n){transform:rotate(-.6deg) translateY(-14px)}
.t-run .t-shot{width:100%;height:min(420px,52vh);object-fit:cover;border-radius:var(--cit-radius);
  box-shadow:var(--cit-shadow);overflow:hidden}
.t-run figcaption{font-family:var(--cit-font-display);font-size:15px;padding-top:12px;color:var(--cit-muted)}
.t-run .t-note{display:block;font-size:12px;color:var(--cit-muted);opacity:.8}
.t-runhint{text-align:center;font-size:12px;color:var(--cit-muted);letter-spacing:.14em;text-transform:uppercase}

/* split feature */
.t-split{display:grid;grid-template-columns:1fr 1fr;align-items:stretch;padding:0}
.t-split .ph{position:relative;overflow:hidden;min-height:64vh}
.t-split .ph img{position:absolute;inset:-10% 0;width:100%;height:120%;object-fit:cover}
.t-split .tx{display:flex;flex-direction:column;justify-content:center;padding:56px min(64px,7vw);
  background:var(--cit-surface)}
.t-split.dark .tx{background:var(--cit-accent);color:var(--cit-on-accent)}
.t-split.dark .t-kick{color:color-mix(in srgb,var(--cit-on-accent) 72%,transparent)}
.t-split h2{font-size:clamp(24px,3.4vw,34px);margin:.34em 0 .6em;line-height:1.2}
.t-split p{margin:0 0 14px;max-width:42ch}
@media(max-width:820px){.t-split{grid-template-columns:1fr}.t-split .ph{min-height:50vh}}

.t-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.t-chips span{font-size:12.5px;padding:6px 12px;border:1px solid currentColor;border-radius:999px;opacity:.82}

/* mood scatter */
.t-mood{background:var(--cit-accent);color:var(--cit-on-accent);overflow:hidden;padding:0}
.t-scatter{position:relative;height:112vh;min-height:620px;width:min(1120px,88vw);margin-inline:auto}
.t-scatter figure{position:absolute;margin:0;width:clamp(140px,26vw,290px)}
.t-scatter img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:var(--cit-radius);
  box-shadow:0 26px 60px -30px rgba(0,0,0,.8)}
.t-scatter .m0{left:2%;top:4%}
.t-scatter .m1{right:3%;top:16%;width:clamp(150px,30vw,330px)}
.t-scatter .m2{left:12%;bottom:14%}
.t-scatter .m3{right:14%;bottom:4%;width:clamp(130px,24vw,250px)}
.t-say{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;padding:0 24px}
.t-say p{font-family:var(--cit-font-display);font-size:clamp(21px,3.4vw,34px);text-align:center;
  max-width:20ch;margin:0;text-shadow:0 2px 30px rgba(0,0,0,.45)}

/* review */
.t-rev{text-align:center}
.t-rev .t-score{display:inline-flex;align-items:baseline;gap:10px;font-family:var(--cit-font-display)}
.t-rev .t-score b{font-size:54px;font-weight:400;line-height:1}
.t-stars{color:var(--cit-accent);display:inline-flex;gap:2px}
.t-rev small{display:block;color:var(--cit-muted);font-size:12.5px;margin-top:10px}
.t-quotes{display:grid;gap:38px;margin-top:52px}
.t-quotes figure{margin:0}
.t-quotes blockquote{margin:0;font-family:var(--cit-font-display);font-size:clamp(18px,2.4vw,26px);
  line-height:1.5;max-width:34ch;margin-inline:auto}
.t-quotes figcaption{margin-top:12px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--cit-muted)}

/* footer */
.t-foot{background:color-mix(in srgb,var(--cit-ink) 94%,#000);color:color-mix(in srgb,var(--cit-on-accent) 82%,transparent);
  padding:56px 0 26px;font-size:13.5px}
.t-fgrid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:32px}
@media(max-width:820px){.t-fgrid{grid-template-columns:1fr;gap:22px}}
.t-foot .t-brand{font-family:var(--cit-font-display);font-size:22px;color:var(--cit-on-accent)}
.t-legal{border-top:1px solid color-mix(in srgb,var(--cit-on-accent) 18%,transparent);
  margin-top:32px;padding-top:16px;display:flex;flex-wrap:wrap;gap:16px;font-size:12px;opacity:.75}
`;

function renderTilted(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["sand-cream-airy"] ?? Object.values(SKINS)[0]!;
  const photos = data.photos;
  const hero = photos[0];
  const bandPhoto = photos[1] ?? photos[0];
  const rooms = roomsForMock(data);
  const heroCopy = copyOf(recipe, "hero");
  const roomsCopy = copyOf(recipe, "rooms");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const place = data.place?.city ?? "";
  const lede = firstSentence(data.intro, 220) || data.tagline;

  // Mood cluster: the tail of the photo set, so it never repeats the hero/rooms.
  // Wrap around rather than slice past the end: a photo-poor lead must still get
  // the (smaller) mood cluster — it carries this template's gallery module hook.
  const moodStart = Math.min(rooms.length + 2, Math.max(0, photos.length - 1));
  const mood = photos.length
    ? Array.from({ length: Math.min(4, photos.length) }, (_, i) => photos[(moodStart + i) % photos.length]!)
    : [];

  const shot = (p: { url: string; alt: string } | undefined, alt: string) =>
    p ? `<img class="t-shot" src="${esc(p.url)}" alt="${esc(p.alt || alt)}" loading="lazy">` : photoFill(alt);

  const facts: { n: string; l: string }[] = [];
  if (data.sampleRoomCount ?? data.rooms?.length)
    facts.push({ n: String(data.sampleRoomCount ?? data.rooms!.length), l: T(data, "szoba") });
  // Skip a stat that repeats a fact we already counted (the demo lead shows
  // "3 szoba" from sampleRoomCount and "9 szoba" from stats — the same label
  // twice reads as a contradiction).
  const taken = new Set(facts.map((f) => f.l.toLowerCase()));
  for (const s of data.stats ?? []) {
    if (facts.length >= 4) break;
    if (taken.has(s.label.toLowerCase())) continue;
    taken.add(s.label.toLowerCase());
    facts.push({ n: esc(s.value), l: esc(s.label) });
  }

  const masthead = mastheadHtml(data, {
    links: [
      { label: T(data, "Szobák"), href: "#cit-rooms" },
      { label: T(data, "Kapcsolat"), href: "#cit-contact" },
      { label: T(data, "Foglalás"), href: "#cit-enquiry", hot: true },
    ],
    place,
  });

  const heroBlock = `<header class="t-hero">
    ${hero ? `<img class="t-hero-img" src="${esc(hero.url)}" alt="${esc(hero.alt)}">` : photoFill(data.name)}
    ${masthead}
    <div class="t-mast" data-cit-hero-copy>
      ${place ? `<div class="t-kick" ${mo("in", 120)}>${esc(place)}</div>` : ""}
      <h1 ${mo("up", 200)}>${accented(heroCopy.lead ?? data.name, heroCopy.accent)}</h1>
      ${
        data.tagline
          ? `<div class="t-sub${data.tagline.length > 48 ? " t-sub-long" : ""}" ${mo("in", 420)}>${esc(
              data.tagline,
            )}</div>`
          : ""
      }
    </div>
    <div class="t-scroll">${T(data, "görgessen")}</div>
  </header>`;

  const band = `<section class="t-band">
    <div class="t-band-ph">
      ${bandPhoto ? `<img ${parallax(1)} src="${esc(bandPhoto.url)}" alt="${esc(bandPhoto.alt)}" loading="lazy">` : ""}
      <div class="t-band-tx">
        <div class="t-lede" ${mo("up", 80)}>${accented(lede, heroCopy.accent)}</div>
      </div>
    </div>
  </section>`;

  const factsBlock = facts.length
    ? `<section><div class="t-wrap">
        <div class="t-facts" ${mo("rise", 140)}>
          ${facts.map((f) => `<div><b>${esc(f.n)}</b><span>${esc(f.l)}</span></div>`).join("")}
        </div>
      </div></section>`
    : "";

  const roomsBlock = `<section class="t-rooms" id="cit-rooms" data-cit-module="rooms" style="padding-bottom:0">
    <div class="t-wrap" style="text-align:center">
      <div class="t-kick" ${mo("in")}>${T(data, "Szobák")}</div>
      <h2 style="font-size:clamp(25px,4.2vw,40px);margin-top:.4em" ${mo("up", 90)}>${esc(
        roomsCopy.title ?? T(data, "Ahol megszáll"),
      )}</h2>
    </div>
    <div class="t-run">
      ${rooms
        .map(
          (r, i) => `<figure><div class="t-rv" ${mo("up", i * 90)}>
          ${shot(r.photo, r.name)}
          <figcaption>${esc(r.name)}${r.capacity ? `<span class="t-note">${esc(r.capacity)}</span>` : ""}</figcaption>
        </div></figure>`,
        )
        .join("")}
    </div>
    <div class="t-runhint">${T(data, "húzza oldalra")}</div>
  </section>`;

  const highlights = data.highlights.slice(0, 8);
  const featurePhoto = photos[Math.min(2, Math.max(0, photos.length - 1))];
  const feature = `<section class="t-split dark">
    <div class="ph">${featurePhoto ? `<img ${parallax(0.8)} src="${esc(featurePhoto.url)}" alt="${esc(featurePhoto.alt)}" loading="lazy">` : photoFill(data.name)}</div>
    <div class="tx">
      <div class="t-kick" ${mo("in")}>${esc(featCopy.eyebrow ?? T(data, "Ami csak itt van"))}</div>
      <h2 ${mo("up", 90)}>${esc(featCopy.title ?? data.tagline)}</h2>
      ${highlights.length ? `<div class="t-chips" ${mo("up", 200)}>${highlights.map((h) => `<span>${esc(h)}</span>`).join("")}</div>` : ""}
    </div>
  </section>`;

  const moodBlock = mood.length
    ? `<section class="t-mood" data-cit-module="gallery">
      <div class="t-scatter">
        ${mood
          .map(
            (p, i) => `<figure class="m${i} cit-par" data-cit-par="${(1 - i * 0.18).toFixed(2)}">
          <div ${mo("in", i * 100)}><img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"></div>
        </figure>`,
          )
          .join("")}
        <div class="t-say"><p ${mo("up", 220)}>${esc(galCopy.title ?? data.tagline)}</p></div>
      </div>
    </section>`
    : "";

  // Real guest quotes only — a sample review must never reach a page (§B.17, and
  // module-render-check measures both directions: the owner's data MUST appear,
  // the SAMPLE_REVIEWS must NOT).
  const quotes = (data.reviews ?? []).slice(0, 3);
  const quoteBlock = quotes.length
    ? `<div class="t-quotes">
        ${quotes
          .map(
            (q, i) => `<figure ${mo("up", i * 110)}>
          <blockquote>${esc(q.quote)}</blockquote>
          ${q.author ? `<figcaption>${esc(q.author)}</figcaption>` : ""}
        </figure>`,
          )
          .join("")}
      </div>`
    : "";

  const rating = data.rating;
  const review = rating
    ? `<section class="t-rev"><div class="t-wrap">
      <div class="t-stars" ${mo("in")} aria-hidden="true">${starIcon().repeat(5)}</div>
      <div class="t-score" ${mo("up", 90)}><b>${esc(String(rating.value).replace(".", ","))}</b> / 10</div>
      ${rating.count ? `<small ${mo("in", 180)}>${T(data, "{n} vendégértékelés átlaga", { n: rating.count })}</small>` : ""}
      ${quoteBlock}
    </div></section>`
    : quoteBlock
      ? `<section class="t-rev"><div class="t-wrap">${quoteBlock}</div></section>`
      : "";

  const c = data.contact;
  const footer = `<footer class="t-foot" id="cit-contact">
    <div class="t-wrap">
      <div class="t-fgrid">
        <div>
          <div class="t-brand">${esc(data.name)}</div>
          <p style="opacity:.72;max-width:34ch">${esc(data.tagline)}</p>
        </div>
        ${c.address ? `<div><div class="t-kick">${T(data, "Cím")}</div><p>${esc(c.address)}</p></div>` : ""}
        <div><div class="t-kick">${T(data, "Kapcsolat")}</div>
          ${c.phone ? `<p><a href="tel:${esc(c.phone.replace(/\s+/g, ""))}">${esc(c.phone)}</a></p>` : ""}
          ${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ""}
        </div>
      </div>
      <div class="t-legal">
        <a href="/adatvedelem">${T(data, "Adatvédelmi tájékoztató")}</a>
        <a href="/impresszum">${T(data, "Impresszum")}</a>
        <span>© ${esc(data.name)}</span>
      </div>
    </div>
  </footer>`;

  const intro = {
    name: esc(data.name),
    place: esc(place || data.tagline),
    photos: photos.slice(0, 4).map((p) => p.url),
  };

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
${mastheadCss()}
${TILTED_CSS}
${centredModsecCss("tilted-gallery")}
${motionCss("calm")}
${intro.photos.length ? introCss() : ""}
  </style>
</head>
<body class="cit-tpl-tilted-gallery">
  ${heroBlock}
  ${band}
  ${factsBlock}
  ${roomsBlock}
  ${slotMarker("showcase")}
  ${feature}
  ${slotMarker("trust")}
  ${moodBlock}
  ${slotMarker("practical")}
  ${review}
  ${bookingSlot(data, phase)}
  ${slotMarker("closing")}
  ${footer}
  ${intro.photos.length ? introHtml(intro) : ""}
  <script>${motionJs()}${intro.photos.length ? introJs(intro) : ""}</script>
</body>
</html>`;
}

export const TILTED_GALLERY: ArtTemplate = {
  id: "tilted-gallery",
  label: "Döntött galéria — szórt fotó-sor, mozgó intro (referencia: Lasala)", // i18n-exempt: operator-facing (console template picker)
  skins: ["sand-cream-airy", "coastal-fresh", "editorial-warm", "stone-masonry"],
  render: renderTilted,
};
