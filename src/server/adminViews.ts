// Tenant admin views (ADR-0023) — styled with the design core (citui.css).
// Server-rendered HTML; Post/Redirect/Get for mutations. No framework (node:http).

import type { TenantSession } from "../auth/tenantAuth.js";
import { GROUP_LABELS, type ModuleGroup } from "../modules.js";
import type { PhotoEdit, TenantContentEdits } from "../tenant/editor.js";
import type { TenantModuleView } from "../tenant/modules.js";
import { MODCFG_STYLE, hasSettingsScreen } from "./moduleConfigViews.js";
import { ic } from "../ui/icons.js";
// ADR-0067: the tenant admin is a CUSTOMER surface — every label reads from the
// language pack. `lang` is the site's own language, threaded from the content.
import { T } from "../i18n/mail.js";

/** Cache-busting asset version: stamped at module load so each deploy serves
 *  fresh CSS through the CDN without a cache purge. */
const ASSET_V = String(Date.now());

type AdminContent =
  | (TenantContentEdits & {
      photos: PhotoEdit[];
      usingOwnPhotos: boolean;
      status: string;
      previewPath: string | null;
      /** ADR-0067: the site's own language — the whole admin renders in it. */
      lang?: string;
    })
  | null;

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function shell(title: string, body: string, lang = "hu"): string {
  return (
    `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">` +
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

/** ADR-0045 §J: contextual help on a card head. The data-kb-anchor is the coverage
 *  hook (kb-check --coverage): a section carrying it MUST have a KB entry. */
function helpLink(anchor: string, lang = "hu"): string {
  return (
    `<a class="adm-help" data-kb-anchor="${anchor}" href="/admin?tab=sugo&topic=${encodeURIComponent(anchor)}" ` +
    `title="${T(lang, "Súgó ehhez a részhez")}">${ic("help", 18)}</a>`
  );
}


/** Photos card — current gallery (with remove when own) + upload. */
function photosCard(
  content: NonNullable<AdminContent>,
  units: readonly { id: string; name: string }[] = [],
  lang = "hu",
): string {
  const photos = content.photos ?? [];
  const notice = content.usingOwnPhotos
    ? `<p class="citui-hint">${T(lang, "A saját fotóid láthatók az oldaladon.")}</p>`
    : `<p class="citui-hint" style="color:var(--citui-warn)">${T(lang, "Jelenleg bemutató (demó) képek láthatók. Tölts fel saját fotókat — az élesítéshez a saját, jogtiszta képeid szükségesek.")}</p>`;
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
        (i === 0 ? `<span class="adm-photo__badge">${T(lang, "Nyitókép")}</span>` : "") +
        (content.usingOwnPhotos
          ? `<form method="POST" action="/admin/photos/delete" class="adm-photo__del">` +
            `<input type="hidden" name="url" value="${esc(p.url)}">` +
            `<button title="${T(lang, "Törlés")}" class="adm-photo-del">×</button></form>`
          : "") +
        `<div class="adm-photo__bar">` +
        (i > 0 ? move("cover", "★", T(lang, "Legyen ez a nyitókép")) : "") +
        (i > 0 ? move("up", "‹", T(lang, "Előrébb")) : "") +
        (i < photos.length - 1 ? move("down", "›", T(lang, "Hátrébb")) : "") +
        `</div>` +
        `<form method="POST" action="/admin/photos/caption" class="adm-photo__cap">` +
        `<input type="hidden" name="url" value="${esc(p.url)}">` +
        `<input class="citui-input" name="alt" value="${esc(p.alt)}" placeholder="${T(lang, "Mi látszik a képen?")}" ` +
        `aria-label="${T(lang, "Képaláírás")}">` +
        `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mentés")}</button>` +
        `</form>` +
        // ADR-0044/d — ONE shared photo library: the owner uploads a picture once and
        // ticks where it belongs. Only shown with several units; a single-unit owner
        // must never meet the concept.
        (units.length > 1
          ? `<form method="POST" action="/admin/photos/units" class="adm-photo__units">` +
            `<input type="hidden" name="url" value="${esc(p.url)}">` +
            `<span class="adm-photo__units-lbl">${T(lang, "Melyik egységhez?")}</span>` +
            units
              .map(
                (u) =>
                  `<label><input type="checkbox" name="unit" value="${esc(u.id)}"` +
                  `${(p.units ?? []).includes(u.id) ? " checked" : ""}> ${esc(u.name)}</label>`,
              )
              .join("") +
            `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mentés")}</button></form>`
          : "") +
        `</figure>`
      );
    })
    .join("");
  const grid = photos.length
    ? `<p class="citui-hint">${T(lang, "Az {b} — az jelenik meg legnagyobban az oldalán. A ★ gombbal bármelyiket előre hozhatja.", { b: `<strong>${T(lang, "első kép a nyitókép")}</strong>` })}</p><div class="adm-gallery">${items}</div>`
    : `<p class="citui-hint">${T(lang, "Még nincs kép.")}</p>`;
  return (
    `<div class="adm-card"><div class="adm-card__head"><span class="adm-ico">${ic("photos")}</span><h2>${T(lang, "Fotók")}</h2>${helpLink("admin.photos", lang)}</div>${notice}${grid}` +
    `<div class="citui-field" style="margin-top:16px"><input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp" multiple></div>` +
    `<button class="citui-btn citui-btn--primary" id="photo-upload" type="button">${T(lang, "Kiválasztott fotók feltöltése")}</button>` +
    `<p class="citui-hint" id="photo-note"></p></div>`
  );
}

