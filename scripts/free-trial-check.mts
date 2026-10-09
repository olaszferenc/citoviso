// ADR-0342 — the card-less free trial (src/trial/). What this proves, each leg a way the
// trial could quietly cost money or hand out a second site:
//   ① a valid submit → tenant + LIVE site on the subdomain + free_trial row, trial_until =
//      start + the CONFIGURED days;
//   ② double submit (two at once, then a third later) → ONE free_trial, ONE tenant; the
//      repeat answers the same trial (existing:true);
//   ③ no subscription row → the billing tick's scoped door mints NO renewal order, and no
//      dunning_event exists for the tenant;
//   ④ EVERY non-retired module is active and flagged trial_grant (translation included);
//   ⑤ exactly ONE coupon (kind=coupon, scope=purchase, the CONFIGURED percent, expiring);
//      the prospect's intro offer is ended (the trial is chosen INSTEAD of it);
//   ⑥ `trial_start` lands on the mock_event spine (the visit the page is in);
//   ⑦ a lead that already owns a site is refused (already_owned), and creates nothing;
//   ⑧ a missing ÁSZF / photo-rights tick is refused BEFORE any row is written;
//   ⑨ the app_setting parser: missing keys → defaults, corrupt / out-of-range → null;
//   ⑩ the address the page PROMISES is the address the trial GETS: `trial.sub` in the
//      GET /p/<token> manifest (ADR-0343 ②) = the slug convertLead gives the site — for a
//      lead with a preview label (ADR-0330) AND for a label-less one whose name-derived
//      slug is already held by another site (measured 2026-10-09: the page said
//      `<name>.citoviso.com`, the site got `<name>-2`).
//   ⑪ IT A-02: a start that crashed after the tenant was written is RESUMED by the next
//      submit (live site, coupon, login) — not answered "your trial is already running";
//   ⑫ IT A-05: the trial ends the intro/escalation offers of EVERY token of the lead, and
//      no decision-helper offer is minted for a trial lead afterwards;
//   ⑬ IT A-04 / B2: a pre-trial initial order (intro price) is not payable during the
//      trial — /pay/go leads to /folytatas, requestPayment refuses it.
//
// The dev DB is SHARED: the config is set with the PROCESS-LOCAL override (the app_setting
// row is never written); every row is this run's own and deleted in `finally`; the
// snapshot directory under sites/ is removed. EMAIL_PROVIDER must be mock (the trial sends
// the real login letter otherwise) — the guard refuses to run on anything else.
//
// --self-test: after the trial starts, the world is SABOTAGED (a subscription row, a module
// switched off, the intro offer revived, the preview label moved between the page and the
// submit) — legs ③ ④ ⑤ ⑩ must go red, or the guard is blind.
//
// Run: EMAIL_PROVIDER=mock npx tsx scripts/free-trial-check.mts

import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { mintRenewalForTenant } from "../src/payment/billing.js";
import {
  FREE_TRIAL_CONFIG_DEFAULT,
  overrideFreeTrialConfigInProcess,
  parseFreeTrialSetting,
} from "../src/trial/config.js";
import { overrideCouponConfigInProcess } from "../src/payment/couponConfig.js";
import { startTrial, trialModuleIds } from "../src/trial/start.js";
import { preTrialOrderOfContinuableTrial } from "../src/conversion/owned.js";
import { ensureEscalationOffer, ESCALATION_CONFIG_DEFAULT, overrideEscalationConfigInProcess } from "../src/payment/offers.js";
import { resolvePayEntry } from "../src/payment/payEntry.js";
import { requestPayment } from "../src/payment/service.js";

const SELF_TEST = process.argv.includes("--self-test");
// ⑩ reads the REAL GET /p/<token> page: the console server is imported in-process on a
// free port, with its background jobs off (CIT_SHOT=1 — no AI top-ups, no scheduled writes).
process.env.CONSOLE_PORT = "0";
process.env.CIT_SHOT = "1";
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

