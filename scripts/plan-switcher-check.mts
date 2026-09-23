// Regression gate for the MULTI-PLAN tracked page (approved contract, 2026-09-23:
// assets/design-refs/prospect-page/plan-tabs/README.md — §N below refers to it).
//
// It measures the RENDERED page: renderSite → injectRuntime → the multi-plan layers →
// the legal footer, exactly the order the console serves (server.ts multiPlanLayers),
// on templates chosen for a named failure mode, at both widths.
//
// What it asserts (each line is a contract clause, not a style wish):
//   · the thin bar is the page's first element, at y=0, full width, and nothing paints
//     over it (§B, framing §2/§8);
//   · it stays THIN — a height budget per width (§B.3);
//   · "Miért kaptam?" is IN the text line (not parsed out of a <p>), opens WITHOUT JS,
//     and carries both legal links (§B.4);
//   · the switcher: one chip per plan, each a real link to /v/<n>, exactly one marked
//     current, the count word from the plans (§C.7–§C.10);
//   · the end-of-page block offers ONLY the other plans, sits ABOVE the legal footer,
//     the footer stays last, and the article follows the numeral (§E);
//   · the nudge is FINITE — no infinite animation anywhere in our layers (§D.14).
//
// Run:   npx tsx scripts/plan-switcher-check.mts
//        npx tsx scripts/plan-switcher-check.mts --selftest   (every red branch MUST fail)
process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { chromium, type Browser, type Page } from "playwright-core";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { disableIntroAnimation, injectTrackingNotice } from "../src/console/prospectNotice.js";
import { injectPlanEndBlock, injectPlanSwitcherBar, type SwitcherInput } from "../src/console/planSwitcher.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

const SELFTEST = process.argv.includes("--selftest");
const TOKEN = "hWAeKUweNOvCiAAMz6hlqUAA";