// A FUNCTION of the reader's language (ADR-0067): the inline script's own
// user-visible messages are localized SERVER-side and interpolated in, so the
// browser never has to carry a second translation mechanism.
const UPLOAD_SCRIPT = (lang = "hu"): string =>
  `<script>(function(){` +
  `var inp=document.getElementById('photo-input'),btn=document.getElementById('photo-upload'),note=document.getElementById('photo-note');` +
  `if(!inp||!btn)return;` +
  `function read(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=rej;r.readAsDataURL(f)})}` +
  `btn.addEventListener('click',async function(){var files=[].slice.call(inp.files||[]);` +
  `if(!files.length){note.textContent='${T(lang, "Válassz ki képeket.")}';return;}` +
  `btn.disabled=true;note.textContent='${T(lang, "Feltöltés…")}';` +
  `try{var images=[];for(var i=0;i<files.length;i++){if(files[i].size>6000000){continue;}var d=await read(files[i]);images.push({dataUrl:d,alt:''});}` +
  `if(!images.length){note.textContent='${T(lang, "A képek túl nagyok (max 6 MB).")}';btn.disabled=false;return;}` +
  `var r=await fetch('/admin/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:images})});` +
  `var j=await r.json();if(j&&j.ok){location.href='/admin?saved=1';}else{note.textContent='${T(lang, "Hiba a feltöltéskor.")}';btn.disabled=false;}}` +
  `catch(e){note.textContent='${T(lang, "Hiba a feltöltéskor.")}';btn.disabled=false;}});})();</script>`;

/** Login page — enter username + password. */
export function loginPage(
  msg?: { text: string; kind: "info" | "bad" },
  consoleLoginUrl = "",
  lang = "hu",
): string {
  const note = msg
    ? `<p class="citui-hint" style="text-align:center;color:${msg.kind === "bad" ? "var(--citui-bad)" : "var(--citui-ok)"}">${esc(msg.text)}</p>`
    : "";
  const pwToggle =
    `<script>function citPwT(id,btn){var i=document.getElementById(id);` +
    `var show=i.type==='password';i.type=show?'text':'password';btn.textContent=show?'elrejt':'mutat';}</script>`;
  return shell(
    T(lang, "Ügyfél-belépés"),
    `${pwToggle}<div class="citui-container" style="max-width:420px;padding:64px 0">` +
      `<div style="text-align:center;margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card">` +
      `<h1 style="font-size:1.5rem;text-align:center">${T(lang, "Ügyfél-belépés")}</h1>` +
      `<p class="citui-hint" style="text-align:center;margin-bottom:18px">${T(lang, "A honlapod kezeléséhez add meg a felhasználóneved és a kapott jelszót.")}</p>` +
      `<form method="POST" action="/login">` +
      `<div class="citui-field"><label class="citui-label" for="username">${T(lang, "Felhasználónév")}</label>` +
      `<input class="citui-input" id="username" name="username" required autocapitalize="none" autocorrect="off" autofocus placeholder="pl. napfeny-panzio"></div>` +
      `<div class="citui-field"><label class="citui-label" for="password">${T(lang, "Jelszó")}</label>` +
      `<div style="display:flex;gap:8px;align-items:center">` +
      `<input class="citui-input" id="password" name="password" type="password" required placeholder="${T(lang, "a kapott jelszó")}" style="flex:1">` +
      `<button type="button" class="citui-btn citui-btn--ghost citui-btn--sm" onclick="citPwT('password',this)">mutat</button></div></div>` +
      `<button class="citui-btn citui-btn--primary" type="submit" style="width:100%">${T(lang, "Belépés")}</button>` +
      `</form>${note}` +
      `<p class="citui-hint" style="text-align:center;margin-top:16px"><a href="/login/help">${T(lang, "Elfelejtett jelszó?")}</a> · <a href="/">${T(lang, "Vissza a főoldalra")}</a></p>` +
      `</div>` +
      (consoleLoginUrl
        ? `<p class="citui-hint" style="text-align:center;margin-top:14px">${T(lang, "Citoviso-munkatárs vagy?")} <a href="${esc(consoleLoginUrl)}">${T(lang, "Belépés a belső konzolba ▸")}</a></p>`
        : "") +
      `</div>`,
    lang,
  );
}

