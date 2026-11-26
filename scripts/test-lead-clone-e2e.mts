// [TESZT] CLONE + THE DISPATCH TICK FOR TEST LEADS (ADR-0498, owner 2026-11-26 „Végpróba”) — on a SCRATCH
// database (scripts/lib/hr-world.mts: one Croatian lead, real engine mock, mock mail/payment), nothing leaves
// the machine.
//
// What it pins:
//   ① scripts/test-lead-clone.mts: dry-run writes nothing; --go makes "[TESZT] <name>" whose ONLY contact is
//      the configured address (no phone, no other address), two NEW approved plans re-rendered into their own
//      files, the source's verdicts/approval NOT copied, a dispatch row held for the owner's page
//      (QA_WAIT_NOTE); the source lead and its mocks are untouched; a second run with the same name refuses
//   ② the owner's Mehet (decideApproval) takes a row held with QA_WAIT_NOTE (the page lists it — before the
//      fix the yes wrote nothing)
//   ③ a Sunday night in Zagreb (window closed): the tick claims the TEST lead, a real queued lead stays queued,
//      and the next tick reports the window; the test send counts in no country's day counter
//   ④ the twin gate: another "[TESZT]" lead already mailed at the same address does not hold the clone; a
//      REAL lead already mailed at it does
//
//   npx tsx scripts/test-lead-clone-e2e.mts
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { buildHrWorld } from "./lib/hr-world.mts";

const w = await buildHrWorld({ base: "citoviso_tlclone_e2e" });
const { db } = await import("../src/db/client.js");
const { generateEngineMock } = await import("../src/generator/generateEngine.ts");
const { loadLead } = await import("../src/generator/persist.ts");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

async function atClock<T>(at: Date, fn: () => Promise<T>): Promise<T> {
  const RealDate = Date;
  const fixed = at.getTime();
  class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixed);
      else super(...(args as [string | number | Date]));
    }
    static now(): number {
      return fixed;
    }
  }
  globalThis.Date = FrozenDate as DateConstructor;
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

