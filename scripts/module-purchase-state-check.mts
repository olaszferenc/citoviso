// ŐR — „a kifizetett modul MONDJA KI, hogy ki van fizetve" (Elek FK-005b, 2026-09-11).
//
// A MÉRT HIBA: a tenant kifizetett 14 900 Ft-ot a Többnyelvű honlap modulért, és a
// Modulok oldal fizetés ELŐTT és UTÁN mindössze három keskeny sávban tért el (egy
// jelvény-szám és a három nyelv pipájának kiürülése). Se „kifizetve", se összeg, se
// hivatkozás — a „Fizetés és generálás (14 900 Ft)" gomb pedig VÁLTOZATLANUL AKTÍV
// maradt, vagyis egy kattintás egy MÁSODIK megrendelést indított volna. Az egyetlen
// zöld sor a kártyán („A fordítás készül") egy KORÁBBI futás ottfelejtett sorából
// jött, tehát már a fizetés ELŐTT is ott volt: nulla információt hordozott.
//
// Amit ez az őr mér — mindig a fizetés ELŐTTI és UTÁNI állapot ÖSSZEHASONLÍTÁSÁVAL,
// mert pont az összehasonlítás hiányzott:
//   ① fizetés előtt: él a fizetés-gomb, nincs „Kifizetve"
//   ② kiállított, de MÉG NEM fizetett megrendelés ettől semmit nem változtat
//   ③ fizetés után: a kártya MEGVÁLTOZIK, kimondja a „Kifizetve"-t összeggel,
//      időponttal, hivatkozással és a megvett nyelvekkel, a gomb pedig HALOTT
//   ④ a kapu az ÍRÁSON is ott van (ADR-0113 ⑤): kézzel gyártott POST sem rendelhet
//      másodszor ugyanarra a tételre
//   ⑤ elakadt generálás: a kártya őszinte („tovább tart"), és TOVÁBBRA sem fizettet
//   ⑥ leszállított (done) generálás után az újragenerálás megint megvásárolható
//   ⑦ a bukás-oldalon van valódi újrapróbálás-GOMB és hivatkozási azonosító
//   ⑧ az elutasított fizetőoldal KIMONDJA, hogy elutasítva (nem „pending" 11px-en)
//
// Valós DB-n, SAJÁT eldobható fixture-rel (a közös ELEK-parkhoz NEM nyúl), és a
// végén mindent visszatakarít. Fizetést nem indít: a payment-sort maga írja.
//
//   npx tsx scripts/module-purchase-state-check.mts
//   npx tsx scripts/module-purchase-state-check.mts --self-test
//     ⛔ NEGATÍV FUTÁS: ugyanezeket a méréseket a JAVÍTÁS ELŐTTI nézetre futtatja
//     (a kártya-adatból kivesszük a `paid` tényt, a bukás-oldalról a hivatkozást,
//     a fizetőoldalról a státuszt), és elvárja, hogy MIND ELBUKJON. Ha az önteszt
//     is zöld lenne, az őr nem a szabályt mérné, hanem a semmit
//     (feedback_fixture_must_prove_its_own_path).

process.env.DATABASE_URL = "";

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import { multilangSection } from "../src/server/adminViews.js";
import type { MultilangAdminData } from "../src/server/adminViews.js";
import { payMockPage, payResultPage } from "../src/console/views.js";
import {
  MULTILANG_STALL_MINUTES,
  multilangCardData,
  multilangPurchaseBlockedReason,
} from "../src/tenant/multilangCard.js";

const SELF_TEST = process.argv.includes("--self-test");

const failures: string[] = [];

/**
 * INVARIÁNS: mindkét futásban IGAZNAK kell lennie. Ide tartozik minden, ami nem
 * a mostani javítás terméke — a fizetés előtti állapot, a megőrzendő szövegek, és
 * a DB-oldali írás-kapu, amit a nézet kicserélése értelemszerűen nem érint.
 */
