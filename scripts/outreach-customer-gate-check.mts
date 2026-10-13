// ŐR — próbázó vagy már ügyfél leadnek NINCS hideg megkeresés, egyik csatornán sem
// (Elek éles teszt 2026-10-13, O-1).
//
// ⛔ MIÉRT: az élő konzolon egy futó próbájú, élő próba-oldalú lead lapja „Kiküldve: még nem —
// ez a következő”-t mondott, a piszkozat-lap pedig „E-mail: most kiküldhető — a küldő-út
// minden kapuja zöld”-et. A `src/outreach/` küldő-kapui közül egyik sem nézte a próbát vagy a
// bérlőt — csak a próba-kampány. Egy kattintás, és a próbázó tulaj „Ez egy honlap-terv az Ön
// szállásáról” levelet kap.
//
// Amit mér (eldobható fixtúra a közös dev-DB-n, saját scrape_run-nal, AI és küldés nélkül):
//   ① a kapu maga (alreadyCustomerBlocks): free_trial sorral → tilt; bérlővel → tilt;
//      NEGATÍV KONTROLL: egyik nélkül → null (a kapu nem tilt mindenkit);
//   ② az e-mail út (sendOutreachMail, dryRun+probe — semmi nem megy ki) a próbázót
//      a kapu okával utasítja el, és a konzol-állítás (describeMailSendability) nem „küldhető”;
//   ③ a mobil út (mobileOutreachGates: SMS és MMS+SMS pár) ugyanígy tilt;
//   ④ a lead-lap munkasávja ügyfélnél a „Kiküldve” állomást nem jelöli „ez a következő”-nek
//      (NEGATÍV KONTROLL: nem-ügyfélnél igen).
//
//   npx tsx scripts/outreach-customer-gate-check.mts

import { db, pool } from "../src/db/client.js";
import { alreadyCustomerBlocks } from "../src/outreach/customerGate.js";
import { describeMailSendability, sendOutreachMail } from "../src/outreach/sendBatch.js";
import { mobileOutreachGates } from "../src/outreach/sendOutreachSms.js";
import { workflowBand } from "../src/console/views.js";

let fail = 0;
const check = (n: string, ok: boolean, d?: unknown): void => {
  if (ok) console.log(`  ✓ ${n}`);
  else {
    fail++;
    console.error(`  ✗ ${n}${d === undefined ? "" : " — " + JSON.stringify(d).slice(0, 400)}`);
  }
};

const ids: Record<string, string> = {};
const stamp = Date.now().toString(36);
try {
  const def = await db.insertInto("scraper_definition").values({ label: "_ocg", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.def = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.run = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: `_ocg próbázó ${stamp}`, raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.lead = lead.id;
  const email = `ocg-${stamp}@example.com`;
  const prospect = await db.insertInto("prospect").values({ lead_id: lead.id, token: `ocg_${stamp}`, contact_email: email }).returning("id").executeTakeFirstOrThrow();
  ids.prospect = prospect.id;

  console.log("\n① a kapu maga");
  check("NEGATÍV KONTROLL: próba és bérlő nélkül a kapu nem tilt", (await alreadyCustomerBlocks(lead.id)) === null);
  const before = await sendOutreachMail(prospect.id, { dryRun: true, probe: true });
  const beforeReason = before.outcome.kind === "skipped" ? before.outcome.reason : "";
  check("NEGATÍV KONTROLL: az e-mail út más okból áll meg, nem a próba miatt", !/próbázó|már ügyfél/.test(beforeReason), before.outcome);

  const trial = await db.insertInto("free_trial").values({
    lead_id: lead.id,
    prospect_id: prospect.id,
    contact_name: "Teszt Próbázó",
    contact_email: email,
    terms_accepted_at: new Date(),
    terms_text: "_ocg",
    photo_rights_declared_at: new Date(),
    photo_rights_text: "_ocg",
    trial_until: new Date(Date.now() + 14 * 86_400_000),
  }).returning("id").executeTakeFirstOrThrow();
  ids.trial = trial.id;
  const why = await alreadyCustomerBlocks(lead.id);
  check("free_trial sorral a kapu tilt, és megnevezi a próbát", !!why && /próbázó/.test(why), why);

  console.log("\n② az e-mail út");
  const mail = await sendOutreachMail(prospect.id, { dryRun: true, probe: true });
  check("sendOutreachMail: skipped, a kapu okával", mail.outcome.kind === "skipped" && /próbázó/.test(mail.outcome.reason), mail.outcome);
  const claim = await describeMailSendability(prospect.id);
  check("a konzol nem állít „küldhető”-t, és az okot mondja", !claim.sendable && /próbázó/.test(claim.reason ?? ""), claim);

  console.log("\n③ a mobil út (SMS · MMS+SMS pár)");
  const mob = await mobileOutreachGates(prospect.id);
  check("mobileOutreachGates: tilt, a kapu okával", mob.ok === false && /próbázó/.test(mob.message), mob);

  console.log("\n① bérlő (próba nélkül is)");
  await db.deleteFrom("free_trial").where("id", "=", trial.id).execute();
  delete ids.trial;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: `_ocg ${stamp}` }).returning("id").executeTakeFirstOrThrow();
  ids.tenant = tenant.id;
  const why2 = await alreadyCustomerBlocks(lead.id);
  check("bérlővel a kapu tilt („már ügyfél”)", !!why2 && /már ügyfél/.test(why2), why2);
  console.log("\n④ a lead-lap munkasávja");
  type Band = Parameters<typeof workflowBand>;
  const d = { surveyedAt: "2026-10-01T10:00:00Z" } as unknown as Band[0];
  const approved = { decisions: [{ decision: "approve", decidedAt: "2026-10-02T10:00:00Z" }], generatedAt: "2026-10-02T09:00:00Z" } as unknown as Band[1];
  const sentCell = (html: string): string => /<div class="con-wf__st[^"]*" data-station="sent"[\s\S]*?<\/div><\/div>/.exec(html)?.[0] ?? "";
  const plain = sentCell(workflowBand(d, approved, approved, [], [], [], { running: false }, "hu", false));
  const cust = sentCell(workflowBand(d, approved, approved, [], [], [], { running: false }, "hu", true));
  check("NEGATÍV KONTROLL: nem-ügyfélnél a „Kiküldve” a következő", /data-state="next"/.test(plain) && /ez a következő/.test(plain), plain);
  check("ügyfélnél a „Kiküldve” nem a következő, és megmondja, miért", /data-state="skip"/.test(cust) && !/ez a következő/.test(cust) && /már ügyfél/.test(cust), cust);
} finally {
  if (ids.trial) await db.deleteFrom("free_trial").where("id", "=", ids.trial).execute().catch(() => {});
  if (ids.tenant) await db.deleteFrom("tenant").where("id", "=", ids.tenant).execute().catch(() => {});
  if (ids.prospect) await db.deleteFrom("prospect").where("id", "=", ids.prospect).execute().catch(() => {});
  if (ids.lead) await db.deleteFrom("lead").where("id", "=", ids.lead).execute().catch(() => {});
  if (ids.run) await db.deleteFrom("scrape_run").where("id", "=", ids.run).execute().catch(() => {});
  if (ids.def) await db.deleteFrom("scraper_definition").where("id", "=", ids.def).execute().catch(() => {});
  await pool.end();
}
console.log(fail ? `\n⛔ OUTREACH-CUSTOMER-GATE: ${fail} bukás` : "\n🟢 OUTREACH-CUSTOMER-GATE: próbázónak és ügyfélnek egyik csatornán sincs hideg megkeresés");
process.exit(fail ? 1 : 0);