if (config.emailProvider !== "mock") {
  console.error(`⛔ free-trial-check: EMAIL_PROVIDER=${config.emailProvider} — a próba valódi belépő-levelet küldene. Futtasd: EMAIL_PROVIDER=mock`);
  process.exit(2);
}

const SITE: SiteData = {
  name: `_trialcheck_${stamp} Panzió`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/trialcheck-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const RECIPE: Recipe = { template: "editorial", skin: "", archetype: "", sections: [] } as unknown as Recipe;

const leads: string[] = [];
const MOCK_FILE = path.resolve(process.cwd(), `sites/_trialcheck_${stamp}.html`);
let closeConsole: (() => void) | null = null;
const tenants: string[] = [];
let defId: string | null = null;
let runId: string | null = null;

async function fixtureLead(
  tag: string,
  over: { name?: string; previewLabel?: string } = {},
): Promise<{ leadId: string; prospectId: string; token: string; artId: string }> {
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: runId!,
      name: over.name ?? `_trialcheck_${stamp} ${tag}`,
      raw: JSON.stringify({}),
      ...(over.previewLabel ? { preview_label: over.previewLabel } : {}),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: `sites/_trialcheck_${stamp}.html`, inputs: JSON.stringify({ engine: "composition", recipe: RECIPE, siteData: SITE }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const token = `trialcheck${stamp}${tag}xxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  const pr = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date() })
    .returning("id")
    .executeTakeFirstOrThrow();
  return { leadId: lead.id, prospectId: pr.id, token, artId: art.id };
}

const FORM = { name: "Teszt Elek", email: "trialcheck@example.invalid", phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true };

try {
  // ⑨ the parser (pure)
  console.log("⑨ app_setting parser");
  const d = FREE_TRIAL_CONFIG_DEFAULT;
  check("üres objektum → alapértékek", JSON.stringify(parseFreeTrialSetting("{}")) === JSON.stringify(d));
  check("days 0 → null (érvénytelen)", parseFreeTrialSetting('{"days":0}') === null);
  check("a régi couponPercent mezőt figyelmen kívül hagyja (ADR-0346: a kupon a közös beállításé)", JSON.stringify(parseFreeTrialSetting('{"couponPercent":2.5}')) === JSON.stringify(d));
  check("sérült JSON → null", parseFreeTrialSetting("{nem json") === null);
  check("enabled:false megmarad", parseFreeTrialSetting('{"enabled":false}')?.enabled === false);

  overrideFreeTrialConfigInProcess({ enabled: true, days: 9 });
  overrideCouponConfigInProcess({ percent: 30, days: 40 });
  const def = await db
    .insertInto("scraper_definition")
    .values({ label: `_trialcheck_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id")
    .executeTakeFirstOrThrow();
  defId = def.id;
  runId = (await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow()).id;

  const a = await fixtureLead("a");
  await db.insertInto("offer").values({ kind: "outreach", prospect_id: a.prospectId, percent: 25, scope: "initial" }).execute();
  const view = await db.insertInto("mock_view").values({ prospect_id: a.prospectId }).returning("id").executeTakeFirstOrThrow();

  // ⑧ refused before any write
  console.log("⑧ hiányzó pipa");
  const noTerms = await startTrial(a.token, { ...FORM, aszfAccepted: false });
  const noPhoto = await startTrial(a.token, { ...FORM, photoRightsAccepted: false });
  const rowsAfterRefusal = await db.selectFrom("free_trial").select("id").where("lead_id", "=", a.leadId).execute();
  check("ÁSZF nélkül → terms_required", !noTerms.ok && noTerms.error === "terms_required");
  check("fotó-nyilatkozat nélkül → photo_rights_required", !noPhoto.ok && noPhoto.error === "photo_rights_required");
  check("elutasítás nem írt sort", rowsAfterRefusal.length === 0);

  // ① + ② two at once, then a third
  console.log("①② indítás + dupla kattintás");
  const t0 = Date.now();
  const [r1, r2] = await Promise.all([
    startTrial(a.token, { ...FORM, viewId: view.id }),
    startTrial(a.token, { ...FORM, viewId: view.id }),
  ]);
  const r3 = await startTrial(a.token, FORM);
  const okOne = [r1, r2].filter((r) => r.ok);
  check("párhuzamos kettőből legalább egy sikeres", okOne.length >= 1, JSON.stringify([r1, r2].map((r) => (r.ok ? "ok" : r.error))));
  const trials = await db.selectFrom("free_trial").selectAll().where("lead_id", "=", a.leadId).execute();
  const tns = await db.selectFrom("tenant").select("id").where("lead_id", "=", a.leadId).execute();
  tenants.push(...tns.map((t) => t.id));
  check("EGY free_trial sor", trials.length === 1, `${trials.length}`);
  check("EGY tenant", tns.length === 1, `${tns.length}`);
  check("a harmadik ugyanazt a próbát adja (existing)", r3.ok && r3.existing && r3.tenantId === tns[0]?.id);
  const tenantId = tns[0]!.id;
  const site = await db.selectFrom("site").select(["status", "slug"]).where("tenant_id", "=", tenantId).executeTakeFirst();
  check("a site LIVE az aldomainen", site?.status === "live" && !!site.slug, `${site?.status} ${site?.slug}`);
  const days = (new Date(trials[0]!.trial_until as unknown as string).getTime() - t0) / 86_400_000;
  check("trial_until = a beállított 9 nap", Math.abs(days - 9) < 0.01, days.toFixed(3));

  if (SELF_TEST) {
    await db
      .insertInto("subscription")
      .values({ tenant_id: tenantId, anchor_date: new Date(), current_period_start: new Date(), current_period_end: new Date(Date.now() + 30 * 86_400_000) })
      .execute();
    await db.updateTable("module_entitlement").set({ active: false }).where("tenant_id", "=", tenantId).where("module", "=", "gallery").execute();
    await db.updateTable("offer").set({ expires_at: null }).where("prospect_id", "=", a.prospectId).where("kind", "=", "outreach").execute();
  }

  // ③ billing cannot see it
  console.log("③ nincs számla / dunning");
  const sub = await db.selectFrom("subscription").select("id").where("tenant_id", "=", tenantId).executeTakeFirst();
  check("nincs subscription sor", !sub);
  const mint = await mintRenewalForTenant(tenantId, new Date(Date.now() + 400 * 86_400_000));
  check("a megújulás-mintázó nem mintáz rendelést", mint.orderIntentId === null);
  const renewals = await db.selectFrom("order_intent").select("id").where("tenant_id", "=", tenantId).execute();
  check("nincs order_intent a tenanton", renewals.length === 0);

  // ④ full function
  console.log("④ minden modul");
  const ents = await db.selectFrom("module_entitlement").select(["module", "active", "trial_grant"]).where("tenant_id", "=", tenantId).execute();
  const want = trialModuleIds();
  const missing = want.filter((m) => !ents.some((e) => e.module === m && e.active && e.trial_grant));
  check("minden nem-kivezetett modul aktív + trial_grant", missing.length === 0, missing.join(",") || `${want.length} modul`);
  check("a fordítás (multilang) is benne", want.includes("multilang"));

  // ⑤ coupon + intro offer ended
  console.log("⑤ kupon");
  const coupons = await db.selectFrom("offer").select(["percent", "scope", "expires_at"]).where("tenant_id", "=", tenantId).where("kind", "=", "coupon").execute();
  check("pontosan EGY kupon", coupons.length === 1, `${coupons.length}`);
  check("kupon: a KÖZÖS beállítás 30%-a, scope=purchase, lejárattal", coupons[0]?.percent === 30 && coupons[0]?.scope === "purchase" && !!coupons[0]?.expires_at);
  const tu = await db.selectFrom("free_trial").select("trial_until").where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
  // IT B1-HATAR (ADR-XXXX): the letters print "<day>-ig" — the coupon holds to the END of that
  // Budapest day, not to the trial's start-hour on it (it ran out at 09:20 of the printed day).
  const { addIsoDays, budapestDayEnd, budapestIsoDay } = await import("../src/text/budapestTime.js");
  const couponDay = addIsoDays(budapestIsoDay(new Date(tu.trial_until as unknown as string)), 40);
  const couponExp = new Date(coupons[0]?.expires_at as unknown as string);
  check("kupon lejárata = a próba vége + a közös beállítás 40 napja, a nap VÉGÉIG (23:59:59.999 Budapest)",
    couponExp.getTime() === budapestDayEnd(couponDay).getTime() && budapestIsoDay(couponExp) === couponDay, couponExp.toISOString());
  const { purgeDay } = await import("../src/trial/retention.js");
  check("a törlés napja a kupon-nap UTÁN jön (40 < 90 nap)", purgeDay(new Date(tu.trial_until as unknown as string)) > couponDay);
  const intro = await db.selectFrom("offer").select("expires_at").where("prospect_id", "=", a.prospectId).where("kind", "=", "outreach").executeTakeFirst();
  check("az outreach-ajánlat lezárva", !!intro?.expires_at && new Date(intro.expires_at as unknown as string).getTime() <= Date.now());

  // ⑥ measurement
  console.log("⑥ mérés");
  const ev = await db.selectFrom("mock_event").select("id").where("mock_view_id", "=", view.id).where("type", "=", "trial_start").execute();
  check("trial_start esemény a látogatáson (egyszer)", ev.length === 1, `${ev.length}`);

  // ⑦ an owner is refused
  console.log("⑦ már vásárolt lead");
  const b = await fixtureLead("b");
  const bt = await db.insertInto("tenant").values({ lead_id: b.leadId, display_name: `_trialcheck_${stamp} b` }).returning("id").executeTakeFirstOrThrow();
  tenants.push(bt.id);
  const rb = await startTrial(b.token, FORM);
  const bTrials = await db.selectFrom("free_trial").select("id").where("lead_id", "=", b.leadId).execute();
  check("tulajdonos lead → already_owned", !rb.ok && rb.error === "already_owned");
  check("…és nem írt próba-sort", bTrials.length === 0);

  // ⑩ promised address = given address, read off the real page
  console.log("⑩ a lapon ígért aldomain = a próba-site slugja");
  await writeFile(MOCK_FILE, "<!doctype html><html><head><title>t</title></head><body><main>mock</main></body></html>");
  const { server: consoleServer } = await import("../src/console/server.js");
  closeConsole = () => {
    consoleServer.closeAllConnections();
    consoleServer.close();
  };
  if (!consoleServer.listening) await new Promise((r) => consoleServer.once("listening", r));
  const cport = (consoleServer.address() as { port: number }).port;
  const promisedSub = async (token: string): Promise<string | null> => {
    const r = await fetch(`http://127.0.0.1:${cport}/p/${token}`, { redirect: "manual" });
    const html = r.status === 200 ? await r.text() : "";
    const m = /<script type="application\/json" data-cit-configurator>([\s\S]*?)<\/script>/.exec(html);
    if (!m) return null;
    const mf = JSON.parse(m[1]!) as { trial?: { sub?: string } };
    return mf.trial?.sub ?? null;
  };
  const givenSub = async (leadId: string): Promise<string | null> => {
    const s = await db
      .selectFrom("site")
      .innerJoin("tenant", "tenant.id", "site.tenant_id")
      .select("site.slug")
      .where("tenant.lead_id", "=", leadId)
      .executeTakeFirst();
    return s ? `${s.slug}.citoviso.com` : null;
  };
  // (c) label-less, and its name-derived slug is ALREADY lead a's site — the collision case.
  const c = await fixtureLead("c", { name: `_trialcheck_${stamp} a` });
  const cPromised = await promisedSub(c.token);
  const rc = await startTrial(c.token, FORM);
  const cGiven = await givenSub(c.leadId);
  tenants.push(...(await db.selectFrom("tenant").select("id").where("lead_id", "=", c.leadId).execute()).map((t) => t.id));
  check("címke nélküli, foglalt névvel: a lap trial.sub-ja = a site slugja", rc.ok && !!cPromised && cPromised === cGiven, `ígért ${cPromised} · kapott ${cGiven}`);
  // (d) the lead carries its own preview label (ADR-0330) — the common, post-0330 case.
  const dLabel = `trialcheck-${stamp}-sajat`;
  const dl = await fixtureLead("d", { previewLabel: dLabel });
  const dPromised = await promisedSub(dl.token);
  // Sabotage: the label moves between the page and the submit — the promise is broken.
  if (SELF_TEST) await db.updateTable("lead").set({ preview_label: `${dLabel}-mas` }).where("id", "=", dl.leadId).execute();
  const rd = await startTrial(dl.token, FORM);
  const dGiven = await givenSub(dl.leadId);
  tenants.push(...(await db.selectFrom("tenant").select("id").where("lead_id", "=", dl.leadId).execute()).map((t) => t.id));
  check("saját előnézeti címkével: a lap trial.sub-ja = a site slugja", rd.ok && dPromised === `${dLabel}.citoviso.com` && dPromised === dGiven, `ígért ${dPromised} · kapott ${dGiven}`);

  // ⑪ IT A-02: a start that crashed AFTER the tenant was written (site not live, no
  // coupon, no login) is RESUMED by the next submit — not answered "already running".
  console.log("⑪ félbetört indítás gyógyul");
  const e = await fixtureLead("e");
  const re1 = await startTrial(e.token, FORM);
  const eTenant = (await db.selectFrom("tenant").select("id").where("lead_id", "=", e.leadId).executeTakeFirst())?.id ?? null;
  if (eTenant) tenants.push(eTenant);
  if (re1.ok && eTenant) {
    // The crash, after the fact: back to what step 4 leaves behind, claimed > 2 minutes ago.
    await db.updateTable("free_trial").set({ coupon_offer_id: null, created_at: new Date(Date.now() - 10 * 60_000) }).where("lead_id", "=", e.leadId).execute();
    await db.deleteFrom("offer").where("tenant_id", "=", eTenant).execute();
    await db.deleteFrom("tenant_user").where("tenant_id", "=", eTenant).execute();
    await db.updateTable("site").set({ status: "provisioned" }).where("tenant_id", "=", eTenant).execute();
  }
  const re2 = await startTrial(e.token, FORM);
  const eSite = eTenant ? await db.selectFrom("site").select("status").where("tenant_id", "=", eTenant).executeTakeFirst() : undefined;
  const eCoupons = eTenant ? await db.selectFrom("offer").select("id").where("tenant_id", "=", eTenant).where("kind", "=", "coupon").execute() : [];
  const eLogin = eTenant ? await db.selectFrom("tenant_user").select("id").where("tenant_id", "=", eTenant).executeTakeFirst() : undefined;
  const eTrial = await db.selectFrom("free_trial").select("coupon_offer_id").where("lead_id", "=", e.leadId).executeTakeFirst();
  check("az újraküldés NEM „már fut” (existing:false), a belépő-levél kimegy", re2.ok && !re2.existing && !!re2.loginSentTo, JSON.stringify(re2));
  check("…a site LIVE lett", eSite?.status === "live", `${eSite?.status}`);
  check("…EGY kupon, a próba-sorra kötve", eCoupons.length === 1 && eTrial?.coupon_offer_id === eCoupons[0]?.id, `${eCoupons.length}`);
  check("…van belépés", !!eLogin);
  const re3 = await startTrial(e.token, FORM);
  check("a befejezett próba újraküldése már existing:true", re3.ok && re3.existing);

  // ⑫ IT A-05: a lead reached on TWO tokens — the trial on one ends the other's intro and
  // escalation offers too, and no decision-helper is minted for it afterwards.
  console.log("⑫ több prospectes lead");
  const f = await fixtureLead("f");
  const fB = await db
    .insertInto("prospect")
    .values({ lead_id: f.leadId, mock_artifact_id: f.artId, token: `trialcheck${stamp}fbxxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, ""), status: "sent", sent_at: new Date() })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db.insertInto("offer").values({ kind: "outreach", prospect_id: fB.id, percent: 25, scope: "initial" }).execute();
  await db.insertInto("offer").values({ kind: "escalation", prospect_id: fB.id, percent: 50, scope: "initial", expires_at: new Date(Date.now() + 86_400_000) }).execute();
  const rf = await startTrial(f.token, FORM);
  tenants.push(...(await db.selectFrom("tenant").select("id").where("lead_id", "=", f.leadId).execute()).map((t) => t.id));
  const bOpen = await db
    .selectFrom("offer")
    .select(["kind", "expires_at"])
    .where("prospect_id", "=", fB.id)
    .execute();
  const stillOpen = bOpen.filter((o) => !o.expires_at || new Date(o.expires_at as unknown as string).getTime() > Date.now());
  check("a másik token ajánlatai (25% + 50%) is lezárva", rf.ok && bOpen.length === 2 && stillOpen.length === 0, stillOpen.map((o) => o.kind).join(",") || "0 nyitott");
  await db.deleteFrom("offer").where("prospect_id", "=", fB.id).where("kind", "=", "escalation").execute();
  overrideEscalationConfigInProcess({ ...ESCALATION_CONFIG_DEFAULT, enabled: true, threshold: 1, distinctDays: false });
  await db.insertInto("mock_view").values({ prospect_id: fB.id }).execute();
  const esc = await ensureEscalationOffer(fB.id);
  overrideEscalationConfigInProcess(null);
  check("próbázó leadnek nem születik döntés-segítő ajánlat", esc === null, JSON.stringify(esc));

  // ⑬ IT A-04 / B2: an initial order priced BEFORE the trial (intro −40%) is not payable
  // during the trial — /pay/go sends to the continuation, requestPayment refuses it.
  console.log("⑬ próba előtti rendelés");
  const g = await fixtureLead("g");
  const gOrder = await db
    .insertInto("order_intent")
    .values({ prospect_id: g.prospectId, price: 2340, modules: JSON.stringify([]), status: "submitted", buyer_country: "HU", created_at: new Date(Date.now() - 60_000) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const gPay = await db
    .insertInto("payment")
    .values({ order_intent_id: gOrder.id, amount: 2340, period: "monthly", status: "pending", pay_url: "https://mock.invalid/pay/x" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const rg = await startTrial(g.token, FORM);
  tenants.push(...(await db.selectFrom("tenant").select("id").where("lead_id", "=", g.leadId).execute()).map((t) => t.id));
  const goGet = await resolvePayEntry(gPay.id, { reissue: false });
  check("/pay/go a régi, pending linkre → /folytatas (nem a régi áras pénztár)", rg.ok && goGet.kind === "redirect" && goGet.url === `/p/${g.token}/folytatas`, JSON.stringify(goGet));
  const fresh = await requestPayment(gOrder.id);
  check("requestPayment a próba előtti rendelésre nem ad pay-linket", fresh === null, JSON.stringify(fresh));
  const gCont = await db
    .insertInto("order_intent")
    .values({ prospect_id: g.prospectId, price: 2925, modules: JSON.stringify([]), status: "submitted" })
    .returning("id")
    .executeTakeFirstOrThrow();
  check("a próba UTÁNI (folytatás-) rendelést a kapu nem érinti", (await preTrialOrderOfContinuableTrial(gCont.id)) === null);
} finally {
  closeConsole?.();
  await rm(MOCK_FILE, { force: true });
  overrideFreeTrialConfigInProcess(null);
  overrideCouponConfigInProcess(null);
  overrideEscalationConfigInProcess(null);
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
  // Sabotage legs: subscription (3 checks), gallery off (1), intro offer revived (1),
  // preview label moved (1) — and ⑩ must be among them by name.
  const slugLegRed = failed.some((l) => l.startsWith("saját előnézeti címkével"));
  if (failures < 4 || !slugLegRed) {
    console.error(`\n⛔ free-trial-check --self-test: csak ${failures} állítás ment pirosra a szabotázson${slugLegRed ? "" : " (⑩ zöld maradt)"} — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ free-trial-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
} else if (failures > 0) {
  console.error(`\n⛔ free-trial-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ free-trial-check: minden zöld");
}
