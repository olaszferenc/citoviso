// GATE-OUTPUT GUARD — "ha egy kapu elbukik, elolvashatja-e bárki, MIÉRT?"
//
// THE BUG IT CLOSES (mérve 2026-09-15, ADR-0171). A `hooks/pre-commit` 112 kapujából **73**
// a `>/dev/null`-ra írta a stdout-ját, a hook pedig `set -e`-vel fut. Egy BUKÓ kapu kimenete
// ezért nyomtalanul eltűnt: a napló annyit mutatott, hogy a kapu fejléc-sora, majd semmi.
//
// ⛔ Ez NEM hamis zöld — a bukás bukás, a commit nem jött létre. Ez DIAGNOSZTIZÁLHATATLAN
// bukás, és pont akkor a legdrágább, amikor a legnagyobb a baj: három diagnosztikai kört
// vitt el (a folyamat megölését, majd OOM-ot gyanítottunk, dmesg-et olvastunk, tmux-ba
// menekítettük a commitot), miközben a `hu-machine-form-check` VALÓDI leletet talált —
// egy „a(z)" a felhasználói szövegben. A javítás percek kérdése volt, a megtalálása órák.
//
// A MECHANIKA, amit ez az őr életben tart: a kapu stdout-ja fájlba megy (`$GATE_LOG`), és
// CSAK BUKÁSKOR kerül kiírásra (`|| gate_failed`). A stderr szándékosan átfolyik, ahogy a
// `>/dev/null` mellett is — így a SIKERES futás viselkedése bitre ugyanaz marad.
//
// ⚠️ MIÉRT UTÓTAG ÉS NEM BURKOLÓ ELŐTAG: a `guard-wiring-check` (ADR-0152) a SOR ELEJÉRE
// horgonyozva ismeri fel a bekötést (`/^\s*(?:npx tsx|node)\s+scripts\/…/`). Egy
// `run_gate `-előtag 73 őrt „bekötetlennek" jelentett volna. Mérve igazolva: a felismert
// halmaz a transzformáció előtt és után AZONOS (121 és 119 találat mindkét felismerővel).
//
// A MÉRÉS KÉT RÉTEGE:
//   ① SZERKEZETI — egyetlen kapu-hívás sem küldheti a stdout-ját a /dev/null-ra.
//   ② VISELKEDÉSI — a ténylegesen SZÁLLÍTOTT segédfüggvényt kivágjuk a hookból, és élesben
//      lefuttatjuk: bukó kapunál a kimenet MEGJELENIK és a kilépési kód átjön; sikeres
//      kapunál CSENDES marad; a stderr MINDKÉT esetben átfolyik.
//      ⛔ A ② azért a kivágott EREDETIVEL fut, nem egy újraírt másolattal: egy másolat azt
//      bizonyítaná, hogy az ÉN elképzelésem működik, nem azt, hogy a hookban lévő kód.
//
// Futtatás:  npx tsx scripts/gate-output-check.mts
// Piros önteszt: npx tsx scripts/gate-output-check.mts --self-test
//   (visszarontja a mechanikát a memóriában — `>"$GATE_LOG" || gate_failed` → `>/dev/null` —,
//    és minden állításnak bukni KELL; enélkül nem tudnánk, hogy az őr képes pirosra menni.)

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SELF_TEST = process.argv.includes("--self-test");
const HOOK = "hooks/pre-commit";

const oks: string[] = [];
const fails: string[] = [];
function ok(label: string, pass: boolean, detail = ""): void {
  (pass ? oks : fails).push(`${label}${detail ? ` — ${detail}` : ""}`);
}

let hookText = readFileSync(HOOK, "utf8");
if (SELF_TEST) {
  // ⛔ RED CONTROL — a MÉRT hibát tesszük vissza, és semmi mást: a kapu stdout-ja megint
  // a /dev/null-ra megy. A helyettesítés a szállított alakra köt, tehát ha a mechanika
  // megnevezése változik, az önteszt itt HANGOSAN elhasal, nem csendben nem-mér.
  const before = hookText;
  hookText = hookText.split('>"$GATE_LOG" || gate_failed').join(">/dev/null");
  if (before === hookText) {
    console.log("⛔ AZ ÖNTESZT NEM TUDOTT VISSZARONTANI: a '>\"$GATE_LOG\" || gate_failed' alak");
    console.log("   nincs meg a hookban. Az őr ezért NEM mér semmit — ez bukás, nem zöld.");
    process.exit(1);
  }
  // ⛔ A MÁSODIK VISSZARONTÁS, KÜLÖN OKBÓL. A fentebbi CSAK a hívási alakot rontja el, ami
  // az ① SZERKEZETI réteget buktatja — a ② VISELKEDÉSI ág viszont a SEGÉDFÜGGVÉNYT méri, és
  // attól zöld maradt. Egy piros kontroll nélküli állítás nem tudja magáról, hogy képes-e
  // pirosra menni (ADR-0164: „egy önteszt, ami az első szabály után megáll, a többiről
  // semmit nem mond"). Ezért a kiírást is kiütjük: így a ② ág is bizonyítja a pirosát.
  const before2 = hookText;
  hookText = hookText.replace('  cat "$GATE_LOG" >&2\n', "  : # az önteszt kiütötte a kiírást\n");
  if (before2 === hookText) {
    console.log('⛔ AZ ÖNTESZT NEM TUDTA KIÜTNI A KIÍRÁST (`cat "$GATE_LOG" >&2`) — a ② ág');
    console.log("   piros kontroll nélkül maradna. Ez bukás, nem zöld.");
    process.exit(1);
  }
}

