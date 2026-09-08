// ADR-0114 ŐR — az „egész szállás" és a szobái KIZÁRJÁK egymást.
//
// A tulaj szava (2026-09-08): „ha valaki az egész szállást kéri, akkor a többi egység
// adott napokra ne legyen elérhető. ERGO az egész szállás mint egység mindig van."
//
// Mérve a javítás ELŐTT: az egész szállásra elfogadott szept. 10–12. mellett az
// Apartman1 ugyanarra a napra FOGLALHATÓ maradt — a rendszer maga termelt dupla
// foglalást. Ez az őr azt méri, hogy ez a rés zárva van, MINDKÉT irányban, és hogy
// a szobák egymást NEM zárják (különben egy négy-apartmanos ház egyszerre csak egyet
// tudna kiadni — az ellenkező hiba, ugyanolyan drága).
//
// Valós DB-n dolgozik, SAJÁT eldobható fixture-rel (semmi máshoz nem nyúl), és a végén
// mindent visszatakarít. Levelet nem küld: csak az ütközés-ágat hívja, ami a levél
// előtt fordul vissza.
//
//   npx tsx scripts/whole-property-check.mts
//   npx tsx scripts/whole-property-check.mts --self-test
//     A flag KIKAPCSOLÁSÁVAL méri újra: ilyenkor a szoba szabad marad (a 0113 előtti
//     viselkedés). Ha ez is „zöld" lenne, az őr nem a szabályt mérné, hanem a semmit.

process.env.DATABASE_URL = "";

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import { getBlockedDaysFrom, isRangeFree, setManualMonthBlocks } from "../src/tenant/availability.js";
import { blockingUnitIds } from "../src/tenant/unitScope.js";
import { createUnit, deleteUnit, ensureUnits, getUnits, wholePropertyUnitId } from "../src/tenant/units.js";

const SELF_TEST = process.argv.includes("--self-test");

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

// A fixture jövőbeli hónapot használ: a múltbeli napokat a naptár nem is kínálja,
// és egy „ma"-hoz kötött teszt fél év múlva magától elromlana.
const now = new Date();
const target = new Date(now.getFullYear(), now.getMonth() + 2, 1);
const MONTH = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
const D10 = `${MONTH}-10`;
const D11 = `${MONTH}-11`;
const D12 = `${MONTH}-12`;
const D20 = `${MONTH}-20`;
const D25 = `${MONTH}-25`;
const D26 = `${MONTH}-26`;

let leadId = "";
let tenantId = "";
let siteId = "";

