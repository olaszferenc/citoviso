// [TESZT] CLONE OF A REAL LEAD (ADR-0498, owner 2026-11-26 „Végpróba”) — the owner's live walk of the WHOLE
// production chain (approval page → send → mock → trial → payment → admin) on a copy of a real, chain-found
// lead, without the real lead ever being touched or contacted.
//
// What it makes, from a source lead that already has a dispatch-ready pair of plans (main + second plan):
//   · a new lead "[TESZT] <name>" in the same scrape run (so the same country / area), whose ONLY contact is
//     the owner's address: raw.email = that address; every phone, other address and contact list dropped;
//   · the source's hero pin (lead_hero_override), so the clone's mock picks the same hero;
//   · both plans as NEW mock_artifact rows of the clone (status approved, Vera's verdict kept — the text is
//     the same text), re-rendered from their persisted inputs with the current engine into their own files
//     (generator/mockRefresh.refreshMock: no AI, the inputs ARE the design); the owner's approval, the render
//     gate's and the colleague's verdicts of the source are NOT copied — the clone earns its own;
//   · the machine render gate on both plans, then the dispatch row, held like every freshly rendered mock
//     (QA_WAIT_NOTE): the owner's /jovahagyas page lists it, and his Mehet sends it on the real path.
//
// The address is read from TEST_LEAD_EMAIL, else EMAIL_BCC (the house copy address) — never from the command
// line, and it is never printed (repo / commit / log stay clean of it).
//
// Dry-run by default (prints the plan, writes nothing); --go writes. Run from the tree the console serves
// (mock paths are relative to the cwd), on the database of that tree.
//
//   npx tsx scripts/test-lead-clone.mts <sourceLeadId> [--name "[TESZT] …"] [--go]
import { copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { isTestLeadName } from "../src/outreach/ownerTestPhone.js";
import { secondPlanOf } from "../src/outreach/secondPlan.js";
import { refreshMock } from "../src/generator/mockRefresh.js";
import { renderGateFor } from "../src/outreach/mockRenderGate.js";
import { enqueueDispatch } from "../src/outreach/autoDispatch.js";
import { QA_WAIT_NOTE } from "../src/outreach/mockQaReview.js";

const GO = process.argv.includes("--go");
const args = process.argv.slice(2);
const sourceId = args.find((a) => /^[0-9a-f-]{36}$/i.test(a));
const nameIdx = args.indexOf("--name");
const wantName = nameIdx >= 0 ? args[nameIdx + 1] : undefined;
const BY = "test-lead-clone";

function fail(msg: string): never {
  console.error(`⛔ ${msg}`);
  process.exit(1);
}

const email = (process.env.TEST_LEAD_EMAIL ?? process.env.EMAIL_BCC ?? "").split(",")[0]!.trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("nincs tulaj-cím: TEST_LEAD_EMAIL vagy EMAIL_BCC kell");
const masked = email.replace(/^(.).*(@.*)$/, "$1…$2");
if (!sourceId) fail("használat: test-lead-clone.mts <forrás-lead-id> [--name \"[TESZT] …\"] [--go]");

const src = await db.selectFrom("lead").selectAll().where("id", "=", sourceId).executeTakeFirst();
if (!src) fail(`nincs ilyen lead: ${sourceId}`);
if (isTestLeadName(src.name)) fail("a forrás már teszt-lead — valódi, a lánc által talált leadet adj meg");
const name = wantName ?? `[TESZT] ${src.name}`;
if (!isTestLeadName(name)) fail(`a név „[TESZT]”-tel kezdődjön: ${name}`);
const taken = await db.selectFrom("lead").select("id").where("name", "=", name).executeTakeFirst();
if (taken) fail(`már van ilyen nevű lead: ${name} (${taken.id}) — adj más nevet (--name)`);

// The source's plan pair: the one its dispatch row names, else its newest approved plan; + the second plan.
const disp = await db.selectFrom("outreach_dispatch").select("artifact_id").where("lead_id", "=", src.id).executeTakeFirst();
const mainSrc =
  (disp?.artifact_id
    ? await db.selectFrom("mock_artifact").selectAll().where("id", "=", disp.artifact_id).executeTakeFirst()
    : undefined) ??
  (await db
    .selectFrom("mock_artifact")
    .selectAll()
    .where("lead_id", "=", src.id)
    .where("status", "=", "approved")
    .orderBy("generated_at", "desc")
    .executeTakeFirst());
if (!mainSrc?.path) fail("a forrásnak nincs jóváhagyott, fájllal bíró mockja");
const altRef = await secondPlanOf(src.id, mainSrc.id);
const altSrc = altRef ? await db.selectFrom("mock_artifact").selectAll().where("id", "=", altRef.id).executeTakeFirst() : undefined;
if (!altSrc?.path) fail("a forrásnak nincs második terve (két sablon kell a kiküldéshez)");
for (const a of [mainSrc, altSrc]) if (!existsSync(path.resolve(process.cwd(), a.path!))) fail(`a mock fájlja hiányzik: ${a.path}`);

/** The source's raw with the owner's address as the only contact. */
function cloneRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const { phone: _p, otherEmails: _o, contacts: _c, scrapedContact: _s, emailCuratedAt: _e, ...rest } = raw;
  return { ...rest, name, email, contactChannel: "email" };
}