/** Tenant password-recovery help — honest path until the sending domain is live. */
export function loginHelpPage(contactEmail: string, lang = "hu"): string {
  return shell(
    T(lang, "Elfelejtett jelszó"),
    `<div class="citui-container" style="max-width:480px;padding:64px 0">` +
      `<div style="text-align:center;margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card"><h1 style="font-size:1.4rem">${T(lang, "Elfelejtett jelszó")}</h1>` +
      `<p class="citui-hint">A belépési adataidat az aktiváláskor e-mailben küldtük el — érdemes először
       ott keresni („Citoviso belépési adatok").</p>` +
      `<p class="citui-hint">${T(lang, "Ha nincs meg, írj nekünk a(z)")} <strong>${esc(contactEmail)}</strong> címre a
       vállalkozásod nevével, és új jelszót adunk ki. Az önkiszolgáló visszaállítás hamarosan elérhető lesz.</p>` +
      `<p class="citui-hint">${T(lang, "Belépés után a jelszavadat a Kezelőfelület „Fiók” részében bármikor megváltoztathatod.")}</p>` +
      `<p style="margin-top:14px"><a class="citui-btn citui-btn--primary" href="/login">${T(lang, "← Vissza a belépéshez")}</a></p>` +
      `</div></div>`,
    lang,
  );
}

/** After requesting a link. */
export function linkSentPage(lang = "hu"): string {
  return shell(
    T(lang, "Link elküldve"),
    `<div class="citui-container" style="max-width:420px;padding:64px 0;text-align:center">` +
      `<div style="margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card"><h1 style="font-size:1.4rem">${T(lang, "Elküldtük a belépő linket")}</h1>` +
      `<p class="citui-hint">${T(lang, "Ha van fiók ezzel az e-mail-címmel, perceken belül megérkezik a belépő link. A link 30 percig érvényes.")}</p></div></div>`,
    lang,
  );
}

export function verifyErrorPage(lang = "hu"): string {
  return shell(
    T(lang, "Érvénytelen link"),
    `<div class="citui-container" style="max-width:420px;padding:64px 0;text-align:center">` +
      `<div class="citui-card"><h1 style="font-size:1.4rem">${T(lang, "A link érvénytelen vagy lejárt")}</h1>` +
      `<p class="citui-hint">${T(lang, "Kérj egy új belépő linket.")}</p>` +
      `<p><a class="citui-btn citui-btn--primary" href="/login">${T(lang, "Új link kérése")}</a></p></div></div>`,
    lang,
  );
}

/** Self-service module management (ADR-0034): the owner switches modules on/off and sees the
 *  price impact immediately, instead of being told to write an e-mail. The spine (enquiry) is
 *  locked — it is the conversion backbone, included in the base price. */
function modulesSection(mv: TenantModuleView, contactEmail: string, lang = "hu"): string {
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
            ? `<span class="adm-chip adm-chip--off">${T(lang, "nem számítjuk")}</span>`
            : m.spine
              ? `<span class="adm-chip adm-chip--free">${T(lang, "az árban")}</span>`
              : `<span class="adm-chip">${T(lang, "+{price}/hó", { price: esc(huf(m.priceMonthly)) })}</span>`;
          const input =
            m.spine || replacedBy
              ? `<input type="checkbox"${m.active && !replacedBy ? " checked" : ""} disabled aria-label="${esc(T(lang, m.label))}">`
              : `<input type="checkbox" name="module" value="${esc(m.id)}"${m.active ? " checked" : ""} aria-label="${esc(T(lang, m.label))}">`;
          const sw = `<span class="adm-switch">${input}<span class="tr"></span><span class="th"></span></span>`;
          // ADR-0044: an active module the owner can actually SET gets a way in.
          // The link sits OUTSIDE the label, otherwise tapping it would toggle the switch.
          const cfg =
            m.active && !replacedBy && hasSettingsScreen(m.id)
              ? `<a class="adm-mod__cfg" href="/admin?tab=modulok&m=${encodeURIComponent(m.id)}">` +
                `${ic("settings", 18)}<span>${T(lang, "Beállítás")}</span></a>`
              : "";
          const note = replacedBy
            ? `<span>${T(lang, "Ezt most a(z) „{other}” váltja ki — a kettő ugyanazon a helyen jelenne meg.", { other: esc(replacedBy) })}</span>`
            : m.spine
              ? `<span>${T(lang, "Mindig aktív — ezen keresztül keresik meg a vendégek.")}</span>`
              : "";
          return (
            `<div class="adm-modrow${replacedBy ? " is-replaced" : ""}"><label class="adm-mod">${sw}` +
            `<span class="adm-mod__txt"><strong>${esc(T(lang, m.label))}</strong>${note}` +
            `</span>${price}</label>${cfg}</div>`
          );
        })
        .join("");
      return `<div class="adm-modgroup">${esc(T(lang, GROUP_LABELS[g]))}</div>${rows}`;
    })
    .join("");

  return (
    `<form method="POST" action="/admin/modules" class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>${T(lang, "Modulok")}</h2>${helpLink("admin.modules", lang)}</div>` +
    // 0033: adding a paid module now goes through payment, so say so BEFORE the
    // click. A silent redirect to a card page is exactly the kind of surprise
    // §I (no bait-and-switch) forbids — the buyer must know what the button does.
    `<p class="adm-lead">${T(lang, "Kapcsold be, amit szeretnél az oldaladon. Új, fizetős modul bekapcsolásakor a mentés a biztonságos fizetési oldalra visz — a modul a fizetés után jelenik meg. Kikapcsolni bármikor ingyenesen tudsz.")}</p>` +
    blocks +
    `<div class="adm-total"><span><span class="citui-hint" style="margin:0">${T(lang, "Jelenlegi díj")}</span><br>` +
    `<b>${T(lang, "{price}/hó", { price: esc(huf(mv.totalMonthly)) })}</b> <span class="citui-hint" style="margin:0">${T(lang, "(alapdíj {base} + modulok)", { base: esc(huf(mv.baseMonthly)) })}</span></span>` +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Modulok mentése")}</button></div>` +
    `<p class="citui-hint" style="margin-top:14px">${T(lang, "Kérdésed van a csomagról? Írj:")} <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a></p>` +
    `</form>`
  );
}

