// ADR-0046 fixture gate: proves the review flow keeps its promises, against the real
// database, on a throwaway site it creates and removes.
//
// WHAT THIS MEASURES AND WHY IT IS NOT module-render-check's JOB: that script proves
// a review that SHOULD show does show. The dangerous direction is the opposite one —
// a review that must NOT show slipping onto the page. Moderation is the entire value
// of the module; if a pending or rejected review can reach the visitor, the owner was
// promised a gate that does not exist. "Van űrlap" was never the question.
//
// The Google badge is measured the same way, in the withholding direction: a weak
// match would print the NEIGHBOUR's stars on this tenant's page (ADR-0043), and a
// stale row would present an old number as today's.
//
//   npx tsx scripts/review-flow-check.mts

import { db, pool } from "../src/db/client.js";
import { moduleContentFor } from "../src/tenant/editor.js";
import { setTenantModules } from "../src/tenant/modules.js";
import { setSiteModuleConfig } from "../src/tenant/siteModuleConfig.js";
import { createReview, decideReview, publishedReviews } from "../src/reviews/reviews.js";
import { getPlaceRating, savePlaceRating } from "../src/reviews/placeRating.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { starIcon } from "../src/engine/icons.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

/** The rendered star glyph — counted to catch stars that survive a switched-off badge. */
const STAR_MARK = starIcon();

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const BASE: SiteData = {
  name: "_rev_check panzió",
  tagline: "Teszt",
  intro: "Teszt bevezető szöveg a fixture-höz.",
  highlights: ["Egy", "Kettő"],
  photos: [{ url: "/uploads/a.jpg", alt: "A", provenance: "owner" }],
  contact: { email: "teszt@example.com" },
};

const ids: {
  defId?: string;
  runId?: string;
  leadId?: string;
  tenantId?: string;
  siteId?: string;
} = {};

console.log("Vélemény-folyamat (eldobható fixture, valódi DB):\n");

