## ADR-0218 — A lead-mock programajánlója kitöltött minta: pirula nélkül, a nézés napjához igazított dátumokkal (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva) · **Kapcsolódó:** ADR-0214
(heti programajánló), ADR-0061 (minta-jelölés a szekción), ADR-0015 (wow ↔ jelölés feszültség),
§B.17 (tényhűség). Kontraktus: `assets/design-refs/public-site/programajanlo/minta/README.md`.

**Kontextus.** A lead-mockban a `poi` minta még a régi ADR-0061 hely-típus lista volt („A környéken
— Strand, vízpart…”), nem az ADR-0214 jóváhagyott A blokkja. A tulaj: „azt szeretném, ha már a
leadnek kiküldött mockfile-ban ez a programajánló szekció tartalommal lenne feltöltve. Nem azt
mondom, hogy valós adattal, csak egyáltalán tartalommal." A mock statikus pillanatkép, a lead
hetekkel később nyitja meg: valós programok addigra lejárnának.

**Döntés.**
1. **A mock az A blokkot mutatja, kitöltve:** 10 évszak-független program-TÍPUS, „a környéken”
   hely-rovattal. Kitalált település, km-címke, „Helyben” és „Forrás:” sor nincs (§B.17).
2. **Jelölés a bevezető mondatban, pirula nélkül** (tulaj: a három vázlatból a „C”): „**Minta-napirend.**
   Élesben itt a következő két hét valós programjai állnak, {a lead települése} 30 km-es
   körzetéből, forrással." Ez az ADR-0061 pirula-szabály KIMONDOTT kivétele erre az egy szekcióra —
   a jelölés továbbra is a szekción él, nem egy képernyővel lejjebb.
3. **A dátumok a nézés napjától számolnak:** a sor az eltolását hordozza (`data-d`, `data-len`); a
   szerver a render napjától írja ki, a runtime (`shiftSampleDates`) a megnyitás napjára tolja.
   JS nélkül a render-napi dátum marad.

**Őrök.** `module-render-check`: minden sablonban 10 sor, jelölt, holnapi első dátum, nincs
kitalált forrás/távolság, a bevezető a lead települését viszi. `native-content-check` és
`configurator-placement-check`: a poi szekciót NÉV szerint kérdezik a jelölésről (negatív
kontrollal: a jelölés kivétele mindkettőt pirosra viszi); élesre a minta-jelölés nem szivároghat.
