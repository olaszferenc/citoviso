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
          const price = m.spine ? "az árban" : `+${huf(m.priceMonthly)}/hó`;
          const box = m.spine
            ? `<input type="checkbox" checked disabled aria-label="${esc(m.label)}">`
            : `<input type="checkbox" name="module" value="${esc(m.id)}"${m.active ? " checked" : ""} aria-label="${esc(m.label)}" style="width:20px;height:20px;flex:0 0 auto;cursor:pointer">`;
          return (
            `<label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--citui-line);border-radius:10px;background:var(--citui-white);cursor:${m.spine ? "default" : "pointer"}">` +
            box +
            `<span style="flex:1"><strong style="display:block">${esc(m.label)}</strong>` +
            (m.spine ? `<span class="citui-hint" style="margin:0">Mindig aktív — ezen keresztül keresik meg a vendégek.</span>` : "") +
            `</span>` +
            `<span class="citui-pill${m.spine ? " citui-pill--info" : ""}" style="white-space:nowrap">${esc(price)}</span>` +
            `</label>`
          );
        })
        .join("");
      return (
        `<h3 style="font-size:1rem;margin:18px 0 8px">${esc(GROUP_LABELS[g])}</h3>` +
        `<div style="display:grid;gap:8px">${rows}</div>`
      );
    })
    .join("");

  return (
    `<form method="POST" action="/admin/modules" class="citui-card">` +
    `<h2 style="font-size:1.2rem">Modulok</h2>` +
    `<p class="citui-hint">Kapcsold be, amit szeretnél az oldaladon. A változás a következő számlázási ciklustól érvényes; az új szekció a következő közzétételkor jelenik meg az oldalon.</p>` +
    blocks +
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid var(--citui-line)">` +
    `<span><span class="citui-hint" style="margin:0">Jelenlegi díj</span><br><strong style="font-size:1.3rem">${esc(huf(mv.totalMonthly))}/hó</strong>` +
    `<span class="citui-hint" style="margin:0"> (alapdíj ${esc(huf(mv.baseMonthly))} + modulok)</span></span>` +
    `<button class="citui-btn citui-btn--primary" type="submit">Modulok mentése</button></div>` +
    `<p class="citui-hint" style="margin-top:12px">Kérdésed van a csomagról? Írj: <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a></p>` +
    `</form>`
  );
}

/** Admin sections — a real menu instead of one endless scroll (ADR-0034). */
const TABS: readonly { id: string; label: string }[] = [
  { id: "attekintes", label: "Áttekintés" },
  { id: "szovegek", label: "Szövegek" },
  { id: "fotok", label: "Fotók" },
  { id: "modulok", label: "Modulok" },
  { id: "fiok", label: "Fiók" },
];

function tabNav(active: string): string {
  const items = TABS.map((t) => {
    const on = t.id === active;
    return (
      `<a href="/admin?tab=${t.id}" style="display:inline-block;padding:10px 16px;border-radius:999px;text-decoration:none;` +
      `font-weight:600;font-size:.95rem;white-space:nowrap;` +
      (on
        ? `background:var(--citui-navy-900);color:#fff"`
        : `background:var(--citui-white);color:var(--citui-navy-900);border:1px solid var(--citui-line)"`) +
      `>${esc(t.label)}</a>`
    );
  }).join("");
  return `<nav style="display:flex;gap:8px;overflow-x:auto;padding:4px 0 20px;-webkit-overflow-scrolling:touch">${items}</nav>`;
}

