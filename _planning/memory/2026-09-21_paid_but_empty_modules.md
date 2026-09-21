# 2026-09-21 — A kifizetett, de ÜRES modul (+ három diagnózis a tulaj kérdéseire)

## Amivel a session indult: a tulaj három kérdése

A tulaj a saját tenantján tesztelt („beköltöztem a honlapra"), és hármat kérdezett.
Mindháromra MÉRÉS ment, nem vélemény:

1. **„kilóg a tenant címe a kártyáról"** — igaz. A `.adm-stat b` dobozon nem volt semmilyen
   törés-engedély, a cím viszont egyetlen szóköz nélküli token, a rács cellája pedig
   `minmax(160px,1fr)`. Javítva: `min-width:0` + `overflow-wrap:anywhere`.
2. **„a Környék/látnivalók modul működik? megy a scrape? mi a cron rá?"** — NEM működik.
   Nincs mögötte SEMMILYEN adatgyűjtés (se Overpass/OSM, se Places, se távolságszámítás, se
   POI-tábla, se cron/timer/worker); a tartalom kizárólag kézi. Az ADR-0041 tervezte, de
   RÉTEG B, nem épült meg. ⛔ A fizetés előtti előnézet közben azt ígéri, hogy „a környék
   valós pontjait és távolságait **mi állítjuk össze**" — ezt ma semmi nem teljesíti.
3. **„jól kalkulálta a fizetendőt? kevésnek tűnik"** — JÓL. Levezetve a kódból és a DB-ből:
   490+490+990 = 1 970 Ft/hó × 10 hó (12 − 2 ajándék) = **19 700 Ft** listaár, mínusz egy
   **25 %-os** „új előfizetői üdvözlő kupon" (ADR-0088 §6, `offer` tábla, max 1 használat)
   = **14 775 Ft**. A DB-ben: `list_price=19700`, `price=14775`, `payment.amount=14775 paid`.
   ⚠️ A szám helyes, a KÖZLÉS hiányos: a kedvezmény sehol nem látszik — sem a visszaigazoló
   sávon (`adminViews` csak a végösszeget kapja: a redirect `mamount=order.price`-t visz,
   pedig az orderben ott a `listPrice` és az `offerPercent`), sem a számlán. Az ADR-0088 ④⑥
   saját szava erre: „visibly, not buried". A kupon közben csendben el is fogyott (1/1).

## A mérés, ami egyik kérdésben sem szerepelt — és a legsúlyosabb lett

Lekértem a tulaj ÉLŐ oldalát (HTTP 200, 149 kB): a `data-cit-module` horgonyok közt **nincs
`pricing` és nincs `poi`**, és a lapon az „Árak" / „A környéken" szó **0-szor** fordul elő.
A három ma vásárolt modulból kettő **semmit nem tesz az oldalra**, mert üres — és erről
egyetlen képernyő sem szólt. Ez lett a session fő munkája (ADR-0194).

⚠️ A horgony-alapú mérés önmagában HAZUDIK: a `reviews` → `review-form`/`reviews-pending`,
a `location` → `map`, a `booking` → `booking-section`, az `enquiry` → `booking`. Az első
futásom emiatt hamis pirosakat adott (a „Megközelítés és kapcsolat" ott van a lapon,
horgony nélkül). A leképezés a `MODULE_CATALOG.domType`-ban él.

## Amit szállítottam (A változat, §2b kör)

Három működő mock (A: teendő-sor modulonként · B: összevont sáv · C: „Mit lát ma a vendég"
szakasz-lista), mindkét méret képével, kattintható HTML-lel → a tulaj **A**-t választotta.
Kontraktus: `assets/design-refs/tenant-admin/paid-empty/README.md`. Döntés: **ADR-0194**.

- Predikátum: `paidButEmptyModules()` + `filledContentFields()` (`src/tenant/modules.ts`) —
  az ürességet a `moduleContentFor().data` dönti el, a renderelő saját kimenete.
- Öt modul kaphat sort (`pricing`, `poi`, `hours`, `amenities`, `rooms`); négy SOHA
  (`booking`, `location`, `reviews`, `enquiry`), plusz `gallery` és `usp` — a hamis riasztás
  ugyanolyan kár, mint a néma hiba.
- Az ár-szabály modul-szintre emelve (`annualMultiplier` + `modulePriceForm`), hogy a Modulok
  fül és a teendő-sor EGY példányból árazzon.
- Őr: `scripts/paid-empty-check.mts` (+`--self-test`: 20 bukás), bekötve a pre-commit-be.
- KB: `admin-overview` új szakasza + elem-capture kép, 6 nyelvre lefordítva.

## ⛔ Saját hibák, amiket NEM én vettem észre elsőre

1. **A burkoló-csapda.** Az első predikátumom a `ModuleContent` FELSŐ szintjét kapta
   (`{data, photoCap, units}`), így egyetlen modul-mező sem volt a halmazban: az üres
   tenanton **véletlenül helyes** eredményt adott, minden kitöltöttön hamis riasztást. A
   negatív kontroll (szintetikus kitöltött `data`) fogta meg.
2. **Zárt hurok a KB és az őr között.** A súgóba KITALÁLT modulnevet írtam („Érkezés,
   távozás" a valódi „Nyitvatartás, érkezés" helyett), és az őr fixtúrája UGYANAZT a kitalált
   nevet gépelte — a saját téves feltevésemet igazoltam vissza. Gépi kapu ezt nem foghatta
   meg; a **tudásbázis-őr** emberi verdiktje törte meg. Gyökér-ok javítva: a fixtúra a
   `MODULE_CATALOG`-ból származtat.
3. **Fordítatlan modulnév** a sorban (`esc(m.label)`), miközben a felület minden más helye
   `T(lang, m.label)`-t ír → a lengyel tulaj lefordított súgót olvasott volna magyar
   modulnévvel. Az i18n-lint ezt nem látja (a kulcs változó, nem literál).
4. **A KB-kép kétszer volt rossz:** először 0 px-et változott (a fixtúra-vendégház nem
   birtokolja a `poi`-t, így üres listát kapott), aztán viewportként **félbevágta** a sort —
   a magyarázat és MINDKÉT gomb lemaradt, pont amin a szöveg végigvezet. Most `.adm-card`
   elem-capture (1644 px). A `.adm-main__inner` visszahozta volna a lap fejlécét is, de
   **mérve 2344 px** — a szkript saját szabálya szerint 2000 px fölött olvashatatlan.
5. **Összerakott mondatot idéztem** félkövéren a súgóban („Töltse ki: Szobák, apartmanok"),
   ami nem literál, hanem `T(lang,"Töltse ki: {module}")` behelyettesítés — a kb-scan hook
   blokkolt. Plusz a szócikk RÉGI részében két félkövér „felirat" sosem létezett a képernyőn.

## 🔴 NYITOTT — amit ez a session kimért, de nem oldott meg

- **A POI-ígéret fedezetlen.** „Mi állítjuk össze" — de nincs gyűjtés. Külön session indult
  rá: **„Automata heti programajánló"** (`https://claude.ai/code/session_01K3gwMQc3jtbyxMhspXwvwh`),
  briefje a saját fája `assets/design-refs/_drafts/BRIEF.md`-jében. Feladata: modul-átnevezés,
  batch-gyűjtés (~30 programból a tenant 10-et választ/szerkeszt), ár-emelés (az összeget a
  tulaj mondja meg). Költség-mérés a briefben: web search **$10/1000 keresés** + a találatok
  input tokenként; naiv heti hívás/tenant Haikuval 175 Ft/hó, Sonnettel 580 Ft/hó — a mai
  490 Ft-os modulárba csak a Haiku fér bele. Régiós cache + Batch API (−50 %) +
  `response_inclusion:"excluded"` mellett ~53 Ft/hó/tenant.
- **A kedvezmény láthatatlan** (lásd fent, 3. kérdés): a `listPrice`/`offerPercent` megvan az
  orderben, csak nem megy tovább a sávra és a számlára.
- **Az ADR-0193 ár-kapuja a JOGOSULTSÁGOT kérdezi**, nem a tartalmat: kifizetett, de üres
  `pricing` mellett a foglalási út továbbra is árat számolhat és fagyaszthat a vendég
  levelébe, miközben a lapon nincs ár. Mérni és dönteni kell — külön szál.

## Módosított fájlok

`src/tenant/modules.ts` · `src/server/adminViews.ts` · `src/server/public.ts` ·
`public/assets/ui/citui-admin.css` · `src/i18n/catalog.json` · `scripts/paid-empty-check.mts`
(új) · `scripts/kb-shot.mts` · `hooks/pre-commit` · `kb/entries/admin-overview/entry.hu.md` +
`assets/hu/screen.png` · `assets/design-refs/tenant-admin/paid-empty/` (új kontraktus) ·
`_planning/DECISIONS.md` (ADR-0194)
