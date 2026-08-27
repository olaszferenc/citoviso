// LOCAL demo tenant — a clickable way to test the admin end to end (ADR-0044).
//
// The module work (config, units, prices, booking) could only be verified by scripts
// so far, because a fresh database has no tenant to log in as. This creates one:
// a guesthouse with three units, prices, amenities and every module switched on,
// then prints the login. Re-runnable — it refreshes the same demo tenant instead of
// piling up duplicates.
//
// LOCAL ONLY. It writes to whatever database DATABASE_URL points at, so it refuses
// to run unless that is clearly a local host — seeding demo data into production
// would be exactly the kind of accident the deploy doctrine exists to prevent.
//
//   npx tsx scripts/demo-tenant.mts

import { db, pool } from "../src/db/client.js";
import { config } from "../src/config.js";
import { issueTenantLogin } from "../src/tenant/credentials.js";
import { setTenantModules } from "../src/tenant/modules.js";
import { setSiteModuleConfig } from "../src/tenant/siteModuleConfig.js";
import { createUnit, ensureUnits, getUnits, setUnitAmenities, updateUnit } from "../src/tenant/units.js";
import { addSeasonPrice, setBasePrice } from "../src/tenant/prices.js";
import { rerenderTenantSnapshot, setTenantPhotoUnits } from "../src/tenant/editor.js";
import { MODULE_CATALOG } from "../src/modules.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

// Local dev runs on the embedded postgres (no DATABASE_URL, unix socket); production
// sets DATABASE_URL. So the safe state is "no DSN, or a plainly local one" — anything
// else is refused, because seeding demo data into production is exactly the accident
// the deploy doctrine exists to prevent.
const dsn = config.databaseUrl ?? process.env.DATABASE_URL ?? "";
if (dsn && !/@?(localhost|127\.0\.0\.1)|\/tmp|\.pgdata/.test(dsn)) {
  console.error(`⛔ Ez a script CSAK helyi adatbázison futhat. A DATABASE_URL nem helyi.`);
  process.exit(1);
}
console.log(dsn ? "adatbázis: DATABASE_URL (helyi)" : "adatbázis: beágyazott postgres (helyi socket)");

const LABEL = "_demo_tenant";
const NAME = "Nyugalom Vendégház";

