#!/usr/bin/env npx tsx
/**
 * PAID-MODULE ANCHOR guard — every module the tenant pays for either SHOWS on the live
 * page or is NAMED as "kifizette, de üres" in the admin. A third state — paid, silent,
 * absent — must not exist.
 *
 *   npx tsx scripts/paid-module-anchor-check.mts [--self-test]
 *
 * THE MEASURED HOLE (T-1, Elek live test 2026-10-01, tenant `teszt-muschel-panzio`): the
 * 11-module package held `location`, the admin said active, "Térkép látszódjon" was on,
 * address + coordinates were known — and the live HTML had NO `data-cit-module="map"`.
 * `moduleContentFor()` handed `location` to the renderer only next to a typed approach or
 * parking note; a fresh purchase has no config row at all, so the renderer saw "no
 * location" and `locationBlock()` read that as "map off". The paid-empty predicate kept
 * claiming location "always renders", so not a single screen said a word.
 *
 * ⛔ WHY THIS GUARD AND NOT module-render-check: that one feeds `renderSite()` a
 * hand-built SiteData that already carries `location: { showMap, approachNote, … }` —
 * it starts AFTER the layer that dropped the module, so it was green throughout. This
 * guard starts where the owner starts: entitlement rows + (absent or saved) config rows
 * on a real DB tenant, through `effectiveSiteForMultilang()` — the SAME assembly the
 * live snapshot is rendered from — and then across every art template.
 *
 * THE INVARIANT, per billed module with a page anchor (catalog `domType`):
 *   anchor on the live page  ∨  listed by paidButEmptyModules()
 * Modules without a `domType` (email, multilang) are not page sections — derived from the
 * catalog, not a hand list, so a new page module falls under the guard automatically.
 *
 * Scenarios:
 *   ① fresh purchase — every sellable module entitled, NO config row (what convertLead leaves)
 *   ② Elek's state — location config saved as { showMap: true, notes empty }
 *   ③ NEGATIVE CONTROL — the owner switched the map OFF: the anchor must go
 *   ④ end-to-end — the real snapshot writer (rerenderTenantSnapshot) puts the map in the file
 *
 * --self-test: re-applies the removed "notes-only" filter to the measured data and requires
 * the location assertions to go RED. A guard never seen red proves nothing.
 *
 * Fixture: throwaway tenant on the SHARED dev DB (removed in `finally`); the snapshot file
 * goes to a private temp dir, never into the shared sites/.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { db } from "../src/db/client.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { MODULE_CATALOG, detectPresentModules } from "../src/modules.js";
import { effectiveSiteForMultilang, moduleContentFor, rerenderTenantSnapshot } from "../src/tenant/editor.js";
import {
  filledContentFields,
  getTenantModules,
  isBilledModule,
  paidButEmptyModules,
} from "../src/tenant/modules.js";

const SELF_TEST = process.argv.includes("--self-test");
const stamp = Date.now().toString(36);
const ids: Record<string, string> = {};
let failures = 0;
let tmpDir = "";

const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const ADDRESS = "8360 Keszthely, Szalasztó utca 12.";
const BASE: SiteData = {
  name: `_paidanchor_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral és árnyas kerttel.",
  highlights: ["Saját parkoló", "Kutyabarát"],
  photos: [
    { url: "/uploads/paidanchor-a.jpg", alt: "kert", provenance: "owner" },
    { url: "/uploads/paidanchor-b.jpg", alt: "szoba", provenance: "owner" },
  ],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: ADDRESS },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;

/** Page modules = catalog entries with a page anchor, sellable today. */
const PAGE_MODULES = MODULE_CATALOG.filter((m) => m.domType && !m.retired && !m.spine);
/** Everything a buyer can hold (Elek's 11-module package minus the retired one). */
const ENTITLE = MODULE_CATALOG.filter((m) => !m.retired && !m.spine && m.billing !== "once").map(
  (m) => m.id,
);

/** The filter T-1 removed — used ONLY by --self-test to prove the guard can fail. */
const oldFilter = (d: SiteData): SiteData => {
  const l = d.location;
  if (l && !l.approachNote && !l.parkingNote) {
    const { location: _drop, ...rest } = d as SiteData & { location?: unknown };
    return rest as SiteData;
  }
  return d;
};

const setLocationConfig = async (config: Record<string, unknown> | null): Promise<void> => {
  await db
    .deleteFrom("site_module_config")
    .where("site_id", "=", ids.siteId!)
    .where("module", "=", "location")
    .execute();
  if (config) {
    await db
      .insertInto("site_module_config")
      .values({ site_id: ids.siteId!, module: "location", version: 1, config: JSON.stringify(config) })
      .execute();
  }
};

interface Measured {
  /** template id → module ids with no anchor and no paid-empty row */
  readonly silent: Map<string, string[]>;
  /** template id → the map section carries a real query */
  readonly mapWithQuery: Map<string, boolean>;
  readonly paidEmpty: string[];
}

