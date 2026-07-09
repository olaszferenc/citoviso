// Parametric renderer (ADR-0005). Same content model as render.ts, but every
// visual decision comes from a Theme (theme.ts): palette, fonts, hero style,
// gallery style, section order. Three hero archetypes × three gallery styles ×
// six palettes × five font pairs × orderings → hundreds of distinct looks.

import type { MockData, MockFeature } from "./render.js";
import type { Theme } from "./theme.js";

const ICONS: Record<MockFeature["icon"], string> = {
  location:
    '<path d="M12 21s-7-6.5-7-11a7 7 0 1 1 14 0c0 4.5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  wifi: '<path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
  parking:
    '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 16V8h3.5a2.5 2.5 0 0 1 0 5H9"/>',
  coffee:
    '<path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16"/><path d="M7 3v2M11 3v2"/>',
  view: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  key: '<circle cx="8" cy="8" r="4"/><path d="M11 11l7 7M16 16l2-2M18 18l2-2"/>',
};

function icon(name: MockFeature["icon"]): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function heroSection(d: MockData, t: Theme): string {
  const eyebrow = `<div class="eyebrow">${esc(d.region)}</div>`;
  const title = `<h1>${esc(d.name)}</h1>`;
  const tagline = `<p>${esc(d.regionTagline)}</p>`;
  const cta = `<a class="btn" href="#kapcsolat">Érdeklődöm / Foglalok</a>`;
  const img = d.heroImage
    ? `<img src="${esc(d.heroImage)}" alt="${esc(d.name)}">`
    : "";

  if (t.heroStyle === "split") {
    return `<section class="hero hero-split">
      <div class="hero-copy"><div class="hero-copy-inner">${eyebrow}${title}${tagline}${cta}</div></div>
      <div class="hero-media">${img}</div>
    </section>`;
  }
  if (t.heroStyle === "banner") {
    return `<section class="hero hero-banner">
      <div class="hero-band">${img}</div>
      <div class="wrap hero-title-block">${eyebrow}${title}${tagline}${cta}</div>
    </section>`;
  }
  // overlay
  return `<section class="hero hero-overlay">${img}
    <div class="wrap">${eyebrow}${title}${tagline}${cta}</div>
  </section>`;
}

function gallerySection(d: MockData, t: Theme): string {
  if (!d.photos.length) return "";
  const shots = d.photos
    .map(
      (src) =>
        `<figure class="shot"><img loading="lazy" src="${esc(src)}" alt="${esc(d.name)}"></figure>`,
    )
    .join("\n");
  return `<section class="gallery"><div class="wrap">
    <div class="eyebrow">Galéria</div>
    <h2>Nézz körül nálunk</h2>
    <div class="grid grid-${t.galleryStyle}">${shots}</div>
  </div></section>`;
}

function introSection(d: MockData): string {
  return `<section class="lead-in"><div class="wrap">
    <div class="eyebrow">Bemutatkozás</div>
    <h2>Otthonos pihenés, ${esc(d.region)} szívében</h2>
    <p>${esc(d.intro)}</p>
  </div></section>`;
}

function featuresSection(d: MockData): string {
  const features = d.features
    .map(
      (f) =>
        `<li class="feature"><span class="ico">${icon(f.icon)}</span><span>${esc(f.label)}</span></li>`,
    )
    .join("\n");
  return `<section class="features"><div class="wrap">
    <div class="eyebrow">Amit kínálunk</div>
    <h2>Minden karnyújtásnyira</h2>
    <ul>${features}</ul>
  </div></section>`;
}

