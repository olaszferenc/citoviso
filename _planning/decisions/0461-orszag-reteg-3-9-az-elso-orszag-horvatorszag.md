## ADR-0461 — Ország-réteg 3/9: az első ország, Horvátország — ország-sor migrációban, a küldési ablak a sorból, a §C-kapu a jogi csomagból

**Státusz:** ELFOGADVA (tulaj-döntések 2026-11-19 a koordinátoron át, brief
`orszag-reteg-3i-horvat-nyitas-elek-20261119.md`, koordinátor `cit9b4690e3`) ·
**Épít:** ADR-0437 (ország-réteg), ADR-0111 (piac-kapu), ADR-0443 (pénz-út, saját pénznem), ADR-0456
(megkeresés az ország nyelvén), ADR-0458 (jogi csomag), ADR-0460 (Országok lap, `countryReadiness`).

### Kiváltó

A 3/8 után minden készen állt egy első ország felvételéhez, de: (1) a `send_window_from/to` oszlopot a
küldés nem olvasta (ADR-0460 nyitott tétele); (2) két e2e a bg Bábel-mag óta piros volt, mert a „csomag
nélküli” nyelvet a bolgárral mérték; (3) a §C-kapu a levél jogi sorát a UI-katalógusból (`T()`) várta, a
levél viszont a JOGI CSOMAGBÓL írja (`draft.ts` → `legalTextForLang`). Ahol Bábel a UI-másolatot nem
fordította le (it, hr), ott a kapu a magyar mondatot kereste volna a horvát levélben, és a teljesség-mérés
egy soha meg nem jelenő feliratot számolt hiánynak.

### Döntés

① **A HR ország-sor migrációban** (`0142_country_hr.sql`, additív, `ON CONFLICT DO NOTHING`): valós
master-adat — EUR, hr, Europe/Zagreb, +385 / 0, mobil 91 92 95 97 98 99, `.hr` + `.com`, horvát portálok,
ünnepnapok a Zakon o blagdanima (NN 110/2019) szerint: a fix napok évente, a húsvét, húsvéthétfő és úrnapja
2026-ra és 2027-re külön; csatorna CSAK e-mail (tulaj: külföldi SMS/MMS-szolgáltató egyelőre nincs, a
csak-mobilos HR lead TARTVA); ablak 8–17 helyi idő; IFA-modell `none` (a horvát magánszállásadó a
boravišna pristojbát ágyanként évi átalányban fizeti, nem foglalásonként). Mellette az ÜRES, nem
jóváhagyott `hr` ár-régió (EUR) — ugyanaz, amit a konzol „+ Új ár-régió” gombja hoz létre. ⛔ Ár nem kerül
bele (a tulaj állítja be a konzolon, országonként saját pénznemben, átváltás nélkül), `market` sor sincs: a
piac ZÁRVA marad, az Országok lap a hiányt mutatja.

② **A küldési ablak a sorból:** a hideg megkeresés ablaka = az ország-sor `send_window_from/to` ∩ a tulaj
`MOCK_OUTREACH_WINDOW`-ja, az ország időzónájában, munkanapon (`countryOutreach.ts outreachHoursOf`). A sor
csak szűkíthet, a tulaj 8–17-e a plafon; nem fedő ablak = soha, látható okkal. A HU sor 8–20-a a tulaj
ablakát tartalmazza → a HU út bájtra a régi (a budapesti mondat is). A CRM válasz-ablaka változatlan.

③ **A §C-kapu a levél jogi sorát a jogi csomagból várja** (`outreachCheck.ts` →
`legalTextForLang(lang, OUTREACH_LETTER_LEGAL_V1)`), ugyanonnan, ahonnan a levél írja. A UI-katalógusból
ezzel kikerül a felirat (7218 → 7217).

④ **Teszt:** `scripts/country-hr-e2e.mts` (scratch DB, böngészőben az Országok lap): a migrált sor
hibátlan, csak az ársor hiányzik → zárva; a teszt-ársorral minden tétel zöld → a lapon megnyitható → HR
mock horvátul, `.hr` javaslat, a levél horvátul EUR-ral, Zágráb szerinti ablak (ünnepnapon zárva),
csak-mobilos lead TARTVA, tenant-impresszum horvátul OIB-vel és kategorizálási határozattal, HU bájtra
azonos. A teszt-ársor (`scripts/lib/hr-open-fixture.mts`) a HU ársor 1 € = 390 Ft-os átváltása — KIZÁRÓLAG
scratch DB-ben (a fixtúra más adatbázison megtagad). A „csomag nélküli nyelv” TARTVA-mérése a két régi
e2e-ben (`country-outreach-e2e`, `country-mock-e2e`) a románra került (nincs ro csomag, nincs mag).

### Következmény

- A deploy után a HR sor élesen is megjelenik az Országok lapon, zárt piacként; a nyitás = a tulaj árai a
  `hr` régióban + Bábel hiányzó felirata + a tulaj jóváhagyása.
- HR leadre élesen is készülhet mock (zárt piacon is — ADR-0111 ⑤), a hr csomaggal.

### Nyitott

- Bábel: az eszkalációs levél jogi sora („…a döntés-segítő ajánlata hamarosan lejár…”) it/hr nyelven
  hiányzik → amíg nincs, a HR teljesség-tétel „1 hiányzik”.
- A levél és a foglalás-modul leírása országtól függetlenül a Szállás.hu-t is felsorolja a naptár-szinkron
  portáljai közt; országonkénti portál-lista = új felirat-változat + Bábel (koordinátori tétel).
- Számlanyelv: a sor `invoice_lang = hr`; a Számlázz.hu horvát számlanyelvét a számla-kör ellenőrzi
  (ma a számla nyelve fix `hu`, MEMORY 11-11).
