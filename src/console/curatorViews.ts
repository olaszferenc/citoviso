// POE — THE CURATOR'S TWO VIEWS (approved plan, the contract:
// assets/design-refs/console/poe-curator/).
//
//   ① „Forrás-csomag” — a lead-page tab: EXACTLY what the copywriter is given (sourcePack.ts →
//      writerSources.ts), loaded lazily when the tab opens (the photo lookup measures liveness).
//      Read-only: opening it calls neither Places nor an AI model.
//   ② „Generálás kurátori szöveggel” — ONE form component, two entrances (the „Mock és
//      generálás” panel and its own page /lead/:id/curate). Live validation = the SERVER's
//      real validateCuratorCopy (POST /lead/:id/curated-check), never a client copy;
//      submit = POST /lead/:id/generate-curated (the same background run as /generate).
//
// Every word the scripts show is worded here (i18n) and handed over as data.

import { COPY_LIMITS, manualCopyOf, type CopyKey } from "../engine/copyFields.js";
import { T } from "../i18n/mail.js";
import { ic } from "../ui/icons.js";
import { copyFieldLabel, fieldWhere } from "./copyEditViews.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON for an inline <script>: "</" must never close the script element. */
function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

/** The fields the form offers, in the plan's order (the template path's recipe). */
const FORM_KEYS: readonly CopyKey[] = [
  "hero.lead",
  "hero.accent",
  "tagline",
  "hero.eyebrow",
  "intro",
  "highlights",
  "features.eyebrow",
  "features.title",
  "gallery.eyebrow",
  "gallery.title",
  "reviews.eyebrow",
  "reviews.title",
  "location.eyebrow",
  "location.title",
];

const CSS = `<style>
.cur-blk{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:12px 14px;margin:0 0 12px;min-width:0}
.cur-blk h3{font-family:var(--citui-font-display);font-size:.95rem;margin:0 0 2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cur-blk .why{font-size:12px;color:var(--citui-muted);margin:2px 0 10px;line-height:1.45}
.cur-blk.off{background:var(--citui-surface-2);border-style:dashed}
.cur-grid{display:grid;grid-template-columns:1fr;gap:0 12px}
@media (min-width:900px){.cur-grid{grid-template-columns:1fr 1fr}.cur-grid .span2{grid-column:1/-1}}
.cur-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:var(--citui-radius-pill);background:var(--citui-surface-2);color:var(--citui-ink);white-space:nowrap}
.cur-pill.ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.cur-pill.bad{background:color-mix(in srgb,var(--citui-bad) 12%,var(--citui-white));color:var(--citui-bad-ink)}
.cur-pill.warn{background:color-mix(in srgb,var(--citui-warn) 18%,var(--citui-white));color:var(--citui-warn-ink)}
.cur-pill.no{background:var(--citui-white);border:1px solid var(--citui-line-strong);color:var(--citui-muted)}
.cur-kv{display:grid;grid-template-columns:max-content 1fr;gap:6px 12px;margin:0;font-size:13px}
.cur-kv dt{color:var(--citui-muted);font-size:12px}.cur-kv dd{margin:0;min-width:0;overflow-wrap:anywhere}
.cur-am{margin:0;padding-left:22px;font-size:13px}@media (min-width:560px){.cur-am{columns:2}}
.cur-am li{padding:2px 0;break-inside:avoid}.cur-am .src{font-size:11px;color:var(--citui-muted)}
.cur-item{border-top:1px solid var(--citui-line);padding:10px 0}.cur-item:first-child{border-top:0;padding-top:2px}
.cur-item .hd{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;margin-bottom:6px}
.cur-item.dropped .cur-txt{text-decoration:line-through;color:var(--citui-muted)}
.cur-txt{font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--citui-surface);border-radius:10px;padding:8px 10px;max-height:9.5em;overflow:hidden}
.cur-txt.open{max-height:none}
.cur-lnk{background:none;border:0;padding:4px 0 0;font:600 12px/1.2 var(--citui-font-text);color:var(--citui-link-ink);cursor:pointer;text-decoration:underline}
.cur-flag{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.45;border-radius:10px;padding:8px 10px;margin:0 0 10px;background:color-mix(in srgb,var(--citui-warn) 12%,var(--citui-white));color:var(--citui-warn-ink)}
.cur-photos{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media (min-width:900px){.cur-photos{grid-template-columns:repeat(4,1fr)}}
.cur-photos figure{margin:0}.cur-photos img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;display:block;background:var(--citui-surface-2)}
.cur-photos figcaption{font-size:11px;color:var(--citui-muted);padding-top:3px}
.cur-vis{width:100%;border-collapse:collapse;font-size:12.5px}
.cur-vis th,.cur-vis td{text-align:left;padding:6px;border-top:1px solid var(--citui-line);vertical-align:top}
.cur-vis th{font-size:11px;color:var(--citui-muted);border-top:0}.cur-vis td.c,.cur-vis th.c{text-align:center;white-space:nowrap}
.cur-yes{color:var(--citui-ok-ink);font-weight:700}.cur-nope{color:var(--citui-muted)}
.cur-rooms{display:flex;flex-wrap:wrap;gap:6px}.cur-rooms span{font-size:12px;border:1px dashed var(--citui-line-strong);border-radius:8px;padding:4px 8px;color:var(--citui-muted)}
.cur-json{font:11.5px/1.45 ui-monospace,monospace;background:var(--citui-navy-950);color:var(--citui-surface);border-radius:10px;padding:10px;max-height:360px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.cur-f{margin:0 0 12px}.cur-f label.l{display:block;font-weight:600;font-size:13px;margin-bottom:3px}
.cur-f input[type=text],.cur-f textarea{width:100%;padding:7px 9px;font:inherit;font-size:13px;border:1px solid var(--citui-line-strong);border-radius:8px;background:var(--citui-white);color:var(--citui-ink)}
.cur-f .where{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 5px;font-size:11.5px;color:var(--citui-muted)}
.cur-f .ft{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--citui-muted);margin-top:3px}
.cur-f .msg{font-size:12px;margin-top:3px}.cur-f .msg.bad{color:var(--citui-bad-ink)}.cur-f .msg.warn{color:var(--citui-warn-ink)}
.cur-f.err input,.cur-f.err textarea{border-color:var(--citui-bad)}.cur-f.dim{opacity:.6}
.cur-f .live{font-size:12.5px;margin-top:4px}
.cur-row{display:flex;gap:6px;margin:0 0 6px}.cur-row input{flex:1;min-width:0}
.cur-tpls{display:flex;gap:6px;flex-wrap:wrap}.cur-tpls label{display:inline-flex;gap:6px;align-items:center;font-size:13px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-pill);padding:5px 11px;cursor:pointer}
.cur-sum{font-size:13px;margin:10px 0}.cur-sum .bad{color:var(--citui-bad-ink)}.cur-sum .warn{color:var(--citui-warn-ink)}
.cur-warns{margin:6px 0 0;padding-left:18px;font-size:12px;color:var(--citui-warn-ink)}
.con-mkcopy__pill--poe{background:var(--citui-navy-900);color:var(--citui-white)}
</style>`;

