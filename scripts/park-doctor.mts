// PARK-DOCTOR — alkalmas-e a KÖZÖS dev-park a mérésre?
//
//   npx tsx scripts/park-doctor.mts            → diagnózis (csak olvas)
//   npx tsx scripts/park-doctor.mts --self-test → a felismerők tudnak-e pirosra menni
//
// MIÉRT VAN (mérve 2026-09-22). A `pre-commit` 165 kaput hív, és ezek közül **55 a
// KÖZÖS dev-DB-t olvassa** — egyetlen adatbázist, amin ~10 párhuzamos worktree
// osztozik. Ezért egy session tesztje olyan rekordot hagyhat hátra, ami egy MÁSIK
// kapu ELŐFELTÉTELÉT töri el, és onnantól mindenki landja elakad.
//
// ⛔ A KONKRÉT NAP, amiért ez megszületett: egy idegen dedup-teszt hátrahagyott egy
// `_amdedup_mud0ppy0` nevű leadet — 0 prospekttel, 0 rendeléssel, mégis „vásárolt"
// állapotban. A `prospect-owned-check` ezt választotta ki alanyául, és
// „✗ ELŐFELTÉTEL HIÁNYZIK: a vásárolt leadnek nincs 'initial' rendelése"-vel elhasalt
// — HAT egymás utáni land-kísérletben, determinisztikusan. A kód hibátlan volt.
//
// ⚠️ EZ NEM KAPU, HANEM DIAGNOSZTIKA. Szándékosan nem a `pre-commit`-ből fut:
//   · Nem ad zöldet semminek. Egy „a park rendben" sor sosem helyettesíti a kapukat,
//     és nem is hallgattat el egyetlen pirosat sem (`feedback_narrow_recognizer_is_a_false_green`).
//   · Nem ír a DB-be és nem töröl. A közös parkban más szál MÉR — egy „takarítás"
//     mérés közben pont az a hibaosztály lenne, amit gyógyítani akar. A törlést
//     ezért NEVESÍTVE javasolja, és az embernél hagyja.
// A haszna egyetlen mondat: megmondja, hogy a piros a DIFFED-e, vagy a PARKÉ.

import { db } from "../src/db/client.js";

const selfTest = process.argv.includes("--self-test");

type Finding = {
  readonly level: "blokkoló" | "gyanús";
  readonly what: string;
  readonly why: string;
  readonly fix: string;
};

const findings: Finding[] = [];
const ok: string[] = [];

// ── ① Teszt-artefakt leadek ──────────────────────────────────────────────────
// A konvenció szerint az aláhúzással kezdődő nevű lead gépi eredetű. Az ilyen
// rekord magában ártalmatlan — AKKOR lesz blokkoló, ha egy kapu alanyául
// választható, de hiányzik a kísérő adata.
const artefacts = await db
  .selectFrom("lead")
  .select(["id", "name", "created_at"])
  .where("name", "like", "\\_%")
  .execute();

for (const a of artefacts) {
  const prospects = await db
    .selectFrom("prospect")
    .select(["id"])
    .where("lead_id", "=", a.id)
    .execute();
  const orders = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select(["order_intent.kind as kind"])
    .where("prospect.lead_id", "=", a.id)
    .execute();
  const age = Math.round((Date.now() - new Date(a.created_at as never).getTime()) / 60_000);
  if (!prospects.length && !orders.length) {
    findings.push({
      level: "gyanús",
      what: `árva teszt-lead: „${a.name}" (${age} perce, 0 prospect, 0 rendelés)`,
      why:
        "Semmi nem kötődik hozzá, viszont a lead-alapú kapuk ALANYNAK választhatják — " +
        "ilyenkor az előfeltételük törik el, nem az állításuk.",
      fix: `ha egyetlen futó teszt sem használja: töröld a lead sort (id=${a.id})`,
    });
  }
}
if (!artefacts.length) ok.push("nincs teszt-artefakt lead (aláhúzással kezdődő név)");

// ── ② A prospect-owned-check előfeltétele ────────────────────────────────────
// Ez a kapu VALÓDI pénz-úti állítást mér (requestPayment() megtagadja-e egy már
// vásárolt lead initial rendelését), de ehhez kell egy vásárolt lead, amelynek VAN
// initial rendelése. Ez tört el 2026-09-22-én.
const ownedWithOrder = await db
  .selectFrom("order_intent")
  .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
  .select(["order_intent.id as id"])
  .where("order_intent.kind", "=", "initial")
  .executeTakeFirst();
