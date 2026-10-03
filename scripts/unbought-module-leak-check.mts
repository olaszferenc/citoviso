#!/usr/bin/env npx tsx
/**
 * UNBOUGHT-MODULE LEAK guard — a live tenant page shows NOTHING the tenant has not bought,
 * apart from the spine. The reverse of paid-module-anchor-check (every bought module shows).
 *
 *   npx tsx scripts/unbought-module-leak-check.mts [--self-test]
 *
 * THE MEASURED HOLE (LV-1, Elek live test 2026-10-02, tenant `teszt-muschel-panzio`): a
 * 3-module order (gallery, enquiry, location) went live with `data-cit-module="usp"` (the
 * lead's highlights: "Medence a kertben, reggeli a teraszon") and `reviews-pending` (a
 * reviews block promising host-moderated guest reviews) on the page, while the tenant admin
 * listed "Miért Önt válasszák" and "Vendégek véleménye" under "Még nem vette meg", and the
 * cold mock's configurator hid both sections when unticked. Measured before the fix on the
 * same data: reviews on 20/20 templates, usp on 15/20. The render never asked which modules
 * were bought — the data those sections draw on (highlights, Google rating) exists anyway.
 *
 * Neither is spine: the catalog's only spine module is `enquiry`; usp and reviews are paid
 * add-ons. So the page was wrong, not the admin.
 *
 * ⚠️ PRESENCE IS READ FROM MARKUP ONLY — <style> and <script> are stripped first. The shared
 * CSS carries `[data-cit-module="amenities"]` / `[data-cit-module="usp"]` selectors, and
 * `detectPresentModules()` on the raw HTML reports those as present (measured: amenities
 * "on the page" on 5 templates with no amenities section at all).
 *
 * Scenarios (throwaway tenant on the shared dev DB, removed in `finally`; the snapshot file
 * goes to a private temp dir, never into the shared sites/):
 *   ① MINIMAL package (gallery + location) — no not-bought page module's anchor, on any
 *      template, via effectiveSiteForMultilang() → renderSite (the live assembly)
 *   ② the cut takes ONLY the module: name, intro and the enquiry spine survive everywhere
 *   ③ POSITIVE CONTROL — usp + reviews bought: their sections ARE on the page again
 *      (a guard that strips everything would pass ① and fail here)
 *   ④ end-to-end — the real snapshot writer (rerenderTenantSnapshot) writes no leak
 *   ⑤ no DEAD LINK: every `href="#x"` left on the cut page (masthead, scrolled bar, side
 *      dots, footer) still has an element with id="x" — the cut takes the section AND the
 *      links into it (owner 2026-10-04: „a sticky headerekben csak azok a modulok
 *      szerepelnek, amelyek elérhetőek”). The mock's client-side cut is measured in a
 *      browser by scripts/nav-target-check.mts.
 *
 * --self-test: renders ① and ④-in-process WITHOUT the cut (hideAnchors dropped) and
 * requires the leak assertion to go RED. A guard never seen red proves nothing.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { db } from "../src/db/client.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { MODULE_CATALOG } from "../src/modules.js";
import { effectiveSiteForMultilang, rerenderTenantSnapshot } from "../src/tenant/editor.js";

const SELF_TEST = process.argv.includes("--self-test");
const stamp = Date.now().toString(36);
const ids: Record<string, string> = {};
let failures = 0;
let tmpDir = "";

const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const INTRO = "Csendes utca végén álló panzió, saját udvarral és árnyas kerttel.";
const BASE: SiteData = {
  name: `_leak_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: INTRO,
  // The exact shape of Elek's page: the lead's highlights + a known Google rating.
  highlights: ["Medence a kertben", "Reggeli a teraszon"],
  rating: { value: 4.7, count: 128 },
  photos: [
    { url: "/uploads/leak-a.jpg", alt: "kert", provenance: "owner" },
    { url: "/uploads/leak-b.jpg", alt: "szoba", provenance: "owner" },
    { url: "/uploads/leak-c.jpg", alt: "terasz", provenance: "owner" },
  ],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Szalasztó utca 12." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;

const MINIMAL = ["gallery", "location"];

/** Module anchors present in the MARKUP (stylesheets and scripts stripped). */
const anchorsInMarkup = (html: string): Set<string> => {
  const body = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  return new Set([...body.matchAll(/<[a-zA-Z][^<>]*\sdata-cit-module="([^"]+)"/g)].map((m) => m[1]!));
};

/** In-page link targets (`href="#x"`) in the MARKUP that no element's id answers. */
const deadLinks = (html: string): string[] => {
  const body = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  const ids = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  const hrefs = [...body.matchAll(/<a\b[^<>]*\shref="#([^"]+)"/gi)].map((m) => m[1]!);
  return [...new Set(hrefs.filter((h) => !ids.has(h)))];
};

/** anchor → catalog module (spine excluded: its anchor is allowed everywhere). */
const OWNER_OF = new Map<string, string>();
for (const m of MODULE_CATALOG) {
  if (m.spine) continue;
  for (const a of [m.domType, ...(m.domTypesAlso ?? [])]) if (a) OWNER_OF.set(a, m.id);
}
const SPINE_ANCHORS = new Set(
  MODULE_CATALOG.filter((m) => m.spine).flatMap((m) => [m.domType, ...(m.domTypesAlso ?? [])]),
);

const setEntitlements = async (modules: readonly string[]): Promise<void> => {
  await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId!).execute();
  if (modules.length) {
    await db
      .insertInto("module_entitlement")
      .values(modules.map((module) => ({ tenant_id: ids.tenantId!, module, active: true })))
      .execute();
  }
};