const OWNER = "elek@citoviso.com"; // the world's transport only lets this address through (ELEK_RUN)
const step = (m: string): void => console.log(`  … ${m} (${new Date().toISOString().slice(11, 19)})`);
step("a világ kész");
try {
  // The world's lead was mailed at OWNER; in production the source lead has its OWN address, never the owner's.
  await db.updateTable("prospect").set({ contact_email: "lavanda-forras@example.invalid" }).where("id", "=", w.prospectId).execute();
  const srcRaw0 = (await db.selectFrom("lead").select("raw").where("id", "=", w.leadId).executeTakeFirstOrThrow()).raw as Record<string, unknown>;
  await db.updateTable("lead").set({ raw: JSON.stringify({ ...srcRaw0, email: "lavanda-forras@example.invalid" }) } as never).where("id", "=", w.leadId).execute();

  step("a forrás címe átírva");
  // The second plan (a different template), approved like the first.
  const { MOCK_HEROFIX_STAMP } = await import("../src/outreach/mockPhotoGate.js");
  const main = await db.selectFrom("mock_artifact").select(["id", "inputs"]).where("lead_id", "=", w.leadId).executeTakeFirstOrThrow();
  const curatorCopy = { fields: { "hero.lead": "Mirni apartmani u Makarskoj", tagline: "Obiteljski apartmani", intro: "Apartmani Lavanda obiteljski su smještaj.", highlights: ["Vrt", "Plaža", "Doček"] } };
  const gen2 = await generateEngineMock(await loadLead(w.leadId), "_e2e", { curatorCopy: curatorCopy as never, template: "parallax", skin: "coastal-fresh" });
  step("második terv kész");
  const a2 = await db.selectFrom("mock_artifact").select("inputs").where("id", "=", gen2.artifactId).executeTakeFirstOrThrow();
  await db.updateTable("mock_artifact").set({ status: "approved", inputs: JSON.stringify({ ...(a2.inputs as object), reviewVerdict: "pass", review: { verdict: "pass", by: "e2e" }, terhatasAt: MOCK_HEROFIX_STAMP }) } as never).where("id", "=", gen2.artifactId).execute();
  const srcBefore = JSON.stringify(await db.selectFrom("mock_artifact").select(["id", "status", "inputs", "path"]).where("lead_id", "=", w.leadId).orderBy("id").execute());
  const srcLeadBefore = JSON.stringify(await db.selectFrom("lead").selectAll().where("id", "=", w.leadId).executeTakeFirstOrThrow());

  const env = { ...process.env, PGDATABASE: w.scratch, DATABASE_URL: "", TEST_LEAD_EMAIL: OWNER, EMAIL_BCC: "" };
  const run = (...a: string[]): { out: string; code: number } => {
    try {
      return { out: execFileSync("npx", ["tsx", "scripts/test-lead-clone.mts", w.leadId, ...a], { env, encoding: "utf8", stdio: "pipe" }), code: 0 };
    } catch (e) {
      const x = e as { stdout?: string; stderr?: string; status?: number };
      return { out: `${x.stdout ?? ""}${x.stderr ?? ""}`, code: x.status ?? 1 };
    }
  };

  console.log("① a másoló");
  const nLeads0 = Number((await db.selectFrom("lead").select((eb) => eb.fn.countAll<string>().as("n")).executeTakeFirstOrThrow()).n);
  const dry = run();
  const nLeads1 = Number((await db.selectFrom("lead").select((eb) => eb.fn.countAll<string>().as("n")).executeTakeFirstOrThrow()).n);
  check("szárazfuttatás: semmi nem íródik", dry.code === 0 && nLeads1 === nLeads0 && /DRY-RUN/.test(dry.out), dry.out.slice(-300));
  check("a cím nem kerül a kimenetbe", !dry.out.includes(OWNER));
  const go = run("--go");
  check("--go lefut", go.code === 0, go.out.slice(-600));
  console.log(go.out.split("\n").filter((l) => /terv|✓|⛔/.test(l)).map((l) => `      ${l.trim()}`).join("\n"));
  const clone = await db.selectFrom("lead").selectAll().where("name", "=", "[TESZT] Apartmani Lavanda").executeTakeFirst();
  check("a klón létrejött", !!clone);
  const craw = (clone?.raw ?? {}) as Record<string, unknown>;
  check("egyetlen kontakt: a tulaj címe", craw.email === OWNER && craw.phone === undefined && craw.otherEmails === undefined && craw.contacts === undefined, JSON.stringify({ e: craw.email, p: craw.phone }));
  const plans = clone ? await db.selectFrom("mock_artifact").select(["id", "status", "path", "inputs"]).where("lead_id", "=", clone.id).execute() : [];
  const tpl = (i: unknown): string => String(((i as { recipe?: { template?: string } })?.recipe?.template) ?? "");
  check("két új, jóváhagyott terv, két sablon", plans.length === 2 && plans.every((p) => p.status === "approved") && new Set(plans.map((p) => tpl(p.inputs))).size === 2);
  check("saját fájlok, léteznek", plans.every((p) => !!p.path && existsSync(path.resolve(process.cwd(), p.path)) && p.path.includes("-teszt-")));
  check("a forrás tulaj-jóváhagyása / verdiktjei NEM másolódtak", plans.every((p) => !(p.inputs as Record<string, unknown>).ownerApproval && !(p.inputs as Record<string, unknown>).qaReview));
  check("újrarenderelve (a mai bélyeggel)", plans.every((p) => (p.inputs as Record<string, unknown>).terhatasAt === MOCK_HEROFIX_STAMP));
  const { QA_WAIT_NOTE } = await import("../src/outreach/mockQaReview.js");
  const crow = clone ? await db.selectFrom("outreach_dispatch").select(["status", "note", "artifact_id"]).where("lead_id", "=", clone.id).executeTakeFirst() : undefined;
  check("kiküldési sor: tartva a tulaj lapjára (gépi kapura vár)", crow?.status === "held" && crow.note === QA_WAIT_NOTE, JSON.stringify(crow));
  const srcAfter = JSON.stringify(await db.selectFrom("mock_artifact").select(["id", "status", "inputs", "path"]).where("lead_id", "=", w.leadId).orderBy("id").execute());
  const srcLeadAfter = JSON.stringify(await db.selectFrom("lead").selectAll().where("id", "=", w.leadId).executeTakeFirstOrThrow());
  check("a forrás lead és mockjai érintetlenek", srcBefore === srcAfter && srcLeadBefore === srcLeadAfter);
  const again = run("--go");
  check("ugyanazzal a névvel másodszor: elutasít", again.code !== 0 && /már van ilyen nevű lead/.test(again.out));

  console.log("② a tulaj Mehet-je");
  const { decideApproval } = await import("../src/console/approvalQueue.js");
  const yes = clone ? await decideApproval(clone.id, true, "e2e-tulaj") : false;
  const crow2 = clone ? await db.selectFrom("outreach_dispatch").select(["status", "note"]).where("lead_id", "=", clone.id).executeTakeFirst() : undefined;
  check("a „gépi kapura vár” soron a Mehet sorba teszi", yes && crow2?.status === "queued", JSON.stringify(crow2));

  console.log("③ zárt ablak (vasárnap 22:00 Zágráb)");
  // A REAL lead queued next to it (owner-approved main plan, like the clone): it must wait for the window.
  await db.insertInto("outreach_dispatch").values({ lead_id: w.leadId, artifact_id: main.id, queued_by: "e2e", status: "queued" } as never).execute();
  const { runDispatchTick, sentTodayIn } = await import("../src/outreach/autoDispatch.js");
  const sunday = new Date("2026-11-29T21:00:00Z");
  const t1 = await atClock(sunday, () => runDispatchTick(new Date(sunday), { force: true }));
  check("a [TESZT] leadet felveszi zárt ablakban", t1.kind === "done" && t1.leadId === clone?.id, JSON.stringify(t1));
  const real = await db.selectFrom("outreach_dispatch").select("status").where("lead_id", "=", w.leadId).executeTakeFirstOrThrow();
  check("a valódi lead sorban marad", real.status === "queued");
  const t2 = await atClock(sunday, () => runDispatchTick(new Date(sunday), { force: true }));
  check("a következő kör az ablakot jelenti", t2.kind === "window", JSON.stringify(t2));
  check("a [TESZT] levél KIMENT (zárt ablakban, a tulaj címére)", t1.kind === "done" && t1.status === "sent", t1.kind === "done" ? `${t1.status} — ${t1.note.slice(0, 200)}` : t1.kind);
  const n = await atClock(sunday, () => sentTodayIn({ iso2: "HR", timeZone: "Europe/Zagreb" }));
  check("a teszt-küldés nem számít a HR napi keretébe", n === 0, String(n));

  console.log("④ ikerkapu");
  const { twinAlreadyContacted } = await import("../src/outreach/sharedContactGate.js");
  const run1 = await db.selectFrom("lead").select("scrape_run_id").where("id", "=", w.leadId).executeTakeFirstOrThrow();
  const other = await db.insertInto("lead").values({ scrape_run_id: run1.scrape_run_id, name: "[TESZT] Másik próba", raw: JSON.stringify({ name: "[TESZT] Másik próba", email: OWNER, country: "HR" }) } as never).returning("id").executeTakeFirstOrThrow();
  await db.insertInto("prospect").values({ lead_id: other.id, token: `tl${Date.now().toString(36)}a`, contact_email: OWNER, email_sent_at: new Date(), sent_at: new Date() } as never).execute();
  const craw2 = { ...craw } as never;
  check("másik [TESZT] a közös címen: nem tartja", clone ? (await twinAlreadyContacted(clone.id, craw2)) === null : false);
  const realTwin = await db.insertInto("lead").values({ scrape_run_id: run1.scrape_run_id, name: "Valódi Iker", raw: JSON.stringify({ name: "Valódi Iker", email: OWNER, country: "HR" }) } as never).returning("id").executeTakeFirstOrThrow();
  await db.insertInto("prospect").values({ lead_id: realTwin.id, token: `tl${Date.now().toString(36)}b`, contact_email: OWNER, email_sent_at: new Date(), sent_at: new Date() } as never).execute();
  const held = clone ? await twinAlreadyContacted(clone.id, craw2) : null;
  check("VALÓDI lead a közös címen: tartja", !!held && /Valódi Iker/.test(held), String(held));

  console.log("⑤ [TESZT]-rendelés 0,10 €, visszautalás + sztornó, takarítás");
  // The world's own lead (a sent prospect with a token) becomes a test lead for this part.
  await db.updateTable("lead").set({ name: "[TESZT] Világ Lavanda" }).where("id", "=", w.leadId).execute();
  const { PRESETS } = await import("../src/modules.js");
  const { computeMonthly, loadPricing } = await import("../src/pricing.js");
  const { applyOffer } = await import("../src/payment/offers.js");
  await loadPricing();
  const mods = PRESETS.find((x) => x.id === "alap")!.modules;
  const offers = await db.selectFrom("offer").select(["kind", "percent"]).where("prospect_id", "=", w.prospectId).execute();
  const pct = offers.find((o) => o.kind === "outreach")?.percent ?? 0;
  const shown = applyOffer(computeMonthly(mods, "hr"), { percent: pct } as never);
  const buyer = { buyer_name: "Ivan Babić", buyer_country: "HR", buyer_zip: "21300", buyer_city: "Makarska", buyer_address: "Obala kralja Tomislava 12", buyer_email: OWNER };
  const ord = await fetch(`${w.consoleOrigin}/p/${w.token}/request`, {
    method: "POST", redirect: "manual", headers: { "content-type": "application/json" },
    body: JSON.stringify({ modules: mods, preset: "alap", billing_period: "monthly", domain_type: "citoviso_sub", photo_rights_declared: true, recurring_consent: true, withdrawal_waiver: true, terms_accepted: true, price: shown, buyer_type: "individual", ...buyer }),
  });
  const oj = (await ord.json().catch(() => ({}))) as { ok?: boolean; payUrl?: string; error?: string };
  check("a vevő a képernyő árával (lista) rendel — nincs ár-eltérés", oj.ok === true && !!oj.payUrl, JSON.stringify(oj).slice(0, 300));
  const oi = await db.selectFrom("order_intent").selectAll().where("prospect_id", "=", w.prospectId).orderBy("created_at", "desc").executeTakeFirst();
  check("a rendelés 0,10 € (10 cent), domain-díj és ajánlat nélkül", oi?.currency === "EUR" && oi.price === 10 && !oi.domain_fee && !oi.offer_id, JSON.stringify({ c: oi?.currency, p: oi?.price, shown }));
  const pay = oi ? await db.selectFrom("payment").select(["id", "amount", "gateway_ref"]).where("order_intent_id", "=", oi.id).executeTakeFirst() : undefined;
  check("a fizetés is 10 cent", pay?.amount === 10, JSON.stringify(pay));
  if (pay?.gateway_ref) {
    const paid = await fetch(`${w.consoleOrigin}/pay/mock/${pay.gateway_ref}/paid`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "" });
    check("mock-fizetés: lefut", paid.status < 500, String(paid.status));
  }
  const settled = pay ? await db.selectFrom("payment").select("status").where("id", "=", pay.id).executeTakeFirst() : undefined;
  check("fizetett", settled?.status === "paid", JSON.stringify(settled));
  const inv = pay ? await db.selectFrom("invoice").selectAll().where("payment_id", "=", pay.id).execute() : [];
  check("számla: 1 db, euróban, 0,10 € bruttó", inv.length === 1 && inv[0]!.currency === "EUR" && inv[0]!.gross === 10 && inv[0]!.status === "issued", JSON.stringify(inv.map((i) => ({ g: i.gross, c: i.currency, s: i.status }))));

  const refundRun = (...a: string[]): { out: string; code: number } => {
    try {
      return { out: execFileSync("npx", ["tsx", "scripts/payment-refund.mts", w.leadId, ...a], { env: { ...env, PAYMENT_GATEWAY: "mock", INVOICE_PROVIDER: "mock" }, encoding: "utf8", stdio: "pipe" }), code: 0 };
    } catch (e) {
      const x = e as { stdout?: string; stderr?: string; status?: number };
      return { out: `${x.stdout ?? ""}${x.stderr ?? ""}`, code: x.status ?? 1 };
    }
  };
  const purgeRun = (...a: string[]): { out: string; code: number } => {
    try {
      return { out: execFileSync("npx", ["tsx", "scripts/test-lead-purge.mts", w.leadId, ...(clone ? [clone.id] : []), ...a], { env, encoding: "utf8", stdio: "pipe" }), code: 0 };
    } catch (e) {
      const x = e as { stdout?: string; stderr?: string; status?: number };
      return { out: `${x.stdout ?? ""}${x.stderr ?? ""}`, code: x.status ?? 1 };
    }
  };
  const early = purgeRun("--go", "--backup-dir", path.resolve("_planning/backups/tlclone-e2e-early"));
  check("takarító: amíg kint a pénz, NEM töröl", early.code === 2 && /még kint van pénz/.test(early.out), early.out.slice(-300));
  const r1 = refundRun("--go");
  check("visszautalás + sztornó: lefut", r1.code === 0, r1.out.slice(-400));
  const pAfter = pay ? await db.selectFrom("payment").select(["status", "refund_amount", "refund_ref"]).where("id", "=", pay.id).executeTakeFirst() : undefined;
  check("a fizetés: refunded, 10 cent, hivatkozással", pAfter?.status === "refunded" && pAfter.refund_amount === 10 && !!pAfter.refund_ref, JSON.stringify(pAfter));
  const invAfter = pay ? await db.selectFrom("invoice").select(["status", "gross", "cancels_invoice_id", "invoice_number"]).where("payment_id", "=", pay.id).execute() : [];
  check("a számla sztornózva + a sztornó bizonylat saját sor (−10 cent)", invAfter.some((i) => i.status === "storno") && invAfter.some((i) => i.status === "cancelled" && !!i.cancels_invoice_id && i.gross === -10), JSON.stringify(invAfter));
  const r2 = refundRun("--go");
  check("másodszor: nem utal vissza újra, nincs új sztornó", r2.code === 0 && /already/.test(r2.out) && !/sztornó .* → /.test(r2.out), r2.out.slice(-300));
  const realRefuse = (() => { try { execFileSync("npx", ["tsx", "scripts/payment-refund.mts", realTwin.id, "--go"], { env, stdio: "pipe" }); return false; } catch { return true; } })();
  check("valódi leadre --real nélkül: elutasít", realRefuse);
  const bdir = path.resolve("_planning/backups/tlclone-e2e");
  const purged = purgeRun("--go", "--backup-dir", bdir);
  check("takarító: lefut", purged.code === 0, purged.out.slice(-500));
  const leftLead = await db.selectFrom("lead").select("id").where("id", "in", [w.leadId, ...(clone ? [clone.id] : [])]).execute();
  const leftPay = pay ? await db.selectFrom("payment").select("id").where("id", "=", pay.id).execute() : [];
  check("a leadek és a láncuk törölve", leftLead.length === 0 && leftPay.length === 0);
  check("mentés: rows.json", existsSync(path.join(bdir, "rows.json")));
  const realLeft = await db.selectFrom("lead").select("id").where("id", "=", realTwin.id).executeTakeFirst();
  check("a valódi lead megmaradt", !!realLeft);
  const refuseReal = (() => { try { execFileSync("npx", ["tsx", "scripts/test-lead-purge.mts", realTwin.id], { env, stdio: "pipe" }); return false; } catch { return true; } })();
  check("takarító valódi leadre: elutasít", refuseReal);
} finally {
  await w.close();
}
console.log(fails ? `\n✗ ${fails} hiba` : "\n✓ minden rendben");
process.exit(fails ? 1 : 0);
