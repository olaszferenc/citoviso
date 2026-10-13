// „Foglalás beállítása” — a vezetett foglalás-beállítás + a Segítő — ŐR (ADR-0380,
// jóváhagyott terv: assets/design-refs/tenant-admin/foglalas-kerdezz-felelek/, „B”).
//
// Mit mér (eldobható fixtúra, valódi DB + valódi HTTP-szerver + böngésző, mindkét méreten):
//   ① a hozzáférés: csak bejelentkezett tulaj, élő booking-modullal, és csak JSON-kérés
//      (űrlap-POST-ot nem fogad — kereszt-oldali űrlap nem tud JSON-t küldeni);
//   ② szakaszonkénti mentés a MEGLÉVŐ írás-függvényeken át — a DB-ből visszaolvasva:
//      kiadás módja (szobánként / egyben is / csak egyben), szobák, alapár, „nem adok meg árat”,
//      időszak (a valódi normalizálással és hibaüzenettel), szabályok, IFA három állapota,
//      értesítési cím (a rossz címet kimondja), lejárat;
//   ③ a néma akadályok hangosan: „csak az időszakokban” időszak nélkül, időszak-minimum >
//      leghosszabb foglalás, ár nélküli éjszakák;
//   ④ a próba-foglalás UGYANAZT mondja, mint a vendég-út (stayRuleErrors / stayQuote);
//   ⑤ idegen objektum (más site szobája / ára) nem íródik;
//   ⑥ a Segítő: kulcs nélkül udvarias „most nem tudok válaszolni” (az őr SOSEM költ AI-t),
//      a modell-válasz `go` mutatója csak az oldal kérdés-azonosítója lehet, a prompt kimondja
//      a „nem írok be” és a „csak a foglalásról” szabályt;
//   ⑦ böngészőben, 390 px és asztali méreten: 0 JS-hiba, szakasz-nyitás, mentés-tovább,
//      mobilon az alsó „Kérdezzen a Segítőtől” sáv nyitja a lapot, asztalin a Segítő jobb oldalt;
//   ⑧ az Online foglalás képernyő: a „Foglalás beállítása” kártya, a mai űrlap a
//      „Haladó beállítások” mögött (és a #halado link kinyitja).
//
// Usage: npx tsx scripts/booking-setup-check.mts

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
// ⛔ The gate never spends: with no key the helper answers "unavailable" before any call.
process.env.ANTHROPIC_API_KEY = "";

import { once } from "node:events";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCOPE = path.basename(ROOT);
const { db, pool } = await import("../src/db/client.js");
const { config } = await import("../src/config.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { parseHelperOutput, helperSystemPrompt, helperMealsFact, HELPER_ADV_LABELS } = await import("../src/ai/bookingHelper.js");
const { readMeals } = await import("../src/tenant/meals.js");
const { MODULE_CATALOG } = await import("../src/modules.js");
const { sql } = await import("kysely");
const { readFile } = await import("node:fs/promises");

const ids: Record<string, string> = {};
let server: Server | null = null;
const siteDirs: string[] = [];
let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  if (c) console.log(`  ✓ ${n}`);
  else {
    fail++;
    console.error(`  ✗ ${n}${d === undefined ? "" : " — " + JSON.stringify(d).slice(0, 500)}`);
  }
};

type State = {
  mode: string;
  units: { id: string; name: string; whole: boolean; cap: number | null; base: number | null; por: boolean; seasons: { id: string; label: string; from: string; to: string; min: number | null }[] }[];
  blockers: { q: string; sev: string; t: string }[];
  taxState: string | null;
};
type Resp = { ok: boolean; errors: string[]; state: State; message?: string };

