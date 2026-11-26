// tervvaltas A (2026-11-16, owner: „Próba javaslat OK!”) — the free trial, its paid
// continuation and the plain order are bound to the PLAN, not to the link's plan 1.
// Measured before the fix:
//   · „Indítsa el” on plan 2 built the trial site from plan 1 (startTrial always converted
//     prospect.mock_artifact_id);
//   · the trialist's /folytatas checkout posted to /p/<token>/request — plan 1 again;
//   · an order on /p/<token>/v/<n>/request was recorded without its plan, and the paid
//     activation converted prospect.mock_artifact_id → plan 1 went live whatever was bought.
//
// What this proves (shared dev DB, own fixture parent, every row dropped on exit):
//   ① the page's trial button names its plan: GET /p/<t>/v/2 → trial.url = /p/<t>/v/2/trial;
//      plan 1 keeps the bare /p/<t>/trial (the links already out keep working);
//   ② POST /p/<t>/v/2/trial → the tenant's site is built from PLAN 2's artifact; plan 2 was a
//      `generated` alternative (as 1698/1706 are live) and the start approved it, plan 1 stays
//      approved (the offered set's member converts — the coordinator's ruling);
//   ③ refused, nothing written: a foreign artifact (another lead's mock) → not_found; a plan
//      number the link does not have → 404; a REJECTED offered plan → not_available before any claim;
//   ④ the continuation sells the running plan: GET /p/<t>/folytatas shows plan 2's artifact
//      and posts to /p/<t>/folytatas/request; trialRunningArtifactForLead = plan 2;
//   ⑤ the bare /p/<t>/trial on a multi-plan link still starts plan 1;
//   ⑥ an order recorded on plan 2 stores order_intent.plan_artifact_id = plan 2, and the mock
//      payment's activation converts PLAN 2 (site.source_artifact_id); an order on another plan
//      is not a "twin" of it.
//
// --self-test: the trial site's source is moved back to plan 1 after the start, and the order's
// plan is erased before payment — ② ④ ⑥ must go red, or the guard is blind.
//
// Run: npx tsx scripts/trial-plan-binding-check.mts [--self-test]
// (it forces the mock mail / SMS / gateway / invoice providers itself: the dev .env has
// SMS_PROVIDER=gammu, and a trial start sends the login SMS — measured 2026-11-16.)

// ── providers FIRST, before any import that reads config ──────────────────────────────────
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.DNS_PROVIDER = "mock";
// The console server is imported in-process on a free port, background jobs off.
process.env.CONSOLE_PORT = "0";
process.env.CIT_SHOT = "1";

import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

const { config } = await import("../src/config.js");
if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
  console.error(`⛔ trial-plan-binding-check: EMAIL=${config.emailProvider} SMS=${config.smsProvider} — csak mock postával fut`);
  process.exit(2);
}
const { db } = await import("../src/db/client.js");
const { trialRunningArtifactForLead } = await import("../src/conversion/owned.js");
const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { startTrial } = await import("../src/trial/start.js");
const { validateBuyer } = await import("../src/billing/buyer.js");
const { approveArtifactForBuyerOrder, pendingTwinInitialOrder, recordOrderIntent } = await import("../src/console/data.js");
const { applyWebhookResult, requestPayment } = await import("../src/payment/service.js");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");

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

