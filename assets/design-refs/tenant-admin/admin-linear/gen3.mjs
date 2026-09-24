// Round 3 — the owner picked 2.1 (Linear) as the base. Adds: a minimalist accent colour,
// the Midnight subscription card, the Bento cover showcase on the dashboard, light/dark toggle.
import { writeFileSync } from "node:fs";
import { LOGO, page, V1 } from "./gen2.mjs";
const OUT = "/home/citoviso/wt/citd2e5a7ba/assets/design-refs/_drafts";

const EXTRA_CSS_COMMON = `
/* ── accent: ONE colour, only where it means something ── */
.frame{--accent:#1fb6d6;--accent-ink:#06131b;--link:#0f8aa6;--accent-soft:color-mix(in srgb,#1fb6d6 12%,transparent)}
.frame .btn--p{background:var(--accent);color:var(--accent-ink)}
.frame .bdg{background:var(--accent);color:var(--accent-ink)}
.frame .crumb a:hover{color:var(--link)}
.frame .spark i{background:var(--accent)}
.frame .t.is-cover{box-shadow:0 0 0 2px var(--accent)}
.frame .t__cover{background:var(--accent);color:var(--accent-ink)}.frame .t__cover svg{color:var(--accent-ink)}
.frame .covb.is-on{background:var(--accent);color:var(--accent-ink);border-color:transparent}.frame .covb.is-on svg{color:var(--accent-ink)}
.frame .iss.is-open .iss__st{border-color:var(--accent);border-style:dashed}
.frame .mrow i{background:var(--accent)}
.frame .wc__h svg{color:var(--link)}
.frame .bnav a.is-active{color:var(--link)}
.frame .seg button.on{color:var(--link);background:var(--accent-soft)}
.frame .nav a:hover{background:var(--hover)}
.frame .nav a.is-active{background:var(--accent-soft);color:var(--ink)}
.frame .nav a.is-active svg{color:var(--link)}
.frame .side__top .ib{color:var(--muted)}
/* ── dark theme ── */
.frame[data-theme="dark"]{--bg:#0f1116;--panel:#151821;--field:#1b1f29;--hover:#1e2330;--line:#262b37;--ink:#e6e9ef;--muted:#8a93a3;--ok:#3ddc97;--warn:#f0b35a;--bad:#ff7b7b;--info:#6fb8ff;--link:#4fd0ea;--accent-soft:color-mix(in srgb,#1fb6d6 16%,transparent)}
.frame[data-theme="dark"] .top{background:var(--panel)}
.frame[data-theme="dark"] .srch{background:var(--field)}
.frame[data-theme="dark"] .bnav{background:var(--panel)}
.frame[data-theme="dark"] .t:hover .t__acts{background:rgba(21,24,33,.92)}
.frame[data-theme="dark"] .side{background:#12151c;border-color:var(--line)}
.frame[data-theme="dark"] .user .av{background:var(--accent);color:var(--accent-ink)}
.frame[data-theme="dark"] .pageover{background:color-mix(in srgb,var(--accent) 22%,rgba(15,17,22,.9))}
.frame[data-theme="dark"] .drawer__box{background:var(--panel)}
/* ── subscription card (from Midnight) ── */
.plan{border:1px solid var(--line);border-radius:8px;padding:10px;margin:8px 0 0;font-size:.86em;background:radial-gradient(120% 100% at 100% 0%,color-mix(in srgb,var(--accent) 18%,transparent),transparent 60%),var(--panel)}
.plan b{display:flex;align-items:center;gap:6px;font-size:.95em}.plan b svg{color:var(--link)}
.plan small{display:block;color:var(--muted);margin:3px 0 8px;line-height:1.4}
.plan .bars{display:flex;gap:2px;height:10px;margin-bottom:8px}.plan .bars i{flex:1;border-radius:2px;background:var(--line)}.plan .bars i.on{background:var(--accent)}
.plan .btn{width:100%}
.is-rail .plan{display:none}
.plan--m{margin:14px 0 0}
/* ── cover showcase (from Bento) ── */
.covc{position:relative;border-radius:8px;overflow:hidden;background:#101828;min-height:200px;display:flex;flex-direction:column;justify-content:flex-end;margin-top:12px;border:1px solid var(--line)}
.covc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.88}
.covc__b{position:relative;padding:16px;background:linear-gradient(transparent,rgba(16,24,40,.88));color:#fff}
.covc__b b{display:block;font-size:1.05em;font-weight:600}
.covc__b span{font-size:.85em;opacity:.85;display:block;margin:2px 0 10px}
.covc__b .btn{background:#fff;border-color:#fff;color:#151a24}
.covc__b .btn--p{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.covc__tag{position:absolute;top:10px;left:10px;background:rgba(255,255,255,.92);color:#151a24;font-size:.72em;font-weight:600;padding:3px 9px;border-radius:999px;display:inline-flex;gap:5px;align-items:center}
.covc__tag svg{color:var(--link)}
.covc__meta{position:absolute;top:10px;right:10px;background:rgba(16,24,40,.55);color:#fff;font-size:.72em;font-weight:500;padding:3px 9px;border-radius:999px}
@container (min-width:900px){.covc{min-height:230px}.covc__b{padding:18px 20px;display:flex;align-items:flex-end;gap:16px}.covc__b>div{flex:1}.covc__b span{margin-bottom:0}.covc__acts{display:flex;gap:6px}}
.w>.wc{min-width:0}.mrow span{min-width:0;flex:1}
#themeBtn2{display:none}
@container (min-width:900px){#themeBtn2{display:inline-flex}}
`;

