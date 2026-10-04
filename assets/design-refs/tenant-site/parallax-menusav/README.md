# Parallax — görgetett menüsáv asztalon (JÓVÁHAGYOTT kontraktus)

**Hatókör:** `src/engine/templates/parallax.ts`

**Tulaj döntése:** 2026-10-04, a koordinátoron át, szó szerint: „A”. A két vázlatból (A: vékony görgetett
menüsáv, a dokk nem ragad · B: linksor a ragadó foglalás-dokkban) az A-t választotta. Terv: `plan.html`
(a sablon valódi renderje, demó-adattal). Képek: `shots/terv-asztal-gorgetve.png`, `shots/terv-mobil-gorgetve.png`,
`shots/terv-asztal-foglalasnal.png`, `shots/terv-asztal-erdeklodes.png`.

**Miért:** a tulaj jelezte, hogy a Parallax mock ragadó fejlécében csak a foglalás (Foglalás / Szabad időpontok)
van, a Galéria és a többi szakasz nincs. Mérve: a ragadó elem a foglalási dokk volt, a szakasz-menü csak a
hero masthead-jében élt, görgetve csak a felirat nélküli pötty-nav maradt.

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. Asztalon (701 px fölött, 500 px-nél magasabb képernyőn) a hero elhagyása után felül egy vékony sötét sáv
   csúszik be: a szállás neve, a masthead szakasz-linkjei (ugyanaz a készlet és felirat), jobb szélen a foglalás-gomb.
   A hero alatt (amíg a masthead látszik) a sáv nincs kint.
2. A sáv linkje a sáv ALÁ ugrik, nem mögé (`--cit-stick`, közös runtime).
3. ADR-0253 ①: a foglalási blokknál a sáv foglalás-gombja eltűnik (a közös runtime méri), a linkek maradnak.
4. A foglalási dokk NEM ragad (foglalás-modul nélkül egy ~227 px magas érdeklődés-űrlap, ragadósan a képernyő
   negyedét vinné); a hero alatt a folyamban áll.
5. A dokkban az érdeklődés-űrlap a sötét alapra van festve: a cím, a címkék és a megjegyzések világosak
   (mérve előtte: a cím sötét a sötéten).
6. Telefonon (és fekvő telefonon) nincs sáv: ott az ADR-0253 közös menügombja és alsó sávja él, változatlanul.
7. JS nélkül a sáv nem jelenik meg; a masthead és a pötty-nav ugyanúgy navigál.
8. A sáv csak a lapon ténylegesen meglévő szakaszra linkel; egy nem megvett modul szakaszával együtt a linkje is
   eltűnik (élesen a szerver-vágás, a mockban a konfigurátor — őr: `scripts/nav-target-check.mts`,
   `scripts/unbought-module-leak-check.mts` ⑤).
