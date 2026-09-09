// "arch-frames" art template (ADR-0027 + ADR-0115) — the palazzosogni.com
// reference direction the owner brought in as a quality bar.
//
// The signature moves, measured on the reference:
//   • ARCH-TOPPED photo frames (the palazzo window) — the strongest signature;
//   • three type registers: spaced small-caps lead / large italic display title /
//     classic serif body, with a great deal of air;
//   • a soft watercolour blot under each section title (generated from the accent
//     token, not an asset — so it dresses with the skin);
//   • faint botanical line art in the margins;
//   • strict symmetry, centred headings.
//
// WHY THIS ONE MATTERS FOR US: the photo is FRAMED and mid-sized instead of
// full-bleed, with a lot of quiet around it. Measured on real leads, ~85% arrive
// with ordinary portal photography; this composition flatters exactly those,
// where a full-screen hero would expose them.
//
// Motion (ADR-0115): the arch opens upward like a curtain — the clip-path rides
// the inner <img>, never the observed box (rule 4).

import { starIcon } from "../icons.js";
import { introCss, introHtml, introJs, mo, motionCss, motionJs, parallax } from "../motion.js";
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
  heroPhoto,
  photoFill,
  roomsForMock,
  T,
  type ArtTemplate,
} from "../templateKit.js";

/** A drawn sprig — inline SVG, never an emoji (§B.4). Dresses from currentColor. */
const SPRIG = `<svg viewBox="0 0 60 160" width="56" height="150" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
<path d="M30 158V54"/><path d="M30 54c-9-6-13-16-11-27 9 3 14 12 11 27Z"/>
<path d="M30 54c9-6 13-16 11-27-9 3-14 12-11 27Z"/><path d="M30 30c-6-5-8-13-6-21 6 3 9 11 6 21Z"/>
<path d="M30 30c6-5 8-13 6-21-6 3-9 11-6 21Z"/><path d="M30 96c-8 2-14-2-18-9 8-3 15 0 18 9Z"/>
<path d="M30 118c8 2 14-2 18-9-8-3-15 0-18 9Z"/></svg>`;