const CSS_A = `
/* A · fehér oldalsáv, cián akcent */
`;

const CSS_B = `
/* B · brand-navy oldalsáv */
@container (min-width:900px){
  .side{background:#0e2a47;border-right:0;color:#d5e1ee}
  .side__top b{color:#fff}.side__top small{color:#9fb3c8}.side__top .ib{color:#9fb3c8}
  .nav .g{color:#7f96b0}
  .nav a{color:#c9d6e5}.nav a svg{color:#8fa6bf}
  .nav a:hover{background:rgba(255,255,255,.08);color:#fff}
  .nav a.is-active{background:rgba(31,182,214,.18);color:#fff}
  .nav a.is-active svg{color:#1fb6d6}
  .nav a .n{color:#8fa6bf}
  .user{border-color:rgba(255,255,255,.12);color:#fff}.user .av{background:#1fb6d6;color:#06131b}.user span small{color:#9fb3c8}.user .ib{color:#c9d6e5}
  .plan{border-color:rgba(255,255,255,.14);background:radial-gradient(120% 100% at 100% 0%,rgba(31,182,214,.28),transparent 60%),rgba(255,255,255,.05);color:#fff}
  .plan small{color:#9fb3c8}.plan .bars i{background:rgba(255,255,255,.14)}.plan .bars i.on{background:#1fb6d6}
  .plan .btn{background:transparent;border-color:rgba(255,255,255,.25);color:#fff}
  .frame[data-theme="dark"] .side{background:#0a1f36}
}`;

