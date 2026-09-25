// gate-lane: own-fixture-only
//   ↑ ÍGÉRET (ADR-0229, audit 2026-09-25): ez a kapu CSAK a saját, futásonként bélyegzett fixture-ét írja és
//   olvassa vissza — a kapu-futtató ② fázisában a többi jelölt íróval PÁRHUZAMOSAN fut. Ha ide globális
//   olvasás/söprés/kölcsönzött sor kerül, vedd le a jelölést. Őr: scripts/gate-lane-check.mts.
// ŐR — ADR-0128: 29 nyelv és három sáv a Többnyelvű honlap modulban.
// Kontraktus: assets/design-refs/console/multilang-tiers/ (a jóváhagyott A változat).
//
// Amit mér, és MIÉRT pont ezt (mindegyik pont egy MÉRT hibából vagy a kontraktus
// egy kötéséből származik, nem „jó lenne ha" listából):
//
//   ① A LISTA ÉS A FELIRAT UGYANABBÓL SZÁMOL. A „Választható: N nyelv" mondat és a
//      ténylegesen kirenderelt csempék száma nem csúszhat el egymástól
//      (feedback_label_must_derive_from_predicate: a felirat más oszlopot ígért,
//      mint amin a predikátum ült).
//   ② MINDEN NYELVNEK VAN ZÁSZLÓJA. A flagSvg() ismeretlen kódra ÜRES stringet ad,
//      tehát egy kimaradt zászló nem hibázik, csak csendben eltűnik — a vendég-oldali
//      nyelvváltón is.
//   ③ A KÉT NYELVLISTA SZÉTVÁLT. A konzol nyelvválasztója uiLangs()-ból él, nem a 29
//      eladható nyelvből — különben az operátor olyan nyelvre válthatna, amin a
//      felület csak hu-fallback.
//   ④ A SAPKA LÁTHATÓ ÉS A CSONKÍTÁS KIMONDOTT (kontraktus §3–§4) — Playwrighttal
//      végigkattintva, mert ezt KÉP NEM MUTATJA MEG.
//   ⑤ A KAPU AZ ÍRÁSON VAN (ADR-0113 ⑤): kézzel gyártott POST sem vehet 3 nyelv
//      áráért 6-ot; a Teljes sáv viszont tényleg mind a 28-at adja.
//   ⑥ AZ ÁR A SÁVBÓL JÖN, nem beégetett számból.
//
//   npx tsx scripts/multilang-tier-check.mts
//   npx tsx scripts/multilang-tier-check.mts --self-test
//     ⛔ NEGATÍV FUTÁS: a kártya-adatot visszarontja az ADR-0128 ELŐTTI alakra
//     (egyetlen sáv, fix 3 nyelv, régió-bontás nélkül), és elvárja, hogy a
//     ⑥/④/① mérések ELBUKJANAK. Ha az önteszt is zöld lenne, az őr nem a szabályt
//     mérné, hanem a semmit (feedback_fixture_must_prove_its_own_path).

process.env.DATABASE_URL = "";

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { sql } from "kysely";
import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { siteLangs, uiLangs, LANG_REGIONS } from "../src/i18n/lang.js";
import { flagSvg } from "../src/ui/flags.js";
import { MULTILANG_TIERS } from "../src/modules.js";
import { getMultilangTierPrice, loadPricing, pricingSnapshot } from "../src/pricing.js";
import { pricingPage } from "../src/console/views.js";
import { langNameLocalized, langRegionName, multilangTierName } from "../src/i18n/mail.js";
import { multilangSection, type MultilangAdminData } from "../src/server/adminViews.js";
import { multilangCardData } from "../src/tenant/multilangCard.js";
import { createMultilangOrder } from "../src/tenant/multilangOrder.js";

const REPO = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");
const failures: string[] = [];