/** The plan's inputs without the verdicts the clone must earn itself; the site's address is the owner's. */
function cloneInputs(inputs: unknown): Record<string, unknown> {
  const { ownerApproval: _a, renderGate: _g, qaReview: _q, qaFindings: _f, ...rest } = (inputs ?? {}) as Record<string, unknown>;
  const oldMail = typeof src!.raw === "object" && src!.raw ? String((src!.raw as Record<string, unknown>).email ?? "") : "";
  const text = JSON.stringify(rest);
  return JSON.parse(oldMail ? text.split(oldMail).join(email) : text) as Record<string, unknown>;
}

const newPath = (p: string, id: string): string => {
  const dir = path.dirname(p);
  const base = path.basename(p, ".html").replace(/-[0-9a-f]{8}$/, "");
  return path.join(dir === "." ? "" : dir, `${base}-teszt-${id.slice(0, 8)}.html`);
};

const leadId = randomUUID();
const mainId = randomUUID();
const altId = randomUUID();
console.log(`forrás: ${src.name} (${src.id})`);
console.log(`klón:   ${name} (${leadId}) · kontakt: ${masked} (csak ez)`);
console.log(`tervek: ${mainSrc.id} → ${mainId} · ${altSrc.id} → ${altId}`);
if (!GO) {
  console.log("\nDRY-RUN — semmi nem íródott. Élesben: --go");
  process.exit(0);
}

const hero = await db.selectFrom("lead_hero_override").selectAll().where("lead_id", "=", src.id).executeTakeFirst();
await db.transaction().execute(async (trx) => {
  await trx
    .insertInto("lead")
    .values({
      id: leadId,
      scrape_run_id: src.scrape_run_id,
      name,
      lat: src.lat,
      lng: src.lng,
      address: src.address,
      category: src.category,
      qualification: src.qualification,
      weight: src.weight,
      match_confidence: src.match_confidence,
      raw: JSON.stringify(cloneRaw(src.raw as Record<string, unknown>)),
      lifecycle_status: src.lifecycle_status,
      contact_checked_at: new Date(),
    } as never)
    .execute();
  if (hero) await trx.insertInto("lead_hero_override").values({ lead_id: leadId, url: hero.url, actor: BY } as never).execute();
  for (const [from, id] of [[mainSrc, mainId], [altSrc, altId]] as const) {
    await trx
      .insertInto("mock_artifact")
      .values({
        id,
        lead_id: leadId,
        path: newPath(from.path!, id),
        status: "approved",
        inputs: JSON.stringify(cloneInputs(from.inputs)),
        generated_at: sql`now()`,
      } as never)
      .execute();
  }
});

// Each plan: the source file as the starting point, then the clone's own render from its inputs.
for (const [from, id] of [[mainSrc, mainId], [altSrc, altId]] as const) {
  const row = await db.selectFrom("mock_artifact").select(["id", "lead_id", "path", "inputs", "generated_at"]).where("id", "=", id).executeTakeFirstOrThrow();
  await copyFile(path.resolve(process.cwd(), from.path!), path.resolve(process.cwd(), row.path!));
  const r = await refreshMock(row);
  const g = await renderGateFor(id);
  console.log(`  terv ${id.slice(0, 8)}: újrarenderelve (${r.arm}) · render-kapu: ${g.verdict}${g.findings.length ? ` — ${g.findings.map((f) => f.code).join(", ")}` : ""}`);
}

const q = await enqueueDispatch({ leadId, artifactId: mainId, by: BY });
if (!q.ok) fail(`a kiküldési sor elutasította: ${q.reason}`);
await db.updateTable("outreach_dispatch").set({ status: "held", note: QA_WAIT_NOTE }).where("id", "=", q.id).execute();
console.log(`\n✓ ${name} kész — a kiküldési sorban, a tulaj /jovahagyas lapjára vár (lead ${leadId})`);
process.exit(0);
