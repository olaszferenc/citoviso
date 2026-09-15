// A KÖZÖS park hiányzó ELŐFIZETÉS-sorának pótlása — DEV-SESSION eszköz.
//
// ⛔ A MÉRT LELET (2026-09-14, az ADR-0153 gépies-alak őr építése közben). A park
// FÉLIG KIPURGÁLT állapotban élt: `tenant` 1 · `site` 1 (live) · `module_entitlement`
// 12 AKTÍV — de `order_intent` 0 · `payment` 0 · `subscription` 0. Vagyis tizenkét
// kifizetett jogosultság nulla vásárlási előzménnyel.
//
// Miért számít ez egy ŐRNEK: a bérlői Modulok fül Előfizetés kártyája `sub === null`
// esetén MEG SEM JELENIK. Egy körbejáró őr ilyenkor „11/11 lap megmérve"-t ír, és
// ZÖLDEN megy át azon a képernyőn, amit soha nem is látott. Pontosan ez történt: az
// első lefedettség-tanúm a „Fordulónap" szót a SÚGÓ fül KB-cikkéből olvasta ki
// (feedback_guard_greenly_defended_the_bug). A park tehát nem kényelmi kérdés — a
// hiánya NÉMA vakfoltot csinál a mérésből.
//
// ⛔ MIÉRT NEM NYERS `INSERT` A SUBSCRIPTION-TÁBLÁBA. Egy kézzel írt sor olyan
// állapotot is előállíthat, amit a termék SOHA nem tud létrehozni — és akkor az őr
// egy fikciót mér. Ezért a VALÓDI lánc épül fel, ugyanabban a sorrendben, ahogy az
// FK-005a vásárol:
//
//     order_intent (kind='initial', a prospecten át, tenant_id NULL)
//       → kifizetett payment
//         → ensureSubscriptionForOrder()     ← a fordulónapot A TERMÉK dönti el
//
// A horgony így nem az én dátum-írásom, hanem az `ensureSubscriptionForOrder`
// szabálya a fizetés időpontjából (ADR-0144 ①: egy vásárlási úton EGY fordulónap,
// és annak EGY definíciója van).
//
// ⚠️ A PARK KÖZÖS (~16 szál). Ezért: dry-run alapból, idempotens (meglévő sorra nem
// nyúl), és kiírja a visszavonáshoz szükséges azonosítókat.
//
//   npx tsx scripts/seed-park-subscription.mts            (dry-run: mit tenne)
//   npx tsx scripts/seed-park-subscription.mts --go       (ír)
//   npx tsx scripts/seed-park-subscription.mts --go --annual
process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { db } from "../src/db/client.js";
import { ensureSubscriptionForOrder } from "../src/payment/subscription.js";
import { getBaseMonthly, loadPricing } from "../src/pricing.js";

const GO = process.argv.includes("--go");
const ANNUAL = process.argv.includes("--annual");
const period: "monthly" | "annual" = ANNUAL ? "annual" : "monthly";

const tenant = await db
  .selectFrom("tenant")
  .select(["id", "lead_id", "created_at"])
  .orderBy("created_at", "asc")
  .executeTakeFirst();
if (!tenant) {
  // ⛔ Nem néma kilépés: ha nincs bérlő, a parkot előbb a vásárlás-körből kell
  // felépíteni — ez az eszköz nem tud (és nem is akar) bérlőt gyártani.
  console.error("⛔ nincs tenant a parkban — előbb a vásárlás-kör építse fel, ez az eszköz csak az előfizetést pótolja");
  await db.destroy();
  process.exit(1);
}

const existing = await db
  .selectFrom("subscription")
  .select(["id", "billing_period", "anchor_date", "current_period_end", "status"])
  .where("tenant_id", "=", tenant.id)
  .executeTakeFirst();
if (existing) {
  console.log("🟢 már van előfizetés-sor — nincs teendő:", existing);
  await db.destroy();
  process.exit(0);
}

const prospect = tenant.lead_id
  ? await db.selectFrom("prospect").select(["id"]).where("lead_id", "=", tenant.lead_id).executeTakeFirst()
  : undefined;
if (!prospect) {
  console.error(
    "⛔ nincs prospect a bérlő leadjéhez — az 'initial' út nem járható, és NEM kerülöm meg " +
      "kézi sorral (az olyan állapotot adna, amit a termék nem tud előállítani)",
  );
  await db.destroy();
  process.exit(1);
}

const modules = (
  await db
    .selectFrom("module_entitlement")
    .select(["module"])
    .where("tenant_id", "=", tenant.id)
    .where("active", "=", true)
    .execute()
).map((r) => r.module);

await loadPricing();
const price = getBaseMonthly();
// A horgony a bérlő SZÜLETÉSE: ez az a nap, amikor a vásárlás ténylegesen megtörtént
// (a payment-sorokat utólag purge-ölte valaki, a tenant és a jogosultságok maradtak).
// ⛔ Nem `new Date()`: egy „mai" horgony olyan fordulónapot adna, ami sosem létezett,
// és a park óráját minden futtatás elcsúsztatná.
const paidAt = new Date(tenant.created_at as unknown as string);

