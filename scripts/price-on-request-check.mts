// „Nem adok meg árat" + új egység ára + a hiányos árazás teendő-sora — ŐR
// (ADR-0208 ⑥.2 · ⑥.3 · ⑥.4, jóváhagyott terv: assets/design-refs/tenant-admin/price-on-request/, „A").
//
// Mit mér (eldobható fixtúra, valódi DB + valódi HTTP-szerver + böngésző, mindkét méreten):
//   ① a predikátum (`unitPriceStatus`) ismert válaszú esetekre — kézzel felírt elvárással,
//      NEM a vizsgált függvény másik hívásával (feedback_guard_must_not_borrow_its_subject);
//   ② az Árazás kártya állapot-sora és pipája, ③ a pipa mentése (és hogy az alapár törli),
//   ④ az Áttekintés teendő-sora — ugyanazt mondja-e, mint a kártya;
//   ⑤ a vendég-lap „Árak" szakasza: a kimondott szoba „Egyedi ajánlat alapján", az
//      elfelejtett ár NEM (ott ez hamis állítás lenne);
//   ⑥ az új egység felvétele mind a négy kimenettel — ⛔ a mentés SOHA nem tagad meg
//      (ADR-0193 ①), a rossz ár nem nyelődik el némán „nincs ár"-ként;
//   ⑦ negatív kontroll: `pricing` nélkül se ár-mező, se teendő-sor;
//   ⑧ a heti emlékeztető IDŐBEN: a naptárat léptetve (a `now` paraméterrel, CSAK a saját
//      fixtúra-site-on — a dev-DB közös), a KÉZBESÍTETT levelekből mérve: 7 nap előtt
//      nincs levél, a 7. napon egy, egy héten belül nincs második, a 14. napon a második;
//      a kimondott szoba kimarad belőle, a teljes kimondás lezárja az epizódot.
//
// Usage: npx tsx scripts/price-on-request-check.mts

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

import { once } from "node:events";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCOPE = path.basename(ROOT); // worktree-unique scratch key: assets/Temp is a SYMLINK shared by every worktree
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { addSeasonPrice, setBasePrice, getUnitPrices, unitPriceStatus } = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { sitePriceGaps, maintainPriceGaps, GAP_REMIND_DAYS } = await import("../src/tenant/priceGap.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
type UnitPrice = Awaited<ReturnType<typeof getUnitPrices>>[number];

const ids: Record<string, string> = {};
let server: Server | null = null;
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  if (c) console.log(`  ✓ ${n}`);
  else {
    fail++;
    console.error(`  ✗ ${n}${d === undefined ? "" : " — " + JSON.stringify(d).slice(0, 400)}`);
  }
};

const STARTED = Date.now();
const OUTBOX = path.join(ROOT, "outbox");
/** Mails written since the run started to `who` — only files that did not exist before. */
async function mailsTo(who: string): Promise<{ subject: string; body: string; file: string }[]> {
  await new Promise((r) => setTimeout(r, 400));
  const out: { subject: string; body: string; file: string }[] = [];
  let files: string[] = [];
  try {
    files = await readdir(OUTBOX);
  } catch {
    return out;
  }
  for (const f of files.sort()) {
    const p = path.join(OUTBOX, f);
    if ((await stat(p)).mtimeMs < STARTED) continue;
    const raw = await readFile(p, "utf8");
    if (!(/^To: (.*)$/m.exec(raw)?.[1] ?? "").includes(who)) continue;
    out.push({ subject: /^Subject: (.*)$/m.exec(raw)?.[1] ?? "", body: raw.slice(raw.indexOf("\n\n") + 2), file: f });
  }
  return out;
}

