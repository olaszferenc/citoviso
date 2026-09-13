// A lead-lap megkeresés-sora AZT mondja, ami történt (Elek FK-004 Z3/Z4).
//
// ⛔ MIÉRT — három mért állítás ugyanarról a képernyőről:
//   Z3/a A sor „✓ E-mail elküldve"-t írt a CSATORNA-FÜGGETLEN `sent_at`-ból, amit a
//        MMS+SMS páros is beállít (sendOutreachPair) → egy mobil-only megkeresés olyan
//        levelet állított volna, ami soha nem ment ki. Mérve 2026-09-13: a parkban ma
//        0 ilyen sor van — LATENS hiba, ezért kell őr: a tünet hiánya nem védelem.
//   Z3/b A lap egyszerre mondta, hogy „még nem ment ki" és hogy 119 esemény történt a
//        linken. Mindkettő IGAZ, de együtt lead-érdeklődésnek látszik. Mérve: 5
//        sosem-küldött linkből 3-on volt forgalom, mind ugyanarról a Linux-desktop
//        böngészőről (saját megnyitás).
//   Z4   Küldés után a felület a teljes levél-szöveget és a másoló gombot változatlanul
//        kínálta — a megismétlést ugyanúgy, mint küldés előtt, jelzés nélkül.
//
// A fixture a TERMÉK forrásából épül (valós `getProspects()` sor, felülírt bélyegekkel):
// a `scripts/` nincs típus-ellenőrizve, ezért egy kézzel írt objektum némán hiányos lenne.
//
//   npx tsx scripts/outreach-row-truth-check.mts
//   npx tsx scripts/outreach-row-truth-check.mts --self-test   (pirosra KELL mennie)

import { db } from "../src/db/client.js";
import { getLead, getProspects, type ProspectView } from "../src/console/data.js";
import { leadPage, outreachDraftPage } from "../src/console/views.js";
import { buildDraftForProspect } from "../src/outreach/draft.js";
import { checkOutreachDraft } from "../src/outreach/outreachCheck.js";

const SELF_TEST = process.argv.includes("--self-test");

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) { console.log(`✓ ${what}`); return; }
  failed++;
  console.error(`✗ BUKÁS  ${what}${detail ? `\n     ↳ ${detail}` : ""}`);
};

/** A lead that really has tracked links — the guard must measure the shipped view. */
const lead = await db
  .selectFrom("prospect")
  .innerJoin("lead", "lead.id", "prospect.lead_id")
  .select(["lead.id as id", "lead.name as name"])
  .orderBy("prospect.created_at", "desc")
  .limit(1)
  .executeTakeFirst();
if (!lead) {
  console.error("⛔ nincs egyetlen prospect sem a parkban — az őr nem tud mérni");
  process.exit(1);
}
const real = await getProspects(lead.id);
say(real.length > 0, `van mérhető sor (${lead.name}: ${real.length} követett link)`);

const base = real[0]!;
const D = "2026-09-13T10:00:00.000Z";

/**
 * The four states the row must tell apart. ⛔ `...base` first, so every field the type
 * requires is really there — the fixture inherits the product's own shape.
 */
