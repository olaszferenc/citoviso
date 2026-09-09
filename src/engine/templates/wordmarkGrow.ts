// "wordmark-grow" art template (ADR-0027 + ADR-0115) — the thebendclub.com
// reference direction the owner brought in as a quality bar.
//
// The signature moves, measured on the reference (its own class names name them):
//   • `hero-loader__word` → the wordmark draws in, letter by letter;
//   • `hero-loader__growing-image` → a SMALL photo frame sits INSIDE the wordmark,
//     cycles photographs, and then GROWS into the hero — the whole idea of the page;
//   • `hero-fade-word` → headlines then reveal WORD BY WORD;
//   • Lenis smooth scroll + calm, rounded portrait photo cards, cream ground.
//
// The growing-frame intro lives in motion.ts (shared), because it is the piece the
// owner picked as the house style: 0.6× playback, first session view only.
//
// This template is the QUIET one of the three: rounded portrait cards, generous
// white space, alternating text/photo rows — it carries an ordinary photo set
// without ever asking it to fill a screen.

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
  copyOf,
  esc,
  firstSentence,
  heroPhoto,
  photoFill,
  roomsForMock,
  T,
  type ArtTemplate,
} from "../templateKit.js";

/** A drawn four-point star — the reference's section mark. Inline SVG (§B.4). */
const SPARK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2c.5 5 2.5 7.5 8 8-5.5.5-7.5 3-8 8-.5-5-2.5-7.5-8-8 5.5-.5 7.5-3 8-8Z"/></svg>`;

