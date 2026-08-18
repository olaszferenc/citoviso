// Tenant admin views (ADR-0023) — styled with the design core (citui.css).
// Server-rendered HTML; Post/Redirect/Get for mutations. No framework (node:http).

import type { TenantSession } from "../auth/tenantAuth.js";
import { GROUP_LABELS, type ModuleGroup } from "../modules.js";
import type { PhotoEdit, TenantContentEdits } from "../tenant/editor.js";
import type { TenantModuleView } from "../tenant/modules.js";

/** Cache-busting asset version: stamped at module load so each deploy serves
 *  fresh CSS through the CDN without a cache purge. */
const ASSET_V = String(Date.now());

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
    `<link rel="stylesheet" href="/assets/ui/citui.css?v=${ASSET_V}"><title>${esc(title)}</title></head>` +
    `<body style="background:var(--citui-surface)">${body}</body></html>`
  );
}

const LOGO =
  `<a class="citui-brand citui-brand--ink" href="/" style="justify-content:center">` +
  `<svg class="citui-brand__mark" viewBox="0 0 48 48" aria-hidden="true">` +
  `<path d="M34.5 10.5A17 17 0 1 0 34.5 37.5" fill="none" stroke="#1fb6d6" stroke-width="6" stroke-linecap="round"/>` +
  `<circle cx="22.5" cy="24" r="4.5" fill="#16283f"/><path d="M34 18.5 42 24l-8 5.5z" fill="#1fb6d6"/></svg>` +
  `<span>Citoviso</span></a>`;

/** Inline SVG icon set (stroke-based, currentColor) — design doctrine: SVG, never emoji. */
const ICON: Readonly<Record<string, string>> = {
  overview: `<path d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z"/>`,
  texts: `<path d="M4 7V5h16v2M9 20h6M12 5v15"/>`,
  photos: `<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 21"/>`,
  modules: `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>`,
  account: `<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>`,
  external: `<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  alert: `<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>`,
};
function ic(name: string, size = 20): string {
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? ""}</svg>`
  );
}

/** Self-contained admin design system (scoped .adm-*), built on the citui tokens. Injected
 *  once per admin page — a real SaaS dashboard shell (sidebar on desktop, bottom tab bar on
 *  mobile), so the paying owner gets a professional, app-like feel. */
