# Vendégvélemény-kezelő — a tenant-admin vélemény-listája

**Jóváhagyva:** 2026-09-23 (tulajdonosi döntés: „B”), §2b terv-kapu.
**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** Amit alább „KÖT” jelöl, az elvárt
viselkedés; a megvalósítást ehhez mérjük, és eltérés esetén a kód a hibás, nem a terv.

| fájl | mi ez |
|---|---|
| `reviews-inbox.html` | a jóváhagyott, működő vázlat (a felső sáv — méretváltó, Google-kapcsoló, „Minta újra” — csak a vázlat kerete, nem a termék része) |
| `reviews-inbox-mobile.png` | 390 px, ehhez mérjük a mobil megvalósítást |
| `reviews-inbox-desktop.png` | asztali, ehhez mérjük az asztali megvalósítást |
| `reviews-inbox-google-ki-mobile.png` | a Google-kártya kikapcsolt állapotban |

Őr: `scripts/reviews-inbox-check.mts` (böngészőben, 390/1280 px, a kapcsoló mindkét
állásában) + `scripts/i18n-pseudo-check.mts` (a `reviews` képernyő minden felirata és
akadálymentes neve a nyelvi csomagon megy át).

## A lelet, amire a terv válasz (mérve 2026-09-23)

- A teli és az üres csillag UGYANAZ a „★” jel volt, csak egy sosem megírt szín választotta
  volna szét: egy **1 csillagos vélemény ★★★★★-nak látszott**, és a tulaj ezzel döntött.
- A `rev-*` osztályokhoz nem volt CSS: név, csillag és állapot egy sorba folyt, a gombsor
  a következő kártyához tapadt.
- A Google-kártya „Ez látszik most az oldalán”-t mondott akkor is, amikor a kapcsoló ki volt
  kapcsolva — pedig ilyenkor a szám LEKERÜL a lapról.
- Négy felirat és az `aria-label` burkolatlan volt; az i18n-lint ékezetet keres, ezek
  ékezet nélküliek, a pszeudo-nyelvi őr pedig ezt a képernyőt nem renderelte.

## Amit a terv KÖT

### ① A csillag szín nélkül is igazat mond
- A teli csillag `★`, az üres `☆` — **eltérő jel**, nem csak eltérő szín.
- Mellette a szám kiírva: **„N/5”**. Az 1★ és az 5★ sor szövege is különbözik.
- 2 vagy kevesebb csillagnál a szám pirosas jelölést kap (figyelem-felhívás, nem ítélet).
- Az akadálymentes név („N csillag az 5-ből”) a nyelvi csomagból jön.

### ② Állapot szerint csoportosítva, a döntésre várók elöl
- Három csoport: **Döntésre vár · Az oldalon · Nem került ki**, a címben darabszámmal.
- A „Döntésre vár” mindig első, és akkor is látszik, ha üres („Nincs döntésre váró
  vélemény.”) — a nulla is hír. A másik kettő csak akkor, ha van benne sor.
- A csoport jelöli az állapotot, soronkénti állapot-címke nincs.

### ③ A sorok nem folynak egybe
- Két sor között látható elválasztó; a gombsor a SAJÁT során belül marad.
- **Mobil:** egy oszlop — név + meta, csillag, szöveg, gombok egymás alatt.
- **Asztali (≥640 px konténer):** három oszlop — bal: név, meta, csillag; közép: szöveg;
  jobb: a gombok egymás alatt. (`@container`, mert az admin-hasáb keskenyebb az ablaknál.)
- A 180 karakternél hosszabb szöveg 3 sor után levágva, **„Teljes szöveg” / „Kevesebb”**
  váltóval (JS nélkül is működik).

### ④ A gombok mindig azt kínálják, amit még lehet
- Döntésre vár: **Kiteszem** + **Nem teszem ki**. Az oldalon: **Leveszem**.
  Nem került ki: **Kiteszem**.
- Döntés után a kártya tetején egy sor MEGNEVEZI, mi történt, kivel
  („Nagy Péter véleményét levette az oldaláról.”), és a lap a listára tér vissza.

### ⑤ A Google-kártya a kapcsolót tükrözi
- BE: „Ez látszik most az oldalán. A vendég rákattintva a Google-véleményekhez jut.” (zöld)
- KI: „Ez most nem látszik az oldalán: kikapcsolta lent, a Szabályok között (…)” (sárga),
  **„Ugrás a kapcsolóhoz”** linkkel; a szám és a csillagok halványítva.
- A csillagok úgy látszanak, ahogy a látogató látja őket az oldalon (ugyanaz a kerekítés,
  mint a `honestStarCount`) — a kártya a lapot tükrözi. Nincs „N/5” jelölés, mert a
  4,8 nem 5/5.
