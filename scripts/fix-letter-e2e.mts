// THE CORRECTION LETTER, END TO END on a SCRATCH database restored from a prod dump (ADR-XXXX):
// selection by the rule → both plans by today's generator through the render gate → the approval page → „Mehet” →
// the letter through the guarded send path into the MOCK outbox → once per lead. The letter text is measured
// LETTER FOR LETTER against the owner's sentences as the brief gives them (not against our own copy module).
//
//   EMAIL_PROVIDER=mock PGDATABASE=<scratch db> npx tsx scripts/fix-letter-e2e.mts
//
// ⛔ Refuses to run unless EMAIL_PROVIDER=mock (the dev .env says smtp — a real address must never get a test letter)
// and the database name says scratch / fixletter / check. The clock is set to a weekday 10:00 Budapest for the run
// (the send window), nothing else is faked.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const DBNAME = process.env.PGDATABASE ?? "";
if ((process.env.EMAIL_PROVIDER ?? "") !== "mock" || process.env.SMTP_URL || process.env.COLD_OUTREACH_SMTP_URL) {
  console.error("⛔ csak EMAIL_PROVIDER=mock mellett, SMTP_URL / COLD_OUTREACH_SMTP_URL nélkül fut (valódi cím nem kaphat tesztlevelet)"); // i18n-exempt: operator log
  process.exit(2);
}
if (!/scratch|fixletter|check/i.test(DBNAME)) {
  console.error(`⛔ csak scratch adatbázison fut (PGDATABASE=${DBNAME || "—"})`); // i18n-exempt: operator log
  process.exit(2);
}

