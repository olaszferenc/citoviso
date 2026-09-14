---
id: console-leads
title: Lead-lista — szűrés, rendezés, számok, diszkvalifikáltak
audience: operator
category: lead-path
anchors: console.leads
updated: 2026-09-14
---

A lead-lista két nézetből áll: az **„Aktív leadek”** a munka-lista, a
**„Diszkvalifikált leadek”** pedig az elutasítottaké. Mindig látszik a képernyő tetején, melyikben
vagy — a cím mondja ki, nem egy apró vissza-link.

![Képernyőkép: a lead-lista telefonon](assets/hu/screen.png)

## Melyik szám mit számol?

A cím alatti sor minden számot megnevez, mert önmagában egyik sem mond semmit:

- „1–50 / 260 sor megjelenítve” — amennyi ezen a lapon látszik.
- „260 felel meg a szűrőnek” — a jelenlegi szűrés teljes találati halmaza (ennyin lapozol végig).
  Ez a tétel **csak akkor jelenik meg, ha tényleg fut szűrő** — szűrés nélkül nincs mihez
  „megfelelni”.
- „593 aktív lead (szűrő nélkül)” — minden nem diszkvalifikált szereplő.
- „2 diszkvalifikált” — akiket kizártál.
- „595 felmért szereplő összesen” — a teljes gyűjtött állomány, a két nézet együtt.

Az irányítópult **„kvalifikált lead”** jelzője ugyanezt a szűrést számolja, mint amit a rákattintva
kapott lista mutat — a két szám nem térhet el.

## Az alapértelmezett szűrés

Üres `/leads` megnyitásakor a lista nem a teljes állományt mutatja, hanem a ma
megszólíthatókat. A szűrő-sor kiírja tételesen, **melyik oszlopra** milyen feltétel él,
például: „Alapértelmezett szűrő — Kvalifikáció: nincs honlap vagy elavult · Anyag: legalább 1”.

⚠️ A feltétel az **„Anyag”** oszlopon ül, nem a **„Fotók”**-on — ezért látsz a listában 0 fotós
sorokat is. Ez szándékos: egy szállásnak lehet 13 képe portál-profilból úgy, hogy a Places
egyet sem adott; a mock az összes összegyűjtött képből készül.

## Szűrés és rendezés a fejlécből

A táblázat fejléce nem csak felirat — szűrő **és** rendező is. A kettő egymás mellett van, ezért
érdemes tudni, melyik mit csinál:

- **Szűrés:** az oszlopnév melletti kis, felirat nélküli **vonalkás ikonra** koppintva nyílik le a
  szűrő. A kategorikus oszlopoknál (Terület, Ország, Város, Kvalifikáció, Kontakt, Mock) pipálható
  lista jön élő darabszámmal — hosszú listánál (Terület, Város) egy **„keresés…”** mező is, amivel
  szűkíthetsz. A szám-oszlopoknál (Fotók, Anyag, Match) egy **„legalább”** mező van. Amint pipálsz
  vagy beírsz egy számot, a lista **azonnal újratöltődik** — nincs külön „Alkalmaz” gomb. Ha a
  szűrő aktív, az ikon kigyullad: a pipálós szűrőnél a kijelölt értékek darabszáma, a szám-szűrőnél
  maga a küszöb látszik rajta (pl. `3+`).
- **Match-szűrés:** a Match 0 és 1 közti pontszám, ezért itt tizedes értéket adsz meg (0,05-ös
  lépésekkel, pl. `0.9`). ⚠️ A küszöb beállításával a **portál-találat nélküli („–”) sorok
  kiesnek** — helyesen, mert egy találat nélküli lead nem éri el a küszöböt. Ha azokat is látni
  akarod, vedd ki a Match-szűrőt.
- **Név-keresés:** a Név oszlop **nagyító ikonja** alatt gépelhetsz, és a lista a meglévő nevekből
  ajánl.
