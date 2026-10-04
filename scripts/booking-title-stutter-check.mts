// ŐR: renderelt lapon két egymást követő „Foglalás” cím nem állhat — mind a 21 sablon.
//
// A LELET (2026-10-04, a booking-card SUB mellék-lelete, tulaj: „javítsuk”): a walk-through-ban a
// foglalás-sáv („Foglalás” + „Szabad időpontok megtekintése”) közvetlenül a lapzáró „Foglalás”
// naptár-szakasz <h2>-je fölött állt, az art-deco „porta” paneljén a panel saját „Foglalás” címe
// alatt a sáv újra „Foglalás”-t írt. Ugyanaz a szó kétszer egymás alatt = dadogás.
//
// Mérés: minden sablon × {mock, élő foglalás-modullal, élő foglalás nélkül} × {1280, 390 px}.
// A látható, nem-link, nem-gomb, nem-menü elemek közül azokat gyűjti, amelyek szövege pontosan
// „Foglalás”; két ilyen „egymást követő”, ha a dokumentum-sorrendben köztük álló látható szöveg
// (linkek/gombok nélkül) legfeljebb egy rövid alcím (≤ 80 karakter), és a kettő 360 px-en belül áll
// — azaz nincs köztük valódi tartalom (a Képek utáni kártya és a lapzáró naptár között pl. az
// értékelés-blokk és több száz px áll: az nem dadogás, hanem a booking-card kontraktus ④).
//
// Javítva (a gate-opening meglévő szabálya szerint): walk-through — a naptár-szakaszt közvetlenül
// megelőző sáv belseje rejtve (a #cit-enquiry horgony marad); art-deco „porta” és brutalism
// „konzol” — a konténer saját „Foglalás” címe marad, a foglalás-sáv címe rejtve (cta-változat).
//
//   npx tsx scripts/booking-title-stutter-check.mts              # zöld futás
//   npx tsx scripts/booking-title-stutter-check.mts --self-test  # PIROS kontroll (visszarontás)

import { chromium, type Browser, type Page } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";