const EXTRA_JS = `
const LOGO_INK=${JSON.stringify(LOGO('#17191c'))};
ICON.sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
ICON.moon='<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>';
var theme;try{theme=localStorage.getItem('citTheme')||'light'}catch(e){theme='light'}
function applyTheme(){theme=theme||'light';$('#frame').dataset.theme=theme;const l=ic(theme==='dark'?'sun':'moon',16);const b1=$('#themeBtn'),b2=$('#themeBtn2');if(b1)b1.innerHTML=l;if(b2)b2.innerHTML=l}
function toggleTheme(){theme=theme==='dark'?'light':'dark';try{localStorage.setItem('citTheme',theme)}catch(e){}applyTheme();toast(theme==='dark'?'Sötét mód':'Világos mód')}
// Subscription card — REAL: annual, started 2026-09-24, renews 2027-09-24 → month 1 of 12.
function planHtml(m){return '<div class="plan'+(m?' plan--m':'')+'"><b>'+ic('card',14)+SITE.sub.plan+'</b><small>megújul '+SITE.sub.renews+' · '+SITE.modules+' modul aktív · 1. hónap a 12-ből</small><div class="bars">'+Array.from({length:12},(_,i)=>'<i class="'+(i<1?'on':'')+'"></i>').join('')+'</div><button class="btn btn--sm" onclick="go(\\'modulok\\')">Modulok kezelése</button></div>'}
function coverHtml(){const c=P[0];if(!c)return '';return '<div class="covc"><img src="'+esc(c.url)+'" alt="'+esc(c.alt)+'"><span class="covc__tag">'+ic('starf',12)+(own?'Saját nyitókép':'Bemutató nyitókép')+'</span><span class="covc__meta">'+P.length+' kép</span><div class="covc__b"><div><b>'+SITE.name+'</b><span>'+(own?'A saját fotói láthatók az oldalán — így látja a vendég az oldal tetején.':'Jelenleg bemutató képek — az élesítéshez a saját, jogtiszta fotói kellenek.')+'</span></div><div class="covc__acts">'+(own?'<button class="btn btn--sm" onclick="go(\\'fotok\\')">'+ic('photos',14)+'Fotók kezelése</button>':'<button class="btn btn--sm btn--p" onclick="go(\\'fotok\\')">'+ic('upload',14)+'Cserélje sajátra</button>')+'<button class="btn btn--sm" onclick="openLb(0)">'+ic('eye',14)+'Nagyítás</button></div></div></div>'}
function openDrawer(){let h='',g='';for(const t of TABS){if(t[3]!==g){g=t[3];if(GROUPS[g])h+='<div class="g">'+GROUPS[g]+'</div>'}h+='<a class="'+(t[0]===cur?'is-active':'')+'" onclick="closeSheet();go(\\''+t[0]+'\\')">'+ic(t[2],16)+t[1]+badge(t[0])+'</a>'}
  $('#sheet').innerHTML='<div class="drawer__box"><div class="sheet__h">'+LOGO_INK+'<b>Boróka ház</b><span class="sp"></span><button class="ib ib--ghost" onclick="closeSheet()">'+ic('close',18)+'</button></div><div class="menu">'+h+'<div class="g">Megjelenés</div><a id="drawerTheme" onclick="toggleTheme();closeSheet()">'+ic(theme==='dark'?'sun':'moon',16)+(theme==='dark'?'Világos mód':'Sötét mód')+'</a><div class="g">boroka-haz</div><a onclick="closeSheet();toast(\\'Kilépés\\')">'+ic('logout',16)+'Kilépés</a></div></div>';$('#sheet').classList.add('on')}
function overview(){return '<div class="ph"><h1>Áttekintés</h1><p>Az oldala állapota egy képernyőn — ami teendő, az itt sorban áll.</p></div>'+
 '<div class="w"><div class="wc"><div class="wc__h">'+ic('dot',12)+'Állapot<span class="sp"></span><button class="ib ib--ghost" onclick="go(\\'webcim\\')">'+ic('moreh',14)+'</button></div><div class="wc__v" style="display:flex;align-items:center;gap:8px"><span class="chip chip--ok"><i></i>Élő</span></div><div class="wc__s">'+SITE.url+'</div></div>'+
 '<div class="wc"><div class="wc__h">'+ic('report',14)+'Látogatók · 7 nap<span class="sp"></span><button class="ib ib--ghost" onclick="go(\\'forgalom\\')">'+ic('moreh',14)+'</button></div><div class="wc__v">'+SITE.visitors7+'</div><div class="wc__s">egyedi látogató, robotok nélkül</div>'+sparkHtml(SITE.visits7)+'</div>'+
 '<div class="wc"><div class="wc__h">'+ic('mail',14)+'Üzenetek<span class="sp"></span><button class="ib ib--ghost" onclick="go(\\'uzenetek\\')">'+ic('moreh',14)+'</button></div>'+SITE.msgs.map(m=>'<div class="mrow'+(m.u?'':' is-read')+'"><i></i><span>'+m.s+'</span><em class="d" style="font-style:normal">'+m.d+'</em></div>').join('')+'</div></div>'+
 coverHtml()+
 '<div class="issues"><div class="issues__h">Teendők <span class="cnt">'+(own?0:1)+' nyitott</span><span class="sp"></span><span class="cnt">'+SITE.modules+' modul · '+SITE.billed+' számlázott</span></div>'+
 (own?'<div class="iss is-done" onclick="go(\\'fotok\\')"><i class="iss__st"></i><span>Saját fotók feltöltése</span><em class="m">Fotók</em></div>':'<div class="iss is-open" onclick="go(\\'fotok\\')"><i class="iss__st"></i><span>Töltsön fel saját fotókat — bemutató képek láthatók</span><em class="m"><span class="chip chip--warn">Élesítés előtt</span>Fotók</em></div>')+
 '<div class="iss is-done" onclick="go(\\'szovegek\\')"><i class="iss__st"></i><span>Bemutatkozó szöveg</span><em class="m">Szövegek</em></div><div class="iss is-done"><i class="iss__st"></i><span>Az oldal élő és nyilvános</span><em class="m">Webcím</em></div></div>'+
 '<div class="plan-m-slot" id="planM"></div>'}
function render(){const t=tabOf(cur);$('#nav').innerHTML=navHtml();$('#bnav').innerHTML=bnavHtml();$('#railBtn').innerHTML=ic(rail?'expand':'collapse',14);$('#plan').innerHTML=planHtml(false);
  $('#topMenu').innerHTML=ic('menu',18);$('#topBack').innerHTML=ic('back',18);$('#topBack').style.visibility=cur==='attekintes'?'hidden':'visible';
  $('#crumb').innerHTML=(cur==='attekintes'?'<b>Boróka ház</b>':'<a onclick="go(\\'attekintes\\')">Boróka ház</a>'+ic('fwd',13)+'<b>'+t[1]+'</b>');
  $('#srch').innerHTML=ic('search',14)+'Keresés…<kbd>⌘K</kbd>';$('#extBtn').innerHTML=ic('external',14)+'<span>Oldal</span>';
  $('#priBtn').innerHTML=cur==='fotok'?ic('upload',14)+'Feltöltés':ic('plus',14)+'Új';$('#priBtn').onclick=()=>cur==='fotok'?pickFiles(false):toast('Új: szöveg, fotó vagy modul');
  const v=$('#view');v.innerHTML=cur==='attekintes'?overview():cur==='fotok'?photos():'<div class="ph"><h1>'+t[1]+'</h1></div>'+stubHtml(cur);
  if(cur==='attekintes'&&isMobile())$('#planM').innerHTML=planHtml(true);
  if(cur==='fotok'){bindPhoto(v);$('.ph__acts').innerHTML='';}applyTheme()}
render();`;

