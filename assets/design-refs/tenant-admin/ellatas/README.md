# Ellátás és felárak (reggeli, félpanzió…) — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-10-13, egy §2b kör után, a koordinátoron át. A tulaj az A (kártyák) és a
B (táblázat + lenyíló) közül a **B**-t választotta, és ugyanaznap a gyerekárra is igent mondott
(ellátásonként gyerekár, 0 = ingyenes, korhatár; a vendég megadja, hányan gyerekek). A gyerekár
kódban egy kapcsolóval kivehető marad (`MEAL_CHILD_PRICING`). ·
**Kapcsolódó:** ADR-0378 (ez a döntés), ADR-0193 (ár csak élő Árak-modullal), ADR-0199 (egy
egység ára az ár-végponton), ADR-0267 (ajánlat ára csak arra a kérésre), ADR-0299 (az IFA a
kérésre fagy), `tenant-site/booking-price-clarity` (a nyitott ár-bontás), §B.17. · **Migráció:** 0108.

**Hatókör:** `src/tenant/meals.ts` · `src/server/moduleConfigViews.ts` · `src/engine/moduleSections.ts` · `assets/runtime/cit-runtime.js` · `src/booking/requests.ts` · `src/server/bookingViews.ts`

`plan.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** A kész felületet ehhez mérjük
(mobil 390 + asztali). A fenti váltón a **B** a jóváhagyott, az A csak a döntés nyoma. A képek a
B állapotait mutatják, gyerekárral.

## Miért létezik

Mérve 2026-10-13-án: ellátást (reggeli, félpanzió, teljes panzió) sehol nem lehetett megadni. A
vendég nem tudott választani, és az ár sem számolt vele. A tulaj 2026-09-25-én kérte, a pilot
utánra halasztva.

## Amit a terv KÖT

1. **Az alapár tartalma.** A tulaj egyet választ: csak szállás, reggeli, félpanzió vagy teljes
   panzió. A szobák árai ezzel értendők. Az alapárnál kevesebbet tartalmazó ellátás nem
   kínálható, mert negatív felár nincs.
2. **Választható ellátás — táblázat.** Az alapár fölötti ellátások soronként: pipa (kínálom),
   felár, „fő / éj” vagy „szoba / éj”, gyerekár, és egy lenyíló leírás. Mobilon a sor cellákra
   bomlik. Az alapár sora a „az alapár része” jelölést viseli.
3. **Az összeg szabálya ugyanaz, mint az ajánlat-oldalon** (`parseOfferAmount`). A szóköz, a pont
   és a végén álló „Ft” elmarad, csak pozitív egész szám megy át, legfeljebb 10 000 000. A
   gyerekár lehet 0 is (ingyenes), de nem lehet több a felnőtt-árnál. Ha egy ellátás be van
   pipálva, de nincs felára, az hiba. Hibánál **semmi nem mentődik**.
4. **Gyerekár (a tulaj: igen).** Ellátásonként egy gyerekár, és egy korhatár („… éves korig”). Ahol
   a gyerekár üres, ott a gyermek is felnőtt-árat fizet. Ha a kapcsoló ki van véve, sem a
   szállásadó, sem a vendég nem lát gyerek-mezőt, és a felár minden vendégre ugyanannyi.
5. **Szobánként kivehető.** Ahol ki van véve (pl. saját konyhás apartman), ott a vendég nem lát
   ellátás-választást, csak azt, hogy ehhez a szálláshoz nem kérhető. ⛔ Okot nem állítunk
   („saját konyha van”), mert azt a tulaj nem mondta (§B.17).
6. **„Mi van még benne az árban?”** A meglévő szöveg (a foglalás-modul beállítása) ide költözik,
   ugyanazzal a tartalommal és tárolással.
7. **Honlap.** Az „Ellátás” blokk minden sablonon megjelenik: soronként a név és a felár
   **egy sorban**, alatta a leírás és a gyerekár; utána „Az árban benne van:” és a kivett
   szobák neve. A szobakártyán az ellátás-címkék (az alapár kiemelve, a felárasok a felárukkal)
   a KÖZÖS szobakártyán állnak; a saját szobakártyát rajzoló sablonokon ezt az „Ellátás” blokk
   pótolja (megvalósításkor mérve: a kártyát 12 sablon maga rajzolja).
8. **Foglalás.** Egy lenyílóban a választható ellátások a felárukkal, alatta a kiválasztott
   leírása. Az „Ebből gyermek” léptető MINDIG ott van (ADR-XXXX, tulaj 2026-10-14): gyerekárral
   a szállásadó korhatára szerint számol, nélküle „(18 év alatt)” felirattal, és csak az IFA-ra hat. Az ár-dobozba külön sor
   kerül az ellátásnak („Félpanzió · 3 éj × 2 felnőtt × 9 000 Ft”), a gyerekeknek pedig egy
   második sor. Az ár alapja ki van mondva: személyenként vagy a szobára számít.
9. **Az ár fagy.** A választott ellátás és a gyerekek száma a kéréssel együtt tárolódik, az
   ellátás sorai pedig a befagyott tételsorba kerülnek. A vendég levele, az ajánlat és a
   szállásadó kártyája ugyanezt mutatja, újraszámolás nélkül. A szerver számol, a böngésző
   számát nem fogadja el.
10. **A szállásadó foglalás-kártyája.** Az ellátás egy címkén látszik, a tételes ár lenyitható.
    A szállásadó értesítő levele is kapja az „Ellátás” sort.

**Kötő feliratok:** **„Mit tartalmaz az alapár?”** · **„Választható ellátás”** · **„Mely szobákhoz kérhető ellátás?”** · **„Mi van még benne az árban?”** · **„az alapár része”** · **„Ehhez a szálláshoz nem kérhető ellátás.”**
