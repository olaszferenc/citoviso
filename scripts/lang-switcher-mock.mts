// MŰKÖDŐ MOCK — látogatói nyelvváltó (§2b terv-kapu, ADR-0076/0077).
// A tulaj döntése (2026-08-28): „a C a jó irány, csak ne lógjon bele a Foglalás
// gombba" + „mobilon jó a felső sáv, csak ne legyen sticky" + „mi van a többi
// mock típussal?".
//
// Ez a mock AZT a döntést valósítja meg, és tényleg MŰKÖDIK:
//   · a nyelvválasztás VALÓDI: a lap szövegei a legenerált de/it/en változatokból
//     cserélődnek (nem álcázott kattintás);
//   · MÉRET-VÁLTÓ: „Mobil 390px / Asztali" — iframe-szélességet állít, így a sablon
//     SAJÁT @media szabályai futnak le (egy szűkített div-ben nem futnának);
//   · a „többi sablon" kérdésre a mérés válaszol: a fejlécben ott a 16 sablonos
//     ütközés-riport eredménye.
//
//   npx tsx scripts/lang-switcher-mock.mts
//     → assets/design-refs/_drafts/nyelvvalto-mock.html  (gitignore-olt, munkafán belül)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { flagSvg } from "../src/ui/flags.js";

const SITE = "sites/f6a81bc2-8386-419c-8bfe-811e3f836e53";
const OUT = path.resolve(import.meta.dirname, "../assets/design-refs/_drafts");
const LANGS = [
  { code: "hu", name: "Magyar", dir: "" },
  { code: "de", name: "Deutsch", dir: "de" },
  { code: "it", name: "Italiano", dir: "it" },
  { code: "en", name: "English", dir: "en" },
];

/** A lap látható szövegei nyelvenként — a VALÓDI generált változatokból. */
async function textsFor(dir: string): Promise<Record<string, string>> {
  const file = path.resolve(process.cwd(), SITE, dir, "index.html");
  const html = await readFile(file, "utf8");
  const pick = (re: RegExp): string => (re.exec(html)?.[1] ?? "").replace(/<[^>]*>/g, "").trim();
  return {
    eyebrow: pick(/<span class="sb-eyebrow">([\s\S]*?)<\/span>/i),
    h1: pick(/<h1>([\s\S]*?)<\/h1>/i),
    lead: pick(/<h1>[\s\S]*?<\/h1>\s*<p>([\s\S]*?)<\/p>/i),
    cta1: pick(/<a class="cit-btn" href="#cit-enquiry">([\s\S]*?)<\/a>/i),
    nav: pick(/<div class="sb-menu">([\s\S]*?)<\/div>/i).replace(/\s+/g, " · "),
  };
}

const texts: Record<string, Record<string, string>> = {};
for (const l of LANGS) texts[l.code] = await textsFor(l.dir);

const chip = (compact = false) =>
  `<details class="cl"><summary>${flagSvg("hu", 18)}<span data-cl-cur>Magyar</span><i>▾</i></summary>` +
  `<div class="cl-list">` +
  LANGS.map(
    (l) =>
      `<a href="#" data-cl="${l.code}">${flagSvg(l.code, 18)}<span>${l.name}</span></a>`,
  ).join("") +
  `</div></details>${compact ? "" : ""}`;

const bar = () =>
  `<div class="cl-bar">` +
  LANGS.map(
    (l, i) =>
      `<a href="#" class="cl-i${i === 0 ? " on" : ""}" data-cl="${l.code}">` +
      `${flagSvg(l.code, 18)}<span>${l.name}</span></a>`,
  ).join("") +
  `</div>`;

