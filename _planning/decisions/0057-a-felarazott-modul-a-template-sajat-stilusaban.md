## ADR-0057 — A felárazott modul a template SAJÁT stílusában jelenik meg (nem generikus doboz)

**Dátum:** 2026-08-23 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0016 (kompozíciós motor,
O(modul) elv), ADR-0044 (modul-tartalom egy forrásból), ADR-0047 (slot-elhelyezés), ADR-0048
(reviews-pending őszinte helytöltő), 03-INVARIANTS §B (dizájn) + §I (nincs bait-and-switch).

### Probléma

A tulaj a generált mockot tesztelve jelezte: a modul-szekciók (vélemények, nyitvatartás,
hírlevél, árak, amenities) **generikus szürke dobozként „fel vannak sorolva" a lap alján**, a
template kézműves szekcióihoz képest teljesen más — olcsóbb — vizuális nyelven. „A paraszt azt
hiszi, úgy fog kinézni az oldala." Ez pontosan a mock=live / bait-and-switch feszültség: az
ajánlott kép nem az, amit a template ígér. Az ADR-0047 a modul HELYÉT jól megoldotta (megnevezett
slot), de a modul STÍLUSÁT nem — az a fix `.cit-modsec` szürke-doboz maradt.

Másik lelet ugyanabban a tesztben: a Google-rating **kétszer** mondta ugyanazt (hero-statisztika +
`reviews-pending` tompa szöveges ismétlés), a nav „Vélemények" linkje pedig `#t-reviews`-ra mutatott,
ami rating nélküli oldalon nem is létezik (halott horgony).

### Döntés

1. **Template-natív modul-kontraktus.** A közös `.cit-modsec` CSS mostantól CSS-változókból
   dolgozik (`--cit-modsec-py/-maxw/-px/-divider/-head-align/-head-mb/-head-size/-head-weight/
   -card-radius/-card-pad`). Minden art-template EGYSZER beállítja ezeket a SAJÁT szekció-ritmusára
   (`body.cit-tpl-<id>{…}`). A modul így a template stílusát veszi fel (középre/bal, éles/puha sarok,
   sűrű/levegős), miközben a modul MARKUP-ja **továbbra is egy forrásból** (`moduleSections.ts`) jön.
   Ez O(templates) egysoros/template, **NEM** az O(templates × modul) csapda (ADR-0016). A defaultok
   a régi kinézetet reprodukálják, így override nélkül a template bájtazonos a korábbival.

2. **A rating a vélemény-szekcióban DESIGNED badge**, nem tompa ismétlő mondat. A valós Google-szám
   ott marad (a §B.17 anti-fabrikáció-kapu megköveteli: a helytöltő a VALÓS számot mutatja, nem
   törléssel „nyer"), de csillag-badge-ként, a szekció részeként — a „kétszer ugyanaz" érzés így
   megszűnik. A badge kimarad, ha a `google-rating` modul közvetlenül felette már mutat egyet.

3. **Stabil `#t-reviews` horgony.** A `reviews-pending` szekció viseli az id-t; a nav/lábléc
   „Vélemények" linkje csak akkor jelenik meg, ha a horgony tényleg létezik (van rating vagy valós
   vélemény) — nincs többé halott ugrópont.

**Kikényszerítés:** `scripts/module-slot-check.mts` új kapuja piros, ha bármely template nem állítja
be a `--cit-modsec-py`-t (a 17. template nem csúszhat vissza némán generikusba). A meglévő kapuk
(module-render-check anti-fabrikáció, review-flow moderáció, design-token-lint) zölden maradtak.

### Következmények

- Mind a 16 template modul-szekciói a saját arculatukban jelennek meg (screenshot-verifikált,
  desktop + 390px). A mock, amit a lead lát, a kész oldalt ígéri — nem egy félkész vázat.
- Új template írásakor a modul-kontraktus beállítása kötelező (kapu védi), egy CSS-blokk a költsége.

### Visszafordíthatóság

🔄 Additív és token-alapú: a változó-kontraktus defaultjai a régi kinézet, így bármely template
override-ja elhagyható visszaesés nélkül. A badge/anchor finomítás lokális, egy fájlban vissza-
vonható.
