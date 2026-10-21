// ADR-0364 (Elek 10-11 próba-kör) — the trial PROMISES what it GIVES, and a failed start leaves
// nothing behind. Each leg is a measured defect of the 10-11 round:
//
//   ⓪ — IT 5. kör A3: the trial's end is the same Budapest wall time 14 CALENDAR days later, also
//        across the October / March DST switches (was: now + 14 × 86 400 000 ms → 13/15 days, ±1 h).
//   B1 — with the /pricing trial package set to „Ajánlott” the trial granted 7 modules, while
//        the trial form („14 napig minden funkció: foglalási naptár, …”), the login letter
//        („minden modul be van kapcsolva”) and the admin Modulok tab („A próbában minden modul…”)
//        promised all of them.
//     ① the configured package's words (trial/package.ts) = trialModuleIds(ajanlott), not „all”;
//        with NO package set, `everything` (the „minden funkció” wording stays true);
//     ② a real start grants exactly that list (module_entitlement, trial_grant);
//     ③ the login letter (tenant_message, the logged copy of what went out) names the package
//        and every granted module, names no module it lacks, and does not say „minden modul”;
//     ④ the GET /p/<token> manifest carries trial.pkg = the granted list, and the REAL page
//        (Chromium, `?proba=nyit`) prints those names in the form, not „minden funkció”;
//     ⑤ the admin Modulok tab of that trial does not say „minden modul”, names the package;
//        A7: the Foglalások tab says the booking module is not in the trial's package and
//        offers „Megrendelem” + the enquiries in Üzenetek.
//   K1 — ⑥ /p/<token>/folytatas preselects the package the trial ran on (continuation.preset), and on
//        the real page the „Összesen” charges that package (the first cut only moved the highlight).
//   B2 — a failed start locked the lead out („Ez az oldal már az Öné”, no login, no retry).
//     ⑦ a legacy HTML-copy mock: refused BEFORE anything is written (not_available), no
//        free_trial, no tenant; the house is alerted; the /p page offers no trial on it;
//     ⑧ a start that fails AFTER the tenant was built (a broken engine mock): rolled back —
//        no free_trial, no tenant, no sites/<tenant>, lifecycle back, alert sent, the lead not
//        "owned"; once the mock is fixed the SAME lead starts the trial;
//     ⑨ the state the old code left (active claim, tenant_id NULL, an orphan tenant): the lead is
//        not "owned", the /p page offers the trial again, and the next submit finishes it.
//
// With the pre-fix code every leg is red (①–⑥ have no source to read, ⑦–⑨ left the rows).
//
// The dev DB is SHARED: config by PROCESS-LOCAL override, every row this run's own and deleted
// in `finally`, the sites/ directories removed. EMAIL_PROVIDER must be mock.
//
// Run: EMAIL_PROVIDER=mock npx tsx scripts/trial-promise-check.mts

import { rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { setHouseAlertDeps } from "../src/console/houseAlert.js";
import { ownedSiteForLead } from "../src/conversion/owned.js";
import { MODULE_CATALOG } from "../src/modules.js";
import { loadPricing } from "../src/pricing.js";
import { overrideFreeTrialConfigInProcess, trialUntilFrom } from "../src/trial/config.js";
import { budapestHhmm, budapestIsoDay, isoDayDiff } from "../src/text/budapestTime.js";
import { configuredTrialPackage, trialModuleIds } from "../src/trial/package.js";
import { startTrial } from "../src/trial/start.js";
import { trialAdminState } from "../src/trial/admin.js";
import { adminDashboard } from "../src/server/adminViews.js";
import { getTenantModules } from "../src/tenant/modules.js";

process.env.CONSOLE_PORT = "0";
process.env.CIT_SHOT = "1";
const stamp = Date.now().toString(36);
let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

if (config.emailProvider !== "mock") {
  console.error(`⛔ trial-promise-check: EMAIL_PROVIDER=${config.emailProvider} — a próba valódi belépő-levelet küldene. Futtasd: EMAIL_PROVIDER=mock`);
  process.exit(2);
}

const SITE = {
  name: `_trialpromise_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/trialpromise-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;
const BROKEN_RECIPE = { template: "___nincs___", skin: "", archetype: "", sections: [] } as unknown as Recipe;

const leads: string[] = [];
const MOCK_REL = `sites/_trialpromise_${stamp}.html`;
const MOCK_FILE = path.resolve(process.cwd(), MOCK_REL);
let closeConsole: (() => void) | null = null;
let defId: string | null = null;
let runId: string | null = null;
const alerts: string[] = [];

type Kind = "engine" | "legacy" | "broken";
async function fixtureLead(tag: string, kind: Kind = "engine"): Promise<{ leadId: string; prospectId: string; token: string; artId: string }> {
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: runId!, name: `_trialpromise_${stamp} ${tag}`, raw: JSON.stringify({}), lifecycle_status: "outreach" })
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const inputs =
    kind === "legacy"
      ? { engine: "legacy-html" }
      : { engine: "composition", recipe: kind === "broken" ? BROKEN_RECIPE : RECIPE, siteData: SITE };
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: MOCK_REL, inputs: JSON.stringify(inputs) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const token = `trialpromise${stamp}${tag}xxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  const pr = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date() })
    .returning("id")
    .executeTakeFirstOrThrow();
  return { leadId: lead.id, prospectId: pr.id, token, artId: art.id };
}

const FORM = { name: "Teszt Elek", email: "trialpromise@example.invalid", phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true };
const labelOf = (id: string): string => MODULE_CATALOG.find((m) => m.id === id)?.publicLabel ?? id;
const textOf = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

