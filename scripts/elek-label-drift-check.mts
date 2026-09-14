// ELEK-FORGATÓKÖNYV FELIRAT-ŐR — a `várd: látható "…"` állítás olyan szövegre mérjen,
// ami a termékben TÉNYLEG létezik.
//
// ⛔ MIÉRT (mérve 2026-09-14): egy nap alatt öt körben írtam át felületi feliratokat
// (ADR-0139/0141), és a forgatókönyv lemaradt. Az FK-004 futása **pass=2 fail=1
// blocked=9** lett — a 3. lépés a régi „e-mail még nem ment ki"-t várta, és EGY bukott
// lépés kilencet blokkolt. A KB-t ugyanettől a drifttől ŐR védi (kb-check label-drift,
// §J.24), az Elek-forgatókönyveket semmi — pedig ugyanabból a szövegből élnek. A hiba
// így csak egy több perces futásból derült ki, nem a commit-kapunál.
//
// ⚠️ A FUTÓ SZEMANTIKÁJÁVAL MÉR, nem a magaméval. A runner a Playwright
// `page.getByText()`-jét hívja: kis-nagybetű-érzéketlen, szóköz-normalizált RÉSZSZÖVEG.
// Az első mérésem pontos egyezést nézett, és emiatt „hiányzónak" mondta a `„Leadek"`
// állítást — pedig az a valódi „Aktív leadek" cím részszövege, tehát jogosan zöld. Egy
// őr, ami szigorúbban mér, mint a mért rendszer, hamis leletet gyárt.
//
// HÁROM FELOLDÁSI FORRÁS (mérve: együtt a 156 állításból 156-ot feloldanak) — mind
// STRUKTURÁLIS, egyik sem kézzel tartott kivétel-lista:
//   ① FELÜLETI SZÖVEG — a források literáljai + az i18n-katalógus, SABLON-TUDATOSAN:
//      a `{n} foglalás` bejegyzés feloldja a „0 foglalás" állítást.
//   ② AMIT A FORGATÓKÖNYV BEGÉPEL — `tedd: írd "<sel>" "<érték>"`. A „2026. 09. 21. —
//      2026. 09. 23." a saját `2026-09-21`/`2026-09-23` bemenetéből renderelődik, ezért
//      szám-normalizálva egyezik.
//   ③ PARK-SEED — `scripts/seed-elek-*.sql` és a park-építő scriptek. A „Szabó Péter"
//      nem felirat, hanem a seed vendége.
//
// ⚠️ AMIT EZ AZ ŐR NEM TUD (és ezt ki kell mondani): FA-SZINTEN méri, hogy a felirat
// LÉTEZIK-E — nem azt, hogy AZON A LAPON van, amit a lépés néz. A 2026-09-14-i konkrét
// bukást („e-mail még nem ment ki") ezért NEM fogta volna meg: azt a feliratot a lead-soron
// átneveztem, de a Tevékenység-lapon MA IS ÉL. Ugyanazt a driftet viszont KÉT MÁSIK során
// elkapta volna („Outreach-piszkozat", „Jogszerűségi kapu: PASS — küldhető") — vagyis a
// commit-kapunál pirosra ment volna, csak más sorra mutatva. A lap-szintű mérés böngészőt
// és a lépés kattintás-útjának ismeretét kívánná; az egy külön, drágább réteg.
//
//   npx tsx scripts/elek-label-drift-check.mts
//   npx tsx scripts/elek-label-drift-check.mts --self-test   (pirosra KELL mennie)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");

/** A futó `getByText` szemantikája: kis-nagybetű-érzéketlen, szóköz-normalizált. */
const norm = (s: string): string => s.replace(/\s+/g, " ").trim().toLowerCase();
/** Számok általánosítása: a renderelt „2026. 09. 21." a begépelt „2026-09-21"-ből jön. */
const digits = (s: string): string => norm(s).replace(/\d+/g, "#").replace(/[^\p{L}#]+/gu, " ").trim();

function readAll(dir: string, ext: RegExp, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|\.git|elek\/runs/.test(rel)) readAll(rel, ext, out);
    } else if (ext.test(e.name)) out.push(rel);
  }
  return out;
}

// ── ① felületi szöveg ─────────────────────────────────────────────────────────
// ⛔ A KB NEM bizonyíték. A forgatókönyv a TERMÉKRE mér, a súgó pedig elavulhat (mérve
// 2026-09-14: az átnevezett „Outreach-piszkozat" a KB kép-aláírásában élt tovább, és az
// őr emiatt feloldottnak látta). Bizonyíték csak a termék SAJÁT szövege.
const uiFiles = [...readAll("src", /\.ts$/), ...readAll("assets/runtime", /\.js$/)];
/**
 * ⛔ CSAK STRING-LITERÁL a `.ts`-ből, AST-ből — nem a nyers fájl. A saját kommentjeink
 * IDÉZIK a leváltott feliratokat („a sor eddig »Jogszerűségi kapu: PASS — küldhető«-t
 * írt"), és a nyers olvasás ezeket élő szövegnek látta: az őr pont ott vakult meg, ahol a
 * történetünket dokumentáljuk. Mérve: emiatt a mai drift EGYIK sorát sem fogta meg.
 */
