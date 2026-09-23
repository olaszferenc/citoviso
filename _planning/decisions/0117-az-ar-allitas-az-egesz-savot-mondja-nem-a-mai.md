## ADR-0117 — Az ÁR-ÁLLÍTÁS az egész SÁVOT mondja, nem a mai napot; és a beadás NYUGTÁT ad (2026-09-12)

- **Kiváltó (Elek FK-007 kör, 2026-09-11, tulajdonosi jelentés):** „A vendég ugyanarra az
  éjszakára három különböző árat olvas ugyanazon az oldalon, és a foglalási kérés beadása után
  semmilyen összefoglalót nem kap."

**Amit a mérés mutatott.** Egy lapon, egy időszakra három szám állt — és mind a három ugyanabból
a `unit_price` táblából jött:

| felület | szám | honnan |
|---|---|---|
| „Szobák, apartmanok" kártya | **24 000 Ft/éj** (minősítés nélkül) | `priceOn(prices, MA)` |
| „Árak" tábla | 32 000 Ft (09.15–30.) + 24 000 Ft (egyéb) | a szezon-sorok |
| foglalás-widget, 09.21–23. | **64 000 Ft** (= 2 × 32 000, helyes) | `quoteStayFrom` / `quoteFor` |

A hiba nem az árazásban volt, hanem a MEGJELENÍTÉS három külön útján. Egy egység-teszt a
`quoteStayFrom`-ra mind a háromszor zöld lett volna.

**Döntés**

1. **A kártya a teljes SÁVOT mondja: „24 000–32 000 Ft / éj".** Egyetlen szám nem tud felelni a
   „mennyibe kerül?" kérdésre, ha az ár a dátumtól függ. A mai nap ára két sebből vérzett:
   ① olyan kérdésre felelt, amit senki nem tett fel (nem a vendég időszakára), ② statikus
   pillanatképen a RENDERELÉS napjára fagyott, tehát egy télen rendererelt lap egész nyáron a
   téli árat hirdette, újrarenderelésig. A sáv az év minden napján igaz, és teljesíti a
   tulajdonosi mércét: **a vendég soha ne olvasson kisebb árat, mint amit fizetni fog.**
   (Elvetve: „-tól" toldalék — a felső határt elhallgatja; és „alapár, főszezonban X" — kártyára
   túl hosszú, miközben a tábla közvetlenül alatta úgyis megmondja, mikor melyik.)

2. **A beadás TÉTELES nyugtát ad, a SZERVER befagyasztott ajánlatából.** Időszak · éjszakák ·
   létszám · egység · hivatkozás · ár-bontás · összesen · a kimondott válasz-határidő · és a cím,
   ahová a választ küldjük. A számok NEM egy második kliens-oldali számításból jönnek: a nyugtának
   azt a számot kell mutatnia, ami a KÉRÉSEN van. A „hamarosan" nem ígéret — a 48 óra a modul
   valódi beállítása (`autoDeclineHours`), nem beégetett szám.

