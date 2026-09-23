# Évhez kötött szezonár + szezon végi kérdés — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-23, két §2b kör után. 1. kör: A / B / C → a tulaj a **B** irányt
(évsáv) választotta, három kéréssel: az évek **korlátlanul görgethetők** oldalra, mobilon
is, és **egyértelmű legyen, hogy oldalt is vannak évek**; a szezon **mentés után is
módosítható** legyen (név, időszak); és látsszon, hogyan adható meg egy **évhatáron átnyúló**
időszak (2026. 11. 01. – 2027. 03. 01.). 2. kör: B·1 (kilógó kártya) / B·2 (év-vonalzó) →
**B·1**. Utána a tulaj döntött: **fel/le sorrend** kell a szezon-soron (a feljebb álló nyer),
a DB-mezők neve **`parent_id`** és **`season_nudged_year`**, és az évre szóló szezon
lejáratakor **nincs** „Hamarosan lejár egy ár” levél. ·
**Kapcsolódó:** ADR-0208 ③ (a szezon `MM-DD`, év nélkül — a mért tényállás), ADR-0208 ⑥.5,
ADR-0215 ② (az évhez kötött ár adata és szabálya, migráció 0072), ADR-0193 ① (nem blokkolunk),
§B.17. · **Migráció:** 0073.

**Hatókör:** `src/server/moduleConfigViews.ts` · `src/tenant/seasonNudge.ts` · `src/tenant/prices.ts` · `src/tenant/priceExpiry.ts` · `src/engine/moduleSections.ts` · `migrations/0073_season_year_price.sql`

`plan.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** A kész felületet ehhez
mérjük (mobil 390 + asztali). A fájl a 2. kör mockja: a fenti váltón a **B·1** a jóváhagyott,
a B·2 csak a döntés nyoma. A képek a B·1 állapotait mutatják.

## Miért létezik

Mérve (ADR-0208 ③): a szezon ismétlődő `MM-DD`, év nélkül, ezért a 12 hónapos foglalási
horizonton belül 2027 júliusára ugyanaz a 96 000 Ft fagyott be, mint idénre. A 0072 az adatot
(`valid_from`/`valid_to`) és a szabályt (`cit-season.cjs`: évhez kötött szezon → ismétlődő
szezon → dátumos alapár → alapár) megadta — a **felülete** hiányzott.

## Amit a terv KÖT

1. **Visszaeséssel.** Évre szóló árat csak az kap, aki megadja; minden más évben az ismétlődő
   ár él. Egy üres kártya **nem** hiba és nem blokkol semmit.
2. **Az évsáv** minden ismétlődő szezon alatt áll: évenként egy kártya, a legközelebbi, még le
   nem zajlott évtől. A kártyán az év („2027”, átnyúló szezonnál „2026/27”), a teljes dátum,
   az ár-mező (üresen az ismétlődő ár halványan beleírva) és a jelölés: **„saját ár”** vagy
   **„az ismétlődő ár”**. Gombok: **„Mentés”**, és saját árnál **„Vissza az ismétlődőre”**.
3. **Oldalt is vannak évek — ez látszik:** a következő kártya széle mindig kilóg jobbra (mobilon
   egy kártya ~80%, asztalin ~2⅓ fér ki), a jobb szél elhalványul, fölötte két nyíl lép, és a
   fejléc mondja: „**2027** · **„húzza oldalra a további évekért”**”.
4. **Végtelen:** ahogy a tulaj jobbra görget, újabb évek jönnek; nincs felső korlát.
5. **Saját napok egy évre:** a kártyán a **„Más napokon ebben az évben”** alatt (pl. húsvét).
   Ilyenkor a kártya dátuma az adott évi napokat mutatja, „saját napok” jelöléssel.
6. **A szezon mentés után is módosítható:** **„Szerkesztés”** a soron → a sor helyén szerkesztő
   (név, kezdet, vég, ár, és foglalással a minimum), **„Mentés”** / **„Mégse”**. Az éves árak
   megmaradnak; amelyiknek nincs saját napja, az az új napokra költözik, a saját napos marad.
7. **Élő előnézet** (új szezonnál és szerkesztésnél): „Így érvényes: november 1. – a következő
   év március 1., minden évben. Átnyúlik az év végén, például 2026. 11. 01. – 2027. 03. 01.”
   Lehetetlen napra (13-01, 02-30) hibaüzenet. A dátum pontokkal is írható („11.01”, „11. 01.”,
   „1101”) — a szerver ugyanazzal a függvénnyel tárol, amivel az előnézet számol.
8. **Az év végén átnyúló szezon** soron **„átnyúlik az év végén”** jelölés.
9. **Átfedés:** ha az új vagy átírt szezon napjai egy másikéval közösek, sárga sor mondja meg,
   melyiké lesz a közös napok ára — **a listán feljebb álló**. *(A jóváhagyás után hozzáadva, a
   tulaj döntésére:)* a sor **fel/le nyíllal** rendezhető; a sorrend egyben az éves árak
   sorrendje is.
10. **A honlap ártáblája** évet csak annál a szezonnál ír, amelynek van éves ára, és akkor a
    foglalható 12 hónap minden alkalmát a valódi árával listázza; év nélküli sora ilyenkor
    **nem** marad (az idei árat ígérné jövőre is). Az éves ár nélküli szezon sora változatlan.
11. **A szezon végi kérdés:** a szezon utolsó napja utáni reggelen egy levél — tárgya
    **„Véget ért: {season} — mi legyen jövőre az ára?”**; benne az idei ár, és hogy ha marad,
    **„nem kell tennie semmit”**; a link a következő év kártyájára visz, a kurzor az ár-mezőben.
    Szezononként és évenként **egyszer** (`season_nudged_year`), 7 napon belül, és **nem** megy
    ki, ha a következő évre már van saját ár.
12. **Nincs „Hamarosan lejár egy ár” levél az éves szezonra** — lejáratkor az ismétlődő ár lép
    életbe, a sor csendben törlődik és a lap újrarenderelődik. A dátumos ALAPÁR emlékeztetője
    (ADR-0215) változatlan.

## Eltérés a mocktól (kimondva)

- **A levél tárgya és első mondata névelő nélkül áll** („Véget ért: Főszezon — …”, „Tegnap véget
  ért ez az időszak: Főszezon (06. 15. – 08. 31.), Kertre néző apartman.”), a mock „Véget ért
  a Főszezon …” helyett: a levél a tenant nyelvén megy ki (ADR-0067), és a magyar névelő
  (a/az) a szezon nevétől függ — fordítható sablonba nem égethető. A tartalom ugyanaz.
- A mock levelében nincs dátum-változat; a valódi levél „Tegnap …”-ot csak akkor ír, ha a
  szezon valóban tegnap ért véget (egy kimaradt tick után a dátumot írja ki).

## Kötő horgony

- `data-strip` — az évsáv (a szkript és az őr erre köt)
- `data-sedit` — a szezon szerkesztője
- `data-sadd` — az új szezon űrlapja az élő előnézettel
- `season_nudged_year` — a szezon végi kérdés bélyege
- `parent_id` — az éves ár kötése a szezonhoz

## Őr

`scripts/season-year-price-check.mts` — ~99 állítás, eldobható fixtúra, valódi DB + HTTP +
böngésző, mindkét méreten; pozitív kontrollal (a nudge egyszer tényleg kimegy; a dátumos alapár
emlékeztetője tényleg kimegy). Piros kontrollok kézzel lefuttatva (6 bukás): az év nélküli sor
visszatétele a honlap-táblába, a bélyeg-feltétel kivétele, a lejárat-levél kivételének kivétele.
