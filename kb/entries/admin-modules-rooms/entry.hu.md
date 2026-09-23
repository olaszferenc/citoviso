---
id: admin-modules-rooms
title: Szobák, apartmanok — egységek és saját aloldalaik
audience: tenant
category: bookings
anchors: admin.modules.rooms
updated: 2026-09-23
---

A szoba-modul beállító-képernyőjét a Modulok fülön, a modul melletti **„Beállítás”** linkkel éri
el. Itt adja meg, milyen egységeket (szobákat, apartmanokat) ad ki, és mit tudjon róluk a vendég.

Fontos: ugyanezeket az egységeket használja a foglalási naptár és az árazás is — elég egy helyen
karbantartani, és mindenhol egyezni fog.

![Képernyőkép: a szobák rácsa telefonon](assets/hu/screen.png)

## A szobák rácsa

A **„A szobái”** cím alatt minden egysége egy kártyán látszik, és a kártya pontosan azt mutatja,
amit a vendég lát a honlapon: a **borítóképet**, a nevet, a férőhelyet. A képen jobb alul a
jelvény a képek számát írja, egyetlen képnél a **„Részletek”** szót — mert az „1 kép” galériát
ígérne. A név alatt az állapot áll: **„Van saját oldala”** vagy **„Hiányos”**.

Ha ugyanaz a fénykép két egység borítója, azt a kártya piros jelvénnyel kimondja, és megnevezi a
másik egységet — így nem fordulhat elő észrevétlenül, hogy a honlapon két szoba ugyanazzal a
képpel szerepel.

Új egységet a rács alatti **„Új egység felvétele”** résznél vesz fel: adja meg a nevét, a
férőhelyét, és nyomja meg a **„Hozzáadás”** gombot. Ha csak egyben adja ki az egész szállást, elég
egyetlen egység — ilyenkor a vendég nem is találkozik a szobaválasztással.

Ha az Árak modul is be van kapcsolva, a **„Hozzáadás”** megnyomása ELŐTT ugyanitt az árat is
megadhatja (**„Alapár”** mező), vagy bepipálhatja a gomb alatti négyzetet: **„Nem adok meg árat —
egyedi ajánlatot küldök”**. Egyiket sem kötelező kitölteni, a szoba mindenképp felkerül. Ha a
beírt árat nem tudjuk értelmezni (például betűvel írta), a szoba ár nélkül kerül fel, és a sárga
sor ezt is megmondja. Ha se ár, se pipa nincs, a mentés után egy sárga sor mondja ki,
hogy a szobát felvettük, de nincs ára. Mellette az **„Árat adok meg”** gomb az Árazás lapra visz, a
**„Nem adok meg árat”** gomb pedig ott helyben rögzíti, hogy egyedi ajánlatot ad.

## A szerkesztő: koppintson a kártyára

A kártyára koppintva felugrik a szerkesztő. Bezárni a bal felső **×**-szel, a felugró melletti
sötét háttérre koppintva vagy az `Esc` billentyűvel tud. A **„Mentés”** gomb végig a felugró
alján marad, tehát nem kell hozzá végiggörgetni. Három fül van benne:

### „Alapok”

Itt van egy helyen az egység **neve**, a **férőhelye** és a **leírása** — pár mondat arról, mi
jellemzi ezt a szobát, mit szeretnek benne a vendégek. Számítógépen a jobb oldalon rögtön látja is
azt a kártyát, amit a vendég kapni fog.

### „Képek”

Felül nagyban látszik a **borítókép**, azzal a felirattal, hogy **„Ezt mutatja a honlap ezen a
kártyán”**. Ez az a kép, amit a vendég a szoba kártyáján lát.

A **„Kép feltöltése”** gombbal innen, a szobából is tölthet fel fényképet. A feltöltött kép a
**ház közös képtárába** kerül, és egyből ehhez az egységhez is hozzárendeljük — egy képet tehát
elég egyszer feltölteni, akkor is, ha több szobánál szeretné megmutatni. Ha az egységnek még nem
volt borítóképe, az első feltöltött lesz az; ha volt, azt nem írjuk felül.

Ha valamelyik fájlt nem tudjuk elfogadni (nem JPEG/PNG/WEBP, vagy nagyobb 6 MB-nál), megírjuk,
**melyik fájl** és **miért** maradt ki — a többit ilyenkor is feltöltjük.

Alatta **„A ház közös képtára”** következik, benne a szállás összes képe. A halvány képek még nem
tartoznak ehhez az egységhez.

* a **pipa** (bal felső sarok) rendeli a képet ehhez az egységhez — a mentéssel rögzül;
* a **csillag** (jobb alsó sarok) teszi borítóképpé. Ha a kép még nem tartozott ehhez az
  egységhez, a csillag hozzá is rendeli, és ezt ki is írjuk.

Ha kivesz egy képet az egységből (a pipát leveszi, majd ment), a kép a **közös képtárban benne
marad** — nem törli. Ha éppen az volt a borítókép, a sorban következő lép a helyébe; ha nem
maradt kép, azt is megírjuk.

### „Felszereltség”

Itt azt sorolja fel, ami **ebben az egységben** van (a ház egészére vonatkozó tételeket a
Felszereltség modulnál állítja). A kiválasztott tételek kis címkéken látszanak; újat a
**„Hozzáadás a listából”** résznél vesz fel, ikonos csempéken. Ha még egy tétel sincs kiválasztva,
a lista rögtön nyitva van. A kereső mezőbe beírva gyorsan megtalál bármit (pl. „stég”). Ami nincs
a listában, azt az **„Egyéb, ami nincs a listában”** mezőbe írhatja, soronként egyet. Ami az egész
szállásra vonatkozik (pl. medence, parkolás), az halvány, szaggatott csempeként látszik: azt a
Felszereltség modulnál állítja, és a szoba automatikusan örökli.

Ez a fül csak akkor szerkeszthető, ha a **Felszereltség** modul be van kapcsolva — ha nincs, a fül
megmutatja, mit tudna itt beállítani, és a Modulok fülre hív.

![Képernyőkép: a „Képek” fül a közös képtárral](assets/hu/picker.png)

## Mikor lesz saját oldala egy egységnek?

Ha egy egységhez van legalább **egy hozzárendelt fotó** ÉS **leírás vagy felszereltség**, az
egység saját aloldalt kap az Ön honlapján — a keresők (Google) külön is megtalálják, ami több
vendéget hozhat. A rács kártyáján és az **„Alapok”** fülön is mindig kiírjuk, hogy az adott
egységnek lesz-e saját oldala, és ha nem, mi hiányzik hozzá. Üres oldalt sosem készítünk — az
többet ártana, mint használna.

## „A szállás egésze” — a fölérendelt egység

A lista első eleme mindig **az egész szállás**: ez azt jelenti, hogy valaki a teljes szállást
foglalja le. Ezért ha az egész szállást lefoglalják egy napra, a szobái arra a napra
automatikusan foglaltak lesznek — és fordítva, ha bármelyik szobája foglalt, az egész szállás
nem adható ki aznap. Emiatt ez az egység **nem törölhető** (az **„Egység törlése”** gomb nem is
jelenik meg a felugrójában); átnevezni bármikor átnevezheti.