console.log(
  JSON.stringify(
    {
      tenant: tenant.id,
      prospect: prospect.id,
      aktivModulok: modules.length,
      alapdij: price,
      utem: period,
      horgony: paidAt.toISOString().slice(0, 10),
      mod: GO ? "ÍRÁS" : "DRY-RUN",
    },
    null,
    1,
  ),
);
if (!GO) {
  console.log("\nDRY-RUN — semmit nem írtam. Írás: --go");
  await db.destroy();
  process.exit(0);
}

// kind='initial' → tenant_id KÖTELEZŐEN null (order_intent_upsell_tenant_chk): a
// hideg linkről indult vásárlás megelőzi a bérlőt, és a lánc prospect → lead → tenant
// úton talál vissza. Pont ahogy az FK-005a fut.
const oi = await db
  .insertInto("order_intent")
  .values({
    prospect_id: prospect.id,
    kind: "initial",
    price,
    billing_period: period,
    status: "submitted",
    submitted_at: paidAt,
    created_at: paidAt,
    modules: JSON.stringify(modules),
  } as never)
  .returning("id")
  .executeTakeFirstOrThrow();

// ⛔⛔ `gateway_ref` NÉLKÜL — és ez a sor egy VALÓDI kárt zár le, nem óvatosság.
// Az első változatom kitalált egy `park-seed-<id>` átjáró-hivatkozást. A `/pay/done`
// viszont a kapott `paymentId`-vel AZONNAL webhookot hív (`console/server.ts:2871`),
// az átjáró a kitalált azonosítóra HTML-t adott JSON helyett, és a fizetés-visszatérő
// lap elszállt. Következmény MÉRVE: egy MÁSIK szál frissen landolt `consent-style-check`
// őre pirosra ment — az őr a park EGYETLEN kifizetett paymentjét választja, és az az
// enyém volt. A közös parkba írt „ártalmatlan" fixture így három szál landolását fogta meg.
//
// ⚠️ A tanulság saját magamra is áll: a fenti fejléc arról szól, hogy kézzel írt sor ne
// állítson elő olyan állapotot, amit a termék soha — és a `gateway_ref` pont ilyen volt.
// Az `ensureSubscriptionForOrder` csak a `status='paid'` + `paid_at` párost olvassa; az
// átjáró-hivatkozás ennek a láncnak nem része. Amit nem tudunk igazul kitölteni, azt
// üresen hagyjuk: egy kifizetett sor átjáró-hivatkozás nélkül pontosan azt mondja, ami
// történt (tudjuk, hogy fizetve lett, az átjáró-fogantyú nincs meg) — és a `/pay/done`
// oda nélküle el sem jut.
await db
  .insertInto("payment")
  .values({
    order_intent_id: oi.id,
    amount: price,
    currency: "HUF",
    period,
    gateway: "mock", // NOT NULL oszlop
    status: "paid",
    created_at: paidAt,
    paid_at: paidAt,
  } as never)
  .execute();

await ensureSubscriptionForOrder(oi.id);

const made = await db
  .selectFrom("subscription")
  .select(["id", "billing_period", "anchor_date", "current_period_start", "current_period_end", "status"])
  .where("tenant_id", "=", tenant.id)
  .executeTakeFirst();
if (!made) {
  // ⛔ A „lefutott" nem „létrejött": ha a termék útja nem adott sort, azt KIMONDJUK,
  // nem hagyjuk zöldnek (a lánc valamelyik előfeltétele hiányzik).
  console.error("⛔ az ensureSubscriptionForOrder NEM hozott létre sort — a lánc valamelyik feltétele hiányzik");
  await db.destroy();
  process.exit(1);
}
// ⛔ A KÖZÖS PARKBA ÍRÁS UTÁN NEM ELÉG A SAJÁT SOROMAT MEGNÉZNI. A `gateway_ref`-es
// első változatom épp azzal tört el egy másik szál őrét, hogy az a park EGYETLEN
// kifizetett paymentjét választotta. Ezért a futás kiírja, mit LÁT MOST az a lekérdezés.
const refPicked = await db
  .selectFrom("payment")
  .select(["gateway_ref"])
  .where("gateway_ref", "is not", null)
  .where("status", "=", "paid")
  .executeTakeFirst();
console.log("\n✅ LÉTREJÖTT:", made);
console.log(
  `   a „kifizetett, átjáró-hivatkozással" lekérdezés (ezt választják az őrök) most ezt adja: ` +
    `${refPicked?.gateway_ref ?? "NINCS ilyen sor — a vetett payment nem nyúl bele"}`,
);
console.log(`   visszavonás: order_intent ${oi.id} + a payment-je + a subscription ${made.id} törlése`);
await db.destroy();
