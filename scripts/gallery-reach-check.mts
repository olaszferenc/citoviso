// ŐR: a tulaj MINDEN fotója elérhető a vendég-oldal galériájából, és a galéria a lapon
// még NEM LÁTOTT képekkel indul — arch-frames (ív-sáv), wordmark-grow (4:3 sáv, asztalin 3 egyszerre —
// 2026-10-04 óta, kontraktus: design-refs/tenant-site/wordmark-grow-b; előtte kártyapakli, amelynek
// runtime-kódja 2026-10-04-én törölve — tulaj: „igen töröljük”),
// organic (blob-sáv), claymorphism (4 + helyben kinyíló). Kontraktus: assets/design-refs/tenant-site/gallery-cap/.
//
// A LELET (2026-09-28/29): 6 feltöltésből az organic és a claymorphism 4-et mutatott
// (`slice(0, 4)`), a wordmark-grow 3-at; az élő Kemences Vendégház (wordmark-grow, 12 fotó)
// vendége 3 fotót látott, a nagyítóban sem többet — az csak a galéria-slot képein lapoz.
//
// ⛔ MIÉRT BÖNGÉSZŐBEN, JS-SEL ÉS JS NÉLKÜL: az „elérhető” a runtime-tól függ (a sáv
// lapozója, a helyben kinyitás), a no-JS lap pedig a saját ígérete (§B): ott a sáv natív
// húzható sor, és a claymorphism minden kártyát mutat. Ezért minden alany két méretben
// (1280 · 390 px telefon) és két állapotban (runtime-mal · runtime nélkül) fut:
//   ① a galéria-slot MINDEN fotót <img>-ként hordoz, és a nagyító „1 / N”-nel nyílik;
//   ② a galéria első képei közül egy sem látható máshol a lapon, sorrendjük a tulajé;
//   ③ JS-sel: a sáv lapoz (számláló + tiltott nyíl a szélén),
//      a claymorphism 4 → N → 4 (felirat „Kevesebb fotó”); JS nélkül: nincs lapozó és nincs
//      gomb, a claymorphism mind az N kártyát mutatja, a sáv minden kártyája doboz > 0;
//   ④ kis adat: 3 fotónál a claymorphism gomb nélkül; 1 fotónál a sáv lapozó nélkül.
//
//   npx tsx scripts/gallery-reach-check.mts              # zöld futás
//   npx tsx scripts/gallery-reach-check.mts --self-test  # PIROS kontroll (2 visszarontás)

import { chromium, type Page } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { injectRuntime } from "../src/generator/runtime.js";

const SELF_TEST = process.argv.includes("--self-test");
const TPLS = ["arch-frames", "wordmark-grow", "organic", "claymorphism"] as const;
const STRIP: readonly string[] = ["arch-frames", "organic", "wordmark-grow"];

const url = (i: number) => `https://gallery-reach.test/photo-${i}.png`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNoaGjAihhGJQYTAAC5BH+BUz5VbQAAAABJRU5ErkJggg==",
  "base64",
);

