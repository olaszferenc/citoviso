# Kontraktus — Modulok fül: a kosár (az összegző sáv utódja)

**Jóváhagyva:** 2026-09-28, tulajdonosi döntés a §2b terv-körben. Az első körben A (csukott sáv),
B (kosár-gomb) és C (tömör sáv) közül a tulaj a **B**-t választotta, két kikötéssel; a második kör
(`modules-cart.html`) ezekkel készült, és erre mondta: „ez így ok.” Döntés: ADR-XXXX.
**Hatókör:** `src/server/adminViews.ts` · `public/assets/ui/citui-admin.css`
**Kiváltja:** a `modules-tab` ④ (kosár-sáv) és a `wallet` ⑧ pont (kártyaválasztó a sávban) helyét.

## Miért (mérve, 390×844 mobil-kontextus, egy modul a kosárban)

A régi ragadó összegző sáv (`#adm-planbar`) **407 px = a képernyő 48%-a** volt (367–774), ebből a
kártyaválasztó egymaga 184 px. Középre görgetve minden további modul gombja a sáv alá esett;
**fekvő telefonon (844×390) a sáv 284 px volt, a fejlécig ért, és egyetlen gomb sem volt elérhető
semmilyen görgetési helyzetben.** Az éjszakai kör emiatt vitte végig a vásárlást egyesével, öt
külön terheléssel. Kép: `elotte-mobil-407px.png`.

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Üres kosárnak nincs lábnyoma** (a tulaj 1. kikötése). Amíg nincs változás, telefonon nincs
   kosár-gomb, asztalin nincs kosár-hasáb, és a kirakat a teljes szélességet kapja. Az első
   tétel után jelenik meg; fizetés, alkalmazás vagy ürítés után újra eltűnik.
2. **A kirakat gombja a kosár-metaforát beszéli** (a tulaj 2. kikötése): **„Kosárba teszem”**,
   benne lévő modulnál **„Kiveszem a kosárból”**. Ugyanez az előnézet láblécén.
   A bevezető mondat is a kosarat nevezi meg („a kosárba gyűjtjük”), nem „a lap alját”.
3. **Telefon (≤ 899 px):** jobbra lent, az alsó menü fölött egy kis kosár-gomb (a tételek száma,
   fizetős tételnél a most fizetendő összeg). A kirakat gombjai balra igazodnak, ezért a
   kosár-gomb sosem ül rájuk (mérve: 390 és fekvő 844 px-en a gombot csak a fix fejléc és az
   alsó menü takarhatja, a kosár-gomb soha). Koppintásra alulról felcsúszik a kosár (fátyol,
   **×**, Esc, fátyolra koppintás zárja be).
4. **Asztali (≥ 900 px):** a kosár a kirakat mellett jobbra álló, a fejléc alatt tapadó hasáb;
   mellette a kirakat a ténylegesen megmaradó szélességből választ oszlopszámot.
5. **A kosár tartalma:** soronként mi kapcsolna be (fizetős sornál „fizetés most: …”) és mi
   mondódna le; alatta **„Fizetendő most:”** és **„Következő számla így:”** (a változással).
   Gombok: **„Kiürítem a kosarat”** és fizetős tételnél **„Tovább a fizetéshez”**, csak
   díjmentes változásnál **„Alkalmazom a módosításokat”**.
6. **A „Következő számla” sor nem vész el** (a koordinátor nyitott kérdése): a kinyitott kosárban
   és a fizetés-megerősítő kártyán is ott áll, **„Következő számla ({date}) így”** sorban, a
   változással együtt. A megerősítőn minden fizető tulaj átmegy, tehát fizetés előtt mindig látja.
7. **A kártyaválasztó a fizetés-megerősítő kártyára költözik** (a `wallet` ⑧ új helye): mentett
   kártya-megbízásnál **„A mentett kártyámmal”** / **„Másik kártyával”**, a magyarázó
   mondatokkal. A megerősítő gombja a választást követi: mentett kártyával
   **„Terhelés és élesítés — {sum}”**, másik kártyával (és megbízás nélkül)
   **„Tovább a fizetéshez — {sum}”**; a megjegyzés is ennek megfelelően a tárolt terhelést vagy a
   fizetőoldalt mondja ki. A rádiók a formon belül maradnak (`card` mező), a szerver oldal változatlan.
8. **A „−25%” kupon-címke nem rajzolódhat semmilyen ragadó réteg fölé** (a mért régi hiba): a
   kirakat-kártya saját rétegkontextust kap.
9. Változatlan marad: a függőségi szabály (ADR-0192: a társ magától a kosárba kerül, a blokkoló
   lemondás felugrója), a kupon-kerekítés (egy példányban, `assets/runtime/cit-coupon.cjs`), a
   JS nélküli beküldés, és minden ID, amire őr épül (`#adm-plan-apply`, `#adm-plan-paysum`,
   `#adm-plan-card`, `[data-fc-modal]`).

## Képek

`terv-mobil-1tetel.png` · `terv-mobil-kosar.png` · `terv-mobil-megerosito.png` ·
`terv-asztali-ures.png` · `terv-asztali-1tetel.png` — a jóváhagyott második kör, valós adattal
(Éden üdülőház, −25% kupon, Visa ····5559, fordulónap 2026. 10. 25.).