/** ADR-0063 „Többnyelvű honlap" — the multilang card's view data (public.ts assembles). */
export interface MultilangAdminData {
  /** One-time fee (HUF) — the SAME for first generation, regeneration and swap. */
  readonly price: number;
  /** Fixed package size (3). */
  readonly count: number;
  readonly primaryLangName: string;
  /** Pickable target languages (supported set minus the site's own language). */
  readonly options: readonly { code: string; name: string }[];
  /** The paid state; null = never purchased. */
  readonly state: {
    readonly languages: readonly string[];
    readonly langNames: readonly string[];
    readonly status: "active" | "stale";
    readonly generatedAt: string;
  } | null;
  /** A paid generation is currently running (webhook fired, work in progress). */
  readonly generating: boolean;
  /** The latest generation failed with this error (operator-fixable). */
  readonly failedError: string | null;
  /** Live links of the served language versions (only when the site is live). */
  readonly langUrls: readonly { lang: string; url: string }[];
}

/**
 * ADR-0063: one-time paid module — NOT a toggle in the module list (toggling is
 * free there); its own card owns the whole lifecycle: pick 3 languages → pay →
 * generated; content change → stale banner → pay again; swap = new set + pay.
 */
function multilangSection(ml: MultilangAdminData, lang = "hu"): string {
  const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
  const checked = new Set(ml.state?.languages ?? []);
  const picker = ml.options
    .map(
      (o) =>
        `<label class="adm-mlang"><input type="checkbox" name="lang" value="${esc(o.code)}"` +
        `${checked.has(o.code) ? " checked" : ""}> <span>${esc(o.name)}</span></label>`,
    )
    .join("");
  // A warning must not wear the success-green "saved" coat — warn tone, token-only.
  const warnBox =
    `style="background:color-mix(in srgb, var(--citui-warn) 12%, transparent);` +
    `color:var(--citui-warn)"`;
  const statusBlock = ml.generating
    ? `<div class="adm-saved">${ic("check", 18)} ${T(lang, "A fordítás készül — pár percen belül elkészül, és az oldalad nyelvi változatai maguktól megjelennek.")}</div>`
    : ml.failedError
      ? `<div class="adm-saved" role="alert" ${warnBox}>${ic("alert", 18)} ${T(lang, "A legutóbbi generálás nem sikerült — a díjat nem veszítetted el, csapatunk újraindítja. Ha sürgős, írj nekünk.")}</div>`
      : ml.state
        ? ml.state.status === "stale"
          ? `<div class="adm-saved" role="alert" ${warnBox}>${ic("alert", 18)} <strong>${T(lang, "A fordítások elavultak.")}</strong> ${T(lang, "Módosítottad az oldalad szövegeit, ezért a nyelvi változatok ({langs}) még a korábbi tartalmat mutatják. Az újrageneráláshoz újra ki kell fizetni a generálás díját.", { langs: esc(ml.state.langNames.join(", ")) })}</div>`
          : `<div class="adm-saved">${ic("check", 18)} ${T(lang, "A nyelvi változatok naprakészek: {langs} (generálva: {date}).", { langs: esc(ml.state.langNames.join(", ")), date: esc(ml.state.generatedAt) })}</div>`
        : "";
  const links = ml.langUrls.length
    ? `<p class="citui-hint">${T(lang, "Nyelvi változatok:")} ` +
      ml.langUrls
        .map((u) => `<a href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.lang.toUpperCase())}</a>`)
        .join(" · ") +
      `</p>`
    : "";
  const btnLabel = ml.state
    ? T(lang, "Újragenerálás fizetéssel ({price})", { price: esc(huf(ml.price)) })
    : T(lang, "Fizetés és generálás ({price})", { price: esc(huf(ml.price)) });
  return (
    `<form method="POST" action="/admin/multilang" class="adm-card" id="tobbnyelvu">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>${T(lang, "Többnyelvű honlap")}</h2>${helpLink("admin.multilang", lang)}</div>` +
    `<p class="adm-lead">${T(lang, "Az oldalad {count} választott nyelven is elérhető lesz — a beírt szövegeid és a teljes felület lefordítva, egyszeri díjért. Ha később módosítod a szövegeidet, a fordítások nem frissülnek maguktól: az újragenerálás újra ennyibe kerül. A nyelveket ilyenkor cserélheted is.", { count: ml.count })}</p>` +
    statusBlock +
    links +
    `<p class="citui-hint" style="color:var(--citui-warn)"><strong>${T(lang, "Fontos:")}</strong> ${T(lang, "a fordítás a most elmentett tartalmadból készül. Mielőtt fizetsz, nézd át és mentsd el a szövegeidet (Szövegek, Modulok) — azt fordítjuk le, ami el van mentve.")}</p>` +
    `<p style="margin:8px 0 4px"><strong>${T(lang, "Válassz pontosan {count} nyelvet", { count: ml.count })}</strong> ` +
    `<span class="citui-hint">${T(lang, "(az oldalad saját nyelve — {name} — nem számít bele):", { name: esc(ml.primaryLangName) })}</span></p>` +
    `<div class="adm-mlang-grid">${picker}</div>` +
    `<div class="adm-total"><span><span class="citui-hint" style="margin:0">${T(lang, "Egyszeri díj")}</span><br>` +
    `<b>${esc(huf(ml.price))}</b> <span class="citui-hint" style="margin:0">${T(lang, "/ generálás")}</span></span>` +
    `<button class="citui-btn citui-btn--primary" type="submit">${btnLabel}</button></div>` +
    `</form>` +
    // Progressive enhancement: cap the picker at `count` — the server validates anyway.
    `<script>(function(){var f=document.getElementById("tobbnyelvu");if(!f)return;` +
    `var cbs=[].slice.call(f.querySelectorAll('input[name="lang"]'));function sync(){` +
    `var n=cbs.filter(function(c){return c.checked}).length;` +
    `cbs.forEach(function(c){c.disabled=!c.checked&&n>=${ml.count}});}` +
    `cbs.forEach(function(c){c.addEventListener("change",sync)});sync();})();</script>` +
    `<style>.adm-mlang-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:8px 0 4px}` +
    `.adm-mlang{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--citui-line);` +
    `border-radius:var(--citui-radius-sm);cursor:pointer}` +
    `.adm-mlang input{width:18px;height:18px;accent-color:var(--citui-cyan-500)}</style>`
  );
}

