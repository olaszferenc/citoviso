// A throw-away TEST site behind a domain we already own — the real end-to-end proof of
// the custom-domain chain WITHOUT buying a name (ADR-0394).
//
//   npx tsx scripts/tls-probe-site.mts --domain citoviso.hu   # create site + provisioning
//   npx tsx scripts/tls-probe-site.mts --status               # where the probe stands
//   npx tsx scripts/tls-probe-site.mts --remove               # delete every probe row
//
// ⛔ On production this is a live write: only with the owner's explicit permission.
//
// What it creates: a minimal live site ("[TESZT] Tanúsítvány-próba", slug tls-proba, no
// login → the tenant gets no mail) and a domain_provisioning row at `registered` — the
// purchase is skipped, so the domain-resume timer runs the REAL remaining steps: DNS
// (apex + www A records → the VPS, AAAA removed), dns_pending, tls_pending (the
// citoviso-tenant-tls timer issues the certificate), live (site.custom_domain set,
// re-render). `--remove` deletes the rows; the zone's DNS records are NOT restored —
// that is a separate, deliberate step at the registrar.
import { db, pool } from "../src/db/client.js";
import { ensureUnits } from "../src/tenant/units.js";
import { rerenderTenantSnapshot } from "../src/tenant/editor.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

const LABEL = "_tls_probe";
const NAME = "[TESZT] Tanúsítvány-próba";
const SLUG = "tls-proba";
const args = process.argv.slice(2);
const domainArg = args[args.indexOf("--domain") + 1];

async function probeLeads(): Promise<string[]> {
  const rows = await db
    .selectFrom("lead")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .select("lead.id")
    .where("scraper_definition.label", "=", LABEL)
    .execute();
  return rows.map((r) => r.id);
}

async function status(): Promise<void> {
  const rows = await db
    .selectFrom("domain_provisioning")
    .innerJoin("site", "site.id", "domain_provisioning.site_id")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select(["domain_provisioning.domain", "domain_provisioning.status", "domain_provisioning.error", "site.custom_domain", "site.slug"])
    .where("tenant.display_name", "=", NAME)
    .execute();
  if (rows.length === 0) console.log("nincs próba-beszerzés");
  for (const r of rows) console.log(`${r.domain}: ${r.status}${r.error ? ` (${r.error})` : ""} · site ${r.slug} · custom_domain=${r.custom_domain ?? "—"}`);
}

async function remove(): Promise<void> {
  for (const leadId of await probeLeads()) {
    // site / domain_provisioning cascade from the tenant.
    await db.deleteFrom("tenant").where("lead_id", "=", leadId).execute();
    await db.deleteFrom("mock_artifact").where("lead_id", "=", leadId).execute();
    await db.deleteFrom("lead").where("id", "=", leadId).execute();
  }
  const defs = await db.selectFrom("scraper_definition").select("id").where("label", "=", LABEL).execute();
  for (const d of defs) {
    await db.deleteFrom("scrape_run").where("scraper_definition_id", "=", d.id).execute();
    await db.deleteFrom("scraper_definition").where("id", "=", d.id).execute();
  }
  console.log(`próba-sorok törölve (${defs.length} definíció)`);
}

async function create(domain: string): Promise<void> {
  if ((await probeLeads()).length > 0) throw new Error("már van próba-oldal — előbb: --remove");
  const def = await db
    .insertInto("scraper_definition")
    .values({ label: LABEL, country: "HU", region: "—", industry: "accommodation", sources: JSON.stringify(["osm"]) })
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
  const siteData = {
    name: NAME,
    tagline: "Saját domain tanúsítvány-próba",
    intro: "Ez egy belső tesztoldal: a saját domain automatikus bekötését igazolja (DNS, tanúsítvány, kiszolgálás).",
    highlights: ["DNS", "Let's Encrypt", "nginx"],
    photos: [
      { url: "https://placehold.co/1600x1000/16283f/ffffff?text=Teszt", alt: "Teszt", provenance: "owner" },
    ],
    contact: {},
  } as unknown as SiteData;
  const recipe: Recipe = { template: "fullbleed", skin: "", archetype: "", sections: [] };
  const artifact = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, status: "approved", inputs: JSON.stringify({ recipe, siteData }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: NAME })
    .returning("id")
    .executeTakeFirstOrThrow();
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      source_artifact_id: artifact.id,
      status: "live",
      slug: SLUG,
      path: `sites/${tenant.id}/index.html`,
      preview_token: `tlsprobe_${Date.now().toString(36)}`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await ensureUnits(site.id);
  const rendered = await rerenderTenantSnapshot(tenant.id, { as: "live" });
  await db
    .insertInto("domain_provisioning")
    .values({ site_id: site.id, tenant_id: tenant.id, domain, status: "registered" })
    .execute();
  console.log(`✅ próba-oldal kész (${rendered ? "kirenderelve" : "a render NEM futott"}), beszerzés: ${domain} → registered`);
  console.log("   a domain-resume időzítő viszi tovább; állapot: --status");
}

try {
  if (args.includes("--status")) await status();
  else if (args.includes("--remove")) await remove();
  else if (args.includes("--domain") && domainArg && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domainArg)) await create(domainArg);
  else {
    console.error("használat: tls-probe-site.mts --domain <név> | --status | --remove");
    process.exitCode = 2;
  }
} finally {
  await pool.end();
}