function inv(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

/**
 * A JAVÍTÁS SAJÁT mérése: a rendes futásban igaz, az öntesztben (a javítás előtti
 * nézeten) KÖTELEZŐEN hamis. Ha az öntesztben is zöld marad, akkor a mérés nem a
 * szabályt méri, hanem valami mást, ami amúgy is ott volt a lapon.
 */
function fix(name: string, ok: boolean, detail = ""): void {
  const want = SELF_TEST ? !ok : ok;
  if (want) console.log(`  ✅ ${name}${SELF_TEST ? " (helyesen PIROS a régi nézeten)" : ""}`);
  else {
    console.log(
      `  ⛔ ${name}${detail ? ` — ${detail}` : ""}${SELF_TEST ? " ← az önteszten ZÖLD maradt: ez a mérés nem mér semmit" : ""}`,
    );
    failures.push(name);
  }
}

/** A „Kifizetve" blokk a kártyán — a mérések ebben keresnek, nem az egész lapon. */
function paidBlockOf(html: string): string {
  // A nyugta-blokk a `data-mlang-paid` horgonytól a nyelv-választó fejlécéig tart.
  // ⚠️ Nem regexszel vágjuk a záró </div>-ig: a blokk maga is tartalmaz <div>-eket,
  // és a nem-mohó minta az ELSŐ belső záró tagnél elvágná (mérve: emiatt bukott
  // három mérés, miközben a kártya rendben volt).
  const start = html.indexOf("data-mlang-paid");
  if (start < 0) return "";
  const end = html.indexOf("<p style=\"margin:8px 0 4px\">", start);
  return html.slice(start, end < 0 ? html.length : end);
}

/** The pre-fix view: the card knew nothing about the payment (this is the bug). */
function asPreFix(ml: MultilangAdminData): MultilangAdminData {
  return { ...ml, paid: null };
}
const view = (ml: MultilangAdminData): string => multilangSection(SELF_TEST ? asPreFix(ml) : ml);

/** The submit button's markup — the one thing that decides "can I pay again?". */
function payButton(html: string): string {
  const m = /<button[^>]*type="submit"[^>]*>.*?<\/button>/s.exec(html);
  return m?.[0] ?? "";
}

const REF = `mock_${"0".repeat(8)}-0000-4000-8000-${String(Date.now()).slice(-12)}`;
const AMOUNT = 14_900;

let leadId = "";
let tenantId = "";
let siteId = "";
let prospectId = "";
let orderId = "";

try {
  // ── fixture ────────────────────────────────────────────────────────────────
  const defRow = await db
    .insertInto("scraper_definition")
    .values({ label: "modpaychk", country: "HU", region: "modpaychk", industry: "szallas" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: defRow.id } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "FK-005b őr", raw: sql`'{}'::jsonb` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "FK-005b őr" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = tenant.id;
  const site = await db
    .insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `modpaychk${Date.now()}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  siteId = site.id;
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `modpaychk${Date.now()}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  prospectId = prospect.id;

  const card = () => multilangCardData({ siteId, tenantId, primaryLang: "hu" });

  // ── ① fizetés ELŐTT ────────────────────────────────────────────────────────
  const before = view(await card());
  // A fixture BIZONYÍTJA A SAJÁT ÚTJÁT: ha nem a multilang-kártyát rendereltük
  // volna, ez a három állítás sem állna (feedback_fixture_must_prove_its_own_path).
  const rendersCard =
    before.includes("Többnyelvű honlap") && before.includes('name="lang"') && payButton(before) !== "";
  if (!rendersCard) throw new Error("a fixture NEM a multilang-kártyát rendereli — az egész mérés hazug lenne");
  console.log("  ↳ a fixture igazoltan a Többnyelvű honlap kártyát rendereli");
  inv("fizetés előtt ÉL a fizetés-gomb", !/disabled/.test(payButton(before)), payButton(before).slice(0, 90));
  inv("fizetés előtt a kártya NEM állítja, hogy ki van fizetve", !before.includes("Kifizetve"));

  // ── ② megrendelés kiállítva, de MÉG NEM fizetve ────────────────────────────
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospectId,
      kind: "multilang",
      tenant_id: tenantId,
      modules: JSON.stringify(["multilang"]),
      price: AMOUNT,
      billing_period: "monthly",
      status: "submitted",
      submitted_at: new Date(),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  orderId = order.id;
  await db
    .insertInto("payment")
    .values({
      order_intent_id: orderId,
      amount: AMOUNT,
      period: "monthly",
      gateway: "mock",
      gateway_ref: REF,
      pay_url: `/pay/mock/${REF}`,
      status: "pending",
    } as never)
    .execute();
  await db
    .insertInto("multilang_generation")
    .values({
      site_id: siteId,
      tenant_id: tenantId,
      order_intent_id: orderId,
      languages: ["de", "sk", "hr"],
      content_hash: "modpaychk",
      status: "pending_payment",
    } as never)
    .execute();

  const pending = view(await card());
  inv("kiállított, de KI NEM FIZETETT megrendelés nem mondja azt, hogy fizetve", !pending.includes("Kifizetve"));
  inv("és a fizetés-gomb ilyenkor még él", !/disabled/.test(payButton(pending)));
  inv(
    "ki nem fizetett megrendelés mellett ÚJ megrendelés indítható",
    (await multilangPurchaseBlockedReason(siteId)) === null,
  );

  // ── ③ fizetés UTÁN ─────────────────────────────────────────────────────────
  await db
    .updateTable("payment")
    .set({ status: "paid", paid_at: new Date() })
    .where("gateway_ref", "=", REF)
    .execute();
  await db
    .updateTable("multilang_generation")
    .set({ status: "paid" })
    .where("order_intent_id", "=", orderId)
    .execute();

  const after = view(await card());
  // EZ a lényeg: a fizetés ELŐTTI és UTÁNI kártya összehasonlítása.
  fix("a kártya a fizetéstől MEGVÁLTOZIK", after !== before);
  fix("a kártya KIMONDJA, hogy ki van fizetve", after.includes("Kifizetve"));
  fix(
    "a KIFIZETETT összeg ott van a nyugta-blokkban",
    paidBlockOf(after).includes("14 900 Ft") && after.includes("Kifizetett egyszeri díj"),
    `nyugta-blokk: ${paidBlockOf(after).slice(0, 120) || "(nincs)"}`,
  );
  fix("a hivatkozási azonosító ott van a nyugta-blokkban", paidBlockOf(after).includes(REF), REF);
  fix(
    "a MEGVETT nyelvek ott vannak a nyugta-blokkban",
    ["német", "szlovák", "horvát"].every((n) => paidBlockOf(after).includes(n)),
    paidBlockOf(after).slice(0, 160),
  );
  fix("a fizetés-gomb HALOTT", /disabled/.test(payButton(after)), payButton(after).slice(0, 120));
  fix(
    "a nyelv-választás befagy (a megvett hármat mutatja, letiltva)",
    (after.match(/name="lang"[^>]*checked[^>]*disabled/g) ?? []).length === 3,
    `talált: ${(after.match(/name="lang"[^>]*checked[^>]*disabled/g) ?? []).length}`,
  );
  fix(
    "a kifizetett kártya nem ad JS-t, ami visszakapcsolná a pipákat",
    !after.includes('querySelectorAll(\'input[name="lang"]\')'),
  );

  // ── ④ a kapu az ÍRÁSON (ADR-0113 ⑤) ────────────────────────────────────────
  inv(
    "kifizetett, le nem szállított tétel ÚJRA NEM rendelhető (írás-kapu)",
    (await multilangPurchaseBlockedReason(siteId)) !== null,
    (await multilangPurchaseBlockedReason(siteId)) ?? "(nyitva maradt)",
  );

  // ── ⑤ elakadt generálás ────────────────────────────────────────────────────
  await sql`update multilang_generation set created_at = now() - (${
    MULTILANG_STALL_MINUTES + 5
  } || ' minutes')::interval, status = 'generating' where order_intent_id = ${orderId}::uuid`.execute(db);
  const stalled = view(await card());
  fix("elakadt generalasnal a kartya oszinte (nem iger par percet)", stalled.includes("tovább tart"));
  fix("elakadt generalasnal is ott a Kifizetve", stalled.includes("Kifizetve"));
  fix("elakadt generálásnál is HALOTT a gomb", /disabled/.test(payButton(stalled)));
  inv(
    "elakadt generálás mellett sem rendelhető újra",
    (await multilangPurchaseBlockedReason(siteId)) !== null,
  );

  // ── ⑥ leszállítva → az újragenerálás megint megvásárolható ────────────────
  await db
    .updateTable("multilang_generation")
    .set({ status: "done" })
    .where("order_intent_id", "=", orderId)
    .execute();
  const done = view(await card());
  inv("leszállítás után a fizetés-gomb ÚJRA él (újragenerálás vásárolható)", !/disabled/.test(payButton(done)));
  inv("leszállítás után az írás-kapu is nyit", (await multilangPurchaseBlockedReason(siteId)) === null);

  // ── ⑦ a bukás-oldal: valódi gomb + hivatkozás ──────────────────────────────
  const failPage = SELF_TEST
    ? payResultPage(false, false, { amount: AMOUNT })
    : payResultPage(false, false, { amount: AMOUNT, ref: REF, retryUrl: `/pay/mock/${REF}` });
  fix(
    "a bukás-oldalon VAN újrapróbálás-gomb (valódi gomb, nem csupasz link)",
    /<a[^>]*class="citui-btn[^"]*"[^>]*href=/.test(failPage),
    "citui-btn",
  );
  fix("a bukás-oldalon ott a hivatkozási azonosító", failPage.includes(REF));
  // Ez a mondat NEM alku tárgya (tulajdonosi kérés): a „levontátok?" kérdésre
  // mindkét bukás-képernyőnek egyértelmű nemet kell adnia — ezért a self-testben
  // is ZÖLDNEK kell maradnia, tehát nem a `fix()` inverzióján megy át.
  if (!failPage.includes("Nem történt terhelés")) {
    console.log("  ⛔ a bukas-oldalrol ELTUNT a 'Nem történt terhelés' — ezt meg kell orizni");
    failures.push("'Nem történt terhelés' megorzese");
  } else console.log("  ✅ a bukas-oldal tovabbra is kimondja: 'Nem történt terhelés'");

  // ── ⑧ az elutasított fizetőoldal kimondja az állapotát ─────────────────────
  const declined = payMockPage(REF, AMOUNT, "oneoff", SELF_TEST ? "pending" : "failed");
  const pendingPage = payMockPage(REF, AMOUNT, "oneoff", "pending");
  fix("az elutasított fizetőoldal MÁS, mint a fizetés előtti", declined !== pendingPage);
  fix("és kimondja, hogy elutasítva", declined.includes("elutasítva"));

  // A dupla-terhelés elleni, MŰKÖDŐ védelem szövege szintén megőrzendő.
  const settled = payMockPage(REF, AMOUNT, "oneoff", "paid");
  if (!settled.includes("Ez a fizetés már rendezve van")) {
    console.log("  ⛔ eltunt a 'Ez a fizetés már rendezve van' — ezt meg kell orizni");
    failures.push("dupla-terhelés elleni szöveg megőrzése");
  } else console.log("  ✅ a dupla-terhelés elleni szöveg megvan");
} finally {
  // Takarítás — a közös dev DB-ben semmi nyom nem maradhat utánunk.
  if (siteId) {
    await db.deleteFrom("multilang_generation").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site_multilang").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site").where("id", "=", siteId).execute();
  }
  if (orderId) {
    await db.deleteFrom("payment").where("order_intent_id", "=", orderId).execute();
    await db.deleteFrom("order_intent").where("id", "=", orderId).execute();
  }
  if (prospectId) await db.deleteFrom("prospect").where("id", "=", prospectId).execute();
  if (tenantId) {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", tenantId).execute();
    await db.deleteFrom("tenant").where("id", "=", tenantId).execute();
  }
  if (leadId) await db.deleteFrom("lead").where("id", "=", leadId).execute();
  await db.destroy();
}

if (failures.length) {
  console.error(`\n⛔ FK-005b őr: ${failures.length} mérés BUKOTT`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(
  SELF_TEST
    ? "\n✅ ÖNTESZT: a javítás előtti nézeten MINDEN mérés pirosra vált — az őr tényleg a szabályt méri."
    : "\n✅ FK-005b: a kifizetett modul kimondja a fizetést, a gomb halott, és az írás-kapu is zár.",
);
