// §2b draft builder — the PHONE masthead + booking bar, three variants, rendered by the REAL
// engine from Laguna Panzió's persisted inputs (5 templates: 2 overlay, 3 flow). Each cell is
// a full mock file with the variant CSS appended, shown in an iframe so the template's own
// @media rules fire at the iframe's width (a shrunk div would not re-layout them).
//   npx tsx assets/design-refs/engine/name-masthead/phone/build.mts   (→ _drafts/masthead-phone/)
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "kysely";
import { db } from "../../../../../src/db/client.js";
import type { Recipe, SiteData } from "../../../../../src/engine/recipe.js";
import { renderSite } from "../../../../../src/engine/render.js";
import { injectRuntime } from "../../../../../src/generator/runtime.js";

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../_drafts/masthead-phone");
const TPLS = ["fullbleed", "dark-luxury", "transit", "artdeco", "brutalism"];
const HAS_BAR = new Set(["fullbleed", "dark-luxury", "transit", "brutalism"]);

// B — the band collapses to the hot link as a chip in the template's shape; tighter air
const CSS_B = `
@media(max-width:720px){
  .cit-mast{padding-top:var(--mast-pad-m,22px)}
  .cit-mast-place{margin-top:6px;gap:10px}
  .cit-mast-place span{letter-spacing:3px;font-size:10px}
  .cit-mast-links{border:0;margin-top:8px;gap:0;max-width:none}
  .cit-mast-links a.cit-mast-hot{text-decoration:none;border:1px solid var(--mast-line,color-mix(in srgb,currentColor 35%,transparent));
    border-radius:var(--mast-chip,999px);padding:0 18px;min-height:44px}
  body.cit-tpl-brutalism .cit-mast{--mast-chip:0}
  body.cit-tpl-artdeco .cit-mast{--mast-chip:0}
  body.cit-tpl-transit .cit-mast{--mast-chip:2px}
}`;
// C — B + a template whose phone carries a fixed booking bar drops the band entirely (the CTA
// lives in the bar), and the overlay (photo) masthead drops the hairlines so the photo breathes
const CSS_C = CSS_B + `
@media(max-width:720px){
  .cit-mast[data-cit-mast-bar] .cit-mast-links{display:none}
  .cit-mast[data-cit-mast-overlay] .cit-mast-place::before,.cit-mast[data-cit-mast-overlay] .cit-mast-place::after{display:none}
  .cit-mast[data-cit-mast-overlay]{padding-top:18px}
}`;
// the booking bar: value big, label small on ONE line (ellipsis) — never three lines
const CSS_BAR = `
.cit-mobcta__t{display:flex;flex-direction:column;min-width:0;line-height:1.25;gap:1px}
.cit-mobcta__t b{font-size:17px;display:inline-flex;align-items:center;gap:5px}
.cit-mobcta__t b svg{width:14px;height:14px}
.cit-mobcta__t small{font-size:12px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0;text-transform:none;font-family:var(--cit-font-body)}`;

const STAR = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 5.9 21l1.3-6.8-5-4.7 6.8-.8z"/></svg>`;
function stackBar(html: string): string {
  // <span><b>4,1</b> · Google-értékelés · 182 vélemény</span> → stacked
  return html.replace(/<span>(?:<b>|<span class="tb-num">)([^<]+)(?:<\/b>|<\/span>) · ([^<]+)<\/span>/g,
    (_m, v, l) => `<span class="cit-mobcta__t"><b>${v} ${STAR}</b><small>${l}</small></span>`)
    .replace(/<span>([0-9],[0-9]) — ([^<]+)<\/span>/g, (_m, v, l) => `<span class="cit-mobcta__t"><b>${v} ${STAR}</b><small>${l}</small></span>`);
}