/** Admin sections — a real sidebar menu instead of one endless scroll (ADR-0034/0035). */
// A FUNCTION, not a const: the labels must be translated at RENDER time (the
// reader's language is only known then), and the T() calls must keep LITERAL
// source strings so the catalog extractor can see them (ADR-0067).
const TABS = (lang = "hu"): readonly { id: string; label: string; icon: string }[] => [
  { id: "attekintes", label: T(lang, "Áttekintés"), icon: "overview" },
  { id: "szovegek", label: T(lang, "Szövegek"), icon: "texts" },
  { id: "fotok", label: T(lang, "Fotók"), icon: "photos" },
  { id: "modulok", label: T(lang, "Modulok"), icon: "modules" },
  { id: "fiok", label: T(lang, "Fiók"), icon: "account" },
  // ADR-0045: the searchable knowledge base is its own surface, not only per-section icons.
  { id: "sugo", label: T(lang, "Súgó"), icon: "help" },
];

/** Sidebar / bottom-bar navigation links (icon + label), with the active item highlighted. */
function navItems(active: string, lang = "hu"): string {
  return TABS(lang).map(
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
  lang = "hu",
): string {
  const live = content.status === "live";
  const activeCount = mv ? mv.modules.filter((m) => m.active).length : 0;
  const addr = siteUrl
    ? `<a href="${esc(siteUrl)}" target="_blank" rel="noopener">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a>`
    : previewUrl
      ? `<a href="${esc(previewUrl)}" target="_blank" rel="noopener">${T(lang, "privát előnézet")}</a>`
      : `<span class="citui-hint">–</span>`;
  const todoItem = (done: boolean, html: string) =>
    `<li class="${done ? "done" : "pending"}"><span class="adm-tico">${ic(done ? "check" : "alert", 18)}</span><span>${html}</span></li>`;
  const todo =
    todoItem(
      content.usingOwnPhotos,
      content.usingOwnPhotos
        ? T(lang, "Saját fotóid vannak fent")
        : `<strong>${T(lang, "Tölts fel saját fotókat")}</strong> ${T(lang, "— jelenleg bemutató képek láthatók (")}<a href="/admin?tab=fotok">${T(lang, "Fotók")}</a>)`,
    ) +
    todoItem(
      Boolean(content.intro && content.intro.length > 40),
      content.intro && content.intro.length > 40
        ? T(lang, "Bemutatkozó szöveged kész")
        : `<strong>${T(lang, "Írd meg a bemutatkozó szöveget")}</strong> (<a href="/admin?tab=szovegek">${T(lang, "Szövegek")}</a>)`,
    ) +
    todoItem(
      live,
      live
        ? T(lang, "Az oldalad élő és nyilvános")
        : T(lang, "Az oldal még nem publikus — a Citoviso élesíti, amint minden készen áll"),
    );
  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("overview")}</span><h2>${T(lang, "Áttekintés")}</h2>${helpLink("admin.overview", lang)}</div>` +
    `<div class="adm-stats">` +
    `<div class="adm-stat"><b><span class="citui-pill ${live ? "citui-pill--ok" : "citui-pill--info"}">${esc(statusText)}</span></b><span>${T(lang, "Állapot")}</span></div>` +
    `<div class="adm-stat"><b style="font-size:1rem">${addr}</b><span>${T(lang, "Az oldal címe")}</span></div>` +
    `<div class="adm-stat"><b>${T(lang, "{n} db", { n: activeCount })}</b><span>${T(lang, "Aktív modul ·")} <a href="/admin?tab=modulok">${T(lang, "kezelés")}</a></span></div>` +
    `</div>` +
    `<h3 style="font-size:1rem;margin:24px 0 0;font-family:var(--citui-font-display)">${T(lang, "Teendők")}</h3>` +
    `<ul class="adm-todo">${todo}</ul>` +
    `</div>`
  );
}

function textsSection(content: NonNullable<AdminContent>, lang = "hu"): string {
  const highlights = (content.highlights ?? []).join("\n");
  return (
    `<form method="POST" action="/admin/text" class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("texts")}</span><h2>${T(lang, "Szövegek")}</h2>${helpLink("admin.texts", lang)}</div>` +
    `<p class="adm-lead">${T(lang, "Ezek a szövegek jelennek meg az oldaladon.")}</p>` +
    `<div class="citui-field"><label class="citui-label" for="name">${T(lang, "Vállalkozás neve")}</label>` +
    `<input class="citui-input" id="name" name="name" value="${esc(content.name)}"></div>` +
    `<div class="citui-field"><label class="citui-label" for="tagline">${T(lang, "Szlogen (rövid mondat a fejlécben)")}</label>` +
    `<input class="citui-input" id="tagline" name="tagline" value="${esc(content.tagline)}"></div>` +
    `<div class="citui-field"><label class="citui-label" for="intro">${T(lang, "Bemutatkozó szöveg")}</label>` +
    `<textarea class="citui-textarea" id="intro" name="intro" style="min-height:140px">${esc(content.intro)}</textarea></div>` +
    `<div class="citui-field"><label class="citui-label" for="highlights">${T(lang, "Kiemelések (soronként egy)")}</label>` +
    `<textarea class="citui-textarea" id="highlights" name="highlights" style="min-height:110px">${esc(highlights)}</textarea></div>` +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Mentés és frissítés")}</button>` +
    `</form>`
  );
}

