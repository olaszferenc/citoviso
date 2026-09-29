// ŐR: minden csillagsor LÁTHATÓ és ÉSSZERŰ MÉRETŰ — mind a 19 sablonon, böngészőben mérve.
// gate-runner: self-overlap-safe — renders in memory (setContent), writes no file, no row, no shared path; the --self-test and the gate may run side by side (ADR-0261)
//
// A LELETEK — a csillagsor rossz MÉRETÉT kétszer is csak KÉP fogta meg, őr nem:
//   ① 2026-09-28, a trió (arch-frames, tilted-gallery, wordmark-grow): a `.a-stars` stb. SVG-je
//     0×0 px volt (viewBox-only SVG egy inline-flex sorban) — a csillag sosem látszott (114e161d);
//   ② 2026-09-29, claymorphism: a vélemény-fejléc sora (`.cl-revscore .cl-st`) méretezetlen
//     viewBox-SVG volt → ~115 px-es csillagok EGYMÁS ALATT (fa5e6897).
// A darabszámot a `rating-scale-check` méri; ez az őr a MÉRETET, a LÁTHATÓSÁGOT és a SORT.
//
// Mit mér: 19 sablon × {élő, mock} × {telefon 390 px (isMobile, touch, DPR 3), asztali 1280 px}.
// Csillagsor = egy elem, amelynek ≥ 2 közvetlen gyermeke a közös csillag-SVG (`STAR_PATH`) —
// hős, vélemény-fejléc, vélemény-kártyák, dokk/sáv: bármi, ami a lapon van. A sort a képernyő
// közepére görgeti (`behavior:"instant"` — a sablonok `scroll-behavior:smooth`-a különben a
// mérés UTÁN érkezne), a fixed/sticky sort a hős UTÁNI pozícióból méri, a futó animációkat
// és átmeneteket a végállapotukba teszi (a `mo("in")` beúszás a VÉGÉN kell, hogy látsszon).
// Minden csillagra:
//   · nem 0×0; nincs `display:none`/`visibility:hidden` őse; az effektív opacity ≥ 0,5;
//   · teljesen a viewporton belül, és a közepén a hit-test a csillagot adja (nem takarja más —
//     a mérés idejére CSAK a csillagok kapnak `pointer-events:auto`-t; az egész lapra kényszerítve
//     a brutalism kattintás-áteresztő dekor-rétege hamis „takarót” adott. Következmény: egy
//     `pointer-events:none` réteg takarását ez a próba nem látja — azt a kép-ellenőrzés fogja);
//   · a mérete a SOR saját szövegméretéhez viszonyítva 0,5–2,2 em (a sablon betűméretéhez
//     kötve, nem fix px-hez — mérve ma 0,62–1,31 em; a 115 px-es claymorphism ~8,5 em volt);
//   · a sor minden csillaga EGY vonalban (a tetejük a csillag-magasság felén belül), balról jobbra.
// Kivétel CSAK a `HIDDEN_BY_DESIGN` listán, indokkal — és csak akkor, ha a kivett sor TÉNYLEG
// egészében rejtett (a konténere nincs kirajzolva); ha egyszer mégis látszik, rendesen mérve lesz,
// és a fel nem használt kivétel bukás (elavult kivétel nem maradhat a listán).
//
//   npx tsx scripts/star-size-check.mts              # zöld futás
//   npx tsx scripts/star-size-check.mts --self-test  # PIROS kontroll (a két régi hiba + 2 visszarontás)
//   CIT_SSC_JOBS=1 …                                  # soros mérés (alapból 6 párhuzamos lap)

process.env.CIT_SHOT = "1";

import { chromium, type Browser } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";

const SELF_TEST = process.argv.includes("--self-test");
const JOBS = Math.max(1, Number(process.env.CIT_SSC_JOBS) || 6);