function contactSection(d: MockData): string {
  const rows = [
    d.phone &&
      `<a class="contact-row" href="tel:${esc(d.phone.replace(/\s/g, ""))}"><span class="ico">${icon("key")}</span>${esc(d.phone)}</a>`,
    d.email &&
      `<a class="contact-row" href="mailto:${esc(d.email)}"><span class="ico">${icon("coffee")}</span>${esc(d.email)}</a>`,
    d.address &&
      `<div class="contact-row"><span class="ico">${icon("location")}</span>${esc(d.address)}</div>`,
    d.mapUrl &&
      `<a class="contact-row" href="${esc(d.mapUrl)}" target="_blank" rel="noopener"><span class="ico">${icon("view")}</span>Megnyitás a térképen</a>`,
  ]
    .filter(Boolean)
    .join("\n");
  return `<section class="contact" id="kapcsolat"><div class="wrap">
    <div class="contact-grid">
      <div>
        <div class="eyebrow">Kapcsolat</div>
        <h2>Foglalja le a pihenését</h2>
        ${rows}
      </div>
      <div class="cta-card">
        <h3>Szabad időpontok</h3>
        <p>Nézze meg elérhetőségünket és foglaljon közvetlenül — jutalék nélkül.</p>
        <a class="btn" href="${d.email ? `mailto:${esc(d.email)}` : "#"}">Foglalás indítása</a>
      </div>
    </div>
  </div></section>`;
}

