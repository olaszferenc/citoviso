# 2026-10-06 — Szerkeszthetőség-sáv a kiküldött mockon (ADR-0335)

**Elvégezve.** A jóváhagyott terv (`assets/design-refs/prospect-page/edit-strip/`) megvalósítva a
konfigurátor-futtatóban: görgetés után (a szobák szakasza a képernyő közepére ér, vagy 1 képernyőnyi
görgetés — amelyik előbb) felülre egyszer becsúszó, bezárható sáv. Felirat `tr()`-rel, ceruza-ikon cián
pöttyel, × 44 px. A bezárás artefaktumonként `localStorage`-ban (`cit-edit-strip-closed:<artifactId>`),
privát módban csak memóriában. Réteg: 2147482990 (a scrim alatt → panel és döntés-kártya mindig fölötte),
a páncél-blokkban is. A vásárolt-lead ág a futtatót nem kapja → ott nincs sáv (ellenőrizve: `server.ts`
owned-ág csak `injectOwnedNotice/Banner`).

**Ellenőrzés.** Playwright 4 mockon (editorial, aurora, cinematic, + horog nélküli artdeco), 390 és
1280 px: betöltéskor nincs, 120 px görgetésre nincs, később megjelenik, × után és újratöltés után sem
jön vissza, JS-hiba 0. Kapuk zöldek: contract-drift, i18n-lint, design-token-lint, lead-page-surface,
configurator-float, lead-mobile (`--gate`).

**Módosított fájlok.** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css` ·
`src/i18n/catalog.json` · a terv (`assets/design-refs/prospect-page/edit-strip/*`) · ADR.

**Nyitott.** Élesre csak a nagy deployjal. Megjelenés/bezárás nincs mérve (tulaj nem kérte).
