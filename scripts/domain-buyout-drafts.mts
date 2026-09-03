// §2b TERV-generátor a felmondás-flow ELSZÁMOLÁS-képernyőjéhez (ADR-0094).
//
// A modell (tulajdonosi döntés, 2026-09-03): a hűségidő alatt NINCS szabad
// lemondás. Korai kilépés = elszámolás: a hátralévő hónapok díja a VÁLLALT
// MINIMUM tarifán (kötbér) MINDIG jár; a domain definiált vételára CSAK akkor,
// ha a kilépő a domaint el is viszi — különben a domain nálunk marad.
//
// Két KATTINTHATÓ, önhordó változat; a dizájn-magot inline-olja, az árak a
// pricing.ts valós kód-alapértékei (nem kitalált minta, §B.17).
//
// Run:  npx tsx scripts/domain-buyout-drafts.mts
//       → assets/design-refs/_drafts/elszamolas-{a,b}.html

import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

import { getDomainBuyoutPrice, getDomainFreeMinMonthly } from "../src/pricing.js";

const ROOT = path.resolve(import.meta.dirname, "..");
// A MUNKAFÁN BELÜL (assets/design-refs/_drafts, gitignore-olt) — a /tmp és az
// assets/Temp symlink kívül esik a Remote-Control session munkakönyvtárán.
const OUT = path.join(ROOT, "assets", "design-refs", "_drafts");

// ── Valós adat-minta ──
const DOMAIN = "napfenypanzio.hu";
const FLOOR = getDomainFreeMinMonthly(); // a vállalt minimum tarifa (kötbér-alap)
const BUYOUT = getDomainBuyoutPrice(); // a domain definiált vételára
const COMMITMENT = 12;
const SERVED = 5;
const REMAINING = COMMITMENT - SERVED;
const PENALTY = REMAINING * FLOOR;
const PERIOD_END = "2026. október 3.";

const huf = (n: number): string => `${n.toLocaleString("hu-HU")} Ft`;

const css = async (): Promise<string> =>
  (await readFile(path.join(ROOT, "public/assets/ui/citui.css"), "utf8")) +
  "\n" +
  (await readFile(path.join(ROOT, "public/assets/ui/citui-admin.css"), "utf8"));

const ICON_GLOBE =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" width="20" height="20" aria-hidden="true">` +
  `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>`;
const ICON_CHECK =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18" aria-hidden="true">` +
  `<path d="M20 6 9 17l-5-5"/></svg>`;