const PHOTO = (i: number) => ({ url: `https://star-size-check.test/p${i}.png`, alt: `fotó ${i}`, provenance: "owner" as const });
const demo: SiteData = {
  name: "Nyugalom Vendégház",
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
  highlights: ["Saját parkoló az udvarban", "Kert grillezővel", "Csendes környék"],
  photos: [0, 1, 2, 3, 4, 5].map(PHOTO),
  rooms: [{ name: "Kertre néző szoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
  reviews: [
    { quote: "Csendes, tiszta, kedves vendéglátók.", author: "Anna", meta: "Budapest" },
    { quote: "A kertben reggelizni felejthetetlen volt.", author: "Péter", meta: "Győr" },
    { quote: "Mindent előre, pontosan láttunk.", author: "Kata" },
  ],
  // The rating stat the generator emits (generateEngine.ts): most templates draw their header
  // star row next to it — without it the row is absent and the guard would be blind there.
  stats: [{ value: "4,4", label: "Google-értékelés · 82 vélemény", icon: "star" }, { value: "3", label: "szoba" }],
  rating: { value: 4.4, count: 82, url: "https://www.google.com/maps/place/?q=place_id:x" },
  googleRating: { value: 4.4, count: 82, url: "https://www.google.com/maps/place/?q=place_id:x" },
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
  place: { city: "Példaváros", country: "HU" },
} as SiteData;
const sections: Recipe["sections"] = (["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const).map((kind) => ({ kind }));

type Phase = "live" | "mock";
async function render(id: string, phase: Phase): Promise<string> {
  const tpl = TEMPLATES[id]!;
  const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections };
  const html = await injectRuntime(renderSite(recipe, demo, { phase }), demo.lang);
  // The ADR-0115 opening curtain (arch-frames `.cit-fintro`, wordmark-grow `.cit-intro`) is a
  // first-visit, ~2–3 s full-screen overlay that removes itself; the stars are judged on the
  // page BEHIND it. The runtime's own switch (the one prospectNotice.ts uses) skips it.
  return html.replace(/<html\b/i, "<html data-cit-no-intro");
}

const VIEWPORTS = [
  { key: "390", width: 390, height: 844, mobile: true },
  { key: "1280", width: 1280, height: 800, mobile: false },
] as const;
type VpKey = (typeof VIEWPORTS)[number]["key"];

/** Rows hidden ON PURPOSE. `within` = a selector of the row's hidden container. */
const HIDDEN_BY_DESIGN: { tpl: string; vp: VpKey; within: string; why: string }[] = [
  {
    tpl: "card-sidebar",
    vp: "1280",
    within: ".mob-book",
    why: "a telefonos foglalósáv (értékeléssel) asztalon szándékosan nincs kirajzolva — ott az oldalsáv foglaló-kártyája mutatja ugyanezt",
  },
];

// ⛔ PIROS KONTROLL (--self-test): each planted fault must make exactly its (template, rule) go red.
const PLANTED: { tpl: string; why: string; plant: (html: string) => string; expect: RegExp }[] = [
  {
    tpl: "tilted-gallery",
    why: "① 2026-09-28: a trió 0×0 px-es csillag-SVG-je (a méret-szabály nélkül)",
    plant: (h) => h.replace(/\.t-stars svg\{[^}]*\}/, ""),
    expect: /0×0/,
  },
  {
    tpl: "claymorphism",
    why: "② 2026-09-29: a claymorphism vélemény-fejlécének méretezetlen viewBox-SVG-je (a régi, csak-kártyás szabály)",
    plant: (h) => h.replace(".cl-st{display:flex;gap:3px}", ".cl-rv .cl-st{display:flex;gap:3px}").replace(".cl-st svg{width:16px", ".cl-rv .cl-st svg{width:16px"),
    expect: /em —|nem egy sorban/,
  },
  {
    tpl: "organic",
    why: "③ a vélemény-kártyák sora rejtve (visibility:hidden)",
    plant: (h) => h.replace("</head>", "<style>footer .og-st{visibility:hidden}</style></head>"),
    expect: /rejtett/,
  },
  {
    tpl: "aurora",
    why: "④ a fejléc-sor fölé egy takaró réteg kerül",
    plant: (h) => h.replace("</head>", "<style>.au-stars{position:relative}.au-stars::after{content:'';position:absolute;inset:-4px;background:var(--cit-bg,#fff)}</style></head>"),
    expect: /takarja/,
  },
];

const PROBE = `(async () => {
  const D = 'M12 2.2l2.95';
  const W = innerWidth, H = innerHeight;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // A reveal lands AFTER the scroll: IntersectionObserver callback → setTimeout(data-cit-motion-delay)
  // → class → transition. Wait out the largest delay on the page, then jump every running
  // animation/transition to its end state (what the guest sees once it has played).
  const maxDelay = Math.max(0, ...[...document.querySelectorAll('[data-cit-motion-delay]')].map((e) => +e.getAttribute('data-cit-motion-delay') || 0));
  const settle = async () => { await frame(); await new Promise((r) => setTimeout(r, 60 + maxDelay)); await frame();
    for (let i = 0; i < 2; i++) { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } await frame(); } };
  const isStar = (s) => { const p = s.querySelector(':scope > path'); return !!p && (p.getAttribute('d') || '').startsWith(D); };
  const byRow = new Map();
  for (const s of document.querySelectorAll('svg')) if (isStar(s) && s.parentElement) {
    const k = s.parentElement; if (!byRow.has(k)) byRow.set(k, []); byRow.get(k).push(s);
  }
  const name = (el) => { const p = []; for (let e = el; e && e !== document.documentElement && p.length < 3; e = e.parentElement) p.push(e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')); return p.join(' < '); };
  const fixedPos = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
  const hiddenBy = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none') return 'display:none'; if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return 'visibility:' + cs.visibility; } return ''; };
  const effOp = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  const refFs = (el) => { for (let e = el; e; e = e.parentElement) { const f = parseFloat(getComputedStyle(e).fontSize); if (f > 0) return f; } return 16; };
  // Hit-testing skips pointer-events:none elements, so the STARS are forced hittable for the
  // measurement — only them: forcing it page-wide turned a decorative, click-through overlay
  // (brutalism's body pseudo-element) into a false "cover".
  const pe = document.createElement('style'); pe.textContent = 'svg:has(> path[d^="' + D + '"]), svg:has(> path[d^="' + D + '"]) *{pointer-events:auto!important}';
  document.head.appendChild(pe);
  const rows = [];
  for (const [row, stars] of byRow) {
    if (stars.length < 2) continue;
    if (fixedPos(row)) { scrollTo({ top: Math.round(H * 1.5), behavior: 'instant' }); }
    else row.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    await settle();
    const fs = refFs(row);
    const hiddenRow = hiddenBy(row);
    const rr = row.getBoundingClientRect();
    const st = stars.map((s) => {
      const r = s.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let hit = null;
      if (r.width > 0 && r.height > 0 && cx >= 0 && cx < W && cy >= 0 && cy < H) hit = document.elementFromPoint(cx, cy);
      return {
        w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom,
        hidden: hiddenBy(s), op: effOp(s),
        hitOk: !!hit && (hit === s || s.contains(hit)),
        hitBy: hit ? (hit === s || s.contains(hit) ? '' : name(hit)) : 'null@' + Math.round(cx) + ',' + Math.round(cy),
      };
    });
    rows.push({ name: name(row), fs, hiddenRow, rowBox: [rr.width, rr.height], stars: st, W, H });
  }
  pe.remove();
  return rows;
})()`;

interface StarM { w: number; h: number; l: number; t: number; r: number; b: number; hidden: string; op: number; hitOk: boolean; hitBy: string }
interface RowM { name: string; fs: number; hiddenRow: string; rowBox: [number, number]; stars: StarM[]; W: number; H: number }

const MIN_EM = 0.5;
const MAX_EM = 2.2;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Judge one measured page; returns findings (empty = green). */
function judge(tpl: string, vp: VpKey, rows: RowM[], usedExceptions: Set<number>): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const at = `${row.name}`;
    const exIdx = HIDDEN_BY_DESIGN.findIndex((e) => e.tpl === tpl && e.vp === vp && row.name.includes(e.within.slice(1)));
    // An exception holds only while the WHOLE container is really not drawn.
    if (exIdx >= 0 && (row.hiddenRow === "display:none" || row.rowBox[0] * row.rowBox[1] === 0)) {
      usedExceptions.add(exIdx);
      continue;
    }
    const s = row.stars;
    const zero = s.filter((x) => !(x.w > 0.5 && x.h > 0.5));
    if (zero.length) {
      out.push(`${at}: ${zero.length}/${s.length} csillag 0×0 px (${[...new Set(zero.map((x) => `${r1(x.w)}×${r1(x.h)}`))].join(", ")})`);
      continue;
    }
    const hid = s.filter((x) => x.hidden || x.op < 0.5);
    if (hid.length) out.push(`${at}: ${hid.length}/${s.length} csillag rejtett (${hid[0]!.hidden || `opacity ${r1(hid[0]!.op)}`})`);
    const outside = s.filter((x) => x.l < -0.5 || x.t < -0.5 || x.r > row.W + 0.5 || x.b > row.H + 0.5);
    if (outside.length) out.push(`${at}: ${outside.length}/${s.length} csillag a viewporton kívül (${r1(outside[0]!.l)},${r1(outside[0]!.t)})`);
    const covered = s.filter((x) => !x.hidden && !x.hitOk && !outside.includes(x));
    if (covered.length) out.push(`${at}: ${covered.length}/${s.length} csillagot más takarja (${covered[0]!.hitBy || "semmi nem kapható el"})`);
    const em = s.map((x) => Math.max(x.w, x.h) / row.fs);
    const bad = em.filter((e) => e < MIN_EM || e > MAX_EM);
    if (bad.length)
      out.push(`${at}: csillag ${r1(Math.max(s[0]!.w, s[0]!.h))} px = ${r1(bad[0]!)} em — a sor ${row.fs} px-es szövegéhez az ésszerű sáv ${MIN_EM}–${MAX_EM} em`);
    const h0 = Math.max(...s.map((x) => x.h));
    const offLine = s.some((x) => Math.abs(x.t - s[0]!.t) > h0 / 2) || s.some((x, i) => i > 0 && x.l <= s[i - 1]!.l);
    if (offLine) out.push(`${at}: a ${s.length} csillag nem egy sorban (tetők: ${[...new Set(s.map((x) => Math.round(x.t)))].join("/")} px)`);
  }
  return out;
}

