---
id: console-leads
title: Lead-lista — szűrés, rendezés, számok, diszkvalifikáltak
audience: operator
category: lead-path
anchors: console.leads
updated: 2026-09-19
---

A lead-lista két nézetből áll: az **„Aktív leadek”** a munka-lista, a
**„Diszkvalifikált leadek”** pedig az elutasítottaké. Mindig látszik a képernyő tetején, melyikben
vagy — a cím mondja ki, nem egy apró vissza-link.

![Képernyőkép: a lead-lista telefonon](assets/hu/screen.png)

## Hány sort látsz, és mihez képest?

A táblázat **ALATT** egyetlen sor áll, és az mondja meg mindkét számot:
„260 sor a 596 aktív leadből — nincs lapozás, mind itt van.”

- Az **első szám** a most látható sorok száma.
- A **második** az a készlet, amiből szűrtél: az aktív (nem diszkvalifikált) leadek.
  Erre azért van szükség, mert a lista **alapból szűr** — enélkül a 260 úgy nézne ki,
  mintha ennyi lead lenne összesen.
- Ha **nincs** aktív szűrő, a sor rövidebb: „596 sor — nincs lapozás, mind itt van.”
  Ilyenkor nincs mihez viszonyítani.

Az irányítópult **„kvalifikált lead”** jelzője ugyanezt a szűrést számolja, mint amit a rákattintva
kapott lista mutat — a két szám nem térhet el.

## Az alapértelmezett szűrés

Üres `/leads` megnyitásakor a lista nem a teljes állományt mutatja, hanem a ma
megszólíthatókat: **nincs honlapja vagy elavult**, és **van legalább 1 összegyűjtött képe**.

Hogy ez fut, két dologról látod:

1. az érintett oszlopfejlécen (**„Kvalifikáció”**, **„Anyag”**) **cián tölcsér** áll egy
   jelvénnyel — rámutatva kiírja a feltételt is, pl. „Kvalifikáció: nincs honlap vagy elavult”;
2. a cím sorában ott a **„Szűrők törlése”** link, ami szűrés nélkül **nincs** ott.

⚠️ A feltétel az **„Anyag”** oszlopon ül, nem a **„Fotók”**-on — ezért látsz a listában 0 fotós
sorokat is. Ez szándékos: egy szállásnak lehet 13 képe portál-profilból úgy, hogy a Places
egyet sem adott; a mock az összes összegyűjtött képből készül.

## Szűrés és rendezés a fejlécből

A táblázat fejléce nem csak felirat — szűrő **és** rendező is. A kettő egymás mellett van, ezért
érdemes tudni, melyik mit csinál.

⚠️ **A vezérlők alapból nem látszanak.** Az egérrel a fejléc fölé húzva jelennek meg (telefonon
halványan mindig ott vannak), aktív szűrőnél pedig ciánnal kigyulladnak. Ez szándékos: 11 oszlopnyi
mindig látható ikon zajt csinál, és elveszi a figyelmet az adattól.

- **Szűrés:** az oszlopnév melletti **tölcsér ikonra** koppintva nyílik le a szűrő.
  A kategorikus oszlopoknál (Terület, Ország, Város, Kvalifikáció, Kontakt, Mock) pipálható
  lista jön élő darabszámmal — hosszú listánál (Terület, Város) egy **„keresés…”** mező is, amivel
  szűkíthetsz. A szám-oszlopoknál (Fotók, Anyag, Match) egy **„legalább”** mező van. Amint pipálsz
  vagy beírsz egy számot, a lista **azonnal újratöltődik** — nincs külön „Alkalmaz” gomb.
- **Miről szól egy aktív szűrő:** a kigyulladt tölcsérre **rámutatva** (telefonon: hosszan nyomva)
  kiírja a saját mondatát, pl. „Anyag: legalább 1” vagy „Mock: jóváhagyva vagy elutasítva”.
  A mondat mindig azt az oszlopot nevezi meg, amelyiken a szűrő tényleg dolgozik.
- **A jelvény két alakja két külön dolgot jelent:** a **kerek, kitöltött cián pötty** DARABSZÁM
  (hány értéket pipáltál ki), a **szögletes, körvonalas `≥` jelvény** pedig KÜSZÖB (alsó határ).
  Az alapértelmezett nézetben mindkettő látszik egyszerre: `2` a Kvalifikáción, `≥1` az Anyagon.
- **Match-szűrés:** a Match 0 és 1 közti pontszám, ezért itt tizedes értéket adsz meg (0,05-ös
  lépésekkel, pl. `0.9`). ⚠️ A küszöb beállításával a **portál-találat nélküli („–”) sorok
  kiesnek** — helyesen, mert egy találat nélküli lead nem éri el a küszöböt. Ha azokat is látni
  akarod, vedd ki a Match-szűrőt.
