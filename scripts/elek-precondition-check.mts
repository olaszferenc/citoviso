// ELŐFELTÉTEL-ŐR — bizonyítja, hogy a szűkített Elek-futás ELŐRE elkapja a hiányt.
//
// ⛔ A MÉRT LELET (2026-09-15, egy napon KÉTSZER). `run-all.mts FK-006a FK-006b` és
// `run-all.mts FK-001` is a lánc KÖZEPÉN állt meg (`⛔ nincs ELEK-TESZT tenant`), mert
// a `wanted()` szűrő kihagyta az FK-005a-t, a futó viszont megkövetelte annak termékét.
// Addigra a park-írások (lead-seed, követett link visszaállítása) MEGTÖRTÉNTEK — a
// közös parkon ~11 másik szál mér. A tünet késleltetett volt; a tény az első sorban
// eldönthető lett volna.
//
// EZ AZ ŐR NEM A PARKOT MÉRI. A `planRun()` TISZTA függvény: kért körök + mért
// park-tények → problémák. Ezért az öntesztje kitalált park-állapotokkal megy, nulla
// DB-írással és nulla AI-költséggel — a bejelentett esetet is beleértve.
//
// Három réteg:
//   ① VISELKEDÉS — a bejelentett eset PIROS, és a hozzá tartozó negatív kontrollok
//      (park már tudja · a termelő is kérve · teljes mátrix) ZÖLDEK. Az elvárásokat
//      kézzel írom le, nem a függvényből származtatom: egy őr, ami a vizsgált
//      függvénnyel számolja ki a helyes választ, a hibát is helyesnek mondaná.
//   ② ELAVULÁS — a lánc-tábla pontosan azokat a köröket tartalmazza, amiket a futó
//      TÉNYLEGESEN indít (a `run-all.mts` forrásából olvasva) és amikre forgatókönyv
//      létezik. Új kör → a tábla kötelezően követi, különben némán előfeltétel nélkül
//      maradna.
//   ③ ÜZENET — a hibaüzenet megnevezi a hiányzó tényt, a termelő kört ÉS a futtatható
//      parancsot. Egy előfeltétel-hiba, ami nem mondja meg, mit futtassak, ugyanolyan
//      zsákutca, mint a késleltetett tünet volt.
//
//   npx tsx scripts/elek-precondition-check.mts

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { CHAIN, FACTS, fixCommand, planRun, type ParkFacts } from "../src/elek/preconditions.js";
import { ELEK_EMAIL, ELEK_LEAD_NAME, elekProspectOf } from "../src/elek/park.js";

const ROOT = path.resolve(import.meta.dirname, "..");
let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const EMPTY: ParkFacts = { trackedLink: false, elekTenant: false, ownedLead: false };
const FULL_PARK: ParkFacts = { trackedLink: true, elekTenant: true, ownedLead: false };
const LINK_ONLY: ParkFacts = { trackedLink: true, elekTenant: false, ownedLead: false };
/** A MELEG park: a lead már vásárolt — a követett lap „már az Öné" (mérve 2026-09-27). */
const WARM_PARK: ParkFacts = { trackedLink: true, elekTenant: true, ownedLead: true };

// ═══ ① VISELKEDÉS ═════════════════════════════════════════════════════════════
console.log("\n① VISELKEDÉS — a bejelentett eset és a negatív kontrolljai");

// A BEJELENTETT ESET, szó szerint: üres parkban FK-006a+FK-006b, FK-005a nélkül.
{
  const p = planRun(["FK-006a", "FK-006b"], LINK_ONLY);
  check("a bejelentett eset PIROS (FK-006a/b üres tenant mellett)", p.problems.length === 1);
  const prob = p.problems[0];
  check("a hiányzó tényt NEVÉN nevezi", prob?.fact === "elekTenant", prob?.fact);
  check(
    "MINDKÉT blokkolt kört felsorolja (nem csak az elsőt)",
    prob?.blockedFks.join(",") === "FK-006a,FK-006b",
    prob?.blockedFks,
  );
  check(
    "a javító parancs tartalmazza a termelő kört, a lánc sorrendjében",
    fixCommand(["FK-006a", "FK-006b"], p.problems) === "npx tsx elek/bin/run-all.mts FK-005a FK-006a FK-006b",
    fixCommand(["FK-006a", "FK-006b"], p.problems),
  );
}

