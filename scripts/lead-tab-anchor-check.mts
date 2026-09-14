// A LEAD-LAP FÜL-HORGONYÁNAK ŐRE: egy művelet utáni visszairányítás ODA vigyen vissza,
// ahol a kurátor a gombot megnyomta.
//
// ⛔ MIÉRT (mérve 2026-09-14, Elek FK-003b): a „Mock generálása" gomb a „Mock és
// generálás" fülön ül, a POST /lead/:id/generate viszont horgony NÉLKÜL irányított vissza
// (`/lead/:id`). A fül-kapcsoló `fromHash()`-e üres hash-re hamisat ad, tehát az ELSŐ fül
// marad nyitva — a kurátort a gombnyomás átdobta az „Adatok" fülre, el a futástól, amit
// épp elindított, és el az artefaktum-listától, ahová az meg fog érkezni. A minta egy
// függvénnyel odébb már megvolt: a recopy-útvonal `#ls-mocks`-ra landol.
//
// KÉT RÉTEG, mert egyik sem elég:
//   ① VISELKEDÉS (hermetikus, böngészőben): a horgony NÉLKÜLI lap tényleg az első fület
//      nyitja, a `#ls-mocks` tényleg a mock-fület. Ez a szabály MÉRT oka — enélkül csak
//      hinnénk, hogy a fragment számít.
//   ② HÍVÁSI HELY (forrás): a `server.ts` MINDEN `/lead/…`-ra visszairányító sora visel
//      fragmentet. A ① hiába zöld, ha a kód nem küld horgonyt.
//
// Hermetikus: NINCS DB és NINCS szerver — a nézetfüggvényt közvetlenül rendereljük, a
// kimenet egy ideiglenes fájlba megy, azt nyitja a böngésző (a hash csak valódi URL-en
// értelmezhető). A közös park érintetlen.
//
//   npx tsx scripts/lead-tab-anchor-check.mts
//   npx tsx scripts/lead-tab-anchor-check.mts --self-test   (piros önteszt)

process.env.CIT_SHOT = "1";

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { leadPage } from "../src/console/views.js";
import type { LeadDetail } from "../src/console/data.js";

const SELF_TEST = process.argv.includes("--self-test");
let bad = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) bad++;
};

// ── ① VISELKEDÉS ───────────────────────────────────────────────────────────────
const lead = {
  id: "11111111-2222-3333-4444-555555555555",
  name: "Őr-teszt Vendégház",
  qualification: null,
  lifecycle: "new",
  matchConfidence: 0.9,
  address: "Teszt utca 1.",
  region: "teszt",
  raw: {},
  provenance: [],
  artifacts: [],
  heroScores: {},
} as unknown as LeadDetail;

const html = leadPage(lead);
const dir = mkdtempSync(path.join(os.tmpdir(), "cit-tabanchor-"));
const file = path.join(dir, "lead.html");
writeFileSync(file, html, "utf8");
const fileUrl = pathToFileURL(file).href;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

/** Which tab pane is open RIGHT NOW (the script's own `on` class, read back live). */
async function activePane(url: string): Promise<string> {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(150);
  return page.evaluate(() => document.querySelector(".con-tabp.on")?.id ?? "");
}

const tabIds = await (async () => {
  await page.goto(fileUrl, { waitUntil: "load" });
  return page.evaluate(() => [...document.querySelectorAll(".con-tabp")].map((s) => s.id));
})();
ok("a fixture TÉNYLEG több fület rendere (különben a mérés üres halmazon állna)", tabIds.length > 1, `fülek: ${tabIds.length}`);
ok("a mock-fül létezik a lapon", tabIds.includes("ls-mocks"), `fülek: ${tabIds.join(", ")}`);