- **Név-keresés:** a Név oszlop **nagyító ikonja** alatt gépelhetsz, és a lista a meglévő nevekből
  ajánl.
- **Rendezés:** **bármelyik oszlop nevére** koppintva rendezel. Amelyik oszlopnév mellett halvány
  **↕** áll, az rendezhető — vagyis mind. Érkezéskor a **„Felmérve”** oszlop nyila áll ↓-on: ez a
  lista alap-sorrendje, nem „rendezetlenség”. Koppintás után a nyíl a valódi irányt mutatja
  (↑ növekvő, ↓ csökkenő), és az oszlopnév kiemelt színű lesz; újabb koppintás megfordítja.
  Ha csak szűrni akartál, ügyelj rá, hogy a tölcsért találd el, ne a nevet.
  A szöveges oszlopok a **magyar ábécé** szerint rendeződnek, tehát az Á, É, Ó, Ö, Ü kezdetű nevek
  a helyükön vannak, nem a lista végén. Ahol nincs adat („–”), azok a sorok növekvő rendezésnél
  elöl, csökkenőnél hátul csoportosulnak.
- **Mindig látod, mi szerint olvasod a listát:** a kiemelt színű oszlopnév és a nyila mondja meg,
  melyik oszlop rendez és melyik irányba — nem külön mondat a cím alatt.

A szűrésed akkor is megmarad, ha közben **kiürítesz** egy fejléc-szűrőt: a
**„Szűrők törlése”**-vel kapott teljes listáról nem esel vissza az alapértelmezettre.
- Ha elveszett a fonál: a cím sorában a **„Szűrők törlése”** minden szűrőt egyszerre enged el, és
  ezzel a teljes aktív állományt kapod meg.

A szűrésed **átmegy a nézetváltáson**: ha a **„diszkvalifikáltak ▸”**-ra, majd az
**„◂ aktív leadek”**-re kattintasz, ugyanazt a szűrt listát kapod vissza, amiből elindultál.

⚠️ **Ha a 11 oszlop nem fér ki**, a táblázat vízszintesen görgethető, és a lap ezt ki is írja a
táblázat fölött: **„Oldalra görgetve jön a többi oszlop — a Név oszlop közben a helyén marad.”**
**A Név oszlop közben a helyén marad** (oldalra húzva sem csúszik el), így minden érték mellett
látod, melyik szállásról szól. Telefonon ez mindig így van; számítógépen csak akkor, ha tényleg
nem fér ki minden oszlop — széles képernyőn se ragadás, se ez a mondat nincs.

⚠️ **A fejléc-sor a helyén marad lefelé görgetve is.** Mivel nincs lapozás, a lista akár több száz
soros is lehet — a 100. sornál is látod, melyik oszlopot nézed.

## Mit jelentenek az oszlopok és a jelölések?

A cím mellett **egyetlen „?” gomb** áll. Rákoppintva felugrik a teljes jelmagyarázat:
**„Mit jelentenek az oszlopok és a jelölések?”** — mind a 11 oszlop, és minden cellán belüli
jelölés. A felugrót az **×**, az **ESC** vagy a háttérre koppintás zárja, és a lábában ott a
**„Részletes súgó a tudásbázisban”** link, ami ide, ehhez a szócikkhez hoz vissza.

Érintőképernyőn ez az egyetlen út a jelentéshez: az egérrel megjeleníthető elemleírás
(rámutatás) telefonon nem elérhető.

![Képernyőkép: a jelmagyarázat felugró ablaka](assets/hu/legend.png)

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

## Nincs lapozás

**A lista minden rekordot egyben mutat** (tulajdonosi döntés, 2026-09-19). Nincs
„‹ Előző” / „Következő ›”, nincs lapszám és nincs „mind egy lapon” kapcsoló: amit a szűrő
kiválaszt, az mind ott van egyetlen görgethető táblázatban, a fejléce pedig a helyén marad.

Ha sok a sor, **ne lapozz — szűrj vagy rendezz**: a fejléc tölcsére és az oszlopnév erre való.

## A lead-lapra

A lead nevére koppintva nyílik a lead-lap — ott zajlik az érdemi munka (adat-ellenőrzés,
mock-generálás, kuráció, megkeresés, konverzió). Erről külön útmutató szól: a Súgóban keresd a
„Lead-lap” témát.

## Diszkvalifikáltak

A cím sorának jobb szélén a **„diszkvalifikáltak ▸”** link az elutasított szereplőket mutatja
(őket az újra-scrape sem hozza vissza); az **„◂ aktív leadek”** visszavált. A diszkvalifikálás
indokkal együtt a lead-lapon történik, és visszavonható.
