// tervvaltas E (2026-11-16, owner: „a 2 két tervet bármikor lehessen váltogatni. Miért ne?”) —
// the tenant admin's „Kinézet” tab switches the site between the plans its link offered.
// Contract: assets/design-refs/console/tervvalto-admin/README.md.
//
// What this proves (shared dev DB, own fixture parent, every row dropped on exit):
//   ① refused, nothing written: another lead's artifact → not_found; a curator-REJECTED offered
//      plan → not_available; the plan the site already runs → same; no log row, no source change;
//      the HTTP route answers the same way (POST /admin/kinezet → ?hiba=…), and the preview route
//      serves no foreign plan (404);
//   ② a switch moves the site to the new plan: site.source_artifact_id = plan 2, the snapshot is
//      rendered from plan 2's template, the `generated` plan 2 got approved (the payment gate's
//      condition), and a site_plan_switch row records from → to with the actor;
//   ③ the owner's edits survive: edited_site_data is byte-identical, and the new snapshot carries
//      the edited tagline;
//   ④ the paid continuation sells the RUNNING plan: trialRunningArtifactForLead = plan 2 and
//      GET /p/<t>/folytatas shows plan 2 (ADR-0449 reads site.source_artifact_id);
//   ⑤ „Visszavonás”: the switch back restores plan 1 and is logged too; the plan set then offers
//      plan 2 as the undo target;
//   ⑥ a plan rejected ONLY by a sibling's approval („superseded_by:”) stays switchable;
//   ⑦ a one-plan site has nothing to switch: tenantPlanSet returns one plan.
//
// --self-test: after the switch the site is quietly moved back to plan 1 and the edits are
// erased — ② ③ ④ must go red, or the guard is blind.
//
// Run: npx tsx scripts/plan-switch-check.mts [--self-test]
// (it forces the mock mail / SMS / MMS / gateway / invoice providers itself: the dev .env has
// SMS_PROVIDER=gammu, and the trial start sends a login SMS — measured 2026-11-16.)

// ── providers FIRST, before any import that reads config ──────────────────────────────────
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.DNS_PROVIDER = "mock";
// Both servers in-process on free ports, background jobs off.
process.env.CONSOLE_PORT = "0";
process.env.PUBLIC_PORT = "0";
process.env.CIT_SHOT = "1";

import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const { config } = await import("../src/config.js");
if (config.emailProvider !== "mock" || config.smsProvider !== "mock") {
  console.error(`⛔ plan-switch-check: EMAIL=${config.emailProvider} SMS=${config.smsProvider} — csak mock postával fut`);
  process.exit(2);
}
const { db } = await import("../src/db/client.js");
const { trialRunningArtifactForLead } = await import("../src/conversion/owned.js");
const { overrideFreeTrialConfigInProcess } = await import("../src/trial/config.js");
const { startTrial } = await import("../src/trial/start.js");
const { saveTenantContent } = await import("../src/tenant/editor.js");
const { switchSitePlan, tenantPlanSet } = await import("../src/tenant/planSwitch.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
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
  name: `_planswitch_${stamp} ${tag}`,
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral.",
  highlights: ["Saját parkoló"],
  photos: [
    { url: "/uploads/planswitch-a.jpg", alt: "kert", provenance: "owner" },
    { url: "/uploads/planswitch-b.jpg", alt: "udvar", provenance: "owner" },
  ],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "8360 Keszthely, Fő utca 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
});
const recipe = (template: string): Record<string, unknown> => ({ template, skin: "", archetype: "", sections: [] });
const TEMPLATES = ["wordmark-grow", "gate-opening", "parallax"];

const MOCK_REL = (n: number) => `sites/_planswitch_${stamp}_${n}.html`;
const parent = await createFixtureParent(db as never, "planswitch");
const leads: string[] = [];
const servers: Server[] = [];

