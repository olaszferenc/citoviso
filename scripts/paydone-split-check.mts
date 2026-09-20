// A fizetés-visszaigazoló lap őre — a JÓVÁHAGYOTT TERV kontraktusa
// (assets/design-refs/console/paydone-split/README.md) állításonként kimérve.
//
//   npx tsx scripts/paydone-split-check.mts
//
// ⛔ MIÉRT RENDEREL, és miért nem elég a forrás-grep: a terv megvalósításakor HÁROM
// hibát mértem, és KETTŐT kizárólag a kirajzolt lap mutatott meg —
//   • a címsor SÖTÉT maradt a sötét lapon (a citui.css saját h1-szabálya verte a
//     body színét: a markupban minden „ott volt”, a vevő viszont nem látta),
//   • a fixen alul ülő süti-sáv RÁTAKART az egyetlen CTA gombra.
// Egy szöveg-illesztő őr mindkettőt zölden átengedte volna. Ezért a statikus
// állítások mellett a lap BETÖLTVE is mérésre kerül, mindkét méretben, és a
// két mért hibára SAJÁT önteszt (negatív kontroll) is fut: ha a védett szabályt
// visszarontom, az őrnek pirosra kell váltania.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright-core";

import { payResultPage } from "../src/console/views.js";
import { SITE_SHOT_ASPECT } from "../src/payment/shotSize.js";

const ROOT = path.resolve(import.meta.dirname, "..");

let failures = 0;
const fail = (what: string): void => {
  failures++;
  console.error(`  ❌ ${what}`);
};
const ok = (what: string): void => console.log(`  ✅ ${what}`);
const check = (cond: boolean, what: string): void => (cond ? ok(what) : fail(what));

/** A live, activated purchase — the page's main branch. */
const LIVE = {
  siteUrl: "https://aranykagylo-36.citoviso.com",
  businessName: "Aranykagyló 36",
  productName: "Aranykagyló 36",
  username: "aranykagylo-36",
  contactEmail: "tulaj@example.com",
  loginUrl: "https://aranykagylo-36.citoviso.com/login",
  amount: 5430,
  currency: "HUF",
  ref: "CIT-28831F1C",
  supportEmail: "info@citoviso.com",
  // ⚠️ A megújulás összege SZÁNDÉKOSAN más, mint a most terhelt: azonos értékkel
  // az „egyszer szerepel” állítás mérhetetlen lenne (a fixture nem billenthet).
  renewal: { date: "2026-10-20", amount: 7240, period: "monthly" as const },
};

/** Paid, but the site is not finished — the frame must hold, the claims must not. */
const PENDING_SITE = { ...LIVE, siteUrl: null, username: null, loginUrl: null };

/** Make a file-loaded page see the design tokens (the shot would be colourless
 *  otherwise, and a colour assertion on an unstyled page proves nothing). */
