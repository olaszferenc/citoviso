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
// KIVÉTEL NINCS, de a védett invariáns a KÉP-kérés (a lead fotója), nem a lap UA-ja. Ezért egy
// bot-UA nélküli lap/kontextus akkor is megfelel, ha MINDEN képkérése a saját bot-UA-val megy, vagy
// egyáltalán nem megy ki — a lapon (vagy a kontextusból nyitott lapon) `route("**/*", …)` áll, amely
//   (a) a képet `"user-agent": PORTAL_USER_AGENT` fejléccel kéri le (mockRenderGate, fbd0e639,
//       2026-11-24: a LAP a böngésző saját UA-jával renderel, mert a Google Fonts bot-UA-ra másik
//       betűfájlt ad, és a cím-túlfolyás mérése hazudott — mérve 11-24, Crystal Apartment), vagy
//   (b) minden képkérést eldob (a Startpage-keresés, ADR-0463, 0e47b9d5: lead-tartalmat nem kér).
// A route-ot nem elég „valahol” a fájlban látni: a hívás eredmény-változójához kell tartoznia.
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
  // The image route without our bot UA: the page then fetches the lead's photo as HeadlessChrome.
  "src/outreach/mockRenderGate.ts": [/,\s*"user-agent": PORTAL_USER_AGENT/.source, ""],
  // The search page no longer drops images: they go out under the browser UA.
  "src/scraper/sources/webSearchBrowser.ts": [/\["image", "font", "media"\]/.source, '["font", "media"]'],
};

/** The route handlers registered on `v` (`v.route("**\/*", handler)`), as source text. */
function routesOn(src: string, v: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(new RegExp(`\\b${v}\\.route\\(`, "g"))) out.push(argOf(src, m.index! + m[0].length - 1));
  return out;
}

/** True when every image request of the page/context bound to `v` either carries our bot UA or is
 *  aborted: a catch-all route on `v`, or on a page opened from it (`const p = await v.newPage()`). */
function imagesGuarded(src: string, v: string): boolean {
  const vars = [v];
  for (const m of src.matchAll(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*await\\s+${v}\\.newPage\\(\\s*\\)`, "g"))) vars.push(m[1]!);
  return vars.some((x) =>
    routesOn(src, x).some(
      (h) =>
        /^\s*["'`]\*\*\/\*["'`]/.test(h) &&
        (/["']user-agent["']\s*:\s*PORTAL_USER_AGENT\b/.test(h) ||
          /\[[^\]]*["']image["'][^\]]*\]\.includes\([\w.]*?\(\)\.resourceType\(\)\)\s*\?\s*\w+\.abort\(\)/.test(h) ||
          /resourceType\(\)\s*===\s*["']image["']\s*\?\s*\w+\.abort\(\)/.test(h)),
    ),
  );
}

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
    // The variable the page/context is bound to: `const page = await browser.newPage(…)`.
    const bound = /(?:const|let)\s+(\w+)\s*=\s*await\s+$/.exec(src.slice(Math.max(0, m.index! - 80), m.index))?.[1];
    if (!/userAgent:\s*PORTAL_USER_AGENT\b/.test(arg) && !(bound && imagesGuarded(src, bound))) {
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
console.log(`✓ shot-user-agent-check: ${calls} Chromium lap/kontextus ${files.length} fájlban: a képet mind a saját bot-UA-val kéri (vagy nem kéri)`);