const DRAFT_CSS = `
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
.dv-vlabel{position:sticky;top:0;z-index:5;background:var(--citui-navy-950);color:var(--citui-white);
  font-size:.78rem;padding:7px 14px;text-align:center;font-family:var(--citui-font-display)}
.dv-note{font-size:.8rem;color:var(--citui-muted);text-align:center;margin:0 0 14px;
  border:1px dashed var(--citui-line-strong);border-radius:var(--citui-radius-sm);padding:7px 10px}
.dv-dombar{display:flex;align-items:center;gap:11px;background:var(--citui-surface-2);
  border:1px solid var(--citui-line);border-radius:var(--citui-radius);padding:12px 14px;margin:0 0 14px}
.dv-dombar__ico{color:var(--citui-cyan-500);flex:none}
.dv-dombar b{font-family:var(--citui-font-display);word-break:break-all}
.dv-dombar span{display:block;font-size:.82rem;color:var(--citui-muted);margin-top:2px}
.dv-meter{height:7px;border-radius:var(--citui-radius-pill);background:var(--citui-line);
  overflow:hidden;margin-top:7px}
.dv-meter i{display:block;height:100%;background:var(--citui-cyan-500)}

/* Elszámolás-tábla: tételek + élőben frissülő végösszeg. */
.dv-bill{background:var(--citui-surface-2);border:1px solid var(--citui-line);
  border-radius:var(--citui-radius);padding:14px 15px;margin:12px 0}
.dv-bill dl{margin:0;display:grid;grid-template-columns:1fr auto;gap:9px 12px;font-size:.9rem}
.dv-bill dt{color:var(--citui-muted)}
.dv-bill dt small{display:block;font-size:.78rem;margin-top:1px}
.dv-bill dd{margin:0;text-align:right;font-family:var(--citui-font-display);white-space:nowrap}
.dv-bill .dv-total{border-top:1px solid var(--citui-line-strong);padding-top:9px;font-size:1.05rem}
.dv-domrow{display:flex;gap:11px;align-items:flex-start;padding:12px 13px;margin:12px 0 0;
  border:1.5px solid var(--citui-line);border-radius:var(--citui-radius);cursor:pointer;
  transition:var(--citui-transition);background:var(--citui-white)}
.dv-domrow:hover{border-color:var(--citui-cyan-500)}
.dv-domrow.is-on{border-color:var(--citui-cyan-500);
  background:color-mix(in srgb, var(--citui-cyan-500) 7%, var(--citui-white))}
.dv-domrow input{width:20px;height:20px;flex:none;margin-top:1px;accent-color:var(--citui-cyan-500)}
.dv-domrow__t{font-family:var(--citui-font-display);font-size:.98rem}
.dv-domrow__d{display:block;font-size:.82rem;color:var(--citui-muted);margin-top:2px;line-height:1.45}
.dv-domrow__p{margin-left:auto;font-family:var(--citui-font-display);white-space:nowrap}
/* Keskeny nézeten az ár a szöveg alá csúszik, nem törik szó közben. */
@container (max-width:430px){
  .dv-domrow{flex-wrap:wrap}
  .dv-domrow__p{flex-basis:100%;margin-left:31px}
}
.dv-conseq{border-radius:var(--citui-radius-sm);padding:11px 13px;font-size:.87rem;
  margin:12px 0 0;background:color-mix(in srgb, var(--citui-bad) 8%, transparent);
  color:var(--citui-bad);border:1px solid color-mix(in srgb, var(--citui-bad) 30%, transparent)}
.dv-done{display:flex;align-items:flex-start;gap:10px;padding:14px 15px;margin:0 0 14px;
  border-radius:var(--citui-radius);background:var(--citui-ok-soft);color:var(--citui-ok);font-size:.92rem}
.dv-done b{font-family:var(--citui-font-display)}
.dv-danger{border:1px solid color-mix(in srgb, var(--citui-bad) 35%, transparent);
  border-radius:var(--citui-radius);padding:15px 16px;margin-top:18px}
.dv-danger h3{margin:0 0 6px;font-size:1rem;font-family:var(--citui-font-display)}
.dv-danger summary{cursor:pointer;color:var(--citui-bad);font-size:.9rem;
  min-height:44px;display:flex;align-items:center}
`;

