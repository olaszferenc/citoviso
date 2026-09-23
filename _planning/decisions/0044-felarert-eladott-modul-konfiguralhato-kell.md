## ADR-0044 — Felárért eladott modul KONFIGURÁLHATÓ kell legyen (+ a booking adat-modellje: EGYSÉG, nem site)

- **Kiváltó (tulaj, 2026-08-20):** „Megvetetjük szerencsétlen tenanttal az összes modult felárért, oszt
  nem tudja az adminban beállítani? Egyik modulhoz sincs semmilyen konfig. Így fel fognak jelenteni."
  A lelet igaz volt: 12 modul havidíjas felárral (booking 990 Ft/hó, rooms 690, reviews 690…), és a
  tenant-admin összesen szöveget, fotót és egy ON/OFF kapcsolót kínált. A `ModuleDef` típusban nem is
  LÉTEZETT konfig-mező — tehát nem elfelejtettük, a szerkezet nem engedte.
- **Második kiváltó (tulaj, 2026-08-21):** „Azt tudja kezelni a tenant, hogyha nem egy szobája kiadó,
  hanem vannak szobái vagy apartmanjai?" Nem tudta: a 0023 a foglaltságot a SITE-ra kulcsolta, ami
  beégette az „egy szállás = egy kiadható dolog" feltevést. Egy négyapartmanos vendégháznál egy naptár
  négy egységre, és semmi sem tudja, melyik telt be. A `rooms` modul rég a katalógusban volt, tehát a
  több-egységes eset mindig is valóság volt — csak a séma nem ismerte el.

**Döntés**

1. **Invariáns: `priceMonthly > 0` ⇒ a modul KONFIGURÁLHATÓ.** Nem ígéret, hanem kapu:
   `scripts/module-config-lint.mts`, bekötve a `hooks/pre-commit`-be. Az ítélet azon áll, ami TÉNYLEG
   renderel (`IMPLEMENTED_EDITORS`), nem azon, amit a registry deklarál — az első változat épp ezt
   hazudta: a `rooms` egy meg nem épített szerkesztőre hivatkozott, és a lint konfigurálhatónak
   számolta. Egy őr, amit sosem láttunk pirosnak, nem őr (ADR-0043 tanulsága).

2. **KONFIG ≠ ADAT.** Kicsi, deklaratív beállítás (min. éjszaka, értesítési cím) → verziózott JSONB,
   kód-oldali migrációval, így egy mező átnevezése nem DB-migráció és nem tör el élő tenant-oldalt.
   Növekvő, lekérdezendő adat (foglalt napok, foglalási kérések, naptár-linkek) → SAJÁT TÁBLÁK.
   Naptárat JSONB-be tömni zsákutca: fél év múlva a „mennyi volt a szeptemberi kihasználtság?"
   kérdésnél derülne ki.

3. **A konfig a SITE-hoz tartozik, nem a tenanthoz.** A `module_entitlement` helyesen tenant-szintű,
   mert az SZÁMLÁZÁS; a beállítás viszont egy renderelt oldalhoz tartozik. Egy tulaj két apartmannal =
   két site, EGY előfizetés.

