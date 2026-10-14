# Próba és foglalás az operátornak — jóváhagyott terv (2026-10-14)

Tulajdonosi jóváhagyás: **2026-10-14** („mehet”, a deploy-koordinátoron át). A tulaj a
`plan.html` négy fülét látta (A · B · C · Értesítés), mobil ÉS asztali képen, és ezt a
**kombinációt** választotta:

| Felület | Választott változat |
|---|---|
| Lead-lap | **B**: külön ügyfél-kártya a munkamenet-sáv alatt |
| Lead-lista | **C** jelvénye a név alatt **+ B** szűrő-sora a táblázat fölött |
| Értesítés | **E2**: új próbáról levél + SMS (éjjel a reggeli összesítőben), és levél a 24 órája megválaszolatlan foglalásról |

Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat.
A `**„…”**` alak **felületi feliratot** jelöl, a `contract-drift-check` ezeket keresi vissza a kódban.

Referencia: `plan.html` (kattintható, Mobil 390px / Asztali váltóval), a választott terv képei
(`terv-B-lap-*`, `terv-B-lap-myrna-*`, `terv-C-lista-*`, `terv-N-nappal-*`, `terv-N-ejjel-*`),
és a megvalósítás igazolása ugyanazon a leaden, előtte–utána (`elotte-*`, `utana-*`).

## Miért (Elek éles teszt, 2026-10-13, O-2)

A próbázó lead lapján és a lead-sorban csak „jóváhagyva” állt. Az Irányítópult a próbáról nem
szólt, a foglalás a konzolban sehol nem látszott, csak a `/pricing` írta ki, hogy „Most 1 próba fut”.
Új próbáról értesítés sem jött.

## Mit KÖT a terv

### ① Lista: jelvény a név alatt (C)

- Egy szótár a lead-lappal (`clientPill` / `bookingPill`, `src/console/views.ts`).
- Próba: „próbázik · még N nap”; legfeljebb 3 nap hátralévőnél sárga, az utolsó két napon „holnap lejár” / „ma lejár”.
  Ezen kívül **„előfizető”** és **„próba lejárt”**.
- Foglalás: „N foglalás”. Ha a tulaj még nem döntött egy kérésről, sárgán „N foglalás válaszra vár”.
- Ügyfél nélküli sorban nincs jelvény.

### ② Lista: szűrő-sor (B)

- A gombok: **„Mind”** · **„Próbázik”** · **„Foglalás érkezett”** · **„Előfizető”** · **„Próba lejárt”**,
  mindegyik mellett a darabszámmal. A darabszám az EGÉSZ aktív listára vonatkozik.
- Egy gomb a teljes aktív lista azon részét nyitja (`/leads?client=…`). Az oszlop-szűrők és az
  alapszűrés ilyenkor nem érvényesek: a saját honlapos próbázót az alapszűrés kiejtené.
- Diszkvalifikált nézetben a sor nincs kint.

### ③ Lead-lap: ügyfél-kártya a sáv alatt (B)

- Akkor van kint, ha a leadnek próbája, élő előfizetése vagy foglalása van.
- Cím: „Próbázik — még N nap” (≤ 3 napnál sárga keret), **„Előfizető — élő oldal”**, vagy
  „A próba lejárt N napja”. Próbánál csík jelzi, hányadik napnál tart.
- **„Élő oldal”** gomb (új lapon), lejárt próbánál nincs.
- Mezők próbánál: Indult · Lejár · Élő oldal · **„Folytatási kedvezmény”** ·
  **„Kapcsolattartó (a próba-űrlapról)”** · **„Honnan indította”**.
  Lejárt próbánál a mezők: a próba dátumai, az állapot és **„Adatok törlése”** (a lejárat + 90 nap).
- **„Foglalások”** táblázat, a legújabbal kezdve, legfeljebb 10 sor.
  - Oszlopok: kód (FG-…), időszak, vendég, ellátás, összeg, állapot, beérkezés.
  - Állapotok: **„válaszra vár”** · **„ajánlat kiment”** · **„visszaigazolva”** · **„elutasítva”** · **„lejárt”** · **„lemondva”**.
  - Telefonon a sorok kártyává állnak.
  - Üresen: **„Még nem érkezett foglalási kérés az élő oldalon.”**
- Ha a tulaj 24 órája nem válaszolt egy kérésre, sárga sor jelenik meg. Kimondja a lejáratot a webhely
  `autoDeclineHours` beállításából (alapból 48 óra; 0 = nem jár le), és ezzel zárul: **„Érdemes felhívni.”**
- Próbánál a kártya alján: **„Próbázó ügyfél: hideg megkeresés neki már nem megy.”**
  A tervben „ne küldj” állt; közben az O-1 javítás (ADR-0384) a küldést le is tiltotta, ezért a mondat a tényt mondja.
- A sávban próbánál a **Rendelés** állomás: **„próba fut — lent”**, és nincs „ez a következő” jelölés.

### ④ Értesítés (E2)

**Új próba.** Egy próbáról egy levél megy a riasztási e-mail címre, és SMS a riasztási telefonszámra.
- A levél tárgya: „Citoviso: új ingyenes próba — <név> (<város>)”.
  A törzse: szállás, indulás és lejárat, kapcsolattartó, honnan, élő oldal, kedvezmény, konzol-link.
  Benne a mondat: **„Hideg megkeresés neki már nem megy.”**
- Az SMS ékezet nélküli GSM-7, egy szelet: „Citoviso: UJ PROBA - <név>, <város>. Lejar: HH.NN. <élő oldal címe>”.
- A tervhez képest eltérés: a tárgy „Citoviso:”-tal kezdődik (nem „Citoviso —”-val), mert az éjszakai összesítő ezt az előtagot veszi le.
- 22 és 07 óra között az SMS vár, és reggel 07:00-kor a meglévő éjszakai összesítőben érkezik (ADR-0376/0379). A levél ilyenkor is azonnal megy.
- SMS csak az éles hostról megy, a meglévő zajszűrővel.
- Azonnal küldődik a próba indulásakor. Ha elveszett, az óránkénti söprés pótolja (24 órás visszatekintéssel).

**Válasz nélküli foglalás.** 24 órája `pending` kérésről egy levél megy (SMS nem), kérésenként egyszer.
- A tárgy: „Citoviso: válasz nélküli foglalás — <név> (N órája)”. A törzs mondata: „Érdemes felhívni…”.
- Kimarad, ha a webhely lejárati ablaka ≤ 24 óra, és ha a kérés 7 napnál régebbi.

## Őr

`scripts/client-visibility-check.mts`, saját scratch-DB-n. Ellenőrzi:
- az egy szabályt (próba > előfizetés > lejárt próba);
- a valódi olvasást;
- a lista jelvényét, a szűrő-sort és a `?client=` szűrést;
- a kártya kötő szövegeit;
- az értesítéseket: egyszer megy, felszabadít és újrapróbál, a régi próbát nem jelzi, az SMS GSM-7 és egy szelet.

A régi kódon piros: nincs `leadClient` / `clientNotify` modul.
