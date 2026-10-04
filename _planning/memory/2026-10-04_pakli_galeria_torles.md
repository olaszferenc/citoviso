# 2026-10-04 — A kártyapakli-galéria runtime-kódjának törlése

**Szál:** SUB a CIT koordinátor („mock-összehasonlító / Kapunyitás”) alatt; brief `~/rc-briefs/pakli-galeria-torles.md`.
**Tulaj-döntés:** „2. igen töröljük” (2026-10-04, a koordinátoron át).

## Mérés a törlés előtt
- Repó-grep (src, assets/runtime, scripts, hooks, design-refs, DOMAIN): a `data-cit-gdeck`/`data-cit-gcards` horgot
  CSAK a runtime `mountGalleryDeck` olvasta; a CSS-ben és az i18n-katalógusban nincs pakli-saját tétel
  (a lapozó feliratai — „Előző kép” / „Következő kép” — a sávval közösek, maradnak).
- Renderelve: 21 sablon × mock/élő = 42 lap, 0 horog.
- Régi mockok: a runtime-ot az `injectRuntime` BEÁGYAZZA a lapba, és a már beágyazottat nem cseréli
  (minden újra-injektálás `renderSite`-ból, friss markuppal megy). A helyi `sites/`-ben 4 régi lap hordoz paklit
  — a saját runtime-példányukkal, tehát a törlés nem töri el őket.

## Elvégzett munka
- `assets/runtime/cit-runtime.js`: `mountGalleryDeck` és hívása törölve; a `wirePager` körbe-lapozó (`wrap`) ága is
  (csak a pakli használta).
- `scripts/gallery-reach-check.mts`: a `[data-cit-gcards]` kilógás-mentesség (halott ág) és a pakli-említések ki.
- `assets/design-refs/tenant-site/gallery-cap/README.md`: a wordmark-grow pont mellé a törlés ténye; a no-JS pontból a pakli ki.
- Komment-igazítás: `assets/runtime/cit-modules.css`, `src/engine/templateKit.ts`.
- Kapu: `gallery-reach-check` zöld + `--self-test` mindkét piros kontrollja elkap.
