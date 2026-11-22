## ADR-0470 — Nemzetközi: HR végpróba (felderítéstől a fizetésig) + vevő-oldali zsákutcák a látogató nyelvén

**Státusz:** ELFOGADVA (tulaj-jóváhagyás 2026-11-22 „ok mehet” a koordinátoron át, `cit9b4690e3`; brief
`nemzetkozi-hr-vegproba-20261122.md`, SUB `cit41e31dd4`) · **Épít:** ADR-0437, ADR-0455, ADR-0456, ADR-0461,
ADR-0464, ADR-0465, ADR-0466, ADR-0467, ADR-0468.

### Döntés

① **A HR végpróba egy szkript:** `scripts/hr-vegproba-e2e.mts` — EGY horvát szállás (Lavanda) a valódi küldési
úton kiment hideg levéltől a rendelésig és a fizetés indításáig, és egy második (Đurđa) a zágrábi ablak/ünnepnap
→ leiratkozás → horvát elutasítás ágon, ahol utána egyik küldő (hideg, nem-nyitó, viselkedés, próba-kampány,
eszkaláció) sem éri el. `--barion-test`: a valódi Barion-átjáró a SANDBOX ellen (`scripts/lib/hr-world.mts`
`payment: "barion-test"`, csak `api/secure.test.barion.com`-ra mutató `.env`-vel indul, a kerítés csak ezt a
két hostot engedi).

② **Euró-fizetés — mérve 2026-11-22:** éles beállítással (`BARION_WALLET_CURRENCIES` nincs → HUF) a HR piac
ZÁRVA, az ok a hiányzó EUR-tárca; a beérkező rendelés fizetési link nélkül függőben, a vevő horvát „megkaptuk”
levelet kap. A Barion **TESZT-bolt sem fogad EUR-t** („NotExistingCurrency — Payment is not supported”), így az
euró-fizetés sandboxban sem járható végig, amíg a teszt-boltban nincs EUR-tárca (tulaj-teendő, a tárca-döntés
része).

③ **A §C ország-kapu a valódi okot mondja:** `MarketVerdict.reasons` (a `marketGate` okai) → „a HR piac nincs
nyitva (… EUR-tárca …)”; ok nélkül a régi „jogi csomag nincs jóváhagyva” mondat. A lefordított **nem-nyitó
levél** terv-mondata („Készítettünk Önnek egy honlaptervet …”) keretezés-jel: e nélkül egyetlen idegen nyelvű
nem-nyitó levél sem ment volna ki.

④ **Vevő-oldali zsákutca a látogató nyelvén** (konzol): ismeretlen fizetés (`/pay/done`, `/pay/go`), hibás
`/p/…` link, a vevő-útvonalak (`/p|pay|configure|mock|site/`) 404-e: `?l=`/`?lang=`, majd Accept-Language —
csak ország-sorban szereplő nyelv; különben a régi magyar lap. A konzol keretes 404-e vevő-útvonalon nem jelenik
meg. A mock nyelv nélküli `/adatvedelem` linkje a hivatkozó mock nyelvére irányít (`?l=<lang>`); hivatkozó nélkül
a magyar tájékoztató változatlan.

⑤ **A tenant Jogi adatai** az első (lead-)rendelésből is előtöltődnek (név, cím, e-mail, adószám), ha a
tenantnak még nincs vevő-adatos saját rendelése.

⑥ **Telefon, trunk nélküli ország** (IT, CZ …): a 0-val kezdődő szám a szám része (olasz vezetékes); a hívószám
„+” nélkül csak akkor válik le, ha a csupasz számjegyek nem férnek a hosszba (olasz mobil kezdődhet 39-cel).
A nyelv nélküli mock a lead országának nyelvét adja (nem magyart).

### Nem döntés — tulajhoz megy (jog / irány)
- A horvát olvasó a hideg levél láblécében magyar jogalapot (Grt.) és magyar eladói adatot, az adatkezelési
  lapon a NAIH-ot látja panaszhatóságként; a horvát tenant impresszuma és adatvédelmi lapja magyar törvényekre
  hivatkozik (2001. évi CVIII., 2000. évi C.), a szerződés lemondása a 45/2014. Korm. rendeletre.
- A honlap nélküli HR lead $0 mellett nem kap képet (nincs ingyenes HR képforrás).

### Következmény
A minta-szobakártya leírása és jegyzete `T()`-n át (`src/engine/templateKit.ts` sampleRooms): a koordinátor
(cit9b4690e3, 2026-11-23) döntése szerint §2b hibajavítás (csak fordítási burok, a magyar bájtra azonos), felület-kivétel
nem kell — landolva a 0470 kiegészítéseként. Bábel-teendő: a két szöveg horvátul (és minden mock-nyelven).