async function fixture(
  tag: string,
  planCount: number,
  status: (i: number) => "approved" | "generated" | "rejected" = (i) => (i === 1 ? "approved" : "generated"),
): Promise<{ leadId: string; token: string; arts: string[]; tenantId: string; tuId: string }> {
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name: `_planswitch_${stamp} ${tag}`, raw: JSON.stringify({}) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leads.push(lead.id);
  const arts: string[] = [];
  for (let i = 1; i <= planCount; i++) {
    const a = await db
      .insertInto("mock_artifact")
      .values({
        lead_id: lead.id,
        path: MOCK_REL(i),
        status: status(i),
        inputs: JSON.stringify({ engine: "composition", recipe: recipe(TEMPLATES[i - 1]!), siteData: site(`${tag}${i}`) }),
      } as never)
      .returning("id")
      .executeTakeFirstOrThrow();
    arts.push(a.id);
  }
  const token = `planswitch${stamp}${tag}xxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  const pr = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, mock_artifact_id: arts[0]!, token, status: "sent", sent_at: new Date() } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  for (let i = 1; i < arts.length; i++) {
    await db.insertInto("prospect_variant").values({ prospect_id: pr.id, mock_artifact_id: arts[i]!, position: i + 1 }).execute();
  }
  const r = await startTrial(token, { name: "Teszt Elek", email: `planswitch-${stamp}-${tag}@example.invalid`, phone: "+36 30 123 4567", aszfAccepted: true, photoRightsAccepted: true });
  if (!r.ok) throw new Error(`a próba nem indult: ${JSON.stringify(r)}`);
  const t = await db.selectFrom("tenant").select("id").where("lead_id", "=", lead.id).executeTakeFirstOrThrow();
  const tu = await db.selectFrom("tenant_user").select("id").where("tenant_id", "=", t.id).executeTakeFirstOrThrow();
  return { leadId: lead.id, token, arts, tenantId: t.id, tuId: tu.id };
}

const siteRow = async (tenantId: string) =>
  db.selectFrom("site").select(["id", "source_artifact_id", "edited_site_data", "path"]).where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
const artStatus = async (id: string): Promise<string | null> =>
  (await db.selectFrom("mock_artifact").select("status").where("id", "=", id).executeTakeFirst())?.status ?? null;
const logRows = async (siteId: string) =>
  db.selectFrom("site_plan_switch").select(["from_artifact_id", "to_artifact_id", "actor"]).where("site_id", "=", siteId).orderBy("at").execute();
const snapshot = async (p: string | null): Promise<string> => (p ? readFile(path.resolve(process.cwd(), p), "utf8").catch(() => "") : "");

try {
  overrideFreeTrialConfigInProcess({ enabled: true, days: 14 });
  for (let i = 1; i <= 3; i++) {
    await writeFile(path.resolve(process.cwd(), MOCK_REL(i)), `<!doctype html><html><head><title>t${i}</title></head><body><main>terv ${i}</main></body></html>`);
  }
  const { server: consoleServer } = (await import("../src/console/server.js")) as { server: Server };
  const { server: publicServer } = (await import("../src/server/public.js")) as { server: Server };
  servers.push(consoleServer, publicServer);
  for (const s of servers) if (!s.listening) await new Promise((r) => s.once("listening", r));
  const cBase = `http://127.0.0.1:${(consoleServer.address() as AddressInfo).port}`;
  const pBase = `http://127.0.0.1:${(publicServer.address() as AddressInfo).port}`;

  const a = await fixture("a", 3, (i) => (i === 1 ? "approved" : i === 3 ? "rejected" : "generated"));
  const other = await fixture("o", 1);
  // The owner edited the tagline before switching.
  await saveTenantContent(a.tenantId, { tagline: "Szerkesztett szlogen a próbából" });
  const before = await siteRow(a.tenantId);
  const cookie = `cit_session=${mintTenantCookieValue(a.tuId)}`;
  const post = async (body: Record<string, string>): Promise<string> => {
    const r = await fetch(`${pBase}/admin/kinezet`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
    return r.headers.get("location") ?? `HTTP ${r.status}`;
  };

  console.log("① idegen / elutasított / a futó terv: elutasítva, semmi nem íródik");
  const foreign = await switchSitePlan(a.tenantId, other.arts[0]!, "gate");
  const rejected = await switchSitePlan(a.tenantId, a.arts[2]!, "gate");
  const same = await switchSitePlan(a.tenantId, a.arts[0]!, "gate");
  check("másik lead terve → not_found", !foreign.ok && foreign.error === "not_found", JSON.stringify(foreign));
  check("kurátor által elutasított (felajánlott) terv → not_available", !rejected.ok && rejected.error === "not_available", JSON.stringify(rejected));
  check("a már futó terv → same", !same.ok && same.error === "same", JSON.stringify(same));
  const httpForeign = await post({ a: other.arts[0]! });
  check("POST /admin/kinezet idegen tervvel → ?hiba=not_found", httpForeign === "/admin?tab=kinezet&hiba=not_found", httpForeign);
  const pvForeign = await fetch(`${pBase}/admin/kinezet/elonezet?a=${other.arts[0]}`, { headers: { cookie } });
  const pvOwn = await fetch(`${pBase}/admin/kinezet/elonezet?a=${a.arts[1]}`, { headers: { cookie } });
  const pvAnon = await fetch(`${pBase}/admin/kinezet/elonezet?a=${a.arts[1]}`);
  const pvOwnHtml = pvOwn.status === 200 ? await pvOwn.text() : "";
  check("előnézet: idegen terv 404, saját terv 200 a szerkesztett szlogennel, belépés nélkül 401",
    pvForeign.status === 404 && pvOwn.status === 200 && pvOwnHtml.includes("Szerkesztett szlogen a próbából") && pvAnon.status === 401,
    `${pvForeign.status} / ${pvOwn.status} / ${pvAnon.status}`);
  const after1 = await siteRow(a.tenantId);
  check("…a site forrása nem változott, napló-sor nincs", after1.source_artifact_id === a.arts[0] && (await logRows(after1.id)).length === 0);
  check("…az elutasított terv elutasított maradt", (await artStatus(a.arts[2]!)) === "rejected");

  console.log("② váltás a 2. tervre (az admin útvonalán)");
  const status2 = await artStatus(a.arts[1]!);
  const loc = await post({ a: a.arts[1]! });
  check("POST /admin/kinezet → ?valtva=1", loc === "/admin?tab=kinezet&valtva=1", loc);
  if (SELF_TEST) {
    // Sabotage: the site quietly runs plan 1 again, and the owner's edits are gone.
    await db.updateTable("site").set({ source_artifact_id: a.arts[0]!, edited_site_data: null }).where("tenant_id", "=", a.tenantId).execute();
  }
  const s2 = await siteRow(a.tenantId);
  const html2 = await snapshot(s2.path);
  check("a site a 2. terv artifactjából renderel", s2.source_artifact_id === a.arts[1], `forrás ${s2.source_artifact_id} · 2. terv ${a.arts[1]}`);
  check("a pillanatkép a 2. terv sablonjából (gate-opening) készült", /id="ko-/.test(html2), `${html2.length} bájt`);
  check("a `generated` 2. terv a váltással approved lett", status2 === "generated" && (await artStatus(a.arts[1]!)) === "approved", `${status2} → ${await artStatus(a.arts[1]!)}`);
  const log2 = await logRows(s2.id);
  check("napló: 1 sor, 1. terv → 2. terv, actor tenant_user:<id>",
    log2.length === 1 && log2[0]!.from_artifact_id === a.arts[0] && log2[0]!.to_artifact_id === a.arts[1] && log2[0]!.actor === `tenant_user:${a.tuId}`,
    JSON.stringify(log2));

  console.log("③ a tulaj szerkesztései megmaradnak");
  check("edited_site_data bájtra azonos", JSON.stringify(s2.edited_site_data) === JSON.stringify(before.edited_site_data) && before.edited_site_data != null, JSON.stringify(s2.edited_site_data));
  check("az új pillanatképen a szerkesztett szlogen áll", html2.includes("Szerkesztett szlogen a próbából"));

  console.log("④ a próba utáni fizetés a futó tervet viszi");
  const running = await trialRunningArtifactForLead(a.leadId);
  check("trialRunningArtifactForLead = 2. terv", running?.id === a.arts[1], String(running?.id));
  const contHtml = await (await fetch(`${cBase}/p/${a.token}/folytatas`, { redirect: "manual" })).text();
  const man = /<script type="application\/json" data-cit-configurator>([\s\S]*?)<\/script>/.exec(contHtml);
  const manifest = man ? (JSON.parse(man[1]!) as { artifactId?: string; requestUrl?: string }) : null;
  check("/folytatas a 2. tervet rendeli, a /folytatas/request-re", manifest?.artifactId === a.arts[1] && manifest?.requestUrl === `/p/${a.token}/folytatas/request`, `${manifest?.artifactId} · ${manifest?.requestUrl}`);

  if (!SELF_TEST) {
    console.log("⑤ visszavonás");
    const set2 = await tenantPlanSet(a.tenantId);
    check("a tervkészlet visszavonási célja az 1. terv", set2?.previousArtifactId === a.arts[0], String(set2?.previousArtifactId));
    const undo = await post({ a: a.arts[0]!, undo: "1" });
    const s3 = await siteRow(a.tenantId);
    check("visszavonás → ?visszavont=1, a site az 1. tervből", undo === "/admin?tab=kinezet&visszavont=1" && s3.source_artifact_id === a.arts[0], `${undo} · ${s3.source_artifact_id}`);
    check("…naplózva (2. sor, 2. → 1.)", (await logRows(s3.id))[1]?.to_artifact_id === a.arts[0]);
    check("…a szerkesztett szlogen az 1. terven is ott", (await snapshot(s3.path)).includes("Szerkesztett szlogen a próbából"));
    check("…a visszavonási cél most a 2. terv", (await tenantPlanSet(a.tenantId))?.previousArtifactId === a.arts[1]);

    console.log("⑥ testvér jóváhagyása miatt „elutasított” terv választható marad");
    const b = await fixture("b", 2);
    await db.updateTable("mock_artifact").set({ status: "rejected" }).where("id", "=", b.arts[1]!).execute();
    await db.insertInto("curator_decision").values({ mock_artifact_id: b.arts[1]!, decision: "reject", notes: `superseded_by:${b.arts[0]}`, decided_by: "buyer_order" }).execute();
    const rb = await switchSitePlan(b.tenantId, b.arts[1]!, "gate");
    check("superseded_by-elutasított terv → átváltható, és újra approved", rb.ok && (await artStatus(b.arts[1]!)) === "approved", JSON.stringify(rb));

    console.log("⑦ egytervű oldal");
    const one = await tenantPlanSet(other.tenantId);
    check("egy terv: tenantPlanSet 1 tervet ad", one?.plans.length === 1, String(one?.plans.length));
  }
} finally {
  for (const s of servers) {
    s.closeAllConnections();
    s.close();
  }
  overrideFreeTrialConfigInProcess(null);
  for (let i = 1; i <= 3; i++) await rm(path.resolve(process.cwd(), MOCK_REL(i)), { force: true });
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
  const blind = !red("a site a 2. terv") || !red("edited_site_data") || !red("trialRunningArtifactForLead");
  if (blind) {
    console.error(`\n⛔ plan-switch-check --self-test: a szabotázs nem vitte pirosra a ②/③/④ lábat — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ plan-switch-check --self-test: a szabotázs ${failures} állítást pirosra vitt.`);
} else if (failures > 0) {
  console.error(`\n⛔ plan-switch-check: ${failures} hiba`);
  process.exit(1);
} else {
  console.log("\n✅ plan-switch-check: minden zöld");
}
