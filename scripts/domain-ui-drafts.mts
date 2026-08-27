// §2b TERV-generátor a tenant-admin egyedi-domain szekciójához (ADR-0071).
//
// A kapu célja (feedback_design_approval_gate): a tulaj LÁSSA, mit generálunk, és a
// kinézet + funkcionalitás alaptétele dőljön el KÓD ELŐTT. Ezért ez a script NEM
// terméki kód: három KATTINTHATÓ, önhordó HTML-változatot ír ki, amit a tulaj a
// Design-projektben megnéz és módosít.
//
// Miért generált és nem kézzel írt HTML: a valódi dizájn-magot (public/assets/ui/
// citui.css + citui-admin.css) BEOLVASSA és inline-olja, így a tervek pontosan a
// termék tokenjeit viselik — nincs kézzel másolt, elsodródó szín. Önhordó, mert a
// DS-panel előnézete csak úgy renderel (reference_design_login_rc_and_guard).
//
// Az adat VALÓDI: a domain-javaslatok a motor suggestDomains() kimenete, az ár és a
// 24 hónap a domains.ts konstansaiból jön — nem kitalált minta (§B.17).
//
// Run:  npx tsx scripts/domain-ui-drafts.mts   → /tmp/domain-ui/valtozat-{a,b,c}.html

import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

import { suggestDomains, subdomainHost, CUSTOM_DOMAIN_YEARLY, CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS } from "../src/domains.js";

const ROOT = path.resolve(import.meta.dirname, "..");
// A MUNKAFÁN BELÜL kell lennie, különben a Remote-Control session nem tudja megnyitni
// („Can't read this file … outside the session's working directory", 2026-08-27) — a
// /tmp és a fő fába mutató assets/Temp symlink egyaránt kívül esik.
const OUT = path.join(ROOT, "assets", "design-refs", "_drafts");

// ── Valós adat-minta (a motor tényleges kimenete, nem kitalált) ──
const BUSINESS = "Napfény Panzió";
const CURRENT_HOST = subdomainHost(BUSINESS);
const SUGGESTIONS = suggestDomains(BUSINESS);
const PRICE = CUSTOM_DOMAIN_YEARLY;
const MONTHS = CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS;

const huf = (n: number): string => `${n.toLocaleString("hu-HU")} Ft`;

const css = async (): Promise<string> =>
  (await readFile(path.join(ROOT, "public/assets/ui/citui.css"), "utf8")) +
  "\n" +
  (await readFile(path.join(ROOT, "public/assets/ui/citui-admin.css"), "utf8"));

/** Ikon a közös készletből (emoji TILOS, ADR-0021 ①). */
const ICON_GLOBE =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" width="20" height="20" aria-hidden="true">` +
  `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>`;
const ICON_CHECK =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18" aria-hidden="true">` +
  `<path d="M20 6 9 17l-5-5"/></svg>`;

/** Elérhetőség-jelölő — a valós DomainAvailability három állapota. */
function availChip(state: "probably_free" | "taken" | "unknown"): string {
  if (state === "taken")
    return `<span class="dv-chip dv-chip--taken">foglalt</span>`;
  if (state === "unknown")
    return `<span class="dv-chip dv-chip--unknown">nem tudjuk előre</span>`;
  return `<span class="dv-chip dv-chip--free">${ICON_CHECK} szabadnak tűnik</span>`;
}

// A javaslatok elérhetősége a MINTÁBAN vegyes, hogy a tulaj mind a három
// állapotot lássa (a valóságban a checkAvailability dönti el futásidőben).
const AVAIL: ("probably_free" | "taken" | "unknown")[] = [
  "probably_free",
  "probably_free",
  "taken",
  "probably_free",
  "unknown",
];

