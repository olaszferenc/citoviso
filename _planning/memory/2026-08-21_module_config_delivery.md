# 2026-08-21 — Modulok: a beállítástól a renderelt oldalig (ADR-0044)

## Kiváltó (tulaj)

> „Megvetetjük szerencsétlen tenanttal az összes geci fancy modult felárért, oszt nem tudja az
> adminban beállítani? Egyik modulhoz sincs bazdmeg semmilyen kibaszott konfig. Így fel fognak
> jelenteni.”

majd később, ugyanazon a szálon:

> „És a többi modul, amit megvásároltunk a szerencsétlen paraszttal, azzal mi van?
> Felszereltségtől kezdve semmit nem tud beállítani.”

## A LEGFONTOSABB TANULSÁG — az őr azt mérje, ami számít

A hiba nem a hiányzó kód volt, hanem hogy **zöld őrt írtam a kényelmes mérőszámra**.
A `module-config-lint` azt ellenőrizte, hogy *van-e beállító képernyő* — nem azt, hogy a beírt
érték **megjelenik-e az oldalon**. Napokig zöld volt, miközben a tenant beírta a felszereltséget,
elmentette, és semmi nem történt. Ez **rosszabb** a kiindulási állapotnál, mert úgy nézett ki,
mintha működne.

Ugyanez a hibaosztály **háromszor** fordult elő ebben a szálban:
1. `rooms`: csak DEKLARÁLT szerkesztőt, ami nincs megépítve → a lint konfigurálhatónak számolta.
2. Minden modul (a booking kivételével): mentett konfig, ami sehol nem jut a renderelésig.
3. `gallery`: „indokolt kivétel” az őrben, ami valójában kibúvó volt (ahogy a `rooms`-nál is).

**Munkamód, ami ebből következik:** ha egy őr zöld, tedd fel a kérdést, hogy *mit mér valójában* —
és futtasd PIROSRA szándékos rontással. Ebben a szálban minden kritikus tulajdonságot pirosra
futtattam (duplafoglalás, portál-nap túlélése, foglalt éjszaka elutasítása, stílus-azonosság).
Egy sosem-piros őr nem őr. (Vö. ADR-0043: minden kapu zöld volt a rossz eredményen.)

## Amit a tulaj kapott el (én nem)

- **„ha van foglalás, akkor nincs érdeklődés”** — a két modul EGY slotot használ, tehát soha nem
  adhatók el együtt. Kiderült, hogy szerkezetileg már ma is egy slot volt (`data-cit-module="booking"`).
- **több szoba/apartman** — a foglaltság a SITE-ra volt kulcsolva, ami beégette az „egy szállás =
  egy kiadható dolog” feltevést. Szerencsés időzítés: még nulla adat ült rajta.
- **az árazás előfeltétele a szoba-konfig** — és emiatt derült ki, hogy KÉT nyilvántartást
  csináltam ugyanarról (site_unit + a rooms modul szöveges listája).
- **a Booking-integráció nem scope** — csak kompatibilisnek kellett lennie; túl sokat fektettem bele.

## Elvek, amik kikristályosodtak

1. **Egy fogalomnak egy igazsága legyen.** `site_unit`: a rooms mutatja, a booking foglalja, a
   pricing árazza. Két lista ugyanarról előbb-utóbb ellentmond egymásnak.
2. **Az adatot alakítsd, ne a sablont.** 16 sablon van; ami a `SiteData`-ban változik (fotó-sorrend,
   kép-korlát, szobák), az mind a 16-ban hat, `O(1)` költséggel. Szekciót 16-szor megírni = a
   100×N csapda (ADR-0016), és a 17. sablon némán kimaradna.
3. **Amit nem támogatunk, azt ne kínáljuk.** A portál-szinkron kész és tesztelt, de a UI sötét.
4. **Ál-választás = hazugság.** A galéria elrendezés-választója vagy nem hatott, vagy a dizájn ellen
   dolgozott volna. Kivezetve; helyette az hat, ami adat.
5. **Thin content ellen kapu.** Aloldal csak valódi tartalommal születik; a sitemap a TÉNYLEG
   megírt oldalakat listázza.

## Elvégzett munka (11 commit, mind felküldve)

- **§A fotó-doktrína LEZÁRVA** (tulajdonosi rendelet): önnyilatkozattal BÁRMELY demó-kép élesíthető,
  `places`/`streetview` is; ha nyilatkozott és nem tölt fel sajátot, a mock képei mennek ki.
  Egyetlen kizáró ok: vízjel. **Nem újranyitható** — a doktrína ki is mondja.
- **Modul-konfig réteg**: `site_module_config` (verziózott JSONB, SITE-kulcs), három alapérték-réteg
  (katalógus → iparág → tulaj), history a visszaállításhoz.
- **Egységek** (`site_unit`) + **árazás egységenként** (`unit_price`, ismétlődő szezonok).
- **Foglalás**: kérés → tulaj dönt a LEVÉLBŐL egy koppintással → visszaigazolás. Duplafoglalás két
  rétegben (explicit ellenőrzés + `availability_day` elsődleges kulcs).
- **iCal-réteg** (121/121 ellenőrzés) — kompatibilitási felkészítés, UI sötétben.
- **Portál-scraper** (szallas.hu/booked stb.): 10 leadből 9-hez adatlap, 337 `portal` fotó.
- **Vendég-oldali foglalási űrlap**, egység-választóval.
- **Egység-aloldalak** `/apartman/<slug>`, a főoldallal azonos recepten.

## Kapuk (mind a pre-commit-ben)

| Script | Mit véd |
|---|---|
| `module-config-lint` | felárazott modulnak van beállítása |
| `module-render-check` | a beállítás ELJUT az oldalra (16 sablon) |
| `unit-subpage-check` | az aloldal a fő oldal stílusát viszi + nincs thin content |
| `module-config-check` | 50+ ellenőrzés valódi DB-n, eldobható fixture-rel |
| `ical-check` | 121 fixtúra (DTEND-exkluzivitás, folded lines) |
| `shot-booking-form` | a vendég-űrlap VISELKEDÉSE böngészőben, 390px |

## Nyitott

- **`reviews`** — az egyetlen modul, ami még kivétel az őrben; az indok valós: **nincs
  vélemény-adatunk** (a Places field mask nem kéri a szövegeket). Előbb adat, aztán beállítás.
- **Éles deploy** — semmi nincs kint. A prod a `0022`-nél áll; a `0023`–`0026` migráció és a teljes
  modul-réteg hiányzik. Külön, scope-olt engedély kell hozzá.
- **`booking-maintenance` cron** — nincs bejegyezve (a portál-szinkron úgyis sötét).

## Tesztelés

`npx tsx scripts/demo-tenant.mts` → háromegységes demó-vendégház, árakkal, aloldalakkal,
kiírja a belépést. CSAK helyi adatbázison fut (különben megtagadja).