interface Job { tpl: string; phase: Phase; html: string; planted?: (typeof PLANTED)[number] }
const jobs: Job[] = [];
for (const tpl of Object.keys(TEMPLATES)) {
  for (const phase of ["live", "mock"] as const) {
    const html = await render(tpl, phase);
    const planted = SELF_TEST ? PLANTED.find((p) => p.tpl === tpl) : undefined;
    if (planted) {
      const h2 = planted.plant(html);
      if (h2 === html) {
        console.error(`⛔ ÖNTESZT: a „${planted.why}” visszaültetése nem változtatott a lapon — a minta elavult`);
        process.exit(1);
      }
      jobs.push({ tpl, phase, html: h2, planted });
    } else jobs.push({ tpl, phase, html });
  }
}

const fails: string[] = [];
const byKey = new Map<string, string[]>();
const usedExceptions = new Set<number>();
let rowsJudged = 0;
const tplWithRow = new Set<string>();

async function worker(browser: Browser, vp: (typeof VIEWPORTS)[number], queue: Job[]): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 3 : 1,
  });
  // Offline: images/fonts/remote scripts aborted — the layout must not depend on the network.
  await ctx.route("**/*", (r) => (r.request().url().startsWith("data:") ? r.continue() : r.abort()));
  try {
    for (let j = queue.shift(); j; j = queue.shift()) {
      const page = await ctx.newPage();
      const errs: string[] = [];
      page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
      await page.setContent(j.html, { waitUntil: "load", timeout: 30000 });
      const iw = (await page.evaluate("innerWidth")) as number;
      const rows = (await page.evaluate(PROBE)) as RowM[];
      await page.close();
      const key = `${j.tpl} · ${j.phase} · ${vp.key} px`;
      const f = judge(j.tpl, vp.key, rows, usedExceptions);
      if (iw !== vp.width) f.push(`innerWidth ${iw} ≠ ${vp.width} (a telefon kiszélesítette a layout viewportot — a mérés nem érvényes)`);
      if (errs.length) f.push(`JS-hiba: ${errs[0]}`);
      rowsJudged += rows.length;
      if (rows.length) tplWithRow.add(j.tpl);
      byKey.set(key, f);
    }
  } finally {
    await ctx.close();
  }
}

