---
id: console-approval
title: Jóváhagyás — mehet-e ki a megkeresés, és hol
audience: operator
category: lead-path
anchors: console.approval
updated: 2026-11-27
---

A **„Jóváhagyás”** lapon döntöd el, hogy egy megkeresés kimehet-e a leadnek. A listán csak az a lead
jelenik meg, amelyiknek **mindkét terve** végigment a teljes láncon: a mostani generátorral készült
(a folyamat a régebbieket magától újragenerálja), legalább 5 saját fotója van, és a gépi ellenőrzésen
(a render-kapun) átment, és van e-mail-címe. E-mail-cím nélküli lead nem kerül ide, mert levelet nem
kaphat; ha később kerül hozzá e-mail-cím, magától visszalép. A minőségi kolléga jóváhagyása nem feltétel; ha viszont ő egy változatot
rossznak ítélt, az addig nem kerül ide, amíg újra nem készül. Második terv nélkül
megkeresés nem megy ki. Ami ezek közül bármelyiken elakadt, az nem kerül ide, és a menüben látható
szám sem számolja. Megkeresés csak a te jóváhagyásod után megy ki. Hogy egy országban a te
jóváhagyásod kell-e, azt országonként az **Országok / Árazás** lapon, az ország **„Kiküldés”** fülén, a
**„4. Jóváhagyás”** szakaszban állítod: **„Tulaj-jóváhagyás”** esetén az ország leadjei itt várnak a
**„Mehet”**-re (ma minden országban ez az alapérték), **„Automata”** esetén a gép 20 percenként jóváhagyja a
feltételeknek megfelelőket (ha az automata jóváhagyás főkapcsolója be van kapcsolva), és azok nem várnak rád.

## „Jóváhagyásra vár”

Bal oldalt a lista. Felül keresőmező (név vagy település), alatta szűrés honlap szerint
(**„Nincs honlap”** / **„Elavult honlap”**); a **„Szűrők törlése”** mindent visszaállít. Ha a
listában több ország leadje vár, a honlap-szűrő fölött egy **„Ország”** szűrősor is megjelenik
(országonként egy gomb), a lista tetején pedig országonként látod, hány lead vár — minden
országnak saját küldési ablaka és napi kvótája van. A leadek sorában ilyenkor az ország kódja
is ott áll a település előtt. Telefonon a
lista felül áll, alatta a kiválasztott lead.

- **A kiválasztott lead fejlécében** a neve és a települése mellett a **„Keresés”** gomb új ablakban
  megnyitja a Google-t a szállás nevével, a településsel és az e-mail-címmel; alatta az
  elérhetőségei jelvényként, benne az adattal. A megkeresés mindig e-mailben megy,
  országtól függetlenül. SMS, MMS és Viber nem megy ki, akkor sem, ha a leadnek van mobilszáma.
  Ezzel nincs teendőd — a „Mehet” az e-mailt engedi ki.
- **A megkeresés szövege** (alapból összecsukva, a címére kattintva nyílik le): a levél tárgya és
  bekezdései, szerkeszthetően. Ha átírsz valamit, nyomd meg a **„Mentés”** gombot, mielőtt a
  **„Mehet”**-re koppintasz — a „Mehet” a szöveget nem menti el. Üresen hagyott mező = a gépi szöveg megy; ha már elmentettél saját szöveget, a **„Vissza a gépi szövegre”** gomb visszaállítja. Ha a mentés nem sikerül, piros
  **„Nem mentettem”** sáv sorolja fel az okokat. Ha a panel tetején sárga dobozban figyelmeztetés áll (például hogy a jogszerűségi kapu megállítaná a levelet, vagy a leadnek több e-mail-címe van), előbb javítsd a szöveget vagy válaszd ki a címet a lead lapján — ha nem javítható, nyomd a **„Nem mehet ki”** gombot.
- **„Mehet”** — a jóváhagyásod mindkét tervre, ebben a mostani állapotukban szól. A lead visszakerül a
  kiküldési sorba, és a hétköznapi küldési ablakban (reggel 8-tól) kimegy. Ha bármelyik terv a jóváhagyásod után
  megváltozik (például a folyamat újragenerálja), nem megy ki, hanem újra a jóváhagyásodra vár.
  **„Nem mehet ki”** — a megkeresés törlődik. Mindkettő után a következő lead nyílik meg.