try {
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_rev_check",
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
    .values({ scrape_run_id: run.id, name: "_rev_check lead", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;

  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "_rev_check tenant" })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;

  const site = await db
    .insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `rev_${Date.now().toString(36)}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;

  const siteId = site.id;
  const tenantId = tenant.id;
  await setTenantModules(tenantId, ["reviews"]);

  // ── 1. a submitted review is PENDING and invisible ────────────────────────
  const created = await createReview(
    {
      siteId,
      authorName: "Teszt Vendég",
      authorEmail: "vendeg@example.com",
      rating: 5,
      body: "EGYEDI-PENDING-JELZO a fixture ellenőrzéséhez.",
    },
    null,
  );
  check("a beküldött vélemény elfogadásra kerül", created.ok, created.errors);

  const row = await db
    .selectFrom("site_review")
    .select(["status", "action_token"])
    .where("site_id", "=", siteId)
    .executeTakeFirstOrThrow();
  check("az új vélemény PENDING státuszban áll", row.status === "pending", row.status);

  const beforeVerdict = await publishedReviews(siteId);
  check("⭐⭐ döntés ELŐTT a vélemény NEM publikus", beforeVerdict.length === 0, beforeVerdict);

  const contentPending = await moduleContentFor(tenantId, siteId);
  const pendingInData = JSON.stringify(contentPending.data ?? contentPending).includes(
    "EGYEDI-PENDING-JELZO",
  );
  check("⭐⭐ a jóvá NEM hagyott vélemény nem kerül a SiteData-ba", !pendingInData);

  // The real test: through the renderer, in every template.
  {
    const data = { ...BASE, ...(contentPending.data ?? {}) } as SiteData;
    const leaked: string[] = [];
    for (const t of Object.keys(TEMPLATES)) {
      const recipe: Recipe = { template: t, skin: "", archetype: "", sections: [] };
      if (renderSite(recipe, data, { phase: "live" }).includes("EGYEDI-PENDING-JELZO")) {
        leaked.push(t);
      }
    }
    check(
      "⭐⭐ a jóvá NEM hagyott vélemény egyik sablonban sem jelenik meg",
      leaked.length === 0,
      leaked,
    );
  }

  // ── 2. the owner's verdict publishes it ───────────────────────────────────
  const verdict = await decideReview(row.action_token, "published", null);
  check("a tulaj döntése átmegy", verdict.ok && verdict.outcome === "published", verdict);
  check("a döntés visszaadja a tenant-ot (a snapshot újrarendereléséhez)", Boolean(verdict.tenantId));

  const afterVerdict = await publishedReviews(siteId);
  check("döntés UTÁN a vélemény publikus", afterVerdict.length === 1, afterVerdict);

  const twice = await decideReview(row.action_token, "published", null);
  check("a link kétszeri megnyitása nem hibázik (idempotens)", twice.outcome === "already", twice);

  {
    const content = await moduleContentFor(tenantId, siteId);
    const data = { ...BASE, ...(content.data ?? {}) } as SiteData;
    const missing: string[] = [];
    for (const t of Object.keys(TEMPLATES)) {
      const recipe: Recipe = { template: t, skin: "", archetype: "", sections: [] };
      if (!renderSite(recipe, data, { phase: "live" }).includes("EGYEDI-PENDING-JELZO")) {
        missing.push(t);
      }
    }
    check("a jóváhagyott vélemény MINDEN sablonban megjelenik", missing.length === 0, missing);
  }

  // ── 3. withdrawing takes it back down ─────────────────────────────────────
  await db
    .updateTable("site_review")
    .set({ status: "pending" })
    .where("site_id", "=", siteId)
    .execute();
  await decideReview(row.action_token, "rejected", null);
  const afterReject = await publishedReviews(siteId);
  check("⭐⭐ a levett vélemény nem publikus többé", afterReject.length === 0, afterReject);

  // ── 4. the Google badge gates ─────────────────────────────────────────────
  console.log("\nGoogle-értékelés kapui:");

  await savePlaceRating({
    siteId,
    placeId: "ChIJ_rev_check_fixture",
    rating: 4.7,
    userRatingCount: 128,
    matchConfidence: 0.92,
  });
  const strong = await getPlaceRating(siteId);
  check("magas konfidencián a jelvény megjelenik", strong?.rating === 4.7, strong);
  check(
    "a link a Google-véleményekre mutat (attribúció)",
    Boolean(strong?.reviewsUrl.includes("ChIJ_rev_check_fixture")),
    strong?.reviewsUrl,
  );

  await savePlaceRating({
    siteId,
    placeId: "ChIJ_rev_check_fixture",
    rating: 4.7,
    userRatingCount: 128,
    matchConfidence: 0.44,
  });
  check(
    "⭐⭐ GYENGE találatnál a jelvény VISSZATARTVA (nem a szomszéd csillagai)",
    (await getPlaceRating(siteId)) === null,
  );

  await savePlaceRating({
    siteId,
    placeId: "ChIJ_rev_check_fixture",
    rating: 4.7,
    userRatingCount: 128,
    matchConfidence: null,
  });
  check(
    "⭐⭐ ISMERETLEN konfidencia = nem jó hír, a jelvény visszatartva",
    (await getPlaceRating(siteId)) === null,
  );

  await savePlaceRating({
    siteId,
    placeId: "ChIJ_rev_check_fixture",
    rating: 4.7,
    userRatingCount: 128,
    matchConfidence: 0.92,
  });
  await db
    .updateTable("site_place_rating")
    .set({ fetched_at: new Date(Date.now() - 40 * 86_400_000) })
    .where("site_id", "=", siteId)
    .execute();
  check("⭐⭐ ELAVULT adat (40 nap) nem megy ki mai számként", (await getPlaceRating(siteId)) === null);

  // ── 5. the toggle actually does something ─────────────────────────────────
  await db
    .updateTable("site_place_rating")
    .set({ fetched_at: new Date() })
    .where("site_id", "=", siteId)
    .execute();

  const on = await moduleContentFor(tenantId, siteId);
  check("bekapcsolva: a jelvény a SiteData-ban van", Boolean(on.data.googleRating), on.data.googleRating);

  // THE MERGE IS WHAT SHIPS, not moduleContentFor's return value. editor.ts renders
  // `{...siteData, ...moduleContent}`, and a snapshot generated from a cold lead
  // ALREADY carries a rating. So a toggle that merely "adds nothing" leaves the old
  // stars standing — the owner switches it off and the page does not change.
  //
  // Measuring the partial result hid exactly that: this check passed against a
  // deliberately gutted toggle until it was rewritten to render the merged data.
  const inherited = { ...BASE, rating: { value: 4.7, count: 128 } } as SiteData;
  await setSiteModuleConfig(siteId, "reviews", { showGoogleRating: false }, "test");
  const off = await moduleContentFor(tenantId, siteId);
  const merged = { ...inherited, ...off.data } as SiteData;
  check(
    "⭐⭐ KIKAPCSOLVA a jelvény eltűnik a MERGELT adatból (a kapcsoló nem dísz)",
    !merged.googleRating && !merged.rating,
    { googleRating: merged.googleRating, rating: merged.rating },
  );
  {
    // Counting the badge section alone was NOT enough: the stars also ride into the
    // hero through SiteData.rating (honestStarCount), and a gutted toggle left those
    // standing while this check stayed green. So compare against a page that never
    // had a rating — any extra star means something survived the switch-off.
    const noRating = { ...BASE } as SiteData;
    const stillThere: string[] = [];
    for (const t of Object.keys(TEMPLATES)) {
      const recipe: Recipe = { template: t, skin: "", archetype: "", sections: [] };
      const offHtml = renderSite(recipe, merged, { phase: "live" });
      const baseHtml = renderSite(recipe, noRating, { phase: "live" });
      const stars = (h: string): number => h.split(STAR_MARK).length - 1;
      if (offHtml.includes('data-cit-module="google-rating"') || stars(offHtml) > stars(baseHtml)) {
        stillThere.push(`${t}(${stars(offHtml)} vs ${stars(baseHtml)})`);
      }
    }
    check(
      "⭐⭐ KIKAPCSOLVA se jelvény, se hero-csillag nem marad egyik RENDERELT sablonban sem",
      stillThere.length === 0,
      stillThere.slice(0, 4),
    );
  }

  // ── 6. the form appears so the FIRST review can ever arrive ───────────────
  const formOn = await moduleContentFor(tenantId, siteId);
  check("a gyűjtő-űrlap adata jelen van", Boolean(formOn.data.reviewForm), formOn.data.reviewForm);
  {
    const data = { ...BASE, ...formOn.data } as SiteData;
    const missing: string[] = [];
    for (const t of Object.keys(TEMPLATES)) {
      const html = renderSite({ template: t, skin: "", archetype: "", sections: [] }, data, {
        phase: "live",
      });
      if (!html.includes('action="/api/velemeny"')) missing.push(t);
    }
    check(
      "⭐ az űrlap MINDEN sablonban kirenderel (különben sosem jön az első vélemény)",
      missing.length === 0,
      missing,
    );
  }

  await setSiteModuleConfig(siteId, "reviews", { collectEnabled: false }, "test");
  const formOff = await moduleContentFor(tenantId, siteId);
  check(
    "kikapcsolva a gyűjtő-űrlap eltűnik",
    !formOff.data.reviewForm,
    formOff.data.reviewForm,
  );
  const blocked = await createReview(
    { siteId, authorName: "Teszt Kettő", rating: 5, body: "Ez nem mehet át, a gyűjtés kikapcsolva." },
    null,
  );
  check("⭐ kikapcsolt gyűjtésnél a beküldés is elutasul", !blocked.ok, blocked);
} finally {
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}

if (failures) {
  console.error(`\n⛔ review-flow-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ review-flow-check: a moderáció tart, és a Google-jelvény csak fedezettel megy ki.");
