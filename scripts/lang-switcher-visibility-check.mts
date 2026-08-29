// LÁTHATÓSÁG-ŐR a nyelvváltóra (ADR-0063, jóváhagyott terv 2026-08-29).
//
// ⛔ MIÉRT LÉTEZIK: az első kapum azt mérte, hogy a kapcsoló BENNE VAN-e a
// renderelt HTML-ben — és zöld volt, miközben a tulaj fizetett a modulért, a
// látogató pedig EGYÁLTALÁN NEM LÁTTA a kapcsolót: a sablon fejléce (z-index:100)
// eltakarta a lebegő elemet (z-index:60). „Benne van a HTML-ben" ≠ „a látogató
// látja". Ez az őr böngészőben méri, amit a látogató lát:
//
//   ① a kapcsoló KÖZÉPPONTJÁN tényleg ő van legfelül (elementFromPoint) — nem takarja semmi;
//   ② a kapcsoló nem takar el linket/gombot a lapból (átfedés-vizsgálat);
//   ③ mindkét nézetben van ELÉRHETŐ kapcsoló (asztali: chip a navban, mobil: sáv);
//   ④ a mobil sáv NEM sticky (a tulaj kérése): görgetés után kigörög.
//
// Mind a 16 sablonon fut, mindkét nézetben — ez volt a tulaj kérdése („mi van a
// többi mock típussal?"), és a válasz nem lehet egyetlen sablon.
//
//   npx tsx scripts/lang-switcher-visibility-check.mts
//   npx tsx scripts/lang-switcher-visibility-check.mts --self-test   (PIROSNAK kell lennie)

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { decorateWithLanguages } from "../src/tenant/multilangCore.js";

const SELF_TEST = process.argv.includes("--self-test");

/** Reprezentatív adat — valós alakú, de fixture (a kapu nem függhet a dev DB-től). */
const DATA: SiteData = {
  name: "Napfény Panzió",
  tagline: "Csend, kert, Balaton",
  intro: "Kétszáz méterre a strandtól, saját kerttel várjuk a vendégeket.",
  highlights: ["Saját parkoló", "Kutyabarát", "Reggeli"],
  photos: [
    { url: "https://example.invalid/1.jpg", alt: "Ház" },
    { url: "https://example.invalid/2.jpg", alt: "Szoba" },
  ],
  contact: { email: "info@example.hu", phone: "+36 30 123 4567", address: "Fő utca 1." },
  rating: { value: 4.6, count: 91 },
} as unknown as SiteData;

const LANGS = ["de", "it", "en"];

interface Case {
  readonly tpl: string;
  readonly viewport: { width: number; height: number; label: string };
}
const CASES: Case[] = [];
for (const tpl of Object.keys(TEMPLATES)) {
  CASES.push({ tpl, viewport: { width: 1280, height: 820, label: "asztali" } });
  CASES.push({ tpl, viewport: { width: 390, height: 800, label: "mobil" } });
}

const problems: string[] = [];
const dir = await mkdtemp(path.join(tmpdir(), "langvis-"));
const browser = await chromium.launch({ executablePath: config.chromiumPath });