function data(n: number): SiteData {
  return {
    name: "Nyugalom Vendégház",
    tagline: "Csend a domb alatt",
    intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
    highlights: ["Saját parkoló az udvarban", "Kutyabarát szállás"],
    photos: Array.from({ length: n }, (_, i) => ({ url: url(i), alt: `fotó ${i}`, provenance: "owner" as const })),
    rooms: [{ name: "Kertre néző szoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
    usp: ["Öt perc sétára a strandtól"],
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
  } as SiteData;
}
const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

/** Visible photo indices OUTSIDE the gallery slot, and the slot's photo indices in DOM order. */
const PROBE_JS = `(() => {
  const idxOf = (s) => { const m = /gallery-reach\\.test\\/photo-(\\d+)/.exec(s || ""); return m ? Number(m[1]) : -1; };
  const slot = document.querySelector('[data-cit-module="gallery"]');
  const elsewhere = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    if (slot && slot.contains(el)) continue;
    if (el.closest(".cit-lb")) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const i = el instanceof HTMLImageElement ? idxOf(el.currentSrc || el.src) : idxOf(cs.backgroundImage);
    if (i < 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) elsewhere.add(i);
  }
  const imgs = slot ? [...slot.querySelectorAll("img")] : [];
  const boxes = imgs.map((im) => { const r = im.getBoundingClientRect(); return r.width > 4 && r.height > 4; });
  return { elsewhere: [...elsewhere].sort((a, b) => a - b), order: imgs.map((im) => idxOf(im.getAttribute("src"))), boxes };
})()`;
type Probe = { elsewhere: number[]; order: number[]; boxes: boolean[] };

const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (!c) fails.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

async function open(page: Page, html: string) {
  await page.route("https://gallery-reach.test/**", (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
  await page.route(/^https?:\/\/(?!gallery-reach\.test)/, (r) => r.abort());
  await page.setContent(html, { waitUntil: "load" });
}
const visCount = (page: Page, sel: string) =>
  page.evaluate(`[...document.querySelectorAll('${sel}')].filter(e => { const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 4 && r.height > 4; }).length`) as Promise<number>;

function breakIt(t: string, html: string): string {
  if (!SELF_TEST) return html;
  // ⛔ PIROS KONTROLL ①: the 2026-09-28 cap, restored on organic — the slot keeps 4 photos.
  if (t === "organic") return html.replace(/(<div class="og-gtrack"[^>]*>)([\s\S]*?)(<\/div>)/, (_m, a: string, b: string, c: string) =>
    a + (b.match(/<figure[\s\S]*?<\/figure>/g) ?? []).slice(0, 4).join("") + c);
  // ⛔ PIROS KONTROLL ②: owner order instead of "not yet seen first" — the hero (#0) opens the claymorphism gallery.
  if (t === "claymorphism") return html.replace(/(<div class="cl-gal"[^>]*>)\s*<figure>(<img[^>]*>)<\/figure>/, (m, a: string) =>
    `${a}<figure><img src="${url(0)}" alt="x" loading="lazy"></figure>${m.slice(a.length)}`.replace(/(<figure data-cit-gextra><img src="https:\/\/gallery-reach\.test\/photo-0\.png"[^>]*><\/figure>)/, ""));
  return html;
}

const browser = await chromium.launch();
try {
  for (const t of TPLS) {
    console.log(`== ${t}`);
    const N = 12;
    const bare = breakIt(t, renderSite(recipe(t), data(N), { phase: "live" }));
    const withJs = await injectRuntime(bare);
    for (const [tag, ctxOpts] of [
      ["asztali", { viewport: { width: 1280, height: 900 } }],
      ["telefon", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
      ["telefon-360", { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ] as const) {
      // "no-JS" = the REAL page (runtime CSS inlined) with scripts off; "nyers" = rendered
      // without the runtime at all (previews, guards) — neither may show a dead control.
      for (const mode of ["JS", "no-JS", "nyers"] as const) {
        const js = mode === "JS";
        const label = `${t} ${tag} ${mode}`;
        const ctx = await browser.newContext({ ...(ctxOpts as object), reducedMotion: "reduce", javaScriptEnabled: mode !== "no-JS" });
        const page = await ctx.newPage();
        const errs: string[] = [];
        page.on("pageerror", (e) => errs.push(e.message));
        await open(page, mode === "nyers" ? bare : withJs);
        const p = (await page.evaluate(PROBE_JS)) as Probe;
        // ⓪ the gallery never widens a phone's layout viewport (the former card deck's peeking cards did:
        // 390 → 417 px) — `innerWidth` IS the truth on a phone, scrollWidth alone reads 0 overflow.
        const vw = (await page.evaluate("({ iw: innerWidth, sw: document.documentElement.scrollWidth })")) as { iw: number; sw: number };
        const want = (ctxOpts as { viewport: { width: number } }).viewport.width;
        ok(vw.iw === want && vw.sw <= want, `${label}: a lap nem szélesedik ki (innerWidth ${vw.iw}, scrollWidth ${vw.sw} / ${want})`);
        // …and no card BOX reaches past the screen edge either, clipped or not (guest-mobile-check ⑧
        // counts the box: the former deck's turned peek card read 397 px at 390). The strip's own track is
        // a scroller — its off-screen cards are the design, so the track's children are exempt.
        const over = (await page.evaluate(`[...document.querySelectorAll('[data-cit-module="gallery"] *')].filter((e) => {
          if (e.closest('[data-cit-gtrack]')) return false;
          const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 0.5; }).map((e) => e.className + ' ' + Math.round(e.getBoundingClientRect().right))`)) as string[];
        ok(over.length === 0, `${label}: galéria-elem nem lóg ki a képernyőből${over.length ? " — " + over.slice(0, 3).join(" | ") : ""}`);
        // ① every photo in the slot
        ok(new Set(p.order).size === N && p.order.every((i) => i >= 0), `${label}: a galéria-slot mind a ${N} fotót hordozza (${new Set(p.order).size})`);
        // ② not-yet-seen first, owner order
        const unseen = p.order.filter((i) => !p.elsewhere.includes(i));
        ok(p.order.slice(0, unseen.length).every((i) => !p.elsewhere.includes(i)) && unseen.every((i, k) => k === 0 || i > unseen[k - 1]!) && p.elsewhere.length < N,
          `${label}: a galéria a még nem látott képekkel indul (sorrend #${p.order.join(" #")} · máshol látszik #${p.elsewhere.join(" #")})`);
        if (js) {
          // ① the shared lightbox pages through ALL
          await page.evaluate(`(() => { const s=document.querySelector('[data-cit-module="gallery"]'); const im=[...s.querySelectorAll('img')].find(i=>{const r=i.getBoundingClientRect();return r.width>4&&getComputedStyle(i.closest('[aria-hidden="true"]')||i).pointerEvents!=='none'}); (im.parentElement.tagName==='FIGURE'?im.parentElement:im).click(); })()`);
          await page.waitForTimeout(250);
          const lb = (await page.evaluate(`(document.querySelector('.cit-lb[data-open] .cit-lb__count')||{}).textContent||''`)) as string;
          ok(new RegExp(`/ ${N}$`).test(lb), `${label}: a nagyító mind a ${N} fotót lapozza („${lb}”)`);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(150);
          // ③ behaviour
          if (STRIP.includes(t)) {
            const c0 = await page.textContent("[data-cit-gcount]");
            const pvDis0 = await page.$eval("[data-cit-gprev]", (e) => (e as HTMLButtonElement).disabled);
            // A strip that fits entirely has a disabled „›” — judge it, never time out on it.
            const nxDis = await page.$eval("[data-cit-gnext]", (e) => (e as HTMLButtonElement).disabled);
            if (!nxDis) await page.click("[data-cit-gnext]");
            await page.waitForTimeout(700);
            const c1 = nxDis ? c0 : await page.textContent("[data-cit-gcount]");
            ok(c0 === `1 / ${N}` && pvDis0 && c1 !== c0, `${label}: a sáv lapoz („${c0}” → „${c1}”, a „‹” az elején tiltott)`);
          }
          if (t === "wordmark-grow" && tag === "asztali") {
            // contract wordmark-grow-b: three photos at once on a desktop
            const full = (await page.evaluate(`(() => { const tr = document.querySelector('[data-cit-gtrack]'), t = tr.getBoundingClientRect();
              return [...tr.children].filter((c) => { const r = c.getBoundingClientRect(); return r.left >= t.left - 1 && r.right <= t.right + 1; }).length; })()`)) as number;
            ok(full === 3, `${label}: asztalon egyszerre 3 kép látszik (${full})`);
          }
          if (t === "claymorphism") {
            const v0 = await visCount(page, "[data-cit-module=gallery] figure");
            await page.click("[data-cit-gexpand]");
            const v1 = await visCount(page, "[data-cit-module=gallery] figure");
            const lbl = (await page.textContent("[data-cit-gexpand]"))?.trim();
            await page.click("[data-cit-gexpand]");
            const v2 = await visCount(page, "[data-cit-module=gallery] figure");
            const lbl2 = (await page.textContent("[data-cit-gexpand]"))?.trim();
            ok(v0 === 4 && v1 === N && v2 === 4 && lbl === "Kevesebb fotó" && lbl2 === `Összes fotó (${N})`,
              `${label}: helyben kinyílik és összecsukódik (${v0} → ${v1} → ${v2}; „${lbl}” / „${lbl2}”)`);
          }
          ok(errs.length === 0, `${label}: JS-hiba 0${errs.length ? " — " + errs.join(" | ") : ""}`);
        } else {
          ok((await visCount(page, "[data-cit-gpager]")) === 0 && (await visCount(page, "[data-cit-gexpand]")) === 0, `${label}: nincs halott lapozó / gomb`);
          ok(p.boxes.every(Boolean), `${label}: mind a ${N} galéria-kép doboza > 0 (natív sor / minden kártya kint)`);
        }
        await ctx.close();
      }
    }
    // ④ small data (JS on, phone)
    for (const n of [3, 1]) {
      const html = await injectRuntime(renderSite(recipe(t), data(n), { phase: "live" }));
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await open(page, html);
      const pager = await visCount(page, "[data-cit-gpager]");
      const btn = await visCount(page, "[data-cit-gexpand]");
      const p = (await page.evaluate(PROBE_JS)) as Probe;
      const want = t === "claymorphism" ? btn === 0 : n === 1 ? pager === 0 : true;
      ok(want && new Set(p.order).size === n, `${t} ${n} fotó: minden fotó a slotban (${p.order.length}), ${t === "claymorphism" ? "nincs gomb" : n === 1 ? "nincs lapozó" : "rendben"}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

if (SELF_TEST) {
  const cap = fails.some((f) => f.startsWith("organic") && f.includes("slot mind a 12"));
  const order = fails.some((f) => f.startsWith("claymorphism") && f.includes("még nem látott"));
  console.log(cap ? "✅ PIROS KONTROLL ①: a visszaállított 4-es vágást elkapta" : "⛔ PIROS KONTROLL ①: a vágás ÁTCSÚSZOTT");
  console.log(order ? "✅ PIROS KONTROLL ②: a hőssel kezdődő galériát elkapta" : "⛔ PIROS KONTROLL ②: a hőssel kezdődő galéria ÁTCSÚSZOTT");
  process.exit(cap && order ? 0 : 1);
}
if (fails.length) {
  console.log(`\n⛔ ${fails.length} hiba:\n  ` + fails.join("\n  "));
  process.exit(1);
}
console.log(`\n✅ ${TPLS.length} sablon: minden fotó elérhető, a galéria a még nem látott képekkel indul, JS-sel és JS nélkül`);