// ── ① SZERKEZETI: egyetlen kapu-hívás sem némíthatja el a stdout-ját ──────────
const lines = hookText.split("\n");
// ⚠️ A `.ts` IS benne van, nem csak a `.mts`/`.mjs`. Az első változatom kihagyta, és
// pont akkor derült ki, amikor két ÚJ kapu (`offer-selftest.ts`, `period-switch-selftest.ts`)
// landolt `.ts` kiterjesztéssel: az őr „0 elnémított kaput" jelentett volna, miközben kettő
// néma maradt. Egy szűk felismerő ugyanúgy hamis zöldet ad, mint egy hiányzó állítás.
const GATE = /^\s*(?:\S+=\S+\s+)*(?:npx tsx|node)\s+scripts\/([\w.-]+)\.(?:mts|mjs|ts)\b(.*)$/;
const silenced: string[] = [];
const captured: string[] = [];
const plain: string[] = [];
const other: string[] = [];
for (let i = 0; i < lines.length; i++) {
  const m = GATE.exec(lines[i]!);
  if (!m) continue;
  const tail = m[2]!.trim();
  const where = `${m[1]} (${i + 1}. sor)`;
  // ⚠️ A vég-illesztés SZÁNDÉKOS, nem szó szerinti egyezés: a kapu-hívás elé/közé
  // argumentum is kerülhet (`… --fast >"$GATE_LOG" || gate_failed`). Az első változatom
  // pontos egyezést várt, és ezért egy HELYES sort (`hu-machine-form-check --fast`)
  // jelentett hibásnak — a saját őröm első futásán derült ki.
  if (/>\s*\/dev\/null\s*$/.test(tail)) silenced.push(where);
  else if (tail.endsWith('>"$GATE_LOG" || gate_failed')) captured.push(where);
  else if (tail === "" || !tail.includes(">")) plain.push(where);
  else other.push(`${where}: ${tail}`);
}

// ⛔ Ez az állítás ELŐFELTÉTEL: üres halmazon a „nincs elnémított kapu" MINDIG igaz.
// Egy elrontott GATE-regex pontosan így nézne ki — 0 találat, csupa zöld.
ok(
  `① a mérés TALÁLT kapu-hívásokat (nem üres halmazon mér)`,
  captured.length + plain.length + silenced.length + other.length >= 50,
  `elkapott: ${captured.length} · natúr: ${plain.length} · elnémított: ${silenced.length} · egyéb: ${other.length}`,
);
ok(
  `①⭐ EGYETLEN kapu sem küldi a stdout-ját a /dev/null-ra`,
  silenced.length === 0,
  silenced.length ? `${silenced.length} elnémított: ${silenced.slice(0, 6).join(" · ")}${silenced.length > 6 ? " …" : ""}` : "",
);
ok(
  `① a nem-natúr hívások mind a szállított alakot használják`,
  other.length === 0,
  other.length ? other.slice(0, 4).join(" · ") : "",
);
ok(
  `① a segédfüggvény és a napló-fájl deklarálva van`,
  /^GATE_LOG="\$\(mktemp/m.test(hookText) && /^gate_failed\(\)\s*\{/m.test(hookText),
);
ok(
  `① a napló-fájl takarítása trap-re van kötve (nem szemetel a /tmp-be)`,
  /^trap 'rm -f "\$GATE_LOG"' EXIT$/m.test(hookText),
);

