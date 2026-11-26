// NEMZETKÖZI B (2026-11-22) — KIKÜLDÉS, UTÁNKÖVETÉS, VÁLASZ, ELUTASÍTÓ a lead országában.
// SCRATCH database only (scripts/lib/hr-world.mts): migrations, the HR row of 0142, Bábel's hr
// packs (+ the scratch-only markers for strings Bábel has not translated yet), a HR lead whose
// cold letter went out through the real send path to the mock transport. No AI, no network,
// nothing leaves the machine.
//
//   ① the cold letter: Croatian, euro price, no „.hu” address and no Szállás.hu;
//   ② the clocks are Zagreb's with the Croatian holidays: the escalation follow-up waits on a
//      Croatian holiday (Christmas) and goes out on the next working day; the non-opener letter,
//      the behaviour message, the cold dispatch window and the trial day read the same row;
//   ③ the HR phone key: a national „091 …” number is +38591…, and the number-level stop finds it;
//   ④ a Croatian refusal („Ne, hvala, ne zanima me.”) is stored as the lead's reply in Croatian;
//      after the owner's „ne keressük” NO sender touches the lead — not even through a prospect
//      created after the block (no unsubscribed_at of its own): cold mail, cold mobile, dispatch,
//      escalation follow-up, non-opener letter, behaviour message, trial campaign, number stop.
//
//   npx tsx scripts/nemzetkozi-b-e2e.mts
import { buildHrWorld } from "./lib/hr-world.mts";

const w = await buildHrWorld({ base: "citoviso_nemzb_e2e" });

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { countryConfigSync } = await import("../src/country.js");

