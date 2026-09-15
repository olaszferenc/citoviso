// CHARGE-RETRY őr — a kézi terhelés-újrapróba korlátai a WHERE-ben ülnek, nem a hívóban.
//
//   npx tsx scripts/charge-retry-check.mts [--self-test]
//
// Kontraktus: `assets/design-refs/console/freeze-state-v2/` ⑤.
//
// ⚠️ EZ PÉNZT MOZGATÓ ÚT. Amit mérni kell, az nem a boldog ág (az egy sor), hanem
// a FÉKEK: dupla terhelés, püfölhető gomb, végtelen sorozat, és hogy a szerver ne
// higgyen a felületnek. A gomb megléte nem bizonyíték
// (feedback_badge_answered_one_of_nine_gates).
//
// ⛔ VALÓDI PÉNZ NEM MOZDUL: a terhelés-függvény INJEKTÁLT (`deps.charge`), tehát
// az átjáró meg sem hívódik. Ugyanaz a minta, mint az ADR-0118 újraindítójánál.
//
// ⚠️ VALÓDI DB KELL hozzá, mert a mért szabály MAGA egy SQL WHERE. Egy
// TypeScript-ben újraírt „ugyanaz a logika" nem a szabályt mérné, hanem a
// másolatát (feedback_guard_must_not_borrow_its_subject). Ezért saját, eldobható
// fixtúrát vet EGYEDI névvel, és `finally`-ben mindent visszatakarít — a közös
// dev-DB-t nem koszolja, és párhuzamos szálakkal sem ütközik
// (reference_shared_sites_fixture_race).
//
// --self-test a korlátokat kikapcsolva futtatja ugyanazt a forgatókönyvet (a
// claim-feltételek nélküli, „naiv" változatot), és megköveteli, hogy a mérés
// PIROSRA menjen — különben az őr nem a fékeket méri, csak jelen van.

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import {
  MAX_MIT_ATTEMPTS_PER_ORDER,
  RETRY_COOLDOWN_MINUTES,
  retryRenewalCharge,
  type Charger,
  type RetryResult,
} from "../src/payment/retryCharge.js";

const selfTest = process.argv.includes("--self-test");

/**
 * A FÉKEK NÉLKÜLI, „naiv" változat — CSAK az öntesztnek.
 *
 * Pontosan az a kód, amit egy figyelmetlen megvalósítás írna: megnézi, hogy van-e
 * tartozás és kártya, aztán terhel. Nincs birtokbavétel, nincs várakozás, nincs
 * sorozat-korlát. Az őrnek EZT kell pirosra tennie — különben nem a fékeket méri,
 * csak jelen van (feedback_fixture_must_prove_its_own_path).
 */
async function naiveRetry(
  tenant: string,
  deps: { readonly charge?: Charger } = {},
): Promise<RetryResult> {
  const charge = deps.charge ?? (async () => "failed" as const);
  const sub = await db
    .selectFrom("subscription")
    .select(["status", "payment_method as pm", "recurrence_token as tok", "recurrence_trace_id as trace", "current_period_end as pe"])
    .where("tenant_id", "=", tenant)
    .executeTakeFirst();
  if (!sub) return { ok: false, refusal: "nincs_elofizetes" };
  if (sub.status !== "frozen" && sub.status !== "past_due") return { ok: false, refusal: "nincs_tartozas" };
  if (sub.pm !== "token" || !sub.tok) return { ok: false, refusal: "nincs_kartya" };
  const order = await db
    .selectFrom("order_intent")
    .select("id")
    .where("kind", "=", "renewal")
    .where("tenant_id", "=", tenant)
    .where("renewal_period_start", "=", sub.pe)
    .executeTakeFirst();
  if (!order) return { ok: false, refusal: "nincs_rendezendo_order" };
  const outcome = await charge(order.id as string, sub.tok as string, (sub.trace as string) ?? null);
  return { ok: true, outcome };
}