const WORD_CSS = `
/* shared module sections dressed to this template's rhythm (ADR-0057) */
:root{
  --cit-modsec-py:108px;
  --cit-modsec-maxw:1140px;
  --cit-modsec-px:26px;
  --cit-modsec-divider:0;
  --cit-modsec-head-align:left;
  --cit-modsec-head-mb:40px;
  --cit-modsec-head-size:clamp(26px,4vw,44px);
  --cit-modsec-head-weight:400;
  --cit-modsec-card-radius:20px;
  --cit-modsec-card-pad:28px;
  --cit-modsec-card-bg:var(--cit-surface);
  --cit-modsec-card-border:1px solid var(--cit-line)}
/* soft, generously rounded cards with a lifted shadow — the quiet one */
/* ── module LAYOUT: a wide, airy three-column card grid (owner's call) ──
   The widest measure of the three, left-aligned headings, soft lifted cards. */
.cit-tpl-wordmark-grow .cit-modsec__in{max-width:1180px}
.cit-tpl-wordmark-grow .cit-modsec__grid{grid-template-columns:repeat(3,1fr);gap:20px}
.cit-tpl-wordmark-grow .cit-modsec__facts{grid-template-columns:repeat(2,1fr);gap:20px}
.cit-tpl-wordmark-grow .cit-modsec__item,
.cit-tpl-wordmark-grow .cit-modsec__fact{
  box-shadow:0 18px 40px -32px color-mix(in srgb,var(--cit-ink) 60%,transparent)}
.cit-tpl-wordmark-grow .cit-modsec h2{letter-spacing:-.015em}
.cit-tpl-wordmark-grow .cit-modsec table{border-radius:20px;overflow:hidden;
  background:var(--cit-surface);border:1px solid var(--cit-line)}
.cit-tpl-wordmark-grow .cit-modsec th,
.cit-tpl-wordmark-grow .cit-modsec td{padding-left:20px;padding-right:20px}
@media(max-width:900px){.cit-tpl-wordmark-grow .cit-modsec__grid{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.cit-tpl-wordmark-grow .cit-modsec__grid,
  .cit-tpl-wordmark-grow .cit-modsec__facts{grid-template-columns:1fr}}
*{box-sizing:border-box}
body{margin:0;background:var(--cit-bg);color:var(--cit-ink);font-family:var(--cit-font-body);
  font-size:17px;line-height:1.7}
img{display:block;max-width:100%}
a{color:inherit}
.w-wrap{width:min(1140px,88vw);margin-inline:auto}
h1,h2,h3{font-family:var(--cit-font-display);font-weight:400;margin:0;letter-spacing:-.01em}
section{padding:clamp(70px,10vh,124px) 0}
.w-kick{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--cit-muted)}
.w-spark{color:var(--cit-accent);display:block;margin-bottom:20px}


/* ── own header: minimal bar, wordmark centred, booking pill right ── */
.w-nav{position:sticky;top:0;z-index:50;display:grid;grid-template-columns:1fr auto 1fr;
  align-items:center;gap:14px;padding:15px 26px;
  background:color-mix(in srgb,var(--cit-bg) 88%,transparent);backdrop-filter:blur(8px);
  border-bottom:1px solid color-mix(in srgb,var(--cit-line) 60%,transparent)}
.w-nav a{color:var(--cit-ink);text-decoration:none;font-size:12.5px;letter-spacing:.02em}
.w-nav .w-links,.w-nav .w-right{display:none;gap:24px;align-items:center}
@media(min-width:880px){.w-nav .w-links,.w-nav .w-right{display:flex}}
.w-nav .w-right{justify-content:flex-end}
.w-nav .w-brand-s{text-align:center;font-family:var(--cit-font-display);font-size:17px;
  white-space:nowrap}
.w-pill{background:var(--cit-ink);color:var(--cit-bg);font-size:12px;padding:10px 22px;
  border-radius:999px;text-decoration:none;display:inline-block}

/* hero */
.w-hero{position:relative;height:66vh;min-height:420px;overflow:hidden}
.w-hero img{width:100%;height:118%;object-fit:cover;position:absolute;inset:-9% 0}
/* Bottom-weighted veil only — the top of the photo stays open (the reference
   keeps its hero bright); the copy gets its floor from the lower gradient. */
.w-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,
  color-mix(in srgb,#000 30%,transparent) 0,transparent 26%,transparent 44%,
  color-mix(in srgb,#000 78%,transparent))}
/* copy sits BOTTOM-LEFT, not centred — this is the reference's stance */
.w-hero-copy{position:absolute;left:0;right:0;bottom:8%;z-index:3;text-align:left;
  width:min(1140px,88vw);margin-inline:auto;
  color:var(--cit-on-accent);text-shadow:0 2px 26px rgba(0,0,0,.55)}
.w-hero-copy h1{font-size:clamp(28px,5.4vw,64px);line-height:1.1;max-width:16ch;margin:0}
.w-hero-copy .w-kick{color:color-mix(in srgb,var(--cit-on-accent) 90%,transparent);margin-bottom:12px}

/* alternating rows: rounded portrait card + copy */
.w-row{display:grid;grid-template-columns:1fr 1fr;gap:min(72px,7vw);align-items:center}
.w-row.rev .w-fig{order:2}
.w-card{position:relative;aspect-ratio:4/5;overflow:hidden;border-radius:20px;
  box-shadow:0 30px 64px -38px color-mix(in srgb,var(--cit-ink) 66%,transparent)}
.w-card img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.w-row h2{font-size:clamp(26px,4vw,46px);line-height:1.16;margin-bottom:.5em}
.w-row p{margin:0 0 1em;max-width:44ch;color:color-mix(in srgb,var(--cit-ink) 86%,transparent)}
@media(max-width:860px){.w-row,.w-row.rev{grid-template-columns:1fr;gap:30px}
  .w-row.rev .w-fig{order:0}}

/* statement line */
.w-say{text-align:center}
.w-say p{font-family:var(--cit-font-display);font-size:clamp(22px,3.6vw,40px);line-height:1.35;
  max-width:22ch;margin:0 auto}

/* facts */
.w-facts{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:56px}
.w-facts div{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:18px;
  padding:24px 18px;text-align:center}
.w-facts b{display:block;font-family:var(--cit-font-display);font-size:32px;font-weight:400;line-height:1.1}
.w-facts span{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--cit-muted)}
@media(max-width:820px){.w-facts{grid-template-columns:1fr 1fr}}

/* room cards */
.w-rooms{display:grid;grid-template-columns:repeat(3,1fr);gap:min(30px,3.5vw);margin-top:48px}
.w-rooms figure{margin:0}
.w-rooms figcaption{padding-top:14px;font-size:14px}
.w-rooms .w-note{display:block;font-size:12.5px;color:var(--cit-muted)}
@media(max-width:860px){.w-rooms{grid-template-columns:1fr}}

/* amenity chips */
.w-chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}
.w-chips span{font-size:13px;padding:8px 15px;border:1px solid var(--cit-line);border-radius:999px;
  background:var(--cit-surface)}

/* review */
.w-rev{text-align:center}
.w-rev .w-score{font-family:var(--cit-font-display);font-size:60px;line-height:1}
.w-rev .w-of{color:var(--cit-muted);font-size:20px}
.w-stars{color:var(--cit-accent);display:inline-flex;gap:2px}
.w-rev small{display:block;color:var(--cit-muted);font-size:12.5px;margin-top:10px}
.w-quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:26px;margin-top:46px}
.w-quotes figure{margin:0;background:var(--cit-surface);border:1px solid var(--cit-line);
  border-radius:20px;padding:26px;text-align:left}
.w-quotes blockquote{margin:0;font-size:16px;line-height:1.6}
.w-quotes figcaption{margin-top:14px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--cit-muted)}

/* footer */
.w-foot{background:var(--cit-surface);border-top:1px solid var(--cit-line);padding:64px 0 26px;font-size:14px}
.w-fgrid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:34px}
@media(max-width:820px){.w-fgrid{grid-template-columns:1fr;gap:24px}}
.w-foot .w-brand{font-family:var(--cit-font-display);font-size:22px}
.w-legal{border-top:1px solid var(--cit-line);margin-top:34px;padding-top:16px;display:flex;
  flex-wrap:wrap;gap:18px;font-size:12px;color:var(--cit-muted)}
`;