try {
  // Clean any previous run so re-running is safe and idempotent.
  const old = await db.selectFrom("scraper_definition").select("id").where("label", "=", LABEL).execute();
  for (const d of old) {
    const runs = await db.selectFrom("scrape_run").select("id").where("scraper_definition_id", "=", d.id).execute();
    for (const r of runs) {
      const leads = await db.selectFrom("lead").select("id").where("scrape_run_id", "=", r.id).execute();
      for (const l of leads) {
        await db.deleteFrom("tenant").where("lead_id", "=", l.id).execute();
        await db.deleteFrom("mock_artifact").where("lead_id", "=", l.id).execute();
        await db.deleteFrom("lead").where("id", "=", l.id).execute();
      }
      await db.deleteFrom("scrape_run").where("id", "=", r.id).execute();
    }
    await db.deleteFrom("scraper_definition").where("id", "=", d.id).execute();
  }

  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: LABEL,
      country: "HU",
      region: "Balaton",
      industry: "accommodation",
      sources: JSON.stringify(["osm"]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: NAME, raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();

  // Owner-provenance photos so the live photo policy passes without a declaration.
  const siteData: SiteData = {
    name: NAME,
    tagline: "Csend, kert, Balaton",
    intro:
      "Kétszáz méterre a strandtól, saját kerttel és árnyas terasszal. Kutyabarát, ingyenes parkolóval.",
    highlights: ["Saját parkoló", "Kutyabarát", "200 m a strandtól"],
    photos: [
      { url: "https://placehold.co/1600x1000/16283f/ffffff?text=Kert", alt: "Kert", provenance: "owner" },
      { url: "https://placehold.co/1600x1000/0ea5b7/ffffff?text=Szoba", alt: "Szoba", provenance: "owner" },
      { url: "https://placehold.co/1600x1000/6b7a8d/ffffff?text=Terasz", alt: "Terasz", provenance: "owner" },
    ],
    contact: { email: "info@nyugalom.example", phone: "+36 30 123 4567", address: "Fő utca 1., Balatonberény" },
  } as unknown as SiteData;
  const recipe: Recipe = { template: "fullbleed", skin: "", archetype: "", sections: [] };

  const artifact = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: lead.id,
      status: "approved",
      inputs: JSON.stringify({ recipe, siteData }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: NAME })
    .returning("id")
    .executeTakeFirstOrThrow();

  // A FIZETŐS funkciók (modul-upsell 0033, multilang 0036, saját webcím 0078) mind az
  // `order_intent` → `payment` láncra épülnek, az pedig a `prospect`-en lóg. Prospect
  // nélkül a demó-tenanttal EGYIK sem próbálható ki lokálban: a rendelés csendben null-t
  // ad, és a felület úgy néz ki, mintha elromlott volna. (Mérve 2026-08-27 a webcím-fülön.)
  await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `demo${lead.id.replace(/-/g, "").slice(0, 12)}` } as never)
    .onConflict((oc) => oc.doNothing())
    .execute();

  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      source_artifact_id: artifact.id,
      status: "live",
      slug: "nyugalom-demo",
      path: `sites/${tenant.id}/index.html`,
      preview_token: `demo_${Date.now().toString(36)}`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  // Every priced module on, so all the settings screens are reachable.
  await setTenantModules(
    tenant.id,
    MODULE_CATALOG.filter((m) => !m.spine).map((m) => m.id),
  );

  // Units: the one truth the rooms, booking and pricing modules all read.
  await ensureUnits(site.id);
  const first = (await getUnits(site.id))[0]!;
  await updateUnit(site.id, first.id, "Kertre néző apartman", 4, null);
  await createUnit(site.id, "Padlásszoba", 2, "Tetőtéri, zuhanyzós szoba.");
  await createUnit(site.id, "Kis faház", 3, null);
  const units = await getUnits(site.id);

  await setBasePrice(units[0]!.id, 19000);
  await addSeasonPrice(units[0]!.id, "Főszezon", "06-15", "08-31", 28000);
  await setBasePrice(units[1]!.id, 12000);
  await setBasePrice(units[2]!.id, 15000);
  await addSeasonPrice(units[2]!.id, "Ünnepek", "12-20", "01-05", 22000);

  await setSiteModuleConfig(site.id, "amenities", {
    items: ["Ingyenes wifi", "Ingyenes parkolás", "Reggeli kérhető", "Klíma", "Kerti grill"],
  }, "demo");
  await setSiteModuleConfig(site.id, "usp", {
    items: ["Kétperces séta a nádasig", "Saját stég", "Csendes zsákutca"],
  }, "demo");
  await setSiteModuleConfig(site.id, "poi", {
    items: ["Strand — 300 m", "Öreg-hegyi kilátó — 1,2 km", "Halászcsárda — 600 m"],
  }, "demo");
  await setSiteModuleConfig(site.id, "hours", {
    checkInFrom: "15:00", checkInTo: "20:00", checkOutUntil: "10:00",
    note: "Késői érkezés előre egyeztetve lehetséges.",
  }, "demo");
  await setSiteModuleConfig(site.id, "pricing", {
    currency: "HUF", unit: "per_night", note: "Az ár tartalmazza az idegenforgalmi adót.",
  }, "demo");
  await setSiteModuleConfig(site.id, "location", {
    showMap: true,
    approachNote: "A főúton a templomnál forduljon jobbra, a ház a harmadik a sorban.",
    parkingNote: "Ingyenes parkolás az udvarban",
  }, "demo");
  await setSiteModuleConfig(site.id, "newsletter", {
    title: "Maradjunk kapcsolatban", subtitle: "Évente néhányszor írunk, akciókról és szabad időpontokról.",
  }, "demo");
  await setSiteModuleConfig(site.id, "booking", {
    minNights: 2, maxNights: 14, horizonMonths: 12, leadTimeDays: 0,
    notifyEmail: "info@nyugalom.example", autoDeclineHours: 48,
  }, "demo");

  // Per-unit content + photo assignment, so the unit subpages have something to say.
  const u = await getUnits(site.id);
  await setUnitAmenities(site.id, u[0]!.id, ["Saját fürdőszoba", "Terasz", "Klíma"]);
  await setUnitAmenities(site.id, u[1]!.id, ["Zuhanyzó", "Tetőablak"]);
  await setUnitAmenities(site.id, u[2]!.id, ["Faház, saját kert"]);
  await updateUnit(site.id, u[0]!.id, u[0]!.name, 4, "Külön bejáratú, teraszos apartman a kert felé.");
  await updateUnit(site.id, u[2]!.id, u[2]!.name, 3, "Kis faház a telek végében, saját tűzrakóval.");
  await setTenantPhotoUnits(tenant.id, siteData.photos[1]!.url, [u[0]!.id]);
  await setTenantPhotoUnits(tenant.id, siteData.photos[2]!.url, [u[2]!.id]);

  const rendered = await rerenderTenantSnapshot(tenant.id, { as: "live" });
  const login = await issueTenantLogin(tenant.id, NAME, "info@nyugalom.example");

  const port = process.env.PUBLIC_PORT ?? "4800";
  console.log(`\n✅ Demó-bérlő kész${rendered ? " (oldal kirenderelve)" : " — a render nem futott le"}.\n`);
  console.log(`  Belépés:        http://localhost:${port}/login`);
  console.log(`  Felhasználó:    ${login.username}`);
  console.log(`  Jelszó:         ${login.password}`);
  console.log(`\n  Az oldal:       http://localhost:${port}/site/${(await db.selectFrom("site").select("preview_token").where("id","=",site.id).executeTakeFirstOrThrow()).preview_token}`);
  console.log(`  Modulok:        /admin?tab=modulok  → Beállítás gomb soronként`);
  console.log(`\n  Telefonról (Tailscale): cseréld a localhost-ot a gép nevére/IP-jére.\n`);
} finally {
  await pool.end();
}
