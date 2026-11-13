# 2026-11-13 — Megnyitás csatornánként kártya az Irányítópulton

**Brief:** `~/rc-briefs/report-20261113-071126.md` · **Fa:** `cit9a954e9b` · **Tulaj:** „B mehet” · ADR-0441

## Elvégzett munka
- Élesből mért (csak olvasás) számok a tervhez: 7 nap — e-mail 79/390 (20,3%), SMS/MMS 4/109, Viber 0/55,
  WhatsApp 3/53; összes — e-mail 146/797 (18,3%), SMS/MMS 125/1055 (11,8%).
- §2b: A/B/C mock (táblázat / csempék / sávok), mobil + asztali → tulaj „B”; befagyasztva
  `assets/design-refs/console/csatorna-megnyitas/` (README köt).
- Kód: `src/console/openChannels.ts` (számolás a Riport `loadProspectFacts`-ából), `src/console/openChannelsViews.ts`
  (kártya), bekötés `views.ts` + `server.ts`, Riport panel horgonyok + hash-lenyitás (`reportViews.ts`), CSS
  `citui-console.css` (`oc-*`, színek a Riport `rp-os-*`).
- Őr: `scripts/open-channels-check.mts` (+ `--self-test`), pre-commit bekötve. KB: `console-dashboard` új szakasz,
  `kb-check` operator-csoport bővítve.

## Nyitott
- ✅ ÉLESEN 2026-11-13 10:32: `21fee6ff` (`prod/20261113-1032`), csak a kártya (tulaj „csak a kártya”): hotfix-ág az éles `977f90f1`-re, Bábel 6 felirata (6754762c) átvéve, a mainbe `-s ours` merge (`1adeb7a4`). Élő adat 10:35: ma e-mail 19/188, 7 nap e-mail 100/588, SMS/MMS 4/124, Viber 0/55, WhatsApp 3/53.
- Az SMS/MMS 7 napos „kapta” (109) magasabb a tényleges SMS/MMS-küldésnél is lehet: a `touchesOf` a messenger-küldés
  nélküli `sms_sent_at`-ot SMS-nek veszi (ADR-0435 ④) — ha a szám gyanús, ott kell vizsgálni.
