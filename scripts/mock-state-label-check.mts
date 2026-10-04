// A lead-sáv MOCK-JELÖLÉSÉNEK őre: a pirula a LEGERŐSEBB mock-állapotot írja — ugyanazt,
// amit a lead-lista MOCK cellája —, és a jóváhagyott mock ténye sosem tűnik el.
//
// ⛔ MIÉRT (mérve 2026-09-12, Elek FK-004): a sáv a LEGUTÓBBI mock állapotát mondta
// („mock: generated"), miközben a leadnek VOLT jóváhagyott mockja, és a megkeresés
// kiküldhető lett volna. Akkor egy külön „van jóváhagyott mock” jelölés került mellé.
// ⛔ MIÉRT (tulaj, 2026-10-04, Boróka ház): a lista már a LEGERŐSEBB állapotot írta
// (1 jóváhagyott + 2 újabb elutasított → „jóváhagyva”), a lap viszont még a legutóbbit
// („elutasítva”) — ugyanaz a lead két képernyőn két igazsággal. Most a lap pirulája és a
// lista cellája EGY függvényből (`summariseMocks`) jön; ez az őr az egyezést méri.
//
// Hermetikus: NINCS DB és NINCS szerver — a nézetfüggvényeket közvetlenül rendereljük
// szintetikus állapotokkal. Így a park (amit párhuzamos szálak is használnak) érintetlen.
//
//   npx tsx scripts/mock-state-label-check.mts
//   npx tsx scripts/mock-state-label-check.mts --self-test   (piros önteszt)

process.env.CIT_SHOT = "1";

import { leadPage } from "../src/console/views.js";
import { LEAD_COLUMNS, mockStatusLabel, summariseMocks } from "../src/console/leadFilters.js";
import type { LeadDetail, LeadListRow } from "../src/console/data.js";

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

/** Ugyanaz a lead, csak MÁS mock-készlettel — a rendereknek ezen kell szétválniuk. */
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

const T3 = "2026-09-12T09:02:00.000Z";
const T2 = "2026-09-12T09:01:00.000Z";
const T1 = "2026-09-11T06:00:00.000Z";

const stateOf = (html: string): string | null => /data-cit-mockstate="([^"]+)"/.exec(html)?.[1] ?? null;

/** What the LEAD-LIST MOCK cell says for the same artifacts — through the list's own path:
 *  `summariseMocks` (as `listLeadPage` builds the row) → the column's `cell`. */
const listCellOf = (artifacts: Artifact[]): string => {
  const sum = summariseMocks(artifacts);
  const row = { mockArtifact: sum ? { ...sum.shown, byStatus: sum.byStatus } : null } as unknown as LeadListRow;
  return String(LEAD_COLUMNS.mock.cell(row));
};

const approvedPhrase = `mock: ${mockStatusLabel("approved", "hu")}`;

// ── ① A legutóbbi generált, de VAN jóváhagyott → a pirula „jóváhagyva” ────────────
const genOverApproved = [artifact("a3", "generated", T3), artifact("a1", "approved", T1)];
const divergent = leadPage(lead(genOverApproved));
ok("① a sáv a LEGERŐSEBB állapotot mondja (approved), nem a legutóbbit", stateOf(divergent) === "approved");
ok(`① a felirat „${approvedPhrase}”`, divergent.includes(approvedPhrase));
ok("① a külön „van jóváhagyott mock” jelölés NEM ismétli meg (a pirula már kimondja)", !/data-cit-approved-shown/.test(divergent));
ok("① a többi mock a title-ben áll („2 mockból: …”)", /title="2 mockból: 1 jóváhagyva, 1 legenerálva"/.test(divergent));

// ── ② Boróka ház: 1 jóváhagyott + 2 ÚJABB elutasított → „jóváhagyva” ─────────────
const boroka = [artifact("b3", "rejected", T3), artifact("b2", "rejected", T2), artifact("b1", "approved", T1)];
const borokaPage = leadPage(lead(boroka));
ok("② Boróka ház: a sáv „jóváhagyva”, nem „elutasítva”", stateOf(borokaPage) === "approved");