function accountSection(session: TenantSession, lang = "hu"): string {
  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("account")}</span><h2>${T(lang, "Fiók")}</h2>${helpLink("admin.account", lang)}</div>` +
    `<div class="citui-field"><label class="citui-label">${T(lang, "Felhasználónév (belépéshez)")}</label>` +
    `<input class="citui-input" value="${esc(session.username)}" readonly style="background:var(--citui-surface-2)"></div>` +
    `<form method="POST" action="/admin/contact">` +
    `<div class="citui-field"><label class="citui-label" for="contact_email">${T(lang, "Kommunikációs e-mail (ide küldünk értesítést)")}</label>` +
    `<input class="citui-input" id="contact_email" name="contact_email" type="email" value="${esc(session.contactEmail)}" required></div>` +
    `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "E-mail mentése")}</button>` +
    `</form>` +
    `<form method="POST" action="/admin/password" style="margin-top:18px;padding-top:18px;border-top:1px solid var(--citui-line)">` +
    `<h3 style="font-size:1rem;margin:0 0 10px;font-family:var(--citui-font-display)">${T(lang, "Jelszó módosítása")}</h3>` +
    `<div class="citui-field"><label class="citui-label" for="pw_current">${T(lang, "Jelenlegi jelszó")}</label>` +
    `<input class="citui-input" id="pw_current" name="current" type="password" autocomplete="current-password" required></div>` +
    `<div class="citui-field"><label class="citui-label" for="pw_next">${T(lang, "Új jelszó (min. 8 karakter)")}</label>` +
    `<input class="citui-input" id="pw_next" name="next" type="password" autocomplete="new-password" minlength="8" required></div>` +
    `<div class="citui-field"><label class="citui-label" for="pw_next2">${T(lang, "Új jelszó még egyszer")}</label>` +
    `<input class="citui-input" id="pw_next2" name="next2" type="password" autocomplete="new-password" minlength="8" required></div>` +
    `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Jelszó módosítása")}</button>` +
    `</form></div>`
  );
}

