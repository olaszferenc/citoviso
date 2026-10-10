# Horvát piac (EU-s nyitás) — számlázás, adó, jog · előkutatás a tanácsadói egyeztetéshez

**Dátum:** 2026-10-10 · **Státusz:** KUTATÁS, nem döntés. Az adó- és jogi következtetéseket adószakértőnek
és könyvelőnek kell megerősítenie. A kódhoz NEM nyúltunk.
**Kiindulás (a repóból, nem feltételezés):** az eladó magyar **egyéni vállalkozó, alanyi adómentes (AAM)**,
adószám 92227011-1-33 (ADR-0098, ADR-0206). Számla Számlázz.hu-n, fizetés Barionon, kártyával. A Kft.-váltás a
pilot sikerétől függ (ADR-0098). A piacot ORSZÁGONKÉNT nyitjuk, és csak kész jogi csomaggal (ADR-0111).
**A termék adójogi szemmel:** automatikusan generált, előfizetéses honlap és tárhely, modulokkal, opcionálisan
domainnel. Ez a HÉA-irányelv II. melléklete szerint valószínűleg **elektronikusan nyújtott szolgáltatás (ESS)**
(„weboldal-szolgáltatás, webtárhely”). Ezt is a tanácsadónak kell megerősítenie, mert a besoroláson múlik a B2C-ág.

---

## 1. ÁFA: három vevőtípus, három szabály

| Horvát vevő | Teljesítési hely | Mit számlázunk | Kódban ma |
|---|---|---|---|
| **A. Adóalany, PDV-azonosítóval** (HR + OIB, a VIES-ben érvényes) | Horvátország (Áfa tv. 37. §, B2B főszabály) | ÁFA nélkül, **„Fordított adózás / Reverse charge”**, mindkét közösségi adószámmal. A horvát vevő maga fizeti a **25%** horvát PDV-t. | ✅ megvan: `reverse_charge` csak VIES-szel igazolt számnál (ADR-0055 ④, DB CHECK), `vatKey: "TAM"` |
| **B. Magánszemély, nem vállalkozó** (B2C) | ESS-nél: évi **10 000 €** alatt Magyarország, fölötte Horvátország | 10 000 € alatt AAM (mint ma). Fölötte **horvát 25% ÁFA, OSS-en** (NAV-on át bevallva), vagy a 2025-ös **SME-rendszerrel** horvát mentesség (lásd 1.3) | ⚠️ az AAM-ág van meg, a 10 000 €-s számláló és az OSS-ág nincs |
| **C. Vállalkozó, de NEM adja meg a PDV-azonosítóját** | Vitatott, lásd 1.2 | — | ⚠️ ma B2C-ként AAM-ba esik |

### 1.1 Amit a magyar oldalon el kell intézni a nyitás ELŐTT
- **Közösségi adószám** a NAV-nál. AAM-os EV is kérheti, és B2B szolgáltatásnyújtáshoz más tagállamba kötelező
  (a fordított adózású számlán szerepelnie kell). ⚠️ Az ADR-0055 erről nem rendelkezik: az eladó saját közösségi
  adószáma ma nincs a számlán. **Számlázz.hu-beállítás + ellenőrzés kell.**
- **Összesítő nyilatkozat (A60)** azokra a hónapokra, amelyekben fordított adózású szolgáltatás ment EU-s adóalanynak.
  Gépi tétel: az `invoice.vat_treatment='reverse_charge'` sorokból havonta előállítható, a könyvelőnek átadható.
- **Az AAM-plafon (18 M Ft)**: a külföldi teljesítési helyű ügylet NEM számít bele (ADR-0098 ③, Áfa tv. 188. §).
  A konzol AAM-őre ezt már így számolja.
- **EUR-számla:** a Barion EUR-t is kezel, a `global` régió árai EUR-ban vannak (`src/pricing.ts`). ÁFA nélküli
  számlán az MNB-árfolyamos forint-átszámítás nem kötelező, de a könyveléshez a forintérték kell. Ezt a könyvelő mondja meg.
- **NAV Online Számla:** 2021 óta a külföldi vevőnek szóló számla is adatszolgáltatás-köteles. A Számlázz.hu ezt elvégzi.

