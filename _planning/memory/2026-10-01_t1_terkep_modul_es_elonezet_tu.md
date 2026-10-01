# T-1: a megvett Térkép-modul hiányzott az élő oldalról; H-1 óriás előnézeti tű; L-5 nem hiba (2026-10-01)

SUB-szál (koordinátor: CIT „élesi teszt”, `cit87d3f275`) · brief: `~/rc-briefs/javitas-elek-0930/t1-terkep-modul.md`
· forrás-lelet: Elek élesi jelentése (`~/wt/citec0aeb80/_elek/JELENTES.md`, T-1 / H-1 / L-5).

## T-1 (MAGAS) — gyökér: `moduleContentFor()` (`src/tenant/editor.ts`)
- A `location` modult CSAK megközelítés- vagy parkolás-szöveg mellett adta át a renderelőnek. Friss vásárlásnál
  (a konverzió NEM ír `site_module_config` sort) és „csak térkép” beállításnál a renderelő „nincs location”-t látott,
  a `locationBlock()` ezt „térkép kikapcsolva”-nak olvasta → az élő HTML-ből hiányzott a `data-cit-module="map"`.
- Élesen OLVASVA megerősítve: a `teszt-muschel-panzio` (23d59f37…) bérlőnek NINCS location config-sora.
- Lokálban reprodukálva: dev `1b7863dc…` (showMap=true, üres szövegek) és `a122ab93…` (nincs sor) → 0 térkép.
- Javítás: amíg a modul be van kapcsolva, a `location` MINDIG átmegy (showMap + a két szöveg). Cím/koordináta nélkül a
  renderelő továbbra is őszintén elhagyja. A kikapcsolt térkép (showMap=false) továbbra is eltűnik.
- Miért nem fogta meg a `module-render-check`: kézzel épített SiteData-val indul, a hibás réteg UTÁN.
- Dev visszamérés: `1b7863dc…` újrarenderelve → `data-cit-module="map" data-cit-query="46.75…,17.34…"`, kép:
  `assets/design-refs/_drafts/t1/t1-utana-dev-elo-{d,m}.png` (gitignore-olt, a land törli).

## Ugyanígy elveszhet-e más? — a mátrix-őr lelete: `usp` (külön gyökér)
- Új őr: `scripts/paid-module-anchor-check.mts` — eldobható dev-bérlő, minden megvehető modul, VALÓDI összerakás
  (`effectiveSiteForMultilang`) × 19 sablon; invariáns: megvett lapmodul = horog az élő lapon ∨ „kifizette, de üres” sor.
  + Elek-állapot, negatív kontroll (kikapcsolt térkép), végpontig (`rerenderTenantSnapshot` fájlja). Önteszt: 4 bukás.
  Valódi mutációval (régi editor.ts) 5 bukás, exit 1. Bekötve: `hooks/pre-commit`.
- Első futásra a `usp` („Miért Önt válasszák”) horga hiányzott a `card-sidebar`-on (div-blokkok, nincs `<section>`) és a
  `dopamine`-on (az első kiemelés a hős-matricán áll, szakaszon kívül; a bélyegző ott feladta). A TARTALOM látszott,
  csak a horog nem. Javítás: `stampSellingPointsAnchor` minden előfordulást végignéz és csak BEFOGLALÓ `<section>`-t
  bélyegez (a már lezárt előzőt nem); a card-sidebar natív kiemelés-blokkja maga viseli a horgot. Előtte/utána mérve:
  csak ez a két sablon változott (élő + mock).

## H-1 (KÖZEPES) — más gyökér: a konzol `tpl-preview` útja runtime nélkül ment ki
- A `.cit-map-pin svg {34px}` csak a `assets/runtime/cit-modules.css`-ben él; a kész mock `injectRuntime()`-mal kapja,
  a kinézet-előnézet nem → a tű a teljes oszlopot kitöltötte (mérve 1012–1124 px, mind a 19 sablonon).
- Javítás: új `src/console/tplPreview.ts` (`renderTemplatePreview` = renderSite + injectRuntime), a route ezt hívja.
- Őr: `scripts/tpl-preview-runtime-check.mts` — böngészőben mért tű-doboz ≤ 48 px, 19 sablon; önteszt + mutáció piros.
- Képek: `assets/design-refs/_drafts/t1/h1-{elotte,utana}-editorial-{d,m}.png`.

## L-5 (ALACSONY) — NEM termékhiba
- A Google-beágyazás headless Chromiumban is betölt, ha a keret a nézetbe görgetődik (mérve, kép a jegyzet készítésekor).
  Elek üres kerete a `loading="lazy"` iframe + teljes-lapos screenshot mellékterméke (a keret sosem került nézetbe).
  A tű-kártya szándékosan átlátszik az üres kereten (moduleSections.ts megjegyzése).

## Nyitott / a koordinátoré
- Élesen a meglévő bérlők (ma 1, deaktivált) újrarenderelése + deploy: a koordinátoré, a tulaj engedélyével.
- A `paidButEmptyModules` továbbra is azt mondja, a `location` „mindig renderel” — cím ÉS koordináta nélküli bérlőnél
  ez nem igaz (szélső eset, nem mért élesen).

## Módosított fájlok
- `src/tenant/editor.ts` · `src/engine/render.ts` · `src/engine/templates/cardSidebar.ts` · `src/console/server.ts`
- új: `src/console/tplPreview.ts` · `scripts/paid-module-anchor-check.mts` · `scripts/tpl-preview-runtime-check.mts`
- `hooks/pre-commit` (két új kapu) · ez a jegyzet · `MEMORY.md`
