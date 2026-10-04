// ŐR: a foglalás-sáv („Foglalás” + „Szabad időpontok megtekintése”) KÁRTYA a Képek után —
// kontraktus: assets/design-refs/tenant-site/booking-card/ (tulaj „A”, 2026-10-04).
//
// A LELET (2026-10-04, renderrel mérve mind a 21 sablonon): az arch-frames és a tilted-gallery
// a közös bookingSlot() sávját csupaszon tette le — a közös sáv-stílus (ENQUIRY_BAR_CSS) csak a
// régi sablonokba jut be —, ezért a felirat és a gomb formázatlanul x=0-n tapadt, közvetlenül a
// teljes „Foglalás” naptár fölött (két „Foglalás” egymás alatt, a gomb a közvetlenül alatta
// lévő szakaszra ugrott). A kártya EGY közös szabály: templateKit bookingCardCss().
//
// Sablononként (arch-frames · tilted-gallery · wordmark-grow), 1280 és 390 px telefonon:
//   ① foglalási felülettel a sáv KÖZVETLENÜL a Képek (gallery-modul) után áll, és nem a naptár előtt;
//   ② kártya: felület-háttér, 20 px lekerekítés, szélessége min(1140px, 88vw), középen;
//   ③ asztalon a felirat és a gomb EGY sorban (gomb jobbra); telefonon egymás alatt, a gomb
//      a kártya tartalom-szélességében;
//   ④ a gomb a #cit-booking naptárhoz visz; a lap nem szélesedik ki;
//   ⑤ foglalási felület nélkül (érdeklődés-sáv) a sáv a régi helyén marad, nem a Képek után.
//
//   npx tsx scripts/booking-card-check.mts              # zöld futás
//   npx tsx scripts/booking-card-check.mts --self-test  # PIROS kontroll (2 visszarontás)

import { chromium, type Page } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { injectRuntime } from "../src/generator/runtime.js";

