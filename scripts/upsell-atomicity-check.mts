// ⛔⛔ A KIFIZETETT BŐVÍTÉS MIND BEKAPCSOL, VAGY EGYIK SEM — és ha nem, azt EMBER TUDJA MEG.
//
// A MÉRT LELET (ADR-0192 ⑧.7). Az `activateUpsell()` modulonként KÜLÖN utasítással írt, tehát
// N külön tranzakcióban: egy félbemaradó ciklus után `booking` bent, `pricing` kint — vagyis
// **kifizetett** függőség-sértés, amit semmi nem vesz észre.
//
// ⛔ ÉS AMIT A JAVÍTÁS KÖZBEN MÉRTEM KI: a tranzakció ÖNMAGÁBAN egyik némaságot cserélné a
// másikra. A `applyWebhookResult()` a fizetést **a rendezés ELŐTT** állítja `paid`-re, az első
// sora viszont `if (payment.status === "paid") return { alreadySettled: true }` — tehát egy
// ismételt webhook **meg sem próbálja újra** az aktiválást. Bukó rendezés után a vevő fizetett,
// semmit nem kapott, és az idempotencia elnyelte a hibát
// (`feedback_idempotency_made_the_second_charge_worthless`).
//
// Amit állít (eldobható fixture, valódi DB, DB-szintű hibainjektálással):
//   ① HIBA NÉLKÜL: mind a három megvett modul bekapcsol — a kapu nem tagadja meg a fizetőt.
//   ② ⭐ HIBA A MÁSODIK MODULNÁL: EGYETLEN modul sem kapcsol be (mind vagy semmi).
//      A javítás előtt itt **részleges** állapot keletkezett.
//   ③ ⭐⭐ A hibát követő ISMÉTELT webhook ÚJRA MEGPRÓBÁLJA a rendezést, és sikerül.
//      A javítás előtt `alreadySettled`-del azonnal visszatért, és a vevő ott maradt semmivel.
//   ④ A tartósan bukó újrarendezés NEM jelent sikert — és riasztást vált ki.
//      ⚠️ A KIMENŐ riasztást ez a kapu SZÁNDÉKOSAN NEM SÜTI EL, ha valódi címzett van
//      beállítva: egy commit-kapu nem küldhet SMS-t/levelet a tulajnak minden commitnál
//      (a ház erre külön KÉZI eszközt tart: `scripts/alert-drill.mts --go`). Ilyenkor a ④
//      HANGOSAN kimarad, megnevezve az okot — a néma kihagyás késznek olvasódna.
//
// A HIBAINJEKTÁLÁS: egy BEFORE INSERT trigger a `module_entitlement`-en, ami KIZÁRÓLAG a
// fixture tenant-jára és KIZÁRÓLAG egy megnevezett modulra dob hibát.
// ⚠️ A dev-adatbázis KÖZÖS (~25 párhuzamos szál). Ezért a trigger tenant-re szűkített, egyedi
// nevű, és a `finally` mindenképp eldobja — egy szál sem futhat bele.
//
// Futtatás:
//   npx tsx scripts/upsell-atomicity-check.mts
//   npx tsx scripts/upsell-atomicity-check.mts --self-test   ← PIROSNAK KELL LENNIE
//
// Az önteszt a TÖRTÉNETI viselkedést futtatja: modulonként külön utasítás (a tranzakció előtti
// alak), és a replay-nél a régi, azonnal visszatérő `alreadySettled` ág.

process.env.CIT_SHOT = "1";

import { sql } from "kysely";

import { db, pool } from "../src/db/client.js";
import { MODULE_CATALOG } from "../src/modules.js";
import { getAlertRecipients } from "../src/console/appSettings.js";
import { reservedRecipients } from "../src/email/sender.js";
import { applyWebhookResult } from "../src/payment/service.js";
import { activateUpsell } from "../src/tenant/moduleUpsell.js";

const SELF_TEST = process.argv.includes("--self-test");