/** Searchable knowledge base surface (ADR-0045): topic list + one open guide.
 *  Pure view — the entries are loaded and filtered by the caller (public.ts). */
function helpSection(help: NonNullable<AdminOpts["help"]>, lang = "hu"): string {
  const search =
    `<form method="GET" action="/admin" class="adm-kb-search">` +
    `<input type="hidden" name="tab" value="sugo">` +
    `<input class="citui-input" type="search" name="q" value="${esc(help.query)}" ` +
    `placeholder="${T(lang, "Miben segíthetünk? (pl. fotó, jelszó)")}" aria-label="${T(lang, "Keresés a súgóban")}">` +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Keresés")}</button></form>`;
  const inner = help.open
    ? `<a class="adm-kb-back" href="/admin?tab=sugo">${T(lang, "← Minden téma")}</a>` +
      `<article class="adm-kb-article">` +
      `<h2 style="font-size:1.2rem;font-family:var(--citui-font-display);margin:10px 0 4px">${esc(help.open.title)}</h2>` +
      help.open.html +
      (help.open.updated ? `<p class="citui-hint">${T(lang, "Frissítve: {date}", { date: esc(help.open.updated) })}</p>` : "") +
      `</article>`
    : help.topics.length
      ? `<div class="adm-kb-list">` +
        help.topics
          .map(
            (t) =>
              `<a class="adm-kb-item" href="/admin?tab=sugo&topic=${encodeURIComponent(t.id)}">` +
              `<strong>${esc(t.title)}</strong><span class="citui-hint">${esc(t.snippet)}…</span></a>`,
          )
          .join("") +
        `</div>`
      : `<p class="citui-hint">${T(lang, "Nincs találat a keresésre. Próbálja meg más szóval körülírni, vagy írjon nekünk — a Fiók fülön megadott e-mailről válaszolunk a leggyorsabban.")}</p>`;
  return (
    `<div class="adm-card"><div class="adm-card__head"><span class="adm-ico">${ic("help")}</span><h2>${T(lang, "Súgó")}</h2></div>` +
    `<p class="adm-lead">${T(lang, "Lépésről lépésre útmutatók a kezelőfelület minden részéhez. Ugyanide jut a lapokon látható {icon} ikonokkal is.", { icon: ic("help", 14) })}</p>` +
    search +
    inner +
    `</div>`
  );
}

export interface AdminOpts {
  readonly saved?: boolean;
  /**
   * The pay-link for a module upsell could not be issued (0033). Shown because
   * the alternative is a silent no-op: the owner ticks a module, gets bounced
   * back, and sees it switched off with no explanation.
   */
  readonly payError?: boolean;
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
  /** ADR-0045: Súgó tab data — filtered topic list, the open entry (rendered), the query. */
  readonly help?: {
    readonly topics: readonly { id: string; title: string; snippet: string }[];
    readonly open: { title: string; html: string; updated: string } | null;
    readonly query: string;
  } | null;
  /** ADR-0063: the one-time multilang module's card data (Modulok tab). */
  readonly multilang?: MultilangAdminData | null;
  /** POST /admin/multilang validation error to show on the card. */
  readonly multilangError?: string | null;
}