const SELF_TEST = process.argv.includes("--self-test");
const VERBOSE = process.argv.includes("--verbose");
// the self-test only needs the template it breaks
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7) ?? (SELF_TEST ? "walk-through" : undefined);

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNoaGjAihhGJQYTAAC5BH+BUz5VbQAAAABJRU5ErkJggg==",
  "base64",
);
const base: SiteData = {
  name: "Nyugalom Vendégház",
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
  highlights: ["Saját parkoló az udvarban", "Kutyabarát szállás"],
  photos: Array.from({ length: 8 }, (_, i) => ({ url: `https://title-stutter.test/p-${i}.png`, alt: `fotó ${i}`, provenance: "owner" as const })),
  rooms: [{ name: "Kertre néző szoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
  usp: ["Öt perc sétára a strandtól"],
  rating: { value: 4.8, count: 26 },
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
} as SiteData;
const withBooking: SiteData = {
  ...base,
  booking: {
    units: [{ id: "u1", name: "Kertre néző szoba", capacity: 2 }],
    minNights: 1,
    maxNights: 30,
    horizonMonths: 12,
    leadTimeDays: 0,
  } as SiteData["booking"],
} as SiteData;

const recipe = (t: string): Recipe =>
  ({ skin: TEMPLATES[t]!.skins[0]!, archetype: "stacked", template: t, sections: [] }) as unknown as Recipe;

const STATES = [
  { tag: "mock", data: base, phase: "mock" as const },
  { tag: "élő+foglalás", data: withBooking, phase: "live" as const },
  { tag: "élő foglalás nélkül", data: base, phase: "live" as const },
];

// ⛔ PIROS KONTROLL: the 2026-10-04 stutter put back — a „Foglalás” heading right above the band.
function breakIt(t: string, html: string): string {
  if (!SELF_TEST || t !== "walk-through") return html;
  return html.replace(/(<section id="cit-enquiry")/, `<h2 class="x-stutter">Foglalás</h2>$1`);
}

const PROBE = (VERBOSE: boolean) => `(() => {
  const VERBOSE = ${VERBOSE};
  const WORD = "Foglalás";
  const visible = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0.05; };
  const skip = (e) => e.closest("a,button,nav,summary,label,option,select,[aria-hidden='true'],[hidden]");
  // leaf text blocks in document order (an element whose own text nodes carry the text)
  const blocks = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; const seen = new Set();
  while ((n = walker.nextNode())) {
    const txt = n.nodeValue.replace(/\\s+/g, " ").trim();
    if (!txt) continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
    seen.add(el);
    if (!visible(el)) continue;
    const full = el.textContent.replace(/\\s+/g, " ").trim();
    const r = el.getBoundingClientRect();
    blocks.push({ el, text: full, link: !!el.closest("a,button"), title: full === WORD && !skip(el), y: Math.round(r.top + scrollY), tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute("class") || "").split(/\\s+/)[0] });
  }
  const out = [];
  let last = -1;
  blocks.forEach((b, i) => {
    if (!b.title) return;
    if (last >= 0) {
      const between = blocks.slice(last + 1, i).filter((x) => !x.el.contains(blocks[last].el) && !blocks[last].el.contains(x.el));
      const chars = between.filter((x) => !x.link).reduce((s, x) => s + x.text.length, 0);
      if ((chars <= 80 && b.y - blocks[last].y < 360) || VERBOSE) {
        const a = blocks[last];
        out.push({ a: a.tag + (a.cls ? "." + a.cls : ""), ay: a.y, b: b.tag + (b.cls ? "." + b.cls : ""), by: b.y,
          between: between.map((x) => x.text).join(" | ").slice(0, 160), chars });
      }
    }
    last = i;
  });
  return { titles: blocks.filter((b) => b.title).map((b) => b.tag + (b.cls ? "." + b.cls : "") + "@" + b.y), pairs: out };
})()`;
type R = { titles: string[]; pairs: { a: string; ay: number; b: string; by: number; between: string }[] };

const VIEWPORTS = [
  ["1280", { viewport: { width: 1280, height: 900 } }],
  ["390", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
] as const;

async function newPage(browser: Browser, opts: object): Promise<Page> {
  const ctx = await browser.newContext({ ...opts, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.route("https://title-stutter.test/**", (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
  await page.route(/^https?:\/\/(?!title-stutter\.test)/, (r) => r.abort());
  return page;
}

const fails: string[] = [];
const browser = await chromium.launch();
try {
  const pages = new Map<string, Page>();
  for (const [vtag, opts] of VIEWPORTS) pages.set(vtag, await newPage(browser, opts));
  const tpls = Object.keys(TEMPLATES).filter((t) => !ONLY || t === ONLY);
  for (const t of tpls) {
    for (const s of STATES) {
      const html = await injectRuntime(breakIt(t, renderSite(recipe(t), s.data, { phase: s.phase })), "hu", s.phase);
      for (const [vtag] of VIEWPORTS) {
        const page = pages.get(vtag)!;
        await page.setContent(html, { waitUntil: "load" });
        const r = (await page.evaluate(PROBE(VERBOSE))) as R;
        const label = `${t} · ${s.tag} · ${vtag}`;
        if (r.pairs.length) {
          for (const p of r.pairs) {
            const m = `${label}: két egymást követő „Foglalás” — ${p.a}@${p.ay} → ${p.b}@${p.by} (köztük: ${p.between || "semmi"})`;
            fails.push(m);
            console.log(`  ✗ ${m}`);
          }
        } else {
          console.log(`  ✓ ${label}: ${r.titles.length} „Foglalás” cím, egyik sem dadog`);
        }
      }
    }
  }
} finally {
  await browser.close();
}

if (SELF_TEST) {
  const red = fails.some((f) => f.startsWith("walk-through") && f.includes("h2.x-stutter"));
  console.log(red ? "\n✅ ÖNTESZT: a visszarontás PIROS" : "\n❌ ÖNTESZT: a visszarontást nem fogta meg");
  process.exit(red ? 0 : 1);
}
console.log(fails.length ? `\n❌ ${fails.length} BUKÁS` : "\n✅ booking-title-stutter-check ZÖLD");
process.exit(fails.length ? 1 : 0);