const ARCH_CSS = `
/* shared module sections dressed to this template's rhythm (ADR-0057) */
:root{
  --cit-modsec-py:112px;
  --cit-modsec-maxw:1080px;
  --cit-modsec-px:24px;
  --cit-modsec-divider:0;
  --cit-modsec-head-align:center;
  --cit-modsec-head-mb:46px;
  --cit-modsec-head-size:clamp(24px,4vw,40px);
  --cit-modsec-head-weight:400;
  --cit-modsec-card-radius:0px;
  --cit-modsec-card-pad:28px;
  --cit-modsec-card-bg:var(--cit-surface);
  --cit-modsec-card-border:1px solid var(--cit-line)}
/* the palazzo idiom reaches the shared modules too: arch-topped cards and
   small-caps labels, so the middle of the page still reads as THIS template */
/* ── module LAYOUT: one narrow centred procession (owner's call) ──
   Where the editorial template runs two wide columns, the palazzo keeps a single
   780px column, arch-topped cards and centred text — the same markup, a wholly
   different rhythm. */
.cit-tpl-arch-frames .cit-modsec__in{max-width:780px}
.cit-tpl-arch-frames .cit-modsec__grid{grid-template-columns:1fr;gap:14px}
.cit-tpl-arch-frames .cit-modsec__item{
  border-radius:44% 44% 0 0/58px 58px 0 0;padding-top:34px;
  flex-direction:column;align-items:center;text-align:center;gap:8px}
.cit-tpl-arch-frames .cit-modsec__facts{grid-template-columns:repeat(2,1fr);gap:14px}
.cit-tpl-arch-frames .cit-modsec__fact{
  border-radius:44% 44% 0 0/48px 48px 0 0;padding-top:30px;text-align:center}
.cit-tpl-arch-frames .cit-modsec h2{font-style:italic}
.cit-tpl-arch-frames .cit-modsec__note{font-variant:small-caps;letter-spacing:.08em}
.cit-tpl-arch-frames .cit-modsec table{margin-inline:auto}
@media(max-width:700px){.cit-tpl-arch-frames .cit-modsec__facts{grid-template-columns:1fr}}
*{box-sizing:border-box}
body{margin:0;background:var(--cit-bg);color:var(--cit-ink);font-family:var(--cit-font-body);
  font-size:16.5px;line-height:1.75}
img{display:block;max-width:100%}
a{color:inherit}
.a-wrap{width:min(1080px,86vw);margin-inline:auto}
h1,h2,h3{font-family:var(--cit-font-display);font-weight:400;margin:0}
section{padding:clamp(66px,9vh,110px) 0;position:relative}
.a-kick{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--cit-muted)}
.a-lead{font-variant:small-caps;letter-spacing:.1em;font-size:clamp(15px,1.9vw,18px);line-height:1.7}
.a-body p{margin:0 0 1.1em;text-align:justify;hyphens:auto;
  color:color-mix(in srgb,var(--cit-ink) 88%,transparent)}


/* ── own header (approved draft): links | centred brand | phone + pill ── */
.a-nav{position:sticky;top:0;z-index:50;display:grid;grid-template-columns:1fr auto 1fr;
  align-items:center;gap:14px;padding:13px 24px;
  background:color-mix(in srgb,var(--cit-bg) 90%,transparent);backdrop-filter:blur(8px)}
.a-nav a{color:var(--cit-ink);text-decoration:none;font-size:12px;font-variant:small-caps;
  letter-spacing:.16em}
.a-nav .a-links,.a-nav .a-right{display:none;gap:22px;align-items:center}
@media(min-width:880px){.a-nav .a-links,.a-nav .a-right{display:flex}}
.a-nav .a-right{justify-content:flex-end}
.a-nav .a-brand{text-align:center;font-variant:small-caps;letter-spacing:.2em;font-size:15px;
  white-space:nowrap}
.a-nav .a-brand small{display:block;font-size:8.5px;letter-spacing:.42em;color:var(--cit-muted);
  margin-top:2px}
.a-pill{background:var(--cit-accent);color:var(--cit-on-accent);font-size:11.5px;
  font-variant:small-caps;letter-spacing:.18em;padding:9px 22px;border-radius:999px;
  text-decoration:none;display:inline-block}

/* ── the opening, as in the APPROVED draft: a full-bleed photo carrying NO title
   (the name lives in the header), then the cream page starts with the script
   title over its watercolour blot. */
.a-hero{position:relative;height:82vh;min-height:460px;overflow:hidden}
.a-hero img{width:100%;height:116%;object-fit:cover;position:absolute;inset:-8% 0}
.a-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,
  color-mix(in srgb,#000 24%,transparent),transparent 30%,
  color-mix(in srgb,#000 62%,transparent) 78%,color-mix(in srgb,var(--cit-bg) 82%,transparent))}
.a-hero-copy{position:absolute;left:0;right:0;bottom:16%;z-index:3;text-align:center;padding:0 24px;
  color:#fff;text-shadow:0 2px 26px rgba(0,0,0,.55)}
.a-hero-kick{font-size:10.5px;letter-spacing:.42em;text-transform:uppercase;
  color:rgba(255,255,255,.9);margin-bottom:12px}
.a-hero-name{font-family:var(--cit-font-display);font-style:italic;
  font-size:clamp(30px,6.2vw,66px);line-height:1.04}
.a-hero-line{font-family:var(--cit-font-display);font-size:clamp(16px,2.2vw,24px);
  line-height:1.34;max-width:26ch;margin:.5em auto 0;color:rgba(255,255,255,.94)}
.a-scroll{position:absolute;bottom:18px;left:0;right:0;z-index:3;text-align:center;font-size:10px;
  letter-spacing:.34em;text-transform:uppercase;color:color-mix(in srgb,var(--cit-ink) 62%,transparent)}

/* THE SIGNATURE: the arch */
.a-arch{position:relative;overflow:hidden;
  border-radius:50vw 50vw var(--cit-radius) var(--cit-radius)/32vh 32vh var(--cit-radius) var(--cit-radius);
  box-shadow:0 30px 70px -40px color-mix(in srgb,var(--cit-ink) 70%,transparent)}
.a-arch img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.a-arch::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  border:1px solid color-mix(in srgb,var(--cit-line) 90%,transparent)}
.a-frame{position:relative;aspect-ratio:3/4}

/* section title with the watercolour blot (generated from the accent token) */
.a-title{position:relative;display:grid;place-items:center;margin-bottom:36px}
.a-title::before{content:"";position:absolute;width:min(340px,52vw);height:74px;
  background:radial-gradient(60% 60% at 42% 46%,color-mix(in srgb,var(--cit-accent) 26%,transparent),transparent 70%),
             radial-gradient(52% 68% at 66% 58%,color-mix(in srgb,var(--cit-accent) 18%,transparent),transparent 72%);
  filter:blur(8px);border-radius:48% 52% 60% 40%/56% 44% 56% 44%;transform:translateY(14px) rotate(-2deg)}
.a-title h1,.a-title h2{position:relative;z-index:2;font-style:italic;font-weight:400;font-size:clamp(30px,6.4vw,64px);
  line-height:1.05;letter-spacing:.01em;text-align:center}

/* two-column story */
.a-story{display:grid;grid-template-columns:.92fr 1fr;gap:min(64px,7vw);align-items:center}
.a-story.rev{grid-template-columns:1fr .92fr}
.a-story.rev .a-fig{order:2}
@media(max-width:820px){.a-story,.a-story.rev{grid-template-columns:1fr;gap:30px}
  .a-story.rev .a-fig{order:0}}

/* room trio */
.a-trio{display:grid;grid-template-columns:repeat(3,1fr);gap:min(34px,4vw);margin-top:50px}
.a-trio figure{margin:0}
.a-trio figcaption{text-align:center;padding-top:14px;font-variant:small-caps;letter-spacing:.14em;
  font-size:13px;color:var(--cit-muted)}
.a-trio .a-note{display:block;font-size:12px;opacity:.8;letter-spacing:0;font-variant:normal}
@media(max-width:820px){.a-trio{grid-template-columns:1fr;gap:34px}}

/* facts strip */
.a-facts{display:flex;justify-content:center;flex-wrap:wrap;margin-top:52px;
  border-top:1px solid var(--cit-line);border-bottom:1px solid var(--cit-line)}
.a-facts div{padding:22px min(46px,5vw);text-align:center;border-right:1px solid var(--cit-line)}
.a-facts div:last-child{border-right:0}
.a-facts b{display:block;font-family:var(--cit-font-display);font-size:32px;font-weight:400;line-height:1.1}
.a-facts span{font-size:10.5px;letter-spacing:.2em;font-variant:small-caps;color:var(--cit-muted)}

/* amenity list */
.a-amen{columns:2;column-gap:min(60px,6vw);margin-top:26px;padding:0;list-style:none}
.a-amen li{break-inside:avoid;padding:7px 0 7px 20px;position:relative;font-size:15px}
.a-amen li::before{content:"";position:absolute;left:0;top:16px;width:8px;height:1px;background:var(--cit-accent)}
@media(max-width:700px){.a-amen{columns:1}}

/* wide band */
.a-band{position:relative;height:70vh;min-height:380px;overflow:hidden}
.a-band img{width:100%;height:120%;object-fit:cover;position:absolute;inset:-10% 0}

/* quotes + rating */
.a-rev{text-align:center}
.a-rev .a-score{font-family:var(--cit-font-display);font-size:58px;line-height:1}
.a-rev .a-of{color:var(--cit-muted);font-size:20px}
.a-stars{color:var(--cit-accent);display:inline-flex;gap:2px}
.a-rev small{display:block;color:var(--cit-muted);font-size:12.5px;margin-top:10px;
  font-variant:small-caps;letter-spacing:.12em}
.a-quotes{display:grid;gap:38px;margin-top:48px}
.a-quotes figure{margin:0}
.a-quotes blockquote{margin:0;font-family:var(--cit-font-display);font-style:italic;
  font-size:clamp(18px,2.4vw,26px);line-height:1.5;max-width:34ch;margin-inline:auto}
.a-quotes figcaption{margin-top:12px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--cit-muted)}

/* botanical margins */
.a-sprig{position:absolute;color:color-mix(in srgb,var(--cit-accent) 42%,transparent);
  pointer-events:none;z-index:0}
.a-sprig.l{left:2vw;bottom:6%}
.a-sprig.r{right:3vw;top:8%;transform:scaleX(-1) rotate(8deg)}
@media(max-width:900px){.a-sprig{display:none}}

/* footer */
.a-foot{background:var(--cit-surface);padding:62px 0 26px;font-size:14px;
  border-top:1px solid var(--cit-line)}
.a-fgrid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:34px}
@media(max-width:820px){.a-fgrid{grid-template-columns:1fr;gap:24px}}
.a-foot .a-brand{font-variant:small-caps;letter-spacing:.2em;font-size:20px}
.a-legal{border-top:1px solid var(--cit-line);margin-top:34px;padding-top:16px;display:flex;
  flex-wrap:wrap;gap:18px;font-size:12px;color:var(--cit-muted)}
`;

