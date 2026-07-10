# DIZÁJN-KATALÓGUS — a mock-generátor „sokszínűség-memóriája"

> **Cél:** hogy az AI-generátor **tudja, mi az, hogy „sokszínű"** (konkrét szerkezeti szótár, nem homályos
> utasítás), ÉS hogy **ne ismételje magát** (mit használt már, főleg egy régión belül).
> Két memória: (1) **szerkezeti minta-katalógus** (bővülő szótár) · (2) **használati napló** (anti-collision).
> Kapcsolódó: ADR-0005/0006/0007, `_planning/DOMAIN/` (típus-taxonómia).

---

## 1. Szerkezeti minta-katalógus (a „diverzitás szótára")

A generátor promptjába ez a lista kerül: „használj ezekhez fogható, de akár ÚJ szerkezetet; NE a mostani
régióban már használtakat". **Bővíthető** — ahogy jön új archetípus, ide kerül (referencia: `assets/design-refs/structures/`).

| Archetípus | Lényeg | Ref-fájl |
|---|---|---|
| **editorial** | újság-fejléc, magazin-spread lebegő kártyával, drop-cap intro, váltakozó lakosztály-spreadek, serif | `structures/editorial.html` |
| **immersive-dark** | sötét paletta, teljes-képernyős parallax hero, full-bleed egymásra tornyozott kártyák | `structures/immersive-dark.html` |
| **quiet-minimal** | keskeny (max ~960), központozott, §-számozott csendes sorok, sok levegő | `structures/quiet-minimal.html` |
| **ken-burns-carousel** | animált Ken-Burns hero + húzható carousel (JS), pöttyök | `structures/ken-burns-carousel.html` |
| **cinematic-horizontal** | vízszintes-görgetős fejezetek (I–V), full-screen panelek, wheel→horizontal (JS) | `structures/cinematic-horizontal.html` |
| **booking-classic** | hero+foglaló-widget → „szobák&árak" → szolgáltatás-csík → vélemény+info (a 180-as korpusz alap-váza) | `types/*.html` |

**Bővítendő** (ötlet-mag, még nincs referencia): split-asymmetric · story-scroll (függőleges fejezetek) ·
gallery-led (galéria-fókusz) · magazine-grid · full-bleed-alternating · card-stack · map-forward.

## 2. Típus-referencia (Környezet × Minőség)

A `assets/design-refs/types/` 180 fájlja **típusonként** (`{kornyezet}-{minoseg}-{1..5}.html`) adja a **paletta +
hangulat + tipó + kép-stílus** referenciát. ⚠️ Ezek TARTALMA fiktív (stock kép, kamu ár/szoba/értékelés, emoji) —
**csak stílus-referenciának** (few-shot), NEM tartalomnak. Taxonómia: `_planning/DOMAIN/`.

## 3. ⚠️ Brand + jogi rendelet (KŐBE VÉSVE — minden generálásra)

1. **Tények kötöttek:** csak a szállás VALÓS adata (név, régió, valós fotók, a vízió által ténylegesen látott
   jellemzők). **Amit nem tudunk (ár, szoba-nevek, m², értékelés, NTAK), azt KIHAGYNI** — sosem fabrikálni.
   Ha nincs ár/szoba-adat → nincs „Szobák & árak" szekció.
2. **Nincs emoji** — saját vonalas SVG-ikonkészlet.
3. **Provenance + demo-jelölés:** a preview jelölje, hogy előzetes terv; portál/vendég-fotó csak demóra.
4. **Valós fotók** (Places/Street View), nem stock — a stock csak a referencia-korpuszban van.
5. **Turisztikai relevancia** (gyakori hiba): a tények IGAZAK legyenek, de a VENDÉG szempontjából
   RELEVÁNSAK is — elhelyezkedés/közelség (part, sétány, borvidék, központ), hangulat/csend/zöld,
   kilátás, kényelem, megközelíthetőség. NE turisztikailag lényegtelen fizikai/építészeti apróság
   (tetőszín, kapu/kerítés anyaga, homlokzat-részlet) — igaz, de nem eladási pont, sőt zavaró. A
   hero-főcím ÉLMÉNY/ELŐNY-vezérelt, ne fizikai leírás. („Piros tetős polgárvilla" ✗ → „Sétatávolságra a parttól" ✓)

## 4. Használati napló (anti-collision)

Minden generált mocknál rögzítjük, **melyik archetípust + stílust** használta (a `mock_artifact.inputs`-ban),
és **régiónként** visszakérdezzük → a prompt kapja: „ezeket a szomszédok már megkapták, kerüld". Így a
sokszínűség **régión belül is garantált**, és mérhető, hogy melyik archetípus mennyire fordul elő.

## 6. Sokszínűség vs. tényhűség — a valódi feszültség (2026-07-09)

⚠️ A tulaj cset-mintái (`structures/` — fullbleed-glass, split-bento, dark-luxury, airbnb-sidebar,
immersive-parallax, +topart-luxus 5) VADUL sokszínűek. A jelenlegi grounded aiMock ezekhez képest
samey. KÉT ok:
1. **Prompt-erő:** az agent nem tolja elég bátran a strukturális variációt, és NEM kapja few-shot-ként
   ezt a korpuszt. → **Gyors győzelem:** few-shot a `structures/`-ből + bátor nav-paradigma / foglaló-UX /
   layout-rendszer variáció; a VALÓS fotókat rendezze kreatívan (bento/mosaic/carousel — nem kell fake kép).
2. **⚠️ Tartalmi gazdagság = részben FABRIKÁCIÓ:** a minták gazdagsága (szoba-kártyák, árak, 138 vélemény,
   rating-barok, stat-band, ár-bontásos sidebar) nagyrészt KITALÁLT adat — és épp EZEK a szekciók adják a
   sok elrendezhető elemet. Amikor tényhűre szűrünk, egy adat-szegény lead (5 fotó, nincs ár/szoba/vélemény)
   eleve VÉKONYABB → kevesebb szekció → kevesebb variáció. A gazdagság és a fabrikáció részben ugyanaz.
   → **Valódi megoldás:** TÖBB valós adat (valós felszereltség, valós Google-vélemények, hely/POI/közeli
   látnivaló kontextus — lásd POI-DB + enrichment). Adat-szegény lead sosem lesz olyan gazdag, mint egy
   fabrikált resort, de valós enrichmenttel sokkal közelebb kerül — hazugság nélkül.

**Következő:** (a) erősebb agent-prompt few-shot korpusszal + bátrabb struktúra; (b) valós-adat enrichment.
