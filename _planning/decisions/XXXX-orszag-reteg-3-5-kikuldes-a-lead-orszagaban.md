## ADR-XXXX — Ország-réteg 3/5: a hideg megkeresés a lead országának nyelvén, ablakában, csatornáján és kvótájával megy — hiányzó nyelvnél TARTVA

**Státusz:** ELFOGADVA (tulaj 2026-11-17, „Ok” a kiküldés lépésre; brief `orszag-reteg-3e-kikuldes-20261117.md`, koordinátor `cit9b4690e3`; nyelvi pontosítás: tulaj-szabály 2026-11-17 a koordinátoron át) ·
**Épít:** ADR-0437 (ország-réteg), ADR-0443 (pénzút), ADR-0450/0452 (`phoneCountry.ts`), ADR-0455 (CRM: `countryClock`, `public_holidays`), ADR-0409 (kiküldési sor), ADR-0334 (mock-ablak), ADR-0111 (piac-kapu) ·
**Forrás:** `_planning/RESEARCH-2026-11-11-orszag-reteg-diagnosztika.md` 4. szakasz.

### Kiváltó

A kiküldés +36-ra és Budapestre volt kötve: mobil = „+36 20/30/31/50/70”, a mock-ablak budapesti
falióra, egy közös napi 40-es kvóta, a levél ára forintban, hiányzó fordításnál magyar fallback, az
SMS minden nyelven GSM-7-re hajlítva (egy cirill szöveg kiürült volna), és a §C-kapu magyar szavakat
keresett (egy lefordított levél sosem ment volna át).

### Döntés

① **Csatorna az ország-sorból** (`country.outreach_channels`, 0133 óta megvan; HU = a mai teljes
készlet). Az MMS+SMS pár a helyi modemen megy (magyar SIM, `docs/mms-send.md`): csak akkor nyitott,
ha a sor engedi az `mms`-t ÉS az `sms`-t, ÉS az ország hívószáma a modemé (36). Különben a mobil
megkeresés TARTVA, látható okkal — SOHA nem SMS-re cserélve, SOHA nem nemzetközi MMS a magyar
SIM-ről. Új szolgáltatót nem kötöttünk be: egy piac saját mobil-vonala koordinátori döntés.
(`src/outreach/countryOutreach.ts`: `modemPairBlocks`, `messengerBlocks`, `leadMobileIn`.)

② **Mobil-felismerés nemzeti szabállyal:** a jóváhagyási sor, a kiküldés mobil-kapuja, a jóváhagyó
másolat, a próbaidő-kampány, a lead-adat mentése (presence-kérés) és a messenger-presence listák a
lead országának számrendjén (`normalizePhoneIn` / `isMobileE164In`); az S10 `norm()` bármely
hívószám E.164-ét elfogadja („+…”), a magyar alakok változatlanok.

③ **Küldési ablak a lead helyi idejében:** hétköznap, `MOCK_OUTREACH_WINDOW` órái (a tulaj 8–17-je),
a lead zónájában, az ország `public_holidays` napjain zárva (`outreachWindowBlocksIn` a
`countryClock`-ra). Ismeretlen ország = nem ütemezhető. A HU-sor a budapesti mondatot adja, bájtra.

④ **Sor és kvóta országonként** (ADR-0409): a kiküldő azokból az országokból vesz, amelyek ablaka
nyitva és saját napi számlálója nem telt be; a sorrend (honlap nélküliek, e-mailesek elöl) országon
belül változatlan. Kvóta: HU = `outreach_auto.dailyCap` (ma 40); más ország saját számlálóval, a
`outreach_auto.countryCaps[ISO]`-ból, különben a sor `daily_quota`-jából; a nap az ország zónájában.
`outreach_dispatch.country` (0140, additív; NULL = 0140 előtti magyar sor, a HU-számláló számolja).
CLI: `outreach-dispatch.mts cap <n> --country=XX`. A jóváhagyási sor többországos esetben
országonként számol („Jóváhagyásra vár: 5 BG 1 · CZ 2 · HU 2”).

⑤ **Nyelv = az ország alapértelmezett nyelve, és csak az** (tulaj 2026-11-17): a megkeresés a sor
`default_lang`-ján megy, nem a lead/mock egyéni nyelvi jelzésén. A render begyűjti a magyar
fallbackjeit (`collectFallbacks` → `untranslated`); egyetlen hiányzó szöveg (aláírás, leiratkozó
sor, ár-felirat is) az EGÉSZ megkeresést tartja. Küldéskor a hiányos csomag oka „Bábelre vár …
TARTVA, magyarul nem megy ki”. Az összeg a lead régiójának pénznemében (`formatMinor`); a forint-
mondat a HUF-ág, más pénznem saját mondatot kap (`foreignPrice.ts`, a magyar levél-család
kritikus-ujjlenyomatán kívül: magyar levélben sosem jelenik meg).

⑥ **Kiküldés-ellenőrző** (`outreachCheck.ts`): NYELV-ok, ha a nyelv nem az ország nyelve, ha egy
szövegrész nincs lefordítva, vagy ha egy nem magyar szöveg nyelvi teljessége nem mért (egy még be
nem kötött követő-szöveg így zártan áll). Nem magyar levélben a HIRDETŐ / KERETEZÉS / JOGALAP
elemeit a forrásmondatok FORDÍTÁSÁBAN keresi; az ár-hirdetést a pénznem jeléből ismeri fel. A
`lang!=="hu"` kapu helyett a forrásnyelv (`DEFAULT_LANG`). Cirill/görög SMS nem hajlik GSM-7-re
(UCS-2, 70/67 karakter/szelet), a személyre szabás a név írásában hasonlít.

⑦ **Prospect-keret és leiratkozó lap:** a feliratok `T()` alatt a lap nyelvén (`prospectNotice.ts`,
a leiratkozás megerősítő lapja). A jogi bekezdések (LEGAL_BASIS, TRACKING_NOTICE) érintetlenek: a
jogi csomag (7. lépés) dolga. A **süti-sáv** (`cit-consent.js`) felirat-csomagolása KÉSZ, de nem
ebben a landban: a felület-kapu (§2b) tulaj-jóváhagyást kér rá (magyar lapon vizuálisan azonos) —
patch: `~/rc-briefs/orszag-reteg-3e-suti-sav-i18n.patch`.

### Ami NEM változott

A HU-kiküldés: ablak (két hetes, DST-n átívelő söprés: mondatra azonos), mobil-ítélet, csatorna,
kvóta (40), levél és SMS szövege, ellenőrző (a magyar levél-család ujjlenyomata a rögzített PASS-é).
A hirdető-azonosító a Citoviso (magyar cég) sajátja, ezért az adószám-minta marad a magyar.

### Mérés

- `scripts/country-layer-check.mts` ⑨ (pre-commit): a kiküldés-fájlokban nincs +36 /
  `isHuMobileE164` / budapesti mock-ablak / HUF-összeg / `lang==="hu"` (ALLOW indoklással), a
  bekötések élnek, a HU-sor ablaka/mobilja/kvótája a régi.
- `scripts/country-outreach-e2e.mts` (scratch DB, HU + CZ + BG, minden küldő mock): 42 ellenőrzés zöld.

### Visszafordíthatóság

🔄 — egy additív oszlop (0140); a kód a HU-soron a régi értékeket adja. Visszaállítás = a commit visszavonása.
