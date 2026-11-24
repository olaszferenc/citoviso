## ADR-0475 — HR dev-próba (Makarska): település-index mint ingyenes portálkép-forrás + a felderítés hamis „saját honlap” ítéletei

**Státusz:** ELFOGADVA (brief `hr-dev-lead-proba-20261123`, koordinátor `cit9b4690e3`; SUB `citfe6a479b`) ·
**Épít:** ADR-0337 (attachPhotoLinks), ADR-0437 (ország-réteg), ADR-0456, ADR-0467 (gyűjtés országfüggően), ADR-0470 (HR végpróba).

### Kontextus
A tulaj 2026-11-23-án azt kérte, hogy egy horvát tengerparti településen a dev-en, élesen futó módon szerezzünk leadet.
A Makarskán (2,5 km-es kör) végigvitt próba a közös dev DB-n mérve: 74 hely → 70 mentve → 47 lead → 34 kontaktos →
7 e-mailes → 7 db ≥5 képes → 1 levélre kész lead (a ≥5 saját kép a kiküldés kapuja, 4fd41a77).
A honlap nélküli HR leadnek $0 mellett nem volt képe (ADR-0470): a Places fizetős, a portál-adapterek magyarok, és a
kolléga-lánc headless keresője innen nem használható (a Bing az idézőjeles nevet és a települést figyelmen kívül
hagyja, budapesti „Villa” találatokat ad; a Brave 429-et ad).

### Döntés
① **Település-index, országfüggően.** Az ország szótára (`src/countryLexicon/<iso2>.json`) `portalTownIndexes`
kulcsa URL-mintákat sorol (`{town}` helyőrzővel). HR: `https://www.apartmanija.hr/apartmani/{town}`, egy statikus
lap a település összes kártyájával (név, tű, link; Makarska: 202 db; a robots engedi). A
`src/scraper/sources/portals/townIndex.ts` a kártyák közül csak JAVASOL: közös márkaszó (a szótár általános szavai
nem számítanak) és legfeljebb 1 km-es tűtávolság, a legközelebbi 3. A tulajdonítás az `attachPhotoLinks` dolga
(entitás-kapu, fotószűrő, provenance `portal`), az index ezt nem kerüli meg. A lépés neve:
`scripts/portal-town-index.mts` (a <5 saját képes no_site/outdated leadek). Kulcs nélküli ország (HU) változatlan.
**Sorrend:** előbb a kontakt (telefon), utána a kép. A telefon nélküli leadnél a kapu csak név, település és
távolság alapján dönt, és egy gyakori keresztnévre (Nikola, Antonio) „magas” egyezést adhat.

② **A felderítés hamis „saját honlap” ítéletei (javítva):**
- A régió-szavak közül kiesnek a csupa számjegyből álló szavak. Egy dátumos címkéből a „2026” földrajzi szó lett,
  és minden „© 2026” + márkaszavas oldal átment (18 „rejtett honlapból” 13 hamis volt).
- `isAffiliateRedirect`: ha a kitalált domain egy másik domainre visz, és a cél query-je URL-t vagy a kitalált
  hosztot hordozza, az aggregátor- vagy partnerlink-továbbítás, nem saját honlap (housity.net, buiibo.com).
- A `%`-kódolt `mailto:` cím dekódolva kerül a leadbe (`%20info@…` visszapattant volna).
- HR `tradeWords` + central, centar, center, centre, city, penthouse. A „Central Beach 9” a „central” szón
  60 idegen fotót kapott volna.

③ **Kontakt-csatorna az ország-sorból:** a mobil csak ott „sms”, ahol a sor mobil-csatornát nyit. HR-ben (csak
e-mail) a mobil „voice”. A konzolos adatmentés újraszámolja a csatornát.

④ **§C keretezés idegen nyelven:** a tulaj levelének lefordított horga keretező jel (`foreignGateMarks`). Enélkül
egyetlen külföldi hideg levél sem ment volna ki.

### Nem döntés — a koordinátorhoz / a tulajhoz megy
- A kolléga-lánc (repón kívül) kontaktkeresője a housity-átirányítást saját honlapnak vette, és az aggregátor
  e-mailjét adta volna kontaktnak. A megtalált saját honlapot nem írja a lead `website` mezőjébe, így a lead
  `no_site` marad (Maritimo: modern honlap → „nincs honlapja” megkeresés lett volna). A Bing HR-re használhatatlan.
- A lánc átnézője (`egylepes-elo/kor.sh`) prod-kötött, dev-en nem futtatható.
- Az entitás-kapu telefon és házszám nélkül, gyakori keresztnévre „magas” egyezést ad (HU-n ugyanígy működik).

### Következmény
`country-collect-regress` +10 ellenőrzés (HU azonos), `experiment-selftest` ⑪ (horvát levél §C). A
`outreach-from-price-check` csak HU prospecten mér (a dev DB legújabb prospectje horvát lett).
