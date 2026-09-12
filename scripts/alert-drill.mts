// RIASZTÁS-PRÓBA — valódi SMS + levél a beállított címzetteknek (tulaj-kérés, 2026-09-12).
//
// MIÉRT VAN: a riasztási címzettet beállítani additív írás. Az `alert-recipients-check`
// megméri a To: fejlécet, de azt NEM tudja megmondani, hogy a levél tényleg megérkezik-e a
// postafiókba, és hogy az SMS kimegy-e a modemen. Ezt csak egy VALÓDI riasztás mondja meg.
//
// Mit csinál: felállít egy eldobható PRÓBA-tenantot, aminek a generálása KÖLTSÉG NÉLKÜL
// bukik el (a site-nak nincs `path`-a → a futtató a fordítás ELŐTT elhasal, egy AI-hívás
// sem történik), végigfuttatja rajta az ADR-0118 sorozatot (3 automata próbálkozás), és
// hagyja, hogy a 4. tick kiváltsa az IGAZI feladás-riasztást. Utána mindent visszatakarít.
//
//   npx tsx scripts/alert-drill.mts          # szárazon: megmutatja, kinek menne
//   npx tsx scripts/alert-drill.mts --go     # ÉLES: tényleg küld SMS-t és levelet
//
// ⚠️ A `--go` VALÓDI üzenetet küld a konzol /settings címzettjeinek. A próba-tenant neve
// ezért kimondja magáról, hogy próba — egy riasztás, ami valódi ügyfélnek látszik, rosszabb,
// mint a hiány (§B.17).

process.env.DATABASE_URL = "";

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import { getAlertRecipients } from "../src/console/appSettings.js";
import { MAX_MULTILANG_ATTEMPTS, resumeStalledGenerations } from "../src/tenant/multilangResume.js";

const GO = process.argv.includes("--go");
const TENANT_NAME = "PRÓBA-RIASZTÁS (nem valódi ügyfél)";

const rcpt = await getAlertRecipients();
console.log("A riasztás címzettjei:");
console.log(`  SMS:     ${rcpt.phone ?? "(nincs — az SMS-csatorna ki van kapcsolva)"}`);
console.log(`  E-mail:  ${rcpt.email ?? "(nincs — az e-mail csatorna ki van kapcsolva)"}`);
if (!rcpt.phone && !rcpt.email) {
  console.error("⛔ nincs egyetlen címzett sem — a próbának nincs értelme.");
  await db.destroy();
  process.exit(1);
}
if (!GO) {
  console.log("\n(szárazon futott — a valódi küldéshez: --go)");
  await db.destroy();
  process.exit(0);
}

let leadId = "";
let tenantId = "";
let siteId = "";
let prospectId = "";
let orderId = "";
let genId = "";

try {
  // ── eldobható PRÓBA-fixture ────────────────────────────────────────────────
  const defRow = await db
    .insertInto("scraper_definition")
    .values({ label: "alertdrill", country: "HU", region: "alertdrill", industry: "szallas" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: defRow.id } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: TENANT_NAME, raw: sql`'{}'::jsonb` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: TENANT_NAME } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = tenant.id;
  // ⛔ SZÁNDÉKOSAN `path` nélkül: az effectiveSiteForMultilang ilyenkor null-t ad, a
  // futtató a fordítás ELŐTT elhasal — a próba egyetlen fillér AI-költséget sem termel.
  const site = await db
    .insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `alertdrill${Date.now()}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  siteId = site.id;
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `alertdrill${Date.now()}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  prospectId = prospect.id;
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospectId,
      kind: "multilang",
      tenant_id: tenantId,
      modules: JSON.stringify(["multilang"]),
      price: 14_900,
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
      amount: 14_900,
      period: "monthly",
      gateway: "mock",
      gateway_ref: `mock_alertdrill_${Date.now()}`,
      status: "paid",
      paid_at: new Date(),
    } as never)
    .execute();
  const gen = await db
    .insertInto("multilang_generation")
    .values({
      site_id: siteId,
      tenant_id: tenantId,
      order_intent_id: orderId,
      languages: ["de", "sk", "hr"],
      content_hash: "alertdrill",
      status: "paid",
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  genId = gen.id;
  console.log(`\n▸ próba-generálás felállítva: ${genId}`);

  /** Időt ugrunk: a sort némává tesszük, hogy a következő tick elakadtnak lássa. */
  const silence = async (): Promise<void> => {
    await sql`update multilang_generation
              set heartbeat_at = now() - interval '60 minutes',
                  created_at   = least(created_at, now() - interval '60 minutes')
              where id = ${genId}::uuid`.execute(db);
  };

  // ── a sorozat: MAX_MULTILANG_ATTEMPTS valódi, bukó próbálkozás ─────────────
  for (let i = 1; i <= MAX_MULTILANG_ATTEMPTS; i++) {
    await silence();
    const r = await resumeStalledGenerations();
    console.log(`  ${i}. tick → ${r.resumed} újraindítva · ${r.notes.join(" | ") || "—"}`);
  }

  // ── a 4. tick: a sorozat elfogyott → IGAZI riasztás ────────────────────────
  await silence();
  console.log("\n▸ a sorozat elfogyott — most megy ki a VALÓDI riasztás…");
  const last = await resumeStalledGenerations();
  console.log(`  feladva: ${last.gaveUp} · ${last.notes.join(" | ") || "—"}`);

  const row = await db
    .selectFrom("multilang_generation")
    .select(["status", "attempts", "alert_at", "error"])
    .where("id", "=", genId)
    .executeTakeFirstOrThrow();
  console.log(
    `\nA sor állapota: status=${row.status} · attempts=${row.attempts} · ` +
      `riasztás=${row.alert_at ? "KIMENT" : "NEM ment ki"}`,
  );
  console.log(`Az utolsó hiba, amit a levél idéz: ${row.error}`);
  if (!row.alert_at) {
    console.error(
      "⛔ a riasztás NEM ment ki — nézd a fenti naplót (hiányzó címzett vagy transzport-hiba).",
    );
  }
} finally {
  // Takarítás: a próba-tenant nem maradhat a közös dev DB-ben.
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
  console.log("\n✔ a próba-fixture visszatakarítva.");
  await db.destroy();
}
