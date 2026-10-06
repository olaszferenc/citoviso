# 2026-10-06 — Rendelés-panel mérése + riport (A + B) megvalósítva

**Kérés:** a kiküldött linken mérjük, megnyomták-e az „Itt rendelheti meg” gombot, és mi történt a panelen belül.
**Döntés:** ADR-XXXX (a land adja a számot). Jóváhagyott terv: `assets/design-refs/console/rendeles-panel/`.

## Elvégezve
- Konfigurátor: `panel_open.via`, új `panel_close`, panel-idő (`panel_collapse/close.seconds`, `dwell_end.panel_seconds`).
  Fej nélküli böngészőben 390 px-en és asztalin ellenőrizve: a beacon-ok helyesek, JS-hiba 0.
- Viselkedés lap: új „Rendelés-panel” panel a KPI-k után: chip-szűrő (`pv`), 4 KPI, lépcső + „Mit csinált közben”
  és leadenkénti lista kibontható idővonallal; JS nélkül (`<details>`), mobilon kártyás nézet `@container`-rel.
- Tevékenység lap: minden konfigurátor-esemény magyar feliratot kap, a `section_seen` sorok rejtve, a `via` zárójelben.
- KB `console.report` új szakasz + `behaviour.png` frissítve + új `order-panel.png`; a kb-shot minta-adat
  determinisztikusan bővítve.

## Módosított fájlok
`assets/runtime/cit-configurator.js` · `src/console/{reportData,reportViews,views,server}.ts` ·
`public/assets/ui/citui-console.css` · `src/i18n/catalog.json` · `scripts/kb-shot.mts` ·
`kb/entries/console-report/{entry.hu.md,assets/hu/behaviour.png,assets/hu/order-panel.png}` · ADR + ez a jegyzet + MEMORY.md

## Nyitott
- Nincs élesítve (nagy deploy). Élesen csak az élesítés UTÁNI látogatásoknak lesz `via`-ja és panel-ideje.
- `partnerData.ts` saját esemény-feliratai régiek maradtak; a Tevékenység lap időpontja UTC-szelet (a riporté Budapest).