// ── ③ NINCS jóváhagyott: a döntésre váró nyer az elutasított felett ────────────────
const genOverRejected = [artifact("c2", "rejected", T3), artifact("c1", "generated", T1)];
const none = leadPage(lead(genOverRejected));
ok("③ jóváhagyott nélkül nincs jelölés", !/data-cit-approved-shown/.test(none));
ok("③ a döntésre váró (generated) nyer az újabb elutasított felett", stateOf(none) === "generated");
ok(`③ a felirat NEM tartalmazza a „${approvedPhrase}” alakot`, !none.includes(approvedPhrase));

// ── ④ FUTÓ generálás jóváhagyott mellett: a pirula „fut”, a tény külön jelölésben ──
// Az Elek FK-003b azt méri, hogy futás közben NINCS approved a fejlécben; a jóváhagyott
// mock ténye ilyenkor a külön jelölésben marad látható (a megkeresés attól mehet ki).
const running = leadPage(lead(genOverApproved), { running: true } as Parameters<typeof leadPage>[1]);
ok("④ futás közben a pirula „running”", stateOf(running) === "running");
ok("④ futás közben NINCS approved mockstate", !/data-cit-mockstate="approved"/.test(running));
ok("④ …de a „van jóváhagyott mock” jelölés kimondja a tényt", /data-cit-approved-shown="1"[^>]*>van jóváhagyott mock/.test(running));

// ── ⑤ LISTA = LAP: ugyanannál a leadnél ugyanazt írják ────────────────────────────
const cases: [string, Artifact[]][] = [
  ["① generált a jóváhagyott fölött", genOverApproved],
  ["② Boróka ház", boroka],
  ["③ elutasított a generált fölött", genOverRejected],
  ["egyetlen elutasított", [artifact("d1", "rejected", T1)]],
];
for (const [name, arts] of cases) {
  const page = stateOf(leadPage(lead(arts)));
  const list = listCellOf(arts);
  ok(`⑤ ${name}: lista „${list}” = lap „${page}”`, page === list);
}
ok("⑤ mock nélkül: lista „none” = lap „none”", listCellOf([]) === "none" && stateOf(leadPage(lead([]))) === "none");

// ── A GÉPI TÉNY-HORGONY: park-zajtól független, mindig ott van ─────────────────
ok("a tény-horgony jóváhagyottat jelez (①)", /data-cit-approved="1"/.test(divergent));
ok("a tény-horgony jóváhagyottat jelez (②)", /data-cit-approved="1"/.test(borokaPage));
ok("a tény-horgony jóváhagyott nélkül 0-t jelez (③)", /data-cit-approved="0"/.test(none));

// ── A FIXTURE BIZONYÍTJA A SAJÁT ÚTJÁT ─────────────────────────────────────────
ok("a különböző állapotok TÉNYLEG különböző lapot renderelnek", divergent !== none && divergent !== running);

if (SELF_TEST) {
  console.log("\n⚑ ÖNTESZT — a romlott viselkedést megfogná-e?");
  // Negatív kontroll: a RÉGI szabály (a legutóbbi mock állapota) Borókánál eltér a listától.
  const newestState = boroka[0]!.status;
  ok("⑤ a régi „legutóbbi” szabály a Boróka-esetben ELTÉRNE a listától", newestState !== listCellOf(boroka));
  // Ha a lap a legutóbbit írná, az ② állítás bukna.
  const borokaBroken = borokaPage.replace(/data-cit-mockstate="approved"/, 'data-cit-mockstate="rejected"');
  ok("② állítása pirosra vált a régi (legutóbbi-állapotú) kimeneten", stateOf(borokaBroken) !== "approved");
  // Ha a futás alatti jelölés eltűnne, a ④ bukna.
  const runningBroken = running.replace(/<span class="pill approved" data-cit-approved-shown="1">[^<]*<\/span>/, "");
  ok("④ állítása pirosra vált jelölés nélkül", !/data-cit-approved-shown="1"/.test(runningBroken));
}

console.log(
  bad === 0
    ? "\n✅ A lap mock-pirulája a legerősebb állapotot írja, a listával egyezően; a jóváhagyott mock ténye sosem tűnik el."
    : `\n⛔ ${bad} eltérés.`,
);
process.exit(bad === 0 ? 0 : 1);
