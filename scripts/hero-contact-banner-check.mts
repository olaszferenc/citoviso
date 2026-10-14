// A lefotózott portál-molinó elérhetőséggel = reklám (Elek-foglaló F-3, tulaj-döntés „B”, 2026-10-14).
// A teszt-oldal galériájában a valódi szállás szallas.hu-molinója állt (telefon, gmail, www.szallas.hu):
// a képszűrő `sign_map`-nek, 5 pontra ítélte — nyitókép nem lett, de a galériában maradt, mert csak az
// `ad_banner` esik ki. A v4 prompt ezt reklámnak mondja; a v3-as ítéletek ÉRVÉNYESEK maradnak,
// kivéve a `sign_map`-eket (csak azokat kérdezzük újra — élesen 277 sor, ~$0,4, a teljes $25 helyett).
//   ① az elfogadási szabály: v4 mindig; v3 igen, kivéve a sign_map-et; minden más verzió nem;
//   ② a prompt kimondja a szabályt (portál neve / webcím / telefon / e-mail a táblán → ad_banner),
//      és a puszta névtábla kivételét;
//   ③ az újrapontozó `--sign-map` módja létezik, alapból száraz, és az EREDETI (nem kisbetűs) URL-lel hív.
// Élő vision-mérés (dev, 2026-10-14): a molinó v3 → sign_map 5 pont, v4 → ad_banner 0; a többi 5
// galériakép ítélete nem változott; egy szállás saját névtáblája (apartman.hu) sign_map maradt.
// Futtatás: npx tsx scripts/hero-contact-banner-check.mts
import { readFile } from "node:fs/promises";
import path from "node:path";
const { acceptsCachedVerdict } = await import("../src/generator/heroPick.js");

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(d).slice(0, 200)}`}`);
  if (!c) fail++;
};
const ROOT = path.resolve(import.meta.dirname, "..");
const src = await readFile(path.join(ROOT, "src/generator/heroPick.ts"), "utf8");

console.log("\n① melyik cache-ítélet érvényes");
const v4 = (/const CACHE_MODEL = `\$\{HERO_MODEL\}#\$\{PROMPT_VERSION\}`/.test(src) && /const PROMPT_VERSION = "v4-contactbanner"/.test(src));
check("a prompt-verzió v4-contactbanner", v4);
// The model name is read from the source — the predicate is checked against its own constants.
const base = /const HERO_MODEL = "([^"]+)"/.exec(src)?.[1] ?? "";
check("a modell-név kiolvasható", Boolean(base), base);
const at = (v: string) => `${base}#${v}`;
check("⭐ v4 ítélet: elfogadva (bármilyen tárgy)", acceptsCachedVerdict(at("v4-contactbanner"), "sign_map") && acceptsCachedVerdict(at("v4-contactbanner"), "exterior"));
check("⭐ v3 ítélet: elfogadva, ha nem sign_map", acceptsCachedVerdict(at("v3-watermark"), "exterior") && acceptsCachedVerdict(at("v3-watermark"), "ad_banner"));
check("⭐ v3 sign_map: NEM elfogadva (újrakérdezendő)", !acceptsCachedVerdict(at("v3-watermark"), "sign_map"));
check("negatív kontroll: a v3 előtti (vízjel nélküli) ítélet nem elfogadott", !acceptsCachedVerdict(at("v2-adbanner"), "exterior"));

console.log("\n② a prompt szabálya");
check("⭐ lefotózott tábla/molinó + portálnév / webcím / telefon / e-mail → ad_banner", /LEFÉNYKÉPEZETT reklámtábla, molinó, plakát vagy szórólap/.test(src) && /telefonszám vagy e-mail-cím olvasható/.test(src));
check("a puszta névtábla kivétel marad (sign_map / exterior)", /puszta névtáblája vagy cégére \(csak a név, elérhetőség és portál nélkül\) NEM ez/.test(src));

console.log("\n③ az újrapontozó --sign-map módja");
const rs = await readFile(path.join(ROOT, "scripts/rescore-photo-verdicts.mts"), "utf8");
check("létezik a --sign-map kapcsoló", /a === "--sign-map"/.test(rs));
check("alapból száraz (csak --go-val hív)", /if \(signMap\) \{[\s\S]*?if \(!go\) \{[\s\S]*?SZÁRAZ FUTÁS/.test(rs));
check("⭐ az EREDETI URL-lel hív (a kisbetűs kulcs a Google-fotót nem tölti le)", /urlByKey\.set\(k, u\)/.test(rs) && /const found = \[\.\.\.urlByKey\.values\(\)\]/.test(rs));

console.log(fail ? `\n⛔ HERO-CONTACT-BANNER: ${fail} bukás` : "\n🟢 HERO-CONTACT-BANNER: a portál-molinó elérhetőséggel reklám; csak a v3 sign_map-eket kérdezzük újra");
process.exit(fail ? 1 : 0);