let failures = 0;
let quiet = false;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    if (!quiet) console.log(`  ✓ ${name}`);
  } else {
    failures++;
    if (!quiet) console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";

const DATA: SiteData = {
  name: "ELEK-PRÓBA Vendégház",
  tagline: "Szigliget, Balaton",
  intro: "Szigligeten, a várdomb és a strand között, tágas kerttel és nyolc fő számára kényelmes házzal.",
  highlights: ["Teraszos kert, grillsarok", "Strand néhány perc sétára"],
  geo: { lat: 46.8, lon: 17.43 },
  photos: [1, 2, 3].map((i) => ({ url: PIX, alt: `kép ${i}`, provenance: "portal" as const })),
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Kossuth utca 36, Szigliget, 8264" },
};

/** A chosen set, each for a NAMED reason (the framing guard's own set). */
const TEMPLATES_UNDER_TEST: ReadonlyArray<[string, string]> = [
  ["fullbleed", "a navja position:absolute; top:0 — ez fekhetne rá a sávra"],
  ["aurora", "body>*{position:relative} — ez ejtett már a lap aljára injektált réteget"],
  ["editorial", "világos, kéthasábos — más elrendezés-család"],
];

/** §B.3 — measured 116 px (390) and 44 px (1280) on the approved plan; a few px of font slack. */
const HEIGHT_BUDGET: Record<number, number> = { 390: 124, 1280: 52 };

const recipe = (templateId: string): Recipe =>
  ({ skin: TEMPLATES[templateId]!.skins[0]!, archetype: "stacked", template: templateId, sections: [] }) as unknown as Recipe;

function input(count: number, current: number): SwitcherInput {
  return {
    token: TOKEN,
    leadName: DATA.name,
    lang: "hu",
    plans: Array.from({ length: count }, (_, i) => ({ n: i + 1, hasThumb: i !== 1 })),
    current,
    viewId: "11111111-2222-3333-4444-555555555555",
  };
}

/** The page as the console serves it to a TRACKED visitor of a multi-plan link. */
async function multiPage(tpl: string, count: number, current: number): Promise<string> {
  const base = disableIntroAnimation(await injectRuntime(renderSite(recipe(tpl), DATA)));
  const i = input(count, current);
  return injectTrackingNotice(injectPlanEndBlock(injectPlanSwitcherBar(base, i), i), TOKEN);
}

/** The legal footer is the last appended block — identified by its opt-out link. */
const FOOTER_JS = `(() => { const a = [...document.querySelectorAll('a[href$="/unsubscribe"]')]
  .filter(x => !x.closest('#cit-plans')); return a.length ? a[a.length-1].closest('div') : null; })()`;

async function measure(page: Page, label: string, count: number, current: number, width: number): Promise<void> {
  const m = await page.evaluate(
    ({ FOOTER }) => {
      const bar = document.getElementById("cit-plans");
      const first = [...document.body.children].find((e) => !["STYLE", "SCRIPT", "NOSCRIPT"].includes(e.tagName));
      const r = bar?.getBoundingClientRect();
      const cx = r ? r.left + r.width / 2 : 0;
      const cy = r ? r.top + Math.min(r.height / 2, 12) : 0;
      const hit = r ? document.elementFromPoint(cx, cy) : null;
      const details = document.querySelector("#cit-plans .citp-txt details");
      const chips = [...document.querySelectorAll("#cit-plans nav a")].map((a) => ({
        href: a.getAttribute("href") ?? "",
        cur: a.getAttribute("aria-current"),
        label: a.getAttribute("aria-label"),
      }));
      const end = document.getElementById("cit-plans-end");
      const endOffers = [...document.querySelectorAll("#cit-plans-end [data-cit-plan-end]")].map((a) =>
        Number(a.getAttribute("data-cit-plan-end")),
      );
      // eslint-disable-next-line no-eval
      const foot = (0, eval)(FOOTER) as HTMLElement | null;
      const endBeforeFoot = !!(end && foot && end.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING);
      const endBottom = end?.getBoundingClientRect().bottom ?? 0;
      const footTop = foot?.getBoundingClientRect().top ?? 0;
      return {
        firstIsBar: first === bar,
        top: r ? Math.round(r.top + window.scrollY) : -1,
        width: r ? Math.round(r.width) : 0,
        height: r ? Math.round(r.height) : 0,
        covered: !!r && !(hit && bar!.contains(hit)),
        detailsInLine: !!details,
        chips,
        lbl: document.querySelector("#cit-plans .citp-lbl")?.textContent ?? "",
        endOffers,
        endHead: end?.querySelector("h2")?.textContent ?? "",
        endSub: end?.querySelector("p")?.textContent ?? "",
        endBeforeFoot,
        endAboveFoot: endBottom <= footTop + 1,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    },
    { FOOTER: FOOTER_JS },
  );
  check(`${label}: a vékony sáv a lap ELSŐ eleme`, m.firstIsBar);
  check(`${label}: a sáv teteje y=0`, m.top === 0, m.top);
  check(`${label}: a sáv teljes szélességű`, Math.abs(m.width - width) <= 1, m.width);
  check(`${label}: semmi nem fest rá a sávra`, !m.covered);
  check(`${label}: a sáv VÉKONY (≤ ${HEIGHT_BUDGET[width]} px)`, m.height > 0 && m.height <= HEIGHT_BUDGET[width]!, m.height);
  check(`${label}: a „Miért kaptam?” a szövegsorban van (nem esett ki egy <p>-ből)`, m.detailsInLine);
  check(`${label}: tervenként egy gomb`, m.chips.length === count, m.chips.length);
  check(
    `${label}: minden gomb valódi link a saját tervére`,
    m.chips.every((c, i) => (i === 0 ? !/\/v\//.test(c.href) : new RegExp(`/v/${i + 1}(\\?|$)`).test(c.href))),
    m.chips.map((c) => c.href),
  );
  check(
    `${label}: pontosan a nézett terv jelölt`,
    m.chips.filter((c) => c.cur === "page").length === 1 && m.chips[current - 1]?.cur === "page",
    m.chips.map((c) => c.cur),
  );
  check(`${label}: a gombok felolvasható neve „N. terv”`, m.chips.every((c, i) => c.label === `${i + 1}. terv`));
  check(
    `${label}: a felirat a tervek számából jön`,
    m.lbl.startsWith(count >= 3 ? "Három tervet" : "Két tervet"),
    m.lbl,
  );
  const others = Array.from({ length: count }, (_, i) => i + 1).filter((n) => n !== current);
  check(`${label}: a lap alja CSAK a többi tervet kínálja`, m.endOffers.join() === others.join(), m.endOffers);
  check(
    `${label}: a lap alji címsor a darabszámhoz illik`,
    m.endHead.includes(count >= 3 ? "a másik kettőt is" : "a másikat is"),
    m.endHead,
  );
  const art = current === 1 || current === 5 ? "az" : "a";
  check(`${label}: helyes névelő („${art} ${current}.”)`, m.endSub.startsWith(`Ez volt ${art} ${current}. terv`), m.endSub);
  check(`${label}: a lap alji blokk a jogi lábléc ELŐTT áll`, m.endBeforeFoot);
  check(`${label}: …és fölötte is látszik`, m.endAboveFoot);
  check(`${label}: nincs vízszintes túlcsordulás`, m.overflow <= 0, m.overflow);

  // §D.14 — force the nudge and read the running animations: finite, and only on OUR layer
  const anim = await page.evaluate(() => {
    const nav = document.querySelector("#cit-plans nav")!;
    nav.classList.add("citp-nudge");
    const ours = [...document.querySelectorAll("#cit-plans *, #cit-plans-end *")].flatMap((e) =>
      (e as HTMLElement).getAnimations(),
    );
    return {
      count: ours.length,
      infinite: ours.filter((a) => (a.effect?.getTiming().iterations ?? 1) === Infinity).length,
      iterations: ours.map((a) => a.effect?.getTiming().iterations),
    };
  });
  check(`${label}: a felvillanás elindul`, anim.count > 0, anim);
  check(`${label}: a felvillanás VÉGES (nincs végtelen animáció)`, anim.infinite === 0, anim.iterations);
}

async function run(browser: Browser, mutate?: (html: string) => string): Promise<void> {
  for (const [tpl, why] of TEMPLATES_UNDER_TEST) {
    if (!quiet) console.log(`\n${tpl} — ${why}`);
    for (const [count, current] of [[3, 2], [2, 1]] as const) {
      for (const width of [390, 1280]) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await ctx.newPage();
        let html = await multiPage(tpl, count, current);
        if (mutate) html = mutate(html);
        await page.setContent(html, { waitUntil: "load" });
        await page.waitForTimeout(150);
        await measure(page, `${tpl} ${count} terv / ${current}. @${width}`, count, current, width);
        await ctx.close();
      }
    }
    // §B.4 — JS OFF: the expander still opens, and carries both legal links
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    let html = await multiPage(tpl, 3, 1);
    if (mutate) html = mutate(html);
    await page.setContent(html, { waitUntil: "load" });
    const s = page.locator("#cit-plans summary");
    const had = (await s.count()) > 0;
    if (had) await s.click();
    const open = had
      ? await page.evaluate(() => {
          const d = document.querySelector("#cit-plans details") as HTMLDetailsElement | null;
          const links = [...(d?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href") ?? "");
          return { open: !!d?.open, privacy: links.some((h) => h === "/privacy"), unsub: links.some((h) => h.endsWith("/unsubscribe")) };
        })
      : { open: false, privacy: false, unsub: false };
    check(`${tpl} JS=KI: a „Miért kaptam?” nyílik`, open.open);
    check(`${tpl} JS=KI: a kinyitott rész viszi mindkét jogi linket`, open.privacy && open.unsub, open);
    await ctx.close();
  }
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  if (!SELFTEST) {
    await run(browser);
  } else {
    // Every red branch must FAIL, or the guard is not a guard.
    const RED: ReadonlyArray<[string, (h: string) => string]> = [
      ["a <details> <p>-be kerül", (h) => h.replace('<div class="citp-txt">', '<p class="citp-txt">').replace("</details></div>", "</details></p>")],
      ["nincs jelölt terv", (h) => h.replace(/ aria-current="page"/g, "")],
      ["a lap alji blokk a lábléc UTÁN", (h) => {
        const m = /<section id="cit-plans-end"[\s\S]*?<\/section>/.exec(h);
        return m ? h.replace(m[0], "").replace(/<\/body>/i, `${m[0]}</body>`) : h;
      }],
      ["végtelen felvillanás", (h) => h.replace("animation:citpNudge .9s ease 2", "animation:citpNudge .9s ease infinite")],
      ["a sáv nem az első elem", (h) => h.replace(/(<body[^>]*>)/i, '$1<div style="height:40px">x</div>')],
      // appended as its own rule with !important: a declaration slipped INTO the base rule
      // is overridden by that rule's own later `padding` (first try — measured, not caught)
      ["vastag sáv", (h) => h.replace("<style data-cit-plans-css>", "<style data-cit-plans-css>#cit-plans{padding-top:140px!important}")],
    ];
    quiet = true;
    let ok = true;
    for (const [name, mutate] of RED) {
      const before = failures;
      await run(browser, mutate);
      const caught = failures > before;
      console.log(`  ${caught ? "✓" : "✗"} piros ág: ${name} — ${caught ? `elkapva (${failures - before} bukás)` : "NEM kapta el"}`);
      if (!caught) ok = false;
    }
    failures = ok ? 0 : 1;
  }
} finally {
  await browser.close();
}

if (failures) {
  console.error(`\n❌ plan-switcher-check: ${failures} bukás.`);
  process.exit(1);
}
console.log(
  SELFTEST
    ? "\n✅ plan-switcher-check --selftest: minden piros ág elbukik."
    : "\n✅ plan-switcher-check: a több-tervű lap vékony, a helyén van, a váltó valódi link, a lap alja a lábléc fölött, a felvillanás véges.",
);
