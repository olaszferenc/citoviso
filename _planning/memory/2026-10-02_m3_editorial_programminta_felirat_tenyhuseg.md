# 2026-10-02 — M3: editorial szállás-szöveg, dátum nélküli program-minta, beszélő fotó-felirat, tényhűség-lista (ADR-0300)

**Szál:** SUB M3 (`~/wt/cit2a60616f`), koordinátor: CIT „élesi teszt” fő session (`~/wt/cit87d3f275`).
**Brief:** `~/rc-briefs/javitas-elek-0930/m3-editorial-programok.md`. **Forrás:** Elek élesi jelentése (SZ-3, SZ-4, L-3, H-2).

## Menet
1. §2b terv-kör (2026-10-01): működő változatok a VALÓDI mockokon (Muschel élesről scp, csak olvasás; Három Huszár dev),
   változat-réteg a mock DOM-ján, mobil/asztali + lead-váltó, Playwright 164 állítás. 18 sablon felmérése (külön szálnak).
2. Tulaj-döntés (2026-10-02, „egyetértek”): SZ-3 A · SZ-4 1 (ADR-0218 ②④ felülírva) · L-3 2 · H-2 1.
3. Kód + őrök, mindegyik mutációval igazolva (régi kód → piros, új → zöld).

## Elvégzett munka
- `src/engine/templates/editorial.ts` — szavak (Szolgáltatások/Képek/Vélemények/Az oldalon/Elérhetőség/Szabad szoba kérése),
  nincs No.-szám, idézőjeles főcím, díszbetű, „Nyomtatva…”; „A ház számokban” csak ≥2 szám fölött; a nyitókép felirata a kép alatt.
- `src/engine/photoCaption.ts` (új) — a látható felirat szabálya; használja: editorial, brutalism, artdeco, darkLuxury, primitives.
- `src/engine/moduleSections.ts` — a program-minta dátum/nap nélkül, „Minta” pirulával; a runtime `shiftSampleDates` MARAD (kiküldött mockok).
- `src/console/views.ts` + `public/assets/ui/citui-console.css` — a tényhűség-jelvény gomb a számmal, a lista a kártyán.
- Őrök: `scripts/template-copy-check.mts`, `scripts/photo-caption-check.mts`, `scripts/mock-card-fact-list-check.mts` (új),
  `module-render-check` / `native-content-check` / `configurator-placement-check` (program-minta szabály átírva); pre-commit bekötés.
- Kontraktusok: `assets/design-refs/public-site/sablon-szoveg-feliratok/`, `.../programajanlo/minta/` (frissítve),
  `assets/design-refs/console/mock-cards-fact-list/`. KB: `kb/entries/console-lead/entry.hu.md` (a jelvény-lista).

## Koordinátori kiegészítés (2026-10-02, az M4 leletéből)
- Az editorial vélemény-kártyáiról lekerült az átlag csillagsora; az átlag egyszer áll a vélemény-szakasz fejléce alatt
  (a rating-scale-check és a star-size-check „mérés vak” bukása miatt kell az egy sor).
- EGY őr a sablon-szövegre: az editorial tételek a `scripts/template-copy-check.mts`-ben (az M4 ugyanezt a fájlt hozza;
  ő landol később → rebase-nél beleolvasztja a saját szakaszát; az ő `OLD_CARD_STARS` listája már számol az editoriallal).

## Tanulságok
- Az „AMIT ITT KAPSZ” AI-szöveg (recept eyebrow), nem sablon — a vendég-kritikus (ADR-0292) fogja; nem ide tartozik.
- A kártya teendő-mondatát először „indoklással vedd tudomásul”-ra írtam — a kód szerint a felugró megjegyzése NEM
  kötelező („Kiküldöm mégis”). A súgó és a kód olvasása mentett meg egy hamis mondattól.
- A KB-őr az összerakott „6 forrás nélküli” feliratot literálnak vette volna — összerakott szöveget nem idézünk félkövéren.
- A lake-balaton portál a headless Chromiumot 429-cel tiltja (valódi böngészőt kiszolgál) — a mérő UA-t kell állítani.
  Gyanú (NEM ellenőrizve): a saját fotó-élő ellenőrzésünk emiatt halottnak minősíthet élő portál-képeket.

## Nyitott
- A KIKÜLDÖTT mockok statikusak: a régi editorial-szöveg, dátumos program-minta és gépi felirat bennük marad, amíg nem
  renderelődnek újra (koordinátori/tulaj döntés).
- A többi 18 sablon játék-szövege és csillagsora, az archFrames vélemény-címe: M4.