### 1.2 A „C” eset a legnagyobb nyitott adókérdés
A 282/2011/EU végrehajtási rendelet 18. cikk (2) szerint az eladó nem adóalanynak tekintheti a vevőt, ha az nem adott
meg PDV-azonosítót, **„hacsak nem rendelkezik ellenkező információval”**. Mi a vevőt pont azért keressük meg, mert
**szállásadó**, vagyis ellenkező információnk van. Ráadásul a horvát magánszállásadók (paušalisti) **jellemzően
RENDELKEZNEK PDV-azonosítóval**: a Booking/Airbnb jutalékuk után kötelesek a 25%-os horvát PDV-t fordítottan
megfizetni, ezért a platform-szerződéshez kérniük kell. A horvát adóhatóság véleménye szerint a külföldi portál
hirdetési díja után is fizetniük kell a PDV-t, akkor is, ha nincsenek a PDV-rendszerben.
**Gyakorlati javaslat (tanácsadóval egyeztetni):** horvát vevőnél „szállásadóként rendelek” → a PDV-azonosító
KÖTELEZŐ mező, VIES-szel ellenőrizve. Magánszemély-ág csak annak legyen, aki nem üzleti célra vásárol.

### 1.3 A B2C-ág fölött: OSS vagy SME
- **10 000 €-s küszöb:** az EU-n belüli, MÁS tagállamba menő B2C ESS + távértékesítés összege, **az összes tagállamra
  együtt**, az adott ÉS az előző naptári évben. Átlépéskor a küszöböt átlépő ügylettől kezdve a vevő országának
  ÁFÁ-ja jár. Ehhez a rendszernek tudnia kell számolni (ma nem tudja).
- **OSS (egyablakos rendszer):** negyedéves bevallás a NAV-nál, horvát 25%. AAM-os adóalany regisztrálhat, de a
  pontos következményt (az AAM megmarad-e belföldön) a könyvelőnek kell megerősítenie.
- **SME-rendszer (2025-01-01 óta):** az EV a horvát kisvállalkozói mentességet is igénybe veheti (horvát küszöb
  **60 000 €**), ha az EU-s éves árbevétele 100 000 € alatt van, és a NAV-nál bejelentkezik (EX-azonosító). Ekkor a
  horvát B2C sem lenne ÁFÁ-s. **Kérdés a tanácsadónak: melyik az olcsóbb és egyszerűbb, és összefér-e a kettő.**

### 1.4 Üzleti következmény: a horvát B2B-vevőnek a mi árunk +25%-ba kerül
A fordított adózásnál a horvát paušalist maga fizeti a 25% PDV-t, és **nem vonhatja le** (nincs a PDV-rendszerben).
A „booking-jutalék kiváltása” érv ettől erősebb is lehet, mert a Booking-jutalékra ugyanúgy rárakódik a 25%.
Az árazásnál (EUR-lista, `global` régió) ezzel számolni kell. Döntés a tulajé.

---

## 2. Jövedelemadó, forrásadó, telephely
- **Magyar adóilletőség, nincs horvát telephely** (iroda, alkalmazott vagy helyi képviselő nélkül) → a jövedelem
  Magyarországon adózik, a mostani EV-adózás szerint.
- **Horvát forrásadó (15%):** a horvát kifizetőnek bizonyos, nem rezidensnek fizetett díjakból le kell vonnia
  (jogdíj, szellemi tulajdon; piackutatás, adó- és üzleti tanácsadás, könyvvizsgálat). A tárhely/SaaS nincs a felsorolt
  szolgáltatások közt. **Kérdés a tanácsadónak:** minősülhet-e az előfizetés **jogdíjnak** (szoftver-használati jog), és
  ha igen, mennyi a HU–HR egyezmény (1996, MLI-vel módosítva) 12. cikk szerinti kulcsa. Az egyezményes kedvezményhez a
  vevőnek előre kellhet a mi **illetőségigazolásunk**. Ha ez igaz, az egész modellt érinti: a kártyás fizetésnél nincs
  hol levonni.

---

