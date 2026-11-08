# JÓVÁHAGYOTT TERV — Messenger-felület (egyesített: jóváhagyó lap + irányítópult + lead-oldal)

Tulaj-jóváhagyás: 2026-11-08 („mehet így élesre”), egy módosítással (lent). ADR-0430.
A lead-oldal és a Messenger-út blokk alapja a korábban jóváhagyott A terv (`../messenger-meres/`).
Ez a terv a megvalósítás KONTRAKTUSA. Kattintható: `plan.html`; képek: `3-*` (asztali + mobil).

## ⭐ Tulaj-módosítás a jóváhagyáskor (KÖTELEZŐ)

„Jobban látszódjon a jóváhagyandó oldal, lehet jóval szélesebb az egész oldal, túl sok a kihasználatlan
oldalsó rész.” → A `/jovahagyas` lap a TELJES képernyő-szélességet használja: a konzol 1600 px-es
tartalom-plafonja itt nem él. A bal lista keskeny marad. A jóváhagyandó oldal előnézete (iframe/kép)
a maradék szélességet és a képernyő-magasság nagy részét kitölti, oldalt nem marad üres sáv. A
csatorna-lépcső és a szöveg-panel tömör, hogy az előnézet minél feljebb kezdődjön.

## Amit a terv KÖT

1. **Jóváhagyó lap, „Jóváhagyásra vár” fül:**
   - A lista csatornánként csoportosítva: Viberen megy / WhatsAppon megy / MMS + SMS megy / E-mailben megy / Még ellenőrizzük. Minden csoportfejlécen ott a darabszám, a messenger-csoportoknál az is, hogy „SMS nélkül”.
   - Szűrők: keresés név vagy település szerint, csatorna, honlap (nincs / elavult). Minden szűrőgombon ott a darabszám, a 0-s gomb inaktív, és van „Szűrők törlése”.
   - A kiválasztott leadnél felül a 4 lépcső (1. Viber ≤30 nap → 2. WhatsApp → 3. Viber régi aktivitással → 4. MMS + SMS együtt), kiemelve, melyik megy, és egy mondat az okáról. Kikapcsolt messenger-útnál vagy leállt féknél MMS + SMS megy.
   - A szöveg-panel a csatornához igazodik: messengeren „Viber-üzenet szövege (a kép alatt)” / „WhatsApp-üzenet szövege (a kép alatt)”, MMS + SMS-nél a kísérő SMS.
   - Gombok: „Mehet” / „Nem mehet ki” (változatlan működés).
2. **„Messengeren nem nézte meg” fül:**
   - Azok, akiknek 3 napja kiment Viberen vagy WhatsAppon, de nem nézték meg. Aki válaszolt, elutasított vagy leiratkozott, ide soha nem kerül.
   - Leadenként idővonal: elküldve → kézbesítve → nem nézte meg → Viberen utoljára aktív; mellette a kiküldött kép és szöveg.
   - WhatsAppon kiírja, hogy aki kikapcsolta az olvasási visszaigazolást, az is „nem nézte meg”-nek látszik.
   - Gombok: „Mehet MMS + SMS-ben is” (ugyanaz a kép MMS-ben + a kísérő SMS, együtt) / „Nem kell”.
   - Szűrők: csatorna, állapot (kézbesítve / csak elküldve), Viberen aktív az elmúlt 7 napban, mióta (3 / 4–6 / 7+ napja), darabszámmal, „Szűrők törlése” gombbal.
3. **Irányítópult, Válaszok-blokk:**
   - Csatorna-szűrő: Minden / E-mail / SMS / Viber / WhatsApp, darabszámmal.
   - Messengeren a teljes csevegés időrendben: a kiküldött kép + szöveg „Megnézve” jellel, a lead válaszai, a mi válaszaink. A válasz ugyanazon a csatornán megy vissza.
4. **Irányítópult, Messenger-út blokk:**
   - „Ma kiküldve messengeren: N” (Viber / WhatsApp bontásban). ⛔ NAPI KERET NINCS.
   - A fék állapota és a feloldás gomb; a be/ki kapcsoló.
   - Az elmúlt 7 nap csatorna-megoszlása, és csatornánként a kézbesítési, olvasási és válasz-arány; az MMS olvasása „n/a”.
5. **Lead-oldal:** az A terv (`../messenger-meres/README.md` 1–4. pont).
6. **Jelenlét:** a telefon a sorba érkezéskor üzenet nélkül megnézi, van-e Vibere / WhatsAppja (a „Még ellenőrizzük” csoport addig), és kiküldéskor újra megnézi.