for (const c of CASES) {
  const recipe: Recipe = { template: c.tpl, skin: "", archetype: "", sections: [] };
  let html = decorateWithLanguages(renderSite(recipe, DATA, { phase: "live" }), {
    current: "hu",
    primaryLang: "hu",
    languages: LANGS,
    baseUrl: "https://pelda.citoviso.com",
  });
  // ÖNTESZT: a hibát ÚGY állítjuk elő, ahogy élesben megtörtént — a kapcsolót a
  // lap fejléce alá süllyesztjük. Ha az őr ezt nem veszi észre, nem mér semmit.
  if (SELF_TEST) {
    html = html.replace(
      "</head>",
      "<style>.cit-lang-nav,.cit-lang-bar{position:fixed;top:0;right:0;z-index:1}</style></head>",
    );
  }
  const file = path.join(dir, `${c.tpl}-${c.viewport.label}.html`);
  await writeFile(file, html, "utf8");

  const page = await browser.newPage({
    viewport: { width: c.viewport.width, height: c.viewport.height },
    isMobile: c.viewport.width < 700,
  });
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(220);

  const verdict = await page.evaluate(() => {
    const all = Array.from(
      document.querySelectorAll(".cit-lang-nav, .cit-lang-bar"),
    ) as HTMLElement[];
    // A rejtett fél (a másik nézeté) nem hiba — a LÁTHATÓT ítéljük meg.
    const el = all.find((e) => e.getBoundingClientRect().width > 8);
    if (!el) return "nincs elérhető nyelvváltó ebben a nézetben";
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cy < 0 || cy > window.innerHeight) return "a kapcsoló a képernyőn kívül van";
    const top = document.elementFromPoint(cx, cy);
    if (!top || !el.contains(top)) {
      const who = top ? `${top.tagName.toLowerCase()}.${(top.className || "").toString().slice(0, 24)}` : "?";
      return `TAKARVA — a középpontján ez van felül: ${who}`;
    }
    const hits: string[] = [];
    for (const a of Array.from(document.querySelectorAll("a,button"))) {
      if (el.contains(a)) continue;
      const ar = (a as HTMLElement).getBoundingClientRect();
      if (ar.width < 4 || ar.height < 4) continue;
      if (ar.left < r.right && ar.right > r.left && ar.top < r.bottom && ar.bottom > r.top) {
        hits.push(((a as HTMLElement).innerText || "?").trim().slice(0, 18));
      }
    }
    return hits.length ? `ELTAKAR a lapból: ${hits.slice(0, 3).join(", ")}` : "ok";
  });
  if (verdict !== "ok") problems.push(`${c.tpl} / ${c.viewport.label}: ${verdict}`);

  // ④ A mobil sáv NEM lehet sticky (tulajdonosi kérés).
  if (c.viewport.label === "mobil" && verdict === "ok") {
    const sticky = await page.evaluate(() => {
      const bar = document.querySelector(".cit-lang-bar") as HTMLElement | null;
      if (!bar || bar.getBoundingClientRect().width < 8) return false;
      const before = bar.getBoundingClientRect().top;
      window.scrollTo(0, 800);
      // ⚠️ Csak akkor ítélkezünk, ha a lap TÉNYLEG görgött: rövid lapon a sáv
      // azért nem mozdul, mert nincs hova — az nem stickyness (hamis pozitív volt).
      if (window.scrollY < 40) return false;
      const after = bar.getBoundingClientRect().top;
      return after >= before; // nem mozdult el felfelé ⇒ ragad
    });
    if (sticky) problems.push(`${c.tpl} / mobil: a nyelvi sáv STICKY — a tulaj kérése szerint kigörögnie kell`);
  }
  await page.close();
}
await browser.close();

if (SELF_TEST) {
  if (problems.length) {
    console.log(
      `✅ önteszt: a szándékos elrontást (a kapcsoló a fejléc alá süllyesztve) az őr ` +
        `${problems.length}/${CASES.length} esetben elkapta — pl. „${problems[0]}"`,
    );
    process.exit(0);
  }
  console.error("⛔ önteszt: az elrontott kapcsolót NEM vette észre — az őr vak, javítsd.");
  process.exit(1);
}

if (problems.length) {
  console.error(
    `⛔ lang-switcher-visibility: ${problems.length}/${CASES.length} esetben a látogató nem ` +
      `használhatja a nyelvváltót (a tenant KIFIZETTE a modult):`,
  );
  for (const p of problems.slice(0, 12)) console.error(`   · ${p}`);
  console.error(`   A jóváhagyott terv: assets/design-refs/tenant-site/README.md`);
  process.exit(1);
}
console.log(
  `✅ lang-switcher-visibility: mind a ${Object.keys(TEMPLATES).length} sablonon, mindkét ` +
    `nézetben LÁTSZIK és nem takar semmit (${CASES.length} eset).`,
);
