// ADR-0356 — the trial's once-free name change, and the old address that 301s forever.
// What this proves, each leg a way the rename could break a promise or a link:
//   ① the label the buyer chose on /folytatas WINS: a site the trial already built is renamed
//      by the activation's convertLead(preferredSlug) — and activate() really passes it on
//      (read off the source: the same order as the real go-live edge);
//   ② the old slug becomes an alias, ONCE: the same activation run twice writes one alias row;
//   ③ the canonical / og:url of the re-rendered live snapshot says the NEW host, never the old;
//   ④ the old host answers GET with a 301 to the new host, path AND query kept — the root, a
//      mail-linked token route (mailLinkRoutes.ts) and an arbitrary page; HEAD too; a POST is
//      NOT redirected (a 301 turns it into a GET, and a GET never decides);
//   ⑤ the dev /t/<old> path 301s to /t/<new> (only where the dev path is on);
//   ⑥ the old label is never handed out again: another lead cannot pick it on /folytatas
//      (checkSubdomainAvailable), never gets it as a preview label (peekPreviewLabel); the SAME
//      lead may return to it (labelHeldByOther is false for its own alias);
//   ⑦ a choice that is reserved or held by another lead keeps the old address (no throw);
//   ⑧ returning to the own former name swaps the alias: the site gets it back, the name it
//      leaves becomes the alias, and the old host now serves in place (no redirect loop);
//   ⑨ a 40-character cut never leaves a trailing hyphen (an invalid host label).
//
// The dev DB is SHARED: every row is this run's own and deleted in `finally`; the snapshot
// directories under sites/ are removed. EMAIL_PROVIDER must be mock (the trial sends the
// real login letter otherwise).
//
// --self-test: the activation is SABOTAGED (the choice is dropped, as before ADR-0356) —
// legs ① ② ③ ④ must go red, or the guard is blind.
//
// Run: EMAIL_PROVIDER=mock npx tsx scripts/slug-rename-check.mts

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

import http from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Recipe, SiteData } from "../src/engine/recipe.js";

const SELF_TEST = process.argv.includes("--self-test");
const stamp = Date.now().toString(36);
let failures = 0;
const failed: string[] = [];
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) {
    failures++;
    failed.push(label);
  }
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const { config } = await import("../src/config.js");
if (config.emailProvider !== "mock") {
  console.error(`⛔ slug-rename-check: EMAIL_PROVIDER=${config.emailProvider} — a próba valódi belépő-levelet küldene. Futtasd: EMAIL_PROVIDER=mock`);
  process.exit(2);
}

const { db } = await import("../src/db/client.js");
const { PLATFORM_DOMAIN, isPlatformHosting } = await import("../src/domains.js");
const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { startTrial, trialModuleIds } = await import("../src/trial/start.js");
const { convertLead, checkSubdomainAvailable, renameSiteSlug } = await import("../src/conversion/provision.js");
const { labelHeldByOther, peekPreviewLabel } = await import("../src/outreach/previewLabel.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { MAIL_LINK_ROUTES } = await import("../src/server/mailLinkRoutes.js");
const { server } = (await import("../src/server/public.js")) as { server: http.Server };
if (!server.listening) await once(server, "listening");
const port = (server.address() as { port: number }).port;

interface Reply { status: number; location: string | null }
/** Raw request so the Host header actually goes out (fetch drops it). */
const raw = (method: string, host: string, p: string): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: p, method, headers: { Host: host, "content-type": "application/x-www-form-urlencoded" } }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode ?? 0, location: (res.headers.location as string | undefined) ?? null }));
    });
    req.on("error", reject);
    req.end(method === "POST" ? "x=1" : undefined);
  });

// ① the real go-live edge passes the choice to convertLead and re-renders AFTER it.
console.log("① activate() → convertLead(preferredSlug) → live render");
{
  const service = readFileSync(path.resolve("src/payment/service.ts"), "utf8");
  const from = service.slice(service.indexOf("async function activate("));
  const body = from.slice(0, from.indexOf("\n}\n") + 3);
  const convAt = body.indexOf("convertLead(oi.leadId, oi.artifactId, modules, preferredSlug)");
  const renderAt = body.indexOf('rerenderTenantSnapshot(conv.tenantId, { as: "live" })');
  check("activate() a választott címkét adja a convertLead-nek", convAt > 0);
  check("…és UTÁNA renderel élesre (a canonical az új címet mondja)", convAt > 0 && renderAt > convAt);
}

const SITE: SiteData = {
  name: `_slugrename_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/slugrename-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE: Recipe = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;
const MOCK_FILE = path.resolve(process.cwd(), `sites/_slugrename_${stamp}.html`);
const FORM = { name: "Teszt Elek", email: "slugrename@example.invalid", phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true };

const leads: string[] = [];
const tenants: string[] = [];
let defId: string | null = null;
let runId: string | null = null;

async function fixtureLead(tag: string, over: { name?: string; previewLabel?: string } = {}) {
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: runId!,
      name: over.name ?? `_slugrename_${stamp} ${tag}`,
      raw: JSON.stringify({}),
      ...(over.previewLabel ? { preview_label: over.previewLabel } : {}),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: `sites/_slugrename_${stamp}.html`, inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const token = `slugrename${stamp}${tag}xxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  await db.insertInto("prospect").values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date() }).execute();
  return { leadId: lead.id, token, artId: art.id };
}

