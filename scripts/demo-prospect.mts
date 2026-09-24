// DEMO PROSPECT — wire the local demo tenant's lead to a rendered, approved mock
// so the FULL buyer funnel is clickable end to end WITHOUT AI or scraping:
//
//     /p/<token>  →  „Élesítés" (configurator)  →  order  →  checkout  →  Barion
//
// WHY: the Barion acquirer review performs a test purchase. Our purchase paths all
// hang off a prospect whose mock_artifact has a real file on disk (getProspectByToken
// refuses a prospect without artifactPath — measured: /p/<token> 404s). demo-tenant.mts
// creates the tenant+lead+artifact but leaves the artifact file unrendered and the
// prospect unwired. This script closes exactly that gap, on the product's own rails:
// the SAME renderSite + frameDemoMock the intake pipeline uses — no hand-made HTML.
//
// Idempotent: re-running re-renders the same artifact file and keeps the wiring.
// Run AFTER scripts/demo-tenant.mts:
//
//   npx tsx scripts/demo-prospect.mts
//
// Local-first (deploy doctrine §0.1). On prod it only runs with the same explicit
// permission any prod write needs — it refuses non-local DBs the same way
// demo-tenant.mts does, and the prod copy is a deliberate, separate decision.

import { writeFile } from "node:fs/promises";
import { db, pool } from "../src/db/client.js";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { frameDemoMock } from "../src/generator/demoFrame.js";
import { checkDemoFraming } from "../src/generator/provenanceCheck.js";
import { mockArtifactPath } from "../src/generator/persist.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

const dsn = config.databaseUrl ?? process.env.DATABASE_URL ?? "";
if (dsn && !/@?(localhost|127\.0\.0\.1)|\/tmp|\.pgdata/.test(dsn)) {
  console.error("⛔ Ez a script CSAK helyi adatbázison futhat (élesre: külön, kimondott engedéllyel)."); // i18n-exempt: operator log
  process.exit(1);
}

const NAME = "Nyugalom Vendégház";

try {
  // The demo lead is the one that OWNS the demo tenant — the reviewer lead below
  // carries the same name, so the name alone is ambiguous.
  const lead = await db
    .selectFrom("lead")
    .innerJoin("tenant", "tenant.lead_id", "lead.id")
    .select(["lead.id as id", "lead.name as name"])
    .where("lead.name", "=", NAME)
    .executeTakeFirst();
  if (!lead) throw new Error("nincs demó-lead — előbb: npx tsx scripts/demo-tenant.mts");

  const artifact = await db
    .selectFrom("mock_artifact")
    .select(["id", "inputs", "status", "path"])
    .where("lead_id", "=", lead.id)
    .executeTakeFirstOrThrow();

  const inputs = artifact.inputs as unknown as { recipe: Recipe; siteData: SiteData };
  if (!inputs?.recipe || !inputs?.siteData) {
    throw new Error("az artifact inputs nem tartalmaz recipe+siteData párost — a demo-tenant.mts írja ezt");
  }

  // The mock phase of the SAME renderer the product uses — deterministic, no AI.
  const html = renderSite(inputs.recipe, inputs.siteData, { phase: "mock" });
  const framed = await frameDemoMock(html);
  const framing = checkDemoFraming(framed);
  if (framing.verdict !== "pass") {
    throw new Error(`demo-framing FLAG: ${JSON.stringify(framing)} — jelöletlen demót nem adunk ki`);
  }

  // One artifact = one file (ADR-0140): the name derives from the artifact id.
  const path = artifact.path ?? mockArtifactPath(lead.name, inputs.recipe.template ?? "engine", artifact.id);
  await writeFile(path, framed, "utf8");
  await db.updateTable("mock_artifact").set({ path }).where("id", "=", artifact.id).execute();

  const prospect = await db
    .selectFrom("prospect")
    .select(["id", "token"])
    .where("lead_id", "=", lead.id)
    .executeTakeFirstOrThrow();
  await db
    .updateTable("prospect")
    .set({ mock_artifact_id: artifact.id } as never)
    .where("id", "=", prospect.id)
    .execute();

  console.log(`\n✅ Demó-prospect bekötve (artifact ${artifact.id.slice(0, 8)} → ${path})`);
  console.log(`   (a tenant-demó linkje — ez NEM vásárlói út: a lead-nek élő oldala van)`);

  // ── REVIEWER PURCHASE PATH (2026-09-24) ────────────────────────────────────
  // The demo lead above OWNS a live site (its tenant), so since the "already
  // bought" branch of /p/<token> (2026-09-20) its link serves the mock WITHOUT
  // the configurator and checkout — measured on prod: the Barion reviewer could
  // not reach the billing e-mail field, so setEncryptedEmail never fired.
  // ownedSiteForLead() keys on the LEAD (tenant.lead_id, paid initial order), so
  // the purchase path needs its own lead: same content, no tenant, no payment.
  // Deterministic token → re-running reuses the same link instead of minting one.
  const demoLead = await db
    .selectFrom("lead")
    .select(["scrape_run_id"])
    .where("id", "=", lead.id)
    .executeTakeFirstOrThrow();
  const reviewToken = `review${lead.id.replace(/-/g, "").slice(0, 12)}`;
  const existing = await db
    .selectFrom("prospect")
    .select(["id", "lead_id"])
    .where("token", "=", reviewToken)
    .executeTakeFirst();
  const reviewLeadId =
    existing?.lead_id ??
    (
      await db
        .insertInto("lead")
        .values({ scrape_run_id: demoLead.scrape_run_id, name: NAME, raw: JSON.stringify({ demo: "review" }) })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  const reviewArtifact =
    (await db
      .selectFrom("mock_artifact")
      .select(["id", "path"])
      .where("lead_id", "=", reviewLeadId)
      .executeTakeFirst()) ??
    (await db
      .insertInto("mock_artifact")
      .values({ lead_id: reviewLeadId, status: "approved", inputs: JSON.stringify(inputs) })
      .returning(["id", "path"])
      .executeTakeFirstOrThrow());
  const reviewPath =
    reviewArtifact.path ?? mockArtifactPath(lead.name, inputs.recipe.template ?? "engine", reviewArtifact.id);
  await writeFile(reviewPath, framed, "utf8");
  await db.updateTable("mock_artifact").set({ path: reviewPath }).where("id", "=", reviewArtifact.id).execute();
  if (existing) {
    await db
      .updateTable("prospect")
      .set({ mock_artifact_id: reviewArtifact.id } as never)
      .where("id", "=", existing.id)
      .execute();
  } else {
    await db
      .insertInto("prospect")
      .values({ lead_id: reviewLeadId, token: reviewToken, mock_artifact_id: reviewArtifact.id } as never)
      .execute();
  }

  console.log(`\n✅ Bírálói vásárlói út (tenant nélküli lead ${reviewLeadId.slice(0, 8)})`);
  console.log(`   A vásárlói út:  http://localhost:4600/p/${reviewToken}`);
  console.log(`   (élesen:        https://citoviso.com/p/${reviewToken})\n`);
} finally {
  await pool.end();
}