const ADM_STYLE = `<style>
  .adm-shell{display:grid;grid-template-columns:248px 1fr;min-height:100vh;background:var(--citui-surface)}
  .adm-side{position:sticky;top:0;align-self:start;height:100vh;display:flex;flex-direction:column;
    background:linear-gradient(180deg,var(--citui-navy-900),#0a1f36);color:#eaf3f8;padding:22px 16px;gap:8px}
  .adm-side__brand{display:flex;align-items:center;gap:10px;padding:6px 8px 18px;font-family:var(--citui-font-display);font-weight:700;font-size:1.15rem}
  .adm-side__brand svg{width:30px;height:30px;flex:0 0 auto}
  .adm-nav{display:flex;flex-direction:column;gap:4px}
  .adm-nav a{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;color:rgba(234,243,248,.72);
    text-decoration:none;font-weight:600;font-size:.95rem;transition:background .15s,color .15s}
  .adm-nav a:hover{background:rgba(255,255,255,.07);color:#fff}
  .adm-nav a.is-active{background:rgba(31,182,214,.16);color:#fff;box-shadow:inset 3px 0 0 var(--citui-cyan-400)}
  .adm-nav a svg{flex:0 0 auto;opacity:.9}
  .adm-side__foot{margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,.12);display:flex;
    align-items:center;justify-content:space-between;gap:8px}
  .adm-side__user{font-size:.85rem;color:rgba(234,243,248,.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .adm-side__out{color:#fff;text-decoration:none;font-size:.85rem;font-weight:600;padding:6px 12px;border:1px solid rgba(255,255,255,.25);border-radius:999px}
  .adm-side__out:hover{background:rgba(255,255,255,.1)}
  .adm-topbar{display:none}
  .adm-main{min-width:0}
  .adm-main__inner{max-width:900px;margin:0 auto;padding:34px 34px 64px}
  .adm-pagehead{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:6px}
  .adm-pagehead h1{margin:0;font-size:1.7rem;font-family:var(--citui-font-display)}
  .adm-sub{color:var(--citui-muted);margin:2px 0 24px;font-size:.98rem}
  .adm-viewbtn{display:inline-flex;align-items:center;gap:7px;background:var(--citui-white);color:var(--citui-navy-900);
    border:1px solid var(--citui-line);border-radius:999px;padding:9px 16px;font-weight:600;font-size:.9rem;text-decoration:none}
  .adm-viewbtn:hover{border-color:var(--citui-cyan-500)}
  .adm-card{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:20px;
    box-shadow:var(--citui-shadow-sm);padding:26px 28px;margin-bottom:20px}
  .adm-card__head{display:flex;align-items:center;gap:11px;margin:0 0 4px}
  .adm-card__head .adm-ico{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;
    background:var(--citui-surface-2);color:var(--citui-cyan-500);flex:0 0 auto}
  .adm-card__head h2{margin:0;font-size:1.2rem;font-family:var(--citui-font-display)}
  .adm-card p.adm-lead{color:var(--citui-muted);margin:0 0 18px;font-size:.95rem}
  .adm-saved{display:inline-flex;align-items:center;gap:8px;background:#e7f8ef;color:var(--citui-ok);
    border:1px solid rgba(47,169,107,.3);border-radius:999px;padding:8px 16px;font-weight:600;font-size:.9rem;margin-bottom:18px}
  .adm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-top:6px}
  .adm-stat{background:var(--citui-surface-2);border:1px solid var(--citui-line);border-radius:14px;padding:16px 18px}
  .adm-stat b{display:block;font-family:var(--citui-font-display);font-size:1.35rem;line-height:1.2;margin-bottom:2px}
  .adm-stat span{color:var(--citui-muted);font-size:.85rem}
  .adm-stat a{color:var(--citui-cyan-500);font-weight:600;text-decoration:none}
  .adm-todo{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:10px}
  .adm-todo li{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid var(--citui-line);border-radius:12px;font-size:.95rem}
  .adm-todo li .adm-tico{flex:0 0 auto;margin-top:1px}
  .adm-todo li.done{color:var(--citui-muted)}
  .adm-todo li.done .adm-tico{color:var(--citui-ok)}
  .adm-todo li.pending .adm-tico{color:var(--citui-warn)}
  .adm-todo li a{color:var(--citui-cyan-500);font-weight:600}
  .adm-modgroup{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--citui-muted);
    font-weight:700;margin:22px 0 10px}
  .adm-mod{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--citui-line);
    border-radius:14px;background:var(--citui-white);margin-bottom:9px;transition:border-color .15s,box-shadow .15s}
  .adm-mod:hover{border-color:var(--citui-line-strong)}
  .adm-mod__txt{flex:1;min-width:0}
  .adm-mod__txt strong{display:block;font-size:1rem}
  .adm-mod__txt span{color:var(--citui-muted);font-size:.85rem}
  .adm-chip{white-space:nowrap;font-size:.82rem;font-weight:700;color:var(--citui-navy-900);
    background:var(--citui-surface-2);border:1px solid var(--citui-line);border-radius:999px;padding:5px 12px}
  .adm-chip--free{color:var(--citui-cyan-500);border-color:rgba(31,182,214,.3)}
  .adm-switch{position:relative;width:46px;height:27px;flex:0 0 auto}
  .adm-switch input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;z-index:2}
  .adm-switch input:disabled{cursor:default}
  .adm-switch .tr{position:absolute;inset:0;background:var(--citui-line-strong);border-radius:999px;transition:background .2s}
  .adm-switch .th{position:absolute;top:3px;left:3px;width:21px;height:21px;background:#fff;border-radius:50%;
    box-shadow:0 1px 4px rgba(14,42,71,.35);transition:transform .2s}
  .adm-switch input:checked~.tr{background:var(--citui-cyan-500)}
  .adm-switch input:checked~.th{transform:translateX(19px)}
  .adm-switch input:disabled~.tr{background:var(--citui-cyan-300);opacity:.7}
  .adm-total{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;
    margin-top:22px;padding-top:18px;border-top:1px solid var(--citui-line)}
  .adm-total b{font-family:var(--citui-font-display);font-size:1.4rem}
  .adm-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:14px}
  @media(max-width:899px){
    .adm-shell{grid-template-columns:1fr}
    .adm-side{position:fixed;top:auto;bottom:0;left:0;right:0;height:auto;z-index:50;flex-direction:row;
      padding:6px 6px calc(6px + env(safe-area-inset-bottom));gap:2px;border-top:1px solid rgba(255,255,255,.1)}
    .adm-side__brand,.adm-side__foot{display:none}
    .adm-nav{flex-direction:row;flex:1;gap:2px}
    .adm-nav a{flex-direction:column;gap:3px;flex:1;padding:8px 4px;font-size:.68rem;font-weight:600;border-radius:10px;text-align:center}
    .adm-nav a.is-active{box-shadow:none;background:rgba(31,182,214,.2)}
    .adm-topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;
      background:linear-gradient(120deg,var(--citui-navy-900),var(--citui-navy-700));color:#fff;padding:12px 16px}
    .adm-topbar .adm-tb-brand{display:flex;align-items:center;gap:8px;font-family:var(--citui-font-display);font-weight:700}
    .adm-topbar .adm-tb-brand svg{width:26px;height:26px}
    .adm-topbar a{color:#fff;text-decoration:none;font-size:.85rem;font-weight:600;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:6px 12px}
    .adm-main__inner{padding:22px 16px 96px}
    .adm-pagehead h1{font-size:1.4rem}
    .adm-card{padding:20px 18px;border-radius:16px}
  }
</style>`;

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
          ? `<form method="POST" action="/admin/photos/delete" style="position:absolute;top:4px;right:4px;margin:0">` +
            `<input type="hidden" name="url" value="${esc(p.url)}">` +
            `<button title="Törlés" style="background:rgba(14,42,71,.75);color:#fff;border-radius:50%;width:24px;height:24px;line-height:1;padding:0;cursor:pointer">×</button></form>`
          : "") +
        `</figure>`,
    )
    .join("");
  const grid = photos.length
    ? `<div class="adm-gallery">${items}</div>`
    : `<p class="citui-hint">Még nincs kép.</p>`;
  return (
    `<div class="adm-card"><div class="adm-card__head"><span class="adm-ico">${ic("photos")}</span><h2>Fotók</h2></div>${notice}${grid}` +
    `<div class="citui-field" style="margin-top:16px"><input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp" multiple></div>` +
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
  `var r=await fetch('/admin/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:images})});` +
  `var j=await r.json();if(j&&j.ok){location.href='/admin?saved=1';}else{note.textContent='Hiba a feltöltéskor.';btn.disabled=false;}}` +
  `catch(e){note.textContent='Hiba a feltöltéskor.';btn.disabled=false;}});})();</script>`;

/** Login page — enter username + password. */
export function loginPage(
  msg?: { text: string; kind: "info" | "bad" },
  consoleLoginUrl = "",
): string {
  const note = msg
    ? `<p class="citui-hint" style="text-align:center;color:${msg.kind === "bad" ? "var(--citui-bad)" : "var(--citui-ok)"}">${esc(msg.text)}</p>`
    : "";
  const pwToggle =
    `<script>function citPwT(id,btn){var i=document.getElementById(id);` +
    `var show=i.type==='password';i.type=show?'text':'password';btn.textContent=show?'elrejt':'mutat';}</script>`;
  return shell(
    "Ügyfél-belépés",
    `${pwToggle}<div class="citui-container" style="max-width:420px;padding:64px 0">` +
      `<div style="text-align:center;margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card">` +
      `<h1 style="font-size:1.5rem;text-align:center">Ügyfél-belépés</h1>` +
      `<p class="citui-hint" style="text-align:center;margin-bottom:18px">A honlapod kezeléséhez add meg a felhasználóneved és a kapott jelszót.</p>` +
      `<form method="POST" action="/login">` +
      `<div class="citui-field"><label class="citui-label" for="username">Felhasználónév</label>` +
      `<input class="citui-input" id="username" name="username" required autocapitalize="none" autocorrect="off" autofocus placeholder="pl. napfeny-panzio"></div>` +
      `<div class="citui-field"><label class="citui-label" for="password">Jelszó</label>` +
      `<div style="display:flex;gap:8px;align-items:center">` +
      `<input class="citui-input" id="password" name="password" type="password" required placeholder="a kapott jelszó" style="flex:1">` +
      `<button type="button" class="citui-btn citui-btn--ghost citui-btn--sm" onclick="citPwT('password',this)">mutat</button></div></div>` +
      `<button class="citui-btn citui-btn--primary" type="submit" style="width:100%">Belépés</button>` +
      `</form>${note}` +
      `<p class="citui-hint" style="text-align:center;margin-top:16px"><a href="/login/help">Elfelejtett jelszó?</a> · <a href="/">Vissza a főoldalra</a></p>` +
      `</div>` +
      (consoleLoginUrl
        ? `<p class="citui-hint" style="text-align:center;margin-top:14px">Citoviso-munkatárs vagy? <a href="${esc(consoleLoginUrl)}">Belépés a belső konzolba ▸</a></p>`
        : "") +
      `</div>`,
  );
}

/** Tenant password-recovery help — honest path until the sending domain is live. */
export function loginHelpPage(contactEmail: string): string {
  return shell(
    "Elfelejtett jelszó",
    `<div class="citui-container" style="max-width:480px;padding:64px 0">` +
      `<div style="text-align:center;margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card"><h1 style="font-size:1.4rem">Elfelejtett jelszó</h1>` +
      `<p class="citui-hint">A belépési adataidat az aktiváláskor e-mailben küldtük el — érdemes először
       ott keresni („Citoviso belépési adatok").</p>` +
      `<p class="citui-hint">Ha nincs meg, írj nekünk a(z) <strong>${esc(contactEmail)}</strong> címre a
       vállalkozásod nevével, és új jelszót adunk ki. Az önkiszolgáló visszaállítás hamarosan elérhető lesz.</p>` +
      `<p class="citui-hint">Belépés után a jelszavadat a Kezelőfelület „Fiók" részében bármikor megváltoztathatod.</p>` +
      `<p style="margin-top:14px"><a class="citui-btn citui-btn--primary" href="/login">← Vissza a belépéshez</a></p>` +
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
      `<p><a class="citui-btn citui-btn--primary" href="/login">Új link kérése</a></p></div></div>`,
  );
}

/** Self-service module management (ADR-0034): the owner switches modules on/off and sees the
 *  price impact immediately, instead of being told to write an e-mail. The spine (enquiry) is
 *  locked — it is the conversion backbone, included in the base price. */
function modulesSection(mv: TenantModuleView, contactEmail: string): string {
  // Thousand-separated HUF; toLocaleString is unreliable without full ICU on the server.
  const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
  const groups: ModuleGroup[] = ["offer", "reach", "extra"];
  const blocks = groups
    .map((g) => {
      const items = mv.modules.filter((m) => m.group === g);
      if (!items.length) return "";
      const rows = items
        .map((m) => {
          const price = m.spine
            ? `<span class="adm-chip adm-chip--free">az árban</span>`
            : `<span class="adm-chip">+${esc(huf(m.priceMonthly))}/hó</span>`;
          const input = m.spine
            ? `<input type="checkbox" checked disabled aria-label="${esc(m.label)}">`
            : `<input type="checkbox" name="module" value="${esc(m.id)}"${m.active ? " checked" : ""} aria-label="${esc(m.label)}">`;
          const sw = `<span class="adm-switch">${input}<span class="tr"></span><span class="th"></span></span>`;
          return (
            `<label class="adm-mod">${sw}` +
            `<span class="adm-mod__txt"><strong>${esc(m.label)}</strong>` +
            (m.spine ? `<span>Mindig aktív — ezen keresztül keresik meg a vendégek.</span>` : "") +
            `</span>${price}</label>`
          );
        })
        .join("");
      return `<div class="adm-modgroup">${esc(GROUP_LABELS[g])}</div>${rows}`;
    })
    .join("");

  return (
    `<form method="POST" action="/admin/modules" class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>Modulok</h2></div>` +
    `<p class="adm-lead">Kapcsold be, amit szeretnél az oldaladon. A változás a következő számlázási ciklustól érvényes; az új szekció a következő közzétételkor jelenik meg.</p>` +
    blocks +
    `<div class="adm-total"><span><span class="citui-hint" style="margin:0">Jelenlegi díj</span><br>` +
    `<b>${esc(huf(mv.totalMonthly))}/hó</b> <span class="citui-hint" style="margin:0">(alapdíj ${esc(huf(mv.baseMonthly))} + modulok)</span></span>` +
    `<button class="citui-btn citui-btn--primary" type="submit">Modulok mentése</button></div>` +
    `<p class="citui-hint" style="margin-top:14px">Kérdésed van a csomagról? Írj: <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a></p>` +
    `</form>`
  );
}

/** Admin sections — a real sidebar menu instead of one endless scroll (ADR-0034/0035). */
const TABS: readonly { id: string; label: string; icon: string }[] = [
  { id: "attekintes", label: "Áttekintés", icon: "overview" },
  { id: "szovegek", label: "Szövegek", icon: "texts" },
  { id: "fotok", label: "Fotók", icon: "photos" },
  { id: "modulok", label: "Modulok", icon: "modules" },
  { id: "fiok", label: "Fiók", icon: "account" },
];

/** Sidebar / bottom-bar navigation links (icon + label), with the active item highlighted. */
function navItems(active: string): string {
  return TABS.map(
    (t) =>
      `<a href="/admin?tab=${t.id}"${t.id === active ? ' class="is-active"' : ""}>${ic(t.icon)}<span>${esc(t.label)}</span></a>`,
  ).join("");
}

/** Overview: status tiles + an honest next-step checklist. */
function overviewSection(
  content: NonNullable<AdminContent>,
  statusText: string,
  siteUrl: string | null,
  previewUrl: string | null,
  mv: TenantModuleView | null,
): string {
  const live = content.status === "live";
  const activeCount = mv ? mv.modules.filter((m) => m.active).length : 0;
  const addr = siteUrl
    ? `<a href="${esc(siteUrl)}" target="_blank" rel="noopener">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a>`
    : previewUrl
      ? `<a href="${esc(previewUrl)}" target="_blank" rel="noopener">privát előnézet</a>`
      : `<span class="citui-hint">–</span>`;
  const todoItem = (done: boolean, html: string) =>
    `<li class="${done ? "done" : "pending"}"><span class="adm-tico">${ic(done ? "check" : "alert", 18)}</span><span>${html}</span></li>`;
  const todo =
    todoItem(
      content.usingOwnPhotos,
      content.usingOwnPhotos
        ? "Saját fotóid vannak fent"
        : `<strong>Tölts fel saját fotókat</strong> — jelenleg bemutató képek láthatók (<a href="/admin?tab=fotok">Fotók</a>)`,
    ) +
    todoItem(
      Boolean(content.intro && content.intro.length > 40),
      content.intro && content.intro.length > 40
        ? "Bemutatkozó szöveged kész"
        : `<strong>Írd meg a bemutatkozó szöveget</strong> (<a href="/admin?tab=szovegek">Szövegek</a>)`,
    ) +
    todoItem(
      live,
      live
        ? "Az oldalad élő és nyilvános"
        : "Az oldal még nem publikus — a Citoviso élesíti, amint minden készen áll",
    );
  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("overview")}</span><h2>Áttekintés</h2></div>` +
    `<div class="adm-stats">` +
    `<div class="adm-stat"><b><span class="citui-pill ${live ? "citui-pill--ok" : "citui-pill--info"}">${esc(statusText)}</span></b><span>Állapot</span></div>` +
    `<div class="adm-stat"><b style="font-size:1rem">${addr}</b><span>Az oldal címe</span></div>` +
    `<div class="adm-stat"><b>${activeCount} db</b><span>Aktív modul · <a href="/admin?tab=modulok">kezelés</a></span></div>` +
    `</div>` +
    `<h3 style="font-size:1rem;margin:24px 0 0;font-family:var(--citui-font-display)">Teendők</h3>` +
    `<ul class="adm-todo">${todo}</ul>` +
    `</div>`
  );
}

function textsSection(content: NonNullable<AdminContent>): string {
  const highlights = (content.highlights ?? []).join("\n");
  return (
    `<form method="POST" action="/admin/text" class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("texts")}</span><h2>Szövegek</h2></div>` +
    `<p class="adm-lead">Ezek a szövegek jelennek meg az oldaladon.</p>` +
    `<div class="citui-field"><label class="citui-label" for="name">Vállalkozás neve</label>` +
    `<input class="citui-input" id="name" name="name" value="${esc(content.name)}"></div>` +
    `<div class="citui-field"><label class="citui-label" for="tagline">Szlogen (rövid mondat a fejlécben)</label>` +
    `<input class="citui-input" id="tagline" name="tagline" value="${esc(content.tagline)}"></div>` +
    `<div class="citui-field"><label class="citui-label" for="intro">Bemutatkozó szöveg</label>` +
    `<textarea class="citui-textarea" id="intro" name="intro" style="min-height:140px">${esc(content.intro)}</textarea></div>` +
    `<div class="citui-field"><label class="citui-label" for="highlights">Kiemelések (soronként egy)</label>` +
    `<textarea class="citui-textarea" id="highlights" name="highlights" style="min-height:110px">${esc(highlights)}</textarea></div>` +
    `<button class="citui-btn citui-btn--primary" type="submit">Mentés és frissítés</button>` +
    `</form>`
  );
}

function accountSection(session: TenantSession): string {
  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("account")}</span><h2>Fiók</h2></div>` +
    `<div class="citui-field"><label class="citui-label">Felhasználónév (belépéshez)</label>` +
    `<input class="citui-input" value="${esc(session.username)}" readonly style="background:var(--citui-surface-2)"></div>` +
    `<form method="POST" action="/admin/contact">` +
    `<div class="citui-field"><label class="citui-label" for="contact_email">Kommunikációs e-mail (ide küldünk értesítést)</label>` +
    `<input class="citui-input" id="contact_email" name="contact_email" type="email" value="${esc(session.contactEmail)}" required></div>` +
    `<button class="citui-btn citui-btn--ghost" type="submit">E-mail mentése</button>` +
    `</form>` +
    `<form method="POST" action="/admin/password" style="margin-top:18px;padding-top:18px;border-top:1px solid var(--citui-line)">` +
    `<h3 style="font-size:1rem;margin:0 0 10px;font-family:var(--citui-font-display)">Jelszó módosítása</h3>` +
    `<div class="citui-field"><label class="citui-label" for="pw_current">Jelenlegi jelszó</label>` +
    `<input class="citui-input" id="pw_current" name="current" type="password" autocomplete="current-password" required></div>` +
    `<div class="citui-field"><label class="citui-label" for="pw_next">Új jelszó (min. 8 karakter)</label>` +
    `<input class="citui-input" id="pw_next" name="next" type="password" autocomplete="new-password" minlength="8" required></div>` +
    `<div class="citui-field"><label class="citui-label" for="pw_next2">Új jelszó még egyszer</label>` +
    `<input class="citui-input" id="pw_next2" name="next2" type="password" autocomplete="new-password" minlength="8" required></div>` +
    `<button class="citui-btn citui-btn--ghost" type="submit">Jelszó módosítása</button>` +
    `</form></div>`
  );
}