/** Közös, terv-specifikus CSS (a dizájn-magra épül, nyers hex sehol). */
const DRAFT_CSS = `
/* container-query, NEM media-query: így a méret-váltó tényleg átrendezi az elrendezést
   (a media-query a böngésző-ablakhoz kötődne, és egy szűkített div-ben nem sülne el). */
.dv-wrap{max-width:var(--citui-container);margin:0 auto;padding:18px 14px 60px;
  container-type:inline-size;transition:max-width .2s ease}
.dv-wrap.is-phone{max-width:390px}
.dv-sizer{position:sticky;top:0;z-index:6;display:flex;gap:6px;justify-content:center;
  padding:8px;background:var(--citui-navy-900)}
.dv-sizer button{font:inherit;font-size:.8rem;cursor:pointer;padding:6px 14px;min-height:32px;
  border-radius:var(--citui-radius-pill);border:1px solid var(--citui-line-strong);
  background:transparent;color:var(--citui-white);opacity:.65;transition:var(--citui-transition)}
.dv-sizer button.is-on{opacity:1;background:var(--citui-cyan-500);color:var(--citui-navy-950);
  border-color:var(--citui-cyan-500);font-weight:600}
.dv-note{font-size:.8rem;color:var(--citui-muted);text-align:center;margin:0 0 14px;
  border:1px dashed var(--citui-line-strong);border-radius:var(--citui-radius-sm);padding:7px 10px}
.dv-current{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  background:var(--citui-surface-2);border:1px solid var(--citui-line);
  border-radius:var(--citui-radius);padding:12px 14px;margin:0 0 18px}
.dv-current b{font-family:var(--citui-font-display);word-break:break-all}
.dv-current span{font-size:.85rem;color:var(--citui-muted)}
.dv-list{display:flex;flex-direction:column;gap:9px;margin:0 0 16px}
.dv-opt{display:flex;align-items:center;gap:11px;padding:13px 14px;cursor:pointer;
  border:1.5px solid var(--citui-line);border-radius:var(--citui-radius);
  background:var(--citui-white);transition:var(--citui-transition);min-height:56px}
.dv-opt:hover{border-color:var(--citui-cyan-500)}
.dv-opt.is-sel{border-color:var(--citui-cyan-500);
  background:color-mix(in srgb, var(--citui-cyan-500) 7%, var(--citui-white))}
.dv-opt.is-off{opacity:.5;cursor:not-allowed}
.dv-opt input{width:20px;height:20px;flex:none;accent-color:var(--citui-cyan-500)}
.dv-opt__name{font-family:var(--citui-font-display);font-size:1.02rem;flex:1;min-width:0;overflow-wrap:anywhere}
/* Keskeny nézet: a domain-név NE törjön szó közepén (napfenypanz|io.hu) — inkább az
   elérhetőség-jelölő csússzon a név alá, behúzva a rádiógomb szélességével. */
@container (max-width:430px){
  .dv-opt{flex-wrap:wrap}
  .dv-opt__name{flex:1 1 auto}
  .dv-chip{flex-basis:100%;margin-left:31px}
}
.dv-chip{font-size:.74rem;padding:3px 9px;border-radius:var(--citui-radius-pill);
  white-space:nowrap;display:inline-flex;align-items:center;gap:4px;flex:none}
.dv-chip--free{background:var(--citui-ok-soft);color:var(--citui-ok)}
.dv-chip--taken{background:color-mix(in srgb, var(--citui-bad) 12%, transparent);color:var(--citui-bad)}
.dv-chip--unknown{background:color-mix(in srgb, var(--citui-warn) 15%, transparent);color:var(--citui-warn)}
.dv-own{border-top:1px solid var(--citui-line);padding-top:15px;margin-top:4px}
.dv-own__row{display:flex;gap:8px}
.dv-own__row .citui-input{flex:1;min-width:0}
.dv-msg{display:block;margin-top:9px;font-size:.86rem;padding:9px 11px;border-radius:var(--citui-radius-sm)}
.dv-msg--bad{background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad)}
.dv-terms{background:var(--citui-surface-2);border:1px solid var(--citui-line);
  border-radius:var(--citui-radius);padding:14px 15px;margin:16px 0}
.dv-terms dl{margin:0;display:grid;grid-template-columns:1fr auto;gap:9px 12px;font-size:.9rem}
.dv-terms dt{color:var(--citui-muted)}
.dv-terms dd{margin:0;text-align:right;font-family:var(--citui-font-display)}
.dv-terms .dv-total{border-top:1px solid var(--citui-line-strong);padding-top:9px;font-size:1.05rem}
.dv-steps{display:flex;gap:6px;margin:0 0 18px}
.dv-step{flex:1;text-align:center;font-size:.76rem;padding:8px 4px;border-radius:var(--citui-radius-sm);
  background:var(--citui-surface-2);color:var(--citui-muted);border:1px solid var(--citui-line)}
.dv-step.is-now{background:var(--citui-navy-900);color:var(--citui-white);border-color:var(--citui-navy-900)}
.dv-step.is-done{color:var(--citui-ok);border-color:var(--citui-ok)}
.dv-prog{display:flex;flex-direction:column;gap:0;margin:6px 0 0}
.dv-prog__row{display:flex;align-items:flex-start;gap:11px;padding:11px 0;position:relative}
.dv-prog__row+.dv-prog__row{border-top:1px solid var(--citui-line)}
.dv-prog__dot{width:22px;height:22px;border-radius:50%;flex:none;display:grid;place-items:center;
  border:2px solid var(--citui-line-strong);background:var(--citui-white);margin-top:1px}
.dv-prog__row.is-done .dv-prog__dot{background:var(--citui-ok);border-color:var(--citui-ok);color:var(--citui-white)}
.dv-prog__row.is-now .dv-prog__dot{border-color:var(--citui-cyan-500);
  background:color-mix(in srgb, var(--citui-cyan-500) 20%, var(--citui-white))}
.dv-prog__txt strong{display:block;font-size:.95rem}
.dv-prog__txt span{display:block;font-size:.82rem;color:var(--citui-muted);margin-top:2px}
.dv-banner{display:flex;gap:12px;align-items:flex-start;padding:15px 16px;margin:0 0 18px;
  border-radius:var(--citui-radius);border:1px solid var(--citui-cyan-500);
  background:color-mix(in srgb, var(--citui-cyan-500) 8%, var(--citui-white))}
.dv-banner__ico{color:var(--citui-cyan-500);flex:none;margin-top:2px}
.dv-banner h3{margin:0 0 4px;font-size:1rem;font-family:var(--citui-font-display)}
.dv-banner p{margin:0 0 11px;font-size:.88rem;color:var(--citui-muted)}
.dv-live{display:flex;align-items:center;gap:9px;padding:13px 15px;border-radius:var(--citui-radius);
  background:var(--citui-ok-soft);color:var(--citui-ok);font-size:.92rem;margin-top:14px}
.dv-live b{font-family:var(--citui-font-display);word-break:break-all}
.dv-vlabel{position:sticky;top:0;z-index:5;background:var(--citui-navy-950);color:var(--citui-white);
  font-size:.78rem;padding:7px 14px;text-align:center;font-family:var(--citui-font-display)}
`;

