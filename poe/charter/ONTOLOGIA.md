# POE — az ontológia kivonata (ezt olvasod, nem a teljes DOMAIN-t)

> Poénak írt, tételes kivonat azokból a szabályokból, amelyek a szövegben döntenek:
> §B.17 (`_planning/DOMAIN/03-INVARIANTS.md`), ADR-0292, ADR-0317, ADR-0323, ADR-0324.
> **Csak kétség esetén** nyisd meg az eredetit, és akkor is csak a hivatkozott pontot
> (`ls _planning/decisions/ | grep ^0292` és onnan olvasol).
> Ha ez a kivonat és az eredeti eltér, az eredeti az irányadó — és a jelentésben szólsz róla.
> Neo kivonata (`neo/charter/ONTOLOGIA.md`) a honlap- és fotó-kérdéseket fedi; azok nem a te dolgod.

## 1. Fogalmak

- **Lead** — egy szállás a konzol listájában, amelyről még nincs fizető kapcsolat.
- **Mock** — a leadnek generált demó-oldal; a tulaj később ezt küldi ki megkeresésként.
- **Forrás** — a lead saját adatai, a portál- és saját leírások szövege, a vendég-vélemények, és
  a fotón EGYÉRTELMŰEN látható dolog. Ez a Forrás-csomag fül. Más nem forrás.
- **Nyom** — amit Neo vagy te a Google-ben, a térképen, a régió ismeretéből tudsz. A jelentésbe
  való, a szövegbe nem.
- **Gyűjtési terület / régió** — a keresés doboza (pl. „balaton-kelet”), NEM a lead helye.
- **Őrök** — tényhűség-kapu, piaci kapu, vendég-kritikus. Az ítéletük tárolódik, és a kiküldés
  kapuja olvassa.

## 2. Tényhűség (§B.17)

- **Tényt nem adunk hozzá.** HARD tény: ár, m², szoba/kapacitás, ★ és értékelés-szám, évszám,
  NTAK-szám, díj/minősítés, konkrét távolság, cím, telefon, e-mail, nyitvatartás. Ezek CSAK a
  forrásból kerülhetnek a szövegbe. Hangulat, jelző, elrendezés szabad.
- **Az állítás nem lehet nagyobb a forrásánál:** „elegendő parkoló” ≠ „bőséges saját parkoló”.
- **Bizonytalanság → kevesebb, sosem hamis.** Ami nem igazolható, kimarad.
- **A kiemelt tény idézete szó szerint a forrásból** — a gép ellenőrzi (ugyanaz a szabály, mint
  az AI-nál); ami nem egyezik, kiesik, és a „Honnan tudjuk?” panelen nem jelenik meg.

## 3. Valódiság — a vendég-kritikus (ADR-0292)

- **Véleményből ÁLLANDÓ adottság állítható, a vélemény erejéig, hűen fordítva** („B — középút”).
  **Egyszeri élmény vagy szívesség soha**, és véleményből nem lesz ajánlat: „kölcsönadta a
  biciklit” ≠ „bérelhető kerékpárok”. „Bérelhető / ingyenes / foglalható” CSAK, ha a szállás
  maga hirdeti.
- **Tükörfordítás tilos:** „Cooked breakfast” ≠ „főtt reggeli” (nincs ilyen magyar fogalom).
- **Tilos AI-nyitás:** „X várja a vendégeket / a családokat”; ál-idézet a főcímben.
- **A vendég-oldal MAGÁZ;** a ház T/1-ben beszélhet magáról („nálunk”, „várjuk Önöket”).
- **Mérce:** kiírná-e ezt egy normális magyar szállásadó a honlapjára?
- A kritikus nem lát fotót: fotóval igazolt tárgyra (napozóágy, medence) nem emel forrás-kifogást.

## 4. Két tényből nem lesz harmadik (ADR-0317)

