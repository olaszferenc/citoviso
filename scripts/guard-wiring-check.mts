// ⭐⭐ META-ŐR: egy őr, amit SEMMI nem hív meg, nem őr — csak egy zöld fájl a repóban.
//
// A MÉRT LELET (2026-09-14). A bejelentés két árva őrről szólt (`renewal-date-coherence-check`,
// `room-card-overflow-check`). Leltározva a **95 `scripts/*-check.mts`-ből 21 volt árva**:
// létezett, zöld volt, a fejlécében ott állt, hogy melyik ÉLES hibát zárja le — és a
// `hooks/pre-commit` egyiket sem hívta meg. A forrásban 7 helyen áll `Guard: scripts/…-check.mts`
// komment, ami egy soha le nem futó ellenőrzésre hivatkozik. Vagyis a ház azt hitte, védve van.
//
// Miért nem vett észre EGYETLEN kapu sem 21 lyukat: mert minden kapu a TERMÉKET méri, és
// egyik sem a KAPU-RENDSZERT. Ez az.
//
// Amit mér — mind a négy pont egy MÉRT hibaosztály, nem „jó lenne ha":
//
//   ① LEFEDETTSÉG. Minden `scripts/*-check.mts` vagy szerepel a `hooks/pre-commit`-ben, vagy
//      rajta van a lenti KIVÉTEL-listán INDOKKAL. Új őr írása = a bekötés kikényszerítve.
//
//   ② ÖN-TRIGGER (ADR-0147 ③). Ha egy őr diff-scope-olt triggerrel fut, a trigger regexének
//      illeszkednie kell az ŐR SAJÁT FÁJLJÁRA is — különben az őr átírása ellenőrizetlenül megy
//      át, pedig a hibaosztály gyakran egy időzítés vagy egy CSS-sor az őrben magában.
//
//   ③ LAND-HATÓKÖR. A diff-scope-olt blokk a `changed_files` függvényt olvassa, NEM közvetlenül
//      a `git diff --cached`-et. A `land.sh` a kaput `LAND_RANGE`-dzsel, ÜRES indexszel futtatja:
//      ott a nyers `--cached` mindig üres, tehát a trigger sosem tüzel, és az őr NÉMÁN kimarad —
//      pont a landolásnál, ahol a teljes diff egyben van. (Mérve: 5 bekötött őr élt így.)
//
//   ④ A KIVÉTEL-LISTA ÉLŐ. Egy kivétel csak létező fájlra szólhat, és bekötött őrre nem —
//      különben egy átnevezés után a lista némán mentesít valamit, ami már nem is létezik.
//
// Futtatás:  npx tsx scripts/guard-wiring-check.mts
// Piros önteszt: npx tsx scripts/guard-wiring-check.mts --self-test
//   (mind a négy sértést ELŐÁLLÍTJA egy szintetikus hook-szövegen, és elvárja a pirosat —
//    enélkül a csupa-zöld pontosan annyit érne, mint a 21 árva őr zöldje.)

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF_TEST = process.argv.includes("--self-test");

/**
 * Guards that deliberately do NOT run at commit time.
 *
 * ⛔ A KIVÉTEL NEM MENTESÍTÉS, HANEM KIMONDÁS. A lista minden sora MÉRT — alatta ott áll a
 * dátum és az, hogy MI történt, amikor 2026-09-14-én mind a 21 árva őrt lefuttattam. Egy
 * "lassú" vagy "most nem fér bele" sor ide nem kerülhet: a lassúságra a diff-scope-olt
 * trigger a válasz, nem a mentesítés.
 *
 * A `kind` mező a MENTESÍTÉS OKÁNAK OSZTÁLYA, és csak négy lehet:
 *   · "kézi"      — ember kell hozzá (3DS, SIM, valódi kártya): commit-kapuba nem köthető
 *   · "telepítés" — a választ a gép .env-je adja, nem a commit; fejlesztő-gépen szándékosan más
 *   · "park"      — a KÖZÖS teszt-parkra méri magát, tehát a purge-e után nem a kód miatt lenne
 *                   piros; pont ez állította már meg egy session landolását
 *   · "elrohadt"  — MA PIROS az origin/main-en. Ez ADÓSSÁG, nem mentesség: a `measured` mező
 *                   megnevezi a mért bukást, hogy a következő olvasó ne higgye rendben lévőnek.
 */