## 3. Számla-formai teendők (Számlázz.hu)
- A számla nyelve: ma a tétel-szöveg magyar, szándékosan (`src/payment/service.ts`, „LEGAL pack” komment).
  Horvát vevőnek **kétnyelvű (HU/HR vagy HU/EN) számla** kell. A Számlázz.hu többnyelvű számlát tud, a horvát nyelv
  támogatását **ellenőrizni kell**.
- Fordított adózásnál kötelező a „Fordított adózás” szöveg, a vevő HR-azonosítója és a SAJÁT közösségi adószámunk.
- Pénznem: EUR. Horvátország 2023 óta euróövezet.
- ⚠️ **Fiskalizacija 2.0 (2026-01-01):** a belföldi horvát B2B e-számla kötelezettség. Külföldi, horvát telephely
  nélküli eladóra várhatóan nem vonatkozik. **Megerősítendő.**

---

## 4. Jog — a piac-kapu (ADR-0111) feltételei Horvátországra

| Tétel | Mi kell | Megjegyzés |
|---|---|---|
| **ÁSZF, elállás, adatkezelés, DPA horvátul** | A `src/legal.ts` ma egyetlen (magyar) csomagot ismer | Az ADR-0111 nyitott pontja. Horvát jogász fordítsa/igazítsa, ne gépi fordítás (§H.22) |
| **Alkalmazandó jog** | Az ÁSZF-ben magyar jog választható | Fogyasztónál a Róma I. 6. cikk miatt a horvát fogyasztóvédelmi minimum ettől függetlenül érvényes, ha horvát piacra irányulunk |
| **Fogyasztó-e a vevő?** | A szállásadó a szolgáltatást üzleti célra veszi, ezért jellemzően NEM fogyasztó | A kód ma az `individual` vevőt fogyasztónak kezeli (elállási lemondó nyilatkozat). Horvátországban ez óvatos, de helyes alapállás |
| **⚠️ Hideg megkeresés (e-mail, SMS, MMS)** | A horvát elektronikus hírközlési törvény (ZEK, NN 76/22) **természetes személynek** szóló direkt marketing e-mailhez **előzetes hozzájárulást** kér (opt-in). A szakirodalom szerint jogi személyre ez nem egyértelmű | **Ez a modell legnagyobb jogi kockázata.** A horvát szállásadók többsége természetes személy. A magyar jogalap-döntés (lezárt, nem nyitjuk újra) **NEM vihető át automatikusan**: horvát jogászi vélemény kell, mielőtt egyetlen mock kimegy. Ha opt-in kell, a horvát tölcsér más csatornára épül (pl. hirdetés, partner, ügynökség) |
| **GDPR (lead-gyűjtés)** | Ugyanaz a rendelet. A horvát felügyelet az AZOP | A 14. cikk szerinti tájékoztató horvátul |
| **Tenant-oldal jogi lábazata** (ADR-0110) | A horvát e-kereskedelmi törvény (ZET) szerinti szolgáltató-adatok; szállásadónál OIB, kategorizálási határozat, turisztikai adó jelzése | A tenant-csomag ma magyar szabályokra hivatkozik. Horvát változat kell, különben hamis jogi dokumentumot publikálunk (az ADR-0111 pont ezt zárja ki) |
| **.hr domain** | A CARNET szerint EU-s cég VIES-ben érvényes ÁFA-számmal regisztrálhat. Magánszemélynek horvát lakóhely kell. A `.com.hr` kötetlenebb | Az ADR-0056 §4 szerint a domain **a mi nevünkre** kerül → a közösségi adószámunk itt is kell. A regisztrátornál ellenőrizendő |

---

## 5. A rendszerben már kész vs. ami hiányzik (csak felmérés, kód nem változott)

✅ **Kész:** piac-kapu országonként (`market` tábla, három fail-closed kapu) · VIES-ellenőrzés és `reverse_charge`
DB-szintű kényszerrel · EUR-régió · ÁFA-kulcs soronként, konfigurációs váltással · AAM-őr, amely a külföldi
teljesítést kihagyja.

