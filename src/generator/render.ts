// The generator's core: one Property-like data object → a full, standalone,
// responsive HTML mock. Design rules (fixed): NO emoji (custom inline SVG line
// icons), a clean palette, one genuinely regional "mag". Palette-from-photo and
// AI copy are later slices; this proves the render pipeline + design quality.

export interface MockFeature {
  icon: "location" | "wifi" | "parking" | "coffee" | "view" | "key";
  label: string;
}

export interface MockData {
  name: string;
  region: string;
  regionTagline: string;
  heroImage: string;
  photos: string[];
  intro: string;
  features: MockFeature[];
  phone?: string;
  email?: string;
  address?: string;
  mapUrl?: string;
}

// Inline line icons (stroke = currentColor). No emoji, per the design rule.
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

export function render(d: MockData): string {
  const gallery = d.photos
    .map(
      (src) =>
        `<figure class="shot"><img loading="lazy" src="${esc(src)}" alt="${esc(d.name)}"></figure>`,
    )
    .join("\n");

  const features = d.features
    .map(
      (f) =>
        `<li class="feature"><span class="ico">${icon(f.icon)}</span><span>${esc(f.label)}</span></li>`,
    )
    .join("\n");

  const contactRows = [
    d.phone &&
      `<a class="contact-row" href="tel:${esc(d.phone.replace(/\s/g, ""))}"><span class="ico">${icon("key")}</span>${esc(d.phone)}</a>`,
    d.email &&
      `<a class="contact-row" href="mailto:${esc(d.email)}"><span class="ico">${icon("coffee")}</span>${esc(d.email)}</a>`,
    d.address &&
      `<div class="contact-row"><span class="ico">${icon("location")}</span>${esc(d.address)}</div>`,
  ]
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.name)} — ${esc(d.region)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#211d1a; --muted:#6b625b; --line:#e7e0d8;
    --cream:#faf6f0; --cream2:#f2ebe1; --wine:#7c2d3a; --wine-2:#98414f; --gold:#b98a3e;
    --radius:16px; --wrap:1120px;
  }
  *{box-sizing:border-box;margin:0}
  html{scroll-behavior:smooth}
  body{font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--cream);line-height:1.6}
  h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:600;line-height:1.1;letter-spacing:-.01em}
  img{display:block;width:100%;height:100%;object-fit:cover}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:var(--wrap);margin:0 auto;padding:0 24px}
  .btn{display:inline-block;background:var(--wine);color:#fff;padding:14px 26px;border-radius:100px;font-weight:600;font-size:.98rem;transition:transform .15s,background .15s}
  .btn:hover{background:var(--wine-2);transform:translateY(-1px)}

  header.nav{position:sticky;top:0;z-index:10;background:rgba(250,246,240,.85);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .nav .wrap{display:flex;align-items:center;justify-content:space-between;height:66px}
  .brand{font-family:Fraunces,serif;font-size:1.3rem;font-weight:600}
  .brand small{display:block;font-family:Inter;font-size:.72rem;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}

  .hero{position:relative;min-height:78vh;display:flex;align-items:flex-end;color:#fff}
  .hero img{position:absolute;inset:0;z-index:-2}
  .hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,14,12,.15) 0%,rgba(20,14,12,.72) 100%)}
  .hero .wrap{padding-bottom:64px;padding-top:120px}
  .eyebrow{font-size:.82rem;letter-spacing:.2em;text-transform:uppercase;color:#f0d9b0;font-weight:600;margin-bottom:14px}
  .hero h1{font-size:clamp(2.6rem,6vw,4.6rem);max-width:14ch;text-shadow:0 2px 30px rgba(0,0,0,.3)}
  .hero p{margin:18px 0 28px;font-size:1.15rem;max-width:46ch;color:#f4ede2}

  section{padding:84px 0}
  .lead-in{max-width:60ch}
  .lead-in .eyebrow{color:var(--gold)}
  .lead-in h2{font-size:clamp(1.9rem,3.6vw,2.7rem);margin:10px 0 20px}
  .lead-in p{font-size:1.12rem;color:var(--muted)}

  .gallery{background:var(--cream2)}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:34px}
  .shot{aspect-ratio:4/3;border-radius:var(--radius);overflow:hidden;background:#ddd}
  .shot:first-child{grid-column:span 2;grid-row:span 2}

  .features ul{list-style:none;display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:34px}
  .feature{display:flex;align-items:center;gap:16px;padding:22px 24px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);font-weight:500}
  .ico{display:grid;place-items:center;width:26px;height:26px;color:var(--wine);flex:0 0 26px}
  .ico svg{width:24px;height:24px}

  .contact{background:var(--ink);color:var(--cream)}
  .contact .eyebrow{color:var(--gold)}
  .contact h2{font-size:clamp(1.9rem,3.6vw,2.7rem);margin:10px 0 26px;color:#fff}
  .contact-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:48px;align-items:center}
  .contact-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.12);font-size:1.05rem}
  .contact-row .ico{color:var(--gold)}
  .cta-card{background:var(--wine);border-radius:var(--radius);padding:40px;text-align:center}
  .cta-card h3{color:#fff;font-size:1.6rem;margin-bottom:10px}
  .cta-card p{color:#f0d3d7;margin-bottom:24px}
  .cta-card .btn{background:#fff;color:var(--wine)}

  footer{background:var(--cream2);padding:40px 0;text-align:center;color:var(--muted);font-size:.9rem}
  .demo-badge{display:inline-block;margin-top:10px;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);font-weight:600}

  @media(max-width:820px){
    .grid{grid-template-columns:repeat(2,1fr)}
    .shot:first-child{grid-column:span 2;grid-row:auto}
    .features ul{grid-template-columns:1fr}
    .contact-grid{grid-template-columns:1fr;gap:32px}
  }
</style>
</head>
<body>
<header class="nav"><div class="wrap">
  <div class="brand">${esc(d.name)}<small>${esc(d.region)}</small></div>
  <a class="btn" href="#kapcsolat">Foglalás</a>
</div></header>

<section class="hero" style="padding:0">
  ${d.heroImage ? `<img src="${esc(d.heroImage)}" alt="${esc(d.name)}">` : ""}
  <div class="wrap">
    <div class="eyebrow">${esc(d.region)}</div>
    <h1>${esc(d.name)}</h1>
    <p>${esc(d.regionTagline)}</p>
    <a class="btn" href="#kapcsolat">Érdeklődöm / Foglalok</a>
  </div>
</section>

<section class="lead-in"><div class="wrap">
  <div class="eyebrow">Bemutatkozás</div>
  <h2>Otthonos pihenés, ${esc(d.region)} szívében</h2>
  <p>${esc(d.intro)}</p>
</div></section>

${
  d.photos.length
    ? `<section class="gallery"><div class="wrap">
  <div class="eyebrow" style="color:var(--gold)">Galéria</div>
  <h2 style="font-size:clamp(1.9rem,3.6vw,2.7rem);margin-top:10px">Pillanatképek</h2>
  <div class="grid">
${gallery}
  </div>
</div></section>`
    : ""
}

<section class="features"><div class="wrap">
  <div class="eyebrow" style="color:var(--gold)">Amit kínálunk</div>
  <h2 style="font-size:clamp(1.9rem,3.6vw,2.7rem);margin-top:10px">Szolgáltatások</h2>
  <ul>
${features}
  </ul>
</div></section>

<section class="contact" id="kapcsolat"><div class="wrap">
  <div class="contact-grid">
    <div>
      <div class="eyebrow">Kapcsolat</div>
      <h2>Foglalja le a pihenését</h2>
${contactRows}
      ${d.mapUrl ? `<a class="contact-row" href="${esc(d.mapUrl)}" target="_blank" rel="noopener"><span class="ico">${icon("view")}</span>Megnyitás a térképen</a>` : ""}
    </div>
    <div class="cta-card">
      <h3>Szabad időpontok</h3>
      <p>Nézze meg elérhetőségünket és foglaljon közvetlenül — jutalék nélkül.</p>
      <a class="btn" href="${d.email ? `mailto:${esc(d.email)}` : "#"}">Foglalás indítása</a>
    </div>
  </div>
</div></section>

<footer><div class="wrap">
  ${esc(d.name)} · ${esc(d.region)}<br>
  <span class="demo-badge">Előzetes terv — készült a Citoviso motorral</span>
</div></footer>
</body>
</html>`;
}
