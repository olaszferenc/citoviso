---
id: console-free-trial
title: Ingyenes próba — a teljes út az indulástól a folytatásig, a törlésig és a riasztásokig
audience: operator
category: lead-path
anchors: console.free_trial
updated: 2026-10-09
---

Az ingyenes próba a **rendelés alternatívája**: a kiküldött tervet megnyitó lead kártya és fizetés
nélkül kipróbálhatja a saját oldalát. Ez a cikk végigköveti, mi történik egy próbával, hol látod a
konzolon, és mit kell tenned, ha a rendszer riaszt.

## Mi a próba, röviden

- A lead a kiküldött terv lapján (a követett linken) egy rövid űrlapot tölt ki: név, e-mail, telefon,
  és elfogadja az ÁSZF-et meg a fotó-nyilatkozatot. Fizetési adatot nem kérünk.
- Az oldala azonnal **él** a citoviso.com aldomainjén — azon a címen, amit a lap előre megmutatott —,
  **minden modul be van kapcsolva**, és belépő-levelet kap a kezelőfelületéhez.
- Számla nem készül, előfizetés nem születik, terhelés nincs. Egy szállás (lead) **egyszer** próbázhat:
  aki már próbázott vagy vásárolt, annak a lapja nem kínál új próbát.
- Ha a lead korábban kedvezményes ajánlatot kapott (megkeresés, eszkaláció), az a próba indulásakor
  lejár: a próba a kedvezmény HELYETT választható. Helyette a próba saját kupont ad az első fizetésre.

A hosszt (alapból 14 nap) és a kupon százalékát (alapból 25%) a **„Árazás és értékesítés”** lap
**„Ingyenes próba”** szekciójában állítod — részletesen az Árazás súgójában („Ingyenes próba — hossz
és kupon”). A változás csak az ezután indított próbákra hat.

## Hol látod a próbát a konzolon

- **Riport → „Tölcsér”**: a **„Kipróbálja-e?”** kártya (próba / kiküldött, cél 5%) a
  **„Megrendeli-e?”** mellett — ugyanarra a nevezőre mér, hogy a két út egymás mellett olvasható
  legyen. A **„Bontás”** táblában a **„Próba”**, a **„Kohorsz”** táblában a **„Próba 14 n.”** oszlop.
  Egy próba akkor számít, ha az oldala tényleg elindult (a félbemaradt indítás nem).
- **Riport → „Viselkedés” → Rendelés-panel**: a **„Próba-űrlapról”** szűrő azokat a rendelés-panel
  megnyitásokat mutatja, amelyeket a lead a próba-űrlap alján lévő rendelés-linkről nyitott.
- **A lead Tevékenység-lapja**: a próba lépései saját sorokként, a látogatás idővonalán:
  **„Megnyomta az ingyenes próba gombját”**, **„Hibás adat a próba-űrlapon”**,
  **„Elküldte a próba-űrlapot”**, **„Bezárta a próba-űrlapot”**, piros sorként
  **„A próba indítása nem sikerült”**, és kiemelve **„ELINDÍTOTTA AZ INGYENES PRÓBÁT”**. Ez az utolsó
  sor csak akkor jelenik meg, ha a próba ténylegesen elindult.

## A próba vége előtt: T−3 és T−1 értesítés

A próba vége előtt 3 nappal és 1 nappal a próbázó **e-mailt és SMS-t** kap a folytatás linkjével.
Mindkettő csak **hétköznap 9 és 16 óra között** megy ki (az óránkénti ütemezés viszi).

- Ha a lépcső hétvégére esne, **előző pénteken** megy ki — utána már késő lenne.
- Ha a két lépcső ugyanarra a napra esne, csak a T−1 megy ki.
- A cím a valódi hátralévő napokat mondja (egy hétfői lejárat pénteki levele „3 nap múlva” lejáratot
  ír, nem „holnapot”).
- Minden értesítés legfeljebb egyszer megy ki, és a próbázó kezelőfelületének üzenetei között is
  megjelenik.

## A próba vége: reggel 7-kor szünetel

A napi, **reggel 7 órás** futás a lejárt próbát **szünetelteti**: az oldal a látogatónak egy udvarias
lapot ad (a szállás neve, települése, elérhetőségei), a csak a próbában kapott modulok kikapcsolnak.
**Nem terhelünk semmit**, a próbázó kezelőfelülete és minden adata megmarad. Emiatt a próba utolsó
napja után legfeljebb kb. egy napig az oldal még él.

## Folytatás = fizetés

A próbázó a kezelőfelületén a „Folytatom” (lejárt próbánál „Folytatom — fizetés”) gombbal, vagy
a levél gombjával a `/p/<token>/folytatas` címre jut: a megszokott rendelő panel a próba kuponjával.
Ez ugyanaz az első fizetés, mint egy rendelésnél:

- a fizetés után az oldal azonnal újra él, a választott csomag modulja megmarad, a csak kipróbált
  modulok kikapcsolnak;
- ekkor születik az előfizetés, és a **fordulónap a fizetés napja** (nem a próba indulása);
- a próba kuponja egyszer, ezen a fizetésen ég el; mellé üdvözlő kupon nem jár.

A folytatás linkje csak folytatható próbára működik; mindenki mást (már fizetett, idegen lead) a terv
sima lapjára visz vissza.

## 90 napos megőrzés és törlés