/**
 * ① The „Forrás-csomag” tab body. Empty shell + a script that fetches
 * /lead/:id/source-pack.json the FIRST time the tab is shown (or the page opens on it).
 */
export function sourcePackPane(leadId: string, lang: string): string {
  const S = {
    loading: T(lang, "Forrás-csomag betöltése…"),
    failed: T(lang, "A forrás-csomag nem töltődött be: {m}"),
    idTitle: T(lang, "Azonosság és hely"),
    idWhy: T(lang, "A szöveg csak ezt a nevet és ezt a helyet nevezheti meg."),
    name: T(lang, "Név"),
    town: T(lang, "Település"),
    address: T(lang, "Cím"),
    region: T(lang, "Régió"),
    regionCtx: T(lang, "Régió-jellemzés"),
    noRegion: T(lang, "NINCS ADAT — a régió kimarad a csomagból, a szövegíró utasítást kap, hogy ne találjon ki régiót"),
    generic: T(lang, "általános, nem erről a házról"),
    statsTitle: T(lang, "Valós számok"),
    statsWhy: T(lang, "Szám a szövegben csak innen jöhet. Más szám (szoba, m², km, ár) = kitalált tény."),
    rating: T(lang, "Google-átlag"),
    ratingCount: T(lang, "{n} értékelés"),
    noStats: T(lang, "Nincs hivatkozható Google-értékelés."),
    lowRating: T(lang, "A Google-átlag {r} — a mockon ez a szám megjelenik. Ne írjon olyat, ami vele ütközik („a vendégek kedvence”)."),
    amTitle: T(lang, "Igazolt szolgáltatások"),
    amWhy: T(lang, "A portál jellemző-listája + a leírásból kiemelt tételek, erősség szerint. A „leírásból” jelölésű tétel szó-egyezés — a leírás szövegében ellenőrizze."),
    fromDesc: T(lang, "leírásból"),
    fromList: T(lang, "portál-lista"),
    items: T(lang, "{n} tétel"),
    pcs: T(lang, "{n} db"),
    descTitle: T(lang, "Portál-leírások"),
    descWhy: T(lang, "A modell ezt a levágott szöveget látja (≤{n} karakter/db), a tulaj saját bemutatkozása ELSŐ. Idézet-alapú tény csak ebben és a vendég-hangban lehet."),
    ownerIntro: T(lang, "a tulaj bemutatkozása"),
    noOwnerIntro: T(lang, "Nincs a tulaj saját bemutatkozása — a szövegek portálé, harmadik személyben vagy hirdetés-hangon."),
    chars: T(lang, "{n} karakter"),
    full: T(lang, "Teljes szöveg"),
    less: T(lang, "Kevesebb"),
    voiceTitle: T(lang, "Vendég-hang"),
    voiceWhy: T(lang, "≤{max} db, ≥30 karakter, duplikátum nélkül, csak ≥{min}★ (a csillag nélküli portál-vélemény marad). A kiszűrtek áthúzva, okkal."),
    stale: T(lang, "A tárolt Google-vélemények 30 napnál régebbiek — ez a nézet nem kéri le újra, a generálás frissíti (Places-hívás). Ha a frissítés nem sikerül, a generálás nélkülük fut."),
    used: T(lang, "megy a szövegírónak"),
    why_stars: T(lang, "kiszűrve: {min}★ alatti"),
    why_short: T(lang, "kiszűrve: túl rövid"),
    why_duplicate: T(lang, "kiszűrve: duplikátum"),
    why_overflow: T(lang, "kiszűrve: a {max}-es kereten túli"),
    guest: T(lang, "vendég"),
    noVoice: T(lang, "Nincs vendég-hang a csomagban."),
    photosTitle: T(lang, "A modell által látott fotók"),
    photosWhy: T(lang, "A lead {n} tárolt fotójából csak az első {k} megy a modellnek. Amit a szöveg a képről állít, annak ezeken kell látszania."),
    photoCap: T(lang, "{i}. fotó"),
    noPhotos: T(lang, "Nincs tárolt, hiteles fotó."),
    visTitle: T(lang, "Kitöltendő mezők sablononként"),
    visWhy: T(lang, "Mely szöveg-mező kerül ki a lapra az adott sablonon (próba-render; a recept szakaszai: {s}). A „nem látszik” mezőt is érdemes kitölteni: más sablonon megjelenhet."),
    field: T(lang, "Mező"),
    max: T(lang, "max"),
    shows: T(lang, "látszik"),
    hidden: T(lang, "nem látszik"),
    inLead: T(lang, "a főcímben dőlten"),
    roomsTitle: T(lang, "Szobák"),
    roomsPill: T(lang, "a szövegíró NEM látja"),
    roomsWhy: T(lang, "A szobák közvetlenül a szoba-szakaszba kerülnek, nem részei a szövegíró csomagjának: a szövegben szobaszámot, szobanevet ne írjon."),
    roomsCount: T(lang, "{n} egység"),
    noRooms: T(lang, "A portál nem ad meg szobát."),
    rawTitle: T(lang, "A csomag nyersen"),
    open: T(lang, "Megnyitom"),
    close: T(lang, "Becsukom"),
    foot: T(lang, "Tárolt adat — a lap megnyitása semmit nem hív (Places, AI)."),
  };
  const labels: Record<string, string> = {};
  for (const k of FORM_KEYS) labels[k] = copyFieldLabel(k, lang);
  return `${CSS}<div data-cur-pack="${esc(leadId)}">
      <p class="small mut" style="margin:2px 4px 12px">${T(lang, "Ezt kapja a szövegíró — se többet, se kevesebbet. Amit itt nem lát, azt a szövegben állítani sem szabad (§B.17).")}
        <a href="/lead/${esc(leadId)}/curate">${T(lang, "Generálás kurátori szöveggel")} →</a></p>
      <div class="cur-grid" data-cur-pack-body><p class="mut">${esc(S.loading)}</p></div>
    </div>
    <script>
    (function () {
      var root = document.querySelector('[data-cur-pack]'); if (!root) return;
      var LEAD = root.getAttribute('data-cur-pack'), S = ${scriptJson(S)}, LABELS = ${scriptJson(labels)};
      var body = root.querySelector('[data-cur-pack-body]'), loaded = false;
      function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
      function f(t, o) { return String(t).replace(/\\{(\\w+)\\}/g, function (m, k) { return o && o[k] != null ? o[k] : m; }); }
      var WARN = ${scriptJson(ic("alert", 15))};
      function blk(title, pill, why, inner, cls) {
        return '<section class="cur-blk ' + (cls || '') + '"><h3>' + esc(title) + (pill ? ' ' + pill : '') + '</h3>' + (why ? '<div class="why">' + why + '</div>' : '') + inner + '</section>';
      }
      function pill(t, k) { return '<span class="cur-pill ' + (k || '') + '">' + esc(t) + '</span>'; }
      function txt(t, i) { return '<div class="cur-txt" id="cur-t' + i + '">' + esc(t) + '</div><button type="button" class="cur-lnk" data-cur-open="cur-t' + i + '">' + esc(S.full) + '</button>'; }
      function render(p) {
        var n = 0, h = '';
        var id = p.identity;
        h += blk(S.idTitle, '', esc(S.idWhy), '<dl class="cur-kv"><dt>' + esc(S.name) + '</dt><dd><b>' + esc(id.name) + '</b></dd><dt>' + esc(S.town) + '</dt><dd>' + esc(id.town || '—') + '</dd><dt>' + esc(S.address) + '</dt><dd>' + esc(id.address || '—') + '</dd><dt>' + esc(S.region) + '</dt><dd>' +
          (id.region ? esc(id.region.label) + '</dd><dt>' + esc(S.regionCtx) + '</dt><dd>' + esc(id.region.context) + ' ' + pill(S.generic, 'warn') : '<b class="cur-nope">' + esc(S.noRegion) + '</b>') + '</dd></dl>');
        var rs = p.realStats;
        h += blk(S.statsTitle, '', esc(S.statsWhy), rs ? '<dl class="cur-kv"><dt>' + esc(S.rating) + '</dt><dd><b>' + esc(rs.rating) + '</b>' + (rs.count != null ? ' · ' + esc(f(S.ratingCount, { n: rs.count })) : '') + '</dd></dl>' +
          (rs.rating < 3.5 ? '<div class="cur-flag" style="margin-top:10px">' + WARN + '<span>' + esc(f(S.lowRating, { r: rs.rating })) + '</span></div>' : '') : '<p class="mut small">' + esc(S.noStats) + '</p>');
        h += blk(S.amTitle, pill(f(S.items, { n: p.amenities.length })), esc(S.amWhy), '<ol class="cur-am">' + p.amenities.map(function (a) {
          return '<li>' + esc(a.label) + ' <span class="src">· ' + esc(a.origin === 'description' ? S.fromDesc : S.fromList) + '</span></li>'; }).join('') + '</ol>', 'span2');
        var hasOwner = p.descriptions.some(function (d) { return d.source === 'owner_intro'; });
        h += blk(S.descTitle, pill(f(S.pcs, { n: p.descriptions.length })), esc(f(S.descWhy, { n: p.limits.descriptionChars })),
          (hasOwner ? '' : '<div class="cur-flag">' + WARN + '<span>' + esc(S.noOwnerIntro) + '</span></div>') +
          p.descriptions.map(function (d) { return '<div class="cur-item"><div class="hd"><b>' + esc(d.source === 'owner_intro' ? S.ownerIntro : d.source) + '</b><span class="mut">' + esc(f(S.chars, { n: d.text.length })) + '</span></div>' + txt(d.text, n++) + '</div>'; }).join(''), 'span2');
        var v = p.voice, vi = v.used.map(function (r) { return { r: r, why: '' }; }).concat(v.dropped.map(function (d) { return { r: d.review, why: d.reason }; }));
        h += blk(S.voiceTitle, pill(f(S.pcs, { n: v.used.length })), esc(f(S.voiceWhy, { max: v.max, min: v.minStars })),
          (v.googleStale ? '<div class="cur-flag" data-cur-stale>' + WARN + '<span>' + esc(S.stale) + '</span></div>' : '') +
          (vi.length ? vi.map(function (x) { var r = x.r;
            return '<div class="cur-item' + (x.why ? ' dropped' : '') + '"><div class="hd">' + (r.rating != null ? '<b>' + esc(r.rating) + '★</b>' : '') + pill(r.source === 'google_places' ? 'Google' : (r.source || S.guest)) +
              pill(x.why ? f(S['why_' + x.why] || x.why, { min: v.minStars, max: v.max }) : S.used, x.why ? (x.why === 'stars' ? 'bad' : 'no') : 'ok') + '<span class="mut">' + esc(f(S.chars, { n: r.text.length })) + '</span></div>' + txt(r.text, n++) + '</div>'; }).join('')
            : '<p class="mut small">' + esc(S.noVoice) + '</p>'), 'span2');
        h += blk(S.photosTitle, pill(p.visionPhotos + ' / ' + p.photos.length), esc(f(S.photosWhy, { n: p.photos.length, k: p.visionPhotos })),
          p.photos.length ? '<div class="cur-photos">' + p.photos.slice(0, p.visionPhotos).map(function (u, i) { return '<figure><img src="' + esc(u) + '" alt="' + esc(id.name) + ' — ' + (i + 1) + '" loading="lazy"><figcaption>' + esc(f(S.photoCap, { i: i + 1 })) + '</figcaption></figure>'; }).join('') + '</div>' : '<p class="mut small">' + esc(S.noPhotos) + '</p>', 'span2');
        var fv = p.fieldVisibility;
        if (fv) {
          var tp = fv.templates;
          h += blk(S.visTitle, '', esc(f(S.visWhy, { s: fv.sections.join(' · ') })), '<div style="overflow-x:auto"><table class="cur-vis" data-cur-vis><tr><th>' + esc(S.field) + '</th><th>' + esc(S.max) + '</th>' + tp.map(function (t) { return '<th class="c">' + esc(t.label) + '</th>'; }).join('') + '</tr>' +
            fv.fields.map(function (fl) { return '<tr><td><b>' + esc(LABELS[fl.key] || fl.key) + '</b></td><td>' + fl.max + '</td>' + tp.map(function (t) { var on = t.shows.indexOf(fl.key) >= 0;
              return '<td class="c">' + (fl.key === 'hero.accent' && on ? '<span class="cur-yes">' + esc(S.inLead) + '</span>' : on ? '<span class="cur-yes">' + esc(S.shows) + '</span>' : '<span class="cur-nope">' + esc(S.hidden) + '</span>') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>', 'span2');
        }
        var rm = p.rooms;
        h += blk(S.roomsTitle, pill(S.roomsPill, 'no'), esc(S.roomsWhy), (rm.names.length || rm.count) ? '<div class="cur-rooms">' + (rm.names.length ? rm.names.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') : '<span>' + esc(f(S.roomsCount, { n: rm.count })) + '</span>') + '</div>' : '<p class="mut small">' + esc(S.noRooms) + '</p>', 'off span2');
        h += blk(S.rawTitle, '', '', '<button type="button" class="cur-lnk" data-cur-raw>' + esc(S.open) + '</button><pre class="cur-json" hidden data-cur-rawbox>' + esc(JSON.stringify(p, null, 2)) + '</pre>', 'span2');
        body.innerHTML = h + '<p class="small mut span2">' + esc(S.foot) + '</p>';
      }
      function load() {
        if (loaded) return; loaded = true;
        fetch('/lead/' + LEAD + '/source-pack.json').then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || r.status); return j; }); })
          .then(render, function (e) { loaded = false; body.innerHTML = '<p class="cur-flag">' + esc(f(S.failed, { m: e.message })) + '</p>'; });
      }
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cur-open]');
        if (b) { var t = document.getElementById(b.getAttribute('data-cur-open')); t.classList.toggle('open'); b.textContent = t.classList.contains('open') ? S.less : S.full; return; }
        if (e.target.closest('[data-cur-raw]')) { var x = root.querySelector('[data-cur-rawbox]'); x.hidden = !x.hidden; e.target.textContent = x.hidden ? S.open : S.close; }
      });
      // LAZY: the first time the pane is on screen (tab click, #ls-source, or no tab script at all).
      var pane = root.closest('.con-tabp');
      function check() { if (!pane || pane.classList.contains('on')) load(); }
      document.addEventListener('click', function (e) { if (e.target.closest('[data-tab="ls-source"]')) setTimeout(check, 0); });
      window.addEventListener('hashchange', check);
      setTimeout(check, 0);
    })();
    </script>`;
}

