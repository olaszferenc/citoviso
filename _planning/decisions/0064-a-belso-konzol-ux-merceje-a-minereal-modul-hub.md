## ADR-0064 — A belső konzol UX-mércéje a MineREAL: modul-hub kezdőlap, bizonylat-TÍPUS, oszlop-szűrős kereső

**Dátum:** 2026-08-23 · **Státusz:** elfogadva (tulajdonosi rendelet) · **Kapcsolódó:**
ADR-0021 (dizájn-mag), project_internal_console_erp_foundation (ERP-mag elv).

### Probléma (tulaj, 2026-08-23)
A partner/bizonylat-felület első köre funkcionálisan kész volt, de a tulaj a bevált
MineREAL ERP-je képernyőit adta MINTÁUL (több screenshot), és a szállított felület ettől
elrendezésben és kinézetben is messze volt. Három rendelet született.

### Döntés
1. **Kezdőlap = modul-hub.** A konzol nyitóoldala modul-kártyás irányítópult (hero +
   figyelem-chipek élő számokkal + funkció-kereső + kártyánként almenü-lista + „Modul
   megnyitása"). A felső sáv CSAK modul-szintű (Irányítópult · CRM · Pénzügy · Riport ·
   Beállítások) — soha nem az összes funkció laposan.
2. **A bizonylatnak TÍPUSA van, iránya nincs a felületen.** Egy bizonylatot rögzítünk, és a
   típusát választjuk („Vevői számla", „Szállítói számla", sztornó, díjbekérő…) — a
   direction+doc_type a katalógus (DOC_TYPE_OPTIONS) mögött él, a DB változatlan (EGY tábla:
   accounting_document). Kimenő/bejövő SOHA nem külön szekció, csak szűrő.
3. **A kereső-munkalap oszlop-szűrős.** A lista szűrői a táblázat fejléce ALATT ülnek,
   oszloponként (szám, partner, típus, dátum tól-ig, deviza, fizetve) — egy GET-formban,
   lenyílók change-re. A partner-lap fejléce mineral-sáv: azonosítók balra, kompakt
   KPI-dobozok jobbra, fülek a sáv alatt, Áttekintésen KPI-csík + havi bontás diagram.

### Meta-tanulság
A tulaj REFERENCIA-KÉPERNYŐI nem hangulat-inspirációk, hanem a DESIGN-SPEC maga (elrendezés
+ kinézet + workflow): 1:1 portolandók, eltérni csak kimondott indokkal szabad. A szerkezet
átvétele a kinézet átvétele nélkül = bukott szállítás.