let fails = 0;
let total = 0;
function check(name: string, ok: boolean, detail = ""): void {
  total++;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

/** A recording mail transport: nothing is sent, every message is kept for the checks. */
function recorder() {
  const sent: { to: string; subject: string; text: string; html?: string }[] = [];
  return {
    sent,
    sender: {
      async send(msg: { to: string; subject: string; text: string; html?: string }) {
        sent.push(msg);
        return { id: `rec-${sent.length}`, provider: "mock" as const };
      },
    },
  };
}

try {
  const HR = countryConfigSync("HR");
  check("a HR-sor él (Europe/Zagreb, horvát ünnepnapok, csak e-mail)", !!HR && HR.timeZone === "Europe/Zagreb" && HR.publicHolidays.includes("12-25") && JSON.stringify(HR.outreachChannels) === '["email"]');

  // ── ① the cold letter ──────────────────────────────────────────────────────────────────
  console.log("① a hideg levél");
  const fs = await import("node:fs");
  const letter = w.letterPath ? fs.readFileSync(w.letterPath, "utf8") : "";
  check("a hideg levél kiment (a valódi küldési úton, mock-transzport)", !!letter);
  check("euró ár, nincs „Ft”", /€/.test(letter) && !/\bFt\b|forint/.test(letter), (letter.match(/[^\n]{0,40}(€|Ft)[^\n]{0,20}/g) ?? []).slice(0, 3).join(" | "));
  check("nincs Szállás.hu és nincs „.hu” cím a levélben", !/Szállás\.hu|Sz=C3=A1ll=C3=A1s\.hu/.test(letter) && !/(^|\s)\.hu\b/m.test(letter));
  const { buildDraftForProspect } = await import("../src/outreach/draft.js");
  const dr = await buildDraftForProspect(w.prospectId, { reserveLabel: false });
  check("a levél horvát, országa HR", dr?.lang === "hr" && dr.market.country === "HR" && dr.input.country === "HR");
  // (Bábel has not translated the new sentence yet: the scratch world marks it „‹hr› …” with the vowels
  // masked — so the check reads the consonant skeleton too: no „Sz·ll·s”, and „rbnb” is there.)
  const p4 = dr?.draft.parts.p4 ?? "";
  check("a naptár-mondat a határon átnyúló párt nevezi (Booking.com, Airbnb), Szállás.hu nélkül", !/Szállás|Sz.ll.s/.test(p4) && /rbnb/.test(p4), p4);

  // ── ② the clocks ───────────────────────────────────────────────────────────────────────
  console.log("② zágrábi idő, horvát ünnepnap");
  const { followupWindowBlocksIn, behaviorWindowBlocksIn, mockWindowBlocksIn } = await import("../src/outreach/leadClock.js");
  const { followupWindowBlocks, sendEscalationFollowups } = await import("../src/outreach/escalationFollowup.js");
  const { outreachWindowBlocksIn } = await import("../src/outreach/countryOutreach.js");
  const XMAS = new Date("2026-12-25T09:00:00Z"); // Friday 10:00 Zagreb — Božić
  const MON = new Date("2026-12-28T09:00:00Z"); // Monday 10:00 Zagreb — a working day
  const EARLY = new Date("2026-12-28T05:30:00Z"); // Monday 06:30 Zagreb — before the window
  check("karácsony 10:00 Zágráb: hideg ablak, nem-nyitó, viselkedés, emlékeztető — mind ZÁRVA",
    !!outreachWindowBlocksIn(XMAS, HR) && !!mockWindowBlocksIn(XMAS, HR) && !!behaviorWindowBlocksIn(XMAS, HR) && !!followupWindowBlocksIn(XMAS, HR, followupWindowBlocks));
  check("hétfő 10:00 Zágráb: mind NYITVA",
    !outreachWindowBlocksIn(MON, HR) && !mockWindowBlocksIn(MON, HR) && !behaviorWindowBlocksIn(MON, HR) && !followupWindowBlocksIn(MON, HR, followupWindowBlocks));
  check("hétfő 06:30 Zágráb: az emlékeztető még vár (8–20 helyi idő)", !!followupWindowBlocksIn(EARLY, HR, followupWindowBlocks));
  check("a zárt ablak oka a lead országát és zónáját nevezi", /Horvátország|Europe\/Zagreb/.test(behaviorWindowBlocksIn(XMAS, HR) ?? ""), behaviorWindowBlocksIn(XMAS, HR) ?? "");

  // The escalation follow-up end to end: an offer whose follow-up is due on Christmas.
  await db.insertInto("mock_view").values({ prospect_id: w.prospectId, device: "desktop", started_at: new Date("2026-12-19T10:00:00Z") } as never).execute();
  const offer = await db.insertInto("offer").values({
    kind: "escalation", prospect_id: w.prospectId, percent: 30, expires_at: new Date("2027-01-10T12:00:00Z"),
    note: "nemzetkozi-b-e2e", created_at: new Date("2026-12-20T09:00:00Z"),
  } as never).returning("id").executeTakeFirstOrThrow();
  const only = new Set([w.prospectId]);
  const r1 = recorder();
  const x1 = await sendEscalationFollowups(XMAS, { sender: r1.sender as never, onlyProspects: only });
  const claimed1 = await db.selectFrom("offer").select("followup_sent_at").where("id", "=", offer.id).executeTakeFirstOrThrow();
  check("az eszkalációs emlékeztető karácsonykor NEM megy ki, és nem is foglalódik le", x1.sent === 0 && r1.sent.length === 0 && !claimed1.followup_sent_at, JSON.stringify(x1));
  const r2 = recorder();
  const x2 = await sendEscalationFollowups(MON, { sender: r2.sender as never, onlyProspects: only });
  const fu = r2.sent[0];
  check("hétfőn 10:00 (Zágráb) kimegy", x2.sent === 1 && r2.sent.length === 1, JSON.stringify(x2));
  check("az emlékeztető euróban, „forint” nélkül, Szállás.hu nélkül", !!fu && /€/.test(fu.text) && !/forint|\bFt\b|Szállás\.hu/.test(fu.text), fu?.text.slice(0, 300) ?? "");

  // The trial day on the lead's calendar.
  const { trialDayOf } = await import("../src/trial/escalation.js");
  check("a próbanap a lead naptárával (Zágráb)", trialDayOf(new Date("2026-12-28T23:30:00Z"), new Date("2026-12-28T08:00:00Z"), HR!.timeZone) === 2 &&
    trialDayOf(new Date("2026-12-28T22:30:00Z"), new Date("2026-12-28T08:00:00Z"), HR!.timeZone) === 1);

  // ── ③ the HR phone key ─────────────────────────────────────────────────────────────────
  console.log("③ a horvát telefonszám-kulcs");
  const { leadPhoneE164 } = await import("../src/outreach/leadClock.js");
  check("a horvát „091 234 5678” = +385912345678 (a lead országában olvasva)", leadPhoneE164({ phone: "091 234 5678", country: "HR" }) === "+385912345678");
  check("ugyanez a HU-szabállyal nem olvasható (régi hiba: null kulcs)", (await import("../src/text/phone.js")).normalizePhone("091 234 5678") === null);
  const rawNow = (await db.selectFrom("lead").select("raw").where("id", "=", w.leadId).executeTakeFirstOrThrow()).raw as Record<string, unknown>;
  await db.updateTable("lead").set({ raw: { ...rawNow, phone: "091 234 5678" } } as never).where("id", "=", w.leadId).execute();

  // ── ④ the Croatian refusal → nobody touches the lead ────────────────────────────────────
  console.log("④ horvát elutasítás → a lead blokkolva, semmilyen küldő nem éri el");
  const { ingestReplies } = await import("../src/replies/store.js");
  const ing = await ingestReplies([{
    channel: "email", key: `email:<nemzb-${Date.now()}@test>`, from: "Ivan Babić <elek@citoviso.com>", receivedAt: "2026-11-26T08:00:00.000Z", // after the cold letter (sent at the world's frozen 2026-11-25)
    subject: "Re: Apartmani Lavanda", text: "Ne, hvala, ne zanima me. Molim Vas da me više ne kontaktirate.",
  }]);
  const reply = await db.selectFrom("outreach_reply").select(["id", "lang", "lead_id"]).where("lead_id", "=", w.leadId).executeTakeFirst();
  check("a horvát válasz a leadhez tárolódott, horvát nyelvjellel", ing.accepted.length === 1 && !!reply && reply.lang === "hr", JSON.stringify({ ing, reply }));
  const { repliesNeedingSuggestion } = await import("../src/replies/store.js");
  const need = (await repliesNeedingSuggestion()).find((n) => n.id === reply?.id);
  check("Poe jegye: nyelv hr, zóna Europe/Zagreb", need?.lang === "hr" && need?.timeZone === "Europe/Zagreb", JSON.stringify(need));

  const { blockLeadContact } = await import("../src/console/partnerMessages.js");
  const b = await blockLeadContact(w.leadId, "elutasító (hr): ne zanima me", "e2e");
  check("„ne keressük” rögzítve", b.ok);
  // A prospect created AFTER the block (a re-generated mock) — no unsubscribed_at of its own.
  const art = await db.selectFrom("prospect").select("mock_artifact_id").where("id", "=", w.prospectId).executeTakeFirstOrThrow();
  const p2 = await db.insertInto("prospect").values({ lead_id: w.leadId, token: `nemzb${Date.now().toString(36)}`, mock_artifact_id: art.mock_artifact_id, contact_email: "elek@citoviso.com", sent_at: new Date("2026-12-01T09:00:00Z"), email_sent_at: null } as never)
    .returning("id").executeTakeFirstOrThrow();
  check("az új prospectnek nincs saját leiratkozás-jele (ez a védőháló próbája)", !(await db.selectFrom("prospect").select("unsubscribed_at").where("id", "=", p2.id).executeTakeFirstOrThrow()).unsubscribed_at);

  const { sendOutreachMail } = await import("../src/outreach/sendBatch.js");
  const cold = await sendOutreachMail(p2.id, { dryRun: true });
  check("hideg levél: kihagyva", cold.outcome.kind === "skipped", JSON.stringify(cold.outcome));
  const { mobileOutreachGates, isPhoneSuppressed } = await import("../src/outreach/sendOutreachSms.js");
  const mob = await mobileOutreachGates(p2.id);
  check("hideg mobil (SMS/MMS-pár): tiltva", !mob.ok, JSON.stringify(mob).slice(0, 200));
  check("szám-szintű tiltás: a horvát szám (+385912345678) tiltott", await isPhoneSuppressed("+385912345678"));

  const { enqueueDispatch, runDispatchTick, setAutoDispatchSettings } = await import("../src/outreach/autoDispatch.js");
  await db.deleteFrom("outreach_dispatch").where("lead_id", "=", w.leadId).execute();
  await db.insertInto("outreach_dispatch").values({ lead_id: w.leadId, artifact_id: art.mock_artifact_id, queued_by: "e2e" } as never).execute();
  await setAutoDispatchSettings({ enabled: true });
  const tick = await runDispatchTick(MON, { force: true });
  check("kiküldési sor: kihagyva (válaszolt / tiltott)", tick.kind === "done" && tick.status === "skipped", JSON.stringify(tick));
  void enqueueDispatch;

  const offer2 = await db.insertInto("offer").values({
    kind: "escalation", prospect_id: p2.id, percent: 30, expires_at: new Date("2027-01-10T12:00:00Z"), note: "nemzetkozi-b-e2e 2", created_at: new Date("2026-12-20T09:00:00Z"),
  } as never).returning("id").executeTakeFirstOrThrow();
  const r3 = recorder();
  const x3 = await sendEscalationFollowups(MON, { sender: r3.sender as never, onlyProspects: new Set([p2.id]) });
  check("eszkalációs emlékeztető (blokk utáni prospect): nem megy ki", x3.sent === 0 && r3.sent.length === 0, JSON.stringify(x3));
  void offer2;

  const { listNonOpenerCandidates } = await import("../src/outreach/nonOpenerFollowup.js");
  const non = (await listNonOpenerCandidates({ onlyLeads: [w.leadId], now: new Date("2027-01-20T09:00:00Z") })).find((c) => c.leadId === w.leadId);
  check("nem-nyitó levél: kizárva", !!non && non.excluded !== null, JSON.stringify(non?.excluded));

  const { listBehaviorCandidates, setBehaviorEnabled } = await import("../src/outreach/behaviorMessage.js");
  await setBehaviorEnabled(true, "e2e", new Date("2026-12-01T00:00:00Z"));
  await db.insertInto("mock_view").values({ prospect_id: p2.id, device: "mobile", started_at: new Date("2026-12-27T10:00:00Z") } as never).execute();
  const beh = (await listBehaviorCandidates({ onlyLeads: [w.leadId], now: MON })).filter((c) => c.leadId === w.leadId);
  check("viselkedés-üzenet: kizárva (blocked)", beh.length > 0 && beh.every((c) => c.excluded !== null), JSON.stringify(beh.map((c) => c.excluded)));

  const { listTrialCampaignCandidates } = await import("../src/outreach/trialCampaign.js");
  const tc = (await listTrialCampaignCandidates({ onlyLeads: [w.leadId], now: MON })).find((c) => c.leadId === w.leadId);
  check("próba-kampány: kizárva", !!tc && tc.excluded !== null, JSON.stringify(tc?.excluded));

  const { trialContactBlocked } = await import("../src/trial/contactBlock.js");
  void trialContactBlocked; // the trial runners read the same lead mark (scripts/trial-escalation-check.mts ⑤)
  void sql;
} finally {
  await w.close();
}

console.log(fails ? `\n⛔ nemzetkozi-b-e2e: ${fails}/${total} hiba` : `\n✅ nemzetkozi-b-e2e: mind a ${total} ellenőrzés zöld`);
process.exit(fails ? 1 : 0);