try {
  // ── ⑥ pure helper rules (no AI) ───────────────────────────────────────────
  console.log("\n⑥ Segítő — a válasz ellenőrzése, a prompt szabályai");
  const qids = ["mode", "rooms", "base", "tax"];
  check("érvényes JSON + ismert go → átmegy", JSON.stringify(parseHelperOutput('{"go":"tax","advanced":"none","answer":"Az IFA…"}', qids)) === JSON.stringify({ answer: "Az IFA…", go: "tax", advanced: null }));
  check("ismeretlen go → eldobva (null), nem bízunk benne", parseHelperOutput('{"go":"admin","advanced":"booking","answer":"x"}', qids)?.go === null);
  check("advanced: csak rooms/pricing/booking", parseHelperOutput('{"go":"none","advanced":"booking","answer":"x"}', qids)?.advanced === "booking" && parseHelperOutput('{"go":"none","advanced":"evil","answer":"x"}', qids)?.advanced === null);
  check("üres válasz / nem JSON → null", parseHelperOutput('{"go":"tax","advanced":"none","answer":"  "}', qids) === null && parseHelperOutput("nem json", qids) === null);
  const sp = helperSystemPrompt("hu");
  check("prompt: „Ezt nem én írom be” + soha nem állítja, hogy beállított", sp.includes("Ezt nem én írom be") && sp.includes("Soha ne állítsa"));
  check("prompt: csak a foglalásról, más témára udvarias nem", sp.includes("csak a foglalás beállításában segítek"));
  check("prompt: kimondja, ami NINCS (előleg, lemondás, pótágy, férőhely-szűrés)", /előleg/.test(sp) && /lemondási feltétel/.test(sp) && /pótágy-díj/.test(sp) && /NEM szűri ki/.test(sp));
  check("prompt: az ellátás és a gyerekár (ADR-0378) az Árak „Ellátás” részére mutat, nem tagadja", /Ellátás és felárak/.test(sp) && /gyerekár korhatárral/.test(sp));
  // Elek 10-13 T-1: every screen name the prompt quotes exists in the code that draws it.
  const viewsSrc = await readFile(path.join(ROOT, "src/server/bookingSetupViews.ts"), "utf8");
  for (const lbl of Object.values(HELPER_ADV_LABELS)) {
    check(`prompt-felirat a kódból: „Haladó beállítások › ${lbl}” = a menü T(lang, "${lbl}") eleme`, viewsSrc.includes(`T(lang, "${lbl}")<small>`) || viewsSrc.includes(`T(lang, "${lbl}")}<small>`), lbl);
  }
  const pricingMenu = MODULE_CATALOG.find((m) => m.id === "pricing")!.publicLabel;
  check(`prompt: a bal menü neve a modul-katalógusból („${pricingMenu}”)`, sp.includes(`„${pricingMenu}”`));
  check("prompt: kitalált „Árak képernyő” név nincs", !/Haladó beállítások › Árak képernyő/.test(sp));
  const mf = helperMealsFact(readMeals({ base: "none", childAge: 12, off: [], plans: { bb: { on: true, price: 3000, per: "person", child: 1500 }, hb: { on: true, price: 7000, per: "person", child: 3500 } } }), "HUF");
  check("T-1 a Segítő tényei közt a mentett ellátás + gyerekár", /reggeli \+3000 HUF \/ fő \/ éj, gyermek 1500 HUF \(12 éves korig\)/.test(mf) && /félpanzió \+7000/.test(mf), mf);

  // ── fixture: a fresh site — one default unit, booking + pricing ──────────────
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_bsc", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");

  async function makeTenant(tag: string): Promise<{ tenantId: string; siteId: string; tuId: string; email: string }> {
    const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: `_bsc ${tag}`, raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
    ids[`lead_${tag}`] = lead.id;
    const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: `Nyugalom ${tag} (teszt)` }).returning("id").executeTakeFirstOrThrow();
    ids[`tenant_${tag}`] = tenant.id;
    const slug = `bsc-${tag}-${stamp}`;
    const email = `o-${tag}-${stamp}@example.com`;
    const site = await db.insertInto("site").values({
      tenant_id: tenant.id, preview_token: `bsc_${tag}_${stamp}`, slug, status: "live", live_at: new Date(),
      path: `sites/${slug}/index.html`, source_artifact_id: art!.id,
      edited_site_data: JSON.stringify({ name: `Nyugalom ${tag}`, intro: "Teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email }, businessType: "accommodation" }),
    }).returning("id").executeTakeFirstOrThrow();
    ids[`site_${tag}`] = site.id;
    siteDirs.push(path.join(ROOT, "sites", slug));
    const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `bsc_${tag}_${stamp}`, contact_email: email, password_hash: null }).returning("id").executeTakeFirstOrThrow();
    ids[`tu_${tag}`] = tu.id;
    await setTenantModules(tenant.id, ["booking", "pricing", "gallery"]);
    if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");
    return { tenantId: tenant.id, siteId: site.id, tuId: tu.id, email };
  }
  const A = await makeTenant("a");
  const B = await makeTenant("b");

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const COOKIE = `cit_session=${mintTenantCookieValue(A.tuId)}`;
  const api = async (p: string, body: Record<string, unknown>): Promise<Resp & Record<string, unknown>> => {
    const r = await fetch(BASE + p, { method: "POST", headers: { cookie: COOKIE, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json()) as Resp & Record<string, unknown>;
  };
  const units = async (siteId: string) =>
    db.selectFrom("site_unit").selectAll().where("site_id", "=", siteId).orderBy("sort_order").orderBy("created_at").execute();
  const cfg = async (siteId: string, m: string) =>
    ((await db.selectFrom("site_module_config").select("config").where("site_id", "=", siteId).where("module", "=", m).executeTakeFirst())?.config ?? {}) as Record<string, unknown>;

  // ── ① access ───────────────────────────────────────────────────────────────
  console.log("\n① hozzáférés");
  const page = await (await fetch(BASE + "/admin/booking-setup", { headers: { cookie: COOKIE } })).text();
  check("GET /admin/booking-setup → a lap (cím, adat, Segítő, súgó-horgony)", page.includes("Foglalás beállítása") && page.includes("data-bs-data") && page.includes("Kérdezzen a Segítőtől") && page.includes('data-kb-anchor="admin.booking.setup"'));
  const anon = await fetch(BASE + "/admin/booking-setup", { redirect: "manual" });
  check("bejelentkezés nélkül → /login", anon.status === 302 && (anon.headers.get("location") ?? "").includes("/login"));
  const form = await fetch(BASE + "/admin/booking-setup/save", { method: "POST", headers: { cookie: COOKIE, "Content-Type": "application/x-www-form-urlencoded" }, body: "section=rules&minNights=9" });
  check("űrlap-POST (nem JSON) → 401, semmi nem íródik", form.status === 401 && !("minNights" in (await cfg(A.siteId, "booking"))));

  // ── ② rooms ────────────────────────────────────────────────────────────────
  console.log("\n② szobák és kiadás módja");
  let st = (await api("/admin/booking-setup/save", { section: "rules", minNights: 1, maxNights: 30, horizon: 12, lead: 0 })).state;
  check("friss oldal: egyben, egy egység", st.mode === "single" && st.units.length === 1 && st.units[0]!.whole);
  let r = await api("/admin/booking-setup/save", { section: "rooms", mode: "rooms", units: [{ id: null, whole: false, name: "", cap: 2 }] });
  check("névtelen szoba → valódi hibaüzenet, semmi nem íródik", !r.ok && r.errors.includes("Adjon nevet minden szobának.") && (await units(A.siteId)).length === 1, r.errors);
  r = await api("/admin/booking-setup/save", {
    section: "rooms", mode: "rooms",
    units: [{ id: null, whole: false, name: "Kertre néző apartman", cap: 4 }, { id: null, whole: false, name: "Padlásszoba", cap: 2 }],
  });
  let us = await units(A.siteId);
  const whole0 = us.find((u) => u.represents_whole);
  check("szobánként: két új szoba, az egész szállás rejtve marad (nem törlődik)", r.ok && r.state.mode === "rooms" && us.length === 3 && !!whole0 && !whole0.is_whole_property, us.map((u) => [u.name, u.is_whole_property, u.represents_whole]));
  const apt = us.find((u) => u.name === "Kertre néző apartman")!;
  const attic = us.find((u) => u.name === "Padlásszoba")!;
  check("férőhely mentve", apt.capacity === 4 && attic.capacity === 2);
  r = await api("/admin/booking-setup/save", { section: "rooms", mode: "both", units: [{ id: whole0!.id, whole: true, name: "x", cap: 6 }, { id: apt.id, whole: false, name: "Kertre néző apartman", cap: 4 }, { id: attic.id, whole: false, name: "Padlásszoba", cap: 2 }] });
  us = await units(A.siteId);
  let w = us.find((u) => u.id === whole0!.id)!;
  check("szobánként és egyben is: az egész foglalható, nem csak-egyben, 6 fő", r.ok && r.state.mode === "both" && w.is_whole_property && !w.whole_only && w.capacity === 6 && w.name !== "x");
  r = await api("/admin/booking-setup/save", { section: "rooms", mode: "single", units: [{ id: whole0!.id, whole: true, name: "", cap: 6 }] });
  w = (await units(A.siteId)).find((u) => u.id === whole0!.id)!;
  check("egyben: az egész az egyetlen foglalható, a szobák bemutatásra (whole_only)", r.ok && r.state.mode === "single" && w.is_whole_property && w.whole_only);
  r = await api("/admin/booking-setup/save", { section: "rooms", mode: "rooms", units: [{ id: apt.id, whole: false, name: "Kertre néző apartman", cap: 4 }, { id: attic.id, whole: false, name: "Padlásszoba", cap: 2 }] });
  check("vissza szobánként", r.ok && r.state.mode === "rooms" && (await units(A.siteId)).length === 3);

  // ── ② prices + seasons ─────────────────────────────────────────────────────
  console.log("\n② árak és időszakok");
  r = await api("/admin/booking-setup/save", { section: "prices", currency: "HUF", priceUnit: "per_night", seasonalOnly: false, units: [{ id: apt.id, base: "19 000", por: false }, { id: attic.id, base: "", por: true }] });
  const aptBase = await db.selectFrom("unit_price").select("amount").where("unit_id", "=", apt.id).where("date_from", "is", null).executeTakeFirst();
  const atticU = (await units(A.siteId)).find((u) => u.id === attic.id)!;
  check("alapár „19 000” → 19000; a másik szoba „nem adok meg árat”", r.ok && aptBase?.amount === 19000 && atticU.price_on_request, r.errors);
  check("az ár mire szól: elmentve a pricing modulba", (await cfg(A.siteId, "pricing")).unit === "per_night");
  r = await api("/admin/booking-setup/season", { op: "add", unitIds: [apt.id], label: "Főszezon", from: "13.40", to: "08-31", amount: "28 000", min: "" });
  check("rossz dátum → a valódi hibaüzenet", !r.ok && r.errors.some((e) => e.includes("HÓNAP-NAP alakban")), r.errors);
  r = await api("/admin/booking-setup/season", { op: "add", unitIds: [apt.id], label: "Főszezon", from: "6.15", to: "08-31", amount: "28 000", min: "20" });
  const sz = r.state.units.find((u) => u.id === apt.id)!.seasons[0];
  check("„6.15” → 06-15, minimum 20 éj", r.ok && sz?.from === "06-15" && sz?.min === 20, r);
  r = await api("/admin/booking-setup/season", { op: "add", unitIds: [apt.id], label: "főszezon", from: "07-01", to: "07-31", amount: "30000", min: "" });
  check("azonos nevű időszak → az Árak képernyő üzenete", !r.ok && r.errors.some((e) => e.includes("már van „Főszezon”")), r.errors);
  r = await api("/admin/booking-setup/season", { op: "add", unitIds: [apt.id], label: "Ősz", from: "09-01", to: "09-30", amount: "15000", min: "99" });
  check("minimum 99 → „1 és 60 éj között”", !r.ok && r.errors.includes("A minimum 1 és 60 éj között lehet."));

  // ── ③ blockers ─────────────────────────────────────────────────────────────
  console.log("\n③ néma akadályok, hangosan");
  r = await api("/admin/booking-setup/save", { section: "rules", minNights: 5, maxNights: 3, horizon: 12, lead: 0 });
  check("legrövidebb > leghosszabb → a modul valódi üzenete", !r.ok && r.errors.includes("A legrövidebb foglalás nem lehet hosszabb, mint a leghosszabb."), r.errors);
  r = await api("/admin/booking-setup/save", { section: "rules", minNights: 2, maxNights: 14, horizon: 12, lead: 0 });
  check("2–14 éj elmentve", r.ok && (await cfg(A.siteId, "booking")).maxNights === 14);
  check("időszak-minimum 20 > 14 → „bad” akadály a szabályoknál", r.state.blockers.some((b) => b.sev === "bad" && b.q === "stay" && b.t.includes("legalább 20 éj kell, de a leghosszabb foglalás 14 éj")), r.state.blockers);
  r = await api("/admin/booking-setup/save", { section: "prices", currency: "HUF", priceUnit: "per_night", seasonalOnly: true, units: [{ id: apt.id, base: "19000", por: false }, { id: attic.id, base: "", por: false }] });
  check("„csak az időszakokban” + időszak nélküli szoba → „egyetlen napra sem”", r.state.blockers.some((b) => b.sev === "bad" && b.t.startsWith("Padlásszoba: egyetlen napra sem lehet foglalni")), r.state.blockers);
  r = await api("/admin/booking-setup/save", { section: "prices", currency: "HUF", priceUnit: "per_night", seasonalOnly: false, units: [{ id: apt.id, base: "19000", por: false }, { id: attic.id, base: "", por: false }] });
  check("ár nélküli szoba (nincs pipa) → „warn”: ajánlatot kér", r.state.blockers.some((b) => b.sev === "warn" && b.q === "base" && b.t.startsWith("Padlásszoba:")), r.state.blockers);

  // ── ④ trial = the guest path ───────────────────────────────────────────────
  console.log("\n④ próba-foglalás");
  const y = new Date().getUTCFullYear() + 1;
  let t = await api("/admin/booking-setup/trial", { unitId: apt.id, dateFrom: `${y}-07-10`, nights: 2, guests: 2 });
  check("júliusban 2 éj → „Legalább 20 éjszakára lehet foglalni.”", Array.isArray(t.errors) && (t.errors as string[]).includes("Legalább 20 éjszakára lehet foglalni."), t);
  const oct = new Date(Date.now() + 40 * 86400_000).toISOString().slice(0, 10);
  t = await api("/admin/booking-setup/trial", { unitId: apt.id, dateFrom: oct, nights: 2, guests: 6 });
  const q = t.quote as { totalText: string } | null;
  check("2 éj alapáron → a vendég-út ára (38 000 Ft)", (t.errors as string[]).length === 0 && !!q && q.totalText.replace(/\s/g, "").includes("38000"), t);
  check("6 fő egy 4 fős szobába → őszinte megjegyzés (a rendszer nem szűri)", ((t.notes as string[]) ?? []).some((n) => n.includes("nem szűri ki")), t.notes);
  t = await api("/admin/booking-setup/trial", { unitId: attic.id, dateFrom: oct, nights: 2, guests: 2 });
  check("ár nélküli szoba → elküldhető, végösszeg nélkül (quote: null)", (t.errors as string[]).length === 0 && t.quote === null, t);
  t = await api("/admin/booking-setup/trial", { unitId: apt.id, dateFrom: oct, nights: 20, guests: 2 });
  check("20 éj > 14 → „Legfeljebb 14 éjszakára lehet foglalni.”", (t.errors as string[]).includes("Legfeljebb 14 éjszakára lehet foglalni."), t.errors);

  // ── ② guest + notify ───────────────────────────────────────────────────────
  console.log("\n② amit a vendég lát, értesítés");
  r = await api("/admin/booking-setup/save", { section: "guest", taxState: "amount", tax: "500", includes: "Az ár tartalmazza a reggelit." });
  check("IFA 500 + „mi van az árban” elmentve", r.ok && (await cfg(A.siteId, "booking")).touristTaxPerPersonNight === 500 && (await cfg(A.siteId, "booking")).priceIncludes === "Az ár tartalmazza a reggelit.");
  t = await api("/admin/booking-setup/trial", { unitId: apt.id, dateFrom: oct, nights: 2, guests: 2 });
  check("próba: IFA külön soron (500 × 2 fő × 2 éj = 2 000 Ft)", String(t.taxText ?? "").replace(/\s/g, "").includes("2000"), t.taxText);
  // Elek 10-13 T-4 + T-3: the trial takes the meal and the children like the guest path does —
  // reggeli 3 000 / gyermek 1 500 (12 éves korig), 3 fő ebből 1 gyermek, 2 éj; the child pays no IFA.
  await sql`update site_module_config set config = config || ${JSON.stringify({
    meals: { base: "none", childAge: 12, off: [], plans: { none: { on: false }, bb: { on: true, price: 3000, per: "person", child: 1500, desc: "" }, hb: { on: false }, fb: { on: false } } },
  })}::jsonb where site_id = ${A.siteId} and module = 'pricing'`.execute(db);
  t = await api("/admin/booking-setup/trial", { unitId: apt.id, dateFrom: oct, nights: 2, guests: 3, meal: "bb", children: 1 });
  const mq = t.quote as { totalText: string; mealLines?: string[]; grandText?: string | null } | null;
  check("T-4 próba ellátással: szállás 38 000 + reggeli 2×(2×3 000 + 1 500) = 53 000 Ft, tételesen",
    !!mq && mq.totalText.replace(/\s/g, "").includes("38000") && (mq.mealLines ?? []).length === 2 && (mq.grandText ?? "").replace(/\s/g, "") === "53000Ft", t);
  check("T-3 a gyermek IFA-mentes: 500 × 2 fizető fő × 2 éj = 2 000 Ft (nem 3 000), és a mondat kimondja",
    String(t.taxText ?? "").replace(/\s/g, "").includes("2000Ft") && /18 év alatti vendég mentes/.test(String(t.taxText)) && /13–17 évesek/.test(String(t.taxText)), t.taxText);
  r = await api("/admin/booking-setup/save", { section: "guest", taxState: "none", tax: "", includes: "" });
  check("„nincs IFA” → 0 (kimondott nem)", r.ok && (await cfg(A.siteId, "booking")).touristTaxPerPersonNight === 0 && r.state.taxState === "none");
  r = await api("/admin/booking-setup/save", { section: "guest", taxState: "unknown", tax: "", includes: "" });
  check("„még nem tudom” → üres (nem 0)", r.ok && (await cfg(A.siteId, "booking")).touristTaxPerPersonNight === "" && r.state.taxState === "unknown");
  r = await api("/admin/booking-setup/save", { section: "notify", notify: "anna@, info@nyugalom.example", expiry: 48 });
  check("rossz cím → „Ez nem tűnik e-mail címnek: anna@”, semmi nem íródik", !r.ok && r.errors.includes("Ez nem tűnik e-mail címnek: anna@") && !("notifyEmail" in (await cfg(A.siteId, "booking"))), r.errors);
  r = await api("/admin/booking-setup/save", { section: "notify", notify: "info@nyugalom.example", expiry: 24 });
  const bc = await cfg(A.siteId, "booking");
  check("jó cím + 24 óra elmentve, a korábbi kulcsok megmaradtak", r.ok && bc.notifyEmail === "info@nyugalom.example" && bc.autoDeclineHours === 24 && bc.maxNights === 14 && bc.touristTaxPerPersonNight === "");

  // ── ⑤ foreign objects ──────────────────────────────────────────────────────
  console.log("\n⑤ idegen objektum");
  const bUnit = (await db.selectFrom("site_unit").select("id").where("site_id", "=", B.siteId).executeTakeFirst())
    ?? (await db.insertInto("site_unit").values({ site_id: B.siteId, name: "B szoba", sort_order: 0 }).returning("id").executeTakeFirstOrThrow());
  await db.insertInto("unit_price").values({ unit_id: bUnit.id, label: "", amount: 7777, sort_order: 0 }).execute();
  const bPrice = (await db.selectFrom("unit_price").select("id").where("unit_id", "=", bUnit.id).executeTakeFirstOrThrow()).id;
  await api("/admin/booking-setup/save", { section: "prices", currency: "HUF", priceUnit: "per_night", seasonalOnly: false, units: [{ id: bUnit.id, base: "1", por: true }] });
  await api("/admin/booking-setup/season", { op: "delete", priceId: bPrice });
  await api("/admin/booking-setup/season", { op: "add", unitIds: [bUnit.id], label: "Betörés", from: "01-01", to: "01-02", amount: "1", min: "" });
  const bRows = await db.selectFrom("unit_price").select(["amount", "label"]).where("unit_id", "=", bUnit.id).execute();
  check("más site szobájának ára / időszaka érintetlen", bRows.length === 1 && bRows[0]!.amount === 7777, bRows);
  t = await api("/admin/booking-setup/trial", { unitId: bUnit.id, dateFrom: oct, nights: 2, guests: 2 });
  check("más site szobájára próba-foglalás → semmi", (t.errors as string[]).length === 0 && !("quote" in t));

  // ── Elek 10-13 T-5: with ONE unit the Szobák screen shows the unit row; its save comes back
  //    to Szobák, not to Online foglalás ─────────────────────────────────────────
  console.log("\n⑤b Szobák lap, egy szobával — a mentés a Szobákra tér vissza (T-5)");
  await setTenantModules(B.tenantId, ["booking", "pricing", "gallery", "rooms"]);
  const COOKIE_B = `cit_session=${mintTenantCookieValue(B.tuId)}`;
  const roomsHtml = await (await fetch(BASE + "/admin?tab=modulok&m=rooms", { headers: { cookie: COOKIE_B } })).text();
  const rowForms = roomsHtml.match(/<form method="POST" action="\/admin\/units\/save" class="unit-row">[\s\S]*?<\/form>/g) ?? [];
  check("a Szobák lapon van szoba-sor űrlap, és mind back=rooms-szal ment", rowForms.length >= 1 && rowForms.every((f) => f.includes('name="back" value="rooms"')), rowForms.length);
  const saveB = await fetch(BASE + "/admin/units/save", {
    method: "POST", redirect: "manual",
    headers: { cookie: COOKIE_B, "Content-Type": "application/x-www-form-urlencoded" },
    // the unit's own values — ⑦ opens B's page as a first visit and must find it unchanged
    body: await (async () => {
      const cur = await db.selectFrom("site_unit").select(["name", "capacity", "description"]).where("id", "=", bUnit.id).executeTakeFirstOrThrow();
      return new URLSearchParams({ id: bUnit.id, name: cur.name, capacity: cur.capacity === null ? "" : String(cur.capacity), back: "rooms" }).toString();
    })(),
  });
  check("mentés után a Szobák lap jön (m=rooms&saved=1)", saveB.status === 302 && /m=rooms&saved=1/.test(saveB.headers.get("location") ?? ""), saveB.headers.get("location"));
  await setTenantModules(B.tenantId, ["booking", "pricing", "gallery"]);

  // ── ⑥ helper endpoint without a key ────────────────────────────────────────
  console.log("\n⑥ Segítő végpont (kulcs nélkül)");
  check("a gate kulcs nélkül fut (nem költ)", config.anthropicApiKey === "");
  const ask = await api("/admin/booking-setup/ask", { question: "Mi az az IFA?", ctx: "tax", history: [] });
  check("kulcs nélkül: ok:false + udvarias üzenet", ask.ok === false && String(ask.message).startsWith("Most nem tudok válaszolni"), ask);

  // ── ⑦ browser, both sizes ──────────────────────────────────────────────────
  console.log("\n⑦ böngésző — 390 px és asztali");
  const shotDir = path.join(ROOT, "assets", "Temp", SCOPE, "booking-setup");
  await mkdir(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    for (const [name, width] of [["mobile", 390], ["desktop", 1300]] as const) {
      const ctx = await browser.newContext({ viewport: { width, height: 860 } });
      await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(B.tuId), url: BASE }]);
      const p = await ctx.newPage();
      const errs: string[] = [];
      p.on("pageerror", (e) => errs.push(String(e)));
      await p.goto(BASE + "/admin/booking-setup");
      await p.waitForSelector(".bs-sec");
      check(`${name}: 6 szakasz, állapot-címkével`, (await p.locator(".bs-sec").count()) === 6 && (await p.locator(".bs-pill").count()) === 6);
      check(`${name}: első látogatás — az első hiányos szakasz nyitva`, (await p.locator(".bs-sec.is-open").count()) === 1);
      // Elek 10-13 T-4: the try-out part is not "Kész" before a trial booking ran.
      const checkPill = (await p.locator('.bs-sec[data-s="check"] .bs-pill').innerText()).trim();
      check(`${name}: a „Kipróbálás” rész kipróbálás előtt nem „Kész” („${checkPill}”)`, checkPill === "Még nem próbálta ki");
      await p.screenshot({ path: path.join(shotDir, `${name}-1-new.png`), fullPage: false });
      if (name === "mobile") {
        check("mobil: az alsó „Kérdezzen a Segítőtől” sáv látszik, a Segítő nem", await p.locator("[data-ask]").isVisible() && !(await p.locator(".bs-chat").isVisible()));
        await p.click("[data-ask]");
        check("mobil: a sáv nyitja az alsó lapot", await p.locator(".bs-chat.is-sheet.is-open").isVisible());
        await p.fill(".bs-chat__form input", "Mi az az IFA?");
        await p.press(".bs-chat__form input", "Enter");
        await p.waitForSelector(".bs-msg--ai:not(.bs-typing) >> nth=1");
        check("mobil: kulcs nélkül udvarias válasz a buborékban", (await p.locator(".bs-msg--ai").last().innerText()).startsWith("Most nem tudok válaszolni"));
        await p.screenshot({ path: path.join(shotDir, `${name}-2-chat.png`) });
        await p.click(".bs-chat__close");
      } else {
        check("asztali: a Segítő jobb oldalt látszik, az alsó sáv nem", await p.locator(".bs-chat").isVisible() && !(await p.locator("[data-ask]").isVisible()));
      }
      // first section: choose "Szobánként", name the room, save → prices opens
      await p.click('[data-opt="mode"][data-val="rooms"]');
      await p.fill('[data-k="name"]', "Erdei szoba");
      await p.fill('[data-k="cap"] >> nth=0', "3");
      await p.click('[data-next="prices"]');
      await p.waitForSelector('.bs-sec[data-s="prices"].is-open');
      const bAfter = await units(B.siteId);
      check(`${name}: „Mentés, tovább” → a szoba a DB-ben, az Árak nyílik`, bAfter.some((u) => u.name === "Erdei szoba" && u.capacity === 3));
      await p.screenshot({ path: path.join(shotDir, `${name}-3-prices.png`), fullPage: false });
      check(`${name}: 0 JS-hiba`, errs.length === 0, errs);
      // reset B's rooms for the next size
      await db.deleteFrom("site_unit").where("site_id", "=", B.siteId).where("name", "=", "Erdei szoba").execute();
      await ctx.close();
    }
    // ⑧ the booking screen
    console.log("\n⑧ Online foglalás képernyő");
    const bs = await (await fetch(BASE + "/admin?tab=modulok&m=booking", { headers: { cookie: COOKIE } })).text();
    check("„Foglalás beállítása” kártya a vezetett oldalra", bs.includes('href="/admin/booking-setup"') && bs.includes("Beállítom kérdésről kérdésre"));
    check("a mai űrlap a „Haladó beállítások” mögött", /<details class="mcfg-adv" id="halado">[\s\S]*action="\/admin\/module-config"[\s\S]*<\/details>/.test(bs));
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 860 } });
    await ctx2.addCookies([{ name: "cit_session", value: mintTenantCookieValue(A.tuId), url: BASE }]);
    const p2 = await ctx2.newPage();
    await p2.goto(BASE + "/admin?tab=modulok&m=booking#halado");
    check("a #halado link kinyitja", await p2.locator("#halado").evaluate((d) => (d as HTMLDetailsElement).open));
    await ctx2.close();
  } finally {
    await browser.close();
  }
  console.log(`  képek: ${path.relative(ROOT, shotDir)}`);
} finally {
  if (server?.listening) server.close();
  for (const d of siteDirs) await rm(d, { recursive: true, force: true }).catch(() => {});
  for (const tag of ["a", "b"]) {
    if (ids[`site_${tag}`]) await db.deleteFrom("tenant_ai_call").where("site_id", "=", ids[`site_${tag}`]!).execute().catch(() => {});
    if (ids[`tu_${tag}`]) await db.deleteFrom("tenant_user").where("id", "=", ids[`tu_${tag}`]!).execute().catch(() => {});
    if (ids[`site_${tag}`]) await db.deleteFrom("site").where("id", "=", ids[`site_${tag}`]!).execute().catch(() => {});
    if (ids[`tenant_${tag}`]) {
      await db.deleteFrom("tenant_message").where("tenant_id", "=", ids[`tenant_${tag}`]!).execute().catch(() => {});
      await db.deleteFrom("tenant").where("id", "=", ids[`tenant_${tag}`]!).execute().catch(() => {});
    }
    if (ids[`lead_${tag}`]) await db.deleteFrom("lead").where("id", "=", ids[`lead_${tag}`]!).execute().catch(() => {});
  }
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
console.log(fail ? `\n⛔ BOOKING-SETUP: ${fail} bukás` : "\n🟢 BOOKING-SETUP: a vezetett beállítás a meglévő írás-függvényeken át ír, az akadályok hangosak, a próba a vendég-út szabálya, a Segítő nem ír");
process.exit(fail ? 1 : 0);