type Exception = {
  kind: "kézi" | "telepítés" | "park" | "elrohadt";
  /** when the claim below was last MEASURED (ISO day) */
  measuredOn: string;
  /** what the measurement actually produced — not a guess, not a plan */
  measured: string;
};

const EXCEPTIONS: Readonly<Record<string, Exception>> = {
  "recurring-mandate-check": {
    kind: "kézi",
    measuredOn: "2026-09-14",
    measured:
      "Nem kapu, hanem alparancsos eszköz (config|status|charge), és a `charge` VALÓDI ismétlődő kártyaterhelést indít egy tenantra. A mandátum megszületéséhez ember kell (3DS-kihívás), ezért nem futtattam.",
  },
  "outreach-link-host-check": {
    kind: "telepítés",
    measuredOn: "2026-09-14",
    measured:
      "Lefut, 5 s, zöld — de a TELEPÍTÉST méri: a `PUBLIC_BASE_URL` a gép .env-jéből jön, és fejlesztő-gépen szándékosan nem a citoviso.com. A script fejléce maga mondja ki, hogy az állandóan piros kapu az, amit mindenki megtanul átugrani.",
  },
  "copy-panel-check": {
    kind: "park",
    measuredOn: "2026-09-14",
    measured:
      "PIROS (63 s): beégetett lead-UUID-ra (e16165d9-…) méri a konzol másoló-panelét, és a `.cp-scale` lokátor 30 s után timeoutol ezen a parkon. A purge után sem a kód miatt lenne piros.",
  },
  "hero-pick-check": {
    kind: "park",
    measuredOn: "2026-09-14",
    measured:
      "Zöld (26 s, 6 valódi lead) — de szándékosan fixture NÉLKÜL, a VALÓDI DB leadjein fut, és vision-ítéleteket olvas. Üres parkon nincs mit mérnie, teli parkon pedig pénzbe kerülhet.",
  },
  "hero-override-check": {
    kind: "park",
    measuredOn: "2026-09-14",
    measured:
      "PIROS (9 s): a logikai fele zöld, majd ENOENT a KÖZÖS `sites/`-ben lévő `mock-aranykagylo-36-fullbleed-ab5b3bb9.html`-re — a kiszállított artefaktumot olvassa, ami ebben a fában nincs meg.",
  },
  "hero-override-ui-check": {
    kind: "park",
    measuredOn: "2026-09-14",
    measured:
      "PIROS (69 s): a konzolt egy létező lead nyitókép-paneljén kattintja végig; ezen a parkon a `.hp-undo` gomb 30 s után sincs meg, két állítás pedig már előtte ⛔.",
  },
  "pattern-badge-check": {
    kind: "park",
    measuredOn: "2026-09-14",
    measured:
      "PIROS (15 s): két mockot maga hagyott ki („a mock fájl nincs meg ebben a fában”), a harmadik leadnek pedig nincs minta-összefoglalója — vagyis a park hiánya a piros, nem a kód.",
  },
  "ad-banner-render-check": {
    kind: "park",
    measuredOn: "2026-09-14",
    measured:
      "Zöld (7 s, 80 kiszállított HTML / 990 kép-hivatkozás) — de a KÖZÖS `sites/` tartalmát méri, és szándékosan ANTI-VAKUUM: ha nem lát galéria- ÉS JSON-LD-képet a korpuszban, maga megy pirosra („a »nincs hirdetés« állítás megalapozatlan”). Purge-elt parkon tehát nem a kód miatt bukna.",
  },
  "booking-price-coherence-check": {
    kind: "park",
    measuredOn: "2026-09-14",
    measured:
      "Zöld (17 s) — de a parkban talált EGYETLEN provisioned/live oldalon mért, és üres halmazra kimondottan bukik: „⛔ nincs vizsgálható oldal (provisioned/live, slug-gal)” (a script 329. sora). Purge után ez állítaná meg mindenki landolását.",
  },
  "module-config-check": {
    kind: "elrohadt",
    measuredOn: "2026-09-14",
    measured:
      "PIROS (9 s) — ELROHADT FIXTURE, mert évek óta senki nem futtatta: a fixture `source: \"booking:xyz\"`-t ír, a mai `getMonthAvailability` viszont UUID-t olvas ki belőle → `invalid input syntax for type uuid: \"xyz\"`. Előtte 4 állítás is bukik a foglalás-slot MAI markupjára (`cit-enquiry`). ⚠️ ADÓSSÁG: külön szál, a fixture-t a termék mai alakjához kell igazítani.",
  },
};