// A MÁSIK mért eset ugyanaznap: FK-001 önmagában (orchestrator-szál).
check("a második mért eset is PIROS (FK-001 önmagában)", planRun(["FK-001"], LINK_ONLY).problems.length === 1);

// ⛔ NEGATÍV KONTROLLOK — egy túlbuzgó őr ugyanúgy használhatatlan, mint egy vak.
check(
  "NEM piros, ha a park MÁR TUDJA a tényt (bárki állította elő)",
  planRun(["FK-006a", "FK-006b"], FULL_PARK).problems.length === 0,
);
check(
  "NEM piros, ha a termelő kört IS kérték",
  planRun(["FK-005a", "FK-006a", "FK-006b"], LINK_ONLY).problems.length === 0,
);
check("NEM piros a TELJES mátrix üres parkon (a lánc mindent előállít)", planRun([], EMPTY).problems.length === 0);
check(
  "NEM piros az önálló kör, ami semmit nem igényel",
  planRun(["FK-000", "FK-003", "FK-003b"], EMPTY).problems.length === 0,
);
// A követett link a lánc MÁSIK fele — ha csak a tenantra figyelnénk, ez átcsúszna.
{
  const p = planRun(["FK-005a"], EMPTY);
  check("a KÖVETETT LINK hiányát is elkapja (nem csak a tenantét)", p.problems[0]?.fact === "trackedLink", p.problems);
}
// Elgépelt név némán NULLA kört futtatna, és a futás zölden zárna.
check("az ismeretlen FK-nevet külön jelenti", planRun(["FK-006x"], FULL_PARK).unknown.join() === "FK-006x");
check("az ismeretlen névre nem marad futtatható kör", planRun(["FK-006x"], FULL_PARK).rounds.length === 0);

// ⛔ A MELEG PARK (2026-09-27): az FK-008b a vásárlás ELŐTTI lapot méri, és a parkban már
// ott a vásárlás — az első lépés pirosra ment, hat lépés blokkolt, a futó pedig „minden
// előfeltétel megvan"-t mondott. A többlet-tény ugyanúgy előre eldönthető, mint a hiány.
{
  const p = planRun(["FK-004", "FK-008b"], WARM_PARK);
  check("a meleg park PIROS az FK-008b-re (a lead már vásárolt)", p.problems.length === 1 && p.problems[0]!.reason === "obsolete");
  check("a többlet-tényt NEVÉN nevezi", p.problems[0]?.fact === "ownedLead", p.problems[0]?.fact);
  check("csak az érintett kört blokkolja (az FK-004 mehet)", p.problems[0]?.blockedFks.join() === "FK-008b", p.problems[0]?.blockedFks);
  check("a javító parancs NEM kér termelő kört a meleg parkra (nincs ilyen)", fixCommand(["FK-004", "FK-008b"], p.problems) === "npx tsx elek/bin/run-all.mts FK-004 FK-008b");
  check("NEM piros ugyanez a kérés hideg parkon (a link megvan, vásárlás nincs)", planRun(["FK-004", "FK-008b"], LINK_ONLY).problems.length === 0);
  check("a teljes mátrix is szól a meleg parkon (az FK-008b ott is a vásárlás előtt mér)", planRun([], WARM_PARK).problems.some((x) => x.reason === "obsolete" && x.blockedFks.includes("FK-008b")));
}

// A KIHAGYÁS KIMONDÁSA — ez a tulajdonosi kérés ① pontja.
{
  const p = planRun(["FK-006a", "FK-006b"], FULL_PARK);
  check("a szűkítés felsorolja a kihagyott köröket", p.skipped.length === CHAIN.length - 2, p.skipped.length);
  const named = p.skipped.filter((s) => s.produces);
  // két tény is ugyanattól a körtől (FK-005a) származhat — a kihagyás-lista körönként egy sor
  const producers = new Set(Object.values(FACTS).map((s) => s.producer));
  check(
    "és megmondja, melyik kihagyott kör MIT állítana elő",
    named.length === producers.size && named.every((s) => (s.produces ?? "").length > 10),
    named,
  );
  check("teljes mátrixnál nincs kihagyás-lista (nincs mit kimondani)", planRun([], EMPTY).skipped.length === 0);
}