const t0 = Date.now();
const browser = await chromium.launch();
try {
  const work: Promise<void>[] = [];
  for (const vp of VIEWPORTS) {
    const queue = [...jobs];
    for (let i = 0; i < Math.max(1, Math.floor(JOBS / VIEWPORTS.length)); i++) work.push(worker(browser, vp, queue));
  }
  const settled = await Promise.allSettled(work);
  for (const s of settled) if (s.status === "rejected") fails.push(`futás: egy mérő-munkás elhasalt — ${String(s.reason).slice(0, 200)}`);
} finally {
  await browser.close();
}

// Deterministic output order (parallel workers finish in any order).
for (const tpl of Object.keys(TEMPLATES))
  for (const phase of ["live", "mock"])
    for (const vp of VIEWPORTS) {
      const key = `${tpl} · ${phase} · ${vp.key} px`;
      const f = byKey.get(key);
      if (!f) fails.push(`${key}: NINCS mérési eredmény — sosem zöld`);
      else for (const x of f) fails.push(`${key} · ${x}`);
    }
for (const tpl of Object.keys(TEMPLATES)) if (!tplWithRow.has(tpl)) fails.push(`${tpl}: egyetlen csillagsor sincs a lapon — a mérés itt vak`);
if (Object.keys(TEMPLATES).length < 19) fails.push(`csak ${Object.keys(TEMPLATES).length} sablon regisztrált (várt ≥ 19)`);
HIDDEN_BY_DESIGN.forEach((e, i) => {
  if (!usedExceptions.has(i)) fails.push(`elavult kivétel: ${e.tpl} · ${e.vp} px · ${e.within} — a sor már nem rejtett (vagy nincs), vedd le a listáról`);
});

