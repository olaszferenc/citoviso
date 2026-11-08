# JÓVÁHAGYOTT TERV — Messenger-mérés (A változat: lépcső a kártyában + kompakt csempék)

Tulaj-jóváhagyás: 2026-11-08 („A változat kell”). ADR-0430 F2. Ez a terv a megvalósítás
KONTRAKTUSA — elvárt viselkedés, nem stílus-javaslat. Képek: `A-alap-*`, `A-lead-wa-*`,
`A-dash-fek-leallt-*` (asztali + mobil); kattintható: `plan.html`.

## Amit a terv KÖT

1. **Lead-oldal, Mobil-megkeresés kártya:**
   - **Csatorna-jelvény:** „Kiment ezen: Viber / WhatsApp / MMS+SMS”, alatta az ok, pl. „Viber — utoljára aktív tegnap 18:40”.
   - **A 4 fokú szabály listája** (ADR-0430 ①): a választott fok kipipálva „ezt választottuk” jelöléssel, a többi „nem kellett” vagy az ok, amiért kimaradt.
   - **A Viber-aktivitás a küldés előtt**, az ellenőrzés idejével.
2. **„Kimenő üzenet” kártya:** a kimenő kép előnézete és a kísérő szöveg a linkkel. Alatta: messengeren egy kép és egy szöveg megy, kísérő SMS és tulaj-másolat nincs.
3. **Mérés-lépcső** (asztalin vízszintes, mobilon függőleges):
   - lépései: Sorban → Elküldve → Kézbesítve → Megtekintve/Olvasott → Válasz;
   - időpontokkal, a még nem elért lépésnél „még nem” és az utolsó ellenőrzés ideje;
   - ha van válasz: a szövege, és ugrás a Válaszok blokkra.
4. **Lead-állapotok:** sorban áll; kiment Viberen, még nem olvasta; WhatsAppon elolvasva + válasz; MMS-tartalékra esett; hiba. A hibánál „Újra a sorba” gomb.
5. **Irányítópult, „Messenger-út” blokk:**
   - **Csempe 1:** „Ma kiküldve messengeren: N”, csak számláló. ⛔ NAPI KERET NINCS (tulaj, 2026-11-08: „ne legyen semmilyen keret, korlátlanul, ami jóvá van hagyva, az menjen ki”): a mock keret-mezője és „/ 10” jelölése ÉRVÉNYTELEN.
   - **Csempe 2:** a fék állapota (aktív, vagy leállt és az oka), feloldás gombbal, valamint a messenger-út be/ki kapcsolója. Kikapcsolva vagy leállt fékkel minden MMS+SMS-ben megy.
   - **Csempe 3:** csatorna-megoszlás az elmúlt 7 napban, oszlopsávon.
   - **Csatornánként egy csempe** (Viber, WhatsApp, MMS+kísérő SMS): kézbesítve, megtekintve/olvasott és válasz arány. Ahol nem mérhető: „n/a”.
6. **A Válaszok blokk** (ADR-0339) csatorna-címkéje: SMS / E-mail / **Viber** / **WhatsApp**.

## Megjegyzés a mérhetőséghez

Az MMS kézbesítését a telefonról nem kapjuk vissza: az MMS csempéjén a „kézbesítve” a sikeres
feladást (MMSC elfogadta) jelenti, az olvasás „n/a”. A Viber-olvasás forrása a pipa színe (cián = megnézte).
