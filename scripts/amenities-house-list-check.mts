#!/usr/bin/env npx tsx
/**
 * ADR-0209 guard — the house-level Felszereltség list is exactly what the owner picked.
 *
 *   npx tsx scripts/amenities-house-list-check.mts [--self-test]
 *
 * THE HOLE IT CLOSES (ADR-0192 ⑧.4, measured 2026-09-22): the renderer used to drop every
 * house-level amenity that also sat on a unit. An owner who ticked the same five things
 * on the Felszereltség screen AND on his rooms lost the paid section from the page
 * entirely — and the Áttekintés then told him "kifizette, de üres, ezért a vendég ma nem
 * látja" about a list he had filled in. Owner ruling 2026-09-23: two separate lists — the
 * house list on the homepage, each room's own list on its card.
 *
 * ⛔ Measured on the renderer's OWN output (`moduleContentFor().data`) and on the same
 * paid-empty predicate the Áttekintés runs — never by counting anchors on a rendered page
 * (ADR-0059 folds content into the template's own section, so anchor counts lie).
 *
 * ⛔ `moduleContentFor()` returns { data, … } — NOT the flat field map. The first draft of
 * this probe read fields off the wrapper, saw `undefined` everywhere and went GREEN on the
 * "it disappears" step for the wrong reason; the positive control is what caught it.
 *
 * NEGATIVE CONTROL: a genuinely EMPTY house list must still vanish and still raise the
 * paid-empty row — otherwise "the list never disappears" could be green because the
 * paid-empty alarm was switched off altogether.
 *
 * --self-test: re-applies the removed filter to the measured data and requires the
 * overlap assertions to go RED. A guard never seen red proves nothing.
 *
 * Fixture: throwaway tenant on the SHARED dev DB, removed in `finally`.
 * All house labels are `scope: "both"` catalogue labels — the only tiles the unit picker
 * also offers — so the state is reachable by clicking, not only by writing the DB.
 */
import { db } from "../src/db/client.js";
import { moduleContentFor } from "../src/tenant/editor.js";
import { getTenantModules, filledContentFields, paidButEmptyModules } from "../src/tenant/modules.js";

const SELF_TEST = process.argv.includes("--self-test");
const stamp = Date.now().toString(36);
const ids: Record<string, string> = {};
let failures = 0;

const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const HOUSE = ["Ingyenes Wi‑Fi", "Légkondicionáló", "Síkképernyős TV"];

/** The filter ADR-0209 removed — used ONLY by --self-test to prove the guard can fail. */
const oldFilter = (house: string[] | undefined, unitAms: string[]): string[] | undefined => {
  if (!house) return house;
  const unitLevel = new Set(unitAms.map((a) => a.trim().toLowerCase()));
  const kept = house.filter((a) => !unitLevel.has(a.trim().toLowerCase()));
  return kept.length ? kept : undefined;
};

const setHouse = async (items: string[]): Promise<void> => {
  await db
    .updateTable("site_module_config")
    .set({ config: JSON.stringify({ items }) })
    .where("site_id", "=", ids.siteId)
    .where("module", "=", "amenities")
    .execute();
};

let unitAms: string[] = [];
const setUnitAmenities = async (am: string[]): Promise<void> => {
  unitAms = am;
  await db
    .updateTable("site_unit")
    .set({ amenities: JSON.stringify(am) })
    .where("site_id", "=", ids.siteId)
    .execute();
};

interface Measured {
  readonly amenities?: string[];
  readonly roomAmenityCounts: number[];
  readonly paidEmpty: string[];
}

const measure = async (): Promise<Measured> => {
  const content = await moduleContentFor(ids.tenantId, ids.siteId, []);
  const data = { ...(content.data as unknown as Record<string, unknown>) };
  if (SELF_TEST) {
    const f = oldFilter(data.amenities as string[] | undefined, unitAms);
    if (f) data.amenities = f;
    else delete data.amenities;
  }
  const mv = await getTenantModules(ids.tenantId);
  const rooms = (data.rooms as { amenities?: unknown[] }[] | undefined) ?? [];
  return {
    amenities: data.amenities as string[] | undefined,
    roomAmenityCounts: rooms.map((r) => r.amenities?.length ?? 0),
    paidEmpty: paidButEmptyModules(mv, filledContentFields(data)).map((m) => m.id),
  };
};

