// ŐR — ADR-0118: a KIFIZETETT, elakadt nyelv-generálás magától induljon újra,
// de SE dupla futás, SE végtelen pénz-égetés, SE néma feladás ne legyen belőle.
//
// A MÉRT HIBA (2026-09-11): a generálás detached fut, egy szerver-újraindítás elvágja,
// és a sor örökre 'generating'-en marad — a vevő kifizetett egy fordítást, ami soha nem
// készül el (két ilyen sor élt, az egyik 12 órás). A kártya „csapatunk újraindítja"
// mondata addig ÜRES ÍGÉRET volt: semmi nem indította újra.
//
// Amit ez az őr mér:
//   ① ÉLŐ futás mellé NEM indul második (életjel-alapú, nem óra-alapú döntés)
//   ② NÉMA futás elakadtnak számít, és a birtokbavétel fogyaszt egy próbálkozást
//   ③ két egyszerre futó tick közül PONTOSAN EGY viszi el a sort
//   ④ a sorozat véges: a korlát után nem indul újabb automata futás
//   ⑤ a feladás EMBERT riaszt, PONTOSAN EGYSZER, és a sor 'failed' lesz
//   ⑥ az OPERÁTORI (--force) újraindítás a korlát után is megy, és nem fogyaszt
//   ⑦ a KI NEM FIZETETT generáláshoz a figyelő hozzá sem nyúl
//   ⑧ a kártya MINDEN fázisban igazat mond (a feladás után NEM ígér automatikát)
//
// Valós DB-n, SAJÁT eldobható fixture-rel, a végén mindent visszatakarít. ⛔ A
// generálás-futtatás és a riasztás INJEKTÁLT: az őr sem LLM-et nem éget, sem SMS-t
// nem küld a tulajnak.
//
//   npx tsx scripts/multilang-resume-check.mts
//   npx tsx scripts/multilang-resume-check.mts --self-test
//     ⛔ NEGATÍV FUTÁS: kiveszi a szabály HORGONYAIT (életjel-küszöb → 0, sorozat-
//     korlát → végtelen, „feladtuk" fázis → sima hiba), és elvárja, hogy a rájuk
//     épülő mérések MIND ELBUKJANAK. Ha az önteszt is zöld, az őr nem mér semmit
//     (feedback_fixture_must_prove_its_own_path).

process.env.DATABASE_URL = "";

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import { multilangSection } from "../src/server/adminViews.js";
import type { MultilangPaidState } from "../src/server/adminViews.js";
import { multilangCardData } from "../src/tenant/multilangCard.js";
import {
  MAX_MULTILANG_ATTEMPTS,
  MULTILANG_STALL_MINUTES,
  claimGeneration,
  resumeStalledGenerations,
  stalledGenerations,
  type MultilangResumeDeps,
  type ResumeCandidate,
} from "../src/tenant/multilangResume.js";

const SELF_TEST = process.argv.includes("--self-test");
const failures: string[] = [];