if (SELF_TEST) {
  let ok = true;
  for (const p of PLANTED) {
    const hit = fails.filter((f) => f.startsWith(`${p.tpl} ·`) && p.expect.test(f));
    console.log(hit.length ? `✅ ${p.why}: elkapta (${hit.length} lelet)` : `⛔ ${p.why}: ÁTCSÚSZOTT`);
    if (!hit.length) ok = false;
  }
  const stray = fails.filter((f) => !PLANTED.some((p) => f.startsWith(`${p.tpl} ·`)));
  if (stray.length) {
    ok = false;
    console.log(`⛔ idegen bukás a tiszta lapokon:\n  ${stray.join("\n  ")}`);
  }
  console.log(ok ? `✅ önteszt: mind a ${PLANTED.length} visszaültetett hiba piros, a többi lap zöld` : "⛔ ÖNTESZT BUKOTT");
  process.exit(ok ? 0 : 1);
}

if (fails.length) {
  console.log(`⛔ star-size-check: ${fails.length} hiba (${rowsJudged} mért csillagsor)\n  ${fails.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `✅ star-size-check: ${Object.keys(TEMPLATES).length} sablon × {élő, mock} × {390, 1280 px} — ${rowsJudged} csillagsor, mind látható, ${MIN_EM}–${MAX_EM} em, egy sorban; ${HIDDEN_BY_DESIGN.length} indokolt kivétel (${Math.round((Date.now() - t0) / 1000)} s)`,
);
