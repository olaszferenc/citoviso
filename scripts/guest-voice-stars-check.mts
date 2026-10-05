// VENDÉG-HANG CSILLAG-KAPU — „a szövegíró nem kap rossz véleményt vendég-hangként".
//
// A LELET (2026-10-05, Mandula vendégház, devben olvasva): mind az 5 tárolt Google-vélemény
// ★1 volt („Lehúzás, kosz, átverés"), és a `guestVoice` csak hosszra és duplikátumra szűrt —
// a szövegíró egyetlen vendég-hangja egy vád volt. Tulaj-döntés: csak ≥4★ megy a modellnek;
// a csillag nélküli (portál-)vélemény marad; 10-es skálán ≥8. A forrás-csomag nézet a
// kiszűrteket is mutatja — ezért EGY lánc (`selectGuestVoice`), nem kettő.
//
//   npx tsx scripts/guest-voice-stars-check.mts             # zöld futás
//   npx tsx scripts/guest-voice-stars-check.mts --self-test # PIROS kontroll
//
// Se AI, se hálózat, se DB.

import { readFileSync } from "node:fs";
import { selectGuestVoice, type VoiceCandidate } from "../src/generator/guestVoice.js";

const SELF_TEST = process.argv.includes("--self-test");
const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

/** A 2026-10-05-ig kiszállított lánc: hossz + duplikátum + 10-es plafon, csillag nélkül. */
function OLD<T extends VoiceCandidate>(c: readonly T[]) {
  const seen = new Set<string>();
  const used = c
    .filter((v) => v.text.length >= 30)
    .filter((v) => {
      const k = v.text.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 10);
  return { used, dropped: [] as { review: T; reason: string }[] };
}
const select = SELF_TEST ? OLD : selectGuestVoice;

const g = (text: string, rating?: number) => ({ text, ...(rating !== undefined ? { rating } : {}), source: "google_places" });
const LONG = " — hosszabb vendég-vélemény, hogy átmenjen a hossz-szűrőn.";

{
  // Mandula: mind ★1.
  const r = select([g(`Felháborító, vállalhatatlan élmény${LONG}`, 1), g(`Lehúzás, kosz, átverés${LONG}`, 1)]);
  check(r.used.length === 0, `★1 vélemény nem megy a szövegírónak (kapott: ${r.used.length})`);
  check(SELF_TEST || r.dropped.every((d) => d.reason === "stars"), `…és a kiszűrt „stars" okkal látszik a nézetben`);
}
{
  const r = select([g(`Közepes, de a kert szép${LONG}`, 3), g(`Csodás panoráma a teraszról${LONG}`, 4), g(`Tökéletes pihenés${LONG}`, 5)]);
  check(r.used.length === 2 && !r.used.some((v) => v.rating === 3), `★3 kiesik, ★4 és ★5 marad (kapott: ${r.used.map((v) => v.rating).join(",")})`);
}
{
  const r = select([{ text: `Portál-vélemény csillag nélkül${LONG}`, source: "szallas.hu" }]);
  check(r.used.length === 1, `csillag nélküli portál-vélemény MARAD (pozitív kontroll; kapott: ${r.used.length})`);
}
{
  const r = select([{ text: `Tízes skálán közepes${LONG}`, rating: 6, source: "booking" }, { text: `Tízes skálán kiváló${LONG}`, rating: 9.2, source: "booking" }]);
  check(r.used.length === 1 && r.used[0]!.rating === 9.2, `10-es skála: 6 kiesik, 9,2 marad (kapott: ${r.used.map((v) => v.rating).join(",")})`);
}
{
  // A generálás TÉNYLEG ezt a láncot hívja (nem egy párhuzamos másolatot).
  const src = readFileSync(new URL("../src/generator/generateEngine.ts", import.meta.url), "utf8");
  check(/selectGuestVoice\(\[\.\.\.googleVoice, \.\.\.portalVoice\]\)/.test(src), `generateEngine a selectGuestVoice-t hívja a vendég-hangra`);
}

for (const o of oks) console.log(`  ✓ ${o}`);
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(`\nguest-voice-stars-check: ${oks.length} pass / ${fails.length} fail${SELF_TEST ? " (ÖNTESZT: a pirosnak KELL buknia)" : ""}`);
if (SELF_TEST) {
  if (fails.length === 0) {
    console.error("\n⛔ ÖNTESZT-BUKÁS: a visszarontott viselkedésre az őr ZÖLDET adott.");
    process.exit(1);
  }
  console.log(`✅ ÖNTESZT RENDBEN: ${fails.length} állításon pirosra ment a visszarontott viselkedésen.`);
  process.exit(0);
}
if (fails.length) process.exit(1);
console.log("✅ a szövegíró csak ≥4★ (vagy csillag nélküli) vendég-hangot kap");
