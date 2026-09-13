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

// ── Z5: NYERS ADATBÁZIS-ÉRTÉK nem kerülhet a kirenderelt lapra ───────────────
//
// ⛔ A piszkozat-lap címe a `nincs_honlap` nyers id-t írta ki, miközben UGYANAZON a
// képernyőn a választó már „nincs honlap"-ot mutatott; a lead-sor pedig az angol
// `sent`/`order_intent` státuszt viselte magyar szöveg mellett. Ez SZERKEZETI mérés,
// nem szólista: a felület látható szövegében alsó vonásos, csupa kisbetűs token
// gyakorlatilag csak leakadt enum lehet. (A NAGYBETŰS env-nevek — LEGAL_ENTITY_* —
// szándékosan ott vannak a feladó-azonosítás dobozában, azokat nem bántjuk.)
const RAW_ENUM = /(?:^|[\s>„"'(])([a-z][a-z0-9]*(?:_[a-z0-9]+)+)(?=[\s<.,;:!?)"'”]|$)/g;
const stripTags = (html: string): string =>
  html.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ");

for (const c of CASES.slice(0, 2)) {
  const p: ProspectView = SELF_TEST ? { ...c.p, segment: "nincs_honlap", status: "order_intent" } : c.p;
  const html = leadPage(detail, { running: false }, null, [], [], [p]);
  const raw = [...stripTags(html).matchAll(RAW_ENUM)].map((m) => m[1]);
  say(
    raw.length === 0,
    `nincs nyers adatbázis-érték a lead-lap látható szövegében (${c.why})`,
    `talált: ${[...new Set(raw)].join(", ")}`,
  );
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

// ── Z6/Z7: a tiltott gomb megmondja a kiutat; a kiment cím nem szerkeszthető ──
if (d) {
  const check2 = checkOutreachDraft(d.draft, d.input.leadName, d.lang, d.market);
  const page = (emailSentAt: string | null, phone: string | null): string =>
    outreachDraftPage("p1", d.input, d.draft, { ...check2, verdict: "PASS", reasons: [] },
      "teszt@citoviso.com", null,
      { sms: { text: "x" }, phone, emailSentAt, mmsPreview: { kind: "ready", url: "/x.jpg" } } as never,
      d.leadId, { sendable: true, reason: null, gateBlocked: false });

  // Z6 — szám nélkül: a gomb TILTOTT, és a lap megmondja, hol lehet pótolni.
  const noPhone = SELF_TEST ? page(null, "+36301112233") : page(null, null);
  const pairBtn = /<form[^>]*send-pair[\s\S]*?<\/form>/.exec(noPhone)?.[0] ?? "";
  say(/\bdisabled\b/.test(pairBtn), "Z6: szám nélkül a páros-gomb tiltott", "élő gomb a saját előfeltétele nélkül");
  say(
    /Begyűjtött adatok/.test(noPhone) && /lead\//.test(noPhone),
    "Z6: a lap megmondja, HOL lehet számot pótolni",
    "a hiányt kimondja, a kiutat nem",
  );

  // Z7 — kiküldés után a cím-mező nem szerkeszthető űrlap többé.
  const after = page(SELF_TEST ? null : D, "+36301112233");
  say(!/contact-email/.test(after), "Z7: küldés után nincs cím-szerkesztő űrlap", "a kiment levél címe szerkeszthetőnek látszik");
  say(/erre a címre ment ki/.test(after), "  ↳ de a cím OLVASHATÓAN ott marad");
  const before = page(null, "+36301112233");
  say(/contact-email/.test(before), "  ↳ küldés ELŐTT viszont szerkeszthető (a cím pótlása a rendes út)");
}

if (SELF_TEST) {
  // ⚠️ A nyers-enum szabályt a fenti hazugság NEM falszifikálja: az ADATOT rontja el, a
  // mérés viszont a NÉZET-ről szól (átvezeti-e a feliraton). Ezért a detektort a
  // 2026-09-13-án TÉNYLEGESEN KIMENT markupon bizonyítjuk — különben zöld sor lenne,
  // ami sosem mérhetett semmit.
  const SHIPPED = `<span class="pill">created</span> <span class="pill">nincs_honlap</span>
     <td class="small mut">google_places</td><td>places_match</td>`;
  const seen = [...stripTags(SHIPPED).matchAll(RAW_ENUM)].map((m) => m[1]);
  if (!seen.includes("nincs_honlap") || !seen.includes("google_places")) {
    console.error("\n⛔ ÖNTESZT BUKOTT: a nyers-enum detektor a KIMENT markupot sem látja meg.");
    process.exit(1);
  }
  console.log(`✓ ÖNTESZT: a nyers-enum detektor a kiment markupon ${seen.length} értéket lát (${[...new Set(seen)].join(", ")})`);
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
