// Egység nélküli ár-POST nem nyers 500 (Elek IT R-1, 2026-10-14): a /admin/prices/base egység nélkül
// (vagy nem-uuid egységgel) a Postgres uuid-hibájáig jutott, és nyers HTTP 500 lett belőle. Most a
// „nincs ilyen egység” validációs útra fut — mint minden más idegen egység.
//   ① unitBelongsToSite: "" / "abc" / SQL-szerű szöveg → false, kivétel nélkül;
//   ② HTTP: /admin/prices/base és /admin/prices/season egység nélkül → átirányítás hibaüzenettel, nem 500;
//   ③ negatív kontroll: a saját egységgel az ár elmentődik.
// Futtatás: npx tsx scripts/admin-unit-param-check.mts
process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

import http from "node:http";
import { once } from "node:events";

const { db, pool } = await import("../src/db/client.js");
const { unitBelongsToSite, createUnit } = await import("../src/tenant/units.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { getUnitPrices } = await import("../src/tenant/prices.js");

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 200)}`}`);
  if (!c) fail++;
};

const ids: Record<string, string> = {};
const { server } = (await import("../src/server/public.js")) as { server: http.Server };
if (!server.listening) await once(server, "listening");
const port = (server.address() as { port: number }).port;
const post = (path: string, body: Record<string, string>, cookie: string): Promise<{ status: number; location: string }> =>
  new Promise((resolve, reject) => {
    const b = new URLSearchParams(body).toString();
    const r = http.request(
      { host: "127.0.0.1", port, path, method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded", "content-length": String(Buffer.byteLength(b)) } },
      (res) => { res.resume(); res.on("end", () => resolve({ status: res.statusCode ?? 0, location: String(res.headers.location ?? "") })); },
    );
    r.on("error", reject);
    r.end(b);
  });

try {
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_aup", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_aup lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Egység Teszt" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const site = await db.insertInto("site").values({ tenant_id: tenant.id, preview_token: `aup_${stamp}`, slug: `aup-${stamp}` }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `aup_${stamp}`, contact_email: `o-${stamp}@example.com`, password_hash: null } as never).returning("id").executeTakeFirstOrThrow();
  await setTenantModules(tenant.id, ["pricing"]);
  const unit = (await createUnit(site.id, "Ház", 4, null))!;
  const cookie = `cit_session=${mintTenantCookieValue(tu.id)}`;

  console.log("\n① unitBelongsToSite");
  for (const bad of ["", "abc", "1; drop table x", "00000000-0000-0000-0000-00000000000g"]) {
    let r: boolean | string;
    try { r = await unitBelongsToSite(site.id, bad); } catch (e) { r = `KIVÉTEL: ${(e as Error).message}`; }
    check(`„${bad}” → false, kivétel nélkül`, r === false, r);
  }
  check("negatív kontroll: a saját egység → true", await unitBelongsToSite(site.id, unit));

  console.log("\n② HTTP");
  for (const [path, body] of [
    ["/admin/prices/base", { amount: "20000" }],
    ["/admin/prices/base", { unit: "", amount: "20000" }],
    ["/admin/prices/season", { unit: "nem-uuid", label: "Nyár", from: "07-01", to: "08-31", amount: "25000" }],
  ] as const) {
    const r = await post(path, body as Record<string, string>, cookie);
    check(`⭐ ${path} ${JSON.stringify(body).slice(0, 40)} → nem 500, hibaüzenetes átirányítás`, r.status >= 300 && r.status < 400 && /hiba=/.test(r.location), r);
  }
  console.log("\n③ negatív kontroll");
  const ok = await post("/admin/prices/base", { unit, amount: "21000" }, cookie);
  const base = (await getUnitPrices(unit)).find((p) => p.isBase)?.amount;
  check("a saját egységgel elmentődik (21 000)", ok.status >= 300 && ok.status < 400 && !/hiba=/.test(ok.location) && base === 21000, { ok, base });
} finally {
  if (ids.siteId) {
    await db.deleteFrom("unit_price").where("unit_id", "in", db.selectFrom("site_unit").select("id").where("site_id", "=", ids.siteId)).execute().catch(() => {});
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site_module_config_history").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site_module_config").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site").where("id", "=", ids.siteId).execute().catch(() => {});
  }
  if (ids.tenantId) {
    await db.deleteFrom("tenant_session" as never).where("tenant_id" as never, "=", ids.tenantId as never).execute().catch(() => {});
    await db.deleteFrom("tenant_user").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute().catch(() => {});
  }
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute().catch(() => {});
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute().catch(() => {});
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute().catch(() => {});
  server.close();
  await pool.end();
}
console.log(fail ? `\n⛔ ADMIN-UNIT-PARAM: ${fail} bukás` : "\n🟢 ADMIN-UNIT-PARAM: egység nélküli / nem-uuid egységű ár-POST hibaüzenetet ad, nem 500-at");
process.exit(fail ? 1 : 0);