- **Rendezés:** **bármelyik oszlop nevére** koppintva rendezel. Amelyik oszlopnév mellett halvány
  **↕** áll, az rendezhető — vagyis mind. Érkezéskor a **„Felmérve”** oszlop nyila áll ↓-on: ez a
  lista alap-sorrendje, nem „rendezetlenség”. Koppintás után a nyíl a valódi irányt mutatja (↑ növekvő,
  ↓ csökkenő), az oszlopnév kiemelt színű lesz, újabb koppintás megfordítja; a lista visszaugrik az
  első lapra. Ha csak szűrni akartál, ügyelj rá, hogy az ikont találd el, ne a nevet.
  A szöveges oszlopok a **magyar ábécé** szerint rendeződnek, tehát az Á, É, Ó, Ö, Ü kezdetű nevek
  a helyükön vannak, nem a lista végén. Ahol nincs adat („–”), azok a sorok növekvő rendezésnél
  elöl, csökkenőnél hátul csoportosulnak.
- **Mindig látod, mi szerint olvasod a listát:** a szűrő-sor végén ott a sorrend
  („Sorrend: Felmérve (csökkenő)”, rendezés után pl. „Sorrend: Város (növekvő)”) — és mindig
  egy **oszlopot** nevez meg, amit a táblázatban vissza is tudsz nézni.

A szűrésed akkor is megmarad, ha közben **kiürítesz** egy fejléc-szűrőt: a
**„Szűrők törlése”**-vel kapott teljes listáról nem esel vissza az alapértelmezettre.
- Ha elveszett a fonál: **„Szűrők törlése”** — minden szűrőt egyszerre enged el, és ezzel a teljes
  aktív állományt (a „593 aktív lead” sort) kapod meg.

A szűrésed **átmegy a nézetváltáson**: ha a **„diszkvalifikáltak ▸”**-ra, majd az
**„◂ aktív leadek”**-re kattintasz, ugyanazt a szűrt listát kapod vissza, amiből elindultál.

⚠️ **Telefonon** a táblázat vízszintesen görgethető, és álló képernyőn csak néhány oszlop fér
ki egyszerre. **A Név oszlop közben a helyén marad** (oldalra húzva sem csúszik el), így minden
érték mellett látod, melyik szállásról szól — a lista a táblázat fölött ki is írja, hogy
oldalra húzva jön a többi oszlop.

## Mit jelentenek az oszlopok és a jelölések?

**A táblázat FÖLÖTT** nyitható ugyanez a lista a felületen is:
**„Mit jelentenek az oszlopok és a jelölések?”** — minden oszlop és minden cellán belüli jelölés
szerepel benne. Számítógépen nyitva fogad, telefonon csukva (hogy a táblázat elférjen), és
**minden oszlopfejléc mellett van egy „?” gomb**, ami egyenesen az ADOTT oszlop magyarázatához
ugrik és kiemeli azt — érintőképernyőn ez a leggyorsabb út.

![Képernyőkép: a jelmagyarázat kinyitva](assets/hu/legend.png)

- **„Kvalifikáció”** — a honlap-helyzet badge-e: **„nincs honlap”** (fő célcsoport),
  **„elavult”**, **„modern”**, **„ismeretlen”**. Diszkvalifikált leadnél itt áll az áthúzott
  **„diszkvalifikálva”** jelölés.
- **„Fotók”** — CSAK a Google Places-ből letöltött szállás-fotók száma. ⚠️ **A 10 PLAFON, nem
  darabszám:** a Google legfeljebb 10 fotót ad vissza, ezért ott a szám mellett a
  **„plafon”** jelölés áll, a szám pedig 10+ alakot vesz fel — annyit jelent, hogy ennyinél
  több is lehet. (Mérve: 595 leadből 365 áll pontosan itt.)
- **„Anyag”** — MINDEN összegyűjtött kép (Places + portál-profil + Street View). A mock ebből
  készül, ezért az alapszűrés is ezt méri.
