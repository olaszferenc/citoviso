// page-question-check — ADR-XXXX (kerdes-inditas): the lead page's free-question field, server half.
//
// What it holds (owner 2026-11-12, frozen plan assets/design-refs/prospect-page/kerdes-inditas/ ⑤–⑥):
//   ① pure: 300 characters, a link / domain / e-mail / phone number is refused, repeats compare
//      without case, accents and punctuation;
//   ② the 4 s gap, the repeat, the 100 / lead / Budapest-day ceiling (the 101st is refused);
//   ③ a matched question is stored with its category and NEVER queued;
//   ④ an unmatched one goes to the owner's approval queue (outreach_reply 'page:<id>', on the
//      e-mail the lead was reached at) — at most 5 per day, the 6th is stored, not queued (capped);
//   ⑤ an opted-out lead's question and the owner's own view are stored, never queued;
//   ⑥ nothing is sent: no outreach_reply_send row appears (⑥ — no automatic outward answer).
// --selftest: the same run with the per-day ceiling cut out must go RED.
//
// Usage: npx tsx scripts/page-question-check.mts [--selftest]

import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { ASK_LIMITS, askQuestion, checkQuestionText, isUrlish, normQuestion } from "../src/replies/pageQuestion.js";

const SELFTEST = process.argv.includes("--selftest");
let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    fails++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ① pure rules
check("① üres szöveg elutasítva", "error" in checkQuestionText("   ") && (checkQuestionText("  ") as { error: string }).error === "empty");
check("① 300 karakter átmegy, 301 nem", !("error" in checkQuestionText("a".repeat(300))) && (checkQuestionText("a".repeat(301)) as { error?: string }).error === "long");
for (const t of ["nezze meg www.pelda.hu", "https://x.io/a", "irjon: nev@gmail.com", "hivjon 06 30 123 4567", "olcso-szallas.com"]) {
  check(`① link/cím/szám elutasítva: „${t}”`, isUrlish(t));
}
for (const t of ["Mennyibe kerül egy hónap?", "Van éves díj 2027-re?", "Lemondható 3 hónap után?"]) {
  check(`① sima kérdés átmegy: „${t}”`, !isUrlish(t));
}
check("① ismétlés ékezet/írásjel nélkül egyezik", normQuestion("Lemondható?") === normQuestion("lemondhato"));