// A sorrend-szabály: a termelő nem állhat a fogyasztója MÖGÖTT.
{
  const idx = new Map(CHAIN.map((r, i) => [r.fk, i]));
  const bad = CHAIN.flatMap((r) =>
    r.needs
      .filter((f) => idx.get(FACTS[f].producer)! >= idx.get(r.fk)!)
      .map((f) => `${r.fk} ← ${FACTS[f].producer}`),
  );
  check("a láncban minden termelő a fogyasztója ELŐTT áll", bad.length === 0, bad);
}

// ═══ ② ELAVULÁS ═══════════════════════════════════════════════════════════════
console.log("\n② ELAVULÁS — a tábla a futó és a forgatókönyvek MÉRT halmazát fedi");

// A futó SAJÁT forrásából: melyik köröket indítja. Csak azokat a sorokat nézzük, amik
// TÉNYLEGESEN indítanak/kapuznak — a fejléc-kommentek is említenek FK-neveket, és egy
// nyers fájl-grep a saját magyarázatunkat mérné (ugyanaz a csapda, mint a KB-őrnél).
const runnerSrc = readFileSync(path.join(ROOT, "elek/bin/run-all.mts"), "utf8");
const dispatched = new Set<string>();
for (const line of runnerSrc.split("\n")) {
  if (line.trimStart().startsWith("//")) continue;
  if (!/\brunFk\(|\bwanted\(/.test(line)) continue;
  for (const m of line.matchAll(/"(FK-[0-9a-z]+)"/g)) dispatched.add(m[1]!);
}
const chainFks = new Set(CHAIN.map((r) => r.fk));
check("a futó tényleg indít köröket (nem üres a mérés)", dispatched.size >= 10, dispatched.size);
check(
  "minden INDÍTOTT kör benne van a lánc-táblában",
  [...dispatched].every((fk) => chainFks.has(fk)),
  [...dispatched].filter((fk) => !chainFks.has(fk)),
);
check(
  "a tábla nem tartalmaz olyan kört, amit a futó nem indít",
  [...chainFks].every((fk) => dispatched.has(fk)),
  [...chainFks].filter((fk) => !dispatched.has(fk)),
);

// A forgatókönyv-fájlok halmaza: egy ÚJ FK-fájl kötelezően belép a táblába, különben
// némán előfeltétel nélkül maradna (a doktrína hatóköre a fájllista).
const scenarioFks = readdirSync(path.join(ROOT, "elek/scenarios"))
  .filter((f) => /^FK-[0-9a-z]+-.*\.md$/.test(f))
  .map((f) => /^(FK-[0-9a-z]+)-/.exec(f)![1]!);
check("vannak forgatókönyv-fájlok (nem üres a mérés)", scenarioFks.length >= 10, scenarioFks.length);
check(
  "minden forgatókönyvhöz van lánc-bejegyzés",
  scenarioFks.every((fk) => chainFks.has(fk)),
  scenarioFks.filter((fk) => !chainFks.has(fk)),
);

// ⛔ A LEVEZETÉS, AMI NÉMÁN HIÁNYOS LETT VOLNA — kimondva, hogy ne próbáljuk újra.
// Az `${ELEK_*}` hivatkozásokból származtatott tábla szerkezetinek LÁTSZIK, de az
// FK-006a/b és az FK-007 egyetlen ilyet sem tartalmaz, pedig tenantra mérnek.
{
  const envNeedy = new Set<string>();
  for (const f of readdirSync(path.join(ROOT, "elek/scenarios")).filter((f) => f.endsWith(".md"))) {
    const src = readFileSync(path.join(ROOT, "elek/scenarios", f), "utf8");
    if (/\$\{ELEK_[A-Z_]+\}/.test(src)) envNeedy.add(/^(FK-[0-9a-z]+)-/.exec(f)![1]!);
  }
  const needy = CHAIN.filter((r) => r.needs.length).map((r) => r.fk);
  const invisible = needy.filter((fk) => !envNeedy.has(fk));
  check(
    "a tábla TÖBBET tud, mint az env-hivatkozás — van kör, ami ELEK_* nélkül is függ",
    invisible.length >= 3,
    invisible,
  );
}

// ═══ ③ ÜZENET ═════════════════════════════════════════════════════════════════
console.log("\n③ ÜZENET — megnevezi a tényt, a termelőt és a futtatható parancsot");
for (const [key, spec] of Object.entries(FACTS)) {
  check(`${key}: van emberi neve`, spec.label.length > 5, spec.label);
  check(`${key}: megnevezi a termelő kört`, chainFks.has(spec.producer), spec.producer);
  check(`${key}: megmondja, mit állít elő`, spec.produces.length > 15, spec.produces);
}
{
  const cmd = fixCommand(["FK-001"], planRun(["FK-001"], LINK_ONLY).problems);
  check("a javító parancs futtatható alakú", /^npx tsx elek\/bin\/run-all\.mts( FK-[0-9a-z]+)+$/.test(cmd), cmd);
  check("a javító parancs nem dobja el a KÉRT kört", cmd.includes("FK-001"), cmd);
}

// ═══ ④ A PARK LINKJE A LEADÉ ═══════════════════════════════════════════════
// ⛔ Mérve 2026-09-27: a futó az ELEK-prospectet E-MAIL alapján oldotta fel (a legfrissebb
// elek@ sor), és a FK-009 seed 38 idegen (Tihany/Laguna) linkje UGYANEZT a címet viseli
// (küldés-biztonság) → az FK-008b a Laguna Panzió mockját kapta, a visszaállítás 39 sort
// írt. A cím BIZTONSÁGI tulajdonság (hova mehet levél), nem AZONOSSÁG (kié a link). A
// választás tiszta függvény (src/elek/park.ts) — itt fixtúrán, negatív kontrollal.
console.log("\n④ A PARK LINKJE A LEADÉ — az e-mail nem azonosít, a lead_id igen");
{
  const ELEK = "lead-elek", FOREIGN = "lead-laguna";
  const older = { id: "p-elek", lead_id: ELEK, contact_email: ELEK_EMAIL, created_at: "2026-09-14T09:09:10Z" };
  const newerForeign = { id: "p-laguna", lead_id: FOREIGN, contact_email: ELEK_EMAIL, created_at: "2026-09-26T07:36:40Z" };
  const newerForeign2 = { id: "p-tihany", lead_id: "lead-tihany", contact_email: ELEK_EMAIL, created_at: "2026-09-26T07:36:41Z" };
  // A BEJELENTETT ESET: az idegen sor ÚJABB és elek@ — mégsem az.
  check("a bejelentett eset: az újabb IDEGEN elek@ sor NEM a park linkje", elekProspectOf([older, newerForeign, newerForeign2], ELEK)?.id === "p-elek");
  check("elek@ cím idegen leaden, ELEK-sor nélkül → NINCS link (a tény hamis)", elekProspectOf([newerForeign, newerForeign2], ELEK) === null);
  // Pozitív kontroll: az ELEK-lead több linkje közül a legfrissebb.
  const newerElek = { id: "p-elek-2", lead_id: ELEK, contact_email: ELEK_EMAIL, created_at: "2026-09-27T10:00:00Z" };
  check("az ELEK-lead több linkje közül a LEGFRISSEBB nyer", elekProspectOf([older, newerForeign, newerElek], ELEK)?.id === "p-elek-2");
  // A cím nem feltétel: az ELEK-lead sora más címmel is az övé (a seed elek@-ra ír, de a szabály nem erre épül).
  const otherMail = { id: "p-elek-3", lead_id: ELEK, contact_email: "x@example.com", created_at: "2026-09-28T10:00:00Z" };
  check("a választás nem a címen áll: az ELEK-lead sora más címmel is az övé", elekProspectOf([older, otherMail], ELEK)?.id === "p-elek-3");
  check("lead nélkül (a seed még nem futott) → null, nem az elek@ sor", elekProspectOf([newerForeign], null) === null);
  check("a lead neve egy helyen él, és a seed nevét viseli", ELEK_LEAD_NAME === "ELEK-TESZT Vendégház");
}
// A futó forrása: minden prospect-kérdés a leaden át megy — egy visszacsúszó
// `.where("contact_email", "=", …)` a prospect táblán ugyanezt a hibát hozná vissza.
{
  const live = runnerSrc.split("\n").filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"));
  const emailFilters = live.filter((l) => /\.where\("contact_email"/.test(l));
  check("a futó egyetlen prospect-kérdést sem old fel e-mail alapján", emailFilters.length === 0, emailFilters);
  check("a futó a park-modul feloldóját használja", /elekProspectOf\(/.test(runnerSrc) && /ELEK_LEAD_NAME/.test(runnerSrc));
}

console.log("");
if (failures) {
  console.error(`⛔ elek-precondition-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("✅ elek-precondition-check: a szűkített futás előre elkapja a hiányzó előfeltételt.");