⛔ **Hiányzik a horvát nyitás előtt:**
1. A saját közösségi adószámunk a számlán és a konfigurációban.
2. Kétnyelvű számla-szöveg (a tétel-szöveg ma magyar fix).
3. 10 000 €-s B2C-számláló, plusz OSS- vagy SME-ág (vagy döntés: horvát B2C-t nem fogadunk, csak PDV-azonosítós vevőt).
4. Horvát vevőnél kötelező PDV-azonosító a „szállásadóként” ágon (1.2).
5. Horvát jogi csomag: ÁSZF, elállás, adatkezelés, DPA, tenant-lábazat.
6. Horvát outreach-jogalap. Amíg nincs, a piac-kapu ZÁRVA marad, és csak lead-gyűjtés és mock megy (ADR-0111 ⑤).
7. Havi A60-export a könyvelőnek.

---

## 6. Kérdéslista az adószakértőnek / könyvelőnek (bevihető egy az egyben)

1. Az automatikusan generált honlap + tárhely + modulok előfizetése **elektronikusan nyújtott szolgáltatás**-e (ESS)?
2. AAM-os EV-ként: a közösségi adószám igénylése és a fordított adózású B2B-számlázás milyen bevallási terhet hoz
   (A60 gyakorisága, áfabevallás)? Megmarad-e a belföldi AAM?
3. Horvát B2C: OSS vagy SME-rendszer (horvát 60 000 €-s mentesség)? Melyik összefér az AAM-mal, és melyik olcsóbb?
4. A PDV-azonosítót nem adó horvát szállásadót B2C-ként számlázhatjuk-e, ha tudjuk róla, hogy vállalkozik (282/2011 18. cikk (2))?
5. Lehet-e az előfizetés **jogdíj** a horvát forrásadó szempontjából? Ha igen, mennyi a HU–HR egyezményes kulcs, és kell-e
   illetőségigazolás?
6. EUR-számla ÁFA nélkül: kell-e forintérték a számlán, milyen árfolyammal könyveljük, és mi a Barion-jutalék/kifizetés
   kezelése EUR-ban?
7. Kft.-váltás előtt vagy után érdemes nyitni (közösségi adószám, OSS-regisztráció és szerződések átvitele)?

**Horvát jogásznak:** (a) ZEK szerinti hideg e-mail/SMS természetes és jogi személy szállásadónak; (b) ÁSZF és
fogyasztói státusz; (c) tenant-oldal kötelező tartalma (ZET + szálláshely-szabályok); (d) .hr domain a mi nevünkre.

---

## Források (2026-10-10, webes keresés; több forrás régebbi, a hivatalos szöveggel ellenőrizendő)
- Horvát PDV, szállásadók, EU-s szolgáltatás: https://www.rrif.hr/PDV_obveze_gradana_iznajmljivaca-2448-misljenje/ ·
  https://www.tportal.hr/vijesti/clanak/porezna-uprava-uputila-vaznu-obavijest-gradanima-evo-sto-kazu-u-njoj-20200213 ·
  https://fiskalopedija.hr/baza-znanja/izdavanje-racuna-inozemstvo-unutar-eu ·
  https://rrif.hr/Registriranje_za_potrebe_PDV_a_i_obveze_obracuna_P-2566-misljenje.html
- Horvát forrásadó: https://porezna-uprava.gov.hr/en/profit-tax/7365 · https://taxsummaries.pwc.com/croatia/corporate/withholding-taxes ·
  https://crowe.com/hr/en-us/news/frequently-asked-questions-regarding-withholding-tax
- HU–HR egyezmény: https://porezna-uprava.gov.hr/en/double-taxation/7387 ·
  https://ngmszakmaiteruletek.kormany.hu/akadalymentes/download/4/c5/f2000/Croatia_synthesised%20text.pdf
- ZEK / direkt marketing: https://narodne-novine.nn.hr/clanci/sluzbeni/2022_07_76_1116.html ·
  https://cms.law/en/int/expert-guides/cms-expert-guide-to-data-protection-and-cyber-security-laws/croatia
- AAM, közösségi adószám, SME: https://adozona.hu/kerdesek/2025_3_14_Kisvallalkozasok_kozossegi_alanyi_rgt ·
  https://adozona.hu/afa/Alanyi_mentes_vallalkozas_kozossegen_beluli_RV3D06
- .hr domain: https://en.wikipedia.org/wiki/.hr · https://support.openprovider.eu/hc/en-us/articles/360000755468--hr