// fixtures: a lead reached by e-mail, and an opted-out one
const stamp = Date.now().toString(36);
const def = await db
  .insertInto("scraper_definition")
  .values({ label: `_pagequestion_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
  .returning("id")
  .executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
async function fixture(tag: string, unsub: boolean): Promise<{ token: string; prospectId: string; leadId: string }> {
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: `_pagequestion_${stamp} ${tag}`, raw: JSON.stringify({ phone: "+36 30 111 2233" }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const token = `pq${stamp}${tag}xxxxxxxxxxxxxxxx`.slice(0, 24);
  const p = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token, contact_email: `pq-${tag}@example.invalid`, ...(unsub ? { unsubscribed_at: new Date().toISOString() } : {}) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return { token, prospectId: p.id, leadId: lead.id };
}
const A = await fixture("a", false);
const B = await fixture("b", true);
const IP = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

try {
  // A virtual clock: every question 5 s after the previous one (the 4 s gap is its own check).
  let t = Date.now();
  const next = (gap = 5000) => new Date((t += gap));

  // ③ matched → stored, not queued
  const m = await askQuestion(A.token, { text: "Mennyibe kerül?", category: "ar" }, IP, next());
  check("③ illesztett kérdés: tárolva, NEM rögzítve a sorba", m.ok && !m.recorded, JSON.stringify(m));

  // ② gap and repeat
  const g = await askQuestion(A.token, { text: "Van további költség?", category: "koltseg" }, IP, next(1000));
  check("② 4 mp-en belül: gap + várakozás", !g.ok && g.error === "gap" && (g.wait ?? 0) >= 1, JSON.stringify(g));
  const d = await askQuestion(A.token, { text: "mennyibe kerul", category: "ar" }, IP, next());
  check("② ugyanaz a kérdés újra: dup, nem tárolva", !d.ok && d.error === "dup", JSON.stringify(d));

  // ④ unmatched → the approval queue, 5 a day
  const rec: boolean[] = [];
  let capped = false;
  for (let i = 1; i <= 6; i++) {
    const r = await askQuestion(A.token, { text: `Van parkoló a ${i}. épületnél?`, category: null }, IP, next());
    rec.push(r.ok && r.recorded);
    if (i === 6) capped = r.ok && r.capped && !r.recorded;
  }
  check("④ az első 5 illeszthetetlen a jóváhagyó sorba megy", rec.slice(0, 5).every(Boolean), JSON.stringify(rec));
  check("④ a 6. tárolva, de nem a sorba (capped)", capped);
  const queued = await db
    .selectFrom("outreach_reply")
    .select(["channel", "sender", "source_key", "subject", "answered_at"])
    .where("prospect_id", "=", A.prospectId)
    .execute();
  check("④ sor-elemek: 5 db, e-mail csatorna a megkeresés címére, 'page:' kulcs", queued.length === 5 && queued.every((q) => q.channel === "email" && q.sender === "pq-a@example.invalid" && q.source_key.startsWith("page:") && !q.answered_at), JSON.stringify(queued[0]));

  // ⑤ opted-out / own view
  const u = await askQuestion(B.token, { text: "Hány szobás a ház?", category: null }, IP, next());
  const uq = await db.selectFrom("outreach_reply").select("id").where("prospect_id", "=", B.prospectId).execute();
  check("⑤ leiratkozott lead kérdése: tárolva, soha nem a sorba", u.ok && !u.recorded && uq.length === 0, JSON.stringify(u));
  const o = await askQuestion(A.token, { text: "Saját nézet tesztkérdés?", category: null, own: true }, IP, next());
  check("⑤ saját nézet: tárolva, nem a sorba", o.ok && !o.recorded, JSON.stringify(o));

  // ② the day ceiling
  const have = Number((await db.selectFrom("prospect_question").select(sql<number>`count(*)`.as("n")).where("prospect_id", "=", A.prospectId).executeTakeFirstOrThrow()).n);
  const fill = ASK_LIMITS.perDay - have;
  for (let i = 0; i < fill; i++) {
    await db.insertInto("prospect_question").values({ prospect_id: A.prospectId, text: `kitöltés ${i}`, category: "ar", created_at: new Date(t - 60_000).toISOString() as never }).execute();
  }
  if (SELFTEST) {
    // Sabotage: the ceiling forgotten — delete today's rows so the 101st looks like the 1st.
    await db.deleteFrom("prospect_question").where("prospect_id", "=", A.prospectId).execute();
  }
  const over = await askQuestion(A.token, { text: "Még egy kérdés a napi plafon fölött?", category: null }, IP, next());
  check(`② a ${ASK_LIMITS.perDay + 1}. kérdés aznap: day`, !over.ok && over.error === "day", JSON.stringify(over));

  // ⑥ nothing went out
  const sends = await db
    .selectFrom("outreach_reply_send as s")
    .innerJoin("outreach_reply as r", "r.id", "s.reply_id")
    .select("s.id")
    .where("r.prospect_id", "in", [A.prospectId, B.prospectId])
    .execute();
  check("⑥ semmi nem ment ki gépi úton (outreach_reply_send üres)", sends.length === 0);
} finally {
  await db.deleteFrom("outreach_reply").where("prospect_id", "in", [A.prospectId, B.prospectId]).execute();
  await db.deleteFrom("prospect").where("id", "in", [A.prospectId, B.prospectId]).execute();
  await db.deleteFrom("lead").where("id", "in", [A.leadId, B.leadId]).execute();
  await db.deleteFrom("scrape_run").where("id", "=", run.id).execute();
  await db.deleteFrom("scraper_definition").where("id", "=", def.id).execute();
  await db.destroy();
}

if (SELFTEST) {
  console.log(fails ? `\nselftest OK — a szabotált futás PIROS (${fails} hiba), ahogy kell` : "\n✗ selftest: a szabotált futás is zöld — a kapu nem fog");
  process.exit(fails ? 0 : 1);
}
console.log(fails ? `\n✗ ${fails} hiba` : "\n✓ page-question-check: minden zöld");
process.exit(fails ? 1 : 0);