A lejárt, nem folytatott próba adatai a **próba utolsó napjától számított 90 napig** maradnak meg
(ÁSZF 1.4) — ugyanaddig, ameddig a próba kuponja érvényes. A törlés előtt 7 nappal a próbázó
figyelmeztető levelet kap (hétvégére eső levél előző pénteken; ha a levél késve megy, a törlés is
későbbre tolódik, sosem rövidül).

⚠️ **Ma még semmi nem törlődik magától.** A figyelmeztető levél szövege jóváhagyásra vár, addig a
levél és a törlés is csak **szárazon** fut (naplóz, nem küld, nem töröl) — és elküldött figyelmeztetés
nélkül a törlés amúgy sem indul.

**Kézi futtatás** (a szerveren, a projekt mappájában):

- `npx tsx scripts/free-trial-purge.mts` — szárazon kiírja, mi törlődne, mi vár még (nincs elküldött
  figyelmeztetés, vagy még nem telt el 7 nap), és mit **tagad meg**.
- `npx tsx scripts/free-trial-purge.mts --go` — ténylegesen töröl; `--trial <azonosító>` egy próbára
  szűkít. A `--go` sem töröl olyat, amelynek a figyelmeztetése nem ment ki legalább 7 nappal korábban.

**Mi törlődik:** a próbázó oldala, fotói, fiókja, üzenetei és minden hozzá tartozó beállítás. **Mi marad
meg:** a próba nyilvántartása (név, e-mail, telefon, az ÁSZF-elfogadás bizonyítéka) — ez akadályozza
meg, hogy ugyanaz a szállás újra próbázzon. A lead visszakerül **minősített** állapotba, tehát újra
megkereshető, de új ingyenes próbát nem indíthat.

⛔ **Megtagadott törlés:** ha a próbához bármilyen fizetés-nyom tartozik (előfizetés, mentett kártya,
domain, fizetés a rendelésein), a rendszer nem töröl, a napi futás hibával zár, és levelet kapsz.
Ilyenkor kézzel kell megnézni, mi történt — valószínűleg a próbázó közben fizetett.

## Riasztások — ha egy próba elakad

Óránként egy őr átnézi a próbákat, és ha valami elakadt, **riasztást küld** a **„Fiók”** lap üzemi
riasztás-címzettjeinek (e-mail és SMS; lásd a Fiók súgóját). Esetenként **egyszer** szól; ha egyszerre
több próba akad el ugyanúgy, egy levélben sorolja fel őket. A levél tárgya „Citoviso: ingyenes próba —”
kezdetű, a teszt-környezetből jövőé elején `[TESZT]` áll. Minden próbánál ott a lead konzol-linkje, a
pontos hiba (**„Mi a baj”**) és a konkrét teendő (**„Teendő”**).

Az öt eset, a levél tárgyában szereplő szöveggel:

1. **„a lejárt próba nem szünetelt (a napi lejáratás nem futott)”** — a próba vége után 26 órával
   az oldal még ingyen él. Valószínűleg a reggel 7 órás napi futás állt le. Teendő: a napi időzítő
   állapotának ellenőrzése, majd a levélben megadott paranccsal a pótlás az adott tenantra (többször
   is futtatható, nem okoz kárt).
2. **„a lejárat előtti figyelmeztetés nem ment ki”** — egy T−3/T−1 (vagy a törlés előtti) értesítés
   elbukott, vagy a küldése félbeszakadt. A rendszer ezt **nem küldi újra** (nehogy kétszer menjen ki).
   Teendő: a levél **„Mi a baj”** sora megmondja, melyik lépcső és melyik csatorna (e-mail vagy SMS)
   bukott el, és miért. Ha az áll benne, hogy „a küldés közben leállt”, nem tudni, kiment-e — ilyenkor is úgy kezeld,
   mintha nem ment volna ki. Keresd meg a próbázót (az elérhetősége a lead lapján van), szólj neki a
   próba végéről, és küldd el neki a levélben szereplő folytatás-linket.
3. **„a próba elindult, de az oldala nem él”** — 30 perc után sincs élő oldal. Ha a tenant sem jött
   létre, keresd meg a próbázót, és kérd meg, hogy a terv lapján küldje el újra a próba-űrlapot — a
   rendszer a félbemaradt indítást folytatja; ha a tenant megvan, de az oldal
   nem él, fejlesztői beavatkozás kell (a levél megmondja, mit keress a szervernaplóban).
4. **„kifizetett folytatás, de nincs számla / előfizetés”** — a próbázó 30 percnél régebben fizetett,
   de nem készült számla, nem született előfizetés, vagy a próba nem váltott át. **A pénz bent van, a
   vevő nem kapta meg, amit vett** — ezt kezeld elsőként. Számla-hiánynál a levélben megadott újraküldő
   parancs; előfizetés-hiánynál fejlesztői beavatkozás, a fizetés azonosítójával.
5. **„a próbázó nem kapta meg a belépő-levelet”** — 15 perc után sincs belépő-levél, tehát nem tud
   belépni. Ha a fiókja megvan, a bejelentkező oldal **„Elfelejtett jelszó?”** útján új belépő-link
   kérhető az e-mail-címére; ha fiók sincs, fejlesztői beavatkozás kell.

Ha nincs beállítva riasztás-címzett, vagy egyik csatorna sem ment ki, a rendszer a riasztást **nem**
jelöli elküldöttnek, és a következő órában újra próbálja.
