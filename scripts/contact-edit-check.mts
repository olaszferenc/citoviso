// gate-lane: own-fixture-only
//   ↑ ÍGÉRET (ADR-0229): ez a kapu CSAK a saját, futásonként bélyegzett fixture-ét írja és olvassa
//   vissza. Ha ide globális olvasás/söprés/kölcsönzött sor kerül, vedd le a jelölést.
/**
 * Guard of the „Elérhetőség" tab + the Térkép screen's place card (ADR-0241), measured
 * on the REAL screens served by THIS worktree.
 *
 *   npx tsx scripts/contact-edit-check.mts
 *
 * Contract: assets/design-refs/tenant-admin/elerhetoseg/README.md. What it asserts:
 *   ① the rule (contact.ts): phone normalised the SMS way and printed "+36 30 …",
 *     bad phone / e-mail / address / pin refused, ALL-OR-NOTHING, empty pin pair = keep;
 *   ② the tab exists in the nav, shows the stored facts, and the map layer is present
 *     ONLY with a browser key (never the server key);
 *   ③ the save round trip: override in the DB AND on the rendered page (JSON-LD address,
 *     phone, geo) — a save that only reaches the DB is the lie this guards against;
 *   ④ a refused save changes nothing and names the field on the screen;
 *   ⑤ the Térkép screen: ONE form carries the place card and the module fields, one
 *     POST saves both;
 *   ⑥ in a real browser at 390 and 1280 px: no JS error, no horizontal overflow, a bad
 *     phone is stopped BEFORE the post (DB unchanged), a good one is formatted on blur.
 *
 * The Google map itself is NOT exercised here (network + billing): the gate runs with
 * the key blanked, and the pin is posted through the same hidden fields the map writes.
 */
import { once } from "node:events";
import type { Server } from "node:http";

(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();
process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
process.env.EMAIL_PROVIDER = "mock";

const { chromium } = await import("playwright-core");
const { config } = await import("../src/config.js");
const { db, pool } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { rm } = await import("node:fs/promises");
const { readFile } = await import("node:fs/promises");
const path = await import("node:path");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { applyContactEdits, prettyPhone } = await import("../src/tenant/contact.js");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const { server } = (await import("../src/server/public.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const port = (server.address() as { port: number }).port;

let fails = 0;
function ok(cond: boolean, msg: string, detail = ""): void {
  console.log(`${cond ? "  ok " : "  FAIL"} ${msg}${!cond && detail ? `  — ${detail}` : ""}`);
  if (!cond) fails++;
}

// ── ① the rule ────────────────────────────────────────────────────────────────
console.log("① szabály (contact.ts)");
const base = { address: "Fő utca 1, Próbafalva", phone: "", email: "", geo: { lat: 47.5, lon: 19.05 } };
{
  const r = applyContactEdits(base, { phone: "06 30/516-1631" });
  ok(r.ok && r.facts.phone === "+36 30 516 1631", "06 30/516-1631 → +36 30 516 1631", JSON.stringify(r));
  ok(prettyPhone("+3612345678") === "+36 1 234 5678", "budapesti szám: +36 1 234 5678", prettyPhone("+3612345678"));
  const bad = applyContactEdits(base, { address: "Új cím 2, Próbafalva", phone: "abc12" });
  ok(!bad.ok && bad.errors.includes("phone"), "rossz telefon → phone hiba");
  ok(!bad.ok, "MINDENT VAGY SEMMIT: a rossz telefon a jó címet sem engedi át");
  ok(!applyContactEdits(base, { email: "olasz@" }).ok, "rossz e-mail → hiba");
  ok(!applyContactEdits(base, { address: "ab" }).ok, "túl rövid cím → hiba");
  ok(!applyContactEdits(base, { lat: "95", lon: "19" }).ok, "tartományon kívüli tű → hiba");
  ok(!applyContactEdits(base, { lat: "0", lon: "0" }).ok, "0,0 tű (a törött térkép jele) → hiba");
  const keep = applyContactEdits(base, { lat: "", lon: "" });
  ok(keep.ok && keep.facts.geo?.lat === 47.5, "üres lat/lon pár (nincs térkép) → a tárolt tű marad");
  const empty = applyContactEdits({ ...base, phone: "+36 30 516 1631" }, { phone: "" });
  ok(empty.ok && empty.facts.phone === "", "üres telefon → törlődik (nem hiba)");
}

// ── fixture ───────────────────────────────────────────────────────────────────
const parent = await createFixtureParent(db, "contactedit");
const STAMP = `${process.pid}${Date.now() % 100000}`;
const ids: { lead?: string; tenant?: string; site?: string; user?: string } = {};
const SEED_ADDR = "Ráckevei út 083/2 hrsz. 083/2";
async function seed() {
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: parent.runId, name: "_Elérhetőség őr", raw: sql`'{}'::jsonb`, lat: 46.75, lng: 17.35, address: SEED_ADDR } as never)
    .returning("id").executeTakeFirstOrThrow();
  ids.lead = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "_Elérhetőség őr" } as never)
    .returning("id").executeTakeFirstOrThrow();
  ids.tenant = tenant.id;
  const user = await db.insertInto("tenant_user")
    .values({ tenant_id: tenant.id, contact_email: "ce-teszt@example.com", username: `ce-teszt-${STAMP}` } as never)
    .returning("id").executeTakeFirstOrThrow();
  ids.user = user.id;
  const artifact = await db.insertInto("mock_artifact").values({
    lead_id: lead.id,
    status: "approved",
    inputs: sql`${JSON.stringify({
      recipe: { template: "editorial", skin: "editorial-warm", archetype: "classic", sections: [{ kind: "hero" }] },
      siteData: {
        name: "_Elérhetőség őr", tagline: "Teszt", intro: "Teszt szállás az őrhöz.", highlights: ["Kert"], photos: [],
        contact: { email: "ce-teszt@example.com", phone: "06305161631", address: SEED_ADDR },
        geo: { lat: 46.7505998, lon: 17.3498717 },
      },
    })}::jsonb`,
  } as never).returning("id").executeTakeFirstOrThrow();
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `cechk${STAMP}`, source_artifact_id: artifact.id,
    status: "provisioned", path: `sites/${tenant.id}/index.html`, slug: `ce-teszt-${STAMP}`,
  } as never).returning("id").executeTakeFirstOrThrow();
  ids.site = site.id;
  await db.insertInto("module_entitlement").values({ tenant_id: tenant.id, module: "location", active: true } as never).execute();
}