4. **A foglaltság az EGYSÉGHEZ tartozik** (`site_unit`, 0024), nem a site-hoz. Ez teszi lehetővé a
   portál-szinkront is: egy Booking.com-hirdetés EGY egység, tehát az importált naptárnak egy egység
   napjaira kell szállnia. Site-kulccsal kétszer kellett volna megépíteni.
   **Minden site kap egy alapértelmezett egységet** („A szállás egésze"), ezért az egy-egységes tulaj
   soha nem lát egység-választót és meg sem tanulja a fogalmat.

5. **Három alapérték-réteg:** katalógus → IPARÁG → a tulaj mentett értéke. Ez az „iparág = paraméter"
   doktrína konfig-oldali megfelelője: egy fodrász booking-ja más alapértékekkel indul, mint egy
   panzióé, ugyanabból a modulból.

6. **Foglalás-flow: kérés → tulaj dönt → mindkét fél értesül.** Nincs azonnali foglalás és nincs online
   fizetés (helyszíni). **A tulaj a LEVÉLBŐL dönt, egy koppintással, belépés nélkül** — aki 2026-ban
   nincs fenn a neten, az nem fog adminba belépni foglalást jóváhagyni; enélkül a modul dísz. Az admin
   postaláda a másodlagos út. Idempotens, mert a levelező-kliensek előtöltik a linket.

7. **Duplafoglalás két rétegben.** Az elfogadás tranzakcióban újra-ellenőriz (tiszta emberi üzenet),
   de a VÉGSŐ garancia az `availability_day` elsődleges kulcsa: az explicit ág szándékos kivételekor
   az átfedő második foglalás nem csúszott át, hanem a DB utasította el (`availability_day_pkey`).
   A UI SOHA nem lehet a duplafoglalás akadálya.

8. **A portál napjai nem a tulajé.** Az importált nap csíkos és nem koppintható az adminban; a kézi
   naptármentés hatóköre kizárólag a `manual` forrású nap. Ha a tulaj „felszabadíthatna" egy éjszakát,
   amit a Booking.com már eladott, pont a duplafoglalást állítanánk elő.

**Visszafordíthatóság:** 🔄 a konfig-réteg és az egység-modell additív, nulla soron vezettük be
(a 0023 booking-táblái sosem kerültek élesre). Egyirányúvá akkor válik, amikor éles tenant-adat kerül rá.

**Bizonyíték:** `scripts/module-config-check.mts` (43 ellenőrzés valódi DB-n, eldobható fixture-rel),
`scripts/ical-check.mts` (121/121), `scripts/module-config-lint.mts`, `scripts/shot-module-config.mts`
(mobil 390px). Mindhárom kritikus tulajdonságot szándékos rontással pirosra is futtattuk.

### ADR-0044/c–d kiegészítés (2026-08-21) — árazás egységenként, egység-tartalom, aloldal

- **Kiváltó (tulaj):** „annak nem előfeltétele, hogy a szobák be legyenek konfigurálva? Mi a
  nyavalyát akarna beárazni szerencsétlen bérlő?” majd „tud-e a felhasználó a unitokhoz képeket,
  felszereltségeket rendelni… feltételezem, a unit modul egy aloldal, ami SEO szempontból szerencsés.”

**Döntések**

9. **Az ár az EGYSÉGHEZ tartozik** (`unit_price`, 0025). Egy tulaj szobát/apartmant áraz, nem
   elvont szezont; egy site-szintű lapos ártáblázat nem tudja megmondani, a három apartman közül
   melyik mennyibe kerül. A szezonok **ismétlődő `MM-DD`** tartományok (az év végén átfordulót is
   kezelve), mert a főszezon minden évben ugyanaz — évenkénti újragépelés garantáltan elavult árat
   hagyna élesben. Dátum nélküli sor = alapár; üres ár TÖRLI (§B.17: jobb nincs szám, mint rossz).
10. **`site_unit` = EGY IGAZSÁG.** A `rooms` MEGMUTATJA, a `booking` FOGLALHATÓVÁ teszi, a
    `pricing` ÁRAT tesz rá. A `rooms` modul korábbi külön szöveges listája megszűnt: két
    nyilvántartás ugyanarról előbb-utóbb ellentmond a naptárnak.
11. **Fotók: EGY KÖZÖS KÉPTÁR, hozzárendeléssel.** A tulaj egyszer tölt fel és megjelöli, melyik
    kép melyik egységé; egy kép több helyen állhat, a nem hozzárendelt a ház galériájában marad.
    (Az alternatíva — egységenkénti külön feltöltő — ugyanannak a képnek a kétszeri feltöltését
    követelné.)
12. **Egység-aloldal = UGYANAZ A RECEPT.** `/apartman/<slug>`, a főoldallal azonos sablonon és
    skinen, csak az adat egység-hatókörű. Külön aloldal-sablon TILOS: az ugyanaz a bait-and-switch
    (§I), mint a képek kicserélése. A stílus-azonosság **mérve** (`unit-subpage-check`, 16 sablon,
    + önellenőrzés: idegen sablont 15/15 esetben kiszúr).
13. **Thin-content kapu:** aloldal csak fotó ÉS (leírás vagy felszereltség) esetén születik;
    egy-egységes szállásnál soha (a főoldal duplikátuma volna). A sitemap a TÉNYLEG megírt oldalakat
    listázza. Az admin egységenként kiírja, lesz-e oldal és mi hiányzik hozzá.
14. **Slug-stabilitás:** átnevezéskor a URL marad (arra mutatnak a linkek és a találatok). Egy
    kivétel: az automatikusan létrehozott első egység placeholder-slugja követi az első valódi
    elnevezést.
15. **Galéria: az ál-választó kivezetve.** A „rács/karusszel/mozaik” választó vagy nem hatott
    (ez történt), vagy a 16 sablon arculata ellen dolgozott volna. Helyette az hat, ami adat:
    **sorrend + nyitókép + képaláírás** (Fotók fül) és a **megjelenő képek száma** (modul).

**Ami NEM scope (tulaj, 2026-08-21):** a Booking.com-integráció. A motort csak *kompatibilissé*
kellett tenni; az iCal-réteg megvan és tesztelt, de a tenant-admin nem kínálja
(`PORTAL_SYNC_UI=false`) — amit nem támogatunk, azt nem ígérjük.