// a weekday 10:00 Budapest (09:00 UTC), advancing with real time — the send window, nothing else
{
  const RealDate = Date;
  const offset = new RealDate("2026-11-26T09:00:00Z").getTime() - RealDate.now();
  class FixedDate extends RealDate {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(RealDate.now() + offset);
      else super(...(a as [string]));
    }
    static now(): number {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = FixedDate as DateConstructor;
}

// the config loads .env AFTER the check above: measure what it decided, not what we asked
const { config } = await import("../src/config.js");
if (config.emailProvider !== "mock") {
  console.error(`⛔ a konfiguráció szerint a levél-szolgáltató „${config.emailProvider}” — csak mock mellett fut`); // i18n-exempt: operator log
  process.exit(2);
}
const { db } = await import("../src/db/client.js");
const fx = await import("../src/outreach/fixLetter.js");
const { fixLetterPage } = await import("../src/console/approvalQueue.js");

let fails = 0;
const ok = (cond: boolean, what: string): void => {
  console.log(`${cond ? "✅" : "❌"} ${what}`); // i18n-exempt: operator log
  if (!cond) fails++;
};

/** The owner's letter as the brief gives it — the measure. */
function expectedBody(name: string, link: string, unsub: string, sig: [string, string, string], legal: string, privacy: string, identity: string): string {
  return (
    `Tisztelt ${name}!\n\n` +
    "A napokban küldtünk Önnek egy honlaptervet, amelyet sajnálatos módon meghibásodott generátorunkkal állítottunk elő. A tervet újra elkészítettük:\n" +
    `${link}\n\n` +
    "Ez egy előzetes terv, még nem nyilvános oldal. A képek csak bemutatásra szolgálnak, és lecserélhetők az Önök saját fotóira. A megtekintés ingyenes, és semmire nem kötelez.\n\n" +
    "Ha nem szeretne több megkeresést kapni tőlünk, egy kattintással leiratkozhat:\n" +
    `${unsub}\n\n` +
    `${sig[0]}\n${sig[1]}\n${sig[2]}\n\n` +
    `${legal} ${privacy}\n${identity}`
  );
}

// ① selection
await db.deleteFrom("fix_letter").execute();
const sel = await fx.selectFixLetters();
console.log(`kijelölve: ${sel.selected.map((s) => s.name).join(", ")} · kimaradt: ${sel.refused.map((r) => `${r.name} (${r.reason})`).join(", ")}`); // i18n-exempt: operator log
ok(sel.selected.length > 0, "a szabály kijelöl legalább egy leadet");
ok(sel.refused.every((r) => !sel.selected.some((s) => s.leadId === r.leadId)), "a kimaradtak nincsenek a kijelöltek között");
const again = await fx.selectFixLetters();
ok(again.selected.length === 0, "második futás: senkit nem jelöl ki újra (leadenként egyszer)");

// ② both plans
for (const r of await db.selectFrom("fix_letter").select("id").where("status", "=", "selected").execute()) await fx.prepareFixLetter(r.id);
const rows = await db.selectFrom("fix_letter as f").innerJoin("lead as l", "l.id", "f.lead_id").select(["f.id", "f.status", "f.note", "f.prospect_id", "f.main_id", "f.alt_id", "l.name"]).execute();
for (const r of rows) console.log(`  ${r.name}: ${r.status} — ${r.note ?? ""}`); // i18n-exempt: operator log
const ready = rows.filter((r) => r.status === "ready");
ok(ready.length > 0, `két terv kész és a render-kapun átment: ${ready.length}/${rows.length}`);
ok(ready.every((r) => r.main_id && r.alt_id && r.prospect_id), "minden kész sornak két terve és saját linkje van");

// ③ the page
const list = await fx.listFixLetters();
const html = fixLetterPage(list, ready[0]?.id ?? null, "", {
  cfg: { enabled: false, brake: null },
  waiting: 0,
  notSeen: 0,
  counts: await fx.fixLetterCounts(),
  letter: ready[0]?.prospect_id ? await fx.fixLetterPreview(ready[0].prospect_id) : null,
  reviewed: true,
});
ok(list.every((f) => html.includes(f.name.replace(/&/g, "&amp;"))), "a lap minden javító levelet listáz");
ok(html.includes(`action="/jovahagyas/javito/${ready[0]?.id}"`) && html.includes("Mehet") && html.includes("Nem mehet ki"), "a kiválasztott lead Mehet / Nem mehet ki gombja a helyén");
ok(/Régi — kiküldve/.test(html) && /Új — javított/.test(html), "régi és új terv egymás mellett");

// a decision on a NOT ready row is refused; „Nem mehet ki” closes
const one = ready[ready.length - 1]!;
const no = await fx.decideFixLetter(one.id, false, "e2e");
ok(no.ok && (await db.selectFrom("fix_letter").select("status").where("id", "=", one.id).executeTakeFirst())?.status === "rejected", "„Nem mehet ki” → lezárva");
ok(!(await fx.decideFixLetter(one.id, true, "e2e")).ok, "lezárt sorra nincs „Mehet”");

// ④ „Mehet” → the guarded send into the mock outbox
const goRows = ready.filter((r) => r.id !== one.id);
for (const r of goRows) ok((await fx.decideFixLetter(r.id, true, "e2e")).ok, `Mehet: ${r.name}`);
const outbox = path.resolve(process.cwd(), "outbox");
const before = new Set(await readdir(outbox).catch(() => [] as string[]));
const s1 = await fx.sendApprovedFixLetters();
console.log(`küldés: ${JSON.stringify(s1)}`); // i18n-exempt: operator log
const after = (await readdir(outbox).catch(() => [] as string[])).filter((f) => !before.has(f));
ok(s1.sent > 0, `kiment a mock-outboxba: ${s1.sent}`);
const final = await db.selectFrom("fix_letter as f").innerJoin("lead as l", "l.id", "f.lead_id").select(["f.status", "f.note", "f.prospect_id", "l.name"]).where("f.id", "in", goRows.map((r) => r.id)).execute();
for (const r of final.filter((x) => x.status !== "sent")) console.log(`  vár / kimaradt: ${r.name} — ${r.note ?? ""}`); // i18n-exempt: operator log

// the letter, letter for letter
const { buildDraftForProspect } = await import("../src/outreach/draft.js");
for (const r of final.filter((x) => x.status === "sent")) {
  const d = await buildDraftForProspect(r.prospect_id!);
  const p = d!.draft.parts;
  const exp = expectedBody(d!.input.leadName, d!.draft.link, d!.draft.unsubscribeLink, [p.sigName, p.sigCo, p.sigMail], p.legal, d!.draft.privacyLink, p.identity);
  const files = await Promise.all(after.map(async (f) => ({ f, t: await readFile(path.join(outbox, f), "utf8").catch(() => "") })));
  const mine = files.find((x) => x.t.includes(d!.draft.unsubscribeLink));
  ok(Boolean(mine), `${r.name}: a levél az outboxban`);
  if (!mine) continue;
  const text = mine.t.replace(/\r\n/g, "\n");
  ok(text.includes(`Subject: ${d!.input.leadName} – javított honlapterv`), `${r.name}: a tárgy betű szerint`);
  // (a) the TEXT part, built by the send path's own builder (fixLetterPreview = fixLetterDraft on the same draft)
  const pv = await fx.fixLetterPreview(r.prospect_id!);
  ok(pv?.body === exp, `${r.name}: a szöveges rész betű szerint a brief szerinti`);
  if (pv && pv.body !== exp) console.log(`    várt:\n${exp}\n    kapott:\n${pv.body}`); // i18n-exempt: operator log
  // (b) the HTML that left: every paragraph, link, signature and legal line of the brief, in this order
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pieces = exp.split("\n").map((x) => x.trim()).filter(Boolean).flatMap((x) => (x.endsWith(d!.draft.privacyLink) ? [x.slice(0, -d!.draft.privacyLink.length).trim(), d!.draft.privacyLink] : [x]));
  let at = 0;
  let inOrder = true;
  for (const piece of pieces) {
    const i = text.indexOf(esc(piece), at);
    if (i < 0) {
      inOrder = false;
      console.log(`    a HTML-ből hiányzik / rossz helyen: ${piece.slice(0, 80)}`); // i18n-exempt: operator log
      break;
    }
    at = i + 1;
  }
  ok(inOrder, `${r.name}: a kiment HTML a brief minden sorát sorrendben tartalmazza`);
  ok(!/Elkészült a honlapja|Üdvözlettel|kész honlap/i.test(text), `${r.name}: nincs benne a hideg levél egyetlen sora sem`);
}

// once per lead: a second run sends nothing
const s2 = await fx.sendApprovedFixLetters();
ok(s2.sent === 0, "második küldési kör: semmi nem megy ki újra");
const st = await stat(outbox).catch(() => null);
ok(Boolean(st), "a mock-outbox létezik");

console.log(fails ? `\n❌ ${fails} hiba` : "\n✅ minden rendben"); // i18n-exempt: operator log
process.exit(fails ? 1 : 0);