/** A MÉRT függvény: élesben a valódi, öntesztben a fékek nélküli. */
const attempt = selfTest ? naiveRetry : retryRenewalCharge;

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ⛔ ${msg}`);
};
const pass = (msg: string) => console.log(`  ✔ ${msg}`);

/** Az injektált terhelés: NEM hív átjárót. Számolja a hívásokat, és „failed"-et ad —
 *  mert a MÉRENDŐ eset épp az, amikor a bank újra elutasít. */
let chargeCalls = 0;
const fakeCharge: Charger = async (orderId) => {
  chargeCalls++;
  // A valódi `chargeRenewalWithToken` minden kísérletre ÍR egy MIT-payment sort —
  // ezen a soron áll vagy bukik a sorozat-korlát, tehát a fixtúrának ugyanezt kell
  // tennie, különben a korlát sosem érne hatályba, és az őr zölden védené a hibát.
  await db
    .insertInto("payment")
    .values({
      order_intent_id: orderId,
      amount: 10_270,
      currency: "HUF",
      period: "monthly",
      gateway: "teszt",
      status: "failed",
    })
    .execute();
  return "failed";
};

const STAMP = process.env.CHARGE_RETRY_STAMP ?? String(process.hrtime.bigint());
const SLUG = `retryguard-${STAMP}`;
let tenantId = "";
let leadId = "";
let prospectId = "";
let orderId = "";

async function sow(): Promise<void> {
  // ⚠️ A fixtúra a TERMÉK sémájából épül, nem emlékezetből: a `lead` egy
  // scrape_run-hoz kötött, a `tenant` pedig egy leadhez. Egy találgatott alak itt
  // futásidőben hal meg (`scripts/` nincs típus-ellenőrizve —
  // reference_scripts_are_not_typechecked), ezért a meglévő futást használjuk fel.
  const run = await db.selectFrom("scrape_run").select("id").executeTakeFirst();
  if (!run) throw new Error("nincs egyetlen scrape_run sem — a fixtúra nem vethető");

  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id as string, name: `Őr-fixtúra ${STAMP}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leadId = lead.id as string;

  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: leadId, display_name: `Őr-fixtúra ${STAMP}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = tenant.id as string;
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id as string, token: SLUG })
    .returning("id")
    .executeTakeFirstOrThrow();
  prospectId = prospect.id as string;

  const periodEnd = new Date(Date.now() - 14 * 86_400_000);
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospectId,
      tenant_id: tenantId,
      kind: "renewal",
      price: 10_270,
      billing_period: "monthly",
      modules: JSON.stringify([]) as never,
      renewal_period_start: periodEnd,
      renewal_period_end: new Date(Date.now() + 16 * 86_400_000),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  orderId = order.id as string;

  await db
    .insertInto("subscription")
    .values({
      tenant_id: tenantId,
      status: "frozen",
      current_period_start: new Date(periodEnd.getTime() - 30 * 86_400_000),
      current_period_end: periodEnd,
      anchor_date: periodEnd,
      billing_period: "monthly",
      payment_method: "token",
      recurrence_token: `tok-${STAMP}`,
      frozen_at: new Date(Date.now() - 4 * 86_400_000),
    } as never)
    .execute();
}

async function reap(): Promise<void> {
  if (!tenantId) return;
  await db.deleteFrom("payment").where("order_intent_id", "=", orderId).execute().catch(() => {});
  await db.deleteFrom("subscription").where("tenant_id", "=", tenantId).execute().catch(() => {});
  await db.deleteFrom("order_intent").where("tenant_id", "=", tenantId).execute().catch(() => {});
  await db.deleteFrom("prospect").where("id", "=", prospectId).execute().catch(() => {});
  await db.deleteFrom("tenant").where("id", "=", tenantId).execute().catch(() => {});
  await db.deleteFrom("lead").where("id", "=", leadId).execute().catch(() => {});
}

/** A várakozási időt „visszaforgatjuk", hogy a türelmi idő ne tegye mérhetetlenné
 *  a sorozat-korlátot. Ez a TESZT gyorsítása, nem a szabály megkerülése: a
 *  várakozást külön, saját esetben mérjük. */
async function forgetCooldown(): Promise<void> {
  await db
    .updateTable("order_intent")
    .set({ manual_charge_at: sql<Date>`now() - interval '1 day'` })
    .where("id", "=", orderId)
    .execute();
}

async function main(): Promise<void> {
  console.log(
    selfTest
      ? "charge-retry-check --self-test: a fékek nélküli, naiv futás — a mérésnek PIROSRA kell mennie"
      : "charge-retry-check: a kézi terhelés-újrapróba fékei",
  );
  await sow();

  // ── ① Az első próba elindul, és PONTOSAN EGY terhelést indít ──────────────
  chargeCalls = 0;
  const first = await attempt(tenantId, { charge: fakeCharge });
  if (!first.ok) fail(`az első próbát elutasította: ${first.refusal}`);
  else if (chargeCalls !== 1) fail(`az első próba ${chargeCalls} terhelést indított (1 kellene)`);
  else pass("az első próba elindul, és pontosan egy terhelést indít");

  // ── ② VÁRAKOZÁS: a gomb nem püfölhető ─────────────────────────────────────
  chargeCalls = 0;
  const immediate = await attempt(tenantId, { charge: fakeCharge });
  if (immediate.ok) {
    fail(
      `azonnali második kattintás is terhelést indított (${chargeCalls}×) — a ${RETRY_COOLDOWN_MINUTES} perces ` +
        `várakozás nem érvényesül, a gomb püfölhető`,
    );
  } else if (immediate.refusal !== "varakozas") {
    fail(`azonnali második kattintás elutasítva, de rossz okkal: ${immediate.refusal}`);
  } else if (chargeCalls !== 0) {
    fail(`elutasítás mellett MÉGIS indult ${chargeCalls} terhelés`);
  } else {
    pass("azonnali második kattintás: elutasítva, terhelés nem indult");
  }

  // ── ③ EGYIDEJŰSÉG: két párhuzamos kattintásból pontosan egy nyer ──────────
  // Ez a legveszélyesebb eset: két gyors kattintás (vagy egy dupla submit) két
  // valódi terhelést indítana, ha a korlát a hívóban ülne.
  await forgetCooldown();
  chargeCalls = 0;
  const both = await Promise.all([
    attempt(tenantId, { charge: fakeCharge }),
    attempt(tenantId, { charge: fakeCharge }),
  ]);
  const wonCount = both.filter((r) => r.ok).length;
  if (chargeCalls !== 1 || wonCount !== 1) {
    fail(
      `két PÁRHUZAMOS kattintásból ${wonCount} nyert és ${chargeCalls} terhelés indult — ` +
        `dupla terhelés csúszhat át (a birtokbavételnek atominak kell lennie)`,
    );
  } else {
    pass("két párhuzamos kattintásból pontosan egy nyer, egy terhelés indul");
  }

  // ── ④ SOROZAT-KORLÁT: a végtelen újrapróbálás megáll ──────────────────────
  // A kártyatársaságok korlátozzák egy elutasított MIT újrapróbálását; a korlát
  // túllépése a kereskedőt bünteti.
  let extra = 0;
  for (let i = 0; i < MAX_MIT_ATTEMPTS_PER_ORDER + 3; i++) {
    await forgetCooldown();
    const r = await attempt(tenantId, { charge: fakeCharge });
    if (r.ok) extra++;
    else if (r.refusal === "sorozat_vege") break;
  }
  const used = Number(
    (
      await db
        .selectFrom("payment")
        .select(sql<string>`count(*)`.as("n"))
        .where("order_intent_id", "=", orderId)
        .where("pay_url", "is", null)
        .executeTakeFirst()
    )?.n ?? 0,
  );
  if (used > MAX_MIT_ATTEMPTS_PER_ORDER) {
    fail(
      `${used} MIT-terhelés ment el egy orderre, a korlát ${MAX_MIT_ATTEMPTS_PER_ORDER} — ` +
        `a sorozat nem áll meg (${extra} extra próba ment át)`,
    );
  } else {
    pass(`a sorozat megáll: ${used} MIT-terhelés (korlát ${MAX_MIT_ATTEMPTS_PER_ORDER})`);
  }

  // ── ⑤ A korlát kimerülése UTÁN is más az üzenet, mint a várakozásé ────────
  await forgetCooldown();
  const after = await attempt(tenantId, { charge: fakeCharge });
  if (after.ok) fail("a korlát kimerülése után is elindult egy terhelés");
  else if (after.refusal !== "sorozat_vege") {
    fail(`a korlát kimerülése után rossz ok: ${after.refusal} (sorozat_vege kellene)`);
  } else pass("a kimerült sorozat SAJÁT okot ad, nem összevont „nem sikerült”-et");

  // ── ⑥ A SZERVER nem hisz a felületnek: nem-tartozó fiókot elutasít ────────
  await db.updateTable("subscription").set({ status: "active" }).where("tenant_id", "=", tenantId).execute();
  await forgetCooldown();
  chargeCalls = 0;
  const active = await attempt(tenantId, { charge: fakeCharge });
  if (active.ok || chargeCalls > 0) {
    fail("AKTÍV (nem tartozó) előfizetésen is indult terhelés — a szerver a gombnak hisz");
  } else if (active.refusal !== "nincs_tartozas") {
    fail(`aktív előfizetés elutasítva, de rossz okkal: ${active.refusal}`);
  } else pass("aktív előfizetésen nem indul terhelés");

  // ── ⑦ …és tárolt kártya nélkül sem ────────────────────────────────────────
  await db
    .updateTable("subscription")
    .set({ status: "frozen", recurrence_token: null })
    .where("tenant_id", "=", tenantId)
    .execute();
  await forgetCooldown();
  chargeCalls = 0;
  const noCard = await attempt(tenantId, { charge: fakeCharge });
  if (noCard.ok || chargeCalls > 0) fail("tárolt kártya NÉLKÜL is indult terhelés");
  else if (noCard.refusal !== "nincs_kartya") fail(`rossz ok kártya nélkül: ${noCard.refusal}`);
  else pass("tárolt kártya nélkül nem indul terhelés");
}

try {
  await main();
} finally {
  await reap();
  await db.destroy().catch(() => {});
}

if (failures) {
  console.error(`\ncharge-retry-check: ${failures} sértés.`);
  if (selfTest) {
    console.log("✅ --self-test: az őr KÉPES pirosra menni (a fenti sértéseket VÁRTUK).");
    process.exit(0);
  }
  process.exit(1);
}
if (selfTest) {
  console.error(
    "\n⛔ --self-test: a fékek nélkül futtatva sem találtam sértést — az őr nem a fékeket méri.",
  );
  process.exit(1);
}
console.log("✅ charge-retry-check: a fékek tartanak (várakozás, egyidejűség, sorozat, előfeltételek).");