export function renderVaried(d: MockData, t: Theme): string {
  const p = t.palette;
  const middle = t.order
    .map((k) =>
      k === "intro"
        ? introSection(d)
        : k === "gallery"
          ? gallerySection(d, t)
          : featuresSection(d),
    )
    .join("\n");

  return `<!doctype html>
<html lang="hu"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.name)} — ${esc(d.region)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${t.fonts.href}" rel="stylesheet">
<style>
  :root{
    --bg:${p.bg}; --surface:${p.surface}; --surface2:${p.surface2};
    --ink:${p.ink}; --muted:${p.muted}; --line:${p.line};
    --accent:${p.accent}; --accent-dark:${p.accentDark}; --gold:${p.accentSoft}; --on-accent:${p.onAccent};
    --radius:${t.radius}px; --wrap:1120px;
  }
  *{box-sizing:border-box;margin:0}
  html{scroll-behavior:smooth}
  body{font-family:${t.fonts.body},system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6}
  h1,h2,h3{font-family:${t.fonts.heading},Georgia,serif;font-weight:600;line-height:1.08;letter-spacing:-.01em}
  img{display:block;width:100%;height:100%;object-fit:cover}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:var(--wrap);margin:0 auto;padding:0 24px}
  .eyebrow{font-size:.8rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:12px}
  .btn{display:inline-block;background:var(--accent);color:var(--on-accent);padding:14px 26px;border-radius:100px;font-weight:600;font-size:.98rem;transition:transform .15s,background .15s}
  .btn:hover{background:var(--accent-dark);transform:translateY(-1px)}
  section{padding:84px 0}
  h2{font-size:clamp(1.9rem,3.6vw,2.7rem);margin-bottom:18px}

  header.nav{position:sticky;top:0;z-index:10;background:${t.navTransparent ? "transparent" : "color-mix(in srgb, var(--bg) 85%, transparent)"};backdrop-filter:blur(10px);border-bottom:1px solid ${t.navTransparent ? "transparent" : "var(--line)"}}
  .nav .wrap{display:flex;align-items:center;justify-content:space-between;height:66px}
  .brand{font-family:${t.fonts.heading},serif;font-size:1.3rem;font-weight:600${t.navTransparent ? ";color:#fff;text-shadow:0 1px 12px rgba(0,0,0,.4)" : ""}}
  .brand small{display:block;font-family:${t.fonts.body};font-size:.72rem;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}

  /* hero: overlay */
  .hero-overlay{position:relative;min-height:78vh;display:flex;align-items:flex-end;color:#fff;padding:0}
  .hero-overlay img{position:absolute;inset:0;z-index:-2}
  .hero-overlay::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(15,10,8,.12),rgba(15,10,8,.72))}
  .hero-overlay .wrap{padding-bottom:64px;padding-top:120px}
  .hero-overlay .eyebrow{color:#f0d9b0}
  .hero-overlay h1{font-size:clamp(2.6rem,6vw,4.6rem);max-width:14ch;text-shadow:0 2px 30px rgba(0,0,0,.3)}
  .hero-overlay p{margin:18px 0 28px;font-size:1.15rem;max-width:46ch;color:#f4ede2}

  /* hero: split */
  .hero-split{display:grid;grid-template-columns:1fr 1fr;min-height:82vh}
  .hero-split .hero-copy{display:flex;align-items:center;background:var(--surface);padding:48px}
  .hero-copy-inner{max-width:34ch}
  .hero-split h1{font-size:clamp(2.4rem,4.4vw,3.8rem)}
  .hero-split p{margin:18px 0 28px;font-size:1.12rem;color:var(--muted)}
  .hero-split .hero-media{position:relative;min-height:50vh}

  /* hero: banner */
  .hero-banner .hero-band{height:46vh;min-height:340px;position:relative}
  .hero-banner .hero-title-block{padding:56px 24px 8px;max-width:var(--wrap)}
  .hero-banner h1{font-size:clamp(2.8rem,6.5vw,5rem);max-width:16ch}
  .hero-banner p{margin:18px 0 26px;font-size:1.18rem;max-width:52ch;color:var(--muted)}

  .lead-in .wrap{max-width:64ch}
  .lead-in p{font-size:1.14rem;color:var(--muted)}

  .gallery{background:var(--surface2)}
  .grid{margin-top:8px}
  .grid-mosaic{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .grid-mosaic .shot{aspect-ratio:4/3;border-radius:var(--radius);overflow:hidden;background:#ddd}
  .grid-mosaic .shot:first-child{grid-column:span 2;grid-row:span 2}
  .grid-masonry{column-count:3;column-gap:14px}
  .grid-masonry .shot{break-inside:avoid;margin-bottom:14px;border-radius:var(--radius);overflow:hidden;background:#ddd}
  .grid-masonry .shot img{height:auto}
  .grid-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .grid-row .shot{aspect-ratio:3/4;border-radius:var(--radius);overflow:hidden;background:#ddd}

  .features ul{list-style:none;display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:8px}
  .feature{display:flex;align-items:center;gap:16px;padding:22px 24px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);font-weight:500}
  .ico{display:grid;place-items:center;width:26px;height:26px;color:var(--accent);flex:0 0 26px}
  .ico svg{width:24px;height:24px}

  .contact{background:var(--ink);color:var(--bg)}
  .contact h2{color:#fff}
  .contact-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:48px;align-items:center}
  .contact-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.14);font-size:1.05rem}
  .contact-row .ico{color:var(--gold)}
  .cta-card{background:var(--accent);border-radius:var(--radius);padding:40px;text-align:center}
  .cta-card h3{color:var(--on-accent);font-size:1.6rem;margin-bottom:10px}
  .cta-card p{color:color-mix(in srgb, var(--on-accent) 82%, transparent);margin-bottom:24px}
  .cta-card .btn{background:var(--on-accent);color:var(--accent)}

  footer{background:var(--surface2);padding:40px 0;text-align:center;color:var(--muted);font-size:.9rem}
  .demo-badge{display:inline-block;margin-top:10px;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);font-weight:600}

  @media(max-width:820px){
    .hero-split{grid-template-columns:1fr}
    .hero-split .hero-media{min-height:40vh}
    .grid-mosaic{grid-template-columns:repeat(2,1fr)}
    .grid-mosaic .shot:first-child{grid-column:span 2;grid-row:auto}
    .grid-masonry{column-count:2}
    .grid-row{grid-template-columns:repeat(2,1fr)}
    .features ul{grid-template-columns:1fr}
    .contact-grid{grid-template-columns:1fr;gap:32px}
  }
</style></head>
<body>
<header class="nav"><div class="wrap">
  <div class="brand">${esc(d.name)}<small>${esc(d.region)}</small></div>
  <a class="btn" href="#kapcsolat">Foglalás</a>
</div></header>
${heroSection(d, t)}
${middle}
${contactSection(d)}
<footer><div class="wrap">
  ${esc(d.name)} · ${esc(d.region)}<br>
  <span class="demo-badge">Előzetes terv — ${esc(t.palette.name)} · ${t.mood ? esc(t.mood) + " · " : ""}készült a Citoviso motorral</span>
</div></footer>
</body></html>`;
}