const full = (m: Measured): boolean =>
  Array.isArray(m.amenities) && m.amenities.length === HOUSE.length &&
  HOUSE.every((h) => m.amenities!.includes(h));

try {
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: `_amhouse_${stamp}`,
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
    .values({ scrape_run_id: run.id, name: `_amhouse_${stamp} lead`, raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: `_amhouse_${stamp} tenant` })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      preview_token: `amhouse_${stamp}`,
      slug: `amhouse-${stamp}`,
      status: "live",
      live_at: new Date(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;

  await db
    .insertInto("site_unit")
    .values([
      { site_id: site.id, name: "Kisház", sort_order: 0, is_whole_property: false },
      { site_id: site.id, name: "Nagyház", sort_order: 1, is_whole_property: false },
    ])
    .execute();
  await db
    .insertInto("module_entitlement")
    .values([
      { tenant_id: tenant.id, module: "amenities", active: true },
      { tenant_id: tenant.id, module: "rooms", active: true },
    ])
    .execute();
  await db
    .insertInto("site_module_config")
    .values({
      site_id: site.id,
      module: "amenities",
      version: 1,
      config: JSON.stringify({ items: HOUSE }),
    })
    .execute();

  console.log(`\n① POZITÍV KONTROLL — a szobákon nincs közös tétel:`);
  await setUnitAmenities(["Zuhanyzó"]);
  const ctrl = await measure();
  check("a ház-szintű lista teljes", full(ctrl), JSON.stringify(ctrl.amenities));
  check("nincs „kifizette, de üres” sor", !ctrl.paidEmpty.includes("amenities"));

  console.log(`\n② RÉSZLEGES ÁTFEDÉS — 3-ból 2 a szobákon is:`);
  await setUnitAmenities(["Ingyenes Wi‑Fi", "Légkondicionáló"]);
  const part = await measure();
  check("⛔ a ház-szintű lista NEM fogyatkozik meg", full(part), JSON.stringify(part.amenities));

  console.log(`\n③ TELJES ÁTFEDÉS (ADR-0192 ⑧.4) — minden tétel a szobákon is (kis/nagybetű, szóköz):`);
  await setUnitAmenities(["ingyenes wi‑fi", "  Légkondicionáló ", "SÍKKÉPERNYŐS TV"]);
  const all = await measure();
  check("⛔ a ház-szintű lista MEGMARAD", full(all), JSON.stringify(all.amenities));
  check(
    "⛔ és NINCS hamis „kifizette, de üres” sor",
    !all.paidEmpty.includes("amenities"),
    `paidEmpty = [${all.paidEmpty.join(", ")}]`,
  );
  check(
    "a szobák a SAJÁT listájukat viszik (mindkét kártyán 3 tétel)",
    all.roomAmenityCounts.length === 2 && all.roomAmenityCounts.every((n) => n === 3),
    JSON.stringify(all.roomAmenityCounts),
  );

  console.log(`\n④ NEGATÍV KONTROLL — a ház-szintű lista TÉNYLEG üres:`);
  await setHouse([]);
  const empty = await measure();
  check("a szakasz nincs a kimenetben", empty.amenities === undefined, JSON.stringify(empty.amenities));
  check(
    "és a „kifizette, de üres” sor TOVÁBBRA IS megjelenik",
    empty.paidEmpty.includes("amenities"),
    `paidEmpty = [${empty.paidEmpty.join(", ")}]`,
  );
} finally {
  if (ids.siteId) {
    await db.deleteFrom("site_module_config").where("site_id", "=", ids.siteId).execute();
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute();
  }
  if (ids.tenantId) {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute();
  }
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await db.destroy();
}

if (SELF_TEST) {
  // The removed filter must break exactly the overlap assertions: ② list, ③ list, ③ paid-empty.
  const expected = 3;
  const ok = failures === expected;
  console.log(
    ok
      ? `\n✅ ÖNTESZT: a visszarontott szűrőn ${failures} állítás bukott (várt: ${expected}) — az őr lát\n`
      : `\n❌ ÖNTESZT: ${failures} bukás a várt ${expected} helyett — az őr NEM a szűrőt méri\n`,
  );
  process.exit(ok ? 0 : 1);
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : `\n✅ minden állítás teljesült\n`);
process.exit(failures ? 1 : 0);