const siteOf = (leadId: string) =>
  db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select(["site.id as id", "site.slug as slug", "site.status as status", "site.path as path", "tenant.id as tenantId"])
    .where("tenant.lead_id", "=", leadId)
    .executeTakeFirst();
const aliasesOf = (siteId: string) =>
  db.selectFrom("site_slug_alias").select("slug").where("site_id", "=", siteId).execute();

try {
  await writeFile(MOCK_FILE, "<!doctype html><html><head><title>t</title></head><body><main>mock</main></body></html>");
  overrideFreeTrialConfigInProcess({ enabled: true, days: 9 });
  const def = await db
    .insertInto("scraper_definition")
    .values({ label: `_slugrename_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id")
    .executeTakeFirstOrThrow();
  defId = def.id;
  runId = (await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow()).id;

  // The trial builds the site on the lead's preview label — the address the outreach link showed.
  const OLD = `srn-${stamp}-regi`;
  const NEW = `srn-${stamp}-uj`;
  const a = await fixtureLead("a", { previewLabel: OLD });
  const ra = await startTrial(a.token, FORM);
  tenants.push(...(await db.selectFrom("tenant").select("id").where("lead_id", "=", a.leadId).execute()).map((t) => t.id));
  const before = await siteOf(a.leadId);
  check("a próba-site a régi címen él", ra.ok && before?.slug === OLD && before.status === "live", `${JSON.stringify(ra.ok ? "ok" : ra)} · ${before?.slug} ${before?.status}`);
  if (!before) throw new Error("no trial site — the rest cannot run");

  // The continuation's activation, in activate()'s order: convertLead(choice) → live render → live.
  const activation = async (): Promise<void> => {
    await convertLead(a.leadId, a.artId, trialModuleIds(), SELF_TEST ? null : NEW);
    await rerenderTenantSnapshot(before.tenantId, { as: "live" });
    await db.updateTable("site").set({ status: "live" }).where("id", "=", before.id).execute();
  };
  await activation();
  const after = await siteOf(a.leadId);
  check("① a választott címke érvényesül", after?.slug === NEW, `${after?.slug}`);
  await activation();
  const aliases = await aliasesOf(before.id);
  check("② a régi slug EGY alias-sor (kétszeri aktiválás után is)", aliases.length === 1 && aliases[0]!.slug === OLD, JSON.stringify(aliases));

  // ③ canonical of the live snapshot.
  const html = after?.path ? await readFile(path.resolve(process.cwd(), after.path), "utf8").catch(() => "") : "";
  const canon = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1] ?? null;
  const ogUrl = /<meta property="og:url" content="([^"]+)"/.exec(html)?.[1] ?? null;
  check("③ a canonical az ÚJ hostot mondja", canon === `https://${NEW}.${PLATFORM_DOMAIN}`, `${canon}`);
  check("…az og:url is", ogUrl === `https://${NEW}.${PLATFORM_DOMAIN}`, `${ogUrl}`);
  check("…a régi host sehol a snapshotban", !html.includes(`${OLD}.${PLATFORM_DOMAIN}`));

  // ④ the old host.
  console.log("④ a régi host 301");
  const oldHost = `${OLD}.${PLATFORM_DOMAIN}`;
  const newBase = `https://${NEW}.${PLATFORM_DOMAIN}`;
  const root = await raw("GET", oldHost, "/?utm=x");
  check("④ GET / → 301 az új hostra, query megmarad", root.status === 301 && root.location === `${newBase}/?utm=x`, `${root.status} ${root.location}`);
  const head = await raw("HEAD", oldHost, "/");
  check("…HEAD is 301", head.status === 301 && head.location === `${newBase}/`, `${head.status} ${head.location}`);
  for (const r of MAIL_LINK_ROUTES) {
    const g = await raw("GET", oldHost, `${r.sample}?k=1`);
    check(`…levél-link (${r.who}) ${r.sample} → 301, útvonal + query`, g.status === 301 && g.location === `${newBase}${r.sample}?k=1`, `${g.status} ${g.location}`);
  }
  const page = await raw("GET", oldHost, "/adatvedelem");
  check("…tetszőleges lap → 301 ugyanarra az útvonalra", page.status === 301 && page.location === `${newBase}/adatvedelem`, `${page.status} ${page.location}`);
  const post = await raw("POST", oldHost, MAIL_LINK_ROUTES[0]!.sample);
  check("…POST NEM irányít át (helyben szolgál)", post.status !== 301 && post.status !== 0, `${post.status}`);
  const fresh = await raw("GET", `${NEW}.${PLATFORM_DOMAIN}`, "/");
  check("…az új host kiszolgál (nem irányít tovább)", fresh.status === 200, `${fresh.status}`);

  // ⑤ dev path.
  if (!isPlatformHosting(config.publicSiteUrl)) {
    const dev = await raw("GET", "127.0.0.1", `/t/${OLD}/foglalas?x=2`);
    check("⑤ dev /t/<régi>/… → 301 /t/<új>/…, query megmarad", dev.status === 301 && dev.location === `/t/${NEW}/foglalas?x=2`, `${dev.status} ${dev.location}`);
  } else {
    console.log("  ⏭ ⑤ dev-út kikapcsolva (platform hoszt) — kihagyva");
  }

  // ⑥ the old label stays held.
  console.log("⑥ a régi címke foglalt");
  const b = await fixtureLead("b", { name: `srn ${stamp} regi` });
  const avB = await checkSubdomainAvailable(OLD, b.leadId);
  check("⑥ másik lead nem választhatja a régi címkét", !avB.ok, JSON.stringify(avB));
  const peekB = await peekPreviewLabel(b.leadId);
  check("…előnézeti címkének sem kapja meg", peekB !== OLD && !!peekB, `${peekB}`);
  check("…a SAJÁT lead visszaválthat rá (nem foglalt neki)", !(await labelHeldByOther(OLD, a.leadId)));

  // ⑦ a taken / reserved choice keeps the old address.
  const HELD = `srn-${stamp}-foglalt`;
  await db.updateTable("lead").set({ preview_label: HELD }).where("id", "=", b.leadId).execute();
  const keptHeld = await renameSiteSlug(before.id, a.leadId, HELD);
  const keptReserved = await renameSiteSlug(before.id, a.leadId, "admin");
  const still = await siteOf(a.leadId);
  check("⑦ másik lead címkéje / fenntartott név → marad a cím", keptHeld === still?.slug && keptReserved === still?.slug && still?.slug !== HELD, `${keptHeld} · ${keptReserved} · ${still?.slug}`);

  // ⑧ back to the own former name.
  if (!SELF_TEST) {
    const back = await renameSiteSlug(before.id, a.leadId, OLD);
    const swapped = await aliasesOf(before.id);
    check("⑧ visszaváltás a saját régi névre: a site visszakapja", back === OLD && (await siteOf(a.leadId))?.slug === OLD, `${back}`);
    check("…az elhagyott név lesz az alias (egy sor)", swapped.length === 1 && swapped[0]!.slug === NEW, JSON.stringify(swapped));
    await rerenderTenantSnapshot(before.tenantId, { as: "live" });
    const oldServes = await raw("GET", oldHost, "/");
    const newRedirects = await raw("GET", `${NEW}.${PLATFORM_DOMAIN}`, "/");
    check("…a régi host újra helyben szolgál, az elhagyott irányít", oldServes.status === 200 && newRedirects.status === 301 && newRedirects.location === `https://${oldHost}/`, `${oldServes.status} · ${newRedirects.status} ${newRedirects.location}`);
  }

  // ⑨ 40-character cut.
  const longName = `${"x".repeat(39)} apartman`;
  const cut = await checkSubdomainAvailable(longName, null);
  check("⑨ a 40-es vágás után nincs záró kötőjel", cut.normalized === "x".repeat(39) && !cut.normalized.endsWith("-"), cut.normalized);
} finally {
  server.closeAllConnections?.();
  server.close();
  await rm(MOCK_FILE, { force: true });
  overrideFreeTrialConfigInProcess(null);
  for (const t of tenants) {
    await db.deleteFrom("offer").where("tenant_id", "=", t).execute();
    await db.deleteFrom("tenant_user").where("tenant_id", "=", t).execute();
    await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  }
  for (const l of leads) {
    await db.deleteFrom("free_trial").where("lead_id", "=", l).execute();
    const tIds = (await db.selectFrom("tenant").select("id").where("lead_id", "=", l).execute()).map((r) => r.id);
    for (const t of tIds) await db.deleteFrom("tenant").where("id", "=", t).execute();
    await db.deleteFrom("prospect").where("lead_id", "=", l).execute();
    await db.deleteFrom("mock_artifact").where("lead_id", "=", l).execute();
    await db.deleteFrom("lead").where("id", "=", l).execute();
  }
  if (runId) await db.deleteFrom("scrape_run").where("id", "=", runId).execute();
  if (defId) await db.deleteFrom("scraper_definition").where("id", "=", defId).execute();
  await db.destroy();
}

if (SELF_TEST) {
  const need = ["① a választott címke érvényesül", "② a régi slug EGY alias-sor", "③ a canonical az ÚJ hostot mondja", "④ GET / → 301"];
  const blind = need.filter((n) => !failed.some((f) => f.startsWith(n)));
  if (blind.length) {
    console.error(`\n⛔ slug-rename-check --self-test: a szabotázs ezeket NEM vitte pirosra: ${blind.join(" · ")} — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ slug-rename-check --self-test: a szabotázs ${failures} állítást pirosra vitt (① ② ③ ④ köztük).`);
} else if (failures > 0) {
  console.error(`\n⛔ slug-rename-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ slug-rename-check: minden zöld");
}