try {
  setHouseAlertDeps({ recipientEmail: async () => "house@example.invalid", send: async (m) => void alerts.push(`${m.subject}\n${m.text}`) });
  const def = await db
    .insertInto("scraper_definition")
    .values({ label: `_trialpromise_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id")
    .executeTakeFirstOrThrow();
  defId = def.id;
  runId = (await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow()).id;
  await writeFile(MOCK_FILE, "<!doctype html><html><head><title>t</title></head><body><main>mock</main></body></html>");
  await loadPricing(true);

  // ⓪ IT 5. kör A3: the trial's end is the same Budapest wall time `days` CALENDAR days later —
  // also across the October / March DST switches (before: now + 14 × 86 400 000 ms → 13 or 15
  // calendar days, or ±1 hour).
  console.log("⓪ a próba vége naptári napokkal, óraátállításon át");
  for (const start of [
    "2026-10-11T23:30:00+02:00", "2026-10-12T00:30:00+02:00", "2026-10-12T09:00:00+02:00",
    "2026-10-16T23:59:00+02:00", "2026-10-17T00:01:00+02:00", "2027-03-14T00:30:00+01:00",
    "2027-03-15T23:30:00+01:00", "2027-03-20T12:00:00+01:00",
  ]) {
    const st = new Date(start);
    const end = trialUntilFrom(st, 14);
    const days = isoDayDiff(budapestIsoDay(st), budapestIsoDay(end));
    check(`${start} → ${budapestIsoDay(end)} ${budapestHhmm(end)}: 14 naptári nap, ugyanaz az óra`, days === 14 && budapestHhmm(end) === budapestHhmm(st), `${days} nap`);
  }
  // The spring gap: 02:30 does not exist on 2027-03-28 → 03:30 the same day, still 14 days.
  const gap = trialUntilFrom(new Date("2027-03-14T02:30:00+01:00"), 14);
  check("tavaszi lyuk: 02:30 → 2027-03-28 03:30", budapestIsoDay(gap) === "2027-03-28" && budapestHhmm(gap) === "03:30", `${budapestIsoDay(gap)} ${budapestHhmm(gap)}`);

  // ① the words, from the configured package
  console.log("① a beállított próba-csomag szavai");
  overrideFreeTrialConfigInProcess({ enabled: true, days: 14 });
  const all = await configuredTrialPackage();
  check("csomag nélkül (régi szabály): everything → a „minden funkció” szöveg igaz", all.everything);
  overrideFreeTrialConfigInProcess({ enabled: true, days: 14, package: "ajanlott" });
  const pkg = await configuredTrialPackage();
  const granted = trialModuleIds("ajanlott");
  const lacking = MODULE_CATALOG.filter((m) => !m.retired && m.billing !== "once" && !granted.includes(m.id)).map((m) => m.id);
  check("Ajánlott: NEM everything, a neve „Ajánlott”", !pkg.everything && pkg.label === "Ajánlott", JSON.stringify(pkg));
  check("Ajánlott: a kiírt modul-lista = a ténylegesen adott (trialModuleIds)", JSON.stringify([...pkg.moduleIds].sort()) === JSON.stringify([...granted].sort()), `${pkg.moduleIds.join(",")} vs ${granted.join(",")}`);
  check("…és van olyan modul, ami NINCS benne (a mérés értelmes)", lacking.length > 0 && lacking.includes("booking"), lacking.join(","));

  // ② + ③ a real start
  console.log("②③ valódi indítás: jogosultság + belépő-levél");
  const a = await fixtureLead("a");
  const ra = await startTrial(a.token, FORM);
  check("a próba elindult", ra.ok, JSON.stringify(ra));
  const tenantA = ra.ok ? ra.tenantId : null;
  const ent = tenantA
    ? (await db.selectFrom("module_entitlement").select("module").where("tenant_id", "=", tenantA).where("active", "=", true).where("trial_grant", "=", true).execute()).map((r) => r.module)
    : [];
  check("a megadott modulok = trialModuleIds(ajanlott)", JSON.stringify([...ent].sort()) === JSON.stringify([...granted].sort()), ent.join(","));
  const letter = tenantA
    ? await db.selectFrom("tenant_message").select("body_text").where("tenant_id", "=", tenantA).where("kind", "=", "credentials").executeTakeFirst()
    : undefined;
  const lt = letter?.body_text ?? "";
  check("a belépő-levél NEM ígér „minden modul”-t", !!lt && !/minden modul/i.test(lt), lt.slice(0, 160));
  check("…a csomag nevét mondja („az Ajánlott csomag moduljai”)", lt.includes("az Ajánlott csomag moduljai be vannak kapcsolva"));
  const missingInLetter = granted.filter((id) => !MODULE_CATALOG.find((m) => m.id === id)?.retired).filter((id) => !lt.includes(labelOf(id)));
  check("…minden adott modul nevét kiírja", missingInLetter.length === 0, missingInLetter.join(","));
  check("…és egyet sem, amit NEM adott (pl. „Online foglalás”)", !lacking.some((id) => lt.includes(labelOf(id))), lacking.filter((id) => lt.includes(labelOf(id))).join(","));

  // ④ the page
  console.log("④ a terv-lap próba-űrlapja");
  const { server: consoleServer } = await import("../src/console/server.js");
  closeConsole = () => {
    consoleServer.closeAllConnections();
    consoleServer.close();
  };
  if (!consoleServer.listening) await new Promise((r) => consoleServer.once("listening", r));
  const cport = (consoleServer.address() as { port: number }).port;
  const manifest = async (p: string): Promise<Record<string, unknown> | null> => {
    const r = await fetch(`http://127.0.0.1:${cport}${p}`, { redirect: "manual" });
    const html = r.status === 200 ? await r.text() : "";
    const m = /<script type="application\/json" data-cit-configurator>([\s\S]*?)<\/script>/.exec(html);
    return m ? (JSON.parse(m[1]!) as Record<string, unknown>) : null;
  };
  const b = await fixtureLead("b");
  const mb = await manifest(`/p/${b.token}`);
  const tp = (mb?.trial as { pkg?: { label?: string; modules?: { id: string }[] } } | undefined)?.pkg;
  check("a manifest trial.pkg-je = a ténylegesen adott lista", !!tp && JSON.stringify((tp.modules ?? []).map((m) => m.id).sort()) === JSON.stringify([...granted].sort()), JSON.stringify(tp));
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errs: string[] = [];
      page.on("pageerror", (e) => errs.push(e.message));
      await page.goto(`http://127.0.0.1:${cport}/p/${b.token}?proba=nyit`, { waitUntil: "load" });
      await page.waitForSelector(".cit-cfg-tfacts", { state: "attached", timeout: 15_000 }).catch(() => null);
      const facts = (await page.locator(".cit-cfg-tfacts").first().textContent().catch(() => "")) ?? "";
      check(`${width}px: az űrlap NEM ígér „minden funkció”-t`, !!facts && !/minden funkció/.test(facts), facts.slice(0, 140));
      check(`${width}px: …a csomag nevét és az adott modulokat mondja`, facts.includes("(Ajánlott)") && granted.every((id) => facts.includes(labelOf(id))));
      check(`${width}px: …foglalási naptárt nem ígér`, !/foglalási naptár|Online foglalás/.test(facts));
      check(`${width}px: JS-hiba 0`, errs.length === 0, errs.join(" | "));
      await page.close();
    }
  } finally {
    await browser.close();
  }

  // ⑤ admin
  console.log("⑤ admin: Modulok és Foglalások fül a próbában");
  if (tenantA) {
    const state = await trialAdminState(tenantA);
    const mv = await getTenantModules(tenantA);
    const render = (tab: string): string =>
      textOf(
        adminDashboard(
          { tenantId: tenantA, username: "x", displayName: "x" } as never,
          { lang: "hu", status: "live", name: "x", usingOwnPhotos: false, intro: "x".repeat(60), photos: [] } as never,
          { siteSlug: "x", tab, modules: mv, paidEmpty: [], now: new Date(), trial: state } as never,
        ),
      );
    const mod = render("modulok");
    check("Modulok fül: NEM „minden modul be van kapcsolva”", !/minden modul be van kapcsolva/.test(mod));
    check("…a próba csomagját nevezi meg", mod.includes("A próba csomagja: Ajánlott."));
    const fog = render("foglalasok");
    check("A7 Foglalások fül: kimondja, hogy a foglalás nincs a próba csomagjában", fog.includes("Az online foglalás nincs benne a próba csomagjában (Ajánlott)."));
    check("A7 …és a „Megrendelem” utat + az Üzenetek-beli érdeklődéseket kínálja", fog.includes("Megrendelem — csomag és modulok") && fog.includes("Érdeklődések az Üzenetekben"));
  }

  // ⑥ K1
  console.log("⑥ K1: a folytatás a próba csomagját jelöli elő");
  const mc = await manifest(`/p/${a.token}/folytatas`);
  const preset = (mc?.continuation as { preset?: string } | undefined)?.preset;
  check("continuation.preset = ajanlott", preset === "ajanlott", String(preset));
  // …and on the REAL page the ticked set (so the price) follows it — first cut highlighted
  // „Ajánlott” while the total still charged „Teljes”.
  const { chromium: chromiumK1 } = await import("playwright-core");
  const bk = await chromiumK1.launch();
  try {
    const pg = await bk.newPage({ viewport: { width: 390, height: 900 } });
    await pg.goto(`http://127.0.0.1:${cport}/p/${a.token}/folytatas`, { waitUntil: "load" });
    await pg.waitForSelector(".cit-cfg-preset--on", { state: "attached", timeout: 15_000 }).catch(() => null);
    // A string, not a function: tsx would wrap a named helper in __name(), which the page lacks.
    const k1 = (await pg.evaluate(`(() => {
      const on = document.querySelector(".cit-cfg-preset--on");
      const sq = (x) => (x || "").replace(/\\s+/g, " ").trim();
      const price = on ? sq((on.querySelector(".cit-cfg-preset__price") || {}).textContent) : "";
      const strap = sq((document.querySelector(".cit-cfg-mini__amt") || {}).textContent);
      return { id: on ? on.getAttribute("data-preset") : null, price, strap };
    })()`)) as { id: string | null; price: string; strap: string };
    // The card's price (the discounted one = its last amount) must be the amount „Összesen” charges.
    const amounts = (x: string): string[] => (x.match(/\d[\d\s\u00a0]*\d/g) ?? []).map((n) => n.replace(/[^\d]/g, ""));
    const cardCharge = amounts(k1.price).at(-1) ?? "";
    check("a lapon az Ajánlott van kijelölve, és az „Összesen” az Ajánlott árát mondja", k1.id === "ajanlott" && !!cardCharge && amounts(k1.strap).includes(cardCharge), JSON.stringify(k1));
  } finally {
    await bk.close();
  }

  // ⑦ legacy mock
  console.log("⑦ B2: régi HTML-másolat mock");
  const c = await fixtureLead("c", "legacy");
  const mcl = await manifest(`/p/${c.token}`);
  check("a lap régi mocknál NEM kínál próbát (nincs trial a manifestben)", !!mcl && !mcl.trial);
  const alertsBefore = alerts.length;
  const rc = await startTrial(c.token, FORM);
  check("a kézi indítás not_available-t ad", !rc.ok && rc.error === "not_available", JSON.stringify(rc));
  const cRows = await db.selectFrom("free_trial").select("id").where("lead_id", "=", c.leadId).execute();
  const cTen = await db.selectFrom("tenant").select("id").where("lead_id", "=", c.leadId).execute();
  check("…és SEMMI nem jött létre (free_trial 0, tenant 0)", cRows.length === 0 && cTen.length === 0, `${cRows.length}/${cTen.length}`);
  check("…az operátor riasztást kapott", alerts.length === alertsBefore + 1 && /NEM indult el/.test(alerts.at(-1) ?? ""));

  // ⑧ failure after the tenant was built
  console.log("⑧ B2: a tenant után elbukó indítás visszagörgetődik");
  const d = await fixtureLead("d", "broken");
  const alertsD = alerts.length;
  const rd = await startTrial(d.token, FORM);
  check("a hibás mock indítása provision_failed", !rd.ok && rd.error === "provision_failed", JSON.stringify(rd));
  const dRows = await db.selectFrom("free_trial").select("id").where("lead_id", "=", d.leadId).execute();
  const dTen = await db.selectFrom("tenant").select("id").where("lead_id", "=", d.leadId).execute();
  check("…nincs ott maradt free_trial és tenant", dRows.length === 0 && dTen.length === 0, `${dRows.length}/${dTen.length}`);
  const dLead = await db.selectFrom("lead").select("lifecycle_status").where("id", "=", d.leadId).executeTakeFirst();
  check("…a lead életciklusa visszaállt (outreach)", dLead?.lifecycle_status === "outreach", String(dLead?.lifecycle_status));
  check("…a lead NEM „az Öné” (ownedSiteForLead null)", (await ownedSiteForLead(d.leadId)) === null);
  check("…az operátor riasztást kapott", alerts.length === alertsD + 1 && /visszagörgetve/.test(alerts.at(-1) ?? ""));
  const goneId = /tenant ([0-9a-f-]{36}) törölve/.exec(alerts.at(-1) ?? "")?.[1];
  const dirLeft = goneId ? await stat(path.resolve(process.cwd(), "sites", goneId)).then(() => true, () => false) : true;
  check("…a törölt tenant sites/ könyvtára sincs meg", !!goneId && !dirLeft, String(goneId));
  const mdl = await manifest(`/p/${d.token}`);
  check("…a lap újra kínálja a próbát", !!mdl?.trial);
  await db.updateTable("mock_artifact").set({ inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) }).where("id", "=", d.artId).execute();
  const rd2 = await startTrial(d.token, FORM);
  check("…a mock javítása után UGYANAZ a lead elindítja a próbát", rd2.ok && !rd2.existing, JSON.stringify(rd2));

  // ⑨ the state the old code left behind
  console.log("⑨ B2: a régi kód által hagyott félkész állapot gyógyul");
  const e = await fixtureLead("e");
  const eTenant = await db.insertInto("tenant").values({ lead_id: e.leadId, display_name: "orphan" }).returning("id").executeTakeFirstOrThrow();
  await db
    .insertInto("free_trial")
    .values({
      lead_id: e.leadId,
      prospect_id: e.prospectId,
      contact_name: "Teszt Elek",
      contact_email: "trialpromise@example.invalid",
      contact_phone: "+36301234567",
      terms_accepted_at: new Date(),
      terms_text: "x",
      photo_rights_declared_at: new Date(),
      photo_rights_text: "x",
      started_at: new Date(Date.now() - 3_600_000),
      trial_until: new Date(Date.now() + 13 * 86_400_000),
      created_at: new Date(Date.now() - 3_600_000) as never,
    })
    .execute();
  check("árva tenant + tenant nélküli foglalás: a lead NEM „az Öné”", (await ownedSiteForLead(e.leadId)) === null);
  const mel = await manifest(`/p/${e.token}`);
  check("…a lap a próbát kínálja (nem „Ez az oldal már az Öné”)", !!mel?.trial);
  const re = await startTrial(e.token, FORM);
  const eAfter = await db.selectFrom("free_trial").select("tenant_id").where("lead_id", "=", e.leadId).executeTakeFirst();
  check("…a következő beküldés befejezi (ugyanaz a tenant, belépővel)", re.ok && eAfter?.tenant_id === eTenant.id, JSON.stringify(re));
  if (re.ok) {
    const login = await db.selectFrom("tenant_user").select("id").where("tenant_id", "=", re.tenantId).executeTakeFirst();
    check("…a tulaj kapott belépőt", !!login);
  }
} finally {
  closeConsole?.();
  setHouseAlertDeps(null);
  overrideFreeTrialConfigInProcess(null);
  await rm(MOCK_FILE, { force: true });
  for (const l of leads) {
    const tIds = (await db.selectFrom("tenant").select("id").where("lead_id", "=", l).execute()).map((r) => r.id);
    for (const t of tIds) {
      await db.deleteFrom("offer").where("tenant_id", "=", t).execute();
      await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
    }
    await db.deleteFrom("free_trial").where("lead_id", "=", l).execute();
    for (const t of tIds) await db.deleteFrom("tenant").where("id", "=", t).execute();
    const pIds = (await db.selectFrom("prospect").select("id").where("lead_id", "=", l).execute()).map((r) => r.id);
    if (pIds.length) {
      await db.deleteFrom("offer").where("prospect_id", "in", pIds).execute();
      const vIds = (await db.selectFrom("mock_view").select("id").where("prospect_id", "in", pIds).execute()).map((r) => r.id);
      if (vIds.length) await db.deleteFrom("mock_event").where("mock_view_id", "in", vIds).execute();
      await db.deleteFrom("mock_view").where("prospect_id", "in", pIds).execute();
    }
    await db.deleteFrom("prospect").where("lead_id", "=", l).execute();
    await db.deleteFrom("mock_artifact").where("lead_id", "=", l).execute();
    await db.deleteFrom("lead").where("id", "=", l).execute();
  }
  if (runId) await db.deleteFrom("scrape_run").where("id", "=", runId).execute();
  if (defId) await db.deleteFrom("scraper_definition").where("id", "=", defId).execute();
  await db.destroy();
}

if (failures > 0) {
  console.error(`\n⛔ trial-promise-check: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ trial-promise-check: minden zöld");
process.exit(0);