function renderWordmark(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["coastal-fresh"] ?? Object.values(SKINS)[0]!;
  const photos = data.photos;
  const hero = heroPhoto(data, 2);
  const rooms = roomsForMock(data);
  const heroCopy = copyOf(recipe, "hero");
  const roomsCopy = copyOf(recipe, "rooms");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const place = data.place?.city ?? "";
  const lede = firstSentence(data.intro, 200) || data.tagline;
  // What is LEFT of the intro after the lede — printing the whole intro again
  // repeats the same sentence when the intro is short (measured).
  const rest = data.intro.startsWith(lede) ? data.intro.slice(lede.length).trim() : data.intro;

  const card = (p: { url: string; alt: string } | undefined, alt: string, delay = 0) =>
    `<div class="w-card" ${mo("rise", delay)}>${
      p ? `<img src="${esc(p.url)}" alt="${esc(p.alt || alt)}" loading="lazy">` : photoFill(alt)
    }</div>`;

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
    facts.push({ n: s.value, l: s.label });
  }

  const c0 = data.contact;
  const nav = `<nav class="w-nav">
    <span class="w-links">
      <a href="#cit-about">${T(data, "A ház")}</a>
      <a href="#cit-rooms">${T(data, "Szobák")}</a>
    </span>
    <span class="w-brand-s">${esc(data.name)}</span>
    <span class="w-right">
      ${c0.phone ? `<a href="tel:${esc(c0.phone.replace(/\s+/g, ""))}">${esc(c0.phone)}</a>` : ""}
      <a class="w-pill" href="#cit-enquiry">${T(data, "Foglalás")}</a>
    </span>
  </nav>`;

  // The hero copy is revealed word by word — the intro hands over to it when the
  // growing frame has filled the screen (data-cit-hero-copy is that handshake).
  const heroBlock = `${nav}
  <header class="w-hero">
    ${hero ? `<img ${parallax(0.7)} src="${esc(hero.url)}" alt="${esc(hero.alt)}">` : photoFill(data.name)}
    <div class="w-hero-copy cit-words" data-cit-hero-copy ${mo("in", 100)}>
      ${place ? `<div class="w-kick">${esc(place)}</div>` : ""}
      <h1>${accented(heroCopy.lead ?? data.name, heroCopy.accent)}</h1>
    </div>
  </header>`;

  const about = `<section id="cit-about">
    <div class="w-wrap">
      <div class="w-row">
        <div class="w-fig">${card(photos[1] ?? hero, data.name)}</div>
        <div>
          <span class="w-spark">${SPARK}</span>
          <h2 ${mo("up")}>${esc(featCopy.title ?? data.tagline)}</h2>
          <p ${mo("up", 90)}>${accented(lede, heroCopy.accent)}</p>
          ${rest ? `<p ${mo("up", 150)}>${esc(rest)}</p>` : ""}
          ${
            data.highlights.length
              ? `<div class="w-chips" ${mo("up", 210)}>${data.highlights
                  .slice(0, 8)
                  .map((h) => `<span>${esc(h)}</span>`)
                  .join("")}</div>`
              : ""
          }
        </div>
      </div>
      ${
        facts.length
          ? `<div class="w-facts" ${mo("rise", 120)}>${facts
              .map((f) => `<div><b>${esc(f.n)}</b><span>${esc(f.l)}</span></div>`)
              .join("")}</div>`
          : ""
      }
    </div>
  </section>`;

  const roomsBlock = `<section id="cit-rooms" data-cit-module="rooms" style="padding-top:0">
    <div class="w-wrap">
      <span class="w-spark">${SPARK}</span>
      <h2 style="font-size:clamp(26px,4vw,46px)" ${mo("up")}>${esc(
        roomsCopy.title ?? T(data, "Szobák"),
      )}</h2>
      <div class="w-rooms">
        ${rooms
          .slice(0, 3)
          .map(
            (r, i) => `<figure>${card(r.photo, r.name, i * 140)}
          <figcaption>${esc(r.name)}${
            r.capacity ? `<span class="w-note">${esc(r.capacity)}</span>` : ""
          }</figcaption></figure>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;

  // Wrap around instead of slicing: a lead with two photos would otherwise lose
  // the gallery section entirely — and with it the module hook (measured by
  // configurator-placement-check). The data-poor branch is the blind branch.
  const galPhoto = photos.length ? photos[Math.min(2, photos.length - 1)] : undefined;
  const gallery = `<section data-cit-module="gallery" style="padding-top:0">
      <div class="w-wrap">
        <div class="w-row rev">
          <div class="w-fig">${card(galPhoto, data.name, 80)}</div>
          <div>
            <span class="w-spark">${SPARK}</span>
            <h2 ${mo("up")}>${esc(galCopy.title ?? T(data, "Képek"))}</h2>
            <p ${mo("up", 90)}>${esc(galCopy.eyebrow ?? data.tagline)}</p>
          </div>
        </div>
      </div>
    </section>`;

  const sayText = galCopy.title ?? data.tagline;
  const say = `<section class="w-say"><div class="w-wrap">
    <p class="cit-words" ${mo("in")}>${words(esc(sayText))}</p>
  </div></section>`;

  // Real guest quotes only — a sample review must never reach a page (§B.17).
  const quotes = (data.reviews ?? []).slice(0, 3);
  const quoteBlock = quotes.length
    ? `<div class="w-quotes">${quotes
        .map(
          (q, i) => `<figure ${mo("up", i * 110)}>
        <blockquote>${esc(q.quote)}</blockquote>
        ${q.author ? `<figcaption>${esc(q.author)}</figcaption>` : ""}</figure>`,
        )
        .join("")}</div>`
    : "";

  const rating = data.rating;
  const review =
    rating || quoteBlock
      ? `<section class="w-rev"><div class="w-wrap">
      ${
        rating
          ? `<div class="w-stars" ${mo("in")} aria-hidden="true">${starIcon().repeat(5)}</div>
      <div class="w-score" ${mo("up", 90)}>${esc(
        String(rating.value).replace(".", ","),
      )}<span class="w-of"> / 10</span></div>
      ${
        rating.count
          ? `<small ${mo("in", 170)}>${T(data, "{n} vendégértékelés átlaga", {
              n: rating.count,
            })}</small>`
          : ""
      }`
          : ""
      }
      ${quoteBlock}
    </div></section>`
      : "";

  const c = data.contact;
  const footer = `<footer class="w-foot" id="cit-contact">
    <div class="w-wrap">
      <div class="w-fgrid">
        <div>
          <div class="w-brand">${esc(data.name)}</div>
          <p style="color:var(--cit-muted);max-width:34ch">${esc(data.tagline)}</p>
        </div>
        ${c.address ? `<div><div class="w-kick">${T(data, "Cím")}</div><p>${esc(c.address)}</p></div>` : ""}
        <div><div class="w-kick">${T(data, "Kapcsolat")}</div>
          ${c.phone ? `<p><a href="tel:${esc(c.phone.replace(/\s+/g, ""))}">${esc(c.phone)}</a></p>` : ""}
          ${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ""}
        </div>
      </div>
      <div class="w-legal">
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

${WORD_CSS}
${motionCss("calm")}
${intro.photos.length ? introCss() : ""}
  </style>
</head>
<body class="cit-tpl-wordmark-grow">
  ${heroBlock}
  ${about}
  ${roomsBlock}
  ${slotMarker("showcase")}
  ${gallery}
  ${say}
  ${slotMarker("trust")}
  ${review}
  ${slotMarker("practical")}
  ${bookingSlot(data, phase)}
  ${slotMarker("closing")}
  ${footer}
  ${intro.photos.length ? introHtml(intro) : ""}
  <script>${motionJs()}${intro.photos.length ? introJs(intro) : ""}</script>
</body>
</html>`;
}

export const WORDMARK_GROW: ArtTemplate = {
  id: "wordmark-grow",
  label: "Névből növő — csendes kártyák, szavankénti felfedés (referencia: The Bend Club)", // i18n-exempt: operator-facing (console template picker)
  skins: ["coastal-fresh", "sand-cream-airy", "clay-soft", "editorial-warm"],
  render: renderWordmark,
};
