# 2026-10-31 — Riport: lead típus szűrő + ítélet-színű kártya-fejléc

**Kérés (tulaj, 2026-10-27, brief `~/rc-briefs/report-20261027-213948.md`):** „kellene egy szűrő, hogy lead
típus szerint hogy alakulnak a mutatók: nincs honlap, van honlap de szar, stb.” — majd (10-28) „ha már
hozzányúlunk”: a KPI-kártyák fejléce emelje ki jobban, vezesse a szemet → 5 változat, tulaj: **„A”**.

## Elvégezve (landolva `4291beae`, ÉLESEN NINCS)
- `?seg=` (`REPORT_SEGS`: nincs_honlap · 0_labnyom · van_labnyom · elavult · ismeretlen) a Tölcsér és a
  Viselkedés fülön. A `foldReport` a bemenetet szűri, így MINDEN szám (kártyák, előző időszak, heti görbék,
  Visszatérés, Bontás, Kohorsz, idővonal, Viselkedés) az adott típusra és annak SAJÁT múltjára szól.
  A szűrő a `qs()`-en át minden linken, és a napló-űrlapon át is megmarad.
- KPI-kártya „A”: a kérdés a cím (display, 17px, 700, `--citui-ink-brand`), a felső 4px-es szél az ítélet
  színe; az ítélet osztályként (`rp-hcard--ok|warn|bad|none`) él a kártyán.
- Befagyott terv: `assets/design-refs/console/riport-leadtipus/` (README + kattintható mock + képek).

## Módosított fájlok
- `src/console/reportData.ts`, `src/console/reportViews.ts`, a konzol route-fájlja (`src/console/server.ts`)
- `public/assets/ui/citui-console.css`
- `src/i18n/catalog.json`, `src/i18n/catalog-context.json`
- `assets/design-refs/console/riport-leadtipus/*`

## Tanulság
- A §2b kaput a commit-kapu fogta meg: képet küldtem, a kattintható mockot csak a tulaj „mock?” kérdésére.
  A felület-munka ELSŐ körébe a működő mock is kell.
- A riport-mock önhordóan legyártható a valódi `foldReport` + nézet kódjából szintetikus tényekkel
  (a `kb-shot.mts` `rpFacts` fixture-je), a CSS-t inline-olva, iframe-ben mobil/asztali váltóval.

## Nyitott
- Élesítés: a következő deployjal (külön tulaj-utasítás).
- Ötlet: darabszám a választóban („Nincs honlap (211)”).