const first = tabIds[0] ?? "";
const bare = await activePane(fileUrl);
ok(
  `① horgony NÉLKÜL az ELSŐ fül nyílik («${first}») — ezért veszti el a kurátor a helyét`,
  bare === first,
  `nyitva: «${bare}»`,
);
const anchored = await activePane(`${fileUrl}#ls-mocks`);
ok("① a «#ls-mocks» fragment TÉNYLEG a mock-fületre vált", anchored === "ls-mocks", `nyitva: «${anchored}»`);
ok(
  "① a két eset szét is válik (a fragment nem hatástalan)",
  bare !== anchored,
  `mindkettő: «${bare}»`,
);

await browser.close();
rmSync(dir, { recursive: true, force: true });

// ── ② HÍVÁSI HELY ──────────────────────────────────────────────────────────────
// Minden lead-lapra visszairányító sor viseljen fragmentet. A `back`-alapú (referer)
// visszairányítások külön ágon élnek és már ma is horgonyoznak; itt a SABLON-literálos
// `/lead/${…}` alak a tárgy, mert az a horgony nélküli út.
const SERVER = path.resolve(import.meta.dirname, "..", "src", "console", "server.ts");
const source = SELF_TEST
  ? // PIROS ÖNTESZT: visszarontjuk a javítást (levesszük a fragmentet) — a ② állításnak
    // pirosra kell váltania, különben az őr a hibát ZÖLDEN védené.
    readFileSync(SERVER, "utf8").replace("/lead/${id}#ls-mocks", "/lead/${id}")
  : readFileSync(SERVER, "utf8");

// ⚠️ A TELJES hívást olvassuk, nem egy sort: két visszairányítás több sorra tördelve
// fűzi össze a célt (`…?flash=…` + `&flashKind=…#ls-photos`), és egy sor-alapú minta
// ŐKET is horgony nélkülinek mérte — vagyis az őr két ÉP útvonalat jelentett hibásnak.
const LEAD_REDIRECT = /redirect\(\s*res,\s*([\s\S]*?)\);/g;
const targets = [...source.matchAll(LEAD_REDIRECT)]
  .map((m) => m[1]!.replace(/\s+/g, " ").trim())
  .filter((t) => t.includes("/lead/${"));
ok(
  "② a forrás TÉNYLEG tartalmaz lead-lapra visszairányító sort (a szabálynak van tárgya)",
  targets.length > 0,
  `találat: ${targets.length}`,
);
const unanchored = targets.filter((t) => !t.includes("#"));
ok(
  "② MINDEN lead-lapra visszairányítás MEGNEVEZI a fület, ahová visszavisz",
  unanchored.length === 0,
  unanchored.length ? `horgony nélkül: ${unanchored.join(" · ")}` : "",
);
// A horgony ne mutasson nem létező fülre: amit kiír, azt a lap ismerje. (Az aliasokat a
// fül-kapcsoló `ALIAS` táblája ismeri; `a-<uuid>` = egy konkrét artefaktum-kártya.)
const ALIASES = ["mock-artifacts", "prospects", "ls-generate"];
const unknownAnchor = targets
  .flatMap((t) => [...t.matchAll(/#([a-z0-9-]+)/g)].map((m) => m[1]!))
  .filter((h) => !tabIds.includes(h) && !ALIASES.includes(h));
ok("② a kiírt horgony létező fülre (vagy ismert aliasra) mutat", unknownAnchor.length === 0, unknownAnchor.join(" · "));

if (SELF_TEST) {
  console.log("\n⚑ ÖNTESZT: a fenti ② állítás a VISSZARONTOTT forráson futott — pirosnak kell lennie.");
  const passed = unanchored.length === 0;
  console.log(
    passed
      ? "  ⛔ AZ ÖNTESZT BUKOTT: az őr a horgony nélküli kódot is átengedte."
      : "  ✅ az őr képes pirosra menni (a visszarontott kódot megfogta).",
  );
  process.exit(passed ? 1 : 0);
}

console.log(
  bad === 0
    ? "\n✅ A művelet utáni visszairányítás oda visz, ahol a kurátor a gombot megnyomta."
    : `\n⛔ ${bad} eltérés.`,
);
process.exit(bad === 0 ? 0 : 1);