export interface AdminOpts {
  readonly saved?: boolean;
  readonly previewToken?: string | null;
  readonly modules?: TenantModuleView | null;
  readonly supportEmail?: string;
  /** Active section id (TABS). */
  readonly tab?: string;
  /** Public URL of the live site, when published. */
  readonly siteUrl?: string | null;
}

export function adminDashboard(
  session: TenantSession,
  content: AdminContent,
  opts: AdminOpts = {},
): string {
  const {
    saved = false,
    previewToken = null,
    modules: mv = null,
    supportEmail = "hello@citoviso.com",
    siteUrl = null,
  } = opts;
  const tab = TABS.some((t) => t.id === opts.tab) ? opts.tab! : "attekintes";
  const tabLabel = TABS.find((t) => t.id === tab)?.label ?? "Áttekintés";
  const statusLabel: Record<string, string> = {
    provisioned: "Előnézet (még nem publikus)",
    live: "Élő (publikus)",
    draft: "Vázlat",
    suspended: "Felfüggesztve",
    deactivated: "Deaktiválva",
  };
  const previewUrl = previewToken ? `/site/${previewToken}` : null;
  const sideBrand = LOGO.replace("citui-brand--ink", "").replace('fill="#16283f"', 'fill="#fff"');

  if (!content) {
    return shell(
      "Admin",
      ADM_STYLE +
        `<div class="adm-shell"><aside class="adm-side"><div class="adm-side__brand">${sideBrand}</div>` +
        `<nav class="adm-nav">${navItems(tab)}</nav>` +
        `<div class="adm-side__foot"><span class="adm-side__user">${esc(session.username)}</span>` +
        `<a class="adm-side__out" href="/logout">Kilépés</a></div></aside>` +
        `<main class="adm-main"><div class="adm-main__inner"><div class="adm-card">` +
        `<h1>Üdv, ${esc(session.displayName)}!</h1>` +
        `<p class="citui-hint">Ehhez a fiókhoz még nincs szerkeszthető oldal. Amint elkészül az oldalad, itt tudod majd szerkeszteni.</p>` +
        `</div></div></main></div>`,
    );
  }

  const savedNote = saved
    ? `<div class="adm-saved">${ic("check", 18)} Mentve — az oldalad frissült.</div>`
    : "";
  const viewBtn = previewUrl
    ? `<a class="adm-viewbtn" href="${esc(siteUrl ?? previewUrl)}" target="_blank" rel="noopener">${ic("external", 16)} Oldal megtekintése</a>`
    : "";

  const section =
    tab === "szovegek"
      ? textsSection(content)
      : tab === "fotok"
        ? photosCard(content)
        : tab === "modulok"
          ? mv
            ? modulesSection(mv, supportEmail)
            : `<div class="adm-card"><p class="citui-hint">A modulok jelenleg nem érhetők el.</p></div>`
          : tab === "fiok"
            ? accountSection(session)
            : overviewSection(
                content,
                statusLabel[content.status] ?? content.status,
                siteUrl,
                previewUrl,
                mv,
              );

  return shell(
    "Admin",
    ADM_STYLE +
      `<div class="adm-shell">` +
      // Desktop sidebar
      `<aside class="adm-side"><div class="adm-side__brand">${sideBrand}</div>` +
      `<nav class="adm-nav">${navItems(tab)}</nav>` +
      `<div class="adm-side__foot"><span class="adm-side__user">${esc(session.username)}</span>` +
      `<a class="adm-side__out" href="/logout">Kilépés</a></div></aside>` +
      `<main class="adm-main">` +
      // Mobile top bar (brand + logout); the nav lives in the bottom bar on mobile
      `<div class="adm-topbar"><span class="adm-tb-brand">${sideBrand}</span><a href="/logout">Kilépés</a></div>` +
      `<div class="adm-main__inner">` +
      `<div class="adm-pagehead"><h1>${esc(tabLabel)}</h1>${viewBtn}</div>` +
      `<p class="adm-sub">${esc(session.displayName)}</p>` +
      savedNote +
      section +
      `</div></main></div>` +
      (tab === "fotok" ? UPLOAD_SCRIPT : ""),
  );
}
