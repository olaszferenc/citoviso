// REGION-PHRASE GATE — "ha nincs megnevezett terület, a régió-fordulat ELMARAD".
//
// A SZABÁLY (tulajdonosi döntés, 2026-09-14): besorolatlan gyűjtési területnél a vevőnek
// szóló szövegből a régió-fordulat KIMARAD. ⛔ Nem helyettesítjük: a kulcs visszhangja
// („…_test szívében") és a konzol állapot-szava („…nincs besorolás szívében") EGYFORMÁN
// hamis mondat. Egy tényt, amink nincs, elhagyunk — de a modellnek KIMONDJUK, hogy hiányzik,
// különben a fotókból találja ki (§B.17).
//
// A LYUK, AMIT BEZÁR: a `resolveRegion()` utolsó sora `label: REGIONS[id]?.label ?? id` volt,
// vagyis ismeretlen azonosítónál a SCRAPE KULCSOT adta vissza megjelenítendő névként, és
// onnantól semmi nem tudta megkülönböztetni egy valódi helynévtől. Mérve 2026-09-14:
// `bs` → "bs", `_test` → "_test". Ez a string ment a COPYWRITER promptjába a szállás
// régiójaként ÉS a TÉNY-KAPU forrás-listájára igazolt igazságként — vagyis egy
// besorolatlan gyűjtő-definícióból „_test" kerülhetett a vendégnek szóló prózába, a kapu
// áldásával. (Az ADR-0143 ③ ezt még a `render.ts` legacy útjára írta; az ÉLŐ út más, és
// rosszabb — lásd az ADR helyesbítését.)
//
// ⛔ MIÉRT VAN SZERKEZETI RÉTEG IS (③): a viselkedés-állítások csak a mai hívási helyeket
// fedik. Egy jövőbeli szerkesztés, ami visszaírja a feltétel nélküli `region: region.label`-t
// egy ÚJ helyre, viselkedésben zöld maradna, amíg valaki le nem generál egy besorolatlan
// leadet. A forrás-szintű állítás ezt a rést zárja.
//
//   npx tsx scripts/region-phrase-drop-check.mts             # zöld futás
//   npx tsx scripts/region-phrase-drop-check.mts --self-test # PIROS kontroll
//
// Se AI-hívás, se hálózat, se DB-írás: tiszta függvény-viselkedés + forrás-olvasás.

import { readFileSync } from "node:fs";
import path from "node:path";

import { regionLines } from "../src/generator/brief.js";
import { regionSourceLine } from "../src/generator/factCheck.js";
import { resolveRegion } from "../src/generator/generate.js";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");

const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

/**
 * A VISSZARONTOTT viselkedés — pontosan az, ami ki lett szállítva. A piros önteszt ezekkel
 * futtatja ugyanazokat az állításokat, hogy bizonyítsa: az őr KÉPES pirosra menni.
 * (Nem a vizsgált függvényeket hívja „másképp" — külön, önálló újraírás.)
 */
const OLD = {
  resolveRegion: (id: string) => ({ id, label: id, known: true }),
  regionLines: (region?: string, ctx?: string) => `Régió: ${region}\nKontextus: ${ctx ?? ""}\n`,
  regionSourceLine: (region?: string) => `region: ${region}`,
};
const R = SELF_TEST ? OLD.resolveRegion : (id: string) => resolveRegion(id, null, null);
const L = SELF_TEST ? OLD.regionLines : regionLines;
const S = SELF_TEST ? OLD.regionSourceLine : regionSourceLine;

// A dev-korpuszon MÉRT kulcsok, és hogy melyikük mögött van `region` rekord.
// A `Balaton` szándékosan itt van: VALÓDI helynévnek látszik, de gyűjtő-definíció kulcsa —
// ezért nem szó-feketelista az őr, hanem a `known` zászlót méri.
const REGISTERED = ["balaton-north", "badacsony"] as const;
const UNREGISTERED = ["bs", "_test", "Balaton"] as const;

// ── ① A forrás megkülönbözteti a NEVET a KULCSTÓL ────────────────────────────
for (const id of REGISTERED) {
  const r = R(id);
  check(r.known === true, `[${id}] bejegyzett terület → known=true (kapott: ${r.known})`);
  check(
    r.known && r.label !== id,
    `[${id}] a címke a terület NEVE, nem a kulcs visszhangja („${r.label}")`,
  );
}
for (const id of UNREGISTERED) {
  const r = R(id);
  check(r.known === false, `[${id}] nincs terület-rekord → known=false (kapott: ${r.known})`);
}
check(
  UNREGISTERED.length >= 3 && REGISTERED.length >= 2,
  `a minta TÉNYLEG tartalmaz mindkét esetet (${REGISTERED.length} bejegyzett / ${UNREGISTERED.length} nem) — enélkül az őr fél halmazt mérne`,
);