3. **HIVATKOZÁS van, és mindkét fél ugyanazt látja** (`FG-` + az id első 6 jegye). Levezetett,
   nem tárolt oszlop — így nem tud elcsúszni attól a rekordtól, amit megnevez. Az `action_token`
   erre alkalmatlan: az a lemondó-link egyetlen titka. A hivatkozás a vendég nyugtáján, a vendég
   levelében, a tulaj levelében és a tulaj képernyőjén is ott van; enélkül egy telefonhívás
   („a hétvégi foglalásom ügyében…") semmihez nem köthető.

4. **A CSEMPE a valóságot mondja, a másik tényt pedig megnevezi.** Az „Idén visszaigazolt" korábban
   a VERDIKTEKET számolta, ezért 2-t írt, amikor egyetlen élő visszaigazolt foglalás sem volt. Két
   tény van (mennyit igazoltunk vissza / mennyi él), és a felület a rosszat mondta a másik neve
   alatt. Mostantól a fő szám az, ami LÉTEZIK, mellette „· {n} lemondva", és a lenyíló panel
   összeadódik a csempével — a szám koppintással ellenőrizhető.

5. **Egy verdikt után a felület KIMONDJA, kit igazolt vissza és kit utasított el.** Egy fedés-döntés
   három kérést zárhat le és három levelet küld; ezt „Mentve — az oldalad frissült."-ként jelenteni
   kevesebb, mint ami történt. A redirect ID-ket visz (UUID, nem személyes adat), a nevet a képernyő
   oldja fel a már betöltött sorokból.

6. **Kevesebb megerősítő lépés, de a JS-mentes út sértetlen.** A fedés-választó egy koppintásra
   nyílik; a natív `confirm()` elmarad, mert a modál közvetlenül a gomb fölött MEGNEVEZI a
   veszteseket — egy második, stílustalan ablak ugyanazt rosszabb szavakkal mondta. JS nélkül a
   `<details>` panel a régi módon működik. A záró gomb RAGAD (sticky), mert egy görgethető modál
   is a hajtás alá tudja tolni a fő műveletet.

7. **A múltbeli nap megtartja a színét (halványan).** A hónap-összegző minden cellát számol; ha a
   múltbeli nap elveszti a forrás-színét, a fejléc olyan színt nevez meg, ami sehol nincs a rácson
   („1 nap kézi blokk", és egyetlen sötétkék nap sem). A magyarázat nélküli keret ugyanez: a
   megnyitott nap bekerült a jelmagyarázatba.

**Visszafordíthatóság:** 🔄 ① a sáv egyetlen függvény (`priceSpan`/`formatSpan`), a `priceOn` maradt
a helyén; ② a nyugta a `summary` mező jelenlététől függ, régi szerver-válaszra a rövid szöveg a
tartalék; ③ a hivatkozás levezetett, nincs migráció.

**Bizonyíték:** `scripts/booking-price-coherence-check.mts` — a RENDERELT lapon veti össze a
kártya-árat, az ártáblát és a widget számítását, három időszakra (szezonon belül · szezonon kívül ·
határon átlógó), a táblából FÜGGETLENÜL újraszámolva. Zöld a javított lapon; a `--selftest`
visszaírja a régi viselkedést és elvárja a pirosat — ekkor pontosan a bejelentett hibát mondja ki
(„a vendég KISEBB árat olvas, mint amit fizetni fog"). A nyugta 390px-en és 1280px-en végigkattintva
(JS-hiba 0), a fedés-választó záró gombja `elementFromPoint`-tal igazolva mindkét méreten.

⚠️ **Két csapda, amit az őr SAJÁT magán fogott ki** (mindkettő piros lett volna egy helyes lapon):
① a „24 000–32 000 Ft" sávból csak a második számot látta (egy pénznem-jel, két szám), ezért PIROS
lett egy HELYES oldalon — és az öntesztje ettől ROSSZ OKBÓL volt zöld; ② az ártábla saját
dátum-sávját („09. 15. – 09. 30. 32 000 Ft") pénz-sávnak olvasta. **Egy parser-hiba az orákulumban
pontosan úgy néz ki, mint egy termék-hiba.** Ezért az őr azt is kimondja, ha EGYETLEN oldalt sem
sikerült megmérnie — a nulla összehasonlítás nem zöld.

⚠️ **Hatókör-lelet, harmadszor** (ADR-0067, ADR-0070 után): `src/server/bookingViews.ts` nem volt
az `i18n-sources` listán. A Foglalások fül MINDEN felirata `T(lang, …)`-be volt csomagolva, minden
kapu zöld volt, és egyetlen string sem jutott a katalógusba — egy nem magyar tenant magyarul
intézte a foglalásait, és ezt semmi nem tudta jelenteni. **A doktrína hatóköre az őr FÁJLLISTÁJA.**