const cells: string[] = [];
for (const tpl of TPLS) {
  const row = await db.selectFrom("mock_artifact").innerJoin("lead", "lead.id", "mock_artifact.lead_id")
    .select(["mock_artifact.inputs as inputs"]).where("lead.name", "=", "Laguna Panzió")
    .where(sql<string>`mock_artifact.inputs->'recipe'->>'template'`, "=", tpl)
    .orderBy("mock_artifact.generated_at", "desc").executeTakeFirstOrThrow();
  const inputs = row.inputs as { recipe: Recipe; siteData: SiteData };
  let base = await injectRuntime(renderSite(inputs.recipe, inputs.siteData, { phase: "mock" }), inputs.siteData.lang);
  base = base.replace('<header class="cit-mast">', `<header class="cit-mast"${HAS_BAR.has(tpl) ? " data-cit-mast-bar" : ""}${["fullbleed", "dark-luxury"].includes(tpl) ? " data-cit-mast-overlay" : ""}>`);
  for (const [v, css] of [["A", ""], ["B", CSS_B], ["C", CSS_C]] as const) {
    let html = v === "A" ? base : stackBar(base);
    html = html.replace("</head>", `<style data-variant="${v}">${css}${v === "A" ? "" : CSS_BAR}</style></head>`);
    await writeFile(path.join(OUT, `cell-${tpl}-${v}.html`), html);
  }
  cells.push(tpl);
}
const plan = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telefonos fejléc — A/B/C</title>
<link rel="stylesheet" href="../../../../public/assets/ui/citui.css">
<style>
body{margin:0;background:var(--citui-bg);color:var(--citui-ink);font-family:var(--citui-font-body,system-ui)}
.bar{position:sticky;top:0;z-index:9;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 16px;background:var(--citui-surface);border-bottom:1px solid var(--citui-line)}
.bar b{margin-right:6px}.bar button{padding:8px 14px;border:1px solid var(--citui-line);background:var(--citui-bg);color:var(--citui-ink);border-radius:999px;cursor:pointer;font:inherit;min-height:44px}
.bar button[aria-pressed=true]{background:var(--citui-accent);color:var(--citui-on-accent);border-color:var(--citui-accent)}
.note{padding:12px 16px;font-size:14px;line-height:1.5;max-width:900px}
.grid{display:grid;gap:16px;padding:16px;grid-template-columns:repeat(auto-fill,minmax(390px,1fr))}
.grid.desk{grid-template-columns:1fr}
.cell{display:flex;flex-direction:column;gap:6px}
.cell h3{margin:0;font-size:14px;font-weight:600}
iframe{border:1px solid var(--citui-line);background:#fff;width:390px;height:760px;display:block}
.grid.desk iframe{width:100%;height:640px}
.m{font-size:12px;color:var(--citui-muted)}
</style></head><body>
<div class="bar"><b>Változat</b><button data-v="A" aria-pressed="false">A · mai</button><button data-v="B" aria-pressed="false">B · pirula-csík</button><button data-v="C" aria-pressed="true">C · sáv nélkül + levegő</button>
<b style="margin-left:12px">Méret</b><button data-s="m" aria-pressed="true">Mobil 390 px</button><button data-s="d" aria-pressed="false">Asztali</button></div>
<div class="note"><b>Mit dönt el:</b> a masthead telefonos alakja (kontraktus: név → hely → link-sáv, 2026-08-30 — a szerkezet marad, a telefonos <em>sűrűség</em> és a link-sáv alakja változik) + a Foglalás-sáv szövege (érték nagyban, felirat egy sorban). <b>A</b> = a mai állapot. <b>B</b> = a link-sáv a sablon alakját viselő pirula, szűkebb levegő. <b>C</b> = B + ahol a telefonon rögzített Foglalás-sáv van, a fejléc nem ismétli a gombot; fotós (overlay) fejlécnél a léniák eltűnnek, a fotó lélegzik. Asztalon mindhárom AZONOS (a változás ≤ 720 px-re szól) — az asztali nézet ezt bizonyítja.</div>
<div class="grid" id="g">${cells.map((t) => `<div class="cell"><h3>${t}</h3><iframe data-t="${t}" loading="lazy" title="${t}"></iframe><span class="m" data-m="${t}"></span></div>`).join("")}</div>
<script>
let V="C",S="m";
function apply(){document.querySelectorAll('.bar button[data-v]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===V)));document.querySelectorAll('.bar button[data-s]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.s===S)));
document.getElementById('g').classList.toggle('desk',S==='d');
document.querySelectorAll('iframe[data-t]').forEach(f=>{const src='cell-'+f.dataset.t+'-'+V+'.html';if(f.getAttribute('src')!==src)f.setAttribute('src',src);});}
document.querySelectorAll('.bar button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.v)V=b.dataset.v;if(b.dataset.s)S=b.dataset.s;apply();}));
// live measurement inside each cell: masthead height + h1 top + bar height (same-origin file iframes)
setInterval(()=>{document.querySelectorAll('iframe[data-t]').forEach(f=>{try{const d=f.contentDocument;if(!d||!d.body)return;const m=d.querySelector('.cit-mast'),h=d.querySelector('h1'),bar=d.querySelector('[class$="-mobcta"]');const r=e=>e?e.getBoundingClientRect():null;const mr=r(m),hr=r(h),br=r(bar);
document.querySelector('[data-m="'+f.dataset.t+'"]').textContent='fejléc '+(mr?Math.round(mr.height)+' px':'–')+' · főcím teteje '+(hr?Math.round(hr.top)+' px':'–')+(br&&br.height?' · sáv '+Math.round(br.height)+' px':'');}catch(e){}});},800);
if(matchMedia('(max-width:720px)').matches){S='m'}apply();
</script></body></html>`;
await writeFile(path.join(OUT, "plan.html"), plan);
console.log("✓ plan.html + " + cells.length * 3 + " cell");
process.exit(0);