/** Overview: status, live URL, and a plain next-step checklist. */
function overviewSection(
  content: NonNullable<AdminContent>,
  statusText: string,
  siteUrl: string | null,
  previewUrl: string | null,
  mv: TenantModuleView | null,
): string {
  const live = content.status === "live";
  const activeCount = mv ? mv.modules.filter((m) => m.active).length : 0;
  const todo = [
    content.usingOwnPhotos
      ? `<li>✓ Saját fotóid vannak fent</li>`
      : `<li><strong>Tölts fel saját fotókat</strong> — jelenleg bemutató képek láthatók (<a href="/admin?tab=fotok">Fotók</a>)</li>`,
    content.intro && content.intro.length > 40
      ? `<li>✓ Bemutatkozó szöveged kész</li>`
      : `<li><strong>Írd meg a bemutatkozó szöveget</strong> (<a href="/admin?tab=szovegek">Szövegek</a>)</li>`,
    live
      ? `<li>✓ Az oldalad élő és nyilvános</li>`
      : `<li>Az oldal még nem publikus — a Citoviso élesíti, amint minden készen áll</li>`,
  ].join("");
  return (
    `<div class="citui-card">` +
    `<h2 style="font-size:1.2rem">Áttekintés</h2>` +
    `<dl style="display:grid;grid-template-columns:auto 1fr;gap:8px 18px;margin:12px 0 0;align-items:baseline">` +
    `<dt class="citui-hint" style="margin:0">Állapot</dt><dd style="margin:0"><span class="citui-pill ${live ? "citui-pill--ok" : "citui-pill--info"}">${esc(statusText)}</span></dd>` +
    `<dt class="citui-hint" style="margin:0">Az oldal címe</dt><dd style="margin:0">` +
    (siteUrl
      ? `<a href="${esc(siteUrl)}" target="_blank" rel="noopener">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a>`
      : previewUrl
        ? `<a href="${esc(previewUrl)}" target="_blank" rel="noopener">privát előnézet ▸</a> <span class="citui-hint" style="margin:0">(még nem publikus)</span>`
        : `<span class="citui-hint" style="margin:0">–</span>`) +
    `</dd>` +
    `<dt class="citui-hint" style="margin:0">Aktív modulok</dt><dd style="margin:0">${activeCount} db · <a href="/admin?tab=modulok">kezelés ▸</a></dd>` +
    `</dl>` +
    `<h3 style="font-size:1rem;margin:22px 0 8px">Teendők</h3>` +
    `<ul style="margin:0;padding-left:20px;line-height:1.9">${todo}</ul>` +
    `</div>`
  );
}

function textsSection(content: NonNullable<AdminContent>): string {
  const highlights = (content.highlights ?? []).join("\n");
  return (
    `<form method="POST" action="/admin/text" class="citui-card">` +
    `<h2 style="font-size:1.2rem">Szövegek</h2>` +
    `<p class="citui-hint">Ezek a szövegek jelennek meg az oldaladon.</p>` +
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
    `<div class="citui-card">` +
    `<h2 style="font-size:1.2rem">Fiók</h2>` +
    `<div class="citui-field"><label class="citui-label">Felhasználónév (belépéshez)</label>` +
    `<input class="citui-input" value="${esc(session.username)}" readonly style="background:var(--citui-surface-2)"></div>` +
    `<form method="POST" action="/admin/contact">` +
    `<div class="citui-field"><label class="citui-label" for="contact_email">Kommunikációs e-mail (ide küldünk értesítést)</label>` +
    `<input class="citui-input" id="contact_email" name="contact_email" type="email" value="${esc(session.contactEmail)}" required></div>` +
    `<button class="citui-btn citui-btn--ghost" type="submit">E-mail mentése</button>` +
    `</form>` +
    `<form method="POST" action="/admin/password" style="margin-top:18px;padding-top:16px;border-top:1px solid var(--citui-line)">` +
    `<h3 style="font-size:1rem;margin:0 0 10px">Jelszó módosítása</h3>` +
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
  const statusLabel: Record<string, string> = {
    provisioned: "Előnézet (még nem publikus)",
    live: "Élő (publikus)",
    draft: "Vázlat",
    suspended: "Felfüggesztve",
    deactivated: "Deaktiválva",
  };
  const previewUrl = previewToken ? `/site/${previewToken}` : null;
  const header =
    `<header style="background:linear-gradient(120deg,var(--citui-navy-900),var(--citui-navy-700));border-bottom:2px solid var(--citui-cyan-500);box-shadow:0 8px 24px rgba(4,14,26,.16)"><div class="citui-container citui-nav">` +
    `${LOGO.replace("citui-brand--ink", "").replace('fill="#16283f"', 'fill="#fff"')}` +
    `<div class="citui-nav-actions"><span style="color:rgba(255,255,255,.7);font-size:.9rem">${esc(session.username)}</span>` +
    `<a class="citui-btn citui-btn--secondary citui-btn--sm" href="/logout">Kilépés</a></div></div></header>`;

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
  const viewBtn = previewUrl
    ? `<a class="citui-btn citui-btn--ghost citui-btn--sm" href="${esc(siteUrl ?? previewUrl)}" target="_blank" rel="noopener">Oldal megtekintése ▸</a>`
    : "";

  const section =
    tab === "szovegek"
      ? textsSection(content)
      : tab === "fotok"
        ? photosCard(content)
        : tab === "modulok"
          ? mv
            ? modulesSection(mv, supportEmail)
            : `<div class="citui-card"><p class="citui-hint">A modulok jelenleg nem érhetők el.</p></div>`
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
    header +
      `<div class="citui-container" style="padding:32px 0 56px;max-width:820px">` +
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:14px">` +
      `<h1 style="margin:0">${esc(session.displayName)}</h1>${viewBtn}</div>` +
      tabNav(tab) +
      savedNote +
      section +
      `</div>` +
      (tab === "fotok" ? UPLOAD_SCRIPT : ""),
  );
}
