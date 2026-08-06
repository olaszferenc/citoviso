# 2026-08-06 — Minőség-ív II.: kompozíciós kraft-roadmap (ADR-0025)

## Típus
Deliberációs session — NEM implementáció. A styling külön (következő) sessionben indul, ebből a tervből.

## Kiváltó (tulaj)
Az 5 art direction beportolása (ADR-0018/0019) után jelentős a javulás, DE a mock „még mindig bedobált
szar-nak tűnik". Pilotnak elég; a **globális méretű megkeresésekhez** kellő minőségtől még messze.
Rendelet: a minőség-emelést visszük előre első körben.

## A diagnózis (a lényeg)
Eddig a modulok MINŐSÉGÉT és VÁLTOZATOSSÁGÁT (a részeket) optimalizáltuk. A „bedobált" érzés a WHOLE
tulajdonsága: a részek közti VISZONY + az oldal-szintű HIERARCHIA + hogy az oldal REAGÁL-e a konkrét
szállásra. Ezek KOMPOZÍCIÓS, nem moduláris problémák → ezért nem oldotta meg az art direction sem
(mindegyik önmagában is állandó ritmusú sáv-sorozat). **Amatőr hozzáad, profi elhagy és kiemel.**

Kód-gyökér: a `Recipe` (src/engine/recipe.ts) csak azt fejezi ki: MILYEN szekció, MILYEN sorrend,
`variant`/`copy`/`skin`/`archetype`. NINCS szókincse a szekció SÚLYÁRA/FÓKUSZÁRA/VISZONYÁRA. Az AI-tervező
(`planRecipe` → `RECIPE_SCHEMA`, planner.ts) is csak ezt tölti.

## A döntés (ADR-0025)
Egyetlen központi mozdulat: bővítsük a `Recipe` szótárát + az AI-briefet (`RECIPE_SCHEMA` + `planRecipe`
prompt, immár **vízióval** = látja a fotókat). Render MARAD determinisztikus, mock=live sértetlen (additív,
opcionális mezők), §B.17/§I nem sérül. = az ADR-0019 „(C)" útja: ugyanaz a motor, okosabb brief. NEM új
motor, NEM stratégiaváltás.

## A 7 levél → mechanizmus
1. **Restraint** — hideg mockban a minta-jelölt töltelék (üres rooms/reviews/faq) KIESIK; kevesebb, de valós,
   sűrű szekció. Szelekció, nincs új render-kód. Erősíti §B.17 + §I.
2. **Fókusz-szekció** — `RecipeSection.emphasis?: "focal"|"normal"|"quiet"`; a brief a #1 megkülönböztetőt
   EGY szekcióra `focal`-ra teszi; renderer túlméretez, más lehalkul. Megöli a demokratikus egyformaságot.
3. **Ritmus-súly** — `emphasis`(+kind) hajtja padding-block/sűrűség/bg-váltakozás (ritmus-skála, nem konstans ~100px).
4. **Interlock / bleed** — szomszédos szekciók átfedése (átlógó kártya, negatív-margós fotó, közös bg-mező,
   varratot átlépő stat). A LEGERŐSEBB kézműves tell. Bizonyíték: `fullbleed-glass` üveg-sávja = ma az EGYETLEN
   interlock → ezért érződik a legjobbnak. Legdrágább, legnagyobb hozadék.
5. **Fotó-derivált paletta (§B.6)** — `SiteData.palette.accent` mező MÁR LÉTEZIK, de `engine/palette.ts`
   harmonizáló MÉG NINCS. Kell: vízió-extrakció + akcent-hue a skin biztonságos sínjeire (light/dark karaktert sose borít).
6. **Fotó-szerepek** — `Photo.role?: "dominant"|"detail"|"mosaic"` → eltérő crop/méret. Determinisztikus.
7. **Narratív copy-ív** — `copywriter.ts` az oldalt EGY ívként írja (átvezetők), nem per-modul generikusan.
(4. tell „aszimmetria" részben már `editorial-press`-ben → általánosítjuk, nem külön munka.)

Központi fojtópont: `RECIPE_SCHEMA` + `planRecipe` prompt + a render. A brief LÁSSA a fotókat (vízió).

## ELFOGADOTT SORREND (tulaj) — a styling-session ebből indul
1. **① restraint + ② fókusz** együtt (~60-70% érzet-nyereség, olcsó).
2. **④ interlock** (a maradék rés legnagyobb egyedi darabja).
3. **③ ritmus + ⑤ paletta + ⑥ crop** kohézió-réteg. + ⑦ copy-ív folyamatosan.

## Mérce + kapuk (változatlan)
Mérce: `assets/design-refs/reference-quality/` (ADR-0018), screenshot `scripts/engine-shot.ts`.
Kiküldés-kapu KÖTELEZŐ: `tenyhuseg-or` + `dizajn-doktrina-or`.

## Érintett fájlok (a styling-sessionben, MOST nem módosítva)
`src/engine/recipe.ts` (típus-bővítés) · `planner.ts` (RECIPE_SCHEMA + prompt + vízió) · `primitives.ts`
(interlock/ritmus render) · `archetypes.ts` (arrange bleed-tudat) · ÚJ `engine/palette.ts` · `copywriter.ts`.

## Módosított fájlok EBBEN a sessionben
- `_planning/DECISIONS.md` — ADR-0025 hozzáadva.
- `_planning/memory/2026-08-06_quality_composition_roadmap.md` — ez a jegyzet.
- `MEMORY.md` — aktív feladat frissítve.