function literalsOf(file: string): string[] {
  const src = readFileSync(path.join(ROOT, file), "utf8");
  if (!file.endsWith(".ts")) return [src]; // KB-próza és futásidejű JS: a szöveg maga
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n)
    ) {
      out.push((n as ts.LiteralLikeNode).text);
    }
    n.forEachChild(visit);
  };
  visit(sf);
  return out;
}
const uiBlob = norm(uiFiles.flatMap(literalsOf).join("\n"));
/** Szám-normalizált iker: a „OV-2026-" a `OV-${év}-` sablonból renderelődik. */
const uiDigits = digits(uiFiles.flatMap(literalsOf).join("\n"));
const catalog: string[] = JSON.parse(readFileSync(path.join(ROOT, "src/i18n/catalog.json"), "utf8"));

/**
 * Sablon-tudatos illesztés: a katalógus-bejegyzés `{…}` helyőrzőit tetszőleges értékre
 * cseréljük, és azt kérdezzük, hogy az ÁLLÍTÁS beleférhet-e a renderelt eredménybe.
 * Rövid állításnál (pl. „48 órán belül") a bejegyzés egy DARABJA is elég.
 */
function templateResolves(text: string): boolean {
  const n = norm(text);
  const esc = (x: string): string => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return catalog.some((c) => {
    const cn = norm(c);
    // ① az állítás a bejegyzés RÉSZE (a futó is részszöveget keres)
    if (cn.length >= 3 && cn.includes(n)) return true;
    // ② az állítás a bejegyzés RENDERELT alakja: a literál darabok SORBAN szerepelnek az
    //    állításban, és annak nagy részét LEFEDIK.
    //    ⛔ A lefedettség-küszöb nem kozmetika: nélküle a katalógus egykarakteres „H"
    //    bejegyzése mindenre illeszkedett, és az őr NÉMÁN mindent feloldott (mérve
    //    2026-09-14 — az önteszt hozta ki, a zöld futás nem).
    const parts = cn.split(/\{[^}]*\}/).map((x) => x.trim()).filter((x) => x.length >= 3);
    if (parts.length) {
      let i = 0;
      let covered = 0;
      let ok = true;
      for (const part of parts) {
        const k = n.indexOf(part, i);
        if (k < 0) { ok = false; break; }
        i = k + part.length;
        covered += part.length;
      }
      if (ok && covered >= n.length * 0.6) return true;
    }
    // ③ a RÖVID állítás a bejegyzés belsejében ül, a SZÁM a helyőrző helyén
    //    („48 órán belül" ← „…ha {n} órán belül nem válaszol…").
    const letters = n.replace(/\d+/g, "").trim();
    if (/\d/.test(n) && letters.length >= 5) {
      const pat = n.split(/\d+/).map(esc).join("(?:\\d+|\\{[^}]*\\})");
      if (new RegExp(pat).test(cn)) return true;
    }
    return false;
  });
}

// ── ②/③ a forgatókönyv bemenetei + a park-seed ────────────────────────────────
const seedFiles = [
  ...readAll("scripts", /^seed-elek.*\.(sql|mts)$/),
  ...readAll("elek/bin", /\.mts$/),
];
const seedBlob = digits(seedFiles.map((f) => readFileSync(path.join(ROOT, f), "utf8")).join("\n"));

interface Assertion {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  /** Amit UGYANEZ a forgatókönyv gépel be — az saját maga állítja elő a képernyőn. */
  readonly typed: string;
}

const assertions: Assertion[] = [];
for (const f of readdirSync(path.join(ROOT, "elek/scenarios"))) {
  if (!f.endsWith(".md")) continue;
  const src = readFileSync(path.join(ROOT, "elek/scenarios", f), "utf8");
  const typed = digits([...src.matchAll(/tedd\??: (?:írd|válaszd) "[^"]*" "([^"]+)"/g)].map((m) => m[1]!).join(" "));
  src.split("\n").forEach((l, i) => {
    const m = /várd: (?:nem )?látható "([^"]+)"/.exec(l);
    if (m) assertions.push({ file: f, line: i + 1, text: m[1]!, typed });
  });
}

/**
 * ⛔ DARABONKÉNT old fel, mert az állítás gyakran FELIRAT + ADAT: „Visszaigazolva: Kovács
 * János" = UI-felirat + a seed vendége; „Küldés e-mailben — elek@citoviso.com" = sablon +
 * a forgatókönyv által BEGÉPELT cím. Mérve 2026-09-14: siló-szerű feloldással 8 ÉLŐ
 * állításra adott hamis riasztást — egy őr, ami a helyes állapotra piros, használhatatlan.
 */
