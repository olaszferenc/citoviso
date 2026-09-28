## ADR-XXXX — Modulok fül: kosár a ragadó összegző sáv helyett (telefonon kosár-gomb, asztalin hasáb; a kártyaválasztó a fizetés-megerősítőbe költözik)

**Dátum:** 2026-09-28 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy) · **Szál:** „modul-kirakat összegző sáv” (brief: `~/rc-briefs/modul-kirakat-osszegzo-sav.md`)
**Kontraktus:** `assets/design-refs/console/modules-cart/` · **Felülírja:** `modules-tab` ④ (kosár-sáv), `wallet` ⑧ (a kártyaválasztó HELYE; ADR-0226)

### Kontextus

Az éjszakai kör (2026-09-27) telefonon öt külön terheléssel vitte végig a modul-vásárlást, mert egy modul
hozzáadása után a többi „Hozzáadom” gomb elérhetetlenné vált. Újramérve (390×844, `isMobile+hasTouch`, Éden
üdülőház, egy modul a kosárban): a ragadó `#adm-planbar` **407 px = a képernyő 48%-a**, ebből a kártyaválasztó
184 px, a számok 64 px, a két (egymás alá tört) gomb 72 px. **Fekvő telefonon (844×390) a sáv 284 px, a
fejlécig ér — egyetlen kirakat-gomb sem érhető el semmilyen görgetési helyzetben.** Asztalon 267 px (33%).
Mellékleletként a „−25%” kupon-címke (`z-index:2`) a sáv FÖLÉ rajzolódott.

§2b: három működő vázlat (A csukott sáv · B kosár-gomb · C tömör sáv, mind mobil/fekvő/asztali), mért
lábnyommal. **A tulaj a B-t választotta**, két kikötéssel: a kosár csak akkor jelenjen meg, ha valami
belekerül; és a „Hozzáadom” nem a legegyértelműbb felirat („Kosárba rakom?”). A második kör erre
készült („Kosárba teszem”, a koordinátor javaslata), a tulaj rá: „ez így ok.”

### Döntés

1. **Üres kosárnak nincs lábnyoma** — se kosár-gomb, se asztali hasáb; a kirakat a teljes szélességet kapja.
2. **Feliratok:** „Kosárba teszem” / „Kiveszem a kosárból” (kirakat és előnézet-lábléc), „Kiürítem a kosarat”
   (a volt „Elvetem”), fizetős tételnél „Tovább a fizetéshez”, csak díjmentes változásnál „Alkalmazom a
   módosításokat”. A bevezető „a lap alján összegyűjtjük” mondata „a kosárba gyűjtjük” lett (asztalon a kosár
   oldalt áll, tehát a régi irány-állítás hamissá vált volna).
3. **Telefon:** fix kosár-gomb jobbra lent az alsó menü fölött (tételszám + most fizetendő), koppintásra
   alulról felcsúszó kosár. A kirakat gombjai balra igazodnak — a kosár-gomb nem ül rájuk.
   **Asztal:** a kosár a kirakat melletti, tapadó hasáb; a kirakat a megmaradó szélességből választ oszlopot.
4. **A „Következő számla így” sor utódja megnevezve:** a kinyitott kosár ÉS a fizetés-megerősítő („Következő
   számla ({date}) így”, a változással). Nem tétel-sor (saját `adm-fc__next` osztály), hogy a megerősítő
   tételei továbbra is pontosan a végösszeget adják (coupon-rounding-check ④).
5. **A kártyaválasztó a fizetés-megerősítőre költözik** (ADR-0226 ⑧ helye): minden fizető tulaj átmegy rajta,
   és ott a helye, ahol a pénz mozdul. A gomb és a megjegyzés a választást követi („Terhelés és élesítés —
   {sum}” / „Tovább a fizetéshez — {sum}”). A rádiók a formon belül maradnak, a szerver változatlan.
6. A kirakat-kártya saját rétegkontextust kap (`isolation:isolate`), a kupon-címke nem rajzolódhat ragadó réteg fölé.

### Mérés a megvalósításon (a munkafa kódja, Éden valós adatai)

A kirakat minden további gombjára `elementFromPoint` a teljes lap végiggörgetésével: **390 px-en, fekvő
844 px-en és 1280 px-en a gombot a kosár SOHA nem takarja** — takarás csak a lap két szélén, a fix fejléc és az
alsó menü alatt van, ami a tartalom kerete. Üres kosár: 0 lábnyom mindhárom méretben; JS-hiba 0.

### Következmények

- A feliratot idéző fogyasztók ugyanebben a változtatásban követik: 5 KB-cikk, `frozen-state-check` (a
  „Hozzáadom” tiltott szava üresen zöldre ment volna — most „Kosárba teszem”, az önteszt piros), `wallet-check`
  (a ⑧ új helyén, ugyanolyan szigorral), `wallet-tour`, az FK-012 forgatókönyv (mostantól EGY fizetés a kosárból),
  és a `modules-tab` / `wallet` / `modules-billing` / `pricing-rooms-link` kontraktusok utaló sora.
- Élesítés: nincs külön — a nagy deployjal megy (2026-09-25-i tulajdonosi döntés).
