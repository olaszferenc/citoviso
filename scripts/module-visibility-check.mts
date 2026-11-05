#!/usr/bin/env npx tsx
/**
 * MODULE VISIBILITY guard (ADR-0426, migration 0126) — the owner's „Látható / Nem látható"
 * switch takes a module off the GUEST page without cancelling it.
 *
 *   npx tsx scripts/module-visibility-check.mts [--self-test]
 *
 * Owner, 2026-11-05: „minden modulnál lehessen: inaktiválni / aktiválni (azaz látható nem
 * látható) NEM CSAK LEIRATKOZÁS!" — approved plan design-refs/console/modul-lathatosag ("A").
 *
 * Scenarios (throwaway tenant on the shared dev DB, removed in `finally`), every template:
 *   ① all shown: gallery and the real (non-sample) booking calendar are on the page
 *   ② gallery hidden: the gallery section goes (as when unbought), the hero photo STAYS
 *      (KÖT ④), no dead link
 *   ③ pricing hidden: the booking calendar stays — and every
 *      guest-facing price reader (siteShowsModule) says „no", while the ADMIN reader
 *      (siteRendersModule) still says „owned" (KÖT ② ⑤)
 *   ④ booking hidden: the calendar goes AND the enquiry form takes its slot back (KÖT ⑥)
 *   ⑤ the write is bounded: the spine (enquiry) and a module the tenant does not hold
 *      cannot be hidden; billing columns are untouched
 *   ⑥ the DB trigger: when the module's `active` flips, the hide is cleared
 *
 * --self-test: renders with the hidden set IGNORED (owned = shown) and requires ②③④ to go
 * red. A guard never seen red proves nothing.
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { db } from "../src/db/client.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { effectiveSiteForMultilang } from "../src/tenant/editor.js";
import { setModuleHidden, siteRendersModule, siteShowsModule } from "../src/tenant/modules.js";

const SELF_TEST = process.argv.includes("--self-test");
const stamp = Date.now().toString(36);
const ids: Record<string, string> = {};
let failures = 0;
let tmpDir = "";

const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const HERO = "/uploads/vis-hero.jpg";
const BASE: SiteData = {
  name: `_vis_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  highlights: ["Medence a kertben", "Reggeli a teraszon"],
  rating: { value: 4.7, count: 128 },
  intro: "Csendes utca végén álló panzió, saját udvarral és árnyas kerttel.",
  photos: [
    { url: HERO, alt: "kert", provenance: "owner" },
    { url: "/uploads/vis-b.jpg", alt: "szoba", provenance: "owner" },
    { url: "/uploads/vis-c.jpg", alt: "terasz", provenance: "owner" },
    { url: "/uploads/vis-d.jpg", alt: "udvar", provenance: "owner" },
  ],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Szalasztó utca 12." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;

const GALLERY_ONLY = ["/uploads/vis-b.jpg", "/uploads/vis-c.jpg", "/uploads/vis-d.jpg"];
const OWNED = ["gallery", "pricing", "booking", "location", "enquiry"];

const markup = (html: string): string =>
  html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
const anchorsIn = (html: string): Set<string> =>
  new Set([...markup(html).matchAll(/<[a-zA-Z][^<>]*\sdata-cit-module="([^"]+)"/g)].map((m) => m[1]!));
const deadLinks = (html: string): string[] => {
  const body = markup(html);
  const idSet = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  const hrefs = [...body.matchAll(/<a\b[^<>]*\shref="#([^"]+)"/gi)].map((m) => m[1]!);
  return [...new Set(hrefs.filter((h) => !idSet.has(h)))];
};

const setHidden = async (hidden: readonly string[]): Promise<void> => {
  await db
    .updateTable("module_entitlement")
    .set({ hidden_at: null, hidden_by: null })
    .where("tenant_id", "=", ids.tenantId!)
    .execute();
  for (const m of hidden) {
    if (SELF_TEST) continue; // the self-test renders as if the switch did nothing
    const ok = await setModuleHidden(ids.tenantId!, m, true, "module-visibility-check");
    if (!ok) throw new Error(`setModuleHidden(${m}) → false a fixtúrán`);
  }
};

interface Page {
  readonly anchors: Set<string>;
  readonly html: string;
  readonly dead: string[];
}
const renderAll = async (): Promise<Map<string, Page>> => {
  const eff = await effectiveSiteForMultilang(ids.tenantId!);
  if (!eff) throw new Error("effectiveSiteForMultilang → null (a fixtúra nem renderelhető)");
  const out = new Map<string, Page>();
  for (const t of Object.keys(TEMPLATES)) {
    const recipe: Recipe = { ...eff.site.recipe, template: t };
    const html = renderSite(recipe, eff.effective, {
      phase: "live",
      hideGallery: eff.hideGallery,
      hideAnchors: eff.hideAnchors,
    });
    out.set(t, { anchors: anchorsIn(html), html: markup(html), dead: deadLinks(html) });
  }
  return out;
};

/** Templates where `pred` FAILS (the names), for the detail column. */
const failing = (pages: Map<string, Page>, pred: (p: Page) => boolean): string[] =>
  [...pages.entries()].filter(([, p]) => !pred(p)).map(([t]) => t);