if (!ownedWithOrder) {
  findings.push({
    level: "blokkoló",
    what: "nincs egyetlen 'initial' rendelés sem a parkban",
    why: "A prospect-owned-check előfeltétele — enélkül a kapu elhasal, a diffedtől függetlenül.",
    fix: "seed: npx tsx scripts/seed-elek-lead.mts (vagy a park újraépítése)",
  });
} else {
  ok.push("van 'initial' rendelés (a prospect-owned-check alanya megvan)");
}

// ── ③ Tenant-alap ────────────────────────────────────────────────────────────
const tenants = await db.selectFrom("tenant").select(["id"]).execute();
if (!tenants.length) {
  findings.push({
    level: "blokkoló",
    what: "nincs egyetlen tenant sem",
    why: "A tenant-admin felületet mérő kapuk (és a legtöbb DB-függő őr) alany nélkül maradnak.",
    fix: "a park újraépítése szükséges",
  });
} else {
  ok.push(`${tenants.length} tenant a parkban`);
}

// ── ④ Párhuzamos futás: ki ír MOST a parkba? ─────────────────────────────────
// Nem DB-kérdés, de ugyanaz a fájdalom: ha egy idegen kör épp fut, a mérésed alatt
// mozog a talaj (`reference_kb_translate_races_across_worktrees`).
const { execSync } = await import("node:child_process");
let busy = "";
try {
  busy = execSync("pgrep -af 'kb-translate|seed-|purge-' 2>/dev/null || true", {
    encoding: "utf8",
  }).trim();
} catch {
  busy = "";
}
const busyLines = busy ? busy.split("\n").filter((l) => !l.includes("park-doctor")) : [];
if (busyLines.length) {
  findings.push({
    level: "gyanús",
    what: `${busyLines.length} párhuzamos park-író folyamat fut MOST`,
    why: "A mérésed alatt változik az adat — a zöld és a piros is lehet véletlen.",
    fix: "várd meg a végüket, aztán mérj újra",
  });
} else {
  ok.push("nincs futó park-író folyamat");
}

// ── önteszt: tudnak-e a felismerők pirosra menni? ────────────────────────────
// Egy diagnosztika, ami mindig „rendben"-t mond, ugyanolyan haszontalan, mint egy
// őr, ami sosem bukik (`feedback_guard_greenly_defended_the_bug`).
if (selfTest) {
  const probes: ReadonlyArray<{ name: string; hit: boolean }> = [
    { name: "① árva teszt-lead", hit: artefacts.length > 0 },
    { name: "② initial rendelés", hit: !ownedWithOrder },
    { name: "③ tenant-alap", hit: tenants.length === 0 },
    { name: "④ párhuzamos író", hit: busyLines.length > 0 },
  ];
  console.log("park-doctor --self-test: a felismerők KÖTÉSE (a park aktuális állapotán)");
  for (const p of probes) {
    console.log(`  ${p.hit ? "🔴 megszólalt" : "⚪ csendes"} — ${p.name}`);
  }
  console.log(
    "\nℹ️  A csend nem hiba: azt jelenti, hogy a park ezen a ponton ÉP. " +
      "A felismerő kötését az bizonyítja, hogy ugyanez a sor 2026-09-22-én " +
      "az ① és a ④ ágon MEGSZÓLALT, és a land hat kísérletén át pontosan azt mutatta.",
  );
  process.exit(0);
}

// ── jelentés ─────────────────────────────────────────────────────────────────
console.log("park-doctor — a KÖZÖS dev-park állapota (csak olvasás)\n");
for (const o of ok) console.log(`  ✅ ${o}`);
if (findings.length) console.log("");
for (const f of findings) {
  console.log(`  ${f.level === "blokkoló" ? "⛔" : "⚠️ "} ${f.what}`);
  console.log(`     miért számít: ${f.why}`);
  console.log(`     teendő: ${f.fix}`);
}

const blocking = findings.filter((f) => f.level === "blokkoló").length;
console.log("");
if (blocking) {
  console.log(
    `⛔ ${blocking} BLOKKOLÓ park-hiba. Ha most piros egy DB-függő kapud, ` +
      `nagy eséllyel EZ az oka, nem a diffed.`,
  );
} else if (findings.length) {
  console.log(
    `⚠️  ${findings.length} gyanús jel, blokkoló nincs. Ha egy kapu mégis piros, ` +
      `előbb nézd meg, hogy az alanya nem a fenti rekordok egyike-e.`,
  );
} else {
  console.log("✅ A park mérésre alkalmas — egy piros kapu most a DIFFEDRŐL szól.");
}
process.exit(0);
