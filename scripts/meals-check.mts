// ŐR — az ellátás és a felárak (ADR-0378, jóváhagyott terv: assets/design-refs/tenant-admin/ellatas/, „B").
//
// Amit állít:
//   ① a szállásadó űrlapjának szabálya (src/tenant/meals.ts parseMealsForm): az összeg az
//      ajánlat-oldal szabálya, a bekapcsolt, de üres felár hiba, a gyerekár 0 lehet, de nem
//      több a felnőttnél, hibánál NINCS beállítás (semmi nem mentődik);
//   ② a szerver ár-sorai (mealLines): az alapár ellátása nem kerül pénzbe, fejenként a
//      felnőtt és a gyermek külön sor, szobánként egy sor, a kivett szobán semmi;
//   ③ a honlap: az „Ellátás” blokk soronként név + felár EGY sorban, a kivett szoba
//      megnevezve, és okot NEM állít (§B.17);
//   ④ ⭐⭐ a böngésző (cit-runtime.js) UGYANAZT számolja, mint a szerver — valódi widgeten,
//      több esetben. Ez a két implementáció közti szakadékot fogja meg.
//   ⑤ ⭐⭐ Elek 10-13 V-1 (BLOKKOLÓ): TELEFONON a 2. lépés összesítő-sávja is a szerver
//      összegét mutatja MINDEN változtatás (fő, gyermek, ellátás) után — mérve: az ellátás
//      választása után a sáv 68 000-en maradt, a beküldött kérés 90 500 lett.
//
//   npx tsx scripts/meals-check.mts
//   npx tsx scripts/meals-check.mts --selftest   (pirosra kell mennie: a böngésző a
//                                                  gyermeket felnőtt-áron számolja, ÉS a
//                                                  telefonos sáv nem követi az ár-dobozt)

process.env.CIT_SHOT = "1";

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { bookingSlot } from "../src/engine/templateKit.js";
import { moduleSections } from "../src/engine/moduleSections.js";
import type { SiteData } from "../src/engine/recipe.js";
import { mealLines, offeredPlans, parseMealsForm, readMeals, type MealPlanId, type MealsSetting } from "../src/tenant/meals.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELFTEST = process.argv.includes("--selftest");

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

const UNITS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Kerti stúdió", capacity: 3 },
  { id: "22222222-2222-2222-2222-222222222222", name: "Nádas apartman", capacity: 4 },
];
const plan = (on: boolean, price: string, per = "person", child = "", desc = "") => ({ on, price, per, child, desc });

/* ══ ① az űrlap szabálya ═══════════════════════════════════════════════════ */
console.log("\n① A szállásadó űrlapja:");
const good = parseMealsForm({
  base: "none",
  childAge: "12",
  plans: {
    none: plan(false, ""),
    bb: plan(true, "3 500", "person", "2 000", "Svédasztalos reggeli"),
    hb: plan(true, "9.000 Ft", "person", "0", "Reggeli és vacsora"),
    fb: plan(false, ""),
  },
  unitsOn: [UNITS[0]!.id],
  allUnits: UNITS.map((u) => u.id),
});
const S = good.setting as MealsSetting;
check("① a helyes űrlapból beállítás lesz", Boolean(S), JSON.stringify(good.errors));
check("① a „9.000 Ft” → 9000 (az ajánlat-oldal szabálya)", S?.plans.hb.price === 9000);
check("① a 0 gyerekár érvényes (ingyenes)", S?.plans.hb.child === 0);
check("① a kivett szoba az `off` listában", S?.off.length === 1 && S.off[0] === UNITS[1]!.id);
check("① a kínált ellátás: alap + a két bekapcsolt", JSON.stringify(S ? offeredPlans(S) : []) === '["none","bb","hb"]');
const bad = parseMealsForm({
  base: "none",
  childAge: "12",
  plans: { none: plan(false, ""), bb: plan(true, ""), hb: plan(true, "9,5"), fb: plan(true, "12000", "person", "15000") },
  unitsOn: [],
  allUnits: [],
});
check("① hibánál NINCS beállítás (semmi nem mentődik)", !bad.setting);
check("① a bekapcsolt, üres felár hiba", bad.errors["price:bb"] === "empty");
check("① a „9,5” nem egész forint → hiba", bad.errors["price:hb"] === "num");
check("① a gyerekár nem lehet több a felnőttnél", bad.errors["child:fb"] === "childOver");
const noAge = parseMealsForm({
  base: "bb",
  childAge: "",
  plans: { none: plan(false, ""), bb: plan(false, ""), hb: plan(true, "6000", "person", "3000"), fb: plan(false, "") },
  unitsOn: [],
  allUnits: [],
});
check("① gyerekár korhatár nélkül → hiba", noAge.errors.childAge === "ageMissing");
const below = parseMealsForm({
  base: "hb",
  childAge: "",
  plans: { none: plan(true, "1000"), bb: plan(true, "nem szám"), hb: plan(false, ""), fb: plan(false, "") },
  unitsOn: [],
  allUnits: [],
});
check("① az alapár alatti sorokat a szerver figyelmen kívül hagyja", Boolean(below.setting) && below.setting!.plans.bb.on === false);