try {
  // ── ① the predicate, on hand-written expectations ──────────────────────────
  console.log("\n① unitPriceStatus — ismert válaszú esetek");
  const today = "2026-10-01";
  const row = (p: Partial<UnitPrice>): UnitPrice => ({
    id: Math.random().toString(36).slice(2),
    label: "",
    from: null,
    to: null,
    amount: 20_000,
    isBase: true,
    minNights: null,
    validFrom: null,
    validTo: null,
    ...p,
  });
  const base = row({});
  const season = row({ label: "Főszezon", from: "06-15", to: "08-31", isBase: false });
  const U = (seasonalOnly = false, priceOnRequest = false) => ({ seasonalOnly, priceOnRequest });
  check("üres lista → none", unitPriceStatus([], U(), today) === "none");
  check("üres lista + pipa → on_request", unitPriceStatus([], U(false, true), today) === "on_request");
  check("időtlen alapár → complete", unitPriceStatus([base], U(), today) === "complete");
  check("alapár + pipa → complete (a pipának nincs mit mondania)", unitPriceStatus([base], U(false, true), today) === "complete");
  check("csak szezon → partial", unitPriceStatus([season], U(), today) === "partial");
  check("csak szezon + pipa → on_request", unitPriceStatus([season], U(false, true), today) === "on_request");
  check("csak szezon, „csak a felsorolt időszakokban” → complete", unitPriceStatus([season], U(true), today) === "complete");
  check("„csak a felsorolt időszakokban”, sor nélkül → none", unitPriceStatus([], U(true), today) === "none");
  check(
    "LEJÁRT dátumos alapár → none (nem áraz többé)",
    unitPriceStatus([row({ validFrom: "2026-01-01", validTo: "2026-09-30" })], U(), today) === "none",
  );
  check(
    "a horizonton BELÜL lejáró dátumos alapár → partial",
    unitPriceStatus([row({ validFrom: "2026-10-01", validTo: "2027-03-31" })], U(), today) === "partial",
  );
  check(
    "év-átforduló szezon (12-01 → 02-28) alapár nélkül → partial",
    unitPriceStatus([row({ label: "Tél", from: "12-01", to: "02-28", isBase: false })], U(), today) === "partial",
  );

  // ── fixture ───────────────────────────────────────────────────────────────
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_por", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_por lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Ár-döntés Vendégház (teszt)" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `por-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `por_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Ár-döntés Vendégház", intro: "Teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email: `o-${stamp}@example.com` }, businessType: "accommodation" }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const small = await db.insertInto("site_unit").values({ site_id: site.id, name: "Kis faház", capacity: 2, sort_order: 1, is_whole_property: false }).returning("id").executeTakeFirstOrThrow();
  const big = await db.insertInto("site_unit").values({ site_id: site.id, name: "Nagy lakosztály", capacity: 6, sort_order: 2 }).returning("id").executeTakeFirstOrThrow();
  const attic = await db.insertInto("site_unit").values({ site_id: site.id, name: "Tetőtéri szoba", capacity: 3, sort_order: 3 }).returning("id").executeTakeFirstOrThrow();
  const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `por_${stamp}`, contact_email: `o-${stamp}@example.com`, password_hash: null }).returning("id").executeTakeFirstOrThrow();
  ids.tuId = tu.id;
  await setBasePrice(small.id, 15_000);
  const s1 = await addSeasonPrice(attic.id, "Főszezon", "06-15", "08-31", 24_000);
  if (!s1.ok) throw new Error("szezon-ár nem ment");
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const COOKIE = `cit_session=${mintTenantCookieValue(tu.id)}`;
  const get = async (p: string): Promise<string> => (await fetch(BASE + p, { headers: { cookie: COOKIE } })).text();
  const post = async (p: string, body: Record<string, string>): Promise<string> => {
    const r = await fetch(BASE + p, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: COOKIE, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    return r.headers.get("location") ?? "";
  };
  const page = async (): Promise<string> => readFile(path.join(siteDir, "index.html"), "utf8");
  const flag = async (id: string): Promise<boolean> =>
    (await db.selectFrom("site_unit").select("price_on_request").where("id", "=", id).executeTakeFirstOrThrow()).price_on_request;
  /** The pricing card of one unit, cut from the page by its anchor. */
  const card = (html: string, id: string): string => {
    const i = html.indexOf(`id="ar-${id}"`);
    if (i < 0) return "";
    const j = html.indexOf(`class="adm-card" id="ar-`, i + 10);
    return html.slice(i, j < 0 ? i + 12_000 : j);
  };

  // ── ② the Árazás card ─────────────────────────────────────────────────────
  console.log("\n② Árazás kártya — állapot-sor és pipa");
  let pr = await get("/admin?tab=modulok&m=pricing");
  check("a Nagy lakosztály: „Nincs ára.”", /data-price-state="none"/.test(card(pr, big.id)) && card(pr, big.id).includes("Nincs ára."));
  check("a Tetőtéri szoba: „Az év egy részére nincs ára.”", /data-price-state="partial"/.test(card(pr, attic.id)));
  check("a Kis faház: nincs állapot-sor (teljes)", card(pr, small.id) !== "" && !/data-price-state=/.test(card(pr, small.id)));
  check("a Kis faház pipája TILTOTT (alapára van)", /name="on" value="1"[^>]* disabled/.test(card(pr, small.id)));
  check("a Nagy lakosztály pipája ÉLŐ", card(pr, big.id).includes("Nem adok meg alapárat — ahol nincs ár, egyedi ajánlatot küldök") && !/name="on" value="1"[^>]* disabled/.test(card(pr, big.id)));
  check("a figyelmeztetés kimondja a heti emlékeztetőt", card(pr, big.id).includes("hetente emlékeztetjük"));

  // ── ④ the overview row — the SAME predicate ───────────────────────────────
  console.log("\n④ Áttekintés — teendő-sor");
  let ov = await get("/admin?tab=attekintes");
  check("van ár-hiány sor", ov.includes('data-todo="price-gap"'));
  check("„2 szobájának nincs ára”", ov.includes("2 szobájának nincs ára"));
  check("…mindkét szobát megnevezi, a teljeset NEM", ov.includes("Nagy lakosztály — egyik éjszakára sincs ár") && ov.includes("Tetőtéri szoba — az év egy részére nincs ár") && !/<li>Kis faház —/.test(ov));
  check("nincs mellette „Töltse ki: Árak” sor (az árazás nem üres)", !ov.includes("Töltse ki: Árak"));

  // ── ⑤ guest page before the decision ──────────────────────────────────────
  console.log("\n⑤ Vendég-lap — döntés ELŐTT");
  let html = await page();
  check("az elfelejtett árú szoba NEM „Egyedi ajánlat alapján”", !html.includes("Egyedi ajánlat alapján"));

  // ── ③ the decision ─────────────────────────────────────────────────────────
  console.log("\n③ A pipa mentése");
  let loc = await post("/admin/prices/request", { unit: big.id, on: "1" });
  check("a mentés visszavisz az Árazás lapra", loc.startsWith("/admin?tab=modulok&m=pricing"), loc);
  check("a DB-ben kimondva", await flag(big.id));
  pr = await get("/admin?tab=modulok&m=pricing");
  check("a kártya: „Kimondva: nem ad meg alapárat.”", /data-price-state="on_request"/.test(card(pr, big.id)) && card(pr, big.id).includes("Kimondva: nem ad meg alapárat."));
  check("…és a pipa bejelölve", /name="on" value="1" checked/.test(card(pr, big.id)));
  ov = await get("/admin?tab=attekintes");
  check("a teendő-sor: már csak „1 szobájának nincs ára”", ov.includes("1 szobájának nincs ára") && !ov.includes("Nagy lakosztály — egyik"));
  html = await page();
  check("⑤ a vendég-lap újrarenderelve: „Egyedi ajánlat alapján”", html.includes("Egyedi ajánlat alapján"));
  check("⑤ …egész évre (szezon nélkül „Egész évben”)", /data-cit-onrequest><td>Egész évben/.test(html));
  await post("/admin/prices/request", { unit: attic.id, on: "1" });
  ov = await get("/admin?tab=attekintes");
  check("mindkettő kimondva → a teendő-sor ELTŰNIK", !ov.includes('data-todo="price-gap"'));
  check("…és a sitePriceGaps is üres (a levél ugyanezt olvassa)", (await sitePriceGaps(site.id)).length === 0);
  html = await page();
  check("⑤ a szezonos szobánál „Egyéb időszakban” + egyedi ajánlat", /data-cit-onrequest><td>Egyéb időszakban/.test(html));
  loc = await post("/admin/prices/request", { unit: attic.id });
  check("a pipa levétele (üres „on”) visszavonja", !(await flag(attic.id)), loc);
  await setBasePrice(big.id, 20_000);
  check("③ az alapár mentése törli a kimondott döntést", !(await flag(big.id)));

  // ── ⑥ new unit, four outcomes ─────────────────────────────────────────────
  console.log("\n⑥ Új egység — négy kimenet, a mentés sosem tagad meg");
  const newId = async (name: string): Promise<string> =>
    (await db.selectFrom("site_unit").select("id").where("site_id", "=", site.id).where("name", "=", name).executeTakeFirst())?.id ?? "";
  loc = await post("/admin/units/save", { name: "Pince", capacity: "2", price: "26.000", back: "rooms" });
  const pince = await newId("Pince");
  check("„26.000” → alapár 26 000", (await getUnitPrices(pince)).some((p) => p.isBase && p.amount === 26_000));
  check("…visszajelzés a Szobák lapon: uj=ar", /m=rooms.*uj=ar&/.test(loc), loc);
  loc = await post("/admin/units/save", { name: "Padlás", price: "", price_on_request: "1", back: "booking" });
  const padlas = await newId("Padlás");
  check("pipával → kimondva, ár nélkül", (await flag(padlas)) && (await getUnitPrices(padlas)).length === 0);
  check("…a Foglalás lapra jön vissza: uj=ajanlat", /m=booking.*uj=ajanlat&/.test(loc), loc);
  loc = await post("/admin/units/save", { name: "Garázs", back: "rooms" });
  // The browser opens THIS redirect, as the product wrote it — a hard-coded anchor in
  // the guard would stay green if the product dropped it.
  const garazsLoc = loc;
  const garazs = await newId("Garázs");
  check("⛔ ár és pipa nélkül is FELVESZI", garazs !== "");
  check("…uj=nincs", /uj=nincs&/.test(loc), loc);
  loc = await post("/admin/units/save", { name: "Rossz", price: "huszezer", back: "rooms" });
  check("⛔ rossz árral is felveszi, de nem nyeli el: uj=rossz", (await newId("Rossz")) !== "" && /uj=rossz&/.test(loc), loc);
  const flashNone = await get(loc.replace(/#.*$/, ""));
  check("a „nincs” visszajelzés kimondja és kiutat ad", flashNone.includes('data-nu-flash="rossz"') && flashNone.includes("A beírt árat nem tudtuk értelmezni") && flashNone.includes("Árat adok meg") && flashNone.includes(">Nem adok meg árat<"));
  loc = await post("/admin/prices/request", { unit: garazs, on: "1", back: "rooms" });
  check("a visszajelzés „Nem adok meg árat” gombja kimond és a Szobákra visz", (await flag(garazs)) && /m=rooms.*uj=kimondva&/.test(loc), loc);
  const roomsHtml = await get("/admin?tab=modulok&m=rooms");
  check("a felvevő sorban ár-mező és pipa", roomsHtml.includes('name="price"') && roomsHtml.includes("Nem adok meg árat — egyedi ajánlatot küldök"));

  // ── browser: both widths, the real click, and the eye ─────────────────────
  console.log("\n🖥  Böngésző — mobil + asztali");
  const out = path.join(ROOT, `assets/Temp/_por-${SCOPE}`);
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of [{ tag: "mobile", width: 390, height: 844 }, { tag: "desktop", width: 1280, height: 900 }]) {
    // Each width starts from the SAME state (partial) — the previous width's click left
    // the box ticked, and a second click would measure the un-tick instead.
    await post("/admin/prices/request", { unit: attic.id });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(tu.id), url: BASE }]);
    const pg = await ctx.newPage();
    const errs: string[] = [];
    pg.on("pageerror", (e) => errs.push(String(e)));
    await pg.goto(`${BASE}/admin?tab=modulok&m=pricing`);
    const box = pg.locator(`#ar-${attic.id} input[name="on"]`);
    await Promise.all([pg.waitForURL(/saved=1/), box.evaluate((el: HTMLInputElement) => el.click())]);
    const said = await pg.locator(`#ar-${attic.id} [data-price-state]`).getAttribute("data-price-state");
    check(`${vp.tag}: a pipa kattintásra ment → on_request`, said === "on_request", said);
    await pg.screenshot({ path: path.join(out, `por-pricing-${vp.tag}.png`), fullPage: true });
    await pg.goto(BASE + garazsLoc, { waitUntil: "load" });
    const fl = pg.locator('[data-nu-flash="nincs"]');
    check(`${vp.tag}: a Szobák lapon ott a „de nincs ára” visszajelzés`, (await fl.count()) === 1);
    // ⛔ isVisible() said yes while the fixed bottom nav covered it (measured on the
    // 390 px shot). Ask the page what is actually ON TOP at the flash's heading.
    // citui.css sets `scroll-behavior:smooth`, so the load-time scrollIntoView ANIMATES:
    // measured at once, the page still stood at scrollY 2 and the check read "covered".
    // Wait until the scroll position stops moving, then ask what is on top.
    await pg.waitForFunction(
      () => {
        const w = window as unknown as { __y?: number; __n?: number };
        const same = w.__y === scrollY;
        w.__y = scrollY;
        w.__n = same ? (w.__n ?? 0) + 1 : 0;
        return w.__n >= 3;
      },
      undefined,
      { polling: 100, timeout: 5000 },
    );
    const onTop = await pg.evaluate(() => {
      const el = document.querySelector('[data-nu-flash="nincs"] strong');
      if (!el) return "nincs elem";
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight) return `a képen kívül (top ${Math.round(r.top)} / ${innerHeight})`;
      const hit = document.elementFromPoint(r.left + 4, r.top + r.height / 2);
      if (hit && (hit === el || el.contains(hit))) return "ok";
      return `takarja: ${hit?.tagName}.${String(hit?.className).slice(0, 60)} (top ${Math.round(r.top)}, scrollY ${Math.round(scrollY)})`;
    });
    check(`${vp.tag}: …és a megérkezéskor LÁTSZIK (semmi nem takarja)`, onTop === "ok", onTop);
    const bb = await fl.boundingBox();
    check(`${vp.tag}: …és nem lóg ki a lapról`, !!bb && bb.x >= 0 && bb.x + bb.width <= vp.width + 1, bb);
    await pg.screenshot({ path: path.join(out, `por-rooms-${vp.tag}.png`), fullPage: true });
    // The fixed bottom nav paints over a full-page phone shot; the element shot is the eye's copy.
    await fl.screenshot({ path: path.join(out, `por-flash-${vp.tag}.png`) });
    check(`${vp.tag}: JS-hiba 0`, errs.length === 0, errs);
    await ctx.close();
  }
  await browser.close();
  await post("/admin/prices/request", { unit: attic.id });

  // ── ⑦ negative control: no pricing → no price field, no row ───────────────
  console.log("\n⑦ Negatív kontroll — árazás nélkül");
  await setTenantModules(tenant.id, ["booking", "rooms", "gallery"]);
  const roomsOff = await get("/admin?tab=modulok&m=rooms");
  check("nincs ár-mező a felvevő sorban", !roomsOff.includes('name="price"'));
  const ovOff = await get("/admin?tab=attekintes");
  check("nincs ár-hiány teendő-sor", !ovOff.includes('data-todo="price-gap"'));
  check("a sitePriceGaps üres", (await sitePriceGaps(site.id)).length === 0);
  // ⭐ …and the row really would have fired with pricing on — else the control proves nothing.
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);
  check("⭐ pozitív ellenpár: árazással a hiány VAN", (await sitePriceGaps(site.id)).length > 0);

  // ── ⑧ the weekly reminder, walked through time ────────────────────────────
  console.log("\n⑧ Heti emlékeztető — időben léptetve, a kézbesített levelekből");
  const OWNER = `o-${stamp}@example.com`;
  const seen = new Set<string>();
  const fresh = async () => (await mailsTo(OWNER)).filter((m) => !seen.has(m.file) && (seen.add(m.file), true));
  const gapsNow = await sitePriceGaps(site.id);
  const gapNames = gapsNow.map((g) => g.name).sort();
  const T0 = Date.parse("2026-11-02T08:00:00Z");
  const at = (days: number, hours = 0) => new Date(T0 + days * 86_400_000 + hours * 3_600_000);
  const tick = (d: Date) => maintainPriceGaps(d, { onlySiteId: site.id });
  await db.updateTable("site").set({ price_gap_since: null, price_gap_reminded_at: null }).where("id", "=", site.id).execute();
  let r = await tick(at(0));
  check("0. nap: az epizód elindul, levél NINCS", r.started === 1 && r.reminded === 0, r);
  await fresh();
  r = await tick(at(GAP_REMIND_DAYS - 1, 23));
  check("6 nap 23 óra: még nincs levél", r.reminded === 0 && (await fresh()).length === 0, r);
  r = await tick(at(GAP_REMIND_DAYS));
  const m1 = await fresh();
  check("7. nap: EGY levél", r.reminded === 1 && m1.length === 1, { r, n: m1.length });
  check(`…a tárgy: „${gapsNow.length} szobájának nincs ára — a vendég nem lát árat”`, m1[0]?.subject === `${gapsNow.length} szobájának nincs ára — a vendég nem lát árat`, m1[0]?.subject);
  check("…minden hiányos szobát megnevez", gapNames.every((n) => (m1[0]?.body ?? "").includes(`• ${n} —`)), { gapNames, body: (m1[0]?.body ?? "").slice(0, 500) });
  check("…megmondja, hogyan állítható le", (m1[0]?.body ?? "").includes("Nem adok meg alapárat") && (m1[0]?.body ?? "").includes("/admin?tab=modulok&m=pricing"));
  r = await tick(at(GAP_REMIND_DAYS, 1));
  check("egy órával később (átfedő tick): nincs második", r.reminded === 0 && (await fresh()).length === 0, r);
  r = await tick(at(2 * GAP_REMIND_DAYS - 1));
  check("13. nap: nincs második", r.reminded === 0 && (await fresh()).length === 0, r);
  r = await tick(at(2 * GAP_REMIND_DAYS));
  check("14. nap: a második levél (hetente, korlát nélkül)", r.reminded === 1 && (await fresh()).length === 1, r);
  // Declare all but one → the next mail names only the rest.
  const [keep, ...rest] = gapsNow;
  for (const g of rest) await post("/admin/prices/request", { unit: g.unitId, on: "1" });
  r = await tick(at(3 * GAP_REMIND_DAYS));
  const m3 = await fresh();
  check("21. nap: a kimondott szobák KIMARADNAK, csak a maradék szerepel", r.reminded === 1 && m3.length === 1 && (m3[0]?.body ?? "").includes(`• ${keep!.name} —`) && rest.every((g) => !(m3[0]?.body ?? "").includes(`• ${g.name} —`)), { r, body: (m3[0]?.body ?? "").slice(0, 400) });
  check("…egyes számban: „1 szobájának nincs ára …”", m3[0]?.subject === "1 szobájának nincs ára — a vendég nem lát árat", m3[0]?.subject);
  await post("/admin/prices/request", { unit: keep!.unitId, on: "1" });
  r = await tick(at(3 * GAP_REMIND_DAYS, 2));
  const stamps = await db.selectFrom("site").select(["price_gap_since", "price_gap_reminded_at"]).where("id", "=", site.id).executeTakeFirstOrThrow();
  check("mind kimondva → az epizód LEZÁRUL (mindkét bélyeg törölve)", r.ended === 1 && !stamps.price_gap_since && !stamps.price_gap_reminded_at, { r, stamps });
  r = await tick(at(4 * GAP_REMIND_DAYS));
  check("…és utána nincs több levél", r.reminded === 0 && (await fresh()).length === 0, r);
  // A fresh gap starts a fresh 7-day wait — it must not mail at once on the old clock.
  await post("/admin/prices/request", { unit: keep!.unitId });
  r = await tick(at(4 * GAP_REMIND_DAYS, 1));
  check("új hiány → ÚJ epizód, azonnal nincs levél", r.started === 1 && r.reminded === 0 && (await fresh()).length === 0, r);
  // ⭐ Negative control: a suspended site gets no mail, and its episode is closed.
  await db.updateTable("site").set({ status: "suspended" }).where("id", "=", site.id).execute();
  r = await tick(at(6 * GAP_REMIND_DAYS));
  check("felfüggesztett oldal: nincs levél, az epizód lezárul", r.reminded === 0 && r.ended === 1 && (await fresh()).length === 0, r);
  await db.updateTable("site").set({ status: "live" }).where("id", "=", site.id).execute();
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.tuId) await db.deleteFrom("tenant_user").where("id", "=", ids.tuId).execute().catch(() => {});
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) {
    await db.deleteFrom("tenant_message").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  }
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
console.log(fail ? `\n⛔ PRICE-ON-REQUEST: ${fail} bukás` : "\n🟢 PRICE-ON-REQUEST: a „nincs ár” kimondott döntés, az új egység ára, a teendő-sor egy szabályból");
process.exit(fail ? 1 : 0);
