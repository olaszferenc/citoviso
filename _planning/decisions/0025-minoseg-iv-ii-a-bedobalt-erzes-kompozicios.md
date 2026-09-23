## ADR-0025 — Minőség-ív II.: a „bedobált" érzés = KOMPOZÍCIÓS hiány; a `Recipe` szótárának + az AI-brief bővítése (nem új motor)

- **Kiváltó (2026-08-06, tulaj):** az 5 art direction beportolása (ADR-0018/0019 folytatása) után jelentős a javulás,
  DE „még mindig bedobált szar-nak tűnik". Pilotnak elég, de a **globális méretű megkeresésekhez** kellő minőségtől
  még messze. A tulaj rendelete: a minőség-emelést visszük előre első körben (a styling külön sessionben).
- **Diagnózis (a KULCS):** eddig a modulok MINŐSÉGÉT és VÁLTOZATOSSÁGÁT (a részeket) optimalizáltuk. A „bedobált"
  érzés viszont a WHOLE tulajdonsága: a részek közti VISZONY, az oldal-szintű HIERARCHIA, és hogy az oldal REAGÁL-e
  a konkrét szállásra. Ezek kompozíciós, nem moduláris problémák → ezért nem oldotta meg az art direction sem
  (mindegyik önmagában is állandó ritmusú sáv-sorozat). Egy mondat: **amatőr hozzáad, profi elhagy és kiemel.**
- **Kód-gyökér:** a `Recipe` (recipe.ts) ma csak azt fejezi ki: MILYEN szekciók, MILYEN sorrendben, milyen `variant`/
  `copy`/`skin`/`archetype`. **NINCS szókincse** a szekciók SÚLYÁRA, FÓKUSZÁRA, EGYMÁSHOZ VALÓ VISZONYÁRA. Az
  AI-tervező (`planRecipe` → `RECIPE_SCHEMA`) is csak ezt a szűk szótárt tölti.
- **A döntés — egyetlen központi mozdulat:** bővítsük a `Recipe` szótárát + a hozzá tartozó AI-briefet (`RECIPE_SCHEMA`
  + `planRecipe` prompt, immár **vízióval** = a fotókat is látja). A `render` MARAD determinisztikus és a **mock=live
  garancia sértetlen** (a recept perzisztál, azonosan újra-renderelhető), a **§B.17/§I** sem sérül. Ez az ADR-0019-ben
  elvetett bespoke-AI-layout (B) helyett a „(C)" út: **ugyanaz a motor, sokkal okosabb brief** — NEM új motor, NEM
  stratégiaváltás (ADR-0016/0019 érintetlen).
- **A 7 levél → mechanizmus (impact × olcsóság priorizálva):**
  1. **Restraint-politika** — hideg mockban a minta-jelölt töltelék-szekciók (üres rooms/reviews/faq) KIESNEK;
     kevesebb, de valós-fedezetű, sűrű szekció. Nincs új render-kód (szelekció). Erősíti a §B.17-et ÉS a §I-t.
  2. **Fókusz-szekció** — `RecipeSection.emphasis?: "focal"|"normal"|"quiet"`; a brief a szállás #1 megkülönböztetőjét
     EGY szekcióra `focal`-ra teszi (renderer túlméretez, minden más lehalkul) → megöli a demokratikus egyformaságot.
  3. **Ritmus-súly** — az `emphasis`(+kind) hajtja a `padding-block`-ot/sűrűséget/háttér-váltakozást (ritmus-skála a
     konstans ~100px sáv helyett). Tiszta render-logika.
  4. **Határ-átfedés / interlock** — szomszédos szekciók közti „bleed" (átlógó kártya, negatív-margós fotó, közös
     háttér-mező, varratot átlépő stat). A LEGERŐSEBB kézműves tell. Bizonyíték: a `fullbleed-glass` üveg-sávja az
     EGYETLEN mai interlock, ezért érződik a legjobbnak. Legdrágább, de a legnagyobb „nem-sablon" hozadék.
  5. **Fotó-derivált paletta (§B.6)** — a `SiteData.palette.accent` mező MÁR LÉTEZIK, de a harmonizáló `engine/palette.ts`
     MÉG NINCS megírva. Kell: vízió-extrakció a briefben + akcent-hue a skin biztonságos sínjeire húzva (világos/sötét
     karaktert sosem borítva).
  6. **Szerkesztői fotó-szerepek** — `Photo.role?: "dominant"|"detail"|"mosaic"` → eltérő crop/méret. Determinisztikus.
  7. **Narratív copy-ív** — a `copywriter.ts` az oldalt EGY ívként írja (átvezető sorok), nem per-modul generikusan.
  (A 4. „aszimmetria"-tell részben már az `editorial-press`-ben él → több archetípusra általánosítjuk, nem külön munka.)
- **Központi fojtópont:** mind a 7 egyetlen helyen fut össze — `RECIPE_SCHEMA` + `planRecipe` prompt bővítése + a render,
  ami tiszteletben tartja. A briefnek LÁTNIA kell a fotókat (vízió) a fókusz/paletta/crop döntéshez.
- **ELFOGADOTT SORREND (tulaj, 2026-08-06) — a styling-session ebből indul:**
  1. **① restraint + ② fókusz** együtt (a „bedobált→megtervezett" érzés ~60-70%-a, olcsó).
  2. **④ interlock** (a maradék rés legnagyobb egyedi darabja).
  3. **③ ritmus + ⑤ paletta + ⑥ crop** (kohézió-réteg). + ⑦ copy-ív folyamatosan.
- **Visszafordíthatóság:** 🔄 könnyű — additív recept-mezők (mind opcionális → régi receptek változatlanul renderelnek,
  mock=live megőrizve); a render determinisztikus marad. Egyirányú elem nincs.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-06, deliberációs session). Implementáció a KÖVETKEZŐ (styling) sessionben.
  Mérce változatlan: `assets/design-refs/reference-quality/` (ADR-0018). Kiküldés-kapu: `tenyhuseg-or` + `dizajn-doktrina-or`.
