// A piszkozat-képernyő NEM mondhat mást, mint amit a küldő-út tenne (Elek FK-004 Z1/Z2).
//
// ⛔ MIÉRT: a lap teteje zöld „Jogszerűségi kapu: PASS — küldhető" jelvényt adott, miközben
// a §C-kapu a `sendOutreachMail` KILENC kapujából EGY. Mérve 2026-09-13: három ELEK-prospect
// „küldhető"-t mutatott volna, miközben a küldő-út „a mock kurátori jóváhagyásra vár"-ral
// utasította el őket, a kiküldött levél lapja pedig a KÜLDÉS UTÁN is „küldhető"-t állított
// (a csatorna-egylövés közben lezárta a csatornát). Egy piros figyelmeztetés ült ugyanezen a
// soron, és semmi nem mondta meg, hogy az blokkol-e (nem blokkolt — a levél kiment).
//
// Amit ez az őr MÉR (a KIRENDERELT lapon, nem a szándékon):
//   ① a lap sendability-állítása egyezik a küldő-út verdiktjével (`describeMailSendability`);
//   ② a §C-jelvény SOHA nem állítja magáról, hogy „küldhető" — az nem az ő ítélete;
//   ③ elhasznált csatornán (email_sent_at kitöltve) a lap nem állíthat küldhetőt;
//   ④ a nem-blokkoló figyelmeztetés megmondja magáról, hogy nem blokkol.
//
//   npx tsx scripts/outreach-sendability-check.mts
//   npx tsx scripts/outreach-sendability-check.mts --self-test   (pirosra KELL mennie)

import { db } from "../src/db/client.js";
import { outreachDraftPage } from "../src/console/views.js";
import { buildDraftForProspect } from "../src/outreach/draft.js";
import { checkOutreachDraft } from "../src/outreach/outreachCheck.js";
import { describeMailSendability, type MailSendability } from "../src/outreach/sendBatch.js";

const SELF_TEST = process.argv.includes("--self-test");

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) {
    console.log(`✓ ${what}`);
    return;
  }
  failed++;
  console.error(`✗ BUKÁS  ${what}${detail ? `\n     ↳ ${detail}` : ""}`);
};

/** The two claims the screen can make, as the operator reads them. */
const CLAIM_YES = "most kiküldhető";
const CLAIM_NO = "most NEM küldhető";

/**
 * Rule ②: does the §C badge promise sendability? ONE copy, used by the page check AND
 * by the self-test below — a rule that is never shown to go red is decoration, and this
 * one could not be falsified by the sendability self-test (that one only lies about the
 * claim, not about the badge).
 */
const badgePromisesSendable = (html: string): boolean =>
  /Jogszerűségi kapu[^<]*küldhető/u.test(
    html.replace(/Jogszerűségi kapu: FLAG — ez tiltja a küldést/gu, ""),
  );

const rows = await db
  .selectFrom("prospect")
  .innerJoin("lead", "lead.id", "prospect.lead_id")
  .select([
    "prospect.id as id",
    "lead.name as name",
    "prospect.email_sent_at as emailSentAt",
  ])
  .orderBy("prospect.created_at", "desc")
  .limit(20)
  .execute();

// A guard that measures nothing is decoration: if the park is empty, fail loudly rather
// than report a green run over zero rows.
say(rows.length >= 3, `van mit mérni (${rows.length} prospect)`, "a parkban nincs elég prospect a méréshez");

for (const r of rows) {
  const d = await buildDraftForProspect(r.id);
  if (!d) continue;
  const truth = await describeMailSendability(r.id);
  // ⛔ SELF-TEST: the screen is handed the OPPOSITE claim — a page that says „mehet"
  // while the send path refuses. Every rule below must go red on it, or none of them
  // could ever have caught the reported bug.
  const shown: MailSendability = SELF_TEST
    ? { sendable: true, reason: null, gateBlocked: false }
    : truth;
  const html = outreachDraftPage(
    r.id,
    d.input,
    d.draft,
    checkOutreachDraft(d.draft, d.input.leadName, d.lang, d.market),
    null,
    null,
    null,
    d.leadId,
    shown,
  );
  const saysYes = html.includes(CLAIM_YES);
  const saysNo = html.includes(CLAIM_NO);
  const who = `${r.name} (${r.id.slice(0, 8)})`;

  // ① the page's claim IS the send path's verdict
  say(
    saysYes === truth.sendable && saysNo === !truth.sendable,
    `${who}: a lap állítása = a küldő-út verdiktje (${truth.sendable ? "küldhető" : "nem küldhető"})`,
    `lapon: küldhető=${saysYes} / nem=${saysNo} · küldő-út: ${truth.sendable ? "küldhető" : (truth.reason ?? "§C kapu")}`,
  );

  // ② the §C badge must never claim sendability — that verdict is not its to give
  say(
    !badgePromisesSendable(html),
    `${who}: a §C-jelvény nem állít „küldhető”-t`,
    "a §C-kapu a kilencből egy — a küldhetőség nem az ő ítélete",
  );

  // ③ a used channel can never be shown as sendable
  if (r.emailSentAt) {
    say(
      !saysYes,
      `${who}: elhasznált csatorna → a lap NEM állít küldhetőt`,
      "a levél már kiment, a lap mégis küldhetőnek mondja (FK-004 Z2)",
    );
  }

  // ④ a non-blocking warning says so about itself
  if (html.includes("nem a feladó domainje")) {
    say(
      html.includes("nem blokkol"),
      `${who}: a link-figyelmeztetés megmondja, hogy nem blokkol`,
      "piros sáv blokkolás-gyanúval, a visszafordíthatatlan gomb mellett (FK-004 Z1)",
    );
  }
}

if (SELF_TEST) {
  // ⚠️ Rule ② cannot be falsified by the lie above (that one only changes the CLAIM,
  // not the badge), so it is measured against the page as it ACTUALLY SHIPPED on
  // 2026-09-13 — the wording from the FK-004 screenshot. Without this, rule ② would be
  // a green line that never proved it can see anything.
  const SHIPPED_BADGE = `<span class="pill approved">Jogszerűségi kapu: PASS — küldhető</span>`;
  if (!badgePromisesSendable(SHIPPED_BADGE)) {
    console.error(
      "\n⛔ ÖNTESZT BUKOTT: a ② szabály a 2026-09-13-án KIMENT jelvényt sem fogja meg — vak.",
    );
    process.exit(1);
  }
  console.log("✓ ÖNTESZT ②: a szabály felismeri a kiment „PASS — küldhető” jelvényt");
  if (failed === 0) {
    console.error(
      "\n⛔ ÖNTESZT BUKOTT: a hamis „küldhető” állítást EGYETLEN szabály sem fogta meg — az őr vak.",
    );
    process.exit(1);
  }
  console.log(`\n✅ ÖNTESZT: a hamis állítást ${failed} mérés fogta meg (ennek kell pirosnak lennie).`);
  process.exit(0);
}

if (failed) {
  console.error(`\n⛔ ${failed} mérés bukott — a képernyő mást állít, mint amit a küldés tenne.`);
  process.exit(1);
}
console.log("\n✅ outreach-sendability-check: a lap a küldő-út verdiktjét mondja, és a §C-jelvény nem ígér küldhetőséget.");
process.exit(0);