let bad = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    bad++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** The historical, per-module loop — the red control's activation path. */
async function activateUpsellLegacy(tenantId: string, bought: readonly string[]): Promise<void> {
  for (const id of bought) {
    await db
      .insertInto("module_entitlement")
      .values({ tenant_id: tenantId, module: id, active: true })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "module"]).doUpdateSet({
          active: true,
          awaiting_first_charge: false,
          cancel_at_period_end: false,
          cancelled_at: null,
        }),
      )
      .execute();
  }
}

const ids: { defId?: string; runId?: string; leadId?: string; tenantId?: string } = {};
let faultOn = false;
const TRG = `_upsell_atomicity_fault`;

async function activeModules(tenantId: string): Promise<string[]> {
  const rows = await db
    .selectFrom("module_entitlement")
    .select("module")
    .where("tenant_id", "=", tenantId)
    .where("active", "=", true)
    .execute();
  return rows.map((r) => r.module).sort();
}

try {
  const BASKET = MODULE_CATALOG.filter((m) => !m.spine && m.billing !== "once")
    .slice(0, 3)
    .map((m) => m.id);
  const FAIL_ON = BASKET[1]!; // the SECOND one: a partial write needs a survivor before it

  const stamp = Date.now().toString(36);
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_upsell_atom_check",
      country: "HU",
      region: "_test",
      industry: "accommodation",
      sources: JSON.stringify(["osm"]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "_upsell_atom lead", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `atom_${stamp}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "_upsell_atom tenant" })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const tenantId = tenant.id;

  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      kind: "upsell",
      tenant_id: tenantId,
      modules: JSON.stringify(BASKET),
      price: 1000,
      billing_period: "monthly",
      status: "submitted",
      submitted_at: new Date(),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();

  // ⛔ A FIXTURE-NEK VALÓDI FIZETETT SORA KELL, és ezt a mérés tanította meg. Enélkül a
  // `settleUpsellPaid` aktivál, majd a `syncEntitlementsToPaid` ugyanabban a hívásban
  // VISSZAKAPCSOLJA mind („NEM FIZETETT modul kikapcsolva"), mert a fizetett unió üres —
  // tehát a ③ állítás egy olyan úton mérne, ami a terméken sosem fordul elő.
  const payment = await db
    .insertInto("payment")
    .values({
      order_intent_id: order.id,
      amount: 1000,
      currency: "HUF",
      period: "monthly",
      gateway: "mock",
      status: "paid",
      paid_at: new Date(),
      gateway_ref: `atomref_${stamp}`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();

  console.log(`Kosár: ${BASKET.join(" + ")} · hiba-injektálás: ${FAIL_ON}`);

  // ── ② the fault: ONE statement of the batch refuses ─────────────────────────
  // Scoped to THIS tenant and THIS module, so a concurrent session cannot trip it.
  await sql`
    CREATE OR REPLACE FUNCTION ${sql.raw(TRG)}() RETURNS trigger AS $fn$
    BEGIN
      IF NEW.tenant_id = ${sql.lit(tenantId)}::uuid AND NEW.module = ${sql.lit(FAIL_ON)} THEN
        RAISE EXCEPTION 'injected upsell fault';
      END IF;
      RETURN NEW;
    END $fn$ LANGUAGE plpgsql;
  `.execute(db);
  await sql`
    CREATE TRIGGER ${sql.raw(TRG)} BEFORE INSERT ON module_entitlement
    FOR EACH ROW EXECUTE FUNCTION ${sql.raw(TRG)}();
  `.execute(db);
  faultOn = true;

  console.log("\n② A ciklus közepén elhasal a beírás:");
  let threw = false;
  try {
    if (SELF_TEST) await activateUpsellLegacy(tenantId, BASKET);
    else await activateUpsell(order.id);
  } catch {
    threw = true;
  }
  check("a hiba nem nyelődik el (a hívó megtudja)", threw, threw);
  const afterFault = await activeModules(tenantId);
  check(
    "⭐ EGYETLEN modul sem kapcsolt be — mind vagy semmi (nincs kifizetett zárvány)",
    afterFault.length === 0,
    afterFault,
  );

  // ── ③ the replay must RE-DRIVE, not shrug ──────────────────────────────────
  // ⛔ THROUGH THE WEBHOOK, not through settleUpsellPaid(). The hole is not in the
  // settlement — that always worked — but in `applyWebhookResult`, which saw
  // `payment.status === 'paid'` and returned `alreadySettled` without ever asking
  // whether the purchase had been DELIVERED. Calling the settlement directly would
  // measure a path the gateway never takes, and stay green on the real defect.
  console.log("\n③ A hiba UTÁN ÚJRAKÜLDÖTT WEBHOOK (amit a gateway tényleg csinál):");
  await sql`DROP TRIGGER IF EXISTS ${sql.raw(TRG)} ON module_entitlement;`.execute(db);
  faultOn = false;

  const replay = SELF_TEST
    ? // RED CONTROL: the historical replay branch — a bare shrug on a paid payment.
      { ok: true, activated: false, alreadySettled: true }
    : await applyWebhookResult({ gatewayRef: `atomref_${stamp}`, status: "paid" });
  check(
    "⭐⭐ az ÚJRAKÜLDÖTT webhook újrarendez (nem vállat von, hogy „már rendezve”)",
    replay.activated === true,
    replay,
  );
  check(
    "és közben NEM állít új terhelést (a korábbi fizetés érvényes)",
    replay.alreadySettled === true,
    replay,
  );
  const afterHeal = await activeModules(tenantId);
  check(
    "① a fizető vevő mind a három modult megkapja",
    BASKET.every((id) => afterHeal.includes(id)),
    afterHeal,
  );

  // ── ④ a re-drive that FAILS must not report success ────────────────────────
  console.log("\n④ Az újrarendezés is elhasal — a webhook NEM jelenthet sikert:");
  const rcpt = await getAlertRecipients();
  const liveRecipient =
    (rcpt.email ?? "").split(",").some((a) => a.trim() && reservedRecipients(a.trim()).length === 0) ||
    Boolean(rcpt.phone);
  if (liveRecipient) {
    // ⛔ LOUD SKIP, with the reason — a silent one would read as coverage.
    console.log(
      `  ⚠️ KIHAGYVA: valódi riasztási címzett van beállítva ` +
        `(${rcpt.email ?? "-"}${rcpt.phone ? ` · ${rcpt.phone}` : ""}). Egy commit-kapu nem ` +
        `küldhet valódi riasztást; a kimenő csatornát a scripts/alert-drill.mts --go méri.`,
    );
  } else {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", tenantId).execute();
    await sql`
      CREATE TRIGGER ${sql.raw(TRG)} BEFORE INSERT ON module_entitlement
      FOR EACH ROW EXECUTE FUNCTION ${sql.raw(TRG)}();
    `.execute(db);
    faultOn = true;
    const failed = await applyWebhookResult({ gatewayRef: `atomref_${stamp}`, status: "paid" });
    check(
      "⭐ bukó újrarendezés után a webhook NEM mond kézbesítést",
      failed.activated === false,
      failed,
    );
    check(
      "és az állapot NEM lett részlegesen bekapcsolva",
      (await activeModules(tenantId)).length === 0,
      await activeModules(tenantId),
    );
    await sql`DROP TRIGGER IF EXISTS ${sql.raw(TRG)} ON module_entitlement;`.execute(db);
    faultOn = false;
  }
} finally {
  if (faultOn) {
    await sql`DROP TRIGGER IF EXISTS ${sql.raw(TRG)} ON module_entitlement;`.execute(db).catch(() => {});
  }
  await sql`DROP FUNCTION IF EXISTS ${sql.raw(TRG)}();`.execute(db).catch(() => {});
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}

if (SELF_TEST) {
  if (bad) {
    console.log(`\n✅ önteszt: a történeti (modulonkénti) aktiváláson ${bad} állítás pirosra ment.`);
    process.exit(0);
  }
  console.error("\n⛔ ÖNTESZT-BUKÁS: a modulonkénti aktiválás ZÖLD maradt — az őr VAK.");
  process.exit(1);
}

if (bad) {
  console.error(`\n⛔ upsell-atomicity-check: ${bad} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ upsell-atomicity-check: a kifizetett bővítés mind bekapcsol, vagy egyik sem.");
