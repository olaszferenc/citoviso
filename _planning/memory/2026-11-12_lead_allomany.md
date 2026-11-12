# 2026-11-12 — Lead-állomány a CRM-kártya helyett + Visszatérés csatorna-badge

**Session:** `cit3bb1b313` · brief `~/rc-briefs/ir-ny-t-pult-20261112-080759.md` · ADR-0438 · tulaj: „terv ok. B változat” (a Messenger-út helyőrző doboza nélkül).

## Elvégezve
- Irányítópult: a CRM-kártya helyén teljes szélességű „Lead-állomány” sor — állapot-tábla (saját kép / település-stock / semmilyen kép × darab / ebből kiküldött / generálásra vár / kiküldhető), csatorna szerint (E-mail / Messenger / MMS / Mind), generálásra vár ok szerint. Időszak-gomb Ma / 7 nap / 1 hónap / Összes (alap: Összes), a Lead-állomány és a Megkeresések kártyára hat; a Messenger-út változatlan.
- Riport: új „Lead-állomány” fül (`/report/leads`) — KPI-k, százalék + sáv, részletes várakozás (4 ok), csatorna, fogalom-magyarázat.
- Minden szám a `/leads?stock=<kat>.<oszlop>&stockDays=` szűrt listára visz, sávval és visszalinkkel.
- Riport / Visszatérés: lenyitott sorban csatorna-badge (E-mail/SMS/Viber/WhatsApp/Nem eldönthető).
- Élesítve: `3ef0918e` (`prod/20261112-1239`), élő ellenőrzés az `elek` fiókkal. Megjegyzés: 08:29 UTC-kor élesen kicsekkolták az `a38aa22d`-t újraindítás és DEPLOYED-sor nélkül; ez a deploy azt is rendbe tette.

## Fájlok
`src/console/leadStock.ts` (új), `src/console/leadStockViews.ts` (új), `src/console/views.ts`, `src/console/reportViews.ts`, `src/console/reportData.ts`, `src/console/` szerver-útvonalak, `src/console/data.ts`, `public/assets/ui/citui-console.css`, `src/i18n/catalog*.json`, `assets/design-refs/console/lead-allomany/`, `_planning/decisions/0438-lead-allomany-a-crm-kartya-helyett-keptipus.md`.

## Nyitott
- Élesen a „település / stock” sor: 0 kiküldött, 809 kiküldhető — kivizsgálandó (besoroló vagy adat).