type Block = {
  /** guard file name without extension, e.g. "ical-check" */
  name: string;
  /** the diff-scope regex source, or null when the guard runs unconditionally */
  trigger: string | null;
  /** true when the trigger reads `changed_files` (land-aware), false for raw `git diff --cached` */
  landAware: boolean;
  line: number;
};

/**
 * Parses the hook into guard blocks. Deliberately text-based and strict about the shape
 * the file actually uses (`if [ -f scripts/X ] [&& … grep -qE '…'] ; then … fi`) — a
 * clever parser that "understands" shell would also understand shapes nobody writes, and
 * would go quiet on a block written in a new shape. Unknown shape ⇒ not wired ⇒ loud.
 */
function parseHook(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^if \[ -f (scripts\/[\w.-]+) \]/.exec(lines[i]);
    if (!open) continue;
    // Join the condition (it may wrap with a trailing backslash) up to `; then`.
    let cond = lines[i];
    let j = i;
    while (!/;\s*then\s*$/.test(cond) && j + 1 < lines.length) {
      j++;
      cond += "\n" + lines[j];
    }
    // Body: everything until the closing `fi` at column 0.
    let body = "";
    let k = j;
    while (k + 1 < lines.length && !/^fi\s*$/.test(lines[k + 1])) {
      k++;
      body += lines[k] + "\n";
    }
    // The guard a block RUNS is the one it invokes, not the one it file-tests — those
    // are the same everywhere today, and a mismatch is itself worth a red line.
    const run = /(?:npx tsx|node)\s+(scripts\/[\w.-]+)/.exec(body);
    const path = run ? run[1] : open[1];
    const trig = /grep -qE\s+'([^']+)'/.exec(cond);
    blocks.push({
      name: path.replace(/^scripts\//, "").replace(/\.(mts|mjs)$/, ""),
      trigger: trig ? trig[1] : null,
      landAware: trig ? /changed_files/.test(cond) : true,
      line: i + 1,
    });
  }
  // Unconditional invocations that live outside any `if` block.
  const inBlocks = new Set(blocks.map((b) => b.name));
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(?:npx tsx|node)\s+scripts\/([\w.-]+)\.(?:mts|mjs)/.exec(lines[i]);
    if (!m || inBlocks.has(m[1])) continue;
    blocks.push({ name: m[1], trigger: null, landAware: true, line: i + 1 });
    inBlocks.add(m[1]);
  }
  return blocks;
}

