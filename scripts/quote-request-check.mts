// ⛔⛔ AZ ÁRAJÁNLAT-MÓD ŐRE — kontraktus: assets/design-refs/tenant-site/quote-request/
// (tulajdonosi jóváhagyás 2026-09-22, „C" változat).
//
// A MÉRT LELET, amiért létezik. Ha a kiválasztott egységre — vagy a tartózkodás BÁRMELYIK
// éjszakájára — nem állt össze ár, a `renderQuote` NÉMÁN kiürítette az ár-dobozt
// (`if (!q) { el.innerHTML = ""; }`). Asztalon üres lyuk maradt a dátum-sáv alatt, mobilon
// összecsukódott — a naptár, az űrlap és a gomb viszont változatlanul működött, tehát a
// vendég megnyomta a „Foglalási kérés elküldése" gombot úgy, hogy SOHA nem látott árat.
//
// Miért END-TO-END és nem egység-teszt: a kontraktus HÁROM felületi tényt köt EGYSZERRE
// (a doboz tartalma · a gomb felirata · a gomb alatti ígéret), és azok három külön helyen
// épülnek. Egy `quoteFor`-ra írt egység-teszt mindháromra zöld lett volna.
//
// Eldobható fixtúrán mér: valódi DB + valódi HTTP-szerver + valódi böngésző, mindkét méreten.
// A `--selftest` nem szimulál: a KIRENDERELT pillanatképben cseréli vissza a történeti
// viselkedést (néma kiürítés), és újra lefuttatja ugyanazokat az állításokat.
//
// ADR-0393 (több szoba egy foglalási kérésben, kontraktus: tenant-site/multi-room/): a 2+
// egységes lapon nincs többé <select id="cit-unit">, hanem szobalista ([data-cit-roomlist]):
// előbb a napok, aztán a szobák kijelölése. Az ⑤ pont („a választóban jelölve”) ma a
// szobalista ár-helyén él („egyedi ár” vs. összeg); az árajánlat-mód akkor lép életbe, ha
// BÁRMELYIK kijelölt szobára nincs ár; kijelölés nélkül se ár, se árajánlat-mód.
//
//   npx tsx scripts/quote-request-check.mts
//   npx tsx scripts/quote-request-check.mts --selftest   ← PIROSNAK KELL LENNIE

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

const SELFTEST = process.argv.includes("--selftest");

import { once } from "node:events";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCOPE = path.basename(ROOT); // worktree-unique scratch key: assets/Temp is a SYMLINK shared by every worktree
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { setBasePrice } = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");

const ids: Record<string, string> = {};
let server: Server | null = null;
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown) =>
  c ? console.log(`  ✓ ${n}`) : (fail++, console.error(`  ✗ ${n}${d === undefined ? "" : " — " + JSON.stringify(d)}`));