const SELF_TEST = process.argv.includes("--self-test");
const TPLS = ["arch-frames", "tilted-gallery", "wordmark-grow"] as const;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNoaGjAihhGJQYTAAC5BH+BUz5VbQAAAABJRU5ErkJggg==",
  "base64",
);
const data: SiteData = {
  name: "Nyugalom Vendégház",
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
  highlights: ["Saját parkoló az udvarban", "Kutyabarát szállás"],
  photos: Array.from({ length: 8 }, (_, i) => ({ url: `https://booking-card.test/p-${i}.png`, alt: `fotó ${i}`, provenance: "owner" as const })),
  rooms: [{ name: "Kertre néző szoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
  usp: ["Öt perc sétára a strandtól"],
  // a rating renders the review block that sits between the photos and the enquiry bar (⑤)
  rating: { value: 4.8, count: 26 },
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
} as SiteData;
const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

function breakIt(t: string, html: string): string {
  if (!SELF_TEST) return html;
  // ⛔ PIROS KONTROLL ①: the card rule dropped on arch-frames (the 2026-10-04 bug: bare band).
  if (t === "arch-frames") return html.replace(/\.cit-tpl-arch-frames \[data-cit-variant="cta"\] \.cit-enquiry-bar-inner\{/g, ".x-off{");
  // ⛔ PIROS KONTROLL ②: the band back at the end, right above the calendar, on tilted-gallery.
  if (t === "tilted-gallery") {
    const m = /<section id="cit-enquiry"[\s\S]*?<\/section>/.exec(html);
    if (!m) return html;
    const rest = html.replace(m[0], "");
    return rest.replace(/(<section[^>]*id="cit-booking")/, `${m[0]}$1`);
  }
  return html;
}

const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (!c) fails.push(m); console.log(`${c ? "  ✓" : "  ✗"} ${m}`); };

async function open(page: Page, html: string) {
  await page.route("https://booking-card.test/**", (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
  await page.route(/^https?:\/\/(?!booking-card\.test)/, (r) => r.abort());
  await page.setContent(html, { waitUntil: "load" });
}

const PROBE = `(() => {
  const s = document.getElementById("cit-enquiry");
  const i = s.querySelector(".cit-enquiry-bar-inner"), t = s.querySelector(".cit-enquiry-bar-title"), b = s.querySelector(".cit-btn");
  const R = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
  const cs = getComputedStyle(i), ics = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const prev = s.previousElementSibling, next = s.nextElementSibling;
  return { variant: s.dataset.citVariant, prev: prev && (prev.getAttribute("data-cit-module") || prev.id), next: next && next.id,
    inner: R(i), title: R(t), btn: R(b), bg: cs.backgroundColor, radius: cs.borderRadius, pad: ics,
    iw: innerWidth, sw: document.documentElement.scrollWidth };
})()`;
type Box = { x: number; y: number; w: number; h: number; r: number; b: number };
type P = { variant: string; prev: string | null; next: string | null; inner: Box; title: Box; btn: Box; bg: string; radius: string; pad: number; iw: number; sw: number };

const browser = await chromium.launch();
try {
  for (const t of TPLS) {
    console.log(`== ${t}`);
    const html = await injectRuntime(breakIt(t, renderSite(recipe(t), data, { phase: "mock" })), "hu", "mock");
    for (const [tag, opts] of [
      ["asztali", { viewport: { width: 1280, height: 900 } }],
      ["telefon", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
    ] as const) {
      const label = `${t} ${tag}`;
      const ctx = await browser.newContext({ ...(opts as object), reducedMotion: "reduce" });
      const page = await ctx.newPage();
      const errs: string[] = [];
      page.on("pageerror", (e) => errs.push(e.message));
      await open(page, html);
      const p = (await page.evaluate(PROBE)) as P;
      const W = (opts as { viewport: { width: number } }).viewport.width;
      ok(p.variant === "cta" && p.prev === "gallery" && p.next !== "cit-booking", `${label}: a sáv a Képek után áll, nem a naptár előtt (előtte: ${p.prev}, utána: ${p.next})`);
      const want = Math.min(1140, W * 0.88);
      ok(p.bg !== "rgba(0, 0, 0, 0)" && p.radius === "20px" && Math.abs(p.inner.w - want) <= 1 && Math.abs(p.inner.x - (W - p.inner.r)) <= 1,
        `${label}: kártya — háttér ${p.bg}, lekerekítés ${p.radius}, szélesség ${Math.round(p.inner.w)}/${Math.round(want)}, bal ${Math.round(p.inner.x)} · jobb ${Math.round(W - p.inner.r)}`);
      if (tag === "asztali") {
        ok(Math.abs((p.title.y + p.title.h / 2) - (p.btn.y + p.btn.h / 2)) <= 4 && p.btn.x > p.title.r,
          `${label}: a felirat és a gomb egy sorban, a gomb jobbra`);
      } else {
        ok(p.btn.y >= p.title.b - 1 && Math.abs(p.btn.w - (p.inner.w - p.pad - 2)) <= 2,
          `${label}: a gomb a felirat alatt, teljes szélességben (${Math.round(p.btn.w)} / ${Math.round(p.inner.w - p.pad - 2)})`);
      }
      ok(p.iw === W && p.sw <= W, `${label}: a lap nem szélesedik ki (${p.iw}/${p.sw})`);
      await page.evaluate(`document.getElementById("cit-enquiry").scrollIntoView({ block: "center" })`);
      await page.click("#cit-enquiry .cit-btn");
      await page.waitForTimeout(700);
      const top = (await page.evaluate(`document.getElementById("cit-booking").getBoundingClientRect().top`)) as number;
      ok(top > -5 && top < 200, `${label}: a gomb a naptárhoz visz (#cit-booking teteje ${Math.round(top)} px)`);
      ok(errs.length === 0, `${label}: nincs JS-hiba${errs.length ? " — " + errs[0] : ""}`);
      await ctx.close();
    }
    // ⑤ enquiry state (no booking surface): the bar stays where it was
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await open(page, renderSite(recipe(t), data, { phase: "live" }));
    const e = (await page.evaluate(`(() => { const s = document.getElementById("cit-enquiry"), p = s.previousElementSibling;
      return { variant: s.dataset.citVariant, prev: p && (p.getAttribute("data-cit-module") || p.id || p.className) }; })()`)) as { variant: string; prev: string };
    ok(e.variant === "bar" && e.prev !== "gallery", `${t}: foglalás nélkül az érdeklődés-sáv a régi helyén (előtte: ${e.prev})`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (SELF_TEST) {
  const reds = [
    fails.some((f) => f.startsWith("arch-frames") && f.includes("kártya")),
    fails.some((f) => f.startsWith("tilted-gallery") && f.includes("a Képek után")),
  ];
  console.log(reds.every(Boolean) ? "\n✅ ÖNTESZT: mindkét visszarontás PIROS" : `\n❌ ÖNTESZT: nem minden visszarontást fogott meg (${reds})`);
  process.exit(reds.every(Boolean) ? 0 : 1);
}
console.log(fails.length ? `\n❌ ${fails.length} BUKÁS` : "\n✅ booking-card-check ZÖLD");
process.exit(fails.length ? 1 : 0);