const site = (tag: string): Record<string, unknown> => ({
  name: `_planbind_${stamp} ${tag}`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [{ url: "/uploads/planbind-a.jpg", alt: "kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
});
const recipe = (template: string): Record<string, unknown> => ({ template, skin: "", archetype: "", sections: [] });

const MOCK_REL = (n: number) => `sites/_planbind_${stamp}_${n}.html`;
const parent = await createFixtureParent(db as never, "planbind");
const leads: string[] = [];
let closeConsole: (() => void) | null = null;

async function fixture(
  tag: string,
  planCount: number,
  opts: { rejectPlan2?: boolean; plan1Template?: string } = {},
): Promise<{ leadId: string; token: string; arts: string[] }> {
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name: `_planbind_${stamp} ${tag}`, raw: JSON.stringify({}) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const arts: string[] = [];
  for (let i = 1; i <= planCount; i++) {
    const a = await db
      .insertInto("mock_artifact")
      .values({
        lead_id: lead.id,
        path: MOCK_REL(Math.min(i, 2)),
        // Plan 1 is the approved, sent mock; the alternatives are `generated`, as live.
        status: i === 1 ? "approved" : opts.rejectPlan2 && i === 2 ? "rejected" : "generated",
        inputs: JSON.stringify({ engine: "composition", recipe: recipe(i === 1 ? opts.plan1Template ?? "wordmark-grow" : "gate-opening"), siteData: site(`${tag}${i}`) }),
      } as never)
      .returning("id")
      .executeTakeFirstOrThrow();
    arts.push(a.id);
  }
  const token = `planbind${stamp}${tag}xxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  const pr = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, mock_artifact_id: arts[0]!, token, status: "sent", sent_at: new Date() } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  for (let i = 1; i < arts.length; i++) {
    await db.insertInto("prospect_variant").values({ prospect_id: pr.id, mock_artifact_id: arts[i]!, position: i + 1 }).execute();
  }
  return { leadId: lead.id, token, arts };
}

const FORM = { name: "Teszt Elek", email: "planbind@example.invalid", phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true };

const siteSource = async (leadId: string): Promise<string | null> =>
  (
    await db
      .selectFrom("site")
      .innerJoin("tenant", "tenant.id", "site.tenant_id")
      .select("site.source_artifact_id")
      .where("tenant.lead_id", "=", leadId)
      .executeTakeFirst()
  )?.source_artifact_id ?? null;
const artStatus = async (id: string): Promise<string | null> =>
  (await db.selectFrom("mock_artifact").select("status").where("id", "=", id).executeTakeFirst())?.status ?? null;

try {
  overrideFreeTrialConfigInProcess({ enabled: true, days: 14 });
  for (let i = 1; i <= 2; i++) {
    await writeFile(path.resolve(process.cwd(), MOCK_REL(i)), `<!doctype html><html><head><title>t${i}</title></head><body><main>terv ${i}</main></body></html>`);
  }

  const { server: consoleServer } = await import("../src/console/server.js");
  closeConsole = () => {
    consoleServer.closeAllConnections();
    consoleServer.close();
  };
  if (!consoleServer.listening) await new Promise((r) => consoleServer.once("listening", r));
  const base = `http://127.0.0.1:${(consoleServer.address() as { port: number }).port}`;
  const manifest = async (p: string): Promise<{ artifactId?: string; requestUrl?: string; trial?: { url?: string } } | null> => {
    const r = await fetch(`${base}${p}`, { redirect: "manual" });
    const html = r.status === 200 ? await r.text() : "";
    const m = /<script type="application\/json" data-cit-configurator>([\s\S]*?)<\/script>/.exec(html);
    return m ? JSON.parse(m[1]!) : null;
  };
  const postTrial = async (p: string, body: object): Promise<{ status: number; json: Record<string, unknown> }> => {
    const r = await fetch(`${base}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  };

  const a = await fixture("a", 2);
  const other = await fixture("o", 1);

  console.log("① a próba-gomb a saját tervére mutat");
  const m1 = await manifest(`/p/${a.token}`);
  const m2 = await manifest(`/p/${a.token}/v/2`);
  check("1. terv: /p/<t>/trial (a kint lévő linkek címe)", m1?.trial?.url === `/p/${a.token}/trial`, String(m1?.trial?.url));
  check("2. terv: /p/<t>/v/2/trial", m2?.trial?.url === `/p/${a.token}/v/2/trial`, String(m2?.trial?.url));

  console.log("③ idegen / nem létező / elutasított terv: elutasítva, semmi nem íródik");
  const foreign = await startTrial(a.token, { ...FORM, planArtifactId: other.arts[0]! });
  const noPlan = await postTrial(`/p/${a.token}/v/3/trial`, FORM);
  const aRows = await db.selectFrom("free_trial").select("id").where("lead_id", "=", a.leadId).execute();
  check("másik lead mockja → not_found", !foreign.ok && foreign.error === "not_found", JSON.stringify(foreign));
  check("nem létező terv-szám (v/3) → 404", noPlan.status === 404, `${noPlan.status}`);
  check("…egyik sem írt próba-sort", aRows.length === 0, `${aRows.length}`);
  const rj = await fixture("r", 2, { rejectPlan2: true });
  const rr = await postTrial(`/p/${rj.token}/v/2/trial`, FORM);
  const rjTenant = await db.selectFrom("tenant").select("id").where("lead_id", "=", rj.leadId).executeTakeFirst();
  const rjRows = await db.selectFrom("free_trial").select("id").where("lead_id", "=", rj.leadId).execute();
  check("elutasított (de felajánlott) 2. terv → not_available, nincs tenant, nincs próba-sor", rr.json.error === "not_available" && !rjTenant && rjRows.length === 0, `${rr.status} ${JSON.stringify(rr.json)} · ${rjRows.length} sor`);
  check("…az elutasított terv elutasított marad", (await artStatus(rj.arts[1]!)) === "rejected");

  console.log("④ kivezetett sablonú terv (ADR-0423): a próba a link másik, tulaj-sablonú tervéből épül; ha nincs ilyen, nem indul");
  const h = await fixture("h", 2, { plan1Template: "horizontal" });
  const hr = await startTrial(h.token, FORM);
  check("horizontal 1. terv + gate-opening 2. terv → ok", hr.ok, JSON.stringify(hr));
  check("…az oldal a 2. tervből (gate-opening) épült, nem a horizontalból", (await siteSource(h.leadId)) === h.arts[1], String(await siteSource(h.leadId)));
  const z = await fixture("z", 1, { plan1Template: "horizontal" });
  const zr = await startTrial(z.token, FORM);
  const zTenant = await db.selectFrom("tenant").select("id").where("lead_id", "=", z.leadId).executeTakeFirst();
  check("csak horizontal terv → not_available, nincs tenant", !zr.ok && zr.error === "not_available" && !zTenant, JSON.stringify(zr));

  console.log("② a 2. tervről indított próba a 2. terv artifactjából épül");
  const before2 = await artStatus(a.arts[1]!);
  const r2 = await postTrial(`/p/${a.token}/v/2/trial`, FORM);
  check("POST /p/<t>/v/2/trial → ok", r2.status === 200 && r2.json.ok === true, `${r2.status} ${JSON.stringify(r2.json)}`);
  // Sabotage: the site quietly runs plan 1 — exactly the bug.
  if (SELF_TEST) {
    await db
      .updateTable("site")
      .set({ source_artifact_id: a.arts[0]! })
      .where("tenant_id", "in", db.selectFrom("tenant").select("id").where("lead_id", "=", a.leadId))
      .execute();
  }
  const src = await siteSource(a.leadId);
  check("a tenant site-ja a 2. terv artifactjából épült", src === a.arts[1], `forrás ${src} · 2. terv ${a.arts[1]}`);
  check("a `generated` 2. terv a próbaindítással approved lett, az 1. terv approved maradt",
    before2 === "generated" && (await artStatus(a.arts[1]!)) === "approved" && (await artStatus(a.arts[0]!)) === "approved",
    `előtte ${before2} · most ${await artStatus(a.arts[1]!)} · 1. terv ${await artStatus(a.arts[0]!)}`);

  console.log("④ a próba utáni fizetés a futó tervet viszi");
  const running = await trialRunningArtifactForLead(a.leadId);
  check("trialRunningArtifactForLead = 2. terv", running?.id === a.arts[1], String(running?.id));
  const mc = await manifest(`/p/${a.token}/folytatas`);
  check("/folytatas a 2. tervet mutatja", mc?.artifactId === a.arts[1], String(mc?.artifactId));
  check("/folytatas a /folytatas/request-re küld (nem az 1. terv /request-jére)", mc?.requestUrl === `/p/${a.token}/folytatas/request`, String(mc?.requestUrl));

  console.log("⑤ a régi /p/<t>/trial a többtervű linken az 1. tervet indítja");
  const b = await fixture("b", 2);
  const rb = await postTrial(`/p/${b.token}/trial`, FORM);
  const bSrc = await siteSource(b.leadId);
  check("POST /p/<t>/trial → ok, az 1. terv artifactjából", rb.status === 200 && bSrc === b.arts[0], `${rb.status} ${bSrc}`);

  console.log("⑥ a 2. terven rendelt csomag fizetés után a 2. tervet élesíti");
  const o = await fixture("p", 2);
  const v = await validateBuyer(
    {
      buyer_type: "individual",
      buyer_name: "Teszt Elek",
      buyer_country: "HU",
      buyer_zip: "8360",
      buyer_city: "Keszthely",
      buyer_address: "Fő utca 1.",
      buyer_email: `planbind-${stamp}@example.invalid`,
      withdrawal_waiver: true,
      terms_accepted: true,
    },
    { requireTerms: false },
  );
  if (!v.ok) throw new Error(`az őr vevő-adata érvénytelen: ${JSON.stringify(v.errors)}`);
  const rec = await recordOrderIntent({
    money: { region: "hu", currency: "HUF" },
    artifactId: o.arts[1]!,
    modules: [],
    billingPeriod: "monthly",
    price: 3900,
    domainType: "citoviso_sub",
    domainName: null,
    commitmentMonths: null,
    photoRightsDeclared: true,
    recurringConsent: true,
    buyer: v.value,
    prospectToken: o.token,
  });
  if (!rec) throw new Error("a rendelés-rögzítés nem adott vissza rekordot");
  const oi = await db.selectFrom("order_intent").select("plan_artifact_id").where("id", "=", rec.orderIntentId).executeTakeFirst();
  check("order_intent.plan_artifact_id = 2. terv", oi?.plan_artifact_id === o.arts[1], String(oi?.plan_artifact_id));
  const twinOther = await pendingTwinInitialOrder({
    leadId: o.leadId, modules: [], billingPeriod: "monthly", price: 3900, domainType: "citoviso_sub",
    domainName: null, platformLabel: null, buyerEmail: v.value.buyerEmail, planArtifactId: o.arts[0]!,
  });
  const twinSame = await pendingTwinInitialOrder({
    leadId: o.leadId, modules: [], billingPeriod: "monthly", price: 3900, domainType: "citoviso_sub",
    domainName: null, platformLabel: null, buyerEmail: v.value.buyerEmail, planArtifactId: o.arts[1]!,
  });
  check("az 1. tervre ugyanígy beküldött rendelés NEM iker (nem kapja a 2. terv pay-linkjét)", twinOther === null, JSON.stringify(twinOther));
  check("…a 2. tervre beküldött igen", twinSame?.orderIntentId === rec.orderIntentId, JSON.stringify(twinSame));
  // Sabotage: the order forgets its plan — activation falls back to plan 1 (the old bug).
  if (SELF_TEST) await db.updateTable("order_intent").set({ plan_artifact_id: null }).where("id", "=", rec.orderIntentId).execute();
  await approveArtifactForBuyerOrder(o.arts[1]!, rec.orderIntentId);
  await requestPayment(rec.orderIntentId);
  const pay = await db.selectFrom("payment").select("gateway_ref").where("order_intent_id", "=", rec.orderIntentId).executeTakeFirst();
  const act = pay ? await applyWebhookResult({ gatewayRef: String(pay.gateway_ref), status: "paid" }) : null;
  check("a mock fizetés aktivál", !!act && act.ok === true && act.activated === true, JSON.stringify(act));
  const oSrc = await siteSource(o.leadId);
  check("az aktivált site a 2. terv artifactjából épült", oSrc === o.arts[1], `forrás ${oSrc} · 2. terv ${o.arts[1]}`);
} finally {
  closeConsole?.();
  overrideFreeTrialConfigInProcess(null);
  for (let i = 1; i <= 2; i++) await rm(path.resolve(process.cwd(), MOCK_REL(i)), { force: true });
  for (const l of leads) {
    const tIds = (await db.selectFrom("tenant").select("id").where("lead_id", "=", l).execute()).map((r) => r.id);
    for (const t of tIds) {
      await db.deleteFrom("tenant_user").where("tenant_id", "=", t).execute().catch(() => {});
      await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
    }
  }
  await parent.drop();
  await db.destroy();
}

if (SELF_TEST) {
  const red = (p: string) => failed.some((l) => l.startsWith(p));
  const blind = !red("a tenant site-ja") || !red("/folytatas a 2. tervet") || !red("az aktivált site");
  if (blind) {
    console.error(`\n⛔ trial-plan-binding-check --self-test: a szabotázs nem vitte pirosra a ②/④/⑥ lábat — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ trial-plan-binding-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
} else if (failures > 0) {
  console.error(`\n⛔ trial-plan-binding-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ trial-plan-binding-check: minden zöld");
}
