# 2026-09-01 — Hero-olvashatóság őr+scrim + fizetés-váltó az 1. lépésre (ADR-0090)

## Kiváltó
Tulajdonosi hibajelentés két képernyőképpel: (1) a Rozé Fogadó mock heróján a főcím akcent-része
beleolvad a világos fotóba (olvashatatlan) — „fel lehet állítani valami őrt?"; (2) a fizetési
modálon mobilon nem találta, hogyan váltson éves→havi fizetésre.

## Előzmény — a fa 19 committal LE VOLT MARADVA
A képernyőkép ajánlat-UI-t (ADR-0088 intro −25%, áthúzott listaár) mutatott, ami a munkafában
NEM volt meg → `git rebase origin/main` (2b2b9a7 → 63c07bc) MIELŐTT bármit terveztem. Tanulság
megerősítve: stale fából ne tervezz.

## Irány (jóváhagyva, AskUserQuestion) — mindkettőre B
- Kontraszt: **őr + auto-javítás**.
- Fizetés-váltó: **kártyás választó az 1. lépésen**.
§2b felület-kapu végigfutva: mock (`_drafts/`) → ui-shot 390+desktop (Read-del megnézve) →
SendUserFile (mindkét méret + kattintható HTML) → jóváhagyás → `surface-gate.mjs approve` →
kód → kontraktus befagyasztva `design-refs/`-be README-vel.

## ① Hero-cím olvashatóság
- **Ok:** fotó-overlay heróskban a főcím dőlt része `color-mix(--cit-accent,#fff)` = világos;
  a scrim vagy statikus gyenge (`fullbleed/parallax/cinematic`), vagy `--cit-bg`-alapú → light
  skinen eltűnik (`dark-luxury/horizontal`). Rozé mérve **1,08:1**.
- **Őr — `scripts/hero-contrast-check.mts` (ÚJ):** MÉR, nem tippel. Minden sablont worst-case
  világos hero-fotóval renderel (`renderSite`), Playwrighttal megméri a hero-cím `em` tényleges
  renderelt színét ÉS a mögötte lévő (scrim+fotó) képpont-átlagot (a h1 elrejtve → clip-screenshot
  → canvas-átlag), WCAG-kontraszt a `palette.ts` képletével, buktat **3,0:1** alatt. ⭐ CSAK
  fotó-overlay heróst mér (a cím dobozát metsző fotó/kép-réteg detektálása) → `brutalism` (tömör
  bal-háttéren ülő cím) helyesen kizárva. Pre-commitba kötve (`hero-contrast-check`), trigger:
  `src/engine/(templates/|skins.ts|palette.ts|render.ts)`.
- **Auto-javítás (B) — 5 sablon scrimje:** semleges sötét scrim-alap a szöveg-sávban, skin-független;
  a világos akcent-szín marad, a fotó fokozatosan sötétül (nincs fekete sáv). Baseline→fix:
  cinematic 2,22→3,10 · parallax 2,96→3,61 · horizontal 2,07→3,87 · dark-luxury 2,31→4,11 ·
  fullbleed 2,82→4,85. Vizuálisan 3 sablonon (390+desktop) ellenőrizve: olvasható, fotó megmarad.
- ⚠️ **Csapda menet közben:** a worst-case fotó SVG data-URI-jában `xmlns='...'` EGYSZERES
  idézőjelek a template `url('...')` burkolását idő előtt zárták → a fotó nem renderelt és a
  detektálás bukott. Javítva `%22`-kódolt idézőjelekkel.

## ② Fizetés-váltó az 1. lépésen (B — kártyás)
- **Ok:** a `Havi/Éves` váltó a 2. lépésen (`.cit-cfg-step2`, rejtett) ült, míg az éves ár már az
  1. lépésen látszott váltó nélkül → mobilon felfedezhetetlen.
- **Fix:** a váltó átkerült az 1. lépés láblécébe, közvetlenül az ár fölé (`.cit-cfg-permat` két
  opció-kártya, éves kedvezmény badge-ként); a 2. lépésen 0 váltó maradt. A pinnelt lábléc miatt
  mobilon mindig látszik. Éves marad az alapértelmezett; valós árazás + ADR-0088 ajánlat-kártya
  változatlan. `configurator-price-check` az új `.cit-cfg-popt` class-ra állítva. Valódi
  konfigurátoron (injectConfigurator + Playwright) igazolva: éves 77 850 Ft/év → Havi 7 785 Ft/hó,
  kártya aktiválódik, JS-hiba 0.

## Módosított / létrehozott fájlok
- `assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css` — váltó az 1. lépésre (B)
- `scripts/configurator-price-check.mts` — `.cit-cfg-popt` class-horgony
- `src/engine/templates/{fullbleed,parallax,cinematic,darkLuxury,horizontal}.ts` — scrim-alap
- `scripts/hero-contrast-check.mts` — ÚJ mérő-őr
- `hooks/pre-commit` — hero-contrast-check bekötve
- `src/i18n/catalog.json` — 4 új kulcs (Fizetési gyakoriság, rugalmas bármikor, a legjobb ár, {n} hó ingyen)
- `assets/design-refs/console/period-toggle-step1/{plan.html,README.md}` — kontraktus
- `assets/design-refs/engine/hero-contrast/{plan.html,README.md}` — kontraktus
- `_planning/DECISIONS.md` — ADR-0090

## Kapuk (mind zöld)
tsc · i18n-lint · configurator-price-check · configurator-placement-check · native-content-check ·
mobile-sticky-check (27/27) · hero-contrast-check (5/5 ≥3,0).

## Nyitott / következő
- **Élesítés NEM történt** (§0.3 — külön tulaj-engedély kell).
- A `brutalism` hero-címe tömör háttéren 2,89:1 (accent-on-bg) — KÜLÖN kérdés (skin-akcent
  luminancia, nem scrim), nem ADR-0090 hatóköre; ha felmerül, önálló döntés.
- A `dark-luxury`/`horizontal` a valódi SÖTÉT skinjükkel eddig is olvasható volt; a semleges alap
  ott ártalmatlan (nincs fekete sáv, ellenőrizve), a light-skin párosítást védi ki.
