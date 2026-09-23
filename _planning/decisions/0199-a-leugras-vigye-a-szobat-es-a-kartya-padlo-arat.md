## ADR-0199 — A leugrás vigye a szobát, és a kártya PADLÓ-árat írjon (2026-09-22)

**Kontextus.** Az ADR-0195 után a tulaj két kérdést tett fel: *„nem jobb, ha azt írjuk:
árakért válasszon dátumot?"* és *„nem úgy van, hogy ha a szobánál a foglalásra kattintunk,
akkor odaugrik a foglalás szekcióra?"*. A második kérdésre a mérés NEM azt válaszolta,
amire számítottunk.

**Amit a mérés talált (artdeco + fullbleed, aktív foglalás-modullal).**

| Állítás | Eredmény |
|---|---|
| a kártyán van Foglalás gomb | ✅ (de: `fullbleed`-en **0** — a közös tartalék kártyáin sosem volt) |
| odaugrik a foglalás-szekcióra | ✅ a horgony létezik, a hash beáll |
| ott dátumot lehet állítani | ✅ |
| **átviszi, MELYIK szobáról jött** | ⛔ **NEM** — a választó a 2. szoba gombja után is az 1. egységen állt |

A következmény nem kozmetikai: a naptár a rossz egység foglaltságát mutatta, az ajánlat a
rossz egység árából számolt, és a beküldés `unit: currentUnit()`-je a **rossz egységre**
küldte volna a kérést — a tulaj olyan szobára kap foglalást, amit senki nem kért.
Mindkettő KORÁBBI állapot volt, nem az ADR-0195 terméke.

**Döntés.**

**① A leugrás viszi a szobát.** A kártya héja `data-cit-room-unit`-ot visel, és a runtime a
foglalás-horgonyra kattintva beállítja a `<select name="unit">` értékét + `change`-t lő — mert
minden más (a foglaltság-lekérés, az ár-sorok, a beküldés) MÁR ezt olvassa. Csak akkor állít,
ha a választóban tényleg van ilyen érték; különben némán egy nem létező egységre váltana.

**② Minden szobának van foglalás-útja, ami viszi az egységet.** A közös tartalék kártyái
(7 sablon) megkapják a hiányzó Foglalás gombot. A három szikár sablonon (`arch-frames`,
`tilted-gallery`, `wordmark-grow`) a kártya szándékosan CTA nélküli marad — ott a FELUGRÓ
„Foglalás"-a az út. ⭐ Ezért az őr állítása nem „van-e gomb", hanem **„eljut-e a vendég a
foglaláshoz a szoba azonosságával"** — ez az outcome, és mind a 19 sablonon KÖT.

**③ Az ár: PADLÓ, nem sáv.** `24 000 Ft-tól / éj` a `24 000–32 000 Ft / éj` helyett. A sáv két
számot tett oda, ahol a vendég egyet keres. A „-tól" MEGTARTJA az Elek FK-007 invariánsát —
az a hiba épp az volt, hogy a 24 000 mellől hiányzott a padló-jelzés, és a widget 32 000-et
terhelt. Egy árnál nincs „-tól".

**④ A „válasszon dátumot" mondat a FELUGRÓBA megy, nem a kártyára — és csak ahol igaz.**
⛔ A tulaj javaslatát (szám helyett mondat a kártyán) NEM vettük át, két mért okból:
(a) az ár az első szűrő — szám nélkül a vendég nem tudja eldönteni, 18 ezres vagy 180 ezres
helyen jár, és nem dátumot ad meg, hanem továbblép; (b) a mondat **be nem tartható ígéret**
ott, ahol a lap nem tud árat számolni: a runtime `quoteFor()`-ja ár-sor nélkül `null`-t ad,
és a `renderQuote` ÜRESEN hagyja a dobozt. Ezért a mondat csak PADLÓ-ár mellett és csak
foglalás-felülettel jelenik meg.

⭐ **Best practice, kimondva:** a szálláskereső oldalak két ÁLLAPOTOT mutatnak ugyanazon a
kártyán — böngészéskor „-tól" árat (ez a szűrő), dátum megadása után a valódi összeget. A
Booking azért tud dátum nélkül árat nem mutatni, mert náluk a dátum a keresésből jön; egy
szállás saját oldalán ez nincs meg (a vendég a Google-ből/Maps-ből/a mi hideg linkünkből
érkezik). A „dátum vezérli a kártyákat" második állapot MEGÉPÍTHETŐ — az ár-motor
(`quoteFor`) már a lapon van —, de az ár-lista ma EGYETLEN egységre érkezik
(`/api/foglaltsag/<unitId>`), tehát kiszélesített végpont kell hozzá; és a dátum-sáv helye
ütközik az ADR-0059 dramaturgia-döntésével (a teljes foglalási felület nem az első képernyőn).
**Ez külön §2b kör, nem ennek a szálnak a hatóköre.**

**Őrizve.** A `room-details-check` négy új állítással és három új visszarontással bővült
(összesen **10 visszarontás**, mind piros, kontroll zöld): a leugrás viszi-e a szobát · a
sáv-alakú ár visszatérése · a dátum-mondat egy árnál · a felugró CTA-ja a semmibe mutat-e.
⛔ **Két saját hiba ismét:** a `file://` foglaltság-lekérés CORS-hibáját a mérőm „JS-hibának"
olvasta (szűken, kimondva szűrve), és egy visszarontásom MÁSODSZOR is olyan mechanizmust
célzott, ami már nem létezik (a runtime a `<details>`-t a `load` ELŐTT kiveszi) — 0/4 pirossal
„bizonyított" volna.

**NYITOTT.** A dátum-vezérelt kártya-ár (külön kör) · a négy kivételes sablon „A/B" döntése
továbbra is a tulajé (a szállított állapot: „A" + ár-sor).