- Alul a nézet: **„1. terv”** / **„2. terv”** a terv teljes oldala, **„Levél”** pedig pontosan az a
  levél, amit a lead megkap, képpel együtt. **„Asztali”** / **„Mobil”** a szélesség.
- **„Megkereső link megnyitása (nem számít kattintásnak)”** — új lapon megnyitja azt az oldalt, amire
  a levél linkje visz (a „Levél” fül és ez a gomb akkor látszik, ha a levél elkészíthető). A te megnyitásod nem számít a lead kattintásának; a „Levél” nézetben lévő
  linkek ugyanígy.

## „Javító levél”

Ez a fül csak akkor látszik, ha van javító levél. A régi településkép-választó november 13. és 23. között néhány
megkeresés tervébe hibás nyitóképet tett (mozdonyt, vasútállomást, űrfelvételt). Aki egy ilyen tervet megnézett,
és azóta nem válaszolt, nem iratkozott le és nem ügyfél, egyszer kap egy javító levelet a mai generátor két új
tervével. A fül melletti szám azt mutatja, hány javító levél vár a döntésedre.

- **Bal oldalt a lista**: a szállás neve és egy címke. Asztali gépen a név alatt a település, hogy mikor ment ki a
  hibás levél, hányszor nézte meg és mi volt a hiba is látszik; telefonon ezek a kiválasztott lead fejében állnak.
  A címke mutatja, hol tart:
  - **„Döntésre vár”** — a két új terv kész, a te döntésedre vár.
  - **„Mehet — kiküldésre vár”** — jóváhagytad, a következő kiküldési ablakban megy ki. A jóváhagyás után a lead
    fejében szürke sor csak akkor áll, ha a küldés egy ellenőrzésen akadt el („küldés vár: …”, például Vera ítélete
    hiányzik); ez később magától átmehet, a gép minden kiküldési ablakban újra megpróbálja, teendőd nincs.
  - **„Kiment”** — a javító levél elment.
  - **„Nem megy ki”** — „Nem mehet ki”-t nyomtál.
  - **„Küldéskor kimaradt”** — küldés előtt kiderült, hogy a lead közben leiratkozott, válaszolt vagy ügyfél lett;
    nem kap levelet.
  - **„Készül”** — a két új terv még nem készült el (néhány percen belül elkészül).
  - **„Elakadt — a gép újrapróbálja”** — a két új terv nem készült el; az okát a lead fejében a szürke sor írja ki.
    A gép naponta egyszer magától újrapróbálja (így egy bővült településképtárat is felvesz), új szöveg érkezésekor
    azonnal. Teendőd nincs.
- **Fent** az **„Ami rossz volt”** sor megmondja, mi volt a hibás nyitókép. Ha sárga doboz figyelmeztet, hogy az új
  terv szövegét Vera még nem ellenőrizte, a levél a „Mehet” után is csak Vera ítélete után megy ki.
- **Középen egymás mellett** látod a két oldalt: balra **„Régi — kiküldve”** és a dátum (amit a lead annak idején
  kapott), jobbra **„Új — javított”** (a két új terv). A gombokon a terv száma és a sablon neve áll (például
  „1. terv · Parallax”, „2. terv · Kapunyitás”); ezekkel váltasz. Ha a régi levélben csak egy terv volt, bal
  oldalt csak az az egy gomb van. Telefonon a **„Régi”** / **„Új”** gomb váltja, melyik oldalt látod.
- **Alul** pontosan az a levél áll, amit a lead megkap: feladó, címzett, tárgy, a szöveg, az aláírás és a jogi sor.
- **„Mehet”** — a jóváhagyásod mindkét új tervre ebben a mostani állapotukban szól. A levél a következő kiküldési
  ablakban (hétköznap 8–17) megy ki. Küldés előtt a gép újra megnézi, hogy a lead nem iratkozott-e le (a címre sem),
  nem válaszolt-e bármit, nem ügyfél vagy próbázó-e, és kapott-e már javító levelet. **„Nem mehet ki”** — a lead nem
  kap javító levelet. A döntés után felül egy sor visszajelez („<név>: mehet” vagy „<név>: nem megy ki”), és a
  következő döntésre váró lead nyílik meg; ha nincs több, ugyanaz marad nyitva. Ha a döntés nem sikerült (például
  közben más döntött), a visszajelző sor ezt írja ki, és ugyanaz a lead marad nyitva.