/** INVARIÁNS: mindkét futásban igaznak kell lennie (nem ennek a javításnak a terméke). */
function inv(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

/** ÚJ SZABÁLY: élesben igaz, az önteszt visszarontott nézetén BUKNIA kell. */
function rule(name: string, ok: boolean, detail = ""): void {
  const want = !SELF_TEST;
  if (ok === want) console.log(`  ✅ ${name}${SELF_TEST ? " (helyesen bukott)" : ""}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(SELF_TEST ? `${name} — az önteszten NEM bukott` : name);
  }
}

/** Az ADR-0128 ELŐTTI kártya-adat: egy sáv, fix 3, régió-bontás nélkül. */
function regress(d: MultilangAdminData): MultilangAdminData {
  return {
    ...d,
    count: 3,
    tiers: [{ ...d.tiers[0]!, cap: 3, isAll: false }],
    selectedTier: d.tiers[0]!.id,
    // A régi kártya egyetlen, tagolatlan rácsot adott — és a 9 nyelvű készletből
    // választatott, miközben a bevezető mondat mást ígért. Pont az ① elcsúszás.
    regions: [{ key: "central", langs: d.options.slice(0, 9) }],
  };
}

/**
 * ⛔ AZ ADATOT VISSZARONTANI NEM ELÉG: a sáv-kártyák, a sapka-sor és a „csomag
 * tartalma" doboz ÚJ JELÖLÉS, amit a kártya a `tiers` tömbtől függetlenül is
 * kirakna — az első öntesztem emiatt két helyen NEM bukott, egy kattintás pedig
 * 30 mp-es időtúllépéssel szállt el. A hű „előtte" nézethez a jelölést is le kell
 * venni, különben az őr egy nem létező múltat mér.
 */
function stripNew(html: string): string {
  return html
    .replace(/<div class="adm-mltier">[\s\S]*?<\/div>\s*(?=<p style)/, "")
    // ⚠️ A sapka-sor már SZERVER-OLDALON kap szöveget (JS nélkül is olvasható), ezért
    //    a tartalmára is illeszkedni kell — az üres-elemre írt minta csendben elvétette.
    .replace(/<p class="adm-mlcap"[^>]*>[\s\S]*?<\/p>/, "")
    .replace(/<div class="adm-mlall"[\s\S]*?<\/div><\/div>/, "")
    // A kártyán kívüli mobil ár-sáv szintén ADR-0128-as: az „előtte" nézetben az
    // összegző csak a kártyán BELÜL létezett.
    .replace(/<div class="adm-mlbar">[\s\S]*?<\/div>\s*<\/form>/, "</form>");
}

const view = (d: MultilangAdminData): string =>
  SELF_TEST ? stripNew(multilangSection(regress(d), "hu")) : multilangSection(d, "hu");

async function reallyVisible(page: Page, sel: string): Promise<boolean> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }, sel);
}

let leadId = "";
let tenantId = "";
let siteId = "";
let prospectId = "";
let tmp = "";
const browser = await chromium.launch({ executablePath: config.chromiumPath });

try {
  await loadPricing();
  tmp = await mkdtemp(path.join(tmpdir(), "mltier-"));

  /* ── ② zászló-teljesség — DB nélkül mérhető ──────────────────────────────── */
  console.log("\n② Zászló minden nyelvhez");
  const noFlag = siteLangs().filter((l) => flagSvg(l, 18) === "");
  inv(
    `mind a ${siteLangs().length} nyelvnek van zászlója`,
    noFlag.length === 0,
    noFlag.length ? `hiányzik: ${noFlag.join(", ")}` : "",
  );
  const ungrouped = siteLangs().filter(
    (l) => l !== "hu" && !LANG_REGIONS.some((r) => r.codes.includes(l)),
  );
  inv(
    "minden célnyelv be van sorolva egy régióba",
    ungrouped.length === 0,
    ungrouped.length ? `kimaradt: ${ungrouped.join(", ")}` : "",
  );
  // ⛔ A nyelv NEVE is vevő-oldali felirat (§B.18), és a langNameLocalized() ismeretlen
  //    kódra a KÓDOT adja vissza — némán. Ezt a pszeudo-nyelv kapu élőben megfogta
  //    (a régi fixture-ben egyetlen nyelv volt `name:"de"`, ami a nyelvkód-szabályra
  //    illeszkedett, ezért a nevek soha nem lettek megmérve). Itt szerkezetileg zárjuk.
  const unnamed = siteLangs().filter((l) => langNameLocalized(l, "hu") === l);
  inv(
    "minden nyelvnek van FORDÍTHATÓ neve (langNameLocalized)",
    unnamed.length === 0,
    unnamed.length ? `csak a kódot adja vissza: ${unnamed.join(", ")}` : "",
  );
  const unnamedTiers = MULTILANG_TIERS.filter((t) => multilangTierName(t.id, "hu") === t.id);
  inv(
    "minden sávnak van fordítható neve",
    unnamedTiers.length === 0,
    unnamedTiers.map((t) => t.id).join(", "),
  );
  const unnamedRegions = LANG_REGIONS.filter((r) => langRegionName(r.key, "hu") === r.key);
  inv(
    "minden régiónak van fordítható neve",
    unnamedRegions.length === 0,
    unnamedRegions.map((r) => r.key).join(", "),
  );

  /* ── ⑥b a sáv-árak TÉNYLEG szerkeszthetők az Árazás lapon ────────────────── */
  // ⛔ A kontraktus azt ígéri, hogy „az árak operátor-szerkeszthetők maradnak". Ez
  //    NEM volt igaz: az Árazás lap a MODULE_CATALOG-ot járja, amiben csak a
  //    `multilang` van — a `multilang6`/`multilang28` mezője hiányzott, a mentés
  //    pedig eldobta volna az értéküket. (Egy párhuzamos szál tudasbazis-őre mérte
  //    ki, 2026-09-13.) Ha egy ígéret a kontraktusban áll, legyen őre is.
  console.log("\n⑥b A sáv-árak szerkeszthetők az Árazás lapon");
  const pricingHtml = pricingPage(
    pricingSnapshot("hu") as never,
    [] as never,
    new Map() as never,
    new Set() as never,
  );
  for (const t of MULTILANG_TIERS) {
    inv(`a(z) ${t.name} sávnak van ár-mezője (m_${t.priceId})`,
      pricingHtml.includes(`name="m_${t.priceId}"`));
  }

  /* ── ③ a két nyelvlista szétvált ─────────────────────────────────────────── */
  console.log("\n③ A konzol-nyelvek és az eladható nyelvek külön listák");
  inv("a site-nyelvek köre bővebb, mint a konzolé", siteLangs().length > uiLangs().length,
    `site=${siteLangs().length} ui=${uiLangs().length}`);
  inv(
    "a konzol-nyelvek mind benne vannak az eladható körben (nincs árva UI-nyelv)",
    uiLangs().every((l) => siteLangs().includes(l)),
  );
  inv("a konzol NEM kínálja a teljes eladható kört", uiLangs().length < siteLangs().length);

  /* ── fixture ─────────────────────────────────────────────────────────────── */
  const stamp = String(Date.now());
  // Own, stamped parent — dropped on every exit path (scripts/lib/fixture-parent.mts).
  const { createFixtureParent } = await import("./lib/fixture-parent.mts");
  const parent = await createFixtureParent(db as never, "mltier");
  const defRow = { id: parent.defId };
  const run = { id: parent.runId };
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "ADR-0128 őr", raw: sql`'{}'::jsonb` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "ADR-0128 őr" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = tenant.id;
  // A renderelhetőség feltétele a MOCK-ARTEFAKT is: recipe + siteData nélkül a
  // loadSiteForEdit() null-t ad, és a rendelés a nyelv-kapu ELŐTT elhasal.
  const artifact = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: lead.id,
      status: "generated",
      inputs: JSON.stringify({
        recipe: { template: "aurora", lang: "hu" },
        siteData: { name: "ADR-0128 őr", lang: "hu", tagline: "teszt" },
      }) as never,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      source_artifact_id: artifact.id,
      preview_token: `mltierchk${stamp}`,
      // ⛔ A `path` NÉLKÜL az effectiveSiteForMultilang() azonnal null-t ad, és a
      //    rendelés a „site még nem renderelhető" ágon bukik el — vagyis az ⑤ mérés
      //    ZÖLD lenne anélkül, hogy a nyelv-kapuhoz ELÉRT volna. Az első futásom pont
      //    így volt vak (feedback_guard_must_not_borrow_its_subject rokona: a zöld a
      //    ROSSZ okból jött).
      path: `sites/mltierchk${stamp}`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  siteId = site.id;
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `mltierchk${stamp}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  prospectId = prospect.id;

  const data = await multilangCardData({ siteId, tenantId, primaryLang: "hu" });
  const html = view(data);

  // A fixture BIZONYÍTJA A SAJÁT ÚTJÁT: ha nem a multilang-kártyát rendereltük, az
  // egész mérés hazug lenne (feedback_fixture_must_prove_its_own_path).
  if (!html.includes("Többnyelvű honlap") || !html.includes('name="lang"')) {
    throw new Error("a fixture NEM a multilang-kártyát rendereli");
  }
  console.log("\n  ↳ a fixture igazoltan a Többnyelvű honlap kártyát rendereli");

  /* ── ① a felirat és a lista ugyanabból számol ────────────────────────────── */
  console.log("\n① A Választható-mondat a LISTÁBÓL származik");
  // ⚠️ NEM a `name="lang"` előfordulásait számoljuk: azt az inline script is
  //    tartalmazza (input[name="lang"]), ezért eggyel többet mért a valóságnál.
  const tiles = (html.match(/<label class="adm-mlang" data-lang=/g) ?? []).length;
  const claimed = Number(/Választható: (\d+) nyelv/.exec(html)?.[1] ?? "0");
  rule(
    "a kiírt szám megegyezik a kirenderelt csempék számával",
    claimed > 0 && claimed === tiles,
    `mondat=${claimed} csempe=${tiles}`,
  );
  inv("a magyar NEM választható célnyelvként", !/value="hu"/.test(html));
  rule(
    `mind a ${siteLangs().length - 1} célnyelv ki van rakva`,
    tiles === siteLangs().length - 1,
    `${tiles} csempe`,
  );

  /* ── ⑥ az ár a sávból jön ────────────────────────────────────────────────── */
  console.log("\n⑥ Három sáv, mindegyik a saját árával");
  const flat = (s: string) => s.replace(/\u00a0/g, " ");
  for (const t of MULTILANG_TIERS) {
    const price = getMultilangTierPrice(t);
  // ⚠️ A magyar ezres-elválasztó NEM TÖRŐ szóköz (U+00A0), a kártya viszont sima
  //    szóközzel formáz — a nyers összehasonlítás HELYES feliraton is bukna.
    const shown = flat(html).includes(flat(price.toLocaleString("hu-HU")));
    // Az Alap ára INVARIÁNS: az ADR-0128 ELŐTT is ez az egy ár volt kiírva.
    // Csak a két ÚJ sáv ára az, aminek az öntesztben el kell tűnnie.
    (t.id === "alap" ? inv : rule)(`a(z) ${t.name} sáv ára megjelenik (${price} Ft)`, shown);
  }
  rule(
    "mind a három sáv-kártya kirenderelődik",
    (html.match(/<input type="radio" name="tier"/g) ?? []).length === 3,
  );

  /* ── ④ viselkedés: sapka, csonkítás, Teljes sáv (Playwright) ─────────────── */
  console.log("\n④ A sapka látható, a csonkítás kimondott (végigkattintva)");
  const file = path.join(tmp, "card.html");
  // ⛔ A VALÓDI ADMIN-CSS-SEL, viewport-metával. Az első változatom csupasz
  //    `<body>`-ba írta a kártyát: ott a `.adm-card`-nak nincs `overflow:hidden`,
  //    tehát a §6 tapadás-mérés EGY MÁSIK LAPOT mért volna, mint ami élesben fut —
  //    és a viewport-meta nélkül a `@media (max-width:560px)` sem kapcsolt be
  //    (a mobil emuláció 980px-es layout-viewportot adott, a sáv display:none maradt).
  const adminCss =
    (await readFile(path.join(REPO, "public/assets/ui/citui.css"), "utf8")) +
    "\n" +
    (await readFile(path.join(REPO, "public/assets/ui/citui-admin.css"), "utf8"));
  await writeFile(
    file,
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<style>${adminCss}</style></head>` +
      `<body class="citui-admin-body" style="background:var(--citui-surface)">` +
      `<div style="max-width:var(--citui-container);margin:0 auto;padding:18px 14px 60px">${html}</div>` +
      `</body></html>`,
    "utf8",
  );
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const jsErrors: string[] = [];
  page.on("pageerror", (e) => jsErrors.push(String(e)));
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(150);

  const capText = async () => ((await page.textContent("[data-ml-cap]")) ?? "").replace(/\u00a0/g, " ").trim();
  const checkedN = () => page.evaluate(() => document.querySelectorAll('input[name="lang"]:checked').length);
  const offN = () => page.evaluate(() => document.querySelectorAll(".adm-mlang.is-off").length);
  const pick = async (code: string) => page.click(`.adm-mlang[data-lang="${code}"]`);

  /** A hiányzó vezérlő BUKÁS, nem összeomlás — az öntesztben pont ez a várt kimenet. */
  const tryRule = async (name: string, fn: () => Promise<boolean>): Promise<void> => {
    let ok = false;
    try { ok = await fn(); } catch { ok = false; }
    rule(name, ok);
  };
  const has = async (sel: string) => (await page.$(sel)) !== null;

  await tryRule("van sapka-sor, és megmondja, hány nyelv fér még bele", async () =>
    (await has("[data-ml-cap]")) && /Még \d+ nyelvet/.test(await capText()));
  await tryRule("van sávváltó, mind a három sávval", async () =>
    (await page.$$(".adm-mltc")).length === 3);

  // Alap sáv: a 3. pipa után a többi LÁTHATÓAN kikapcsol.
  // ⚠️ Olyan kódokat pipálunk, amik a VISSZARONTOTT nézetben is ott vannak (az első 9) —
  //    különben az önteszt nem a szabályon bukna, hanem egy hiányzó csempén.
  for (const c of ["de", "pl", "cs"]) await pick(c);
  inv("három nyelv bepipálható az Alap sávban", (await checkedN()) === 3);
  // A sapka-KIKAPCSOLÁS invariáns: a régi kártya JS-e is letiltotta a fölös csempét.
  inv("a sapkán túli csempék kikapcsolnak", (await offN()) > 0, `${await offN()} kikapcsolt`);
  await tryRule("és a felirat kimondja, hogy betelt", async () => (await capText()).includes("Betelt"));

  // Bővítettre váltva újra választható, és az ár követi.
  await tryRule("Bővítettre váltva megint választható", async () => {
    if (!(await has('.adm-mltc:has(input[value="bovitett"])'))) return false;
    await page.click('.adm-mltc:has(input[value="bovitett"])');
    await page.waitForTimeout(80);
    return (await offN()) === 0;
  });
  // A huf() nem törő szóközt (U+00A0) tesz az ezresek közé: a nyers includes("22 900")
  //    emiatt bukott egy HELYES feliraton. Normalizálva hasonlítunk.
  const norm = (s: string) => s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const payText = async () => norm((await page.textContent("[type=submit]")) ?? "");
  await tryRule("a gomb a Bővített sáv árát mondja", async () => (await payText()).includes("22 900"));

  // Teljes sáv: nincs mit választani, a lista helyére a tartalom lép.
  const toTeljes = async (): Promise<boolean> => {
    if (!(await has('.adm-mltc:has(input[value="teljes"])'))) return false;
    await page.click('.adm-mltc:has(input[value="teljes"])');
    await page.waitForTimeout(80);
    return true;
  };
  await tryRule("a Teljes sávban eltűnik a választó", async () =>
    (await toTeljes()) && !(await reallyVisible(page, "[data-ml-picker]")));
  await tryRule("helyette a csomag tartalma látszik", async () =>
    (await has("[data-ml-all]")) && (await reallyVisible(page, "[data-ml-all]")));
  await tryRule("a sapka-sor kimondja, hogy nincs mit választani", async () =>
    (await capText()).includes("nincs mit választani"));
  await tryRule("a gomb a Teljes sáv árát mondja", async () => (await payText()).includes("30 000"));

  // Lefelé váltva a fölös jelölés LEKERÜL — és a szám mutatja.
  await tryRule("Alapra vissza: a fölös jelölés lekerült", async () => {
    if (!(await has('.adm-mltc:has(input[value="alap"])'))) return false;
    await page.click('.adm-mltc:has(input[value="alap"])');
    await page.waitForTimeout(80);
    return (await checkedN()) <= 3;
  });
  inv("nincs JS-hiba a kártyán", jsErrors.length === 0, jsErrors.join(" | "));
  await page.close();

  /* ── §6: a mobil ár-sáv a kártyán KÍVÜL, és tényleg tapad ────────────────── */
  // ⛔ Ezt sem kép, sem DOM-jelenlét nem bizonyítja: a sáv a kártyán BELÜL is
  //    ott VOLNA, csak sosem tapadna meg (a .adm-card overflow:hidden lesz a
  //    scroll-konténere). Ezért a tapadást MÉRJÜK, görgetés közben.
  console.log("\n§6 A mobil ár-sáv a kártyán kívül van, és tapad (390px)");
  const m = await browser.newPage({ viewport: { width: 390, height: 800 }, isMobile: true });
  await m.goto(pathToFileURL(file).href);
  await m.waitForTimeout(150);
  const barOutside = await m.evaluate(
    () => !!document.querySelector(".adm-mlbar") &&
      !document.querySelector(".adm-card")!.contains(document.querySelector(".adm-mlbar")),
  );
  rule("a mobil ár-sáv a .adm-card-on KÍVÜL van", barOutside);
  // A hiányzó sáv BUKÁS (pont ez a várt az öntesztben), nem összeomlás.
  const stuck = await m.evaluate(() => {
    window.scrollTo(0, 700);
    const el = document.querySelector(".adm-mlbar");
    if (!el) return { top: -1, vh: window.innerHeight, h: 0 };
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), vh: window.innerHeight, h: Math.round(r.height) };
  });
  rule(
    "görgetés közben is a képernyőn van (tapad)",
    stuck.top >= 0 && stuck.top < stuck.vh && stuck.h > 10,
    `top=${stuck.top} vh=${stuck.vh} h=${stuck.h}`,
  );
  // ⛔ NEM ELÉG, hogy a sáv „a képernyőn van": ha az alja kilóg, a GOMB és az ÖSSZEG
  //    egy része a látható terület alá esik — a vevő megint nem látja, mit fizet.
  //    A teljes sáv a viewportban kell legyen, a gombjával együtt.
  const whole = await m.evaluate(() => {
    const el = document.querySelector(".adm-mlbar");
    if (!el) return { barBottom: 1e9, btnBottom: 1e9, vh: window.innerHeight };
    const btn = el.querySelector("[type=submit]");
    return {
      barBottom: Math.round(el.getBoundingClientRect().bottom),
      btnBottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : 1e9,
      vh: window.innerHeight,
    };
  });
  rule(
    "a sáv TELJESEN a képernyőn van, a gombjával együtt",
    whole.barBottom <= whole.vh + 1 && whole.btnBottom <= whole.vh + 1,
    `sáv alja=${whole.barBottom} gomb alja=${whole.btnBottom} vh=${whole.vh}`,
  );
  const sameLabel = await m.evaluate(() =>
    [...document.querySelectorAll("[type=submit]")].map((b) => (b.textContent ?? "").trim()),
  );
  inv(
    "a két gomb UGYANAZT az árat mondja (egy forrás, két megjelenítés)",
    new Set(sameLabel).size === 1,
    sameLabel.join(" | "),
  );
  await m.close();

  /* ── ⑤ a kapu az ÍRÁSON ──────────────────────────────────────────────────── */
  // ⚠️ Ez a rész a VALÓDI createMultilangOrder-t hívja, tehát a nézet visszarontása
  // nem érinti — ezért `inv`, nem `rule`: mindkét futásban igaznak kell lennie.
  console.log("\n⑤ A kapu az íráson van (a nézet visszarontása nem lazítja)");
  // ⛔ ELŐBB BIZONYÍTSA AZ ÚTJÁT: ha a rendelés a site-on akadna el, minden alábbi
  //    „nem rendelhető" mérés a ROSSZ okból lenne zöld.
  const reach = await createMultilangOrder(tenantId, ["de"], "alap");
  inv(
    "a rendelés ELÉR a nyelv-kapuig (nem a site-on akad el)",
    !/site még nem renderelhető/.test(reach.error ?? ""),
    reach.error ?? "ok",
  );
  const over = await createMultilangOrder(tenantId, ["de", "en", "sk", "it", "pl", "cs"], "alap");
  inv(
    "Alap sávba 6 nyelv NEM rendelhető",
    !over.ok && /legfeljebb 3 nyelv/.test(over.error ?? ""),
    over.error ?? "átment",
  );
  const empty = await createMultilangOrder(tenantId, [], "bovitett");
  inv("nyelv nélkül nem rendelhető", !empty.ok, empty.error ?? "átment");
  // ⛔ A Teljes sáv NE a beküldött jelölésből dolgozzon: egyetlen pipával is mind a 28 jár.
  //    (A rendelés a számlázási azonosság hiányán fog elhasalni — a fixture-nek nincs
  //    kifizetett megrendelése —, de a NYELV-kapu addigra már lefutott, tehát ha a
  //    sapka-hiba élne, ITT `legfeljebb`-hibát kapnánk helyette.)
  const all = await createMultilangOrder(tenantId, ["de"], "teljes");
  inv(
    "a Teljes sáv nem akad el nyelv-sapkán",
    !/legfeljebb/.test(all.error ?? ""),
    all.error ?? "ok",
  );
} finally {
  await browser.close();
  if (tmp) await rm(tmp, { recursive: true, force: true });
  // Takarítás — a közös dev DB-ben semmi nyom nem maradhat utánunk.
  if (siteId) {
    await db.deleteFrom("multilang_generation").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site_multilang").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site").where("id", "=", siteId).execute();
  }
  if (tenantId) {
    await db.deleteFrom("order_intent").where("tenant_id", "=", tenantId).execute();
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", tenantId).execute();
  }
  if (prospectId) await db.deleteFrom("prospect").where("id", "=", prospectId).execute();
  if (tenantId) await db.deleteFrom("tenant").where("id", "=", tenantId).execute();
  if (leadId) await db.deleteFrom("lead").where("id", "=", leadId).execute();
  await db.destroy();
}

if (failures.length) {
  console.error(`\n⛔ ADR-0128 őr${SELF_TEST ? " (önteszt)" : ""}: ${failures.length} mérés BUKOTT`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(
  SELF_TEST
    ? "\n✅ ÖNTESZT: a visszarontott (fix 3 nyelv, egy sáv) nézeten minden új szabály elbukott — az őr tényleg mér."
    : "\n✅ ADR-0128: 29 nyelv, három sáv, látható sapka, és a kapu az íráson.",
);
