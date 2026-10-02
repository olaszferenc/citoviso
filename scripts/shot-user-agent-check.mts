// ŐR: a valódi lead-tartalmat fényképező/mérő Chromium a SAJÁT bot-UA-nkkal kér (PORTAL_USER_AGENT).
//
// A LELET (2026-10-02, M4 mérés): a lake-balaton.com a User-Agent „HeadlessChrome” tokenjére
// 429 text/plain választ ad (oldalra és képre is), a sima Chrome- és a `citoviso-bot/0.1` UA-ra
// 200-at — 12 párhuzamos kérésre is. Nem terheléskorlát, hanem UA-szűrés. Mérve: alap headless
// UA-val 3/3 kép 429 és naturalWidth=0, bot-UA-val 3/3 betölt. Következmény: minden alap-UA-s
// headless kép a lake-balaton fotós leadeknél (Három Huszár, Muschel) TÖRÖTT fotót mutat, holott a
// fotó él — a vásárlás utáni oldalkép (payment/siteShot) a nyitófotóra esett vissza, Elek
// böngészős tesztje és a mock-generálás légiesség-mérése (qaAiriness) képek nélküli lapot látott.
// A heroShot (2026-08-30) és a ui-shot már bot-UA-val kért — ez a két minta lett a szabály.
//
// A politeness-doktrína szerint a SAJÁT nevünkben kérünk (nem álcázunk böngészőnek); a
// siteVisit bot-szűrője a `headless`-t és a `bot`-ot egyformán kiszűri, így a számlálás nem változik.
//
// Hatókör: minden `chromium.launch`-ot hívó fájl az src/ és az elek/bin/ alatt, + scripts/ui-shot.mts
// (a §2b döntési képek eszköze). A többi scripts/ őr saját fixture-t renderel, külső fotót nem kér.
// Szabály: minden `<böngésző>.newPage({…})` és `.newContext({…})` opció-objektuma tartalmazza a
// `userAgent: PORTAL_USER_AGENT` sort; argumentum nélküli `newPage()` csak kontextuson (ami maga
// is ezt a szabályt követi) megengedett.
//
//   npx tsx scripts/shot-user-agent-check.mts              # zöld futás
//   npx tsx scripts/shot-user-agent-check.mts --self-test  # PIROS kontroll: a régi siteShot /
//                                                          #   runner / qaAiriness hívás visszarakva

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.m?ts$/.test(n)) out.push(p);
  }
  return out;
}

const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "elek/bin")), path.join(ROOT, "scripts/ui-shot.mts")]
  .filter((f) => readFileSync(f, "utf8").includes("chromium.launch"));

/** The balanced-paren argument text of a call starting at `open` (the index of "("). */
function argOf(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) return src.slice(open + 1, i);
  }
  return src.slice(open + 1);
}

/** The OLD calls (before 2026-10-02), put back for the self-test. */
const OLD: Record<string, [string, string]> = {
  "src/payment/siteShot.ts": [
    /viewport: VIEWPORT,\s*deviceScaleFactor: SCALE,[\s\S]*?userAgent: PORTAL_USER_AGENT,?\s*\}/.source,
    "viewport: VIEWPORT, deviceScaleFactor: SCALE }",
  ],
  "elek/bin/runner.mts": [/\s*userAgent: PORTAL_USER_AGENT,/.source, ""],
  "src/generator/qaAiriness.ts": [/,?\s*userAgent: PORTAL_USER_AGENT/.source, ""],
};

const fails: string[] = [];
let calls = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  let src = readFileSync(f, "utf8");
  if (SELF_TEST && OLD[rel]) src = src.replace(new RegExp(OLD[rel]![0]), OLD[rel]![1]);
  for (const m of src.matchAll(/(\w+)\)?\.(newPage|newContext)\(/g)) {
    const arg = argOf(src, m.index! + m[0].length - 1).trim();
    const line = src.slice(0, m.index).split("\n").length;
    // ctx.newPage() / (await contextFor(u)).newPage() — the context carries the UA.
    if (m[2] === "newPage" && arg === "" && !/^(browser|b)$/.test(m[1]!)) continue;
    calls++;
    if (!/userAgent:\s*PORTAL_USER_AGENT\b/.test(arg)) {
      fails.push(`${rel}:${line} — ${m[1]}.${m[2]}(…) a saját bot-UA nélkül (HeadlessChrome → a lake-balaton 429-et ad, a fotó törött)`);
    }
  }
}

if (calls < 5) fails.push(`a mérés vak: csak ${calls} lap/kontextus-nyitás a hatókörben (${files.length} fájl)`);

if (SELF_TEST) {
  const expected = Object.keys(OLD);
  const missing = expected.filter((r) => !fails.some((x) => x.startsWith(r + ":")));
  const extra = fails.filter((x) => !expected.some((r) => x.startsWith(r + ":")));
  if (missing.length || extra.length) {
    console.error("✗ shot-user-agent-check --self-test: a kontroll nem a várt fájlokat buktatta");
    for (const m of missing) console.error(`  · nem bukott: ${m}`);
    for (const e of extra) console.error(`  · váratlan: ${e}`);
    process.exit(1);
  }
  console.log(`✓ shot-user-agent-check --self-test: a régi hívások pontosan a ${expected.length} fájlt buktatják`);
  process.exit(0);
}

if (fails.length) {
  console.error(`✗ shot-user-agent-check: ${fails.length} lelet`);
  for (const x of fails) console.error(`  · ${x}`);
  process.exit(1);
}
console.log(`✓ shot-user-agent-check: ${calls} Chromium lap/kontextus ${files.length} fájlban mind a saját bot-UA-val kér`);
