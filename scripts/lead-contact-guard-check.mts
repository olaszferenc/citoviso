// gate-lane: own-fixture-only
//   ↑ ÍGÉRET (ADR-0229): ez a kapu CSAK a saját, futásonként bélyegzett fixture-ét írja és olvassa
//   vissza. A park mérése (hány lead érintett) NEM ennek a kapunak a dolga — az ADR-ben rögzítve.
/**
 * A LEAD NYILVÁNOS ELÉRHETŐSÉGÉNEK ŐRE (ADR-XXXX): a szállás címe/országa nem lehet egy vevő
 * számlázási adata.
 *
 * ⛔ MIÉRT (mérve 2026-10-03, dev park): 7 lead `raw.address`-ében a tesztelő SAJÁT számlázási
 * címe állt („Ráckevei út 083/2 hrsz., 24393470213" — utca + 11 jegyű, adószám-formájú szám),
 * az országban „MAGYARORSZÁG", és ez minden mockra/sablonra kiment (hős, fejléc, lábléc, térkép).
 * Az út: a konzol „Adatok" űrlapja (`saveLeadEdits`, POST /lead/:id/data) — `name="address|
 * country|…"` mezők, amiket a böngésző cím-automatikus kitöltése a gépelő SAJÁT profiljából tölt
 * (ugyanez a sztring ül az order_intent.buyer_address-ben, a pénztár-űrlapot is ez töltötte).
 *
 *   ① szabály (leadContactRules.ts): a mért szennyezett értékek elutasítva, a valódi címek
 *     (hrsz.-szal, irányítószámmal, házszámmal) átmennek, az ország ISO-2-re fordul;
 *   ② mentés (saveLeadEdits, saját fixture-lead): az autofill-csomag MINDENT-VAGY-SEMMIT
 *     elutasítva — a DB-ben semmi nem változik; egy jó mentés átmegy, az ország „HU"-ként áll.
 *   (Az űrlap autofill-tiltása §2b-jóváhagyásra vár — ADR-XXXX; ha bejön, ide a ③ réteg.)
 *
 * Negatív kontroll: a régi kódon a ② piros (a mentés elfogadta és beírta az autofill-csomagot).
 *
 *   npx tsx scripts/lead-contact-guard-check.mts
 */
(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();
process.env.CIT_SHOT = "1";

const { db, pool } = await import("../src/db/client.js");
const { saveLeadEdits } = await import("../src/console/data.js");
const { checkLeadContact } = await import("../src/console/leadContactRules.js");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");

let fails = 0;
function ok(cond: boolean, msg: string, detail = ""): void {
  console.log(`${cond ? "  ok " : "  FAIL"} ${msg}${!cond && detail ? `  — ${detail}` : ""}`);
  if (!cond) fails++;
}

// ── ① szabály ────────────────────────────────────────────────────────────────
console.log("① szabály (leadContactRules.ts)");
const polluted = [
  "Ráckevei út 083/2 hrsz., 24393470213",
  "24393470213",
  "Fő utca 1., 24393470-2-13",
  "Fő utca 1., 06 20 375 9440",
  "Kossuth u. 3, +36305161631",
];
for (const a of polluted) {
  const v = checkLeadContact({ address: a });
  ok(!v.ok, `elutasítva: „${a}"`, JSON.stringify(v));
}
const clean = [
  "8274 Köveskál, Fő u. 24.",
  "Zamárdi, Szent István u. 3512 hrsz, 8621 Hungary",
  "Ráckevei út 083/2 hrsz. 083/2",
  "8621 Zamárdi, Petőfi Sándor utca 120/B",
  "1051 Budapest, Október 6. utca 12. 3/14",
];
for (const a of clean) {
  const v = checkLeadContact({ address: a });
  ok(v.ok, `átmegy: „${a}"`, JSON.stringify(v));
}
for (const [inp, out] of [["Magyarország", "HU"], ["MAGYARORSZÁG", "HU"], ["hu", "HU"], ["HU", "HU"], ["at", "AT"]] as const) {
  const v = checkLeadContact({ country: inp });
  ok(v.ok && v.country === out, `ország „${inp}" → ${out}`, JSON.stringify(v));
}
ok(!checkLeadContact({ country: "Hungaryy" }).ok, "ismeretlen, nem ISO-2 ország elutasítva");
ok(checkLeadContact({}).ok && checkLeadContact({ address: "", country: "" }).ok, "üres mezők (törlés) átmennek");

// ── ② mentés, saját fixture-ön ───────────────────────────────────────────────
console.log("② saveLeadEdits — mindent-vagy-semmit");
const parent = await createFixtureParent(db, "leadcontact");
try {
  const original = { name: "Őr-teszt Vendégház", city: "Köveskál", country: "HU", phone: "06 70 000 0000" };
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: parent.runId,
      name: original.name,
      address: null,
      raw: JSON.stringify(original),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const read = async () =>
    db.selectFrom("lead").select(["address", "raw"]).where("id", "=", lead.id).executeTakeFirstOrThrow();

  // The exact package the browser autofill wrote on 2026-09-26 (Három Huszár).
  const autofill = {
    phone: "06 30 000 0001",
    email: "tesztelo@example.com",
    country: "Magyarország",
    address: "Ráckevei út 083/2 hrsz., 24393470213",
  };
  const r1 = (await saveLeadEdits(lead.id, autofill, new Date())) as { ok?: boolean } | undefined;
  const after1 = await read();
  const raw1 = after1.raw as Record<string, unknown>;
  ok(r1?.ok === false, "az autofill-csomag mentése ELUTASÍTVA", JSON.stringify(r1));
  ok(after1.address === null && raw1.address === undefined, "a cím NEM íródott be", String(after1.address ?? raw1.address));
  ok(raw1.phone === original.phone && raw1.email === undefined, "telefon/e-mail sem (mindent-vagy-semmit)", JSON.stringify(raw1));
  ok(raw1.curatorEditedAt === undefined && raw1.scrapedContact === undefined, "nincs szerkesztés-bélyeg", JSON.stringify(raw1));

  const r2 = (await saveLeadEdits(
    lead.id,
    { address: "8274 Köveskál, Fő u. 24.", country: "magyarország" },
    new Date(),
  )) as { ok?: boolean } | undefined;
  const after2 = await read();
  const raw2 = after2.raw as Record<string, unknown>;
  ok(r2?.ok === true, "jó cím mentése átmegy", JSON.stringify(r2));
  ok(after2.address === "8274 Köveskál, Fő u. 24." && raw2.address === "8274 Köveskál, Fő u. 24.", "a cím oszlopban és raw-ban is", JSON.stringify(after2));
  ok(raw2.country === "HU", "az ország ISO-2-ként áll (nem „MAGYARORSZÁG”)", String(raw2.country));
} finally {
  await parent.drop();
}

await pool.end();
if (fails) {
  console.log(`\n⛔ ${fails} hiba — a lead nyilvános elérhetősége befogadhat vevő-/számlázási adatot.`);
  process.exit(1);
}
console.log("\n✅ lead-elérhetőség őr: zöld");