export interface CuratorFormOpts {
  readonly leadId: string;
  readonly lang: string;
  /** The daily AI ceiling is reached → the button stays disabled, the line says why. */
  readonly blockedMessage: string | null;
  /** Templates to pre-tick (the standalone page's ?t=a,b — from Neo's ticket). */
  readonly preselect?: readonly string[];
  /** A generation already runs on this lead. */
  readonly running: boolean;
}

/**
 * ② „Generálás kurátori szöveggel” — the ONE form, used by the panel and by /lead/:id/curate.
 * Its field/visibility model loads lazily (/lead/:id/source-pack.json?part=fields) the first
 * time it is opened.
 */
export function curatorForm(o: CuratorFormOpts): string {
  const { lang } = o;
  const labels: Record<string, { label: string; where: string }> = {};
  for (const k of FORM_KEYS) labels[k] = { label: copyFieldLabel(k, lang), where: fieldWhere(k, lang) };
  const S = {
    loading: T(lang, "Az űrlap betöltése…"),
    failed: T(lang, "Az űrlap nem töltődött be: {m}"),
    tplHead: T(lang, "Sablon — 1 vagy 2, a jegy szerint; mindkettő ugyanazt a szöveget kapja"),
    tplNone: T(lang, "Legalább egy sablont válasszon."),
    tplMax: T(lang, "Legfeljebb 2 sablon."),
    req: T(lang, "kötelező"),
    shows: T(lang, "{t}: látszik"),
    hidden: T(lang, "{t}: NEM látszik"),
    inLead: T(lang, "{t}: a főcímben dőlten"),
    count: T(lang, "{n} / {max}"),
    accentNot: T(lang, "Nincs benne szó szerint a főcímben — így dőlt rész nélkül jelenik meg."),
    lookLike: T(lang, "Így jelenik meg:"),
    hlHead: T(lang, "Kiemelések"),
    hlWhere: T(lang, "1–6 db, egyenként ≤{n} karakter; berendezés-leírás („bézs csempés fürdő”) kiesik"),
    hlAdd: T(lang, "+ Új kiemelés"),
    hlDel: T(lang, "Kiemelés törlése"),
    spHead: T(lang, "Igazolt tények (idézettel)"),
    spWhere: T(lang, "Opcionális. Címke + az idézet SZÓ SZERINT a forrásból (portál-leírás vagy vélemény). Amelyik idézet nem egyezik, az kiesik — a generálás nem áll meg miatta."),
    spAdd: T(lang, "+ Új tény"),
    spDel: T(lang, "Tény törlése"),
    spLabel: T(lang, "Címke (pl. játszótér a kertben)"),
    spQuote: T(lang, "Idézet szó szerint a forrásból"),
    accHead: T(lang, "Akcentszín"),
    accWhere: T(lang, "Opcionális, #rrggbb. Üresen a sablon saját akcentje marad."),
    checking: T(lang, "Ellenőrzés…"),
    errors: T(lang, "{n} hiba — így nem generálható."),
    ok: T(lang, "Generálható · {n} mock ({t})"),
    warns: T(lang, "{n} figyelmeztetés"),
    go: T(lang, "Generálás ezzel a szöveggel"),
    starting: T(lang, "Indítás…"),
    running: T(lang, "Erre a leadre már fut egy generálás."),
    checkFailed: T(lang, "Az ellenőrzés nem futott le: {m}"),
  };
  const boot = {
    lead: o.leadId,
    blocked: o.blockedMessage,
    running: o.running,
    preselect: o.preselect ?? [],
    limits: COPY_LIMITS,
    keys: FORM_KEYS,
  };
  const x = ic("close", 14);
  return `${CSS}<div class="cur-form" data-cur-form>
      <p class="small mut" style="margin:0 0 10px">${T(lang, "A szöveget Ön írja, a gép csak a fotókat és a kinézetet adja hozzá — AI-szövegíró nem fut, a három őr egyszer ítél. Forrás: a Forrás-csomag fül; ami ott nincs, azt itt ne állítsa.")}</p>
      ${o.blockedMessage ? `<div class="con-ai-msg con-ai-msg--bad" style="margin:0 0 12px">${ic("alert", 15)}<span>${esc(o.blockedMessage)}</span></div>` : ""}
      <div data-cur-form-body><p class="mut">${esc(S.loading)}</p></div>
      <div class="cur-sum" data-cur-sum aria-live="polite"></div>
      <button type="button" class="gen-go" data-cur-go disabled>${esc(S.go)}</button>
    </div>
    <script>
    (function () {
      var root = document.querySelector('[data-cur-form]'); if (!root || root.getAttribute('data-ready')) return;
      root.setAttribute('data-ready', '1');
      var B = ${scriptJson(boot)}, S = ${scriptJson(S)}, LB = ${scriptJson(labels)}, XI = ${scriptJson(x)};
      var body = root.querySelector('[data-cur-form-body]'), sum = root.querySelector('[data-cur-sum]'), go = root.querySelector('[data-cur-go]');
      var FV = null, V = {}, HL = [''], SP = [{ label: '', quote: '' }], ACC = '', SEL = {}, verdict = null, timer = 0, seq = 0, busy = false;
      function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
      function f(t, o) { return String(t).replace(/\\{(\\w+)\\}/g, function (m, k) { return o && o[k] != null ? o[k] : m; }); }
      function maxOf(k) { var x = FV.fields.filter(function (q) { return q.key === k; })[0]; return x ? x.max : 0; }
      function reqOf(k) { var x = FV.fields.filter(function (q) { return q.key === k; })[0]; return x ? x.required : false; }
      function sel() { return FV ? FV.templates.filter(function (t) { return SEL[t.id]; }) : []; }
      function fieldHTML(k) {
        var big = k === 'intro' || k === 'hero.lead' || k === 'tagline' || /\\.title$/.test(k);
        return '<div class="cur-f" data-k="' + k + '"><label class="l" for="cur-' + k + '">' + esc(LB[k].label) + (reqOf(k) ? ' <span class="cur-pill">' + esc(S.req) + '</span>' : '') + '</label>' +
          '<div class="where" data-where="' + k + '"></div><div class="where">' + esc(LB[k].where) + '</div>' +
          (big ? '<textarea id="cur-' + k + '" data-in="' + k + '" rows="' + (k === 'intro' ? 5 : 2) + '"></textarea>' : '<input type="text" id="cur-' + k + '" data-in="' + k + '">') +
          (k === 'hero.lead' ? '<div class="live" data-live></div>' : '') + '<div class="msg"></div><div class="ft"><span></span><span class="n"></span></div></div>';
      }
      function build() {
        var h = '<div class="cur-f"><label class="l">' + esc(S.tplHead) + '</label><div class="cur-tpls">' + FV.templates.map(function (t) {
          return '<label><input type="checkbox" data-tpl="' + esc(t.id) + '"' + (SEL[t.id] ? ' checked' : '') + '> ' + esc(t.label) + '</label>'; }).join('') + '</div><div class="msg" data-tpl-msg></div></div>';
        B.keys.forEach(function (k) {
          if (k === 'highlights') {
            h += '<div class="cur-f" data-k="highlights"><label class="l">' + esc(S.hlHead) + ' <span class="cur-pill">' + esc(S.req) + '</span></label><div class="where" data-where="highlights"></div><div class="where">' + esc(f(S.hlWhere, { n: B.limits.highlight })) + '</div><div data-hl></div><div class="msg"></div><div class="ft"><button type="button" class="con-btn con-btn--sm" data-hl-add>' + esc(S.hlAdd) + '</button><span class="n"></span></div></div>';
          } else h += fieldHTML(k);
        });
        h += '<div class="cur-f" data-k="sellingPoints"><label class="l">' + esc(S.spHead) + '</label><div class="where">' + esc(S.spWhere) + '</div><div data-sp></div><div class="msg"></div><div class="ft"><button type="button" class="con-btn con-btn--sm" data-sp-add>' + esc(S.spAdd) + '</button><span class="n"></span></div></div>';
        h += '<div class="cur-f" data-k="accent"><label class="l" for="cur-accent">' + esc(S.accHead) + '</label><div class="where">' + esc(S.accWhere) + '</div><input type="text" id="cur-accent" data-acc placeholder="#rrggbb" maxlength="9" spellcheck="false" autocomplete="off" style="max-width:160px"><div class="msg"></div></div>';
        body.innerHTML = h; rows();
      }
      function rows() {
        body.querySelector('[data-hl]').innerHTML = HL.map(function (v, i) { return '<div class="cur-row"><input type="text" data-hlv="' + i + '" value="' + esc(v) + '" aria-label="' + esc(S.hlHead) + ' ' + (i + 1) + '"><button type="button" class="con-btn con-btn--sm" data-hl-del="' + i + '" aria-label="' + esc(S.hlDel) + '">' + XI + '</button></div>'; }).join('');
        body.querySelector('[data-hl-add]').disabled = HL.length >= B.limits.highlightsMax;
        body.querySelector('[data-sp]').innerHTML = SP.map(function (p, i) { return '<div class="cur-row"><input type="text" data-spl="' + i + '" value="' + esc(p.label) + '" placeholder="' + esc(S.spLabel) + '" aria-label="' + esc(S.spLabel) + '"><input type="text" data-spq="' + i + '" value="' + esc(p.quote) + '" placeholder="' + esc(S.spQuote) + '" aria-label="' + esc(S.spQuote) + '"><button type="button" class="con-btn con-btn--sm" data-sp-del="' + i + '" aria-label="' + esc(S.spDel) + '">' + XI + '</button></div>'; }).join('');
      }
      function copy() {
        var fields = {};
        B.keys.forEach(function (k) { if (k === 'highlights') fields.highlights = HL.filter(function (x) { return x.trim(); }); else if ((V[k] || '').trim()) fields[k] = V[k]; });
        var sp = SP.filter(function (p) { return p.label.trim() || p.quote.trim(); });
        return { fields: fields, sellingPoints: sp, accent: ACC.trim() || undefined };
      }
      function paint() {
        var ts = sel(), errs = verdict && !verdict.ok ? verdict.errors || {} : {}, warns = verdict && verdict.ok ? verdict.warnings || [] : [];
        var tm = body.querySelector('[data-tpl-msg]');
        tm.textContent = !ts.length ? S.tplNone : ts.length > 2 ? S.tplMax : ''; tm.className = 'msg' + (ts.length && ts.length <= 2 ? '' : ' bad');
        body.querySelectorAll('[data-where]').forEach(function (w) { var k = w.getAttribute('data-where');
          w.innerHTML = ts.map(function (t) { var on = t.shows.indexOf(k) >= 0; return '<span class="cur-pill ' + (on ? 'ok' : 'no') + '">' + esc(f(k === 'hero.accent' && on ? S.inLead : on ? S.shows : S.hidden, { t: t.label })) + '</span>'; }).join('');
          var box = w.closest('.cur-f'); box.classList.toggle('dim', ts.length > 0 && !ts.some(function (t) { return t.shows.indexOf(k) >= 0; })); });
        B.keys.concat(['accent']).forEach(function (k) {
          var box = body.querySelector('.cur-f[data-k="' + k + '"]'); if (!box) return;
          var m = box.querySelector('.msg'), e = errs[k] || '', n = box.querySelector('.n');
          if (n && k !== 'highlights') { var len = (V[k] || '').trim().length; n.textContent = f(S.count, { n: len, max: maxOf(k) }); }
          var w = '';
          if (k === 'hero.accent' && !e && (V[k] || '').trim() && (V['hero.lead'] || '').indexOf(V[k].trim()) < 0) w = S.accentNot;
          m.textContent = e || w; m.className = 'msg ' + (e ? 'bad' : w ? 'warn' : ''); box.classList.toggle('err', !!e);
        });
        var hb = body.querySelector('.cur-f[data-k="highlights"] .n'); hb.textContent = f(S.count, { n: HL.filter(function (x) { return x.trim(); }).length, max: B.limits.highlightsMax });
        var live = body.querySelector('[data-live]'), lead = (V['hero.lead'] || '').replace(/\\s+/g, ' ').trim(), acc = (V['hero.accent'] || '').replace(/\\s+/g, ' ').trim(), i = acc ? lead.indexOf(acc) : -1;
        live.innerHTML = lead ? esc(S.lookLike) + ' ' + (i >= 0 ? esc(lead.slice(0, i)) + '<em>' + esc(acc) + '</em>' + esc(lead.slice(i + acc.length)) : esc(lead)) : '';
        var nErr = Object.keys(errs).length + (ts.length && ts.length <= 2 ? 0 : 1);
        sum.innerHTML = B.blocked ? '<span class="bad">' + esc(B.blocked) + '</span>' : B.running ? '<span class="bad">' + esc(S.running) + '</span>' :
          !verdict ? esc(S.checking) : nErr ? '<span class="bad"><b>' + esc(f(S.errors, { n: nErr })) + '</b></span>' :
          '<b>' + esc(f(S.ok, { n: ts.length, t: ts.map(function (t) { return t.label; }).join(' + ') })) + '</b>' + (warns.length ? ' · <span class="warn">' + esc(f(S.warns, { n: warns.length })) + '</span><ul class="cur-warns">' + warns.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '');
        go.disabled = !!B.blocked || B.running || busy || !verdict || nErr > 0;
      }
      function check() {
        clearTimeout(timer); verdict = null; paint();
        timer = setTimeout(function () {
          var my = ++seq;
          fetch('/lead/' + B.lead + '/curated-check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ copy: copy() }) })
            .then(function (r) { return r.json(); })
            .then(function (j) { if (my === seq) { verdict = j; paint(); } }, function (e) { if (my === seq) { sum.textContent = f(S.checkFailed, { m: e.message }); } });
        }, 350);
      }
      body.addEventListener('input', function (e) { var t = e.target, a;
        if ((a = t.getAttribute('data-in'))) V[a] = t.value;
        else if ((a = t.getAttribute('data-hlv')) != null) HL[+a] = t.value;
        else if ((a = t.getAttribute('data-spl')) != null) SP[+a].label = t.value;
        else if ((a = t.getAttribute('data-spq')) != null) SP[+a].quote = t.value;
        else if (t.hasAttribute('data-acc')) ACC = t.value;
        else return;
        check(); });
      body.addEventListener('change', function (e) { var id = e.target.getAttribute('data-tpl'); if (id) { SEL[id] = e.target.checked; paint(); } });
      body.addEventListener('click', function (e) { var b;
        if ((b = e.target.closest('[data-hl-add]'))) { HL.push(''); rows(); check(); var l = body.querySelectorAll('[data-hlv]'); l[l.length - 1].focus(); }
        else if ((b = e.target.closest('[data-sp-add]'))) { SP.push({ label: '', quote: '' }); rows(); check(); var q = body.querySelectorAll('[data-spl]'); q[q.length - 1].focus(); }
        else if ((b = e.target.closest('[data-hl-del]'))) { HL.splice(+b.getAttribute('data-hl-del'), 1); if (!HL.length) HL.push(''); rows(); check(); }
        else if ((b = e.target.closest('[data-sp-del]'))) { SP.splice(+b.getAttribute('data-sp-del'), 1); if (!SP.length) SP.push({ label: '', quote: '' }); rows(); check(); } });
      go.addEventListener('click', function () {
        if (go.disabled) return; busy = true; go.disabled = true; go.textContent = S.starting;
        fetch('/lead/' + B.lead + '/generate-curated', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templates: sel().map(function (t) { return t.id; }), copy: copy() }) })
          .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
          .then(function (x) {
            if (x.r.status === 202 && x.j.redirect) { location.href = x.j.redirect; if (location.pathname === x.j.redirect.split('#')[0]) location.reload(); return; }
            busy = false; go.textContent = S.go; verdict = x.j; paint(); if (x.j.message) sum.innerHTML = '<span class="bad">' + esc(x.j.message) + '</span>';
          }, function (e) { busy = false; go.textContent = S.go; sum.textContent = f(S.checkFailed, { m: e.message }); paint(); });
      });
      var loaded = false;
      function load() {
        if (loaded) return; loaded = true;
        fetch('/lead/' + B.lead + '/source-pack.json?part=fields').then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || r.status); return j; }); })
          .then(function (j) { FV = j.fieldVisibility; B.preselect.forEach(function (t) { SEL[t] = true; }); build(); check(); },
            function (e) { loaded = false; body.innerHTML = '<p class="mut">' + esc(f(S.failed, { m: e.message })) + '</p>'; });
      }
      // LAZY: load when the form is actually on screen (an open <details>, a shown tab).
      function visible() { return root.offsetParent !== null; }
      document.addEventListener('toggle', function () { if (visible()) load(); }, true);
      document.addEventListener('click', function () { setTimeout(function () { if (visible()) load(); }, 0); });
      if (visible()) load();
    })();
    </script>`;
}

/**
 * „Poe írta” — the mock card pill for a curator-written mock (copyOrigin=curator): who answers
 * for the words, from the stored provenance (copyManual.by). Empty for any other mock.
 */
export function curatorPill(inputs: Record<string, unknown>, lang: string): string {
  if (inputs.copyOrigin !== "curator") return "";
  const by = Object.values(manualCopyOf(inputs)).find((e) => e.by)?.by || "Poe";
  return `<span class="con-mkcopy__pill con-mkcopy__pill--poe" data-cit-curator="${esc(by)}">${ic("texts", 12)}${esc(
    T(lang, "{by} írta", { by }),
  )}</span>`;
}
