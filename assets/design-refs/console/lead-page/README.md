# Operátor lead-lap (`/lead/:id`) — jóváhagyott terv (B változat, 2026-09-14)

Tulajdonosi jóváhagyás: **2026-09-14**. A tulaj két változatot látott mobil ÉS asztali képen,
kattintható HTML-lel, és a **B** változatot választotta: *munkamenet-sáv és összehasonlító
mock-tábla*. Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat.

> ⚠️ A `**„…”**` alak ebben a fájlban **felületi feliratot** jelöl — a `contract-drift-check`
> pontosan azokat keresi vissza a kódban. A változat NEVE nem felirat, ezért nem abban az
> alakban áll.

Referencia: `plan.html` (kattintható, valós adattal, „Mobil 390px / Asztali” váltóval),
`B-asztali.png`, `B-mobil.png`, és **külön** `B-mock-ful-{asztali,mobil}.png` — mert a két
változat legnagyobb különbsége a „Mock és generálás” fülön ül, a lap érkezési állapotában
pedig az nem látszik. Az elvetett változat is bent marad (`A-elvetett-*.png`), hogy a döntés
MIRE mondott nemet, az is dokumentálva legyen.

Testvér-kontraktus: `assets/design-refs/console/lead-list/` (a lista, ADR-0161). A két
felület **egy szótárat** használ az állapotokra — az a döntés ott dőlt el, és ide is áll.

---

## Miért van — a mért hibák (Elek FK-003b, 2026-09-13; újramérve 2026-09-14)

| Hiba | Mérés |
|---|---|
| A fejléc-metrika néma gondolatjel | `matchConfidence == null` → egy alig látható szürke `–` navy alapon; **595 leadből 109-nek nincs értéke**, a magyarázat pedig egy MÁSIK fülön, a lap közepén |
| Futás közben elvész a „van jóváhagyott mock” tény | a pirula feltétele (`latestMock.status !== "approved"`) pont abban az esetben hamis, amit a lelet leír; a tény csak gépi `data-cit-approved` attribútumban él |
| Három különböző képszám ugyanarról a leadről | ELEK-TESZT, mérve: **12** (Adatok fül) · **11** (portál-bontás) · **10** (a mockba ment) — és a bontás (0+11+0) nem adja ki a 12-t, mert a Street View „igen”-ként szerepel, de számként beleszámít |
| Öt egyforma artefaktum-kártya | a cím minden azonos sablon/skin-re ugyanaz — a kártyák nem mondják meg, miben KÜLÖNBÖZNEK |
| A két főszám nem jön ki egymásból | „9 szolgáltatást … 18-ból” és „3 dolgot … nem említ” — a maradék 6 tétel sorsáról egy szó sem |
| Gépi szöveg az operátor szeme előtt | nyers `kulcs=érték` felsorolás (üres `heroScore=` mezőkkel), nyers `reject` enum a döntés-soron, `superseded_by:<uuid>` jegyzet |
| Magyarázat nélküli fül-számlálók | hét fülből hat visel magyarázat nélküli számot, a „Fotók” egyet sem — így a hiánya „üres”-nek olvasódik |
| „mérés indul” felirat egy 119 eseményes linken | a gomb olyat állít, ami már megtörtént |

---

## Mit KÖT a terv

### ① MUNKAMENET-SÁV a fejléc alatt — nagy metrika-szám helyett

Hat állomás, balról jobbra: **„Begyűjtve”**, **„Mock”**, **„Jóváhagyva”**, **„Kiküldve”**,
**„Rendelés”**, **„Fizetve”**.

- A lap első kérdése az, hogy **hol tart ez a lead, és mi a következő lépés** — nem az, hogy
  mennyi egy pontszám.
- **Minden állomás vagy dátumot mond, vagy azt, hogy „még nem”.** ⛔ Néma gondolatjel sehol:
  a `–` eddig egyszerre jelentett „nem mértük”-et és „nulla”-t.
- A soron következő állomás **megjelöli magát** („ez a következő”), hogy a kurátor ne
  keresse.
- A megtett állomások dátuma **ott marad**; a sáv nem felejt.

### ② ADAT-MEGBÍZHATÓSÁG: egy sor a sáv alatt, a KÖVETKEZMÉNYÉVEL

A match-konfidencia nem nagy szám a fejlécben, hanem egy mondat, ami **kimondja, mi következik
belőle**: ha nincs mért egyezés, akkor azt, hogy **kiküldés előtt át kell nézni az Adatok
fület**. Ahol van érték, ott a lista szabálya áll (ADR-0161 ⑥): a `0,85` a képlet
ALAPÉRTÉKE, nem mért egyezés.