const CASES: ReadonlyArray<{ why: string; p: ProspectView; want: RegExp; deny?: RegExp }> = [
  {
    why: "csak MOBIL páros ment ki (sent_at igen, email NEM)",
    p: { ...base, sentAt: D, emailSentAt: null, smsSentAt: D, mmsSentAt: D, views: 0 },
    want: /Mobil \(MMS\+SMS\) elküldve/,
    deny: /E-mail elküldve/,
  },
  {
    why: "csak E-MAIL ment ki",
    p: { ...base, sentAt: D, emailSentAt: D, smsSentAt: null, mmsSentAt: null, views: 0 },
    want: /E-mail elküldve/,
    deny: /Mobil \(MMS\+SMS\) elküldve/,
  },
  {
    why: "FÉLBEMARADT páros (MMS ki, SMS nem) — nem teljesített mobil-megkeresés",
    p: { ...base, sentAt: D, emailSentAt: null, smsSentAt: null, mmsSentAt: D, views: 0 },
    want: /FÉLBEMARADT/,
    deny: /E-mail elküldve/,
  },
  {
    why: "semmi nem ment ki, de VAN forgalom a linken",
    p: { ...base, sentAt: null, emailSentAt: null, smsSentAt: null, mmsSentAt: null, views: 13, events: 119 },
    want: /NEM a megkeresés címzettjétől/,
    deny: /elküldve/,
  },
  {
    // ⚠️ KÜLÖNBSÉGI PRÓBA: a fenti szabályt a hazug-bélyeg önteszt NEM falszifikálja,
    // ezért itt bizonyítja, hogy az ADATTÓL függ — egy feltétel nélkülivé tett
    // figyelmeztetés (ami minden soron ott állna) ezen a soron megy pirosra.
    why: "semmi nem ment ki, és NINCS forgalom — ilyenkor NEM figyelmeztet",
    p: { ...base, sentAt: null, emailSentAt: null, smsSentAt: null, mmsSentAt: null, views: 0, events: 0 },
    want: /még egyik csatornán sem ment ki/,
    deny: /NEM a megkeresés címzettjétől/,
  },
];

const detail = await getLead(lead.id);
if (!detail) { console.error("⛔ nincs lead-részlet"); process.exit(1); }

for (const c of CASES) {
  // ⛔ SELF-TEST: the row is fed the OLD predicate — the channel-agnostic stamp as if it
  // proved a mail. Every rule that could have caught the reported defect must go red.
  const p: ProspectView = SELF_TEST
    ? { ...c.p, emailSentAt: c.p.sentAt, smsSentAt: null, mmsSentAt: null }
    : c.p;
  // A prospect-sorok a 6. pozicionális argumentumban élnek — a nézet ÍGY kapja őket.
  const html = leadPage(detail, { running: false }, null, [], [], [p]);
  say(c.want.test(html), `sor: ${c.why}`, `hiányzik a várt állítás: ${c.want}`);
  if (c.deny) {
    say(!c.deny.test(html), `  ↳ és NEM állít mást (${c.deny.source})`, "a sor olyat állít, ami nem történt meg");
  }
}

// ── Z4: a kimásolható levél küldés UTÁN megmondja, hogy az a második példány ──
const anyProspect = await db
  .selectFrom("prospect")
  .select(["id"])
  .orderBy("created_at", "desc")
  .limit(1)
  .executeTakeFirst();
const d = anyProspect ? await buildDraftForProspect(anyProspect.id) : null;
if (d) {
  const check = checkOutreachDraft(d.draft, d.input.leadName, d.lang, d.market);
  const render = (emailSentAt: string | null): string =>
    outreachDraftPage(anyProspect!.id, d.input, d.draft, check, "teszt@citoviso.com", null, {
      sms: { text: "x" }, phone: null, emailSentAt,
    }, d.leadId);
  const before = render(null);
  const after = render(SELF_TEST ? null : D); // self-test: a lap úgy tesz, mintha nem ment volna ki
  say(
    /MÁSODIK példányt jelentené/.test(after),
    "küldés UTÁN a másolható szöveg kimondja, hogy az a második példány",
    "a felület a megismétlést jelzés nélkül kínálja (FK-004 Z4)",
  );
  say(
    !/MÁSODIK példányt jelentené/.test(before),
    "  ↳ küldés ELŐTT viszont nem riogat (a kézi út a rendes fallback)",
  );
}

if (SELF_TEST) {
  if (failed === 0) {
    console.error("\n⛔ ÖNTESZT BUKOTT: a régi (csatorna-vak) viselkedést EGYETLEN szabály sem fogta meg.");
    process.exit(1);
  }
  console.log(`\n✅ ÖNTESZT: a régi viselkedést ${failed} mérés fogta meg (ennek kell pirosnak lennie).`);
  process.exit(0);
}
if (failed) {
  console.error(`\n⛔ ${failed} mérés bukott — a sor mást állít, mint ami történt.`);
  process.exit(1);
}
console.log("\n✅ outreach-row-truth-check: a sor a csatorna saját bélyegéből beszél, a sosem-küldött link forgalma meg van jelölve, és a kézi út küldés után szól.");
process.exit(0);