let failures = 0;
function check(label: string, ok: boolean, detail: string): void {
  console.log(`${ok ? "✅" : "⛔"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** The four rules, applied to ONE (hook text, guard list) pair. Returns the violations. */
function audit(hookText: string, guards: readonly string[]): string[] {
  const blocks = parseHook(hookText);
  const wired = new Map(blocks.map((b) => [b.name, b]));
  const bad: string[] = [];

  // ① every guard on disk is wired or excused
  for (const g of guards) {
    if (wired.has(g)) continue;
    if (g in EXCEPTIONS) continue;
    bad.push(`① BEKÖTETLEN ŐR: scripts/${g}.mts — a hooks/pre-commit sosem hívja meg`);
  }
  // ② a diff-scoped trigger must cover the guard's own file
  for (const b of blocks) {
    if (!b.trigger) continue;
    let re: RegExp;
    try {
      re = new RegExp(b.trigger);
    } catch {
      bad.push(`② ÉRTELMEZHETETLEN trigger-regex a ${b.line}. sorban: ${b.trigger}`);
      continue;
    }
    // ⛔ The name lifted from the hook may ALREADY carry its extension: the four
    // guards wired on 2026-09-14 are `*-selftest.ts` / `shot-*.mts`, and appending
    // `.mts` blindly produced `scripts/offer-selftest.ts.mts` — a path that cannot
    // exist, so a correctly wired guard was reported as unprotected. An empty
    // suffix is the case a name-plus-extension rule always has to carry.
    const candidates = /\.(mts|mjs|ts|js)$/.test(b.name)
      ? [""]
      : ["", ".mts", ".mjs", ".ts", ".js"];
    let matched = false;
    for (const ext of candidates) {
      if (re.test(`scripts/${b.name}${ext}`)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      bad.push(
        `② ÖN-TRIGGER HIÁNYZIK: a ${b.name} triggere nem illeszkedik a saját fájljára (scripts/${b.name}${candidates[0] === "" && candidates.length === 1 ? "" : ".mts"}) — az őr átírása ellenőrizetlenül megy át`,
      );
    }
  }
  // ③ a diff-scoped trigger must read changed_files, or it silently skips at land time
  for (const b of blocks) {
    if (b.trigger && !b.landAware) {
      bad.push(
        `③ LAND-VAK TRIGGER: a ${b.name} nyers \`git diff --cached\`-et olvas a changed_files helyett — landoláskor (üres index) NÉMÁN kimarad`,
      );
    }
  }
  // ④ the exception list stays honest
  for (const [name, ex] of Object.entries(EXCEPTIONS)) {
    if (!guards.includes(name)) {
      bad.push(`④ HALOTT kivétel: ${name} — nincs ilyen fájl (átnevezték vagy törölték)`);
    }
    if (wired.has(name)) {
      bad.push(`④ FÖLÖSLEGES kivétel: ${name} — be VAN kötve, nem kell mentesíteni`);
    }
    // ⑤ a mentesítés MÉRT állítás legyen, ne hangulat: dátum + mit adott a futás.
    // Enélkül a lista pontosan azzá válik, ami ellen készült — egy hely, ahol az őr
    // csendben eltűnik, és a következő olvasó rendben lévőnek hiszi.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ex.measuredOn)) {
      bad.push(`⑤ DÁTUM NÉLKÜLI kivétel: ${name} — mikor mérted? (measuredOn: "${ex.measuredOn}")`);
    }
    if (ex.measured.trim().length < 40) {
      bad.push(
        `⑤ MÉRÉS NÉLKÜLI kivétel: ${name} — a "measured" mező mondja meg, MIT adott a futás (rc, idő, a bukó állítás), ne csak azt, hogy „nem fut"`,
      );
    }
  }
  return bad;
}

// ── PIROS ÖNTESZT ────────────────────────────────────────────────────────────
// Szintetikus hook-szöveg, amiben MIND A NÉGY sértés benne van. Ha az auditor ezt
// zöldnek látja, akkor az éles zöldje sem jelent semmit.
if (SELF_TEST) {
  const brokenHook = [
    "if [ -f scripts/alpha-check.mts ]; then",
    "  npx tsx scripts/alpha-check.mts",
    "fi",
    "if [ -f scripts/beta-check.mts ] && \\",
    "   changed_files | grep -qE '^src/only/other\\.ts$'; then",
    "  npx tsx scripts/beta-check.mts",
    "fi",
    "if [ -f scripts/gamma-check.mts ] && \\",
    "   git diff --cached --name-only | grep -qE '^(src/x\\.ts|scripts/gamma-check)'; then",
    "  npx tsx scripts/gamma-check.mts",
    "fi",
  ].join("\n");
  // delta-check exists on disk but the hook never mentions it → ①
  const fakeGuards = ["alpha-check", "beta-check", "gamma-check", "delta-check"];
  const found = audit(brokenHook, fakeGuards);
  const want = [
    ["①", "delta-check"],
    ["②", "beta-check"],
    ["③", "gamma-check"],
    ["④", "HALOTT"],
  ] as const;
  // ⑤ a saját kivétel-listánk alakja: dátum + MÉRT állítás. Az ellenőrzés a VALÓDI
  // EXCEPTIONS térképen fut (nem fixture-ön), mert pont azt kell honestnek tartani.
  for (const [name, ex] of Object.entries(EXCEPTIONS)) {
    check(
      `önteszt ⑤: a(z) ${name} kivétel MÉRT (dátum + mit adott a futás)`,
      /^\d{4}-\d{2}-\d{2}$/.test(ex.measuredOn) && ex.measured.trim().length >= 40,
      `${ex.kind} · ${ex.measuredOn} · ${ex.measured.length} karakter`,
    );
  }
  for (const [rule, needle] of want) {
    const hit = found.some((f) => f.startsWith(rule) && f.includes(needle));
    check(`önteszt ${rule}: a sértés PIROSRA megy (${needle})`, hit, hit ? "" : `nem találta meg; kapott: ${found.join(" | ")}`);
  }
  // …and the same auditor must be QUIET on a clean shape (különben mindent pirosnak mond)
  const cleanHook = [
    "if [ -f scripts/alpha-check.mts ]; then",
    "  npx tsx scripts/alpha-check.mts",
    "fi",
    "if [ -f scripts/beta-check.mts ] && \\",
    "   changed_files | grep -qE '^(src/only/other\\.ts$|scripts/beta-check)'; then",
    "  npx tsx scripts/beta-check.mts",
    "fi",
  ].join("\n");
  const cleanFound = audit(cleanHook, ["alpha-check", "beta-check"]).filter(
    (f) => !f.startsWith("④"), // the real EXCEPTIONS map is not part of this fixture
  );
  check(
    "önteszt: TISZTA alakra néma (nincs álpozitív)",
    cleanFound.length === 0,
    cleanFound.length ? cleanFound.join(" | ") : "0 sértés",
  );
  if (failures) {
    console.error(`\n⛔ guard-wiring-check --self-test: ${failures} sértés — az auditor maga hibás.`);
    process.exit(1);
  }
  console.log("\n✅ guard-wiring-check --self-test: mind a négy szabály képes pirosra menni.");
  process.exit(0);
}