function shell(title: string, body: string, cssText: string): string {
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title><style>${cssText}\n${DRAFT_CSS}</style></head>` +
    `<body class="citui-admin-body" style="background:var(--citui-surface)">` +
    `<div class="dv-vlabel">${title} · TERV — kattintható mock, próbálja ki</div>` +
    `<div class="dv-sizer">` +
    `<button type="button" data-size="phone">Mobil 390px</button>` +
    `<button type="button" data-size="desktop" class="is-on">Asztali</button>` +
    `</div>` +
    `<div class="dv-wrap">${body}</div>` +
    // MŰKÖDŐ mock: a domain-pipa élőben átszámolja a végösszeget és a gombot —
    // pontosan ez a viselkedés kerülne a termékbe.
    `<script>
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
      document.querySelectorAll('[data-goto]').forEach(function(b){
        b.addEventListener('click',function(){
          var t=b.getAttribute('data-goto');
          document.querySelectorAll('[data-panel]').forEach(function(p){
            p.style.display = p.getAttribute('data-panel')===t ? '' : 'none';
          });
          window.scrollTo(0,0);
        });
      });
      // A domain-pipa: végösszeg + gomb + záró-képernyő együtt vált.
      var PENALTY=${PENALTY}, BUYOUT=${BUYOUT};
      function huf(n){return n.toLocaleString('hu-HU')+' Ft'}
      document.querySelectorAll('[data-domtoggle]').forEach(function(row){
        var box=row.querySelector('input');
        function sync(){
          var on=box.checked;
          row.classList.toggle('is-on',on);
          var total=PENALTY+(on?BUYOUT:0);
          document.querySelectorAll('[data-domline]').forEach(function(el){
            el.textContent=on?huf(BUYOUT):'—';
          });
          document.querySelectorAll('[data-total]').forEach(function(el){ el.textContent=huf(total); });
          document.querySelectorAll('[data-settle]').forEach(function(el){
            el.textContent='Elszámolás és lemondás — '+huf(total);
          });
          document.querySelectorAll('[data-domfate]').forEach(function(el){
            el.textContent=on
              ? 'A webcímet elviszi: a(z) ${DOMAIN} tulajdonjoga a fizetés után az Öné.'
              : 'A webcímet nem viszi el: a(z) ${DOMAIN} nálunk marad.';
          });
          document.querySelectorAll('[data-donefate]').forEach(function(el){
            el.textContent=on
              ? 'A(z) ${DOMAIN} tulajdonjog-átadását elindítottuk — a lépéseket e-mailben küldjük.'
              : 'A(z) ${DOMAIN} webcím nálunk maradt.';
          });
        }
        // A sor <label>: a natív kattintás maga pipál — csak a change-re számolunk
        // újra (kézi toggle itt DUPLÁN váltana, és az összeg állva maradna).
        box.addEventListener('change', sync);
        sync();
      });
    </script></body></html>`
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

function domainBar(): string {
  const pct = Math.round((SERVED / COMMITMENT) * 100);
  return (
    `<div class="dv-dombar"><span class="dv-dombar__ico">${ICON_GLOBE}</span><div style="flex:1;min-width:0">` +
    `<b>${DOMAIN}</b>` +
    `<span>saját webcím tőlünk — a vállalt ${COMMITMENT} hónapból ${SERVED} telt el, ${REMAINING} van hátra</span>` +
    `<div class="dv-meter"><i style="width:${pct}%"></i></div>` +
    `</div></div>`
  );
}

/** Az elszámolás lényege: tételes, élőben frissülő számla + domain-pipa. */
function settlement(): string {
  return (
    `<p style="font-size:.88rem;margin:0 0 4px"><b>A hűségidő alatt a lemondás elszámolással jár.</b> ` +
    `A hátralévő ${REMAINING} hónap díja a vállalt minimum tarifán mindenképp fizetendő; a webcímet ` +
    `választása szerint viheti vagy hagyja.</p>` +
    `<label class="dv-domrow" data-domtoggle>` +
    `<input type="checkbox">` +
    `<span style="flex:1;min-width:0"><span class="dv-domrow__t">A webcímet is elviszem</span>` +
    `<span class="dv-domrow__d">A(z) <b>${DOMAIN}</b> tulajdonjoga a fizetés után az Öné, és bárhová ` +
    `elviheti. Enélkül a webcím nálunk marad.</span></span>` +
    `<span class="dv-domrow__p">+ ${huf(BUYOUT)}</span>` +
    `</label>` +
    `<div class="dv-bill"><dl>` +
    `<dt>Hátralévő hűségidő<small>${REMAINING} hónap × ${huf(FLOOR)} (vállalt minimum)</small></dt>` +
    `<dd>${huf(PENALTY)}</dd>` +
    `<dt>Webcím vételára<small>csak ha elviszi</small></dt><dd data-domline>—</dd>` +
    `<dt class="dv-total"><strong>Összesen fizetendő</strong></dt>` +
    `<dd class="dv-total" data-total>${huf(PENALTY)}</dd>` +
    `</dl></div>` +
    `<div class="dv-conseq"><span data-domfate>A webcímet nem viszi el: a(z) ${DOMAIN} nálunk marad.</span> ` +
    `A honlap ${PERIOD_END} után nem lesz elérhető a vendégeknek.</div>` +
    `<button class="citui-btn adm-btn-bad" style="width:100%;margin-top:12px" data-settle data-goto="kesz">` +
    `Elszámolás és lemondás — ${huf(PENALTY)}</button>`
  );
}

function donePanel(backTo: string): string {
  return (
    `<div data-panel="kesz" style="display:none">` +
    card(
      "Elszámolás rögzítve",
      `<div class="dv-done">${ICON_CHECK}<span>Az elszámolást rögzítettük, a fizetéshez e-mailben küldjük a ` +
        `linket. A honlap ${PERIOD_END}-ig elérhető marad. <b data-donefate>A(z) ${DOMAIN} webcím nálunk maradt.</b></span></div>` +
        `<p class="citui-hint" style="margin:0 0 14px">A webcím tulajdonjoga minden esetben csak a teljes ` +
        `elszámolás (kötbér és díjak) maradéktalan rendezése után száll át.</p>` +
        `<button class="citui-btn citui-btn--ghost" style="width:100%" data-goto="${backTo}">Vissza</button>`,
    ) +
    `</div>`
  );
}

// ── A VÁLTOZAT — elszámolás BEÁGYAZVA a Modulok-fül lemondás-dobozába ──
function variantA(): string {
  return (
    `<p class="dv-note">A) Beágyazott — a ma is élő „Előfizetés lemondása" doboz bővül: a lenyitás után ` +
    `rögtön az elszámolást látja, és csak azzal együtt zárhat. Nincs külön képernyő.</p>` +
    `<div data-panel="fo">` +
    card(
      "Előfizetés",
      `<p class="citui-hint" style="margin:0 0 8px">Csomagja: <b>9 880 Ft/hó</b> · következő fordulónap: ${PERIOD_END}</p>` +
        `<div class="dv-danger"><h3>Előfizetés lemondása</h3>` +
        `<details open><summary>Előfizetés lemondása…</summary>` +
        domainBar() +
        settlement() +
        `</details></div>`,
      "Az előfizetés kártyája a Modulok fülön — a lemondás itt, lent lakik.",
    ) +
    `</div>` +
    donePanel("fo")
  );
}

