// Tenant admin views (ADR-0023) — styled with the design core (citui.css).
// Server-rendered HTML; Post/Redirect/Get for mutations. No framework (node:http).

import type { TenantSession } from "../auth/tenantAuth.js";
import { GROUP_LABELS, type ModuleGroup } from "../modules.js";
import type { PhotoEdit, TenantContentEdits } from "../tenant/editor.js";
import type { TenantModuleView } from "../tenant/modules.js";
import { MODCFG_STYLE, hasSettingsScreen } from "./moduleConfigViews.js";
import { ic } from "../ui/icons.js";

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

// Icons come from the shared bespoke set (src/ui/icons.ts) — one icon language
// across every first-party surface.

/** Admin design system lives in the central design core (ADR-0021 ①):
 *  /assets/ui/citui-admin.css (scoped .adm-*, token-driven on citui.css).
 *  No embedded stylesheet here — change the core, the admin follows. */
const ADM_STYLE = `<link rel="stylesheet" href="/assets/ui/citui-admin.css?v=${ASSET_V}">`;


/** Photos card — current gallery (with remove when own) + upload. */
function photosCard(
  content: NonNullable<AdminContent>,
  units: readonly { id: string; name: string }[] = [],
): string {
  const photos = content.photos ?? [];
  const notice = content.usingOwnPhotos
    ? `<p class="citui-hint">A saját fotóid láthatók az oldaladon.</p>`
    : `<p class="citui-hint" style="color:var(--citui-warn)">Jelenleg bemutató (demó) képek láthatók. Tölts fel saját fotókat — az élesítéshez a saját, jogtiszta képeid szükségesek.</p>`;
  // ADR-0044: order + caption. Every template uses photos[0] as the cover, so
  // "legyen ez a főkép" is the most valuable control here — and the gallery module's
  // help text has been promising ordering while this tab offered none.
  const items = photos
    .map((p, i) => {
      const move = (to: string, label: string, title: string) =>
        `<form method="POST" action="/admin/photos/order" style="margin:0">` +
        `<input type="hidden" name="url" value="${esc(p.url)}">` +
        `<input type="hidden" name="to" value="${to}">` +
        `<button class="adm-photo-btn" title="${esc(title)}">${label}</button></form>`;
      return (
        `<figure class="adm-photo${i === 0 ? " is-cover" : ""}" style="margin:0">` +
        `<img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy">` +
        (i === 0 ? `<span class="adm-photo__badge">Nyitókép</span>` : "") +
        (content.usingOwnPhotos
          ? `<form method="POST" action="/admin/photos/delete" class="adm-photo__del">` +
            `<input type="hidden" name="url" value="${esc(p.url)}">` +
            `<button title="Törlés" class="adm-photo-del">×</button></form>`
          : "") +
        `<div class="adm-photo__bar">` +
        (i > 0 ? move("cover", "★", "Legyen ez a nyitókép") : "") +
        (i > 0 ? move("up", "‹", "Előrébb") : "") +
        (i < photos.length - 1 ? move("down", "›", "Hátrébb") : "") +
        `</div>` +
        `<form method="POST" action="/admin/photos/caption" class="adm-photo__cap">` +
        `<input type="hidden" name="url" value="${esc(p.url)}">` +
        `<input class="citui-input" name="alt" value="${esc(p.alt)}" placeholder="Mi látszik a képen?" ` +
        `aria-label="Képaláírás">` +
        `<button class="citui-btn citui-btn--ghost" type="submit">Mentés</button>` +
        `</form>` +
        // ADR-0044/d — ONE shared photo library: the owner uploads a picture once and
        // ticks where it belongs. Only shown with several units; a single-unit owner
        // must never meet the concept.
        (units.length > 1
          ? `<form method="POST" action="/admin/photos/units" class="adm-photo__units">` +
            `<input type="hidden" name="url" value="${esc(p.url)}">` +
            `<span class="adm-photo__units-lbl">Melyik egységhez?</span>` +
            units
              .map(
                (u) =>
                  `<label><input type="checkbox" name="unit" value="${esc(u.id)}"` +
                  `${(p.units ?? []).includes(u.id) ? " checked" : ""}> ${esc(u.name)}</label>`,
              )
              .join("") +
            `<button class="citui-btn citui-btn--ghost" type="submit">Mentés</button></form>`
          : "") +
        `</figure>`
      );
    })
    .join("");
  const grid = photos.length
    ? `<p class="citui-hint">Az <strong>első kép a nyitókép</strong> — az jelenik meg legnagyobban az oldalán. ` +
      `A ★ gombbal bármelyiket előre hozhatja.</p><div class="adm-gallery">${items}</div>`
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
          // A module replaced by another (booking takes over enquiry's slot) is shown
          // greyed out and unbilled, with the reason stated — not silently hidden, or
          // the owner would think a module they know about had vanished.
          const replacedBy = m.supersededBy
            ? mv.modules.find((x) => x.id === m.supersededBy)?.label
            : null;
          const price = replacedBy
            ? `<span class="adm-chip adm-chip--off">nem számítjuk</span>`
            : m.spine
              ? `<span class="adm-chip adm-chip--free">az árban</span>`
              : `<span class="adm-chip">+${esc(huf(m.priceMonthly))}/hó</span>`;
          const input =
            m.spine || replacedBy
              ? `<input type="checkbox"${m.active && !replacedBy ? " checked" : ""} disabled aria-label="${esc(m.label)}">`
              : `<input type="checkbox" name="module" value="${esc(m.id)}"${m.active ? " checked" : ""} aria-label="${esc(m.label)}">`;
          const sw = `<span class="adm-switch">${input}<span class="tr"></span><span class="th"></span></span>`;
          // ADR-0044: an active module the owner can actually SET gets a way in.
          // The link sits OUTSIDE the label, otherwise tapping it would toggle the switch.
          const cfg =
            m.active && !replacedBy && hasSettingsScreen(m.id)
              ? `<a class="adm-mod__cfg" href="/admin?tab=modulok&m=${encodeURIComponent(m.id)}">` +
                `${ic("settings", 18)}<span>Beállítás</span></a>`
              : "";
          const note = replacedBy
            ? `<span>Ezt most a(z) „${esc(replacedBy)}” váltja ki — a kettő ugyanazon a helyen jelenne meg.</span>`
            : m.spine
              ? `<span>Mindig aktív — ezen keresztül keresik meg a vendégek.</span>`
              : "";
          return (
            `<div class="adm-modrow${replacedBy ? " is-replaced" : ""}"><label class="adm-mod">${sw}` +
            `<span class="adm-mod__txt"><strong>${esc(m.label)}</strong>${note}` +
            `</span>${price}</label>${cfg}</div>`
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
  /** ADR-0044: pre-rendered settings screen for ONE module (?m=<id>), when open. */
  readonly moduleSettingsHtml?: string | null;
  /** ADR-0044/d: bookable units, so photos can be assigned to them on the Fotók tab. */
  readonly units?: readonly { id: string; name: string }[];
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
        ? photosCard(content, opts.units ?? [])
        : tab === "modulok"
          ? // ADR-0044: ?m=<id> opens that module's own settings screen; without it
            // the tab is the on/off list. One screen = one decision.
            (opts.moduleSettingsHtml ??
              (mv
                ? modulesSection(mv, supportEmail)
                : `<div class="adm-card"><p class="citui-hint">A modulok jelenleg nem érhetők el.</p></div>`))
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
      (tab === "fotok" ? UPLOAD_SCRIPT : "") +
      // The photo cards (order/caption) and the module screens share one stylesheet.
      (tab === "modulok" || tab === "fotok" ? MODCFG_STYLE : ""),
  );
}