/** INVARIÁNS: mindkét futásban igaz (nem a mostani szabály terméke). */
function inv(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

/** A SZABÁLY saját mérése: az öntesztben (horgony nélkül) kötelezően hamis. */
function fix(name: string, ok: boolean, detail = ""): void {
  const want = SELF_TEST ? !ok : ok;
  if (want) console.log(`  ✅ ${name}${SELF_TEST ? " (helyesen PIROS a horgony nélkül)" : ""}`);
  else {
    console.log(
      `  ⛔ ${name}${detail ? ` — ${detail}` : ""}${SELF_TEST ? " ← az önteszten ZÖLD maradt: ez a mérés nem mér semmit" : ""}`,
    );
    failures.push(name);
  }
}

// ── a KIVEHETŐ HORGONYOK ─────────────────────────────────────────────────────
// Öntesztben az életjel-küszöb 0 (mindent elakadtnak lát — ez a naiv, óra-alapú
// figyelő), a sorozat-korlát pedig végtelen (a „fusson, amíg sikerül" változat).
const STALE = SELF_TEST ? 0 : MULTILANG_STALL_MINUTES;
// ⚠️ int4-en belül: a Number.MAX_SAFE_INTEGER a Postgresben túlcsordult (22003).
const CAP = SELF_TEST ? 1_000_000_000 : MAX_MULTILANG_ATTEMPTS;

/** Öntesztben nincs külön „feladtuk" fázis — a régi nézet sima hibaként mutatná. */
function asPreFix(p: MultilangPaidState | null): MultilangPaidState | null {
  if (!p || !SELF_TEST) return p;
  return p.phase === "gave_up" ? { ...p, phase: "failed" } : p;
}

let leadId = "";
let tenantId = "";
let siteId = "";
let prospectId = "";
let orderId = "";
let unpaidOrderId = "";
let genId = "";
let unpaidGenId = "";

/** A generálás-futtatás helyett: nem égetünk LLM-et, csak számoljuk a hívásokat. */
let runCalls = 0;
let alertCalls = 0;
const deps = (runOk: boolean): MultilangResumeDeps => ({
  run: async (id: string) => {
    runCalls++;
    if (runOk) {
      await db.updateTable("multilang_generation").set({ status: "done" }).where("id", "=", id).execute();
      return { ok: true };
    }
    await db
      .updateTable("multilang_generation")
      .set({ status: "failed", error: "őr-fixture: szándékos bukás", heartbeat_at: new Date() })
      .where("id", "=", id)
      .execute();
    return { ok: false, error: "őr-fixture: szándékos bukás" };
  },
  alert: async (_c: ResumeCandidate) => {
    alertCalls++;
    return true; // „kiment" — SMS-t/e-mailt az őr SOHA nem küld
  },
});

/** A fixture sorát némává teszi: életjel N perccel ezelőttre. */
async function silence(id: string, minutes: number): Promise<void> {
  await sql`update multilang_generation
            set heartbeat_at = now() - (${minutes} || ' minutes')::interval,
                created_at   = least(created_at, now() - (${minutes} || ' minutes')::interval)
            where id = ${id}::uuid`.execute(db);
}

try {
  // ── fixture ────────────────────────────────────────────────────────────────
  const defRow = await db
    .insertInto("scraper_definition")
    .values({ label: "mlresume", country: "HU", region: "mlresume", industry: "szallas" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: defRow.id } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "ADR-0118 őr", raw: sql`'{}'::jsonb` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "ADR-0118 őr" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = tenant.id;
  const site = await db
    .insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `mlresume${Date.now()}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  siteId = site.id;
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `mlresume${Date.now()}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  prospectId = prospect.id;

  const mkOrder = async (payStatus: "paid" | "pending"): Promise<string> => {
    const o = await db
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
    await db
      .insertInto("payment")
      .values({
        order_intent_id: o.id,
        amount: 14_900,
        period: "monthly",
        gateway: "mock",
        gateway_ref: `mock_mlresume_${payStatus}_${Date.now()}`,
        status: payStatus,
        ...(payStatus === "paid" ? { paid_at: new Date() } : {}),
      } as never)
      .execute();
    return o.id;
  };
  const mkGen = async (orderIntentId: string): Promise<string> => {
    const g = await db
      .insertInto("multilang_generation")
      .values({
        site_id: siteId,
        tenant_id: tenantId,
        order_intent_id: orderIntentId,
        languages: ["de", "sk", "hr"],
        content_hash: "mlresume",
        status: "paid",
      } as never)
      .returning("id")
      .executeTakeFirstOrThrow();
    return g.id;
  };

  orderId = await mkOrder("paid");
  genId = await mkGen(orderId);

  // A FIXTURE BIZONYÍTJA A SAJÁT ÚTJÁT: ha a figyelő nem a mi sorunkat látná, az
  // egész mérés-sorozat vakon zöldelne (feedback_fixture_must_prove_its_own_path).
  await silence(genId, MULTILANG_STALL_MINUTES + 5);
  const seen = await stalledGenerations(MULTILANG_STALL_MINUTES);
  if (!seen.some((r) => r.id === genId)) {
    throw new Error("a figyelő NEM látja a fixture sorát — az egész mérés hazug lenne");
  }
  console.log(`  ↳ a figyelő igazoltan látja a fixture generálását (${genId.slice(0, 8)}…)`);

  // ── ① ÉLŐ futás mellé nem indul második ────────────────────────────────────
  await db
    .updateTable("multilang_generation")
    .set({ status: "generating", heartbeat_at: new Date() })
    .where("id", "=", genId)
    .execute();
  fix(
    "ÉLŐ (életjelet adó) futás mellé NEM indul második",
    (await claimGeneration(genId, { staleMinutes: STALE, maxAttempts: CAP })) === false,
    "a friss életjel ellenére birtokba vette",
  );
  inv(
    "és a friss futás a figyelő listájában sincs benne",
    !(await stalledGenerations(MULTILANG_STALL_MINUTES)).some((r) => r.id === genId),
  );

  // ── ② NÉMA futás elakadt: birtokba vehető, és fogyaszt egy próbálkozást ────
  await silence(genId, MULTILANG_STALL_MINUTES + 5);
  // ⚠️ RELATÍV mérés, nem abszolút: az öntesztben az ① claim (helyesen) átmegy, és
  // már elfogyasztott egyet — egy „attempts === 1" állítás ott a kivett horgony
  // MELLÉKHATÁSÁN bukna el, nem a mért szabályon.
  const beforeClaim = await db
    .selectFrom("multilang_generation")
    .select("attempts")
    .where("id", "=", genId)
    .executeTakeFirstOrThrow();
  inv(
    "NÉMA futás birtokba vehető",
    await claimGeneration(genId, { staleMinutes: STALE, maxAttempts: CAP }),
  );
  const after1 = await db
    .selectFrom("multilang_generation")
    .select(["attempts", "status"])
    .where("id", "=", genId)
    .executeTakeFirstOrThrow();
  inv(
    "a birtokbavétel PONTOSAN EGY próbálkozást fogyaszt",
    after1.attempts === beforeClaim.attempts + 1,
    `${beforeClaim.attempts} → ${after1.attempts}`,
  );
  inv("és a sor 'generating'-re vált", after1.status === "generating");

  // ── ③ két tick közül pontosan egy viszi el ─────────────────────────────────
  await silence(genId, MULTILANG_STALL_MINUTES + 5);
  const [a, b] = await Promise.all([
    claimGeneration(genId, { staleMinutes: STALE, maxAttempts: CAP }),
    claimGeneration(genId, { staleMinutes: STALE, maxAttempts: CAP }),
  ]);
  fix("két egyidejű tick közül PONTOSAN EGY viszi el a sort", [a, b].filter(Boolean).length === 1, `a=${a} b=${b}`);

  // ── ④ a sorozat véges ──────────────────────────────────────────────────────
  await sql`update multilang_generation set attempts = ${MAX_MULTILANG_ATTEMPTS} where id = ${genId}::uuid`.execute(db);
  await silence(genId, MULTILANG_STALL_MINUTES + 5);
  fix(
    `a ${MAX_MULTILANG_ATTEMPTS}. próbálkozás után NEM indul újabb automata futás`,
    (await claimGeneration(genId, { staleMinutes: STALE, maxAttempts: CAP })) === false,
    "a korlát fölött is birtokba vette",
  );

  // ── ⑤ a feladás EMBERT riaszt, pontosan egyszer ───────────────────────────
  runCalls = 0;
  alertCalls = 0;
  await silence(genId, MULTILANG_STALL_MINUTES + 5);
  const tick1 = await resumeStalledGenerations(deps(true), MULTILANG_STALL_MINUTES);
  inv("a feladásnál riasztás megy ki", alertCalls === 1, `alertCalls=${alertCalls}`);
  inv("és NEM indul újabb generálás", runCalls === 0, `runCalls=${runCalls}`);
  inv("a tick feladásként számolja el", tick1.gaveUp === 1, JSON.stringify(tick1.notes));
  const afterGive = await db
    .selectFrom("multilang_generation")
    .select(["status", "alert_at", "error"])
    .where("id", "=", genId)
    .executeTakeFirstOrThrow();
  inv("a sor VÉGLEGES bukásra vált", afterGive.status === "failed");
  inv("és a riasztás nyomot hagy (alert_at)", afterGive.alert_at !== null);

  await silence(genId, MULTILANG_STALL_MINUTES + 5);
  const tick2 = await resumeStalledGenerations(deps(true), MULTILANG_STALL_MINUTES);
  inv("a KÖVETKEZŐ tick NEM riaszt újra", alertCalls === 1, `alertCalls=${alertCalls}`);
  inv("és nem is futtat semmit", runCalls === 0 && tick2.resumed === 0);

  // ── ⑧ a kártya minden fázisban igazat mond ────────────────────────────────
  const cardNow = async (): Promise<string> => {
    const data = await multilangCardData({ siteId, tenantId, primaryLang: "hu" });
    const paid = asPreFix(data.paid);
    return multilangSection({ ...data, paid });
  };
  const gaveUpCard = await cardNow();
  fix(
    "feladás után a kártya NEM ígér automatikus újraindítást",
    !gaveUpCard.includes("automatikusan újraindítja") && !gaveUpCard.includes("automatikusan újrapróbálja"),
    "még mindig automatikát ígér",
  );
  fix(
    "feladás után a kártya EMBERT ígér",
    gaveUpCard.includes("Munkatársunk már tud róla"),
  );
  inv("feladás után is ott a „Kifizetve” és a halott gomb", gaveUpCard.includes("Kifizetve"));
  inv(
    "és továbbra sem rendelhető újra",
    /<button[^>]*type="submit"[^>]*disabled/.test(gaveUpCard) ||
      /disabled[^>]*type="submit"/.test(gaveUpCard),
  );

  // NÉMA, de még sorozaton belüli állapot → a kártya automatikát ígérhet, mert az igaz.
  await sql`update multilang_generation
            set attempts = 1, status = 'generating', alert_at = null, error = null
            where id = ${genId}::uuid`.execute(db);
  await silence(genId, MULTILANG_STALL_MINUTES + 5);
  const stalledCard = await cardNow();
  // Szöveg-invariáns: nem horgony-billentős mérés, hanem az, hogy a mondat OTT VAN.
  // (Kivenni bármikor ki lehet — ettől lesz piros; ez a dolga.)
  inv(
    "sorozaton belül a kártya AUTOMATIKUS újraindítást ígér (és az igaz is)",
    stalledCard.includes("automatikusan újraindítja"),
  );

  // FUTÓ, újraindított állapot → a kártya kimondja, hányadik próbálkozás.
  await db
    .updateTable("multilang_generation")
    .set({ heartbeat_at: new Date() })
    .where("id", "=", genId)
    .execute();
  const runningCard = await cardNow();
  inv("újraindítás után a kártya kimondja a próbálkozás sorszámát", runningCard.includes("1. próbálkozás"));

  // ── ⑥ az OPERÁTORI újraindítás a korlát fölött is megy, és nem fogyaszt ───
  await sql`update multilang_generation set attempts = ${MAX_MULTILANG_ATTEMPTS}, status = 'failed' where id = ${genId}::uuid`.execute(db);
  const forced = await claimGeneration(genId, { staleMinutes: 0, consumeAttempt: false });
  const afterForce = await db
    .selectFrom("multilang_generation")
    .select("attempts")
    .where("id", "=", genId)
    .executeTakeFirstOrThrow();
  inv("operátori (--force) újraindítás a korlát fölött is birtokba vesz", forced);
  inv(
    "és NEM fogyaszt automata próbálkozást",
    afterForce.attempts === MAX_MULTILANG_ATTEMPTS,
    `attempts=${afterForce.attempts}`,
  );

  // ── ⑦ a KI NEM FIZETETT generáláshoz hozzá sem nyúl ───────────────────────
  unpaidOrderId = await mkOrder("pending");
  unpaidGenId = await mkGen(unpaidOrderId);
  await sql`update multilang_generation set status = 'pending_payment' where id = ${unpaidGenId}::uuid`.execute(db);
  await silence(unpaidGenId, MULTILANG_STALL_MINUTES + 60);
  inv(
    "KI NEM FIZETETT generálás nem kerül a figyelő elé",
    !(await stalledGenerations(MULTILANG_STALL_MINUTES)).some((r) => r.id === unpaidGenId),
  );
  inv(
    "és birtokba sem vehető",
    (await claimGeneration(unpaidGenId, { staleMinutes: 0, consumeAttempt: false })) === false,
  );
} finally {
  if (siteId) {
    await db.deleteFrom("multilang_generation").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site_multilang").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site").where("id", "=", siteId).execute();
  }
  for (const o of [orderId, unpaidOrderId].filter(Boolean)) {
    await db.deleteFrom("payment").where("order_intent_id", "=", o).execute();
    await db.deleteFrom("order_intent").where("id", "=", o).execute();
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
  console.error(`\n⛔ ADR-0118 őr: ${failures.length} mérés BUKOTT`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(
  SELF_TEST
    ? "\n✅ ÖNTESZT: a horgonyok kivételével a mérések átbillennek — az őr tényleg a szabályt méri."
    : "\n✅ ADR-0118: az elakadt generálás magától újraindul, élő futás mellé nem, és a sorozat végén ember kap szót.",
);