// ── B VÁLTOZAT — KÖZBEIKTATOTT elszámolás-képernyő ──
function variantB(): string {
  return (
    `<p class="dv-note">B) Közbeiktatott — a „Lemondom" gomb erre a külön lapra hoz: az elszámolás a ` +
    `teljes felületet kapja, a lemondás csak innen zárható le; a „Mégsem" visszavisz.</p>` +
    `<div data-panel="fo">` +
    card(
      "Lemondás — elszámolás a hűségidőről",
      domainBar() + settlement() +
        `<button class="citui-btn citui-btn--ghost" style="width:100%;margin-top:9px" data-goto="megse">` +
        `Mégsem mondom le — vissza</button>`,
      "Az „Előfizetés lemondása” gombra kattintva érkezett ide.",
    ) +
    `</div>` +
    `<div data-panel="megse" style="display:none">` +
    card(
      "Minden marad a régiben",
      `<div class="dv-done">${ICON_CHECK}<span>Nem történt lemondás — az előfizetése és a webcíme változatlanul él.</span></div>` +
        `<button class="citui-btn citui-btn--ghost" style="width:100%" data-goto="fo">Vissza</button>`,
    ) +
    `</div>` +
    donePanel("fo")
  );
}

const cssText = await css();
await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "elszamolas-a.html"), shell("A változat — elszámolás a lemondás-dobozban", variantA(), cssText));
await writeFile(path.join(OUT, "elszamolas-b.html"), shell("B változat — közbeiktatott elszámolás-képernyő", variantB(), cssText));
console.log(`✅ 2 terv kiírva: ${OUT}/elszamolas-{a,b}.html`);
console.log(`   valós értékek: hátra ${REMAINING} hó × ${huf(FLOOR)} = ${huf(PENALTY)} kötbér · domain ${huf(BUYOUT)}`);
