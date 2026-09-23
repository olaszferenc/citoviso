## ADR-0062 — Konverziós dramaturgia: a FŐ MOTIVÁCIÓ doktrínája — vágy előbb, konverzió a döntési ponton

**Dátum:** 2026-08-23 · **Státusz:** elfogadva (tulajdonosi rendelet) · **Kapcsolódó:**
ADR-0018 (wow-mérce), ADR-0059/0061 (modul-integráció), 03-INVARIANTS §B.19 (új).

### Probléma (tulaj, 2026-08-23)

A foglaltság-naptár bekötése után a TELJES foglalási űrlap (naptárral) a lap tetejére
került — az organic sablon hero-kártyájába, amit egy KARCSÚ sávra terveztek. A tulaj
szavaival: „a foglalási felület már rögtön az elején, mielőtt még fel sem keltettük az
érdeklődését… ez így nem jó." A gyökér-ok mélyebb a layoutnál: a doktrína rögzítette a
MIT-eket (modul natívan, kipróbálhatóan), de nem a MIÉRT-et — így a végrehajtás
funkció-pipálássá válhatott, ítélet nélkül.

### Döntés

1. **A fő motiváció kimondva (§B.19):** az oldal íve elcsábítás → ajánlat → bizalom →
   konverzió. A teljes konverziós felület a lap ALSÓ, döntési zónájában él; az első
   képernyőn TILOS. Fent csak könnyű CTA, ami odaugrik.
2. **Minden felület-döntés ehhez mérendő** — egy funkció léte nem érv az elhelyezésére;
   leszállítás előtt a kimenet látogató-szemmel ítélendő meg (screenshot, 390px is).
3. **Szerkezet:** a sablonok szignatúra-konténerében (hero-kártya, dokk, sidebar) a
   karcsú CTA-sáv él (arra tervezték); a teljes foglalás-widget saját, natív-stílusú
   „Foglalás" szekció a záró zónában (`#cit-booking`); minden „Foglalás" gomb odaugrik.
4. **Kapu:** a dramaturgiát a `native-content-check` méri (a request-widget a
   galéria/szobák UTÁN áll a forrás-sorrendben; fent csak horgony).

### Visszafordíthatóság

🔄 Elhelyezés-átrendezés; a widget maga változatlan. Egy sablon indokolt kivétele
(pl. sidebar-kompozíció) az őr ALLOW-listáján, indoklással.