// ── ② VISELKEDÉSI: a SZÁLLÍTOTT segédfüggvény élesben ────────────────────────
// A hookból kivágjuk a `GATE_LOG=`-tól a `gate_failed` záró `}`-ig tartó blokkot, és EZT
// futtatjuk — nem egy újraírt másolatot.
const start = lines.findIndex((l) => /^GATE_LOG="\$\(mktemp/.test(l));
let end = -1;
for (let i = start; i >= 0 && i < lines.length; i++) {
  if (lines[i] === "}") { end = i; break; }
}
const helper = start >= 0 && end > start ? lines.slice(start, end + 1).join("\n") : "";
ok(
  `② a segédfüggvény KIVÁGHATÓ a hookból (a viselkedési mérés az ÉLES kódon fut)`,
  helper.includes('cat "$GATE_LOG"') && helper.includes("exit"),
  helper ? `${helper.split("\n").length} sor` : "nem találtam a blokkot",
);

const dir = mkdtempSync(join(tmpdir(), "cit-gateout-"));
type Run = { code: number; out: string; err: string };
// ⚠️ `spawnSync`, NEM `execFileSync`: az utóbbi SIKER esetén csak a stdout-ot adja vissza,
// a stderr-t eldobja (az csak a hiba-objektumon érhető el). Az első változatom ezért a
// „sikerkor a stderr átfolyik" állítást ÜRES sztringen mérte, és hibásan pirosra ment egy
// hibátlan mechanikán — a mérőeszköz hibája volt, nem a mérendőé.
function run(body: string): Run {
  const f = join(dir, "h.sh");
  writeFileSync(f, `#!/usr/bin/env bash\nset -e\n${helper}\n${body}\n`, "utf8");
  const r = spawnSync("bash", [f], { encoding: "utf8" });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

const FAKE_OUT = "JEL_A_KAPU_STDOUTJABOL";
const FAKE_ERR = "JEL_A_KAPU_STDERRJEBOL";
const AFTER = "IDE_MAR_NEM_JUTHAT";

if (helper) {
  // ⑴ BUKÓ kapu: a kimenete MEGJELENIK, a kilépési kód ÁTJÖN, a hook MEGÁLL.
  const bad = run(
    `bukó() { echo "${FAKE_OUT}"; echo "${FAKE_ERR}" >&2; return 7; }\n` +
      `bukó >"$GATE_LOG" || gate_failed\n` +
      `echo "${AFTER}"`,
  );
  const badAll = bad.out + bad.err;
  ok(`②⭐ BUKÁSKOR a kapu stdout-ja MEGJELENIK az operátornak`, badAll.includes(FAKE_OUT),
     `stdout+stderr ${badAll.length} bájt`);
  ok(`②⭐ …és a kilépési kód ÁTJÖN (nem nyeli el a burkoló)`, bad.code === 7, `mért: ${bad.code}`);
  ok(`② …és a hook MEGÁLL a bukó kapunál`, !badAll.includes(AFTER));
  ok(`② …a stderr bukáskor is átfolyik`, badAll.includes(FAKE_ERR));

  // ⑵ SIKERES kapu: CSENDES marad (ez a `>/dev/null` eredeti, jogos szándéka), a stderr
  //    viszont átfolyik — vagyis a javítás nem zajosítja el a zöld futást.
  const good = run(
    `jó() { echo "${FAKE_OUT}"; echo "${FAKE_ERR}" >&2; return 0; }\n` +
      `jó >"$GATE_LOG" || gate_failed\n` +
      `echo "${AFTER}"`,
  );
  ok(`②⭐ SIKERKOR a kapu stdout-ja NEM jelenik meg (a zöld futás csendes marad)`,
     !good.out.includes(FAKE_OUT) && !good.err.includes(FAKE_OUT));
  ok(`② …a sikeres futás TOVÁBBMEGY`, good.out.includes(AFTER), `kód: ${good.code}`);
  ok(`② …és a stderr sikerkor is átfolyik (mint eddig)`, good.err.includes(FAKE_ERR));
} else {
  ok(`② viselkedési mérés lefutott`, false, "a segédfüggvényt nem tudtam kivágni");
}
rmSync(dir, { recursive: true, force: true });

// ── Verdikt ─────────────────────────────────────────────────────────────────
console.log("KAPU-KIMENET ŐR — „ha egy kapu elbukik, elolvasható-e, miért?”\n");
for (const o of oks) console.log(`  ✓ ${o}`);
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(`\ngate-output-check: ${oks.length} pass / ${fails.length} fail`);
if (SELF_TEST) {
  console.log(
    fails.length > 0
      ? `\n✅ PIROS ÖNTESZT RENDBEN — a visszarontott mechanikán ${fails.length} állítás bukik.`
      : `\n⛔ AZ ÖNTESZT NEM MENT PIROSRA — az őr nem képes megfogni a hibát, amiért készült.`,
  );
  process.exit(fails.length > 0 ? 0 : 1);
}
if (fails.length) {
  console.log(`\n⛔ BUKÁS — egy bukó kapu kimenete nem ér el az operátorhoz.`);
  process.exit(1);
}
console.log(`\n✅ TISZTA — minden kapu bukása olvasható, a sikeres futás csendes.`);