/* ══ ② a szerver ár-sorai ══════════════════════════════════════════════════ */
console.log("\n② A szerver ár-sorai:");
const L = (p: MealPlanId | null, guests: number, children: number, unitId = UNITS[0]!.id, m: MealsSetting | null = S) =>
  mealLines(m, { unitId, plan: p, nights: 3, guests, children, lang: "hu" });
check("② az alapár ellátása nem kerül pénzbe", L("none", 2, 0).length === 0);
const hb = L("hb", 3, 1);
check("② félpanzió 2 felnőtt + 1 gyermek → két sor", hb.length === 2 && hb[0]!.guests === 2 && hb[1]!.guests === 1, JSON.stringify(hb));
check("② a gyermek sora a gyerekárral (itt 0)", hb[1]?.sum === 0 && /gyermek/.test(hb[1]?.label ?? ""));
check("② a felnőttek sora: 3 éj × 2 fő × 9 000", hb[0]?.sum === 54000);
check("② a kivett szobán nincs ellátás-sor", L("hb", 2, 0, UNITS[1]!.id).length === 0);
const room = readMeals({ ...S, plans: { ...S.plans, bb: { ...S.plans.bb, per: "room", price: 5000 } } });
const rl = L("bb", 4, 2, UNITS[0]!.id, room);
check("② szobánként egy sor, a létszám nem számít", rl.length === 1 && rl[0]!.sum === 15000, JSON.stringify(rl));
check("② az egész létszám sem lehet mind gyermek (legalább 1 felnőtt)", L("bb", 2, 5)[0]?.guests === 1);

/* ══ ③ + ④ a valódi motor és a valódi widget ══════════════════════════════ */
const iso = (o: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + o);
  return d.toISOString().slice(0, 10);
};

function siteData(m: MealsSetting): SiteData {
  return {
    name: "Myrna Haus",
    tagline: "",
    intro: "",
    highlights: [],
    photos: [],
    contact: { email: "info@example.com", phone: "+36 30 123 4567" },
    rooms: UNITS.map((u) => ({ name: u.name, unitId: u.id, capacity: `${u.capacity} fő`, price: "16 000 Ft / éj" })),
    meals: {
      base: m.base,
      plans: offeredPlans(m).map((id) => ({
        id,
        per: m.plans[id].per,
        ...(id !== m.base && m.plans[id].price !== null ? { price: m.plans[id].price! } : {}),
        ...(id !== m.base && m.plans[id].per === "person" && m.plans[id].child !== null ? { child: m.plans[id].child! } : {}),
        ...(m.plans[id].desc ? { desc: m.plans[id].desc } : {}),
      })),
      ...(m.childAge ? { childAge: m.childAge } : {}),
      off: m.off,
      includes: "Ágynemű, törülköző",
      currency: "HUF",
    },
    booking: { units: UNITS, minNights: 1, maxNights: 14, horizonMonths: 12, leadTimeDays: 0, responseNote: "", touristTaxPerPersonNight: 400 },
  } as unknown as SiteData;
}