/** A mock BELSEJE: a valódi oldal + a döntött elhelyezés + valódi nyelvcsere. */
async function innerDoc(): Promise<string> {
  const raw = await readFile(path.resolve(process.cwd(), SITE, "index.html"), "utf8");
  // A jelenlegi (láthatatlan) kapcsolót kivesszük — a döntött megoldás lép a helyére.
  const clean = raw.replace(/<div class="cit-lang-switch"[\s\S]*?<\/div>\s*(?=<\/body>)/i, "");
  const css = `
.cl{position:relative;font:600 12px/1 var(--cit-font-body,system-ui)}
.cl>summary{list-style:none;display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;
  color:inherit;background:color-mix(in srgb,currentColor 14%,transparent);
  border:1px solid color-mix(in srgb,currentColor 26%,transparent);cursor:pointer}
.cl>summary::-webkit-details-marker{display:none}
.cl>summary i{font-style:normal;opacity:.6}
.cl-list{position:absolute;right:0;top:calc(100% + 6px);padding:5px;border-radius:12px;min-width:160px;
  background:var(--cit-surface,#fff);box-shadow:0 8px 24px rgba(0,0,0,.22);z-index:20}
.cl-list a{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;
  color:var(--cit-ink,#222);text-decoration:none}
.cl-innav{display:inline-flex;align-items:center;margin-left:10px;vertical-align:middle}
/* MOBIL: saját sáv a lap tetején. NEM sticky (a tulaj kérése) — kigörög. */
.cl-bar{display:none;justify-content:center;gap:2px;padding:6px 8px;
  background:var(--cit-surface,#f7f7f7);border-bottom:1px solid var(--cit-line,#e5e5e5)}
.cl-bar .cl-i{display:inline-flex;align-items:center;gap:6px;padding:5px 7px;border-radius:8px;
  color:var(--cit-ink,#222);text-decoration:none;opacity:.72;font:600 11px/1 var(--cit-font-body,system-ui)}
.cl-bar .cl-i.on{opacity:1;background:color-mix(in srgb,var(--cit-accent,#888) 18%,transparent)}
@media(max-width:640px){.cl-bar{display:flex}.cl-innav{display:none}}`;
  const js = `<script>(function(){
  var T=${JSON.stringify(texts)};
  function set(code){
    var t=T[code]; if(!t) return;
    var q=function(s){return document.querySelector(s)};
    if(q('.sb-eyebrow')) q('.sb-eyebrow').textContent=t.eyebrow;
    if(q('header h1')) q('header h1').textContent=t.h1;
    var p=document.querySelector('header h1 + p'); if(p) p.textContent=t.lead;
    var c=document.querySelector('a.cit-btn[href="#cit-enquiry"]'); if(c) c.textContent=t.cta1;
    document.documentElement.lang=code;
    var names={hu:'Magyar',de:'Deutsch',it:'Italiano',en:'English'};
    var cur=document.querySelector('[data-cl-cur]'); if(cur) cur.textContent=names[code];
    document.querySelectorAll('.cl-bar .cl-i').forEach(function(a){
      a.classList.toggle('on', a.getAttribute('data-cl')===code)});
    var d=document.querySelector('.cl'); if(d) d.open=false;
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest('[data-cl]'); if(!a) return; e.preventDefault(); set(a.getAttribute('data-cl'));
  });
})();</script>`;
  let out = clean.replace("</head>", `<style>${css}</style></head>`);
  out = out.replace(/<body([^>]*)>/i, `<body$1>${bar()}`);
  const nav = /<nav[\s\S]*?<\/nav>/i.exec(out) ?? /<header[\s\S]*?<\/header>/i.exec(out);
  if (nav) {
    const b = nav[0];
    const last = b.lastIndexOf("</a>");
    out = out.replace(b, b.slice(0, last + 4) + `<span class="cl-innav">${chip()}</span>` + b.slice(last + 4));
  }
  return out.replace("</body>", `${js}</body>`);
}

const inner = await innerDoc();
const collision = JSON.parse(
  await readFile(path.resolve(process.cwd(), "assets/design-refs/tenant-site/lang-switcher-collision.json"), "utf8"),
) as Record<string, Record<string, string>>;
const okCount = Object.values(collision.v6 ?? {}).filter((x) => x === "ok").length;
const total = Object.keys(collision.v6 ?? {}).length;

const page = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TERV — látogatói nyelvváltó</title><style>
body{margin:0;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#eef2f6;color:#16283f}
.tb{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:10px;align-items:center;
  padding:10px 14px;background:#16283f;color:#fff}
.tb b{font-size:14px}.tb .sp{flex:1}
.tb button{font:600 13px/1 inherit;padding:9px 14px;border-radius:999px;border:1px solid #ffffff55;
  background:transparent;color:#fff;cursor:pointer}
.tb button.on{background:#1fb6d6;border-color:#1fb6d6;color:#0e2a47}
.note{padding:10px 14px;background:#fff;border-bottom:1px solid #dde5ec;font-size:13px}
.note b{color:#0e7d99}
.stage{display:flex;justify-content:center;padding:16px}
iframe{border:1px solid #cfd8e3;border-radius:10px;background:#fff;height:78vh;width:100%;max-width:1280px}
iframe.mobil{width:390px}
</style></head><body>
<div class="tb"><b>TERV — látogatói nyelvváltó</b>
  <span class="sp"></span>
  <button id="b390">Mobil 390px</button>
  <button id="bdesk" class="on">Asztali</button>
</div>
<div class="note">
  A te döntésed megvalósítva: <b>asztalin</b> a lenyíló chip a sablon SAJÁT menüsorába szőve
  (ezért nem lóghat bele a Foglalás gombba), <b>mobilon</b> felső sáv, ami <b>nem sticky</b> — görgetésnél kimegy.
  A nyelvváltás itt IGAZI: a lap szövegei a legenerált változatokból cserélődnek.
  <br>„Mi van a többi mock típussal?" → mind a 16 sablonon és mindkét nézetben lemérve:
  <b>${okCount}/${total} ütközésmentes</b> (a mérés: assets/design-refs/tenant-site/lang-switcher-collision.json).
</div>
<div class="stage"><iframe id="fr" title="terv"></iframe></div>
<!-- A tervezett OLDAL sima szövegként: JS-stringbe téve az escape-elés
     eltörte a külső szkriptet. A záró script-tag mintáját feltörjük.
     (Tanulság: az első javításom KOMMENTJE tartalmazta a záró tagot,
     és pont az zárta le a szkriptet — mérve.) -->
<script type="text/plain" id="doc">${inner.replace(/<\/(script)/gi, "&lt;/$1")}</script>
<script>
var DOC = document.getElementById("doc").textContent.split("&lt;/script").join("</scr" + "ipt");
var fr = document.getElementById("fr");
function load(){ fr.srcdoc = DOC; }
document.getElementById("b390").onclick=function(){fr.classList.add("mobil");
  this.classList.add("on");document.getElementById("bdesk").classList.remove("on");load();};
document.getElementById("bdesk").onclick=function(){fr.classList.remove("mobil");
  this.classList.add("on");document.getElementById("b390").classList.remove("on");load();};
load();
</script></body></html>`;

await mkdir(OUT, { recursive: true });
const dest = path.join(OUT, "nyelvvalto-mock.html");
await writeFile(dest, page, "utf8");
console.log(dest);
process.exit(0);