// ── ÉLES MÉRÉS ───────────────────────────────────────────────────────────────
const hookText = await readFile(resolve(ROOT, "hooks/pre-commit"), "utf8");
const guards = (await readdir(resolve(ROOT, "scripts")))
  .filter((f) => f.endsWith("-check.mts"))
  .map((f) => f.replace(/\.mts$/, ""))
  .sort();

const violations = audit(hookText, guards);
const blocks = parseHook(hookText);
const wiredCount = new Set(blocks.map((b) => b.name)).size;

check(
  `lefedettség: ${guards.length} őr a lemezen, ${guards.length - violations.filter((v) => v.startsWith("①")).length - Object.keys(EXCEPTIONS).length} bekötve, ${Object.keys(EXCEPTIONS).length} indokolt kivétel`,
  !violations.some((v) => v.startsWith("①")),
  violations.filter((v) => v.startsWith("①")).join(" | "),
);
check(
  `ön-trigger: ${blocks.filter((b) => b.trigger).length} diff-scope-olt blokk`,
  !violations.some((v) => v.startsWith("②")),
  violations.filter((v) => v.startsWith("②")).join(" | "),
);
check(
  "land-hatókör: minden diff-scope-olt blokk a changed_files-t olvassa",
  !violations.some((v) => v.startsWith("③")),
  violations.filter((v) => v.startsWith("③")).join(" | "),
);
check(
  "kivétel-lista élő (létező fájl, nem bekötött)",
  !violations.some((v) => v.startsWith("④")),
  violations.filter((v) => v.startsWith("④")).join(" | "),
);
check(
  "kivétel-lista MÉRT (dátum + a futás eredménye, nem hangulat)",
  !violations.some((v) => v.startsWith("⑤")),
  violations.filter((v) => v.startsWith("⑤")).join(" | "),
);

console.log(`\nℹ️  a hook ${wiredCount} őrt hív meg (ebből ${blocks.filter((b) => b.trigger).length} diff-scope-olt)`);
// ⚠️ Az ADÓSSÁG nem tűnhet el a zöldben: a MA PIROS őröket minden futás kiírja, hogy a
// „minden zöld" sor ne olvasódjon úgy, mintha a repó rendben lenne.
const rotted = Object.entries(EXCEPTIONS).filter(([, e]) => e.kind === "elrohadt");
if (rotted.length) {
  console.log(`⚠️  ${rotted.length} őr MA PIROS az origin/main-en, ezért nincs bekötve — ez adósság, nem rendben lévő állapot:`);
  for (const [name, e] of rotted) console.log(`   · ${name} (${e.measuredOn}): ${e.measured.split(".")[0]}.`);
}

if (failures) {
  console.error(
    `\n⛔ guard-wiring-check: ${violations.length} sértés.\n` +
      `   Egy őr, amit senki nem hív meg, nem véd semmit — kösd be a hooks/pre-commit-be\n` +
      `   diff-scope-olt triggerrel (ami az ŐR SAJÁT fájlját is tartalmazza), vagy vedd fel\n` +
      `   INDOKKAL a scripts/guard-wiring-check.mts EXCEPTIONS térképébe.`,
  );
  process.exit(1);
}
console.log("\n✅ guard-wiring-check: minden őr be van kötve vagy indokolt kivétel.");
