// Tenant admin views (ADR-0023) — styled with the design core (citui.css).
// Server-rendered HTML; Post/Redirect/Get for mutations. No framework (node:http).

import type { TenantSession } from "../auth/tenantAuth.js";
import type { PhotoEdit, TenantContentEdits } from "../tenant/editor.js";

type AdminContent =
  | (TenantContentEdits & {
      photos: PhotoEdit[];
      usingOwnPhotos: boolean;
      status: string;
      previewPath: string | null;
    })
  | null;

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function shell(title: string, body: string): string {
  return (
    `<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">` +
    `<link rel="stylesheet" href="/assets/ui/citui.css"><title>${esc(title)}</title></head>` +
    `<body style="background:var(--citui-surface)">${body}</body></html>`
  );
}

const LOGO =
  `<a class="citui-brand citui-brand--ink" href="/" style="justify-content:center">` +
  `<svg class="citui-brand__mark" viewBox="0 0 48 48" aria-hidden="true">` +
  `<path d="M34.5 10.5A17 17 0 1 0 34.5 37.5" fill="none" stroke="#1fb6d6" stroke-width="6" stroke-linecap="round"/>` +
  `<circle cx="22.5" cy="24" r="4.5" fill="#16283f"/><path d="M34 18.5 42 24l-8 5.5z" fill="#1fb6d6"/></svg>` +
  `<span>Citoviso</span></a>`;

/** Photos card — current gallery (with remove when own) + upload. */
function photosCard(content: NonNullable<AdminContent>): string {
  const photos = content.photos ?? [];
  const notice = content.usingOwnPhotos
    ? `<p class="citui-hint">A saját fotóid láthatók az oldaladon.</p>`
    : `<p class="citui-hint" style="color:var(--citui-warn)">Jelenleg bemutató (demó) képek láthatók. Tölts fel saját fotókat — az élesítéshez a saját, jogtiszta képeid szükségesek.</p>`;
  const items = photos
    .map(
      (p) =>
        `<figure style="position:relative;margin:0">` +
        `<img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy" style="width:100%;height:92px;object-fit:cover;border-radius:8px;border:1px solid var(--citui-line)">` +
        (content.usingOwnPhotos
          ? `<form method="POST" action="/admin/foto/torol" style="position:absolute;top:4px;right:4px;margin:0">` +
            `<input type="hidden" name="url" value="${esc(p.url)}">` +
            `<button title="Törlés" style="background:rgba(14,42,71,.75);color:#fff;border-radius:50%;width:24px;height:24px;line-height:1;padding:0;cursor:pointer">×</button></form>`
          : "") +
        `</figure>`,
    )
    .join("");
  const grid = photos.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:12px">${items}</div>`
    : `<p class="citui-hint">Még nincs kép.</p>`;
  return (
    `<div class="citui-card" style="margin-top:20px"><h2 style="font-size:1.2rem">Fotók</h2>${notice}${grid}` +
    `<div class="citui-field" style="margin-top:14px"><input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp" multiple></div>` +
    `<button class="citui-btn citui-btn--primary" id="photo-upload" type="button">Kiválasztott fotók feltöltése</button>` +
    `<p class="citui-hint" id="photo-note"></p></div>`
  );
}

const UPLOAD_SCRIPT =
  `<script>(function(){` +
  `var inp=document.getElementById('photo-input'),btn=document.getElementById('photo-upload'),note=document.getElementById('photo-note');` +
  `if(!inp||!btn)return;` +
  `function read(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=rej;r.readAsDataURL(f)})}` +
  `btn.addEventListener('click',async function(){var files=[].slice.call(inp.files||[]);` +
  `if(!files.length){note.textContent='Válassz ki képeket.';return;}` +
  `btn.disabled=true;note.textContent='Feltöltés…';` +
  `try{var images=[];for(var i=0;i<files.length;i++){if(files[i].size>6000000){continue;}var d=await read(files[i]);images.push({dataUrl:d,alt:''});}` +
  `if(!images.length){note.textContent='A képek túl nagyok (max 6 MB).';btn.disabled=false;return;}` +
  `var r=await fetch('/admin/foto',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:images})});` +
  `var j=await r.json();if(j&&j.ok){location.href='/admin?saved=1';}else{note.textContent='Hiba a feltöltéskor.';btn.disabled=false;}}` +
  `catch(e){note.textContent='Hiba a feltöltéskor.';btn.disabled=false;}});})();</script>`;

/** Login page — enter username + password. */
export function loginPage(msg?: { text: string; kind: "info" | "bad" }): string {
  const note = msg
    ? `<p class="citui-hint" style="text-align:center;color:${msg.kind === "bad" ? "var(--citui-bad)" : "var(--citui-ok)"}">${esc(msg.text)}</p>`
    : "";
  return shell(
    "Bejelentkezés",
    `<div class="citui-container" style="max-width:420px;padding:64px 0">` +
      `<div style="text-align:center;margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card">` +
      `<h1 style="font-size:1.5rem;text-align:center">Bejelentkezés</h1>` +
      `<p class="citui-hint" style="text-align:center;margin-bottom:18px">Add meg a felhasználóneved és a kapott jelszót.</p>` +
      `<form method="POST" action="/belepes">` +
      `<div class="citui-field"><label class="citui-label" for="username">Felhasználónév</label>` +
      `<input class="citui-input" id="username" name="username" required autocapitalize="none" autocorrect="off" placeholder="pl. napfeny-panzio"></div>` +
      `<div class="citui-field"><label class="citui-label" for="password">Jelszó</label>` +
      `<input class="citui-input" id="password" name="password" type="password" required placeholder="a kapott jelszó"></div>` +
      `<button class="citui-btn citui-btn--primary" type="submit" style="width:100%">Belépés</button>` +
      `</form>${note}` +
      `<p class="citui-hint" style="text-align:center;margin-top:16px"><a href="/">Vissza a főoldalra</a></p>` +
      `</div></div>`,
  );
}