const explains = (a: Assertion, s: string): boolean => {
  const n = norm(s);
  if (n.length < 3) return true; // „·", „—", számok önmagukban nem bizonyítanak semmit
  return (
    uiBlob.includes(n) ||
    uiDigits.includes(digits(s)) ||
    templateResolves(s) ||
    a.typed.includes(digits(s)) ||
    seedBlob.includes(digits(s))
  );
};

const resolves = (a: Assertion): boolean => {
  if (explains(a, a.text)) return true;
  // A határoló mentén darabolva MINDEN érdemi darabnak megmagyarázottnak kell lennie.
  const segs = a.text.split(/\s*[:·—–|]\s*|,\s+/).filter((x) => x.trim().length > 0);
  return segs.length > 1 && segs.every((x) => explains(a, x));
};

// ⛔ ÖNTESZT: a MA eltört állítást adjuk vissza a készlethez. Ha az őr erre sem megy
// pirosra, akkor a mai hibát sem fogta volna meg — vagyis semmit nem ér.
/**
 * ⛔ TÖBB, FÜGGETLEN valódi eset — nem egy szerencsés találat. Mindhárom feliratot MA
 * neveztem át, és mérve NULLA előfordulásuk van a termék szövegében. Ha az őr bármelyiket
 * elengedi, akkor a darabonkénti feloldás túl engedékeny lett, és az egész zöld hamis.
 */
const MORE_DRIFTS: readonly string[] = ["Pilot-tölcsér (H1–H5)", "Order-intentek"];

const SHIPPED_DRIFT: Assertion = {
  file: "ÖNTESZT (a 2026-09-14-i valódi drift)",
  line: 0,
  // A piszkozat-lap CÍME, amit az ADR-0141 átnevezett: mérve NULLA előfordulás a
  // felületi szövegben. ⚠️ Az első fixture-em az „e-mail még nem ment ki" volt — az
  // viszont MA IS ÉLŐ felirat a Tevékenység-lapon (`prospectActivityPage`), tehát az őr
  // helyesen NEM adott rá pirosat, és a fixture volt rossz, nem az őr.
  text: "Outreach-piszkozat",
  typed: "",
};
/** ⛔ És a másik irány: erre TILOS pirosat adni — még mindig élő felirat máshol. */
const STILL_LIVE: Assertion = {
  file: "ÖNTESZT (élő felirat — hamis riasztás tilos)",
  line: 0,
  text: "e-mail még nem ment ki",
  typed: "",
};
const pool = SELF_TEST
  ? [...assertions, SHIPPED_DRIFT, STILL_LIVE,
     ...MORE_DRIFTS.map((t, i) => ({ file: "ÖNTESZT (további valódi drift)", line: i, text: t, typed: "" }))]
  : assertions;

const unresolved = pool.filter((a) => !resolves(a));
console.log(`ELEK FELIRAT-ŐR — ${assertions.length} állítás, ${new Set(assertions.map((a) => a.file)).size} forgatókönyv`);

if (SELF_TEST) {
  const wanted = [SHIPPED_DRIFT.text, ...MORE_DRIFTS];
  const missed = wanted.filter((t) => !unresolved.some((a) => a.text === t));
  if (missed.length) {
    console.error(`\n⛔ ÖNTESZT BUKOTT: ${missed.length} VALÓDIAN eltört feliratot nem fog meg: ${missed.map((t) => `„${t}"`).join(", ")}`);
    process.exit(1);
  }
  const falsePositives = unresolved.filter((a) => !wanted.includes(a.text));
  if (falsePositives.length) {
    console.error(`\n⛔ ÖNTESZT BUKOTT: ${falsePositives.length} ÉLŐ állításra is pirosat ad (hamis riasztás):`);
    for (const a of falsePositives) console.error(`   ${a.file}:${a.line} „${a.text}"`);
    process.exit(1);
  }
  console.log(`✅ ÖNTESZT: mind a ${wanted.length} valódi driftet megfogja, és a ${assertions.length} élő állítás közül EGYRE sem ad hamis riasztást.`);
  process.exit(0);
}

if (unresolved.length) {
  console.error(`\n⛔ ${unresolved.length} állítás olyan szövegre mér, ami a termékben nincs meg:\n`);
  for (const a of unresolved) console.error(`   ${a.file}:${a.line}  „${a.text}"`);
  console.error(
    "\nEz vagy ELAVULT felirat (a terméket átnevezték → igazítsd a forgatókönyvet), vagy\n" +
      "olyan adat, ami se a seedből, se a forgatókönyv bemenetéből nem származik (akkor a\n" +
      "park-seedbe való). ⚠️ Egy bukott lépés a futásban az ÖSSZES utána következőt blokkolja.",
  );
  process.exit(1);
}
console.log("✅ minden állítás feloldható: felületi szöveg, a forgatókönyv saját bemenete vagy a park-seed.");
process.exit(0);