export function adminDashboard(
  session: TenantSession,
  content: AdminContent,
  opts: AdminOpts = {},
): string {
  const {
    saved = false,
    payError = false,
    previewToken = null,
    modules: mv = null,
    supportEmail = "hello@citoviso.com",
    siteUrl = null,
  } = opts;
  // ADR-0067: the owner's own site language drives the WHOLE admin. Falls back to
  // Hungarian only when there is no site yet (nothing to derive it from).
  const lang = content?.lang ?? "hu";
  const tab = TABS().some((t) => t.id === opts.tab) ? opts.tab! : "attekintes";
  const tabLabel = TABS(lang).find((t) => t.id === tab)?.label ?? T(lang, "Áttekintés");
  const statusLabel: Record<string, string> = {
    provisioned: T(lang, "Előnézet (még nem publikus)"),
    live: T(lang, "Élő (publikus)"),
    draft: T(lang, "Vázlat"),
    suspended: T(lang, "Felfüggesztve"),
    deactivated: T(lang, "Deaktiválva"),
  };
  const previewUrl = previewToken ? `/site/${previewToken}` : null;
  const sideBrand = LOGO.replace("citui-brand--ink", "").replace('fill="#16283f"', 'fill="#fff"');

  if (!content) {
    return shell(
      T(lang, "Admin"),
      ADM_STYLE +
        `<div class="adm-shell"><aside class="adm-side"><div class="adm-side__brand">${sideBrand}</div>` +
        `<nav class="adm-nav">${navItems(tab, lang)}</nav>` +
        `<div class="adm-side__foot"><span class="adm-side__user">${esc(session.username)}</span>` +
        `<a class="adm-side__out" href="/logout">${T(lang, "Kilépés")}</a></div></aside>` +
        `<main class="adm-main"><div class="adm-main__inner"><div class="adm-card">` +
        `<h1>${T(lang, "Üdv, {name}!", { name: esc(session.displayName) })}</h1>` +
        `<p class="citui-hint">${T(lang, "Ehhez a fiókhoz még nincs szerkeszthető oldal. Amint elkészül az oldalad, itt tudod majd szerkeszteni.")}</p>` +
        `</div></div></main></div>`,
      lang,
    );
  }

  const savedNote = payError
    ? `<div class="adm-saved" role="alert">${ic("check", 18)} ${T(lang, "A fizetési oldalt nem sikerült megnyitni, ezért az új modult NEM kapcsoltuk be — és nem is számoltunk fel érte semmit. Próbáld újra, vagy írj nekünk.")}</div>`
    : saved
    ? `<div class="adm-saved">${ic("check", 18)} ${T(lang, "Mentve — az oldalad frissült.")}</div>`
    : "";
  const viewBtn = previewUrl
    ? `<a class="adm-viewbtn" href="${esc(siteUrl ?? previewUrl)}" target="_blank" rel="noopener">${ic("external", 16)} ${T(lang, "Oldal megtekintése")}</a>`
    : "";

  const section =
    tab === "sugo"
      ? helpSection(opts.help ?? { topics: [], open: null, query: "" }, lang)
      : tab === "szovegek"
      ? textsSection(content, lang)
      : tab === "fotok"
        ? photosCard(content, opts.units ?? [], lang)
        : tab === "modulok"
          ? // ADR-0044: ?m=<id> opens that module's own settings screen; without it
            // the tab is the on/off list. One screen = one decision.
            (opts.moduleSettingsHtml ??
              (mv
                ? modulesSection(mv, supportEmail, lang) +
                  // ADR-0063: the one-time multilang module has its own card — it is
                  // NOT a free toggle, so it lives outside the toggle form.
                  (opts.multilang
                    ? (opts.multilangError
                        ? `<div class="adm-saved" role="alert">${ic("alert", 18)} ${esc(opts.multilangError)}</div>`
                        : "") + multilangSection(opts.multilang, lang)
                    : "")
                : `<div class="adm-card"><p class="citui-hint">${T(lang, "A modulok jelenleg nem érhetők el.")}</p></div>`))
          : tab === "fiok"
            ? accountSection(session, lang)
            : overviewSection(
                content,
                statusLabel[content.status] ?? content.status,
                siteUrl,
                previewUrl,
                mv,
                lang,
              );

  return shell(
    T(lang, "Admin"),
    ADM_STYLE +
      `<div class="adm-shell">` +
      // Desktop sidebar
      `<aside class="adm-side"><div class="adm-side__brand">${sideBrand}</div>` +
      `<nav class="adm-nav">${navItems(tab, lang)}</nav>` +
      `<div class="adm-side__foot"><span class="adm-side__user">${esc(session.username)}</span>` +
      `<a class="adm-side__out" href="/logout">${T(lang, "Kilépés")}</a></div></aside>` +
      `<main class="adm-main">` +
      // Mobile top bar (brand + logout); the nav lives in the bottom bar on mobile
      `<div class="adm-topbar"><span class="adm-tb-brand">${sideBrand}</span><a href="/logout">${T(lang, "Kilépés")}</a></div>` +
      `<div class="adm-main__inner">` +
      `<div class="adm-pagehead"><h1>${esc(tabLabel)}</h1>${viewBtn}</div>` +
      `<p class="adm-sub">${esc(session.displayName)}</p>` +
      savedNote +
      section +
      `</div></main></div>` +
      (tab === "fotok" ? UPLOAD_SCRIPT(lang) : "") +
      // The photo cards (order/caption) and the module screens share one stylesheet.
      (tab === "modulok" || tab === "fotok" ? MODCFG_STYLE : ""),
    lang,
  );
}