- **„Match”** — 0 és 1 közti pontszám: mennyire biztos, hogy a megtalált portál-profil tényleg
  ehhez a szálláshoz tartozik. Ahol **„nincs találat”** áll, ott a gyűjtés nem talált
  portál-profilt (595 leadből 109 ilyen). ⚠️ A **0,85** aláhúzva a képlet **alapértéke** —
  nem mért egyezés, hanem a kiinduló súly (54 lead áll pontosan itt). Szűrhető („legalább”
  küszöbbel) és rendezhető is.

**Rendezni MINDEN oszlop szerint lehet** (a fejlécre koppintva). Szűrni majdnem mindegyik
szerint — két kivétellel: a **„Név”** oszlopban keresel (nem pipálsz), a **„Felmérve”**
oszlopnak pedig nincs szűrője, csak rendezése. Ha időszakra akarsz szűkíteni, rendezz a
Felmérve szerint, és felülről olvasd a listát.
- **„Kontakt”** — a legjobb csatorna a megkereséshez (e-mail / SMS / telefon / nincs).
- **„Mock”** — a legutóbbi mock állapota: **nincs / legenerálva / jóváhagyva / elutasítva**.
  (2026-09-14 óta magyarul — korábban az adatbázis angol értéke látszott.)
- **„Felmérve”** — mikor vette fel a gyűjtés a szereplőt. **Alapból ez a lista sorrendje**
  (a legutóbb felmért áll elöl), ezért a fejlécén nyíl mutatja az irányt. A cellában a dátum
  áll, a pontos időpontot az elemleírás (rámutatás) adja.
- **„Terület”** — **melyik gyűjtési terület (kereső-doboz) hozta be a leadet.** Ez a
  terület NEVE, **nem a lead földrajzi besorolása**: egy terület doboza több települést, akár
  egy tó mindkét partját lefedi. Ha azt akarod tudni, *hol van* a szállás, az **Ország** és a
  **Város** oszlopot nézd. Ahol a gyűjtési körhöz nincs felvett terület-rekord, ott
  **„nincs besorolás”** áll — a belső azonosító az elemleírásban van, nem a cellában.
- **„Ország”** / **„Város”** — a gyűjtésből; ha az nem hozott értéket, „–” áll ott.

Cellán belüli jelölések:

- **SV** a Fotók mellett — Street View-felvétel is elérhető a címről (tartalék nyitókép).
- **„✓ kiküldve”** a Mock oszlopban — a megkereső e-mail már elment ehhez a leadhez.
- **„nincs besorolás”** a Terület oszlopban — a gyűjtési körhöz nincs felvett terület-rekord,
  ezért a területnek nincs neve.
- **Szín** a Fotók és a Kontakt oszlopban — zöld = jó (3+ fotó, illetve e-mail), sárga = gyenge,
  piros = nincs.
- **–** bármelyik szám-oszlopban — nincs adat; az Anyag oszlopban a nulla is így jelenik meg.

## Lapozás

Alapból 50 sor jön egy lapon; alul a **„‹ Előző”** / **„Következő ›”** visz tovább.
A „Mind a 260 egy lapon” linkkel egyszerre is végignézheted a teljes találati halmazt — onnan a
**„Lapozva”** link vált vissza lapozott nézetre.

![Képernyőkép: a lapozó](assets/hu/pager.png)

## A lead-lapra

A lead nevére koppintva nyílik a lead-lap — ott zajlik az érdemi munka (adat-ellenőrzés,
mock-generálás, kuráció, megkeresés, konverzió). Erről külön útmutató szól: a Súgóban keresd a
„Lead-lap” témát.

## Diszkvalifikáltak

A szűrő-sáv jobb szélén a **„diszkvalifikáltak ▸”** link az elutasított szereplőket mutatja
(őket az újra-scrape sem hozza vissza); az **„◂ aktív leadek”** visszavált. A diszkvalifikálás
indokkal együtt a lead-lapon történik, és visszavonható.