### ③ FÜL-SZÁMLÁLÓ HELYETT MONDAT

A fülsor alatt egy sor mondja meg, **mi van a megnyitott fülön**, és a fül-váltást követi.
⛔ Így a „Fotók” fül sem lóg ki azzal, hogy neki nincs száma — egy hiányzó szám „üres”-nek
olvasódik, pedig nem az.

### ④ A MOCKOK ÖSSZEHASONLÍTÓ TÁBLÁBAN — a sor a KÜLÖNBSÉGET mutatja

Oszlopok: **készült · sablon/arculat · képszám · nyitókép · állapot · döntés**.
⛔ Így „öt egyforma kártya” **szerkezetileg lehetetlen**: ami két mockban közös, az egy
oszlopban ismétlődik, ami különbözik, az egymás alatt áll és összevethető.
A felülírás **megnevezi, MI írta felül** (nem `superseded_by:<uuid>`), a döntés pedig
magyarul áll (nem nyers `reject`).

### ⑤ EGY KÉPSZÁM, LEVEZETVE

Egy mondat: hány képet gyűjtöttünk, és ebből hány ment a jóváhagyott mockba. A bontás
(portál / Street View / Places / a fotó-kapun kiesett) **kinyitható**, nem három külön
helyen szétszórva. ⛔ Ahol több szám van, a lap megmutatja, hogyan jönnek ki egymásból.

### ⑥ A KÉT FŐSZÁM ÖSSZEADÓDIK

A „mit használ fel a szöveg” sáv három szakasza (**felhasznált + kimaradt + ismétlés**)
**kiadja a nevezőt**, és a lap ki is írja az összeadást. ⛔ És kimondja, hogy a nevező nem
csak a gyűjtésből jön, ezért generálásonként változhat.

### ⑦ FUTÁS KÖZBEN SEM VÉSZ EL, HOGY VAN JÓVÁHAGYOTT MOCK

Újragenerálás alatt a **Mock** állomás vált futás-állapotra (eltelt idővel), a **Jóváhagyva**
állomás viszont **a helyén marad a saját dátumával**. ⛔ Ezen múlik, hogy a megkeresés
kiküldhető-e — a tény nem tűnhet el csak azért, mert épp készül egy újabb mock.

### ⑧ NINCS GÉPI SZÖVEG AZ OPERÁTOR SZEME ELŐTT

`kulcs=érték` helyett megnevezett sorok (**üres mező nem jelenik meg**), nyers enum helyett a
közös szótár szava, `superseded_by:<uuid>` helyett „Felülírta: …”. A fejlesztői adatok
elérhetők maradnak, de **kinyitva**, nem az operátor arcába.

### ⑨ A GOMB A SAJÁT TETTÉT MONDJA

**„Megjelölöm kiküldöttként”** — ⛔ nem „mérés indul”, mert a linken már 119 esemény van. A
mérés a link létrehozása óta fut; a megjelölés azt rögzíti, hogy INNENTŐL a forgalom a
címzetté.

### ⑩ TELEFONON A SÁV FÜGGŐLEGES, A TÁBLA SOROKKÁ BOMLIK

390 px-en hat állomás vízszintesen vagy kigörögne, vagy olvashatatlanul összenyomódna — ez
**külön tervezői döntés**, nem a desktop lelőve. A mock-tábla ugyanígy: fejléc nélkül,
soronként megnevezett mezőkkel.

---

## Amit a terv SZÁNDÉKOSAN nem old meg

- Az **irányítópult** „13/14 eladó” piros jelvénye — ugyanaz a hibaosztály (állapot-szín
  olyat állít, ami nem igaz), de másik felületen.
- A **diszkvalifikált lista-nézet** hiányzó „mikor/ki” adata — a lista kontraktusánál nyitva.

---

## Kapuk

`scripts/lead-page-plan-check.mts` — a KIRENDERELT lapon mér, valódi stíluslappal:
a sáv állomásai és állapotai, a futás közben is megmaradó jóváhagyott-tény, a fül-mondat,
az összehasonlító tábla oszlopai, az összeadódó sáv aritmetikája, a nyers enum és a
`kulcs=érték` hiánya, és telefonon a sáv függőlegessége. Piros önteszttel, a pre-commitben
`views.ts` / `leadFilters.ts` / `citui-console.css` triggerrel.

A meglévő `mock-state-label-check` (a jelölés mindkét kérdésre felel) és
`lead-tab-anchor-check` (a visszairányítás megnevezi a fület) változatlanul érvényes.