interface Measured {
  /** template → not-bought modules whose anchor is in the markup */
  readonly leaks: Map<string, string[]>;
  /** template → what the cut took that it must not (name / intro / spine) */
  readonly collateral: Map<string, string[]>;
  /** template → anchors present (for the positive control) */
  readonly present: Map<string, Set<string>>;
  /** template → `#x` links with no id="x" on the page */
  readonly dead: Map<string, string[]>;
}

const measure = async (bought: readonly string[]): Promise<Measured> => {
  const eff = await effectiveSiteForMultilang(ids.tenantId!);
  if (!eff) throw new Error("effectiveSiteForMultilang → null (a fixtúra nem renderelhető)");
  const hideAnchors = SELF_TEST ? [] : eff.hideAnchors;
  const leaks = new Map<string, string[]>();
  const collateral = new Map<string, string[]>();
  const present = new Map<string, Set<string>>();
  const dead = new Map<string, string[]>();
  for (const t of Object.keys(TEMPLATES)) {
    const recipe: Recipe = { ...eff.site.recipe, template: t };
    const html = renderSite(recipe, eff.effective, { phase: "live", hideGallery: eff.hideGallery, hideAnchors });
    const anchors = anchorsInMarkup(html);
    present.set(t, anchors);
    const d = deadLinks(html);
    if (d.length) dead.set(t, d);
    const leaked = [...anchors]
      .map((a) => OWNER_OF.get(a))
      .filter((id): id is string => Boolean(id) && !bought.includes(id!) && id !== "booking");
    if (leaked.length) leaks.set(t, [...new Set(leaked)]);
    const lost: string[] = [];
    if (!html.includes(BASE.name)) lost.push("név");
    if (!html.includes(INTRO.slice(0, 30))) lost.push("bevezető");
    if (![...anchors].some((a) => SPINE_ANCHORS.has(a))) lost.push("gerinc (érdeklődés)");
    if (lost.length) collateral.set(t, lost);
  }
  return { leaks, collateral, present, dead };
};

const describe = (m: Map<string, string[]>): string =>
  [...m.entries()]
    .slice(0, 6)
    .map(([t, v]) => `${t}: ${v.join(",")}`)
    .join(" · ") + (m.size > 6 ? ` · …(+${m.size - 6})` : "");