const measure = async (): Promise<Measured> => {
  const eff = await effectiveSiteForMultilang(ids.tenantId!);
  if (!eff) throw new Error("effectiveSiteForMultilang → null (a fixtúra nem renderelhető)");
  const effective = SELF_TEST ? oldFilter(eff.effective) : eff.effective;
  const mv = await getTenantModules(ids.tenantId!);
  const content = await moduleContentFor(ids.tenantId!, ids.siteId!, []);
  const contentData = { ...(content.data as unknown as Record<string, unknown>) };
  const paidEmpty = paidButEmptyModules(mv, filledContentFields(contentData)).map((m) => m.id);
  const billedPage = mv.modules
    .filter(isBilledModule)
    .map((m) => m.id)
    .filter((id) => PAGE_MODULES.some((p) => p.id === id));

  const silent = new Map<string, string[]>();
  const mapWithQuery = new Map<string, boolean>();
  for (const t of Object.keys(TEMPLATES)) {
    const recipe: Recipe = { ...eff.site.recipe, template: t };
    const html = renderSite(recipe, effective, { phase: "live", hideGallery: eff.hideGallery });
    const present = new Set(detectPresentModules(html));
    const lost = billedPage.filter((id) => !present.has(id) && !paidEmpty.includes(id));
    if (lost.length) silent.set(t, lost);
    mapWithQuery.set(t, /data-cit-module="map"[^>]*data-cit-query="[^"]+"/.test(html));
  }
  return { silent, mapWithQuery, paidEmpty };
};

const describeSilent = (m: Map<string, string[]>): string =>
  [...m.entries()]
    .slice(0, 5)
    .map(([t, lost]) => `${t}: ${lost.join(",")}`)
    .join(" · ") + (m.size > 5 ? ` · …(+${m.size - 5})` : "");

const mapEverywhere = (m: Measured): boolean => [...m.mapWithQuery.values()].every(Boolean);
const mapNowhere = (m: Measured): boolean => [...m.mapWithQuery.values()].every((v) => !v);
const silentLocation = (m: Measured): string[] =>
  [...m.silent.entries()].filter(([, lost]) => lost.includes("location")).map(([t]) => t);

try {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "paidanchor-"));
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: `_paidanchor_${stamp}`,
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
    .values({ scrape_run_id: run.id, name: `_paidanchor_${stamp} lead`, raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const recipe: Recipe = { template: "editorial", skin: "", archetype: "", sections: [] };
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: null, inputs: JSON.stringify({ recipe, siteData: BASE }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.artId = art.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: `_paidanchor_${stamp} tenant` })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      source_artifact_id: art.id,
      preview_token: `paidanchor_${stamp}`,
      slug: `paidanchor-${stamp}`,
      status: "live",
      live_at: new Date(),
      // Absolute → renderAndPersist resolves it as-is: the snapshot never touches sites/.
      path: path.join(tmpDir, "index.html"),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;
  await db
    .insertInto("module_entitlement")
    .values(ENTITLE.map((module) => ({ tenant_id: tenant.id, module, active: true })))
    .execute();

  console.log(
    `\nFixtúra: ${ENTITLE.length} megvett modul (${ENTITLE.join(", ")}), ` +
      `${Object.keys(TEMPLATES).length} sablon, cím + koordináta megvan.`,
  );

  console.log(`\n① FRISS VÁSÁRLÁS — nincs egyetlen config-sor sem (ahogy a konverzió hagyja):`);
  await setLocationConfig(null);
  const fresh = await measure();
  check(
    "⛔ minden megvett modul vagy LÁTSZIK, vagy „kifizette, de üres” sort kap — mindegyik sablonon",
    fresh.silent.size === 0,
    describeSilent(fresh.silent),
  );
  check(
    "a térkép-szakasz valós címmel/koordinátával kint van mindegyik sablonon",
    mapEverywhere(fresh),
    `hiányzik: ${silentLocation(fresh).slice(0, 6).join(", ")}`,
  );

  console.log(`\n② ELEK ÁLLAPOTA — „Térkép látszódjon” be, megközelítés és parkolás üres:`);
  await setLocationConfig({ showMap: true, approachNote: "", parkingNote: "" });
  const elek = await measure();
  check(
    "⛔ a térkép-modul nem tűnik el némán",
    silentLocation(elek).length === 0,
    `néma hiány: ${silentLocation(elek).slice(0, 6).join(", ")}`,
  );
  check("a térkép-szakasz kint van mindegyik sablonon", mapEverywhere(elek));

  console.log(`\n③ NEGATÍV KONTROLL — a tulaj KIKAPCSOLTA a térképet (szöveg nélkül):`);
  await setLocationConfig({ showMap: false, approachNote: "", parkingNote: "" });
  const off = await measure();
  check("a kapcsoló még mindig hat: nincs térkép-lekérdezés egyik sablonon sem", mapNowhere(off));

  console.log(`\n④ VÉGPONTIG — a valódi pillanatkép-író (rerenderTenantSnapshot) fájlja:`);
  await setLocationConfig(null);
  const wrote = await rerenderTenantSnapshot(ids.tenantId);
  const file = wrote ? await readFile(path.join(tmpDir, "index.html"), "utf8") : "";
  const fileHasMap = /data-cit-module="map"[^>]*data-cit-query="[^"]+"/.test(file);
  // --self-test cannot reach into the writer; it re-applies the old filter to the
  // in-process measurements only, so this step is judged the same way in both modes.
  check("a kiírt élő index.html-ben ott a térkép-szakasz", wrote && fileHasMap, wrote ? "" : "nem írt fájlt");
} finally {
  if (ids.siteId) {
    await db.deleteFrom("site_module_config").where("site_id", "=", ids.siteId).execute();
  }
  if (ids.tenantId) {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute();
  }
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.artId) await db.deleteFrom("mock_artifact").where("id", "=", ids.artId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  await db.destroy();
}

if (SELF_TEST) {
  // The old filter must break exactly the location assertions of ① (×2) and ② (×2).
  const expected = 4;
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