function variant(id, title, refs, decides, css) {
  return {
    file: `admin3-${id}.html`, title, refs, decides,
    css: V1.css + EXTRA_CSS_COMMON + css,
    body: V1.body
      .replace('<div class="user"><span class="av">BH</span><span>Boróka ház<small>tulajdonos</small></span></div>',
        '<div class="plan" id="plan"></div><div class="user"><span class="av">BH</span><span>Boróka ház<small>tulajdonos</small></span><button class="ib ib--ghost" id="themeBtn" onclick="toggleTheme()" title="Világos / sötét"></button></div>')
      .replace(`<button class="btn btn--sm" onclick="toast('Megnyílik az oldala új lapon')" id="extBtn"></button>`,
        `<button class="ib ib--ghost" id="themeBtn2" onclick="toggleTheme()" title="Világos / sötét"></button><button class="btn btn--sm" onclick="toast('Megnyílik az oldala új lapon')" id="extBtn"></button>`),
    js: V1.js + EXTRA_JS,
  };
}
const A = variant("A-cian", "3A · Linear + cián akcent (fehér oldalsáv) · világos/sötét",
  "2.1 Linear alap + a Midnight előfizetés-kártyája + a Bento nyitókép-mutatója",
  `A szín <b>egyetlen akcent</b> (a logó ciánja): elsődleges gomb, aktív menüpont, jelvény, szikra-diagram, nyitókép-jelölő, link — minden más szürke/fekete, a jelentés-színek (zöld/borostyán/piros) maradnak. <b>Oldalsáv fehér marad.</b> Alul az <b>előfizetés-kártya</b> (éves · megújul 2027. szept. 24. · 1. hónap a 12-ből — valós), a műszerfalon a <b>nyitókép-mutató</b> „Cserélje sajátra" hívással. <b>Világos/sötét váltó</b> a fejlécben (asztali) és a fiók-sorban; a választás megmarad.`,
  CSS_A);
const B = variant("B-navy", "3B · Linear + brand-navy oldalsáv · világos/sötét",
  "2.1 Linear alap + a Midnight előfizetés-kártyája + a Bento nyitókép-mutatója",
  `Ugyanaz a mag, de az <b>oldalsáv a márka sötétkékje</b> (a logó navyja), így a menü súlyt kap és a tartalom világos marad; az aktív pont cián. Az akcent, az előfizetés-kártya, a nyitókép-mutató és a <b>világos/sötét váltó</b> azonos az A-val — a különbség egyetlen döntés: <b>fehér vagy navy oldalsáv</b>.`,
  CSS_B);
for (const v of [A, B]) { writeFileSync(`${OUT}/${v.file}`, page(v)); console.log("wrote", v.file); }
