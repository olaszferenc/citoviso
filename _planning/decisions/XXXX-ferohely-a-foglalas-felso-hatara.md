## ADR-XXXX — A férőhely a foglalás felső határa

**Dátum:** 2026-10-14 · **Kontextus:** éles végigteszt (2026-10-14), Elek-foglaló F-1 és Elek-szállásadó §3. Egy 4 fős szállásra 7 fős kérés ment át (FG-E0FA1A). A szállásadó sehol nem kapott figyelmeztetést: az admin-kártyán aktív volt a „Visszaigazolom”, a megerősítő lépésben és a tulaj-levélben sem állt semmi, a levélben pedig ott volt az egykattintásos „Elfogadom”. **Felülírja:** ADR-0380 próba-foglalás megjegyzését („ma a rendszer ezt nem szűri ki”).

### A modell (mérve, mielőtt döntöttünk)
A férőhely **egységenként** él (`site_unit.capacity`, üres = nincs megadva). Az „egész szállás” is egy saját egység, saját férőhellyel (ADR-0114/0256/0257). A vendég mindig egy egységet foglal. Ezért a korlát a **választott egység** férőhelye: szobánál a szobáé, egész háznál a házé. Ha egy egységnek nincs férőhelye, nincs korlát, mert számot nem találunk ki (§B.17). A szobák férőhelyét nem adjuk össze.

### Döntés
1. **Szelvény:** a „Vendégek” léptető a választott egység férőhelyénél megáll, a „+” gomb tiltott lesz, alatta ez áll: „Ide legfeljebb {n} vendég foglalhat.”. Ha a vendég kisebb egységre vált, a létszám azonnal lecsökken, és az egyszemélyes szoba 1 fővel indul.
2. **Szerver:** a `createBookingRequest` elutasítja a férőhely fölötti kérést, ugyanazzal a mondattal és egy kéréssel: „Ide legfeljebb {n} vendég foglalhat. Kérjük, csökkentse a létszámot.” A próba-foglalás ugyanígy elutasít, mert ugyanez a szabály fut benne.
3. **Régi vagy utólag szűkített túllépő kérés** (a férőhelyet a kérés után csökkentették): figyelmeztetés kerül a tulaj-levél tetejére (piros sáv), az admin-kártyára, a „Visszaigazolom” lépésbe és a levél-link megerősítő oldalára: „Figyelem: a vendég {g} főre kér, a férőhely {n} fő.”. Az elfogadást nem tiltjuk, mert a szállásadó dönthet úgy, hogy pótággyal mégis fogadja.
4. A Segítő promptja már nem állítja, hogy a rendszer nem szűr, a súgó pedig kimondja a korlátot és a figyelmeztetést.

### Őr
`scripts/booking-capacity-check.mts` (új, a pre-commitba kötve). Ellenőrzi a szelvényt (390 és 1280 px: megállás, mondat, egységváltás), a szerver elutasítását, a tulaj-levelet, a kártyát és a visszaigazolási lépést, valamint a megerősítő oldalt, mindhez negatív kontrollal. Igazítva: `booking-setup-check` (a próba elutasít, a Segítő nem tagad), `booking-tax-receipt-check` ③ (a 2 → 3 lépés az 5 fős házon), `quote-request-check` (a 2 fős faháznál a „−” gombbal rajzoltat újra).

### Visszafordíthatóság
🔄 könnyű. Séma nem változott. Élesre a következő deployjal kerül, utána újra kell renderelni a tenant-oldalakat (a futó oldal a renderelt runtime-ot használja).