const origKey = config.googleMapsBrowserKey;
const cfg = config as unknown as { googleMapsBrowserKey: string };
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  await seed();
  const cookie = `cit_session=${mintTenantCookieValue(ids.user!)}`;
  const B = `http://127.0.0.1:${port}`;
  const get = async (u: string) => (await fetch(B + u, { headers: { cookie }, redirect: "manual" }));
  const post = async (u: string, body: Record<string, string>) =>
    fetch(B + u, { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString(), redirect: "manual" });
  const overrides = async () => {
    const r = await db.selectFrom("site").select("edited_site_data").where("id", "=", ids.site!).executeTakeFirstOrThrow();
    const v = r.edited_site_data as unknown;
    return (typeof v === "string" ? JSON.parse(v) : v ?? {}) as { contact?: Record<string, string>; geo?: { lat: number; lon: number } };
  };
  const snapshot = () => readFile(path.resolve(process.cwd(), `sites/${ids.tenant}/index.html`), "utf8");

  // ── ② the tab ───────────────────────────────────────────────────────────────
  console.log("② az Elérhetőség fül");
  cfg.googleMapsBrowserKey = "";
  let html = await (await get("/admin?tab=elerhetoseg")).text();
  ok(/href="\/admin\?tab=elerhetoseg"[^>]*>[\s\S]{0,400}?Elérhetőség/.test(html), "a menüben ott az „Elérhetőség”");
  ok(html.includes(`value="${SEED_ADDR}"`), "a tárolt cím a mezőben");
  ok(html.includes('value="06305161631"'), "a tárolt telefon a mezőben");
  ok(html.includes('name="lat"') && html.includes('value="46.7505998"'), "a tárolt tű a rejtett mezőben");
  ok(!html.includes("maps.googleapis.com"), "kulcs nélkül NINCS térkép-szkript");
  ok(html.includes("A térképes pontosítás most nem érhető el"), "kulcs nélkül kimondja, hogy nincs térkép");
  ok(html.includes('data-kb-anchor="admin.contact"'), "súgó-horgony: admin.contact");
  cfg.googleMapsBrowserKey = "TEST-BROWSER-KEY";
  html = await (await get("/admin?tab=elerhetoseg")).text();
  ok(html.includes("maps/api/js?key=TEST-BROWSER-KEY"), "böngésző-kulccsal a térkép-szkript a BÖNGÉSZŐ-kulcsot viszi");
  ok(!config.googleMapsApiKey || !html.includes(config.googleMapsApiKey), "a SZERVER-kulcs sosem kerül a lapra");
  cfg.googleMapsBrowserKey = "";

  // ── ③ save round trip ───────────────────────────────────────────────────────
  console.log("③ mentés → DB → honlap");
  let r = await post("/admin/elerhetoseg", { address: "  Szilváskerti  u. 5,   Balatongyörök ", phone: "06 30 111 2233", email: "uj@example.com", lat: "46.7512", lon: "17.3461" });
  ok(r.status === 302 && (r.headers.get("location") ?? "").includes("saved=1"), "mentés → vissza a fülre, saved=1", `${r.status} ${r.headers.get("location")}`);
  let o = await overrides();
  ok(o.contact?.address === "Szilváskerti u. 5, Balatongyörök", "DB: a cím szóköz-rendezve", JSON.stringify(o.contact));
  ok(o.contact?.phone === "+36 30 111 2233", "DB: a telefon +36 30 111 2233", String(o.contact?.phone));
  ok(o.contact?.email === "uj@example.com", "DB: az e-mail");
  ok(o.geo?.lat === 46.7512 && o.geo?.lon === 17.3461, "DB: a tű", JSON.stringify(o.geo));
  let snap = await snapshot();
  ok(snap.includes('"streetAddress":"Szilváskerti u. 5, Balatongyörök"'), "HONLAP: az új cím a Google-adatokban (JSON-LD)");
  ok(snap.includes('"telephone":"+36 30 111 2233"'), "HONLAP: az új telefon");
  ok(snap.includes('"latitude":46.7512'), "HONLAP: az új tű");
  ok(!snap.includes("hrsz. 083/2"), "HONLAP: a régi, hibás cím eltűnt");

  // ── ④ refusal changes nothing ────────────────────────────────────────────────
  console.log("④ elutasított mentés");
  r = await post("/admin/elerhetoseg", { address: "Másik utca 9, Balatongyörök", phone: "abc12", email: "uj@example.com", lat: "46.7", lon: "17.3" });
  const loc = r.headers.get("location") ?? "";
  ok(loc.includes("pe=phone"), "rossz telefon → vissza, a mező megnevezve", loc);
  o = await overrides();
  ok(o.contact?.address === "Szilváskerti u. 5, Balatongyörök" && o.geo?.lat === 46.7512, "SEMMI nem változott (cím, tű sem)");
  html = await (await get(loc)).text();
  ok(html.includes("Ez nem telefonszám."), "a képernyő kiírja a hibát");
  html = await (await get("/admin?tab=elerhetoseg&pe=<script>")).text();
  ok(!html.includes("<script>&") && !html.includes('pe=<script>'), "ismeretlen hibakulcs nem jut a lapra");

  // ── ⑤ the Térkép screen ──────────────────────────────────────────────────────
  console.log("⑤ a Térkép képernyő");
  html = await (await get("/admin?tab=modulok&m=location")).text();
  const formStart = html.indexOf('id="pl_form"');
  const formEnd = html.indexOf("</form>", formStart);
  const form = html.slice(formStart, formEnd);
  ok(formStart > 0 && form.includes('id="pl_addr"') && form.includes('id="cfg_approachNote"'), "EGY form viszi a címet és a megközelítést");
  ok(form.includes('name="module" value="location"'), "a form a Térkép modult menti");
  ok(html.includes('href="/admin?tab=elerhetoseg"'), "link az Elérhetőség menüpontra (telefon, e-mail)");
  r = await post("/admin/module-config", { module: "location", address: "Szilváskerti u. 7, Balatongyörök", lat: "46.7515", lon: "17.3465", showMap: "1", approachNote: "A kapu a sorompó után balra.", parkingNote: "Az udvarban" });
  ok(r.status === 302 && (r.headers.get("location") ?? "").includes("saved=1"), "egy mentés", `${r.status} ${r.headers.get("location")}`);
  o = await overrides();
  ok(o.contact?.address === "Szilváskerti u. 7, Balatongyörök" && o.geo?.lat === 46.7515, "a hely elmentve");
  ok(o.contact?.phone === "+36 30 111 2233", "a telefon (nincs a formon) érintetlen");
  const mc = await db.selectFrom("site_module_config").select("config").where("site_id", "=", ids.site!).where("module", "=", "location").executeTakeFirst();
  const mcv = (typeof mc?.config === "string" ? JSON.parse(mc.config) : mc?.config) as { approachNote?: string } | undefined;
  ok(mcv?.approachNote === "A kapu a sorompó után balra.", "a megközelítés is elmentve", JSON.stringify(mcv));
  snap = await snapshot();
  ok(snap.includes('"streetAddress":"Szilváskerti u. 7, Balatongyörök"'), "HONLAP: egy újrarenderelés mindkettőt viszi");
  r = await post("/admin/module-config", { module: "location", address: "x", lat: "", lon: "", showMap: "1", approachNote: "NEM SZABAD", parkingNote: "" });
  ok((r.headers.get("location") ?? "").includes("pe=address"), "rossz cím a Térkép képernyőn → megnevezve");
  const mc2 = await db.selectFrom("site_module_config").select("config").where("site_id", "=", ids.site!).where("module", "=", "location").executeTakeFirst();
  ok(!JSON.stringify(mc2?.config).includes("NEM SZABAD"), "…és a modul-mezők SEM mentődtek");

  // ── ⑥ real browser ───────────────────────────────────────────────────────────
  console.log("⑥ böngészőben, 390 és 1280 px");
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 });
    await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(ids.user!), domain: "127.0.0.1", path: "/" }]);
    const p = await ctx.newPage();
    const errs: string[] = [];
    p.on("pageerror", (e) => errs.push(e.message));
    for (const u of ["/admin?tab=elerhetoseg", "/admin?tab=modulok&m=location"]) {
      await p.goto(B + u);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(over <= 0, `${width}px ${u}: nincs vízszintes kilógás`, `${over}px`);
    }
    await p.goto(B + "/admin?tab=elerhetoseg");
    // The cookie bar is answered once by a real owner; answer it here the same way.
    const consent = p.getByRole("button", { name: "Csak a szükségeseket" });
    if (await consent.isVisible().catch(() => false)) await consent.click();
    const before = JSON.stringify(await overrides());
    await p.fill("#ct_phone", "abc12");
    await p.locator("#ct_phone").blur();
    ok(await p.isVisible("#ct_phone_err"), `${width}px: rossz telefon → hibaüzenet azonnal`);
    await p.click("#pl_save");
    await p.waitForTimeout(400);
    ok(p.url().includes("tab=elerhetoseg") && !p.url().includes("saved=1"), `${width}px: a rossz telefonnal NEM küld`);
    ok(JSON.stringify(await overrides()) === before, `${width}px: a DB érintetlen`);
    ok((await p.textContent("#pl_dirty"))?.includes("Javítsa") === true, `${width}px: a mentés-sor megmondja, miért nem ment`);
    const good = width < 500 ? "06 70 222 3344" : "06 20 555 6677";
    const pretty = width < 500 ? "+36 70 222 3344" : "+36 20 555 6677";
    await p.fill("#ct_phone", good);
    await p.locator("#ct_phone").blur();
    ok((await p.inputValue("#ct_phone")) === pretty, `${width}px: blur → ${pretty}`);
    ok((await p.textContent("#pl_dirty"))?.includes("telefon") === true, `${width}px: „Mentetlen: telefon”`);
    await Promise.all([p.waitForURL(/saved=1/), p.click("#pl_save")]);
    ok((await overrides()).contact?.phone === pretty, `${width}px: böngészőből mentve`);
    ok(errs.length === 0, `${width}px: 0 JS-hiba`, errs.join(" | "));
    await ctx.close();
  }
} finally {
  cfg.googleMapsBrowserKey = origKey;
  await browser.close().catch(() => {});
  if (ids.tenant) await rm(path.resolve(process.cwd(), `sites/${ids.tenant}`), { recursive: true, force: true }).catch(() => {});
  if (ids.site) {
    await db.deleteFrom("site_module_config_history").where("site_id", "=", ids.site).execute().catch(() => {});
    await db.deleteFrom("site_module_config").where("site_id", "=", ids.site).execute().catch(() => {});
    await db.deleteFrom("site").where("id", "=", ids.site).execute().catch(() => {});
  }
  if (ids.tenant) {
    await db.deleteFrom("tenant_message").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
    await db.deleteFrom("tenant_user").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenant).execute().catch(() => {});
  }
  if (ids.lead) await db.deleteFrom("mock_artifact").where("lead_id", "=", ids.lead).execute().catch(() => {});
  await parent.drop().catch(() => {});
  await pool.end();
}

console.log(fails ? `\n⛔ ${fails} FAIL` : "\n✅ az Elérhetőség + Térkép-hely minden állítása ZÖLD");
process.exit(fails ? 1 : 0);