try {
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_ask", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_ask lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "_ask tenant" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `ask-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `ask_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Árajánlat Teszt", intro: "Két egység, egyikre van ár.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email: "owner@example.com" }, businessType: "accommodation" }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const priced = await db.insertInto("site_unit").values({ site_id: site.id, name: "Árazott apartman", capacity: 4, sort_order: 1 }).returning("id").executeTakeFirstOrThrow();
  const unpriced = await db.insertInto("site_unit").values({ site_id: site.id, name: "Árazatlan faház", capacity: 2, sort_order: 2 }).returning("id").executeTakeFirstOrThrow();
  await setBasePrice(priced.id, 28_000);
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: "owner@example.com" }, "test");
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");

  // ⛔ A piros önteszt a KIRENDERELT pillanatképet rontja vissza a történeti alakra —
  // nem egy szintetikus lapot mér, hanem azt, amit a vendég kap. Ha a csere nem talál,
  // HANGOSAN bukunk: egy önteszt, ami némán nem ront vissza semmit, zöldet hazudna.
  if (SELFTEST) {
    const snap = path.join(ROOT, "sites", slug, "index.html");
    const html = await readFile(snap, "utf8");
    const marker = 'el.classList.add("cit-book__quote--ask");';
    if (!html.includes(marker)) {
      console.error("⛔ ÖNTESZT: nem találom az árajánlat-ágat a pillanatképben — nem tudok visszarontani.");
      process.exit(1);
    }
    const start = html.indexOf('if (!q) {');
    const end = html.indexOf('setAskMode(true);\n        return;\n      }');
    if (start < 0 || end < 0) {
      console.error("⛔ ÖNTESZT: az ág határai nem azonosíthatók — nem rontok vissza vakon.");
      process.exit(1);
    }
    await writeFile(snap, html.replace(marker, "/* visszarontva */").replace(
      /if \(!q\) \{[\s\S]*?setAskMode\(true\);\s*return;\s*\}/,
      'if (!q) { el.innerHTML = ""; return; }',
    ), "utf8");
    console.log("  🔴 ÖNTESZT: a pillanatkép visszarontva a NÉMA kiürítésre.\n");
  }

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as AddressInfo).port;

  const browser = await chromium.launch();
  const OUT = path.join(ROOT, `assets/Temp/_quote-${SCOPE}`);
  await mkdir(OUT, { recursive: true });

  for (const [label, width, desktop] of [["mobil", 390, false], ["asztali", 1280, true]] as const) {
    console.log(`\n══ ${label} (${width}px)`);
    const ctx = await browser.newContext({ viewport: { width, height: 1100 } });
    const page = await ctx.newPage();
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/t/${slug}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // ADR-0393 (multi-room): dates FIRST, then rooms. Before the dates the list only says
    // what comes next — no price, no "egyedi ár" claim about a stay nobody chose yet.
    const roomList = page.locator("[data-cit-roomlist]").first();
    check("ADR-0393 a régi egység-választó nincs többé", (await page.locator('select[name="unit"]').count()) === 0);
    check("ADR-0393 dátum előtt a szobalista a következő lépést mondja", /Előbb válassza ki a napokat/.test(await roomList.innerText()), await roomList.innerText());

    // ⛔ HÓNAP-VÉGI CSAPDA (2026-09-26, szept. 26-án piros): a 6. szabad nap a KÖVETKEZŐ hónapba
    // esett, amit a telefon-nézet elrejt — a naptár lapoz egyet, ha a látható hónapban nincs elég.
    let days = page.locator("[data-day]:not([disabled]):not(.is-blocked):visible");
    if ((await days.count()) < 6) {
      await page.locator(".cit-book__calnav--next").first().click();
      await page.waitForTimeout(200);
      days = page.locator("[data-day]:not([disabled]):not(.is-blocked):visible");
    }
    if ((await days.count()) >= 6) { await days.nth(3).click(); await page.waitForTimeout(150); await days.nth(5).click(); await page.waitForTimeout(600); }
    // ADR-0393: on a phone the room list sits in STEP 1, between the dates and the price box;
    // Plan B's step 2 keeps the button and the note. innerText of a non-rendered node is its
    // text, so the ①–④ sentences are judged exactly as before, without leaving step 1.

    const cta = page.locator(".cit-book__submit").first();
    const note = page.locator(".cit-book__note").first();
    const pick = (id: string) => page.locator(`input[data-cit-room-pick][value="${id}"]`).first();
    const priceSlot = (id: string) =>
      page.locator("label.cit-book__room", { has: page.locator(`input[data-cit-room-pick][value="${id}"]`) }).locator(".cit-book__roomp").first();
    const setPick = async (id: string, on: boolean) => { await pick(id).setChecked(on); await page.waitForTimeout(700); };

    // ⑤ a jelölés MÁR A VÁLASZTÁS PILLANATÁBAN — ma: a szobalista ár-helye (ADR-0393)
    const unpricedSlot = (await priceSlot(unpriced.id).innerText().catch(() => "")).trim();
    const pricedSlot = (await priceSlot(priced.id).innerText().catch(() => "")).trim();
    check("⑤ az árazatlan egység a SZOBALISTÁBAN jelölve („egyedi ár”)", /egyedi ár/.test(unpricedSlot), unpricedSlot);
    check("…és az árazott NINCS megjelölve, összeget mutat", !/egyedi ár/.test(pricedSlot) && /\d[\d\s]*Ft/.test(pricedSlot), pricedSlot);
    check("⑦ az árazatlan egység NEM kerül ki a listából (kijelölhető)", (await pick(unpriced.id).count()) === 1 && (await pick(unpriced.id).isEnabled()));

    // ADR-0393: no ticked room — no price, no quote claim, nothing to send; the note says the next step
    const emptyQ = (await page.locator("[data-quote]").innerText()).trim();
    check("ADR-0393 kijelölés nélkül az ár-doboz üres (se ár, se árajánlat-mód)", emptyQ === "" && (await page.locator(".cit-book__ask").count()) === 0, emptyQ.slice(0, 120));
    check("ADR-0393 …a gomb nem küldhető", await cta.isDisabled());
    check("ADR-0393 …és a mondat a következő lépést mondja", /Jelöljön ki legalább egy szobát/.test(await note.innerText()), await note.innerText());

    // ⑥ ÁRAZOTT: semmi nem változik
    await setPick(priced.id, true);
    check("⑥ árazott szobánál megjelenik az összeg", /\d[\d\s]*Ft/.test(await page.locator("[data-quote]").innerText()));
    check("⑥ …a gomb foglalást ígér", /Foglalási kérés/.test(await cta.innerText()), await cta.innerText());
    check("⑥ …és az alatta álló mondat is", /véglegessé/.test(await note.innerText()));

    // ②③④ ÁRAZATLAN is kijelölve: ha BÁRMELYIK kijelölt szobára nincs ár, a gomb és az ígéret
    // EGYÜTT vált árajánlatra. 2026-10-17 óta (tulaj, „2: igen”) az árazott szoba tételes sora és
    // „Az ismert rész” összege látszik — de végösszegként SEMMI nem áll (az az ajánlaté).
    await setPick(unpriced.id, true);
    const quoteTxt = await page.locator("[data-quote]").innerText();
    check("② MAGYARÁZAT áll: az árazatlan szoba árát a szállásadó adja meg", /az árat a szállásadó adja meg/.test(quoteTxt), quoteTxt.slice(0, 400));
    check("② …és kimondja, hogy ez még nem kötelezettség", /nem vállal fizetési kötelezettséget/.test(quoteTxt));
    check("③ ⭐ a gomb árajánlatot kér", /Árajánlatot kérek/.test(await cta.innerText()), await cta.innerText());
    check("④ ⭐ a gomb alatti ígéret is árajánlatról szól", /árajánlattal válaszol/.test(await note.innerText()), await note.innerText());
    check("④ …és NEM ígér helyszíni fizetést egy ár nélküli kérésre", !/A fizetés a helyszínen/.test(await note.innerText()));

    // ⛔ A `note` elem KÖZÖS: a validációs hiba is ide íródik, és hiba nélkül az
    // alap-mondat áll vissza. Az első változatom emiatt árajánlat-módban is a FOGLALÁSI
    // ígéretet hozta vissza (a shot-booking-form őre mérte ki). Ezt VALÓDI úton tűzzük
    // ki: a létszám léptetése újrarajzoltatja az árat, tehát átmegy ugyanazon a
    // visszaállító ágon. ⚠️ Az első próbám SZINTETIKUS volt — kézzel vette le a
    // hiba-osztályt, de a visszaállítót sosem hívta meg —, és a saját hibáján bukott.
    // the guest stepper lives in STEP 2 on a phone — go there the guest's way first
    if (await page.locator(".cit-book__go").isVisible()) { await page.click(".cit-book__go"); await page.waitForTimeout(300); }
    await page.locator('.cit-book__step[data-step="-1"]').first().click();
    await page.waitForTimeout(700);
    check(
      "⭐⭐ újrarajzolás után is az ÁRAJÁNLAT-mondat áll, nem a foglalási ígéret",
      /árajánlattal válaszol/.test(await note.innerText()) && !/A fizetés a helyszínen/.test(await note.innerText()),
      await note.innerText(),
    );
    check(
      "⭐ …és a gomb is árajánlatnál marad",
      /Árajánlatot kérek/.test(await cta.innerText()),
      await cta.innerText(),
    );

    check(
      "⛔ végösszeg NINCS: csak „Az ismert rész”, az árazatlan szoba „egyedi ár”",
      /Az ismert rész/.test(quoteTxt) && /egyedi ár/.test(quoteTxt) && !/Összesen a szállásért/.test(quoteTxt),
      quoteTxt.slice(0, 400),
    );
    // no ask box (selftest) → measure nothing instead of waiting 30 s and crashing past the verdict
    const askBox = page.locator(".cit-book__ask").first();
    const box = (await askBox.count()) ? await askBox.boundingBox() : null;
    console.log(`     a magyarázó doboz: ${Math.round(box?.width ?? 0)}×${Math.round(box?.height ?? 0)} px`);
    await page.screenshot({ path: path.join(OUT, `ui-ask-${label}.png`) });

    // telefonon „Módosítom a napokat” → vissza az 1. lépésbe, ahol a szobalista áll
    if (await page.locator(".cit-book__edit").isVisible()) { await page.click(".cit-book__edit"); await page.waitForTimeout(300); }

    // ⛔ a „nincs kijelölt szoba” állapot SOHA nem árajánlat-mód: mindent levéve a mód is elmúlik
    await setPick(priced.id, false); await setPick(unpriced.id, false);
    check("⛔ minden jelölést levéve nincs árajánlat-mód", (await page.locator(".cit-book__ask").count()) === 0 && !/Árajánlatot kérek/.test(await cta.innerText()), await cta.innerText());
    const offNote = await note.innerText();
    check("⛔ …és az árajánlat-mondat sem ragad be", !/árajánlattal válaszol/.test(offNote), offNote);
    // MÉRT (2026-10-16, javítva ugyanaznap): az árajánlat-módból „mindent levéve” kilépve a
    // setAskMode(false) a semleges „Jelöljön ki…” mondatot a FOGLALÁSI ígérettel írta felül, egy
    // tiltott gomb alatt. Kijelölés nélkül a mondat a következő lépést mondja, nem ígér foglalást.
    check("⛔ …és a mondat a következő lépést mondja („Jelöljön ki…”), nem foglalást ígér", /Jelöljön ki legalább egy szobát/.test(offNote) && !/véglegessé/.test(offNote), offNote);

    // ⑥ vissza csak az árazottra — a jelzés ne ragadjon be
    await setPick(priced.id, true);
    check("⑥ visszaváltva a gomb ÚJRA foglalást ígér (nem ragad be)", /Foglalási kérés/.test(await cta.innerText()), await cta.innerText());
    check("⑥ …az alatta álló mondat is", /véglegessé/.test(await note.innerText()) && !/árajánlattal válaszol/.test(await note.innerText()), await note.innerText());
    check("⑥ …és az ár is visszajön", /\d[\d\s]*Ft/.test(await page.locator("[data-quote]").innerText()));
    check("nincs JS-hiba", jsErr.length === 0, jsErr);
    await ctx.close();
  }
  await browser.close();
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
if (SELFTEST) {
  if (fail === 0) {
    console.error("\n⛔ AZ ÖNTESZT NEM BUKOTT: a néma kiürítést az őr átengedte — vak.");
    process.exit(1);
  }
  console.log(`\n🔴 ÖNTESZT: ${fail} bukás a történeti viselkedésen — az őr lát.`);
  process.exit(1);
}
console.log(fail ? `\n⛔ QUOTE-REQUEST: ${fail} bukás` : "\n🟢 QUOTE-REQUEST: a szállított felület követi a jóváhagyott C tervet");
process.exit(fail ? 1 : 0);