function shell(title: string, body: string, cssText: string): string {
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title><style>${cssText}\n${DRAFT_CSS}</style></head>` +
    `<body class="citui-admin-body" style="background:var(--citui-surface)">` +
    `<div class="dv-vlabel">${title} · TERV — kattintható mock, próbálja ki</div>` +
    // Méret-váltó: EGY fájlban látszik a telefonos és az asztali elrendezés, nem kell
    // két helyen nézni (tulajdonosi kérés, 2026-08-27).
    `<div class="dv-sizer">` +
    `<button type="button" data-size="phone">Mobil 390px</button>` +
    `<button type="button" data-size="desktop" class="is-on">Asztali</button>` +
    `</div>` +
    `<div class="dv-wrap">${body}</div>` +
    // MŰKÖDŐ mock (tulajdonosi rendelet, 2026-08-27): a várt funkciókat tartalmaznia
    // kell — input-viselkedés, kattintások, állapotváltás —, mert a tulaj a
    // FUNKCIONALITÁST is meg akarja ítélni, nem csak a képet. A normalizálás
    // szándékosan a VALÓDI szabályokat tükrözi (domains.ts normalizeCustomDomain):
    // https:// / www. / záró perjel / nagybetű lecsupaszítva; végződés kötelező;
    // csak angol betű-szám-kötőjel. Így a tulaj azt a viselkedést ítéli meg, ami
    // élesben is lesz — nem egy szebb hazugságot.
    `<script>
      // Méret-váltó. Telefonon a 390px viewport miatt alapból a keskeny elrendezés
      // aktív, ezért ott a "Mobil" gomb indul bekapcsolva.
      (function(){
        var wrap=document.querySelector('.dv-wrap');
        var btns=document.querySelectorAll('[data-size]');
        function set(mode){
          wrap.classList.toggle('is-phone', mode==='phone');
          btns.forEach(function(b){ b.classList.toggle('is-on', b.getAttribute('data-size')===mode); });
        }
        btns.forEach(function(b){ b.addEventListener('click',function(){ set(b.getAttribute('data-size')); }); });
        if(window.innerWidth<600) set('phone');
      })();
      function pick(name){
        document.querySelectorAll('[data-picked]').forEach(function(p){p.textContent=name});
      }
      document.querySelectorAll('.dv-opt:not(.is-off)').forEach(function(o){
        o.addEventListener('click',function(){
          o.closest('.dv-list').querySelectorAll('.dv-opt').forEach(function(x){x.classList.remove('is-sel')});
          o.classList.add('is-sel');
          var r=o.querySelector('input'); if(r) r.checked=true;
          var n=o.querySelector('.dv-opt__name');
          pick(n?n.textContent:'');
        });
      });
      document.querySelectorAll('[data-goto]').forEach(function(b){
        b.addEventListener('click',function(){
          var t=b.getAttribute('data-goto');
          document.querySelectorAll('[data-panel]').forEach(function(p){
            p.style.display = p.getAttribute('data-panel')===t ? '' : 'none';
          });
          window.scrollTo(0,0);
          if(t==='folyamat'||t==='3') runProgress();
        });
      });

      // ── Saját domain beírása: normalizálás + ellenőrzés (valódi szabályok) ──
      function normalize(raw){
        var s=String(raw||'').trim().toLowerCase()
          .replace(/^[a-z]+:\\/\\//,'').replace(/^www\\./,'')
          .replace(/[/?#].*$/,'').replace(/\\.$/,'');
        if(!s) return {ok:false,reason:'Adjon meg egy domain nevet'};
        var labels=s.split('.');
        if(labels.length<2) return {ok:false,reason:'Végződés is kell, például: pelda.hu'};
        for(var i=0;i<labels.length;i++){
          var l=labels[i];
          if(!l) return {ok:false,reason:'Hibás domain név (üres rész a pontok között)'};
          if(!/^[a-z0-9-]+$/.test(l)||l[0]==='-'||l[l.length-1]==='-')
            return {ok:false,reason:'Csak angol betű, szám és kötőjel használható'};
        }
        var tld=labels[labels.length-1];
        if(!/^[a-z]{2,}$/.test(tld)) return {ok:false,reason:'Hibás végződés (például: .hu, .com)'};
        return {ok:true,domain:s};
      }
      document.querySelectorAll('[data-check]').forEach(function(btn){
        var wrap=btn.closest('.dv-own');
        var inp=wrap.querySelector('input');
        var out=wrap.querySelector('[data-result]');
        function run(){
          var v=normalize(inp.value);
          if(!v.ok){
            out.innerHTML='<span class="dv-msg dv-msg--bad">'+v.reason+'</span>';
            return;
          }
          inp.value=v.domain; // a normalizált alakot vissza is írjuk — látja, mi történt
          // Szimuláció: a "foglalt" szót tartalmazó nevet vettnek mutatjuk, hogy a
          // tulaj a NEMLEGES ágat is ki tudja próbálni (élesben DNS+RDAP dönt).
          var taken=/foglalt|taken/.test(v.domain);
          out.innerHTML = taken
            ? '<span class="dv-msg dv-msg--bad">A(z) <b>'+v.domain+'</b> már foglalt — próbáljon másikat.</span>'
            : '<label class="dv-opt is-sel" style="margin-top:4px"><input type="radio" name="dom" checked>'+
              '<span class="dv-opt__name">'+v.domain+'</span>'+
              '<span class="dv-chip dv-chip--free">szabadnak tűnik</span></label>';
          if(!taken){
            document.querySelectorAll('.dv-list .dv-opt').forEach(function(x){x.classList.remove('is-sel')});
            pick(v.domain);
          }
        }
        btn.addEventListener('click',run);
        inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){e.preventDefault();run();} });
      });

      // ── A zéró-touch folyamat: a lépések maguktól haladnak (ezt látja a tulaj) ──
      function runProgress(){
        var rows=document.querySelectorAll('[data-panel] .dv-prog__row, .dv-prog__row');
        if(!rows.length) return;
        var i=0;
        rows.forEach(function(r){r.classList.remove('is-done','is-now')});
        rows[0].classList.add('is-now');
        var t=setInterval(function(){
          if(i>=rows.length){clearInterval(t);var d=document.querySelector('[data-donebox]');if(d)d.style.display='';return;}
          rows[i].classList.remove('is-now'); rows[i].classList.add('is-done');
          rows[i].querySelector('.dv-prog__dot').innerHTML='${ICON_CHECK.replace(/'/g, "\\'")}';
          i++; if(i<rows.length) rows[i].classList.add('is-now');
        },1100);
      }
    </script>` +
    `</body></html>`
  );
}

/**
 * @param lostDomain a név, amit időközben elvittek — foglaltként jelenik meg, nem
 *   választható, és a kijelölés a következő szabadra ugrik. (A vizuális átnézés
 *   kapta el, hogy enélkül a bukott nevet kínálnánk fel újra „szabadnak tűnik"-kel.)
 */
function suggestionList(lostDomain?: string): string {
  const avail = SUGGESTIONS.map((d, i) =>
    d === lostDomain ? ("taken" as const) : (AVAIL[i] ?? "unknown"),
  );
  const firstFree = avail.findIndex((a) => a !== "taken");
  return (
    `<div class="dv-list">` +
    SUGGESTIONS.map((d, i) => {
      const state = avail[i]!;
      const off = state === "taken";
      const sel = i === firstFree;
      return (
        `<label class="dv-opt${sel ? " is-sel" : ""}${off ? " is-off" : ""}">` +
        `<input type="radio" name="dom"${sel ? " checked" : ""}${off ? " disabled" : ""}>` +
        `<span class="dv-opt__name">${d}</span>${availChip(state)}</label>`
      );
    }).join("") +
    `</div>`
  );
}

function ownInput(): string {
  return (
    `<div class="dv-own"><div class="citui-field">` +
    `<label class="citui-label" for="own">Vagy írja be a saját ötletét</label>` +
    `<div class="dv-own__row">` +
    `<input class="citui-input" id="own" placeholder="pl. napfenyvendeghaz.hu">` +
    `<button class="citui-btn citui-btn--ghost" type="button" data-check>Ellenőrzés</button>` +
    `</div><div data-result></div></div></div>`
  );
}

function terms(): string {
  return (
    `<div class="dv-terms"><dl>` +
    `<dt>A választott cím</dt><dd data-picked>${SUGGESTIONS[0]}</dd>` +
    `<dt>Domain díja (1 év)</dt><dd>${huf(PRICE)}</dd>` +
    `<dt>Előfizetés vállalása</dt><dd>${MONTHS} hónap</dd>` +
    `<dt class="dv-total"><strong>Most fizetendő</strong></dt><dd class="dv-total">${huf(PRICE)}</dd>` +
    `</dl>` +
    `<p class="citui-hint" style="margin:11px 0 0">A saját nevet mi vásároljuk meg és tartjuk karban. ` +
    `A régi cím (${CURRENT_HOST}) nem szűnik meg: automatikusan az újra irányít, így a korábbi ` +
    `hivatkozások is működnek tovább.</p></div>`
  );
}

function progress(active: number): string {
  const steps = [
    ["Megvásároljuk a nevet", "A regisztrátornál lefoglaljuk Önnek"],
    ["Beállítjuk a címet", "A név a honlapjára mutat"],
    ["Biztonsági tanúsítvány", "Hogy a böngésző lakatot mutasson"],
    ["Átköltöztetés", "A honlapja az új néven érhető el"],
  ];
  return (
    `<div class="dv-prog">` +
    steps
      .map(([t, s], i) => {
        const cls = i < active ? " is-done" : i === active ? " is-now" : "";
        return (
          `<div class="dv-prog__row${cls}"><span class="dv-prog__dot">${i < active ? ICON_CHECK : ""}</span>` +
          `<span class="dv-prog__txt"><strong>${t}</strong><span>${s}</span></span></div>`
        );
      })
      .join("") +
    `</div>` +
    `<p class="citui-hint" style="margin-top:12px">Ez általában néhány percet vesz igénybe. ` +
    `Nincs teendője — e-mailben jelezzük, amint kész.</p>`
  );
}

function card(title: string, inner: string, lead = ""): string {
  return (
    `<div class="adm-card"><div class="adm-card__head">` +
    `<span class="adm-ico">${ICON_GLOBE}</span><h2>${title}</h2>` +
    `<a class="adm-help" href="#" title="Súgó">?</a></div>` +
    (lead ? `<p class="adm-lead">${lead}</p>` : "") +
    inner +
    `</div>`
  );
}

// ── A VÁLTOZAT — egyetlen kártya a Fiók fülön (a legkisebb felület) ──
function variantA(): string {
  return (
    `<p class="dv-note">A) Egy kártya a „Fiók” fülön — a választás, az ár és a megrendelés egy helyen.</p>` +
    card(
      "Saját webcím",
      `<div class="dv-current"><b>${CURRENT_HOST}</b><span>a honlapja jelenlegi címe</span></div>` +
        `<p class="citui-hint" style="margin:0 0 14px">Saját nevet választhat — ez a cím jelenik majd meg a vendégeinek, ` +
        `a névjegyén és a Google-ban.</p>` +
        suggestionList() +
        ownInput() +
        terms() +
        `<button class="citui-btn citui-btn--primary" style="width:100%" data-goto="folyamat">` +
        `Megrendelem — ${huf(PRICE)}</button>`,
    ) +
    `<div data-panel="folyamat" style="display:none">` +
    card("Saját webcím — folyamatban", progress(1), `A választott név: <strong data-picked>${SUGGESTIONS[0]}</strong>`) +
    `</div>`
  );
}

// ── B VÁLTOZAT — saját fül, lépésekre bontva (a döntés külön pillanat) ──
function variantB(): string {
  return (
    `<p class="dv-note">B) Külön „Webcím” fül, 3 lépés — a választás és a fizetési döntés külön képernyőn.</p>` +
    `<div data-panel="1"><div class="dv-steps">` +
    `<span class="dv-step is-now">1. Név</span><span class="dv-step">2. Áttekintés</span><span class="dv-step">3. Kész</span>` +
    `</div>` +
    card(
      "Válasszon nevet",
      `<div class="dv-current"><b>${CURRENT_HOST}</b><span>most ez a címe</span></div>` +
        suggestionList() +
        ownInput() +
        `<button class="citui-btn citui-btn--primary" style="width:100%;margin-top:16px" data-goto="2">Tovább</button>`,
      "A vendégei ezt a címet fogják beírni és látni a Google-ban.",
    ) +
    `</div>` +
    `<div data-panel="2" style="display:none"><div class="dv-steps">` +
    `<span class="dv-step is-done">1. Név</span><span class="dv-step is-now">2. Áttekintés</span><span class="dv-step">3. Kész</span>` +
    `</div>` +
    card(
      "Áttekintés",
      terms() +
        `<button class="citui-btn citui-btn--primary" style="width:100%" data-goto="3">Fizetés és megrendelés</button>` +
        `<button class="citui-btn citui-btn--ghost" style="width:100%;margin-top:9px" data-goto="1">Vissza</button>`,
      `A választott név: <strong data-picked>${SUGGESTIONS[0]}</strong>`,
    ) +
    `</div>` +
    `<div data-panel="3" style="display:none"><div class="dv-steps">` +
    `<span class="dv-step is-done">1. Név</span><span class="dv-step is-done">2. Áttekintés</span><span class="dv-step is-now">3. Kész</span>` +
    `</div>` +
    card("Már intézzük", progress(2), `<strong data-picked>${SUGGESTIONS[0]}</strong> — a megrendelést megkaptuk.`) +
    `</div>`
  );
}

// ── C VÁLTOZAT — az Áttekintés fülön kezdeményez, ott is zárul (proaktív) ──
function variantC(): string {
  return (
    `<p class="dv-note">C) Az „Áttekintés” fül ajánlja fel — a tulaj nem keresi, hanem elé kerül; a részletek egy lapon.</p>` +
    `<div data-panel="1">` +
    `<div class="dv-banner"><span class="dv-banner__ico">${ICON_GLOBE}</span><div>` +
    `<h3>Szeretne saját webcímet?</h3>` +
    `<p>A honlapja most a <strong>${CURRENT_HOST}</strong> címen érhető el. ` +
    `Saját név (pl. <strong>${SUGGESTIONS[0]}</strong>) profibb benyomást kelt, és könnyebben megjegyezhető.</p>` +
    `<button class="citui-btn citui-btn--primary citui-btn--sm" data-goto="2">Megnézem a lehetőségeket</button>` +
    `</div></div>` +
    card(
      "Áttekintés",
      `<p class="citui-hint" style="margin:0">Itt látja a honlapja állapotát. (A terv szempontjából a fenti ` +
        `felajánlás a lényeg — ez a kártya csak a környezetet mutatja.)</p>`,
      "A honlapja él, a vendégek elérik.",
    ) +
    `</div>` +
    `<div data-panel="2" style="display:none">` +
    card(
      "Saját webcím",
      suggestionList() +
        ownInput() +
        terms() +
        `<button class="citui-btn citui-btn--primary" style="width:100%" data-goto="3">Megrendelem — ${huf(PRICE)}</button>` +
        `<button class="citui-btn citui-btn--ghost" style="width:100%;margin-top:9px" data-goto="1">Most nem</button>`,
      "Válasszon egy nevet — a többit mi intézzük.",
    ) +
    `</div>` +
    `<div data-panel="3" style="display:none">` +
    card(
      "Saját webcím",
      progress(4) +
        `<div class="dv-live">${ICON_CHECK}<span>Kész — a honlapja mostantól itt érhető el: <b data-picked>${SUGGESTIONS[0]}</b></span></div>`,
      "Készen vagyunk.",
    ) +
    `</div>`
  );
}

// ── ÁLLAPOTOK — a zéró-touch folyamat, ahogy a tulaj LÁTJA ──
// Külön lap, mert a folyamat közbeni és utáni képernyő ugyanannyira szállítás, mint
// a választó — és mert a SIKERTELEN eset valós: a domain a fizetés és a vétel közt
// elkelhet (a registrar atomi kapuja miatt inkább elhasal, mint hogy rosszat vegyen).
function stateRunning(): string {
  return (
    `<p class="dv-note">Á1) FOLYAMATBAN — ezt látja a tulaj közvetlenül a fizetés után. ` +
    `Nincs teendője; a rendszer magától dolgozik.</p>` +
    card("Saját webcím", progress(2), `A választott név: <strong>${SUGGESTIONS[0]}</strong>`)
  );
}

function stateDone(): string {
  return (
    `<p class="dv-note">Á2) KÉSZ — az átköltöztetés megtörtént, a honlap az új néven él.</p>` +
    card(
      "Saját webcím",
      progress(4) +
        `<div class="dv-live">${ICON_CHECK}<span>A honlapja mostantól itt érhető el: <b>${SUGGESTIONS[0]}</b></span></div>` +
        `<p class="citui-hint" style="margin-top:12px">A régi cím (${CURRENT_HOST}) automatikusan ide irányít, ` +
        `így a korábban kiadott névjegyek és hivatkozások is működnek.</p>`,
      "Készen vagyunk.",
    )
  );
}

function stateFailed(): string {
  return (
    `<p class="dv-note">Á3) NEM SIKERÜLT — valós eset: a nevet a fizetés és a vétel között ` +
    `más lefoglalhatja. A rendszer inkább elhasal, mint hogy rossz nevet vegyen.</p>` +
    card(
      "Saját webcím",
      `<div class="dv-live" style="background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad)">` +
        `<span>A(z) <b>${SUGGESTIONS[0]}</b> nevet időközben más lefoglalta.</span></div>` +
        // ⛔ Visszautalást NEM ígérünk: a Barion Refund API-ja létezik, de nálunk nincs
        // megírva (README, tulaj-döntés 2026-08-27) — §B.17: magunkról sem állítunk valótlant.
        `<p class="citui-hint" style="margin:12px 0 14px">A befizetett összeg nem vész el: ` +
        `egy másik névre fordítjuk. Válassza ki, melyiket kéri helyette:</p>` +
        suggestionList(SUGGESTIONS[0]) +
        `<button class="citui-btn citui-btn--primary" style="width:100%;margin-top:14px">Ezt kérem helyette</button>`,
      "Ritkán, de előfordul — a nevek érkezési sorrendben kelnek el.",
    )
  );
}

const cssText = await css();
await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "allapot-1-folyamatban.html"), shell("Állapot 1 — folyamatban", stateRunning(), cssText));
await writeFile(path.join(OUT, "allapot-2-kesz.html"), shell("Állapot 2 — kész", stateDone(), cssText));
await writeFile(path.join(OUT, "allapot-3-sikertelen.html"), shell("Állapot 3 — nem sikerült", stateFailed(), cssText));
await writeFile(path.join(OUT, "valtozat-a.html"), shell("A változat — kártya a Fiók fülön", variantA(), cssText));
await writeFile(path.join(OUT, "valtozat-b.html"), shell("B változat — külön fül, 3 lépés", variantB(), cssText));
await writeFile(path.join(OUT, "valtozat-c.html"), shell("C változat — proaktív felajánlás", variantC(), cssText));
console.log(`✅ 3 terv kiírva: ${OUT}/valtozat-{a,b,c}.html`);
console.log(`   valós adat: ${CURRENT_HOST} · javaslatok: ${SUGGESTIONS.join(", ")} · ${huf(PRICE)} / ${MONTHS} hó`);