const short = (xs: string[]): string => (xs.length ? xs.slice(0, 6).join(", ") + (xs.length > 6 ? ` …(+${xs.length - 6})` : "") : "");

try {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "vischeck-"));
  const def = await db
    .insertInto("scraper_definition")
    .values({ label: `_vis_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
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
    .values({ scrape_run_id: run.id, name: `_vis_${stamp} lead`, raw: JSON.stringify({}) })
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
    .values({ lead_id: lead.id, display_name: `_vis_${stamp} tenant` })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      source_artifact_id: art.id,
      preview_token: `vis_${stamp}`,
      slug: `vis-${stamp}`,
      status: "live",
      live_at: new Date(),
      // Absolute → the snapshot never touches the shared sites/.
      path: path.join(tmpDir, "index.html"),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;
  await db
    .insertInto("module_entitlement")
    .values(OWNED.map((module) => ({ tenant_id: tenant.id, module, active: true })))
    .execute();
  const n = Object.keys(TEMPLATES).length;
  console.log(`\nFixtúra: ${OWNED.join(" + ")} megvéve, ${n} sablon.`);

  console.log(`\n① MIND LÁTHATÓ:`);
  await setHidden([]);
  const all = await renderAll();
  const allNoGallery = failing(all, (p) => p.anchors.has("gallery"));
  check(`a galéria-szakasz kint van`, allNoGallery.length <= n / 4, `nincs galéria-horgony: ${short(allNoGallery)}`);
  check(`a foglalási naptár kint van mindegyik sablonon`, failing(all, (p) => p.anchors.has("booking-section")).length === 0,
    short(failing(all, (p) => p.anchors.has("booking-section"))));
  // The calendar section's inner div carries the shared "booking" anchor (moduleSections.ts) —
  // what tells the real calendar from the enquiry form is the runtime's non-demo config.
  const realCal = (p: Page): boolean => /data-cit-module="booking-section"/.test(p.html) && !/data-cit-demo="1"/.test(p.html);
  check(`a naptár a valódi beállítással fut (nem minta)`, failing(all, realCal).length === 0, short(failing(all, realCal)));

  console.log(`\n② KÉPEK REJTVE:`);
  await setHidden(["gallery"]);
  const g = await renderAll();
  // The cut is the one an UNBOUGHT gallery gets (render.ts withoutGallery): the section goes,
  // or — on a template whose only image place is the gallery (card-sidebar) — it keeps the
  // hero alone. Either way no gallery-only photo is left on the page.
  // (Other sections — about, hero slides — may still use the photos, exactly as without
  // the gallery module; the switch takes the GALLERY, not the pictures.)
  const noGalleryPhotos = (p: Page): boolean => !GALLERY_ONLY.some((u) => p.html.includes(u));
  const kept = failing(g, (p) => !p.anchors.has("gallery"));
  check(`⛔ a galéria-szakasz ment (ahol marad, ott csak a nyitóképpel)`,
    kept.every((t) => noGalleryPhotos(g.get(t)!)) && kept.length <= 1, short(kept));
  check(`a nyitókép megmaradt (kép nélküli oldal tilos)`, failing(g, (p) => p.html.includes(HERO)).length === 0,
    short(failing(g, (p) => p.html.includes(HERO))));
  check(`nincs cél nélküli #-link (a menüpont is ment)`, failing(g, (p) => p.dead.length === 0).length === 0,
    [...g.entries()].filter(([, p]) => p.dead.length).slice(0, 4).map(([t, p]) => `${t}: ${p.dead.join(",")}`).join(" · "));

  console.log(`\n③ ÁRAK REJTVE (Foglalás látható):`);
  await setHidden(["pricing"]);
  const pr = await renderAll();
  // (The pricing SECTION needs priced units to render at all, so on this fixture it is absent
  // either way — the guest-facing READER below is what the switch must flip.)
  check(`a foglalási naptár marad`, failing(pr, (p) => p.anchors.has("booking-section")).length === 0,
    short(failing(pr, (p) => p.anchors.has("booking-section"))));
  check(`⛔ vendég-oldali ár-olvasó (siteShowsModule pricing) = nem`, !(await siteShowsModule(ids.siteId!, "pricing")));
  check(`az admin-olvasó (siteRendersModule pricing) = birtokolja — a beállítás nyitva marad`,
    await siteRendersModule(ids.siteId!, "pricing"));

  console.log(`\n④ FOGLALÁS REJTVE:`);
  await setHidden(["booking"]);
  const bk = await renderAll();
  check(`⛔ a foglalási naptár egyik sablonon sincs`, failing(bk, (p) => !p.anchors.has("booking-section")).length === 0,
    short(failing(bk, (p) => !p.anchors.has("booking-section"))));
  check(`⛔ az érdeklődés-űrlap visszakapta a helyét mindegyik sablonon`, failing(bk, (p) => p.anchors.has("booking")).length === 0,
    short(failing(bk, (p) => p.anchors.has("booking"))));

  console.log(`\n⑤ AZ ÍRÁS KORLÁTOS:`);
  await setHidden([]);
  check(`a gerinc (enquiry) nem rejthető`, !(await setModuleHidden(ids.tenantId!, "enquiry", true, "check")));
  check(`nem birtokolt modul (reviews) nem rejthető`, !(await setModuleHidden(ids.tenantId!, "reviews", true, "check")));
  check(`egyszeri termék (multilang) nem rejthető`, !(await setModuleHidden(ids.tenantId!, "multilang", true, "check")));
  const before = await db.selectFrom("module_entitlement").selectAll().where("tenant_id", "=", ids.tenantId!).where("module", "=", "gallery").executeTakeFirstOrThrow();
  await setModuleHidden(ids.tenantId!, "gallery", true, "check");
  const after = await db.selectFrom("module_entitlement").selectAll().where("tenant_id", "=", ids.tenantId!).where("module", "=", "gallery").executeTakeFirstOrThrow();
  check(`rejtéskor a számlázási mezők érintetlenek (active, cancel_at_period_end)`,
    after.active === before.active && after.cancel_at_period_end === before.cancel_at_period_end && Boolean(after.hidden_at));

  console.log(`\n⑥ DB-TRIGGER — az active váltása törli a rejtést:`);
  await db.updateTable("module_entitlement").set({ active: false }).where("tenant_id", "=", ids.tenantId!).where("module", "=", "gallery").execute();
  const off = await db.selectFrom("module_entitlement").select(["hidden_at", "hidden_by"]).where("tenant_id", "=", ids.tenantId!).where("module", "=", "gallery").executeTakeFirstOrThrow();
  check(`active → false után hidden_at/hidden_by üres`, off.hidden_at === null && off.hidden_by === null);
} finally {
  if (ids.tenantId) await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute();
  if (ids.siteId) {
    await db.deleteFrom("site_module_config").where("site_id", "=", ids.siteId).execute();
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute();
    await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  }
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.artId) await db.deleteFrom("mock_artifact").where("id", "=", ids.artId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  await db.destroy();
}

if (SELF_TEST) {
  // Ignoring the switch must break ② (gallery section), ③ (guest price reader) and ④ (the
  // calendar stays): at least 3 red.
  const ok = failures >= 3;
  console.log(ok
    ? `\n✅ ÖNTESZT: a kapcsoló nélkül ${failures} állítás bukott — az őr lát\n`
    : `\n❌ ÖNTESZT: csak ${failures} bukás — az őr NEM a rejtést méri\n`);
  process.exit(ok ? 0 : 1);
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : `\n✅ minden állítás teljesült\n`);
process.exit(failures ? 1 : 0);