function absolutizeAssets(html: string): string {
  return html.replace(/(href|src)="\/assets\//g, `$1="${pathToFileURL(path.join(ROOT, "public", "assets")).href}/`);
}

/** sRGB relative luminance (WCAG) of a computed `rgb(...)` string. */
function luminance(rgb: string): number {
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return -1;
  const [r, g, b] = m.slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

async function main(): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "cit-paydone-"));
  try {
    const liveHtml = payResultPage(true, true, LIVE);
    const pendingHtml = payResultPage(true, false, PENDING_SITE);

    console.log("\n① A VEVŐ LAPJA, NEM A KONZOL SHELLJE (kontraktus ①)");
    check(!/<header class="con-top"/.test(liveHtml), "nincs konzol-fejléc a visszaigazolón");
    check(/<body class="paypage"/.test(liveHtml), "saját, teljes felületű lap-váz");
    check(/citui\.css/.test(liveHtml), "a dizájn-mag (tokenek) betöltve");

    console.log("\n③④⑤ A MEGVETT DOLOG");
    check(/class="pd-stamp"/.test(liveHtml), "siker-pecsét a lapon");
    check(/prefers-reduced-motion/.test(liveHtml), "mozgás-érzékenyeknek animáció nélkül is ott a pecsét");
    check(/id="paySiteUrl"/.test(liveHtml) && /data-copy-target="paySiteUrl"/.test(liveHtml),
      "a cím MÁSOLHATÓ objektum, nem csupasz link");
    check(new RegExp(`href="${LIVE.siteUrl}"`).test(liveHtml), "a „Megnyitom” a VALÓDI címre visz");

    console.log("\n⑦ A KÖTELEZETTSÉG-SOROK HIÁNYTALANUL");
    for (const row of [
      "Következő terhelés", "Megújulás", "ÁFA", "Számla", "Lemondás",
      "Felhasználónév", "Belépés", "Mit szerkeszthet",
    ]) {
      check(liveHtml.includes(row), `sor: ${row}`);
    }
    check(/id="payRef"/.test(liveHtml) && /data-copy-target="payRef"/.test(liveHtml),
      "a hivatkozási azonosító másolható");
    check(liveHtml.includes("2026"), "a következő terhelés DÁTUMMAL szerepel");

    console.log("\n⑥ EGY ÖSSZEG, EGYSZER (a fejléc alatti duplikáció mért hiba volt)");
    // ⛔ A forrás-illesztés itt HAMIS PIROSAT adott (mért: 5): a terhelt összeg
    // jogosan szerepel a Barion-pixel adataiban is, ami nem látható szöveg. Amit
    // tiltani akarunk, az a VEVŐ szeme előtt kétszer álló ugyanaz a szám — tehát a
    // kirajzolt lap látható szövegén mérünk (lentebb, a renderelt szakaszban).
    check(!liveHtml.includes("Most fizetett"), "nincs „Most fizetett” sor a fejléc-összeg alatt");

    console.log("\n⑧ EGY DOMINÁNS CTA");
    const ctas = (liveHtml.match(/class="pd-cta"/g) ?? []).length;
    check(ctas === 1, `pontosan egy elsődleges gomb (mért: ${ctas})`);

    console.log("\nA NEM-KÖTÖTT ÁG: fizetve, de az oldal még készül");
    check(!/data-copy-target="paySiteUrl"/.test(pendingHtml), "nincs cím-objektum, amíg nincs cím");
    check(!/Megnyitom/.test(pendingHtml), "nem kínál megnyitást egy nem létező oldalra");
    check(!/class="pd-cta"/.test(pendingHtml), "nem hívja belépésre, amíg nincs belépés");
    for (const row of ["Következő terhelés", "Megújulás", "ÁFA", "Számla", "Lemondás"]) {
      check(pendingHtml.includes(row), `a kötelezettség itt is jár: ${row}`);
    }
    check(/class="pd-stamp"/.test(pendingHtml), "ugyanaz a keret (pecsét) — a fizetés itt is megtörtént");

    console.log("\n④ AZ ELŐNÉZET HÁROM SZINTJE");
    const withShot = payResultPage(true, true, { ...LIVE, preview: { shotUrl: "/pay/preview?paymentId=x" } });
    const withPhoto = payResultPage(true, true, { ...LIVE, preview: { photoUrl: "https://example.test/hero.jpg" } });
    const bare = payResultPage(true, true, { ...LIVE, preview: null });
    check(withShot.includes('src="/pay/preview?paymentId=x"'), "① valódi képernyőkép, ha kész");
    check(!/class="pd-veil"/.test(withShot), "a screenshotot nem takarja név-overlay");
    check(withPhoto.includes("https://example.test/hero.jpg"), "② nyitókép-fotó, ha nincs screenshot");
    check(/class="pd-veil"/.test(withPhoto), "a fotón ott a lap neve");
    check(!/<img /.test(bare.split('class="pd-shot"')[1]?.split("</div>")[0] ?? ""),
      "③ kép nélkül a márka-gradiens marad (nincs törött kép)");
    check(/onerror="this\.remove\(\)"/.test(withPhoto), "a be nem töltő fotó ELTŰNIK, nem törött ikon lesz");

    // ── RENDERELT MÉRÉS ─────────────────────────────────────────────────────
    const file = path.join(dir, "paydone.html");
    await writeFile(file, absolutizeAssets(liveHtml), "utf8");
    const url = pathToFileURL(file).href;
    const browser = await chromium.launch();
    try {
      for (const vp of [
        { tag: "mobil 390px", width: 390, height: 844 },
        { tag: "asztali 1280px", width: 1280, height: 900 },
      ]) {
        console.log(`\n⚑ KIRAJZOLVA — ${vp.tag}`);
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
        await page.waitForTimeout(300);

        // (a) the headline must be LIGHT on the dark page — the measured defect
        const h1 = await page.evaluate(`(() => {
          const el = document.querySelector(".pd-left h1");
          if (!el) return null;
          const cs = getComputedStyle(el);
          const root = getComputedStyle(document.documentElement);
          return { color: cs.color, navy: root.getPropertyValue("--citui-navy-900").trim() };
        })()`) as { color: string; navy: string } | null;
        if (!h1) fail(`${vp.tag}: nincs címsor a lapon`);
        else {
          const lum = luminance(h1.color);
          check(lum > 0.5, `${vp.tag}: a címsor VILÁGOS a sötét lapon (luminancia ${lum.toFixed(2)}, szín ${h1.color})`);
        }

        // (b) nothing may cover the only CTA — and the page must reserve room for
        //     the fixed consent bar, which is what covered it once.
        await page.evaluate(`document.documentElement.style.setProperty("--citui-consent-h","140px")`);
        await page.waitForTimeout(120);
        const room = await page.evaluate(`(() => {
          const split = document.querySelector(".pd-split");
          if (!split) return null;
          const pad = parseFloat(getComputedStyle(split).paddingBottom) || 0;
          const cta = document.querySelector(".pd-cta");
          const r = cta ? cta.getBoundingClientRect() : null;
          return { pad, cta: r ? { w: r.width, h: r.height } : null };
        })()`) as { pad: number; cta: { w: number; h: number } | null } | null;
        if (!room?.cta) fail(`${vp.tag}: nincs CTA gomb a lapon`);
        else {
          check(room.pad >= 140, `${vp.tag}: a lap helyet hagy a süti-sávnak (alsó térköz ${room.pad}px ≥ 140px)`);
          check(room.cta.h >= 44, `${vp.tag}: a CTA ujjal is fogható (${Math.round(room.cta.h)}px magas)`);
        }

        // (b2) ONE amount, ONCE — measured on the VISIBLE text, where the duplicate
        //      actually lived (5 430 Ft in the header AND as "Most fizetett" below).
        const seen = await page.evaluate(`(() => {
          const t = (document.body.innerText || "").replace(/\\u00a0/g, " ");
          const count = (needle) => t.split(needle).length - 1;
          return { charge: count("5 430"), renewal: count("7 240"), paidRow: count("Most fizetett") };
        })()`) as { charge: number; renewal: number; paidRow: number };
        check(seen.charge === 1, `${vp.tag}: a terhelt összeg egyszer látható (mért: ${seen.charge})`);
        check(seen.renewal === 1, `${vp.tag}: a következő terhelés összege egyszer látható (mért: ${seen.renewal})`);
        check(seen.paidRow === 0, `${vp.tag}: nincs megismételt „Most fizetett” sor`);

        // (b3) THE PREVIEW MUST NOT CROP. A fixed box height cut the hero mid-
        //      sentence (owner, 2026-09-20: „nagyon le van vágva"); the box now
        //      takes the SHOT's own aspect, so the two cannot drift apart. The
        //      tolerance is 2% — enough for sub-pixel rounding, not for a
        //      re-introduced magic number.
        const shotBox = await page.evaluate(`(() => {
          const el = document.querySelector(".pd-shot");
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        })()`) as { w: number; h: number } | null;
        if (!shotBox || !shotBox.h) fail(`${vp.tag}: nincs előnézet-doboz a lapon`);
        else {
          const ratio = shotBox.w / shotBox.h;
          const off = Math.abs(ratio - SITE_SHOT_ASPECT) / SITE_SHOT_ASPECT;
          check(
            off <= 0.02,
            `${vp.tag}: az előnézet a KÉP alakját viseli, nem vág le ` +
              `(${shotBox.w}×${shotBox.h} = ${ratio.toFixed(2)}, kép: ${SITE_SHOT_ASPECT.toFixed(2)})`,
          );
        }

        // (c) the layout must not leak sideways at any width
        const overflow = await page.evaluate(
          `document.documentElement.scrollWidth - document.documentElement.clientWidth`,
        ) as number;
        check(overflow <= 1, `${vp.tag}: nincs vízszintes túlfolyás (${overflow}px)`);
        await ctx.close();
      }

      // ── NEGATÍV KONTROLL: a két MÉRT hibát visszarontva az őrnek buknia kell ──
      console.log("\n⚑ ÖNTESZT — a védett szabályok visszarontása");
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page: Page = await ctx.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      const darkAgain = await page.evaluate(`(() => {
        const el = document.querySelector(".pd-left h1");
        el.style.color = getComputedStyle(document.documentElement).getPropertyValue("--citui-ink");
        return getComputedStyle(el).color;
      })()`) as string;
      check(luminance(darkAgain) <= 0.5, `önteszt: sötét címsorra a mérés BUKIK (visszarontva: ${darkAgain})`);
      const cropped = await page.evaluate(`(() => {
        const el = document.querySelector(".pd-shot");
        el.style.aspectRatio = "auto";
        el.style.height = "230px";
        const r = el.getBoundingClientRect();
        return r.width / r.height;
      })()`) as number;
      check(
        Math.abs(cropped - SITE_SHOT_ASPECT) / SITE_SHOT_ASPECT > 0.02,
        `önteszt: fix magasságú (levágó) előnézetre a mérés BUKIK (visszarontva: ${cropped.toFixed(2)})`,
      );
      const noRoom = await page.evaluate(`(() => {
        const s = document.querySelector(".pd-split");
        s.style.paddingBottom = "44px";
        document.documentElement.style.setProperty("--citui-consent-h","140px");
        return parseFloat(getComputedStyle(s).paddingBottom) || 0;
      })()`) as number;
      check(noRoom < 140, `önteszt: rögzített alsó térközre a mérés BUKIK (visszarontva: ${noRoom}px)`);
      await ctx.close();
    } finally {
      await browser.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  if (failures) {
    console.error(`\n❌ paydone-split-check: ${failures} lelet`);
    process.exit(1);
  }
  console.log("\n✅ paydone-split-check: a jóváhagyott terv kontraktusa áll (forrás + kirajzolt lap).");
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