function renderArch(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["sand-cream-airy"] ?? Object.values(SKINS)[0]!;
  const photos = data.photos;
  const hero = heroPhoto(data, 1);
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

  const framed = (p: { url: string; alt: string } | undefined, alt: string, delay = 0) =>
    `<div class="a-frame a-arch" ${mo("arch", delay)}>${
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
  const nav = `<nav class="a-nav">
    <span class="a-links">
      <a href="#cit-about">${T(data, "A ház")}</a>
      <a href="#cit-rooms">${T(data, "Szobák")}</a>
      <a href="#cit-contact">${T(data, "Kapcsolat")}</a>
    </span>
    <span class="a-brand">${esc(data.name)}${place ? `<small>${esc(place)}</small>` : ""}</span>
    <span class="a-right">
      ${c0.phone ? `<a href="tel:${esc(c0.phone.replace(/\s+/g, ""))}">${esc(c0.phone)}</a>` : ""}
      <a class="a-pill" href="#cit-enquiry">${T(data, "Foglalás")}</a>
    </span>
  </nav>`;

  const heroBlock = `${nav}
  <header class="a-hero">
    ${hero ? `<img ${parallax(0.7)} data-cit-hero-img src="${esc(hero.url)}" alt="${esc(hero.alt)}">` : photoFill(data.name)}
    <div class="a-hero-copy" data-cit-hero-copy>
      ${place ? `<div class="a-hero-kick" ${mo("in", 100)}>${esc(place)}</div>` : ""}
      <div class="a-hero-name" ${mo("up", 200)}>${esc(data.name)}</div>
      ${heroCopy.lead ? `<div class="a-hero-line" ${mo("up", 320)}>${accented(heroCopy.lead, heroCopy.accent)}</div>` : ""}
    </div>
    <div class="a-scroll">${T(data, "görgessen")}</div>
  </header>`;

  const about = `<section id="cit-about">
    <div class="a-sprig r">${SPRIG}</div>
    <div class="a-wrap">
      <div class="a-title"><h1 ${mo("up")}>${esc(heroCopy.lead ?? T(data, "Üdvözöljük"))}</h1></div>
      <div class="a-story">
        <div class="a-fig">${framed(photos[1] ?? hero, data.name)}</div>
        <div class="a-body" ${mo("up", 90)}>
          <p class="a-lead">${accented(lede, heroCopy.accent)}</p>
          ${rest ? `<p>${esc(rest)}</p>` : ""}
        </div>
      </div>
      ${
        facts.length
          ? `<div class="a-facts" ${mo("rise", 140)}>${facts
              .map((f) => `<div><b>${esc(f.n)}</b><span>${esc(f.l)}</span></div>`)
              .join("")}</div>`
          : ""
      }
    </div>
  </section>`;

  const roomsBlock = `<section id="cit-rooms" data-cit-module="rooms" style="padding-top:0">
    <div class="a-wrap">
      <div class="a-title"><h2 ${mo("up")}>${esc(roomsCopy.title ?? T(data, "Szobák"))}</h2></div>
      <div class="a-trio">
        ${rooms
          .slice(0, 3)
          .map(
            (r, i) => `<figure>${framed(r.photo, r.name, i * 170)}
          <figcaption>${esc(r.name)}${
            r.capacity ? `<span class="a-note">${esc(r.capacity)}</span>` : ""
          }</figcaption></figure>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;

  const highlights = data.highlights.slice(0, 10);
  const feature = `<section data-cit-module="gallery" style="padding-top:0">
    <div class="a-sprig l">${SPRIG}</div>
    <div class="a-wrap">
      <div class="a-title"><h2 ${mo("up")}>${esc(featCopy.title ?? T(data, "A ház"))}</h2></div>
      <div class="a-story rev">
        <div class="a-body" ${mo("up", 90)}>
          <p class="a-lead">${esc(featCopy.eyebrow ?? data.tagline)}</p>
          ${
            highlights.length
              ? `<ul class="a-amen">${highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`
              : ""
          }
        </div>
        <div class="a-fig">${framed(photos[2] ?? photos[0], data.name, 120)}</div>
      </div>
    </div>
  </section>`;

  const bandPhoto = photos[3] ?? photos[1] ?? photos[0];
  const band = bandPhoto
    ? `<div class="a-band"><img ${parallax(1)} src="${esc(bandPhoto.url)}" alt="${esc(
        bandPhoto.alt,
      )}" loading="lazy"></div>`
    : "";

  // Real guest quotes only — a sample review must never reach a page (§B.17).
  const quotes = (data.reviews ?? []).slice(0, 3);
  const quoteBlock = quotes.length
    ? `<div class="a-quotes">${quotes
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
      ? `<section class="a-rev">
      <div class="a-wrap">
        <div class="a-title"><h2 ${mo("up")}>${esc(galCopy.title ?? T(data, "Vendégeink"))}</h2></div>
        ${
          rating
            ? `<div class="a-stars" ${mo("in")} aria-hidden="true">${starIcon().repeat(5)}</div>
        <div class="a-score" ${mo("up", 90)}>${esc(
          String(rating.value).replace(".", ","),
        )}<span class="a-of"> / 10</span></div>
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
      </div>
    </section>`
      : "";

  const c = data.contact;
  const footer = `<footer class="a-foot" id="cit-contact">
    <div class="a-wrap">
      <div class="a-fgrid">
        <div>
          <div class="a-brand">${esc(data.name)}</div>
          <p style="color:var(--cit-muted);max-width:34ch">${esc(data.tagline)}</p>
        </div>
        ${c.address ? `<div><div class="a-lead" style="color:var(--cit-muted)">${T(data, "Cím")}</div><p>${esc(c.address)}</p></div>` : ""}
        <div><div class="a-lead" style="color:var(--cit-muted)">${T(data, "Kapcsolat")}</div>
          ${c.phone ? `<p><a href="tel:${esc(c.phone.replace(/\s+/g, ""))}">${esc(c.phone)}</a></p>` : ""}
          ${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ""}
        </div>
      </div>
      <div class="a-legal">
        <a href="/adatvedelem">${T(data, "Adatvédelmi tájékoztató")}</a>
        <a href="/impresszum">${T(data, "Impresszum")}</a>
        <span>© ${esc(data.name)}</span>
      </div>
    </div>
  </footer>`;

  const intro = {
    name: esc(data.name),
    place: esc(place || data.tagline),
    // the cycle ENDS on this template's own hero photo — the intro hands its last
    // frame to the hero, so the page must not snap to a different picture
    photos: [
      ...photos.filter((p) => p.url !== hero?.url).slice(0, 3).map((p) => p.url),
      ...(hero ? [hero.url] : []),
    ],
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

${ARCH_CSS}
${centredModsecCss("arch-frames")}
${motionCss("calm")}
${intro.photos.length ? introCss() : ""}
  </style>
</head>
<body class="cit-tpl-arch-frames">
  ${heroBlock}
  ${about}
  ${roomsBlock}
  ${slotMarker("showcase")}
  ${feature}
  ${band}
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

export const ARCH_FRAMES: ArtTemplate = {
  id: "arch-frames",
  label: "Boltíves keretek — palazzo-ritmus, akvarell címek (referencia: Palazzo Sogni)", // i18n-exempt: operator-facing (console template picker)
  // ⛔ NO "watercolor-lake" here: its cool blue + 22px radius fights the palazzo
  // rhythm (the arch's own corners round off), and the owner read the result as
  // "an akvarell template" — the skin rail must not contradict the template.
  skins: ["sand-cream-airy", "editorial-warm", "stone-masonry", "editorial-magazine"],
  render: renderArch,
};