try {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "leakcheck-"));
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: `_leak_${stamp}`,
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
    .values({ scrape_run_id: run.id, name: `_leak_${stamp} lead`, raw: JSON.stringify({}) })
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
    .values({ lead_id: lead.id, display_name: `_leak_${stamp} tenant` })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      source_artifact_id: art.id,
      preview_token: `leak_${stamp}`,
      slug: `leak-${stamp}`,
      status: "live",
      live_at: new Date(),
      // Absolute → renderAndPersist resolves it as-is: the snapshot never touches sites/.
      path: path.join(tmpDir, "index.html"),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;

  const n = Object.keys(TEMPLATES).length;
  console.log(`\nFixtúra: kiemelések + Google-értékelés az adatban (Elek lapjának alakja), ${n} sablon.`);

  console.log(`\n① ALAP CSOMAG (${MINIMAL.join(" + ")} + gerinc) — nem megvett modul nem látszik:`);
  await setEntitlements(MINIMAL);
  const min = await measure(MINIMAL);
  check(`⛔ egyik sablonon sincs nem megvett modul szekciója (${n} sablon)`, min.leaks.size === 0, describe(min.leaks));

  console.log(`\n② A VÁGÁS CSAK A MODULT VISZI:`);
  check("név, bevezető és az érdeklődés-gerinc minden sablonon megmaradt", min.collateral.size === 0, describe(min.collateral));

  console.log(`\n⑤ NINCS HALOTT LINK — a vágott lapon minden #horgony-linknek van célja:`);
  check(`⛔ egyik sablonon sincs cél nélküli #-link (fejléc, görgetett sáv, pöttyök, lábléc)`, min.dead.size === 0, describe(min.dead));

  console.log(`\n③ POZITÍV KONTROLL — usp + reviews megvéve:`);
  const plus = [...MINIMAL, "usp", "reviews"];
  await setEntitlements(plus);
  const full = await measure(plus);
  const noReviews = [...full.present.entries()].filter(([, a]) => !a.has("reviews-pending")).map(([t]) => t);
  const uspCount = [...full.present.values()].filter((a) => a.has("usp")).length;
  check("a vélemény-szekció visszajön mindegyik sablonon", noReviews.length === 0, `hiányzik: ${noReviews.join(", ")}`);
  check(
    `a kiemelés-szekció (usp) visszajön (${uspCount}/${n} sablon; a horgony nélküli sablonokon a mock sem tudja kapcsolni)`,
    uspCount >= 15,
  );
  check("megvéve nincs szivárgás-jelzés (a mérés nem jelez hamisan)", full.leaks.size === 0, describe(full.leaks));
  check("megvéve sincs cél nélküli #-link", full.dead.size === 0, describe(full.dead));

  console.log(`\n④ VÉGPONTIG — a valódi pillanatkép-író (rerenderTenantSnapshot) fájlja, alap csomaggal:`);
  await setEntitlements(MINIMAL);
  if (SELF_TEST) {
    console.log("  (öntesztben kihagyva — a fájl-író a javított kódot futtatja)");
  } else {
    const wrote = await rerenderTenantSnapshot(ids.tenantId!);
    const file = wrote ? await readFile(path.join(tmpDir, "index.html"), "utf8") : "";
    const leaked = [...anchorsInMarkup(file)]
      .map((a) => OWNER_OF.get(a))
      .filter((id) => id && !MINIMAL.includes(id) && id !== "booking");
    check("a kiírt élő index.html-ben nincs nem megvett modul", wrote && leaked.length === 0, wrote ? leaked.join(",") : "nem írt fájlt");
  }
} finally {
  if (ids.tenantId) {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute();
  }
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
  // ⑤'s measurement must SEE a dead link: a real page with one linked section's id
  // planted away has to come back with exactly that target.
  const page = renderSite({ template: "parallax", skin: "", archetype: "", sections: [] } as Recipe, BASE, { phase: "live" });
  const planted = deadLinks(page.replace(' id="t-gallery"', ""));
  const sees = planted.length === 1 && planted[0] === "t-gallery" && deadLinks(page).length === 0;
  console.log(`  ${sees ? "✅" : "❌"} ⑤ ültetett halott link (#t-gallery cél nélkül) — a mérés ${sees ? "jelzi" : "NEM jelzi"}: ${planted.join(",")}`);
  // Without the cut, ① must go red (the leak) — and ONLY ①: ② and ③ are about the cut's
  // precision, which an absent cut cannot violate.
  const ok = failures === 1 && sees;
  console.log(
    ok
      ? `\n✅ ÖNTESZT: vágás nélkül a szivárgás-állítás bukott (1/1) — az őr lát\n`
      : `\n❌ ÖNTESZT: ${failures} bukás a várt 1 helyett — az őr NEM a vágást méri\n`,
  );
  process.exit(ok ? 0 : 1);
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : `\n✅ minden állítás teljesült\n`);
process.exit(failures ? 1 : 0);
