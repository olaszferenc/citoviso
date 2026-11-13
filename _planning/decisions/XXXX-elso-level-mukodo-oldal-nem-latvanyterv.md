## ADR-XXXX — Az első megkereső levél működő oldalt mutat be, nem „látványtervet”; tárgy „– kész honlap”; a levél-kritikus előfizetésen fut (2026-11-13)

**Státusz:** elfogadva (tulaj, 2026-11-13; a szöveget a tulaj küldte vissza jóváhagyottként, a naptár-mondatot ő diktálta) ·
**Lokál, nem élesítve** (§0) · **Kapcsolódó:** ADR-0306 (a levél csak a mértet állítja), ADR-0101 (a levél részei),
ADR-0361 (iCal portál-naptárszinkron), ADR-0440 (egy kattintásos indítás), §A demo-framing, §C.4.

### Kontextus
A tulaj: „Ezek még csak látványtervek, nem kész oldalak, és semmire nem kötelezik” — „azonnal működik az oldal, azt
sugalja, hogy nem kész oldalról van szó… senki nem akar vele baszódni. És nem látványtervnek kell hívni.” A mondat
ráadásul nem is igaz: a linken kattintható, mobilos, testre szabható oldal van, egy kattintással indítható próbával.

### Döntés
1. **A keretezés az IGAZ tény:** „Nem kép, hanem működő oldal: kattintható, telefonon is jól mutat, és benne vannak a
   szállása képei és adatai. Még nem nyilvános, csak ezen a linken érhető el:”. A §A demo-framing ezzel teljesül (nem adja
   ki magát élő, nyilvános oldalnak); a §C-kapu `FRAMING_PATTERN`-je a „nem nyilvános” kifejezést is elfogadja.
2. **„Ezért elkészítettük Önnek a honlapját”** csak ott, ahol nem találtunk honlapot; régi honlap mellett „egy új
   honlapot” (a levél-kritikus ellentmondásnak ítélte); modern honlap mellett „hogy össze tudja vetni a mostanival”.
3. **Sorrend:** ajánlat + link → váltás a kinézetek között → „Ha tetszik, egy kattintással maga is elindíthatja, és {N}
   napig ingyen használhatja, kötelezettség nélkül.” (csak ha a lap próbát kínál) → jutalék nélkül + **„Foglalásait
   automatikusan szinkronizálhatja a Booking.com, az Airbnb és a Szállás.hu naptárával.”** (csak az ADR-0361-ben igazolt
   három portál) → ár a végén (a HTML-ben a navy ár-doboz is ide került).
4. **Tárgy:** „{név} – kész honlap” minden tervszámnál (13 karakter, rövidebb, mint a „– 3 honlap-terv”). Nem élő-oldal
   állítás: a törzs kimondja, hogy még nem nyilvános. HTML: fejléc-címke „Még nem nyilvános”, gomb „Megnézem a honlapot”.
5. **A levél-kritikus (ADR-0306) a `claude --print` CLI-n fut, előfizetésen** — eszköz nélkül (`--tools ""`), üres
   cwd-ből, `ANTHROPIC_API_KEY` nélkül (tulaj 2026-11-03: API-kredit nem költhető). A tulaj által jóváhagyott mondatokat
   az OWNER_RULINGS ④ szűri; ág-ellentmondást továbbra is jelez.

### Nem változott (külön döntés)
Az SMS / MMS / Messenger szövegek még „honlap-látványterv”-et írnak; az emlékeztető-levél saját mondatai változatlanok.
A 6 idegen nyelvű csomagban az új mondatok Bábelre várnak (ma csak a HU piac jóváhagyott, élesen mérve).
