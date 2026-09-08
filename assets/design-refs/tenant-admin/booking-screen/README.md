# Online foglalás képernyő — kontraktus (tulajdonosi jóváhagyás, 2026-09-08)

A tulaj szava (idézet, nem UI-felirat): *A változat + ha foglalt napra kattint, tudja megnézni
a foglalások részleteit*, majd a részlet hordozójára: *felugró ablak de középre igazítva*.

Az `approved.html` a jóváhagyott, MŰKÖDŐ vázlat (méret-váltó, egység-fülek, csukható
naptár, kattintható napok, mind a négy nap-fajta részlete). A döntéskori képek:
`decision-mobile.png`, `decision-desktop.png`, `linked-day-mobile.png`.
**Ez a terv KÖT — elvárt viselkedés, nem stílus-javaslat.**

Előzmény: a tulaj a mai képernyőre azt mondta, hogy *az egységek és a naptár teljesen gagyi
kinézetű felül*, és hogy a naptár legyen összecsukható. Három változatot látott
(fülek / egység-lista / legördülő); az **A** nyert.

## 1. Amit a FEJLÉC köt

Egyetlen sötét blokk, nem öt szétszórt sor. Benne: a modul neve (`Online foglalás`),
az ára pirulában (`+990 Ft/hó`), alatta két szöveges link: `‹ Vissza a modulokhoz` és
`Útmutató ehhez a képernyőhöz` (a KB-horgony, ADR-0045 §J).

⛔ A régi állapot (cím + szállásnév + vissza-link + súgó-gomb + ár-sor + „Melyik egység?"
felirat, mind külön sorban) nem térhet vissza.

## 2. Amit az EGYSÉG-VÁLASZTÓ köt

**Fülsor** (nem lebegő pirulák), vízszintesen görgethető, minden fülön két sor:
a név, alatta halványan a férőhely. Az egész szállás fülén ez a második sor kimondja,
hogy ő az egész (`10 fő · az egész ház`) — ADR-0114 óta ő a fölérendelt egység.
Aktív fül: sötét szöveg + ciános alsó vonal. Tap-méret ≥ 44px.

⛔ A választó akkor is látszik, ha csak egy egység van? **Nem** — az egy-egységes tulaj
soha nem találkozik a fogalommal (ADR-0044/b).

## 3. Amit a NAPTÁR köt

- **Összecsukható.** A fejléc-sorban: „Mikor van tele? — <egység>", alatta a hónap, jobbra
  egy jelvény, ami **csukott állapotban is megmondja a lényeget**: `3 nap tele` /
  `nincs tele nap`. A chevron forog.
- **Egység-váltáskor a naptár KINYÍLIK** — a tulaj azért váltott, hogy lássa.
- A rács Monday-first, a múlt napjai halványak és nem kattinthatók.
- Asztali gépen a rács **nem nő tovább** (max ~500px); a jelmagyarázat és a mentés a
  naptár MELLÉ kerül, nem alá. Mobilon egymás alatt.
- ÖT nap-fajta, mind megkülönböztethető: **szabad** (üres), **az ÖN kézi blokkja**
  (közepes kék, koppintásra felold), **vendég foglalása** (legsötétebb + cián kézjegy-pötty,
  koppintásra kártya), **másik egység foglalása** (csíkos, ADR-0114), **portálról**
  (ciános csíkos). A jelmagyarázat mind az ötöt megnevezi.

## 4. Amit a NAP RÉSZLETE köt (a tulaj kérése)

**A foglalt nap gomb, nem jelölőnégyzet** — mögötte adat van. Koppintásra
**KÖZÉPRE igazított felugró kártya** nyílik, sötétített háttérrel.
⛔ Nem alulról feljövő lap, és nem a naptár alatt kinyíló panel (mindkettőt látta, ezt
választotta).

A kártya tartalma nap-fajtánként:

| Nap | Mit mutat |
|---|---|
| **Saját foglalás** | Vendég neve · státusz-címke · időszak (hány éjszaka) · létszám · ár · e-mail és telefon **kattintható** linkként · honnan jött · a vendég üzenete, ha van. Műveletek: „Foglalás megnyitása" (a Foglalások fülre) és „Írok a vendégnek". |
| **Másik egység foglalása** (csíkos) | KI tartja (vendég), melyik egységen, milyen időszakban, és a mondat, hogy ezért nem foglalható itt. Műveletek: „Foglalás megnyitása" + **„Átváltok a naptárára"**. |
| **Kézi blokk** | ⚠️ **ELTÉRÉS a vázlattól, megvalósításkor (2026-09-08).** A vázlaton a kézi napnak is kártyája volt („Ön jelölte tele" + „Mégis kiadom ezt a napot"). A szállított képernyőn NINCS: a kézi nap koppintásra AZONNAL felszabadul — ez a képernyő fő művelete („koppintson a napokra, amikor tele van"), és egy közbeiktatott kártya minden egyes napnál két koppintásra lassítaná. Cserébe a kézi nap MÁS SZÍNŰ, mint a vendég-foglalás, és a jelmagyarázat külön nevezi meg: **„Ön jelölte tele"** vs. **„Vendég foglalása"** — a vázlaton ez a kettő pixel-azonos volt, ami a tudásbázis-őr szerint épp a legkockázatosabb félreértés. |
| **Portál-nap** | A portál neve, az időszak, és hogy **itt nem módosítható** — ott kell kezelni. |

A kártya bezárható (×), a sötét háttérre koppintva is. A nyitott naphoz a naptárban
ciános kiemelés tartozik, hogy látszódjon, melyikről szól.

## 5. Amit a MÉRET köt

- **Mobil (390px):** egy oszlop; a kártya a képernyő közepén, `min(440px, 100%-28px)`
  szélességgel, görgethető, ha nem fér ki.
- **Asztali:** a naptár és a jelmagyarázat/mentés két hasábban; a kártya ugyanúgy középen.
- A vázlat méret-váltója `@container`-rel dolgozik és a VIEWPORTBÓL indul.

## 6. Ami NINCS a tervben (tudatosan)

- **Foglalás SZERKESZTÉSE a kártyán** — a döntés és a módosítás helye a Foglalások fül;
  ez a kártya oda VISZ, nem másolja le. Két hely nem dönthet ugyanarról.
- **Portál-nap felszabadítása** — a portál a forrása, itt feloldani dupla eladás volna.
- **Hónapon átnyúló sáv-rajzolás** (a foglalás „végigfestése" a rácson) — a jelenlegi
  nap-alapú jelölés marad; a részlet-kártya úgyis kiírja a teljes időszakot.

## 7. Mérés

**A SZÁLLÍTOTT felületet** `scripts/booking-screen-check.mts` méri (pre-commit): 25 állítás
mindkét méretben, valódi szerveren, bejelentkezett tenantként — a fejléc egy blokk, a fülek
megvannak, a naptár csukódik és a jelvény igazat mond, a foglalt nap kártyája megnyílik és
**mérten középen** áll (0px eltérés), a kézi blokk és a vendég-foglalás **különböző színű**,
a csíkos nap megnevezi a foglalót és átvisz, és JS-hiba nincs.

A jóváhagyáskori VÁZLAT viselkedését `assets/design-refs/_drafts/reszletek-check.mts` mérte
(17 állítás) — a vázlat a `_drafts` takarításával eltűnik, a kontraktus és a szállított
felület őre marad.