try {
  const defRow = await db
    .insertInto("scraper_definition")
    .values({ label: "wholecheck", country: "HU", region: "wholecheck", industry: "szallas" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: defRow.id } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "ADR-0114 teszt", raw: sql`'{}'::jsonb` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "ADR-0114 teszt" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = tenant.id;
  const site = await db
    .insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `wholechk${Date.now()}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  siteId = site.id;

  // ── ① az egész szállás magától létrejön, és FÖLÉRENDELTNEK születik ──────────
  const units0 = await ensureUnits(siteId);
  check("új szállásnak azonnal van egysége", units0.length === 1, `kapott: ${units0.length}`);
  check("és az az EGÉSZ szállás", units0[0]?.isWholeProperty === true);

  await createUnit(siteId, "Apartman1", 4, null);
  await createUnit(siteId, "Appar2", 2, null);
  const units = await getUnits(siteId);
  const whole = units.find((u) => u.isWholeProperty)!;
  const room1 = units.find((u) => u.name === "Apartman1")!;
  const room2 = units.find((u) => u.name === "Appar2")!;
  check("felvett szoba SOHA nem lesz fölérendelt", !room1.isWholeProperty && !room2.isWholeProperty);
  check(
    "site-onként pontosan EGY egész szállás van",
    units.filter((u) => u.isWholeProperty).length === 1,
  );
  check("a fölérendelt egység visszakereshető", (await wholePropertyUnitId(siteId)) === whole.id);

  if (SELF_TEST) {
    // A szabály HORGONYÁT vesszük ki: a flag nélkül a rendszer a 0113 ELŐTTI módon
    // viselkedik. Ha az alábbi mérések ettől nem billennek át, az őr nem mér semmit.
    await db.updateTable("site_unit").set({ is_whole_property: false }).where("id", "=", whole.id).execute();
  }

  // ── ② az EGÉSZ foglalt → a szobák sem elérhetők ────────────────────────────
  await setManualMonthBlocks(whole.id, MONTH, [D10, D11, D12]);
  const room1Blocked = await getBlockedDaysFrom(room1.id, D10);
  const wholeBlocksRoom = [D10, D11, D12].every((d) => room1Blocked.includes(d));
  check(
    SELF_TEST
      ? "ÖNTESZT: flag nélkül a szoba szabad marad (a régi, hibás viselkedés)"
      : "az egész szállás foglalása KIZÁRJA a szobát",
    SELF_TEST ? !wholeBlocksRoom : wholeBlocksRoom,
    `szoba blokkjai: ${room1Blocked.slice(0, 5).join(", ") || "(üres)"}`,
  );
  check(
    SELF_TEST ? "ÖNTESZT: flag nélkül a szoba foglalható" : "és a szoba tartománya sem szabad",
    (await isRangeFree(room1.id, D10, D12)) === SELF_TEST,
  );

  if (!SELF_TEST) {
    // ── ③ a szoba foglalt → az EGÉSZ sem adható ki ───────────────────────────
    await setManualMonthBlocks(room2.id, MONTH, [D20]);
    const wholeBlocked = await getBlockedDaysFrom(whole.id, D10);
    check("egy szoba foglalása KIZÁRJA az egész szállást", wholeBlocked.includes(D20));

    // ── ④ de a szobák EGYMÁST nem zárják ────────────────────────────────────
    const room1Days = await getBlockedDaysFrom(room1.id, D10);
    check("a másik szoba foglalása NEM zárja ki ezt a szobát", !room1Days.includes(D20));
    check("szabad napra a szoba foglalható", await isRangeFree(room1.id, D25, D26));

    // ── ⑤ a kizárás halmaza pontosan az, aminek lennie kell ─────────────────
    const fromWhole = new Set(await blockingUnitIds(whole.id));
    const fromRoom = new Set(await blockingUnitIds(room1.id));
    check("az egészet MINDEN egység blokkolhatja", fromWhole.size === 3);
    check("a szobát csak önmaga és az egész", fromRoom.size === 2 && fromRoom.has(whole.id));

    // ── ⑥ az egész szállás nem törölhető, a szoba igen ──────────────────────
    const delWhole = await deleteUnit(siteId, whole.id);
    check("az egész szállás törlése ELUTASÍTVA", !delWhole.ok, delWhole.reason ?? "");
    const delRoom = await deleteUnit(siteId, room2.id);
    check("egy szoba törölhető", delRoom.ok, delRoom.reason ?? "");
  }
} finally {
  // Takarítás — a közös dev DB-ben semmi nyom nem maradhat utánunk.
  if (siteId) {
    const ids = (await db.selectFrom("site_unit").select("id").where("site_id", "=", siteId).execute()).map(
      (r) => r.id,
    );
    if (ids.length) await db.deleteFrom("availability_day").where("unit_id", "in", ids).execute();
    await db.deleteFrom("site_unit").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site").where("id", "=", siteId).execute();
  }
  if (tenantId) await db.deleteFrom("tenant").where("id", "=", tenantId).execute();
  if (leadId) await db.deleteFrom("lead").where("id", "=", leadId).execute();
  await db.destroy();
}

if (failures.length) {
  console.error(`\n⛔ ADR-0114: ${failures.length} mérés BUKOTT`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(
  SELF_TEST
    ? "\n✅ ÖNTESZT: a flag kivételével a mérések átbillennek — az őr tényleg a szabályt méri."
    : "\n✅ ADR-0114: az egész szállás és a szobái kizárják egymást; a szobák egymást nem.",
);