/** After requesting a link. */
export function linkSentPage(): string {
  return shell(
    "Link elküldve",
    `<div class="citui-container" style="max-width:420px;padding:64px 0;text-align:center">` +
      `<div style="margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card"><h1 style="font-size:1.4rem">Elküldtük a belépő linket</h1>` +
      `<p class="citui-hint">Ha van fiók ezzel az e-mail-címmel, perceken belül megérkezik a belépő link. ` +
      `A link 30 percig érvényes.</p></div></div>`,
  );
}

export function verifyErrorPage(): string {
  return shell(
    "Érvénytelen link",
    `<div class="citui-container" style="max-width:420px;padding:64px 0;text-align:center">` +
      `<div class="citui-card"><h1 style="font-size:1.4rem">A link érvénytelen vagy lejárt</h1>` +
      `<p class="citui-hint">Kérj egy új belépő linket.</p>` +
      `<p><a class="citui-btn citui-btn--primary" href="/belepes">Új link kérése</a></p></div></div>`,
  );
}

/** The tenant admin dashboard with the A1 text editor. */
export function adminDashboard(
  session: TenantSession,
  content: AdminContent,
  saved: boolean,
  previewToken?: string | null,
): string {
  const statusLabel: Record<string, string> = {
    provisioned: "Előnézet (még nem publikus)",
    live: "Élő (publikus)",
    draft: "Vázlat",
    suspended: "Felfüggesztve",
    deactivated: "Deaktiválva",
  };
  const header =
    `<header style="background:var(--citui-navy-900)"><div class="citui-container citui-nav">` +
    `${LOGO.replace("citui-brand--ink", "").replace('fill="#16283f"', 'fill="#fff"')}` +
    `<div class="citui-nav-actions"><span style="color:rgba(255,255,255,.7);font-size:.9rem">${esc(session.username)}</span>` +
    `<a class="citui-btn citui-btn--secondary citui-btn--sm" href="/kilepes">Kilépés</a></div></div></header>`;

  if (!content) {
    return shell(
      "Admin",
      header +
        `<div class="citui-container" style="padding:48px 0"><div class="citui-card">` +
        `<h1>Üdv, ${esc(session.displayName)}!</h1>` +
        `<p class="citui-hint">Ehhez a fiókhoz még nincs szerkeszthető oldal. Amint elkészül az oldalad, itt tudod majd szerkeszteni.</p>` +
        `</div></div>`,
    );
  }

  const savedNote = saved
    ? `<p class="citui-pill citui-pill--ok" style="margin-bottom:16px">Mentve — az oldalad frissült.</p>`
    : "";
  const preview = previewToken
    ? `<a class="citui-btn citui-btn--ghost citui-btn--sm" href="/site/${esc(previewToken)}" target="_blank" rel="noopener">Oldal megtekintése</a>`
    : "";
  const highlights = (content.highlights ?? []).join("\n");

  return shell(
    "Admin",
    header +
      `<div class="citui-container" style="padding:40px 0;max-width:760px">` +
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:8px">` +
      `<h1 style="margin:0">${esc(session.displayName)}</h1>` +
      `<span class="citui-pill ${content.status === "live" ? "citui-pill--ok" : "citui-pill--info"}">${esc(statusLabel[content.status] ?? content.status)}</span></div>` +
      `<p class="citui-hint" style="margin-bottom:24px">Itt szerkesztheted az oldalad szövegeit. ${preview}</p>` +
      savedNote +
      `<form method="POST" action="/admin/szoveg" class="citui-card">` +
      `<h2 style="font-size:1.2rem">Szövegek</h2>` +
      `<div class="citui-field"><label class="citui-label" for="name">Vállalkozás neve</label>` +
      `<input class="citui-input" id="name" name="name" value="${esc(content.name)}"></div>` +
      `<div class="citui-field"><label class="citui-label" for="tagline">Szlogen (rövid mondat a fejlécben)</label>` +
      `<input class="citui-input" id="tagline" name="tagline" value="${esc(content.tagline)}"></div>` +
      `<div class="citui-field"><label class="citui-label" for="intro">Bemutatkozó szöveg</label>` +
      `<textarea class="citui-textarea" id="intro" name="intro" style="min-height:120px">${esc(content.intro)}</textarea></div>` +
      `<div class="citui-field"><label class="citui-label" for="highlights">Kiemelések (soronként egy)</label>` +
      `<textarea class="citui-textarea" id="highlights" name="highlights" style="min-height:100px">${esc(highlights)}</textarea></div>` +
      `<button class="citui-btn citui-btn--primary" type="submit">Mentés és frissítés</button>` +
      `</form>` +
      `<div class="citui-card" style="margin-top:20px">` +
      `<h2 style="font-size:1.2rem">Fiók</h2>` +
      `<div class="citui-field"><label class="citui-label">Felhasználónév (belépéshez)</label>` +
      `<input class="citui-input" value="${esc(session.username)}" readonly style="background:var(--citui-surface-2)"></div>` +
      `<form method="POST" action="/admin/kapcsolat">` +
      `<div class="citui-field"><label class="citui-label" for="contact_email">Kommunikációs e-mail (ide küldünk értesítést)</label>` +
      `<input class="citui-input" id="contact_email" name="contact_email" type="email" value="${esc(session.contactEmail)}" required></div>` +
      `<button class="citui-btn citui-btn--ghost" type="submit">E-mail mentése</button>` +
      `</form></div>` +
      photosCard(content) +
      `</div>` +
      UPLOAD_SCRIPT,
  );
}