- Ha egy tagmondat **szolgáltatást** (reggeli, vacsora, kávé, parkoló, grillezés, kerékpár, wifi)
  vagy **hely-kérdéses létesítményt** (jakuzzi, szauna, uszoda, wellness) egy **helyre** tesz
  („a kertben”, „a teraszon”, „az udvarban”, „a helyszínen”, „a házban”), kell egy forrás-mondat,
  ami a dolgot ÉS a helyet viszonyként mondja.
- „A szállás kerttel reggelente reggelit szolgál fel” → „reggeli a kertben” **TILOS** (a viszonyt
  senki nem mondta). „Kerttel”, „kertes”, „kertre néző”, „teraszos” = a ház jellemzője, nem viszony.
- Egy lapos „Szolgáltatások” lista keverheti a környék kínálatát a házéval (Uszoda a Nightclub
  mellett) — ilyenkor a létesítmény nem a házé, amíg más forrás nem mondja.

## 5. Lírai nyitórész (ADR-0324)

- **A nyitórész (főcím + alcím + bemutatkozó) LÍRAI:** a hely érzete egy forrásból ismert képpel
  (táj, fekvés, közelség, évszak, kinek való). **Leíró mód tilos:** felület, anyag, szín, bútor,
  méret, felszereltség-lista — az a kiemelésekbe való („sötétre pácolt faház” nem nyitórész).
- **Egy adottság, nagyon szűken:** a főcímben és az alcímben legfeljebb EGY, élménybe ágyazva,
  felsorolás soha; a bemutatkozóban legfeljebb kettő, a végén.
- **A líra is forrásból:** tájegység, érzéki részlet (madárszó, illat, csillagos ég) csak, ha a
  leírás vagy egy vélemény kimondja. „Csend” / „nyugalom” TILOS, ha bármelyik vélemény zajról
  szól. Egy vendég egyszeri élményéből nem lesz főcím.
- **Vékony forrás:** a líra a településből és a célközönségből épül, általános marad, tájat nem
  talál ki.
- **A líra nem üres hangulat:** a főcím valós képet visz, és nem másolható rá más szállásra.
  Ezért vezeted a `~/poe/nyitasok.md`-t — ismételt nyitás nincs.
- **A régió neve és a település neve nem forrás:** „Balatongyörök” nem igazolja a
  „Balaton-partot”. Táj-szó (Balaton, part, tó, hegy, erdő, szőlő, kilátás, Bakony…) csak a
  szállás saját leírásából vagy véleményből.
- A gép ezt determinisztikusan is méri (leíró nyitás, leltár-nyitás, minta-másolás, hangulat
  forrás nélkül) — a vendég-kritikusban mindig blokkoló.

## 6. A kézi szöveg és az őr-ítélet (ADR-0323 + ADR-0326)

- A te szöveged **kurátori mező**: a gép rögzíti, ki írta (a mock-kártyán a pirula a neved).
  Az AI-újraírás a kurátori mezőt nem írja felül.
- **Kurátori módban az AI nem ír és nem generál újra** (ADR-0326, D1 = A): a három őr EGYSZER,
  csak ítél a kiszállított szövegen.
- **A javító kör a tiéd:** a szöveg-szerkesztő mentésekor az őrök újra ítélnek; leadenként
  legfeljebb egy ilyen kör.
- **Nyugtázás:** egy korábbi nyugtázás a szöveg-cserével elvész. Nyugtázni nem a te dolgod.

## Mikor nyisd meg az eredetit

- A vendég-kritikus egy kifogását nem érted → ADR-0292 (2–3. pont).
- Hely-állítás határeset („kinti”, „kültéri”) → ADR-0317 ①.
- A nyitórész egy kifogását nem érted → ADR-0324 (1–6. pont).
- Teljes tényhűség-kontraktus → `03-INVARIANTS.md` §B.17 (`grep -n "^17\." _planning/DOMAIN/03-INVARIANTS.md`).