// ── ② A COPYWRITER promptja: elhagyja a fordulatot, és KIMONDJA, hogy nincs ──
{
  const known = L("Balaton", "A tó északi oldala");
  check(known.includes("Balaton"), "ismert területnél a prompt TARTALMAZZA a nevet");

  const unknown = L(undefined, undefined);
  // Egyik kulcs sem szivároghat be — a valódi kulcsokkal mérve, nem elvi mintával.
  const leaked = UNREGISTERED.filter((k) => unknown.includes(k));
  check(
    leaked.length === 0,
    `ismeretlen területnél a prompt EGYETLEN nyers kulcsot sem tartalmaz (sértő: ${leaked.join(", ") || "0"})`,
  );
  check(
    !/undefined|null/.test(unknown),
    "ismeretlen területnél a prompt nem ír ki `undefined`/`null`-t (a régi kód ezt tette volna)",
  );
  // ⛔ A csend NEM elég: ha csak kihagynánk a sort, a modell a képekből találná ki a helyet.
  check(
    /NINCS ADAT/.test(unknown) && /NE említs/.test(unknown),
    "ismeretlen területnél a prompt KIMONDJA a hiányt ÉS megtiltja a régió-említést",
  );
  // És nem a konzol állapot-szavát tolja a helyére (az ugyanúgy hamis mondatot szülne).
  check(
    !unknown.includes("nincs besorolás"),
    "a hiányt NEM a konzol állapot-szavával tölti ki („nincs besorolás” a prózában ugyanúgy hamis)",
  );
}

// ── ③ A TÉNY-KAPU forrás-listája: a régió nem lesz megalapozható tény ────────
{
  const known = S("Balaton");
  check(known === "region: Balaton", "ismert területnél a tény-horgony a nevet közli");

  const unknown = S(undefined);
  const leaked = UNREGISTERED.filter((k) => unknown.includes(k));
  check(leaked.length === 0, `ismeretlen területnél a tény-horgony nem közöl kulcsot (sértő: ${leaked.length})`);
  check(
    /NINCS ADAT/.test(unknown) && /MEGALAPOZATLAN/.test(unknown),
    "a tény-horgony KIMONDJA, hogy régió-állítás ilyenkor megalapozatlan (nem néma kihagyás)",
  );
}

// ── ④ SZERKEZETI IKER: egyetlen ÉLŐ hívási hely sem adja át feltétel nélkül ──
// A viselkedés-állítások a mai hívókat fedik; ez a réteg a HOLNAPIT.
{
  const LIVE = ["src/generator/generateEngine.ts", "src/generator/recopy.ts"];
  for (const rel of LIVE) {
    const src = SELF_TEST
      ? // PIROS kontroll: a kiszállított, feltétel nélküli alak.
        "  const briefInput = {\n    name: lead.name,\n    region: region.label,\n"
      : readFileSync(path.join(ROOT, rel), "utf8");
    // Feltétel NÉLKÜLI átadás: `region: region.label` úgy, hogy nem `region.known`-ra őrzött.
    const bad = src
      .split("\n")
      .filter((l) => /^\s*region:\s*region\.label\s*,?\s*$/.test(l));
    check(
      bad.length === 0,
      `[${rel}] nincs FELTÉTEL NÉLKÜLI \`region: region.label\` átadás (sértő sor: ${bad.length})`,
    );
    if (!SELF_TEST) {
      // …és a `region.known` őr TÉNYLEG ott van (különben a fenti állítás üresen is zöld:
      // egy fájl, ami a régiót egyáltalán nem említi, átmenne).
      check(
        /region\.known\s*\?/.test(src),
        `[${rel}] a fájl TÉNYLEG a \`region.known\`-ra őrzi az átadást (a mérés nem üres)`,
      );
    }
  }
}

// ── Verdikt ─────────────────────────────────────────────────────────────────
for (const o of oks) console.log(`  ✓ ${o}`);
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(
  `\nregion-phrase-drop-check: ${oks.length} pass / ${fails.length} fail${SELF_TEST ? " (ÖNTESZT: a pirosnak KELL buknia)" : ""}`,
);

if (SELF_TEST) {
  if (fails.length === 0) {
    console.error(
      "\n⛔ ÖNTESZT-BUKÁS: a visszarontott viselkedésre az őr ZÖLDET adott — nem azt méri, amit állít.",
    );
    process.exit(1);
  }
  console.log(`✅ ÖNTESZT RENDBEN: ${fails.length} állításon pirosra ment a visszarontott viselkedésen.`);
  process.exit(0);
}

if (fails.length) process.exit(1);
console.log("✅ besorolatlan területnél a régió-fordulat elmarad — se kulcs, se állapot-szó, és a hiány kimondva");
