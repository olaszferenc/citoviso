// A lead-sáv MOCK-JELÖLÉSÉNEK őre: a felirat MINDKÉT kérdésre feleljen.
//
// ⛔ MIÉRT (mérve 2026-09-12, Elek FK-004): a sáv a LEGUTÓBBI mock állapotát mondta
// („mock: generated"), miközben a leadnek VOLT jóváhagyott mockja, és a megkeresés
// kiküldhető lett volna. A jelölés tehát más kérdésre válaszolt, mint amit az operátor
// (és a küldés-út) feltesz — a forgatókönyv emiatt bukott el egy ÉP terméken.
//
// Hermetikus: NINCS DB és NINCS szerver — a nézetfüggvényt közvetlenül rendereljük két
// szintetikus állapottal. Így a park (amit párhuzamos szálak is használnak) érintetlen,
// és az állítás pontosan arról szól, amit a kód a két állapotban ÍR.
//
//   npx tsx scripts/mock-state-label-check.mts
//   npx tsx scripts/mock-state-label-check.mts --self-test   (piros önteszt)

process.env.CIT_SHOT = "1";

import { leadPage } from "../src/console/views.js";
import type { LeadDetail } from "../src/console/data.js";

const SELF_TEST = process.argv.includes("--self-test");
let bad = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) bad++;
};

type Artifact = LeadDetail["artifacts"][number];
const artifact = (id: string, status: string, iso: string): Artifact =>
  ({
    id,
    status,
    generatedAt: iso, // a nézet sztringként kezeli (slice) — a fixture a VALÓS alakot adja
    path: `/tmp/${id}.html`,
    inputs: {},
    decisions: [],
  }) as unknown as Artifact;

/** Ugyanaz a lead, csak MÁS mock-készlettel — a két rendernek ezen kell szétválnia. */
const lead = (artifacts: Artifact[]): LeadDetail =>
  ({
    id: "11111111-2222-3333-4444-555555555555",
    name: "Őr-teszt Vendégház",
    qualification: null,
    lifecycle: "new",
    matchConfidence: 0.9,
    address: "Teszt utca 1.",
    region: "teszt",
    raw: {},
    provenance: [],
    artifacts,
    heroScores: {},
  }) as unknown as LeadDetail;

const NEW = "2026-09-12T09:00:00.000Z";
const OLD = "2026-09-11T06:00:00.000Z";

// ── ① SZÉTVÁLÓ állapot: a legutóbbi generált, de VAN jóváhagyott ────────────────
const divergent = leadPage(lead([artifact("a-new", "generated", NEW), artifact("a-old", "approved", OLD)]));
ok("① a sáv a LEGUTÓBBI állapotot mondja (mock: generated)", /data-cit-mockstate="generated"/.test(divergent));
ok("① és KIMONDJA, hogy van jóváhagyott mock", /data-cit-approved-exists="1"/.test(divergent));
ok("① a jelölés olvasható szöveget visel", /van jóváhagyott mock/.test(divergent));
// ⚠️ A generálás-közbeni forgatókönyv a „mock: approved" NEM-láthatóságát méri —
// az új jelölés nem írhatja felül ezt az állítást.
ok(
  "① a felirat NEM tartalmazza a „mock: approved\" alakot (az Elek-állítás érintetlen)",
  !/mock: approved/.test(divergent),
);

// ── ② EGYBEESŐ állapot: a legutóbbi maga a jóváhagyott ─────────────────────────
const convergent = leadPage(lead([artifact("a-new", "approved", NEW), artifact("a-old", "rejected", OLD)]));
ok("② a sáv a jóváhagyottat mondja", /data-cit-mockstate="approved"/.test(convergent));
ok(
  "② és NEM ismétli meg külön jelöléssel (nincs felesleges zaj)",
  !/data-cit-approved-exists/.test(convergent),
);

// ── ③ NINCS jóváhagyott: a jelölés nem állíthat olyat, ami nincs ───────────────
const none = leadPage(lead([artifact("a-new", "generated", NEW), artifact("a-old", "rejected", OLD)]));
ok("③ jóváhagyott nélkül nincs jelölés", !/data-cit-approved-exists/.test(none));
ok("③ a sáv ilyenkor is a legutóbbit mondja", /data-cit-mockstate="generated"/.test(none));

// ── A FIXTURE BIZONYÍTJA A SAJÁT ÚTJÁT ─────────────────────────────────────────
// Ha a három render azonos lenne (elgépelt mező, nem a vizsgált ágra futó adat),
// minden fenti állítás „zölden" mérne egy ÉS UGYANAZT a lapot.
ok("a három állapot TÉNYLEG három különböző lapot rendere", divergent !== convergent && convergent !== none);

if (SELF_TEST) {
  console.log("\n⚑ ÖNTESZT — a romlott viselkedést megfogná-e?");
  // A romlás, amit meg kell fognia: a jelölés eltűnik a szétváló állapotban (a régi kód).
  const brokenLike = divergent.replace(/<span class="pill approved" data-cit-approved-exists="1">[^<]*<\/span>/, "");
  ok("① állítása pirosra vált a régi (jelölés nélküli) kimeneten", !/data-cit-approved-exists="1"/.test(brokenLike));
  // És a fordítottja: ha a jelölés MINDIG kiírná magát, a ② állítás bukna.
  const alwaysOn = convergent.replace(
    /data-cit-mockstate="approved"/,
    'data-cit-mockstate="approved"><span data-cit-approved-exists="1"',
  );
  ok("② állítása pirosra vált, ha a jelölés feleslegesen is kiírja magát", /data-cit-approved-exists/.test(alwaysOn));
}

console.log(
  bad === 0
    ? "\n✅ A mock-jelölés mindkét kérdésre felel: mi a legutóbbi, és van-e jóváhagyott."
    : `\n⛔ ${bad} eltérés.`,
);
process.exit(bad === 0 ? 0 : 1);