console.log("\n③ A honlap „Ellátás” blokkja:");
{
  const html = moduleSections(siteData(S));
  const block = /data-cit-module="meals"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
  check("③ van „Ellátás” szekció", /<h2>Ellátás<\/h2>/.test(block));
  check(
    "③ név és felár EGY sorban (közös fejléc-sor)",
    /cit-meals__h"><span>Félpanzió<\/span><b>\+ 9 000 Ft \/ fő \/ éj<\/b>/.test(block),
    block.slice(0, 300),
  );
  check("③ a gyerekár kimondva, a 0 „ingyenes”", /Gyermeknek \(12 éves korig\): ingyenes/.test(block));
  check("③ a kivett szoba megnevezve", /Ellátás nem kérhető: Nádas apartman/.test(block));
  check("③ ⛔ okot nem állít (§B.17)", !/konyh/i.test(html));
  check("③ a widget megkapja az ellátás-adatot", /data-cit-meals="/.test(bookingSlot(siteData(S)) + moduleSections(siteData(S))));
}

console.log("\n④ ⭐⭐ A böngésző UGYANAZT számolja, mint a szerver:");
async function pageFor(m: MealsSetting): Promise<string> {
  const [moneyJs, seasonJs, runtimeJsRaw, modulesCss] = await Promise.all([
    readFile(path.join(ROOT, "assets/runtime/cit-money.js"), "utf8"),
    readFile(path.join(ROOT, "assets/runtime/cit-season.cjs"), "utf8"),
    readFile(path.join(ROOT, "assets/runtime/cit-runtime.js"), "utf8"),
    readFile(path.join(ROOT, "assets/runtime/cit-modules.css"), "utf8"),
  ]);
  // ⛔ ÖNTESZT: a böngésző a gyermeket felnőtt-áron számolja — az őrnek pirosra kell mennie.
  // ⛔ ÖNTESZT ⑤: a sáv nem követi az ár-dobozt (a V-1 előtti állapot).
  const runtimeJs = SELFTEST
    ? runtimeJsRaw
        .replace("var k = kidPriced(p) ? Math.min(kids, guests - 1) : 0;", "var k = 0;")
        .replace("if (quoteBox) new MutationObserver(syncSteps)", "if (false) new MutationObserver(syncSteps)")
    : runtimeJsRaw;
  const d = siteData(m);
  const stub =
    `<script>(function(){var real=window.fetch;window.fetch=function(u,o){var s=String(u);` +
    `if(s.indexOf("/api/foglaltsag/")>=0){return Promise.resolve({ok:true,json:function(){` +
    `return Promise.resolve(${JSON.stringify({
      blocked: [],
      pricing: { currency: "HUF", unit: "per_night", rows: [{ base: true, amount: 16000, label: "Alapár" }] },
    })});}});}` +
    `return real.apply(this,arguments);};})();</script>`;
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>:root{--cit-bg:#fff;--cit-ink:#16283f;--cit-muted:#5b6b7f;--cit-line:#dbe3ec;--cit-accent:#0e7f8c;--cit-radius:14px}` +
    `body{font-family:system-ui,sans-serif;margin:0}</style><style>${modulesCss}</style></head><body>` +
    stub +
    bookingSlot(d) +
    moduleSections(d) +
    `<script>${moneyJs}</script><script>${seasonJs}</script><script>${runtimeJs}</script></body></html>`
  );
}

async function setRange(page: Page, from: string, to: string): Promise<void> {
  await page.evaluate(
    ([a, b]) => {
      const f = document.querySelector<HTMLInputElement>("#cit-from")!;
      const t = document.querySelector<HTMLInputElement>("#cit-to")!;
      f.value = a!;
      f.dispatchEvent(new Event("change", { bubbles: true }));
      t.value = b!;
      t.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [from, to],
  );
  await page.waitForTimeout(200);
}
async function clickN(page: Page, sel: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await page.click(sel);
}
const totalOf = async (page: Page): Promise<number> =>
  Number(((await page.locator(".cit-book__qtotal b").textContent()) ?? "").replace(/\D/g, ""));

const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const dir = await mkdtemp(path.join(tmpdir(), "meals-check-"));
  const file = path.join(dir, "site.html");
  await writeFile(file, await pageFor(S), "utf8");
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(500);
  await setRange(page, iso(20), iso(23)); // 3 nights

  const cases: { name: string; plan: MealPlanId; guests: number; kids: number }[] = [
    { name: "csak szállás, 2 fő", plan: "none", guests: 2, kids: 0 },
    { name: "reggeli, 2 fő", plan: "bb", guests: 2, kids: 0 },
    { name: "félpanzió, 3 fő, ebből 1 gyermek (ingyenes)", plan: "hb", guests: 3, kids: 1 },
    { name: "reggeli, 3 fő, ebből 2 gyermek", plan: "bb", guests: 3, kids: 2 },
  ];
  for (const c of cases) {
    // reset the steppers: guests 2 → target, kids 0 → target
    const g = Number(await page.locator("[data-guests]").textContent());
    if (g > c.guests) await clickN(page, '[data-step="-1"]', g - c.guests);
    if (g < c.guests) await clickN(page, '[data-step="1"]', c.guests - g);
    await page.selectOption("#cit-meal", c.plan);
    const k = Number(await page.locator("[data-kids]").textContent());
    if (c.kids && (await page.locator("[data-cit-kidsf]").isHidden())) {
      check(`④ ${c.name}: az „Ebből gyermek” látszik`, false);
      continue;
    }
    if (k > c.kids) await clickN(page, '[data-kstep="-1"]', k - c.kids);
    if (k < c.kids) await clickN(page, '[data-kstep="1"]', c.kids - k);
    const server = 3 * 16000 + L(c.plan, c.guests, c.kids).reduce((t, l) => t + l.sum, 0);
    const shown = await totalOf(page);
    check(`④ ${c.name}: a böngésző ${shown} Ft, a szerver ${server} Ft`, shown === server);
  }
  const q = (await page.locator("[data-quote]").textContent()) ?? "";
  check("④ az ellátás alapja kimondva a beadás előtt", /Az ellátás felára személyenként számít/.test(q), q.slice(0, 200));

  await page.selectOption("#cit-unit", UNITS[1]!.id);
  await page.waitForTimeout(250);
  check("④ a kivett szobánál nincs választó, a mondat ott áll", await page.locator("#cit-meal").isHidden() &&
    /Ehhez a szálláshoz nem kérhető ellátás\./.test((await page.locator("[data-cit-mealf]").textContent()) ?? ""));
  check("④ JS-hiba 0", errs.length === 0, errs.join(" | "));

  /* ⑤ V-1: the phone's step-2 summary bar. The guest sets the head count, the children and
   * the meal IN THAT ORDER (the meal last — that is what the bar missed), and after EVERY
   * change the bar's total equals the server's; the desktop box is asserted alongside. */
  console.log("\n⑤ ⭐⭐ Telefonon a 2. lépés összesítője = a szerver összege (V-1):");
  const sumOf = async (p: Page): Promise<number> =>
    Number(((await p.locator(".cit-book__sumtotal .cit-amt").textContent()) ?? "").replace(/\D/g, ""));
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const perrs: string[] = [];
  phone.on("pageerror", (e) => perrs.push(e.message));
  await phone.goto(pathToFileURL(file).href);
  await phone.waitForTimeout(500);
  await setRange(phone, iso(20), iso(23));
  await phone.click(".cit-book__go");
  await phone.waitForTimeout(150);
  check("⑤ a 2. lépés nyitva (a sáv látszik)", await phone.locator(".cit-book__sum").isVisible());
  const steps: { name: string; act: () => Promise<void>; plan: MealPlanId; guests: number; kids: number }[] = [
    { name: "2 fő, csak szállás", act: async () => {}, plan: "none", guests: 2, kids: 0 },
    { name: "+1 fő", act: () => phone.click('[data-step="1"]'), plan: "none", guests: 3, kids: 0 },
    { name: "+1 gyermek", act: () => phone.click('[data-kstep="1"]'), plan: "none", guests: 3, kids: 1 },
    { name: "reggeli választva", act: async () => { await phone.selectOption("#cit-meal", "bb"); }, plan: "bb", guests: 3, kids: 1 },
    { name: "félpanzió választva", act: async () => { await phone.selectOption("#cit-meal", "hb"); }, plan: "hb", guests: 3, kids: 1 },
    { name: "−1 gyermek", act: () => phone.click('[data-kstep="-1"]'), plan: "hb", guests: 3, kids: 0 },
    { name: "−1 fő", act: () => phone.click('[data-step="-1"]'), plan: "hb", guests: 2, kids: 0 },
  ];
  for (const st of steps) {
    await st.act();
    await phone.waitForTimeout(80);
    const server = 3 * 16000 + L(st.plan, st.guests, st.kids).reduce((t, l) => t + l.sum, 0);
    const bar = await sumOf(phone);
    const box = await totalOf(phone);
    check(`⑤ ${st.name}: a sáv ${bar} Ft, az ár-doboz ${box} Ft, a szerver ${server} Ft`, bar === server && box === server);
  }
  /* ⑥ Elek 10-13 T-2 · T-3 · T-6 on the same phone page: the age limit reads like the owner's
   * rule, the counted child pays no tourist tax (Htv. 31. § a)), the plan list names the child price. */
  console.log("\n⑥ Gyerek-korhatár, IFA-mentesség, gyerekár a listában (T-2 · T-3 · T-6):");
  const kidAge = ((await phone.locator("[data-cit-kidage]").textContent()) ?? "").trim();
  check(`⑥ T-2 a felirat az admin szabálya: „(12 éves korig)” („${kidAge}”)`, kidAge === "(12 éves korig)");
  await phone.selectOption("#cit-meal", "bb");
  const descBb = ((await phone.locator("[data-cit-mdesc]").textContent()) ?? "").trim();
  await phone.selectOption("#cit-meal", "hb");
  const descHb = ((await phone.locator("[data-cit-mdesc]").textContent()) ?? "").trim();
  check("⑥ T-6 a választó alatt a választott ellátás gyerekára, az oldal szavaival",
    /Gyermeknek \(12 éves korig\): 2 000 Ft \/ fő \/ éj$/.test(descBb) && /Gyermeknek \(12 éves korig\): ingyenes$/.test(descHb), [descBb, descHb]);
  await phone.click('[data-step="1"]'); // 3 guests
  await phone.click('[data-kstep="1"]'); // 1 child
  await phone.waitForTimeout(80);
  const tax = await phone.locator(".cit-book__sumtax").innerText();
  check("⑥ T-3 a gyermek IFA-mentes: 400 × 2 fő × 3 éj = 2 400 Ft (nem 3 600)", /× 2 fő × 3 éj = 2 400 Ft/.test(tax), tax);
  check("⑥ T-3 a mondat kimondja a szabályt és a 13–17 éveseket", /18 év alatti vendég mentes/.test(tax) && /13–17 évesek/.test(tax), tax);
  check("⑤ JS-hiba 0", perrs.length === 0, perrs.join(" | "));
  await phone.close();
} finally {
  await browser.close();
}

if (SELFTEST) {
  if (failures.some((f) => f.startsWith("④")) && failures.some((f) => f.startsWith("⑤") && /reggeli választva: a sáv 48000 Ft/.test(f))) {
    console.log("\n✅ meals-check ÖNTESZT: a szabotázst (gyermek felnőtt-áron · a sáv nem követ) a ④ és a ⑤ elkapta.");
    process.exit(0);
  }
  console.log("\n⛔ meals-check ÖNTESZT: a szabotázs ÁTMENT — a ④ vagy a ⑤ dísz.");
  process.exit(1);
}
if (failures.length) {
  console.log(`\n⛔ meals-check: ${failures.length} állítás bukott.`);
  process.exit(1);
}
console.log("\n✅ meals-check: az ellátás szabálya, ár-sorai, blokkja és a böngésző-szerver egyezés rendben.");
