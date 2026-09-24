# Pénztárca — a mentett kártya kezelése (ADR-0226 — „B: külön fül")

Tulajdonosi jóváhagyás: 2026-09-24 („B külön pénztárca"). A vázlat `wallet.html` (A/B egy fájlban;
a **B** köt, az A elvetve), képek: `ui-wallet-{mobile,desktop}.png` (alapállapot),
`ui-wallet-change-mobile.png` (csere-ablak), `ui-wallet-off-mobile.png` (visszavont állapot),
`ui-wallet-expiring-desktop.png` (lejáró kártya). **Ez a terv KÖT** — elvárt viselkedés, nem
stílus-javaslat.

## Amit a terv KÖT

1. **Külön „Pénztárca" fül** a tenant-adminban (a Dokumentumok és a Fiók között), saját
   súgó-horgonnyal (`admin.wallet`). Két hasáb asztalon, egy oszlop mobilon (`@container`).
2. **A mentett kártya LÁTHATÓ:** márka (VISA / MASTERCARD …), utolsó 4 számjegy
   („···· ···· ···· 4242"), lejárat (HH/ÉÉÉÉ), mikor mentettük. A teljes kártyaszámot
   SOHA nem tároljuk és nem mutatjuk — a lap ki is mondja: „A kártyaadatokat a Barion tárolja,
   mi csak az utolsó 4 számjegyet és a lejáratot látjuk."
   ⚠️ Egy MÁR mentett, de maszk nélküli megbízás (a bevezetés előtti tokenek) állapota
   „kártya mentve — a részletek a következő terheléskor jelennek meg"; nem találunk ki számot.
3. **Állapot-pill, három állapot:**
   - `AUTOMATIKUS TERHELÉS BEKAPCSOLVA` (zöld) — van használható megbízás;
   - `LEJÁR: HH/ÉÉÉÉ` (borostyán) — a kártya a következő terhelés ELŐTT jár le; a lap kimondja,
     hogy ha nem cseréli, a fordulónapon fizetési linket kap;
   - `NINCS MENTETT KÁRTYA` (piros) — díjbekérős fizetés; a szaggatott keretes üres kártya-kép.
4. **„Kártya cseréje" / „Kártya megadása" — EGY út, a 3DS-en át.** A gomb tájékoztató ablakot
   nyit („Kártya cseréje"): az új kártyát a Barion oldalán adja meg; a bank egyszeri
   megerősítést kér; a megerősítés ára ki van mondva (⑤); utána minden díj az új kártyáról
   megy, a régi az előzményekbe kerül. Gombok: **„Tovább a bankkártyás megerősítéshez"**
   (elsődleges, sötét) és **„Mégsem"**. Escape / fátyol = mégsem.
   - Siker → az új kártya a mentett, a régi a „Korábbi kártyák" közé („cserélve <dátum>").
   - Bank elutasítja / visszalép → SEMMI nem változik, és a lap ezt mondja is.
   ⛔ Nincs „kártyaszám átírása" mező, és nincs egy-kattintásos visszakapcsolás — a
   kártyaséma a tárolt hitelesítőt egy vevő-indított, 3DS-kihívott fizetéshez köti.
5. **A csere-hitelesítés ára a lapon áll, és IGAZ.** A vázlat a „100 Ft zárolás, azonnal
   feloldva" változatot írja; a megvalósítás azt a mondatot viszi, amelyet a Barion-doksi és a
   sandbox IGAZOL (zárolás/feloldás vagy jelképes összeg, amit a következő díjból jóváírunk).
   A mondat NEM ígérhet olyat, amit az átjáró nem tesz.
6. **Megbízás visszavonása** — a jóváhagyott KÉTLÉPÉSES ablak (mandate-coupon ②) változatlan
   hátrány-listával; a 4. pont szövege azonban frissül: „a visszakapcsolás nem egy kattintás:
   … új kártya-megadás kell (Kártya megadása gomb)". Visszavonás után a régi kártya az
   előzményekbe kerül („visszavonva <dátum>").
7. **Jobb hasáb:** „Következő terhelés" cella (dátum · összeg; kártya nélkül: „fizetési link
   e-mailben"), a T−3 e-mail mondata, és a **„Terhelések ezen a kártyán"** táblázat
   (dátum + tétel · összeg · `sikeres` / `elutasítva`). Üres: „Még nem volt terhelés."
8. **Modul-vásárlás kártyaválasztó** (a Modulok fül terv-sávjában, amikor van mentett kártya
   ÉS fizetendő összeg): **„A mentett kártyámmal"** + a kártya neve, pl. VISA ····4242 (azonnal, átirányítás nélkül,
   ez marad a mentett kártya) vagy **„Másik kártyával"** (Barion-oldal, bankkártyás
   megerősítéssel, **„Ez a kártya lesz ezután a mentett kártya"** a régi helyett). A gomb
   felirata a választást követi. ⛔ A „másik kártya" ág KÖTELEZŐEN tokent kér és a fizetés
   után az ÚJ kártya a megbízás — a mondat különben hazugság (ma az upsell nem ment kártyát).
9. **Az Előfizetés kártya megbízás-blokkja** (Modulok fül) NEM másolja a Pénztárcát: a
   „KIKAPCSOLVA" ág mondata a Pénztárcára mutat („Kártya megadása"), a „BEKAPCSOLVA" ág
   linkel a Pénztárcára. Egy szabály, egy hely (feedback_one_rule_two_copies).
10. Minden felirat `T()`-fordított; a KB `admin-wallet` cikke a VALÓDI gombfeliratokkal vezet,
    az `admin-subscription` cikk visszakapcsolás-mondata frissül.
